/**
 * Task 5.3: User Concurrency Limits
 *
 * Enforces per-user job limits (max 5 concurrent jobs by default).
 * Queries BullMQ for user's active jobs (pending + processing),
 * counts jobs by filtering on userId field, rejects if user has ≥ max jobs,
 * and caches user job count for 5 seconds to reduce Redis queries.
 */

import type { QueueManager } from './queue-manager.js';
import type { JobStatusTracker } from './job-status-tracker.js';
import type { QueueLogger } from './logger.js';

/**
 * User limit check result
 */
export interface UserLimitResult {
  /** Whether the user is allowed to submit a new job */
  allowed: boolean;

  /** Current number of active jobs for the user */
  currentJobCount?: number;

  /** Maximum allowed concurrent jobs */
  maxJobs?: number;

  /** Error message if limit is exceeded or check fails */
  error?: string;
}

/**
 * User limits configuration
 */
export interface UserLimitsConfig {
  /** Maximum concurrent jobs per user (default: 5) */
  maxConcurrentJobs: number;

  /** Cache duration in milliseconds (default: 5000ms = 5 seconds) */
  cacheDuration: number;
}

/**
 * Cache entry for user job count
 */
interface CacheEntry {
  count: number;
  timestamp: number;
}

/**
 * User Limits - enforces per-user job limits
 *
 * Features:
 * - Queries BullMQ for user's active jobs (pending + processing states)
 * - Counts jobs by filtering on userId field
 * - Rejects submission if user has ≥ maxConcurrentJobs
 * - Caches user job count for cacheDuration to reduce Redis queries
 * - Returns clear error messages with current job count
 * - Fail closed: rejects if query fails (Redis down)
 *
 * Thread-safety: Uses in-memory cache. For distributed systems, consider Redis cache.
 */
export class UserLimits {
  private queueManager: QueueManager;
  private config: UserLimitsConfig;
  private logger: QueueLogger;
  private cache: Map<string, CacheEntry>;

  /**
   * Creates a new UserLimits instance
   *
   * @param queueManager - QueueManager instance for accessing BullMQ queue
   * @param _jobStatusTracker - JobStatusTracker for querying job status (reserved for future use)
   * @param config - User limits configuration
   * @param logger - Logger instance for structured logging
   */
  constructor(
    queueManager: QueueManager,
    _jobStatusTracker: JobStatusTracker,
    config: UserLimitsConfig,
    logger: QueueLogger
  ) {
    this.queueManager = queueManager;
    this.config = config;
    this.logger = logger;
    this.cache = new Map<string, CacheEntry>();
  }

  /**
   * Check if user can submit a new job based on current active job count
   *
   * Queries BullMQ for user's active jobs (pending + processing states),
   * counts jobs where userId matches, and rejects if user has reached
   * the concurrent job limit. Results are cached per user to reduce
   * Redis queries.
   *
   * Error Handling:
   * - If query fails (Redis down), rejects submission (fail closed)
   * - Logs errors for monitoring
   *
   * @param userId - User identifier to check
   * @returns UserLimitResult indicating whether submission is allowed
   */
  async checkUserLimit(userId: string): Promise<UserLimitResult> {
    try {
      // Check cache first
      const cached = this.getCachedCount(userId);
      if (cached !== null) {
        return this.buildResult(userId, cached);
      }

      // Query BullMQ for all jobs in active states
      const queue = this.queueManager.getQueue();
      const activeStates: ('waiting' | 'active')[] = ['waiting', 'active'];

      // Get all jobs in pending and processing states
      const allJobs = await queue.getJobs(activeStates, 0, -1);

      // Count jobs for this specific user
      const userActiveJobs = allJobs.filter(
        (job) => job.data?.userId === userId
      );
      const jobCount = userActiveJobs.length;

      // Cache the result
      this.setCachedCount(userId, jobCount);

      // Return result
      return this.buildResult(userId, jobCount);
    } catch (error) {
      // Fail closed: if we can't verify the limit, reject the submission
      this.logger.logError('user-limit-check', error as Error, {
        operation: 'checkUserLimit',
        userId,
      });

      return {
        allowed: false,
        error: 'Unable to verify user job limit. Please try again later.',
      };
    }
  }

  /**
   * Clear cache for a specific user or all users
   *
   * Useful when jobs complete and we want to immediately allow new submissions
   * without waiting for cache to expire.
   *
   * @param userId - Optional user ID to clear. If not provided, clears all caches.
   */
  clearCache(userId?: string): void {
    if (userId !== undefined) {
      this.cache.delete(userId);
      this.logger.logInfo('user_limit_cache_cleared', { userId });
    } else {
      this.cache.clear();
      this.logger.logInfo('user_limit_cache_cleared_all', {});
    }
  }

  /**
   * Get cached job count for user if still valid
   *
   * @param userId - User identifier
   * @returns Cached job count or null if not cached or expired
   */
  private getCachedCount(userId: string): number | null {
    const entry = this.cache.get(userId);
    if (!entry) {
      return null;
    }

    // Check if cache has expired
    const now = Date.now();
    const age = now - entry.timestamp;

    if (age > this.config.cacheDuration) {
      // Cache expired, remove it
      this.cache.delete(userId);
      return null;
    }

    return entry.count;
  }

  /**
   * Cache job count for user
   *
   * @param userId - User identifier
   * @param count - Current job count
   */
  private setCachedCount(userId: string, count: number): void {
    this.cache.set(userId, {
      count,
      timestamp: Date.now(),
    });
  }

  /**
   * Build result object based on job count
   *
   * @param userId - User identifier
   * @param jobCount - Current active job count
   * @returns UserLimitResult
   */
  private buildResult(userId: string, jobCount: number): UserLimitResult {
    const allowed = jobCount < this.config.maxConcurrentJobs;

    if (allowed) {
      this.logger.logInfo('user_limit_check', {
        userId,
        currentJobs: jobCount,
        maxJobs: this.config.maxConcurrentJobs,
        allowed: true,
      });

      return {
        allowed: true,
        currentJobCount: jobCount,
        maxJobs: this.config.maxConcurrentJobs,
      };
    } else {
      this.logger.logWarn('user_limit_exceeded', {
        userId,
        currentJobs: jobCount,
        maxJobs: this.config.maxConcurrentJobs,
      });

      return {
        allowed: false,
        currentJobCount: jobCount,
        maxJobs: this.config.maxConcurrentJobs,
        error: `User has reached the maximum concurrent job limit (${jobCount}/${this.config.maxConcurrentJobs}). Please wait for some jobs to complete.`,
      };
    }
  }
}
