/**
 * Task 6.1: Job Processor with PixelLabClient Integration - Tests
 *
 * Comprehensive test suite for JobProcessor covering:
 * - Successful generation flow
 * - Progress tracking during polling
 * - Cache integration
 * - Error handling and classification
 * - Edge cases (timeout, corrupted data, crashes)
 */

import { describe, it, expect, beforeEach, vi, afterEach, Mock } from 'vitest';
import { Job } from 'bullmq';
import { JobProcessor } from '../job-processor.js';
import { SpriteGenerator, JobSubmissionResponse } from '../../pixellab/sprite-generator.js';
import { StatusPoller, PollingConfig } from '../../pixellab/status-poller.js';
import { JobStatusResponse, JobStatus as PixelLabJobStatus } from '../../pixellab/status-parser.js';
import { ResultBuilder, GenerationResult } from '../../pixellab/result-builder.js';
import { ImageDecoder } from '../../pixellab/image-decoder.js';
import { PixelLabError, PixelLabErrorType } from '../../pixellab/errors.js';
import { CacheManager, CacheLookupResult } from '../../cache/cache-manager.js';
import { CacheEntry } from '../../cache/redis-cache.js';
import { ProgressIntegrator } from '../../progress/progress-integrator.js';
import { ErrorClassifier, ClassifiedError, ErrorType } from '../../retry/error-classifier.js';
import { QueueLogger } from '../logger.js';
import { StructuredPrompt, SpriteGenerationResult } from '../job-status-tracker.js';

// Mock dependencies
vi.mock('../pixellab/sprite-generator.js');
vi.mock('../pixellab/status-poller.js');
vi.mock('../pixellab/result-builder.js');
vi.mock('../pixellab/image-decoder.js');
vi.mock('../cache/cache-manager.js');
vi.mock('../progress/progress-integrator.js');
vi.mock('../retry/error-classifier.js');
vi.mock('./logger.js');

describe('JobProcessor', () => {
  let jobProcessor: JobProcessor;
  let mockSpriteGenerator: SpriteGenerator;
  let mockStatusPoller: StatusPoller;
  let mockCacheManager: CacheManager;
  let mockProgressIntegrator: ProgressIntegrator;
  let mockLogger: QueueLogger;
  let mockJob: Job;

  const samplePrompt: StructuredPrompt = {
    type: 'character',
    style: 'pixel-art',
    size: { width: 64, height: 64 },
    action: 'walking',
    description: 'A brave knight with sword and shield',
    raw: 'pixel art character brave knight with sword and shield',
  };

  const sampleJobSubmission: JobSubmissionResponse = {
    characterId: 'char-123',
    name: 'Knight Sprite',
  };

  const sampleCompletedStatus: JobStatusResponse = {
    characterId: 'char-123',
    status: PixelLabJobStatus.COMPLETED,
    characterData: {
      id: 'char-123',
      name: 'Knight Sprite',
      created: '2024-01-01T00:00:00Z',
      specifications: {
        directions: 8,
        canvas_size: '64x64',
        view: 'high top-down',
      },
      style: {
        outline: 'single color black outline',
        shading: 'basic shading',
        detail: 'medium detail',
      },
      rotations: [
        { direction: 'north', url: 'https://example.com/north.png' },
        { direction: 'south', url: 'https://example.com/south.png' },
      ],
      download_url: 'https://example.com/download.zip',
    },
  };

  const sampleGenerationResult: GenerationResult = {
    characterId: 'char-123',
    name: 'Knight Sprite',
    created: '2024-01-01T00:00:00Z',
    specifications: {
      directions: 8,
      canvasSize: '64x64',
      view: 'high top-down',
    },
    style: {
      outline: 'single color black outline',
      shading: 'basic shading',
      detail: 'medium detail',
    },
    directions: [
      {
        direction: 'north',
        url: 'https://example.com/north.png',
        buffer: Buffer.from('north-image'),
      },
      {
        direction: 'south',
        url: 'https://example.com/south.png',
        buffer: Buffer.from('south-image'),
      },
    ],
    downloadUrl: 'https://example.com/download.zip',
  };

  beforeEach(() => {
    // Create mock instances
    mockSpriteGenerator = new SpriteGenerator({} as any);
    mockStatusPoller = new StatusPoller({} as any);
    mockCacheManager = new CacheManager({} as any, {} as any, {} as any, {} as any);
    mockProgressIntegrator = new ProgressIntegrator({} as any, {} as any, {} as any, {} as any);
    mockLogger = new QueueLogger({ enabled: false });

    // Mock job
    mockJob = {
      id: 'job-123',
      data: {
        jobId: 'job-123',
        userId: 'user-123',
        structuredPrompt: samplePrompt,
        cacheKey: 'cache:abc123',
      },
      updateProgress: vi.fn(),
    } as unknown as Job;

    // Create processor
    jobProcessor = new JobProcessor(
      mockSpriteGenerator,
      mockStatusPoller,
      mockCacheManager,
      mockProgressIntegrator,
      mockLogger
    );

    // Reset all mocks
    vi.clearAllMocks();

    // Set up default mock for ErrorClassifier to prevent undefined errors
    vi.spyOn(ErrorClassifier, 'classify').mockImplementation((error: any) => ({
      type: ErrorType.UNKNOWN,
      retryable: false,
      userMessage: 'An error occurred',
      technicalDetails: error instanceof Error ? error.message : String(error),
      originalError: error instanceof Error ? error : new Error(String(error)),
    }));

    // Set up default mocks for ProgressIntegrator to return Promises
    vi.spyOn(mockProgressIntegrator, 'broadcastStateChange').mockResolvedValue(undefined);
    vi.spyOn(mockProgressIntegrator, 'broadcastCompletion').mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('processJob - Success Flow', () => {
    it('should successfully generate sprite and return result', async () => {
      // Arrange
      vi.spyOn(mockSpriteGenerator, 'submitGeneration').mockResolvedValue(sampleJobSubmission);
      vi.spyOn(mockStatusPoller, 'pollUntilComplete').mockResolvedValue(sampleCompletedStatus);
      vi.spyOn(ImageDecoder, 'decodeBase64Array').mockReturnValue([
        Buffer.from('north-image'),
        Buffer.from('south-image'),
      ]);
      vi.spyOn(ResultBuilder, 'buildResult').mockReturnValue(sampleGenerationResult);
      vi.spyOn(mockCacheManager, 'set').mockResolvedValue(undefined);

      // Act
      const result = await jobProcessor.processJob(mockJob);

      // Assert
      expect(result).toBeDefined();
      expect(result.jobId).toBe('job-123');
      expect(result.frames).toHaveLength(2);
      expect(result.frames[0].toString()).toBe('north-image');
      expect(result.frames[1].toString()).toBe('south-image');
      expect(result.metadata.frameCount).toBe(2);
      expect(result.metadata.cacheHit).toBe(false);
      expect(result.metadata.pixelLabJobId).toBe('char-123');

      // Verify flow
      expect(mockSpriteGenerator.submitGeneration).toHaveBeenCalledWith({
        description: samplePrompt.description,
        size: 64, // Extracted from size.width
      });
      expect(mockStatusPoller.pollUntilComplete).toHaveBeenCalledWith('char-123');
      expect(ImageDecoder.decodeBase64Array).toHaveBeenCalled();
      expect(ResultBuilder.buildResult).toHaveBeenCalled();
      expect(mockCacheManager.set).toHaveBeenCalled();
    });

    it('should map StructuredPrompt fields to GenerationRequest correctly', async () => {
      // Arrange
      const promptWithOptions: StructuredPrompt = {
        ...samplePrompt,
        options: {
          textGuidanceScale: 7.5,
          paletteImage: 'base64-image-data',
        },
      };

      mockJob.data.structuredPrompt = promptWithOptions;

      vi.spyOn(mockSpriteGenerator, 'submitGeneration').mockResolvedValue(sampleJobSubmission);
      vi.spyOn(mockStatusPoller, 'pollUntilComplete').mockResolvedValue(sampleCompletedStatus);
      vi.spyOn(ImageDecoder, 'decodeBase64Array').mockReturnValue([Buffer.from('image')]);
      vi.spyOn(ResultBuilder, 'buildResult').mockReturnValue({
        ...sampleGenerationResult,
        directions: [{ direction: 'north', url: 'url', buffer: Buffer.from('image') }],
      });
      vi.spyOn(mockCacheManager, 'set').mockResolvedValue(undefined);

      // Act
      await jobProcessor.processJob(mockJob);

      // Assert
      expect(mockSpriteGenerator.submitGeneration).toHaveBeenCalledWith({
        description: promptWithOptions.description,
        size: 64,
        textGuidanceScale: 7.5,
        initImage: 'base64-image-data',
      });
    });
  });

  describe('processJob - Progress Tracking', () => {
    it('should update progress at key stages', async () => {
      // Arrange
      vi.spyOn(mockSpriteGenerator, 'submitGeneration').mockResolvedValue(sampleJobSubmission);
      vi.spyOn(mockStatusPoller, 'pollUntilComplete').mockResolvedValue(sampleCompletedStatus);
      vi.spyOn(ImageDecoder, 'decodeBase64Array').mockReturnValue([Buffer.from('image')]);
      vi.spyOn(ResultBuilder, 'buildResult').mockReturnValue({
        ...sampleGenerationResult,
        directions: [{ direction: 'north', url: 'url', buffer: Buffer.from('image') }],
      });
      vi.spyOn(mockCacheManager, 'set').mockResolvedValue(undefined);

      // Act
      await jobProcessor.processJob(mockJob);

      // Assert - verify progress updates
      const updateCalls = (mockJob.updateProgress as Mock).mock.calls;

      // Should have progress updates:
      // 1. After submission (10%)
      // 2. After polling (90%)
      // 3. After caching (100%)
      expect(updateCalls.length).toBeGreaterThanOrEqual(3);

      // Check specific milestones
      expect(updateCalls.some((call) => call[0] === 10)).toBe(true); // After submission
      expect(updateCalls.some((call) => call[0] === 90)).toBe(true); // After polling
      expect(updateCalls.some((call) => call[0] === 100)).toBe(true); // After caching
    });

    it('should call ProgressIntegrator.broadcastStateChange when processing starts', async () => {
      // Arrange
      vi.spyOn(mockSpriteGenerator, 'submitGeneration').mockResolvedValue(sampleJobSubmission);
      vi.spyOn(mockStatusPoller, 'pollUntilComplete').mockResolvedValue(sampleCompletedStatus);
      vi.spyOn(ImageDecoder, 'decodeBase64Array').mockReturnValue([Buffer.from('image')]);
      vi.spyOn(ResultBuilder, 'buildResult').mockReturnValue({
        ...sampleGenerationResult,
        directions: [{ direction: 'north', url: 'url', buffer: Buffer.from('image') }],
      });
      vi.spyOn(mockCacheManager, 'set').mockResolvedValue(undefined);
      vi.spyOn(mockProgressIntegrator, 'broadcastStateChange').mockResolvedValue(undefined);

      // Act
      await jobProcessor.processJob(mockJob);

      // Assert
      expect(mockProgressIntegrator.broadcastStateChange).toHaveBeenCalledWith(
        'job-123',
        'user-123',
        expect.any(String),
        expect.any(String)
      );
    });

    it('should call ProgressIntegrator.broadcastCompletion with result', async () => {
      // Arrange
      vi.spyOn(mockSpriteGenerator, 'submitGeneration').mockResolvedValue(sampleJobSubmission);
      vi.spyOn(mockStatusPoller, 'pollUntilComplete').mockResolvedValue(sampleCompletedStatus);
      vi.spyOn(ImageDecoder, 'decodeBase64Array').mockReturnValue([Buffer.from('image')]);
      vi.spyOn(ResultBuilder, 'buildResult').mockReturnValue({
        ...sampleGenerationResult,
        directions: [{ direction: 'north', url: 'url', buffer: Buffer.from('image') }],
      });
      vi.spyOn(mockCacheManager, 'set').mockResolvedValue(undefined);
      vi.spyOn(mockProgressIntegrator, 'broadcastCompletion').mockResolvedValue(undefined);

      // Act
      const result = await jobProcessor.processJob(mockJob);

      // Assert
      expect(mockProgressIntegrator.broadcastCompletion).toHaveBeenCalledWith(
        'job-123',
        'user-123',
        result
      );
    });
  });

  describe('processJob - Cache Integration', () => {
    it('should cache result after successful generation', async () => {
      // Arrange
      vi.spyOn(mockSpriteGenerator, 'submitGeneration').mockResolvedValue(sampleJobSubmission);
      vi.spyOn(mockStatusPoller, 'pollUntilComplete').mockResolvedValue(sampleCompletedStatus);
      vi.spyOn(ImageDecoder, 'decodeBase64Array').mockReturnValue([Buffer.from('image')]);
      vi.spyOn(ResultBuilder, 'buildResult').mockReturnValue({
        ...sampleGenerationResult,
        directions: [{ direction: 'north', url: 'url', buffer: Buffer.from('image') }],
      });
      vi.spyOn(mockCacheManager, 'set').mockResolvedValue(undefined);

      // Act
      await jobProcessor.processJob(mockJob);

      // Assert
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'cache:abc123',
        expect.objectContaining({
          cacheKey: 'cache:abc123',
          userId: 'user-123',
          structuredPrompt: samplePrompt,
          result: expect.objectContaining({
            jobId: 'job-123',
            frames: expect.any(Array),
          }),
          createdAt: expect.any(Number),
          expiresAt: expect.any(Number),
          hits: 0,
          lastAccessedAt: expect.any(Number),
        })
      );
    });

    it('should set cache entry with 30-day TTL', async () => {
      // Arrange
      vi.spyOn(mockSpriteGenerator, 'submitGeneration').mockResolvedValue(sampleJobSubmission);
      vi.spyOn(mockStatusPoller, 'pollUntilComplete').mockResolvedValue(sampleCompletedStatus);
      vi.spyOn(ImageDecoder, 'decodeBase64Array').mockReturnValue([Buffer.from('image')]);
      vi.spyOn(ResultBuilder, 'buildResult').mockReturnValue({
        ...sampleGenerationResult,
        directions: [{ direction: 'north', url: 'url', buffer: Buffer.from('image') }],
      });
      vi.spyOn(mockCacheManager, 'set').mockResolvedValue(undefined);

      const beforeTime = Date.now();

      // Act
      await jobProcessor.processJob(mockJob);

      // Assert
      const cacheCall = (mockCacheManager.set as Mock).mock.calls[0];
      const cacheEntry = cacheCall[1] as CacheEntry;

      // Verify TTL is approximately 30 days (in milliseconds)
      const expectedTTL = 30 * 24 * 60 * 60 * 1000;
      const actualTTL = cacheEntry.expiresAt - cacheEntry.createdAt;

      expect(actualTTL).toBeGreaterThanOrEqual(expectedTTL - 1000); // Allow 1s tolerance
      expect(actualTTL).toBeLessThanOrEqual(expectedTTL + 1000);
      expect(cacheEntry.createdAt).toBeGreaterThanOrEqual(beforeTime);
    });

    it('should complete successfully even if caching fails', async () => {
      // Arrange
      vi.spyOn(mockSpriteGenerator, 'submitGeneration').mockResolvedValue(sampleJobSubmission);
      vi.spyOn(mockStatusPoller, 'pollUntilComplete').mockResolvedValue(sampleCompletedStatus);
      vi.spyOn(ImageDecoder, 'decodeBase64Array').mockReturnValue([Buffer.from('image')]);
      vi.spyOn(ResultBuilder, 'buildResult').mockReturnValue({
        ...sampleGenerationResult,
        directions: [{ direction: 'north', url: 'url', buffer: Buffer.from('image') }],
      });
      vi.spyOn(mockCacheManager, 'set').mockRejectedValue(new Error('Redis connection failed'));
      vi.spyOn(mockLogger, 'logWarn').mockReturnValue(undefined);

      // Act
      const result = await jobProcessor.processJob(mockJob);

      // Assert - job should succeed despite cache failure
      expect(result).toBeDefined();
      expect(result.jobId).toBe('job-123');
      expect(mockLogger.logWarn).toHaveBeenCalledWith(
        'cache_set_failed',
        expect.objectContaining({
          error: 'Redis connection failed',
        })
      );
    });
  });

  describe('processJob - Error Handling', () => {
    it('should classify and rethrow PixelLabError from submission', async () => {
      // Arrange
      const pixelLabError = new PixelLabError({
        type: PixelLabErrorType.AUTHENTICATION,
        message: 'Invalid API key',
        statusCode: 401,
        retryable: false,
      });

      const classifiedError: ClassifiedError = {
        type: ErrorType.AUTHENTICATION,
        retryable: false,
        userMessage: 'Authentication failed',
        technicalDetails: 'Invalid API key',
        originalError: pixelLabError,
      };

      vi.spyOn(mockSpriteGenerator, 'submitGeneration').mockRejectedValue(pixelLabError);
      vi.spyOn(ErrorClassifier, 'classify').mockReturnValue(classifiedError);

      // Act & Assert
      await expect(jobProcessor.processJob(mockJob)).rejects.toThrow('Invalid API key');

      expect(ErrorClassifier.classify).toHaveBeenCalledWith(pixelLabError);
      expect(mockLogger.logError).toHaveBeenCalledWith(
        'job-123',
        pixelLabError,
        expect.objectContaining({
          operation: 'processJob',
          stage: 'submission',
        })
      );
    });

    it('should classify and rethrow PixelLabError from polling', async () => {
      // Arrange
      const pixelLabError = new PixelLabError({
        type: PixelLabErrorType.TIMEOUT,
        message: 'Polling timeout exceeded',
        retryable: true,
      });

      const classifiedError: ClassifiedError = {
        type: ErrorType.TIMEOUT,
        retryable: true,
        userMessage: 'Request timed out',
        technicalDetails: 'Polling timeout exceeded',
        originalError: pixelLabError,
      };

      vi.spyOn(mockSpriteGenerator, 'submitGeneration').mockResolvedValue(sampleJobSubmission);
      vi.spyOn(mockStatusPoller, 'pollUntilComplete').mockRejectedValue(pixelLabError);
      vi.spyOn(ErrorClassifier, 'classify').mockReturnValue(classifiedError);

      // Act & Assert
      await expect(jobProcessor.processJob(mockJob)).rejects.toThrow('Polling timeout exceeded');

      expect(ErrorClassifier.classify).toHaveBeenCalledWith(pixelLabError);
      expect(mockLogger.logError).toHaveBeenCalledWith(
        'job-123',
        pixelLabError,
        expect.objectContaining({
          operation: 'processJob',
          stage: 'polling',
        })
      );
    });

    it('should handle rate limit errors with retry classification', async () => {
      // Arrange
      const rateLimitError = new PixelLabError({
        type: PixelLabErrorType.RATE_LIMIT,
        message: 'Rate limit exceeded',
        statusCode: 429,
        retryable: true,
      });

      const classifiedError: ClassifiedError = {
        type: ErrorType.RATE_LIMIT,
        retryable: true,
        userMessage: 'Rate limit exceeded',
        technicalDetails: 'Rate limit exceeded',
        retryAfter: 30,
        originalError: rateLimitError,
      };

      vi.spyOn(mockSpriteGenerator, 'submitGeneration').mockRejectedValue(rateLimitError);
      vi.spyOn(ErrorClassifier, 'classify').mockReturnValue(classifiedError);

      // Act & Assert
      await expect(jobProcessor.processJob(mockJob)).rejects.toThrow('Rate limit exceeded');

      const classifyCall = (ErrorClassifier.classify as Mock).mock.calls[0][0];
      expect(classifyCall).toBe(rateLimitError);

      expect(mockLogger.logError).toHaveBeenCalled();
    });

    it('should handle validation errors as non-retryable', async () => {
      // Arrange
      const validationError = new PixelLabError({
        type: PixelLabErrorType.VALIDATION,
        message: 'Invalid size parameter',
        statusCode: 422,
        retryable: false,
      });

      const classifiedError: ClassifiedError = {
        type: ErrorType.VALIDATION_ERROR,
        retryable: false,
        userMessage: 'Invalid input parameters',
        technicalDetails: 'Invalid size parameter',
        originalError: validationError,
      };

      vi.spyOn(mockSpriteGenerator, 'submitGeneration').mockRejectedValue(validationError);
      vi.spyOn(ErrorClassifier, 'classify').mockReturnValue(classifiedError);

      // Act & Assert
      await expect(jobProcessor.processJob(mockJob)).rejects.toThrow('Invalid size parameter');

      expect(ErrorClassifier.classify).toHaveBeenCalledWith(validationError);
    });
  });

  describe('processJob - Edge Cases', () => {
    it('should handle PixelLab job timeout (never completes)', async () => {
      // Arrange
      const timeoutError = new PixelLabError({
        type: PixelLabErrorType.TIMEOUT,
        message: 'Maximum polling attempts exceeded',
        retryable: false,
      });

      vi.spyOn(mockSpriteGenerator, 'submitGeneration').mockResolvedValue(sampleJobSubmission);
      vi.spyOn(mockStatusPoller, 'pollUntilComplete').mockRejectedValue(timeoutError);
      vi.spyOn(ErrorClassifier, 'classify').mockReturnValue({
        type: ErrorType.TIMEOUT,
        retryable: false,
        userMessage: 'Request timed out',
        technicalDetails: 'Maximum polling attempts exceeded',
        originalError: timeoutError,
      });

      // Act & Assert
      await expect(jobProcessor.processJob(mockJob)).rejects.toThrow(
        'Maximum polling attempts exceeded'
      );
    });

    it('should handle corrupted sprite data from PixelLab', async () => {
      // Arrange
      vi.spyOn(mockSpriteGenerator, 'submitGeneration').mockResolvedValue(sampleJobSubmission);
      vi.spyOn(mockStatusPoller, 'pollUntilComplete').mockResolvedValue(sampleCompletedStatus);

      const corruptionError = new PixelLabError({
        type: PixelLabErrorType.INVALID_REQUEST,
        message: 'Invalid PNG format',
        retryable: false,
      });

      vi.spyOn(ImageDecoder, 'decodeBase64Array').mockImplementation(() => {
        throw corruptionError;
      });

      vi.spyOn(ErrorClassifier, 'classify').mockReturnValue({
        type: ErrorType.VALIDATION_ERROR,
        retryable: false,
        userMessage: 'Invalid sprite data',
        technicalDetails: 'Invalid PNG format',
        originalError: corruptionError,
      });

      // Act & Assert
      await expect(jobProcessor.processJob(mockJob)).rejects.toThrow('Invalid PNG format');
    });

    it('should handle network connection lost during polling', async () => {
      // Arrange
      const networkError = new Error('ECONNRESET');
      (networkError as any).code = 'ECONNRESET';

      vi.spyOn(mockSpriteGenerator, 'submitGeneration').mockResolvedValue(sampleJobSubmission);
      vi.spyOn(mockStatusPoller, 'pollUntilComplete').mockRejectedValue(networkError);
      vi.spyOn(ErrorClassifier, 'classify').mockReturnValue({
        type: ErrorType.NETWORK_ERROR,
        retryable: true,
        userMessage: 'Network error',
        technicalDetails: 'ECONNRESET',
        originalError: networkError,
      });

      // Act & Assert
      await expect(jobProcessor.processJob(mockJob)).rejects.toThrow('ECONNRESET');

      expect(ErrorClassifier.classify).toHaveBeenCalledWith(networkError);
    });

    it('should handle missing job data gracefully', async () => {
      // Arrange
      const invalidJob = {
        id: 'job-123',
        data: {}, // Missing required fields
        updateProgress: vi.fn(),
      } as unknown as Job;

      // Act & Assert
      await expect(jobProcessor.processJob(invalidJob)).rejects.toThrow();
    });

    it('should handle missing structured prompt', async () => {
      // Arrange
      const jobWithoutPrompt = {
        id: 'job-123',
        data: {
          jobId: 'job-123',
          userId: 'user-123',
          cacheKey: 'cache:abc123',
          // structuredPrompt is missing
        },
        updateProgress: vi.fn(),
      } as unknown as Job;

      // Act & Assert
      await expect(jobProcessor.processJob(jobWithoutPrompt)).rejects.toThrow();
    });

    it('should handle ResultBuilder validation errors', async () => {
      // Arrange
      vi.spyOn(mockSpriteGenerator, 'submitGeneration').mockResolvedValue(sampleJobSubmission);
      vi.spyOn(mockStatusPoller, 'pollUntilComplete').mockResolvedValue(sampleCompletedStatus);
      vi.spyOn(ImageDecoder, 'decodeBase64Array').mockReturnValue([Buffer.from('image')]);

      const buildError = new PixelLabError({
        type: PixelLabErrorType.INVALID_REQUEST,
        message: 'Image count mismatch',
        retryable: false,
      });

      vi.spyOn(ResultBuilder, 'buildResult').mockImplementation(() => {
        throw buildError;
      });

      vi.spyOn(ErrorClassifier, 'classify').mockReturnValue({
        type: ErrorType.VALIDATION_ERROR,
        retryable: false,
        userMessage: 'Invalid result data',
        technicalDetails: 'Image count mismatch',
        originalError: buildError,
      });

      // Act & Assert
      await expect(jobProcessor.processJob(mockJob)).rejects.toThrow('Image count mismatch');
    });

    it('should handle empty directions array from PixelLab', async () => {
      // Arrange
      const emptyResultStatus: JobStatusResponse = {
        ...sampleCompletedStatus,
        characterData: {
          ...sampleCompletedStatus.characterData!,
          rotations: [], // Empty rotations
        },
      };

      vi.spyOn(mockSpriteGenerator, 'submitGeneration').mockResolvedValue(sampleJobSubmission);
      vi.spyOn(mockStatusPoller, 'pollUntilComplete').mockResolvedValue(emptyResultStatus);
      vi.spyOn(ImageDecoder, 'decodeBase64Array').mockReturnValue([]);

      const emptyError = new PixelLabError({
        type: PixelLabErrorType.INVALID_REQUEST,
        message: 'At least one image is required',
        retryable: false,
      });

      vi.spyOn(ResultBuilder, 'buildResult').mockImplementation(() => {
        throw emptyError;
      });

      vi.spyOn(ErrorClassifier, 'classify').mockReturnValue({
        type: ErrorType.VALIDATION_ERROR,
        retryable: false,
        userMessage: 'No sprite frames generated',
        technicalDetails: 'At least one image is required',
        originalError: emptyError,
      });

      // Act & Assert
      await expect(jobProcessor.processJob(mockJob)).rejects.toThrow(
        'At least one image is required'
      );
    });
  });

  describe('processJob - Timing and Metadata', () => {
    it('should track generation time in metadata', async () => {
      // Arrange
      vi.spyOn(mockSpriteGenerator, 'submitGeneration').mockResolvedValue(sampleJobSubmission);
      vi.spyOn(mockStatusPoller, 'pollUntilComplete').mockImplementation(async () => {
        // Simulate 100ms delay
        await new Promise((resolve) => setTimeout(resolve, 100));
        return sampleCompletedStatus;
      });
      vi.spyOn(ImageDecoder, 'decodeBase64Array').mockReturnValue([Buffer.from('image')]);
      vi.spyOn(ResultBuilder, 'buildResult').mockReturnValue({
        ...sampleGenerationResult,
        directions: [{ direction: 'north', url: 'url', buffer: Buffer.from('image') }],
      });
      vi.spyOn(mockCacheManager, 'set').mockResolvedValue(undefined);

      // Act
      const result = await jobProcessor.processJob(mockJob);

      // Assert
      expect(result.metadata.generationTimeMs).toBeGreaterThan(0);
      expect(result.metadata.generationTimeMs).toBeGreaterThanOrEqual(100);
    });

    it('should include PixelLab job ID in result metadata', async () => {
      // Arrange
      vi.spyOn(mockSpriteGenerator, 'submitGeneration').mockResolvedValue(sampleJobSubmission);
      vi.spyOn(mockStatusPoller, 'pollUntilComplete').mockResolvedValue(sampleCompletedStatus);
      vi.spyOn(ImageDecoder, 'decodeBase64Array').mockReturnValue([Buffer.from('image')]);
      vi.spyOn(ResultBuilder, 'buildResult').mockReturnValue({
        ...sampleGenerationResult,
        directions: [{ direction: 'north', url: 'url', buffer: Buffer.from('image') }],
      });
      vi.spyOn(mockCacheManager, 'set').mockResolvedValue(undefined);

      // Act
      const result = await jobProcessor.processJob(mockJob);

      // Assert
      expect(result.metadata.pixelLabJobId).toBe('char-123');
    });

    it('should set dimensions in metadata based on sprite frames', async () => {
      // Arrange
      vi.spyOn(mockSpriteGenerator, 'submitGeneration').mockResolvedValue(sampleJobSubmission);
      vi.spyOn(mockStatusPoller, 'pollUntilComplete').mockResolvedValue(sampleCompletedStatus);
      vi.spyOn(ImageDecoder, 'decodeBase64Array').mockReturnValue([Buffer.from('image')]);
      vi.spyOn(ResultBuilder, 'buildResult').mockReturnValue({
        ...sampleGenerationResult,
        directions: [{ direction: 'north', url: 'url', buffer: Buffer.from('image') }],
      });
      vi.spyOn(mockCacheManager, 'set').mockResolvedValue(undefined);

      // Act
      const result = await jobProcessor.processJob(mockJob);

      // Assert
      expect(result.metadata.dimensions).toEqual({ width: 64, height: 64 });
    });

    it('should set frameCount in metadata', async () => {
      // Arrange
      vi.spyOn(mockSpriteGenerator, 'submitGeneration').mockResolvedValue(sampleJobSubmission);
      vi.spyOn(mockStatusPoller, 'pollUntilComplete').mockResolvedValue(sampleCompletedStatus);
      vi.spyOn(ImageDecoder, 'decodeBase64Array').mockReturnValue([
        Buffer.from('image1'),
        Buffer.from('image2'),
      ]);
      vi.spyOn(ResultBuilder, 'buildResult').mockReturnValue({
        ...sampleGenerationResult,
        directions: [
          { direction: 'north', url: 'url1', buffer: Buffer.from('image1') },
          { direction: 'south', url: 'url2', buffer: Buffer.from('image2') },
        ],
      });
      vi.spyOn(mockCacheManager, 'set').mockResolvedValue(undefined);

      // Act
      const result = await jobProcessor.processJob(mockJob);

      // Assert
      expect(result.metadata.frameCount).toBe(2);
    });
  });
});
