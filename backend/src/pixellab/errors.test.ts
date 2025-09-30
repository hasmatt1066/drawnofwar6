import { describe, it, expect } from 'vitest';
import { PixelLabError, PixelLabErrorType } from './errors';

describe('PixelLabError - Task 1.4: Custom Error Class', () => {
  describe('constructor', () => {
    it('should create error with all properties', () => {
      const originalError = new Error('Original error message');
      const error = new PixelLabError({
        type: PixelLabErrorType.API_ERROR,
        message: 'API request failed',
        statusCode: 500,
        retryable: true,
        originalError,
      });

      expect(error).toBeDefined();
      expect(error.type).toBe(PixelLabErrorType.API_ERROR);
      expect(error.message).toBe('API request failed');
      expect(error.statusCode).toBe(500);
      expect(error.retryable).toBe(true);
      expect(error.originalError).toBe(originalError);
    });

    it('should preserve stack trace', () => {
      const error = new PixelLabError({
        type: PixelLabErrorType.NETWORK,
        message: 'Network error',
        retryable: true,
      });

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('PixelLabError');
    });

    it('should work with instanceof checks', () => {
      const error = new PixelLabError({
        type: PixelLabErrorType.AUTHENTICATION,
        message: 'Auth failed',
        retryable: false,
      });

      expect(error instanceof PixelLabError).toBe(true);
      expect(error instanceof Error).toBe(true);
    });

    it('should serialize to JSON correctly', () => {
      const error = new PixelLabError({
        type: PixelLabErrorType.RATE_LIMIT,
        message: 'Rate limit exceeded',
        statusCode: 429,
        retryable: true,
      });

      const json = JSON.stringify(error);
      const parsed = JSON.parse(json);

      expect(parsed.type).toBe(PixelLabErrorType.RATE_LIMIT);
      expect(parsed.message).toBe('Rate limit exceeded');
      expect(parsed.statusCode).toBe(429);
      expect(parsed.retryable).toBe(true);
    });

    it('should handle VALIDATION error with field errors', () => {
      const error = new PixelLabError({
        type: PixelLabErrorType.VALIDATION,
        message: 'Validation failed',
        statusCode: 422,
        retryable: false,
        fieldErrors: [
          { field: 'description', constraint: 'required', value: '' },
          { field: 'size', constraint: 'minimum', value: 16 },
        ],
      });

      expect(error.fieldErrors).toHaveLength(2);
      expect(error.fieldErrors?.[0].field).toBe('description');
      expect(error.fieldErrors?.[1].field).toBe('size');
    });
  });

  describe('edge cases', () => {
    it('should handle error creation without original error', () => {
      const error = new PixelLabError({
        type: PixelLabErrorType.TIMEOUT,
        message: 'Request timed out',
        retryable: true,
      });

      expect(error.originalError).toBeUndefined();
    });

    it('should handle error type UNKNOWN', () => {
      const error = new PixelLabError({
        type: PixelLabErrorType.UNKNOWN,
        message: 'Something went wrong',
        retryable: false,
      });

      expect(error.type).toBe(PixelLabErrorType.UNKNOWN);
    });

    it('should handle error without status code', () => {
      const error = new PixelLabError({
        type: PixelLabErrorType.NETWORK,
        message: 'Network unreachable',
        retryable: true,
      });

      expect(error.statusCode).toBeUndefined();
    });

    it('should handle error with empty message', () => {
      const error = new PixelLabError({
        type: PixelLabErrorType.DATABASE,
        message: '',
        retryable: false,
      });

      expect(error.message).toBe('');
    });
  });

  describe('error types', () => {
    it('should support VALIDATION error type', () => {
      const error = new PixelLabError({
        type: PixelLabErrorType.VALIDATION,
        message: 'Validation failed',
        retryable: false,
      });

      expect(error.type).toBe(PixelLabErrorType.VALIDATION);
      expect(error.retryable).toBe(false);
    });

    it('should support PARAMETER error type', () => {
      const error = new PixelLabError({
        type: PixelLabErrorType.PARAMETER,
        message: 'Invalid parameter',
        retryable: false,
      });

      expect(error.type).toBe(PixelLabErrorType.PARAMETER);
      expect(error.retryable).toBe(false);
    });

    it('should support DATABASE error type', () => {
      const error = new PixelLabError({
        type: PixelLabErrorType.DATABASE,
        message: 'Database error',
        retryable: false,
      });

      expect(error.type).toBe(PixelLabErrorType.DATABASE);
      expect(error.retryable).toBe(false);
    });

    it('should support AUTHENTICATION error type', () => {
      const error = new PixelLabError({
        type: PixelLabErrorType.AUTHENTICATION,
        message: 'Invalid API key',
        retryable: false,
      });

      expect(error.type).toBe(PixelLabErrorType.AUTHENTICATION);
      expect(error.retryable).toBe(false);
    });

    it('should support RATE_LIMIT error type', () => {
      const error = new PixelLabError({
        type: PixelLabErrorType.RATE_LIMIT,
        message: 'Rate limit exceeded',
        retryable: true,
      });

      expect(error.type).toBe(PixelLabErrorType.RATE_LIMIT);
      expect(error.retryable).toBe(true);
    });

    it('should support API_ERROR error type', () => {
      const error = new PixelLabError({
        type: PixelLabErrorType.API_ERROR,
        message: 'Internal server error',
        retryable: true,
      });

      expect(error.type).toBe(PixelLabErrorType.API_ERROR);
      expect(error.retryable).toBe(true);
    });
  });
});
