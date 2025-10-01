/**
 * Task 2.6: Hybrid Cache Manager
 *
 * Orchestrates Redis + Firestore cache layers with fallback logic and write-through.
 * Provides resilient caching with fast Redis lookups and persistent Firestore backup.
 */

import type { RedisCache, CacheEntry } from './redis-cache.js';
import type { FirestoreBackup } from './firestore-backup.js';
import type { QueueServiceConfig } from '../queue/queue-manager.js';
import type { QueueLogger } from '../queue/logger.js';

// Re-export CacheEntry for external use
export type { CacheEntry } from './redis-cache.js';

/**
 * Cache lookup result with hit/miss information
 */
export interface CacheLookupResult {
  /** Whether the cache entry was found */
  hit: boolean;

  /** Cache entry if found */
  entry?: CacheEntry;

  /** Source of the cache hit ('redis' or 'firestore') */
  source?: 'redis' | 'firestore';
}

/**
 * Hybrid Cache Manager
 *
 * Orchestrates two-tier caching strategy:
 * 1. Redis (fast, volatile) - First checked on reads
 * 2. Firestore (persistent, durable) - Fallback on Redis miss
 *
 * Features:
 * - Read-through caching with automatic Redis population
 * - Write-through to both layers (parallel)
 * - Graceful degradation on partial failures
 * - Cache hit/miss metrics logging
 * - Resilient error handling
 */
export class CacheManager {
  private redisCache: RedisCache;
  private firestoreBackup: FirestoreBackup;
  private logger: QueueLogger;

  /**
   * Creates a new CacheManager instance
   *
   * @param redisCache - Redis cache layer instance
   * @param firestoreBackup - Firestore backup layer instance
   * @param config - Queue service configuration
   * @param logger - Logger instance for structured logging
   */
  constructor(
    redisCache: RedisCache,
    firestoreBackup: FirestoreBackup,
    config: QueueServiceConfig,
    logger: QueueLogger
  ) {
    this.redisCache = redisCache;
    this.firestoreBackup = firestoreBackup;
    this.logger = logger;
    // Note: config parameter reserved for future cache strategy configuration
    void config;
  }

  /**
   * Get cache entry with Redis-first lookup and Firestore fallback
   *
   * Lookup strategy:
   * 1. Check Redis (fast path)
   * 2. If Redis miss, check Firestore (fallback)
   * 3. If Firestore hit, populate Redis (read-through)
   * 4. If both miss, return null (proceed to generation)
   *
   * @param key - Cache key to retrieve
   * @returns Cache lookup result with hit/miss information
   */
  async get(key: string): Promise<CacheLookupResult> {
    // Step 1: Check Redis first
    try {
      const redisEntry = await this.redisCache.get(key);
      if (redisEntry) {
        // Redis hit - return immediately
        this.logger.logInfo('cache_hit', {
          cacheKey: key,
          source: 'redis',
        });

        return {
          hit: true,
          entry: redisEntry,
          source: 'redis',
        };
      }
    } catch (error) {
      // Redis error - log and continue to Firestore
      this.logger.logWarn('redis_get_error', {
        cacheKey: key,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Step 2: Redis miss - check Firestore
    try {
      const firestoreEntry = await this.firestoreBackup.get(key);
      if (firestoreEntry) {
        // Firestore hit - populate Redis and return
        this.logger.logInfo('cache_hit', {
          cacheKey: key,
          source: 'firestore',
        });

        // Populate Redis asynchronously (don't block return)
        this.populateRedis(key, firestoreEntry);

        return {
          hit: true,
          entry: firestoreEntry,
          source: 'firestore',
        };
      }
    } catch (error) {
      // Firestore error - log and return miss
      this.logger.logWarn('firestore_get_error', {
        cacheKey: key,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Step 3: Both miss - return null
    this.logger.logInfo('cache_miss', {
      cacheKey: key,
    });

    return {
      hit: false,
    };
  }

  /**
   * Set cache entry with write-through to both layers
   *
   * Writes to Redis and Firestore in parallel for performance.
   * Handles partial failures gracefully (one layer can fail without blocking).
   *
   * @param key - Cache key to set
   * @param entry - Cache entry to store
   */
  async set(key: string, entry: CacheEntry): Promise<void> {
    // Write to both layers in parallel
    const results = await Promise.allSettled([
      this.redisCache.set(key, entry),
      this.firestoreBackup.set(key, entry),
    ]);

    const [redisResult, firestoreResult] = results;

    // Track which layers succeeded/failed
    const successLayers: string[] = [];
    const failedLayers: Array<{ layer: string; error: string }> = [];

    // Check Redis result
    if (redisResult.status === 'fulfilled') {
      successLayers.push('redis');
    } else {
      failedLayers.push({
        layer: 'redis',
        error: redisResult.reason instanceof Error ? redisResult.reason.message : String(redisResult.reason),
      });
    }

    // Check Firestore result
    if (firestoreResult.status === 'fulfilled') {
      successLayers.push('firestore');
    } else {
      failedLayers.push({
        layer: 'firestore',
        error:
          firestoreResult.reason instanceof Error
            ? firestoreResult.reason.message
            : String(firestoreResult.reason),
      });
    }

    // Log results
    if (failedLayers.length === 0) {
      // Full success
      this.logger.logInfo('cache_write', {
        cacheKey: key,
        layers: successLayers,
      });
    } else if (successLayers.length > 0) {
      // Partial success
      failedLayers.forEach((failure) => {
        this.logger.logWarn('cache_write_partial_failure', {
          cacheKey: key,
          failedLayer: failure.layer,
          error: failure.error,
        });
      });
    } else {
      // Complete failure
      this.logger.logWarn('cache_write_complete_failure', {
        cacheKey: key,
        redisError: failedLayers.find((f) => f.layer === 'redis')?.error,
        firestoreError: failedLayers.find((f) => f.layer === 'firestore')?.error,
      });
    }
  }

  /**
   * Populate Redis cache from Firestore entry (async, non-blocking)
   *
   * @param key - Cache key
   * @param entry - Cache entry from Firestore
   */
  private async populateRedis(key: string, entry: CacheEntry): Promise<void> {
    try {
      await this.redisCache.set(key, entry);
      this.logger.logInfo('redis_cache_populated', {
        cacheKey: key,
        source: 'firestore',
      });
    } catch (error) {
      // Log error but don't throw (population is best-effort)
      this.logger.logWarn('redis_population_failed', {
        cacheKey: key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
