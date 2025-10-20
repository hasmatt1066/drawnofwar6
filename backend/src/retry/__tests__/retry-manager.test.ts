/**
 * Tests for Task 4.2: Automatic Job Retry
 *
 * Tests the RetryManager which automatically retries failed jobs
 * according to the retry strategy.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Job, Queue } from 'bullmq';
import { RetryManager } from '../retry-manager';
import { RetryStrategy, RetryConfig } from '../retry-strategy';
import { ErrorClassifier, ClassifiedError, ErrorType } from '../error-classifier';
import { QueueLogger } from '../../queue/logger';
import { QueueManager, QueueServiceConfig } from '../../queue/queue-manager';
import { PixelLabError, PixelLabErrorType } from '../pixellab/errors';

describe('RetryManager', () => {
  let retryManager: RetryManager;
  let mockQueueManager: QueueManager;
  let mockQueue: Queue;
  let mockRetryStrategy: RetryStrategy;
  let mockLogger: QueueLogger;
  let mockJob: Job;

  const mockConfig: QueueServiceConfig = {
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

  beforeEach(() => {
    // Mock Queue
    mockQueue = {
      add: vi.fn(),
      getJob: vi.fn(),
      client: {
        set: vi.fn(),
        get: vi.fn(),
        del: vi.fn(),
      },
    } as any;

    // Mock QueueManager
    mockQueueManager = {
      getQueue: vi.fn().mockReturnValue(mockQueue),
    } as any;

    // Mock Logger
    mockLogger = {
      logInfo: vi.fn(),
      logWarn: vi.fn(),
      logError: vi.fn(),
      logRetry: vi.fn(),
    } as any;

    // Mock RetryStrategy
    const retryConfig: RetryConfig = {
      maxRetries: 1,
      backoffDelay: 5000,
      backoffMultiplier: 2.0,
    };
    mockRetryStrategy = new RetryStrategy(retryConfig, mockLogger);

    // Create RetryManager
    retryManager = new RetryManager(
      mockQueueManager,
      mockRetryStrategy,
      mockLogger
    );

    // Mock Job
    mockJob = {
      id: 'test-job-id',
      name: 'sprite-generation',
      data: {
        userId: 'user-123',
        prompt: { description: 'test prompt' },
        retryCount: 0,
      },
      opts: {},
      attemptsMade: 0,
      retry: vi.fn(),
      updateData: vi.fn(),
      moveToFailed: vi.fn(),
      log: vi.fn(),
    } as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('handleFailedJob', () => {
    it('should retry job on transient failure (500 error)', async () => {
      const error = new PixelLabError({
        type: PixelLabErrorType.API_ERROR,
        message: 'Server error',
        statusCode: 500,
        retryable: true,
      });

      mockJob.data.retryCount = 0;

      await retryManager.handleFailedJob(mockJob, error);

      // Should calculate delay and schedule retry
      expect(mockJob.updateData).toHaveBeenCalledWith(
        expect.objectContaining({
          retryCount: 1,
        })
      );
      expect(mockJob.retry).toHaveBeenCalled();
      expect(mockLogger.logRetry).toHaveBeenCalledWith(
        'test-job-id',
        1,
        expect.stringContaining('server_error')
      );
    });

    it('should not retry on non-retryable error (401 auth)', async () => {
      const error = new PixelLabError({
        type: PixelLabErrorType.AUTHENTICATION,
        message: 'Unauthorized',
        statusCode: 401,
        retryable: false,
      });

      mockJob.data.retryCount = 0;

      await retryManager.handleFailedJob(mockJob, error);

      // Should NOT retry
      expect(mockJob.retry).not.toHaveBeenCalled();
      expect(mockJob.updateData).not.toHaveBeenCalled();
      expect(mockLogger.logWarn).toHaveBeenCalledWith(
        'retry_rejected',
        expect.objectContaining({
          errorType: ErrorType.AUTHENTICATION,
        })
      );
    });

    it('should increment retry count', async () => {
      const error = new PixelLabError({
        type: PixelLabErrorType.API_ERROR,
        message: 'Server error',
        statusCode: 500,
        retryable: true,
      });

      mockJob.data.retryCount = 0;

      await retryManager.handleFailedJob(mockJob, error);

      expect(mockJob.updateData).toHaveBeenCalledWith(
        expect.objectContaining({
          retryCount: 1,
        })
      );
    });

    it('should schedule retry with calculated delay', async () => {
      const error = new PixelLabError({
        type: PixelLabErrorType.TIMEOUT,
        message: 'Timeout',
        retryable: true,
      });

      mockJob.data.retryCount = 0;

      await retryManager.handleFailedJob(mockJob, error);

      // Should call retry with delay (5000ms base delay for attempt 0)
      expect(mockJob.retry).toHaveBeenCalled();
      const retryCall = (mockJob.retry as any).mock.calls[0];
      const delay = retryCall[1]; // Second argument is delay
      expect(delay).toBeGreaterThanOrEqual(4500); // Allow for jitter (±10%)
      expect(delay).toBeLessThanOrEqual(5500);
    });

    it('should not retry after max retries exhausted', async () => {
      const error = new PixelLabError({
        type: PixelLabErrorType.API_ERROR,
        message: 'Server error',
        statusCode: 500,
        retryable: true,
      });

      mockJob.data.retryCount = 1; // Already at max retries (1)

      await retryManager.handleFailedJob(mockJob, error);

      // Should NOT retry
      expect(mockJob.retry).not.toHaveBeenCalled();
      expect(mockLogger.logWarn).toHaveBeenCalledWith(
        'retry_rejected',
        expect.objectContaining({
          reason: 'Max retries exceeded',
        })
      );
    });

    it('should handle network errors as retryable', async () => {
      const error = new PixelLabError({
        type: PixelLabErrorType.NETWORK,
        message: 'Network error',
        retryable: true,
      });

      mockJob.data.retryCount = 0;

      await retryManager.handleFailedJob(mockJob, error);

      expect(mockJob.retry).toHaveBeenCalled();
      expect(mockLogger.logRetry).toHaveBeenCalled();
    });

    it('should not retry validation errors', async () => {
      const error = new PixelLabError({
        type: PixelLabErrorType.VALIDATION,
        message: 'Invalid parameters',
        statusCode: 400,
        retryable: false,
      });

      mockJob.data.retryCount = 0;

      await retryManager.handleFailedJob(mockJob, error);

      expect(mockJob.retry).not.toHaveBeenCalled();
      expect(mockLogger.logWarn).toHaveBeenCalledWith(
        'retry_rejected',
        expect.objectContaining({
          errorType: ErrorType.VALIDATION_ERROR,
        })
      );
    });

    it('should handle generic errors by classifying them', async () => {
      // Create an error with error code (like Node.js network errors)
      const error = Object.assign(new Error('Connection timed out'), {
        code: 'ETIMEDOUT',
      });

      mockJob.data.retryCount = 0;

      await retryManager.handleFailedJob(mockJob, error);

      // Generic timeout error should be retryable
      expect(mockJob.retry).toHaveBeenCalled();
    });
  });

  describe('shouldRetry', () => {
    it('should return true for retryable error within retry limit', () => {
      const error = new PixelLabError({
        type: PixelLabErrorType.API_ERROR,
        message: 'Server error',
        statusCode: 500,
        retryable: true,
      });

      mockJob.data.retryCount = 0;

      const result = retryManager.shouldRetry(mockJob, error);

      expect(result).toBe(true);
    });

    it('should return false for non-retryable error', () => {
      const error = new PixelLabError({
        type: PixelLabErrorType.AUTHENTICATION,
        message: 'Unauthorized',
        statusCode: 401,
        retryable: false,
      });

      mockJob.data.retryCount = 0;

      const result = retryManager.shouldRetry(mockJob, error);

      expect(result).toBe(false);
    });

    it('should return false when max retries exceeded', () => {
      const error = new PixelLabError({
        type: PixelLabErrorType.API_ERROR,
        message: 'Server error',
        statusCode: 500,
        retryable: true,
      });

      mockJob.data.retryCount = 1; // At max retries

      const result = retryManager.shouldRetry(mockJob, error);

      expect(result).toBe(false);
    });
  });
});
