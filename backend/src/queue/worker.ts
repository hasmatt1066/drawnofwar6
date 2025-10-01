/**
 * Task 1.2: Implement BullMQ Worker with Job Processing Loop
 *
 * Creates BullMQ Worker that picks up jobs from queue and processes them asynchronously.
 * Handles concurrent job processing, progress updates, graceful shutdown, and error recovery.
 */

import { Worker, Job, WorkerOptions } from 'bullmq';
import type { QueueManager } from './queue-manager.js';
import type { QueueLogger } from './logger.js';
import type { QueueServiceConfig } from './queue-manager.js';

/**
 * Job processor function type
 *
 * Processes a single job from the queue. Should return the job result
 * or throw an error if processing fails.
 *
 * @param job - BullMQ Job instance
 * @returns Job processing result (can be any value)
 * @throws Error if job processing fails
 */
export interface JobProcessor {
  (job: Job): Promise<any>;
}

/**
 * Queue Worker - manages BullMQ worker instance
 *
 * Responsibilities:
 * - Create and manage BullMQ Worker instance
 * - Process jobs from queue using provided processor function
 * - Handle job lifecycle events (completed, failed, etc.)
 * - Manage graceful shutdown with signal handlers
 * - Log worker lifecycle and job events
 * - Reconnect to Redis on connection failures
 */
export class QueueWorker {
  private worker: Worker | null = null;
  private config: QueueServiceConfig;
  private logger: QueueLogger;
  private processor: JobProcessor;
  private running = false;
  private signalHandlers: Map<string, () => Promise<void>> = new Map();

  /**
   * Creates a new QueueWorker instance
   *
   * Note: queueManager parameter is kept for API consistency and potential
   * future use, though not currently utilized in the implementation.
   *
   * @param _queueManager - QueueManager instance (reserved for future use)
   * @param processor - Job processor function
   * @param config - Queue service configuration
   * @param logger - Logger instance for structured logging
   */
  constructor(
    _queueManager: QueueManager,
    processor: JobProcessor,
    config: QueueServiceConfig,
    logger: QueueLogger
  ) {
    this.processor = processor;
    this.config = config;
    this.logger = logger;
  }

  /**
   * Start the worker and begin processing jobs
   *
   * Creates BullMQ Worker instance, sets up event handlers,
   * and begins pulling jobs from the queue. Sets up signal
   * handlers for graceful shutdown.
   *
   * @throws {Error} if worker is already running
   */
  async start(): Promise<void> {
    if (this.running) {
      throw new Error('Worker is already running');
    }

    // Create worker instance
    this.createWorker();

    // Set up event handlers
    this.setupEventHandlers();

    // Set up signal handlers for graceful shutdown
    this.setupSignalHandlers();

    this.running = true;

    this.logger.logInfo('worker_started', {
      queueName: this.config.queue.name,
      concurrency: this.config.queue.concurrency,
      redisHost: this.config.redis.host,
      redisPort: this.config.redis.port,
    });
  }

  /**
   * Stop the worker gracefully
   *
   * Waits for active jobs to complete (or timeout),
   * then closes the worker and removes signal handlers.
   *
   * @throws {Error} if worker is not running
   */
  async stop(): Promise<void> {
    if (!this.running) {
      throw new Error('Worker is not running');
    }

    this.logger.logInfo('worker_stopping', {
      queueName: this.config.queue.name,
    });

    // Remove signal handlers
    this.removeSignalHandlers();

    // Close worker (waits for active jobs)
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }

    this.running = false;

    this.logger.logInfo('worker_stopped', {
      queueName: this.config.queue.name,
    });
  }

  /**
   * Check if worker is currently running
   *
   * @returns True if worker is running, false otherwise
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Create BullMQ Worker instance
   *
   * Configures worker with Redis connection, concurrency settings,
   * and wraps the user-provided processor function.
   */
  private createWorker(): void {
    // Build connection options conditionally to satisfy exactOptionalPropertyTypes
    const connectionOptions: any = {
      host: this.config.redis.host,
      port: this.config.redis.port,
      db: this.config.redis.db ?? 0,
    };

    // Only include password if it's defined
    if (this.config.redis.password !== undefined) {
      connectionOptions.password = this.config.redis.password;
    }

    const workerOptions: WorkerOptions = {
      connection: connectionOptions,
      concurrency: this.config.queue.concurrency,
      autorun: false, // We'll manually call run()
    };

    // Create worker with wrapped processor
    this.worker = new Worker(
      this.config.queue.name,
      this.createProcessorWrapper(),
      workerOptions
    );

    // Manually start the worker
    this.worker.run();
  }

  /**
   * Create wrapper around user-provided processor
   *
   * Wraps the processor to add logging and error handling.
   * Returns a function compatible with BullMQ's processor signature.
   *
   * @returns Wrapped processor function
   */
  private createProcessorWrapper(): (job: Job) => Promise<any> {
    return async (job: Job): Promise<any> => {
      this.logger.logStateChange(job.id!, 'waiting', 'active', {
        jobName: job.name,
        userId: (job.data as any).userId,
      });

      try {
        // Call user's processor
        const result = await this.processor(job);

        return result;
      } catch (error) {
        // Log error and re-throw for BullMQ to handle
        this.logger.logError(job.id!, error as Error, {
          jobName: job.name,
          jobData: job.data,
        });
        throw error;
      }
    };
  }

  /**
   * Set up event handlers for worker lifecycle
   *
   * Handles:
   * - completed: Job completed successfully
   * - failed: Job failed after all retries
   * - error: Worker-level errors (connection issues, etc.)
   */
  private setupEventHandlers(): void {
    if (!this.worker) {
      return;
    }

    // Job completed successfully
    this.worker.on('completed', (job: Job, result: any) => {
      this.logger.logStateChange(job.id!, 'active', 'completed', {
        jobName: job.name,
        result,
      });
    });

    // Job failed after all retries
    this.worker.on('failed', (job: Job | undefined, error: Error) => {
      if (job) {
        this.logger.logError(job.id!, error, {
          jobName: job.name,
          jobData: job.data,
        });

        this.logger.logStateChange(job.id!, 'active', 'failed', {
          jobName: job.name,
          error: error.message,
        });
      }
    });

    // Worker-level errors (connection issues, etc.)
    this.worker.on('error', (error: Error) => {
      this.logger.logWarn('worker_error', {
        error: error.message,
        queueName: this.config.queue.name,
      });
    });
  }

  /**
   * Set up signal handlers for graceful shutdown
   *
   * Handles SIGTERM and SIGINT by calling stop().
   * Stores handlers for later removal.
   */
  private setupSignalHandlers(): void {
    const handleShutdown = async () => {
      this.logger.logInfo('worker_shutdown_signal', {
        queueName: this.config.queue.name,
      });

      try {
        await this.stop();
        process.exit(0);
      } catch (error) {
        this.logger.logError('worker-shutdown', error as Error, {
          queueName: this.config.queue.name,
        });
        process.exit(1);
      }
    };

    this.signalHandlers.set('SIGTERM', handleShutdown);
    this.signalHandlers.set('SIGINT', handleShutdown);

    process.on('SIGTERM', handleShutdown);
    process.on('SIGINT', handleShutdown);
  }

  /**
   * Remove signal handlers
   *
   * Cleans up signal handlers when worker stops.
   */
  private removeSignalHandlers(): void {
    Array.from(this.signalHandlers.entries()).forEach(([signal, handler]) => {
      process.off(signal, handler);
    });
    this.signalHandlers.clear();
  }
}
