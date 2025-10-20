import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RetryStrategy, RetryConfig } from '../retry-strategy';
import { PixelLabError, PixelLabErrorType } from '../errors';

describe('Retry Strategy - Task 7.2: Retry Strategy', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('retryable errors', () => {
    it('should retry 500 error up to max attempts', async () => {
      let attempts = 0;

      const operation = async () => {
        attempts++;
        throw new PixelLabError({
          type: PixelLabErrorType.API_ERROR,
          message: 'Server error',
          statusCode: 500,
          retryable: true,
        });
      };

      const config: RetryConfig = {
        maxAttempts: 3,
        initialDelay: 100,
      };

      const promise = RetryStrategy.executeWithRetry(operation, config);

      // Advance through retries
      await vi.advanceTimersByTimeAsync(100); // 1st retry
      await vi.advanceTimersByTimeAsync(200); // 2nd retry (exponential)
      await vi.advanceTimersByTimeAsync(400); // 3rd retry

      await expect(promise).rejects.toThrow(PixelLabError);
      expect(attempts).toBe(3);
    });

    it('should succeed on 2nd attempt if request recovers', async () => {
      let attempts = 0;

      const operation = async () => {
        attempts++;
        if (attempts < 2) {
          throw new PixelLabError({
            type: PixelLabErrorType.NETWORK,
            message: 'Network error',
            retryable: true,
          });
        }
        return 'success';
      };

      const config: RetryConfig = {
        maxAttempts: 3,
        initialDelay: 100,
      };

      const promise = RetryStrategy.executeWithRetry(operation, config);

      await vi.advanceTimersByTimeAsync(100); // 1st retry

      const result = await promise;

      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });

    it('should use exponential backoff (1s, 2s, 4s)', async () => {
      const delays: number[] = [];
      let lastTime = Date.now();

      const operation = async () => {
        const currentTime = Date.now();
        if (delays.length > 0) {
          delays.push(currentTime - lastTime);
        }
        lastTime = currentTime;

        throw new PixelLabError({
          type: PixelLabErrorType.API_ERROR,
          message: 'Server error',
          retryable: true,
        });
      };

      const config: RetryConfig = {
        maxAttempts: 3,
        initialDelay: 1000,
        backoffMultiplier: 2,
      };

      const promise = RetryStrategy.executeWithRetry(operation, config);

      await vi.advanceTimersByTimeAsync(1000); // 1s
      await vi.advanceTimersByTimeAsync(2000); // 2s
      await vi.advanceTimersByTimeAsync(4000); // 4s

      await expect(promise).rejects.toThrow();

      expect(delays[0]).toBe(1000);
      expect(delays[1]).toBe(2000);
    });

    it('should retry timeout errors', async () => {
      let attempts = 0;

      const operation = async () => {
        attempts++;
        throw new PixelLabError({
          type: PixelLabErrorType.TIMEOUT,
          message: 'Request timeout',
          retryable: true,
        });
      };

      const config: RetryConfig = {
        maxAttempts: 2,
        initialDelay: 100,
      };

      const promise = RetryStrategy.executeWithRetry(operation, config);

      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(200);

      await expect(promise).rejects.toThrow();
      expect(attempts).toBe(2);
    });

    it('should retry network errors', async () => {
      let attempts = 0;

      const operation = async () => {
        attempts++;
        throw new PixelLabError({
          type: PixelLabErrorType.NETWORK,
          message: 'Network error',
          retryable: true,
        });
      };

      const promise = RetryStrategy.executeWithRetry(operation);

      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);

      await expect(promise).rejects.toThrow();
      expect(attempts).toBe(3); // default maxAttempts
    });
  });

  describe('non-retryable errors', () => {
    it('should not retry 401 auth error', async () => {
      let attempts = 0;

      const operation = async () => {
        attempts++;
        throw new PixelLabError({
          type: PixelLabErrorType.AUTHENTICATION,
          message: 'Invalid API key',
          statusCode: 401,
          retryable: false,
        });
      };

      await expect(RetryStrategy.executeWithRetry(operation)).rejects.toThrow(PixelLabError);
      expect(attempts).toBe(1); // No retries
    });

    it('should not retry validation errors', async () => {
      let attempts = 0;

      const operation = async () => {
        attempts++;
        throw new PixelLabError({
          type: PixelLabErrorType.VALIDATION,
          message: 'Validation failed',
          statusCode: 422,
          retryable: false,
        });
      };

      await expect(RetryStrategy.executeWithRetry(operation)).rejects.toThrow();
      expect(attempts).toBe(1);
    });

    it('should not retry invalid request errors', async () => {
      let attempts = 0;

      const operation = async () => {
        attempts++;
        throw new PixelLabError({
          type: PixelLabErrorType.INVALID_REQUEST,
          message: 'Invalid request',
          retryable: false,
        });
      };

      await expect(RetryStrategy.executeWithRetry(operation)).rejects.toThrow();
      expect(attempts).toBe(1);
    });

    it('should not retry quota exceeded errors', async () => {
      let attempts = 0;

      const operation = async () => {
        attempts++;
        throw new PixelLabError({
          type: PixelLabErrorType.QUOTA_EXCEEDED,
          message: 'Quota exceeded',
          statusCode: 402,
          retryable: false,
        });
      };

      await expect(RetryStrategy.executeWithRetry(operation)).rejects.toThrow();
      expect(attempts).toBe(1);
    });
  });

  describe('success cases', () => {
    it('should not retry on success', async () => {
      let attempts = 0;

      const operation = async () => {
        attempts++;
        return 'success';
      };

      const result = await RetryStrategy.executeWithRetry(operation);

      expect(result).toBe('success');
      expect(attempts).toBe(1);
    });

    it('should return result immediately on success', async () => {
      const operation = async () => {
        return { data: 'test' };
      };

      const result = await RetryStrategy.executeWithRetry(operation);

      expect(result).toEqual({ data: 'test' });
    });
  });

  describe('edge cases', () => {
    it('should handle max retries set to 0', async () => {
      let attempts = 0;

      const operation = async () => {
        attempts++;
        throw new PixelLabError({
          type: PixelLabErrorType.API_ERROR,
          message: 'Error',
          retryable: true,
        });
      };

      const config: RetryConfig = {
        maxAttempts: 0,
      };

      await expect(RetryStrategy.executeWithRetry(operation, config)).rejects.toThrow();
      expect(attempts).toBe(0); // No attempts at all
    });

    it('should succeed on final retry (max attempts - 1)', async () => {
      let attempts = 0;

      const operation = async () => {
        attempts++;
        if (attempts < 3) {
          throw new PixelLabError({
            type: PixelLabErrorType.API_ERROR,
            message: 'Error',
            retryable: true,
          });
        }
        return 'success';
      };

      const config: RetryConfig = {
        maxAttempts: 3,
        initialDelay: 100,
      };

      const promise = RetryStrategy.executeWithRetry(operation, config);

      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(200);

      const result = await promise;

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should handle non-PixelLabError exceptions', async () => {
      let attempts = 0;

      const operation = async () => {
        attempts++;
        throw new Error('Generic error');
      };

      await expect(RetryStrategy.executeWithRetry(operation)).rejects.toThrow('Generic error');
      expect(attempts).toBe(1); // Don't retry non-PixelLabError
    });

    it('should respect max delay cap', async () => {
      let attempts = 0;

      const operation = async () => {
        attempts++;
        throw new PixelLabError({
          type: PixelLabErrorType.API_ERROR,
          message: 'Error',
          retryable: true,
        });
      };

      const config: RetryConfig = {
        maxAttempts: 5,
        initialDelay: 1000,
        backoffMultiplier: 2,
        maxDelay: 3000, // Cap at 3s
      };

      const promise = RetryStrategy.executeWithRetry(operation, config);

      // Should use: 1s, 2s, 3s (capped), 3s (capped)
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(3000);
      await vi.advanceTimersByTimeAsync(3000);
      await vi.advanceTimersByTimeAsync(3000);

      await expect(promise).rejects.toThrow();
      expect(attempts).toBe(5);
    });
  });

  describe('configuration', () => {
    it('should use default config when not provided', async () => {
      let attempts = 0;

      const operation = async () => {
        attempts++;
        throw new PixelLabError({
          type: PixelLabErrorType.API_ERROR,
          message: 'Error',
          retryable: true,
        });
      };

      const promise = RetryStrategy.executeWithRetry(operation);

      // Default: 3 attempts, 1s initial delay
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);

      await expect(promise).rejects.toThrow();
      expect(attempts).toBe(3);
    });

    it('should use custom backoff multiplier', async () => {
      const delays: number[] = [];
      let lastTime = Date.now();

      const operation = async () => {
        const currentTime = Date.now();
        if (delays.length > 0) {
          delays.push(currentTime - lastTime);
        }
        lastTime = currentTime;

        throw new PixelLabError({
          type: PixelLabErrorType.API_ERROR,
          message: 'Error',
          retryable: true,
        });
      };

      const config: RetryConfig = {
        maxAttempts: 3,
        initialDelay: 100,
        backoffMultiplier: 3, // Triple each time
      };

      const promise = RetryStrategy.executeWithRetry(operation, config);

      await vi.advanceTimersByTimeAsync(100); // 100ms
      await vi.advanceTimersByTimeAsync(300); // 300ms (100 * 3)
      await vi.advanceTimersByTimeAsync(900); // 900ms (300 * 3)

      await expect(promise).rejects.toThrow();
    });
  });
});
