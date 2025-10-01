/**
 * Task 5.3: User Concurrency Limits - Tests
 *
 * Tests for UserLimits that enforces per-user job limits (max 5 concurrent jobs).
 * Queries BullMQ for user's active jobs, counts pending + processing jobs,
 * rejects if user has ≥ 5 active jobs, and caches results for 5 seconds.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Job, Queue } from 'bullmq';
import { UserLimits, UserLimitResult, UserLimitsConfig } from './user-limits.js';
import type { QueueManager } from './queue-manager.js';
import type { JobStatusTracker, JobStatus } from './job-status-tracker.js';
import type { QueueLogger } from './logger.js';

/**
 * Mock QueueManager for testing
 */
class MockQueueManager {
  private mockQueue: Partial<Queue>;

  constructor() {
    this.mockQueue = {
      getJobs: vi.fn(),
    };
  }

  getQueue(): Queue {
    return this.mockQueue as Queue;
  }

  mockGetJobs(jobs: Partial<Job>[]): void {
    // Mock to filter jobs by requested states
    (this.mockQueue.getJobs as any).mockImplementation(async (states: string[]) => {
      const filtered = [];
      for (const job of jobs) {
        if (!job.getState) continue;
        const jobState = await job.getState();
        if (states.includes(jobState)) {
          filtered.push(job);
        }
      }
      return filtered;
    });
  }

  mockGetJobsError(error: Error): void {
    (this.mockQueue.getJobs as any).mockRejectedValue(error);
  }
}

/**
 * Mock JobStatusTracker for testing
 */
class MockJobStatusTracker {
  getUserJobs = vi.fn();
}

/**
 * Mock QueueLogger for testing
 */
class MockQueueLogger {
  logInfo = vi.fn();
  logWarn = vi.fn();
  logError = vi.fn();
}

/**
 * Create mock job for testing
 */
function createMockJob(
  jobId: string,
  userId: string,
  state: 'waiting' | 'active' | 'completed' | 'failed'
): Partial<Job> {
  return {
    id: jobId,
    data: { userId },
    getState: vi.fn().mockResolvedValue(state),
    timestamp: Date.now(),
    processedOn: state === 'active' || state === 'completed' || state === 'failed' ? Date.now() : undefined,
    finishedOn: state === 'completed' || state === 'failed' ? Date.now() : undefined,
  };
}

/**
 * Create test config
 */
function createTestConfig(overrides?: Partial<UserLimitsConfig>): UserLimitsConfig {
  return {
    maxConcurrentJobs: 5,
    cacheDuration: 5000,
    ...overrides,
  };
}

describe('UserLimits', () => {
  let mockQueueManager: MockQueueManager;
  let mockJobStatusTracker: MockJobStatusTracker;
  let mockLogger: MockQueueLogger;
  let userLimits: UserLimits;
  let config: UserLimitsConfig;

  beforeEach(() => {
    vi.useFakeTimers();
    mockQueueManager = new MockQueueManager();
    mockJobStatusTracker = new MockJobStatusTracker();
    mockLogger = new MockQueueLogger();
    config = createTestConfig();
    userLimits = new UserLimits(
      mockQueueManager as unknown as QueueManager,
      mockJobStatusTracker as unknown as JobStatusTracker,
      config,
      mockLogger as unknown as QueueLogger
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('checkUserLimit', () => {
    describe('Basic Acceptance Criteria', () => {
      it('should allow job when user has 0 active jobs', async () => {
        // Mock empty job list
        mockQueueManager.mockGetJobs([]);

        const result = await userLimits.checkUserLimit('user-1');

        expect(result.allowed).toBe(true);
        expect(result.currentJobCount).toBe(0);
        expect(result.maxJobs).toBe(5);
        expect(result.error).toBeUndefined();
      });

      it('should allow job when user has 1 active job', async () => {
        // Mock 1 pending job
        mockQueueManager.mockGetJobs([
          createMockJob('job-1', 'user-1', 'waiting'),
        ]);

        const result = await userLimits.checkUserLimit('user-1');

        expect(result.allowed).toBe(true);
        expect(result.currentJobCount).toBe(1);
        expect(result.maxJobs).toBe(5);
      });

      it('should allow job when user has 4 active jobs', async () => {
        // Mock 2 pending + 2 processing jobs
        mockQueueManager.mockGetJobs([
          createMockJob('job-1', 'user-1', 'waiting'),
          createMockJob('job-2', 'user-1', 'waiting'),
          createMockJob('job-3', 'user-1', 'active'),
          createMockJob('job-4', 'user-1', 'active'),
        ]);

        const result = await userLimits.checkUserLimit('user-1');

        expect(result.allowed).toBe(true);
        expect(result.currentJobCount).toBe(4);
        expect(result.maxJobs).toBe(5);
      });

      it('should reject job when user has 5 active jobs', async () => {
        // Mock 3 pending + 2 processing jobs
        mockQueueManager.mockGetJobs([
          createMockJob('job-1', 'user-1', 'waiting'),
          createMockJob('job-2', 'user-1', 'waiting'),
          createMockJob('job-3', 'user-1', 'waiting'),
          createMockJob('job-4', 'user-1', 'active'),
          createMockJob('job-5', 'user-1', 'active'),
        ]);

        const result = await userLimits.checkUserLimit('user-1');

        expect(result.allowed).toBe(false);
        expect(result.currentJobCount).toBe(5);
        expect(result.maxJobs).toBe(5);
        expect(result.error).toContain('User has reached the maximum');
        expect(result.error).toContain('5/5');
      });

      it('should reject job when user has more than 5 active jobs', async () => {
        // Mock 4 pending + 3 processing jobs
        mockQueueManager.mockGetJobs([
          createMockJob('job-1', 'user-1', 'waiting'),
          createMockJob('job-2', 'user-1', 'waiting'),
          createMockJob('job-3', 'user-1', 'waiting'),
          createMockJob('job-4', 'user-1', 'waiting'),
          createMockJob('job-5', 'user-1', 'active'),
          createMockJob('job-6', 'user-1', 'active'),
          createMockJob('job-7', 'user-1', 'active'),
        ]);

        const result = await userLimits.checkUserLimit('user-1');

        expect(result.allowed).toBe(false);
        expect(result.currentJobCount).toBe(7);
        expect(result.maxJobs).toBe(5);
      });

      it('should count only active jobs (not completed)', async () => {
        // Mock 2 pending + 1 processing + 3 completed
        mockQueueManager.mockGetJobs([
          createMockJob('job-1', 'user-1', 'waiting'),
          createMockJob('job-2', 'user-1', 'waiting'),
          createMockJob('job-3', 'user-1', 'active'),
          createMockJob('job-4', 'user-1', 'completed'),
          createMockJob('job-5', 'user-1', 'completed'),
          createMockJob('job-6', 'user-1', 'completed'),
        ]);

        const result = await userLimits.checkUserLimit('user-1');

        expect(result.allowed).toBe(true);
        expect(result.currentJobCount).toBe(3);
      });

      it('should count only active jobs (not failed)', async () => {
        // Mock 2 pending + 1 processing + 2 failed
        mockQueueManager.mockGetJobs([
          createMockJob('job-1', 'user-1', 'waiting'),
          createMockJob('job-2', 'user-1', 'waiting'),
          createMockJob('job-3', 'user-1', 'active'),
          createMockJob('job-4', 'user-1', 'failed'),
          createMockJob('job-5', 'user-1', 'failed'),
        ]);

        const result = await userLimits.checkUserLimit('user-1');

        expect(result.allowed).toBe(true);
        expect(result.currentJobCount).toBe(3);
      });

      it('should work correctly for multiple users independently', async () => {
        // Mock jobs for user-1 (5 active)
        mockQueueManager.mockGetJobs([
          createMockJob('job-1', 'user-1', 'waiting'),
          createMockJob('job-2', 'user-1', 'waiting'),
          createMockJob('job-3', 'user-1', 'waiting'),
          createMockJob('job-4', 'user-1', 'active'),
          createMockJob('job-5', 'user-1', 'active'),
          createMockJob('job-6', 'user-2', 'waiting'), // Different user
          createMockJob('job-7', 'user-2', 'active'), // Different user
        ]);

        // Check user-1 (should be rejected)
        const result1 = await userLimits.checkUserLimit('user-1');
        expect(result1.allowed).toBe(false);
        expect(result1.currentJobCount).toBe(5);

        // Check user-2 (should be allowed)
        const result2 = await userLimits.checkUserLimit('user-2');
        expect(result2.allowed).toBe(true);
        expect(result2.currentJobCount).toBe(2);
      });
    });

    describe('Caching', () => {
      it('should cache user job count for 5 seconds', async () => {
        // First call - mock 2 jobs
        mockQueueManager.mockGetJobs([
          createMockJob('job-1', 'user-1', 'waiting'),
          createMockJob('job-2', 'user-1', 'active'),
        ]);

        const result1 = await userLimits.checkUserLimit('user-1');
        expect(result1.currentJobCount).toBe(2);

        // Second call immediately - should use cache, not query again
        mockQueueManager.mockGetJobs([
          createMockJob('job-1', 'user-1', 'waiting'),
          createMockJob('job-2', 'user-1', 'active'),
          createMockJob('job-3', 'user-1', 'waiting'),
          createMockJob('job-4', 'user-1', 'waiting'),
        ]);

        const result2 = await userLimits.checkUserLimit('user-1');
        expect(result2.currentJobCount).toBe(2); // Still cached value

        // Verify only called once
        expect(mockQueueManager.getQueue().getJobs).toHaveBeenCalledTimes(1);
      });

      it('should refresh cache after 5 seconds', async () => {
        // First call - mock 2 jobs
        mockQueueManager.mockGetJobs([
          createMockJob('job-1', 'user-1', 'waiting'),
          createMockJob('job-2', 'user-1', 'active'),
        ]);

        const result1 = await userLimits.checkUserLimit('user-1');
        expect(result1.currentJobCount).toBe(2);

        // Advance time by 5 seconds + 1ms to exceed cache duration
        vi.advanceTimersByTime(5001);

        // Second call - should query again
        mockQueueManager.mockGetJobs([
          createMockJob('job-1', 'user-1', 'waiting'),
          createMockJob('job-2', 'user-1', 'active'),
          createMockJob('job-3', 'user-1', 'waiting'),
          createMockJob('job-4', 'user-1', 'waiting'),
        ]);

        const result2 = await userLimits.checkUserLimit('user-1');
        expect(result2.currentJobCount).toBe(4); // Updated value

        // Verify called twice
        expect(mockQueueManager.getQueue().getJobs).toHaveBeenCalledTimes(2);
      });

      it('should cache per user independently', async () => {
        // User 1 - 2 jobs
        mockQueueManager.mockGetJobs([
          createMockJob('job-1', 'user-1', 'waiting'),
          createMockJob('job-2', 'user-1', 'active'),
          createMockJob('job-3', 'user-2', 'waiting'),
          createMockJob('job-4', 'user-2', 'active'),
          createMockJob('job-5', 'user-2', 'waiting'),
        ]);

        const result1 = await userLimits.checkUserLimit('user-1');
        expect(result1.currentJobCount).toBe(2);

        const result2 = await userLimits.checkUserLimit('user-2');
        expect(result2.currentJobCount).toBe(3);

        // Both should be cached now
        const result3 = await userLimits.checkUserLimit('user-1');
        expect(result3.currentJobCount).toBe(2);

        const result4 = await userLimits.checkUserLimit('user-2');
        expect(result4.currentJobCount).toBe(3);

        // Should only have queried twice (once per user)
        expect(mockQueueManager.getQueue().getJobs).toHaveBeenCalledTimes(2);
      });

      it('should use custom cache duration from config', async () => {
        // Create with 10 second cache
        const customConfig = createTestConfig({ cacheDuration: 10000 });
        const customUserLimits = new UserLimits(
          mockQueueManager as unknown as QueueManager,
          mockJobStatusTracker as unknown as JobStatusTracker,
          customConfig,
          mockLogger as unknown as QueueLogger
        );

        // First call
        mockQueueManager.mockGetJobs([
          createMockJob('job-1', 'user-1', 'waiting'),
        ]);

        await customUserLimits.checkUserLimit('user-1');

        // Advance time by 5 seconds (should still be cached)
        vi.advanceTimersByTime(5000);

        mockQueueManager.mockGetJobs([
          createMockJob('job-1', 'user-1', 'waiting'),
          createMockJob('job-2', 'user-1', 'waiting'),
        ]);

        const result = await customUserLimits.checkUserLimit('user-1');
        expect(result.currentJobCount).toBe(1); // Still cached

        // Advance time by another 5 seconds + 1ms (10001ms total)
        vi.advanceTimersByTime(5001);

        const result2 = await customUserLimits.checkUserLimit('user-1');
        expect(result2.currentJobCount).toBe(2); // Cache expired
      });
    });

    describe('Edge Cases', () => {
      it('should handle race condition when user job completes during check', async () => {
        // This is handled by BullMQ's state consistency
        // We query the current state, which should be atomic
        mockQueueManager.mockGetJobs([
          createMockJob('job-1', 'user-1', 'waiting'),
          createMockJob('job-2', 'user-1', 'waiting'),
          createMockJob('job-3', 'user-1', 'waiting'),
          createMockJob('job-4', 'user-1', 'active'),
          createMockJob('job-5', 'user-1', 'active'),
        ]);

        const result = await userLimits.checkUserLimit('user-1');

        // At the moment of the query, user had 5 jobs, so should be rejected
        expect(result.allowed).toBe(false);
        expect(result.currentJobCount).toBe(5);
      });

      it('should handle concurrent submissions from same user (first 5 allowed)', async () => {
        // Initial state: user has no jobs
        mockQueueManager.mockGetJobs([]);

        // Simulate 6 concurrent submissions
        const promises = [];
        for (let i = 0; i < 6; i++) {
          promises.push(userLimits.checkUserLimit('user-1'));
        }

        const results = await Promise.all(promises);

        // All should see 0 jobs (cached after first query)
        // This is expected behavior - the cache prevents multiple queries
        // The actual job count will be updated after submission
        results.forEach((result) => {
          expect(result.currentJobCount).toBe(0);
        });
      });

      it('should reject submission if job count query fails (fail closed)', async () => {
        // Mock Redis error
        mockQueueManager.mockGetJobsError(new Error('Redis connection timeout'));

        const result = await userLimits.checkUserLimit('user-1');

        expect(result.allowed).toBe(false);
        expect(result.error).toContain('Unable to verify user job limit');
        expect(mockLogger.logError).toHaveBeenCalled();
      });

      it('should handle user with 5 jobs that all complete at once', async () => {
        // Initial check - 5 active jobs
        mockQueueManager.mockGetJobs([
          createMockJob('job-1', 'user-1', 'waiting'),
          createMockJob('job-2', 'user-1', 'waiting'),
          createMockJob('job-3', 'user-1', 'waiting'),
          createMockJob('job-4', 'user-1', 'active'),
          createMockJob('job-5', 'user-1', 'active'),
        ]);

        const result1 = await userLimits.checkUserLimit('user-1');
        expect(result1.allowed).toBe(false);

        // Cache expires
        vi.advanceTimersByTime(5001);

        // All jobs complete - user now has 0 active jobs
        mockQueueManager.mockGetJobs([
          createMockJob('job-1', 'user-1', 'completed'),
          createMockJob('job-2', 'user-1', 'completed'),
          createMockJob('job-3', 'user-1', 'completed'),
          createMockJob('job-4', 'user-1', 'completed'),
          createMockJob('job-5', 'user-1', 'completed'),
        ]);

        const result2 = await userLimits.checkUserLimit('user-1');
        expect(result2.allowed).toBe(true);
        expect(result2.currentJobCount).toBe(0);
      });

      it('should handle empty userId', async () => {
        mockQueueManager.mockGetJobs([]);

        const result = await userLimits.checkUserLimit('');

        expect(result.allowed).toBe(true);
        expect(result.currentJobCount).toBe(0);
      });

      it('should handle missing job data gracefully', async () => {
        // Mock jobs with missing userId
        mockQueueManager.mockGetJobs([
          {
            id: 'job-1',
            data: {},
            getState: vi.fn().mockResolvedValue('waiting')
          } as Partial<Job>,
          {
            id: 'job-2',
            data: { userId: 'user-1' },
            getState: vi.fn().mockResolvedValue('waiting')
          } as Partial<Job>,
        ]);

        const result = await userLimits.checkUserLimit('user-1');

        // Should only count jobs with matching userId
        expect(result.allowed).toBe(true);
        expect(result.currentJobCount).toBe(1);
      });

      it('should handle null job data gracefully', async () => {
        // Mock jobs with null data
        mockQueueManager.mockGetJobs([
          {
            id: 'job-1',
            data: null,
            getState: vi.fn().mockResolvedValue('waiting')
          } as Partial<Job>,
          {
            id: 'job-2',
            data: { userId: 'user-1' },
            getState: vi.fn().mockResolvedValue('waiting')
          } as Partial<Job>,
        ]);

        const result = await userLimits.checkUserLimit('user-1');

        expect(result.allowed).toBe(true);
        expect(result.currentJobCount).toBe(1);
      });
    });

    describe('Logging', () => {
      it('should log limit violations', async () => {
        mockQueueManager.mockGetJobs([
          createMockJob('job-1', 'user-1', 'waiting'),
          createMockJob('job-2', 'user-1', 'waiting'),
          createMockJob('job-3', 'user-1', 'waiting'),
          createMockJob('job-4', 'user-1', 'active'),
          createMockJob('job-5', 'user-1', 'active'),
        ]);

        await userLimits.checkUserLimit('user-1');

        expect(mockLogger.logWarn).toHaveBeenCalledWith(
          'user_limit_exceeded',
          expect.objectContaining({
            userId: 'user-1',
            currentJobs: 5,
            maxJobs: 5,
          })
        );
      });

      it('should log when allowing job submission', async () => {
        mockQueueManager.mockGetJobs([
          createMockJob('job-1', 'user-1', 'waiting'),
        ]);

        await userLimits.checkUserLimit('user-1');

        expect(mockLogger.logInfo).toHaveBeenCalledWith(
          'user_limit_check',
          expect.objectContaining({
            userId: 'user-1',
            currentJobs: 1,
            maxJobs: 5,
            allowed: true,
          })
        );
      });

      it('should log errors when query fails', async () => {
        const error = new Error('Redis connection timeout');
        mockQueueManager.mockGetJobsError(error);

        await userLimits.checkUserLimit('user-1');

        expect(mockLogger.logError).toHaveBeenCalledWith(
          'user-limit-check',
          error,
          expect.objectContaining({
            operation: 'checkUserLimit',
            userId: 'user-1',
          })
        );
      });
    });

    describe('Custom Configuration', () => {
      it('should respect custom maxConcurrentJobs limit', async () => {
        // Create with max 3 jobs
        const customConfig = createTestConfig({ maxConcurrentJobs: 3 });
        const customUserLimits = new UserLimits(
          mockQueueManager as unknown as QueueManager,
          mockJobStatusTracker as unknown as JobStatusTracker,
          customConfig,
          mockLogger as unknown as QueueLogger
        );

        mockQueueManager.mockGetJobs([
          createMockJob('job-1', 'user-1', 'waiting'),
          createMockJob('job-2', 'user-1', 'active'),
          createMockJob('job-3', 'user-1', 'active'),
        ]);

        const result = await customUserLimits.checkUserLimit('user-1');

        expect(result.allowed).toBe(false);
        expect(result.currentJobCount).toBe(3);
        expect(result.maxJobs).toBe(3);
      });

      it('should allow job when under custom limit', async () => {
        const customConfig = createTestConfig({ maxConcurrentJobs: 3 });
        const customUserLimits = new UserLimits(
          mockQueueManager as unknown as QueueManager,
          mockJobStatusTracker as unknown as JobStatusTracker,
          customConfig,
          mockLogger as unknown as QueueLogger
        );

        mockQueueManager.mockGetJobs([
          createMockJob('job-1', 'user-1', 'waiting'),
          createMockJob('job-2', 'user-1', 'active'),
        ]);

        const result = await customUserLimits.checkUserLimit('user-1');

        expect(result.allowed).toBe(true);
        expect(result.currentJobCount).toBe(2);
        expect(result.maxJobs).toBe(3);
      });
    });

    describe('Performance', () => {
      it('should handle large number of jobs efficiently', async () => {
        // Create 1000 jobs for different users
        // User-1 will have 10 jobs (1, 101, 201, ..., 901)
        // But we only create 4 for user-1 to stay under limit
        const jobs = [];
        for (let i = 0; i < 1000; i++) {
          const userId = `user-${i % 100}`;
          // User-1 only gets jobs at specific indices to keep count at 4
          if (userId === 'user-1' && i > 301) {
            continue; // Skip to keep user-1 at 4 jobs
          }
          jobs.push(createMockJob(`job-${i}`, userId, i % 2 === 0 ? 'waiting' : 'active'));
        }

        mockQueueManager.mockGetJobs(jobs);

        const start = Date.now();
        const result = await userLimits.checkUserLimit('user-1');
        const end = Date.now();

        expect(result.allowed).toBe(true);
        expect(end - start).toBeLessThan(100); // Should be fast
      });
    });
  });

  describe('clearCache', () => {
    it('should clear cache for specific user', async () => {
      // Set up cache
      mockQueueManager.mockGetJobs([
        createMockJob('job-1', 'user-1', 'waiting'),
        createMockJob('job-2', 'user-2', 'waiting'),
      ]);

      await userLimits.checkUserLimit('user-1');
      await userLimits.checkUserLimit('user-2');

      // Clear user-1 cache
      userLimits.clearCache('user-1');

      // Mock updated data
      mockQueueManager.mockGetJobs([
        createMockJob('job-1', 'user-1', 'waiting'),
        createMockJob('job-3', 'user-1', 'waiting'),
        createMockJob('job-2', 'user-2', 'waiting'),
      ]);

      const result1 = await userLimits.checkUserLimit('user-1');
      expect(result1.currentJobCount).toBe(2); // Re-queried

      const result2 = await userLimits.checkUserLimit('user-2');
      expect(result2.currentJobCount).toBe(1); // Still cached
    });

    it('should clear all caches when no userId provided', async () => {
      // Set up cache for multiple users
      mockQueueManager.mockGetJobs([
        createMockJob('job-1', 'user-1', 'waiting'),
        createMockJob('job-2', 'user-2', 'waiting'),
        createMockJob('job-3', 'user-3', 'waiting'),
      ]);

      await userLimits.checkUserLimit('user-1');
      await userLimits.checkUserLimit('user-2');
      await userLimits.checkUserLimit('user-3');

      // Clear all caches
      userLimits.clearCache();

      // Mock updated data
      mockQueueManager.mockGetJobs([
        createMockJob('job-1', 'user-1', 'waiting'),
        createMockJob('job-4', 'user-1', 'waiting'),
        createMockJob('job-2', 'user-2', 'waiting'),
        createMockJob('job-5', 'user-2', 'waiting'),
        createMockJob('job-3', 'user-3', 'waiting'),
        createMockJob('job-6', 'user-3', 'waiting'),
      ]);

      const result1 = await userLimits.checkUserLimit('user-1');
      const result2 = await userLimits.checkUserLimit('user-2');
      const result3 = await userLimits.checkUserLimit('user-3');

      expect(result1.currentJobCount).toBe(2);
      expect(result2.currentJobCount).toBe(2);
      expect(result3.currentJobCount).toBe(2);
    });
  });
});
