import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { AuthManager } from './auth-manager';
import { PixelLabError, PixelLabErrorType, FieldError } from './errors';

/**
 * Configuration for PixelLab API Client
 */
export interface PixelLabClientConfig {
  apiKey: string;
  baseURL?: string;
  timeout?: number; // milliseconds
  maxRetries?: number;
  rateLimitPerMinute?: number;
  enableLogging?: boolean;
}

/**
 * HTTP Client for PixelLab.ai API
 *
 * Provides configured Axios instance with:
 * - Authentication via Bearer token
 * - Timeout handling
 * - Default headers
 * - Request/response interceptors
 */
export class HttpClient {
  public readonly axiosInstance: AxiosInstance;
  private config: Required<PixelLabClientConfig>;

  constructor(config: PixelLabClientConfig) {
    // Validate required fields
    this.validateConfig(config);

    // Apply defaults
    this.config = {
      apiKey: config.apiKey,
      baseURL: config.baseURL || 'https://api.pixellab.ai',
      timeout: config.timeout || 180000, // 3 minutes default (from API testing results)
      maxRetries: config.maxRetries ?? 3,
      rateLimitPerMinute: config.rateLimitPerMinute ?? 30,
      enableLogging: config.enableLogging ?? true,
    };

    // Create Axios instance
    this.axiosInstance = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Add interceptors
    this.setupAuthInterceptor();
    this.setupErrorInterceptor();
  }

  /**
   * Setup request interceptor for authentication
   * Adds Bearer token to all outgoing requests
   */
  private setupAuthInterceptor(): void {
    this.axiosInstance.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        // Only add Authorization if not already present
        if (!config.headers['Authorization']) {
          config.headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );
  }

  /**
   * Setup response interceptor for error handling
   * Classifies API errors into PixelLabError types
   */
  private setupErrorInterceptor(): void {
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        // Convert Axios error to PixelLabError
        const pixelError = this.classifyError(error);
        return Promise.reject(pixelError);
      }
    );
  }

  /**
   * Classify Axios error into PixelLabError
   */
  private classifyError(error: AxiosError): PixelLabError {
    // Network errors (no response)
    if (!error.response) {
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        return new PixelLabError({
          type: PixelLabErrorType.TIMEOUT,
          message: 'Request timed out',
          retryable: true,
          originalError: error,
        });
      }

      return new PixelLabError({
        type: PixelLabErrorType.NETWORK,
        message: error.message || 'Network error occurred',
        retryable: true,
        originalError: error,
      });
    }

    const statusCode = error.response.status;
    const responseData = error.response.data as any;
    const detail = responseData?.detail;

    // Authentication errors (401, 403)
    if (statusCode === 401 || statusCode === 403) {
      return new PixelLabError({
        type: PixelLabErrorType.AUTHENTICATION,
        message: detail || 'Authentication failed',
        statusCode,
        retryable: false,
        originalError: error,
      });
    }

    // Rate limit (429)
    if (statusCode === 429) {
      return new PixelLabError({
        type: PixelLabErrorType.RATE_LIMIT,
        message: detail || 'Rate limit exceeded',
        statusCode,
        retryable: true,
        originalError: error,
      });
    }

    // Quota exceeded (402)
    if (statusCode === 402) {
      return new PixelLabError({
        type: PixelLabErrorType.QUOTA_EXCEEDED,
        message: detail || 'Quota exceeded',
        statusCode,
        retryable: false,
        originalError: error,
      });
    }

    // Validation errors (422)
    if (statusCode === 422) {
      // Check if Pydantic validation error (array of field errors)
      if (Array.isArray(detail)) {
        const fieldErrors: FieldError[] = detail.map((err: any) => ({
          field: Array.isArray(err.loc) ? err.loc.join('.') : String(err.loc),
          constraint: err.type || 'validation_error',
          value: err.input,
        }));

        return new PixelLabError({
          type: PixelLabErrorType.VALIDATION,
          message: 'Validation failed',
          statusCode,
          retryable: false,
          originalError: error,
          fieldErrors,
        });
      }

      // Parameter constraint error (string message)
      return new PixelLabError({
        type: PixelLabErrorType.PARAMETER,
        message: detail || 'Invalid parameter value',
        statusCode,
        retryable: false,
        originalError: error,
      });
    }

    // Bad request (400)
    if (statusCode === 400) {
      return new PixelLabError({
        type: PixelLabErrorType.INVALID_REQUEST,
        message: detail || 'Invalid request',
        statusCode,
        retryable: false,
        originalError: error,
      });
    }

    // Server errors (500, 502, 503)
    if (statusCode >= 500) {
      // Check for database errors
      if (detail && typeof detail === 'string' && detail.toLowerCase().includes('database')) {
        return new PixelLabError({
          type: PixelLabErrorType.DATABASE,
          message: detail,
          statusCode,
          retryable: false,
          originalError: error,
        });
      }

      return new PixelLabError({
        type: PixelLabErrorType.API_ERROR,
        message: detail || 'Server error',
        statusCode,
        retryable: true,
        originalError: error,
      });
    }

    // Unknown error
    return new PixelLabError({
      type: PixelLabErrorType.UNKNOWN,
      message: detail || error.message || 'Unknown error occurred',
      statusCode,
      retryable: false,
      originalError: error,
    });
  }

  /**
   * Update API key and use for subsequent requests
   * Validates new key before updating
   *
   * @param newApiKey - New API key to use
   * @throws {PixelLabError} If new API key is invalid
   */
  public setApiKey(newApiKey: string): void {
    // Validate new API key
    AuthManager.validateApiKey(newApiKey);

    // Update config
    this.config.apiKey = newApiKey;
  }

  /**
   * Validate configuration object
   */
  private validateConfig(config: PixelLabClientConfig): void {
    // Validate API key
    if (!config.apiKey || config.apiKey.trim() === '') {
      throw new Error('API key is required and cannot be empty');
    }

    // Validate base URL format
    if (config.baseURL) {
      const urlPattern = /^https?:\/\/.+/;
      if (!urlPattern.test(config.baseURL)) {
        throw new Error('Base URL must include protocol (http:// or https://)');
      }
    }

    // Validate timeout
    if (config.timeout !== undefined && config.timeout <= 0) {
      throw new Error('Timeout must be positive');
    }

    // Validate maxRetries
    if (config.maxRetries !== undefined && config.maxRetries < 0) {
      throw new Error('Max retries must be non-negative');
    }

    // Validate rateLimitPerMinute
    if (config.rateLimitPerMinute !== undefined && config.rateLimitPerMinute <= 0) {
      throw new Error('Rate limit per minute must be positive');
    }
  }

  /**
   * Get current configuration (read-only)
   */
  public getConfig(): Readonly<Required<PixelLabClientConfig>> {
    return { ...this.config };
  }
}
