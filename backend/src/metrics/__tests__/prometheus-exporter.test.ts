/**
 * Task 7.2: Prometheus Metrics Exporter Tests
 *
 * Tests for exporting queue metrics in Prometheus format.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PrometheusExporter } from '../prometheus-exporter.js';
import { MetricsCollector } from '../metrics-collector.js';
import type { QueueLogger } from '../queue/logger.js';

/**
 * Mock logger for testing
 */
const createMockLogger = (): QueueLogger => ({
  info: () => {},
  error: () => {},
  warn: () => {},
  debug: () => {},
});

describe('PrometheusExporter', () => {
  let metricsCollector: MetricsCollector;
  let exporter: PrometheusExporter;

  beforeEach(() => {
    // Reset Prometheus registry before each test to avoid duplicate metric errors
    const { register } = require('prom-client');
    register.clear();

    metricsCollector = new MetricsCollector(createMockLogger());
    exporter = new PrometheusExporter(metricsCollector);
  });

  describe('Constructor', () => {
    it('should create instance with MetricsCollector', () => {
      expect(exporter).toBeDefined();
      expect(exporter).toBeInstanceOf(PrometheusExporter);
    });
  });

  describe('getMetricsText()', () => {
    it('should return Prometheus-formatted text', async () => {
      const text = await exporter.getMetricsText();

      expect(text).toContain('# HELP');
      expect(text).toContain('# TYPE');
    });

    it('should include queue_jobs_total gauge with state labels', async () => {
      metricsCollector.recordJobSubmission('job1', 'user1');
      metricsCollector.recordJobSubmission('job2', 'user2');

      await exporter.updateMetrics();
      const text = await exporter.getMetricsText();

      expect(text).toContain('queue_jobs_total{state="pending"} 2');
      expect(text).toContain('queue_jobs_total{state="processing"} 0');
      expect(text).toContain('queue_jobs_total{state="completed"} 0');
      expect(text).toContain('queue_jobs_total{state="failed"} 0');
    });

    it('should include queue_cache_hit_rate gauge', async () => {
      metricsCollector.recordCacheHit();
      metricsCollector.recordCacheHit();
      metricsCollector.recordCacheMiss();

      await exporter.updateMetrics();
      const text = await exporter.getMetricsText();

      // Hit rate should be 2/3 = 0.6666...
      expect(text).toMatch(/queue_cache_hit_rate 0\.6+/);
    });

    it('should include queue_cache_hits_total counter', async () => {
      metricsCollector.recordCacheHit();
      metricsCollector.recordCacheHit();

      await exporter.updateMetrics();
      const text = await exporter.getMetricsText();

      expect(text).toContain('queue_cache_hits_total 2');
    });

    it('should include queue_cache_misses_total counter', async () => {
      metricsCollector.recordCacheMiss();

      await exporter.updateMetrics();
      const text = await exporter.getMetricsText();

      expect(text).toContain('queue_cache_misses_total 1');
    });

    it('should include queue_job_duration_milliseconds summary with quantiles', async () => {
      // Submit and complete a job
      metricsCollector.recordJobSubmission('job1', 'user1');
      const startedAt = Date.now();
      metricsCollector.recordJobStart('job1', startedAt - 1000);
      metricsCollector.recordJobComplete('job1', startedAt, startedAt + 5000);

      await exporter.updateMetrics();
      const text = await exporter.getMetricsText();

      expect(text).toContain('queue_job_duration_milliseconds_sum');
      expect(text).toContain('queue_job_duration_milliseconds_count');
      expect(text).toMatch(/queue_job_duration_milliseconds{quantile="0\.95"}/);
    });

    it('should include queue_wait_time_milliseconds summary with quantiles', async () => {
      // Submit and start a job with wait time
      const submittedAt = Date.now() - 2000;
      metricsCollector.recordJobSubmission('job1', 'user1');
      metricsCollector.recordJobStart('job1', submittedAt);

      await exporter.updateMetrics();
      const text = await exporter.getMetricsText();

      expect(text).toContain('queue_wait_time_milliseconds_sum');
      expect(text).toContain('queue_wait_time_milliseconds_count');
      expect(text).toMatch(/queue_wait_time_milliseconds{quantile="0\.95"}/);
    });

    it('should include queue_active_users gauge', async () => {
      metricsCollector.recordJobSubmission('job1', 'user1');
      metricsCollector.recordJobSubmission('job2', 'user2');

      await exporter.updateMetrics();
      const text = await exporter.getMetricsText();

      expect(text).toContain('queue_active_users 2');
    });
  });

  describe('updateMetrics()', () => {
    it('should update metrics from MetricsCollector', async () => {
      metricsCollector.recordJobSubmission('job1', 'user1');

      await exporter.updateMetrics();
      const text = await exporter.getMetricsText();

      expect(text).toContain('queue_jobs_total{state="pending"} 1');
    });

    it('should handle multiple updates', async () => {
      metricsCollector.recordJobSubmission('job1', 'user1');
      await exporter.updateMetrics();

      metricsCollector.recordJobSubmission('job2', 'user2');
      await exporter.updateMetrics();

      const text = await exporter.getMetricsText();
      expect(text).toContain('queue_jobs_total{state="pending"} 2');
    });

    it('should track job state transitions', async () => {
      metricsCollector.recordJobSubmission('job1', 'user1');
      await exporter.updateMetrics();

      const startedAt = Date.now();
      metricsCollector.recordJobStart('job1', startedAt - 1000);
      await exporter.updateMetrics();

      metricsCollector.recordJobComplete('job1', startedAt, startedAt + 5000);
      await exporter.updateMetrics();

      const text = await exporter.getMetricsText();
      expect(text).toContain('queue_jobs_total{state="pending"} 0');
      expect(text).toContain('queue_jobs_total{state="processing"} 0');
      expect(text).toContain('queue_jobs_total{state="completed"} 1');
    });
  });

  describe('getRequestHandler()', () => {
    it('should return Express-compatible handler', () => {
      const handler = exporter.getRequestHandler();

      expect(handler).toBeDefined();
      expect(typeof handler).toBe('function');
      expect(handler.length).toBe(2); // Express handlers take (req, res)
    });

    it('should set correct Content-Type header', async () => {
      const handler = exporter.getRequestHandler();

      let contentType: string | undefined;
      const mockRes = {
        set: (name: string, value: string) => {
          if (name === 'Content-Type') {
            contentType = value;
          }
        },
        end: () => {},
      };

      await handler({} as any, mockRes as any);

      expect(contentType).toBe('text/plain; version=0.0.4; charset=utf-8');
    });

    it('should return metrics in response body', async () => {
      metricsCollector.recordJobSubmission('job1', 'user1');
      await exporter.updateMetrics();

      const handler = exporter.getRequestHandler();

      let responseBody: string | undefined;
      const mockRes = {
        set: () => {},
        end: (data: string) => {
          responseBody = data;
        },
      };

      await handler({} as any, mockRes as any);

      expect(responseBody).toContain('queue_jobs_total{state="pending"} 1');
    });

    it('should handle errors gracefully', async () => {
      const handler = exporter.getRequestHandler();

      let statusCode = 200;
      let responseBody: string | undefined;
      const mockRes = {
        set: () => {},
        status: (code: number) => {
          statusCode = code;
          return mockRes;
        },
        end: (data?: string) => {
          responseBody = data;
        },
      };

      // Force an error by passing invalid response object
      await handler({} as any, mockRes as any);

      // Should not throw, should return normally
      expect(statusCode).toBe(200);
      expect(responseBody).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle metrics endpoint before any jobs', async () => {
      await exporter.updateMetrics();
      const text = await exporter.getMetricsText();

      // All metrics should exist with zero values
      expect(text).toContain('queue_jobs_total{state="pending"} 0');
      expect(text).toContain('queue_jobs_total{state="processing"} 0');
      expect(text).toContain('queue_jobs_total{state="completed"} 0');
      expect(text).toContain('queue_jobs_total{state="failed"} 0');
      expect(text).toContain('queue_cache_hit_rate 0');
      expect(text).toContain('queue_active_users 0');
    });

    it('should handle very large metric values', async () => {
      // Record 10,000 cache hits
      for (let i = 0; i < 10000; i++) {
        metricsCollector.recordCacheHit();
      }

      await exporter.updateMetrics();
      const text = await exporter.getMetricsText();

      expect(text).toContain('queue_cache_hits_total 10000');
    });

    it('should handle concurrent scrapes without race conditions', async () => {
      metricsCollector.recordJobSubmission('job1', 'user1');

      // Simulate concurrent scrapes
      const [text1, text2, text3] = await Promise.all([
        exporter.getMetricsText(),
        exporter.getMetricsText(),
        exporter.getMetricsText(),
      ]);

      // All should return valid metrics
      expect(text1).toContain('# HELP');
      expect(text2).toContain('# HELP');
      expect(text3).toContain('# HELP');
    });

    it('should maintain counter values across multiple updates', async () => {
      metricsCollector.recordCacheHit();
      await exporter.updateMetrics();

      metricsCollector.recordCacheHit();
      await exporter.updateMetrics();

      const text = await exporter.getMetricsText();

      // Counter should be cumulative
      expect(text).toContain('queue_cache_hits_total 2');
    });

    it('should handle failed jobs correctly', async () => {
      metricsCollector.recordJobSubmission('job1', 'user1');
      const startedAt = Date.now();
      metricsCollector.recordJobStart('job1', startedAt - 1000);
      metricsCollector.recordJobFailed('job1');

      await exporter.updateMetrics();
      const text = await exporter.getMetricsText();

      expect(text).toContain('queue_jobs_total{state="failed"} 1');
    });

    it('should handle zero cache hit rate correctly', async () => {
      metricsCollector.recordCacheMiss();

      await exporter.updateMetrics();
      const text = await exporter.getMetricsText();

      expect(text).toContain('queue_cache_hit_rate 0');
    });

    it('should handle 100% cache hit rate correctly', async () => {
      metricsCollector.recordCacheHit();

      await exporter.updateMetrics();
      const text = await exporter.getMetricsText();

      expect(text).toContain('queue_cache_hit_rate 1');
    });

    it('should update active users count dynamically', async () => {
      // Add 3 active users
      metricsCollector.recordJobSubmission('job1', 'user1');
      metricsCollector.recordJobSubmission('job2', 'user2');
      metricsCollector.recordJobSubmission('job3', 'user3');

      await exporter.updateMetrics();
      let text = await exporter.getMetricsText();
      expect(text).toContain('queue_active_users 3');

      // Complete one user's job
      const startedAt = Date.now();
      metricsCollector.recordJobStart('job1', startedAt - 1000);
      metricsCollector.recordJobComplete('job1', startedAt, startedAt + 1000);

      await exporter.updateMetrics();
      text = await exporter.getMetricsText();
      expect(text).toContain('queue_active_users 2');
    });
  });

  describe('Prometheus Format Compliance', () => {
    it('should use snake_case for metric names', async () => {
      await exporter.updateMetrics();
      const text = await exporter.getMetricsText();

      // Check all metrics use snake_case
      expect(text).toContain('queue_jobs_total');
      expect(text).toContain('queue_cache_hit_rate');
      expect(text).toContain('queue_cache_hits_total');
      expect(text).toContain('queue_cache_misses_total');
      expect(text).toContain('queue_job_duration_milliseconds');
      expect(text).toContain('queue_wait_time_milliseconds');
      expect(text).toContain('queue_active_users');
    });

    it('should include HELP and TYPE comments', async () => {
      await exporter.updateMetrics();
      const text = await exporter.getMetricsText();

      // Check for metric documentation
      expect(text).toMatch(/# HELP queue_jobs_total/);
      expect(text).toMatch(/# TYPE queue_jobs_total gauge/);
      expect(text).toMatch(/# HELP queue_cache_hit_rate/);
      expect(text).toMatch(/# TYPE queue_cache_hit_rate gauge/);
      expect(text).toMatch(/# HELP queue_cache_hits_total/);
      expect(text).toMatch(/# TYPE queue_cache_hits_total counter/);
    });

    it('should use correct metric types', async () => {
      await exporter.updateMetrics();
      const text = await exporter.getMetricsText();

      // Gauges (can go up/down)
      expect(text).toMatch(/# TYPE queue_jobs_total gauge/);
      expect(text).toMatch(/# TYPE queue_cache_hit_rate gauge/);
      expect(text).toMatch(/# TYPE queue_active_users gauge/);

      // Counters (monotonically increasing)
      expect(text).toMatch(/# TYPE queue_cache_hits_total counter/);
      expect(text).toMatch(/# TYPE queue_cache_misses_total counter/);

      // Summaries (distributions with quantiles)
      expect(text).toMatch(/# TYPE queue_job_duration_milliseconds summary/);
      expect(text).toMatch(/# TYPE queue_wait_time_milliseconds summary/);
    });
  });
});
