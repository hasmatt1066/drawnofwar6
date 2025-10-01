/**
 * Task 6.2: Result Caching After Successful Generation
 *
 * Caches completed sprite generation results in Redis + Firestore for 30-day reuse.
 * Integrates with CacheManager from Phase 2 for hybrid cache write-through.
 */

import type { CacheManager, CacheEntry } from '../cache/cache-manager.js';
import type { QueueLogger } from './logger.js';
import type { StructuredPrompt, SpriteGenerationResult } from './job-status-tracker.js';

/**
 * Result Cacher - Caches completed generation results
 *
 * Responsibilities:
 * - Create CacheEntry with result data
 * - Set 30-day TTL (createdAt + 30 days)
 * - Write to Redis + Firestore via CacheManager
 * - Initialize hit counter to 0
 * - Set lastAccessedAt to current timestamp
 * - Handle cache write failures gracefully (log warning, don't fail job)
 *
 * Features:
 * - Graceful degradation on cache failures
 * - Comprehensive logging
 * - Support for verification of cached entries
 * - No throwing on cache errors (job success is independent of caching)
 *
 * @example
 * ```typescript
 * const cacher = new ResultCacher(cacheManager, logger);
 *
 * // Cache a successful generation result
 * const success = await cacher.cacheResult(
 *   cacheKey,
 *   userId,
 *   structuredPrompt,
 *   generationResult
 * );
 *
 * // Verify it was cached
 * const isCached = await cacher.verifyCached(cacheKey);
 * ```
 */
export class ResultCacher {
  private cacheManager: CacheManager;
  private logger: QueueLogger;

  /** 30-day TTL in milliseconds */
  private static readonly TTL_DAYS = 30;
  private static readonly TTL_MS = ResultCacher.TTL_DAYS * 24 * 60 * 60 * 1000;

  /**
   * Creates a new ResultCacher instance
   *
   * @param cacheManager - CacheManager instance for Redis + Firestore access
   * @param logger - Logger instance for structured logging
   */
  constructor(cacheManager: CacheManager, logger: QueueLogger) {
    this.cacheManager = cacheManager;
    this.logger = logger;
  }

  /**
   * Cache a completed generation result
   *
   * Creates a CacheEntry with the result data and writes it to both
   * Redis and Firestore via CacheManager. Handles failures gracefully
   * by logging warnings without throwing errors.
   *
   * @param cacheKey - Cache key for the result
   * @param userId - User ID who generated the result
   * @param prompt - Structured prompt that generated the result
   * @param result - Sprite generation result to cache
   * @returns True if caching succeeded, false if it failed
   *
   * @example
   * ```typescript
   * const success = await cacher.cacheResult(
   *   'cache:abc123',
   *   'user-456',
   *   structuredPrompt,
   *   generationResult
   * );
   *
   * if (success) {
   *   console.log('Result cached successfully');
   * } else {
   *   console.log('Caching failed, but job still succeeded');
   * }
   * ```
   */
  async cacheResult(
    cacheKey: string,
    userId: string,
    prompt: StructuredPrompt,
    result: SpriteGenerationResult
  ): Promise<boolean> {
    try {
      const now = Date.now();

      // Create cache entry
      const entry: CacheEntry = {
        cacheKey,
        userId,
        structuredPrompt: prompt,
        result,
        createdAt: now,
        expiresAt: now + ResultCacher.TTL_MS,
        hits: 0,
        lastAccessedAt: now,
      };

      // Write to cache via CacheManager (writes to both Redis and Firestore)
      await this.cacheManager.set(cacheKey, entry);

      // Log success
      this.logger.logInfo('result_cached', {
        cacheKey,
        userId,
        jobId: result.jobId,
        frameCount: result.frames.length,
      });

      return true;
    } catch (error) {
      // Log warning but don't throw - cache failure should not fail the job
      this.logger.logWarn('result_cache_failed', {
        cacheKey,
        userId,
        jobId: result.jobId,
        error: error instanceof Error ? error.message : String(error),
      });

      return false;
    }
  }

  /**
   * Verify that a result is cached
   *
   * Checks if a cache entry exists for the given key. Useful for
   * testing and verification after caching.
   *
   * @param cacheKey - Cache key to verify
   * @returns True if entry exists, false otherwise
   *
   * @example
   * ```typescript
   * const isCached = await cacher.verifyCached('cache:abc123');
   * if (isCached) {
   *   console.log('Entry found in cache');
   * }
   * ```
   */
  async verifyCached(cacheKey: string): Promise<boolean> {
    try {
      const lookupResult = await this.cacheManager.get(cacheKey);
      return lookupResult.hit;
    } catch (error) {
      // Log warning but don't throw
      this.logger.logWarn('cache_verify_failed', {
        cacheKey,
        error: error instanceof Error ? error.message : String(error),
      });

      return false;
    }
  }
}
