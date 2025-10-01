/**
 * Task 7.4: Implement Health Check Endpoint
 *
 * Provides health check endpoint for load balancer and monitoring.
 * Checks Redis, Firestore, and queue status to determine system health.
 * Responds quickly (< 1s) with comprehensive health information.
 */

import type { QueueManager } from './queue-manager.js';
import type { QueueServiceConfig } from './queue-manager.js';
import type { QueueLogger } from './logger.js';

/**
 * Health status response
 */
export interface HealthStatus {
  /** Overall health status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Timestamp of health check */
  timestamp: string;
  /** Individual component checks */
  checks: {
    /** Redis connection status */
    redis: 'up' | 'down';
    /** Firestore connection status */
    firestore: 'up' | 'down';
    /** Queue capacity status */
    queue: 'healthy' | 'warning' | 'full';
  };
  /** Detailed health information */
  details: {
    /** Current queue size (waiting + active + delayed) */
    queueSize: number;
    /** Maximum queue size threshold */
    queueLimit: number;
    /** Health check response time in milliseconds */
    responseTime: number;
  };
}

/**
 * Health check service
 *
 * Provides fast health checks for load balancer and monitoring.
 * Checks all critical dependencies and returns detailed status.
 * Implements timeout protection to ensure quick responses.
 */
export class HealthCheck {
  private queueManager: QueueManager;
  private config: QueueServiceConfig;
  private logger: QueueLogger;

  /**
   * Health check timeout in milliseconds (1 second)
   */
  private static readonly HEALTH_CHECK_TIMEOUT = 1000;

  /**
   * Cache duration for health check results (5 seconds)
   * Prevents health check spam
   */
  private static readonly CACHE_TTL_MS = 5000;

  /**
   * Cached health status
   */
  private cachedStatus: HealthStatus | null = null;

  /**
   * Timestamp of cached status
   */
  private cacheTimestamp: number = 0;

  /**
   * Creates a new HealthCheck instance
   *
   * @param queueManager - Queue manager instance
   * @param config - Queue service configuration
   * @param logger - Logger instance
   */
  constructor(
    queueManager: QueueManager,
    config: QueueServiceConfig,
    logger: QueueLogger
  ) {
    this.queueManager = queueManager;
    this.config = config;
    this.logger = logger;
  }

  /**
   * Check system health
   *
   * Performs comprehensive health check of all system components:
   * - Redis connection
   * - Firestore connection (basic check)
   * - Queue capacity
   *
   * Returns cached result if within TTL to prevent health check spam.
   * Implements timeout protection to ensure fast response.
   *
   * @returns Health status
   */
  async checkHealth(): Promise<HealthStatus> {
    const startTime = Date.now();

    // Check cache
    if (this.isCacheValid()) {
      // Update response time for cached result
      const cached = this.cachedStatus!;
      return {
        ...cached,
        details: {
          ...cached.details,
          responseTime: Date.now() - startTime,
        },
      };
    }

    try {
      // Perform health check with timeout
      const status = await this.performHealthCheck(startTime);

      // Cache result
      this.cachedStatus = status;
      this.cacheTimestamp = Date.now();

      return status;
    } catch (error) {
      // If health check fails or times out, return unhealthy
      this.logger.logWarn('health_check_failed', {
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      });

      const failedStatus: HealthStatus = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        checks: {
          redis: 'down',
          firestore: 'down',
          queue: 'healthy',
        },
        details: {
          queueSize: 0,
          queueLimit: this.config.queue.systemQueueLimit,
          responseTime: Date.now() - startTime,
        },
      };

      return failedStatus;
    }
  }

  /**
   * Get HTTP status code for health status
   *
   * @param status - Health status
   * @returns HTTP status code (200 or 503)
   */
  getHttpStatusCode(status: HealthStatus): number {
    return status.status === 'healthy' ? 200 : 503;
  }

  /**
   * Perform health check with timeout protection
   *
   * @param startTime - Start timestamp for response time calculation
   * @returns Health status
   */
  private async performHealthCheck(startTime: number): Promise<HealthStatus> {
    // Create timeout promise
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Health check timeout'));
      }, HealthCheck.HEALTH_CHECK_TIMEOUT);
    });

    // Race health check against timeout
    return Promise.race([this.doHealthCheck(startTime), timeout]);
  }

  /**
   * Execute health check
   *
   * @param startTime - Start timestamp for response time calculation
   * @returns Health status
   */
  private async doHealthCheck(startTime: number): Promise<HealthStatus> {
    // Check Redis connection
    const redisStatus = await this.checkRedisConnection();

    // Check Firestore connection (basic check - projectId exists)
    const firestoreStatus = this.checkFirestoreConnection();

    // Check queue capacity
    const queueStatus = await this.checkQueueCapacity();

    // Determine overall status
    const overallStatus = this.determineOverallStatus(
      redisStatus,
      firestoreStatus,
      queueStatus
    );

    const responseTime = Date.now() - startTime;

    const status: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks: {
        redis: redisStatus ? 'up' : 'down',
        firestore: firestoreStatus ? 'up' : 'down',
        queue: queueStatus.status,
      },
      details: {
        queueSize: queueStatus.size,
        queueLimit: this.config.queue.systemQueueLimit,
        responseTime,
      },
    };

    return status;
  }

  /**
   * Check Redis connection
   *
   * @returns True if Redis is connected, false otherwise
   */
  private async checkRedisConnection(): Promise<boolean> {
    try {
      return await this.queueManager.isConnected();
    } catch (error) {
      return false;
    }
  }

  /**
   * Check Firestore connection
   *
   * Basic check to verify Firestore configuration is present.
   * Does not perform actual network call to keep health check fast.
   *
   * @returns True if Firestore is configured, false otherwise
   */
  private checkFirestoreConnection(): boolean {
    // Basic configuration check
    // A full connection check would be too slow for health endpoint
    return !!(this.config.firestore && this.config.firestore.projectId);
  }

  /**
   * Check queue capacity
   *
   * @returns Queue status information
   */
  private async checkQueueCapacity(): Promise<{
    status: 'healthy' | 'warning' | 'full';
    size: number;
  }> {
    try {
      const queue = this.queueManager.getQueue();
      const counts = await queue.getJobCounts();

      // Calculate total queue size
      const queueSize =
        (counts['waiting'] || 0) + (counts['active'] || 0) + (counts['delayed'] || 0);

      const systemLimit = this.config.queue.systemQueueLimit;
      const warningThreshold = this.config.queue.warningThreshold;

      // Determine queue status
      let status: 'healthy' | 'warning' | 'full';

      if (queueSize > systemLimit) {
        status = 'full';
      } else if (queueSize > warningThreshold) {
        status = 'warning';
      } else {
        status = 'healthy';
      }

      return { status, size: queueSize };
    } catch (error) {
      // If we can't get queue counts, assume unhealthy
      return { status: 'full', size: 0 };
    }
  }

  /**
   * Determine overall health status based on component checks
   *
   * @param redisUp - Redis connection status
   * @param firestoreUp - Firestore connection status
   * @param queueStatus - Queue status
   * @returns Overall health status
   */
  private determineOverallStatus(
    redisUp: boolean,
    firestoreUp: boolean,
    queueStatus: { status: 'healthy' | 'warning' | 'full'; size: number }
  ): 'healthy' | 'degraded' | 'unhealthy' {
    // Unhealthy if Redis is down or queue is full
    if (!redisUp || queueStatus.status === 'full') {
      return 'unhealthy';
    }

    // Degraded if Firestore is down or queue is at warning level
    if (!firestoreUp || queueStatus.status === 'warning') {
      return 'degraded';
    }

    // Healthy if all systems are operational
    return 'healthy';
  }

  /**
   * Check if cached health status is still valid
   *
   * @returns True if cache is valid, false otherwise
   */
  private isCacheValid(): boolean {
    if (!this.cachedStatus) {
      return false;
    }

    const now = Date.now();
    const age = now - this.cacheTimestamp;

    return age < HealthCheck.CACHE_TTL_MS;
  }
}
