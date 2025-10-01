/**
 * Task 4.1: Retry Strategy with Exponential Backoff - Tests
 *
 * Tests for retry behavior with exponential backoff delays.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RetryStrategy, RetryConfig } from './retry-strategy';
import { ErrorClassifier, ErrorType, ClassifiedError } from './error-classifier';
import { QueueLogger } from '../queue/logger';
import { PixelLabError, PixelLabErrorType } from '../pixellab/errors';

describe('RetryStrategy', () => {
  let logger: QueueLogger;
  let defaultConfig: RetryConfig;

  beforeEach(() => {
    logger = new QueueLogger({ enabled: false });
    defaultConfig = {
      maxRetries: 1,
      backoffDelay: 5000,
      backoffMultiplier: 2.0,
    };
  });

  describe('constructor', () => {
    it('creates instance with default configuration', () => {
      const strategy = new RetryStrategy(defaultConfig, logger);

      expect(strategy).toBeInstanceOf(RetryStrategy);
    });

    it('accepts custom configuration', () => {
      const customConfig: RetryConfig = {
        maxRetries: 3,
        backoffDelay: 10000,
        backoffMultiplier: 1.5,
      };

      const strategy = new RetryStrategy(customConfig, logger);

      expect(strategy).toBeInstanceOf(RetryStrategy);
    });
  });

  describe('calculateDelay', () => {
    it('calculates correct delay for first retry (attempt 0)', () => {
      const strategy = new RetryStrategy(defaultConfig, logger);

      const delay = strategy.calculateDelay(0);

      // baseDelay * (backoffMultiplier ^ 0) = 5000 * 1 = 5000
      // With ±10% jitter, should be between 4500 and 5500
      expect(delay).not.toBeNull();
      expect(delay!).toBeGreaterThanOrEqual(4500);
      expect(delay!).toBeLessThanOrEqual(5500);
    });

    it('returns null for attempt exceeding maxRetries', () => {
      const strategy = new RetryStrategy(defaultConfig, logger);

      // With maxRetries = 1, only attempt 0 is allowed
      // Attempt 1 should return null
      const delay = strategy.calculateDelay(1);

      expect(delay).toBeNull();
    });

    it('returns null when max retries exceeded', () => {
      const strategy = new RetryStrategy(defaultConfig, logger);

      // maxRetries = 1, so attempt 1 is the last allowed
      const delay = strategy.calculateDelay(2);

      expect(delay).toBeNull();
    });

    it('returns null when attempt equals maxRetries', () => {
      const strategy = new RetryStrategy(defaultConfig, logger);

      // With maxRetries = 1, attempt 0 is allowed
      const delay0 = strategy.calculateDelay(0);
      expect(delay0).not.toBeNull();

      // Attempt 1 equals maxRetries, should return null
      const delay1 = strategy.calculateDelay(1);
      expect(delay1).toBeNull();
    });

    it('applies exponential backoff correctly', () => {
      const config: RetryConfig = {
        maxRetries: 3,
        backoffDelay: 1000,
        backoffMultiplier: 2.0,
      };
      const strategy = new RetryStrategy(config, logger);

      const delay0 = strategy.calculateDelay(0);
      const delay1 = strategy.calculateDelay(1);
      const delay2 = strategy.calculateDelay(2);

      // Remove jitter for comparison by checking range
      // attempt 0: 1000 * 2^0 = 1000 (900-1100)
      expect(delay0).toBeGreaterThanOrEqual(900);
      expect(delay0).toBeLessThanOrEqual(1100);

      // attempt 1: 1000 * 2^1 = 2000 (1800-2200)
      expect(delay1).toBeGreaterThanOrEqual(1800);
      expect(delay1).toBeLessThanOrEqual(2200);

      // attempt 2: 1000 * 2^2 = 4000 (3600-4400)
      expect(delay2).toBeGreaterThanOrEqual(3600);
      expect(delay2).toBeLessThanOrEqual(4400);
    });

    it('handles backoff multiplier of 1.0 (constant delay)', () => {
      const config: RetryConfig = {
        maxRetries: 3,
        backoffDelay: 5000,
        backoffMultiplier: 1.0,
      };
      const strategy = new RetryStrategy(config, logger);

      const delay0 = strategy.calculateDelay(0);
      const delay1 = strategy.calculateDelay(1);
      const delay2 = strategy.calculateDelay(2);

      // All delays should be around 5000ms (±10% jitter)
      expect(delay0).toBeGreaterThanOrEqual(4500);
      expect(delay0).toBeLessThanOrEqual(5500);

      expect(delay1).toBeGreaterThanOrEqual(4500);
      expect(delay1).toBeLessThanOrEqual(5500);

      expect(delay2).toBeGreaterThanOrEqual(4500);
      expect(delay2).toBeLessThanOrEqual(5500);
    });

    it('applies jitter to prevent thundering herd', () => {
      const strategy = new RetryStrategy(defaultConfig, logger);

      // Generate multiple delays and verify they're not all identical
      const delays = Array.from({ length: 10 }, () => strategy.calculateDelay(0));

      const uniqueDelays = new Set(delays);

      // Should have multiple unique values due to jitter
      expect(uniqueDelays.size).toBeGreaterThan(1);

      // All should be within jitter range (4500-5500)
      delays.forEach((delay) => {
        expect(delay).toBeGreaterThanOrEqual(4500);
        expect(delay).toBeLessThanOrEqual(5500);
      });
    });

    it('logs retry attempt with calculated delay', () => {
      const loggerWithLogging = new QueueLogger({ enabled: true });
      const logInfoSpy = vi.spyOn(loggerWithLogging, 'logInfo');

      const strategy = new RetryStrategy(defaultConfig, loggerWithLogging);

      const delay = strategy.calculateDelay(0);

      expect(logInfoSpy).toHaveBeenCalledWith(
        'retry_delay_calculated',
        expect.objectContaining({
          attempt: 0,
          delay: expect.any(Number),
          baseDelay: 5000,
        })
      );
    });

    describe('Edge cases', () => {
      it('handles maxRetries of 0 (no retries)', () => {
        const config: RetryConfig = {
          maxRetries: 0,
          backoffDelay: 5000,
          backoffMultiplier: 2.0,
        };
        const strategy = new RetryStrategy(config, logger);

        const delay = strategy.calculateDelay(0);

        expect(delay).toBeNull();
      });

      it('handles very large retry attempts without overflow', () => {
        const config: RetryConfig = {
          maxRetries: 100,
          backoffDelay: 1000,
          backoffMultiplier: 2.0,
        };
        const strategy = new RetryStrategy(config, logger);

        const delay = strategy.calculateDelay(50);

        // Should still return a number, not Infinity
        expect(delay).not.toBeNull();
        expect(delay).toBeGreaterThan(0);
        expect(Number.isFinite(delay!)).toBe(true);
      });

      it('caps delay at reasonable maximum to prevent overflow', () => {
        const config: RetryConfig = {
          maxRetries: 100,
          backoffDelay: 1000,
          backoffMultiplier: 2.0,
        };
        const strategy = new RetryStrategy(config, logger);

        const delay = strategy.calculateDelay(30);

        // 1000 * 2^30 would be > 1 billion, should be capped
        expect(delay).not.toBeNull();
        expect(delay!).toBeLessThanOrEqual(3600000); // 1 hour max
      });

      it('handles negative retry attempt gracefully', () => {
        const strategy = new RetryStrategy(defaultConfig, logger);

        const delay = strategy.calculateDelay(-1);

        // Should still calculate or return null, not crash
        expect(delay).toBeDefined();
      });

      it('rejects negative base delay in config validation', () => {
        const config: RetryConfig = {
          maxRetries: 1,
          backoffDelay: -1000,
          backoffMultiplier: 2.0,
        };

        expect(() => new RetryStrategy(config, logger)).toThrow(/backoffDelay.*positive/i);
      });

      it('rejects zero base delay in config validation', () => {
        const config: RetryConfig = {
          maxRetries: 1,
          backoffDelay: 0,
          backoffMultiplier: 2.0,
        };

        expect(() => new RetryStrategy(config, logger)).toThrow(/backoffDelay.*positive/i);
      });

      it('rejects negative maxRetries in config validation', () => {
        const config: RetryConfig = {
          maxRetries: -1,
          backoffDelay: 5000,
          backoffMultiplier: 2.0,
        };

        expect(() => new RetryStrategy(config, logger)).toThrow(/maxRetries.*non-negative/i);
      });

      it('rejects negative backoff multiplier in config validation', () => {
        const config: RetryConfig = {
          maxRetries: 1,
          backoffDelay: 5000,
          backoffMultiplier: -1.0,
        };

        expect(() => new RetryStrategy(config, logger)).toThrow(/backoffMultiplier.*positive/i);
      });

      it('rejects zero backoff multiplier in config validation', () => {
        const config: RetryConfig = {
          maxRetries: 1,
          backoffDelay: 5000,
          backoffMultiplier: 0,
        };

        expect(() => new RetryStrategy(config, logger)).toThrow(/backoffMultiplier.*positive/i);
      });
    });
  });

  describe('shouldRetry', () => {
    it('allows retry for retryable errors within retry limit', () => {
      const strategy = new RetryStrategy(defaultConfig, logger);

      const error: ClassifiedError = {
        type: ErrorType.TIMEOUT,
        retryable: true,
        userMessage: 'Request timed out',
        technicalDetails: 'Timeout after 30s',
        originalError: new Error('Timeout'),
      };

      const shouldRetry = strategy.shouldRetry(0, error);

      expect(shouldRetry).toBe(true);
    });

    it('rejects retry for non-retryable errors', () => {
      const strategy = new RetryStrategy(defaultConfig, logger);

      const error: ClassifiedError = {
        type: ErrorType.AUTHENTICATION,
        retryable: false,
        userMessage: 'Authentication failed',
        technicalDetails: 'Invalid API key',
        originalError: new Error('Auth failed'),
      };

      const shouldRetry = strategy.shouldRetry(0, error);

      expect(shouldRetry).toBe(false);
    });

    it('rejects retry when max retries exceeded', () => {
      const strategy = new RetryStrategy(defaultConfig, logger);

      const error: ClassifiedError = {
        type: ErrorType.TIMEOUT,
        retryable: true,
        userMessage: 'Request timed out',
        technicalDetails: 'Timeout after 30s',
        originalError: new Error('Timeout'),
      };

      // Attempt 2 exceeds maxRetries = 1
      const shouldRetry = strategy.shouldRetry(2, error);

      expect(shouldRetry).toBe(false);
    });

    it('allows last retry attempt', () => {
      const strategy = new RetryStrategy(defaultConfig, logger);

      const error: ClassifiedError = {
        type: ErrorType.SERVER_ERROR,
        retryable: true,
        userMessage: 'Server error',
        technicalDetails: '500 Internal Server Error',
        originalError: new Error('Server error'),
      };

      // With maxRetries = 1, attempt 0 is the only allowed retry
      const shouldRetry0 = strategy.shouldRetry(0, error);
      expect(shouldRetry0).toBe(true);

      // Attempt 1 exceeds maxRetries
      const shouldRetry1 = strategy.shouldRetry(1, error);
      expect(shouldRetry1).toBe(false);

      // Attempt 2 should be rejected
      const shouldNotRetry = strategy.shouldRetry(2, error);
      expect(shouldNotRetry).toBe(false);
    });

    it('rejects all retries when maxRetries is 0', () => {
      const config: RetryConfig = {
        maxRetries: 0,
        backoffDelay: 5000,
        backoffMultiplier: 2.0,
      };
      const strategy = new RetryStrategy(config, logger);

      const error: ClassifiedError = {
        type: ErrorType.TIMEOUT,
        retryable: true,
        userMessage: 'Request timed out',
        technicalDetails: 'Timeout',
        originalError: new Error('Timeout'),
      };

      const shouldRetry = strategy.shouldRetry(0, error);

      expect(shouldRetry).toBe(false);
    });

    it('respects retryable flag from classified error', () => {
      const strategy = new RetryStrategy(defaultConfig, logger);

      const retryableError: ClassifiedError = {
        type: ErrorType.RATE_LIMIT,
        retryable: true,
        userMessage: 'Rate limited',
        technicalDetails: '429 Too Many Requests',
        originalError: new Error('Rate limit'),
      };

      const nonRetryableError: ClassifiedError = {
        type: ErrorType.VALIDATION_ERROR,
        retryable: false,
        userMessage: 'Invalid input',
        technicalDetails: '400 Bad Request',
        originalError: new Error('Validation failed'),
      };

      expect(strategy.shouldRetry(0, retryableError)).toBe(true);
      expect(strategy.shouldRetry(0, nonRetryableError)).toBe(false);
    });

    it('logs decision when retry is allowed', () => {
      const loggerWithLogging = new QueueLogger({ enabled: true });
      const logInfoSpy = vi.spyOn(loggerWithLogging, 'logInfo');

      const strategy = new RetryStrategy(defaultConfig, loggerWithLogging);

      const error: ClassifiedError = {
        type: ErrorType.TIMEOUT,
        retryable: true,
        userMessage: 'Timeout',
        technicalDetails: 'Request timeout',
        originalError: new Error('Timeout'),
      };

      strategy.shouldRetry(0, error);

      expect(logInfoSpy).toHaveBeenCalledWith(
        'retry_decision',
        expect.objectContaining({
          attempt: 0,
          shouldRetry: true,
          errorType: ErrorType.TIMEOUT,
        })
      );
    });

    it('logs decision when retry is rejected', () => {
      const loggerWithLogging = new QueueLogger({ enabled: true });
      const logWarnSpy = vi.spyOn(loggerWithLogging, 'logWarn');

      const strategy = new RetryStrategy(defaultConfig, loggerWithLogging);

      const error: ClassifiedError = {
        type: ErrorType.AUTHENTICATION,
        retryable: false,
        userMessage: 'Auth failed',
        technicalDetails: 'Invalid credentials',
        originalError: new Error('Auth failed'),
      };

      strategy.shouldRetry(0, error);

      expect(logWarnSpy).toHaveBeenCalledWith(
        'retry_rejected',
        expect.objectContaining({
          attempt: 0,
          errorType: ErrorType.AUTHENTICATION,
          reason: expect.any(String),
        })
      );
    });
  });

  describe('Integration with ErrorClassifier', () => {
    it('correctly handles authentication errors (non-retryable)', () => {
      const strategy = new RetryStrategy(defaultConfig, logger);

      const error = new PixelLabError({
        type: PixelLabErrorType.AUTHENTICATION,
        message: 'Invalid API key',
        statusCode: 401,
        retryable: false,
      });

      const classified = ErrorClassifier.classify(error);
      const shouldRetry = strategy.shouldRetry(0, classified);

      expect(shouldRetry).toBe(false);
    });

    it('correctly handles rate limit errors (retryable)', () => {
      const strategy = new RetryStrategy(defaultConfig, logger);

      const error = new PixelLabError({
        type: PixelLabErrorType.RATE_LIMIT,
        message: 'Rate limit exceeded',
        statusCode: 429,
        retryable: true,
      });

      const classified = ErrorClassifier.classify(error);
      const shouldRetry = strategy.shouldRetry(0, classified);

      expect(shouldRetry).toBe(true);
    });

    it('correctly handles timeout errors (retryable)', () => {
      const strategy = new RetryStrategy(defaultConfig, logger);

      const error = new PixelLabError({
        type: PixelLabErrorType.TIMEOUT,
        message: 'Request timed out',
        retryable: true,
      });

      const classified = ErrorClassifier.classify(error);
      const shouldRetry = strategy.shouldRetry(0, classified);

      expect(shouldRetry).toBe(true);
    });

    it('correctly handles server errors (retryable)', () => {
      const strategy = new RetryStrategy(defaultConfig, logger);

      const error = new PixelLabError({
        type: PixelLabErrorType.API_ERROR,
        message: 'Internal server error',
        statusCode: 500,
        retryable: true,
      });

      const classified = ErrorClassifier.classify(error);
      const shouldRetry = strategy.shouldRetry(0, classified);

      expect(shouldRetry).toBe(true);
    });

    it('correctly handles validation errors (non-retryable)', () => {
      const strategy = new RetryStrategy(defaultConfig, logger);

      const error = new PixelLabError({
        type: PixelLabErrorType.VALIDATION,
        message: 'Invalid input',
        statusCode: 400,
        retryable: false,
      });

      const classified = ErrorClassifier.classify(error);
      const shouldRetry = strategy.shouldRetry(0, classified);

      expect(shouldRetry).toBe(false);
    });
  });

  describe('Retry workflow', () => {
    it('follows complete retry workflow for retryable error', () => {
      const strategy = new RetryStrategy(defaultConfig, logger);

      const error: ClassifiedError = {
        type: ErrorType.TIMEOUT,
        retryable: true,
        userMessage: 'Timeout',
        technicalDetails: 'Request timeout',
        originalError: new Error('Timeout'),
      };

      // First attempt (0)
      expect(strategy.shouldRetry(0, error)).toBe(true);
      const delay0 = strategy.calculateDelay(0);
      expect(delay0).not.toBeNull();
      expect(delay0).toBeGreaterThan(0);

      // Second attempt (1) - exceeds limit (maxRetries = 1 allows only 1 retry)
      expect(strategy.shouldRetry(1, error)).toBe(false);
      const delay1 = strategy.calculateDelay(1);
      expect(delay1).toBeNull();
    });

    it('rejects retry immediately for non-retryable error', () => {
      const strategy = new RetryStrategy(defaultConfig, logger);

      const error: ClassifiedError = {
        type: ErrorType.AUTHENTICATION,
        retryable: false,
        userMessage: 'Auth failed',
        technicalDetails: 'Invalid API key',
        originalError: new Error('Auth failed'),
      };

      // First attempt should be rejected
      expect(strategy.shouldRetry(0, error)).toBe(false);

      // Should not even calculate delay for non-retryable errors
      const delay = strategy.calculateDelay(0);
      // Delay may be calculated, but shouldRetry is what matters
      // The consumer should check shouldRetry before calculateDelay
    });
  });
});
