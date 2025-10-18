/**
 * Task 3.2 Tests: Polling Fallback Manager
 *
 * Comprehensive test suite for HTTP polling fallback mechanism
 * Testing status queries, caching, rate limiting, and edge cases
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PollingManager } from './polling-manager.js';
import type { JobStatusTracker, QueueJob, JobStatus } from '../queue/job-status-tracker.js';
import type { QueueServiceConfig } from '../queue/queue-manager.js';
import type { QueueLogger } from '../queue/logger.js';

describe('PollingManager', () => {
  let pollingManager: PollingManager;
  let mockJobStatusTracker: JobStatusTracker;
  let mockConfig: QueueServiceConfig;
  let mockLogger: QueueLogger;

  beforeEach(() => {
    mockConfig = {
      redis: {
        host: 'localhost',
        port: 6379,
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
        strategy: 'moderate' as const,
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

    mockLogger = {
      logInfo: vi.fn(),
      logWarn: vi.fn(),
      logError: vi.fn(),
    } as any;

    mockJobStatusTracker = {
      getJobStatus: vi.fn(),
    } as any;

    pollingManager = new PollingManager(
      mockJobStatusTracker,
      mockConfig,
      mockLogger
    );
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('getJobStatus', () => {
    const mockJob: QueueJob = {
      jobId: 'job123',
      userId: 'user123',
      structuredPrompt: {
        type: 'sprite',
        style: 'pixel-art',
        size: { width: 32, height: 32 },
        action: 'idle',
        description: 'Test sprite',
        raw: 'test prompt',
      },
      cacheKey: 'cache123',
      status: 'processing' as JobStatus,
      progress: 50,
      createdAt: Date.now(),
      retryCount: 0,
      metadata: {
        cacheHit: false,
      },
    };

    it('should return current job status and progress', async () => {
      vi.mocked(mockJobStatusTracker.getJobStatus).mockResolvedValue(mockJob);

      const result = await pollingManager.getJobStatus('job123');

      expect(result.status).toEqual(mockJob);
      expect(result.modified).toBe(true);
      expect(result.etag).toBeDefined();
    });

    it('should return 304 if status unchanged since last poll (via timestamp)', async () => {
      vi.mocked(mockJobStatusTracker.getJobStatus).mockResolvedValue(mockJob);

      // First poll
      const result1 = await pollingManager.getJobStatus('job123');
      const lastModified = result1.status.createdAt;

      // Second poll with same timestamp
      const result2 = await pollingManager.getJobStatus('job123', lastModified);

      expect(result2.modified).toBe(false);
    });

    it('should generate ETag based on job state', async () => {
      vi.mocked(mockJobStatusTracker.getJobStatus).mockResolvedValue(mockJob);

      const result = await pollingManager.getJobStatus('job123');

      expect(result.etag).toBeDefined();
      expect(typeof result.etag).toBe('string');
      expect(result.etag.length).toBeGreaterThan(0);
    });

    it('should return different ETag when job status changes', async () => {
      vi.useFakeTimers();
      const job1 = { ...mockJob, status: 'pending' as JobStatus };
      const job2 = { ...mockJob, status: 'completed' as JobStatus };

      vi.mocked(mockJobStatusTracker.getJobStatus).mockResolvedValueOnce(job1);
      const result1 = await pollingManager.getJobStatus('job123');

      // Advance time to expire cache
      vi.advanceTimersByTime(2000);

      vi.mocked(mockJobStatusTracker.getJobStatus).mockResolvedValueOnce(job2);
      const result2 = await pollingManager.getJobStatus('job123');

      expect(result1.etag).not.toBe(result2.etag);
    });

    it('should cache status for 2 seconds to avoid excessive BullMQ queries', async () => {
      vi.useFakeTimers();
      vi.mocked(mockJobStatusTracker.getJobStatus).mockResolvedValue(mockJob);

      // First call
      await pollingManager.getJobStatus('job123');
      expect(mockJobStatusTracker.getJobStatus).toHaveBeenCalledTimes(1);

      // Second call within 2 seconds (should use cache)
      await pollingManager.getJobStatus('job123');
      expect(mockJobStatusTracker.getJobStatus).toHaveBeenCalledTimes(1);

      // Advance time by 2 seconds
      vi.advanceTimersByTime(2000);

      // Third call (cache expired, should query again)
      await pollingManager.getJobStatus('job123');
      expect(mockJobStatusTracker.getJobStatus).toHaveBeenCalledTimes(2);
    });

    it('should return null status when job not found', async () => {
      vi.mocked(mockJobStatusTracker.getJobStatus).mockResolvedValue(null);

      const result = await pollingManager.getJobStatus('nonexistent');

      expect(result.status).toBeNull();
      expect(result.modified).toBe(true);
    });

    it('should log status query', async () => {
      vi.mocked(mockJobStatusTracker.getJobStatus).mockResolvedValue(mockJob);

      await pollingManager.getJobStatus('job123');

      expect(mockLogger.logInfo).toHaveBeenCalledWith(
        'polling_status_query',
        expect.objectContaining({
          jobId: 'job123',
        })
      );
    });
  });

  describe('Rate Limiting', () => {
    const mockJob: QueueJob = {
      jobId: 'job123',
      userId: 'user123',
      structuredPrompt: {
        type: 'sprite',
        style: 'pixel-art',
        size: { width: 32, height: 32 },
        action: 'idle',
        description: 'Test sprite',
        raw: 'test prompt',
      },
      cacheKey: 'cache123',
      status: 'processing' as JobStatus,
      progress: 50,
      createdAt: Date.now(),
      retryCount: 0,
      metadata: {
        cacheHit: false,
      },
    };

    it('should rate limit to 1 request per 2 seconds per job', async () => {
      vi.useFakeTimers();
      vi.mocked(mockJobStatusTracker.getJobStatus).mockResolvedValue(mockJob);

      // First request - should succeed
      const result1 = await pollingManager.getJobStatus('job123');
      expect(result1.status).toEqual(mockJob);

      // Second request immediately - should be rate limited
      const result2 = await pollingManager.getJobStatus('job123');
      expect(result2.status).toEqual(mockJob); // Returns cached value
      expect(mockJobStatusTracker.getJobStatus).toHaveBeenCalledTimes(1);

      // Wait 2 seconds
      vi.advanceTimersByTime(2000);

      // Third request - should succeed
      const result3 = await pollingManager.getJobStatus('job123');
      expect(result3.status).toEqual(mockJob);
      expect(mockJobStatusTracker.getJobStatus).toHaveBeenCalledTimes(2);
    });

    it('should log rate limit warnings', async () => {
      vi.useFakeTimers();
      vi.mocked(mockJobStatusTracker.getJobStatus).mockResolvedValue(mockJob);

      // First request
      await pollingManager.getJobStatus('job123');

      // Second request within 2 seconds (rate limited)
      await pollingManager.getJobStatus('job123');

      expect(mockLogger.logWarn).toHaveBeenCalledWith(
        'polling_rate_limited',
        expect.objectContaining({
          jobId: 'job123',
        })
      );
    });

    it('should allow different jobs to poll independently', async () => {
      vi.useFakeTimers();
      const job1 = { ...mockJob, jobId: 'job123' };
      const job2 = { ...mockJob, jobId: 'job456' };

      vi.mocked(mockJobStatusTracker.getJobStatus)
        .mockResolvedValueOnce(job1)
        .mockResolvedValueOnce(job2);

      // Poll both jobs immediately
      await pollingManager.getJobStatus('job123');
      await pollingManager.getJobStatus('job456');

      // Both should succeed (no cross-job rate limiting)
      expect(mockJobStatusTracker.getJobStatus).toHaveBeenCalledTimes(2);
    });
  });

  describe('Authorization', () => {
    const mockJob: QueueJob = {
      jobId: 'job123',
      userId: 'user123',
      structuredPrompt: {
        type: 'sprite',
        style: 'pixel-art',
        size: { width: 32, height: 32 },
        action: 'idle',
        description: 'Test sprite',
        raw: 'test prompt',
      },
      cacheKey: 'cache123',
      status: 'processing' as JobStatus,
      progress: 50,
      createdAt: Date.now(),
      retryCount: 0,
      metadata: {
        cacheHit: false,
      },
    };

    it('should verify job belongs to requesting user', async () => {
      vi.mocked(mockJobStatusTracker.getJobStatus).mockResolvedValue(mockJob);

      const result = await pollingManager.getJobStatus('job123', undefined, 'user123');

      expect(result.status).toEqual(mockJob);
    });

    it('should reject access to other users jobs', async () => {
      vi.mocked(mockJobStatusTracker.getJobStatus).mockResolvedValue(mockJob);

      const result = await pollingManager.getJobStatus('job123', undefined, 'user456');

      expect(result.status).toBeNull();
      expect(mockLogger.logWarn).toHaveBeenCalledWith(
        'polling_unauthorized_access',
        expect.objectContaining({
          jobId: 'job123',
          requestingUserId: 'user456',
          jobUserId: 'user123',
        })
      );
    });

    it('should allow access without userId check if not provided', async () => {
      vi.mocked(mockJobStatusTracker.getJobStatus).mockResolvedValue(mockJob);

      const result = await pollingManager.getJobStatus('job123');

      expect(result.status).toEqual(mockJob);
    });
  });

  describe('Edge Cases', () => {
    it('should handle job completion between polls', async () => {
      const pendingJob: QueueJob = {
        jobId: 'job123',
        userId: 'user123',
        structuredPrompt: {
          type: 'sprite',
          style: 'pixel-art',
          size: { width: 32, height: 32 },
          action: 'idle',
          description: 'Test sprite',
          raw: 'test prompt',
        },
        cacheKey: 'cache123',
        status: 'pending' as JobStatus,
        progress: 0,
        createdAt: Date.now(),
        retryCount: 0,
        metadata: {
          cacheHit: false,
        },
      };

      const completedJob: QueueJob = {
        ...pendingJob,
        status: 'completed' as JobStatus,
        progress: 100,
        completedAt: Date.now(),
      };

      vi.useFakeTimers();
      vi.mocked(mockJobStatusTracker.getJobStatus)
        .mockResolvedValueOnce(pendingJob)
        .mockResolvedValueOnce(completedJob);

      // First poll - pending
      const result1 = await pollingManager.getJobStatus('job123');
      expect(result1.status?.status).toBe('pending');

      // Advance time to expire cache
      vi.advanceTimersByTime(2000);

      // Second poll - completed (should return immediately)
      const result2 = await pollingManager.getJobStatus('job123');
      expect(result2.status?.status).toBe('completed');
      expect(result2.modified).toBe(true);
    });

    it('should handle very old job (expired from Redis)', async () => {
      vi.mocked(mockJobStatusTracker.getJobStatus).mockResolvedValue(null);

      const result = await pollingManager.getJobStatus('ancient-job-123');

      expect(result.status).toBeNull();
      expect(mockLogger.logInfo).toHaveBeenCalledWith(
        'polling_status_query',
        expect.objectContaining({
          jobId: 'ancient-job-123',
          found: false,
        })
      );
    });

    it('should handle tracker errors gracefully', async () => {
      const error = new Error('Redis connection failed');
      vi.mocked(mockJobStatusTracker.getJobStatus).mockRejectedValue(error);

      await expect(pollingManager.getJobStatus('job123')).rejects.toThrow(
        'Redis connection failed'
      );

      expect(mockLogger.logError).toHaveBeenCalledWith(
        'job123',
        error,
        expect.objectContaining({
          operation: 'getJobStatus',
        })
      );
    });

    it('should clear cache on error to prevent stale data', async () => {
      vi.useFakeTimers();
      const mockJob: QueueJob = {
        jobId: 'job123',
        userId: 'user123',
        structuredPrompt: {
          type: 'sprite',
          style: 'pixel-art',
          size: { width: 32, height: 32 },
          action: 'idle',
          description: 'Test sprite',
          raw: 'test prompt',
        },
        cacheKey: 'cache123',
        status: 'processing' as JobStatus,
        progress: 50,
        createdAt: Date.now(),
        retryCount: 0,
        metadata: {
          cacheHit: false,
        },
      };

      // First call succeeds
      vi.mocked(mockJobStatusTracker.getJobStatus).mockResolvedValueOnce(mockJob);
      await pollingManager.getJobStatus('job123');

      // Advance time to expire cache
      vi.advanceTimersByTime(2000);

      // Second call fails
      const error = new Error('Redis error');
      vi.mocked(mockJobStatusTracker.getJobStatus).mockRejectedValueOnce(error);

      try {
        await pollingManager.getJobStatus('job123');
      } catch (e) {
        // Expected
      }

      // Advance time to expire rate limit
      vi.advanceTimersByTime(2000);

      // Third call should query again (cache cleared)
      vi.mocked(mockJobStatusTracker.getJobStatus).mockResolvedValueOnce(mockJob);
      await pollingManager.getJobStatus('job123');

      expect(mockJobStatusTracker.getJobStatus).toHaveBeenCalledTimes(3);
    });

    it('should handle concurrent polls for same job', async () => {
      const mockJob: QueueJob = {
        jobId: 'job123',
        userId: 'user123',
        structuredPrompt: {
          type: 'sprite',
          style: 'pixel-art',
          size: { width: 32, height: 32 },
          action: 'idle',
          description: 'Test sprite',
          raw: 'test prompt',
        },
        cacheKey: 'cache123',
        status: 'processing' as JobStatus,
        progress: 50,
        createdAt: Date.now(),
        retryCount: 0,
        metadata: {
          cacheHit: false,
        },
      };

      vi.mocked(mockJobStatusTracker.getJobStatus).mockResolvedValue(mockJob);

      // Concurrent polls
      const [result1, result2, result3] = await Promise.all([
        pollingManager.getJobStatus('job123'),
        pollingManager.getJobStatus('job123'),
        pollingManager.getJobStatus('job123'),
      ]);

      // All should succeed
      expect(result1.status).toEqual(mockJob);
      expect(result2.status).toEqual(mockJob);
      expect(result3.status).toEqual(mockJob);
    });

    it('should handle null/undefined userId gracefully', async () => {
      const mockJob: QueueJob = {
        jobId: 'job123',
        userId: 'user123',
        structuredPrompt: {
          type: 'sprite',
          style: 'pixel-art',
          size: { width: 32, height: 32 },
          action: 'idle',
          description: 'Test sprite',
          raw: 'test prompt',
        },
        cacheKey: 'cache123',
        status: 'processing' as JobStatus,
        progress: 50,
        createdAt: Date.now(),
        retryCount: 0,
        metadata: {
          cacheHit: false,
        },
      };

      vi.mocked(mockJobStatusTracker.getJobStatus).mockResolvedValue(mockJob);

      const result = await pollingManager.getJobStatus('job123', undefined, undefined);

      expect(result.status).toEqual(mockJob);
    });
  });

  describe('ETag Generation', () => {
    it('should generate consistent ETag for same job state', async () => {
      const mockJob: QueueJob = {
        jobId: 'job123',
        userId: 'user123',
        structuredPrompt: {
          type: 'sprite',
          style: 'pixel-art',
          size: { width: 32, height: 32 },
          action: 'idle',
          description: 'Test sprite',
          raw: 'test prompt',
        },
        cacheKey: 'cache123',
        status: 'processing' as JobStatus,
        progress: 50,
        createdAt: 1000,
        retryCount: 0,
        metadata: {
          cacheHit: false,
        },
      };

      vi.mocked(mockJobStatusTracker.getJobStatus).mockResolvedValue(mockJob);

      const result1 = await pollingManager.getJobStatus('job123');
      const result2 = await pollingManager.getJobStatus('job123');

      expect(result1.etag).toBe(result2.etag);
    });

    it('should generate different ETag when progress changes', async () => {
      vi.useFakeTimers();
      const job1: QueueJob = {
        jobId: 'job123',
        userId: 'user123',
        structuredPrompt: {
          type: 'sprite',
          style: 'pixel-art',
          size: { width: 32, height: 32 },
          action: 'idle',
          description: 'Test sprite',
          raw: 'test prompt',
        },
        cacheKey: 'cache123',
        status: 'processing' as JobStatus,
        progress: 50,
        createdAt: 1000,
        retryCount: 0,
        metadata: {
          cacheHit: false,
        },
      };

      const job2: QueueJob = {
        ...job1,
        progress: 75,
      };

      vi.mocked(mockJobStatusTracker.getJobStatus)
        .mockResolvedValueOnce(job1)
        .mockResolvedValueOnce(job2);

      const result1 = await pollingManager.getJobStatus('job123');

      // Advance time to expire cache
      vi.advanceTimersByTime(2000);

      const result2 = await pollingManager.getJobStatus('job123');

      expect(result1.etag).not.toBe(result2.etag);
    });
  });

  describe('Performance', () => {
    it('should cache multiple different jobs independently', async () => {
      vi.useFakeTimers();
      const job1: QueueJob = {
        jobId: 'job123',
        userId: 'user123',
        structuredPrompt: {
          type: 'sprite',
          style: 'pixel-art',
          size: { width: 32, height: 32 },
          action: 'idle',
          description: 'Test sprite',
          raw: 'test prompt',
        },
        cacheKey: 'cache123',
        status: 'processing' as JobStatus,
        progress: 50,
        createdAt: Date.now(),
        retryCount: 0,
        metadata: {
          cacheHit: false,
        },
      };

      const job2: QueueJob = {
        ...job1,
        jobId: 'job456',
      };

      vi.mocked(mockJobStatusTracker.getJobStatus)
        .mockResolvedValueOnce(job1)
        .mockResolvedValueOnce(job2);

      // First call for each job
      await pollingManager.getJobStatus('job123');
      await pollingManager.getJobStatus('job456');

      expect(mockJobStatusTracker.getJobStatus).toHaveBeenCalledTimes(2);

      // Second call for each job (should use cache)
      await pollingManager.getJobStatus('job123');
      await pollingManager.getJobStatus('job456');

      expect(mockJobStatusTracker.getJobStatus).toHaveBeenCalledTimes(2);
    });
  });
});
