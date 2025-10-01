/**
 * Tests for Queue Job Fixtures
 *
 * Verifies that queue job fixtures are valid, deterministic, and cover all job states.
 */

import { describe, it, expect } from 'vitest';
import { JobStatus } from '../../src/queue/job-status-tracker.js';
import {
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

describe('Queue Job Fixtures', () => {
  describe('createPendingJob', () => {
    it('should create a valid pending job', () => {
      const job = createPendingJob();

      expect(job).toBeDefined();
      expect(job.jobId).toBe('job-pending-001');
      expect(job.userId).toBe('user-test-123');
      expect(job.status).toBe(JobStatus.PENDING);
      expect(job.progress).toBe(0);
      expect(job.retryCount).toBe(0);
      expect(job.metadata.cacheHit).toBe(false);
    });

    it('should be deterministic', () => {
      const job1 = createPendingJob();
      const job2 = createPendingJob();

      expect(job1).toEqual(job2);
    });

    it('should have valid structured prompt', () => {
      const job = createPendingJob();

      expect(job.structuredPrompt).toBeDefined();
      expect(job.structuredPrompt.type).toBeTruthy();
      expect(job.structuredPrompt.description).toBeTruthy();
    });

    it('should not have completion fields', () => {
      const job = createPendingJob();

      expect(job.startedAt).toBeUndefined();
      expect(job.completedAt).toBeUndefined();
      expect(job.result).toBeUndefined();
      expect(job.errorMessage).toBeUndefined();
    });
  });

  describe('createProcessingJob', () => {
    it('should create a valid processing job', () => {
      const job = createProcessingJob();

      expect(job).toBeDefined();
      expect(job.status).toBe(JobStatus.PROCESSING);
      expect(job.progress).toBeGreaterThan(0);
      expect(job.progress).toBeLessThan(100);
      expect(job.startedAt).toBeDefined();
      expect(job.pixelLabJobId).toBeDefined();
    });

    it('should be deterministic', () => {
      const job1 = createProcessingJob();
      const job2 = createProcessingJob();

      expect(job1).toEqual(job2);
    });

    it('should have valid timestamps', () => {
      const job = createProcessingJob();

      expect(job.createdAt).toBeLessThan(job.startedAt!);
    });

    it('should not have completion fields', () => {
      const job = createProcessingJob();

      expect(job.completedAt).toBeUndefined();
      expect(job.result).toBeUndefined();
    });
  });

  describe('createCompletedJob', () => {
    it('should create a valid completed job', () => {
      const job = createCompletedJob();

      expect(job).toBeDefined();
      expect(job.status).toBe(JobStatus.COMPLETED);
      expect(job.progress).toBe(100);
      expect(job.startedAt).toBeDefined();
      expect(job.completedAt).toBeDefined();
      expect(job.result).toBeDefined();
      expect(job.metadata.actualDuration).toBeDefined();
    });

    it('should be deterministic', () => {
      const job1 = createCompletedJob();
      const job2 = createCompletedJob();

      expect(job1.jobId).toEqual(job2.jobId);
      expect(job1.status).toEqual(job2.status);
      expect(job1.progress).toEqual(job2.progress);
    });

    it('should have valid timestamp progression', () => {
      const job = createCompletedJob();

      expect(job.createdAt).toBeLessThan(job.startedAt!);
      expect(job.startedAt!).toBeLessThan(job.completedAt!);
    });

    it('should have valid result', () => {
      const job = createCompletedJob();

      expect(job.result).toBeDefined();
      expect(job.result?.jobId).toBeTruthy();
      expect(job.result?.frames).toBeDefined();
      expect(job.result?.frames.length).toBeGreaterThan(0);
    });
  });

  describe('createFailedJob', () => {
    it('should create a valid failed job', () => {
      const job = createFailedJob();

      expect(job).toBeDefined();
      expect(job.status).toBe(JobStatus.FAILED);
      expect(job.retryCount).toBeGreaterThan(0);
      expect(job.errorMessage).toBeDefined();
      expect(job.errorMessage?.length).toBeGreaterThan(0);
      expect(job.completedAt).toBeDefined();
    });

    it('should be deterministic', () => {
      const job1 = createFailedJob();
      const job2 = createFailedJob();

      expect(job1).toEqual(job2);
    });

    it('should not have result', () => {
      const job = createFailedJob();

      expect(job.result).toBeUndefined();
    });

    it('should have meaningful error message', () => {
      const job = createFailedJob();

      expect(job.errorMessage).toBeDefined();
      expect(job.errorMessage?.length).toBeGreaterThan(0);
    });
  });

  describe('createRetryingJob', () => {
    it('should create a valid retrying job', () => {
      const job = createRetryingJob();

      expect(job).toBeDefined();
      expect(job.status).toBe(JobStatus.RETRYING);
      expect(job.retryCount).toBeGreaterThan(0);
      expect(job.errorMessage).toBeDefined();
      expect(job.completedAt).toBeUndefined();
    });

    it('should be deterministic', () => {
      const job1 = createRetryingJob();
      const job2 = createRetryingJob();

      expect(job1).toEqual(job2);
    });

    it('should not be completed', () => {
      const job = createRetryingJob();

      expect(job.completedAt).toBeUndefined();
      expect(job.result).toBeUndefined();
    });
  });

  describe('createCachedJob', () => {
    it('should create a valid cached job', () => {
      const job = createCachedJob();

      expect(job).toBeDefined();
      expect(job.status).toBe(JobStatus.COMPLETED);
      expect(job.metadata.cacheHit).toBe(true);
      expect(job.result).toBeDefined();
    });

    it('should be deterministic', () => {
      const job1 = createCachedJob();
      const job2 = createCachedJob();

      expect(job1).toEqual(job2);
    });

    it('should have fast completion time', () => {
      const job = createCachedJob();

      const duration = job.completedAt! - job.createdAt;
      expect(duration).toBeLessThan(1000);
    });

    it('should have cache hit result', () => {
      const job = createCachedJob();

      expect(job.result?.metadata.cacheHit).toBe(true);
    });
  });

  describe('createMinimalJob', () => {
    it('should create a minimal job with only required fields', () => {
      const job = createMinimalJob();

      expect(job).toBeDefined();
      expect(job.jobId).toBeTruthy();
      expect(job.userId).toBeTruthy();
      expect(job.status).toBeDefined();
      expect(job.metadata).toBeDefined();
    });

    it('should be deterministic', () => {
      const job1 = createMinimalJob();
      const job2 = createMinimalJob();

      expect(job1).toEqual(job2);
    });
  });

  describe('createLongRunningJob', () => {
    it('should create a long-running job', () => {
      const job = createLongRunningJob();

      expect(job).toBeDefined();
      expect(job.status).toBe(JobStatus.PROCESSING);
      expect(job.metadata.estimatedDuration).toBeGreaterThan(30000);
    });

    it('should be deterministic', () => {
      const job1 = createLongRunningJob();
      const job2 = createLongRunningJob();

      expect(job1).toEqual(job2);
    });
  });

  describe('createJobArray', () => {
    it('should create an array of jobs covering all states', () => {
      const jobs = createJobArray();

      expect(jobs).toHaveLength(6);
      expect(jobs.some((j) => j.status === JobStatus.PENDING)).toBe(true);
      expect(jobs.some((j) => j.status === JobStatus.PROCESSING)).toBe(true);
      expect(jobs.some((j) => j.status === JobStatus.COMPLETED)).toBe(true);
      expect(jobs.some((j) => j.status === JobStatus.FAILED)).toBe(true);
      expect(jobs.some((j) => j.status === JobStatus.RETRYING)).toBe(true);
    });

    it('should be deterministic', () => {
      const jobs1 = createJobArray();
      const jobs2 = createJobArray();

      expect(jobs1.length).toEqual(jobs2.length);
      jobs1.forEach((job, index) => {
        expect(job.jobId).toEqual(jobs2[index].jobId);
      });
    });

    it('should have unique job IDs', () => {
      const jobs = createJobArray();

      const jobIds = jobs.map((j) => j.jobId);
      const uniqueIds = new Set(jobIds);
      expect(uniqueIds.size).toBe(jobIds.length);
    });
  });

  describe('createCustomJob', () => {
    it('should create a job with custom overrides', () => {
      const custom = createCustomJob({
        jobId: 'custom-job-123',
        userId: 'custom-user-456',
        status: JobStatus.COMPLETED,
        progress: 100,
      });

      expect(custom.jobId).toBe('custom-job-123');
      expect(custom.userId).toBe('custom-user-456');
      expect(custom.status).toBe(JobStatus.COMPLETED);
      expect(custom.progress).toBe(100);
    });

    it('should preserve base fields not overridden', () => {
      const custom = createCustomJob({
        jobId: 'custom-job-789',
      });

      expect(custom.jobId).toBe('custom-job-789');
      expect(custom.structuredPrompt).toBeDefined();
      expect(custom.cacheKey).toBeTruthy();
      expect(custom.metadata).toBeDefined();
    });
  });
});
