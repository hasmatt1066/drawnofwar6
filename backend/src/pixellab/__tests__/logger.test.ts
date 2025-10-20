import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Logger, LogLevel, LogEntry } from '../logger';

describe('Logger - Task 8.1: Structured Logging', () => {
  let consoleLogSpy: any;
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('constructor', () => {
    it('should create logger with default level INFO', () => {
      const logger = new Logger();

      expect(logger).toBeDefined();
      expect(logger.getLevel()).toBe(LogLevel.INFO);
    });

    it('should create logger with custom level', () => {
      const logger = new Logger({ level: LogLevel.DEBUG });

      expect(logger.getLevel()).toBe(LogLevel.DEBUG);
    });

    it('should create logger with logging disabled', () => {
      const logger = new Logger({ enabled: false });

      logger.info('test');

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('log level filtering', () => {
    it('should log at current level', () => {
      const logger = new Logger({ level: LogLevel.INFO });

      logger.info('info message');

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should log above current level', () => {
      const logger = new Logger({ level: LogLevel.INFO });

      logger.error('error message');

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should not log below current level', () => {
      const logger = new Logger({ level: LogLevel.INFO });

      logger.debug('debug message');

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should respect DEBUG level', () => {
      const logger = new Logger({ level: LogLevel.DEBUG });

      logger.debug('debug message');

      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('API request logging', () => {
    it('should log API request with all details', () => {
      const logger = new Logger({ level: LogLevel.DEBUG });

      logger.logApiRequest({
        method: 'POST',
        url: '/v1/characters',
        payloadSize: 245,
        timestamp: new Date('2025-01-01T00:00:00.000Z'),
      });

      expect(consoleLogSpy).toHaveBeenCalled();
      const logCall = JSON.parse(consoleLogSpy.mock.calls[0][0]);

      expect(logCall.level).toBe('debug');
      expect(logCall.type).toBe('api_request');
      expect(logCall.method).toBe('POST');
      expect(logCall.url).toBe('/v1/characters');
      expect(logCall.payloadSize).toBe(245);
    });

    it('should redact API key from headers', () => {
      const logger = new Logger({ level: LogLevel.DEBUG });

      logger.logApiRequest({
        method: 'GET',
        url: '/v1/characters/123',
        headers: {
          'Authorization': 'Bearer c1994b12-b97e-4b29-9991-180e3a0ebe55',
          'Content-Type': 'application/json',
        },
        timestamp: new Date(),
      });

      expect(consoleLogSpy).toHaveBeenCalled();
      const logCall = JSON.parse(consoleLogSpy.mock.calls[0][0]);

      expect(logCall.headers.Authorization).toBe('Bearer c199...be55');
      expect(logCall.headers['Content-Type']).toBe('application/json');
    });
  });

  describe('API response logging', () => {
    it('should log successful API response', () => {
      const logger = new Logger({ level: LogLevel.DEBUG });

      logger.logApiResponse({
        method: 'POST',
        url: '/v1/characters',
        statusCode: 200,
        duration: 1250,
        creditsUsed: 10,
        timestamp: new Date('2025-01-01T00:00:00.000Z'),
      });

      expect(consoleLogSpy).toHaveBeenCalled();
      const logCall = JSON.parse(consoleLogSpy.mock.calls[0][0]);

      expect(logCall.level).toBe('debug');
      expect(logCall.type).toBe('api_response');
      expect(logCall.statusCode).toBe(200);
      expect(logCall.duration).toBe(1250);
      expect(logCall.creditsUsed).toBe(10);
    });

    it('should log failed API response as warning', () => {
      const logger = new Logger({ level: LogLevel.INFO });

      logger.logApiResponse({
        method: 'POST',
        url: '/v1/characters',
        statusCode: 422,
        duration: 500,
        timestamp: new Date(),
      });

      expect(consoleWarnSpy).toHaveBeenCalled();
      const logCall = JSON.parse(consoleWarnSpy.mock.calls[0][0]);

      expect(logCall.level).toBe('warn');
      expect(logCall.statusCode).toBe(422);
    });

    it('should log slow requests as warning', () => {
      const logger = new Logger({ level: LogLevel.INFO });

      logger.logApiResponse({
        method: 'GET',
        url: '/v1/characters/123',
        statusCode: 200,
        duration: 185000, // Over 3 minutes
        timestamp: new Date(),
      });

      expect(consoleWarnSpy).toHaveBeenCalled();
    });
  });

  describe('error logging', () => {
    it('should log error with full context', () => {
      const logger = new Logger({ level: LogLevel.ERROR });

      const error = new Error('API request failed');
      logger.logError('Failed to create character', {
        error,
        context: {
          characterName: 'wizard',
          size: 48,
        },
      });

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logCall = JSON.parse(consoleErrorSpy.mock.calls[0][0]);

      expect(logCall.level).toBe('error');
      expect(logCall.message).toBe('Failed to create character');
      expect(logCall.error.message).toBe('API request failed');
      expect(logCall.context.characterName).toBe('wizard');
    });

    it('should redact sensitive data in error context', () => {
      const logger = new Logger({ level: LogLevel.ERROR });

      logger.logError('Authentication failed', {
        context: {
          apiKey: 'c1994b12-b97e-4b29-9991-180e3a0ebe55',
          userId: 'user-123',
        },
      });

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logCall = JSON.parse(consoleErrorSpy.mock.calls[0][0]);

      expect(logCall.context.apiKey).toBe('c199...be55');
    });
  });

  describe('JSON formatting', () => {
    it('should output valid JSON', () => {
      const logger = new Logger({ level: LogLevel.INFO });

      logger.info('test message');

      expect(consoleLogSpy).toHaveBeenCalled();
      const logOutput = consoleLogSpy.mock.calls[0][0];

      // Should parse without error
      const parsed = JSON.parse(logOutput);
      expect(parsed).toBeDefined();
    });

    it('should include timestamp in ISO format', () => {
      const logger = new Logger({ level: LogLevel.INFO });

      logger.info('test message');

      expect(consoleLogSpy).toHaveBeenCalled();
      const logCall = JSON.parse(consoleLogSpy.mock.calls[0][0]);

      expect(logCall.timestamp).toBeDefined();
      expect(() => new Date(logCall.timestamp)).not.toThrow();
    });
  });

  describe('data redaction', () => {
    it('should redact API key in nested objects', () => {
      const logger = new Logger({ level: LogLevel.DEBUG });

      logger.debug('Config loaded', {
        config: {
          apiKey: 'c1994b12-b97e-4b29-9991-180e3a0ebe55',
          baseURL: 'https://api.pixellab.ai',
        },
      });

      expect(consoleLogSpy).toHaveBeenCalled();
      const logCall = JSON.parse(consoleLogSpy.mock.calls[0][0]);

      expect(logCall.data.config.apiKey).toBe('c199...be55');
      expect(logCall.data.config.baseURL).toBe('https://api.pixellab.ai');
    });

    it('should handle objects without sensitive data', () => {
      const logger = new Logger({ level: LogLevel.INFO });

      logger.info('Character created', {
        characterId: '123',
        name: 'wizard',
      });

      expect(consoleLogSpy).toHaveBeenCalled();
      const logCall = JSON.parse(consoleLogSpy.mock.calls[0][0]);

      expect(logCall.data.characterId).toBe('123');
      expect(logCall.data.name).toBe('wizard');
    });
  });

  describe('disabled logging', () => {
    it('should not log anything when disabled', () => {
      const logger = new Logger({ enabled: false, level: LogLevel.DEBUG });

      logger.debug('debug');
      logger.info('info');
      logger.warn('warn');
      logger.error('error');

      expect(consoleLogSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should not log API requests when disabled', () => {
      const logger = new Logger({ enabled: false, level: LogLevel.DEBUG });

      logger.logApiRequest({
        method: 'POST',
        url: '/v1/characters',
        timestamp: new Date(),
      });

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('log level changes', () => {
    it('should allow changing log level at runtime', () => {
      const logger = new Logger({ level: LogLevel.INFO });

      logger.setLevel(LogLevel.DEBUG);

      expect(logger.getLevel()).toBe(LogLevel.DEBUG);
    });

    it('should respect new log level', () => {
      const logger = new Logger({ level: LogLevel.INFO });

      logger.debug('should not log');
      expect(consoleLogSpy).not.toHaveBeenCalled();

      logger.setLevel(LogLevel.DEBUG);

      logger.debug('should log now');
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });
});
