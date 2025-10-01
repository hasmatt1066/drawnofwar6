/**
 * Task 4.1: Retry Strategy with Exponential Backoff
 *
 * Defines retry behavior for failed jobs with exponential backoff delays.
 *
 * Features:
 * - Configurable max retries (default: 1)
 * - Exponential backoff: baseDelay * (backoffMultiplier ^ retryAttempt)
 * - Jitter (±10%) to prevent thundering herd
 * - Maximum delay cap to prevent overflow
 * - Integration with error classification
 */

import { QueueLogger } from '../queue/logger';
import { ClassifiedError } from './error-classifier';

/**
 * Retry strategy configuration
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 1) */
  maxRetries: number;

  /** Base delay in milliseconds for first retry (default: 5000) */
  backoffDelay: number;

  /** Backoff multiplier for exponential backoff (default: 2.0) */
  backoffMultiplier: number;
}

/**
 * Retry strategy with exponential backoff
 *
 * Calculates retry delays and determines whether to retry based on:
 * - Number of attempts vs. max retries
 * - Error classification (retryable vs. non-retryable)
 * - Exponential backoff with jitter
 */
export class RetryStrategy {
  private config: RetryConfig;
  private logger: QueueLogger;

  /**
   * Maximum delay cap in milliseconds (1 hour)
   * Prevents overflow from large retry attempts
   */
  private static readonly MAX_DELAY_MS = 3600000;

  /**
   * Jitter percentage (±10%)
   */
  private static readonly JITTER_PERCENT = 0.1;

  /**
   * Create a retry strategy
   *
   * @param config - Retry configuration
   * @param logger - Queue logger for logging retry decisions
   * @throws Error if configuration is invalid
   */
  constructor(config: RetryConfig, logger: QueueLogger) {
    this.validateConfig(config);
    this.config = config;
    this.logger = logger;
  }

  /**
   * Calculate delay for a retry attempt
   *
   * Uses exponential backoff: baseDelay * (backoffMultiplier ^ retryAttempt)
   * Adds jitter (±10%) to prevent thundering herd
   * Caps at MAX_DELAY_MS to prevent overflow
   *
   * @param retryAttempt - Zero-based retry attempt number (0 = first retry)
   * @returns Delay in milliseconds, or null if max retries exceeded
   */
  calculateDelay(retryAttempt: number): number | null {
    // Check if retry attempt exceeds max retries
    // retryAttempt is the current retry count, maxRetries is the maximum allowed
    if (retryAttempt >= this.config.maxRetries || this.config.maxRetries === 0) {
      return null;
    }

    // Handle negative attempts (shouldn't happen, but be defensive)
    const attempt = Math.max(0, retryAttempt);

    // Calculate base delay with exponential backoff
    const { backoffDelay, backoffMultiplier } = this.config;
    const exponentialDelay = backoffDelay * Math.pow(backoffMultiplier, attempt);

    // Add jitter (±10%) to prevent thundering herd
    const delayWithJitter = this.addJitter(exponentialDelay);

    // Cap at maximum delay to prevent overflow (after jitter)
    const cappedDelay = Math.min(delayWithJitter, RetryStrategy.MAX_DELAY_MS);
    const delay = cappedDelay;

    // Log the calculated delay
    this.logger.logInfo('retry_delay_calculated', {
      attempt: retryAttempt,
      delay,
      baseDelay: backoffDelay,
      exponentialDelay,
      cappedDelay,
    });

    return Math.round(delay);
  }

  /**
   * Determine if a job should be retried
   *
   * @param attempt - Current attempt number (0-based)
   * @param error - Classified error from the failed job
   * @returns True if job should be retried, false otherwise
   */
  shouldRetry(attempt: number, error: ClassifiedError): boolean {
    // Check if error is retryable
    if (!error.retryable) {
      this.logger.logWarn('retry_rejected', {
        attempt,
        errorType: error.type,
        reason: 'Error is not retryable',
      });
      return false;
    }

    // Check if we've exceeded max retries
    // attempt is the current retry count (0-based), maxRetries is the maximum allowed retries
    // If attempt >= maxRetries, we've exhausted our retries
    if (attempt >= this.config.maxRetries || this.config.maxRetries === 0) {
      this.logger.logWarn('retry_rejected', {
        attempt,
        errorType: error.type,
        maxRetries: this.config.maxRetries,
        reason: 'Max retries exceeded',
      });
      return false;
    }

    // Retry is allowed
    this.logger.logInfo('retry_decision', {
      attempt,
      shouldRetry: true,
      errorType: error.type,
      maxRetries: this.config.maxRetries,
    });

    return true;
  }

  /**
   * Add jitter to delay (±10%)
   *
   * @param delay - Base delay in milliseconds
   * @returns Delay with jitter applied
   */
  private addJitter(delay: number): number {
    const jitterRange = delay * RetryStrategy.JITTER_PERCENT;
    const jitter = (Math.random() * 2 - 1) * jitterRange; // Random value between -jitterRange and +jitterRange
    return delay + jitter;
  }

  /**
   * Validate retry configuration
   *
   * @param config - Configuration to validate
   * @throws Error if configuration is invalid
   */
  private validateConfig(config: RetryConfig): void {
    if (config.maxRetries < 0) {
      throw new Error('maxRetries must be non-negative');
    }

    if (config.backoffDelay <= 0) {
      throw new Error('backoffDelay must be positive');
    }

    if (config.backoffMultiplier <= 0) {
      throw new Error('backoffMultiplier must be positive');
    }

    if (!Number.isFinite(config.maxRetries) ||
        !Number.isFinite(config.backoffDelay) ||
        !Number.isFinite(config.backoffMultiplier)) {
      throw new Error('Configuration values must be finite numbers');
    }
  }
}
