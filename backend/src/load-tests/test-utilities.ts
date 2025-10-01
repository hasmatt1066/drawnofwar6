/**
 * Load Test Utilities
 *
 * Helper functions and utilities for load testing the queue system.
 * Provides performance measurement, metrics collection, and test data generation.
 */

import type { StructuredPrompt } from '../queue/job-submitter.js';
import type { QueueMetrics } from '../metrics/metrics-collector.js';

/**
 * Performance metrics for load testing
 */
export interface LoadTestMetrics {
  /** Total jobs submitted */
  totalJobs: number;
  /** Jobs completed successfully */
  successfulJobs: number;
  /** Jobs that failed */
  failedJobs: number;
  /** Error rate (0-1) */
  errorRate: number;
  /** Throughput (jobs/second) */
  throughput: number;
  /** Average latency (ms) */
  averageLatency: number;
  /** P95 latency (ms) */
  p95Latency: number;
  /** P99 latency (ms) */
  p99Latency: number;
  /** Min latency (ms) */
  minLatency: number;
  /** Max latency (ms) */
  maxLatency: number;
  /** Total duration (ms) */
  totalDuration: number;
  /** Cache hit rate (0-1) */
  cacheHitRate: number;
}

/**
 * Job timing information
 */
export interface JobTiming {
  jobId: string;
  submittedAt: number;
  completedAt?: number;
  duration?: number;
  success: boolean;
  error?: string;
}

/**
 * Performance metrics calculator
 */
export class PerformanceMetrics {
  private timings: JobTiming[] = [];
  private startTime: number = Date.now();
  private endTime?: number;

  /**
   * Record job submission
   */
  recordSubmission(jobId: string): void {
    this.timings.push({
      jobId,
      submittedAt: Date.now(),
      success: false,
    });
  }

  /**
   * Record job completion
   */
  recordCompletion(jobId: string, success: boolean, error?: string): void {
    const timing = this.timings.find((t) => t.jobId === jobId);
    if (timing) {
      timing.completedAt = Date.now();
      timing.duration = timing.completedAt - timing.submittedAt;
      timing.success = success;
      timing.error = error;
    }
  }

  /**
   * Mark test end
   */
  endTest(): void {
    this.endTime = Date.now();
  }

  /**
   * Calculate performance metrics
   */
  calculate(cacheHits: number = 0, cacheMisses: number = 0): LoadTestMetrics {
    const completedJobs = this.timings.filter((t) => t.completedAt !== undefined);
    const successfulJobs = completedJobs.filter((t) => t.success);
    const failedJobs = completedJobs.filter((t) => !t.success);
    const durations = completedJobs
      .map((t) => t.duration!)
      .filter((d) => d !== undefined)
      .sort((a, b) => a - b);

    const totalDuration = (this.endTime ?? Date.now()) - this.startTime;
    const throughput = (completedJobs.length / totalDuration) * 1000; // jobs/sec

    const totalRequests = cacheHits + cacheMisses;
    const cacheHitRate = totalRequests > 0 ? cacheHits / totalRequests : 0;

    return {
      totalJobs: this.timings.length,
      successfulJobs: successfulJobs.length,
      failedJobs: failedJobs.length,
      errorRate: completedJobs.length > 0 ? failedJobs.length / completedJobs.length : 0,
      throughput,
      averageLatency: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      p95Latency: this.percentile(durations, 0.95),
      p99Latency: this.percentile(durations, 0.99),
      minLatency: durations.length > 0 ? durations[0] : 0,
      maxLatency: durations.length > 0 ? durations[durations.length - 1] : 0,
      totalDuration,
      cacheHitRate,
    };
  }

  /**
   * Get all timings
   */
  getTimings(): JobTiming[] {
    return this.timings;
  }

  /**
   * Calculate percentile
   */
  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }
}

/**
 * Create test prompt with variation
 */
export function createTestPrompt(index: number = 0): StructuredPrompt {
  const characters = ['wizard', 'warrior', 'archer', 'knight', 'mage', 'rogue', 'paladin', 'druid'];
  const colors = ['blue', 'red', 'green', 'purple', 'gold', 'silver', 'black', 'white'];
  const items = ['staff', 'sword', 'bow', 'shield', 'wand', 'dagger', 'hammer', 'cloak'];

  const charType = characters[index % characters.length];
  const color = colors[index % colors.length];
  const item = items[index % items.length];

  return {
    type: 'character',
    style: 'pixel-art',
    size: { width: 48, height: 48 },
    action: 'walking',
    description: `${color} ${charType} with ${item}`,
    raw: `${color} ${charType} with ${item} walking`,
  };
}

/**
 * Create duplicate test prompt (for cache hit testing)
 */
export function createDuplicatePrompt(): StructuredPrompt {
  return {
    type: 'character',
    style: 'pixel-art',
    size: { width: 48, height: 48 },
    action: 'walking',
    description: 'standard test wizard',
    raw: 'standard test wizard walking',
  };
}

/**
 * Wait for all jobs to complete
 */
export async function waitForJobsToComplete(
  jobIds: string[],
  statusChecker: (jobId: string) => Promise<string>,
  timeoutMs: number = 60000
): Promise<void> {
  const startTime = Date.now();
  const pending = new Set(jobIds);

  while (pending.size > 0 && Date.now() - startTime < timeoutMs) {
    for (const jobId of Array.from(pending)) {
      const status = await statusChecker(jobId);
      if (status === 'completed' || status === 'failed') {
        pending.delete(jobId);
      }
    }

    if (pending.size > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  if (pending.size > 0) {
    throw new Error(`Timeout waiting for jobs to complete. ${pending.size} jobs still pending.`);
  }
}

/**
 * Detect potential deadlock
 *
 * Checks if jobs are stuck in processing state for too long
 */
export async function detectDeadlock(
  getQueueMetrics: () => Promise<QueueMetrics>,
  thresholdSeconds: number = 30
): Promise<boolean> {
  const initialMetrics = await getQueueMetrics();
  const initialProcessing = initialMetrics.jobCounts.processing;

  // Wait for threshold period
  await new Promise((resolve) => setTimeout(resolve, thresholdSeconds * 1000));

  const finalMetrics = await getQueueMetrics();
  const finalProcessing = finalMetrics.jobCounts.processing;

  // If same jobs are still processing and no progress, likely deadlock
  return initialProcessing > 0 && initialProcessing === finalProcessing;
}

/**
 * Monitor system health during load test
 */
export class HealthMonitor {
  private samples: QueueMetrics[] = [];
  private intervalId?: NodeJS.Timeout;

  /**
   * Start monitoring
   */
  start(getMetrics: () => Promise<QueueMetrics>, intervalMs: number = 1000): void {
    this.intervalId = setInterval(async () => {
      try {
        const metrics = await getMetrics();
        this.samples.push(metrics);
      } catch (error) {
        // Ignore errors during monitoring
      }
    }, intervalMs);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  /**
   * Get all samples
   */
  getSamples(): QueueMetrics[] {
    return this.samples;
  }

  /**
   * Check if queue remained healthy
   */
  isHealthy(): boolean {
    // Check if queue counts stayed within reasonable bounds
    const maxPending = Math.max(...this.samples.map((s) => s.jobCounts.pending));
    const maxProcessing = Math.max(...this.samples.map((s) => s.jobCounts.processing));

    // Heuristic: queue is unhealthy if pending jobs grow unbounded
    return maxPending < 1000 && maxProcessing < 100;
  }

  /**
   * Get peak metrics
   */
  getPeakMetrics(): {
    maxPending: number;
    maxProcessing: number;
    maxQueueWait: number;
    minCacheHitRate: number;
  } {
    if (this.samples.length === 0) {
      return { maxPending: 0, maxProcessing: 0, maxQueueWait: 0, minCacheHitRate: 1.0 };
    }

    return {
      maxPending: Math.max(...this.samples.map((s) => s.jobCounts.pending)),
      maxProcessing: Math.max(...this.samples.map((s) => s.jobCounts.processing)),
      maxQueueWait: Math.max(...this.samples.map((s) => s.queueWaitTime.average)),
      minCacheHitRate: Math.min(...this.samples.map((s) => s.cache.hitRate)),
    };
  }
}

/**
 * Format metrics for console output
 */
export function formatMetrics(metrics: LoadTestMetrics): string {
  return `
Load Test Results:
==================
Total Jobs: ${metrics.totalJobs}
Successful: ${metrics.successfulJobs} (${((metrics.successfulJobs / metrics.totalJobs) * 100).toFixed(1)}%)
Failed: ${metrics.failedJobs} (${(metrics.errorRate * 100).toFixed(1)}%)

Performance:
-----------
Throughput: ${metrics.throughput.toFixed(2)} jobs/sec
Duration: ${(metrics.totalDuration / 1000).toFixed(2)}s

Latency (ms):
------------
Average: ${metrics.averageLatency.toFixed(2)}ms
P95: ${metrics.p95Latency.toFixed(2)}ms
P99: ${metrics.p99Latency.toFixed(2)}ms
Min: ${metrics.minLatency.toFixed(2)}ms
Max: ${metrics.maxLatency.toFixed(2)}ms

Cache:
------
Hit Rate: ${(metrics.cacheHitRate * 100).toFixed(1)}%
`;
}
