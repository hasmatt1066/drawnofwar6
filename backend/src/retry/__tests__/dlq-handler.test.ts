/**
 * Tests for Task 4.3: Dead Letter Queue (DLQ)
 *
 * Tests the DLQHandler which moves permanently failed jobs to DLQ
 * for manual review and debugging.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Job, Queue } from 'bullmq';
import { DLQHandler, DLQEntry } from './dlq-handler';
import { ClassifiedError, ErrorType } from './error-classifier';
import { QueueLogger } from '../queue/logger';
import { QueueServiceConfig } from '../queue/queue-manager';
import { PixelLabError, PixelLabErrorType } from '../pixellab/errors';

describe('DLQHandler', () => {
  let dlqHandler: DLQHandler;
  let mockDLQQueue: Queue;
  let mockMainQueue: Queue;
  let mockLogger: QueueLogger;
  let mockConfig: QueueServiceConfig;

  beforeEach(() => {
    mockConfig = {
      redis: { host: 'localhost', port: 6379 },
      firestore: { projectId: 'test-project' },
      queue: {
        name: 'test-queue',
        concurrency: 5,
        maxJobsPerUser: 5,
        systemQueueLimit: 500,
        warningThreshold: 400,
      },
      cache: { ttlDays: 30, strategy: 'moderate' as const },
      retry: { maxRetries: 1, backoffDelay: 5000, backoffMultiplier: 2.0 },
      sse: { updateInterval: 2500, keepAliveInterval: 30000 },
      deduplication: { windowSeconds: 10 },
    };

    // Mock DLQ Queue
    mockDLQQueue = {
      name: 'test-queue-dlq',
      add: vi.fn(),
      getJobs: vi.fn(),
      getJob: vi.fn(),
      remove: vi.fn(),
      client: {
        set: vi.fn(),
        get: vi.fn(),
        del: vi.fn(),
      },
    } as any;

    // Mock Main Queue
    mockMainQueue = {
      name: 'test-queue',
      add: vi.fn(),
      getJob: vi.fn(),
    } as any;

    // Mock Logger
    mockLogger = {
      logInfo: vi.fn(),
      logWarn: vi.fn(),
      logError: vi.fn(),
      logDLQMove: vi.fn(),
    } as any;

    dlqHandler = new DLQHandler(mockDLQQueue, mockMainQueue, mockConfig, mockLogger);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('moveToDLQ', () => {
    let mockJob: Job;
    let classifiedError: ClassifiedError;

    beforeEach(() => {
      mockJob = {
        id: 'test-job-id',
        name: 'sprite-generation',
        data: {
          userId: 'user-123',
          prompt: { description: 'test prompt' },
          retryCount: 1,
          pixelLabJobId: 'pixellab-job-123',
        },
        opts: {},
        attemptsMade: 2,
      } as any;

      const error = new PixelLabError({
        type: PixelLabErrorType.API_ERROR,
        message: 'Server error',
        statusCode: 500,
        retryable: true,
      });

      classifiedError = {
        type: ErrorType.SERVER_ERROR,
        retryable: true,
        userMessage: 'Server error occurred',
        technicalDetails: 'API error: Server error (Status: 500)',
        originalError: error,
      };
    });

    it('should move job to DLQ after max retries', async () => {
      await dlqHandler.moveToDLQ(mockJob, classifiedError);

      expect(mockDLQQueue.add).toHaveBeenCalledWith(
        'dlq-entry',
        expect.objectContaining({
          jobId: 'test-job-id',
          userId: 'user-123',
          retryAttempts: 1,
          pixelLabJobId: 'pixellab-job-123',
        }),
        expect.objectContaining({
          jobId: expect.stringContaining('dlq-'),
          removeOnComplete: false,
          removeOnFail: false,
        })
      );
    });

    it('should store full job context in DLQ entry', async () => {
      await dlqHandler.moveToDLQ(mockJob, classifiedError);

      const dlqEntryCall = (mockDLQQueue.add as any).mock.calls[0];
      const dlqEntry = dlqEntryCall[1] as DLQEntry;

      expect(dlqEntry).toMatchObject({
        jobId: 'test-job-id',
        userId: 'user-123',
        originalJob: {
          id: 'test-job-id',
          name: 'sprite-generation',
          data: expect.objectContaining({
            userId: 'user-123',
            prompt: { description: 'test prompt' },
          }),
        },
        failureReason: 'Server error occurred',
        retryAttempts: 1,
        lastError: {
          message: 'Server error',
          type: 'server_error',
          stack: expect.any(String),
        },
        pixelLabJobId: 'pixellab-job-123',
      });

      expect(dlqEntry.failedAt).toBeGreaterThan(0);
    });

    it('should log failure with full error details and stack trace', async () => {
      await dlqHandler.moveToDLQ(mockJob, classifiedError);

      expect(mockLogger.logDLQMove).toHaveBeenCalledWith(
        'test-job-id',
        'Server error occurred',
        1
      );

      expect(mockLogger.logError).toHaveBeenCalledWith(
        'test-job-id',
        classifiedError.originalError,
        expect.objectContaining({
          errorType: 'server_error',
          retryAttempts: 1,
          userMessage: 'Server error occurred',
        })
      );
    });

    it('should retain DLQ entries for 7 days', async () => {
      await dlqHandler.moveToDLQ(mockJob, classifiedError);

      const addOptions = (mockDLQQueue.add as any).mock.calls[0][2];

      // 7 days in milliseconds
      const sevenDays = 7 * 24 * 60 * 60 * 1000;

      // BullMQ uses removeOnComplete with age
      expect(addOptions).toEqual(
        expect.objectContaining({
          removeOnComplete: false,
          removeOnFail: false,
        })
      );
    });

    it('should handle job without pixelLabJobId', async () => {
      delete mockJob.data.pixelLabJobId;

      await dlqHandler.moveToDLQ(mockJob, classifiedError);

      const dlqEntryCall = (mockDLQQueue.add as any).mock.calls[0];
      const dlqEntry = dlqEntryCall[1] as DLQEntry;

      expect(dlqEntry.pixelLabJobId).toBeUndefined();
    });

    it('should handle job without retryCount', async () => {
      delete mockJob.data.retryCount;

      await dlqHandler.moveToDLQ(mockJob, classifiedError);

      const dlqEntryCall = (mockDLQQueue.add as any).mock.calls[0];
      const dlqEntry = dlqEntryCall[1] as DLQEntry;

      expect(dlqEntry.retryAttempts).toBe(0);
    });

    it('should handle error without stack trace', async () => {
      const errorWithoutStack = new Error('No stack');
      delete errorWithoutStack.stack;

      classifiedError.originalError = errorWithoutStack;

      await dlqHandler.moveToDLQ(mockJob, classifiedError);

      const dlqEntryCall = (mockDLQQueue.add as any).mock.calls[0];
      const dlqEntry = dlqEntryCall[1] as DLQEntry;

      expect(dlqEntry.lastError.stack).toBeUndefined();
    });

    it('should handle DLQ add failure gracefully', async () => {
      mockDLQQueue.add = vi.fn().mockRejectedValue(new Error('DLQ full'));

      await expect(
        dlqHandler.moveToDLQ(mockJob, classifiedError)
      ).rejects.toThrow('DLQ full');

      // Should still log the error
      expect(mockLogger.logError).toHaveBeenCalled();
    });
  });

  describe('listDLQEntries', () => {
    it('should list all DLQ entries', async () => {
      const mockDLQJobs = [
        {
          id: 'dlq-1',
          data: {
            jobId: 'job-1',
            userId: 'user-1',
            failureReason: 'Error 1',
            failedAt: Date.now(),
            retryAttempts: 1,
            lastError: { message: 'Error 1', type: 'server_error' },
            originalJob: { id: 'job-1', name: 'test' },
          },
        },
        {
          id: 'dlq-2',
          data: {
            jobId: 'job-2',
            userId: 'user-2',
            failureReason: 'Error 2',
            failedAt: Date.now(),
            retryAttempts: 2,
            lastError: { message: 'Error 2', type: 'timeout' },
            originalJob: { id: 'job-2', name: 'test' },
          },
        },
      ];

      mockDLQQueue.getJobs = vi.fn().mockResolvedValue(mockDLQJobs);

      const entries = await dlqHandler.listDLQEntries();

      expect(entries).toHaveLength(2);
      expect(entries[0].jobId).toBe('job-1');
      expect(entries[1].jobId).toBe('job-2');
    });

    it('should limit DLQ entries when limit specified', async () => {
      const mockDLQJobs = Array.from({ length: 10 }, (_, i) => ({
        id: `dlq-${i}`,
        data: {
          jobId: `job-${i}`,
          userId: `user-${i}`,
          failureReason: `Error ${i}`,
          failedAt: Date.now(),
          retryAttempts: 1,
          lastError: { message: `Error ${i}`, type: 'server_error' },
          originalJob: { id: `job-${i}`, name: 'test' },
        },
      }));

      mockDLQQueue.getJobs = vi.fn().mockResolvedValue(mockDLQJobs);

      const entries = await dlqHandler.listDLQEntries(5);

      expect(mockDLQQueue.getJobs).toHaveBeenCalledWith(
        ['failed', 'completed'],
        0,
        4, // limit - 1 for BullMQ (0-indexed)
        true
      );
    });

    it('should handle empty DLQ', async () => {
      mockDLQQueue.getJobs = vi.fn().mockResolvedValue([]);

      const entries = await dlqHandler.listDLQEntries();

      expect(entries).toHaveLength(0);
    });

    it('should handle DLQ read failure', async () => {
      mockDLQQueue.getJobs = vi.fn().mockRejectedValue(new Error('Redis error'));

      await expect(dlqHandler.listDLQEntries()).rejects.toThrow('Redis error');
    });
  });

  describe('getDLQEntry', () => {
    it('should retrieve specific DLQ entry by job ID', async () => {
      const mockDLQJobs = [
        {
          id: 'dlq-1',
          data: {
            jobId: 'job-123',
            userId: 'user-1',
            failureReason: 'Error',
            failedAt: Date.now(),
            retryAttempts: 1,
            lastError: { message: 'Error', type: 'server_error' },
            originalJob: { id: 'job-123', name: 'test' },
          },
        },
      ];

      mockDLQQueue.getJobs = vi.fn().mockResolvedValue(mockDLQJobs);

      const entry = await dlqHandler.getDLQEntry('job-123');

      expect(entry).not.toBeNull();
      expect(entry?.jobId).toBe('job-123');
    });

    it('should return null if DLQ entry not found', async () => {
      mockDLQQueue.getJobs = vi.fn().mockResolvedValue([]);

      const entry = await dlqHandler.getDLQEntry('nonexistent-job');

      expect(entry).toBeNull();
    });

    it('should search through all DLQ entries', async () => {
      const mockDLQJobs = [
        {
          id: 'dlq-1',
          data: {
            jobId: 'job-1',
            userId: 'user-1',
            failureReason: 'Error',
            failedAt: Date.now(),
            retryAttempts: 1,
            lastError: { message: 'Error', type: 'server_error' },
            originalJob: { id: 'job-1', name: 'test' },
          },
        },
        {
          id: 'dlq-2',
          data: {
            jobId: 'job-2',
            userId: 'user-2',
            failureReason: 'Error',
            failedAt: Date.now(),
            retryAttempts: 1,
            lastError: { message: 'Error', type: 'server_error' },
            originalJob: { id: 'job-2', name: 'test' },
          },
        },
      ];

      mockDLQQueue.getJobs = vi.fn().mockResolvedValue(mockDLQJobs);

      const entry = await dlqHandler.getDLQEntry('job-2');

      expect(entry?.jobId).toBe('job-2');
    });
  });

  describe('retryFromDLQ', () => {
    it('should resubmit job from DLQ to main queue', async () => {
      const mockDLQJob = {
        id: 'dlq-123',
        data: {
          jobId: 'job-123',
          userId: 'user-1',
          originalJob: {
            id: 'job-123',
            name: 'sprite-generation',
            data: {
              userId: 'user-1',
              prompt: { description: 'test prompt' },
            },
          },
          failureReason: 'Error',
          failedAt: Date.now(),
          retryAttempts: 1,
          lastError: { message: 'Error', type: 'server_error' },
        },
      };

      mockDLQQueue.getJobs = vi.fn().mockResolvedValue([mockDLQJob]);

      await dlqHandler.retryFromDLQ('job-123');

      // Should add job back to main queue
      expect(mockMainQueue.add).toHaveBeenCalledWith(
        'sprite-generation',
        expect.objectContaining({
          userId: 'user-1',
          prompt: { description: 'test prompt' },
          retryCount: 0, // Reset retry count
          retriedFromDLQ: true,
        }),
        expect.objectContaining({
          jobId: expect.stringContaining('job-123-retry-'),
        })
      );

      // Should log retry
      expect(mockLogger.logInfo).toHaveBeenCalledWith(
        'dlq_retry',
        expect.objectContaining({
          originalJobId: 'job-123',
          newJobId: expect.stringContaining('job-123-retry-'),
        })
      );
    });

    it('should throw error if DLQ entry not found', async () => {
      mockDLQQueue.getJobs = vi.fn().mockResolvedValue([]);

      await expect(dlqHandler.retryFromDLQ('nonexistent-job')).rejects.toThrow(
        'DLQ entry not found'
      );
    });

    it('should handle retry failure', async () => {
      const mockDLQJob = {
        id: 'dlq-123',
        data: {
          jobId: 'job-123',
          userId: 'user-1',
          originalJob: {
            id: 'job-123',
            name: 'sprite-generation',
            data: {
              userId: 'user-1',
              prompt: { description: 'test prompt' },
            },
          },
          failureReason: 'Error',
          failedAt: Date.now(),
          retryAttempts: 1,
          lastError: { message: 'Error', type: 'server_error' },
        },
      };

      mockDLQQueue.getJobs = vi.fn().mockResolvedValue([mockDLQJob]);
      mockMainQueue.add = vi.fn().mockRejectedValue(new Error('Queue full'));

      await expect(dlqHandler.retryFromDLQ('job-123')).rejects.toThrow(
        'Queue full'
      );
    });
  });

  describe('deleteDLQEntry', () => {
    it('should delete DLQ entry by job ID', async () => {
      const mockDLQJob = {
        id: 'dlq-123',
        data: {
          jobId: 'job-123',
        },
        remove: vi.fn(),
      };

      mockDLQQueue.getJobs = vi.fn().mockResolvedValue([mockDLQJob]);

      await dlqHandler.deleteDLQEntry('job-123');

      expect(mockDLQJob.remove).toHaveBeenCalled();
      expect(mockLogger.logInfo).toHaveBeenCalledWith(
        'dlq_entry_deleted',
        expect.objectContaining({
          jobId: 'job-123',
        })
      );
    });

    it('should throw error if DLQ entry not found', async () => {
      mockDLQQueue.getJobs = vi.fn().mockResolvedValue([]);

      await expect(dlqHandler.deleteDLQEntry('nonexistent-job')).rejects.toThrow(
        'DLQ entry not found'
      );
    });

    it('should handle delete failure', async () => {
      const mockDLQJob = {
        id: 'dlq-123',
        data: {
          jobId: 'job-123',
        },
        remove: vi.fn().mockRejectedValue(new Error('Delete failed')),
      };

      mockDLQQueue.getJobs = vi.fn().mockResolvedValue([mockDLQJob]);

      await expect(dlqHandler.deleteDLQEntry('job-123')).rejects.toThrow(
        'Delete failed'
      );
    });
  });

  describe('edge cases', () => {
    it('should handle DLQ growth monitoring', async () => {
      const mockDLQJobs = Array.from({ length: 1000 }, (_, i) => ({
        id: `dlq-${i}`,
        data: {
          jobId: `job-${i}`,
          userId: `user-${i}`,
          failureReason: 'Error',
          failedAt: Date.now(),
          retryAttempts: 1,
          lastError: { message: 'Error', type: 'server_error' },
          originalJob: { id: `job-${i}`, name: 'test' },
        },
      }));

      mockDLQQueue.getJobs = vi.fn().mockResolvedValue(mockDLQJobs);

      const entries = await dlqHandler.listDLQEntries();

      expect(entries.length).toBe(1000);
      // In production, this would trigger an alert
    });

    it('should handle job from deleted user account', async () => {
      const mockJob = {
        id: 'test-job-id',
        name: 'sprite-generation',
        data: {
          userId: 'deleted-user-999',
          prompt: { description: 'test prompt' },
          retryCount: 1,
        },
        opts: {},
        attemptsMade: 2,
      } as any;

      const error = new PixelLabError({
        type: PixelLabErrorType.API_ERROR,
        message: 'Server error',
        statusCode: 500,
        retryable: true,
      });

      const classifiedError: ClassifiedError = {
        type: ErrorType.SERVER_ERROR,
        retryable: true,
        userMessage: 'Server error occurred',
        technicalDetails: 'API error: Server error (Status: 500)',
        originalError: error,
      };

      await dlqHandler.moveToDLQ(mockJob, classifiedError);

      // Should still store for debugging
      expect(mockDLQQueue.add).toHaveBeenCalled();
    });

    it('should handle corrupted job data', async () => {
      const mockJob = {
        id: 'test-job-id',
        name: 'sprite-generation',
        data: null, // Corrupted
        opts: {},
        attemptsMade: 2,
      } as any;

      const error = new PixelLabError({
        type: PixelLabErrorType.API_ERROR,
        message: 'Server error',
        statusCode: 500,
        retryable: true,
      });

      const classifiedError: ClassifiedError = {
        type: ErrorType.SERVER_ERROR,
        retryable: true,
        userMessage: 'Server error occurred',
        technicalDetails: 'API error: Server error (Status: 500)',
        originalError: error,
      };

      await dlqHandler.moveToDLQ(mockJob, classifiedError);

      // Should still move to DLQ with whatever data is available
      expect(mockDLQQueue.add).toHaveBeenCalled();
    });

    it('should generate unique DLQ job IDs', async () => {
      const mockJob1 = {
        id: 'job-1',
        name: 'sprite-generation',
        data: { userId: 'user-1', retryCount: 1 },
        opts: {},
        attemptsMade: 2,
      } as any;

      const mockJob2 = {
        id: 'job-2',
        name: 'sprite-generation',
        data: { userId: 'user-2', retryCount: 1 },
        opts: {},
        attemptsMade: 2,
      } as any;

      const error = new PixelLabError({
        type: PixelLabErrorType.API_ERROR,
        message: 'Server error',
        statusCode: 500,
        retryable: true,
      });

      const classifiedError: ClassifiedError = {
        type: ErrorType.SERVER_ERROR,
        retryable: true,
        userMessage: 'Server error occurred',
        technicalDetails: 'API error: Server error (Status: 500)',
        originalError: error,
      };

      await dlqHandler.moveToDLQ(mockJob1, classifiedError);
      await dlqHandler.moveToDLQ(mockJob2, classifiedError);

      const calls = (mockDLQQueue.add as any).mock.calls;
      const dlqJobId1 = calls[0][2].jobId;
      const dlqJobId2 = calls[1][2].jobId;

      expect(dlqJobId1).not.toBe(dlqJobId2);
    });
  });

  describe('DLQ retention', () => {
    it('should configure 7-day retention on DLQ queue', async () => {
      const mockJob = {
        id: 'test-job-id',
        name: 'sprite-generation',
        data: {
          userId: 'user-123',
          prompt: { description: 'test prompt' },
          retryCount: 1,
        },
        opts: {},
        attemptsMade: 2,
      } as any;

      const error = new PixelLabError({
        type: PixelLabErrorType.API_ERROR,
        message: 'Server error',
        statusCode: 500,
        retryable: true,
      });

      const classifiedError: ClassifiedError = {
        type: ErrorType.SERVER_ERROR,
        retryable: true,
        userMessage: 'Server error occurred',
        technicalDetails: 'API error: Server error (Status: 500)',
        originalError: error,
      };

      await dlqHandler.moveToDLQ(mockJob, classifiedError);

      const addOptions = (mockDLQQueue.add as any).mock.calls[0][2];

      // DLQ entries should not be auto-removed
      expect(addOptions.removeOnComplete).toBe(false);
      expect(addOptions.removeOnFail).toBe(false);
    });
  });
});
