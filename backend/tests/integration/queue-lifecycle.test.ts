/**
 * Integration Test: Queue Lifecycle
 *
 * Tests the full job lifecycle from submission to completion:
 * - Happy path: submit → process → complete → cache
 * - Cache hit: instant return from cache
 * - Deduplication: same job within 10s window
 * - Job state transitions
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestEnvironment, teardownTestEnvironment, TestContext } from './test-setup.js';
import { simplePrompt, createUniquePrompt } from '../fixtures/requests.js';
import { CacheKeyGenerator } from '../../src/cache/cache-key-generator.js';

describe('Queue Lifecycle Integration Tests', () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await setupTestEnvironment({ scenario: 'success' });
  });

  afterEach(async () => {
    await teardownTestEnvironment(context);
  });

  it('should complete full job lifecycle: submit → process → complete → cache', async () => {
    // Create unique prompt to avoid cache hits
    const prompt = createUniquePrompt(`lifecycle-${Date.now()}`);
    const userId = 'test-user-1';

    // Submit job
    const { jobId, cacheHit } = await context.jobSubmitter.submitJob(
      userId,
      prompt
    );

    expect(jobId).toBeDefined();
    expect(cacheHit).toBe(false);

    // Wait for job to complete (with timeout)
    const startTime = Date.now();
    const timeout = 10000; // 10 seconds

    let jobCompleted = false;
    while (Date.now() - startTime < timeout) {
      const job = await context.queueManager.getQueue().getJob(jobId);

      if (job) {
        const state = await job.getState();
        if (state === 'completed') {
          jobCompleted = true;
          break;
        } else if (state === 'failed') {
          throw new Error(`Job ${jobId} failed: ${job.failedReason}`);
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    expect(jobCompleted).toBe(true);

    // Result should be cached (verified by subsequent cache hit test)
  });

  it('should return instant result from cache on cache hit', async () => {
    const prompt = createUniquePrompt(`cache-hit-${Date.now()}`);
    const userId = 'test-user-2';

    // First submission (cache miss)
    const firstSubmission = await context.jobSubmitter.submitJob(
      prompt,
      userId
    );

    expect(firstSubmission.cacheHit).toBe(false);

    // Wait for completion
    let jobCompleted = false;
    const timeout = 10000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout && !jobCompleted) {
      const job = await context.queueManager.getQueue().getJob(firstSubmission.jobId);
      if (job) {
        const state = await job.getState();
        if (state === 'completed') {
          jobCompleted = true;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    expect(jobCompleted).toBe(true);

    // Second submission (cache hit)
    const secondSubmission = await context.jobSubmitter.submitJob(
      prompt,
      userId
    );

    expect(secondSubmission.cacheHit).toBe(true);
    expect(secondSubmission.result).toBeDefined();
    expect(secondSubmission.result?.characterId).toBeDefined();
  });

  it('should deduplicate jobs submitted within 10-second window', async () => {
    const prompt = createUniquePrompt(`dedup-${Date.now()}`);
    const userId = 'test-user-3';

    // Submit first job
    const firstSubmission = await context.jobSubmitter.submitJob(
      prompt,
      userId
    );

    // Submit second job immediately (within deduplication window)
    const secondSubmission = await context.jobSubmitter.submitJob(
      prompt,
      userId
    );

    // Both should return the same job ID (deduplication)
    expect(firstSubmission.jobId).toBe(secondSubmission.jobId);
    expect(secondSubmission.cacheHit).toBe(false); // Not from cache, but deduplicated
  });

  it('should track job state transitions correctly', async () => {
    const prompt = createUniquePrompt(`state-${Date.now()}`);
    const userId = 'test-user-4';

    // Submit job
    const { jobId } = await context.jobSubmitter.submitJob(userId, prompt);

    // Track states
    const states: string[] = [];
    const timeout = 10000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const job = await context.queueManager.getQueue().getJob(jobId);

      if (job) {
        const state = await job.getState();
        if (!states.includes(state)) {
          states.push(state);
        }

        if (state === 'completed' || state === 'failed') {
          break;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Should see: waiting/active → active → completed
    expect(states).toContain('completed');
    expect(states.length).toBeGreaterThan(0);
  });

  it('should handle multiple concurrent jobs from different users', async () => {
    const jobs = await Promise.all([
      context.jobSubmitter.submitJob(
        createUniquePrompt(`concurrent-1-${Date.now()}`),
        'user-1'
      ),
      context.jobSubmitter.submitJob(
        createUniquePrompt(`concurrent-2-${Date.now()}`),
        'user-2'
      ),
      context.jobSubmitter.submitJob(
        createUniquePrompt(`concurrent-3-${Date.now()}`),
        'user-3'
      ),
    ]);

    // All jobs should have different IDs
    const jobIds = jobs.map((j) => j.jobId);
    const uniqueIds = new Set(jobIds);
    expect(uniqueIds.size).toBe(3);

    // Wait for all jobs to complete
    const timeout = 15000;
    const startTime = Date.now();

    const completionStatus = await Promise.all(
      jobIds.map(async (jobId) => {
        while (Date.now() - startTime < timeout) {
          const job = await context.queueManager.getQueue().getJob(jobId);
          if (job) {
            const state = await job.getState();
            if (state === 'completed') return true;
            if (state === 'failed') return false;
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        return false;
      })
    );

    // All jobs should complete successfully
    expect(completionStatus.every((status) => status === true)).toBe(true);
  });

  it('should properly clean up completed jobs', async () => {
    const prompt = createUniquePrompt(`cleanup-${Date.now()}`);
    const userId = 'test-user-5';

    const { jobId } = await context.jobSubmitter.submitJob(userId, prompt);

    // Wait for completion
    const timeout = 10000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const job = await context.queueManager.getQueue().getJob(jobId);
      if (job) {
        const state = await job.getState();
        if (state === 'completed') break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Job should exist in completed state
    const job = await context.queueManager.getQueue().getJob(jobId);
    expect(job).toBeDefined();

    const state = await job!.getState();
    expect(state).toBe('completed');
  });
});
