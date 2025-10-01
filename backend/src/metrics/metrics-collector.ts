/**
 * Task 7.1: Queue Metrics Collection
 *
 * Collects and exposes metrics for queue performance and health monitoring.
 * Tracks job lifecycle events, cache performance, and user activity.
 */

import type { QueueLogger } from '../queue/logger.js';

/**
 * Queue metrics for observability
 */
export interface QueueMetrics {
  /** Job counts by state */
  jobCounts: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    total: number;
  };

  /** Cache performance metrics */
  cache: {
    hitRate: number; // 0.0 to 1.0
    hits: number;
    misses: number;
    totalRequests: number;
  };

  /** Job duration metrics (milliseconds) */
  jobDuration: {
    average: number;
    p95: number;
    min: number;
    max: number;
  };

  /** Queue wait time metrics (submission → processing start, milliseconds) */
  queueWaitTime: {
    average: number;
    p95: number;
  };

  /** Count of unique users with pending/processing jobs */
  activeUsers: number;

  /** Unix timestamp when metrics collected */
  timestamp: number;
}

/**
 * Job state for internal tracking
 */
interface JobState {
  jobId: string;
  userId: string;
  state: 'pending' | 'processing' | 'completed' | 'failed';
  submittedAt?: number;
  startedAt?: number;
}

/**
 * Metrics Collector
 *
 * Collects and aggregates metrics for queue performance monitoring.
 * Tracks job lifecycle events, cache performance, and user activity.
 *
 * Features:
 * - Real-time job state tracking (pending → processing → completed/failed)
 * - Cache hit/miss rate calculation
 * - Job duration and wait time metrics with percentiles
 * - Active user tracking
 * - Circular buffer for efficient percentile calculation
 */
export class MetricsCollector {
  private logger: QueueLogger;

  /** Job state tracking by jobId */
  private jobs: Map<string, JobState> = new Map();

  /** Job count by state */
  private jobCounts = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
  };

  /** Cache statistics */
  private cacheStats = {
    hits: 0,
    misses: 0,
  };

  /** Job duration samples (milliseconds) - circular buffer */
  private jobDurations: number[] = [];

  /** Queue wait time samples (milliseconds) - circular buffer */
  private queueWaitTimes: number[] = [];

  /** Maximum samples to keep for percentile calculations */
  private static readonly MAX_SAMPLES = 1000;

  /**
   * Creates a new MetricsCollector instance
   *
   * @param logger - Logger instance for structured logging
   */
  constructor(logger: QueueLogger) {
    this.logger = logger;
    // Logger reserved for future metric logging enhancements
    void this.logger;
  }

  /**
   * Record job submission
   *
   * Increments pending count and tracks user as active.
   *
   * @param jobId - Unique job identifier
   * @param userId - User identifier
   */
  recordJobSubmission(jobId: string, userId: string): void {
    this.jobs.set(jobId, {
      jobId,
      userId,
      state: 'pending',
      submittedAt: Date.now(),
    });

    this.jobCounts.pending++;
  }

  /**
   * Record job start
   *
   * Moves job from pending to processing and tracks wait time.
   *
   * @param jobId - Unique job identifier
   * @param submittedAt - Unix timestamp when job was submitted
   */
  recordJobStart(jobId: string, submittedAt: number): void {
    const job = this.jobs.get(jobId);

    // If job was tracked as pending, decrement pending count
    if (job && job.state === 'pending') {
      this.jobCounts.pending--;
    }

    // Update or create job state
    const now = Date.now();
    const waitTime = now - submittedAt;

    // Only track wait time if:
    // 1. Job was previously tracked (has submittedAt)
    // 2. Wait time is positive (reject negative durations from clock skew)
    if (job && job.submittedAt && waitTime > 0) {
      this.addSample(this.queueWaitTimes, waitTime);
    }

    if (job) {
      job.state = 'processing';
      job.startedAt = now;
    } else {
      // Job not previously tracked (edge case)
      this.jobs.set(jobId, {
        jobId,
        userId: '', // Unknown user
        state: 'processing',
        startedAt: now,
      });
    }

    this.jobCounts.processing++;
  }

  /**
   * Record job completion
   *
   * Moves job from processing to completed and tracks duration.
   *
   * @param jobId - Unique job identifier
   * @param startedAt - Unix timestamp when job started processing
   * @param completedAt - Unix timestamp when job completed
   */
  recordJobComplete(jobId: string, startedAt: number, completedAt: number): void {
    const job = this.jobs.get(jobId);

    // If job was tracked as processing, decrement processing count
    if (job && job.state === 'processing') {
      this.jobCounts.processing--;
    }

    // Calculate and track duration
    const duration = completedAt - startedAt;

    // Only track duration if:
    // 1. Job was previously tracked and started (has startedAt)
    // 2. Duration is positive (reject negative durations from clock skew)
    if (job && job.startedAt && duration > 0) {
      this.addSample(this.jobDurations, duration);
    }

    // Update job state
    if (job) {
      job.state = 'completed';
      this.jobs.set(jobId, job);
    } else {
      // Job not previously tracked (edge case)
      this.jobs.set(jobId, {
        jobId,
        userId: '',
        state: 'completed',
      });
    }

    this.jobCounts.completed++;
  }

  /**
   * Record job failure
   *
   * Moves job from processing to failed.
   *
   * @param jobId - Unique job identifier
   */
  recordJobFailed(jobId: string): void {
    const job = this.jobs.get(jobId);

    // If job was tracked as processing, decrement processing count
    if (job && job.state === 'processing') {
      this.jobCounts.processing--;
    }

    // Update job state
    if (job) {
      job.state = 'failed';
      this.jobs.set(jobId, job);
    } else {
      // Job not previously tracked (edge case)
      this.jobs.set(jobId, {
        jobId,
        userId: '',
        state: 'failed',
      });
    }

    this.jobCounts.failed++;
  }

  /**
   * Record cache hit
   */
  recordCacheHit(): void {
    this.cacheStats.hits++;
  }

  /**
   * Record cache miss
   */
  recordCacheMiss(): void {
    this.cacheStats.misses++;
  }

  /**
   * Get current metrics
   *
   * Returns comprehensive queue metrics including job counts,
   * cache statistics, performance metrics, and user activity.
   *
   * @returns QueueMetrics object
   */
  getMetrics(): QueueMetrics {
    const totalJobs = this.jobCounts.pending + this.jobCounts.processing + this.jobCounts.completed + this.jobCounts.failed;

    const cacheTotal = this.cacheStats.hits + this.cacheStats.misses;
    const cacheHitRate = cacheTotal > 0 ? this.cacheStats.hits / cacheTotal : 0;

    const activeUsers = this.countActiveUsers();

    return {
      jobCounts: {
        pending: this.jobCounts.pending,
        processing: this.jobCounts.processing,
        completed: this.jobCounts.completed,
        failed: this.jobCounts.failed,
        total: totalJobs,
      },
      cache: {
        hitRate: cacheHitRate,
        hits: this.cacheStats.hits,
        misses: this.cacheStats.misses,
        totalRequests: cacheTotal,
      },
      jobDuration: {
        average: this.calculateAverage(this.jobDurations),
        p95: this.calculateP95(this.jobDurations),
        min: this.calculateMin(this.jobDurations),
        max: this.calculateMax(this.jobDurations),
      },
      queueWaitTime: {
        average: this.calculateAverage(this.queueWaitTimes),
        p95: this.calculateP95(this.queueWaitTimes),
      },
      activeUsers,
      timestamp: Date.now(),
    };
  }

  /**
   * Add sample to circular buffer
   *
   * Maintains a fixed-size buffer for efficient percentile calculation.
   *
   * @param buffer - Sample buffer
   * @param value - Value to add
   */
  private addSample(buffer: number[], value: number): void {
    buffer.push(value);

    // Maintain circular buffer by removing oldest samples
    if (buffer.length > MetricsCollector.MAX_SAMPLES) {
      buffer.shift();
    }
  }

  /**
   * Calculate average of samples
   *
   * @param samples - Array of sample values
   * @returns Average value or 0 if empty
   */
  private calculateAverage(samples: number[]): number {
    if (samples.length === 0) return 0;

    const sum = samples.reduce((acc, val) => acc + val, 0);
    return sum / samples.length;
  }

  /**
   * Calculate minimum of samples
   *
   * @param samples - Array of sample values
   * @returns Minimum value or 0 if empty
   */
  private calculateMin(samples: number[]): number {
    if (samples.length === 0) return 0;
    return Math.min(...samples);
  }

  /**
   * Calculate maximum of samples
   *
   * @param samples - Array of sample values
   * @returns Maximum value or 0 if empty
   */
  private calculateMax(samples: number[]): number {
    if (samples.length === 0) return 0;
    return Math.max(...samples);
  }

  /**
   * Calculate 95th percentile of samples
   *
   * Uses sorted array approach for accurate percentile calculation.
   *
   * @param samples - Array of sample values
   * @returns 95th percentile value or 0 if empty
   */
  private calculateP95(samples: number[]): number {
    if (samples.length === 0) return 0;

    const sorted = [...samples].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * 0.95) - 1;
    const value = sorted[Math.max(0, index)];
    return value !== undefined ? value : 0;
  }

  /**
   * Count active users
   *
   * Returns count of unique users with pending or processing jobs.
   *
   * @returns Count of active users
   */
  private countActiveUsers(): number {
    const activeUserIds = new Set<string>();

    for (const job of this.jobs.values()) {
      if (job.state === 'pending' || job.state === 'processing') {
        activeUserIds.add(job.userId);
      }
    }

    return activeUserIds.size;
  }
}
