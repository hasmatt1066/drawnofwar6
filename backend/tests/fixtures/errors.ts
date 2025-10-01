/**
 * Test Fixtures: Error Scenarios
 *
 * Provides deterministic test data for various error conditions
 * including PixelLab API errors, validation errors, and system errors.
 */

import { PixelLabError, PixelLabErrorType, type FieldError } from '../../src/pixellab/errors.js';

/**
 * Authentication error (401)
 *
 * Use case: Testing invalid API key handling
 */
export function createAuthError(): PixelLabError {
  return new PixelLabError({
    type: PixelLabErrorType.AUTHENTICATION,
    message: 'Invalid API key',
    statusCode: 401,
    retryable: false,
  });
}

/**
 * Rate limit error (429)
 *
 * Use case: Testing rate limiting and retry logic
 */
export function createRateLimitError(): PixelLabError {
  return new PixelLabError({
    type: PixelLabErrorType.RATE_LIMIT,
    message: 'Rate limit exceeded. Please try again in 60 seconds.',
    statusCode: 429,
    retryable: true,
  });
}

/**
 * Quota exceeded error (402)
 *
 * Use case: Testing credit/quota exhaustion
 */
export function createQuotaError(): PixelLabError {
  return new PixelLabError({
    type: PixelLabErrorType.QUOTA_EXCEEDED,
    message: 'API quota exceeded. Please check your account balance.',
    statusCode: 402,
    retryable: false,
  });
}

/**
 * Timeout error
 *
 * Use case: Testing timeout handling and retry logic
 */
export function createTimeoutError(): PixelLabError {
  return new PixelLabError({
    type: PixelLabErrorType.TIMEOUT,
    message: 'Request timed out after 30000ms',
    retryable: true,
  });
}

/**
 * Network error
 *
 * Use case: Testing connection failures and resilience
 */
export function createNetworkError(): PixelLabError {
  const originalError = new Error('ECONNREFUSED');
  return new PixelLabError({
    type: PixelLabErrorType.NETWORK,
    message: 'Network error: Connection refused',
    retryable: true,
    originalError,
  });
}

/**
 * Server error (500)
 *
 * Use case: Testing API server failures
 */
export function createServerError(): PixelLabError {
  return new PixelLabError({
    type: PixelLabErrorType.API_ERROR,
    message: 'Internal server error',
    statusCode: 500,
    retryable: true,
  });
}

/**
 * Validation error with field details
 *
 * Use case: Testing input validation error handling
 */
export function createValidationError(): PixelLabError {
  const fieldErrors: FieldError[] = [
    {
      field: 'size',
      constraint: 'must be one of: 32, 48, 64, 128',
      value: 16,
    },
    {
      field: 'description',
      constraint: 'must not be empty',
      value: '',
    },
  ];

  return new PixelLabError({
    type: PixelLabErrorType.VALIDATION,
    message: 'Validation failed for 2 fields',
    statusCode: 422,
    retryable: false,
    fieldErrors,
  });
}

/**
 * Parameter error
 *
 * Use case: Testing parameter constraint violations
 */
export function createParameterError(): PixelLabError {
  const fieldErrors: FieldError[] = [
    {
      field: 'textGuidanceScale',
      constraint: 'must be between 1.0 and 20.0',
      value: 25.0,
    },
  ];

  return new PixelLabError({
    type: PixelLabErrorType.PARAMETER,
    message: 'Parameter constraint violation: textGuidanceScale out of range',
    statusCode: 400,
    retryable: false,
    fieldErrors,
  });
}

/**
 * Database error
 *
 * Use case: Testing API internal database errors
 */
export function createDatabaseError(): PixelLabError {
  return new PixelLabError({
    type: PixelLabErrorType.DATABASE,
    message: 'Database error: Invalid UUID format',
    statusCode: 500,
    retryable: true,
  });
}

/**
 * Invalid request error
 *
 * Use case: Testing malformed request handling
 */
export function createInvalidRequestError(): PixelLabError {
  return new PixelLabError({
    type: PixelLabErrorType.INVALID_REQUEST,
    message: 'Invalid request format: Missing required field "description"',
    statusCode: 400,
    retryable: false,
  });
}

/**
 * Unknown error
 *
 * Use case: Testing unclassified error scenarios
 */
export function createUnknownError(): PixelLabError {
  const originalError = new Error('Something unexpected happened');
  return new PixelLabError({
    type: PixelLabErrorType.UNKNOWN,
    message: 'Unknown error occurred',
    retryable: false,
    originalError,
  });
}

/**
 * Multiple validation errors
 *
 * Use case: Testing complex validation error scenarios
 */
export function createMultipleValidationErrors(): PixelLabError {
  const fieldErrors: FieldError[] = [
    {
      field: 'description',
      constraint: 'must not be empty',
      value: '',
    },
    {
      field: 'size',
      constraint: 'must be one of: 32, 48, 64, 128',
      value: 0,
    },
    {
      field: 'textGuidanceScale',
      constraint: 'must be between 1.0 and 20.0',
      value: -5.0,
    },
    {
      field: 'nDirections',
      constraint: 'must be 4 or 8',
      value: 6,
    },
  ];

  return new PixelLabError({
    type: PixelLabErrorType.VALIDATION,
    message: 'Validation failed for 4 fields',
    statusCode: 422,
    retryable: false,
    fieldErrors,
  });
}

/**
 * Retryable error array
 *
 * Use case: Testing retry logic with different error types
 */
export function createRetryableErrors(): PixelLabError[] {
  return [
    createRateLimitError(),
    createTimeoutError(),
    createNetworkError(),
    createServerError(),
    createDatabaseError(),
  ];
}

/**
 * Non-retryable error array
 *
 * Use case: Testing permanent failure handling
 */
export function createNonRetryableErrors(): PixelLabError[] {
  return [
    createAuthError(),
    createQuotaError(),
    createValidationError(),
    createParameterError(),
    createInvalidRequestError(),
  ];
}

/**
 * Generic error for testing (not PixelLabError)
 *
 * Use case: Testing handling of non-PixelLab errors
 */
export function createGenericError(): Error {
  return new Error('Generic error for testing');
}

/**
 * Error with stack trace
 *
 * Use case: Testing error logging and debugging
 */
export function createErrorWithStack(): PixelLabError {
  const error = new PixelLabError({
    type: PixelLabErrorType.API_ERROR,
    message: 'Error with stack trace',
    statusCode: 500,
    retryable: true,
  });

  // Ensure stack trace is captured
  if (Error.captureStackTrace) {
    Error.captureStackTrace(error, createErrorWithStack);
  }

  return error;
}

/**
 * Create custom error
 *
 * Use case: Testing with specific error configurations
 */
export function createCustomError(
  type: PixelLabErrorType,
  message: string,
  options: {
    statusCode?: number;
    retryable: boolean;
    fieldErrors?: FieldError[];
  }
): PixelLabError {
  return new PixelLabError({
    type,
    message,
    statusCode: options.statusCode,
    retryable: options.retryable,
    fieldErrors: options.fieldErrors,
  });
}
