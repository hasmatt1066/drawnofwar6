import { PixelLabError } from './errors';

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;

  /** Initial delay in milliseconds before first retry (default: 1000) */
  initialDelay?: number;

  /** Backoff multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;

  /** Maximum delay between retries in milliseconds (default: 30000 = 30s) */
  maxDelay?: number;
}

/**
 * Retry Strategy for PixelLab API
 *
 * Automatically retries failed requests based on error type:
 * - Retries: API errors (500+), timeouts, network errors
 * - No retry: Auth errors, validation errors, quota errors
 *
 * Uses exponential backoff: delay * (multiplier ^ attempt)
 */
export class RetryStrategy {
  /**
   * Default configuration
   */
  private static readonly DEFAULT_CONFIG: Required<RetryConfig> = {
    maxAttempts: 3,
    initialDelay: 1000, // 1 second
    backoffMultiplier: 2,
    maxDelay: 30000, // 30 seconds
  };

  /**
   * Execute operation with retry logic
   *
   * @param operation - Async operation to execute
   * @param config - Retry configuration
   * @returns Result of successful operation
   * @throws {PixelLabError} If all retries exhausted or error is non-retryable
   */
  public static async executeWithRetry<T>(
    operation: () => Promise<T>,
    config?: RetryConfig
  ): Promise<T> {
    const finalConfig = {
      ...this.DEFAULT_CONFIG,
      ...config,
    };

    // Handle maxAttempts = 0 (no attempts at all)
    if (finalConfig.maxAttempts === 0) {
      throw new PixelLabError({
        type: 'unknown' as any,
        message: 'Max attempts is 0, no operation executed',
        retryable: false,
      });
    }

    let lastError: Error | undefined;
    let attempt = 0;

    while (attempt < finalConfig.maxAttempts) {
      try {
        // Execute operation
        const result = await operation();
        return result; // Success!

      } catch (error) {
        attempt++;
        lastError = error as Error;

        // Check if error is retryable
        if (!this.shouldRetry(error, attempt, finalConfig.maxAttempts)) {
          throw error;
        }

        // Calculate delay for next retry
        const delay = this.calculateDelay(attempt, finalConfig);

        // Wait before retrying
        await this.delay(delay);
      }
    }

    // All retries exhausted
    throw lastError;
  }

  /**
   * Determine if error should be retried
   */
  private static shouldRetry(error: any, attempt: number, maxAttempts: number): boolean {
    // Don't retry if we've exhausted attempts
    if (attempt >= maxAttempts) {
      return false;
    }

    // Only retry PixelLabErrors
    if (!(error instanceof PixelLabError)) {
      return false;
    }

    // Check if error is marked as retryable
    return error.retryable;
  }

  /**
   * Calculate delay before next retry using exponential backoff
   */
  private static calculateDelay(attempt: number, config: Required<RetryConfig>): number {
    // Calculate exponential delay: initialDelay * (multiplier ^ (attempt - 1))
    // attempt - 1 because first retry should use initialDelay
    const exponentialDelay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1);

    // Cap at max delay
    return Math.min(exponentialDelay, config.maxDelay);
  }

  /**
   * Delay for specified milliseconds
   */
  private static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
