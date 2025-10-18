import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MetricsTracker, RequestMetrics } from './metrics-tracker';

describe('Metrics Tracker - Task 8.3: Performance Metrics', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('request tracking', () => {
    it('should track individual request duration', () => {
      const tracker = new MetricsTracker();

      const requestId = tracker.startRequest('GET', '/characters');

      vi.advanceTimersByTime(1500);

      tracker.endRequest(requestId, 200);

      const metrics = tracker.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.requestsByMethod.GET).toBe(1);
      expect(metrics.requestsByStatus[200]).toBe(1);
      expect(metrics.averageLatency).toBe(1500);
    });

    it('should track multiple requests', () => {
      const tracker = new MetricsTracker();

      const req1 = tracker.startRequest('POST', '/characters');
      vi.advanceTimersByTime(1000);
      tracker.endRequest(req1, 201);

      const req2 = tracker.startRequest('GET', '/characters/123');
      vi.advanceTimersByTime(500);
      tracker.endRequest(req2, 200);

      const metrics = tracker.getMetrics();
      expect(metrics.totalRequests).toBe(2);
      expect(metrics.requestsByMethod.POST).toBe(1);
      expect(metrics.requestsByMethod.GET).toBe(1);
    });

    it('should track concurrent requests', () => {
      const tracker = new MetricsTracker();

      const req1 = tracker.startRequest('GET', '/api/1');
      const req2 = tracker.startRequest('GET', '/api/2');
      const req3 = tracker.startRequest('POST', '/api/3');

      vi.advanceTimersByTime(1000);

      tracker.endRequest(req1, 200);
      tracker.endRequest(req2, 200);
      tracker.endRequest(req3, 201);

      const metrics = tracker.getMetrics();
      expect(metrics.totalRequests).toBe(3);
    });

    it('should handle request without ending', () => {
      const tracker = new MetricsTracker();

      tracker.startRequest('GET', '/api/test');

      const metrics = tracker.getMetrics();
      expect(metrics.totalRequests).toBe(0); // Not counted until ended
      expect(metrics.inFlightRequests).toBe(1);
    });

    it('should track in-flight requests', () => {
      const tracker = new MetricsTracker();

      const req1 = tracker.startRequest('GET', '/api/1');
      const req2 = tracker.startRequest('GET', '/api/2');

      expect(tracker.getMetrics().inFlightRequests).toBe(2);

      tracker.endRequest(req1, 200);
      expect(tracker.getMetrics().inFlightRequests).toBe(1);

      tracker.endRequest(req2, 200);
      expect(tracker.getMetrics().inFlightRequests).toBe(0);
    });
  });

  describe('success/failure tracking', () => {
    it('should track successful requests (2xx status)', () => {
      const tracker = new MetricsTracker();

      const req1 = tracker.startRequest('GET', '/api/test');
      tracker.endRequest(req1, 200);

      const req2 = tracker.startRequest('POST', '/api/test');
      tracker.endRequest(req2, 201);

      const metrics = tracker.getMetrics();
      expect(metrics.successfulRequests).toBe(2);
      expect(metrics.failedRequests).toBe(0);
      expect(metrics.successRate).toBe(100);
    });

    it('should track failed requests (4xx, 5xx status)', () => {
      const tracker = new MetricsTracker();

      const req1 = tracker.startRequest('GET', '/api/test');
      tracker.endRequest(req1, 404);

      const req2 = tracker.startRequest('POST', '/api/test');
      tracker.endRequest(req2, 500);

      const metrics = tracker.getMetrics();
      expect(metrics.successfulRequests).toBe(0);
      expect(metrics.failedRequests).toBe(2);
      expect(metrics.successRate).toBe(0);
    });

    it('should calculate success rate correctly', () => {
      const tracker = new MetricsTracker();

      // 3 successful
      tracker.endRequest(tracker.startRequest('GET', '/api'), 200);
      tracker.endRequest(tracker.startRequest('GET', '/api'), 201);
      tracker.endRequest(tracker.startRequest('GET', '/api'), 204);

      // 1 failed
      tracker.endRequest(tracker.startRequest('GET', '/api'), 500);

      const metrics = tracker.getMetrics();
      expect(metrics.successfulRequests).toBe(3);
      expect(metrics.failedRequests).toBe(1);
      expect(metrics.successRate).toBe(75); // 3/4 = 75%
    });

    it('should return 0 success rate when no requests', () => {
      const tracker = new MetricsTracker();

      expect(tracker.getMetrics().successRate).toBe(0);
    });

    it('should track 3xx redirects as successful', () => {
      const tracker = new MetricsTracker();

      const req = tracker.startRequest('GET', '/api/test');
      tracker.endRequest(req, 301);

      const metrics = tracker.getMetrics();
      expect(metrics.successfulRequests).toBe(1);
      expect(metrics.failedRequests).toBe(0);
    });
  });

  describe('latency tracking', () => {
    it('should calculate average latency', () => {
      const tracker = new MetricsTracker();

      const req1 = tracker.startRequest('GET', '/api');
      vi.advanceTimersByTime(1000);
      tracker.endRequest(req1, 200);

      const req2 = tracker.startRequest('GET', '/api');
      vi.advanceTimersByTime(2000);
      tracker.endRequest(req2, 200);

      const req3 = tracker.startRequest('GET', '/api');
      vi.advanceTimersByTime(3000);
      tracker.endRequest(req3, 200);

      const metrics = tracker.getMetrics();
      expect(metrics.averageLatency).toBe(2000); // (1000 + 2000 + 3000) / 3
    });

    it('should track minimum latency', () => {
      const tracker = new MetricsTracker();

      const req1 = tracker.startRequest('GET', '/api');
      vi.advanceTimersByTime(500);
      tracker.endRequest(req1, 200);

      const req2 = tracker.startRequest('GET', '/api');
      vi.advanceTimersByTime(100);
      tracker.endRequest(req2, 200);

      const req3 = tracker.startRequest('GET', '/api');
      vi.advanceTimersByTime(300);
      tracker.endRequest(req3, 200);

      const metrics = tracker.getMetrics();
      expect(metrics.minLatency).toBe(100);
    });

    it('should track maximum latency', () => {
      const tracker = new MetricsTracker();

      const req1 = tracker.startRequest('GET', '/api');
      vi.advanceTimersByTime(500);
      tracker.endRequest(req1, 200);

      const req2 = tracker.startRequest('GET', '/api');
      vi.advanceTimersByTime(2000);
      tracker.endRequest(req2, 200);

      const req3 = tracker.startRequest('GET', '/api');
      vi.advanceTimersByTime(300);
      tracker.endRequest(req3, 200);

      const metrics = tracker.getMetrics();
      expect(metrics.maxLatency).toBe(2000);
    });

    it('should return 0 for latency metrics when no requests', () => {
      const tracker = new MetricsTracker();

      const metrics = tracker.getMetrics();
      expect(metrics.averageLatency).toBe(0);
      expect(metrics.minLatency).toBe(0);
      expect(metrics.maxLatency).toBe(0);
    });
  });

  describe('method and status breakdown', () => {
    it('should track requests by HTTP method', () => {
      const tracker = new MetricsTracker();

      tracker.endRequest(tracker.startRequest('GET', '/api'), 200);
      tracker.endRequest(tracker.startRequest('GET', '/api'), 200);
      tracker.endRequest(tracker.startRequest('POST', '/api'), 201);
      tracker.endRequest(tracker.startRequest('PUT', '/api'), 200);
      tracker.endRequest(tracker.startRequest('DELETE', '/api'), 204);

      const metrics = tracker.getMetrics();
      expect(metrics.requestsByMethod.GET).toBe(2);
      expect(metrics.requestsByMethod.POST).toBe(1);
      expect(metrics.requestsByMethod.PUT).toBe(1);
      expect(metrics.requestsByMethod.DELETE).toBe(1);
    });

    it('should track requests by status code', () => {
      const tracker = new MetricsTracker();

      tracker.endRequest(tracker.startRequest('GET', '/api'), 200);
      tracker.endRequest(tracker.startRequest('GET', '/api'), 200);
      tracker.endRequest(tracker.startRequest('GET', '/api'), 404);
      tracker.endRequest(tracker.startRequest('GET', '/api'), 500);
      tracker.endRequest(tracker.startRequest('GET', '/api'), 500);

      const metrics = tracker.getMetrics();
      expect(metrics.requestsByStatus[200]).toBe(2);
      expect(metrics.requestsByStatus[404]).toBe(1);
      expect(metrics.requestsByStatus[500]).toBe(2);
    });

    it('should handle new HTTP methods dynamically', () => {
      const tracker = new MetricsTracker();

      tracker.endRequest(tracker.startRequest('PATCH', '/api'), 200);
      tracker.endRequest(tracker.startRequest('OPTIONS', '/api'), 200);

      const metrics = tracker.getMetrics();
      expect(metrics.requestsByMethod.PATCH).toBe(1);
      expect(metrics.requestsByMethod.OPTIONS).toBe(1);
    });
  });

  describe('endpoint tracking', () => {
    it('should track requests by endpoint', () => {
      const tracker = new MetricsTracker();

      tracker.endRequest(tracker.startRequest('GET', '/characters'), 200);
      tracker.endRequest(tracker.startRequest('GET', '/characters'), 200);
      tracker.endRequest(tracker.startRequest('POST', '/characters'), 201);
      tracker.endRequest(tracker.startRequest('GET', '/animations'), 200);

      const metrics = tracker.getMetrics();
      expect(metrics.requestsByEndpoint['/characters']).toBe(3);
      expect(metrics.requestsByEndpoint['/animations']).toBe(1);
    });

    it('should track distinct endpoints', () => {
      const tracker = new MetricsTracker();

      tracker.endRequest(tracker.startRequest('GET', '/api/users'), 200);
      tracker.endRequest(tracker.startRequest('GET', '/api/posts'), 200);
      tracker.endRequest(tracker.startRequest('GET', '/api/comments'), 200);

      const metrics = tracker.getMetrics();
      expect(Object.keys(metrics.requestsByEndpoint)).toHaveLength(3);
    });
  });

  describe('reset functionality', () => {
    it('should reset all metrics', () => {
      const tracker = new MetricsTracker();

      tracker.endRequest(tracker.startRequest('GET', '/api'), 200);
      tracker.endRequest(tracker.startRequest('POST', '/api'), 201);

      tracker.reset();

      const metrics = tracker.getMetrics();
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.successfulRequests).toBe(0);
      expect(metrics.failedRequests).toBe(0);
      expect(metrics.averageLatency).toBe(0);
      expect(metrics.requestsByMethod).toEqual({});
      expect(metrics.requestsByStatus).toEqual({});
      expect(metrics.requestsByEndpoint).toEqual({});
    });

    it('should allow tracking after reset', () => {
      const tracker = new MetricsTracker();

      tracker.endRequest(tracker.startRequest('GET', '/api'), 200);
      tracker.reset();

      tracker.endRequest(tracker.startRequest('POST', '/api'), 201);

      const metrics = tracker.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.requestsByMethod.POST).toBe(1);
    });

    it('should not clear in-flight requests on reset', () => {
      const tracker = new MetricsTracker();

      const req = tracker.startRequest('GET', '/api');
      tracker.reset();

      expect(tracker.getMetrics().inFlightRequests).toBe(1);

      tracker.endRequest(req, 200);
      expect(tracker.getMetrics().totalRequests).toBe(1);
    });
  });

  describe('percentile tracking', () => {
    it('should calculate p50 (median) latency', () => {
      const tracker = new MetricsTracker();

      // Add requests with varying latencies: 100, 200, 300, 400, 500
      for (let i = 1; i <= 5; i++) {
        const req = tracker.startRequest('GET', '/api');
        vi.advanceTimersByTime(i * 100);
        tracker.endRequest(req, 200);
      }

      const metrics = tracker.getMetrics();
      expect(metrics.p50Latency).toBe(300);
    });

    it('should calculate p95 latency', () => {
      const tracker = new MetricsTracker();

      // Add 100 requests with latencies 1-100
      for (let i = 1; i <= 100; i++) {
        const req = tracker.startRequest('GET', '/api');
        vi.advanceTimersByTime(i);
        tracker.endRequest(req, 200);
      }

      const metrics = tracker.getMetrics();
      expect(metrics.p95Latency).toBe(95);
    });

    it('should calculate p99 latency', () => {
      const tracker = new MetricsTracker();

      // Add 100 requests with latencies 1-100
      for (let i = 1; i <= 100; i++) {
        const req = tracker.startRequest('GET', '/api');
        vi.advanceTimersByTime(i);
        tracker.endRequest(req, 200);
      }

      const metrics = tracker.getMetrics();
      expect(metrics.p99Latency).toBe(99);
    });

    it('should return 0 for percentiles when no requests', () => {
      const tracker = new MetricsTracker();

      const metrics = tracker.getMetrics();
      expect(metrics.p50Latency).toBe(0);
      expect(metrics.p95Latency).toBe(0);
      expect(metrics.p99Latency).toBe(0);
    });
  });

  describe('time window tracking', () => {
    it('should track metrics start time', () => {
      vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));

      const tracker = new MetricsTracker();

      const metrics = tracker.getMetrics();
      expect(metrics.startTime).toEqual(new Date('2025-01-01T00:00:00Z'));
    });

    it('should calculate elapsed time', () => {
      vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));

      const tracker = new MetricsTracker();

      vi.setSystemTime(new Date('2025-01-01T00:05:00Z')); // 5 minutes later

      const metrics = tracker.getMetrics();
      expect(metrics.elapsedTime).toBe(300000); // 5 minutes in ms
    });

    it('should calculate requests per second', () => {
      vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));

      const tracker = new MetricsTracker();

      // Add 10 requests
      for (let i = 0; i < 10; i++) {
        tracker.endRequest(tracker.startRequest('GET', '/api'), 200);
      }

      vi.setSystemTime(new Date('2025-01-01T00:00:05Z')); // 5 seconds later

      const metrics = tracker.getMetrics();
      expect(metrics.requestsPerSecond).toBe(2); // 10 requests / 5 seconds
    });

    it('should handle zero elapsed time for RPS calculation', () => {
      const tracker = new MetricsTracker();

      tracker.endRequest(tracker.startRequest('GET', '/api'), 200);

      const metrics = tracker.getMetrics();
      expect(metrics.requestsPerSecond).toBe(0); // Avoid division by zero
    });
  });

  describe('edge cases', () => {
    it('should handle very fast requests (< 1ms)', () => {
      const tracker = new MetricsTracker();

      const req = tracker.startRequest('GET', '/api');
      vi.advanceTimersByTime(0.5);
      tracker.endRequest(req, 200);

      const metrics = tracker.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.minLatency).toBeGreaterThanOrEqual(0);
    });

    it('should handle very slow requests (> 1 minute)', () => {
      const tracker = new MetricsTracker();

      const req = tracker.startRequest('GET', '/api');
      vi.advanceTimersByTime(120000); // 2 minutes
      tracker.endRequest(req, 200);

      const metrics = tracker.getMetrics();
      expect(metrics.maxLatency).toBe(120000);
    });

    it('should handle ending non-existent request gracefully', () => {
      const tracker = new MetricsTracker();

      // Should not throw
      tracker.endRequest('non-existent-id', 200);

      const metrics = tracker.getMetrics();
      expect(metrics.totalRequests).toBe(0);
    });

    it('should handle many concurrent requests', () => {
      const tracker = new MetricsTracker();

      const requests: string[] = [];

      // Start 1000 concurrent requests
      for (let i = 0; i < 1000; i++) {
        requests.push(tracker.startRequest('GET', `/api/${i}`));
      }

      expect(tracker.getMetrics().inFlightRequests).toBe(1000);

      // End all requests
      for (const req of requests) {
        tracker.endRequest(req, 200);
      }

      expect(tracker.getMetrics().totalRequests).toBe(1000);
      expect(tracker.getMetrics().inFlightRequests).toBe(0);
    });
  });

  describe('JSON export', () => {
    it('should export metrics as JSON', () => {
      const tracker = new MetricsTracker();

      tracker.endRequest(tracker.startRequest('GET', '/api'), 200);

      const json = tracker.getMetricsJSON();

      expect(typeof json).toBe('string');
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('should include all metrics in JSON export', () => {
      const tracker = new MetricsTracker();

      tracker.endRequest(tracker.startRequest('GET', '/api'), 200);

      const json = JSON.parse(tracker.getMetricsJSON());

      expect(json).toHaveProperty('totalRequests');
      expect(json).toHaveProperty('successfulRequests');
      expect(json).toHaveProperty('failedRequests');
      expect(json).toHaveProperty('successRate');
      expect(json).toHaveProperty('averageLatency');
      expect(json).toHaveProperty('requestsByMethod');
      expect(json).toHaveProperty('requestsByStatus');
    });
  });
});
