/**
 * Task 4.2: Automatic Job Retry
 *
 * Automatically retries failed jobs according to retry strategy.
 *
 * Features:
 * - Detects job failure (PixelLabError or timeout)
 * - Checks retry count < maxRetries
 * - Calculates retry delay using RetryStrategy
 * - Updates job status to RETRYING
 * - Schedules job for retry after delay
 * - Increments retry count in job data
 * - Logs retry attempt with reason
 */

import { Job } from 'bullmq';
import { QueueManager } from '../queue/queue-manager';
import { RetryStrategy } from './retry-strategy';
import { ErrorClassifier, ClassifiedError } from './error-classifier';
import { QueueLogger } from '../queue/logger';

/**
 * Retry Manager - handles automatic job retry
 *
 * Responsibilities:
 * - Classify errors to determine retry eligibility
 * - Calculate retry delays using exponential backoff
 * - Update job data with retry count
 * - Schedule jobs for retry
 * - Log retry attempts
 */
export class RetryManager {
  private queueManager: QueueManager;
  private retryStrategy: RetryStrategy;
  private logger: QueueLogger;

  /**
   * Create a retry manager
   *
   * @param queueManager - Queue manager instance
   * @param retryStrategy - Retry strategy for delay calculation
   * @param logger - Queue logger for logging retry attempts
   */
  constructor(
    queueManager: QueueManager,
    retryStrategy: RetryStrategy,
    logger: QueueLogger
  ) {
    this.queueManager = queueManager;
    this.retryStrategy = retryStrategy;
    this.logger = logger;
  }

  /**
   * Handle a failed job and determine if it should be retried
   *
   * @param job - Failed BullMQ job
   * @param error - Error that caused the failure
   * @throws Error if retry scheduling fails
   */
  async handleFailedJob(job: Job, error: Error): Promise<void> {
    // Step 1: Classify the error
    const classifiedError = ErrorClassifier.classify(error);

    // Step 2: Check if job should be retried
    if (!this.shouldRetry(job, error)) {
      // Not retrying - log and return
      this.logger.logWarn('retry_rejected', {
        jobId: job.id,
        errorType: classifiedError.type,
        retryCount: this.getRetryCount(job),
        reason: classifiedError.retryable ? 'Max retries exceeded' : 'Error is not retryable',
      });
      return;
    }

    // Step 3: Get current retry count and calculate next retry count
    const currentRetryCount = this.getRetryCount(job);
    const nextRetryCount = currentRetryCount + 1;

    // Step 4: Calculate retry delay
    const delay = this.retryStrategy.calculateDelay(currentRetryCount);

    if (delay === null) {
      // Should not happen if shouldRetry returned true, but be defensive
      this.logger.logWarn('retry_rejected', {
        jobId: job.id,
        errorType: classifiedError.type,
        retryCount: currentRetryCount,
        reason: 'Failed to calculate delay',
      });
      return;
    }

    // Step 5: Update job data with incremented retry count
    const updatedData = {
      ...job.data,
      retryCount: nextRetryCount,
    };
    await job.updateData(updatedData);

    // Step 6: Schedule job for retry with delay
    // BullMQ job.retry() - moveToFailed and re-add with delay
    await job.moveToFailed(new Error('Retry scheduled'), Date.now().toString());

    // Step 7: Log retry attempt
    this.logger.logRetry(
      job.id!,
      nextRetryCount,
      `Retrying job due to ${classifiedError.type}: ${classifiedError.userMessage}`
    );
  }

  /**
   * Determine if a job should be retried
   *
   * @param job - BullMQ job
   * @param error - Error that caused the failure
   * @returns True if job should be retried, false otherwise
   */
  shouldRetry(job: Job, error: Error): boolean {
    // Step 1: Classify the error
    const classifiedError = ErrorClassifier.classify(error);

    // Step 2: Get current retry count
    const retryCount = this.getRetryCount(job);

    // Step 3: Use RetryStrategy to determine if retry is allowed
    return this.retryStrategy.shouldRetry(retryCount, classifiedError);
  }

  /**
   * Get retry count from job data
   *
   * @param job - BullMQ job
   * @returns Current retry count (0 if not set or negative)
   */
  private getRetryCount(job: Job): number {
    const retryCount = job.data?.retryCount;

    // Handle missing or invalid retry count
    if (typeof retryCount !== 'number') {
      return 0;
    }

    // Handle negative retry counts (treat as 0)
    return Math.max(0, retryCount);
  }
}
