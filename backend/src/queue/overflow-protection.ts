/**
 * Task 5.2: Queue Overflow Protection
 *
 * Rejects job submissions when queue is at capacity, warns when near capacity.
 *
 * Features:
 * - Checks queue size before accepting job submission
 * - Rejects submission if queue size ≥ 500 (system limit)
 * - Warns user if queue size ≥ 400 (warning threshold)
 * - Calculates estimated wait time based on queue size and avg job duration
 * - Returns QueueOverflowWarning with details when near capacity
 * - Logs overflow events for monitoring
 *
 * Note on Race Conditions:
 * Queue size is checked at a point in time. Between the check and actual job
 * submission, the queue size could change. This is acceptable as BullMQ handles
 * the actual submission and this check provides user feedback about current load.
 */

import type { QueueSizeMonitor } from './queue-size-monitor.js';
import type { QueueLogger } from './logger.js';

/**
 * Result of queue capacity check
 */
export interface QueueOverflowResult {
  /** Whether job submission is allowed */
  allowed: boolean;

  /** Warning details if queue is near capacity (optional) */
  warning?: QueueOverflowWarning;

  /** Error message if queue is at capacity (optional) */
  error?: string;
}

/**
 * Warning details when queue is near capacity
 */
export interface QueueOverflowWarning {
  /** User-friendly warning message */
  message: string;

  /** Current total queue size (pending + processing) */
  currentQueueSize: number;

  /** Warning threshold that was exceeded */
  threshold: number;

  /** Estimated wait time in seconds */
  estimatedWaitTime: number;

  /** Whether user can proceed despite warning */
  canProceed: boolean;
}

/**
 * Configuration for overflow protection
 */
export interface OverflowProtectionConfig {
  /** Queue size that triggers warning (default: 400) */
  warningThreshold: number;

  /** Maximum queue size before rejection (default: 500) */
  maxQueueSize: number;

  /** Average job duration in seconds (default: 60) */
  averageJobDuration: number;

  /** Number of workers processing jobs (default: 1) */
  workerCount: number;
}

/**
 * Queue Overflow Protection
 *
 * Prevents queue overload by checking capacity before accepting jobs.
 * Provides user feedback about wait times and system load.
 */
export class OverflowProtection {
  private monitor: QueueSizeMonitor;
  private logger: QueueLogger;
  private config: OverflowProtectionConfig;

  /**
   * Default configuration values
   */
  private static readonly DEFAULT_CONFIG: OverflowProtectionConfig = {
    warningThreshold: 400,
    maxQueueSize: 500,
    averageJobDuration: 60, // seconds
    workerCount: 1,
  };

  /**
   * Creates a new OverflowProtection instance
   *
   * @param monitor - Queue size monitor for checking current queue size
   * @param logger - Logger for overflow events
   * @param config - Optional configuration overrides
   */
  constructor(
    monitor: QueueSizeMonitor,
    logger: QueueLogger,
    config?: Partial<OverflowProtectionConfig>
  ) {
    this.monitor = monitor;
    this.logger = logger;
    this.config = {
      ...OverflowProtection.DEFAULT_CONFIG,
      ...config,
    };
  }

  /**
   * Check if queue has capacity for new job
   *
   * Queries current queue size and determines if submission should be:
   * - Accepted (queue size < warning threshold)
   * - Accepted with warning (warning threshold ≤ queue size < max size)
   * - Rejected (queue size ≥ max size)
   *
   * Also calculates estimated wait time for user feedback.
   *
   * @returns Queue overflow result with allow/warn/reject status
   * @throws {Error} if queue size check fails
   */
  async checkCapacity(): Promise<QueueOverflowResult> {
    try {
      // Get current queue metrics from monitor
      const metrics = await this.monitor.getQueueSize();
      const currentSize = metrics.total;

      // Check if queue is at capacity (critical threshold)
      if (currentSize >= this.config.maxQueueSize) {
        return this.handleOverflow(currentSize);
      }

      // Check if queue is near capacity (warning threshold)
      if (currentSize >= this.config.warningThreshold) {
        return this.handleWarning(currentSize);
      }

      // Queue has capacity - accept job
      return {
        allowed: true,
      };
    } catch (error) {
      // Log error and propagate
      this.logger.logWarn('queue_overflow_check_failed', {
        error: (error as Error).message,
      });

      throw new Error(
        `Failed to check queue capacity: ${(error as Error).message}`
      );
    }
  }

  /**
   * Handle queue overflow (at or above max size)
   *
   * @param currentSize - Current queue size
   * @returns Rejection result with error message
   */
  private handleOverflow(currentSize: number): QueueOverflowResult {
    const errorMessage = `Queue is at capacity (${currentSize}/${this.config.maxQueueSize}). Please try again later.`;

    // Log overflow event
    this.logger.logWarn('queue_overflow_rejected', {
      currentQueueSize: currentSize,
      maxQueueSize: this.config.maxQueueSize,
    });

    return {
      allowed: false,
      error: errorMessage,
    };
  }

  /**
   * Handle queue near capacity (warning threshold)
   *
   * @param currentSize - Current queue size
   * @returns Acceptance result with warning
   */
  private handleWarning(currentSize: number): QueueOverflowResult {
    const estimatedWaitTime = this.calculateWaitTime(currentSize);

    const warning: QueueOverflowWarning = {
      message: `Queue is near capacity (${currentSize}/${this.config.maxQueueSize}). Your job may experience delays.`,
      currentQueueSize: currentSize,
      threshold: this.config.warningThreshold,
      estimatedWaitTime,
      canProceed: true,
    };

    // Log warning event
    this.logger.logWarn('queue_overflow_warning', {
      currentQueueSize: currentSize,
      threshold: this.config.warningThreshold,
      estimatedWaitTime,
    });

    return {
      allowed: true,
      warning,
    };
  }

  /**
   * Calculate estimated wait time based on queue size
   *
   * Formula: (queueSize * averageJobDuration) / workerCount
   *
   * @param queueSize - Current total queue size
   * @returns Estimated wait time in seconds
   */
  private calculateWaitTime(queueSize: number): number {
    const { averageJobDuration, workerCount } = this.config;

    // Calculate total processing time needed
    const totalTime = queueSize * averageJobDuration;

    // Divide by number of workers (parallel processing)
    const waitTime = totalTime / workerCount;

    return Math.round(waitTime);
  }
}
