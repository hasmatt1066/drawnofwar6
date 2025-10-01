/**
 * Test Fixtures Index
 *
 * Central export point for all test fixtures.
 * Import fixtures from this file for cleaner test code.
 *
 * @example
 * ```typescript
 * import { createTypicalPrompt, createCompletedJob } from '../fixtures';
 * ```
 */

// Prompt fixtures
export {
  createMinimalPrompt,
  createTypicalPrompt,
  createMaximalPrompt,
  createInvalidPrompt,
  createEdgeCasePrompt,
  createMaxTextGuidancePrompt,
  createLargeSizePrompt,
} from './prompts.js';

// Result fixtures
export {
  createMinimalImageBuffer,
  createSmallImageBuffer,
  createMinimalSpriteResult,
  createTypicalSpriteResult,
  createMaximalSpriteResult,
  createCachedSpriteResult,
  createMinimalGenerationResult,
  createTypicalGenerationResult,
  createMaximalGenerationResult,
} from './results.js';

// Queue job fixtures
export {
  createPendingJob,
  createProcessingJob,
  createCompletedJob,
  createFailedJob,
  createRetryingJob,
  createCachedJob,
  createMinimalJob,
  createLongRunningJob,
  createJobArray,
  createCustomJob,
} from './queue-jobs.js';

// Cache entry fixtures
export {
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

// Error fixtures
export {
  createAuthError,
  createRateLimitError,
  createQuotaError,
  createTimeoutError,
  createNetworkError,
  createServerError,
  createValidationError,
  createParameterError,
  createDatabaseError,
  createInvalidRequestError,
  createUnknownError,
  createMultipleValidationErrors,
  createRetryableErrors,
  createNonRetryableErrors,
  createGenericError,
  createErrorWithStack,
  createCustomError,
} from './errors.js';
