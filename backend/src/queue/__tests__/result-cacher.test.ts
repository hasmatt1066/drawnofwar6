/**
 * Task 6.2: Result Caching After Successful Generation - Tests
 *
 * Tests for caching completed sprite generation results in Redis + Firestore
 * for 30-day reuse. Validates integration with CacheManager from Phase 2.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResultCacher } from '../result-cacher.js';
import type { CacheManager, CacheLookupResult } from '../../cache/cache-manager.js';
import type { QueueLogger } from '../logger.js';
import type { StructuredPrompt, SpriteGenerationResult } from '../job-status-tracker.js';

describe('ResultCacher', () => {
  let resultCacher: ResultCacher;
  let mockCacheManager: CacheManager;
  let mockLogger: QueueLogger;

  const testUserId = 'user-123';
  const testCacheKey = 'cache:abc123def456';
  const testPrompt: StructuredPrompt = {
    type: 'character',
    style: 'pixel-art',
    size: { width: 32, height: 32 },
    action: 'walking',
    description: 'a brave knight',
    raw: 'a brave knight walking',
  };
  const testResult: SpriteGenerationResult = {
    jobId: 'job-789',
    frames: [Buffer.from('frame1'), Buffer.from('frame2')],
    metadata: {
      dimensions: { width: 32, height: 32 },
      frameCount: 2,
      generationTimeMs: 5000,
      cacheHit: false,
      pixelLabJobId: 'pixellab-123',
    },
  };

  beforeEach(() => {
    // Create mock CacheManager
    mockCacheManager = {
      get: vi.fn(),
      set: vi.fn(),
    } as any;

    // Create mock logger
    mockLogger = {
      logInfo: vi.fn(),
      logWarn: vi.fn(),
      logError: vi.fn(),
    } as any;

    resultCacher = new ResultCacher(mockCacheManager, mockLogger);
  });

  describe('cacheResult', () => {
    it('should create cache entry with correct structure', async () => {
      // Arrange
      vi.mocked(mockCacheManager.set).mockResolvedValue();

      // Act
      const result = await resultCacher.cacheResult(
        testCacheKey,
        testUserId,
        testPrompt,
        testResult
      );

      // Assert
      expect(result).toBe(true);
      expect(mockCacheManager.set).toHaveBeenCalledOnce();

      const [cacheKey, entry] = vi.mocked(mockCacheManager.set).mock.calls[0];
      expect(cacheKey).toBe(testCacheKey);
      expect(entry).toMatchObject({
        cacheKey: testCacheKey,
        userId: testUserId,
        structuredPrompt: testPrompt,
        result: testResult,
        hits: 0,
      });
      expect(entry.createdAt).toBeTypeOf('number');
      expect(entry.expiresAt).toBeTypeOf('number');
      expect(entry.lastAccessedAt).toBeTypeOf('number');
    });

    it('should set 30-day TTL correctly', async () => {
      // Arrange
      vi.mocked(mockCacheManager.set).mockResolvedValue();
      const beforeTime = Date.now();

      // Act
      await resultCacher.cacheResult(
        testCacheKey,
        testUserId,
        testPrompt,
        testResult
      );

      // Assert
      const [, entry] = vi.mocked(mockCacheManager.set).mock.calls[0];
      const expectedTTL = 30 * 24 * 60 * 60 * 1000; // 30 days in ms
      const actualTTL = entry.expiresAt - entry.createdAt;

      // Allow for small timing difference (within 100ms)
      expect(actualTTL).toBeGreaterThanOrEqual(expectedTTL - 100);
      expect(actualTTL).toBeLessThanOrEqual(expectedTTL + 100);
      expect(entry.createdAt).toBeGreaterThanOrEqual(beforeTime);
    });

    it('should initialize hits counter to 0', async () => {
      // Arrange
      vi.mocked(mockCacheManager.set).mockResolvedValue();

      // Act
      await resultCacher.cacheResult(
        testCacheKey,
        testUserId,
        testPrompt,
        testResult
      );

      // Assert
      const [, entry] = vi.mocked(mockCacheManager.set).mock.calls[0];
      expect(entry.hits).toBe(0);
    });

    it('should set lastAccessedAt to current timestamp', async () => {
      // Arrange
      vi.mocked(mockCacheManager.set).mockResolvedValue();
      const beforeTime = Date.now();

      // Act
      await resultCacher.cacheResult(
        testCacheKey,
        testUserId,
        testPrompt,
        testResult
      );

      const afterTime = Date.now();

      // Assert
      const [, entry] = vi.mocked(mockCacheManager.set).mock.calls[0];
      expect(entry.lastAccessedAt).toBeGreaterThanOrEqual(beforeTime);
      expect(entry.lastAccessedAt).toBeLessThanOrEqual(afterTime);
    });

    it('should log cache write success', async () => {
      // Arrange
      vi.mocked(mockCacheManager.set).mockResolvedValue();

      // Act
      await resultCacher.cacheResult(
        testCacheKey,
        testUserId,
        testPrompt,
        testResult
      );

      // Assert
      expect(mockLogger.logInfo).toHaveBeenCalledWith('result_cached', {
        cacheKey: testCacheKey,
        userId: testUserId,
        jobId: testResult.jobId,
        frameCount: testResult.frames.length,
      });
    });

    it('should handle cache write failures gracefully', async () => {
      // Arrange
      const testError = new Error('Redis connection failed');
      vi.mocked(mockCacheManager.set).mockRejectedValue(testError);

      // Act
      const result = await resultCacher.cacheResult(
        testCacheKey,
        testUserId,
        testPrompt,
        testResult
      );

      // Assert - should return false but not throw
      expect(result).toBe(false);
      expect(mockLogger.logWarn).toHaveBeenCalledWith('result_cache_failed', {
        cacheKey: testCacheKey,
        userId: testUserId,
        jobId: testResult.jobId,
        error: testError.message,
      });
    });

    it('should not throw on cache failure', async () => {
      // Arrange
      vi.mocked(mockCacheManager.set).mockRejectedValue(new Error('Network error'));

      // Act & Assert - should not throw
      await expect(
        resultCacher.cacheResult(testCacheKey, testUserId, testPrompt, testResult)
      ).resolves.toBe(false);
    });

    it('should handle very large sprite data', async () => {
      // Arrange
      vi.mocked(mockCacheManager.set).mockResolvedValue();
      const largeBuffer = Buffer.alloc(5 * 1024 * 1024); // 5MB buffer
      const largeResult: SpriteGenerationResult = {
        ...testResult,
        frames: Array(8).fill(largeBuffer), // 40MB total
      };

      // Act
      const result = await resultCacher.cacheResult(
        testCacheKey,
        testUserId,
        testPrompt,
        largeResult
      );

      // Assert
      expect(result).toBe(true);
      expect(mockCacheManager.set).toHaveBeenCalledOnce();
    });

    it('should handle cache write timeout', async () => {
      // Arrange
      const timeoutError = new Error('Operation timed out');
      timeoutError.name = 'TimeoutError';
      vi.mocked(mockCacheManager.set).mockRejectedValue(timeoutError);

      // Act
      const result = await resultCacher.cacheResult(
        testCacheKey,
        testUserId,
        testPrompt,
        testResult
      );

      // Assert
      expect(result).toBe(false);
      expect(mockLogger.logWarn).toHaveBeenCalledWith('result_cache_failed', {
        cacheKey: testCacheKey,
        userId: testUserId,
        jobId: testResult.jobId,
        error: timeoutError.message,
      });
    });
  });

  describe('verifyCached', () => {
    it('should return true when cache entry exists', async () => {
      // Arrange
      const mockCacheResult: CacheLookupResult = {
        hit: true,
        entry: {
          cacheKey: testCacheKey,
          userId: testUserId,
          structuredPrompt: testPrompt,
          result: testResult,
          createdAt: Date.now(),
          expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
          hits: 0,
          lastAccessedAt: Date.now(),
        },
        source: 'redis',
      };
      vi.mocked(mockCacheManager.get).mockResolvedValue(mockCacheResult);

      // Act
      const result = await resultCacher.verifyCached(testCacheKey);

      // Assert
      expect(result).toBe(true);
      expect(mockCacheManager.get).toHaveBeenCalledWith(testCacheKey);
    });

    it('should return false when cache entry does not exist', async () => {
      // Arrange
      const mockCacheResult: CacheLookupResult = {
        hit: false,
      };
      vi.mocked(mockCacheManager.get).mockResolvedValue(mockCacheResult);

      // Act
      const result = await resultCacher.verifyCached(testCacheKey);

      // Assert
      expect(result).toBe(false);
      expect(mockCacheManager.get).toHaveBeenCalledWith(testCacheKey);
    });

    it('should return false on cache lookup error', async () => {
      // Arrange
      vi.mocked(mockCacheManager.get).mockRejectedValue(new Error('Cache error'));

      // Act
      const result = await resultCacher.verifyCached(testCacheKey);

      // Assert
      expect(result).toBe(false);
      expect(mockLogger.logWarn).toHaveBeenCalledWith('cache_verify_failed', {
        cacheKey: testCacheKey,
        error: 'Cache error',
      });
    });

    it('should handle Redis being down', async () => {
      // Arrange
      vi.mocked(mockCacheManager.get).mockRejectedValue(
        new Error('Connection refused')
      );

      // Act
      const result = await resultCacher.verifyCached(testCacheKey);

      // Assert - should return false gracefully
      expect(result).toBe(false);
      expect(mockLogger.logWarn).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle concurrent cache writes for same key', async () => {
      // Arrange
      vi.mocked(mockCacheManager.set).mockResolvedValue();

      // Act - multiple concurrent writes
      const promises = Array(3)
        .fill(null)
        .map(() =>
          resultCacher.cacheResult(testCacheKey, testUserId, testPrompt, testResult)
        );

      const results = await Promise.all(promises);

      // Assert - all should succeed (last write wins)
      expect(results).toEqual([true, true, true]);
      expect(mockCacheManager.set).toHaveBeenCalledTimes(3);
    });

    it('should handle empty frames array', async () => {
      // Arrange
      vi.mocked(mockCacheManager.set).mockResolvedValue();
      const emptyResult: SpriteGenerationResult = {
        ...testResult,
        frames: [],
        metadata: {
          ...testResult.metadata,
          frameCount: 0,
        },
      };

      // Act
      const result = await resultCacher.cacheResult(
        testCacheKey,
        testUserId,
        testPrompt,
        emptyResult
      );

      // Assert
      expect(result).toBe(true);
      expect(mockCacheManager.set).toHaveBeenCalled();
    });

    it('should handle prompt with optional fields', async () => {
      // Arrange
      vi.mocked(mockCacheManager.set).mockResolvedValue();
      const promptWithOptions: StructuredPrompt = {
        ...testPrompt,
        options: {
          noBackground: true,
          textGuidanceScale: 7.5,
          paletteImage: 'base64-encoded-image',
        },
      };

      // Act
      const result = await resultCacher.cacheResult(
        testCacheKey,
        testUserId,
        promptWithOptions,
        testResult
      );

      // Assert
      expect(result).toBe(true);
      const [, entry] = vi.mocked(mockCacheManager.set).mock.calls[0];
      expect(entry.structuredPrompt.options).toEqual(promptWithOptions.options);
    });

    it('should handle result with optional pixelLabJobId', async () => {
      // Arrange
      vi.mocked(mockCacheManager.set).mockResolvedValue();
      const resultWithJobId: SpriteGenerationResult = {
        ...testResult,
        metadata: {
          ...testResult.metadata,
          pixelLabJobId: 'pixellab-abc-123',
        },
      };

      // Act
      const result = await resultCacher.cacheResult(
        testCacheKey,
        testUserId,
        testPrompt,
        resultWithJobId
      );

      // Assert
      expect(result).toBe(true);
      const [, entry] = vi.mocked(mockCacheManager.set).mock.calls[0];
      expect(entry.result.metadata.pixelLabJobId).toBe('pixellab-abc-123');
    });

    it('should handle special characters in userId', async () => {
      // Arrange
      vi.mocked(mockCacheManager.set).mockResolvedValue();
      const specialUserId = 'user-with-émoji-™-©';

      // Act
      const result = await resultCacher.cacheResult(
        testCacheKey,
        specialUserId,
        testPrompt,
        testResult
      );

      // Assert
      expect(result).toBe(true);
      const [, entry] = vi.mocked(mockCacheManager.set).mock.calls[0];
      expect(entry.userId).toBe(specialUserId);
    });

    it('should handle very long cache keys', async () => {
      // Arrange
      vi.mocked(mockCacheManager.set).mockResolvedValue();
      const longCacheKey = 'cache:' + 'a'.repeat(200);

      // Act
      const result = await resultCacher.cacheResult(
        longCacheKey,
        testUserId,
        testPrompt,
        testResult
      );

      // Assert
      expect(result).toBe(true);
      expect(mockCacheManager.set).toHaveBeenCalledWith(longCacheKey, expect.any(Object));
    });

    it('should preserve all result metadata fields', async () => {
      // Arrange
      vi.mocked(mockCacheManager.set).mockResolvedValue();
      const detailedResult: SpriteGenerationResult = {
        jobId: 'job-789',
        frames: [Buffer.from('frame1')],
        metadata: {
          dimensions: { width: 64, height: 64 },
          frameCount: 1,
          generationTimeMs: 12345,
          cacheHit: false,
          pixelLabJobId: 'pixellab-999',
        },
      };

      // Act
      await resultCacher.cacheResult(
        testCacheKey,
        testUserId,
        testPrompt,
        detailedResult
      );

      // Assert
      const [, entry] = vi.mocked(mockCacheManager.set).mock.calls[0];
      expect(entry.result.metadata).toEqual(detailedResult.metadata);
    });
  });

  describe('immediate retrieval after caching', () => {
    it('should allow retrieval immediately after caching', async () => {
      // Arrange
      vi.mocked(mockCacheManager.set).mockResolvedValue();

      const cachedEntry = {
        cacheKey: testCacheKey,
        userId: testUserId,
        structuredPrompt: testPrompt,
        result: testResult,
        createdAt: Date.now(),
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        hits: 0,
        lastAccessedAt: Date.now(),
      };

      vi.mocked(mockCacheManager.get).mockResolvedValue({
        hit: true,
        entry: cachedEntry,
        source: 'redis',
      });

      // Act
      const cacheResult = await resultCacher.cacheResult(
        testCacheKey,
        testUserId,
        testPrompt,
        testResult
      );
      const verifyResult = await resultCacher.verifyCached(testCacheKey);

      // Assert
      expect(cacheResult).toBe(true);
      expect(verifyResult).toBe(true);
    });
  });
});
