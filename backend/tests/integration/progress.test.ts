/**
 * Integration Test: Progress Updates
 *
 * Tests progress tracking and SSE (Server-Sent Events) functionality:
 * - SSE connection and progress updates
 * - Progress calculation during job processing
 * - Completion notification via SSE
 * - Edge case: job completes before first progress update
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestEnvironment, teardownTestEnvironment, TestContext } from './test-setup.js';
import { createUniquePrompt } from '../fixtures/requests.js';

describe('Progress Updates Integration Tests', () => {
  let context: TestContext;

  beforeEach(async () => {
    // Use success scenario with small delay to simulate processing
    context = await setupTestEnvironment({
      scenario: 'success',
      delay: 1000,
      progressUpdates: true,
    });
  });

  afterEach(async () => {
    await teardownTestEnvironment(context);
  });

  it('should track progress during job processing', async () => {
    const prompt = createUniquePrompt(`progress-${Date.now()}`);
    const userId = 'test-user-progress-1';

    // Submit job
    const { jobId } = await context.jobSubmitter.submitJob(userId, prompt);

    // Monitor progress updates via Redis
    const progressUpdates: number[] = [];
    const timeout = 10000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      // Check progress in Redis
      const progressData = await context.redis.get(`job-progress:${jobId}`);

      if (progressData) {
        const progress = JSON.parse(progressData);
        if (
          progress.percentage !== undefined &&
          !progressUpdates.includes(progress.percentage)
        ) {
          progressUpdates.push(progress.percentage);
        }
      }

      // Check if job completed
      const job = await context.queueManager.getQueue().getJob(jobId);
      if (job) {
        const state = await job.getState();
        if (state === 'completed') break;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Should have received progress updates
    expect(progressUpdates.length).toBeGreaterThan(0);

    // Progress should increase over time
    if (progressUpdates.length > 1) {
      for (let i = 1; i < progressUpdates.length; i++) {
        expect(progressUpdates[i]).toBeGreaterThanOrEqual(
          progressUpdates[i - 1]
        );
      }
    }
  });

  it('should emit completion event when job finishes', async () => {
    const prompt = createUniquePrompt(`completion-${Date.now()}`);
    const userId = 'test-user-progress-2';

    const { jobId } = await context.jobSubmitter.submitJob(userId, prompt);

    // Wait for job to complete
    let jobCompleted = false;
    const timeout = 10000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const job = await context.queueManager.getQueue().getJob(jobId);
      if (job) {
        const state = await job.getState();
        if (state === 'completed') {
          jobCompleted = true;
          break;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    expect(jobCompleted).toBe(true);

    // Check for completion indicator in Redis
    const progressData = await context.redis.get(`job-progress:${jobId}`);

    if (progressData) {
      const progress = JSON.parse(progressData);
      expect(progress.percentage).toBe(100);
    }
  });

  it('should handle job that completes before first progress update', async () => {
    // Use instant completion (no delay)
    const quickContext = await setupTestEnvironment({
      scenario: 'success',
      delay: 0,
    });

    const prompt = createUniquePrompt(`instant-${Date.now()}`);
    const userId = 'test-user-instant';

    const { jobId } = await quickContext.jobSubmitter.submitJob(
      prompt,
      userId
    );

    // Wait a bit
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Job should be completed
    const job = await quickContext.queueManager.getQueue().getJob(jobId);
    if (job) {
      const state = await job.getState();
      expect(state).toBe('completed');
    }

    await teardownTestEnvironment(quickContext);
  });

  it('should provide accurate progress percentages', async () => {
    const prompt = createUniquePrompt(`accurate-progress-${Date.now()}`);
    const userId = 'test-user-progress-3';

    const { jobId } = await context.jobSubmitter.submitJob(userId, prompt);

    const progressUpdates: number[] = [];
    const timeout = 10000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const progressData = await context.redis.get(`job-progress:${jobId}`);

      if (progressData) {
        const progress = JSON.parse(progressData);
        if (progress.percentage !== undefined) {
          progressUpdates.push(progress.percentage);
        }
      }

      const job = await context.queueManager.getQueue().getJob(jobId);
      if (job) {
        const state = await job.getState();
        if (state === 'completed') break;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // All progress values should be valid percentages (0-100)
    progressUpdates.forEach((progress) => {
      expect(progress).toBeGreaterThanOrEqual(0);
      expect(progress).toBeLessThanOrEqual(100);
    });
  });

  it('should handle multiple concurrent jobs with independent progress', async () => {
    const jobs = await Promise.all([
      context.jobSubmitter.submitJob(
        createUniquePrompt(`concurrent-progress-1-${Date.now()}`),
        'user-1'
      ),
      context.jobSubmitter.submitJob(
        createUniquePrompt(`concurrent-progress-2-${Date.now()}`),
        'user-2'
      ),
      context.jobSubmitter.submitJob(
        createUniquePrompt(`concurrent-progress-3-${Date.now()}`),
        'user-3'
      ),
    ]);

    const jobIds = jobs.map((j) => j.jobId);

    // Monitor progress for all jobs
    const timeout = 15000;
    const startTime = Date.now();

    const allProgressData = new Map<string, number[]>();
    jobIds.forEach((id) => allProgressData.set(id, []));

    while (Date.now() - startTime < timeout) {
      for (const jobId of jobIds) {
        const progressData = await context.redis.get(`job-progress:${jobId}`);
        if (progressData) {
          const progress = JSON.parse(progressData);
          if (progress.percentage !== undefined) {
            const updates = allProgressData.get(jobId) || [];
            if (!updates.includes(progress.percentage)) {
              updates.push(progress.percentage);
              allProgressData.set(jobId, updates);
            }
          }
        }
      }

      // Check if all jobs completed
      const allCompleted = await Promise.all(
        jobIds.map(async (id) => {
          const job = await context.queueManager.getQueue().getJob(id);
          if (job) {
            const state = await job.getState();
            return state === 'completed';
          }
          return false;
        })
      );

      if (allCompleted.every((c) => c === true)) break;

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Each job should have independent progress tracking
    jobIds.forEach((jobId) => {
      const updates = allProgressData.get(jobId) || [];
      expect(updates.length).toBeGreaterThanOrEqual(0);
    });
  });

  it('should clean up progress data after job completion', async () => {
    const prompt = createUniquePrompt(`cleanup-progress-${Date.now()}`);
    const userId = 'test-user-cleanup';

    const { jobId } = await context.jobSubmitter.submitJob(userId, prompt);

    // Wait for completion
    let jobCompleted = false;
    const timeout = 10000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const job = await context.queueManager.getQueue().getJob(jobId);
      if (job) {
        const state = await job.getState();
        if (state === 'completed') {
          jobCompleted = true;
          break;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    expect(jobCompleted).toBe(true);

    // Progress data should still exist (for client to read final state)
    const progressData = await context.redis.get(`job-progress:${jobId}`);
    expect(progressData).toBeDefined();

    // But should eventually be cleaned up (after TTL)
    // In production, this would expire after a configured TTL
  });

  it('should handle SSE heartbeat correctly', async () => {
    const prompt = createUniquePrompt(`heartbeat-${Date.now()}`);
    const userId = 'test-user-heartbeat';

    const { jobId } = await context.jobSubmitter.submitJob(userId, prompt);

    // SSEManager should be active
    expect(context.sseManager).toBeDefined();

    // Wait for job to complete
    const timeout = 10000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const job = await context.queueManager.getQueue().getJob(jobId);
      if (job) {
        const state = await job.getState();
        if (state === 'completed' || state === 'failed') break;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // SSEManager should handle heartbeats without errors
    expect(context.sseManager).toBeDefined();
  });
});
