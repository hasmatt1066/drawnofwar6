/**
 * Task 1.3: Implement Job Submission with Validation - Tests
 *
 * Comprehensive test suite following TDD approach.
 * Tests all acceptance criteria, test scenarios, and edge cases.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JobSubmitter, StructuredPrompt, JobSubmissionResponse, QueueOverflowWarning } from '../job-submitter.js';
import { QueueManager, QueueServiceConfig } from '../queue-manager.js';
import { QueueLogger } from '../logger.js';
import { JobStatus } from '../../pixellab/status-parser.js';
import type { GenerationResult } from '../../pixellab/result-builder.js';

describe('JobSubmitter - Task 1.3: Implement Job Submission with Validation', () => {
  let mockQueueManager: QueueManager;
  let mockLogger: QueueLogger;
  let defaultConfig: QueueServiceConfig;
  let jobSubmitter: JobSubmitter;
  let mockQueue: any;

  // Valid test prompt
  const validPrompt: StructuredPrompt = {
    type: 'character',
    style: 'pixel-art',
    size: { width: 48, height: 48 },
    action: 'walking',
    description: 'cute wizard with blue robes',
    raw: 'cute wizard with blue robes walking',
  };

  beforeEach(async () => {
    // Create mock logger
    mockLogger = new QueueLogger({ enabled: false });

    // Default valid configuration
    defaultConfig = {
      redis: {
        host: 'localhost',
        port: 6379,
        db: 0,
      },
      firestore: {
        projectId: 'test-project',
      },
      queue: {
        name: 'generation-queue',
        concurrency: 5,
        maxJobsPerUser: 5,
        systemQueueLimit: 500,
        warningThreshold: 400,
      },
      cache: {
        ttlDays: 30,
        strategy: 'aggressive' as const,
      },
      retry: {
        maxRetries: 1,
        backoffDelay: 5000,
        backoffMultiplier: 2.0,
      },
      sse: {
        updateInterval: 2500,
        keepAliveInterval: 30000,
      },
      deduplication: {
        windowSeconds: 10,
      },
    };

    // Create mock queue with Redis client simulation
    mockQueue = {
      name: 'generation-queue',
      add: vi.fn().mockResolvedValue({ id: 'job-123' }),
      getJobCounts: vi.fn().mockResolvedValue({
        waiting: 0,
        active: 0,
        delayed: 0,
      }),
      client: {
        get: vi.fn().mockResolvedValue(null), // Cache miss by default
        set: vi.fn().mockResolvedValue('OK'),
        setex: vi.fn().mockResolvedValue('OK'),
        keys: vi.fn().mockResolvedValue([]), // No active jobs by default
      },
    };

    // Create mock QueueManager
    mockQueueManager = {
      getQueue: vi.fn().mockReturnValue(mockQueue),
    } as any;

    // Create job submitter
    jobSubmitter = new JobSubmitter(mockQueueManager, defaultConfig, mockLogger);

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Acceptance Criteria Tests', () => {
    describe('AC1: Validates userId is non-empty string', () => {
      it('should accept valid userId', async () => {
        const response = await jobSubmitter.submitJob('user-123', validPrompt);

        expect(response).toBeDefined();
        expect(response.jobId).toBeDefined();
        expect(response.status).toBe(JobStatus.PROCESSING);
      });

      it('should reject empty userId', async () => {
        await expect(jobSubmitter.submitJob('', validPrompt)).rejects.toThrow('userId must be a non-empty string');
      });

      it('should reject whitespace-only userId', async () => {
        await expect(jobSubmitter.submitJob('   ', validPrompt)).rejects.toThrow('userId must be a non-empty string');
      });

      it('should reject non-string userId', async () => {
        await expect(jobSubmitter.submitJob(null as any, validPrompt)).rejects.toThrow('userId must be a non-empty string');
        await expect(jobSubmitter.submitJob(undefined as any, validPrompt)).rejects.toThrow('userId must be a non-empty string');
        await expect(jobSubmitter.submitJob(123 as any, validPrompt)).rejects.toThrow('userId must be a non-empty string');
      });
    });

    describe('AC2: Validates StructuredPrompt schema', () => {
      it('should accept valid prompt with all required fields', async () => {
        const response = await jobSubmitter.submitJob('user-123', validPrompt);

        expect(response).toBeDefined();
        expect(response.jobId).toBeDefined();
      });

      it('should reject prompt with missing type', async () => {
        const invalidPrompt = { ...validPrompt };
        delete (invalidPrompt as any).type;

        await expect(jobSubmitter.submitJob('user-123', invalidPrompt as any)).rejects.toThrow();
      });

      it('should reject prompt with missing style', async () => {
        const invalidPrompt = { ...validPrompt };
        delete (invalidPrompt as any).style;

        await expect(jobSubmitter.submitJob('user-123', invalidPrompt as any)).rejects.toThrow();
      });

      it('should reject prompt with missing size', async () => {
        const invalidPrompt = { ...validPrompt };
        delete (invalidPrompt as any).size;

        await expect(jobSubmitter.submitJob('user-123', invalidPrompt as any)).rejects.toThrow();
      });

      it('should reject prompt with invalid size (missing width)', async () => {
        const invalidPrompt = { ...validPrompt, size: { height: 48 } };

        await expect(jobSubmitter.submitJob('user-123', invalidPrompt as any)).rejects.toThrow();
      });

      it('should reject prompt with invalid size (missing height)', async () => {
        const invalidPrompt = { ...validPrompt, size: { width: 48 } };

        await expect(jobSubmitter.submitJob('user-123', invalidPrompt as any)).rejects.toThrow();
      });

      it('should reject prompt with missing description', async () => {
        const invalidPrompt = { ...validPrompt };
        delete (invalidPrompt as any).description;

        await expect(jobSubmitter.submitJob('user-123', invalidPrompt as any)).rejects.toThrow();
      });

      it('should accept prompt with valid optional fields', async () => {
        const promptWithOptions: StructuredPrompt = {
          ...validPrompt,
          options: {
            noBackground: true,
            textGuidanceScale: 8.0,
            paletteImage: 'data:image/png;base64,abc123',
          },
        };

        const response = await jobSubmitter.submitJob('user-123', promptWithOptions);

        expect(response).toBeDefined();
        expect(response.jobId).toBeDefined();
      });
    });

    describe('AC3: Generates unique job ID (UUID v4)', () => {
      it('should generate UUID v4 format job ID', async () => {
        const response = await jobSubmitter.submitJob('user-123', validPrompt);

        // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
        const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        expect(response.jobId).toMatch(uuidV4Regex);
      });

      it('should generate unique job IDs for multiple submissions', async () => {
        const response1 = await jobSubmitter.submitJob('user-123', validPrompt);
        const response2 = await jobSubmitter.submitJob('user-123', validPrompt);

        expect(response1.jobId).not.toBe(response2.jobId);
      });
    });

    describe('AC4: Generates cache key via SHA-256 hash', () => {
      it('should generate consistent cache key for same prompt', async () => {
        // We'll verify this by checking Redis calls
        await jobSubmitter.submitJob('user-123', validPrompt);

        // Should have called Redis get with a hash key
        expect(mockQueue.client.get).toHaveBeenCalled();
        const cacheKey = mockQueue.client.get.mock.calls[0][0];

        // Cache key should be prefixed with "cache:"
        expect(cacheKey).toMatch(/^cache:/);

        // Second call with same prompt should use same cache key
        vi.clearAllMocks();
        await jobSubmitter.submitJob('user-123', validPrompt);

        const cacheKey2 = mockQueue.client.get.mock.calls[0][0];
        expect(cacheKey2).toBe(cacheKey);
      });

      it('should generate different cache keys for different prompts', async () => {
        await jobSubmitter.submitJob('user-123', validPrompt);
        const cacheKey1 = mockQueue.client.get.mock.calls[0][0];

        vi.clearAllMocks();

        const differentPrompt = { ...validPrompt, description: 'different description' };
        await jobSubmitter.submitJob('user-123', differentPrompt);
        const cacheKey2 = mockQueue.client.get.mock.calls[0][0];

        expect(cacheKey2).not.toBe(cacheKey1);
      });
    });

    describe('AC5: Checks 10-second deduplication window', () => {
      it('should return existing job ID if duplicate within 10 seconds', async () => {
        // First submission
        const response1 = await jobSubmitter.submitJob('user-123', validPrompt);
        const jobId1 = response1.jobId;

        // Simulate duplicate detection by mocking Redis to return the job ID
        mockQueue.client.keys.mockResolvedValue([`dedup:user-123:${jobId1}`]);
        mockQueue.client.get.mockResolvedValue(jobId1);

        // Second submission (duplicate)
        const response2 = await jobSubmitter.submitJob('user-123', validPrompt);

        expect(response2.jobId).toBe(jobId1);
        expect(response2.status).toBe(JobStatus.PROCESSING);

        // Should not add a new job to the queue
        expect(mockQueue.add).toHaveBeenCalledTimes(1);
      });

      it('should create new job if duplicate outside 10-second window', async () => {
        // First submission
        const response1 = await jobSubmitter.submitJob('user-123', validPrompt);

        // Simulate deduplication key expired (Redis returns null)
        mockQueue.client.keys.mockResolvedValue([]);
        mockQueue.client.get.mockResolvedValue(null);

        // Second submission after window
        const response2 = await jobSubmitter.submitJob('user-123', validPrompt);

        expect(response2.jobId).not.toBe(response1.jobId);

        // Should add new job to queue
        expect(mockQueue.add).toHaveBeenCalledTimes(2);
      });
    });

    describe('AC6: Checks cache for existing result', () => {
      it('should return cached result if cache hit', async () => {
        // Mock cache hit
        const cachedResult: GenerationResult = {
          characterId: 'char-123',
          name: 'Test Character',
          created: '2025-09-30T00:00:00Z',
          specifications: {
            directions: 8,
            canvasSize: '48x48',
            view: 'top-down',
          },
          style: {
            outline: 'black',
            shading: 'basic',
            detail: 'medium',
          },
          directions: [],
          downloadUrl: 'https://example.com/download',
        };

        mockQueue.client.get.mockResolvedValue(JSON.stringify(cachedResult));

        const response = await jobSubmitter.submitJob('user-123', validPrompt);

        expect(response.cacheHit).toBe(true);
        expect(response.result).toEqual(cachedResult);
        expect(response.status).toBe(JobStatus.COMPLETED);

        // Should NOT add job to queue
        expect(mockQueue.add).not.toHaveBeenCalled();
      });

      it('should proceed with job submission if cache miss', async () => {
        mockQueue.client.get.mockResolvedValue(null);

        const response = await jobSubmitter.submitJob('user-123', validPrompt);

        expect(response.cacheHit).toBe(false);
        expect(response.result).toBeUndefined();

        // Should add job to queue
        expect(mockQueue.add).toHaveBeenCalled();
      });
    });

    describe('AC7: Checks user concurrency limit (max 5)', () => {
      it('should accept job if user has less than 5 active jobs', async () => {
        // Mock 4 active jobs for user
        mockQueue.client.keys.mockResolvedValue([
          'active:user-123:job-1',
          'active:user-123:job-2',
          'active:user-123:job-3',
          'active:user-123:job-4',
        ]);

        const response = await jobSubmitter.submitJob('user-123', validPrompt);

        expect(response).toBeDefined();
        expect(response.jobId).toBeDefined();
        expect(mockQueue.add).toHaveBeenCalled();
      });

      it('should reject if user has 5 active jobs', async () => {
        // Mock 5 active jobs for user
        mockQueue.client.keys.mockResolvedValue([
          'active:user-123:job-1',
          'active:user-123:job-2',
          'active:user-123:job-3',
          'active:user-123:job-4',
          'active:user-123:job-5',
        ]);

        await expect(jobSubmitter.submitJob('user-123', validPrompt)).rejects.toThrow(
          'User has reached maximum concurrent jobs limit (5)'
        );

        expect(mockQueue.add).not.toHaveBeenCalled();
      });
    });

    describe('AC8: Checks system queue limit (max 500)', () => {
      it('should accept job if queue has less than 500 jobs', async () => {
        mockQueue.getJobCounts.mockResolvedValue({
          waiting: 100,
          active: 50,
          delayed: 10,
        });

        const response = await jobSubmitter.submitJob('user-123', validPrompt);

        expect(response).toBeDefined();
        expect(response.jobId).toBeDefined();
        expect(mockQueue.add).toHaveBeenCalled();
      });

      it('should reject if queue has 500 jobs', async () => {
        mockQueue.getJobCounts.mockResolvedValue({
          waiting: 400,
          active: 50,
          delayed: 50,
        });

        await expect(jobSubmitter.submitJob('user-123', validPrompt)).rejects.toThrow('System queue is full (500/500)');

        expect(mockQueue.add).not.toHaveBeenCalled();
      });

      it('should reject if queue exceeds 500 jobs', async () => {
        mockQueue.getJobCounts.mockResolvedValue({
          waiting: 450,
          active: 51,
          delayed: 10,
        });

        await expect(jobSubmitter.submitJob('user-123', validPrompt)).rejects.toThrow('System queue is full');

        expect(mockQueue.add).not.toHaveBeenCalled();
      });
    });

    describe('AC9: Adds job to BullMQ queue', () => {
      it('should add job with correct data to queue', async () => {
        const response = await jobSubmitter.submitJob('user-123', validPrompt);

        expect(mockQueue.add).toHaveBeenCalledWith(
          'sprite-generation',
          {
            userId: 'user-123',
            prompt: validPrompt,
            jobId: response.jobId,
            submittedAt: expect.any(String),
          },
          expect.any(Object)
        );
      });

      it('should set deduplication key in Redis after submission', async () => {
        const response = await jobSubmitter.submitJob('user-123', validPrompt);

        // Should set deduplication key with 10-second TTL
        expect(mockQueue.client.setex).toHaveBeenCalledWith(
          expect.stringMatching(/^dedup:user-123:/),
          10,
          response.jobId
        );
      });

      it('should set active job key in Redis after submission', async () => {
        const response = await jobSubmitter.submitJob('user-123', validPrompt);

        // Should set active job tracking key
        expect(mockQueue.client.set).toHaveBeenCalledWith(
          expect.stringMatching(/^active:user-123:/),
          '1'
        );
      });
    });

    describe('AC10: Returns job ID or cached result', () => {
      it('should return JobSubmissionResponse with job ID for new job', async () => {
        const response = await jobSubmitter.submitJob('user-123', validPrompt);

        expect(response).toMatchObject({
          jobId: expect.any(String),
          status: JobStatus.PROCESSING,
          cacheHit: false,
        });
        expect(response.result).toBeUndefined();
      });

      it('should return JobSubmissionResponse with cached result on cache hit', async () => {
        const cachedResult: GenerationResult = {
          characterId: 'char-123',
          name: 'Test Character',
          created: '2025-09-30T00:00:00Z',
          specifications: {
            directions: 8,
            canvasSize: '48x48',
            view: 'top-down',
          },
          style: {
            outline: 'black',
            shading: 'basic',
            detail: 'medium',
          },
          directions: [],
          downloadUrl: 'https://example.com/download',
        };

        mockQueue.client.get.mockResolvedValue(JSON.stringify(cachedResult));

        const response = await jobSubmitter.submitJob('user-123', validPrompt);

        expect(response).toMatchObject({
          jobId: expect.any(String),
          status: JobStatus.COMPLETED,
          cacheHit: true,
          result: cachedResult,
        });
      });

      it('should include warning when queue is near capacity', async () => {
        mockQueue.getJobCounts.mockResolvedValue({
          waiting: 350,
          active: 60,
          delayed: 10,
        });

        const response = await jobSubmitter.submitJob('user-123', validPrompt);

        expect(response.warning).toBeDefined();
        expect(response.warning?.message).toContain('high load');
        expect(response.warning?.queueDepth).toBe(420);
      });

      it('should include estimated wait time', async () => {
        mockQueue.getJobCounts.mockResolvedValue({
          waiting: 100,
          active: 5,
          delayed: 0,
        });

        const response = await jobSubmitter.submitJob('user-123', validPrompt);

        expect(response.estimatedWaitTime).toBeDefined();
        expect(response.estimatedWaitTime).toBeGreaterThan(0);
      });
    });
  });

  describe('Test Scenarios', () => {
    it('should submit valid job to queue', async () => {
      const response = await jobSubmitter.submitJob('user-123', validPrompt);

      expect(response.jobId).toBeDefined();
      expect(response.status).toBe(JobStatus.PROCESSING);
      expect(response.cacheHit).toBe(false);
      expect(mockQueue.add).toHaveBeenCalled();
    });

    it('should return existing job ID if duplicate within 10s', async () => {
      const response1 = await jobSubmitter.submitJob('user-123', validPrompt);

      // Mock duplicate detection
      mockQueue.client.keys.mockResolvedValue([`dedup:user-123:${response1.jobId}`]);
      mockQueue.client.get.mockResolvedValue(response1.jobId);

      const response2 = await jobSubmitter.submitJob('user-123', validPrompt);

      expect(response2.jobId).toBe(response1.jobId);
      expect(mockQueue.add).toHaveBeenCalledTimes(1);
    });

    it('should return cached result if cache hit', async () => {
      const cachedResult: GenerationResult = {
        characterId: 'char-123',
        name: null,
        created: '2025-09-30T00:00:00Z',
        specifications: {
          directions: 4,
          canvasSize: '32x32',
          view: 'side',
        },
        style: {
          outline: 'none',
          shading: 'flat',
          detail: 'low',
        },
        directions: [],
        downloadUrl: 'https://example.com/download',
      };

      mockQueue.client.get.mockResolvedValue(JSON.stringify(cachedResult));

      const response = await jobSubmitter.submitJob('user-123', validPrompt);

      expect(response.cacheHit).toBe(true);
      expect(response.result).toEqual(cachedResult);
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('should reject if user has 5 active jobs', async () => {
      mockQueue.client.keys.mockResolvedValue([
        'active:user-123:job-1',
        'active:user-123:job-2',
        'active:user-123:job-3',
        'active:user-123:job-4',
        'active:user-123:job-5',
      ]);

      await expect(jobSubmitter.submitJob('user-123', validPrompt)).rejects.toThrow(
        'User has reached maximum concurrent jobs limit (5)'
      );
    });

    it('should reject if queue has 500 jobs', async () => {
      mockQueue.getJobCounts.mockResolvedValue({
        waiting: 300,
        active: 100,
        delayed: 100,
      });

      await expect(jobSubmitter.submitJob('user-123', validPrompt)).rejects.toThrow('System queue is full');
    });

    it('should generate warning if queue has 400+ jobs', async () => {
      mockQueue.getJobCounts.mockResolvedValue({
        waiting: 350,
        active: 55,
        delayed: 5,
      });

      const response = await jobSubmitter.submitJob('user-123', validPrompt);

      expect(response.warning).toBeDefined();
      expect(response.warning?.message).toContain('high load');
      expect(response.warning?.queueDepth).toBe(410);
    });
  });

  describe('Edge Cases', () => {
    it('should handle user submitting exact same prompt twice in 5 seconds', async () => {
      const response1 = await jobSubmitter.submitJob('user-123', validPrompt);

      // Simulate deduplication detection
      mockQueue.client.keys.mockResolvedValue([`dedup:user-123:${response1.jobId}`]);
      mockQueue.client.get.mockResolvedValue(response1.jobId);

      const response2 = await jobSubmitter.submitJob('user-123', validPrompt);

      expect(response2.jobId).toBe(response1.jobId);
      expect(mockQueue.add).toHaveBeenCalledTimes(1);
    });

    it('should handle cache expiring between duplicate check and submission', async () => {
      // First call: cache miss
      mockQueue.client.get.mockResolvedValueOnce(null);

      // Simulate cache expiring right before we try to check it
      // This means we proceed with normal submission
      const response = await jobSubmitter.submitJob('user-123', validPrompt);

      expect(response.cacheHit).toBe(false);
      expect(mockQueue.add).toHaveBeenCalled();
    });

    it("should handle user's 5th job completing during submission of 6th", async () => {
      // Simulate race condition: keys call returns 5 jobs, but by the time we check again, one completed
      let callCount = 0;
      mockQueue.client.keys.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First check: 5 active jobs
          return Promise.resolve([
            'active:user-123:job-1',
            'active:user-123:job-2',
            'active:user-123:job-3',
            'active:user-123:job-4',
            'active:user-123:job-5',
          ]);
        }
        return Promise.resolve([]);
      });

      // First call should reject
      await expect(jobSubmitter.submitJob('user-123', validPrompt)).rejects.toThrow(
        'User has reached maximum concurrent jobs limit (5)'
      );

      // Second call should succeed (job completed)
      const response = await jobSubmitter.submitJob('user-123', validPrompt);
      expect(response.jobId).toBeDefined();
    });

    it('should handle queue at exactly 500 jobs (edge of limit)', async () => {
      mockQueue.getJobCounts.mockResolvedValue({
        waiting: 400,
        active: 50,
        delayed: 50,
      });

      await expect(jobSubmitter.submitJob('user-123', validPrompt)).rejects.toThrow('System queue is full (500/500)');
    });

    it('should handle malformed cached data gracefully', async () => {
      // Mock invalid JSON in cache
      mockQueue.client.get.mockResolvedValue('invalid-json{{{');

      // Should treat as cache miss and proceed with job submission
      const response = await jobSubmitter.submitJob('user-123', validPrompt);

      expect(response.cacheHit).toBe(false);
      expect(mockQueue.add).toHaveBeenCalled();
    });

    it('should handle Redis connection errors during submission', async () => {
      mockQueue.client.get.mockRejectedValue(new Error('Redis connection failed'));

      // Should propagate error
      await expect(jobSubmitter.submitJob('user-123', validPrompt)).rejects.toThrow('Redis connection failed');
    });

    it('should handle queue add failure gracefully', async () => {
      mockQueue.add.mockRejectedValue(new Error('Queue add failed'));

      await expect(jobSubmitter.submitJob('user-123', validPrompt)).rejects.toThrow('Queue add failed');
    });

    it('should handle concurrent submissions from same user', async () => {
      // Submit 3 jobs concurrently
      const promises = [
        jobSubmitter.submitJob('user-123', validPrompt),
        jobSubmitter.submitJob('user-123', { ...validPrompt, description: 'different prompt 1' }),
        jobSubmitter.submitJob('user-123', { ...validPrompt, description: 'different prompt 2' }),
      ];

      const responses = await Promise.all(promises);

      // All should succeed with unique job IDs
      expect(responses[0].jobId).toBeDefined();
      expect(responses[1].jobId).toBeDefined();
      expect(responses[2].jobId).toBeDefined();
      expect(responses[0].jobId).not.toBe(responses[1].jobId);
      expect(responses[1].jobId).not.toBe(responses[2].jobId);
    });

    it('should handle prompt with all optional fields', async () => {
      const fullPrompt: StructuredPrompt = {
        ...validPrompt,
        options: {
          noBackground: true,
          textGuidanceScale: 8.5,
          paletteImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        },
      };

      const response = await jobSubmitter.submitJob('user-123', fullPrompt);

      expect(response.jobId).toBeDefined();
      expect(mockQueue.add).toHaveBeenCalledWith(
        'sprite-generation',
        expect.objectContaining({
          prompt: fullPrompt,
        }),
        expect.any(Object)
      );
    });

    it('should handle very long descriptions', async () => {
      const longPrompt: StructuredPrompt = {
        ...validPrompt,
        description: 'a'.repeat(10000), // 10KB description
      };

      const response = await jobSubmitter.submitJob('user-123', longPrompt);

      expect(response.jobId).toBeDefined();
    });

    it('should handle queue at warning threshold exactly (400)', async () => {
      mockQueue.getJobCounts.mockResolvedValue({
        waiting: 350,
        active: 45,
        delayed: 5,
      });

      const response = await jobSubmitter.submitJob('user-123', validPrompt);

      expect(response.warning).toBeDefined();
      expect(response.warning?.queueDepth).toBe(400);
    });

    it('should not warn if queue below warning threshold', async () => {
      mockQueue.getJobCounts.mockResolvedValue({
        waiting: 300,
        active: 50,
        delayed: 49,
      });

      const response = await jobSubmitter.submitJob('user-123', validPrompt);

      expect(response.warning).toBeUndefined();
    });
  });

  describe('Estimated Wait Time Calculation', () => {
    it('should calculate wait time based on queue depth and concurrency', async () => {
      mockQueue.getJobCounts.mockResolvedValue({
        waiting: 100,
        active: 5,
        delayed: 0,
      });

      const response = await jobSubmitter.submitJob('user-123', validPrompt);

      // With concurrency 5, 100 waiting jobs = ~20 batches
      // Assuming ~30 seconds per job, estimated wait = 100/5 * 30 = 600 seconds
      expect(response.estimatedWaitTime).toBeGreaterThan(0);
    });

    it('should return minimal wait time for empty queue', async () => {
      mockQueue.getJobCounts.mockResolvedValue({
        waiting: 0,
        active: 0,
        delayed: 0,
      });

      const response = await jobSubmitter.submitJob('user-123', validPrompt);

      // Should be close to 0 or processing time
      expect(response.estimatedWaitTime).toBeDefined();
    });
  });
});
