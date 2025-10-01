/**
 * Test Suite for Task 7.3: Structured Logging for Queue Events
 *
 * Tests comprehensive structured logging for all queue operations including:
 * - Job submissions, state changes, cache access
 * - Error logging with full context
 * - Retry attempts and DLQ moves
 * - JSON formatting and sensitive data redaction
 * - Edge cases (large data, circular references, logging failures)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { QueueLogger, redactSensitiveData, truncateForLogging } from './logger';

describe('QueueLogger - Task 7.3: Structured Logging', () => {
  let consoleLogSpy: any;
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create logger with default settings', () => {
      const logger = new QueueLogger();

      expect(logger).toBeDefined();
    });

    it('should create logger with custom correlation ID', () => {
      const logger = new QueueLogger({ correlationId: 'test-correlation-id' });

      logger.logJobSubmission('job-123', 'user-456', { description: 'test' });

      expect(consoleLogSpy).toHaveBeenCalled();
      const logEntry = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logEntry.correlationId).toBe('test-correlation-id');
    });

    it('should create logger with logging disabled', () => {
      const logger = new QueueLogger({ enabled: false });

      logger.logJobSubmission('job-123', 'user-456', { description: 'test' });

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('logJobSubmission', () => {
    it('should log job submission with all required fields', () => {
      const logger = new QueueLogger();
      const prompt = {
        description: 'cute wizard',
        size: 48,
        n_directions: 8,
      };

      logger.logJobSubmission('job-123', 'user-456', prompt);

      expect(consoleLogSpy).toHaveBeenCalled();
      const logEntry = JSON.parse(consoleLogSpy.mock.calls[0][0]);

      expect(logEntry.timestamp).toBeDefined();
      expect(logEntry.level).toBe('info');
      expect(logEntry.type).toBe('queue_job_submission');
      expect(logEntry.jobId).toBe('job-123');
      expect(logEntry.userId).toBe('user-456');
      expect(logEntry.prompt).toEqual(prompt);
    });

    it('should redact sensitive data in prompt', () => {
      const logger = new QueueLogger();
      const prompt = {
        description: 'test character',
        apiKey: 'secret-key-12345',
        userId: 'user-789',
      };

      logger.logJobSubmission('job-123', 'user-456', prompt);

      expect(consoleLogSpy).toHaveBeenCalled();
      const logEntry = JSON.parse(consoleLogSpy.mock.calls[0][0]);

      expect(logEntry.prompt.apiKey).toBe('secr...2345');
      expect(logEntry.prompt.description).toBe('test character');
    });

    it('should include correlation ID if provided', () => {
      const logger = new QueueLogger({ correlationId: 'corr-123' });

      logger.logJobSubmission('job-123', 'user-456', {});

      expect(consoleLogSpy).toHaveBeenCalled();
      const logEntry = JSON.parse(consoleLogSpy.mock.calls[0][0]);

      expect(logEntry.correlationId).toBe('corr-123');
    });

    it('should truncate very large prompt data', () => {
      const logger = new QueueLogger();
      const largePrompt = {
        description: 'a'.repeat(10000),
        size: 48,
      };

      logger.logJobSubmission('job-123', 'user-456', largePrompt);

      expect(consoleLogSpy).toHaveBeenCalled();
      const logEntry = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      const logString = JSON.stringify(logEntry);

      // Log should be truncated to reasonable size
      expect(logString.length).toBeLessThan(5000);
    });
  });

  describe('logStateChange', () => {
    it('should log state change with required fields', () => {
      const logger = new QueueLogger();

      logger.logStateChange('job-123', 'pending', 'processing');

      expect(consoleLogSpy).toHaveBeenCalled();
      const logEntry = JSON.parse(consoleLogSpy.mock.calls[0][0]);

      expect(logEntry.timestamp).toBeDefined();
      expect(logEntry.level).toBe('info');
      expect(logEntry.type).toBe('queue_state_change');
      expect(logEntry.jobId).toBe('job-123');
      expect(logEntry.fromState).toBe('pending');
      expect(logEntry.toState).toBe('processing');
    });

    it('should include optional metadata', () => {
      const logger = new QueueLogger();
      const metadata = {
        processingTime: 1500,
        attempts: 1,
      };

      logger.logStateChange('job-123', 'processing', 'completed', metadata);

      expect(consoleLogSpy).toHaveBeenCalled();
      const logEntry = JSON.parse(consoleLogSpy.mock.calls[0][0]);

      expect(logEntry.metadata).toEqual(metadata);
    });

    it('should log failed state change as warning', () => {
      const logger = new QueueLogger();

      logger.logStateChange('job-123', 'processing', 'failed');

      expect(consoleWarnSpy).toHaveBeenCalled();
      const logEntry = JSON.parse(consoleWarnSpy.mock.calls[0][0]);

      expect(logEntry.level).toBe('warn');
      expect(logEntry.toState).toBe('failed');
    });

    it('should redact sensitive data in metadata', () => {
      const logger = new QueueLogger();
      const metadata = {
        apiKey: 'secret-key-12345',
        duration: 1500,
      };

      logger.logStateChange('job-123', 'pending', 'processing', metadata);

      expect(consoleLogSpy).toHaveBeenCalled();
      const logEntry = JSON.parse(consoleLogSpy.mock.calls[0][0]);

      expect(logEntry.metadata.apiKey).toBe('secr...2345');
      expect(logEntry.metadata.duration).toBe(1500);
    });
  });

  describe('logCacheAccess', () => {
    it('should log cache hit', () => {
      const logger = new QueueLogger();

      logger.logCacheAccess('cache-key-123', true, 'user-456');

      expect(consoleLogSpy).toHaveBeenCalled();
      const logEntry = JSON.parse(consoleLogSpy.mock.calls[0][0]);

      expect(logEntry.timestamp).toBeDefined();
      expect(logEntry.level).toBe('debug');
      expect(logEntry.type).toBe('queue_cache_access');
      expect(logEntry.cacheKey).toBe('cache-key-123');
      expect(logEntry.hit).toBe(true);
      expect(logEntry.userId).toBe('user-456');
    });

    it('should log cache miss', () => {
      const logger = new QueueLogger();

      logger.logCacheAccess('cache-key-123', false, 'user-456');

      expect(consoleLogSpy).toHaveBeenCalled();
      const logEntry = JSON.parse(consoleLogSpy.mock.calls[0][0]);

      expect(logEntry.hit).toBe(false);
    });

    it('should not log if debug level disabled', () => {
      const logger = new QueueLogger({ logLevel: 'info' });

      logger.logCacheAccess('cache-key-123', true, 'user-456');

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('logError', () => {
    it('should log error with full context', () => {
      const logger = new QueueLogger();
      const error = new Error('Job processing failed');
      error.stack = 'Error: Job processing failed\n    at processJob (queue.ts:123:45)';
      const context = {
        jobId: 'job-123',
        userId: 'user-456',
        attempt: 2,
      };

      logger.logError('job-123', error, context);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logEntry = JSON.parse(consoleErrorSpy.mock.calls[0][0]);

      expect(logEntry.timestamp).toBeDefined();
      expect(logEntry.level).toBe('error');
      expect(logEntry.type).toBe('queue_error');
      expect(logEntry.jobId).toBe('job-123');
      expect(logEntry.error.message).toBe('Job processing failed');
      expect(logEntry.error.name).toBe('Error');
      expect(logEntry.error.stack).toContain('queue.ts:123:45');
      expect(logEntry.context).toEqual(context);
    });

    it('should redact sensitive data in error context', () => {
      const logger = new QueueLogger();
      const error = new Error('Auth failed');
      const context = {
        apiKey: 'secret-key-12345',
        userId: 'user-456',
        password: 'super-secret',
      };

      logger.logError('job-123', error, context);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logEntry = JSON.parse(consoleErrorSpy.mock.calls[0][0]);

      expect(logEntry.context.apiKey).toBe('secr...2345');
      expect(logEntry.context.password).toBe('supe...cret');
      expect(logEntry.context.userId).toBe('user-456');
    });

    it('should handle errors without stack trace', () => {
      const logger = new QueueLogger();
      const error = new Error('Simple error');
      delete error.stack;

      logger.logError('job-123', error, {});

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logEntry = JSON.parse(consoleErrorSpy.mock.calls[0][0]);

      expect(logEntry.error.message).toBe('Simple error');
      expect(logEntry.error.stack).toBeUndefined();
    });

    it('should truncate very large context objects', () => {
      const logger = new QueueLogger();
      const error = new Error('Test error');
      const largeContext = {
        data: 'x'.repeat(20000),
        jobId: 'job-123',
      };

      logger.logError('job-123', error, largeContext);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logEntry = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      const logString = JSON.stringify(logEntry);

      expect(logString.length).toBeLessThan(10000);
    });
  });

  describe('logRetry', () => {
    it('should log retry attempt', () => {
      const logger = new QueueLogger();

      logger.logRetry('job-123', 2, 'Timeout error');

      expect(consoleWarnSpy).toHaveBeenCalled();
      const logEntry = JSON.parse(consoleWarnSpy.mock.calls[0][0]);

      expect(logEntry.timestamp).toBeDefined();
      expect(logEntry.level).toBe('warn');
      expect(logEntry.type).toBe('queue_retry');
      expect(logEntry.jobId).toBe('job-123');
      expect(logEntry.attempt).toBe(2);
      expect(logEntry.reason).toBe('Timeout error');
    });

    it('should include correlation ID if provided', () => {
      const logger = new QueueLogger({ correlationId: 'corr-456' });

      logger.logRetry('job-123', 1, 'Network error');

      expect(consoleWarnSpy).toHaveBeenCalled();
      const logEntry = JSON.parse(consoleWarnSpy.mock.calls[0][0]);

      expect(logEntry.correlationId).toBe('corr-456');
    });
  });

  describe('logDLQMove', () => {
    it('should log DLQ move', () => {
      const logger = new QueueLogger();

      logger.logDLQMove('job-123', 'Max retries exceeded', 3);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logEntry = JSON.parse(consoleErrorSpy.mock.calls[0][0]);

      expect(logEntry.timestamp).toBeDefined();
      expect(logEntry.level).toBe('error');
      expect(logEntry.type).toBe('queue_dlq_move');
      expect(logEntry.jobId).toBe('job-123');
      expect(logEntry.reason).toBe('Max retries exceeded');
      expect(logEntry.retryCount).toBe(3);
    });

    it('should include correlation ID if provided', () => {
      const logger = new QueueLogger({ correlationId: 'corr-789' });

      logger.logDLQMove('job-123', 'Permanent failure', 5);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logEntry = JSON.parse(consoleErrorSpy.mock.calls[0][0]);

      expect(logEntry.correlationId).toBe('corr-789');
    });
  });

  describe('JSON formatting', () => {
    it('should output valid JSON for all log types', () => {
      const logger = new QueueLogger();

      logger.logJobSubmission('job-1', 'user-1', { description: 'test' });
      logger.logStateChange('job-2', 'pending', 'processing');
      logger.logCacheAccess('key-1', true, 'user-1');
      logger.logError('job-3', new Error('test'), {});
      logger.logRetry('job-4', 1, 'retry');
      logger.logDLQMove('job-5', 'dlq', 3);

      // All calls should produce valid JSON
      const allCalls = [
        ...consoleLogSpy.mock.calls,
        ...consoleWarnSpy.mock.calls,
        ...consoleErrorSpy.mock.calls,
      ];

      allCalls.forEach((call) => {
        expect(() => JSON.parse(call[0])).not.toThrow();
      });
    });

    it('should include ISO timestamp in all logs', () => {
      const logger = new QueueLogger();

      logger.logJobSubmission('job-1', 'user-1', {});

      const logEntry = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logEntry.timestamp).toBeDefined();
      expect(() => new Date(logEntry.timestamp)).not.toThrow();
      expect(logEntry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('edge cases', () => {
    it('should handle circular references in job data', () => {
      const logger = new QueueLogger();
      const circularData: any = { description: 'test' };
      circularData.self = circularData;

      // Should not throw
      expect(() => {
        logger.logJobSubmission('job-123', 'user-456', circularData);
      }).not.toThrow();

      expect(consoleLogSpy).toHaveBeenCalled();
      const logEntry = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logEntry.prompt.description).toBe('test');
    });

    it('should handle circular references in error context', () => {
      const logger = new QueueLogger();
      const error = new Error('test error');
      const circularContext: any = { jobId: 'job-123' };
      circularContext.self = circularContext;

      // Should not throw
      expect(() => {
        logger.logError('job-123', error, circularContext);
      }).not.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should handle logging when console.log fails', () => {
      consoleLogSpy.mockImplementation(() => {
        throw new Error('Console error');
      });

      const logger = new QueueLogger();

      // Should not throw - should handle logging failure gracefully
      expect(() => {
        logger.logJobSubmission('job-123', 'user-456', {});
      }).not.toThrow();
    });

    it('should handle null/undefined values gracefully', () => {
      const logger = new QueueLogger();

      logger.logJobSubmission('job-123', 'user-456', null as any);
      logger.logStateChange('job-123', 'pending', 'processing', undefined);

      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
    });

    it('should handle very deep nested objects', () => {
      const logger = new QueueLogger();
      let deepObj: any = { level: 0 };
      let current = deepObj;

      // Create 50 levels of nesting
      for (let i = 1; i < 50; i++) {
        current.nested = { level: i };
        current = current.nested;
      }

      // Should not throw or cause stack overflow
      expect(() => {
        logger.logJobSubmission('job-123', 'user-456', deepObj);
      }).not.toThrow();

      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('disabled logging', () => {
    it('should not log anything when disabled', () => {
      const logger = new QueueLogger({ enabled: false });

      logger.logJobSubmission('job-1', 'user-1', {});
      logger.logStateChange('job-2', 'pending', 'processing');
      logger.logCacheAccess('key-1', true, 'user-1');
      logger.logError('job-3', new Error('test'), {});
      logger.logRetry('job-4', 1, 'retry');
      logger.logDLQMove('job-5', 'dlq', 3);

      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });
});

describe('redactSensitiveData', () => {
  it('should redact known sensitive fields', () => {
    const data = {
      apiKey: 'secret-key-12345',
      api_key: 'another-secret-key',
      authorization: 'Bearer token-12345',
      password: 'super-secret-password',
      normalField: 'normal-value',
    };

    const redacted = redactSensitiveData(data);

    expect(redacted.apiKey).toBe('secr...2345');
    expect(redacted.api_key).toBe('anot...key');
    expect(redacted.authorization).toBe('Bear...2345');
    expect(redacted.password).toBe('supe...word');
    expect(redacted.normalField).toBe('normal-value');
  });

  it('should handle nested objects', () => {
    const data = {
      user: {
        id: 'user-123',
        apiKey: 'secret-key-12345',
        settings: {
          token: 'secret-token-67890',
        },
      },
    };

    const redacted = redactSensitiveData(data);

    expect(redacted.user.id).toBe('user-123');
    expect(redacted.user.apiKey).toBe('secr...2345');
    expect(redacted.user.settings.token).toBe('secr...7890');
  });

  it('should handle arrays', () => {
    const data = {
      items: [
        { id: 1, apiKey: 'key-1' },
        { id: 2, apiKey: 'key-2' },
      ],
    };

    const redacted = redactSensitiveData(data);

    expect(redacted.items[0].apiKey).toBe('key-...y-1');
    expect(redacted.items[1].apiKey).toBe('key-...y-2');
  });

  it('should handle null and undefined', () => {
    expect(redactSensitiveData(null)).toBeNull();
    expect(redactSensitiveData(undefined)).toBeUndefined();
  });

  it('should handle primitive values', () => {
    expect(redactSensitiveData('string')).toBe('string');
    expect(redactSensitiveData(123)).toBe(123);
    expect(redactSensitiveData(true)).toBe(true);
  });

  it('should redact short sensitive values', () => {
    const data = {
      apiKey: 'short',
    };

    const redacted = redactSensitiveData(data);

    expect(redacted.apiKey).toBe('***');
  });

  it('should handle Bearer tokens', () => {
    const data = {
      authorization: 'Bearer c1994b12-b97e-4b29-9991-180e3a0ebe55',
    };

    const redacted = redactSensitiveData(data);

    expect(redacted.authorization).toBe('Bearer c199...be55');
  });
});

describe('truncateForLogging', () => {
  it('should truncate string exceeding max length', () => {
    const longString = 'a'.repeat(2000);
    const truncated = truncateForLogging(longString, 1000);

    expect(truncated.length).toBeLessThanOrEqual(1050); // Some overhead for truncation marker
    expect(truncated).toContain('...[truncated]');
  });

  it('should not truncate short strings', () => {
    const shortString = 'hello world';
    const truncated = truncateForLogging(shortString, 1000);

    expect(truncated).toBe(shortString);
  });

  it('should truncate objects with large string values', () => {
    const obj = {
      description: 'a'.repeat(5000),
      size: 48,
    };

    const truncated = truncateForLogging(obj, 1000);
    const stringified = JSON.stringify(truncated);

    expect(stringified.length).toBeLessThan(2000);
    expect(truncated.description).toContain('...[truncated]');
    expect(truncated.size).toBe(48);
  });

  it('should handle nested objects', () => {
    const obj = {
      level1: {
        level2: {
          data: 'x'.repeat(5000),
        },
      },
    };

    const truncated = truncateForLogging(obj, 1000);

    expect(JSON.stringify(truncated).length).toBeLessThan(2000);
  });

  it('should handle arrays', () => {
    const arr = Array(1000).fill('long string data here');

    const truncated = truncateForLogging(arr, 500);

    expect(JSON.stringify(truncated).length).toBeLessThan(1000);
  });

  it('should handle circular references', () => {
    const circular: any = { name: 'test' };
    circular.self = circular;

    // Should not throw
    expect(() => truncateForLogging(circular, 1000)).not.toThrow();
  });

  it('should use default max length if not specified', () => {
    const longString = 'a'.repeat(10000);
    const truncated = truncateForLogging(longString);

    expect(truncated.length).toBeLessThan(10000);
  });

  it('should handle null and undefined', () => {
    expect(truncateForLogging(null)).toBeNull();
    expect(truncateForLogging(undefined)).toBeUndefined();
  });

  it('should preserve small objects unchanged', () => {
    const obj = {
      id: 'job-123',
      status: 'processing',
      size: 48,
    };

    const truncated = truncateForLogging(obj, 1000);

    expect(truncated).toEqual(obj);
  });
});
