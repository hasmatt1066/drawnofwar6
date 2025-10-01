/**
 * Task 1.4: Implement Job Status Tracking - Tests
 *
 * Tests for JobStatusTracker that queries BullMQ for job state,
 * provides status query interface, lists user jobs, and tracks metrics.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Job, Queue } from 'bullmq';
import { JobStatusTracker, QueueJob, JobStatus } from './job-status-tracker.js';
import type { QueueManager, QueueServiceConfig } from './queue-manager.js';
import type { QueueLogger } from './logger.js';

/**
 * Mock QueueManager for testing
 */
class MockQueueManager {
  private mockQueue: Partial<Queue>;

  constructor() {
    this.mockQueue = {
      getJob: vi.fn(),
      getJobs: vi.fn(),
      getJobCounts: vi.fn(),
      getWaitingCount: vi.fn(),
      getActiveCount: vi.fn(),
      getCompletedCount: vi.fn(),
      getFailedCount: vi.fn(),
    };
  }

  getQueue(): Queue {
    return this.mockQueue as Queue;
  }

  mockGetJob(jobId: string, job: Partial<Job> | null): void {
    (this.mockQueue.getJob as any).mockImplementation((id: string) => {
      if (id === jobId) {
        return Promise.resolve(job);
      }
      return Promise.resolve(null);
    });
  }

  mockGetJobs(jobs: Partial<Job>[]): void {
    (this.mockQueue.getJobs as any).mockResolvedValue(jobs);
  }

  mockGetJobCounts(counts: Record<string, number>): void {
    (this.mockQueue.getJobCounts as any).mockResolvedValue(counts);
  }
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
 * Create test config
 */
function createTestConfig(): QueueServiceConfig {
  return {
    redis: {
      host: 'localhost',
      port: 6379,
      db: 0,
    },
    firestore: {
      projectId: 'test-project',
    },
    queue: {
      name: 'test-queue',
      concurrency: 5,
      maxJobsPerUser: 5,
      systemQueueLimit: 500,
      warningThreshold: 400,
    },
    cache: {
      ttlDays: 30,
      strategy: 'moderate',
    },
    retry: {
      maxRetries: 1,
      backoffDelay: 5000,
      backoffMultiplier: 2.0,
    },
    sse: {
      updateInterval: 2500,
      keepAliveInterval: 30000,
    },
    deduplication: {
      windowSeconds: 10,
    },
  };
}

/**
 * Create mock BullMQ job
 */
function createMockBullMQJob(
  jobId: string,
  userId: string,
  status: string,
  data: any = {}
): Partial<Job> {
  const now = Date.now();
  const job: Partial<Job> = {
    id: jobId,
    name: 'sprite-generation',
    data: {
      userId,
      structuredPrompt: {
        type: 'unit',
        style: 'fantasy',
        size: { width: 32, height: 32 },
        action: 'walk',
        description: 'A brave knight',
        raw: 'fantasy style brave knight walking',
      },
      cacheKey: 'cache-key-123',
      ...data,
    },
    progress: 0,
    timestamp: now,
    processedOn: status === 'processing' || status === 'completed' ? now : undefined,
    finishedOn: status === 'completed' || status === 'failed' ? now : undefined,
    attemptsMade: 0,
    returnvalue: status === 'completed' ? { frames: [], metadata: {} } : undefined,
    failedReason: status === 'failed' ? 'Test error' : undefined,
  };

  return job;
}

describe('JobStatusTracker', () => {
  let mockQueueManager: MockQueueManager;
  let mockLogger: MockQueueLogger;
  let config: QueueServiceConfig;
  let tracker: JobStatusTracker;

  beforeEach(() => {
    mockQueueManager = new MockQueueManager();
    mockLogger = new MockQueueLogger();
    config = createTestConfig();
    tracker = new JobStatusTracker(
      mockQueueManager as unknown as QueueManager,
      config,
      mockLogger as unknown as QueueLogger
    );
  });

  describe('getJobStatus', () => {
    it('should return job status for valid job ID', async () => {
      const jobId = 'job-123';
      const userId = 'user-456';
      const mockJob = createMockBullMQJob(jobId, userId, 'pending');

      mockQueueManager.mockGetJob(jobId, mockJob);

      const result = await tracker.getJobStatus(jobId);

      expect(result).toBeDefined();
      expect(result?.jobId).toBe(jobId);
      expect(result?.userId).toBe(userId);
      expect(result?.status).toBe(JobStatus.PENDING);
      expect(result?.progress).toBe(0);
      expect(result?.createdAt).toBe(mockJob.timestamp);
    });

    it('should return null for non-existent job ID', async () => {
      const jobId = 'non-existent-job';
      mockQueueManager.mockGetJob(jobId, null);

      const result = await tracker.getJobStatus(jobId);

      expect(result).toBeNull();
    });

    it('should return job with PROCESSING status', async () => {
      const jobId = 'job-processing';
      const userId = 'user-789';
      const mockJob = createMockBullMQJob(jobId, userId, 'processing', {
        progress: 50,
      });
      mockJob.progress = 50;

      mockQueueManager.mockGetJob(jobId, mockJob);

      const result = await tracker.getJobStatus(jobId);

      expect(result).toBeDefined();
      expect(result?.status).toBe(JobStatus.PROCESSING);
      expect(result?.progress).toBe(50);
      expect(result?.startedAt).toBe(mockJob.processedOn);
    });

    it('should return job with COMPLETED status', async () => {
      const jobId = 'job-completed';
      const userId = 'user-123';
      const mockResult = {
        frames: [Buffer.from('frame1')],
        metadata: {
          dimensions: { width: 32, height: 32 },
          frameCount: 1,
          generationTimeMs: 1000,
          cacheHit: false,
        },
      };
      const mockJob = createMockBullMQJob(jobId, userId, 'completed');
      mockJob.returnvalue = mockResult;

      mockQueueManager.mockGetJob(jobId, mockJob);

      const result = await tracker.getJobStatus(jobId);

      expect(result).toBeDefined();
      expect(result?.status).toBe(JobStatus.COMPLETED);
      expect(result?.progress).toBe(100);
      expect(result?.completedAt).toBe(mockJob.finishedOn);
      expect(result?.result).toEqual(mockResult);
    });

    it('should return job with FAILED status', async () => {
      const jobId = 'job-failed';
      const userId = 'user-456';
      const errorMessage = 'Generation failed: API error';
      const mockJob = createMockBullMQJob(jobId, userId, 'failed');
      mockJob.failedReason = errorMessage;

      mockQueueManager.mockGetJob(jobId, mockJob);

      const result = await tracker.getJobStatus(jobId);

      expect(result).toBeDefined();
      expect(result?.status).toBe(JobStatus.FAILED);
      expect(result?.errorMessage).toBe(errorMessage);
      expect(result?.completedAt).toBe(mockJob.finishedOn);
    });

    it('should return job with RETRYING status', async () => {
      const jobId = 'job-retrying';
      const userId = 'user-789';
      const mockJob = createMockBullMQJob(jobId, userId, 'failed');
      mockJob.attemptsMade = 1;
      mockJob.finishedOn = undefined; // Not finished yet, retrying

      mockQueueManager.mockGetJob(jobId, mockJob);

      const result = await tracker.getJobStatus(jobId);

      expect(result).toBeDefined();
      expect(result?.status).toBe(JobStatus.RETRYING);
      expect(result?.retryCount).toBe(1);
    });

    it('should calculate progress percentage correctly', async () => {
      const jobId = 'job-with-progress';
      const userId = 'user-123';
      const mockJob = createMockBullMQJob(jobId, userId, 'processing');
      mockJob.progress = 75;

      mockQueueManager.mockGetJob(jobId, mockJob);

      const result = await tracker.getJobStatus(jobId);

      expect(result).toBeDefined();
      expect(result?.progress).toBe(75);
    });

    it('should handle job with metadata', async () => {
      const jobId = 'job-with-metadata';
      const userId = 'user-456';
      const mockJob = createMockBullMQJob(jobId, userId, 'processing', {
        metadata: {
          estimatedDuration: 120,
          cacheHit: false,
        },
        pixelLabJobId: 'pixellab-job-123',
      });

      mockQueueManager.mockGetJob(jobId, mockJob);

      const result = await tracker.getJobStatus(jobId);

      expect(result).toBeDefined();
      expect(result?.metadata.estimatedDuration).toBe(120);
      expect(result?.metadata.cacheHit).toBe(false);
      expect(result?.pixelLabJobId).toBe('pixellab-job-123');
    });
  });

  describe('getUserJobs', () => {
    it('should list all jobs for a user', async () => {
      const userId = 'user-123';
      const mockJobs = [
        createMockBullMQJob('job-1', userId, 'pending'),
        createMockBullMQJob('job-2', userId, 'processing'),
        createMockBullMQJob('job-3', userId, 'completed'),
      ];

      mockQueueManager.mockGetJobs(mockJobs);

      const result = await tracker.getUserJobs(userId);

      expect(result).toHaveLength(3);
      expect(result[0].jobId).toBe('job-1');
      expect(result[0].status).toBe(JobStatus.PENDING);
      expect(result[1].jobId).toBe('job-2');
      expect(result[1].status).toBe(JobStatus.PROCESSING);
      expect(result[2].jobId).toBe('job-3');
      expect(result[2].status).toBe(JobStatus.COMPLETED);
    });

    it('should return empty array when user has 0 jobs', async () => {
      const userId = 'user-no-jobs';
      mockQueueManager.mockGetJobs([]);

      const result = await tracker.getUserJobs(userId);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should filter jobs by userId', async () => {
      const userId = 'user-123';
      const otherUserId = 'user-456';
      const mockJobs = [
        createMockBullMQJob('job-1', userId, 'pending'),
        createMockBullMQJob('job-2', otherUserId, 'processing'),
        createMockBullMQJob('job-3', userId, 'completed'),
      ];

      mockQueueManager.mockGetJobs(mockJobs);

      const result = await tracker.getUserJobs(userId);

      expect(result).toHaveLength(2);
      expect(result[0].userId).toBe(userId);
      expect(result[1].userId).toBe(userId);
      expect(result.every((job) => job.userId === userId)).toBe(true);
    });

    it('should handle jobs in different states', async () => {
      const userId = 'user-789';
      const mockJobs = [
        createMockBullMQJob('job-1', userId, 'pending'),
        createMockBullMQJob('job-2', userId, 'processing'),
        createMockBullMQJob('job-3', userId, 'completed'),
        createMockBullMQJob('job-4', userId, 'failed'),
      ];

      mockQueueManager.mockGetJobs(mockJobs);

      const result = await tracker.getUserJobs(userId);

      expect(result).toHaveLength(4);
      expect(result.map((j) => j.status)).toEqual([
        JobStatus.PENDING,
        JobStatus.PROCESSING,
        JobStatus.COMPLETED,
        JobStatus.FAILED,
      ]);
    });
  });

  describe('getQueueMetrics', () => {
    it('should return queue-wide metrics', async () => {
      mockQueueManager.mockGetJobCounts({
        waiting: 10,
        active: 5,
        completed: 100,
        failed: 2,
        delayed: 0,
      });

      const result = await tracker.getQueueMetrics();

      expect(result).toBeDefined();
      expect(result.queue.pending).toBe(10);
      expect(result.queue.processing).toBe(5);
      expect(result.queue.completed).toBe(100);
      expect(result.queue.failed).toBe(2);
    });

    it('should handle queue with no jobs', async () => {
      mockQueueManager.mockGetJobCounts({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      });

      const result = await tracker.getQueueMetrics();

      expect(result).toBeDefined();
      expect(result.queue.pending).toBe(0);
      expect(result.queue.processing).toBe(0);
      expect(result.queue.completed).toBe(0);
      expect(result.queue.failed).toBe(0);
    });

    it('should calculate total queue size', async () => {
      mockQueueManager.mockGetJobCounts({
        waiting: 25,
        active: 15,
        completed: 200,
        failed: 10,
        delayed: 5,
      });

      const result = await tracker.getQueueMetrics();

      expect(result).toBeDefined();
      // Total active jobs (waiting + active + delayed)
      const totalActive = result.queue.pending + result.queue.processing;
      expect(totalActive).toBe(40); // 25 + 15
    });

    it('should include DLQ size in metrics', async () => {
      mockQueueManager.mockGetJobCounts({
        waiting: 10,
        active: 5,
        completed: 100,
        failed: 15, // Some failed jobs (potential DLQ entries)
        delayed: 0,
      });

      const result = await tracker.getQueueMetrics();

      expect(result).toBeDefined();
      expect(result.queue.dlqSize).toBeDefined();
      expect(typeof result.queue.dlqSize).toBe('number');
    });
  });

  describe('Edge Cases', () => {
    it('should handle job ID exists but job expired from Redis', async () => {
      const jobId = 'expired-job';
      mockQueueManager.mockGetJob(jobId, null);

      const result = await tracker.getJobStatus(jobId);

      expect(result).toBeNull();
    });

    it('should handle user with 0 jobs (empty array)', async () => {
      const userId = 'new-user';
      mockQueueManager.mockGetJobs([]);

      const result = await tracker.getUserJobs(userId);

      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle job in RETRYING state and show retry count', async () => {
      const jobId = 'job-retry';
      const userId = 'user-123';
      const mockJob = createMockBullMQJob(jobId, userId, 'failed');
      mockJob.attemptsMade = 1;
      mockJob.finishedOn = undefined;

      mockQueueManager.mockGetJob(jobId, mockJob);

      const result = await tracker.getJobStatus(jobId);

      expect(result).toBeDefined();
      expect(result?.status).toBe(JobStatus.RETRYING);
      expect(result?.retryCount).toBe(1);
    });

    it('should handle job with missing optional fields', async () => {
      const jobId = 'minimal-job';
      const userId = 'user-456';
      const mockJob: Partial<Job> = {
        id: jobId,
        name: 'sprite-generation',
        data: {
          userId,
          structuredPrompt: {
            type: 'unit',
            style: 'fantasy',
            size: { width: 32, height: 32 },
            action: 'walk',
            description: 'A brave knight',
            raw: 'fantasy style brave knight walking',
          },
          cacheKey: 'cache-key-789',
        },
        progress: 0,
        timestamp: Date.now(),
        attemptsMade: 0,
      };

      mockQueueManager.mockGetJob(jobId, mockJob);

      const result = await tracker.getJobStatus(jobId);

      expect(result).toBeDefined();
      expect(result?.jobId).toBe(jobId);
      expect(result?.status).toBe(JobStatus.PENDING);
      expect(result?.startedAt).toBeUndefined();
      expect(result?.completedAt).toBeUndefined();
      expect(result?.result).toBeUndefined();
    });

    it('should handle jobs with very high retry counts', async () => {
      const jobId = 'high-retry-job';
      const userId = 'user-789';
      const mockJob = createMockBullMQJob(jobId, userId, 'failed');
      mockJob.attemptsMade = 5; // More than maxRetries
      mockJob.finishedOn = Date.now();

      mockQueueManager.mockGetJob(jobId, mockJob);

      const result = await tracker.getJobStatus(jobId);

      expect(result).toBeDefined();
      expect(result?.status).toBe(JobStatus.FAILED);
      expect(result?.retryCount).toBe(5);
    });

    it('should handle corrupted job data gracefully', async () => {
      const jobId = 'corrupted-job';
      const mockJob: Partial<Job> = {
        id: jobId,
        name: 'sprite-generation',
        data: null as any, // Corrupted data
        progress: 0,
        timestamp: Date.now(),
        attemptsMade: 0,
      };

      mockQueueManager.mockGetJob(jobId, mockJob);

      // Should either return null or handle gracefully
      await expect(tracker.getJobStatus(jobId)).resolves.toBeDefined();
    });

    it('should handle metrics when Redis connection fails', async () => {
      const error = new Error('Redis connection failed');
      (mockQueueManager.getQueue().getJobCounts as any).mockRejectedValue(error);

      // Should handle error gracefully, possibly returning default metrics
      await expect(tracker.getQueueMetrics()).rejects.toThrow();
    });
  });

  describe('State Transition Tracking', () => {
    it('should track pending → processing transition', async () => {
      const jobId = 'job-transition-1';
      const userId = 'user-123';

      // Initially pending
      const pendingJob = createMockBullMQJob(jobId, userId, 'pending');
      mockQueueManager.mockGetJob(jobId, pendingJob);

      const pendingResult = await tracker.getJobStatus(jobId);
      expect(pendingResult?.status).toBe(JobStatus.PENDING);
      expect(pendingResult?.startedAt).toBeUndefined();

      // Then processing
      const processingJob = createMockBullMQJob(jobId, userId, 'processing');
      mockQueueManager.mockGetJob(jobId, processingJob);

      const processingResult = await tracker.getJobStatus(jobId);
      expect(processingResult?.status).toBe(JobStatus.PROCESSING);
      expect(processingResult?.startedAt).toBe(processingJob.processedOn);
    });

    it('should track processing → completed transition', async () => {
      const jobId = 'job-transition-2';
      const userId = 'user-456';

      // Processing
      const processingJob = createMockBullMQJob(jobId, userId, 'processing');
      processingJob.progress = 50;
      mockQueueManager.mockGetJob(jobId, processingJob);

      const processingResult = await tracker.getJobStatus(jobId);
      expect(processingResult?.status).toBe(JobStatus.PROCESSING);
      expect(processingResult?.progress).toBe(50);

      // Completed
      const completedJob = createMockBullMQJob(jobId, userId, 'completed');
      mockQueueManager.mockGetJob(jobId, completedJob);

      const completedResult = await tracker.getJobStatus(jobId);
      expect(completedResult?.status).toBe(JobStatus.COMPLETED);
      expect(completedResult?.progress).toBe(100);
      expect(completedResult?.completedAt).toBeDefined();
    });

    it('should track processing → failed transition', async () => {
      const jobId = 'job-transition-3';
      const userId = 'user-789';

      // Processing
      const processingJob = createMockBullMQJob(jobId, userId, 'processing');
      mockQueueManager.mockGetJob(jobId, processingJob);

      const processingResult = await tracker.getJobStatus(jobId);
      expect(processingResult?.status).toBe(JobStatus.PROCESSING);

      // Failed
      const failedJob = createMockBullMQJob(jobId, userId, 'failed');
      failedJob.failedReason = 'Test failure';
      mockQueueManager.mockGetJob(jobId, failedJob);

      const failedResult = await tracker.getJobStatus(jobId);
      expect(failedResult?.status).toBe(JobStatus.FAILED);
      expect(failedResult?.errorMessage).toBe('Test failure');
    });
  });
});
