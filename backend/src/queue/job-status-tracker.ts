/**
 * Task 1.4: Implement Job Status Tracking
 *
 * Tracks job state transitions and provides status query interface.
 * Queries BullMQ for job state, returns job status/progress/timestamps,
 * handles job not found (404), lists user's jobs, and provides queue metrics.
 */

import type { Job } from 'bullmq';
import type { QueueManager, QueueServiceConfig } from './queue-manager.js';
import type { QueueLogger } from './logger.js';

/**
 * Job status enum
 */
export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying',
  CACHED = 'cached',
}

/**
 * Structured prompt from prompt-builder
 */
export interface StructuredPrompt {
  type: string;
  style: string;
  size: { width: number; height: number };
  action: string;
  description: string;
  raw: string;
  options?: {
    noBackground?: boolean;
    textGuidanceScale?: number;
    paletteImage?: string;
  };
}

/**
 * Sprite generation result
 */
export interface SpriteGenerationResult {
  jobId: string;
  frames: Buffer[];
  metadata: {
    dimensions: { width: number; height: number };
    frameCount: number;
    generationTimeMs: number;
    cacheHit: boolean;
    pixelLabJobId?: string;
  };
}

/**
 * Queue job data structure
 */
export interface QueueJob {
  jobId: string;
  userId: string;
  structuredPrompt: StructuredPrompt;
  cacheKey: string;
  status: JobStatus;
  progress: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  retryCount: number;
  pixelLabJobId?: string;
  errorMessage?: string;
  result?: SpriteGenerationResult;
  metadata: {
    estimatedDuration?: number;
    actualDuration?: number;
    cacheHit: boolean;
  };
}

/**
 * Queue metrics for observability
 */
export interface QueueMetrics {
  queue: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    dlqSize: number;
  };
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
    size: number;
  };
  performance: {
    avgJobDuration: number;
    avgQueueWaitTime: number;
    p95JobDuration: number;
  };
  users: {
    activeUsers: number;
    topUsers: Array<{ userId: string; activeJobs: number }>;
  };
}

/**
 * Job Status Tracker - tracks job state transitions and provides status queries
 *
 * Responsibilities:
 * - Query BullMQ for job state
 * - Return job status, progress, timestamps
 * - Handle job not found (404)
 * - List user's jobs
 * - Provide queue-wide metrics
 * - Track state transitions (pending → processing → completed/failed)
 */
export class JobStatusTracker {
  private queueManager: QueueManager;
  private config: QueueServiceConfig;
  private logger: QueueLogger;

  /**
   * Creates a new JobStatusTracker instance
   *
   * @param queueManager - QueueManager instance for accessing BullMQ queue
   * @param config - Queue service configuration
   * @param logger - Logger instance for structured logging
   */
  constructor(
    queueManager: QueueManager,
    config: QueueServiceConfig,
    logger: QueueLogger
  ) {
    this.queueManager = queueManager;
    this.config = config;
    this.logger = logger;
  }

  /**
   * Get job status by job ID
   *
   * Queries BullMQ for the job and returns its current state including
   * status, progress, timestamps, and result data if completed.
   *
   * @param jobId - Unique job identifier
   * @returns QueueJob object or null if job not found
   */
  async getJobStatus(jobId: string): Promise<QueueJob | null> {
    try {
      const queue = this.queueManager.getQueue();
      const bullJob = await queue.getJob(jobId);

      if (!bullJob) {
        this.logger.logInfo('job_status_not_found', { jobId });
        return null;
      }

      return this.mapBullJobToQueueJob(bullJob);
    } catch (error) {
      this.logger.logError(jobId, error as Error, {
        operation: 'getJobStatus',
      });
      throw error;
    }
  }

  /**
   * Get all jobs for a specific user
   *
   * Retrieves all jobs (pending, processing, completed, failed) for the
   * specified user ID. Useful for displaying user's job history.
   *
   * @param userId - User identifier
   * @returns Array of QueueJob objects (empty array if no jobs)
   */
  async getUserJobs(userId: string): Promise<QueueJob[]> {
    try {
      const queue = this.queueManager.getQueue();

      // Get jobs in all states
      const states = ['waiting', 'active', 'completed', 'failed', 'delayed'] as const;
      const allJobs: Job[] = [];

      for (const state of states) {
        const jobs = await queue.getJobs([state], 0, -1);
        allJobs.push(...jobs);
      }

      // Filter by userId and map to QueueJob
      const userJobs = allJobs
        .filter((job) => job.data?.userId === userId)
        .map((job) => this.mapBullJobToQueueJob(job));

      this.logger.logInfo('user_jobs_retrieved', {
        userId,
        jobCount: userJobs.length,
      });

      return userJobs;
    } catch (error) {
      this.logger.logError('user-jobs-query', error as Error, {
        operation: 'getUserJobs',
        userId,
      });
      throw error;
    }
  }

  /**
   * Get queue-wide metrics
   *
   * Returns comprehensive metrics about the queue including job counts,
   * cache statistics, performance metrics, and user activity.
   *
   * @returns QueueMetrics object with queue statistics
   */
  async getQueueMetrics(): Promise<QueueMetrics> {
    try {
      const queue = this.queueManager.getQueue();

      // Get job counts by state
      const counts = await queue.getJobCounts();

      // Calculate DLQ size (failed jobs that exceeded max retries)
      const failedJobs = await queue.getJobs(['failed'], 0, -1);
      const dlqSize = failedJobs.filter(
        (job) => job.attemptsMade >= this.config.retry.maxRetries + 1
      ).length;

      // For MVP, return basic metrics
      // Cache, performance, and user metrics will be enhanced in future tasks
      const metrics: QueueMetrics = {
        queue: {
          pending: (typeof counts['waiting'] === 'number' ? counts['waiting'] : 0) || 0,
          processing: (typeof counts['active'] === 'number' ? counts['active'] : 0) || 0,
          completed: (typeof counts['completed'] === 'number' ? counts['completed'] : 0) || 0,
          failed: (typeof counts['failed'] === 'number' ? counts['failed'] : 0) || 0,
          dlqSize,
        },
        cache: {
          hits: 0, // Will be tracked by CacheManager (Task 2.6)
          misses: 0,
          hitRate: 0,
          size: 0,
        },
        performance: {
          avgJobDuration: 0, // Will be tracked by MetricsCollector (Task 7.1)
          avgQueueWaitTime: 0,
          p95JobDuration: 0,
        },
        users: {
          activeUsers: 0, // Will be tracked by MetricsCollector (Task 7.1)
          topUsers: [],
        },
      };

      this.logger.logInfo('queue_metrics_retrieved', {
        pending: metrics.queue.pending,
        processing: metrics.queue.processing,
        completed: metrics.queue.completed,
        failed: metrics.queue.failed,
        dlqSize: metrics.queue.dlqSize,
      });

      return metrics;
    } catch (error) {
      this.logger.logError('queue-metrics', error as Error, {
        operation: 'getQueueMetrics',
      });
      throw error;
    }
  }

  /**
   * Map BullMQ Job to QueueJob interface
   *
   * Converts BullMQ's internal job representation to our domain model,
   * determining status based on job state and attempt count.
   *
   * @param bullJob - BullMQ Job instance
   * @returns QueueJob object
   */
  private mapBullJobToQueueJob(bullJob: Job): QueueJob {
    const status = this.determineJobStatus(bullJob);
    const progress = this.calculateProgress(bullJob, status);

    // Build base job object
    const queueJob: QueueJob = {
      jobId: bullJob.id!,
      userId: bullJob.data?.userId || 'unknown',
      structuredPrompt: bullJob.data?.structuredPrompt || this.getDefaultPrompt(),
      cacheKey: bullJob.data?.cacheKey || '',
      status,
      progress,
      createdAt: bullJob.timestamp,
      retryCount: bullJob.attemptsMade,
      metadata: {
        cacheHit: bullJob.data?.metadata?.cacheHit || false,
      },
    };

    // Add optional fields only if they exist (exactOptionalPropertyTypes compliance)
    if (bullJob.processedOn !== undefined) {
      queueJob.startedAt = bullJob.processedOn;
    }

    if (bullJob.finishedOn !== undefined) {
      queueJob.completedAt = bullJob.finishedOn;
    }

    if (bullJob.data?.pixelLabJobId !== undefined) {
      queueJob.pixelLabJobId = bullJob.data.pixelLabJobId;
    }

    if (bullJob.failedReason !== undefined) {
      queueJob.errorMessage = bullJob.failedReason;
    }

    if (bullJob.returnvalue !== undefined) {
      queueJob.result = bullJob.returnvalue;
    }

    if (bullJob.data?.metadata?.estimatedDuration !== undefined) {
      queueJob.metadata.estimatedDuration = bullJob.data.metadata.estimatedDuration;
    }

    if (bullJob.data?.metadata?.actualDuration !== undefined) {
      queueJob.metadata.actualDuration = bullJob.data.metadata.actualDuration;
    }

    return queueJob;
  }

  /**
   * Determine job status from BullMQ job state
   *
   * Maps BullMQ's job state and attempt count to our JobStatus enum.
   *
   * @param bullJob - BullMQ Job instance
   * @returns JobStatus enum value
   */
  private determineJobStatus(bullJob: Job): JobStatus {
    // Completed successfully
    if (bullJob.finishedOn && bullJob.returnvalue) {
      return JobStatus.COMPLETED;
    }

    // Failed permanently (exceeded max retries)
    if (
      bullJob.finishedOn &&
      bullJob.failedReason &&
      bullJob.attemptsMade >= this.config.retry.maxRetries + 1
    ) {
      return JobStatus.FAILED;
    }

    // Currently retrying (has failed but not finished yet)
    if (bullJob.attemptsMade > 0 && !bullJob.finishedOn) {
      return JobStatus.RETRYING;
    }

    // Currently processing
    if (bullJob.processedOn && !bullJob.finishedOn) {
      return JobStatus.PROCESSING;
    }

    // Waiting in queue
    return JobStatus.PENDING;
  }

  /**
   * Calculate job progress percentage
   *
   * Returns progress as 0-100 based on job state and stored progress value.
   *
   * @param bullJob - BullMQ Job instance
   * @param status - Determined job status
   * @returns Progress percentage (0-100)
   */
  private calculateProgress(bullJob: Job, status: JobStatus): number {
    // Completed jobs are always 100%
    if (status === JobStatus.COMPLETED) {
      return 100;
    }

    // Get progress value safely (could be number, string, boolean, or object in BullMQ)
    const progressValue = bullJob.progress;
    let progress = 0;

    if (typeof progressValue === 'number') {
      progress = progressValue;
    } else if (typeof progressValue === 'string') {
      const parsed = parseFloat(progressValue);
      progress = isNaN(parsed) ? 0 : parsed;
    }

    // Failed jobs keep their last progress value (or 0)
    if (status === JobStatus.FAILED) {
      return progress;
    }

    // Use stored progress value, default to 0 for pending jobs
    return progress;
  }

  /**
   * Get default prompt for jobs with missing data
   *
   * @returns Default StructuredPrompt object
   */
  private getDefaultPrompt(): StructuredPrompt {
    return {
      type: 'unknown',
      style: 'unknown',
      size: { width: 0, height: 0 },
      action: 'unknown',
      description: 'Unknown prompt',
      raw: 'Unknown',
    };
  }
}
