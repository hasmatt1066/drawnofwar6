/**
 * Test Fixtures: CacheEntry
 *
 * Provides deterministic test data for cache entries with varying
 * expiration states, hit counts, and access patterns.
 */

import type { CacheEntry } from '../../src/cache/redis-cache.js';
import { createTypicalPrompt, createMinimalPrompt, createMaximalPrompt } from './prompts.js';
import { createTypicalSpriteResult, createMinimalSpriteResult, createMaximalSpriteResult } from './results.js';

/**
 * Base timestamp for deterministic time-based testing
 * Using far-future date to ensure fixtures don't expire during testing
 */
const BASE_TIMESTAMP = 2000000000000; // 2033-05-18T03:33:20Z

/**
 * Default TTL: 30 days in milliseconds
 */
const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Fresh cache entry (recently created, no hits)
 *
 * Use case: Testing new cache entries
 */
export function createFreshCacheEntry(): CacheEntry {
  return {
    cacheKey: 'cache:abc123def456ghi789',
    userId: 'user-test-123',
    structuredPrompt: createTypicalPrompt(),
    result: createTypicalSpriteResult(),
    createdAt: BASE_TIMESTAMP,
    expiresAt: BASE_TIMESTAMP + DEFAULT_TTL_MS,
    hits: 0,
    lastAccessedAt: BASE_TIMESTAMP,
  };
}

/**
 * Accessed cache entry (has been hit multiple times)
 *
 * Use case: Testing cache hit tracking and popularity
 */
export function createAccessedCacheEntry(): CacheEntry {
  const lastAccessed = BASE_TIMESTAMP + 24 * 60 * 60 * 1000; // 1 day later
  return {
    cacheKey: 'cache:def456ghi789jkl012',
    userId: 'user-test-123',
    structuredPrompt: createTypicalPrompt(),
    result: createTypicalSpriteResult(),
    createdAt: BASE_TIMESTAMP,
    expiresAt: BASE_TIMESTAMP + DEFAULT_TTL_MS,
    hits: 5,
    lastAccessedAt: lastAccessed,
  };
}

/**
 * Popular cache entry (high hit count)
 *
 * Use case: Testing cache analytics and popular content
 */
export function createPopularCacheEntry(): CacheEntry {
  const lastAccessed = BASE_TIMESTAMP + 7 * 24 * 60 * 60 * 1000; // 7 days later
  return {
    cacheKey: 'cache:ghi789jkl012mno345',
    userId: 'user-test-456',
    structuredPrompt: createTypicalPrompt(),
    result: createTypicalSpriteResult(),
    createdAt: BASE_TIMESTAMP,
    expiresAt: BASE_TIMESTAMP + DEFAULT_TTL_MS,
    hits: 42,
    lastAccessedAt: lastAccessed,
  };
}

/**
 * Expired cache entry (past expiration date)
 *
 * Use case: Testing TTL expiration and cleanup
 */
export function createExpiredCacheEntry(): CacheEntry {
  const oldTimestamp = BASE_TIMESTAMP - (31 * 24 * 60 * 60 * 1000); // 31 days ago
  return {
    cacheKey: 'cache:jkl012mno345pqr678',
    userId: 'user-test-789',
    structuredPrompt: createMinimalPrompt(),
    result: createMinimalSpriteResult(),
    createdAt: oldTimestamp,
    expiresAt: oldTimestamp + DEFAULT_TTL_MS, // Expired 1 day ago
    hits: 3,
    lastAccessedAt: oldTimestamp + 24 * 60 * 60 * 1000,
  };
}

/**
 * Near-expiration cache entry (expires soon)
 *
 * Use case: Testing cache refresh logic and expiration warnings
 */
export function createNearExpirationCacheEntry(): CacheEntry {
  const almostExpired = BASE_TIMESTAMP + (24 * 60 * 60 * 1000); // Expires in 1 day
  return {
    cacheKey: 'cache:mno345pqr678stu901',
    userId: 'user-test-123',
    structuredPrompt: createTypicalPrompt(),
    result: createTypicalSpriteResult(),
    createdAt: BASE_TIMESTAMP - (29 * 24 * 60 * 60 * 1000), // Created 29 days ago
    expiresAt: almostExpired,
    hits: 12,
    lastAccessedAt: BASE_TIMESTAMP,
  };
}

/**
 * Minimal cache entry (smallest valid data)
 *
 * Use case: Testing minimal valid cache entries
 */
export function createMinimalCacheEntry(): CacheEntry {
  return {
    cacheKey: 'cache:pqr678stu901vwx234',
    userId: 'user-minimal-001',
    structuredPrompt: createMinimalPrompt(),
    result: createMinimalSpriteResult(),
    createdAt: BASE_TIMESTAMP,
    expiresAt: BASE_TIMESTAMP + DEFAULT_TTL_MS,
    hits: 0,
    lastAccessedAt: BASE_TIMESTAMP,
  };
}

/**
 * Maximal cache entry (largest valid data)
 *
 * Use case: Testing large cache entries with 8 frames
 */
export function createMaximalCacheEntry(): CacheEntry {
  return {
    cacheKey: 'cache:stu901vwx234yz5678',
    userId: 'user-test-123',
    structuredPrompt: createMaximalPrompt(),
    result: createMaximalSpriteResult(),
    createdAt: BASE_TIMESTAMP,
    expiresAt: BASE_TIMESTAMP + DEFAULT_TTL_MS,
    hits: 0,
    lastAccessedAt: BASE_TIMESTAMP,
  };
}

/**
 * Cache entry with custom TTL (7 days)
 *
 * Use case: Testing custom expiration periods
 */
export function createCustomTTLCacheEntry(): CacheEntry {
  const customTTL = 7 * 24 * 60 * 60 * 1000; // 7 days
  return {
    cacheKey: 'cache:vwx234yz5678abc901',
    userId: 'user-test-456',
    structuredPrompt: createTypicalPrompt(),
    result: createTypicalSpriteResult(),
    createdAt: BASE_TIMESTAMP,
    expiresAt: BASE_TIMESTAMP + customTTL,
    hits: 1,
    lastAccessedAt: BASE_TIMESTAMP,
  };
}

/**
 * Stale cache entry (old but not expired)
 *
 * Use case: Testing old entries that haven't been accessed recently
 */
export function createStaleCacheEntry(): CacheEntry {
  const oldCreation = BASE_TIMESTAMP - (25 * 24 * 60 * 60 * 1000); // 25 days ago
  return {
    cacheKey: 'cache:yz5678abc901def234',
    userId: 'user-test-789',
    structuredPrompt: createTypicalPrompt(),
    result: createTypicalSpriteResult(),
    createdAt: oldCreation,
    expiresAt: oldCreation + DEFAULT_TTL_MS, // Expires in 5 days
    hits: 1,
    lastAccessedAt: oldCreation + (2 * 24 * 60 * 60 * 1000), // Last accessed 23 days ago
  };
}

/**
 * Array of cache entries for batch testing
 *
 * Use case: Testing cache statistics and management
 */
export function createCacheEntryArray(): CacheEntry[] {
  return [
    createFreshCacheEntry(),
    createAccessedCacheEntry(),
    createPopularCacheEntry(),
    createNearExpirationCacheEntry(),
    createStaleCacheEntry(),
  ];
}

/**
 * Create cache entry with custom properties
 *
 * Use case: Testing with specific configurations
 */
export function createCustomCacheEntry(
  overrides: Partial<CacheEntry>
): CacheEntry {
  const base = createFreshCacheEntry();
  return {
    ...base,
    ...overrides,
  };
}
