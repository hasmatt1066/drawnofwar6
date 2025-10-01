/**
 * Integration Test: Cache Operations
 *
 * Tests cache behavior across the full job lifecycle:
 * - Cache write after successful generation
 * - Cache read on subsequent requests
 * - Cache consistency across multiple reads
 * - Concurrent cache operations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestEnvironment, teardownTestEnvironment, TestContext } from './test-setup.js';
import { createUniquePrompt } from '../fixtures/requests.js';

describe('Cache Integration Tests', () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await setupTestEnvironment({ scenario: 'success' });
  });

  afterEach(async () => {
    await teardownTestEnvironment(context);
  });

  it('should write result to cache after successful generation', async () => {
    const prompt = createUniquePrompt(`cache-write-${Date.now()}`);
    const userId = 'test-user-cache-1';

    // Submit job (cache miss)
    const { jobId, cacheHit } = await context.jobSubmitter.submitJob(
      userId,
      prompt
    );

    expect(cacheHit).toBe(false);

    // Wait for completion
    let jobCompleted = false;
    const timeout = 10000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout && !jobCompleted) {
      const job = await context.queueManager.getQueue().getJob(jobId);
      if (job) {
        const state = await job.getState();
        if (state === 'completed') {
          jobCompleted = true;
        } else if (state === 'failed') {
          const reason = job.failedReason || 'unknown';
          throw new Error(`Job failed: ${reason}`);
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    expect(jobCompleted).toBe(true);

    // Verify cache by submitting same job again (should get cache hit)
    const secondSubmission = await context.jobSubmitter.submitJob(
      userId,
      prompt
    );

    expect(secondSubmission.cacheHit).toBe(true);
    expect(secondSubmission.result).toBeDefined();
  });

  it('should read result from cache on subsequent requests', async () => {
    const prompt = createUniquePrompt(`cache-read-${Date.now()}`);
    const userId = 'test-user-cache-2';

    // First request (cache miss)
    const firstSubmission = await context.jobSubmitter.submitJob(
      userId,
      prompt
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

    // Second request (cache hit)
    const secondSubmission = await context.jobSubmitter.submitJob(
      userId,
      prompt
    );

    expect(secondSubmission.cacheHit).toBe(true);
    expect(secondSubmission.result).toBeDefined();
    expect(secondSubmission.result?.characterId).toBeDefined();
  });

  it('should handle cache misses correctly', async () => {
    const prompt = createUniquePrompt(`cache-miss-${Date.now()}`);
    const userId = 'test-user-cache-3';

    // Submit job (should be cache miss for new prompt)
    const { cacheHit } = await context.jobSubmitter.submitJob(userId, prompt);

    expect(cacheHit).toBe(false);
  });

  it('should maintain cache consistency across multiple reads', async () => {
    const prompt = createUniquePrompt(`cache-consistency-${Date.now()}`);
    const userId = 'test-user-cache-4';

    // First request
    const firstSubmission = await context.jobSubmitter.submitJob(
      userId,
      prompt
    );

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

    // Multiple cache reads from different "users" (but same prompt)
    const reads = await Promise.all([
      context.jobSubmitter.submitJob(`${userId}-1`, prompt),
      context.jobSubmitter.submitJob(`${userId}-2`, prompt),
      context.jobSubmitter.submitJob(`${userId}-3`, prompt),
    ]);

    // All should be cache hits
    reads.forEach((read) => {
      expect(read.cacheHit).toBe(true);
      expect(read.result?.characterId).toBeDefined();
    });
  });

  it('should differentiate cache entries for different prompts', async () => {
    const prompt1 = createUniquePrompt(`different-1-${Date.now()}`);
    const prompt2 = createUniquePrompt(`different-2-${Date.now()}`);
    const userId = 'test-user-cache-5';

    // Submit both (should be cache misses)
    const sub1 = await context.jobSubmitter.submitJob(userId, prompt1);
    const sub2 = await context.jobSubmitter.submitJob(userId, prompt2);

    expect(sub1.cacheHit).toBe(false);
    expect(sub2.cacheHit).toBe(false);

    // Job IDs should be different
    expect(sub1.jobId).not.toBe(sub2.jobId);
  });

  it('should handle cache operations under concurrent load', async () => {
    const prompts = Array.from({ length: 10 }, (_, i) =>
      createUniquePrompt(`concurrent-cache-${i}-${Date.now()}`)
    );

    // Submit all jobs concurrently
    const submissions = await Promise.all(
      prompts.map((prompt, i) =>
        context.jobSubmitter.submitJob(`user-${i}`, prompt)
      )
    );

    // All should be cache misses (unique prompts)
    submissions.forEach((submission) => {
      expect(submission.cacheHit).toBe(false);
    });

    // Wait for all to complete
    const timeout = 15000;
    const startTime = Date.now();

    const completions = await Promise.all(
      submissions.map(async ({ jobId }) => {
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

    // All should complete
    expect(completions.every((c) => c === true)).toBe(true);

    // Verify all cached by resubmitting
    const cacheChecks = await Promise.all(
      prompts.map(async (prompt, i) => {
        const result = await context.jobSubmitter.submitJob(`user-${i}`, prompt);
        return result.cacheHit;
      })
    );

    expect(cacheChecks.every((c) => c === true)).toBe(true);
  });
});
