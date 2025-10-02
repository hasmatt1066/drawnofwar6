/**
 * Task 6.3: Generation Timeout Handling
 *
 * Enforces timeout on sprite generation jobs to prevent indefinite hanging.
 * Wraps job processor with timeout mechanism using Promise.race(), handles
 * race conditions with grace period, and marks timed-out jobs as retryable failures.
 *
 * Features:
 * - Configurable default timeout (10 minutes)
 * - Per-job timeout override for complex jobs
 * - Grace period for race condition handling
 * - Structured logging of timeout events
 * - TimeoutError is retryable for BullMQ retry handling
 * - Cleanup of timeout timers
 */

import type { Job } from 'bullmq';
import type { JobProcessor } from './job-processor.js';
import type { QueueLogger } from './logger.js';
import type { SpriteGenerationResult } from './job-status-tracker.js';

/**
 * Timeout configuration
 */
export interface TimeoutConfig {
  /** Default timeout in milliseconds (default: 600000ms = 10 minutes) */
  defaultTimeout: number;

  /** Enable per-job timeout overrides (default: true) */
  enablePerJobOverride: boolean;
}

/**
 * TimeoutError - custom error for job timeouts
 *
 * Marked as retryable so BullMQ will retry the job according to retry policy.
 * Contains detailed timing information for debugging and metrics.
 */
export class TimeoutError extends Error {
  public override readonly name = 'TimeoutError';
  public readonly jobId: string;
  public readonly elapsedTime: number;
  public readonly timeoutDuration: number;
  public readonly retryable = true;

  constructor(jobId: string, elapsedTime: number, timeoutDuration: number) {
    super(
      `Job ${jobId} timed out after ${elapsedTime}ms (timeout: ${timeoutDuration}ms)`
    );

    this.jobId = jobId;
    this.elapsedTime = elapsedTime;
    this.timeoutDuration = timeoutDuration;

    // Maintain proper stack trace (V8 engine)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TimeoutError);
    }
  }
}

/**
 * TimeoutHandler - wraps job execution with timeout enforcement
 *
 * Uses Promise.race() to race job execution against a timeout promise.
 * Includes grace period (100ms) to handle race conditions where job completes
 * just after timeout fires, preferring success over timeout in edge cases.
 *
 * Responsibilities:
 * - Determine timeout (custom or default)
 * - Track job start time
 * - Create timeout promise with grace period
 * - Race job execution vs timeout
 * - Handle timeout: log, create TimeoutError
 * - Handle success: log, return result
 * - Cleanup timeout timers
 */
export class TimeoutHandler {
  private logger: QueueLogger;
  private config: TimeoutConfig;

  /**
   * Grace period in milliseconds for race condition handling
   *
   * If job completes within this period after timeout fires,
   * prefer success over timeout to avoid losing completed work.
   */
  private static readonly GRACE_PERIOD_MS = 100;

  /**
   * Default configuration
   */
  private static readonly DEFAULT_CONFIG: TimeoutConfig = {
    defaultTimeout: 600000, // 10 minutes
    enablePerJobOverride: true,
  };

  /**
   * Creates a new TimeoutHandler instance
   *
   * @param logger - Logger instance for structured logging
   * @param config - Optional timeout configuration
   */
  constructor(logger: QueueLogger, config?: Partial<TimeoutConfig>) {
    this.logger = logger;
    this.config = {
      ...TimeoutHandler.DEFAULT_CONFIG,
      ...config,
    };
  }

  /**
   * Get current configuration (for testing)
   *
   * @returns Current TimeoutConfig
   */
  public getConfig(): TimeoutConfig {
    return { ...this.config };
  }

  /**
   * Execute job with timeout enforcement
   *
   * Main timeout handling flow:
   * 1. Determine timeout (custom from job.data.timeout or default)
   * 2. Log execution start
   * 3. Track start time
   * 4. Create timeout promise (timeout + grace period)
   * 5. Race job execution vs timeout
   * 6. On success: log and return result
   * 7. On timeout: log, throw TimeoutError
   * 8. On error: propagate original error
   * 9. Cleanup timeout timer
   *
   * @param job - BullMQ Job instance
   * @param processor - JobProcessor instance to execute job
   * @param customTimeout - Optional timeout override (for testing)
   * @returns SpriteGenerationResult if job completes within timeout
   * @throws {TimeoutError} If job exceeds timeout
   * @throws {Error} If job processor throws error
   */
  public async executeWithTimeout(
    job: Job,
    processor: JobProcessor,
    customTimeout?: number
  ): Promise<SpriteGenerationResult> {
    // Step 1: Determine timeout
    const timeoutDuration = this.determineTimeout(job, customTimeout);
    const jobId = job.id || 'unknown';

    // Step 2: Log execution start
    this.logger.logInfo('timeout_handler_started', {
      jobId,
      timeoutDuration,
    });

    // Step 3: Track start time
    const startTime = Date.now();

    // Step 4: Create timeout promise with grace period
    let timeoutHandle: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        const elapsedTime = Date.now() - startTime;
        reject(new TimeoutError(jobId, elapsedTime, timeoutDuration));
      }, timeoutDuration + TimeoutHandler.GRACE_PERIOD_MS);
    });

    try {
      // Step 5: Race job execution vs timeout
      const result = await Promise.race<SpriteGenerationResult>([
        processor.processJob(job),
        timeoutPromise,
      ]);

      // Step 6: Success - log and return result
      const elapsedTime = Date.now() - startTime;
      this.logger.logInfo('timeout_handler_completed', {
        jobId,
        elapsedTime,
      });

      return result;
    } catch (error) {
      // Step 7: Handle timeout
      if (error instanceof TimeoutError) {
        this.logger.logError(jobId, error, {
          operation: 'executeWithTimeout',
          timeoutDuration,
          elapsedTime: error.elapsedTime,
        });
      }

      // Step 8: Propagate error (timeout or processor error)
      throw error;
    } finally {
      // Step 9: Cleanup timeout timer
      if (timeoutHandle !== undefined) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  /**
   * Determine timeout duration for job
   *
   * Priority order:
   * 1. Custom timeout parameter (for testing)
   * 2. Job data timeout (if enablePerJobOverride is true)
   * 3. Default timeout from config
   *
   * Validates timeout is a positive number, falls back to default if invalid.
   *
   * @param job - BullMQ Job instance
   * @param customTimeout - Optional custom timeout (for testing)
   * @returns Timeout duration in milliseconds
   */
  private determineTimeout(job: Job, customTimeout?: number): number {
    // Priority 1: Custom timeout (for testing)
    if (customTimeout !== undefined && this.isValidTimeout(customTimeout)) {
      return customTimeout;
    }

    // Priority 2: Job data timeout (if enabled)
    if (this.config.enablePerJobOverride && job.data?.timeout !== undefined) {
      const jobTimeout = job.data.timeout;

      if (this.isValidTimeout(jobTimeout)) {
        return jobTimeout;
      }
    }

    // Priority 3: Default timeout
    return this.config.defaultTimeout;
  }

  /**
   * Validate timeout value
   *
   * Timeout must be a number and >= 0 (zero timeout means immediate timeout).
   * Negative timeouts are invalid.
   *
   * @param timeout - Timeout value to validate
   * @returns True if timeout is valid
   */
  private isValidTimeout(timeout: any): timeout is number {
    return typeof timeout === 'number' && !isNaN(timeout) && timeout >= 0;
  }
}
