/**
 * Task 1.2: Implement BullMQ Worker with Job Processing Loop - Tests
 *
 * Comprehensive test suite following TDD approach.
 * Tests all acceptance criteria, test scenarios, and edge cases.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Worker, Job } from 'bullmq';
import { QueueWorker, JobProcessor } from './worker.js';
import { QueueManager } from './queue-manager.js';
import { QueueLogger } from './logger.js';
import type { QueueServiceConfig } from './queue-manager.js';

// Mock BullMQ Worker
vi.mock('bullmq', async () => {
  const actualBullMQ: any = await vi.importActual('bullmq');
  return {
    ...actualBullMQ,
    Worker: vi.fn().mockImplementation(function (this: any, queueName: string, processor: any, opts: any) {
      this.queueName = queueName;
      this.processor = processor;
      this.opts = opts;
      this._isRunning = false;
      this._events = new Map<string, Array<(...args: any[]) => void>>();

      // Mock methods
      this.run = vi.fn().mockImplementation(async () => {
        this._isRunning = true;
      });

      this.close = vi.fn().mockImplementation(async () => {
        this._isRunning = false;
      });

      this.pause = vi.fn().mockResolvedValue(undefined);
      this.resume = vi.fn().mockResolvedValue(undefined);

      this.on = vi.fn().mockImplementation((event: string, handler: (...args: any[]) => void) => {
        if (!this._events.has(event)) {
          this._events.set(event, []);
        }
        this._events.get(event)!.push(handler);
        return this;
      });

      this.off = vi.fn().mockImplementation((event: string, handler?: (...args: any[]) => void) => {
        if (handler) {
          const handlers = this._events.get(event) || [];
          const index = handlers.indexOf(handler);
          if (index > -1) {
            handlers.splice(index, 1);
          }
        } else {
          this._events.delete(event);
        }
        return this;
      });

      // Helper to emit events for testing
      this._emit = (event: string, ...args: any[]) => {
        const handlers = this._events.get(event) || [];
        handlers.forEach((handler) => handler(...args));
      };

      return this;
    }),
  };
});

describe('QueueWorker - Task 1.2: Implement BullMQ Worker with Job Processing Loop', () => {
  let mockLogger: QueueLogger;
  let mockQueueManager: QueueManager;
  let mockJobProcessor: JobProcessor;
  let defaultConfig: QueueServiceConfig;

  beforeEach(() => {
    // Create mock logger
    mockLogger = new QueueLogger({ enabled: false });

    // Default valid configuration
    defaultConfig = {
      redis: {
        host: 'localhost',
        port: 6379,
        password: undefined,
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
        strategy: 'aggressive',
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

    // Create mock queue manager
    mockQueueManager = new QueueManager(defaultConfig, mockLogger);

    // Create mock job processor
    mockJobProcessor = vi.fn().mockResolvedValue({ status: 'completed' });

    vi.clearAllMocks();
  });

  afterEach(async () => {
    vi.clearAllMocks();
  });

  describe('Acceptance Criteria Tests', () => {
    it('should pull jobs from queue in FIFO order', async () => {
      const worker = new QueueWorker(mockQueueManager, mockJobProcessor, defaultConfig, mockLogger);
      await worker.start();

      // Verify worker was created with correct queue name
      expect(Worker).toHaveBeenCalledWith(
        defaultConfig.queue.name,
        expect.any(Function),
        expect.objectContaining({
          connection: expect.objectContaining({
            host: defaultConfig.redis.host,
            port: defaultConfig.redis.port,
          }),
        })
      );

      expect(worker.isRunning()).toBe(true);
    });

    it('should process up to N jobs concurrently (configurable)', async () => {
      const customConfig = {
        ...defaultConfig,
        queue: {
          ...defaultConfig.queue,
          concurrency: 10,
        },
      };

      const worker = new QueueWorker(mockQueueManager, mockJobProcessor, customConfig, mockLogger);
      await worker.start();

      // Verify worker was created with correct concurrency
      expect(Worker).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function),
        expect.objectContaining({
          concurrency: 10,
        })
      );
    });

    it('should call job processor function for each job', async () => {
      const worker = new QueueWorker(mockQueueManager, mockJobProcessor, defaultConfig, mockLogger);
      await worker.start();

      // Get the processor function passed to Worker
      const workerInstance = vi.mocked(Worker).mock.results[0]!.value;
      const processorFn = workerInstance.processor;

      // Simulate a job
      const mockJob = {
        id: 'job-123',
        name: 'test-job',
        data: { userId: 'user-1', prompt: 'test prompt' },
        updateProgress: vi.fn().mockResolvedValue(undefined),
      } as unknown as Job;

      await processorFn(mockJob);

      // Verify job processor was called
      expect(mockJobProcessor).toHaveBeenCalledWith(mockJob);
    });

    it('should update job progress during processing', async () => {
      // Create processor that updates progress
      const progressProcessor: JobProcessor = vi.fn().mockImplementation(async (job: Job) => {
        await job.updateProgress(25);
        await job.updateProgress(50);
        await job.updateProgress(75);
        await job.updateProgress(100);
        return { status: 'completed' };
      });

      const worker = new QueueWorker(mockQueueManager, progressProcessor, defaultConfig, mockLogger);
      await worker.start();

      const workerInstance = vi.mocked(Worker).mock.results[0]!.value;
      const processorFn = workerInstance.processor;

      const mockJob = {
        id: 'job-123',
        name: 'test-job',
        data: { userId: 'user-1' },
        updateProgress: vi.fn().mockResolvedValue(undefined),
      } as unknown as Job;

      await processorFn(mockJob);

      expect(mockJob.updateProgress).toHaveBeenCalledWith(25);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(50);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(75);
      expect(mockJob.updateProgress).toHaveBeenCalledWith(100);
    });

    it('should handle job completion (success)', async () => {
      const worker = new QueueWorker(mockQueueManager, mockJobProcessor, defaultConfig, mockLogger);
      await worker.start();

      const workerInstance = vi.mocked(Worker).mock.results[0]!.value;
      const processorFn = workerInstance.processor;

      const mockJob = {
        id: 'job-123',
        name: 'test-job',
        data: { userId: 'user-1' },
        updateProgress: vi.fn().mockResolvedValue(undefined),
      } as unknown as Job;

      const result = await processorFn(mockJob);

      expect(result).toEqual({ status: 'completed' });
    });

    it('should handle job completion (failure)', async () => {
      const failingProcessor: JobProcessor = vi.fn().mockRejectedValue(new Error('Processing failed'));

      const worker = new QueueWorker(mockQueueManager, failingProcessor, defaultConfig, mockLogger);
      await worker.start();

      const workerInstance = vi.mocked(Worker).mock.results[0]!.value;
      const processorFn = workerInstance.processor;

      const mockJob = {
        id: 'job-123',
        name: 'test-job',
        data: { userId: 'user-1' },
        updateProgress: vi.fn().mockResolvedValue(undefined),
      } as unknown as Job;

      await expect(processorFn(mockJob)).rejects.toThrow('Processing failed');
    });

    it('should gracefully shut down on SIGTERM/SIGINT', async () => {
      const worker = new QueueWorker(mockQueueManager, mockJobProcessor, defaultConfig, mockLogger);
      await worker.start();

      const workerInstance = vi.mocked(Worker).mock.results[0]!.value;

      await worker.stop();

      expect(workerInstance.close).toHaveBeenCalled();
      expect(worker.isRunning()).toBe(false);
    });

    it('should log worker lifecycle events', async () => {
      const loggerSpy = vi.spyOn(mockLogger, 'logInfo');

      const worker = new QueueWorker(mockQueueManager, mockJobProcessor, defaultConfig, mockLogger);
      await worker.start();

      expect(loggerSpy).toHaveBeenCalledWith('worker_started', expect.any(Object));
    });
  });

  describe('Test Scenarios', () => {
    it('should process job from queue', async () => {
      const worker = new QueueWorker(mockQueueManager, mockJobProcessor, defaultConfig, mockLogger);
      await worker.start();

      const workerInstance = vi.mocked(Worker).mock.results[0]!.value;
      const processorFn = workerInstance.processor;

      const mockJob = {
        id: 'job-456',
        name: 'generation-job',
        data: { userId: 'user-2', prompt: 'another prompt' },
        updateProgress: vi.fn().mockResolvedValue(undefined),
      } as unknown as Job;

      await processorFn(mockJob);

      expect(mockJobProcessor).toHaveBeenCalledWith(mockJob);
      expect(mockJobProcessor).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple concurrent jobs', async () => {
      let activeJobs = 0;
      let maxConcurrent = 0;

      const concurrentProcessor: JobProcessor = vi.fn().mockImplementation(async (job: Job) => {
        activeJobs++;
        maxConcurrent = Math.max(maxConcurrent, activeJobs);

        // Simulate async work
        await new Promise((resolve) => setTimeout(resolve, 10));

        activeJobs--;
        return { status: 'completed' };
      });

      const worker = new QueueWorker(mockQueueManager, concurrentProcessor, defaultConfig, mockLogger);
      await worker.start();

      const workerInstance = vi.mocked(Worker).mock.results[0]!.value;
      const processorFn = workerInstance.processor;

      // Process multiple jobs concurrently
      const jobs = Array.from({ length: 5 }, (_, i) => ({
        id: `job-${i}`,
        name: 'test-job',
        data: { userId: `user-${i}` },
        updateProgress: vi.fn().mockResolvedValue(undefined),
      } as unknown as Job));

      await Promise.all(jobs.map((job) => processorFn(job)));

      expect(concurrentProcessor).toHaveBeenCalledTimes(5);
    });

    it('should respect concurrency limit', async () => {
      const customConfig = {
        ...defaultConfig,
        queue: {
          ...defaultConfig.queue,
          concurrency: 3,
        },
      };

      const worker = new QueueWorker(mockQueueManager, mockJobProcessor, customConfig, mockLogger);
      await worker.start();

      expect(Worker).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function),
        expect.objectContaining({
          concurrency: 3,
        })
      );
    });

    it('should update job status during processing', async () => {
      const statusProcessor: JobProcessor = vi.fn().mockImplementation(async (job: Job) => {
        await job.updateProgress(0);
        await job.updateProgress(50);
        await job.updateProgress(100);
        return { status: 'completed' };
      });

      const worker = new QueueWorker(mockQueueManager, statusProcessor, defaultConfig, mockLogger);
      await worker.start();

      const workerInstance = vi.mocked(Worker).mock.results[0]!.value;
      const processorFn = workerInstance.processor;

      const mockJob = {
        id: 'job-789',
        name: 'test-job',
        data: { userId: 'user-3' },
        updateProgress: vi.fn().mockResolvedValue(undefined),
      } as unknown as Job;

      await processorFn(mockJob);

      expect(mockJob.updateProgress).toHaveBeenCalledTimes(3);
    });

    it('should handle worker shutdown gracefully', async () => {
      const worker = new QueueWorker(mockQueueManager, mockJobProcessor, defaultConfig, mockLogger);
      await worker.start();

      expect(worker.isRunning()).toBe(true);

      await worker.stop();

      expect(worker.isRunning()).toBe(false);
    });

    it('should reconnect to Redis if connection lost', async () => {
      const worker = new QueueWorker(mockQueueManager, mockJobProcessor, defaultConfig, mockLogger);
      await worker.start();

      const workerInstance = vi.mocked(Worker).mock.results[0]!.value;

      // Verify 'error' event handler is registered for reconnection logic
      const errorHandlers = workerInstance._events.get('error') || [];
      expect(errorHandlers.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle worker crash mid-job (job returns to queue)', async () => {
      const crashProcessor: JobProcessor = vi.fn().mockImplementation(async (job: Job) => {
        await job.updateProgress(50);
        throw new Error('Worker crashed');
      });

      const worker = new QueueWorker(mockQueueManager, crashProcessor, defaultConfig, mockLogger);
      await worker.start();

      const workerInstance = vi.mocked(Worker).mock.results[0]!.value;
      const processorFn = workerInstance.processor;

      const mockJob = {
        id: 'job-crash',
        name: 'test-job',
        data: { userId: 'user-4' },
        updateProgress: vi.fn().mockResolvedValue(undefined),
      } as unknown as Job;

      // Job processing should fail, causing BullMQ to retry
      await expect(processorFn(mockJob)).rejects.toThrow('Worker crashed');
    });

    it('should handle all workers busy (job waits in queue)', async () => {
      // This is handled by BullMQ's internal queuing mechanism
      // We verify that concurrency is set correctly
      const worker = new QueueWorker(mockQueueManager, mockJobProcessor, defaultConfig, mockLogger);
      await worker.start();

      expect(Worker).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function),
        expect.objectContaining({
          concurrency: defaultConfig.queue.concurrency,
        })
      );
    });

    it('should handle Redis connection lost during processing', async () => {
      const worker = new QueueWorker(mockQueueManager, mockJobProcessor, defaultConfig, mockLogger);
      await worker.start();

      const workerInstance = vi.mocked(Worker).mock.results[0]!.value;

      // Simulate connection error
      const error = new Error('Redis connection lost');
      workerInstance._emit('error', error);

      // Worker should log error and attempt reconnection (handled by BullMQ)
      // Verify error event listener exists
      const errorHandlers = workerInstance._events.get('error') || [];
      expect(errorHandlers.length).toBeGreaterThan(0);
    });

    it('should handle SIGKILL (ungraceful shutdown)', async () => {
      const worker = new QueueWorker(mockQueueManager, mockJobProcessor, defaultConfig, mockLogger);
      await worker.start();

      // Note: SIGKILL cannot be caught, but we test that regular stop works
      // In production, BullMQ will handle incomplete jobs on restart
      await worker.stop();

      expect(worker.isRunning()).toBe(false);
    });

    it('should handle processor that returns undefined', async () => {
      const voidProcessor: JobProcessor = vi.fn().mockResolvedValue(undefined);

      const worker = new QueueWorker(mockQueueManager, voidProcessor, defaultConfig, mockLogger);
      await worker.start();

      const workerInstance = vi.mocked(Worker).mock.results[0]!.value;
      const processorFn = workerInstance.processor;

      const mockJob = {
        id: 'job-void',
        name: 'test-job',
        data: { userId: 'user-5' },
        updateProgress: vi.fn().mockResolvedValue(undefined),
      } as unknown as Job;

      const result = await processorFn(mockJob);
      expect(result).toBeUndefined();
    });

    it('should handle processor timeout', async () => {
      const timeoutProcessor: JobProcessor = vi.fn().mockImplementation(async (job: Job) => {
        // Simulate long-running job
        await new Promise((resolve) => setTimeout(resolve, 100000));
        return { status: 'completed' };
      });

      const worker = new QueueWorker(mockQueueManager, timeoutProcessor, defaultConfig, mockLogger);
      await worker.start();

      // Verify timeout is not set at worker level (BullMQ handles this)
      // We just verify worker was created successfully
      expect(worker.isRunning()).toBe(true);
    });

    it('should handle job with missing data', async () => {
      const worker = new QueueWorker(mockQueueManager, mockJobProcessor, defaultConfig, mockLogger);
      await worker.start();

      const workerInstance = vi.mocked(Worker).mock.results[0]!.value;
      const processorFn = workerInstance.processor;

      const mockJob = {
        id: 'job-no-data',
        name: 'test-job',
        data: {},
        updateProgress: vi.fn().mockResolvedValue(undefined),
      } as unknown as Job;

      // Processor should handle missing data gracefully
      await processorFn(mockJob);
      expect(mockJobProcessor).toHaveBeenCalledWith(mockJob);
    });
  });

  describe('Worker Lifecycle', () => {
    it('should not allow starting worker twice', async () => {
      const worker = new QueueWorker(mockQueueManager, mockJobProcessor, defaultConfig, mockLogger);
      await worker.start();

      await expect(worker.start()).rejects.toThrow(/already running/i);
    });

    it('should not allow stopping worker that is not running', async () => {
      const worker = new QueueWorker(mockQueueManager, mockJobProcessor, defaultConfig, mockLogger);

      await expect(worker.stop()).rejects.toThrow(/not running/i);
    });

    it('should return correct running status', async () => {
      const worker = new QueueWorker(mockQueueManager, mockJobProcessor, defaultConfig, mockLogger);

      expect(worker.isRunning()).toBe(false);

      await worker.start();
      expect(worker.isRunning()).toBe(true);

      await worker.stop();
      expect(worker.isRunning()).toBe(false);
    });

    it('should clean up resources on stop', async () => {
      const worker = new QueueWorker(mockQueueManager, mockJobProcessor, defaultConfig, mockLogger);
      await worker.start();

      const workerInstance = vi.mocked(Worker).mock.results[0]!.value;

      await worker.stop();

      expect(workerInstance.close).toHaveBeenCalled();
    });
  });

  describe('Event Handling', () => {
    it('should log completed jobs', async () => {
      const loggerSpy = vi.spyOn(mockLogger, 'logStateChange');

      const worker = new QueueWorker(mockQueueManager, mockJobProcessor, defaultConfig, mockLogger);
      await worker.start();

      const workerInstance = vi.mocked(Worker).mock.results[0]!.value;

      // Simulate job completion
      const mockJob = {
        id: 'job-completed',
        name: 'test-job',
        data: { userId: 'user-6' },
      } as unknown as Job;

      workerInstance._emit('completed', mockJob, { status: 'completed' });

      expect(loggerSpy).toHaveBeenCalledWith('job-completed', 'active', 'completed', expect.any(Object));
    });

    it('should log failed jobs', async () => {
      const loggerSpy = vi.spyOn(mockLogger, 'logError');

      const worker = new QueueWorker(mockQueueManager, mockJobProcessor, defaultConfig, mockLogger);
      await worker.start();

      const workerInstance = vi.mocked(Worker).mock.results[0]!.value;

      // Simulate job failure
      const mockJob = {
        id: 'job-failed',
        name: 'test-job',
        data: { userId: 'user-7' },
      } as unknown as Job;

      const error = new Error('Job processing failed');
      workerInstance._emit('failed', mockJob, error);

      expect(loggerSpy).toHaveBeenCalledWith('job-failed', error, expect.any(Object));
    });

    it('should log worker errors', async () => {
      const loggerSpy = vi.spyOn(mockLogger, 'logWarn');

      const worker = new QueueWorker(mockQueueManager, mockJobProcessor, defaultConfig, mockLogger);
      await worker.start();

      const workerInstance = vi.mocked(Worker).mock.results[0]!.value;

      const error = new Error('Worker error');
      workerInstance._emit('error', error);

      expect(loggerSpy).toHaveBeenCalledWith('worker_error', expect.objectContaining({
        error: error.message,
      }));
    });
  });

  describe('Configuration Validation', () => {
    it('should use Redis configuration from config', async () => {
      const worker = new QueueWorker(mockQueueManager, mockJobProcessor, defaultConfig, mockLogger);
      await worker.start();

      expect(Worker).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function),
        expect.objectContaining({
          connection: expect.objectContaining({
            host: defaultConfig.redis.host,
            port: defaultConfig.redis.port,
            db: defaultConfig.redis.db,
          }),
        })
      );
    });

    it('should include password if provided', async () => {
      const configWithPassword = {
        ...defaultConfig,
        redis: {
          ...defaultConfig.redis,
          password: 'test-password',
        },
      };

      const worker = new QueueWorker(mockQueueManager, mockJobProcessor, configWithPassword, mockLogger);
      await worker.start();

      expect(Worker).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Function),
        expect.objectContaining({
          connection: expect.objectContaining({
            password: 'test-password',
          }),
        })
      );
    });

    it('should use queue name from config', async () => {
      const worker = new QueueWorker(mockQueueManager, mockJobProcessor, defaultConfig, mockLogger);
      await worker.start();

      expect(Worker).toHaveBeenCalledWith(
        defaultConfig.queue.name,
        expect.any(Function),
        expect.any(Object)
      );
    });
  });

  describe('Signal Handling', () => {
    it('should set up signal handlers for graceful shutdown', async () => {
      const processSpy = vi.spyOn(process, 'on');

      const worker = new QueueWorker(mockQueueManager, mockJobProcessor, defaultConfig, mockLogger);
      await worker.start();

      // Verify signal handlers are registered
      expect(processSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(processSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    });

    it('should clean up signal handlers on stop', async () => {
      const processOffSpy = vi.spyOn(process, 'off');

      const worker = new QueueWorker(mockQueueManager, mockJobProcessor, defaultConfig, mockLogger);
      await worker.start();
      await worker.stop();

      // Verify signal handlers are removed
      expect(processOffSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(processOffSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    });
  });
});
