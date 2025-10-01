/**
 * Task 3.4: Integrate Progress Updates with Job Processor
 *
 * Orchestrates progress tracking and broadcasting by coordinating:
 * - PixelLab API polling for progress updates
 * - Progress calculation and mapping
 * - SSE broadcasting to connected clients
 * - BullMQ job progress updates
 * - State change and completion notifications
 */

import type { Job } from 'bullmq';
import type { SSEManager, ProgressUpdate } from './sse-manager.js';
import type { ProgressCalculator } from './progress-calculator.js';
import { JobStage } from './progress-calculator.js';
import type { QueueLogger } from '../queue/logger.js';
import type { QueueServiceConfig } from '../queue/queue-manager.js';
import { JobStatus, type SpriteGenerationResult } from '../queue/job-status-tracker.js';

/**
 * PixelLab progress response from polling function
 */
export interface PixelLabProgress {
  /** Progress percentage from PixelLab (0-100) */
  progress: number;
  /** Current status from PixelLab */
  status: string;
}

/**
 * Progress Integrator - orchestrates progress tracking and broadcasting
 *
 * Responsibilities:
 * - Poll PixelLab API at configured intervals
 * - Calculate overall progress using ProgressCalculator
 * - Broadcast updates via SSE to user's connections
 * - Update BullMQ job progress for polling clients
 * - Broadcast state changes and completion events
 * - Handle errors gracefully without stopping job processing
 */
export class ProgressIntegrator {
  private sseManager: SSEManager;
  private progressCalculator: ProgressCalculator;
  private config: QueueServiceConfig;
  private logger: QueueLogger;

  /**
   * Last known PixelLab progress (used when polling fails)
   */
  private lastKnownProgress: number = 0;

  /**
   * Creates a new ProgressIntegrator instance
   *
   * @param sseManager - SSE manager for broadcasting updates
   * @param progressCalculator - Progress calculator for mapping stages
   * @param config - Queue service configuration
   * @param logger - Logger instance for structured logging
   */
  constructor(
    sseManager: SSEManager,
    progressCalculator: ProgressCalculator,
    config: QueueServiceConfig,
    logger: QueueLogger
  ) {
    this.sseManager = sseManager;
    this.progressCalculator = progressCalculator;
    this.config = config;
    this.logger = logger;
  }

  /**
   * Track progress for a PixelLab job with periodic polling
   *
   * Polls the provided function at configured intervals to fetch PixelLab progress,
   * calculates overall progress, and broadcasts updates via SSE and BullMQ.
   * Continues until job completes (progress 100 or status 'completed').
   *
   * @param job - BullMQ job instance to update
   * @param pixelLabJobId - PixelLab API job ID for logging
   * @param userId - User ID for broadcasting updates
   * @param getProgressFn - Function to fetch current PixelLab progress
   */
  async trackProgress(
    job: Job,
    pixelLabJobId: string,
    userId: string,
    getProgressFn: () => Promise<PixelLabProgress>
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      const interval = setInterval(async () => {
        try {
          // Poll PixelLab API
          const pixelLabProgress = await getProgressFn();

          // Update last known progress
          this.lastKnownProgress = pixelLabProgress.progress;

          // Calculate overall progress
          const overallProgress = this.progressCalculator.calculateProgress(
            JobStage.PIXELLAB_GENERATION,
            pixelLabProgress.progress
          );

          // Get time estimate
          const estimatedTimeRemaining = this.progressCalculator.estimateTimeRemaining(
            overallProgress
          );

          // Update BullMQ job progress
          await job.updateProgress(overallProgress);

          // Check if job is complete (after updating progress)
          if (pixelLabProgress.progress >= 100 || pixelLabProgress.status === 'completed') {
            clearInterval(interval);
            resolve();
            return;
          }

          // Broadcast progress update via SSE
          try {
            const update: ProgressUpdate = {
              jobId: job.id!,
              userId,
              status: JobStatus.PROCESSING,
              progress: overallProgress,
              message: 'Generating sprites...',
              timestamp: Date.now(),
            };

            // Add time estimate if available
            if (estimatedTimeRemaining !== null) {
              update.estimatedTimeRemaining = estimatedTimeRemaining;
            }

            this.sseManager.broadcast(userId, update);
          } catch (error) {
            // SSE broadcast failed - log warning but continue processing
            this.logger.logWarn('sse_broadcast_error', {
              jobId: job.id!,
              userId,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        } catch (error) {
          // PixelLab polling failed - log warning and use last known progress
          this.logger.logWarn('progress_poll_error', {
            jobId: job.id!,
            pixelLabJobId,
            error: error instanceof Error ? error.message : String(error),
          });

          // Continue with last known progress
          const overallProgress = this.progressCalculator.calculateProgress(
            JobStage.PIXELLAB_GENERATION,
            this.lastKnownProgress
          );

          // Still try to broadcast with last known progress
          try {
            const update: ProgressUpdate = {
              jobId: job.id!,
              userId,
              status: JobStatus.PROCESSING,
              progress: overallProgress,
              message: 'Generating sprites...',
              timestamp: Date.now(),
            };

            this.sseManager.broadcast(userId, update);
          } catch (broadcastError) {
            // Log but continue
            this.logger.logWarn('sse_broadcast_error', {
              jobId: job.id!,
              userId,
              error: broadcastError instanceof Error ? broadcastError.message : String(broadcastError),
            });
          }
        }
      }, this.config.sse.updateInterval);
    });
  }

  /**
   * Broadcast a state change event
   *
   * Broadcasts job state transition (e.g., pending → processing) to all
   * user connections via SSE. Used by job processor to notify clients
   * of major state changes.
   *
   * @param jobId - Job identifier
   * @param userId - User ID for broadcasting
   * @param fromState - Previous job status
   * @param toState - New job status
   */
  async broadcastStateChange(
    jobId: string,
    userId: string,
    fromState: JobStatus,
    toState: JobStatus
  ): Promise<void> {
    try {
      // Format state change message
      const message = this.formatStateMessage(toState);
      const progress = this.getProgressForState(toState);

      const update: ProgressUpdate = {
        jobId,
        userId,
        status: toState,
        progress,
        message,
        timestamp: Date.now(),
      };

      // Broadcast via SSE
      this.sseManager.broadcast(userId, update);

      // Log state change
      this.logger.logInfo('state_change_broadcast', {
        jobId,
        userId,
        fromState,
        toState,
      });
    } catch (error) {
      // SSE broadcast failed - log warning but don't throw
      this.logger.logWarn('sse_broadcast_error', {
        jobId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Broadcast job completion with result
   *
   * Sends final completion notification via SSE with result metadata.
   * Does not include frame buffers (too large for SSE).
   *
   * @param jobId - Job identifier
   * @param userId - User ID for broadcasting
   * @param result - Sprite generation result
   */
  async broadcastCompletion(
    jobId: string,
    userId: string,
    result: SpriteGenerationResult
  ): Promise<void> {
    try {
      // Create result summary without frame buffers (too large for SSE)
      const resultSummary = {
        jobId: result.jobId,
        frameCount: result.metadata.frameCount,
        dimensions: result.metadata.dimensions,
        generationTimeMs: result.metadata.generationTimeMs,
        cacheHit: result.metadata.cacheHit,
      };

      const update: ProgressUpdate = {
        jobId,
        userId,
        status: JobStatus.COMPLETED,
        progress: 100,
        message: 'Generation complete',
        timestamp: Date.now(),
      };

      // Add result to update (will be sent as JSON)
      (update as any).result = resultSummary;

      // Broadcast via SSE
      this.sseManager.broadcast(userId, update);

      // Log completion broadcast
      this.logger.logInfo('completion_broadcast', {
        jobId,
        userId,
        frameCount: result.metadata.frameCount,
        cacheHit: result.metadata.cacheHit,
      });
    } catch (error) {
      // SSE broadcast failed - log warning but don't throw
      this.logger.logWarn('sse_broadcast_error', {
        jobId,
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Format human-readable message for job state
   *
   * @param state - Job status
   * @returns Human-readable message
   */
  private formatStateMessage(state: JobStatus): string {
    switch (state) {
      case JobStatus.PENDING:
        return 'Job queued';
      case JobStatus.PROCESSING:
        return 'Job started processing';
      case JobStatus.COMPLETED:
        return 'Job completed successfully';
      case JobStatus.FAILED:
        return 'Job failed';
      case JobStatus.RETRYING:
        return 'Job retrying after error';
      case JobStatus.CACHED:
        return 'Result retrieved from cache';
      default:
        return 'Job status updated';
    }
  }

  /**
   * Get progress percentage for job state
   *
   * @param state - Job status
   * @returns Progress percentage (0-100)
   */
  private getProgressForState(state: JobStatus): number {
    switch (state) {
      case JobStatus.PENDING:
        return 0;
      case JobStatus.PROCESSING:
        return 10;
      case JobStatus.COMPLETED:
        return 100;
      case JobStatus.CACHED:
        return 100;
      case JobStatus.FAILED:
        return 0;
      case JobStatus.RETRYING:
        return 5;
      default:
        return 0;
    }
  }
}
