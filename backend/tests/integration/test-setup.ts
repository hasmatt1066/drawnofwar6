/**
 * Integration Test Setup Utilities
 *
 * Provides shared setup and teardown functionality for integration tests.
 * Uses real Redis (db 15 for testing) and real BullMQ components.
 */

import { Redis } from 'ioredis';
import { QueueManager, QueueServiceConfig } from '../../src/queue/queue-manager.js';
import { QueueWorker } from '../../src/queue/worker.js';
import { JobSubmitter } from '../../src/queue/job-submitter.js';
import { JobProcessor } from '../../src/queue/job-processor.js';
import { CacheManager } from '../../src/cache/cache-manager.js';
import { RedisCache } from '../../src/cache/redis-cache.js';
import { FirestoreBackup } from '../../src/cache/firestore-backup.js';
import { DeduplicationManager } from '../../src/cache/deduplication-manager.js';
import { ProgressIntegrator } from '../../src/progress/progress-integrator.js';
import { SSEManager } from '../../src/progress/sse-manager.js';
import { PollingManager } from '../../src/progress/polling-manager.js';
import { RetryManager } from '../../src/retry/retry-manager.js';
import { DLQHandler } from '../../src/retry/dlq-handler.js';
import { ErrorClassifier } from '../../src/retry/error-classifier.js';
import { OverflowProtection } from '../../src/queue/overflow-protection.js';
import { UserLimits } from '../../src/queue/user-limits.js';
import { MockPixelLabClient, MockPixelLabClientConfig } from '../mocks/pixellab-client-mock.js';

/**
 * Test environment configuration
 */
export const TEST_CONFIG: QueueServiceConfig = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    db: 15, // Test database (separate from production)
  },
  firestore: {
    projectId: 'test-project',
  },
  queue: {
    name: 'test-generation-queue',
    concurrency: 5,
    maxJobsPerUser: 5,
    systemQueueLimit: 500,
    warningThreshold: 400,
  },
  cache: {
    ttlDays: 30,
    strategy: 'redis-firestore' as const,
  },
  retry: {
    maxRetries: 3,
    backoffDelay: 1000,
    backoffMultiplier: 2,
  },
  sse: {
    updateInterval: 2000,
    keepAliveInterval: 5000,
  },
};

/**
 * Test environment context
 */
export interface TestContext {
  redis: Redis;
  queueManager: QueueManager;
  cacheManager: CacheManager;
  jobSubmitter: JobSubmitter;
  worker: QueueWorker;
  jobProcessor: JobProcessor;
  mockClient: MockPixelLabClient;
  progressIntegrator: ProgressIntegrator;
  sseManager: SSEManager;
  retryManager: RetryManager;
  dlqHandler: DLQHandler;
  overflowProtection: OverflowProtection;
  userLimits: UserLimits;
}

/**
 * Setup test environment
 *
 * Creates all queue components using real Redis and BullMQ.
 * Uses MockPixelLabClient for API interactions.
 */
export async function setupTestEnvironment(
  mockConfig: MockPixelLabClientConfig
): Promise<TestContext> {
  // Create Redis client
  const redis = new Redis({
    host: TEST_CONFIG.redis.host,
    port: TEST_CONFIG.redis.port,
    db: TEST_CONFIG.redis.db,
  });

  // Flush test database
  await redis.flushdb();

  // Create QueueManager
  const queueManager = new QueueManager(TEST_CONFIG);
  await queueManager.initialize();

  // Create logger
  const logger: any = { enabled: false };

  // Create CacheManager
  const redisCache = new RedisCache(redis, TEST_CONFIG, logger);

  // Mock Firestore (we don't want to use real Firestore in tests)
  const mockFirestore: any = {
    collection: () => ({
      doc: () => ({
        set: async () => {},
        get: async () => ({ exists: false }),
      }),
    }),
  };

  const firestoreBackup = new FirestoreBackup(
    mockFirestore,
    TEST_CONFIG,
    logger
  );

  const cacheManager = new CacheManager(redisCache, firestoreBackup);

  // Create Progress components
  const sseManager = new SSEManager(TEST_CONFIG, logger);

  const pollingManager = new PollingManager(redis, TEST_CONFIG, logger);

  const progressIntegrator = new ProgressIntegrator(
    redis,
    sseManager,
    pollingManager,
    logger
  );

  // Create Retry components
  const errorClassifier = new ErrorClassifier();

  const dlqHandler = new DLQHandler(queueManager.getQueue(), logger);

  const retryManager = new RetryManager(
    errorClassifier,
    dlqHandler,
    TEST_CONFIG,
    logger
  );

  // Create Overflow protection
  const overflowProtection = new OverflowProtection(
    TEST_CONFIG,
    logger
  );

  // Create User limits
  const userLimits = new UserLimits(redis, TEST_CONFIG, logger);

  // Create JobSubmitter
  const jobSubmitter = new JobSubmitter(
    queueManager,
    cacheManager,
    overflowProtection,
    userLimits,
    logger
  );

  // Create MockPixelLabClient
  const mockClient = new MockPixelLabClient(mockConfig);

  // Create adapters to make MockPixelLabClient compatible with JobProcessor
  // The mock client uses a simplified interface, so we need to wrap it
  const mockSpriteGenerator: any = {
    submitGeneration: async (request: any) => {
      const result = await mockClient.generateSprite(request);
      return {
        characterId: result.characterId,
        name: result.name,
      };
    },
  };

  const mockStatusPoller: any = {
    pollUntilComplete: async (characterId: string) => {
      // For testing, we assume the job is already complete
      // since MockPixelLabClient.generateSprite returns the full result
      return {
        characterId,
        status: 'COMPLETED',
        characterData: {
          id: characterId,
          name: 'Test Character',
          created: new Date().toISOString(),
          specifications: { directions: 8, canvas_size: '48x48', view: 'low top-down' },
          style: { outline: 'black', shading: 'basic', detail: 'medium' },
          rotations: [],
          download_url: `https://example.com/${characterId}/download.zip`,
        },
      };
    },
  };

  // Create JobProcessor
  const jobProcessor = new JobProcessor(
    mockSpriteGenerator,
    mockStatusPoller,
    cacheManager,
    progressIntegrator,
    errorClassifier,
    logger
  );

  // Create Worker
  const worker = new QueueWorker(queueManager, jobProcessor, logger);

  await worker.start();

  return {
    redis,
    queueManager,
    cacheManager,
    jobSubmitter,
    worker,
    jobProcessor,
    mockClient,
    progressIntegrator,
    sseManager,
    retryManager,
    dlqHandler,
    overflowProtection,
    userLimits,
  };
}

/**
 * Teardown test environment
 *
 * Cleans up all resources and closes connections.
 */
export async function teardownTestEnvironment(
  context: TestContext
): Promise<void> {
  // Stop worker
  await context.worker.stop();

  // Close queue connections
  await context.queueManager.close();

  // Close Redis
  await context.redis.quit();

  // Reset mock client
  context.mockClient.reset();
}

/**
 * Wait for job to complete
 *
 * Polls Redis for job completion with timeout.
 */
export async function waitForJobCompletion(
  redis: Redis,
  jobId: string,
  timeoutMs: number = 10000
): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const jobData = await redis.get(`bull:test-generation-queue:${jobId}`);

    if (jobData) {
      const job = JSON.parse(jobData);
      if (job.finishedOn) {
        return true;
      }
    }

    // Wait 100ms before checking again
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return false;
}

/**
 * Get job result from cache
 */
export async function getJobResult(
  cacheManager: CacheManager,
  cacheKey: string
): Promise<any> {
  const result = await cacheManager.get(cacheKey);
  return result?.data;
}
