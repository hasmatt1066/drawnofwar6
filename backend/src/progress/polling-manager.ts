/**
 * Task 3.2: Polling Fallback Manager
 *
 * HTTP polling endpoint for clients that don't support Server-Sent Events.
 * Provides status queries with caching, rate limiting, and authorization checks.
 */

import type { JobStatusTracker, QueueJob } from '../queue/job-status-tracker.js';
import type { QueueServiceConfig } from '../queue/queue-manager.js';
import type { QueueLogger } from '../queue/logger.js';
import { createHash } from 'crypto';

/**
 * Status query result
 */
export interface StatusQueryResult {
  /** Current job status (null if not found) */
  status: QueueJob | null;

  /** Whether the status has been modified since lastModified timestamp */
  modified: boolean;

  /** ETag for cache validation */
  etag: string;
}

/**
 * Cached status entry
 */
interface CachedStatus {
  /** Cached job status */
  job: QueueJob | null;

  /** Cache timestamp */
  timestamp: number;

  /** ETag for this status */
  etag: string;
}

/**
 * Rate limit entry
 */
interface RateLimitEntry {
  /** Last query timestamp */
  lastQuery: number;
}

/**
 * Polling Manager - HTTP polling fallback for SSE
 *
 * Responsibilities:
 * - Provide REST endpoint for job status queries
 * - Cache status for 2 seconds to reduce BullMQ load
 * - Rate limit to 1 request per 2 seconds per job
 * - Return 304 Not Modified when status unchanged
 * - Verify job authorization (user owns job)
 * - Generate ETags for cache validation
 */
export class PollingManager {
  private jobStatusTracker: JobStatusTracker;
  private config: QueueServiceConfig;
  private logger: QueueLogger;

  /** Status cache: jobId -> cached status */
  private statusCache: Map<string, CachedStatus> = new Map();

  /** Rate limit tracking: jobId -> last query time */
  private rateLimits: Map<string, RateLimitEntry> = new Map();

  /** Cache TTL in milliseconds (2 seconds) */
  private static readonly CACHE_TTL = 2000;

  /** Rate limit interval in milliseconds (2 seconds) */
  private static readonly RATE_LIMIT_INTERVAL = 2000;

  /**
   * Creates a new PollingManager instance
   *
   * @param jobStatusTracker - Job status tracker for querying BullMQ
   * @param config - Queue service configuration
   * @param logger - Logger instance for structured logging
   */
  constructor(
    jobStatusTracker: JobStatusTracker,
    config: QueueServiceConfig,
    logger: QueueLogger
  ) {
    this.jobStatusTracker = jobStatusTracker;
    this.config = config;
    this.logger = logger;
  }

  /**
   * Get job status with caching and rate limiting
   *
   * Returns current job status with cache validation support.
   * Implements 2-second cache to reduce BullMQ queries and rate limiting
   * to prevent excessive polling.
   *
   * @param jobId - Unique job identifier
   * @param lastModified - Optional timestamp for cache validation
   * @param userId - Optional user ID for authorization check
   * @returns Status query result with job status, modified flag, and ETag
   */
  async getJobStatus(
    jobId: string,
    lastModified?: number,
    userId?: string
  ): Promise<StatusQueryResult> {
    try {
      // Check rate limit
      if (this.isRateLimited(jobId)) {
        this.logger.logWarn('polling_rate_limited', {
          jobId,
          userId,
        });

        // Return cached value (rate limited)
        const cached = this.statusCache.get(jobId);
        if (cached) {
          return {
            status: cached.job,
            modified: false,
            etag: cached.etag,
          };
        }
      }

      // Update rate limit
      this.updateRateLimit(jobId);

      // Check cache
      const cached = this.getCachedStatus(jobId);
      if (cached) {
        const job = cached.job;

        // Check authorization
        if (userId && job && job.userId !== userId) {
          this.logger.logWarn('polling_unauthorized_access', {
            jobId,
            requestingUserId: userId,
            jobUserId: job.userId,
          });
          return {
            status: null,
            modified: true,
            etag: '',
          };
        }

        // Check if modified since lastModified timestamp
        if (lastModified !== undefined && job) {
          const jobModifiedTime = job.completedAt || job.startedAt || job.createdAt;
          if (jobModifiedTime <= lastModified) {
            return {
              status: job,
              modified: false,
              etag: cached.etag,
            };
          }
        }

        this.logger.logInfo('polling_status_query', {
          jobId,
          userId,
          cached: true,
          found: job !== null,
        });

        return {
          status: job,
          modified: true,
          etag: cached.etag,
        };
      }

      // Query job status from tracker
      const job = await this.jobStatusTracker.getJobStatus(jobId);

      // Check authorization
      if (userId && job && job.userId !== userId) {
        this.logger.logWarn('polling_unauthorized_access', {
          jobId,
          requestingUserId: userId,
          jobUserId: job.userId,
        });
        return {
          status: null,
          modified: true,
          etag: '',
        };
      }

      // Generate ETag
      const etag = this.generateETag(job);

      // Cache the result
      this.cacheStatus(jobId, job, etag);

      this.logger.logInfo('polling_status_query', {
        jobId,
        userId,
        cached: false,
        found: job !== null,
      });

      // Check if modified since lastModified timestamp
      let modified = true;
      if (lastModified !== undefined && job) {
        const jobModifiedTime = job.completedAt || job.startedAt || job.createdAt;
        if (jobModifiedTime <= lastModified) {
          modified = false;
        }
      }

      return {
        status: job,
        modified,
        etag,
      };
    } catch (error) {
      // Clear cache on error to prevent stale data
      this.statusCache.delete(jobId);

      this.logger.logError(jobId, error as Error, {
        operation: 'getJobStatus',
        userId,
      });

      throw error;
    }
  }

  /**
   * Check if job is rate limited
   *
   * @param jobId - Job identifier
   * @returns True if rate limited
   */
  private isRateLimited(jobId: string): boolean {
    const rateLimitEntry = this.rateLimits.get(jobId);
    if (!rateLimitEntry) {
      return false;
    }

    const now = Date.now();
    const timeSinceLastQuery = now - rateLimitEntry.lastQuery;

    return timeSinceLastQuery < PollingManager.RATE_LIMIT_INTERVAL;
  }

  /**
   * Update rate limit tracking
   *
   * @param jobId - Job identifier
   */
  private updateRateLimit(jobId: string): void {
    this.rateLimits.set(jobId, {
      lastQuery: Date.now(),
    });
  }

  /**
   * Get cached status if available and not expired
   *
   * @param jobId - Job identifier
   * @returns Cached status or null if not available/expired
   */
  private getCachedStatus(jobId: string): CachedStatus | null {
    const cached = this.statusCache.get(jobId);
    if (!cached) {
      return null;
    }

    const now = Date.now();
    const age = now - cached.timestamp;

    if (age >= PollingManager.CACHE_TTL) {
      // Cache expired
      this.statusCache.delete(jobId);
      return null;
    }

    return cached;
  }

  /**
   * Cache job status
   *
   * @param jobId - Job identifier
   * @param job - Job status to cache
   * @param etag - ETag for this status
   */
  private cacheStatus(jobId: string, job: QueueJob | null, etag: string): void {
    this.statusCache.set(jobId, {
      job,
      timestamp: Date.now(),
      etag,
    });
  }

  /**
   * Generate ETag for job status
   *
   * Creates a hash of the job state to detect changes.
   *
   * @param job - Job status
   * @returns ETag string
   */
  private generateETag(job: QueueJob | null): string {
    if (!job) {
      return 'null';
    }

    // Create hash based on job state that matters for clients
    const stateString = JSON.stringify({
      jobId: job.jobId,
      status: job.status,
      progress: job.progress,
      completedAt: job.completedAt,
      errorMessage: job.errorMessage,
      result: job.result ? 'present' : 'absent',
    });

    return createHash('md5').update(stateString).digest('hex');
  }
}
