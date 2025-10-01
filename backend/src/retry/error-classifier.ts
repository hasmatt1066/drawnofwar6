/**
 * Task 4.4: Error Classification and Handling
 *
 * Classifies errors from PixelLab API and determines retry eligibility.
 *
 * Features:
 * - Classifies errors by type (auth, rate limit, timeout, API error)
 * - Determines retry eligibility based on error type
 * - Provides user-friendly error messages
 * - Logs technical error details for debugging
 * - Handles edge cases (unknown errors, network errors, etc.)
 */

import { PixelLabError, PixelLabErrorType } from '../pixellab/errors';

/**
 * Error types for classification
 */
export enum ErrorType {
  AUTHENTICATION = 'authentication',
  RATE_LIMIT = 'rate_limit',
  TIMEOUT = 'timeout',
  SERVER_ERROR = 'server_error',
  VALIDATION_ERROR = 'validation_error',
  NETWORK_ERROR = 'network_error',
  UNKNOWN = 'unknown',
}

/**
 * Classified error with retry information and user-friendly messages
 */
export interface ClassifiedError {
  /** Error type classification */
  type: ErrorType;

  /** Whether this error is retryable */
  retryable: boolean;

  /** User-friendly error message */
  userMessage: string;

  /** Technical error details for logging */
  technicalDetails: string;

  /** Suggested retry delay in seconds (for rate limiting) */
  retryAfter?: number;

  /** Original error object */
  originalError: Error;
}

/**
 * Error classifier for PixelLab API errors
 *
 * Classifies errors into types and determines retry eligibility.
 * Handles both PixelLabError instances and generic errors.
 */
export class ErrorClassifier {
  /**
   * Default retry delay for rate limit errors (in seconds)
   */
  private static readonly DEFAULT_RATE_LIMIT_RETRY_AFTER = 30;

  /**
   * Classify an error and determine retry eligibility
   *
   * @param error - Error to classify (can be any type)
   * @returns Classified error with retry information
   */
  static classify(error: any): ClassifiedError {
    try {
      // Handle null/undefined
      if (error === null || error === undefined) {
        return this.createUnknownError(new Error('Null or undefined error'), 'No error provided');
      }

      // Convert non-Error objects to Error
      const errorObj = this.ensureError(error);

      // Check if it's a PixelLabError
      if (error instanceof PixelLabError) {
        return this.classifyPixelLabError(error);
      }

      // Check for HTTP status codes on generic errors
      if (this.hasStatusCode(error)) {
        return this.classifyByStatusCode(errorObj, error.statusCode);
      }

      // Check for network error codes
      if (this.hasErrorCode(error)) {
        return this.classifyByErrorCode(errorObj, error.code);
      }

      // Check error message patterns
      if (this.isTimeoutError(errorObj)) {
        return this.createTimeoutError(errorObj);
      }

      // Unknown error - default to non-retryable for safety
      return this.createUnknownError(errorObj, errorObj.message || 'Unknown error');
    } catch (classificationError) {
      // If classification itself fails, return safe unknown error
      return this.createUnknownError(
        error instanceof Error ? error : new Error(String(error)),
        'Error during classification'
      );
    }
  }

  /**
   * Classify a PixelLabError
   */
  private static classifyPixelLabError(error: PixelLabError): ClassifiedError {
    const statusCode = error.statusCode;

    // Map PixelLabErrorType to ErrorType
    switch (error.type) {
      case PixelLabErrorType.AUTHENTICATION:
        return {
          type: ErrorType.AUTHENTICATION,
          retryable: false,
          userMessage: 'authentication failed. Please check your API credentials.',
          technicalDetails: `Authentication error: ${error.message} (Status: ${statusCode || 'N/A'})`,
          originalError: error,
        };

      case PixelLabErrorType.RATE_LIMIT:
        return {
          type: ErrorType.RATE_LIMIT,
          retryable: true,
          userMessage: 'rate limit exceeded. Please try again in a moment.',
          technicalDetails: `Rate limit error: ${error.message} (Status: ${statusCode || 'N/A'})`,
          retryAfter: this.extractRetryAfter(error),
          originalError: error,
        };

      case PixelLabErrorType.TIMEOUT:
        return {
          type: ErrorType.TIMEOUT,
          retryable: true,
          userMessage: 'Request timeout. Please try again.',
          technicalDetails: `Timeout error: ${error.message}`,
          originalError: error,
        };

      case PixelLabErrorType.API_ERROR:
        return {
          type: ErrorType.SERVER_ERROR,
          retryable: true,
          userMessage: 'server error occurred. Please try again later.',
          technicalDetails: `API error: ${error.message} (Status: ${statusCode || 'N/A'})`,
          originalError: error,
        };

      case PixelLabErrorType.VALIDATION:
      case PixelLabErrorType.PARAMETER:
      case PixelLabErrorType.INVALID_REQUEST:
        return {
          type: ErrorType.VALIDATION_ERROR,
          retryable: false,
          userMessage: 'validation error. Please check your input parameters.',
          technicalDetails: `validation error: ${error.message} (Status: ${statusCode || 'N/A'})`,
          originalError: error,
        };

      case PixelLabErrorType.NETWORK:
        return {
          type: ErrorType.NETWORK_ERROR,
          retryable: true,
          userMessage: 'network error. Please check your connection and try again.',
          technicalDetails: `Network error: ${error.message}`,
          originalError: error,
        };

      case PixelLabErrorType.DATABASE:
      case PixelLabErrorType.QUOTA_EXCEEDED:
      case PixelLabErrorType.UNKNOWN:
      default:
        // Database errors and quota exceeded are non-retryable
        const isRetryable = error.type !== PixelLabErrorType.QUOTA_EXCEEDED &&
                           error.type !== PixelLabErrorType.DATABASE;
        return {
          type: ErrorType.UNKNOWN,
          retryable: isRetryable,
          userMessage: 'An unexpected error occurred. Please contact support if this persists.',
          technicalDetails: `${error.type}: ${error.message} (Status: ${statusCode || 'N/A'})`,
          originalError: error,
        };
    }
  }

  /**
   * Classify error by HTTP status code
   */
  private static classifyByStatusCode(error: Error, statusCode: number): ClassifiedError {
    // Authentication errors
    if (statusCode === 401 || statusCode === 403) {
      return {
        type: ErrorType.AUTHENTICATION,
        retryable: false,
        userMessage: 'Authentication failed. Please check your API credentials.',
        technicalDetails: `HTTP ${statusCode}: ${error.message}`,
        originalError: error,
      };
    }

    // Rate limit
    if (statusCode === 429) {
      return {
        type: ErrorType.RATE_LIMIT,
        retryable: true,
        userMessage: 'Too many requests. Please try again in a moment.',
        technicalDetails: `HTTP 429: ${error.message}`,
        retryAfter: this.extractRetryAfter(error),
        originalError: error,
      };
    }

    // Validation errors
    if (statusCode === 400 || statusCode === 422) {
      return {
        type: ErrorType.VALIDATION_ERROR,
        retryable: false,
        userMessage: 'Invalid request. Please check your input parameters.',
        technicalDetails: `HTTP ${statusCode}: ${error.message}`,
        originalError: error,
      };
    }

    // Server errors
    if (statusCode >= 500 && statusCode < 600) {
      return {
        type: ErrorType.SERVER_ERROR,
        retryable: true,
        userMessage: 'Server error occurred. Please try again later.',
        technicalDetails: `HTTP ${statusCode}: ${error.message}`,
        originalError: error,
      };
    }

    // Other HTTP errors - default to unknown
    return this.createUnknownError(error, `HTTP ${statusCode}: ${error.message}`);
  }

  /**
   * Classify error by error code (e.g., ECONNREFUSED, ETIMEDOUT)
   */
  private static classifyByErrorCode(error: Error, code: string): ClassifiedError {
    // Network errors
    const networkCodes = ['ECONNREFUSED', 'ENOTFOUND', 'ECONNRESET', 'EPIPE', 'EHOSTUNREACH'];
    if (networkCodes.includes(code)) {
      return {
        type: ErrorType.NETWORK_ERROR,
        retryable: true,
        userMessage: 'network error. Please check your connection and try again.',
        technicalDetails: `Network error (${code}): ${error.message}`,
        originalError: error,
      };
    }

    // Timeout errors
    if (code === 'ETIMEDOUT') {
      return {
        type: ErrorType.TIMEOUT,
        retryable: true,
        userMessage: 'Request timed out. Please try again.',
        technicalDetails: `Timeout (${code}): ${error.message}`,
        originalError: error,
      };
    }

    // Unknown error code
    return this.createUnknownError(error, `Error code ${code}: ${error.message}`);
  }

  /**
   * Check if error message indicates a timeout
   */
  private static isTimeoutError(error: Error): boolean {
    const message = error.message?.toLowerCase() || '';
    return message.includes('timeout') || message.includes('timed out');
  }

  /**
   * Create a timeout error classification
   */
  private static createTimeoutError(error: Error): ClassifiedError {
    return {
      type: ErrorType.TIMEOUT,
      retryable: true,
      userMessage: 'Request timed out. Please try again.',
      technicalDetails: `Timeout: ${error.message}`,
      originalError: error,
    };
  }

  /**
   * Create an unknown error classification
   */
  private static createUnknownError(error: Error, details: string): ClassifiedError {
    return {
      type: ErrorType.UNKNOWN,
      retryable: false,
      userMessage: 'An unexpected error occurred. Please contact support if this persists.',
      technicalDetails: details || error.message || 'Unknown error',
      originalError: error,
    };
  }

  /**
   * Extract retry-after value from error
   */
  private static extractRetryAfter(error: any): number {
    // Check if error has retryAfter property
    if (typeof error.retryAfter === 'number' && error.retryAfter > 0) {
      return error.retryAfter;
    }

    // Check for Retry-After header in response
    if (error.response && error.response.headers) {
      const retryAfter = error.response.headers['retry-after'];
      if (retryAfter) {
        const parsed = parseInt(retryAfter, 10);
        if (!isNaN(parsed) && parsed > 0) {
          return parsed;
        }
      }
    }

    // Default retry-after for rate limits
    return this.DEFAULT_RATE_LIMIT_RETRY_AFTER;
  }

  /**
   * Ensure input is an Error object
   */
  private static ensureError(error: any): Error {
    if (error instanceof Error) {
      return error;
    }

    // Convert string to Error
    if (typeof error === 'string') {
      return new Error(error);
    }

    // Convert object to Error
    if (typeof error === 'object' && error !== null) {
      const message = error.message || error.toString?.() || 'Unknown error';
      const err = new Error(message);
      // Copy properties
      Object.assign(err, error);
      return err;
    }

    // Fallback
    return new Error(String(error));
  }

  /**
   * Check if error has status code property
   */
  private static hasStatusCode(error: any): error is { statusCode: number } {
    return typeof error?.statusCode === 'number';
  }

  /**
   * Check if error has error code property
   */
  private static hasErrorCode(error: any): error is { code: string } {
    return typeof error?.code === 'string';
  }
}
