/**
 * Queue Service Export
 *
 * Provides access to the initialized queue instance.
 * This allows controllers to submit jobs to the generation queue.
 */

import { QueueManager, type QueueServiceConfig } from './queue-manager.js';
import { QueueWorker } from './worker.js';
import { QueueLogger } from './logger.js';
import { processGenerationJob } from './generation-processor.js';

/**
 * Queue service singleton
 */
class QueueService {
  private manager: QueueManager | null = null;
  private worker: QueueWorker | null = null;
  private logger: QueueLogger | null = null;
  private initialized = false;

  /**
   * Initialize queue service with configuration
   */
  async initialize(config: QueueServiceConfig): Promise<void> {
    if (this.initialized) {
      console.warn('[Queue Service] Already initialized');
      return;
    }

    // Create logger
    this.logger = new QueueLogger();

    // Create queue manager
    this.manager = new QueueManager(config, this.logger);
    await this.manager.initialize();

    // Create worker with generation processor
    this.worker = new QueueWorker(this.manager, processGenerationJob, config, this.logger);
    await this.worker.start();

    this.initialized = true;
    console.log('[Queue Service] Initialized successfully');
  }

  /**
   * Get queue instance for job submission
   */
  getQueue() {
    if (!this.manager) {
      throw new Error('Queue service not initialized. Call initialize() first.');
    }
    return this.manager.getQueue();
  }

  /**
   * Get worker instance
   */
  getWorker() {
    if (!this.worker) {
      throw new Error('Queue service not initialized. Call initialize() first.');
    }
    return this.worker;
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Shutdown queue service gracefully
   */
  async shutdown(): Promise<void> {
    if (this.worker) {
      await this.worker.stop();
    }
    if (this.manager) {
      await this.manager.close();
    }
    this.initialized = false;
    console.log('[Queue Service] Shutdown complete');
  }
}

// Export singleton instance
export const queueService = new QueueService();

// Auto-initialize if config is available
// This will be called during server startup
if (process.env['REDIS_HOST']) {
  const config: QueueServiceConfig = {
    redis: {
      host: process.env['REDIS_HOST'] || 'localhost',
      port: parseInt(process.env['REDIS_PORT'] || '6379', 10),
      password: process.env['REDIS_PASSWORD'] ?? undefined,
      db: parseInt(process.env['REDIS_DB'] || '0', 10),
    },
    firestore: {
      projectId: process.env['FIREBASE_PROJECT_ID'] || 'drawn-of-war',
    },
    queue: {
      name: 'generation-queue',
      concurrency: parseInt(process.env['QUEUE_CONCURRENCY'] || '5', 10),
      maxJobsPerUser: 5,
      systemQueueLimit: 500,
      warningThreshold: 400,
    },
    cache: {
      ttlDays: 30,
      strategy: 'moderate',
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

  // Initialize asynchronously (don't block module loading)
  queueService.initialize(config).catch((error) => {
    console.error('[Queue Service] Failed to initialize:', error);
  });
}
