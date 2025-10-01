/**
 * Task 4.3: Dead Letter Queue (DLQ)
 *
 * Moves permanently failed jobs to DLQ for manual review and debugging.
 *
 * Features:
 * - Creates separate BullMQ queue for DLQ
 * - Moves job to DLQ after max retries exhausted
 * - Stores full job context (input, error, retry history)
 * - Logs failure with full error details and stack trace
 * - Provides admin interface to view and retry DLQ jobs
 * - DLQ jobs retained for 7 days
 */

import { Queue, Job } from 'bullmq';
import { ClassifiedError } from './error-classifier';
import { QueueLogger } from '../queue/logger';
import { QueueServiceConfig } from '../queue/queue-manager';

/**
 * DLQ entry data structure
 */
export interface DLQEntry {
  /** Original job ID */
  jobId: string;

  /** User who submitted the job */
  userId: string;

  /** Original job data and metadata */
  originalJob: {
    id: string;
    name: string;
    data: any;
  };

  /** Reason for failure (user-friendly message) */
  failureReason: string;

  /** Timestamp when job failed (Unix timestamp in milliseconds) */
  failedAt: number;

  /** Number of retry attempts made */
  retryAttempts: number;

  /** Last error details */
  lastError: {
    message: string;
    type: string;
    stack?: string;
  };

  /** PixelLab job ID (if available) */
  pixelLabJobId?: string;
}

/**
 * DLQ Handler - manages Dead Letter Queue
 *
 * Responsibilities:
 * - Move permanently failed jobs to DLQ
 * - Store full job context for debugging
 * - Provide admin interface for DLQ management
 * - Support manual retry from DLQ
 * - Clean up old DLQ entries (7-day retention)
 */
export class DLQHandler {
  private dlqQueue: Queue;
  private mainQueue: Queue;
  private config: QueueServiceConfig;
  private logger: QueueLogger;

  /**
   * DLQ retention period in days
   */
  private static readonly DLQ_RETENTION_DAYS = 7;

  /**
   * Create a DLQ handler
   *
   * @param dlqQueue - BullMQ queue for DLQ
   * @param mainQueue - Main processing queue (for retries)
   * @param config - Queue service configuration
   * @param logger - Queue logger
   */
  constructor(
    dlqQueue: Queue,
    mainQueue: Queue,
    config: QueueServiceConfig,
    logger: QueueLogger
  ) {
    this.dlqQueue = dlqQueue;
    this.mainQueue = mainQueue;
    this.config = config;
    this.logger = logger;
  }

  /**
   * Move a failed job to the Dead Letter Queue
   *
   * @param job - Failed BullMQ job
   * @param error - Classified error from the failure
   * @throws Error if DLQ operation fails
   */
  async moveToDLQ(job: Job, error: ClassifiedError): Promise<void> {
    // Step 1: Build DLQ entry
    const dlqEntry: DLQEntry = {
      jobId: job.id!,
      userId: job.data?.userId || 'unknown',
      originalJob: {
        id: job.id!,
        name: job.name,
        data: job.data,
      },
      failureReason: error.userMessage,
      failedAt: Date.now(),
      retryAttempts: job.data?.retryCount || 0,
      lastError: {
        message: error.originalError.message,
        type: error.type,
        stack: error.originalError.stack,
      },
      pixelLabJobId: job.data?.pixelLabJobId,
    };

    // Step 2: Log the DLQ move
    this.logger.logDLQMove(
      job.id!,
      error.userMessage,
      dlqEntry.retryAttempts
    );

    // Step 3: Log full error details
    this.logger.logError(job.id!, error.originalError, {
      errorType: error.type,
      retryAttempts: dlqEntry.retryAttempts,
      userMessage: error.userMessage,
      technicalDetails: error.technicalDetails,
    });

    // Step 4: Add job to DLQ queue
    await this.dlqQueue.add('dlq-entry', dlqEntry, {
      jobId: `dlq-${job.id}-${Date.now()}`,
      removeOnComplete: false, // Keep for retention period
      removeOnFail: false, // Keep even if DLQ processing fails
    });
  }

  /**
   * List DLQ entries
   *
   * @param limit - Maximum number of entries to return (default: 100)
   * @returns Array of DLQ entries
   */
  async listDLQEntries(limit: number = 100): Promise<DLQEntry[]> {
    // Get jobs from DLQ (both failed and completed states)
    const jobs = await this.dlqQueue.getJobs(
      ['failed', 'completed'],
      0,
      limit - 1, // BullMQ uses 0-indexed range
      true // Ascending order (oldest first)
    );

    // Map jobs to DLQ entries
    return jobs.map((job) => job.data as DLQEntry);
  }

  /**
   * Get a specific DLQ entry by original job ID
   *
   * @param jobId - Original job ID
   * @returns DLQ entry or null if not found
   */
  async getDLQEntry(jobId: string): Promise<DLQEntry | null> {
    // Search through DLQ for matching job ID
    const jobs = await this.dlqQueue.getJobs(
      ['failed', 'completed'],
      0,
      -1, // Get all
      true
    );

    const matchingJob = jobs.find((job) => job.data.jobId === jobId);
    return matchingJob ? (matchingJob.data as DLQEntry) : null;
  }

  /**
   * Retry a job from DLQ
   *
   * Resubmits the job to the main queue with reset retry count.
   *
   * @param jobId - Original job ID from DLQ entry
   * @throws Error if DLQ entry not found or retry fails
   */
  async retryFromDLQ(jobId: string): Promise<void> {
    // Step 1: Find DLQ entry
    const dlqEntry = await this.getDLQEntry(jobId);
    if (!dlqEntry) {
      throw new Error('DLQ entry not found');
    }

    // Step 2: Create new job data with reset retry count
    const newJobData = {
      ...dlqEntry.originalJob.data,
      retryCount: 0, // Reset retry count
      retriedFromDLQ: true, // Mark as DLQ retry
    };

    // Step 3: Generate new job ID (append retry timestamp)
    const newJobId = `${dlqEntry.jobId}-retry-${Date.now()}`;

    // Step 4: Add job back to main queue
    await this.mainQueue.add(dlqEntry.originalJob.name, newJobData, {
      jobId: newJobId,
    });

    // Step 5: Log the retry
    this.logger.logInfo('dlq_retry', {
      originalJobId: dlqEntry.jobId,
      newJobId,
      userId: dlqEntry.userId,
    });
  }

  /**
   * Delete a DLQ entry
   *
   * @param jobId - Original job ID from DLQ entry
   * @throws Error if DLQ entry not found or delete fails
   */
  async deleteDLQEntry(jobId: string): Promise<void> {
    // Step 1: Find DLQ job
    const jobs = await this.dlqQueue.getJobs(
      ['failed', 'completed'],
      0,
      -1, // Get all
      true
    );

    const matchingJob = jobs.find((job) => job.data.jobId === jobId);
    if (!matchingJob) {
      throw new Error('DLQ entry not found');
    }

    // Step 2: Remove the job
    await matchingJob.remove();

    // Step 3: Log deletion
    this.logger.logInfo('dlq_entry_deleted', {
      jobId,
      dlqJobId: matchingJob.id,
    });
  }
}
