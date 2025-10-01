/**
 * Task 2.3: 10-Second Deduplication Window
 *
 * Tracks recent job submissions and detects duplicates within 10-second window
 * using Redis with TTL-based automatic cleanup.
 */

import type { Redis } from 'ioredis';
import type { QueueServiceConfig } from '../queue/queue-manager.js';
import type { QueueLogger } from '../queue/logger.js';

/**
 * Result of deduplication check
 */
export interface DeduplicationResult {
  /** Whether this is a duplicate submission */
  isDuplicate: boolean;

  /** Existing job ID if duplicate found */
  existingJobId?: string;

  /** Cache key that was checked */
  cacheKey: string;
}

/**
 * Deduplication Manager
 *
 * Tracks recent job submissions to detect duplicates within a configurable
 * time window. Uses Redis with TTL for automatic cleanup of expired entries.
 *
 * Thread-safe through Redis atomic operations (SET NX).
 *
 * @example
 * ```typescript
 * const manager = new DeduplicationManager(redis, config, logger);
 * const result = await manager.checkDuplicate('cache:abc123', 'job-456');
 * if (result.isDuplicate) {
 *   console.log(`Duplicate of job ${result.existingJobId}`);
 * }
 * ```
 */
export class DeduplicationManager {
  private redis: Redis;
  private config: QueueServiceConfig;
  private logger: QueueLogger;

  /**
   * Creates a new DeduplicationManager instance
   *
   * @param redis - ioredis client instance
   * @param config - Queue service configuration
   * @param logger - Logger instance for structured logging
   */
  constructor(redis: Redis, config: QueueServiceConfig, logger: QueueLogger) {
    this.redis = redis;
    this.config = config;
    this.logger = logger;
  }

  /**
   * Check if submission is a duplicate within the deduplication window
   *
   * Uses Redis SET NX (set if not exists) with TTL for thread-safe duplicate detection.
   * If this is the first submission with this cache key, stores the job ID with TTL.
   * If a duplicate is detected, returns the existing job ID.
   *
   * @param cacheKey - Cache key for the prompt (format: "cache:hash")
   * @param jobId - New job ID attempting to be submitted
   * @returns DeduplicationResult indicating if duplicate and existing job ID
   * @throws {Error} if Redis operation fails
   *
   * @example
   * ```typescript
   * // First submission
   * const result1 = await manager.checkDuplicate('cache:abc', 'job-1');
   * // result1 = { isDuplicate: false, cacheKey: 'cache:abc' }
   *
   * // Duplicate submission within window
   * const result2 = await manager.checkDuplicate('cache:abc', 'job-2');
   * // result2 = { isDuplicate: true, existingJobId: 'job-1', cacheKey: 'cache:abc' }
   * ```
   */
  async checkDuplicate(cacheKey: string, jobId: string): Promise<DeduplicationResult> {
    const dedupKey = this.buildDeduplicationKey(cacheKey);

    try {
      // Use SET NX (set if not exists) with TTL for thread-safe duplicate detection
      // Returns 'OK' if key was set (not a duplicate)
      // Returns null if key already exists (is a duplicate)
      const result = await this.redis.set(
        dedupKey,
        jobId,
        'EX',
        this.config.deduplication.windowSeconds,
        'NX'
      );

      if (result === 'OK') {
        // Key was set successfully - this is the first submission
        return {
          isDuplicate: false,
          cacheKey,
        };
      }

      // Key already exists - this is a duplicate
      // Get the existing job ID
      const existingJobId = await this.redis.get(dedupKey);

      if (existingJobId === null) {
        // Edge case: key expired between SET and GET
        // Treat as non-duplicate and try to set again
        const retryResult = await this.redis.set(
          dedupKey,
          jobId,
          'EX',
          this.config.deduplication.windowSeconds,
          'NX'
        );

        if (retryResult === 'OK') {
          return {
            isDuplicate: false,
            cacheKey,
          };
        }

        // Still exists after retry - get it again
        const retryExistingJobId = await this.redis.get(dedupKey);

        if (retryExistingJobId !== null) {
          return {
            isDuplicate: true,
            existingJobId: retryExistingJobId,
            cacheKey,
          };
        }

        // Still null after retry - race condition resolved, treat as non-duplicate
        return {
          isDuplicate: false,
          cacheKey,
        };
      }

      return {
        isDuplicate: true,
        existingJobId,
        cacheKey,
      };
    } catch (error) {
      // Log error and re-throw (let caller decide how to handle)
      this.logger.logError(jobId, error as Error, {
        operation: 'checkDuplicate',
        cacheKey,
        dedupKey,
      });
      throw error;
    }
  }

  /**
   * Build deduplication key from cache key
   *
   * Converts cache key format to deduplication key format:
   * - Input: "cache:abc123"
   * - Output: "dedup:cache:abc123"
   *
   * @param cacheKey - Cache key (format: "cache:hash")
   * @returns Deduplication key (format: "dedup:cache:hash")
   */
  private buildDeduplicationKey(cacheKey: string): string {
    return `dedup:${cacheKey}`;
  }
}
