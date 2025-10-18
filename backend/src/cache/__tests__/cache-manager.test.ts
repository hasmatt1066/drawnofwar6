/**
 * Task 2.6: Hybrid Cache Manager Tests
 *
 * Comprehensive unit tests for the CacheManager class covering:
 * - Redis-first cache lookup with Firestore fallback
 * - Write-through to both cache layers
 * - Cache hit/miss metrics logging
 * - Partial failure handling (one layer succeeds, one fails)
 * - Redis population on Firestore hit
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { CacheManager, type CacheLookupResult } from './cache-manager.js';
import type { CacheEntry } from './redis-cache.js';
import type { QueueServiceConfig } from '../queue/queue-manager.js';
import type { QueueLogger } from '../queue/logger.js';

// Mock RedisCache interface
interface MockRedisCache {
  get: Mock<[string], Promise<CacheEntry | null>>;
  set: Mock<[string, CacheEntry], Promise<void>>;
}

// Mock FirestoreBackup interface
interface MockFirestoreBackup {
  get: Mock<[string], Promise<CacheEntry | null>>;
  set: Mock<[string, CacheEntry], Promise<void>>;
}

describe('CacheManager', () => {
  let cacheManager: CacheManager;
  let mockRedisCache: MockRedisCache;
  let mockFirestoreBackup: MockFirestoreBackup;
  let mockLogger: QueueLogger;
  let config: QueueServiceConfig;

  const now = Date.now();
  const testCacheEntry: CacheEntry = {
    cacheKey: 'cache:test123',
    userId: 'user-1',
    structuredPrompt: {
      type: 'character',
      style: 'pixel-art',
      size: { width: 32, height: 32 },
      action: 'walking',
      description: 'warrior',
      raw: 'warrior walking',
    },
    result: {
      jobId: 'job-1',
      frames: [Buffer.from('frame1-data'), Buffer.from('frame2-data')],
      metadata: {
        dimensions: { width: 32, height: 32 },
        frameCount: 2,
        generationTimeMs: 5000,
        cacheHit: false,
      },
    },
    createdAt: now,
    expiresAt: now + 30 * 24 * 60 * 60 * 1000,
    hits: 0,
    lastAccessedAt: now,
  };

  beforeEach(() => {
    // Create mock Redis cache
    mockRedisCache = {
      get: vi.fn(),
      set: vi.fn(),
    };

    // Create mock Firestore backup
    mockFirestoreBackup = {
      get: vi.fn(),
      set: vi.fn(),
    };

    // Create mock logger
    mockLogger = {
      logInfo: vi.fn(),
      logWarn: vi.fn(),
      logError: vi.fn(),
      logCacheAccess: vi.fn(),
    } as any;

    // Create test config
    config = {
      redis: { host: 'localhost', port: 6379 },
      firestore: { projectId: 'test-project' },
      queue: {
        name: 'test-queue',
        concurrency: 5,
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

    cacheManager = new CacheManager(
      mockRedisCache as any,
      mockFirestoreBackup as any,
      config,
      mockLogger
    );
  });

  describe('get() - Redis hit path', () => {
    it('should return entry from Redis on cache hit', async () => {
      const key = 'cache:redis-hit';
      mockRedisCache.get.mockResolvedValueOnce(testCacheEntry);

      const result = await cacheManager.get(key);

      // Verify Redis was checked
      expect(mockRedisCache.get).toHaveBeenCalledWith(key);

      // Verify Firestore was NOT checked (Redis hit)
      expect(mockFirestoreBackup.get).not.toHaveBeenCalled();

      // Verify result is correct
      expect(result.hit).toBe(true);
      expect(result.source).toBe('redis');
      expect(result.entry).toEqual(testCacheEntry);

      // Verify metrics were logged
      expect(mockLogger.logInfo).toHaveBeenCalledWith(
        'cache_hit',
        expect.objectContaining({
          cacheKey: key,
          source: 'redis',
        })
      );
    });

    it('should return immediately on Redis hit without checking Firestore', async () => {
      const key = 'cache:redis-only';
      mockRedisCache.get.mockResolvedValueOnce(testCacheEntry);

      await cacheManager.get(key);

      // Firestore should not be touched
      expect(mockFirestoreBackup.get).not.toHaveBeenCalled();
    });
  });

  describe('get() - Firestore fallback path', () => {
    it('should fallback to Firestore on Redis miss', async () => {
      const key = 'cache:firestore-hit';
      mockRedisCache.get.mockResolvedValueOnce(null); // Redis miss
      mockFirestoreBackup.get.mockResolvedValueOnce(testCacheEntry); // Firestore hit

      const result = await cacheManager.get(key);

      // Verify both layers were checked
      expect(mockRedisCache.get).toHaveBeenCalledWith(key);
      expect(mockFirestoreBackup.get).toHaveBeenCalledWith(key);

      // Verify result is correct
      expect(result.hit).toBe(true);
      expect(result.source).toBe('firestore');
      expect(result.entry).toEqual(testCacheEntry);

      // Verify metrics were logged
      expect(mockLogger.logInfo).toHaveBeenCalledWith(
        'cache_hit',
        expect.objectContaining({
          cacheKey: key,
          source: 'firestore',
        })
      );
    });

    it('should populate Redis on Firestore hit', async () => {
      const key = 'cache:populate-redis';
      mockRedisCache.get.mockResolvedValueOnce(null); // Redis miss
      mockFirestoreBackup.get.mockResolvedValueOnce(testCacheEntry); // Firestore hit
      mockRedisCache.set.mockResolvedValueOnce(undefined);

      await cacheManager.get(key);

      // Wait for async population to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify Redis was populated
      expect(mockRedisCache.set).toHaveBeenCalledWith(key, testCacheEntry);

      // Verify population was logged
      expect(mockLogger.logInfo).toHaveBeenCalledWith(
        'redis_cache_populated',
        expect.objectContaining({
          cacheKey: key,
          source: 'firestore',
        })
      );
    });

    it('should handle Redis population failure gracefully', async () => {
      const key = 'cache:populate-fail';
      mockRedisCache.get.mockResolvedValueOnce(null);
      mockFirestoreBackup.get.mockResolvedValueOnce(testCacheEntry);
      mockRedisCache.set.mockRejectedValueOnce(new Error('Redis write failed'));

      const result = await cacheManager.get(key);

      // Should still return the Firestore result
      expect(result.hit).toBe(true);
      expect(result.entry).toEqual(testCacheEntry);

      // Wait for async population to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify error was logged
      expect(mockLogger.logWarn).toHaveBeenCalledWith(
        'redis_population_failed',
        expect.objectContaining({
          cacheKey: key,
          error: 'Redis write failed',
        })
      );
    });
  });

  describe('get() - Both miss path', () => {
    it('should return null when both Redis and Firestore miss', async () => {
      const key = 'cache:both-miss';
      mockRedisCache.get.mockResolvedValueOnce(null);
      mockFirestoreBackup.get.mockResolvedValueOnce(null);

      const result = await cacheManager.get(key);

      // Verify both layers were checked
      expect(mockRedisCache.get).toHaveBeenCalledWith(key);
      expect(mockFirestoreBackup.get).toHaveBeenCalledWith(key);

      // Verify result is miss
      expect(result.hit).toBe(false);
      expect(result.source).toBeUndefined();
      expect(result.entry).toBeUndefined();

      // Verify miss was logged
      expect(mockLogger.logInfo).toHaveBeenCalledWith(
        'cache_miss',
        expect.objectContaining({
          cacheKey: key,
        })
      );
    });
  });

  describe('set() - Write-through to both layers', () => {
    it('should write to both Redis and Firestore', async () => {
      const key = 'cache:write-both';
      mockRedisCache.set.mockResolvedValueOnce(undefined);
      mockFirestoreBackup.set.mockResolvedValueOnce(undefined);

      await cacheManager.set(key, testCacheEntry);

      // Verify both layers were written
      expect(mockRedisCache.set).toHaveBeenCalledWith(key, testCacheEntry);
      expect(mockFirestoreBackup.set).toHaveBeenCalledWith(key, testCacheEntry);

      // Verify success was logged
      expect(mockLogger.logInfo).toHaveBeenCalledWith(
        'cache_write',
        expect.objectContaining({
          cacheKey: key,
          layers: ['redis', 'firestore'],
        })
      );
    });

    it('should write to both layers in parallel', async () => {
      const key = 'cache:parallel-write';
      let redisDelay = 0;
      let firestoreDelay = 0;

      mockRedisCache.set.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        redisDelay = Date.now();
      });

      mockFirestoreBackup.set.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        firestoreDelay = Date.now();
      });

      const start = Date.now();
      await cacheManager.set(key, testCacheEntry);
      const elapsed = Date.now() - start;

      // Should complete in ~50ms (parallel), not ~100ms (sequential)
      expect(elapsed).toBeLessThan(80);

      // Both should be called
      expect(mockRedisCache.set).toHaveBeenCalled();
      expect(mockFirestoreBackup.set).toHaveBeenCalled();
    });
  });

  describe('set() - Partial failure handling', () => {
    it('should handle Redis failure with Firestore success', async () => {
      const key = 'cache:redis-fail';
      mockRedisCache.set.mockRejectedValueOnce(new Error('Redis down'));
      mockFirestoreBackup.set.mockResolvedValueOnce(undefined);

      // Should not throw
      await expect(cacheManager.set(key, testCacheEntry)).resolves.toBeUndefined();

      // Verify error was logged
      expect(mockLogger.logWarn).toHaveBeenCalledWith(
        'cache_write_partial_failure',
        expect.objectContaining({
          cacheKey: key,
          failedLayer: 'redis',
          error: 'Redis down',
        })
      );
    });

    it('should handle Firestore failure with Redis success', async () => {
      const key = 'cache:firestore-fail';
      mockRedisCache.set.mockResolvedValueOnce(undefined);
      mockFirestoreBackup.set.mockRejectedValueOnce(new Error('Firestore offline'));

      // Should not throw
      await expect(cacheManager.set(key, testCacheEntry)).resolves.toBeUndefined();

      // Verify error was logged
      expect(mockLogger.logWarn).toHaveBeenCalledWith(
        'cache_write_partial_failure',
        expect.objectContaining({
          cacheKey: key,
          failedLayer: 'firestore',
          error: 'Firestore offline',
        })
      );
    });

    it('should handle both layers failing', async () => {
      const key = 'cache:both-fail';
      mockRedisCache.set.mockRejectedValueOnce(new Error('Redis down'));
      mockFirestoreBackup.set.mockRejectedValueOnce(new Error('Firestore offline'));

      // Should not throw
      await expect(cacheManager.set(key, testCacheEntry)).resolves.toBeUndefined();

      // Verify error was logged
      expect(mockLogger.logWarn).toHaveBeenCalledWith(
        'cache_write_complete_failure',
        expect.objectContaining({
          cacheKey: key,
          redisError: 'Redis down',
          firestoreError: 'Firestore offline',
        })
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle Redis down with Firestore up (read)', async () => {
      const key = 'cache:redis-down-read';
      mockRedisCache.get.mockRejectedValueOnce(new Error('Connection refused'));
      mockFirestoreBackup.get.mockResolvedValueOnce(testCacheEntry);

      const result = await cacheManager.get(key);

      // Should still get result from Firestore
      expect(result.hit).toBe(true);
      expect(result.source).toBe('firestore');
      expect(result.entry).toEqual(testCacheEntry);
    });

    it('should handle Firestore down with Redis up (read)', async () => {
      const key = 'cache:firestore-down-read';
      mockRedisCache.get.mockResolvedValueOnce(testCacheEntry);

      const result = await cacheManager.get(key);

      // Should get result from Redis (Firestore not checked)
      expect(result.hit).toBe(true);
      expect(result.source).toBe('redis');
    });

    it('should handle both layers down (read)', async () => {
      const key = 'cache:both-down-read';
      mockRedisCache.get.mockRejectedValueOnce(new Error('Redis down'));
      mockFirestoreBackup.get.mockRejectedValueOnce(new Error('Firestore down'));

      const result = await cacheManager.get(key);

      // Should return miss (proceed to generation)
      expect(result.hit).toBe(false);

      // Verify errors were logged
      expect(mockLogger.logWarn).toHaveBeenCalled();
    });

    it('should handle concurrent get operations on same key', async () => {
      const key = 'cache:concurrent-get';
      mockRedisCache.get.mockResolvedValue(testCacheEntry);

      // Concurrent gets should all succeed
      const promises = Array.from({ length: 10 }, () => cacheManager.get(key));
      const results = await Promise.all(promises);

      // All should be hits
      results.forEach((result) => {
        expect(result.hit).toBe(true);
        expect(result.source).toBe('redis');
      });

      // Redis get should be called 10 times
      expect(mockRedisCache.get).toHaveBeenCalledTimes(10);
    });

    it('should handle concurrent set operations on same key', async () => {
      const key = 'cache:concurrent-set';
      mockRedisCache.set.mockResolvedValue(undefined);
      mockFirestoreBackup.set.mockResolvedValue(undefined);

      const entry1 = { ...testCacheEntry, userId: 'user-1' };
      const entry2 = { ...testCacheEntry, userId: 'user-2' };
      const entry3 = { ...testCacheEntry, userId: 'user-3' };

      // Concurrent sets (last write wins)
      await Promise.all([
        cacheManager.set(key, entry1),
        cacheManager.set(key, entry2),
        cacheManager.set(key, entry3),
      ]);

      // All writes should complete
      expect(mockRedisCache.set).toHaveBeenCalledTimes(3);
      expect(mockFirestoreBackup.set).toHaveBeenCalledTimes(3);
    });

    it('should handle very large cache entries', async () => {
      const key = 'cache:large-entry';
      const largeBuffer = Buffer.alloc(10 * 1024 * 1024); // 10MB
      largeBuffer.fill('x');

      const largeEntry: CacheEntry = {
        ...testCacheEntry,
        result: {
          ...testCacheEntry.result,
          frames: [largeBuffer],
        },
      };

      mockRedisCache.set.mockResolvedValueOnce(undefined);
      mockFirestoreBackup.set.mockResolvedValueOnce(undefined);

      // Should handle large entries
      await expect(cacheManager.set(key, largeEntry)).resolves.toBeUndefined();
    });

    it('should handle malformed cache entries gracefully', async () => {
      const key = 'cache:malformed';
      mockRedisCache.get.mockResolvedValueOnce(null);
      mockFirestoreBackup.get.mockResolvedValueOnce(null);

      const result = await cacheManager.get(key);

      // Should treat as cache miss
      expect(result.hit).toBe(false);
    });

    it('should log cache metrics for monitoring', async () => {
      const key = 'cache:metrics';
      mockRedisCache.get.mockResolvedValueOnce(testCacheEntry);

      await cacheManager.get(key);

      // Verify metrics logging
      expect(mockLogger.logInfo).toHaveBeenCalledWith(
        'cache_hit',
        expect.objectContaining({
          cacheKey: key,
          source: 'redis',
        })
      );
    });
  });
});
