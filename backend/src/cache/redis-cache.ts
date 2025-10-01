/**
 * Task 2.4: Redis Cache Layer
 *
 * Fast in-memory cache using Redis for completed generation results.
 * Stores sprite frames as base64, tracks cache hits, and manages 30-day TTL.
 */

import type { Redis } from 'ioredis';
import type { QueueServiceConfig } from '../queue/queue-manager.js';
import type { QueueLogger } from '../queue/logger.js';
import type { StructuredPrompt, SpriteGenerationResult } from '../queue/job-status-tracker.js';

/**
 * Cache entry stored in Redis
 */
export interface CacheEntry {
  /** Cache key (format: "cache:hash") */
  cacheKey: string;

  /** User ID who created this result */
  userId: string;

  /** Structured prompt that generated this result */
  structuredPrompt: StructuredPrompt;

  /** Generation result with sprite frames */
  result: SpriteGenerationResult;

  /** Unix timestamp when entry was created */
  createdAt: number;

  /** Unix timestamp when entry expires */
  expiresAt: number;

  /** Number of times this entry has been accessed */
  hits: number;

  /** Unix timestamp of last access */
  lastAccessedAt: number;
}

/**
 * Internal storage format for Redis
 * (frames converted to base64 for JSON serialization)
 */
interface CacheEntryStorage {
  cacheKey: string;
  userId: string;
  structuredPrompt: StructuredPrompt;
  result: {
    jobId: string;
    frames: string[]; // base64 strings
    metadata: SpriteGenerationResult['metadata'];
  };
  createdAt: number;
  expiresAt: number;
  hits: number;
  lastAccessedAt: number;
}

/**
 * Redis Cache Layer
 *
 * Provides fast in-memory caching for completed sprite generation results.
 * Implements automatic TTL expiration, hit tracking, and base64 encoding
 * for sprite frames (Redis string limitation).
 *
 * Features:
 * - 30-day TTL on all cache entries
 * - Automatic hit counter increment on access
 * - Last accessed timestamp tracking
 * - Base64 encoding/decoding for sprite frames
 * - Graceful error handling for Redis failures
 *
 * @example
 * ```typescript
 * const cache = new RedisCache(redis, config, logger);
 *
 * // Store result
 * await cache.set('cache:abc123', {
 *   cacheKey: 'cache:abc123',
 *   userId: 'user-1',
 *   structuredPrompt: prompt,
 *   result: generationResult,
 *   createdAt: Date.now(),
 *   expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
 *   hits: 0,
 *   lastAccessedAt: Date.now(),
 * });
 *
 * // Retrieve result (increments hit counter)
 * const entry = await cache.get('cache:abc123');
 * ```
 */
export class RedisCache {
  private redis: Redis;
  private config: QueueServiceConfig;
  private logger: QueueLogger;

  /**
   * Creates a new RedisCache instance
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
   * Store cache entry in Redis
   *
   * Converts sprite frames to base64 for JSON serialization and sets
   * TTL based on configuration (default: 30 days).
   *
   * @param key - Cache key (format: "cache:hash")
   * @param entry - Cache entry to store
   * @throws {Error} if Redis operation fails
   *
   * @example
   * ```typescript
   * await cache.set('cache:abc123', {
   *   cacheKey: 'cache:abc123',
   *   userId: 'user-1',
   *   structuredPrompt: prompt,
   *   result: { jobId: 'job-1', frames: [buffer1, buffer2], metadata: {...} },
   *   createdAt: Date.now(),
   *   expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
   *   hits: 0,
   *   lastAccessedAt: Date.now(),
   * });
   * ```
   */
  async set(key: string, entry: CacheEntry): Promise<void> {
    try {
      // Convert entry to storage format (frames as base64)
      const storageEntry: CacheEntryStorage = {
        ...entry,
        result: {
          ...entry.result,
          frames: entry.result.frames.map((frame) => frame.toString('base64')),
        },
      };

      // Serialize to JSON
      const json = JSON.stringify(storageEntry);

      // Calculate TTL in seconds
      const ttlSeconds = this.config.cache.ttlDays * 24 * 60 * 60;

      // Store in Redis with TTL
      await this.redis.setex(key, ttlSeconds, json);

      this.logger.logInfo('cache_set', {
        cacheKey: key,
        userId: entry.userId,
        ttlSeconds,
      });
    } catch (error) {
      this.logger.logError('cache-set', error as Error, {
        operation: 'cache.set',
        cacheKey: key,
      });
      throw error;
    }
  }

  /**
   * Retrieve cache entry from Redis
   *
   * Returns null for cache miss. On cache hit, increments hit counter
   * and updates last accessed timestamp. Converts base64 frames back
   * to Buffers.
   *
   * @param key - Cache key (format: "cache:hash")
   * @returns Cache entry or null if not found/invalid
   *
   * @example
   * ```typescript
   * const entry = await cache.get('cache:abc123');
   * if (entry) {
   *   console.log(`Hit count: ${entry.hits}`);
   *   console.log(`Frames: ${entry.result.frames.length}`);
   * }
   * ```
   */
  async get(key: string): Promise<CacheEntry | null> {
    try {
      // Get from Redis
      const json = await this.redis.get(key);

      if (json === null) {
        // Cache miss
        return null;
      }

      // Parse JSON
      let storageEntry: CacheEntryStorage;
      try {
        storageEntry = JSON.parse(json);
      } catch (parseError) {
        // Malformed JSON - treat as cache miss
        this.logger.logWarn('cache_invalid_json', {
          cacheKey: key,
          error: parseError instanceof Error ? parseError.message : String(parseError),
        });
        return null;
      }

      // Validate required fields
      if (!this.isValidCacheEntry(storageEntry)) {
        this.logger.logWarn('cache_invalid_entry', {
          cacheKey: key,
          reason: 'Missing required fields',
        });
        return null;
      }

      // Convert base64 frames back to Buffers
      const entry: CacheEntry = {
        ...storageEntry,
        result: {
          ...storageEntry.result,
          frames: storageEntry.result.frames.map((base64) => Buffer.from(base64, 'base64')),
        },
      };

      // Increment hit counter and update last accessed timestamp
      const updatedEntry: CacheEntry = {
        ...entry,
        hits: entry.hits + 1,
        lastAccessedAt: Date.now(),
      };

      // Update cache entry asynchronously (don't wait)
      this.updateCacheMetadata(key, updatedEntry).catch((error) => {
        this.logger.logWarn('cache_metadata_update_failed', {
          cacheKey: key,
          error: error instanceof Error ? error.message : String(error),
        });
      });

      this.logger.logInfo('cache_get_hit', {
        cacheKey: key,
        userId: entry.userId,
        hits: updatedEntry.hits,
      });

      return updatedEntry;
    } catch (error) {
      this.logger.logError('cache-get', error as Error, {
        operation: 'cache.get',
        cacheKey: key,
      });
      throw error;
    }
  }

  /**
   * Update cache entry metadata (hits, lastAccessedAt)
   *
   * Called asynchronously after cache hit to update tracking fields
   * without blocking the response.
   *
   * @param key - Cache key
   * @param entry - Updated cache entry
   */
  private async updateCacheMetadata(key: string, entry: CacheEntry): Promise<void> {
    // Convert to storage format
    const storageEntry: CacheEntryStorage = {
      ...entry,
      result: {
        ...entry.result,
        frames: entry.result.frames.map((frame) => frame.toString('base64')),
      },
    };

    // Serialize to JSON
    const json = JSON.stringify(storageEntry);

    // Get current TTL
    const ttl = await this.redis.ttl(key);

    if (ttl > 0) {
      // Update entry while preserving remaining TTL
      await this.redis.setex(key, ttl, json);
    } else {
      // Entry expired or doesn't exist - skip update
      this.logger.logWarn('cache_metadata_update_skipped', {
        cacheKey: key,
        reason: 'Entry expired or missing',
        ttl,
      });
    }
  }

  /**
   * Validate cache entry has all required fields
   *
   * @param entry - Storage entry to validate
   * @returns True if entry is valid
   */
  private isValidCacheEntry(entry: any): entry is CacheEntryStorage {
    return (
      entry &&
      typeof entry === 'object' &&
      typeof entry.cacheKey === 'string' &&
      typeof entry.userId === 'string' &&
      entry.structuredPrompt &&
      typeof entry.structuredPrompt === 'object' &&
      entry.result &&
      typeof entry.result === 'object' &&
      Array.isArray(entry.result.frames) &&
      typeof entry.createdAt === 'number' &&
      typeof entry.expiresAt === 'number' &&
      typeof entry.hits === 'number' &&
      typeof entry.lastAccessedAt === 'number'
    );
  }
}
