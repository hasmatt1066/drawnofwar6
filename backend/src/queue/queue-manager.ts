/**
 * Task 1.1: Initialize BullMQ Queue with Redis Connection
 *
 * Sets up BullMQ queue instance with Redis connection and persistence configuration.
 * Handles connection validation, retry logic, and graceful error handling.
 */

import { Queue, QueueOptions } from 'bullmq';
import type { QueueLogger } from './logger.js';

/**
 * Cache eviction strategy
 */
export type CacheStrategy = 'aggressive' | 'moderate' | 'conservative';

/**
 * Main queue service configuration
 */
export interface QueueServiceConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number; // default 0, valid range: 0-15
  };
  firestore: {
    projectId: string;
    credentials?: any;
  };
  queue: {
    name: string; // e.g., "generation-queue"
    concurrency: number; // default 5 (workers processing simultaneously)
    maxJobsPerUser: number; // default 5
    systemQueueLimit: number; // default 500
    warningThreshold: number; // default 400
  };
  cache: {
    ttlDays: number; // default 30
    strategy: CacheStrategy;
  };
  retry: {
    maxRetries: number; // default 1
    backoffDelay: number; // milliseconds, default 5000
    backoffMultiplier: number; // default 2.0
  };
  sse: {
    updateInterval: number; // milliseconds, default 2500
    keepAliveInterval: number; // milliseconds, default 30000
  };
  deduplication: {
    windowSeconds: number; // default 10
  };
}

/**
 * Queue Manager - manages BullMQ queue instance
 *
 * Responsibilities:
 * - Initialize BullMQ queue with Redis connection
 * - Validate configuration and connection
 * - Handle connection errors with retry logic
 * - Provide queue instance access
 * - Manage queue lifecycle (initialize, close)
 */
export class QueueManager {
  private queue: Queue | null = null;
  private config: QueueServiceConfig;
  private logger: QueueLogger;
  private initialized = false;

  /**
   * Maximum number of connection retry attempts
   */
  private static readonly MAX_RETRY_ATTEMPTS = 3;

  /**
   * Creates a new QueueManager instance
   *
   * @param config - Queue service configuration
   * @param logger - Logger instance for structured logging
   */
  constructor(config: QueueServiceConfig, logger: QueueLogger) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * Initialize queue and connect to Redis
   *
   * Validates configuration, creates BullMQ queue instance,
   * and verifies Redis connection. Implements retry logic
   * with exponential backoff for transient failures.
   *
   * @throws {Error} if configuration is invalid
   * @throws {Error} if Redis connection fails after retries
   * @throws {Error} if already initialized
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error('QueueManager is already initialized');
    }

    // Validate configuration
    this.validateConfig();

    // Create queue with retry logic
    await this.createQueueWithRetry();

    this.initialized = true;

    this.logger.logInfo('queue_manager_initialized', {
      queueName: this.config.queue.name,
      redisHost: this.config.redis.host,
      redisPort: this.config.redis.port,
      redisDb: this.config.redis.db ?? 0,
    });
  }

  /**
   * Get the underlying BullMQ queue instance
   *
   * @returns The BullMQ Queue instance
   * @throws {Error} if queue is not initialized
   */
  getQueue(): Queue {
    if (!this.queue) {
      throw new Error('QueueManager is not initialized. Call initialize() first.');
    }
    return this.queue;
  }

  /**
   * Close queue and disconnect from Redis
   *
   * Gracefully shuts down the queue and closes Redis connection.
   */
  async close(): Promise<void> {
    if (this.queue) {
      await this.queue.close();
      this.logger.logInfo('queue_manager_closed', {
        queueName: this.config.queue.name,
      });
      this.initialized = false;
    }
  }

  /**
   * Check if queue is connected to Redis
   *
   * @returns True if connected and responsive, false otherwise
   */
  async isConnected(): Promise<boolean> {
    if (!this.queue) {
      return false;
    }

    try {
      // Attempt to ping Redis through the queue's client
      const client = (this.queue as any).client;
      if (client && typeof client.ping === 'function') {
        await client.ping();
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate configuration before initialization
   *
   * @throws {Error} if configuration is invalid
   */
  private validateConfig(): void {
    // Validate queue name
    if (!this.config.queue.name || this.config.queue.name.trim().length === 0) {
      throw new Error('Queue name must be non-empty');
    }

    // Validate Redis DB number (0-15)
    const db = this.config.redis.db ?? 0;
    if (db < 0 || db > 15) {
      throw new Error('Redis DB number must be in range 0-15');
    }
  }

  /**
   * Create queue with retry logic for transient failures
   *
   * @throws {Error} if all retry attempts fail
   */
  private async createQueueWithRetry(): Promise<void> {
    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt < QueueManager.MAX_RETRY_ATTEMPTS) {
      try {
        await this.createQueue();
        return; // Success
      } catch (error) {
        lastError = error as Error;
        attempt++;

        // Check if error is retryable (timeout, connection issues)
        if (this.isRetryableError(error as Error)) {
          if (attempt < QueueManager.MAX_RETRY_ATTEMPTS) {
            const delay = this.calculateBackoffDelay(attempt);
            this.logger.logWarn('queue_connection_retry', {
              attempt,
              maxAttempts: QueueManager.MAX_RETRY_ATTEMPTS,
              delayMs: delay,
              error: (error as Error).message,
            });
            await this.sleep(delay);
          }
        } else {
          // Non-retryable error, fail immediately
          break;
        }
      }
    }

    // All retries failed
    throw this.wrapConnectionError(lastError!);
  }

  /**
   * Create BullMQ queue instance
   *
   * @throws {Error} if queue creation fails
   */
  private async createQueue(): Promise<void> {
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

    const queueOptions: QueueOptions = {
      connection: connectionOptions,
      defaultJobOptions: {
        // Enable job persistence for restart recovery
        removeOnComplete: false,
        removeOnFail: false,

        // Retry configuration
        attempts: this.config.retry.maxRetries + 1, // +1 for initial attempt
        backoff: {
          type: 'exponential',
          delay: this.config.retry.backoffDelay,
        },
      },
    };

    this.queue = new Queue(this.config.queue.name, queueOptions);
  }

  /**
   * Check if error is retryable (timeout, connection refused, etc.)
   *
   * @param error - Error to check
   * @returns True if error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes('etimedout') ||
      message.includes('econnrefused') ||
      message.includes('timeout') ||
      message.includes('connection refused')
    );
  }

  /**
   * Calculate exponential backoff delay for retry attempt
   *
   * @param attempt - Current attempt number (1-based)
   * @returns Delay in milliseconds
   */
  private calculateBackoffDelay(attempt: number): number {
    return this.config.retry.backoffDelay * Math.pow(this.config.retry.backoffMultiplier, attempt - 1);
  }

  /**
   * Wrap connection error with user-friendly message
   *
   * @param error - Original error
   * @returns Wrapped error with clear message
   */
  private wrapConnectionError(error: Error): Error {
    const message = error.message.toLowerCase();

    if (message.includes('wrongpass') || message.includes('authentication')) {
      return new Error(`Redis authentication failed: ${error.message}`);
    }

    if (message.includes('econnrefused') || message.includes('etimedout')) {
      return new Error(
        `Redis connection failed: Unable to connect to ${this.config.redis.host}:${this.config.redis.port}. ${error.message}`
      );
    }

    if (message.includes('enotfound')) {
      return new Error(`Redis connection failed: Host not found (${this.config.redis.host}). ${error.message}`);
    }

    return new Error(`Redis connection failed: ${error.message}`);
  }

  /**
   * Sleep for specified duration
   *
   * @param ms - Duration in milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
