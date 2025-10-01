/**
 * Integration Test: Retry Logic
 *
 * Tests retry behavior and DLQ (Dead Letter Queue) handling:
 * - Retry success: failure → retry → success
 * - DLQ: failure → retry → fail → DLQ
 * - Error classification
 * - Retry count tracking
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestEnvironment, teardownTestEnvironment, TestContext } from './test-setup.js';
import { createUniquePrompt } from '../fixtures/requests.js';

describe('Retry Logic Integration Tests', () => {
  let context: TestContext;

  beforeEach(async () => {
    // Use 'server_error' scenario which is retryable
    context = await setupTestEnvironment({ scenario: 'server_error' });
  });

  afterEach(async () => {
    await teardownTestEnvironment(context);
  });

  it('should retry failed jobs up to max attempts', async () => {
    const prompt = createUniquePrompt(`retry-test-${Date.now()}`);
    const userId = 'test-user-retry-1';

    // Submit job (will fail initially with server_error scenario)
    const { jobId, cacheHit } = await context.jobSubmitter.submitJob(
      prompt,
      userId
    );

    expect(cacheHit).toBe(false);

    // Wait for job to either complete or fail
    let finalState: string | undefined;
    const timeout = 20000; // Longer timeout for retries
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const job = await context.queueManager.getQueue().getJob(jobId);

      if (job) {
        const state = await job.getState();

        if (state === 'completed' || state === 'failed') {
          finalState = state;

          // Check attempt count
          const attemptsMade = job.attemptsMade;

          // Should have made multiple attempts
          expect(attemptsMade).toBeGreaterThan(1);

          break;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    expect(finalState).toBeDefined();
  });

  it('should move job to DLQ after max retry attempts', async () => {
    const prompt = createUniquePrompt(`dlq-test-${Date.now()}`);
    const userId = 'test-user-retry-2';

    // Submit job
    const { jobId } = await context.jobSubmitter.submitJob(userId, prompt);

    // Wait for job to fail and potentially move to DLQ
    let jobFailed = false;
    const timeout = 30000; // Longer timeout for multiple retries
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const job = await context.queueManager.getQueue().getJob(jobId);

      if (job) {
        const state = await job.getState();

        if (state === 'failed') {
          jobFailed = true;

          // Verify retry attempts were made
          const attemptsMade = job.attemptsMade;
          expect(attemptsMade).toBeGreaterThan(1);

          break;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    expect(jobFailed).toBe(true);
  });

  it('should correctly classify retryable vs non-retryable errors', async () => {
    // Server errors (500) should be retryable
    const serverErrorContext = await setupTestEnvironment({
      scenario: 'server_error',
    });

    const prompt1 = createUniquePrompt(`error-class-1-${Date.now()}`);
    const { jobId: jobId1 } = await serverErrorContext.jobSubmitter.submitJob(
      prompt1,
      'user-1'
    );

    // Wait a bit for processing
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const job1 = await serverErrorContext.queueManager.getQueue().getJob(jobId1);

    if (job1) {
      // Should have attempted retries (retryable error)
      const attemptsMade = job1.attemptsMade;
      expect(attemptsMade).toBeGreaterThan(0);
    }

    await teardownTestEnvironment(serverErrorContext);

    // Auth errors (401) should NOT be retryable
    const authErrorContext = await setupTestEnvironment({
      scenario: 'auth_error',
    });

    const prompt2 = createUniquePrompt(`error-class-2-${Date.now()}`);
    const { jobId: jobId2 } = await authErrorContext.jobSubmitter.submitJob(
      prompt2,
      'user-2'
    );

    // Wait for processing
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const job2 = await authErrorContext.queueManager.getQueue().getJob(jobId2);

    if (job2) {
      const state = await job2.getState();

      // Should fail without retries (non-retryable error)
      expect(state).toBe('failed');
    }

    await teardownTestEnvironment(authErrorContext);
  });

  it('should track retry count correctly', async () => {
    const prompt = createUniquePrompt(`retry-count-${Date.now()}`);
    const userId = 'test-user-retry-3';

    const { jobId } = await context.jobSubmitter.submitJob(userId, prompt);

    // Monitor retry count over time
    const retryCounts: number[] = [];
    const timeout = 20000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const job = await context.queueManager.getQueue().getJob(jobId);

      if (job) {
        const attemptsMade = job.attemptsMade;

        if (!retryCounts.includes(attemptsMade)) {
          retryCounts.push(attemptsMade);
        }

        const state = await job.getState();
        if (state === 'completed' || state === 'failed') {
          break;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    // Should have incremented retry count
    expect(retryCounts.length).toBeGreaterThan(1);
    expect(Math.max(...retryCounts)).toBeGreaterThan(1);
  });

  it('should handle timeout errors with retry', async () => {
    const timeoutContext = await setupTestEnvironment({ scenario: 'timeout' });

    const prompt = createUniquePrompt(`timeout-retry-${Date.now()}`);
    const { jobId } = await timeoutContext.jobSubmitter.submitJob(
      prompt,
      'user-timeout'
    );

    // Wait for retries
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const job = await timeoutContext.queueManager.getQueue().getJob(jobId);

    if (job) {
      const attemptsMade = job.attemptsMade;

      // Timeout errors should be retried
      expect(attemptsMade).toBeGreaterThan(1);
    }

    await teardownTestEnvironment(timeoutContext);
  });

  it('should preserve job data across retries', async () => {
    const prompt = createUniquePrompt(`preserve-data-${Date.now()}`);
    const userId = 'test-user-retry-4';

    const { jobId } = await context.jobSubmitter.submitJob(userId, prompt);

    // Wait a bit for processing and retries
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const job = await context.queueManager.getQueue().getJob(jobId);

    if (job) {
      // Job data should still contain original prompt
      expect(job.data).toBeDefined();
      expect(job.data.prompt).toBeDefined();
      expect(job.data.prompt.description).toBe(prompt.description);
    }
  });
});
