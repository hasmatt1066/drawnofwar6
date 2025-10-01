/**
 * Test Fixtures: QueueJob (BullMQ Jobs)
 *
 * Provides deterministic test data for queue jobs in various states.
 * Covers pending, processing, completed, failed, and retrying scenarios.
 */

import type { QueueJob, JobStatus } from '../../src/queue/job-status-tracker.js';
import { createTypicalPrompt, createMinimalPrompt } from './prompts.js';
import { createTypicalSpriteResult, createCachedSpriteResult } from './results.js';

/**
 * Base timestamp for deterministic time-based testing
 */
const BASE_TIMESTAMP = 1727712000000; // 2025-09-30T12:00:00Z

/**
 * Pending job fixture (waiting in queue)
 *
 * Use case: Testing job submission and queue status
 */
export function createPendingJob(): QueueJob {
  return {
    jobId: 'job-pending-001',
    userId: 'user-test-123',
    structuredPrompt: createTypicalPrompt(),
    cacheKey: 'cache:abc123def456',
    status: 'pending' as JobStatus,
    progress: 0,
    createdAt: BASE_TIMESTAMP,
    retryCount: 0,
    metadata: {
      cacheHit: false,
      estimatedDuration: 30000,
    },
  };
}

/**
 * Processing job fixture (currently being processed)
 *
 * Use case: Testing job execution and progress tracking
 */
export function createProcessingJob(): QueueJob {
  return {
    jobId: 'job-processing-002',
    userId: 'user-test-123',
    structuredPrompt: createTypicalPrompt(),
    cacheKey: 'cache:def789ghi012',
    status: 'processing' as JobStatus,
    progress: 45,
    createdAt: BASE_TIMESTAMP,
    startedAt: BASE_TIMESTAMP + 5000,
    retryCount: 0,
    pixelLabJobId: 'pixellab-processing-456',
    metadata: {
      cacheHit: false,
      estimatedDuration: 30000,
    },
  };
}

/**
 * Completed job fixture (successfully finished)
 *
 * Use case: Testing successful job completion and result retrieval
 */
export function createCompletedJob(): QueueJob {
  return {
    jobId: 'job-completed-003',
    userId: 'user-test-123',
    structuredPrompt: createTypicalPrompt(),
    cacheKey: 'cache:ghi345jkl678',
    status: 'completed' as JobStatus,
    progress: 100,
    createdAt: BASE_TIMESTAMP,
    startedAt: BASE_TIMESTAMP + 2000,
    completedAt: BASE_TIMESTAMP + 28000,
    retryCount: 0,
    pixelLabJobId: 'pixellab-completed-789',
    result: createTypicalSpriteResult(),
    metadata: {
      cacheHit: false,
      estimatedDuration: 30000,
      actualDuration: 26000,
    },
  };
}

/**
 * Failed job fixture (permanently failed after max retries)
 *
 * Use case: Testing error handling and failure scenarios
 */
export function createFailedJob(): QueueJob {
  return {
    jobId: 'job-failed-004',
    userId: 'user-test-456',
    structuredPrompt: createMinimalPrompt(),
    cacheKey: 'cache:jkl901mno234',
    status: 'failed' as JobStatus,
    progress: 30,
    createdAt: BASE_TIMESTAMP,
    startedAt: BASE_TIMESTAMP + 1000,
    completedAt: BASE_TIMESTAMP + 120000,
    retryCount: 3,
    pixelLabJobId: 'pixellab-failed-012',
    errorMessage: 'PixelLab API error: Rate limit exceeded',
    metadata: {
      cacheHit: false,
      estimatedDuration: 30000,
    },
  };
}

/**
 * Retrying job fixture (failed but retrying)
 *
 * Use case: Testing retry logic and resilience
 */
export function createRetryingJob(): QueueJob {
  return {
    jobId: 'job-retrying-005',
    userId: 'user-test-789',
    structuredPrompt: createTypicalPrompt(),
    cacheKey: 'cache:mno567pqr890',
    status: 'retrying' as JobStatus,
    progress: 20,
    createdAt: BASE_TIMESTAMP,
    startedAt: BASE_TIMESTAMP + 3000,
    retryCount: 1,
    pixelLabJobId: 'pixellab-retrying-345',
    errorMessage: 'PixelLab API error: Timeout',
    metadata: {
      cacheHit: false,
      estimatedDuration: 30000,
    },
  };
}

/**
 * Cached job fixture (completed via cache hit)
 *
 * Use case: Testing cache hit flow and fast response
 */
export function createCachedJob(): QueueJob {
  return {
    jobId: 'job-cached-006',
    userId: 'user-test-123',
    structuredPrompt: createTypicalPrompt(),
    cacheKey: 'cache:pqr123stu456',
    status: 'completed' as JobStatus,
    progress: 100,
    createdAt: BASE_TIMESTAMP,
    startedAt: BASE_TIMESTAMP + 100,
    completedAt: BASE_TIMESTAMP + 150,
    retryCount: 0,
    result: createCachedSpriteResult(),
    metadata: {
      cacheHit: true,
      estimatedDuration: 100,
      actualDuration: 50,
    },
  };
}

/**
 * Job with minimal data (edge case)
 *
 * Use case: Testing handling of jobs with minimal information
 */
export function createMinimalJob(): QueueJob {
  return {
    jobId: 'job-minimal-007',
    userId: 'user-minimal-001',
    structuredPrompt: createMinimalPrompt(),
    cacheKey: 'cache:stu789vwx012',
    status: 'pending' as JobStatus,
    progress: 0,
    createdAt: BASE_TIMESTAMP,
    retryCount: 0,
    metadata: {
      cacheHit: false,
    },
  };
}

/**
 * Long-running job fixture
 *
 * Use case: Testing timeout scenarios and long-running jobs
 */
export function createLongRunningJob(): QueueJob {
  return {
    jobId: 'job-long-008',
    userId: 'user-test-123',
    structuredPrompt: createTypicalPrompt(),
    cacheKey: 'cache:vwx345yz678',
    status: 'processing' as JobStatus,
    progress: 75,
    createdAt: BASE_TIMESTAMP,
    startedAt: BASE_TIMESTAMP + 1000,
    retryCount: 0,
    pixelLabJobId: 'pixellab-long-678',
    metadata: {
      cacheHit: false,
      estimatedDuration: 60000,
    },
  };
}

/**
 * Job array fixture for batch testing
 *
 * Use case: Testing user job lists and queue metrics
 */
export function createJobArray(): QueueJob[] {
  return [
    createPendingJob(),
    createProcessingJob(),
    createCompletedJob(),
    createFailedJob(),
    createRetryingJob(),
    createCachedJob(),
  ];
}

/**
 * Create job with custom properties
 *
 * Use case: Testing with specific configurations
 */
export function createCustomJob(
  overrides: Partial<QueueJob>
): QueueJob {
  const base = createPendingJob();
  return {
    ...base,
    ...overrides,
  };
}
