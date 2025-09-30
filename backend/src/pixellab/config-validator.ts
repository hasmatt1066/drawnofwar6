import { AuthManager } from './auth-manager';
import { PixelLabError, PixelLabErrorType } from './errors';

/**
 * Configuration for PixelLab API Client
 */
export interface PixelLabClientConfig {
  /** PixelLab API key (required) */
  apiKey: string;

  /** Base URL for API (default: https://api.pixellab.ai) */
  baseURL?: string;

  /** Request timeout in milliseconds (default: 180000 = 3 minutes) */
  timeout?: number;

  /** Maximum retry attempts for failed requests (default: 3) */
  maxRetries?: number;

  /** Client-side rate limit per minute (default: 30) */
  rateLimitPerMinute?: number;

  /** Enable structured logging (default: true) */
  enableLogging?: boolean;
}

/**
 * Validated and normalized configuration
 * All optional fields have been filled with defaults
 */
export type ValidatedConfig = Required<PixelLabClientConfig>;

/**
 * Configuration Validator for PixelLab API Client
 *
 * Validates and normalizes configuration objects:
 * - Validates required fields
 * - Validates field types
 * - Validates value ranges
 * - Applies defaults for optional fields
 * - Normalizes values (e.g., removes trailing slashes from URLs)
 */
export class ConfigValidator {
  /**
   * Default configuration values
   */
  private static readonly DEFAULTS = {
    baseURL: 'https://api.pixellab.ai',
    timeout: 180000, // 3 minutes (from API testing results)
    maxRetries: 3,
    rateLimitPerMinute: 30, // Conservative client-side limit
    enableLogging: true,
  };

  /**
   * Validate and normalize configuration
   *
   * @param config - Configuration object to validate
   * @returns Validated configuration with all fields populated
   * @throws {PixelLabError} If configuration is invalid
   */
  public static validateConfig(config: PixelLabClientConfig): ValidatedConfig {
    // Validate required fields
    this.validateRequired(config);

    // Validate optional fields if provided
    this.validateOptionalFields(config);

    // Build validated config with defaults
    const validated: ValidatedConfig = {
      apiKey: config.apiKey,
      baseURL: this.normalizeBaseURL(config.baseURL ?? this.DEFAULTS.baseURL),
      timeout: config.timeout ?? this.DEFAULTS.timeout,
      maxRetries: config.maxRetries ?? this.DEFAULTS.maxRetries,
      rateLimitPerMinute: config.rateLimitPerMinute ?? this.DEFAULTS.rateLimitPerMinute,
      enableLogging: config.enableLogging ?? this.DEFAULTS.enableLogging,
    };

    return validated;
  }

  /**
   * Validate required configuration fields
   */
  private static validateRequired(config: PixelLabClientConfig): void {
    // Validate API key (uses AuthManager for consistent validation)
    if (!config.apiKey) {
      throw new PixelLabError({
        type: PixelLabErrorType.INVALID_REQUEST,
        message: 'API key is required in configuration',
        retryable: false,
      });
    }

    AuthManager.validateApiKey(config.apiKey);
  }

  /**
   * Validate optional configuration fields if provided
   */
  private static validateOptionalFields(config: PixelLabClientConfig): void {
    // Validate baseURL format if provided
    if (config.baseURL !== undefined && config.baseURL !== null) {
      if (typeof config.baseURL !== 'string') {
        throw new PixelLabError({
          type: PixelLabErrorType.INVALID_REQUEST,
          message: 'Base URL must be a string',
          retryable: false,
        });
      }

      const urlPattern = /^https?:\/\/.+/;
      if (!urlPattern.test(config.baseURL)) {
        throw new PixelLabError({
          type: PixelLabErrorType.INVALID_REQUEST,
          message: 'Base URL must include protocol (http:// or https://)',
          retryable: false,
        });
      }
    }

    // Validate timeout if provided
    if (config.timeout !== undefined && config.timeout !== null) {
      if (typeof config.timeout !== 'number') {
        throw new PixelLabError({
          type: PixelLabErrorType.INVALID_REQUEST,
          message: 'Timeout must be a number',
          retryable: false,
        });
      }

      if (config.timeout <= 0) {
        throw new PixelLabError({
          type: PixelLabErrorType.INVALID_REQUEST,
          message: 'Timeout must be positive (greater than 0)',
          retryable: false,
        });
      }
    }

    // Validate maxRetries if provided
    if (config.maxRetries !== undefined && config.maxRetries !== null) {
      if (typeof config.maxRetries !== 'number' || !Number.isInteger(config.maxRetries)) {
        throw new PixelLabError({
          type: PixelLabErrorType.INVALID_REQUEST,
          message: 'Max retries must be an integer',
          retryable: false,
        });
      }

      if (config.maxRetries < 0) {
        throw new PixelLabError({
          type: PixelLabErrorType.INVALID_REQUEST,
          message: 'Max retries must be non-negative (0 or greater)',
          retryable: false,
        });
      }
    }

    // Validate rateLimitPerMinute if provided
    if (config.rateLimitPerMinute !== undefined && config.rateLimitPerMinute !== null) {
      if (typeof config.rateLimitPerMinute !== 'number' || !Number.isInteger(config.rateLimitPerMinute)) {
        throw new PixelLabError({
          type: PixelLabErrorType.INVALID_REQUEST,
          message: 'Rate limit per minute must be an integer',
          retryable: false,
        });
      }

      if (config.rateLimitPerMinute <= 0) {
        throw new PixelLabError({
          type: PixelLabErrorType.INVALID_REQUEST,
          message: 'Rate limit per minute must be positive (greater than 0)',
          retryable: false,
        });
      }
    }

    // Validate enableLogging if provided
    if (config.enableLogging !== undefined && config.enableLogging !== null) {
      if (typeof config.enableLogging !== 'boolean') {
        throw new PixelLabError({
          type: PixelLabErrorType.INVALID_REQUEST,
          message: 'Enable logging must be a boolean',
          retryable: false,
        });
      }
    }
  }

  /**
   * Normalize base URL
   * Removes trailing slash for consistency
   */
  private static normalizeBaseURL(baseURL: string): string {
    return baseURL.replace(/\/$/, '');
  }

  /**
   * Get default configuration values
   */
  public static getDefaults(): Readonly<typeof ConfigValidator.DEFAULTS> {
    return { ...this.DEFAULTS };
  }
}
