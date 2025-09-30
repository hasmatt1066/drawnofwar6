import { PixelLabError, PixelLabErrorType } from './errors';

/**
 * Authentication Manager for PixelLab API
 *
 * Handles API key validation and management
 */
export class AuthManager {
  /**
   * Minimum API key length (based on actual PixelLab API key format)
   */
  private static readonly MIN_KEY_LENGTH = 32;

  /**
   * Valid API key pattern: alphanumeric and hyphens only
   * Example: c1994b12-b97e-4b29-9991-180e3a0ebe55
   */
  private static readonly API_KEY_PATTERN = /^[a-zA-Z0-9-]+$/;

  /**
   * Validate API key format and requirements
   *
   * @param apiKey - API key to validate
   * @throws {PixelLabError} If API key is invalid
   */
  public static validateApiKey(apiKey: string): void {
    // Check if API key exists
    if (!apiKey || typeof apiKey !== 'string') {
      throw new PixelLabError({
        type: PixelLabErrorType.AUTHENTICATION,
        message: 'API key is required and must be a non-empty string',
        retryable: false,
      });
    }

    // Check for whitespace (including leading/trailing)
    const trimmedKey = apiKey.trim();
    if (trimmedKey !== apiKey) {
      throw new PixelLabError({
        type: PixelLabErrorType.AUTHENTICATION,
        message: 'API key cannot contain leading or trailing whitespace',
        retryable: false,
      });
    }

    if (trimmedKey.length === 0) {
      throw new PixelLabError({
        type: PixelLabErrorType.AUTHENTICATION,
        message: 'API key is required and cannot be empty or whitespace-only',
        retryable: false,
      });
    }

    // Check minimum length
    if (apiKey.length < this.MIN_KEY_LENGTH) {
      throw new PixelLabError({
        type: PixelLabErrorType.AUTHENTICATION,
        message: `API key must be at least ${this.MIN_KEY_LENGTH} characters long`,
        retryable: false,
      });
    }

    // Check character format
    if (!this.API_KEY_PATTERN.test(apiKey)) {
      throw new PixelLabError({
        type: PixelLabErrorType.AUTHENTICATION,
        message: 'API key must contain only alphanumeric characters and hyphens',
        retryable: false,
      });
    }
  }

  /**
   * Check if API key format is valid (non-throwing)
   *
   * @param apiKey - API key to check
   * @returns true if valid format, false otherwise
   */
  public static isValidFormat(apiKey: string): boolean {
    try {
      this.validateApiKey(apiKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Sanitize API key for logging (redact most characters)
   *
   * @param apiKey - API key to sanitize
   * @returns Redacted API key showing only first 4 and last 4 characters
   *
   * @example
   * ```typescript
   * sanitizeForLogging('c1994b12-b97e-4b29-9991-180e3a0ebe55')
   * // Returns: 'c199...be55'
   * ```
   */
  public static sanitizeForLogging(apiKey: string): string {
    if (!apiKey || apiKey.length < 8) {
      return '***';
    }

    const first4 = apiKey.substring(0, 4);
    const last4 = apiKey.substring(apiKey.length - 4);

    return `${first4}...${last4}`;
  }
}
