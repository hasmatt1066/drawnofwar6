/**
 * Task 8.4: Load Testing for 50+ Concurrent Jobs
 *
 * Tests queue performance under high concurrency with 50+ concurrent job submissions.
 * Validates throughput, latency, cache behavior, and system stability.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Redis from 'ioredis';
import { Queue, Worker } from 'bullmq';
import { QueueManager, QueueServiceConfig } from '../queue/queue-manager.js';
import { JobSubmitter, StructuredPrompt } from '../queue/job-submitter.js';
import { JobProcessor } from '../queue/job-processor.js';
import { JobStatusTracker } from '../queue/job-status-tracker.js';
import { QueueLogger } from '../queue/logger.js';
import { CacheManager } from '../cache/cache-manager.js';
import { RedisCache } from '../cache/redis-cache.js';
import { MetricsCollector } from '../metrics/metrics-collector.js';
import {
  createMockPixelLabClient,
  type MockClientConfig,
} from './mock-pixellab-client.js';
import {
  PerformanceMetrics,
  HealthMonitor,
  createTestPrompt,
  createDuplicatePrompt,
  formatMetrics,
} from './test-utilities.js';

/**
 * Load Test Configuration
 */
const LOAD_TEST_CONFIG: QueueServiceConfig = {
  redis: {
    host: 'localhost',
    port: 6379,
    db: 15, // Test database
  },
  firestore: {
    projectId: 'test-project',
  },
  queue: {
    name: 'load-test-queue',
    concurrency: 5,
    maxJobsPerUser: 10,
    systemQueueLimit: 500,
    warningThreshold: 400,
  },
  cache: {
    ttlDays: 30,
    strategy: 'aggressive' as const,
  },
  retry: {
    maxRetries: 1,
    backoffDelay: 5000,
    backoffMultiplier: 2.0,
  },
  sse: {
    updateInterval: 2500,
    keepAliveInterval: 30000,
  },
  deduplication: {
    windowSeconds: 10,
  },
};

describe('Load Tests - Task 8.4: Concurrent Job Submissions', () => {
  let redis: Redis;
  let queueManager: QueueManager;
  let jobSubmitter: JobSubmitter;
  let jobStatusTracker: JobStatusTracker;
  let workers: Worker[];
  let logger: QueueLogger;
  let metricsCollector: MetricsCollector;
  let cacheManager: CacheManager;

  beforeEach(async () => {
    // Create test Redis connection
    redis = new Redis({
      host: LOAD_TEST_CONFIG.redis.host,
      port: LOAD_TEST_CONFIG.redis.port,
      db: LOAD_TEST_CONFIG.redis.db,
      maxRetriesPerRequest: null,
    });

    // Clear test database
    await redis.flushdb();

    // Create logger (disabled for cleaner output)
    logger = new QueueLogger({ enabled: false });

    // Create metrics collector
    metricsCollector = new MetricsCollector(logger);

    // Create mock PixelLab client (10ms response time)
    const mockClient = createMockPixelLabClient({
      responseDelay: 10,
      successRate: 1.0,
      autoComplete: true,
    });

    // Create cache components
    const redisCache = new RedisCache(redis, LOAD_TEST_CONFIG, logger);
    const firestoreBackup = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
    } as any;
    cacheManager = new CacheManager(redisCache, firestoreBackup, LOAD_TEST_CONFIG, logger);

    // Create progress integrator (mocked)
    const progressIntegrator = {
      trackProgress: vi.fn().mockResolvedValue(undefined),
      broadcastUpdate: vi.fn().mockResolvedValue(undefined),
      broadcastStateChange: vi.fn().mockResolvedValue(undefined),
      broadcastCompletion: vi.fn().mockResolvedValue(undefined),
    } as any;

    // Create job processor with mock client
    const jobProcessor = new JobProcessor(
      mockClient.spriteGenerator as any,
      mockClient.statusPoller as any,
      cacheManager,
      progressIntegrator,
      logger
    );

    // Create queue manager
    queueManager = new QueueManager(LOAD_TEST_CONFIG, logger);
    await queueManager.initialize();

    // Create job submitter
    jobSubmitter = new JobSubmitter(queueManager, LOAD_TEST_CONFIG, logger);

    // Create job status tracker
    jobStatusTracker = new JobStatusTracker(queueManager, LOAD_TEST_CONFIG, logger);

    // Create workers
    workers = [];
    const workerCount = LOAD_TEST_CONFIG.queue.concurrency;

    for (let i = 0; i < workerCount; i++) {
      const worker = new Worker(
        LOAD_TEST_CONFIG.queue.name,
        async (job) => {
          const submittedAt = job.timestamp || Date.now();
          metricsCollector.recordJobStart(job.id!, submittedAt);
          const startedAt = Date.now();
          try {
            const result = await jobProcessor.processJob(job);
            const completedAt = Date.now();
            metricsCollector.recordJobComplete(job.id!, startedAt, completedAt);
            return result;
          } catch (error) {
            metricsCollector.recordJobFailed(job.id!);
            throw error;
          }
        },
        {
          connection: redis,
          concurrency: 1,
        }
      );

      workers.push(worker);
    }

    // Wait for workers to be ready
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  afterEach(async () => {
    // Stop all workers
    for (const worker of workers) {
      await worker.close();
    }

    // Close queue manager
    await queueManager.close();

    // Close Redis
    await redis.quit();
  });

  describe('Concurrent Job Submissions', () => {
    it('should handle 50 concurrent jobs without errors', async () => {
      const jobCount = 50;
      const perfMetrics = new PerformanceMetrics();

      // Submit 50 jobs concurrently
      const submissions = Array(jobCount)
        .fill(null)
        .map(async (_, i) => {
          const prompt = createTestPrompt(i);
          const userId = `user-${i % 10}`; // 10 different users
          const response = await jobSubmitter.submitJob(userId, prompt);
          perfMetrics.recordSubmission(response.jobId);
          return response;
        });

      const results = await Promise.allSettled(submissions);

      // Verify no submission errors
      const errors = results.filter((r) => r.status === 'rejected');
      expect(errors).toHaveLength(0);

      // Get all job IDs
      const jobIds = results
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
        .map((r) => r.value.jobId);

      // Wait for all jobs to complete
      const completionPromises = jobIds.map(async (jobId) => {
        return new Promise<void>((resolve, reject) => {
          const checkInterval = setInterval(async () => {
            try {
              const status = await jobStatusTracker.getJobStatus(jobId);
              if (status.status === 'completed') {
                perfMetrics.recordCompletion(jobId, true);
                clearInterval(checkInterval);
                resolve();
              } else if (status.status === 'failed') {
                perfMetrics.recordCompletion(jobId, false, status.errorMessage);
                clearInterval(checkInterval);
                resolve();
              }
            } catch (error) {
              clearInterval(checkInterval);
              reject(error);
            }
          }, 100);

          // Timeout after 60 seconds
          setTimeout(() => {
            clearInterval(checkInterval);
            reject(new Error(`Timeout waiting for job ${jobId}`));
          }, 60000);
        });
      });

      await Promise.all(completionPromises);

      perfMetrics.endTest();

      // Calculate metrics
      const queueMetrics = await metricsCollector.getMetrics();
      const loadMetrics = perfMetrics.calculate(
        queueMetrics.cache.hits,
        queueMetrics.cache.misses
      );

      // Log results
      console.log(formatMetrics(loadMetrics));

      // Verify performance targets
      expect(loadMetrics.successfulJobs).toBe(jobCount);
      expect(loadMetrics.failedJobs).toBe(0);
      expect(loadMetrics.errorRate).toBe(0);
      expect(loadMetrics.throughput).toBeGreaterThan(5); // At least 5 jobs/sec
      expect(loadMetrics.totalDuration).toBeLessThan(60000); // Complete within 1 minute
    }, 120000); // 2 minute timeout

    it('should handle thundering herd (all jobs submitted simultaneously)', async () => {
      const jobCount = 100;
      const perfMetrics = new PerformanceMetrics();
      const startTime = Date.now();

      // Submit ALL jobs at exactly the same time
      const submissions = await Promise.all(
        Array(jobCount)
          .fill(null)
          .map(async (_, i) => {
            const prompt = createTestPrompt(i);
            const userId = `user-${i % 20}`; // 20 different users
            const response = await jobSubmitter.submitJob(userId, prompt);
            perfMetrics.recordSubmission(response.jobId);
            return response;
          })
      );

      const submissionTime = Date.now() - startTime;

      expect(submissions).toHaveLength(jobCount);
      console.log(`Submitted ${jobCount} jobs in ${submissionTime}ms`);

      // Verify queue didn't crash
      const queueMetrics = await metricsCollector.getMetrics();
      expect(queueMetrics.jobCounts.pending + queueMetrics.jobCounts.processing).toBeGreaterThan(0);

      // Wait for all jobs to complete
      const jobIds = submissions.map((r) => r.jobId);
      const completionPromises = jobIds.map(async (jobId) => {
        return new Promise<void>((resolve) => {
          const checkInterval = setInterval(async () => {
            const status = await jobStatusTracker.getJobStatus(jobId);
            if (status.status === 'completed' || status.status === 'failed') {
              perfMetrics.recordCompletion(jobId, status.status === 'completed');
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);
        });
      });

      await Promise.all(completionPromises);
      perfMetrics.endTest();

      const loadMetrics = perfMetrics.calculate();

      console.log(formatMetrics(loadMetrics));

      // Verify system handled thundering herd
      expect(loadMetrics.errorRate).toBeLessThan(0.05); // < 5% error rate
      expect(loadMetrics.throughput).toBeGreaterThan(3); // At least 3 jobs/sec
    }, 180000); // 3 minute timeout

    it('should maintain sub-second queue wait time under load', async () => {
      const jobCount = 50;
      const healthMonitor = new HealthMonitor();

      // Start health monitoring
      healthMonitor.start(async () => await metricsCollector.getMetrics(), 500);

      // Submit jobs
      const submissions = await Promise.all(
        Array(jobCount)
          .fill(null)
          .map((_, i) => {
            const prompt = createTestPrompt(i);
            return jobSubmitter.submitJob(`user-${i % 10}`, prompt);
          })
      );

      // Wait for completion
      const jobIds = submissions.map((r) => r.jobId);
      await Promise.all(
        jobIds.map(
          (jobId) =>
            new Promise<void>((resolve) => {
              const checkInterval = setInterval(async () => {
                const status = await jobStatusTracker.getJobStatus(jobId);
                if (status.status === 'completed' || status.status === 'failed') {
                  clearInterval(checkInterval);
                  resolve();
                }
              }, 100);
            })
        )
      );

      healthMonitor.stop();

      // Check queue wait times
      const peakMetrics = healthMonitor.getPeakMetrics();

      console.log(`Peak Queue Wait Time: ${peakMetrics.maxQueueWait.toFixed(2)}ms`);

      // Verify sub-second wait time
      expect(peakMetrics.maxQueueWait).toBeLessThan(1000); // < 1 second
    }, 120000);
  });

  describe('Cache Performance Under Load', () => {
    it('should cache results correctly under concurrent load', async () => {
      const jobCount = 30;
      const duplicateCount = 20; // Submit 20 duplicate requests

      // Submit unique jobs
      const uniqueSubmissions = await Promise.all(
        Array(jobCount)
          .fill(null)
          .map((_, i) => {
            const prompt = createTestPrompt(i);
            return jobSubmitter.submitJob(`user-${i % 5}`, prompt);
          })
      );

      // Wait for unique jobs to complete
      await Promise.all(
        uniqueSubmissions.map(
          (response) =>
            new Promise<void>((resolve) => {
              const checkInterval = setInterval(async () => {
                const status = await jobStatusTracker.getJobStatus(response.jobId);
                if (status.status === 'completed' || status.status === 'failed') {
                  clearInterval(checkInterval);
                  resolve();
                }
              }, 100);
            })
        )
      );

      // Now submit duplicates (should hit cache)
      const duplicateSubmissions = await Promise.all(
        Array(duplicateCount)
          .fill(null)
          .map((_, i) => {
            const prompt = createTestPrompt(i % 10); // Reuse first 10 prompts
            return jobSubmitter.submitJob(`user-${i % 5}`, prompt);
          })
      );

      // Wait for duplicates to complete
      await Promise.all(
        duplicateSubmissions.map(
          (response) =>
            new Promise<void>((resolve) => {
              const checkInterval = setInterval(async () => {
                const status = await jobStatusTracker.getJobStatus(response.jobId);
                if (status.status === 'completed' || status.status === 'failed') {
                  clearInterval(checkInterval);
                  resolve();
                }
              }, 100);
            })
        )
      );

      // Check cache hit rate
      const metrics = await metricsCollector.getMetrics();

      console.log(`Cache Hits: ${metrics.cache.hits}`);
      console.log(`Cache Misses: ${metrics.cache.misses}`);
      console.log(`Cache Hit Rate: ${(metrics.cache.hitRate * 100).toFixed(1)}%`);

      // Verify cache is working (should have some hits from duplicates)
      expect(metrics.cache.hits).toBeGreaterThan(0);
      expect(metrics.cache.hitRate).toBeGreaterThan(0.1); // At least 10% hit rate
    }, 120000);

    it('should handle cache contention (multiple workers writing)', async () => {
      const jobCount = 50;
      const samePrompt = createDuplicatePrompt();

      // Submit same prompt from multiple users simultaneously
      const submissions = await Promise.all(
        Array(jobCount)
          .fill(null)
          .map((_, i) => {
            return jobSubmitter.submitJob(`user-${i}`, samePrompt);
          })
      );

      // Wait for all to complete
      await Promise.all(
        submissions.map(
          (response) =>
            new Promise<void>((resolve) => {
              const checkInterval = setInterval(async () => {
                const status = await jobStatusTracker.getJobStatus(response.jobId);
                if (status.status === 'completed' || status.status === 'failed') {
                  clearInterval(checkInterval);
                  resolve();
                }
              }, 100);
            })
        )
      );

      // Verify all jobs completed successfully despite cache contention
      const statuses = await Promise.all(
        submissions.map((r) => jobStatusTracker.getJobStatus(r.jobId))
      );

      const completed = statuses.filter((s) => s.status === 'completed');
      expect(completed.length).toBe(jobCount);

      // Cache should have high hit rate due to deduplication
      const metrics = await metricsCollector.getMetrics();
      console.log(`Cache Hit Rate: ${(metrics.cache.hitRate * 100).toFixed(1)}%`);
    }, 120000);
  });

  describe('User Limits Under Concurrent Load', () => {
    it('should enforce user limits under concurrent submissions', async () => {
      const maxJobsPerUser = LOAD_TEST_CONFIG.queue.maxJobsPerUser;
      const userId = 'test-user-limits';
      const jobCount = maxJobsPerUser + 10; // Try to exceed limit

      // Submit more jobs than limit allows
      const submissions = await Promise.allSettled(
        Array(jobCount)
          .fill(null)
          .map((_, i) => {
            const prompt = createTestPrompt(i);
            return jobSubmitter.submitJob(userId, prompt);
          })
      );

      // Some submissions should be rejected
      const accepted = submissions.filter((r) => r.status === 'fulfilled');
      const rejected = submissions.filter((r) => r.status === 'rejected');

      console.log(`Accepted: ${accepted.length}, Rejected: ${rejected.length}`);

      // Should reject submissions exceeding limit
      expect(rejected.length).toBeGreaterThan(0);
      expect(accepted.length).toBeLessThanOrEqual(maxJobsPerUser);
    }, 60000);
  });

  describe('System Stability', () => {
    it('should not deadlock under concurrent load', async () => {
      const jobCount = 75;

      // Submit jobs
      const submissions = await Promise.all(
        Array(jobCount)
          .fill(null)
          .map((_, i) => {
            const prompt = createTestPrompt(i);
            return jobSubmitter.submitJob(`user-${i % 15}`, prompt);
          })
      );

      // Monitor for deadlock (jobs stuck in processing)
      let previousProcessing = -1;
      let stuckCount = 0;

      for (let i = 0; i < 20; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const metrics = await metricsCollector.getMetrics();
        const currentProcessing = metrics.jobCounts.processing;

        if (currentProcessing > 0 && currentProcessing === previousProcessing) {
          stuckCount++;
        } else {
          stuckCount = 0;
        }

        previousProcessing = currentProcessing;

        // If jobs are stuck for 5+ seconds, likely deadlock
        if (stuckCount >= 5) {
          throw new Error('Deadlock detected: jobs stuck in processing state');
        }

        // If all jobs completed, break early
        if (metrics.jobCounts.processing === 0 && metrics.jobCounts.pending === 0) {
          break;
        }
      }

      // Verify no deadlock occurred
      const finalMetrics = await metricsCollector.getMetrics();
      expect(finalMetrics.jobCounts.completed).toBeGreaterThan(jobCount * 0.9); // At least 90% completed
    }, 120000);

    it('should remain healthy under sustained load', async () => {
      const healthMonitor = new HealthMonitor();
      healthMonitor.start(async () => await metricsCollector.getMetrics(), 1000);

      // Submit jobs in waves
      const waves = 5;
      const jobsPerWave = 20;

      for (let wave = 0; wave < waves; wave++) {
        const submissions = await Promise.all(
          Array(jobsPerWave)
            .fill(null)
            .map((_, i) => {
              const prompt = createTestPrompt(wave * jobsPerWave + i);
              return jobSubmitter.submitJob(`user-${i % 10}`, prompt);
            })
        );

        // Wait a bit between waves
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      // Wait for all jobs to drain
      await new Promise((resolve) => setTimeout(resolve, 10000));

      healthMonitor.stop();

      // Verify system remained healthy
      expect(healthMonitor.isHealthy()).toBe(true);

      const peakMetrics = healthMonitor.getPeakMetrics();
      console.log('Peak Metrics:', peakMetrics);

      // Verify reasonable bounds
      expect(peakMetrics.maxPending).toBeLessThan(500);
      expect(peakMetrics.maxProcessing).toBeLessThan(50);
    }, 120000);
  });
});
