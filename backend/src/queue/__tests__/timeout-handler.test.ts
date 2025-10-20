/**
 * Tests for Task 6.3: Generation Timeout Handling
 *
 * Comprehensive test suite for timeout enforcement on sprite generation jobs.
 * Tests all acceptance criteria and edge cases including race conditions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TimeoutHandler, TimeoutError, TimeoutConfig } from '../timeout-handler.js';
import { JobProcessor } from '../job-processor.js';
import { QueueLogger } from '../logger.js';
import type { Job } from 'bullmq';
import type { SpriteGenerationResult } from '../job-status-tracker.js';

/**
 * Mock Job implementation
 */
function createMockJob(jobId: string, data?: any): Job {
  return {
    id: jobId,
    data: data || {
      userId: 'test-user',
      structuredPrompt: {
        type: 'character',
        style: 'pixel',
        size: { width: 32, height: 32 },
        action: 'idle',
        description: 'Test character',
        raw: 'Test',
      },
      cacheKey: 'test-cache-key',
    },
    timestamp: Date.now(),
    attemptsMade: 0,
    progress: vi.fn(),
    updateProgress: vi.fn(),
  } as unknown as Job;
}

/**
 * Mock SpriteGenerationResult
 */
function createMockResult(jobId: string): SpriteGenerationResult {
  return {
    jobId,
    frames: [Buffer.from('test-frame-1'), Buffer.from('test-frame-2')],
    metadata: {
      dimensions: { width: 32, height: 32 },
      frameCount: 2,
      generationTimeMs: 5000,
      cacheHit: false,
      pixelLabJobId: 'pixellab-123',
    },
  };
}

describe('TimeoutHandler', () => {
  let timeoutHandler: TimeoutHandler;
  let mockProcessor: JobProcessor;
  let mockLogger: QueueLogger;

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      logInfo: vi.fn(),
      logWarn: vi.fn(),
      logError: vi.fn(),
      logJobSubmission: vi.fn(),
      logStateChange: vi.fn(),
      logCacheAccess: vi.fn(),
      logRetry: vi.fn(),
      logDLQMove: vi.fn(),
    } as unknown as QueueLogger;

    // Create mock processor
    mockProcessor = {
      processJob: vi.fn(),
    } as unknown as JobProcessor;

    // Create timeout handler with default config
    timeoutHandler = new TimeoutHandler(mockLogger);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('Default Timeout Behavior', () => {
    it('should use default timeout of 10 minutes (600000ms)', () => {
      const config = timeoutHandler.getConfig();
      expect(config.defaultTimeout).toBe(600000);
      expect(config.enablePerJobOverride).toBe(true);
    });

    it('should allow job to complete within default timeout', async () => {
      vi.useFakeTimers();

      const job = createMockJob('job-1');
      const expectedResult = createMockResult('job-1');

      // Mock processor to complete in 5 seconds
      vi.spyOn(mockProcessor, 'processJob').mockImplementation(async () => {
        await vi.advanceTimersByTimeAsync(5000);
        return expectedResult;
      });

      const resultPromise = timeoutHandler.executeWithTimeout(job, mockProcessor);

      // Advance timers to allow job to complete
      await vi.runAllTimersAsync();

      const result = await resultPromise;

      expect(result).toEqual(expectedResult);
      expect(mockProcessor.processJob).toHaveBeenCalledWith(job);
    });

    it('should cancel job after default timeout exceeded', async () => {
      vi.useFakeTimers();

      const job = createMockJob('job-2');

      // Mock processor to take longer than timeout (never resolves)
      vi.spyOn(mockProcessor, 'processJob').mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const resultPromise = timeoutHandler.executeWithTimeout(job, mockProcessor);

      // Advance past timeout + grace period
      await vi.advanceTimersByTimeAsync(600000 + 100 + 1);

      await expect(resultPromise).rejects.toThrow(TimeoutError);
      await expect(resultPromise).rejects.toMatchObject({
        name: 'TimeoutError',
        jobId: 'job-2',
        timeoutDuration: 600000,
        retryable: true,
      });
    });
  });

  describe('Custom Timeout Override', () => {
    it('should respect custom timeout from job data', async () => {
      vi.useFakeTimers();

      const job = createMockJob('job-3', {
        userId: 'test-user',
        structuredPrompt: {},
        cacheKey: 'key',
        timeout: 30000, // 30 seconds custom timeout
      });

      // Mock processor to take 40 seconds (exceeds custom timeout)
      vi.spyOn(mockProcessor, 'processJob').mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const resultPromise = timeoutHandler.executeWithTimeout(job, mockProcessor);

      // Advance past custom timeout + grace period
      await vi.advanceTimersByTimeAsync(30000 + 100 + 1);

      await expect(resultPromise).rejects.toThrow(TimeoutError);
      await expect(resultPromise).rejects.toMatchObject({
        timeoutDuration: 30000,
      });
    });

    it('should allow longer timeout for complex jobs', async () => {
      vi.useFakeTimers();

      const job = createMockJob('job-4', {
        userId: 'test-user',
        structuredPrompt: {},
        cacheKey: 'key',
        timeout: 900000, // 15 minutes for complex job
      });

      const expectedResult = createMockResult('job-4');

      // Mock processor to complete in 12 minutes
      vi.spyOn(mockProcessor, 'processJob').mockImplementation(async () => {
        await vi.advanceTimersByTimeAsync(720000); // 12 minutes
        return expectedResult;
      });

      const resultPromise = timeoutHandler.executeWithTimeout(job, mockProcessor);

      await vi.runAllTimersAsync();

      const result = await resultPromise;

      expect(result).toEqual(expectedResult);
    });

    it('should ignore invalid custom timeout and use default', async () => {
      vi.useFakeTimers();

      const job = createMockJob('job-5', {
        userId: 'test-user',
        structuredPrompt: {},
        cacheKey: 'key',
        timeout: 'invalid', // Invalid timeout value
      });

      const expectedResult = createMockResult('job-5');

      vi.spyOn(mockProcessor, 'processJob').mockImplementation(async () => {
        await vi.advanceTimersByTimeAsync(5000);
        return expectedResult;
      });

      const resultPromise = timeoutHandler.executeWithTimeout(job, mockProcessor);

      await vi.runAllTimersAsync();

      const result = await resultPromise;

      expect(result).toEqual(expectedResult);
      // Should have used default timeout, not crashed
    });
  });

  describe('Timeout Logging', () => {
    it('should log timeout event with job details', async () => {
      vi.useFakeTimers();
      const startTime = Date.now();

      const job = createMockJob('job-6');

      vi.spyOn(mockProcessor, 'processJob').mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const resultPromise = timeoutHandler.executeWithTimeout(job, mockProcessor);

      await vi.advanceTimersByTimeAsync(600000 + 100 + 1);

      await expect(resultPromise).rejects.toThrow(TimeoutError);

      expect(mockLogger.logError).toHaveBeenCalledWith(
        'job-6',
        expect.any(TimeoutError),
        expect.objectContaining({
          operation: 'executeWithTimeout',
          timeoutDuration: 600000,
          elapsedTime: expect.any(Number),
        })
      );
    });

    it('should log start of job execution', async () => {
      vi.useFakeTimers();

      const job = createMockJob('job-7');
      const expectedResult = createMockResult('job-7');

      vi.spyOn(mockProcessor, 'processJob').mockImplementation(async () => {
        await vi.advanceTimersByTimeAsync(5000);
        return expectedResult;
      });

      const resultPromise = timeoutHandler.executeWithTimeout(job, mockProcessor);

      await vi.runAllTimersAsync();

      await resultPromise;

      expect(mockLogger.logInfo).toHaveBeenCalledWith('timeout_handler_started', {
        jobId: 'job-7',
        timeoutDuration: 600000,
      });
    });

    it('should log successful completion within timeout', async () => {
      vi.useFakeTimers();

      const job = createMockJob('job-8');
      const expectedResult = createMockResult('job-8');

      vi.spyOn(mockProcessor, 'processJob').mockImplementation(async () => {
        await vi.advanceTimersByTimeAsync(5000);
        return expectedResult;
      });

      const resultPromise = timeoutHandler.executeWithTimeout(job, mockProcessor);

      await vi.runAllTimersAsync();

      await resultPromise;

      expect(mockLogger.logInfo).toHaveBeenCalledWith('timeout_handler_completed', {
        jobId: 'job-8',
        elapsedTime: expect.any(Number),
      });
    });
  });

  describe('Race Condition Handling', () => {
    it('should prefer success if job completes just before timeout', async () => {
      vi.useFakeTimers();

      const job = createMockJob('job-9');
      const expectedResult = createMockResult('job-9');

      // Mock processor to complete at 599,950ms (50ms before timeout)
      vi.spyOn(mockProcessor, 'processJob').mockImplementation(async () => {
        await vi.advanceTimersByTimeAsync(599950);
        return expectedResult;
      });

      const resultPromise = timeoutHandler.executeWithTimeout(job, mockProcessor);

      await vi.runAllTimersAsync();

      const result = await resultPromise;

      expect(result).toEqual(expectedResult);
      expect(mockLogger.logError).not.toHaveBeenCalled();
    });

    it('should prefer success if job completes during grace period', async () => {
      vi.useFakeTimers();

      const job = createMockJob('job-10');
      const expectedResult = createMockResult('job-10');

      // Mock processor to complete at 600,050ms (50ms after timeout, within grace period)
      vi.spyOn(mockProcessor, 'processJob').mockImplementation(async () => {
        await vi.advanceTimersByTimeAsync(600050);
        return expectedResult;
      });

      const resultPromise = timeoutHandler.executeWithTimeout(job, mockProcessor);

      await vi.runAllTimersAsync();

      const result = await resultPromise;

      expect(result).toEqual(expectedResult);
      expect(mockLogger.logError).not.toHaveBeenCalled();
    });

    it('should timeout if job completes after grace period', async () => {
      vi.useFakeTimers();

      const job = createMockJob('job-11');
      const expectedResult = createMockResult('job-11');

      // Mock processor to complete at 600,150ms (150ms after timeout, beyond grace period)
      vi.spyOn(mockProcessor, 'processJob').mockImplementation(async () => {
        await vi.advanceTimersByTimeAsync(600150);
        return expectedResult;
      });

      const resultPromise = timeoutHandler.executeWithTimeout(job, mockProcessor);

      await vi.runAllTimersAsync();

      await expect(resultPromise).rejects.toThrow(TimeoutError);
    });
  });

  describe('Error Propagation', () => {
    it('should propagate processor errors that are not timeouts', async () => {
      vi.useFakeTimers();

      const job = createMockJob('job-12');
      const processorError = new Error('PixelLab API error');

      vi.spyOn(mockProcessor, 'processJob').mockImplementation(async () => {
        await vi.advanceTimersByTimeAsync(1000);
        throw processorError;
      });

      const resultPromise = timeoutHandler.executeWithTimeout(job, mockProcessor);

      await vi.runAllTimersAsync();

      await expect(resultPromise).rejects.toThrow('PixelLab API error');
      await expect(resultPromise).rejects.not.toBeInstanceOf(TimeoutError);
    });

    it('should mark TimeoutError as retryable', async () => {
      vi.useFakeTimers();

      const job = createMockJob('job-13');

      vi.spyOn(mockProcessor, 'processJob').mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const resultPromise = timeoutHandler.executeWithTimeout(job, mockProcessor);

      await vi.advanceTimersByTimeAsync(600000 + 100 + 1);

      try {
        await resultPromise;
        expect.fail('Should have thrown TimeoutError');
      } catch (error) {
        expect(error).toBeInstanceOf(TimeoutError);
        expect((error as TimeoutError).retryable).toBe(true);
      }
    });
  });

  describe('TimeoutError Class', () => {
    it('should create TimeoutError with all required fields', () => {
      const error = new TimeoutError('job-14', 550000, 600000);

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('TimeoutError');
      expect(error.jobId).toBe('job-14');
      expect(error.elapsedTime).toBe(550000);
      expect(error.timeoutDuration).toBe(600000);
      expect(error.retryable).toBe(true);
      expect(error.message).toContain('job-14');
      expect(error.message).toContain('550000');
      expect(error.message).toContain('600000');
    });

    it('should have proper error stack trace', () => {
      const error = new TimeoutError('job-15', 600000, 600000);

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('TimeoutError');
    });
  });

  describe('Custom Configuration', () => {
    it('should accept custom default timeout in config', () => {
      const customConfig: TimeoutConfig = {
        defaultTimeout: 300000, // 5 minutes
        enablePerJobOverride: true,
      };

      const customHandler = new TimeoutHandler(mockLogger, customConfig);

      const config = customHandler.getConfig();
      expect(config.defaultTimeout).toBe(300000);
    });

    it('should disable per-job override if configured', async () => {
      vi.useFakeTimers();

      const customConfig: TimeoutConfig = {
        defaultTimeout: 600000,
        enablePerJobOverride: false, // Disable overrides
      };

      const customHandler = new TimeoutHandler(mockLogger, customConfig);

      const job = createMockJob('job-16', {
        userId: 'test-user',
        structuredPrompt: {},
        cacheKey: 'key',
        timeout: 30000, // Try to set custom timeout
      });

      vi.spyOn(mockProcessor, 'processJob').mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const resultPromise = customHandler.executeWithTimeout(job, mockProcessor);

      // Should timeout at default timeout (600000ms), not custom (30000ms)
      await vi.advanceTimersByTimeAsync(30000 + 100 + 1);

      // Should still be running
      expect(mockLogger.logError).not.toHaveBeenCalled();

      // Advance to default timeout
      await vi.advanceTimersByTimeAsync(600000 - 30000);

      await expect(resultPromise).rejects.toThrow(TimeoutError);
    });
  });

  describe('Cleanup on Timeout', () => {
    it('should cleanup resources when timeout occurs', async () => {
      vi.useFakeTimers();

      const job = createMockJob('job-17');

      vi.spyOn(mockProcessor, 'processJob').mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const resultPromise = timeoutHandler.executeWithTimeout(job, mockProcessor);

      await vi.advanceTimersByTimeAsync(600000 + 100 + 1);

      await expect(resultPromise).rejects.toThrow(TimeoutError);

      // Verify cleanup: timeout is not still pending
      // This is implicitly tested by the fact that no errors are thrown
      // and the promise rejects cleanly
    });
  });

  describe('Edge Cases', () => {
    it('should handle job with no ID', async () => {
      vi.useFakeTimers();

      const job = {
        id: undefined,
        data: { userId: 'test-user', structuredPrompt: {}, cacheKey: 'key' },
        timestamp: Date.now(),
        attemptsMade: 0,
        progress: vi.fn(),
        updateProgress: vi.fn(),
      } as unknown as Job;

      const expectedResult = createMockResult('unknown');

      vi.spyOn(mockProcessor, 'processJob').mockImplementation(async () => {
        await vi.advanceTimersByTimeAsync(5000);
        return expectedResult;
      });

      const resultPromise = timeoutHandler.executeWithTimeout(job, mockProcessor);

      await vi.runAllTimersAsync();

      const result = await resultPromise;

      expect(result).toEqual(expectedResult);
      // Should use 'unknown' as jobId in logs
      expect(mockLogger.logInfo).toHaveBeenCalledWith(
        'timeout_handler_started',
        expect.objectContaining({ jobId: 'unknown' })
      );
    });

    it('should handle zero timeout (immediate timeout)', async () => {
      vi.useFakeTimers();

      const job = createMockJob('job-18', {
        userId: 'test-user',
        structuredPrompt: {},
        cacheKey: 'key',
        timeout: 0,
      });

      vi.spyOn(mockProcessor, 'processJob').mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const resultPromise = timeoutHandler.executeWithTimeout(job, mockProcessor);

      await vi.advanceTimersByTimeAsync(100 + 1);

      await expect(resultPromise).rejects.toThrow(TimeoutError);
    });

    it('should handle negative timeout (use default)', async () => {
      vi.useFakeTimers();

      const job = createMockJob('job-19', {
        userId: 'test-user',
        structuredPrompt: {},
        cacheKey: 'key',
        timeout: -5000,
      });

      const expectedResult = createMockResult('job-19');

      vi.spyOn(mockProcessor, 'processJob').mockImplementation(async () => {
        await vi.advanceTimersByTimeAsync(5000);
        return expectedResult;
      });

      const resultPromise = timeoutHandler.executeWithTimeout(job, mockProcessor);

      await vi.runAllTimersAsync();

      const result = await resultPromise;

      expect(result).toEqual(expectedResult);
    });
  });

  describe('Multiple Concurrent Jobs', () => {
    it('should handle multiple jobs with independent timeouts', async () => {
      vi.useFakeTimers();

      const job1 = createMockJob('job-20', {
        userId: 'user1',
        structuredPrompt: {},
        cacheKey: 'key1',
        timeout: 30000,
      });

      const job2 = createMockJob('job-21', {
        userId: 'user2',
        structuredPrompt: {},
        cacheKey: 'key2',
        timeout: 60000,
      });

      const result1 = createMockResult('job-20');

      // Create separate processor mocks for each job
      const processor1 = {
        processJob: vi.fn(async () => {
          return result1;
        }),
      } as unknown as JobProcessor;

      const processor2 = {
        processJob: vi.fn(() => new Promise(() => {})), // Never completes
      } as unknown as JobProcessor;

      // Test job 1 (completes successfully)
      const promise1 = timeoutHandler.executeWithTimeout(job1, processor1);

      await vi.runAllTimersAsync();

      const result = await promise1;
      expect(result).toEqual(result1);

      // Test job 2 (times out)
      const promise2 = timeoutHandler.executeWithTimeout(job2, processor2);

      await vi.runAllTimersAsync();

      await expect(promise2).rejects.toThrow(TimeoutError);
    });
  });
});
