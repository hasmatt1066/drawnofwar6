/**
 * Task 7.1: Queue Metrics Collection - Tests
 *
 * Tests for MetricsCollector that tracks job lifecycle events,
 * cache performance, and user activity for queue monitoring.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MetricsCollector, QueueMetrics } from './metrics-collector.js';
import type { QueueLogger } from '../queue/logger.js';

/**
 * Mock QueueLogger for testing
 */
class MockQueueLogger {
  logInfo = vi.fn();
  logWarn = vi.fn();
  logError = vi.fn();
}

describe('MetricsCollector', () => {
  let metricsCollector: MetricsCollector;
  let mockLogger: MockQueueLogger;

  beforeEach(() => {
    mockLogger = new MockQueueLogger();
    metricsCollector = new MetricsCollector(mockLogger as unknown as QueueLogger);
  });

  describe('getMetrics()', () => {
    it('should return initial metrics with all zeros', () => {
      const metrics = metricsCollector.getMetrics();

      expect(metrics.jobCounts).toEqual({
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        total: 0,
      });

      expect(metrics.cache).toEqual({
        hitRate: 0,
        hits: 0,
        misses: 0,
        totalRequests: 0,
      });

      expect(metrics.jobDuration).toEqual({
        average: 0,
        p95: 0,
        min: 0,
        max: 0,
      });

      expect(metrics.queueWaitTime).toEqual({
        average: 0,
        p95: 0,
      });

      expect(metrics.activeUsers).toBe(0);
      expect(metrics.timestamp).toBeGreaterThan(0);
    });

    it('should include current timestamp', () => {
      const before = Date.now();
      const metrics = metricsCollector.getMetrics();
      const after = Date.now();

      expect(metrics.timestamp).toBeGreaterThanOrEqual(before);
      expect(metrics.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('recordJobSubmission()', () => {
    it('should increment pending job count', () => {
      metricsCollector.recordJobSubmission('job1', 'user1');

      const metrics = metricsCollector.getMetrics();
      expect(metrics.jobCounts.pending).toBe(1);
      expect(metrics.jobCounts.total).toBe(1);
    });

    it('should track active users with pending jobs', () => {
      metricsCollector.recordJobSubmission('job1', 'user1');
      metricsCollector.recordJobSubmission('job2', 'user2');

      const metrics = metricsCollector.getMetrics();
      expect(metrics.activeUsers).toBe(2);
    });

    it('should not duplicate user count for multiple jobs', () => {
      metricsCollector.recordJobSubmission('job1', 'user1');
      metricsCollector.recordJobSubmission('job2', 'user1');

      const metrics = metricsCollector.getMetrics();
      expect(metrics.activeUsers).toBe(1);
    });

    it('should track multiple job submissions', () => {
      metricsCollector.recordJobSubmission('job1', 'user1');
      metricsCollector.recordJobSubmission('job2', 'user2');
      metricsCollector.recordJobSubmission('job3', 'user3');

      const metrics = metricsCollector.getMetrics();
      expect(metrics.jobCounts.pending).toBe(3);
      expect(metrics.jobCounts.total).toBe(3);
    });
  });

  describe('recordJobStart()', () => {
    it('should move job from pending to processing', () => {
      const submittedAt = Date.now() - 1000;
      metricsCollector.recordJobSubmission('job1', 'user1');
      metricsCollector.recordJobStart('job1', submittedAt);

      const metrics = metricsCollector.getMetrics();
      expect(metrics.jobCounts.pending).toBe(0);
      expect(metrics.jobCounts.processing).toBe(1);
      expect(metrics.jobCounts.total).toBe(1);
    });

    it('should track queue wait time', () => {
      const submittedAt = Date.now() - 5000; // 5 seconds ago
      metricsCollector.recordJobSubmission('job1', 'user1');
      metricsCollector.recordJobStart('job1', submittedAt);

      const metrics = metricsCollector.getMetrics();
      expect(metrics.queueWaitTime.average).toBeGreaterThan(4000);
      expect(metrics.queueWaitTime.average).toBeLessThan(6000);
    });

    it('should calculate average wait time across multiple jobs', () => {
      const now = Date.now();

      metricsCollector.recordJobSubmission('job1', 'user1');
      metricsCollector.recordJobStart('job1', now - 2000); // 2s wait

      metricsCollector.recordJobSubmission('job2', 'user2');
      metricsCollector.recordJobStart('job2', now - 4000); // 4s wait

      const metrics = metricsCollector.getMetrics();
      expect(metrics.queueWaitTime.average).toBeCloseTo(3000, -2); // (2000 + 4000) / 2
    });

    it('should calculate p95 wait time', () => {
      const now = Date.now();

      // Submit 20 jobs with varying wait times (100ms to 2000ms)
      for (let i = 1; i <= 20; i++) {
        metricsCollector.recordJobSubmission(`job${i}`, `user${i}`);
        metricsCollector.recordJobStart(`job${i}`, now - (i * 100));
      }

      const metrics = metricsCollector.getMetrics();
      expect(metrics.queueWaitTime.p95).toBeGreaterThan(1800); // 95th percentile
      expect(metrics.queueWaitTime.p95).toBeLessThan(2100);
    });

    it('should keep user in active set when job starts processing', () => {
      metricsCollector.recordJobSubmission('job1', 'user1');
      metricsCollector.recordJobStart('job1', Date.now() - 1000);

      const metrics = metricsCollector.getMetrics();
      expect(metrics.activeUsers).toBe(1);
    });

    it('should reject negative wait times (clock skew)', () => {
      const futureTime = Date.now() + 5000;
      metricsCollector.recordJobSubmission('job1', 'user1');

      // Should not throw, but should not record negative wait time
      metricsCollector.recordJobStart('job1', futureTime);

      const metrics = metricsCollector.getMetrics();
      expect(metrics.queueWaitTime.average).toBe(0);
    });

    it('should handle starting a job that was not submitted', () => {
      // Edge case: job started without being submitted first
      metricsCollector.recordJobStart('unknown-job', Date.now() - 1000);

      const metrics = metricsCollector.getMetrics();
      expect(metrics.jobCounts.processing).toBe(1); // Still tracked
      expect(metrics.queueWaitTime.average).toBe(0); // No wait time data
    });
  });

  describe('recordJobComplete()', () => {
    it('should move job from processing to completed', () => {
      const now = Date.now();
      metricsCollector.recordJobSubmission('job1', 'user1');
      metricsCollector.recordJobStart('job1', now - 5000);
      metricsCollector.recordJobComplete('job1', now - 5000, now);

      const metrics = metricsCollector.getMetrics();
      expect(metrics.jobCounts.processing).toBe(0);
      expect(metrics.jobCounts.completed).toBe(1);
      expect(metrics.jobCounts.total).toBe(1);
    });

    it('should track job duration', () => {
      const startedAt = Date.now() - 8000; // 8 seconds ago
      const completedAt = Date.now();

      metricsCollector.recordJobSubmission('job1', 'user1');
      metricsCollector.recordJobStart('job1', startedAt - 1000);
      metricsCollector.recordJobComplete('job1', startedAt, completedAt);

      const metrics = metricsCollector.getMetrics();
      expect(metrics.jobDuration.average).toBeGreaterThan(7000);
      expect(metrics.jobDuration.average).toBeLessThan(9000);
    });

    it('should calculate min, max, and average job durations', () => {
      const now = Date.now();

      // Job 1: 2 seconds
      metricsCollector.recordJobSubmission('job1', 'user1');
      metricsCollector.recordJobStart('job1', now - 3000);
      metricsCollector.recordJobComplete('job1', now - 2000, now);

      // Job 2: 6 seconds
      metricsCollector.recordJobSubmission('job2', 'user2');
      metricsCollector.recordJobStart('job2', now - 7000);
      metricsCollector.recordJobComplete('job2', now - 6000, now);

      const metrics = metricsCollector.getMetrics();
      expect(metrics.jobDuration.min).toBeCloseTo(2000, -2);
      expect(metrics.jobDuration.max).toBeCloseTo(6000, -2);
      expect(metrics.jobDuration.average).toBeCloseTo(4000, -2); // (2000 + 6000) / 2
    });

    it('should calculate p95 job duration', () => {
      const now = Date.now();

      // Submit 20 jobs with durations from 1s to 20s
      for (let i = 1; i <= 20; i++) {
        const duration = i * 1000;
        metricsCollector.recordJobSubmission(`job${i}`, `user${i}`);
        metricsCollector.recordJobStart(`job${i}`, now - duration - 1000);
        metricsCollector.recordJobComplete(`job${i}`, now - duration, now);
      }

      const metrics = metricsCollector.getMetrics();
      // 95th percentile should be around 19000ms (19th element in sorted array of 20)
      expect(metrics.jobDuration.p95).toBeGreaterThan(18000);
      expect(metrics.jobDuration.p95).toBeLessThan(20500);
    });

    it('should remove user from active set when all jobs complete', () => {
      metricsCollector.recordJobSubmission('job1', 'user1');
      metricsCollector.recordJobStart('job1', Date.now() - 1000);
      metricsCollector.recordJobComplete('job1', Date.now() - 1000, Date.now());

      const metrics = metricsCollector.getMetrics();
      expect(metrics.activeUsers).toBe(0);
    });

    it('should keep user in active set if they have other jobs', () => {
      const now = Date.now();

      metricsCollector.recordJobSubmission('job1', 'user1');
      metricsCollector.recordJobSubmission('job2', 'user1');
      metricsCollector.recordJobStart('job1', now - 2000);
      metricsCollector.recordJobComplete('job1', now - 2000, now);

      const metrics = metricsCollector.getMetrics();
      expect(metrics.activeUsers).toBe(1); // Still has job2 pending
    });

    it('should reject negative durations (clock skew)', () => {
      const now = Date.now();
      metricsCollector.recordJobSubmission('job1', 'user1');
      metricsCollector.recordJobStart('job1', now - 1000);

      // Started after completion (negative duration)
      metricsCollector.recordJobComplete('job1', now + 1000, now);

      const metrics = metricsCollector.getMetrics();
      expect(metrics.jobDuration.average).toBe(0); // Should not record negative
    });

    it('should handle completing a job that was not started', () => {
      const now = Date.now();
      metricsCollector.recordJobSubmission('job1', 'user1');
      metricsCollector.recordJobComplete('job1', now - 5000, now);

      const metrics = metricsCollector.getMetrics();
      expect(metrics.jobCounts.completed).toBe(1);
      expect(metrics.jobDuration.average).toBe(0); // No valid duration
    });
  });

  describe('recordJobFailed()', () => {
    it('should move job from processing to failed', () => {
      metricsCollector.recordJobSubmission('job1', 'user1');
      metricsCollector.recordJobStart('job1', Date.now() - 1000);
      metricsCollector.recordJobFailed('job1');

      const metrics = metricsCollector.getMetrics();
      expect(metrics.jobCounts.processing).toBe(0);
      expect(metrics.jobCounts.failed).toBe(1);
      expect(metrics.jobCounts.total).toBe(1);
    });

    it('should remove user from active set when job fails', () => {
      metricsCollector.recordJobSubmission('job1', 'user1');
      metricsCollector.recordJobStart('job1', Date.now() - 1000);
      metricsCollector.recordJobFailed('job1');

      const metrics = metricsCollector.getMetrics();
      expect(metrics.activeUsers).toBe(0);
    });

    it('should keep user in active set if they have other jobs', () => {
      metricsCollector.recordJobSubmission('job1', 'user1');
      metricsCollector.recordJobSubmission('job2', 'user1');
      metricsCollector.recordJobStart('job1', Date.now() - 1000);
      metricsCollector.recordJobFailed('job1');

      const metrics = metricsCollector.getMetrics();
      expect(metrics.activeUsers).toBe(1); // Still has job2 pending
    });

    it('should handle failing a job that was not submitted', () => {
      metricsCollector.recordJobFailed('unknown-job');

      const metrics = metricsCollector.getMetrics();
      expect(metrics.jobCounts.failed).toBe(1);
    });
  });

  describe('cache metrics', () => {
    it('should track cache hits', () => {
      metricsCollector.recordCacheHit();
      metricsCollector.recordCacheHit();

      const metrics = metricsCollector.getMetrics();
      expect(metrics.cache.hits).toBe(2);
      expect(metrics.cache.totalRequests).toBe(2);
    });

    it('should track cache misses', () => {
      metricsCollector.recordCacheMiss();
      metricsCollector.recordCacheMiss();
      metricsCollector.recordCacheMiss();

      const metrics = metricsCollector.getMetrics();
      expect(metrics.cache.misses).toBe(3);
      expect(metrics.cache.totalRequests).toBe(3);
    });

    it('should calculate cache hit rate correctly', () => {
      metricsCollector.recordCacheHit();
      metricsCollector.recordCacheHit();
      metricsCollector.recordCacheHit();
      metricsCollector.recordCacheMiss();

      const metrics = metricsCollector.getMetrics();
      expect(metrics.cache.hits).toBe(3);
      expect(metrics.cache.misses).toBe(1);
      expect(metrics.cache.totalRequests).toBe(4);
      expect(metrics.cache.hitRate).toBe(0.75); // 3/4
    });

    it('should return 0 hit rate when no requests', () => {
      const metrics = metricsCollector.getMetrics();
      expect(metrics.cache.hitRate).toBe(0);
    });

    it('should handle 100% hit rate', () => {
      metricsCollector.recordCacheHit();
      metricsCollector.recordCacheHit();

      const metrics = metricsCollector.getMetrics();
      expect(metrics.cache.hitRate).toBe(1.0);
    });

    it('should handle 0% hit rate', () => {
      metricsCollector.recordCacheMiss();
      metricsCollector.recordCacheMiss();

      const metrics = metricsCollector.getMetrics();
      expect(metrics.cache.hitRate).toBe(0);
    });
  });

  describe('percentile calculations', () => {
    it('should handle empty duration array for p95', () => {
      const metrics = metricsCollector.getMetrics();
      expect(metrics.jobDuration.p95).toBe(0);
      expect(metrics.queueWaitTime.p95).toBe(0);
    });

    it('should handle single duration value for p95', () => {
      const now = Date.now();
      metricsCollector.recordJobSubmission('job1', 'user1');
      metricsCollector.recordJobStart('job1', now - 5000);
      metricsCollector.recordJobComplete('job1', now - 5000, now);

      const metrics = metricsCollector.getMetrics();
      expect(metrics.jobDuration.p95).toBeCloseTo(5000, -2);
    });

    it('should maintain circular buffer for large job counts', () => {
      const now = Date.now();

      // Submit 2000 jobs (buffer size is 1000)
      for (let i = 1; i <= 2000; i++) {
        metricsCollector.recordJobSubmission(`job${i}`, `user${i}`);
        metricsCollector.recordJobStart(`job${i}`, now - 1000);
        metricsCollector.recordJobComplete(`job${i}`, now - 1000, now);
      }

      const metrics = metricsCollector.getMetrics();
      // Should still calculate p95 correctly without memory overflow
      expect(metrics.jobDuration.p95).toBeGreaterThan(0);
      expect(metrics.jobCounts.completed).toBe(2000); // Full count maintained
    });
  });

  describe('edge cases', () => {
    it('should handle very large job counts without overflow', () => {
      // Simulate 100,000 jobs (JavaScript number supports up to 2^53-1)
      for (let i = 0; i < 100000; i++) {
        metricsCollector.recordJobSubmission(`job${i}`, `user${i % 1000}`);
      }

      const metrics = metricsCollector.getMetrics();
      expect(metrics.jobCounts.pending).toBe(100000);
      expect(metrics.jobCounts.total).toBe(100000);
      expect(typeof metrics.jobCounts.total).toBe('number');
    });

    it('should handle concurrent job state changes', () => {
      const now = Date.now();

      metricsCollector.recordJobSubmission('job1', 'user1');
      metricsCollector.recordJobSubmission('job2', 'user1');
      metricsCollector.recordJobSubmission('job3', 'user2');

      metricsCollector.recordJobStart('job1', now - 1000);
      metricsCollector.recordJobStart('job3', now - 1000);

      metricsCollector.recordJobComplete('job1', now - 1000, now);

      const metrics = metricsCollector.getMetrics();
      expect(metrics.jobCounts.pending).toBe(1);
      expect(metrics.jobCounts.processing).toBe(1);
      expect(metrics.jobCounts.completed).toBe(1);
      expect(metrics.activeUsers).toBe(2); // user1 (job2), user2 (job3)
    });

    it('should maintain accuracy after multiple metric queries', () => {
      metricsCollector.recordJobSubmission('job1', 'user1');
      const metrics1 = metricsCollector.getMetrics();

      metricsCollector.recordJobStart('job1', Date.now() - 1000);
      const metrics2 = metricsCollector.getMetrics();

      expect(metrics1.jobCounts.pending).toBe(1);
      expect(metrics2.jobCounts.processing).toBe(1);
    });

    it('should handle missing userId gracefully', () => {
      metricsCollector.recordJobSubmission('job1', '');

      const metrics = metricsCollector.getMetrics();
      expect(metrics.jobCounts.pending).toBe(1);
      expect(metrics.activeUsers).toBe(1); // Empty string still counted as user
    });

    it('should track metrics across different job lifecycles', () => {
      const now = Date.now();

      // Job 1: Complete successfully
      metricsCollector.recordJobSubmission('job1', 'user1');
      metricsCollector.recordJobStart('job1', now - 5000);
      metricsCollector.recordJobComplete('job1', now - 5000, now);

      // Job 2: Fail
      metricsCollector.recordJobSubmission('job2', 'user2');
      metricsCollector.recordJobStart('job2', now - 3000);
      metricsCollector.recordJobFailed('job2');

      // Job 3: Still pending
      metricsCollector.recordJobSubmission('job3', 'user3');

      // Job 4: Processing
      metricsCollector.recordJobSubmission('job4', 'user4');
      metricsCollector.recordJobStart('job4', now - 1000);

      const metrics = metricsCollector.getMetrics();
      expect(metrics.jobCounts.pending).toBe(1);
      expect(metrics.jobCounts.processing).toBe(1);
      expect(metrics.jobCounts.completed).toBe(1);
      expect(metrics.jobCounts.failed).toBe(1);
      expect(metrics.jobCounts.total).toBe(4);
      expect(metrics.activeUsers).toBe(2); // user3 (pending), user4 (processing)
    });
  });

  describe('type safety', () => {
    it('should return QueueMetrics with exact shape', () => {
      const metrics = metricsCollector.getMetrics();

      // Verify all required fields exist
      expect(metrics).toHaveProperty('jobCounts');
      expect(metrics).toHaveProperty('cache');
      expect(metrics).toHaveProperty('jobDuration');
      expect(metrics).toHaveProperty('queueWaitTime');
      expect(metrics).toHaveProperty('activeUsers');
      expect(metrics).toHaveProperty('timestamp');

      // Verify nested structures
      expect(metrics.jobCounts).toHaveProperty('pending');
      expect(metrics.jobCounts).toHaveProperty('processing');
      expect(metrics.jobCounts).toHaveProperty('completed');
      expect(metrics.jobCounts).toHaveProperty('failed');
      expect(metrics.jobCounts).toHaveProperty('total');

      expect(metrics.cache).toHaveProperty('hitRate');
      expect(metrics.cache).toHaveProperty('hits');
      expect(metrics.cache).toHaveProperty('misses');
      expect(metrics.cache).toHaveProperty('totalRequests');

      expect(metrics.jobDuration).toHaveProperty('average');
      expect(metrics.jobDuration).toHaveProperty('p95');
      expect(metrics.jobDuration).toHaveProperty('min');
      expect(metrics.jobDuration).toHaveProperty('max');

      expect(metrics.queueWaitTime).toHaveProperty('average');
      expect(metrics.queueWaitTime).toHaveProperty('p95');
    });

    it('should return numbers for all metric values', () => {
      metricsCollector.recordJobSubmission('job1', 'user1');
      metricsCollector.recordCacheHit();

      const metrics = metricsCollector.getMetrics();

      // Verify all values are numbers
      expect(typeof metrics.jobCounts.pending).toBe('number');
      expect(typeof metrics.cache.hitRate).toBe('number');
      expect(typeof metrics.jobDuration.average).toBe('number');
      expect(typeof metrics.queueWaitTime.average).toBe('number');
      expect(typeof metrics.activeUsers).toBe('number');
      expect(typeof metrics.timestamp).toBe('number');
    });
  });
});
