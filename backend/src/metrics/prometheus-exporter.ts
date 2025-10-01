/**
 * Task 7.2: Prometheus Metrics Exporter
 *
 * Exports queue metrics in Prometheus format for monitoring dashboards.
 * Provides a /metrics HTTP endpoint that Prometheus can scrape.
 */

import { Gauge, Counter, Summary, register } from 'prom-client';
import type { Request, Response } from 'express';
import type { MetricsCollector } from './metrics-collector.js';

/**
 * Prometheus Metrics Exporter
 *
 * Exports queue metrics in Prometheus text format for monitoring.
 * Provides an Express-compatible request handler for /metrics endpoint.
 *
 * Features:
 * - Exposes /metrics HTTP endpoint
 * - Returns metrics in Prometheus text format
 * - Includes all key metrics (queue size, cache hit rate, durations, etc.)
 * - Uses appropriate Prometheus metric types (gauge, counter, summary)
 * - Labels metrics with relevant dimensions (state, quantile)
 * - Updates metrics in real-time
 *
 * Metric Types:
 * - Gauge: Values that can go up or down (queue size, active users)
 * - Counter: Monotonically increasing values (total cache hits/misses)
 * - Summary: Distributions with quantiles (job duration, wait time)
 */
export class PrometheusExporter {
  private metricsCollector: MetricsCollector;

  // Gauges (values that can go up/down)
  private jobsGauge: Gauge<'state'>;
  private cacheHitRateGauge: Gauge<string>;
  private activeUsersGauge: Gauge<string>;

  // Counters (cumulative, monotonically increasing)
  private cacheHitsCounter: Counter<string>;
  private cacheMissesCounter: Counter<string>;

  // Summaries (distributions with quantiles)
  private jobDurationSummary: Summary<string>;
  private waitTimeSummary: Summary<string>;

  // Track previous values for counter deltas
  private previousCacheHits = 0;
  private previousCacheMisses = 0;

  /**
   * Creates a new PrometheusExporter instance
   *
   * @param metricsCollector - MetricsCollector instance to export from
   */
  constructor(metricsCollector: MetricsCollector) {
    this.metricsCollector = metricsCollector;

    // Initialize Prometheus metrics

    // Job counts by state (gauge - can go up/down)
    this.jobsGauge = new Gauge({
      name: 'queue_jobs_total',
      help: 'Total number of jobs by state',
      labelNames: ['state'] as const,
    });

    // Cache hit rate (gauge - percentage 0.0 to 1.0)
    this.cacheHitRateGauge = new Gauge({
      name: 'queue_cache_hit_rate',
      help: 'Cache hit rate (0.0 to 1.0)',
    });

    // Cache hits (counter - cumulative)
    this.cacheHitsCounter = new Counter({
      name: 'queue_cache_hits_total',
      help: 'Total number of cache hits',
    });

    // Cache misses (counter - cumulative)
    this.cacheMissesCounter = new Counter({
      name: 'queue_cache_misses_total',
      help: 'Total number of cache misses',
    });

    // Job duration (summary with quantiles)
    this.jobDurationSummary = new Summary({
      name: 'queue_job_duration_milliseconds',
      help: 'Job duration in milliseconds',
      percentiles: [0.95],
    });

    // Queue wait time (summary with quantiles)
    this.waitTimeSummary = new Summary({
      name: 'queue_wait_time_milliseconds',
      help: 'Queue wait time in milliseconds (submission to processing start)',
      percentiles: [0.95],
    });

    // Active users (gauge - current count)
    this.activeUsersGauge = new Gauge({
      name: 'queue_active_users',
      help: 'Number of active users with pending/processing jobs',
    });
  }

  /**
   * Update metrics from MetricsCollector
   *
   * Fetches current metrics and updates all Prometheus metrics.
   * Should be called before scraping to ensure fresh data.
   *
   * Note: Counters are incremented by delta, not set to absolute values.
   * This maintains Prometheus counter semantics (monotonically increasing).
   */
  async updateMetrics(): Promise<void> {
    const metrics = this.metricsCollector.getMetrics();

    // Update job count gauges
    this.jobsGauge.set({ state: 'pending' }, metrics.jobCounts.pending);
    this.jobsGauge.set({ state: 'processing' }, metrics.jobCounts.processing);
    this.jobsGauge.set({ state: 'completed' }, metrics.jobCounts.completed);
    this.jobsGauge.set({ state: 'failed' }, metrics.jobCounts.failed);

    // Update cache hit rate gauge
    this.cacheHitRateGauge.set(metrics.cache.hitRate);

    // Update cache counters
    // Counters must be incremented by delta, not set to absolute values
    // We track the delta since last update
    const currentHits = metrics.cache.hits;
    const currentMisses = metrics.cache.misses;

    // Calculate deltas
    const hitsDelta = currentHits - this.previousCacheHits;
    const missesDelta = currentMisses - this.previousCacheMisses;

    // Increment by delta (only if positive)
    if (hitsDelta > 0) {
      this.cacheHitsCounter.inc(hitsDelta);
      this.previousCacheHits = currentHits;
    }
    if (missesDelta > 0) {
      this.cacheMissesCounter.inc(missesDelta);
      this.previousCacheMisses = currentMisses;
    }

    // Update job duration summary
    // Note: Summaries observe individual values, but we only have aggregates
    // For now, we observe the p95 value as a representative sample
    // In production, you'd observe each job duration as it completes
    if (metrics.jobDuration.p95 > 0) {
      this.jobDurationSummary.observe(metrics.jobDuration.p95);
    }

    // Update wait time summary
    if (metrics.queueWaitTime.p95 > 0) {
      this.waitTimeSummary.observe(metrics.queueWaitTime.p95);
    }

    // Update active users gauge
    this.activeUsersGauge.set(metrics.activeUsers);
  }

  /**
   * Get metrics in Prometheus text format
   *
   * Returns all metrics as Prometheus-formatted text.
   * This text can be scraped by Prometheus.
   *
   * @returns Prometheus-formatted metrics text
   */
  async getMetricsText(): Promise<string> {
    return register.metrics();
  }

  /**
   * Get Express request handler for /metrics endpoint
   *
   * Returns an Express-compatible handler that:
   * 1. Updates metrics from MetricsCollector
   * 2. Sets correct Content-Type header
   * 3. Returns Prometheus-formatted metrics
   *
   * Example usage:
   * ```typescript
   * app.get('/metrics', exporter.getRequestHandler());
   * ```
   *
   * @returns Express request handler
   */
  getRequestHandler(): (req: Request, res: Response) => Promise<void> {
    return async (_req: Request, res: Response): Promise<void> => {
      try {
        // Update metrics before scrape
        await this.updateMetrics();

        // Set Prometheus content type
        res.set('Content-Type', register.contentType);

        // Return metrics
        const metrics = await this.getMetricsText();
        res.end(metrics);
      } catch (error) {
        // Handle errors gracefully
        res.status(500).end(error instanceof Error ? error.message : 'Internal Server Error');
      }
    };
  }
}
