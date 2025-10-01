/**
 * Job stages for progress tracking
 */
export enum JobStage {
  DEDUPLICATION = 'deduplication',
  QUEUED = 'queued',
  PIXELLAB_GENERATION = 'pixellab_generation',
  CACHING = 'caching',
  COMPLETED = 'completed'
}

/**
 * Progress tracking data for time estimation
 */
interface ProgressSnapshot {
  progress: number;
  timestamp: number;
}

/**
 * Calculates job progress based on PixelLab API progress and internal stages.
 * Ensures monotonically increasing progress and provides time estimates.
 *
 * Stage mapping:
 * - Deduplication: 0-5%
 * - Queued: 5-10%
 * - PixelLab Generation: 10-90% (maps PixelLab 0-100 to 10-90)
 * - Caching: 90-100%
 * - Completed: 100%
 */
export class ProgressCalculator {
  /**
   * Last reported progress percentage (0-100)
   * Used to ensure progress never decreases
   */
  private lastProgress: number = 0;

  /**
   * Start time of progress tracking in milliseconds
   */
  private startTime: number | undefined;

  /**
   * History of progress snapshots for rate calculation
   */
  private progressHistory: ProgressSnapshot[] = [];

  /**
   * Maximum number of snapshots to keep for rate calculation
   */
  private readonly MAX_HISTORY_SIZE = 10;

  /**
   * Calculates overall progress percentage based on job stage and PixelLab progress.
   * Guarantees monotonically increasing progress (never decreases).
   *
   * @param stage - Current job stage
   * @param pixelLabProgress - Progress from PixelLab API (0-100)
   * @returns Overall progress percentage (0-100)
   */
  calculateProgress(stage: JobStage, pixelLabProgress: number): number {
    // Initialize start time on first call
    if (this.startTime === undefined) {
      this.startTime = Date.now();
    }

    // Clamp PixelLab progress to valid range
    const clampedPixelLabProgress = Math.max(0, Math.min(100, pixelLabProgress));

    // Calculate raw progress based on stage
    let rawProgress: number;

    switch (stage) {
      case JobStage.DEDUPLICATION:
        // Deduplication: 0-5%
        // For simplicity, we map the beginning of this stage to 0%
        // In a real implementation, you might track deduplication sub-progress
        rawProgress = 0;
        break;

      case JobStage.QUEUED:
        // Queued: 5-10%
        // Fixed at 5% when queued (could be enhanced with queue position)
        rawProgress = 5;
        break;

      case JobStage.PIXELLAB_GENERATION:
        // PixelLab Generation: 10-90%
        // Map PixelLab 0-100 to 10-90
        // Formula: 10 + (pixelLabProgress * 0.8)
        rawProgress = 10 + (clampedPixelLabProgress * 0.8);
        break;

      case JobStage.CACHING:
        // Caching: 90-100%
        // Fixed at 90% when caching starts
        rawProgress = 90;
        break;

      case JobStage.COMPLETED:
        // Completed: 100%
        rawProgress = 100;
        break;

      default:
        // Unknown stage - maintain last progress
        rawProgress = this.lastProgress;
    }

    // Ensure progress never decreases (monotonically increasing)
    const currentProgress = Math.max(rawProgress, this.lastProgress);

    // Update last progress
    this.lastProgress = currentProgress;

    // Record snapshot for time estimation
    this.recordProgressSnapshot(currentProgress);

    return Math.round(currentProgress);
  }

  /**
   * Estimates time remaining based on progress rate.
   * Returns null if:
   * - No progress has been made
   * - Progress is at 100%
   * - Progress rate is zero (stuck)
   *
   * @param currentProgress - Current progress percentage (0-100)
   * @returns Estimated time remaining in milliseconds, or null if cannot estimate
   */
  estimateTimeRemaining(currentProgress: number): number | null {
    // No estimate at completion
    if (currentProgress >= 100) {
      return null;
    }

    // No estimate without history
    if (this.progressHistory.length < 2) {
      return null;
    }

    // No estimate if no progress made
    if (currentProgress === 0) {
      return null;
    }

    // Calculate progress rate (percentage per millisecond)
    const rate = this.calculateProgressRate();

    // No estimate if rate is zero (stuck)
    if (rate === 0) {
      return null;
    }

    // Calculate remaining progress
    const remainingProgress = 100 - currentProgress;

    // Estimate time remaining
    const estimatedTime = remainingProgress / rate;

    return Math.round(estimatedTime);
  }

  /**
   * Resets progress tracking to initial state.
   * Call this when starting a new job.
   */
  reset(): void {
    this.lastProgress = 0;
    this.startTime = undefined;
    this.progressHistory = [];
  }

  /**
   * Records a progress snapshot for rate calculation.
   * Maintains a limited history to calculate recent progress rate.
   *
   * @param progress - Current progress percentage
   */
  private recordProgressSnapshot(progress: number): void {
    const now = Date.now();

    this.progressHistory.push({
      progress,
      timestamp: now
    });

    // Limit history size
    if (this.progressHistory.length > this.MAX_HISTORY_SIZE) {
      this.progressHistory.shift();
    }
  }

  /**
   * Calculates the current progress rate (percentage per millisecond).
   * Uses linear regression over recent progress history for smooth estimates.
   *
   * @returns Progress rate in percentage per millisecond
   */
  private calculateProgressRate(): number {
    if (this.progressHistory.length < 2) {
      return 0;
    }

    // Get first and last snapshots
    const first = this.progressHistory[0];
    const last = this.progressHistory[this.progressHistory.length - 1];

    // Type guard: should not happen due to length check above
    if (!first || !last) {
      return 0;
    }

    // Calculate time elapsed
    const timeElapsed = last.timestamp - first.timestamp;

    // No rate if no time has passed
    if (timeElapsed === 0) {
      return 0;
    }

    // Calculate progress change
    const progressChange = last.progress - first.progress;

    // No rate if no progress change
    if (progressChange === 0) {
      return 0;
    }

    // Calculate rate (percentage per millisecond)
    return progressChange / timeElapsed;
  }
}
