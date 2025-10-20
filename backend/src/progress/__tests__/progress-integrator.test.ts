/**
 * Task 3.4: Integrate Progress Updates with Job Processor - Tests
 *
 * Tests for ProgressIntegrator class that orchestrates progress tracking and broadcasting.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Job } from 'bullmq';
import { ProgressIntegrator } from '../progress-integrator.js';
import { SSEManager } from '../sse-manager.js';
import { ProgressCalculator, JobStage } from '../progress-calculator.js';
import { QueueLogger } from '../../queue/logger.js';
import { JobStatus, type SpriteGenerationResult } from '../../queue/job-status-tracker.js';
import type { QueueServiceConfig } from '../../queue/queue-manager.js';

describe('ProgressIntegrator', () => {
  let sseManager: SSEManager;
  let progressCalculator: ProgressCalculator;
  let logger: QueueLogger;
  let config: QueueServiceConfig;
  let integrator: ProgressIntegrator;
  let mockJob: Job;

  beforeEach(() => {
    // Use fake timers for testing intervals
    vi.useFakeTimers();

    // Mock SSEManager
    sseManager = {
      broadcast: vi.fn(),
    } as any;

    // Mock ProgressCalculator
    progressCalculator = {
      calculateProgress: vi.fn().mockReturnValue(50),
      estimateTimeRemaining: vi.fn().mockReturnValue(30000),
      reset: vi.fn(),
    } as any;

    // Mock logger
    logger = {
      logInfo: vi.fn(),
      logWarn: vi.fn(),
      logError: vi.fn(),
    } as any;

    // Mock config
    config = {
      sse: {
        updateInterval: 2500, // 2.5 seconds
        keepAliveInterval: 30000,
      },
    } as QueueServiceConfig;

    // Mock BullMQ Job
    mockJob = {
      id: 'test-job-123',
      updateProgress: vi.fn(),
      data: {
        userId: 'user-123',
      },
    } as any;

    // Create integrator
    integrator = new ProgressIntegrator(sseManager, progressCalculator, config, logger);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('trackProgress', () => {
    it('should poll PixelLab API at 2.5 second intervals', async () => {
      const getProgressFn = vi.fn().mockResolvedValue({
        progress: 30,
        status: 'processing',
      });

      // Start tracking (don't await, it runs in background)
      const trackPromise = integrator.trackProgress(
        mockJob,
        'pixellab-job-123',
        'user-123',
        getProgressFn
      );

      // Fast-forward time to trigger polling
      await vi.advanceTimersByTimeAsync(2500); // First poll
      await vi.advanceTimersByTimeAsync(2500); // Second poll
      await vi.advanceTimersByTimeAsync(2500); // Third poll

      // Should have called getProgressFn 3 times
      expect(getProgressFn).toHaveBeenCalledTimes(3);

      // Stop tracking by resolving with completion
      getProgressFn.mockResolvedValue({
        progress: 100,
        status: 'completed',
      });

      await vi.advanceTimersByTimeAsync(2500);
      await trackPromise;
    });

    it('should calculate overall progress using ProgressCalculator', async () => {
      const getProgressFn = vi.fn().mockResolvedValue({
        progress: 45,
        status: 'processing',
      });

      const trackPromise = integrator.trackProgress(
        mockJob,
        'pixellab-job-123',
        'user-123',
        getProgressFn
      );

      await vi.advanceTimersByTimeAsync(2500);

      // Should call ProgressCalculator with PixelLab progress
      expect(progressCalculator.calculateProgress).toHaveBeenCalledWith(
        JobStage.PIXELLAB_GENERATION,
        45
      );

      // Complete tracking
      getProgressFn.mockResolvedValue({ progress: 100, status: 'completed' });
      await vi.advanceTimersByTimeAsync(2500);
      await trackPromise;
    });

    it('should broadcast progress updates via SSE', async () => {
      const getProgressFn = vi.fn().mockResolvedValue({
        progress: 60,
        status: 'processing',
      });

      progressCalculator.calculateProgress = vi.fn().mockReturnValue(58);
      progressCalculator.estimateTimeRemaining = vi.fn().mockReturnValue(25000);

      const trackPromise = integrator.trackProgress(
        mockJob,
        'pixellab-job-123',
        'user-123',
        getProgressFn
      );

      await vi.advanceTimersByTimeAsync(2500);

      // Should broadcast progress update
      expect(sseManager.broadcast).toHaveBeenCalledWith('user-123', {
        jobId: 'test-job-123',
        userId: 'user-123',
        status: JobStatus.PROCESSING,
        progress: 58,
        message: 'Generating sprites...',
        estimatedTimeRemaining: 25000,
        timestamp: expect.any(Number),
      });

      // Complete tracking
      getProgressFn.mockResolvedValue({ progress: 100, status: 'completed' });
      await vi.advanceTimersByTimeAsync(2500);
      await trackPromise;
    });

    it('should update BullMQ job progress', async () => {
      const getProgressFn = vi.fn().mockResolvedValue({
        progress: 70,
        status: 'processing',
      });

      progressCalculator.calculateProgress = vi.fn().mockReturnValue(66);

      const trackPromise = integrator.trackProgress(
        mockJob,
        'pixellab-job-123',
        'user-123',
        getProgressFn
      );

      await vi.advanceTimersByTimeAsync(2500);

      // Should update BullMQ job progress
      expect(mockJob.updateProgress).toHaveBeenCalledWith(66);

      // Complete tracking
      getProgressFn.mockResolvedValue({ progress: 100, status: 'completed' });
      await vi.advanceTimersByTimeAsync(2500);
      await trackPromise;
    });

    it('should stop polling when job completes', async () => {
      const getProgressFn = vi.fn()
        .mockResolvedValueOnce({ progress: 50, status: 'processing' })
        .mockResolvedValueOnce({ progress: 80, status: 'processing' })
        .mockResolvedValueOnce({ progress: 100, status: 'completed' });

      const trackPromise = integrator.trackProgress(
        mockJob,
        'pixellab-job-123',
        'user-123',
        getProgressFn
      );

      await vi.advanceTimersByTimeAsync(2500); // Poll 1
      await vi.advanceTimersByTimeAsync(2500); // Poll 2
      await vi.advanceTimersByTimeAsync(2500); // Poll 3 (completed)

      await trackPromise;

      // Should have called exactly 3 times (no more after completion)
      expect(getProgressFn).toHaveBeenCalledTimes(3);

      // Additional time should not trigger more calls
      await vi.advanceTimersByTimeAsync(5000);
      expect(getProgressFn).toHaveBeenCalledTimes(3);
    });

    it('should handle PixelLab polling errors gracefully', async () => {
      const getProgressFn = vi.fn()
        .mockResolvedValueOnce({ progress: 40, status: 'processing' })
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce({ progress: 50, status: 'processing' })
        .mockResolvedValueOnce({ progress: 100, status: 'completed' });

      progressCalculator.calculateProgress = vi.fn()
        .mockReturnValueOnce(42) // First success
        .mockReturnValueOnce(42) // After error, use last known
        .mockReturnValueOnce(50); // Recovery

      const trackPromise = integrator.trackProgress(
        mockJob,
        'pixellab-job-123',
        'user-123',
        getProgressFn
      );

      await vi.advanceTimersByTimeAsync(2500); // Poll 1 - success
      await vi.advanceTimersByTimeAsync(2500); // Poll 2 - error
      await vi.advanceTimersByTimeAsync(2500); // Poll 3 - recovery
      await vi.advanceTimersByTimeAsync(2500); // Poll 4 - complete

      await trackPromise;

      // Should log warning for error
      expect(logger.logWarn).toHaveBeenCalledWith('progress_poll_error', {
        jobId: 'test-job-123',
        pixelLabJobId: 'pixellab-job-123',
        error: 'Network timeout',
      });

      // Should continue with last known progress
      expect(sseManager.broadcast).toHaveBeenCalledWith('user-123',
        expect.objectContaining({
          progress: 42,
          message: 'Generating sprites...',
        })
      );
    });

    it('should handle SSE broadcast failures gracefully', async () => {
      const getProgressFn = vi.fn()
        .mockResolvedValueOnce({ progress: 30, status: 'processing' })
        .mockResolvedValueOnce({ progress: 100, status: 'completed' });

      // Make broadcast throw error
      (sseManager.broadcast as any).mockImplementationOnce(() => {
        throw new Error('Connection closed');
      });

      const trackPromise = integrator.trackProgress(
        mockJob,
        'pixellab-job-123',
        'user-123',
        getProgressFn
      );

      await vi.advanceTimersByTimeAsync(2500);

      // Should log warning but continue
      expect(logger.logWarn).toHaveBeenCalledWith('sse_broadcast_error', {
        jobId: 'test-job-123',
        userId: 'user-123',
        error: 'Connection closed',
      });

      // Should still update BullMQ job
      expect(mockJob.updateProgress).toHaveBeenCalled();

      // Complete tracking
      await vi.advanceTimersByTimeAsync(2500);
      await trackPromise;
    });

    it('should work without SSE (polling-only clients)', async () => {
      // SSE manager returns without error (no connections)
      const getProgressFn = vi.fn()
        .mockResolvedValueOnce({ progress: 50, status: 'processing' })
        .mockResolvedValueOnce({ progress: 100, status: 'completed' });

      const trackPromise = integrator.trackProgress(
        mockJob,
        'pixellab-job-123',
        'user-123',
        getProgressFn
      );

      await vi.advanceTimersByTimeAsync(2500);
      await vi.advanceTimersByTimeAsync(2500);

      await trackPromise;

      // Should still update BullMQ job progress for polling clients
      expect(mockJob.updateProgress).toHaveBeenCalled();
      expect(getProgressFn).toHaveBeenCalledTimes(2);
    });

    it('should handle job completing before first progress update', async () => {
      const getProgressFn = vi.fn().mockResolvedValue({
        progress: 100,
        status: 'completed',
      });

      const trackPromise = integrator.trackProgress(
        mockJob,
        'pixellab-job-123',
        'user-123',
        getProgressFn
      );

      await vi.advanceTimersByTimeAsync(2500);
      await trackPromise;

      // Should call once and complete
      expect(getProgressFn).toHaveBeenCalledTimes(1);
      expect(mockJob.updateProgress).toHaveBeenCalled();
    });

    it('should handle multiple progress updates in quick succession', async () => {
      const getProgressFn = vi.fn()
        .mockResolvedValue({ progress: 20, status: 'processing' });

      const trackPromise = integrator.trackProgress(
        mockJob,
        'pixellab-job-123',
        'user-123',
        getProgressFn
      );

      // Advance in rapid succession
      await vi.advanceTimersByTimeAsync(2500);
      await vi.advanceTimersByTimeAsync(2500);
      await vi.advanceTimersByTimeAsync(2500);

      // Each should still be processed
      expect(getProgressFn).toHaveBeenCalledTimes(3);
      expect(mockJob.updateProgress).toHaveBeenCalledTimes(3);

      // Complete tracking
      getProgressFn.mockResolvedValue({ progress: 100, status: 'completed' });
      await vi.advanceTimersByTimeAsync(2500);
      await trackPromise;
    });
  });

  describe('broadcastStateChange', () => {
    it('should broadcast state change event', async () => {
      await integrator.broadcastStateChange(
        'job-456',
        'user-789',
        JobStatus.PENDING,
        JobStatus.PROCESSING
      );

      expect(sseManager.broadcast).toHaveBeenCalledWith('user-789', {
        jobId: 'job-456',
        userId: 'user-789',
        status: JobStatus.PROCESSING,
        progress: 10,
        message: 'Job started processing',
        timestamp: expect.any(Number),
      });
    });

    it('should format state transitions correctly', async () => {
      await integrator.broadcastStateChange(
        'job-999',
        'user-111',
        JobStatus.PROCESSING,
        JobStatus.COMPLETED
      );

      expect(sseManager.broadcast).toHaveBeenCalledWith('user-111', {
        jobId: 'job-999',
        userId: 'user-111',
        status: JobStatus.COMPLETED,
        progress: 100,
        message: 'Job completed successfully',
        timestamp: expect.any(Number),
      });
    });

    it('should log state change', async () => {
      await integrator.broadcastStateChange(
        'job-222',
        'user-333',
        JobStatus.PENDING,
        JobStatus.PROCESSING
      );

      expect(logger.logInfo).toHaveBeenCalledWith('state_change_broadcast', {
        jobId: 'job-222',
        userId: 'user-333',
        fromState: JobStatus.PENDING,
        toState: JobStatus.PROCESSING,
      });
    });

    it('should handle SSE broadcast failure gracefully', async () => {
      (sseManager.broadcast as any).mockImplementationOnce(() => {
        throw new Error('No connections');
      });

      // Should not throw
      await expect(
        integrator.broadcastStateChange(
          'job-444',
          'user-555',
          JobStatus.PENDING,
          JobStatus.PROCESSING
        )
      ).resolves.toBeUndefined();

      expect(logger.logWarn).toHaveBeenCalledWith('sse_broadcast_error', {
        jobId: 'job-444',
        userId: 'user-555',
        error: 'No connections',
      });
    });
  });

  describe('broadcastCompletion', () => {
    it('should broadcast completion with result', async () => {
      const result: SpriteGenerationResult = {
        jobId: 'job-777',
        frames: [Buffer.from('frame1'), Buffer.from('frame2')],
        metadata: {
          dimensions: { width: 32, height: 32 },
          frameCount: 2,
          generationTimeMs: 15000,
          cacheHit: false,
          pixelLabJobId: 'pixellab-888',
        },
      };

      await integrator.broadcastCompletion('job-777', 'user-999', result);

      expect(sseManager.broadcast).toHaveBeenCalledWith('user-999', {
        jobId: 'job-777',
        userId: 'user-999',
        status: JobStatus.COMPLETED,
        progress: 100,
        message: 'Generation complete',
        result: {
          jobId: 'job-777',
          frameCount: 2,
          dimensions: { width: 32, height: 32 },
          generationTimeMs: 15000,
          cacheHit: false,
        },
        timestamp: expect.any(Number),
      });
    });

    it('should not include frame buffers in broadcast', async () => {
      const result: SpriteGenerationResult = {
        jobId: 'job-111',
        frames: [Buffer.from('large-frame-data')],
        metadata: {
          dimensions: { width: 64, height: 64 },
          frameCount: 1,
          generationTimeMs: 8000,
          cacheHit: true,
        },
      };

      await integrator.broadcastCompletion('job-111', 'user-222', result);

      const broadcastCall = (sseManager.broadcast as any).mock.calls[0];
      const broadcastData = broadcastCall[1];

      // Should not include frames (too large for SSE)
      expect(broadcastData.result.frames).toBeUndefined();
      // Should include metadata
      expect(broadcastData.result.frameCount).toBe(1);
      expect(broadcastData.result.dimensions).toEqual({ width: 64, height: 64 });
    });

    it('should log completion broadcast', async () => {
      const result: SpriteGenerationResult = {
        jobId: 'job-333',
        frames: [],
        metadata: {
          dimensions: { width: 16, height: 16 },
          frameCount: 0,
          generationTimeMs: 5000,
          cacheHit: false,
        },
      };

      await integrator.broadcastCompletion('job-333', 'user-444', result);

      expect(logger.logInfo).toHaveBeenCalledWith('completion_broadcast', {
        jobId: 'job-333',
        userId: 'user-444',
        frameCount: 0,
        cacheHit: false,
      });
    });

    it('should handle SSE broadcast failure gracefully', async () => {
      const result: SpriteGenerationResult = {
        jobId: 'job-555',
        frames: [],
        metadata: {
          dimensions: { width: 32, height: 32 },
          frameCount: 4,
          generationTimeMs: 12000,
          cacheHit: false,
        },
      };

      (sseManager.broadcast as any).mockImplementationOnce(() => {
        throw new Error('All connections closed');
      });

      // Should not throw
      await expect(
        integrator.broadcastCompletion('job-555', 'user-666', result)
      ).resolves.toBeUndefined();

      expect(logger.logWarn).toHaveBeenCalledWith('sse_broadcast_error', {
        jobId: 'job-555',
        userId: 'user-666',
        error: 'All connections closed',
      });
    });
  });

  describe('configurable update interval', () => {
    it('should respect custom update interval from config', async () => {
      // Create integrator with custom interval
      const customConfig = {
        ...config,
        sse: {
          ...config.sse,
          updateInterval: 5000, // 5 seconds instead of 2.5
        },
      };

      const customIntegrator = new ProgressIntegrator(
        sseManager,
        progressCalculator,
        customConfig,
        logger
      );

      const getProgressFn = vi.fn()
        .mockResolvedValue({ progress: 50, status: 'processing' });

      const trackPromise = customIntegrator.trackProgress(
        mockJob,
        'pixellab-job-123',
        'user-123',
        getProgressFn
      );

      // 2.5 seconds should not trigger
      await vi.advanceTimersByTimeAsync(2500);
      expect(getProgressFn).toHaveBeenCalledTimes(0);

      // 5 seconds should trigger
      await vi.advanceTimersByTimeAsync(2500);
      expect(getProgressFn).toHaveBeenCalledTimes(1);

      // Complete tracking
      getProgressFn.mockResolvedValue({ progress: 100, status: 'completed' });
      await vi.advanceTimersByTimeAsync(5000);
      await trackPromise;
    });
  });
});
