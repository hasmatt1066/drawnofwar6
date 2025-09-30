/**
 * PixelLab API Error Types
 *
 * Based on empirical API testing (see: /docs/planning/api-testing-results.md)
 */
export enum PixelLabErrorType {
  /** Pydantic validation errors (field paths, constraint types) */
  VALIDATION = 'validation',

  /** Parameter constraint violations (e.g., size out of range) */
  PARAMETER = 'parameter',

  /** Database/UUID errors with SQL traceback */
  DATABASE = 'database',

  /** Authentication failures (401, 403) */
  AUTHENTICATION = 'authentication',

  /** Rate limit exceeded (429) */
  RATE_LIMIT = 'rate_limit',

  /** Quota/credits exceeded (402) */
  QUOTA_EXCEEDED = 'quota_exceeded',

  /** Invalid request format (400, 422) */
  INVALID_REQUEST = 'invalid_request',

  /** Request timeout (no response within timeout period) */
  TIMEOUT = 'timeout',

  /** Network errors (ECONNREFUSED, ENOTFOUND, etc.) */
  NETWORK = 'network',

  /** Server errors (500, 502, 503) */
  API_ERROR = 'api_error',

  /** Unknown or unclassified error */
  UNKNOWN = 'unknown',
}

/**
 * Field-level validation error details
 */
export interface FieldError {
  field: string;
  constraint: string;
  value: any;
}

/**
 * Configuration for creating a PixelLabError
 */
export interface PixelLabErrorOptions {
  type: PixelLabErrorType;
  message: string;
  statusCode?: number;
  retryable: boolean;
  originalError?: Error;
  fieldErrors?: FieldError[];
}

/**
 * Custom error class for PixelLab API errors
 *
 * Provides structured error information with:
 * - Error type classification
 * - HTTP status code (if applicable)
 * - Retryability flag
 * - Original error for debugging
 * - Field-level validation errors (for VALIDATION type)
 *
 * @example
 * ```typescript
 * throw new PixelLabError({
 *   type: PixelLabErrorType.AUTHENTICATION,
 *   message: 'Invalid API key',
 *   statusCode: 401,
 *   retryable: false,
 * });
 * ```
 */
export class PixelLabError extends Error {
  public readonly type: PixelLabErrorType;
  public readonly statusCode: number | undefined;
  public readonly retryable: boolean;
  public readonly originalError: Error | undefined;
  public readonly fieldErrors: FieldError[] | undefined;

  constructor(options: PixelLabErrorOptions) {
    super(options.message);

    // Set the prototype explicitly to maintain instanceof checks
    Object.setPrototypeOf(this, PixelLabError.prototype);

    this.name = 'PixelLabError';
    this.type = options.type;
    this.statusCode = options.statusCode;
    this.retryable = options.retryable;
    this.originalError = options.originalError;
    this.fieldErrors = options.fieldErrors;

    // Maintain proper stack trace (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PixelLabError);
    }
  }

  /**
   * Custom JSON serialization
   * Useful for logging and error reporting
   */
  toJSON(): object {
    return {
      name: this.name,
      type: this.type,
      message: this.message,
      statusCode: this.statusCode,
      retryable: this.retryable,
      fieldErrors: this.fieldErrors,
      // Omit originalError to avoid circular references in logs
      stack: this.stack,
    };
  }

  /**
   * Check if this error type is retryable
   */
  isRetryable(): boolean {
    return this.retryable;
  }

  /**
   * Get user-friendly error message
   * (vs. technical message for developers)
   */
  getUserMessage(): string {
    switch (this.type) {
      case PixelLabErrorType.AUTHENTICATION:
        return 'Authentication failed. Please check your API key.';
      case PixelLabErrorType.RATE_LIMIT:
        return 'Rate limit exceeded. Please try again later.';
      case PixelLabErrorType.QUOTA_EXCEEDED:
        return 'API quota exceeded. Please check your account balance.';
      case PixelLabErrorType.TIMEOUT:
        return 'Request timed out. Please try again.';
      case PixelLabErrorType.NETWORK:
        return 'Network error. Please check your connection.';
      case PixelLabErrorType.VALIDATION:
        return 'Invalid input. Please check your parameters.';
      case PixelLabErrorType.PARAMETER:
        return 'Invalid parameter value. Please adjust and try again.';
      default:
        return 'An error occurred. Please try again.';
    }
  }
}
