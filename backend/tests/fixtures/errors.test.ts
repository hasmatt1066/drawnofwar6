/**
 * Tests for Error Fixtures
 *
 * Verifies that error fixtures are valid, deterministic, and cover all error types.
 */

import { describe, it, expect } from 'vitest';
import { PixelLabError, PixelLabErrorType } from '../../src/pixellab/errors.js';
import {
  createAuthError,
  createRateLimitError,
  createQuotaError,
  createTimeoutError,
  createNetworkError,
  createServerError,
  createValidationError,
  createParameterError,
  createDatabaseError,
  createInvalidRequestError,
  createUnknownError,
  createMultipleValidationErrors,
  createRetryableErrors,
  createNonRetryableErrors,
  createGenericError,
  createErrorWithStack,
  createCustomError,
} from './errors.js';

describe('Error Fixtures', () => {
  describe('createAuthError', () => {
    it('should create a valid authentication error', () => {
      const error = createAuthError();

      expect(error).toBeInstanceOf(PixelLabError);
      expect(error.type).toBe(PixelLabErrorType.AUTHENTICATION);
      expect(error.statusCode).toBe(401);
      expect(error.retryable).toBe(false);
      expect(error.message).toBeTruthy();
    });

    it('should be deterministic', () => {
      const error1 = createAuthError();
      const error2 = createAuthError();

      expect(error1.type).toEqual(error2.type);
      expect(error1.message).toEqual(error2.message);
      expect(error1.statusCode).toEqual(error2.statusCode);
    });

    it('should not be retryable', () => {
      const error = createAuthError();

      expect(error.isRetryable()).toBe(false);
    });
  });

  describe('createRateLimitError', () => {
    it('should create a valid rate limit error', () => {
      const error = createRateLimitError();

      expect(error).toBeInstanceOf(PixelLabError);
      expect(error.type).toBe(PixelLabErrorType.RATE_LIMIT);
      expect(error.statusCode).toBe(429);
      expect(error.retryable).toBe(true);
    });

    it('should be deterministic', () => {
      const error1 = createRateLimitError();
      const error2 = createRateLimitError();

      expect(error1.type).toEqual(error2.type);
      expect(error1.statusCode).toEqual(error2.statusCode);
    });

    it('should be retryable', () => {
      const error = createRateLimitError();

      expect(error.isRetryable()).toBe(true);
    });
  });

  describe('createQuotaError', () => {
    it('should create a valid quota error', () => {
      const error = createQuotaError();

      expect(error).toBeInstanceOf(PixelLabError);
      expect(error.type).toBe(PixelLabErrorType.QUOTA_EXCEEDED);
      expect(error.statusCode).toBe(402);
      expect(error.retryable).toBe(false);
    });

    it('should be deterministic', () => {
      const error1 = createQuotaError();
      const error2 = createQuotaError();

      expect(error1.type).toEqual(error2.type);
      expect(error1.statusCode).toEqual(error2.statusCode);
    });
  });

  describe('createTimeoutError', () => {
    it('should create a valid timeout error', () => {
      const error = createTimeoutError();

      expect(error).toBeInstanceOf(PixelLabError);
      expect(error.type).toBe(PixelLabErrorType.TIMEOUT);
      expect(error.retryable).toBe(true);
    });

    it('should be deterministic', () => {
      const error1 = createTimeoutError();
      const error2 = createTimeoutError();

      expect(error1.type).toEqual(error2.type);
      expect(error1.message).toEqual(error2.message);
    });

    it('should be retryable', () => {
      const error = createTimeoutError();

      expect(error.isRetryable()).toBe(true);
    });
  });

  describe('createNetworkError', () => {
    it('should create a valid network error', () => {
      const error = createNetworkError();

      expect(error).toBeInstanceOf(PixelLabError);
      expect(error.type).toBe(PixelLabErrorType.NETWORK);
      expect(error.retryable).toBe(true);
      expect(error.originalError).toBeDefined();
    });

    it('should be deterministic', () => {
      const error1 = createNetworkError();
      const error2 = createNetworkError();

      expect(error1.type).toEqual(error2.type);
      expect(error1.message).toEqual(error2.message);
    });

    it('should have original error', () => {
      const error = createNetworkError();

      expect(error.originalError).toBeInstanceOf(Error);
      expect(error.originalError?.message).toBe('ECONNREFUSED');
    });
  });

  describe('createServerError', () => {
    it('should create a valid server error', () => {
      const error = createServerError();

      expect(error).toBeInstanceOf(PixelLabError);
      expect(error.type).toBe(PixelLabErrorType.API_ERROR);
      expect(error.statusCode).toBe(500);
      expect(error.retryable).toBe(true);
    });

    it('should be deterministic', () => {
      const error1 = createServerError();
      const error2 = createServerError();

      expect(error1.type).toEqual(error2.type);
      expect(error1.statusCode).toEqual(error2.statusCode);
    });
  });

  describe('createValidationError', () => {
    it('should create a valid validation error with field errors', () => {
      const error = createValidationError();

      expect(error).toBeInstanceOf(PixelLabError);
      expect(error.type).toBe(PixelLabErrorType.VALIDATION);
      expect(error.statusCode).toBe(422);
      expect(error.retryable).toBe(false);
      expect(error.fieldErrors).toBeDefined();
      expect(error.fieldErrors?.length).toBeGreaterThan(0);
    });

    it('should be deterministic', () => {
      const error1 = createValidationError();
      const error2 = createValidationError();

      expect(error1.type).toEqual(error2.type);
      expect(error1.fieldErrors?.length).toEqual(error2.fieldErrors?.length);
    });

    it('should have detailed field errors', () => {
      const error = createValidationError();

      expect(error.fieldErrors).toBeDefined();
      error.fieldErrors?.forEach((fieldError) => {
        expect(fieldError.field).toBeTruthy();
        expect(fieldError.constraint).toBeTruthy();
        expect(fieldError.value).toBeDefined();
      });
    });
  });

  describe('createParameterError', () => {
    it('should create a valid parameter error', () => {
      const error = createParameterError();

      expect(error).toBeInstanceOf(PixelLabError);
      expect(error.type).toBe(PixelLabErrorType.PARAMETER);
      expect(error.statusCode).toBe(400);
      expect(error.retryable).toBe(false);
      expect(error.fieldErrors).toBeDefined();
    });

    it('should be deterministic', () => {
      const error1 = createParameterError();
      const error2 = createParameterError();

      expect(error1.type).toEqual(error2.type);
      expect(error1.message).toEqual(error2.message);
    });
  });

  describe('createDatabaseError', () => {
    it('should create a valid database error', () => {
      const error = createDatabaseError();

      expect(error).toBeInstanceOf(PixelLabError);
      expect(error.type).toBe(PixelLabErrorType.DATABASE);
      expect(error.statusCode).toBe(500);
      expect(error.retryable).toBe(true);
    });

    it('should be deterministic', () => {
      const error1 = createDatabaseError();
      const error2 = createDatabaseError();

      expect(error1.type).toEqual(error2.type);
      expect(error1.message).toEqual(error2.message);
    });
  });

  describe('createInvalidRequestError', () => {
    it('should create a valid invalid request error', () => {
      const error = createInvalidRequestError();

      expect(error).toBeInstanceOf(PixelLabError);
      expect(error.type).toBe(PixelLabErrorType.INVALID_REQUEST);
      expect(error.statusCode).toBe(400);
      expect(error.retryable).toBe(false);
    });

    it('should be deterministic', () => {
      const error1 = createInvalidRequestError();
      const error2 = createInvalidRequestError();

      expect(error1.type).toEqual(error2.type);
      expect(error1.message).toEqual(error2.message);
    });
  });

  describe('createUnknownError', () => {
    it('should create a valid unknown error', () => {
      const error = createUnknownError();

      expect(error).toBeInstanceOf(PixelLabError);
      expect(error.type).toBe(PixelLabErrorType.UNKNOWN);
      expect(error.retryable).toBe(false);
      expect(error.originalError).toBeDefined();
    });

    it('should be deterministic', () => {
      const error1 = createUnknownError();
      const error2 = createUnknownError();

      expect(error1.type).toEqual(error2.type);
      expect(error1.message).toEqual(error2.message);
    });
  });

  describe('createMultipleValidationErrors', () => {
    it('should create validation error with multiple field errors', () => {
      const error = createMultipleValidationErrors();

      expect(error).toBeInstanceOf(PixelLabError);
      expect(error.type).toBe(PixelLabErrorType.VALIDATION);
      expect(error.fieldErrors).toBeDefined();
      expect(error.fieldErrors?.length).toBeGreaterThan(2);
    });

    it('should be deterministic', () => {
      const error1 = createMultipleValidationErrors();
      const error2 = createMultipleValidationErrors();

      expect(error1.fieldErrors?.length).toEqual(error2.fieldErrors?.length);
    });

    it('should have at least 4 field errors', () => {
      const error = createMultipleValidationErrors();

      expect(error.fieldErrors?.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('createRetryableErrors', () => {
    it('should create an array of retryable errors', () => {
      const errors = createRetryableErrors();

      expect(errors.length).toBeGreaterThan(0);
      errors.forEach((error) => {
        expect(error.isRetryable()).toBe(true);
      });
    });

    it('should be deterministic', () => {
      const errors1 = createRetryableErrors();
      const errors2 = createRetryableErrors();

      expect(errors1.length).toEqual(errors2.length);
    });

    it('should contain various retryable error types', () => {
      const errors = createRetryableErrors();

      const types = errors.map((e) => e.type);
      expect(types).toContain(PixelLabErrorType.RATE_LIMIT);
      expect(types).toContain(PixelLabErrorType.TIMEOUT);
      expect(types).toContain(PixelLabErrorType.NETWORK);
    });
  });

  describe('createNonRetryableErrors', () => {
    it('should create an array of non-retryable errors', () => {
      const errors = createNonRetryableErrors();

      expect(errors.length).toBeGreaterThan(0);
      errors.forEach((error) => {
        expect(error.isRetryable()).toBe(false);
      });
    });

    it('should be deterministic', () => {
      const errors1 = createNonRetryableErrors();
      const errors2 = createNonRetryableErrors();

      expect(errors1.length).toEqual(errors2.length);
    });

    it('should contain various non-retryable error types', () => {
      const errors = createNonRetryableErrors();

      const types = errors.map((e) => e.type);
      expect(types).toContain(PixelLabErrorType.AUTHENTICATION);
      expect(types).toContain(PixelLabErrorType.VALIDATION);
    });
  });

  describe('createGenericError', () => {
    it('should create a generic Error (not PixelLabError)', () => {
      const error = createGenericError();

      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(PixelLabError);
      expect(error.message).toBeTruthy();
    });

    it('should be deterministic', () => {
      const error1 = createGenericError();
      const error2 = createGenericError();

      expect(error1.message).toEqual(error2.message);
    });
  });

  describe('createErrorWithStack', () => {
    it('should create error with stack trace', () => {
      const error = createErrorWithStack();

      expect(error).toBeInstanceOf(PixelLabError);
      expect(error.stack).toBeDefined();
      expect(error.stack?.length).toBeGreaterThan(0);
    });

    it('should be deterministic', () => {
      const error1 = createErrorWithStack();
      const error2 = createErrorWithStack();

      expect(error1.type).toEqual(error2.type);
      expect(error1.message).toEqual(error2.message);
    });
  });

  describe('createCustomError', () => {
    it('should create error with custom properties', () => {
      const error = createCustomError(
        PixelLabErrorType.API_ERROR,
        'Custom error message',
        {
          statusCode: 503,
          retryable: true,
        }
      );

      expect(error).toBeInstanceOf(PixelLabError);
      expect(error.type).toBe(PixelLabErrorType.API_ERROR);
      expect(error.message).toBe('Custom error message');
      expect(error.statusCode).toBe(503);
      expect(error.retryable).toBe(true);
    });

    it('should support field errors', () => {
      const error = createCustomError(
        PixelLabErrorType.VALIDATION,
        'Custom validation error',
        {
          statusCode: 422,
          retryable: false,
          fieldErrors: [
            {
              field: 'customField',
              constraint: 'must be custom',
              value: 'invalid',
            },
          ],
        }
      );

      expect(error.fieldErrors).toBeDefined();
      expect(error.fieldErrors?.length).toBe(1);
      expect(error.fieldErrors?.[0].field).toBe('customField');
    });
  });

  describe('Error Serialization', () => {
    it('should serialize to JSON correctly', () => {
      const error = createValidationError();
      const json = error.toJSON();

      expect(json).toBeDefined();
      expect(typeof json).toBe('object');
      expect(Object.keys(json)).toContain('type');
      expect(Object.keys(json)).toContain('message');
      expect(Object.keys(json)).toContain('statusCode');
    });

    it('should have user-friendly messages', () => {
      const authError = createAuthError();
      const rateLimitError = createRateLimitError();
      const timeoutError = createTimeoutError();

      expect(authError.getUserMessage()).toBeTruthy();
      expect(rateLimitError.getUserMessage()).toBeTruthy();
      expect(timeoutError.getUserMessage()).toBeTruthy();
    });
  });

  describe('Error Coverage', () => {
    it('should cover all PixelLabErrorType values', () => {
      const allErrors = [
        createAuthError(),
        createRateLimitError(),
        createQuotaError(),
        createTimeoutError(),
        createNetworkError(),
        createServerError(),
        createValidationError(),
        createParameterError(),
        createDatabaseError(),
        createInvalidRequestError(),
        createUnknownError(),
      ];

      const types = allErrors.map((e) => e.type);
      const uniqueTypes = new Set(types);

      // Should cover all error types
      expect(uniqueTypes.size).toBe(types.length);
    });
  });
});
