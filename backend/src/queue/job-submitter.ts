/**
 * Task 1.3: Implement Job Submission with Validation
 *
 * Creates method to submit jobs to queue with input validation and deduplication check.
 * Handles cache hits, user concurrency limits, and system queue capacity.
 */

import { randomUUID } from 'crypto';
import { createHash } from 'crypto';
import type { QueueManager, QueueServiceConfig } from './queue-manager.js';
import type { QueueLogger } from './logger.js';
import { JobStatus } from '../pixellab/status-parser.js';
import type { GenerationResult } from '../pixellab/result-builder.js';

/**
 * Structured prompt for sprite generation
 */
export interface StructuredPrompt {
  /** Prompt type (e.g., 'character', 'tile') */
  type: string;

  /** Art style (e.g., 'pixel-art') */
  style: string;

  /** Output size in pixels */
  size: {
    width: number;
    height: number;
  };

  /** Action/animation (e.g., 'walking', 'idle') */
  action: string;

  /** Detailed description for generation */
  description: string;

  /** Raw user input */
  raw: string;

  /** Optional generation parameters */
  options?: {
    /** Remove background from sprite */
    noBackground?: boolean;

    /** Text guidance scale (1.0-20.0) */
    textGuidanceScale?: number;

    /** Base64-encoded palette reference image */
    paletteImage?: string;
  };
}

/**
 * Queue overflow warning
 */
export interface QueueOverflowWarning {
  /** Warning message */
  message: string;

  /** Current queue depth */
  queueDepth: number;

  /** Queue capacity */
  capacity: number;
}

/**
 * Job submission response
 */
export interface JobSubmissionResponse {
  /** Unique job identifier (UUID v4) */
  jobId: string;

  /** Current job status */
  status: JobStatus;

  /** Whether result came from cache */
  cacheHit: boolean;

  /** Cached generation result (if cache hit) */
  result?: GenerationResult;

  /** Warning if queue is near capacity */
  warning?: QueueOverflowWarning;

  /** Estimated wait time in seconds */
  estimatedWaitTime?: number;
}

/**
 * Job Submitter - handles job submission with validation
 *
 * Responsibilities:
 * - Validate userId and prompt schema
 * - Generate unique job IDs and cache keys
 * - Check deduplication window
 * - Check cache for existing results
 * - Enforce user concurrency limits
 * - Enforce system queue limits
 * - Submit jobs to BullMQ queue
 * - Track active jobs in Redis
 */
export class JobSubmitter {
  private queueManager: QueueManager;
  private config: QueueServiceConfig;
  private logger: QueueLogger;

  /**
   * Average job processing time in seconds (for wait time estimation)
   */
  private static readonly AVG_JOB_PROCESSING_TIME = 30;

  /**
   * Creates a new JobSubmitter instance
   *
   * @param queueManager - Queue manager instance
   * @param config - Queue service configuration
   * @param logger - Logger instance for structured logging
   */
  constructor(queueManager: QueueManager, config: QueueServiceConfig, logger: QueueLogger) {
    this.queueManager = queueManager;
    this.config = config;
    this.logger = logger;
  }

  /**
   * Submit job to queue with validation
   *
   * @param userId - User identifier (must be non-empty string)
   * @param prompt - Structured prompt for generation
   * @returns Job submission response with job ID or cached result
   * @throws {Error} if validation fails or limits are exceeded
   */
  public async submitJob(userId: string, prompt: StructuredPrompt): Promise<JobSubmissionResponse> {
    // Step 1: Validate inputs
    this.validateUserId(userId);
    this.validatePrompt(prompt);

    // Step 2: Generate job ID and cache key
    const jobId = this.generateJobId();
    const cacheKey = this.generateCacheKey(prompt);

    // Step 3: Check cache for existing result
    const cachedResult = await this.checkCache(cacheKey);
    if (cachedResult) {
      this.logger.logCacheAccess(cacheKey, true, userId);
      return {
        jobId, // Return generated ID even for cache hit
        status: JobStatus.COMPLETED,
        cacheHit: true,
        result: cachedResult,
      };
    }
    this.logger.logCacheAccess(cacheKey, false, userId);

    // Step 4: Check deduplication window
    const duplicateJobId = await this.checkDeduplication(userId, cacheKey);
    if (duplicateJobId) {
      this.logger.logInfo('duplicate_job_detected', {
        userId,
        jobId: duplicateJobId,
        cacheKey,
      });
      return {
        jobId: duplicateJobId,
        status: JobStatus.PROCESSING,
        cacheHit: false,
      };
    }

    // Step 5: Check user concurrency limit
    await this.checkUserConcurrencyLimit(userId);

    // Step 6: Check system queue limit and get current depth
    const queueDepth = await this.checkSystemQueueLimit();

    // Step 7: Add job to queue
    await this.addJobToQueue(jobId, userId, prompt);

    // Step 8: Set deduplication key in Redis
    await this.setDeduplicationKey(userId, cacheKey, jobId);

    // Step 9: Track active job in Redis
    await this.trackActiveJob(userId, jobId);

    // Step 10: Log job submission
    this.logger.logJobSubmission(jobId, userId, prompt);

    // Step 11: Build response
    const response: JobSubmissionResponse = {
      jobId,
      status: JobStatus.PROCESSING,
      cacheHit: false,
      estimatedWaitTime: this.calculateEstimatedWaitTime(queueDepth),
    };

    // Add warning if queue is near capacity
    if (queueDepth >= this.config.queue.warningThreshold) {
      response.warning = {
        message: `Queue is under high load (${queueDepth}/${this.config.queue.systemQueueLimit})`,
        queueDepth,
        capacity: this.config.queue.systemQueueLimit,
      };
    }

    return response;
  }

  /**
   * Validate userId is non-empty string
   *
   * @param userId - User identifier to validate
   * @throws {Error} if userId is invalid
   */
  private validateUserId(userId: string): void {
    if (typeof userId !== 'string' || userId.trim().length === 0) {
      throw new Error('userId must be a non-empty string');
    }
  }

  /**
   * Validate StructuredPrompt schema
   *
   * @param prompt - Prompt to validate
   * @throws {Error} if prompt is invalid
   */
  private validatePrompt(prompt: StructuredPrompt): void {
    // Check required fields
    if (!prompt || typeof prompt !== 'object') {
      throw new Error('Prompt must be an object');
    }

    if (typeof prompt.type !== 'string' || prompt.type.length === 0) {
      throw new Error('Prompt type is required and must be a non-empty string');
    }

    if (typeof prompt.style !== 'string' || prompt.style.length === 0) {
      throw new Error('Prompt style is required and must be a non-empty string');
    }

    if (!prompt.size || typeof prompt.size !== 'object') {
      throw new Error('Prompt size is required and must be an object');
    }

    if (typeof prompt.size.width !== 'number' || prompt.size.width <= 0) {
      throw new Error('Prompt size.width is required and must be a positive number');
    }

    if (typeof prompt.size.height !== 'number' || prompt.size.height <= 0) {
      throw new Error('Prompt size.height is required and must be a positive number');
    }

    if (typeof prompt.action !== 'string') {
      throw new Error('Prompt action is required and must be a string');
    }

    if (typeof prompt.description !== 'string' || prompt.description.length === 0) {
      throw new Error('Prompt description is required and must be a non-empty string');
    }

    if (typeof prompt.raw !== 'string') {
      throw new Error('Prompt raw is required and must be a string');
    }

    // Validate optional fields if present
    if (prompt.options !== undefined) {
      if (typeof prompt.options !== 'object' || prompt.options === null) {
        throw new Error('Prompt options must be an object if provided');
      }

      if (prompt.options.noBackground !== undefined && typeof prompt.options.noBackground !== 'boolean') {
        throw new Error('Prompt options.noBackground must be a boolean if provided');
      }

      if (prompt.options.textGuidanceScale !== undefined) {
        if (typeof prompt.options.textGuidanceScale !== 'number') {
          throw new Error('Prompt options.textGuidanceScale must be a number if provided');
        }
        if (prompt.options.textGuidanceScale < 1.0 || prompt.options.textGuidanceScale > 20.0) {
          throw new Error('Prompt options.textGuidanceScale must be between 1.0 and 20.0');
        }
      }

      if (prompt.options.paletteImage !== undefined && typeof prompt.options.paletteImage !== 'string') {
        throw new Error('Prompt options.paletteImage must be a string if provided');
      }
    }
  }

  /**
   * Generate unique job ID using UUID v4
   *
   * @returns UUID v4 string
   */
  private generateJobId(): string {
    return randomUUID();
  }

  /**
   * Generate cache key using SHA-256 hash of prompt
   *
   * @param prompt - Structured prompt
   * @returns Cache key with prefix
   */
  private generateCacheKey(prompt: StructuredPrompt): string {
    // Create stable JSON representation for hashing
    const promptJson = JSON.stringify(prompt, Object.keys(prompt).sort());

    // Generate SHA-256 hash
    const hash = createHash('sha256').update(promptJson).digest('hex');

    return `cache:${hash}`;
  }

  /**
   * Check cache for existing result
   *
   * @param cacheKey - Cache key to check
   * @returns Cached result if found, undefined otherwise
   */
  private async checkCache(cacheKey: string): Promise<GenerationResult | undefined> {
    try {
      const queue = this.queueManager.getQueue();
      const redis = (queue as any).client;

      const cached = await redis.get(cacheKey);
      if (!cached) {
        return undefined;
      }

      // Parse cached result
      const result = JSON.parse(cached) as GenerationResult;
      return result;
    } catch (error) {
      // If cache check fails (malformed JSON, etc.), treat as cache miss
      if (error instanceof SyntaxError) {
        // Invalid JSON - treat as cache miss
        return undefined;
      }
      // Re-throw other errors (Redis connection issues, etc.)
      throw error;
    }
  }

  /**
   * Check deduplication window for duplicate submissions
   *
   * @param userId - User identifier
   * @param cacheKey - Cache key for the prompt
   * @returns Existing job ID if duplicate found, undefined otherwise
   */
  private async checkDeduplication(userId: string, cacheKey: string): Promise<string | undefined> {
    try {
      const queue = this.queueManager.getQueue();
      const redis = (queue as any).client;

      // Build deduplication key pattern
      const dedupKeyPattern = `dedup:${userId}:*`;

      // Get all deduplication keys for this user
      const dedupKeys = await redis.keys(dedupKeyPattern);

      // Check each key to see if it matches our cache key
      for (const dedupKey of dedupKeys) {
        const jobId = await redis.get(dedupKey);
        if (jobId) {
          // Verify this is for the same prompt by checking if dedup key contains cache hash
          // Format: dedup:userId:cacheHash
          const cacheHash = cacheKey.replace('cache:', '');
          if (dedupKey.includes(cacheHash)) {
            return jobId;
          }
        }
      }

      return undefined;
    } catch (error) {
      // If deduplication check fails, proceed with submission
      // We don't want transient Redis issues to block job submission
      this.logger.logWarn('deduplication_check_failed', {
        userId,
        cacheKey,
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  }

  /**
   * Check user concurrency limit
   *
   * @param userId - User identifier
   * @throws {Error} if user has reached maximum concurrent jobs
   */
  private async checkUserConcurrencyLimit(userId: string): Promise<void> {
    const queue = this.queueManager.getQueue();
    const redis = (queue as any).client;

    // Get active job keys for this user
    const activeJobKeys = await redis.keys(`active:${userId}:*`);

    if (activeJobKeys.length >= this.config.queue.maxJobsPerUser) {
      throw new Error(`User has reached maximum concurrent jobs limit (${this.config.queue.maxJobsPerUser})`);
    }
  }

  /**
   * Check system queue limit
   *
   * @returns Current queue depth
   * @throws {Error} if system queue is full
   */
  private async checkSystemQueueLimit(): Promise<number> {
    const queue = this.queueManager.getQueue();

    // Get current job counts
    const counts = await queue.getJobCounts();

    // Calculate total queue depth (waiting + active + delayed)
    const queueDepth = (counts['waiting'] || 0) + (counts['active'] || 0) + (counts['delayed'] || 0);

    if (queueDepth >= this.config.queue.systemQueueLimit) {
      throw new Error(`System queue is full (${queueDepth}/${this.config.queue.systemQueueLimit})`);
    }

    return queueDepth;
  }

  /**
   * Add job to BullMQ queue
   *
   * @param jobId - Job identifier
   * @param userId - User identifier
   * @param prompt - Structured prompt
   */
  private async addJobToQueue(jobId: string, userId: string, prompt: StructuredPrompt): Promise<void> {
    const queue = this.queueManager.getQueue();

    // Add job to queue with job data
    await queue.add(
      'sprite-generation',
      {
        userId,
        prompt,
        jobId,
        submittedAt: new Date().toISOString(),
      },
      {
        jobId, // Use our generated UUID as the BullMQ job ID
        removeOnComplete: false, // Keep for cache
        removeOnFail: false, // Keep for debugging
      }
    );
  }

  /**
   * Set deduplication key in Redis with TTL
   *
   * @param userId - User identifier
   * @param cacheKey - Cache key
   * @param jobId - Job identifier
   */
  private async setDeduplicationKey(userId: string, cacheKey: string, jobId: string): Promise<void> {
    const queue = this.queueManager.getQueue();
    const redis = (queue as any).client;

    // Extract cache hash from cache key (remove "cache:" prefix)
    const cacheHash = cacheKey.replace('cache:', '');

    // Build deduplication key: dedup:userId:cacheHash
    const dedupKey = `dedup:${userId}:${cacheHash}`;

    // Set with TTL from config (deduplication window)
    await redis.setex(dedupKey, this.config.deduplication.windowSeconds, jobId);
  }

  /**
   * Track active job in Redis
   *
   * @param userId - User identifier
   * @param jobId - Job identifier
   */
  private async trackActiveJob(userId: string, jobId: string): Promise<void> {
    const queue = this.queueManager.getQueue();
    const redis = (queue as any).client;

    // Build active job key: active:userId:jobId
    const activeKey = `active:${userId}:${jobId}`;

    // Set active job marker (value doesn't matter, just existence)
    await redis.set(activeKey, '1');
  }

  /**
   * Calculate estimated wait time based on queue depth
   *
   * @param queueDepth - Current queue depth
   * @returns Estimated wait time in seconds
   */
  private calculateEstimatedWaitTime(queueDepth: number): number {
    // Calculate number of job batches ahead in queue
    const concurrency = this.config.queue.concurrency;
    const batchesAhead = Math.ceil(queueDepth / concurrency);

    // Estimate wait time: batches * avg processing time
    const estimatedWaitTime = batchesAhead * JobSubmitter.AVG_JOB_PROCESSING_TIME;

    return estimatedWaitTime;
  }
}
