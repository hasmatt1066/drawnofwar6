/**
 * Task 5.1: Queue Size Monitoring
 *
 * Tracks current queue size and provides real-time metrics with caching and alerting.
 *
 * Features:
 * - Queries BullMQ for job counts by state
 * - Provides real-time queue size via getQueueSize() method
 * - Caches result for 1 second to avoid excessive Redis queries
 * - Emits warning event when queue size exceeds threshold (400)
 * - Emits critical event when queue reaches limit (500)
 * - Provides metrics for observability (Prometheus/Grafana)
 */

import { EventEmitter } from 'events';
import type { QueueManager } from './queue-manager.js';
import type { QueueLogger } from './logger.js';

/**
 * Queue size metrics returned by monitoring
 */
export interface QueueSizeMetrics {
  /** Total number of jobs in queue (pending + processing) */
  total: number;

  /** Number of jobs waiting to be processed */
  pending: number;

  /** Number of jobs currently being processed */
  processing: number;

  /** Number of completed jobs */
  completed: number;

  /** Number of failed jobs */
  failed: number;

  /** Timestamp when metrics were collected (ms since epoch) */
  timestamp: number;
}

/**
 * Configuration for queue size monitoring
 */
export interface QueueSizeMonitorConfig {
  /** Queue size threshold that triggers warning event (default: 400) */
  warningThreshold: number;

  /** Queue size threshold that triggers critical event (default: 500) */
  criticalThreshold: number;

  /** How long to cache metrics in milliseconds (default: 1000) */
  cacheDuration: number;
}

/**
 * Event data emitted when threshold is exceeded
 */
export interface QueueThresholdEvent {
  /** Current queue size */
  total: number;

  /** Threshold that was exceeded */
  threshold: number;

  /** Full metrics snapshot */
  metrics: QueueSizeMetrics;
}

/**
 * Queue Size Monitor
 *
 * Monitors BullMQ queue size in real-time with caching and threshold alerting.
 * Emits events when queue size exceeds warning or critical thresholds.
 *
 * Events:
 * - 'warning': Emitted when queue size >= warningThreshold
 * - 'critical': Emitted when queue size >= criticalThreshold
 */
export class QueueSizeMonitor extends EventEmitter {
  private queueManager: QueueManager;
  private logger: QueueLogger;
  private config: QueueSizeMonitorConfig;

  /** Cached metrics */
  private cachedMetrics: QueueSizeMetrics | null = null;

  /** Timestamp when cache was last updated */
  private cacheTimestamp: number = 0;

  /** Track if warning was already emitted for current cache period */
  private warningEmitted = false;

  /** Track if critical was already emitted for current cache period */
  private criticalEmitted = false;

  /**
   * Default configuration values
   */
  private static readonly DEFAULT_CONFIG: QueueSizeMonitorConfig = {
    warningThreshold: 400,
    criticalThreshold: 500,
    cacheDuration: 1000, // 1 second
  };

  /**
   * Creates a new QueueSizeMonitor instance
   *
   * @param queueManager - Queue manager for accessing BullMQ queue
   * @param logger - Logger instance for structured logging
   * @param config - Optional monitoring configuration
   */
  constructor(
    queueManager: QueueManager,
    logger: QueueLogger,
    config?: Partial<QueueSizeMonitorConfig>
  ) {
    super();
    this.queueManager = queueManager;
    this.logger = logger;
    this.config = {
      ...QueueSizeMonitor.DEFAULT_CONFIG,
      ...config,
    };
  }

  /**
   * Get current queue size with caching
   *
   * Queries BullMQ for job counts and returns metrics. Results are cached
   * for the configured cache duration to reduce Redis load.
   *
   * Emits 'warning' event if queue size >= warningThreshold
   * Emits 'critical' event if queue size >= criticalThreshold
   *
   * @returns Queue size metrics
   * @throws {Error} if Redis query fails and no cached value available
   */
  async getQueueSize(): Promise<QueueSizeMetrics> {
    const now = Date.now();

    // Check if cache is still valid
    if (this.isCacheValid(now)) {
      return this.cachedMetrics!;
    }

    try {
      // Query BullMQ for job counts
      const metrics = await this.queryQueueMetrics(now);

      // Update cache
      this.updateCache(metrics, now);

      // Check thresholds and emit events
      this.checkThresholds(metrics);

      return metrics;
    } catch (error) {
      // If query fails but we have cached data, return it
      if (this.cachedMetrics) {
        this.logger.logWarn('queue_size_monitor_fallback_to_cache', {
          error: (error as Error).message,
        });
        return this.cachedMetrics;
      }

      // No cached data available, propagate error
      throw new Error(`Failed to get queue size: ${(error as Error).message}`);
    }
  }

  /**
   * Check if cached metrics are still valid
   *
   * @param now - Current timestamp
   * @returns True if cache is valid
   */
  private isCacheValid(now: number): boolean {
    return (
      this.cachedMetrics !== null &&
      now - this.cacheTimestamp < this.config.cacheDuration
    );
  }

  /**
   * Query BullMQ for current job counts and build metrics
   *
   * @param timestamp - Timestamp for metrics
   * @returns Queue size metrics
   */
  private async queryQueueMetrics(timestamp: number): Promise<QueueSizeMetrics> {
    const queue = this.queueManager.getQueue();

    // Get job counts from BullMQ
    const counts = await queue.getJobCounts();

    // Extract counts with defaults for undefined values using bracket notation
    // (required for index signature access with exactOptionalPropertyTypes)
    const waiting = counts['waiting'] ?? 0;
    const active = counts['active'] ?? 0;
    const completed = counts['completed'] ?? 0;
    const failed = counts['failed'] ?? 0;

    // Build metrics object
    const metrics: QueueSizeMetrics = {
      total: waiting + active, // Total active load
      pending: waiting,
      processing: active,
      completed,
      failed,
      timestamp,
    };

    return metrics;
  }

  /**
   * Update cache with new metrics
   *
   * @param metrics - New metrics to cache
   * @param timestamp - Timestamp of cache update
   */
  private updateCache(metrics: QueueSizeMetrics, timestamp: number): void {
    this.cachedMetrics = metrics;
    this.cacheTimestamp = timestamp;

    // Reset event emission flags when cache is updated
    this.warningEmitted = false;
    this.criticalEmitted = false;
  }

  /**
   * Check thresholds and emit events if exceeded
   *
   * @param metrics - Current metrics to check
   */
  private checkThresholds(metrics: QueueSizeMetrics): void {
    const { total } = metrics;

    // Check critical threshold (higher priority)
    if (total >= this.config.criticalThreshold && !this.criticalEmitted) {
      this.emitCriticalEvent(metrics);
      this.criticalEmitted = true;
      return; // Don't also emit warning
    }

    // Check warning threshold
    if (total >= this.config.warningThreshold && !this.warningEmitted) {
      this.emitWarningEvent(metrics);
      this.warningEmitted = true;
    }
  }

  /**
   * Emit warning event
   *
   * @param metrics - Current metrics
   */
  private emitWarningEvent(metrics: QueueSizeMetrics): void {
    const event: QueueThresholdEvent = {
      total: metrics.total,
      threshold: this.config.warningThreshold,
      metrics,
    };

    this.emit('warning', event);

    this.logger.logWarn('queue_size_warning', {
      total: metrics.total,
      threshold: this.config.warningThreshold,
      pending: metrics.pending,
      processing: metrics.processing,
    });
  }

  /**
   * Emit critical event
   *
   * @param metrics - Current metrics
   */
  private emitCriticalEvent(metrics: QueueSizeMetrics): void {
    const event: QueueThresholdEvent = {
      total: metrics.total,
      threshold: this.config.criticalThreshold,
      metrics,
    };

    this.emit('critical', event);

    this.logger.logWarn('queue_size_critical', {
      total: metrics.total,
      threshold: this.config.criticalThreshold,
      pending: metrics.pending,
      processing: metrics.processing,
    });
  }
}
