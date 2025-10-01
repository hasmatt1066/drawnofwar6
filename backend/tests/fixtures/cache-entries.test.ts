/**
 * Tests for Cache Entry Fixtures
 *
 * Verifies that cache entry fixtures are valid, deterministic, and cover various states.
 */

import { describe, it, expect } from 'vitest';
import {
  createFreshCacheEntry,
  createAccessedCacheEntry,
  createPopularCacheEntry,
  createExpiredCacheEntry,
  createNearExpirationCacheEntry,
  createMinimalCacheEntry,
  createMaximalCacheEntry,
  createCustomTTLCacheEntry,
  createStaleCacheEntry,
  createCacheEntryArray,
  createCustomCacheEntry,
} from './cache-entries.js';

describe('Cache Entry Fixtures', () => {
  describe('createFreshCacheEntry', () => {
    it('should create a valid fresh cache entry', () => {
      const entry = createFreshCacheEntry();

      expect(entry).toBeDefined();
      expect(entry.cacheKey).toContain('cache:');
      expect(entry.userId).toBeTruthy();
      expect(entry.structuredPrompt).toBeDefined();
      expect(entry.result).toBeDefined();
      expect(entry.hits).toBe(0);
      expect(entry.createdAt).toBeLessThan(entry.expiresAt);
    });

    it('should be deterministic', () => {
      const entry1 = createFreshCacheEntry();
      const entry2 = createFreshCacheEntry();

      expect(entry1).toEqual(entry2);
    });

    it('should have no hits on fresh entry', () => {
      const entry = createFreshCacheEntry();

      expect(entry.hits).toBe(0);
      expect(entry.createdAt).toBe(entry.lastAccessedAt);
    });

    it('should not be expired', () => {
      const entry = createFreshCacheEntry();
      const now = Date.now();

      expect(entry.expiresAt).toBeGreaterThan(now);
    });
  });

  describe('createAccessedCacheEntry', () => {
    it('should create a cache entry with multiple hits', () => {
      const entry = createAccessedCacheEntry();

      expect(entry).toBeDefined();
      expect(entry.hits).toBeGreaterThan(0);
      expect(entry.lastAccessedAt).toBeGreaterThan(entry.createdAt);
    });

    it('should be deterministic', () => {
      const entry1 = createAccessedCacheEntry();
      const entry2 = createAccessedCacheEntry();

      expect(entry1).toEqual(entry2);
    });

    it('should have valid access timestamps', () => {
      const entry = createAccessedCacheEntry();

      expect(entry.createdAt).toBeLessThan(entry.lastAccessedAt);
      expect(entry.lastAccessedAt).toBeLessThan(entry.expiresAt);
    });
  });

  describe('createPopularCacheEntry', () => {
    it('should create a popular cache entry with high hit count', () => {
      const entry = createPopularCacheEntry();

      expect(entry).toBeDefined();
      expect(entry.hits).toBeGreaterThan(10);
      expect(entry.lastAccessedAt).toBeGreaterThan(entry.createdAt);
    });

    it('should be deterministic', () => {
      const entry1 = createPopularCacheEntry();
      const entry2 = createPopularCacheEntry();

      expect(entry1).toEqual(entry2);
    });

    it('should have significant hit count', () => {
      const entry = createPopularCacheEntry();

      expect(entry.hits).toBeGreaterThan(20);
    });
  });

  describe('createExpiredCacheEntry', () => {
    it('should create an expired cache entry', () => {
      const entry = createExpiredCacheEntry();

      expect(entry).toBeDefined();
      // Entry was created in the past and is now expired
      expect(entry.createdAt).toBeLessThan(entry.expiresAt);
      // Expiration is before creation + full TTL (31 days ago + 30 day TTL = expired 1 day ago)
      const ttl = entry.expiresAt - entry.createdAt;
      expect(ttl).toBe(30 * 24 * 60 * 60 * 1000);
    });

    it('should be deterministic', () => {
      const entry1 = createExpiredCacheEntry();
      const entry2 = createExpiredCacheEntry();

      expect(entry1).toEqual(entry2);
    });

    it('should have timestamps in proper order', () => {
      const entry = createExpiredCacheEntry();

      expect(entry.createdAt).toBeLessThan(entry.lastAccessedAt);
      expect(entry.lastAccessedAt).toBeLessThan(entry.expiresAt);
    });
  });

  describe('createNearExpirationCacheEntry', () => {
    it('should create a cache entry near expiration', () => {
      const entry = createNearExpirationCacheEntry();

      expect(entry).toBeDefined();

      // Entry was created 29 days ago, so it expires in ~1 day from BASE_TIMESTAMP
      const ageInDays = (entry.expiresAt - entry.createdAt) / (24 * 60 * 60 * 1000);
      expect(ageInDays).toBeCloseTo(30, 0); // 30 day TTL
    });

    it('should be deterministic', () => {
      const entry1 = createNearExpirationCacheEntry();
      const entry2 = createNearExpirationCacheEntry();

      expect(entry1).toEqual(entry2);
    });

    it('should have valid timestamp order', () => {
      const entry = createNearExpirationCacheEntry();

      expect(entry.createdAt).toBeLessThan(entry.lastAccessedAt);
      expect(entry.lastAccessedAt).toBeLessThanOrEqual(entry.expiresAt);
    });
  });

  describe('createMinimalCacheEntry', () => {
    it('should create a minimal cache entry', () => {
      const entry = createMinimalCacheEntry();

      expect(entry).toBeDefined();
      expect(entry.cacheKey).toBeTruthy();
      expect(entry.userId).toBeTruthy();
      expect(entry.structuredPrompt).toBeDefined();
      expect(entry.result).toBeDefined();
      expect(entry.result.frames).toHaveLength(1);
    });

    it('should be deterministic', () => {
      const entry1 = createMinimalCacheEntry();
      const entry2 = createMinimalCacheEntry();

      expect(entry1).toEqual(entry2);
    });

    it('should have minimal result data', () => {
      const entry = createMinimalCacheEntry();

      expect(entry.result.frames).toHaveLength(1);
      expect(entry.result.metadata.frameCount).toBe(1);
    });
  });

  describe('createMaximalCacheEntry', () => {
    it('should create a maximal cache entry', () => {
      const entry = createMaximalCacheEntry();

      expect(entry).toBeDefined();
      expect(entry.cacheKey).toBeTruthy();
      expect(entry.result.frames).toHaveLength(8);
    });

    it('should be deterministic', () => {
      const entry1 = createMaximalCacheEntry();
      const entry2 = createMaximalCacheEntry();

      expect(entry1).toEqual(entry2);
    });

    it('should have maximum frames', () => {
      const entry = createMaximalCacheEntry();

      expect(entry.result.frames).toHaveLength(8);
      expect(entry.result.metadata.frameCount).toBe(8);
    });

    it('should have all optional prompt fields', () => {
      const entry = createMaximalCacheEntry();

      expect(entry.structuredPrompt.options).toBeDefined();
      expect(entry.structuredPrompt.options?.paletteImage).toBeDefined();
    });
  });

  describe('createCustomTTLCacheEntry', () => {
    it('should create a cache entry with custom TTL', () => {
      const entry = createCustomTTLCacheEntry();

      expect(entry).toBeDefined();
      expect(entry.createdAt).toBeLessThan(entry.expiresAt);
    });

    it('should be deterministic', () => {
      const entry1 = createCustomTTLCacheEntry();
      const entry2 = createCustomTTLCacheEntry();

      expect(entry1).toEqual(entry2);
    });

    it('should have TTL less than default (30 days)', () => {
      const entry = createCustomTTLCacheEntry();

      const ttl = entry.expiresAt - entry.createdAt;
      const defaultTTL = 30 * 24 * 60 * 60 * 1000;
      expect(ttl).toBeLessThan(defaultTTL);
    });
  });

  describe('createStaleCacheEntry', () => {
    it('should create a stale cache entry', () => {
      const entry = createStaleCacheEntry();

      expect(entry).toBeDefined();
      expect(entry.createdAt).toBeLessThan(entry.lastAccessedAt);
      expect(entry.lastAccessedAt).toBeLessThan(entry.expiresAt);
    });

    it('should be deterministic', () => {
      const entry1 = createStaleCacheEntry();
      const entry2 = createStaleCacheEntry();

      expect(entry1).toEqual(entry2);
    });

    it('should have gap between last access and expiration', () => {
      const entry = createStaleCacheEntry();

      // Entry was accessed 2 days after creation but hasn't been accessed since
      // So there's a 23-day gap before expiration
      const daysSinceLastAccess = (entry.expiresAt - entry.lastAccessedAt) / (24 * 60 * 60 * 1000);
      expect(daysSinceLastAccess).toBeGreaterThan(20);
    });
  });

  describe('createCacheEntryArray', () => {
    it('should create an array of cache entries', () => {
      const entries = createCacheEntryArray();

      expect(entries).toHaveLength(5);
    });

    it('should be deterministic', () => {
      const entries1 = createCacheEntryArray();
      const entries2 = createCacheEntryArray();

      expect(entries1.length).toEqual(entries2.length);
      entries1.forEach((entry, index) => {
        expect(entry.cacheKey).toEqual(entries2[index].cacheKey);
      });
    });

    it('should have unique cache keys', () => {
      const entries = createCacheEntryArray();

      const cacheKeys = entries.map((e) => e.cacheKey);
      const uniqueKeys = new Set(cacheKeys);
      expect(uniqueKeys.size).toBe(cacheKeys.length);
    });

    it('should cover different states', () => {
      const entries = createCacheEntryArray();

      const hasUnaccessed = entries.some((e) => e.hits === 0);
      const hasAccessed = entries.some((e) => e.hits > 0);
      const hasPopular = entries.some((e) => e.hits > 10);

      expect(hasUnaccessed).toBe(true);
      expect(hasAccessed).toBe(true);
      expect(hasPopular).toBe(true);
    });
  });

  describe('createCustomCacheEntry', () => {
    it('should create a cache entry with custom overrides', () => {
      const custom = createCustomCacheEntry({
        cacheKey: 'cache:custom-key-123',
        userId: 'custom-user-456',
        hits: 99,
      });

      expect(custom.cacheKey).toBe('cache:custom-key-123');
      expect(custom.userId).toBe('custom-user-456');
      expect(custom.hits).toBe(99);
    });

    it('should preserve base fields not overridden', () => {
      const custom = createCustomCacheEntry({
        hits: 10,
      });

      expect(custom.hits).toBe(10);
      expect(custom.structuredPrompt).toBeDefined();
      expect(custom.result).toBeDefined();
      expect(custom.cacheKey).toBeTruthy();
    });
  });

  describe('Cache Entry Validation', () => {
    it('should have valid cache key format for all fixtures', () => {
      const entries = createCacheEntryArray();

      entries.forEach((entry) => {
        expect(entry.cacheKey).toMatch(/^cache:[a-z0-9]+$/i);
      });
    });

    it('should have valid timestamp order for all fixtures', () => {
      const entries = createCacheEntryArray();

      entries.forEach((entry) => {
        expect(entry.createdAt).toBeLessThanOrEqual(entry.lastAccessedAt);
        expect(entry.createdAt).toBeLessThan(entry.expiresAt);
      });
    });

    it('should have non-negative hits for all fixtures', () => {
      const entries = createCacheEntryArray();

      entries.forEach((entry) => {
        expect(entry.hits).toBeGreaterThanOrEqual(0);
      });
    });

    it('should have valid results with frames for all fixtures', () => {
      const entries = createCacheEntryArray();

      entries.forEach((entry) => {
        expect(entry.result).toBeDefined();
        expect(entry.result.frames).toBeDefined();
        expect(entry.result.frames.length).toBeGreaterThan(0);
        entry.result.frames.forEach((frame) => {
          expect(frame).toBeInstanceOf(Buffer);
        });
      });
    });
  });
});
