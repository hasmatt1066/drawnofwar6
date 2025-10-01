/**
 * Task 6.1: Job Processor with PixelLabClient Integration
 *
 * Core job processing logic that integrates PixelLab API client with queue system.
 * Extracts prompts from queued jobs, calls PixelLab to generate sprites, tracks progress,
 * handles errors, and caches results.
 *
 * Features:
 * - Extract StructuredPrompt from job data and map to GenerationRequest
 * - Call SpriteGenerator to submit generation request
 * - Poll PixelLab job status via StatusPoller
 * - Update job progress during polling (10% → 90%)
 * - Handle completion and retrieve sprite frames
 * - Decode images and build result via ResultBuilder
 * - Cache result via CacheManager
 * - Classify errors and handle retries
 * - Track generation time and metadata
 */

import type { Job } from 'bullmq';
import { SpriteGenerator, JobSubmissionResponse } from '../pixellab/sprite-generator.js';
import { StatusPoller } from '../pixellab/status-poller.js';
import { ResultBuilder } from '../pixellab/result-builder.js';
import { ImageDecoder } from '../pixellab/image-decoder.js';
import { GenerationRequest } from '../pixellab/request-validator.js';
import { PixelLabError } from '../pixellab/errors.js';
import { CacheManager } from '../cache/cache-manager.js';
import { CacheEntry } from '../cache/redis-cache.js';
import { ProgressIntegrator } from '../progress/progress-integrator.js';
import { ErrorClassifier } from '../retry/error-classifier.js';
import { QueueLogger } from './logger.js';
import { JobStatus, StructuredPrompt, SpriteGenerationResult } from './job-status-tracker.js';

/**
 * Job Processor - core job processing logic with PixelLab integration
 *
 * Responsibilities:
 * - Extract and validate job data
 * - Map StructuredPrompt to PixelLab GenerationRequest
 * - Submit generation request to PixelLab
 * - Poll for completion with progress updates
 * - Decode images and build result
 * - Cache result for future requests
 * - Handle errors and classify for retry
 * - Track timing and metadata
 *
 * Progress Stages:
 * - 0%: Job received
 * - 10%: Submitted to PixelLab
 * - 10-90%: Polling PixelLab (interpolated)
 * - 90%: Generation complete, processing result
 * - 100%: Result cached and ready
 */
export class JobProcessor {
  private spriteGenerator: SpriteGenerator;
  private statusPoller: StatusPoller;
  private cacheManager: CacheManager;
  private progressIntegrator: ProgressIntegrator;
  private logger: QueueLogger;

  /**
   * Cache TTL in milliseconds (30 days)
   */
  private static readonly CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

  /**
   * Progress milestones
   */
  private static readonly PROGRESS_SUBMITTED = 10;
  private static readonly PROGRESS_POLLING_END = 90;
  private static readonly PROGRESS_COMPLETE = 100;

  /**
   * Creates a new JobProcessor instance
   *
   * @param spriteGenerator - SpriteGenerator instance for submitting generation requests
   * @param statusPoller - StatusPoller instance for polling job status
   * @param cacheManager - CacheManager instance for caching results
   * @param progressIntegrator - ProgressIntegrator instance for progress tracking
   * @param logger - Logger instance for structured logging
   */
  constructor(
    spriteGenerator: SpriteGenerator,
    statusPoller: StatusPoller,
    cacheManager: CacheManager,
    progressIntegrator: ProgressIntegrator,
    logger: QueueLogger
  ) {
    this.spriteGenerator = spriteGenerator;
    this.statusPoller = statusPoller;
    this.cacheManager = cacheManager;
    this.progressIntegrator = progressIntegrator;
    this.logger = logger;
  }

  /**
   * Process a queued job
   *
   * Main job processing flow:
   * 1. Extract and validate job data
   * 2. Map StructuredPrompt to GenerationRequest
   * 3. Submit to PixelLab via SpriteGenerator
   * 4. Update progress to 10%
   * 5. Poll status via StatusPoller (update progress 10-90%)
   * 6. On completion, decode images
   * 7. Build result via ResultBuilder
   * 8. Update progress to 90%
   * 9. Cache result via CacheManager
   * 10. Update progress to 100%
   * 11. Return SpriteGenerationResult
   *
   * @param job - BullMQ Job instance
   * @returns SpriteGenerationResult with frames and metadata
   * @throws {PixelLabError} If generation fails
   * @throws {Error} If job data is invalid
   */
  async processJob(job: Job): Promise<SpriteGenerationResult> {
    const startTime = Date.now();

    try {
      // Step 1: Extract and validate job data
      const jobData = this.extractJobData(job);
      const { jobId, userId, structuredPrompt, cacheKey } = jobData;

      this.logger.logInfo('job_processing_started', {
        jobId,
        userId,
        cacheKey,
      });

      // Broadcast state change to PROCESSING
      await this.progressIntegrator
        .broadcastStateChange(jobId, userId, JobStatus.PENDING, JobStatus.PROCESSING)
        .catch((error) => {
          this.logger.logWarn('broadcast_state_change_failed', {
            jobId,
            error: error instanceof Error ? error.message : String(error),
          });
        });

      // Step 2: Map StructuredPrompt to GenerationRequest
      const generationRequest = this.mapPromptToRequest(structuredPrompt);

      // Step 3: Submit to PixelLab
      let submission: JobSubmissionResponse;
      try {
        submission = await this.spriteGenerator.submitGeneration(generationRequest);

        this.logger.logInfo('pixellab_submission_success', {
          jobId,
          characterId: submission.characterId,
          name: submission.name,
        });
      } catch (error) {
        // Classify and log error
        const classified = ErrorClassifier.classify(error);
        this.logger.logError(jobId, classified.originalError, {
          operation: 'processJob',
          stage: 'submission',
          errorType: classified.type,
          retryable: classified.retryable,
        });
        throw error;
      }

      // Step 4: Update progress to 10% (submitted)
      await job.updateProgress(JobProcessor.PROGRESS_SUBMITTED);

      // Step 5: Poll for completion
      let statusResponse;
      try {
        statusResponse = await this.statusPoller.pollUntilComplete(submission.characterId);

        this.logger.logInfo('pixellab_polling_complete', {
          jobId,
          characterId: submission.characterId,
          status: statusResponse.status,
        });
      } catch (error) {
        // Classify and log error
        const classified = ErrorClassifier.classify(error);
        this.logger.logError(jobId, classified.originalError, {
          operation: 'processJob',
          stage: 'polling',
          errorType: classified.type,
          retryable: classified.retryable,
        });
        throw error;
      }

      // Step 6: Verify we have character data
      if (!statusResponse.characterData) {
        throw new Error('PixelLab returned no character data');
      }

      // Step 7: Extract image URLs and decode
      const imageUrls = statusResponse.characterData.rotations.map((rotation) => rotation.url);

      // Note: In PixelLab API, URLs are actually base64-encoded PNG data
      // The ImageDecoder expects base64 strings, not URLs
      let imageBuffers: Buffer[];
      try {
        imageBuffers = ImageDecoder.decodeBase64Array(imageUrls);

        this.logger.logInfo('images_decoded', {
          jobId,
          imageCount: imageBuffers.length,
        });
      } catch (error) {
        // Classify and log error
        const classified = ErrorClassifier.classify(error);
        this.logger.logError(jobId, classified.originalError, {
          operation: 'processJob',
          stage: 'decoding',
          errorType: classified.type,
          retryable: classified.retryable,
        });
        throw error;
      }

      // Step 8: Build result
      let generationResult;
      try {
        generationResult = ResultBuilder.buildResult({
          characterData: statusResponse.characterData,
          images: imageBuffers,
        });

        this.logger.logInfo('result_built', {
          jobId,
          characterId: generationResult.characterId,
          directionCount: generationResult.directions.length,
        });
      } catch (error) {
        // Classify and log error
        const classified = ErrorClassifier.classify(error);
        this.logger.logError(jobId, classified.originalError, {
          operation: 'processJob',
          stage: 'building_result',
          errorType: classified.type,
          retryable: classified.retryable,
        });
        throw error;
      }

      // Step 9: Update progress to 90% (generation complete, caching)
      await job.updateProgress(JobProcessor.PROGRESS_POLLING_END);

      // Step 10: Build SpriteGenerationResult
      const endTime = Date.now();
      const generationTimeMs = endTime - startTime;

      const spriteResult: SpriteGenerationResult = {
        jobId,
        frames: generationResult.directions.map((d) => d.buffer),
        metadata: {
          dimensions: structuredPrompt.size,
          frameCount: generationResult.directions.length,
          generationTimeMs,
          cacheHit: false,
          pixelLabJobId: submission.characterId,
        },
      };

      // Step 11: Cache result
      try {
        const now = Date.now();
        const cacheEntry: CacheEntry = {
          cacheKey,
          userId,
          structuredPrompt,
          result: spriteResult,
          createdAt: now,
          expiresAt: now + JobProcessor.CACHE_TTL_MS,
          hits: 0,
          lastAccessedAt: now,
        };

        await this.cacheManager.set(cacheKey, cacheEntry);

        this.logger.logInfo('result_cached', {
          jobId,
          cacheKey,
        });
      } catch (error) {
        // Cache failure should not fail the job
        this.logger.logWarn('cache_set_failed', {
          jobId,
          cacheKey,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Step 12: Update progress to 100%
      await job.updateProgress(JobProcessor.PROGRESS_COMPLETE);

      // Step 13: Broadcast completion
      await this.progressIntegrator.broadcastCompletion(jobId, userId, spriteResult).catch((error) => {
        this.logger.logWarn('broadcast_completion_failed', {
          jobId,
          error: error instanceof Error ? error.message : String(error),
        });
      });

      this.logger.logInfo('job_processing_complete', {
        jobId,
        userId,
        generationTimeMs,
        frameCount: spriteResult.metadata.frameCount,
      });

      return spriteResult;
    } catch (error) {
      // Final catch-all for any unhandled errors
      if (!(error instanceof PixelLabError)) {
        const classified = ErrorClassifier.classify(error);
        this.logger.logError(job.id!, classified.originalError, {
          operation: 'processJob',
          stage: 'unknown',
          errorType: classified.type,
        });
      }

      // Rethrow for BullMQ retry handling
      throw error;
    }
  }

  /**
   * Extract and validate job data
   *
   * @param job - BullMQ Job instance
   * @returns Validated job data
   * @throws {Error} If job data is missing or invalid
   */
  private extractJobData(job: Job): {
    jobId: string;
    userId: string;
    structuredPrompt: StructuredPrompt;
    cacheKey: string;
  } {
    if (!job.id) {
      throw new Error('Job ID is missing');
    }

    if (!job.data) {
      throw new Error('Job data is missing');
    }

    const { userId, structuredPrompt, cacheKey } = job.data;

    if (!userId || typeof userId !== 'string') {
      throw new Error('User ID is missing or invalid');
    }

    if (!structuredPrompt || typeof structuredPrompt !== 'object') {
      throw new Error('Structured prompt is missing or invalid');
    }

    if (!cacheKey || typeof cacheKey !== 'string') {
      throw new Error('Cache key is missing or invalid');
    }

    return {
      jobId: job.id,
      userId,
      structuredPrompt,
      cacheKey,
    };
  }

  /**
   * Map StructuredPrompt to PixelLab GenerationRequest
   *
   * Converts queue system's StructuredPrompt format to PixelLab API format:
   * - description: From structuredPrompt.description
   * - size: From structuredPrompt.size.width (assumes square sprites)
   * - textGuidanceScale: From structuredPrompt.options.textGuidanceScale
   * - initImage: From structuredPrompt.options.paletteImage
   *
   * @param prompt - StructuredPrompt from job data
   * @returns GenerationRequest for PixelLab API
   */
  private mapPromptToRequest(prompt: StructuredPrompt): GenerationRequest {
    const request: GenerationRequest = {
      description: prompt.description,
      size: prompt.size.width as 32 | 48 | 64 | 128, // Assume square sprites
    };

    // Add optional fields if present
    if (prompt.options) {
      if (prompt.options.textGuidanceScale !== undefined) {
        request.textGuidanceScale = prompt.options.textGuidanceScale;
      }

      if (prompt.options.paletteImage !== undefined) {
        request.initImage = prompt.options.paletteImage;
      }
    }

    return request;
  }
}
