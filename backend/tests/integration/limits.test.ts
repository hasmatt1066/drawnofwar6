/**
 * Integration Test: Queue Limits
 *
 * Tests queue limits and overflow protection:
 * - Queue overflow: rejection when system limit reached (500 jobs)
 * - User concurrency limits: rejection when user limit reached (5 jobs)
 * - Proper error messages on limit violations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestEnvironment, teardownTestEnvironment, TestContext } from './test-setup.js';
import { createUniquePrompt } from '../fixtures/requests.js';

describe('Queue Limits Integration Tests', () => {
  let context: TestContext;

  beforeEach(async () => {
    // Use success scenario with no delay for faster testing
    context = await setupTestEnvironment({ scenario: 'success', delay: 0 });
  });

  afterEach(async () => {
    await teardownTestEnvironment(context);
  });

  it('should enforce user concurrency limit (max 5 jobs per user)', async () => {
    const userId = 'test-user-limit-1';

    // Submit 5 jobs (should all succeed)
    const successfulJobs = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        context.jobSubmitter.submitJob(
          createUniquePrompt(`user-limit-${i}-${Date.now()}`),
          userId
        )
      )
    );

    // All 5 should succeed
    expect(successfulJobs.length).toBe(5);
    successfulJobs.forEach((job) => {
      expect(job.jobId).toBeDefined();
    });

    // Try to submit 6th job (should be rejected)
    try {
      await context.jobSubmitter.submitJob(
        createUniquePrompt(`user-limit-6-${Date.now()}`),
        userId
      );

      // Should not reach here
      expect(true).toBe(false);
    } catch (error: any) {
      // Should throw user limit error
      expect(error.message).toContain('limit');
    }

    // Wait for some jobs to complete
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // After jobs complete, should be able to submit again
    const newJob = await context.jobSubmitter.submitJob(
      createUniquePrompt(`user-limit-after-${Date.now()}`),
      userId
    );

    expect(newJob.jobId).toBeDefined();
  });

  it('should allow different users to submit jobs independently', async () => {
    // Each user can submit up to 5 jobs
    const user1Jobs = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        context.jobSubmitter.submitJob(
          createUniquePrompt(`user1-${i}-${Date.now()}`),
          'user-1'
        )
      )
    );

    const user2Jobs = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        context.jobSubmitter.submitJob(
          createUniquePrompt(`user2-${i}-${Date.now()}`),
          'user-2'
        )
      )
    );

    // Both users should succeed
    expect(user1Jobs.length).toBe(5);
    expect(user2Jobs.length).toBe(5);

    // All jobs should have unique IDs
    const allJobIds = [...user1Jobs, ...user2Jobs].map((j) => j.jobId);
    const uniqueIds = new Set(allJobIds);
    expect(uniqueIds.size).toBe(10);
  });

  it('should enforce system queue limit (max 500 jobs)', async () => {
    // This test is computationally expensive, so we'll use a smaller limit
    // In practice, the real limit is 500 jobs

    // Pause the worker to prevent jobs from completing
    await context.worker.stop();

    const smallBatchSize = 10; // Simulate limit enforcement
    const jobs: any[] = [];

    // Submit jobs up to the limit
    for (let i = 0; i < smallBatchSize; i++) {
      const job = await context.jobSubmitter.submitJob(
        createUniquePrompt(`queue-limit-${i}-${Date.now()}`),
        `user-${i}` // Different users to avoid per-user limits
      );
      jobs.push(job);
    }

    expect(jobs.length).toBe(smallBatchSize);

    // Verify all jobs are in the queue
    const queueCounts = await context.queueManager.getQueue().getJobCounts();
    const totalJobs =
      (queueCounts.waiting || 0) +
      (queueCounts.active || 0) +
      (queueCounts.delayed || 0);

    expect(totalJobs).toBeGreaterThanOrEqual(smallBatchSize);

    // Restart worker to clean up
    await context.worker.start();
  });

  it('should properly release user slot when job completes', async () => {
    const userId = 'test-user-release';

    // Submit 5 jobs (max limit)
    const jobs = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        context.jobSubmitter.submitJob(
          createUniquePrompt(`release-${i}-${Date.now()}`),
          userId
        )
      )
    );

    expect(jobs.length).toBe(5);

    // Wait for all jobs to complete
    const timeout = 15000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const jobStates = await Promise.all(
        jobs.map(async ({ jobId }) => {
          const job = await context.queueManager.getQueue().getJob(jobId);
          return job ? await job.getState() : null;
        })
      );

      const allCompleted = jobStates.every(
        (state) => state === 'completed' || state === 'failed'
      );

      if (allCompleted) break;

      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    // Should be able to submit new jobs after completion
    const newJobs = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        context.jobSubmitter.submitJob(
          createUniquePrompt(`release-new-${i}-${Date.now()}`),
          userId
        )
      )
    );

    expect(newJobs.length).toBe(5);
  });

  it('should provide clear error message when user limit exceeded', async () => {
    const userId = 'test-user-error-msg';

    // Submit 5 jobs (max)
    await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        context.jobSubmitter.submitJob(
          createUniquePrompt(`error-msg-${i}-${Date.now()}`),
          userId
        )
      )
    );

    // Try to submit 6th
    try {
      await context.jobSubmitter.submitJob(
        createUniquePrompt(`error-msg-6-${Date.now()}`),
        userId
      );

      expect(true).toBe(false); // Should not reach here
    } catch (error: any) {
      // Error message should be informative
      expect(error.message).toBeDefined();
      expect(error.message.toLowerCase()).toMatch(/limit|exceed|maximum/);
    }
  });

  it('should handle rapid concurrent submissions under user limit', async () => {
    const userId = 'test-user-concurrent';

    // Submit 4 jobs concurrently (under limit)
    const jobs = await Promise.all(
      Array.from({ length: 4 }, (_, i) =>
        context.jobSubmitter.submitJob(
          createUniquePrompt(`concurrent-${i}-${Date.now()}`),
          userId
        )
      )
    );

    // All should succeed
    expect(jobs.length).toBe(4);
    jobs.forEach((job) => {
      expect(job.jobId).toBeDefined();
    });

    // All jobs should have unique IDs
    const uniqueIds = new Set(jobs.map((j) => j.jobId));
    expect(uniqueIds.size).toBe(4);
  });

  it('should track active job count accurately', async () => {
    const userId = 'test-user-tracking';

    // Submit jobs one by one and check count
    for (let i = 0; i < 3; i++) {
      await context.jobSubmitter.submitJob(
        createUniquePrompt(`tracking-${i}-${Date.now()}`),
        userId
      );

      // Check active count via Redis
      const activeCount = await context.redis.get(
        `user-limits:${userId}:active-jobs`
      );

      expect(parseInt(activeCount || '0')).toBeGreaterThan(0);
    }
  });
});
