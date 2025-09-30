import { randomUUID } from 'crypto';

/**
 * Request metrics summary
 */
export interface RequestMetrics {
  /** Total number of completed requests */
  totalRequests: number;

  /** Number of successful requests (2xx, 3xx status) */
  successfulRequests: number;

  /** Number of failed requests (4xx, 5xx status) */
  failedRequests: number;

  /** Success rate as percentage (0-100) */
  successRate: number;

  /** Number of requests currently in flight */
  inFlightRequests: number;

  /** Average latency in milliseconds */
  averageLatency: number;

  /** Minimum latency in milliseconds */
  minLatency: number;

  /** Maximum latency in milliseconds */
  maxLatency: number;

  /** P50 (median) latency in milliseconds */
  p50Latency: number;

  /** P95 latency in milliseconds */
  p95Latency: number;

  /** P99 latency in milliseconds */
  p99Latency: number;

  /** Breakdown by HTTP method */
  requestsByMethod: Record<string, number>;

  /** Breakdown by HTTP status code */
  requestsByStatus: Record<number, number>;

  /** Breakdown by endpoint */
  requestsByEndpoint: Record<string, number>;

  /** Metrics collection start time */
  startTime: Date;

  /** Elapsed time since metrics collection started (ms) */
  elapsedTime: number;

  /** Requests per second */
  requestsPerSecond: number;
}

/**
 * Internal request tracking data
 */
interface RequestData {
  method: string;
  endpoint: string;
  startTime: number;
}

/**
 * Metrics Tracker for PixelLab API Client
 *
 * Tracks performance metrics for API requests with:
 * - Request counting (total, successful, failed)
 * - Latency tracking (min, max, average, percentiles)
 * - Success/failure rate calculation
 * - Breakdown by method, status, and endpoint
 * - Throughput tracking (requests per second)
 * - In-flight request monitoring
 *
 * @example
 * ```typescript
 * const tracker = new MetricsTracker();
 *
 * const requestId = tracker.startRequest('POST', '/characters');
 * // ... perform request ...
 * tracker.endRequest(requestId, 201);
 *
 * const metrics = tracker.getMetrics();
 * console.log(`Success rate: ${metrics.successRate}%`);
 * console.log(`Average latency: ${metrics.averageLatency}ms`);
 * ```
 */
export class MetricsTracker {
  private inFlightRequests: Map<string, RequestData> = new Map();
  private completedRequests: number = 0;
  private successfulRequests: number = 0;
  private failedRequests: number = 0;

  private latencies: number[] = [];
  private requestsByMethod: Map<string, number> = new Map();
  private requestsByStatus: Map<number, number> = new Map();
  private requestsByEndpoint: Map<string, number> = new Map();

  private readonly startTime: Date;

  constructor() {
    this.startTime = new Date();
  }

  /**
   * Start tracking a new request
   *
   * @param method - HTTP method (GET, POST, etc.)
   * @param endpoint - Request endpoint/path
   * @returns Unique request ID for tracking
   */
  public startRequest(method: string, endpoint: string): string {
    const requestId = randomUUID();

    this.inFlightRequests.set(requestId, {
      method,
      endpoint,
      startTime: Date.now(),
    });

    return requestId;
  }

  /**
   * End request tracking and record metrics
   *
   * @param requestId - Request ID from startRequest()
   * @param statusCode - HTTP status code
   */
  public endRequest(requestId: string, statusCode: number): void {
    const requestData = this.inFlightRequests.get(requestId);

    if (!requestData) {
      // Request not found - may have been ended already or never started
      return;
    }

    // Calculate latency
    const endTime = Date.now();
    const latency = endTime - requestData.startTime;

    // Update counters
    this.completedRequests++;
    this.latencies.push(latency);

    // Track success/failure
    if (this.isSuccessStatus(statusCode)) {
      this.successfulRequests++;
    } else {
      this.failedRequests++;
    }

    // Track by method
    const methodCount = this.requestsByMethod.get(requestData.method) || 0;
    this.requestsByMethod.set(requestData.method, methodCount + 1);

    // Track by status
    const statusCount = this.requestsByStatus.get(statusCode) || 0;
    this.requestsByStatus.set(statusCode, statusCount + 1);

    // Track by endpoint
    const endpointCount = this.requestsByEndpoint.get(requestData.endpoint) || 0;
    this.requestsByEndpoint.set(requestData.endpoint, endpointCount + 1);

    // Remove from in-flight
    this.inFlightRequests.delete(requestId);
  }

  /**
   * Get current metrics summary
   */
  public getMetrics(): RequestMetrics {
    const elapsedTime = Date.now() - this.startTime.getTime();
    const elapsedSeconds = elapsedTime / 1000;

    return {
      totalRequests: this.completedRequests,
      successfulRequests: this.successfulRequests,
      failedRequests: this.failedRequests,
      successRate: this.calculateSuccessRate(),
      inFlightRequests: this.inFlightRequests.size,
      averageLatency: this.calculateAverageLatency(),
      minLatency: this.calculateMinLatency(),
      maxLatency: this.calculateMaxLatency(),
      p50Latency: this.calculatePercentile(50),
      p95Latency: this.calculatePercentile(95),
      p99Latency: this.calculatePercentile(99),
      requestsByMethod: this.mapToObject(this.requestsByMethod),
      requestsByStatus: this.mapToObject(this.requestsByStatus),
      requestsByEndpoint: this.mapToObject(this.requestsByEndpoint),
      startTime: this.startTime,
      elapsedTime,
      requestsPerSecond: elapsedSeconds > 0 ? this.completedRequests / elapsedSeconds : 0,
    };
  }

  /**
   * Export metrics as JSON string
   */
  public getMetricsJSON(): string {
    return JSON.stringify(this.getMetrics(), null, 2);
  }

  /**
   * Reset all metrics
   */
  public reset(): void {
    // Don't clear in-flight requests - they may still complete
    this.completedRequests = 0;
    this.successfulRequests = 0;
    this.failedRequests = 0;
    this.latencies = [];
    this.requestsByMethod.clear();
    this.requestsByStatus.clear();
    this.requestsByEndpoint.clear();
  }

  /**
   * Check if status code indicates success
   * 2xx and 3xx are considered successful
   */
  private isSuccessStatus(statusCode: number): boolean {
    return statusCode >= 200 && statusCode < 400;
  }

  /**
   * Calculate success rate as percentage (0-100)
   */
  private calculateSuccessRate(): number {
    if (this.completedRequests === 0) {
      return 0;
    }

    return Math.round((this.successfulRequests / this.completedRequests) * 100);
  }

  /**
   * Calculate average latency
   */
  private calculateAverageLatency(): number {
    if (this.latencies.length === 0) {
      return 0;
    }

    const sum = this.latencies.reduce((acc, latency) => acc + latency, 0);
    return Math.round(sum / this.latencies.length);
  }

  /**
   * Calculate minimum latency
   */
  private calculateMinLatency(): number {
    if (this.latencies.length === 0) {
      return 0;
    }

    return Math.min(...this.latencies);
  }

  /**
   * Calculate maximum latency
   */
  private calculateMaxLatency(): number {
    if (this.latencies.length === 0) {
      return 0;
    }

    return Math.max(...this.latencies);
  }

  /**
   * Calculate latency percentile
   *
   * @param percentile - Percentile to calculate (0-100)
   */
  private calculatePercentile(percentile: number): number {
    if (this.latencies.length === 0) {
      return 0;
    }

    // Sort latencies
    const sorted = [...this.latencies].sort((a, b) => a - b);

    // Calculate index
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    const clampedIndex = Math.max(0, index);

    const value = sorted[clampedIndex];
    return value !== undefined ? value : 0;
  }

  /**
   * Convert Map to plain object
   */
  private mapToObject<K extends string | number, V>(map: Map<K, V>): Record<K, V> {
    const obj = {} as Record<K, V>;

    map.forEach((value, key) => {
      obj[key] = value;
    });

    return obj;
  }
}
