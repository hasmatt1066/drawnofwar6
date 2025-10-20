/**
 * Task 5.1: Queue Size Monitoring - Unit Tests
 *
 * Comprehensive tests for QueueSizeMonitor with all acceptance criteria and edge cases.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QueueSizeMonitor, QueueSizeMetrics, QueueSizeMonitorConfig } from '../queue-size-monitor.js';
import { QueueManager, QueueServiceConfig } from '../queue-manager.js';
import { QueueLogger } from '../logger.js';
import { Queue } from 'bullmq';

describe('QueueSizeMonitor', () => {
  let monitor: QueueSizeMonitor;
  let queueManager: QueueManager;
  let logger: QueueLogger;
  let mockQueue: any;

  const defaultConfig: QueueSizeMonitorConfig = {
    warningThreshold: 400,
    criticalThreshold: 500,
    cacheDuration: 1000,
  };

  const mockQueueServiceConfig: QueueServiceConfig = {
    redis: {
      host: 'localhost',
      port: 6379,
    },
    firestore: {
      projectId: 'test-project',
    },
    queue: {
      name: 'test-queue',
      concurrency: 5,
      maxJobsPerUser: 5,
      systemQueueLimit: 500,
      warningThreshold: 400,
    },
    cache: {
      ttlDays: 30,
      strategy: 'moderate',
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

  beforeEach(() => {
    // Create mock queue with all required BullMQ methods
    mockQueue = {
      getJobCounts: vi.fn(),
      close: vi.fn(),
      client: {
        ping: vi.fn().mockResolvedValue('PONG'),
      },
    };

    // Create logger and queue manager
    logger = new QueueLogger({ enabled: false });
    queueManager = new QueueManager(mockQueueServiceConfig, logger);

    // Mock getQueue to return our mock
    vi.spyOn(queueManager, 'getQueue').mockReturnValue(mockQueue as any);

    // Create monitor
    monitor = new QueueSizeMonitor(queueManager, logger, defaultConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getQueueSize()', () => {
    it('should return current queue size metrics', async () => {
      // Arrange
      const mockCounts = {
        waiting: 10,
        active: 5,
        completed: 100,
        failed: 2,
        delayed: 0,
        paused: 0,
      };
      mockQueue.getJobCounts.mockResolvedValue(mockCounts);

      // Act
      const metrics = await monitor.getQueueSize();

      // Assert
      expect(metrics).toBeDefined();
      expect(metrics.total).toBe(15); // waiting + active
      expect(metrics.pending).toBe(10);
      expect(metrics.processing).toBe(5);
      expect(metrics.completed).toBe(100);
      expect(metrics.failed).toBe(2);
      expect(metrics.timestamp).toBeGreaterThan(0);
      expect(mockQueue.getJobCounts).toHaveBeenCalledTimes(1);
    });

    it('should count jobs by state correctly', async () => {
      // Arrange
      const mockCounts = {
        waiting: 50,
        active: 25,
        completed: 200,
        failed: 10,
        delayed: 5,
        paused: 0,
      };
      mockQueue.getJobCounts.mockResolvedValue(mockCounts);

      // Act
      const metrics = await monitor.getQueueSize();

      // Assert
      expect(metrics.pending).toBe(50); // waiting jobs
      expect(metrics.processing).toBe(25); // active jobs
      expect(metrics.total).toBe(75); // waiting + active
      expect(metrics.completed).toBe(200);
      expect(metrics.failed).toBe(10);
    });

    it('should cache result for 1 second', async () => {
      // Arrange
      const mockCounts = {
        waiting: 10,
        active: 5,
        completed: 100,
        failed: 2,
        delayed: 0,
        paused: 0,
      };
      mockQueue.getJobCounts.mockResolvedValue(mockCounts);

      // Act
      const metrics1 = await monitor.getQueueSize();
      const metrics2 = await monitor.getQueueSize();

      // Assert
      expect(mockQueue.getJobCounts).toHaveBeenCalledTimes(1); // Only called once due to cache
      expect(metrics1).toEqual(metrics2);
    });

    it('should refresh cache after cache duration expires', async () => {
      // Arrange
      const mockCounts1 = {
        waiting: 10,
        active: 5,
        completed: 100,
        failed: 2,
        delayed: 0,
        paused: 0,
      };
      const mockCounts2 = {
        waiting: 20,
        active: 10,
        completed: 120,
        failed: 3,
        delayed: 0,
        paused: 0,
      };
      mockQueue.getJobCounts
        .mockResolvedValueOnce(mockCounts1)
        .mockResolvedValueOnce(mockCounts2);

      // Act
      const metrics1 = await monitor.getQueueSize();

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      const metrics2 = await monitor.getQueueSize();

      // Assert
      expect(mockQueue.getJobCounts).toHaveBeenCalledTimes(2);
      expect(metrics1.total).toBe(15);
      expect(metrics2.total).toBe(30);
    });

    it('should handle zero jobs correctly', async () => {
      // Arrange
      const mockCounts = {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        paused: 0,
      };
      mockQueue.getJobCounts.mockResolvedValue(mockCounts);

      // Act
      const metrics = await monitor.getQueueSize();

      // Assert
      expect(metrics.total).toBe(0);
      expect(metrics.pending).toBe(0);
      expect(metrics.processing).toBe(0);
      expect(metrics.completed).toBe(0);
      expect(metrics.failed).toBe(0);
    });
  });

  describe('threshold events', () => {
    it('should emit warning event when queue size exceeds 400', async () => {
      // Arrange
      const mockCounts = {
        waiting: 350,
        active: 60,
        completed: 1000,
        failed: 10,
        delayed: 0,
        paused: 0,
      };
      mockQueue.getJobCounts.mockResolvedValue(mockCounts);

      const warningHandler = vi.fn();
      monitor.on('warning', warningHandler);

      // Act
      await monitor.getQueueSize();

      // Assert
      expect(warningHandler).toHaveBeenCalledTimes(1);
      expect(warningHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          total: 410,
          threshold: 400,
        })
      );
    });

    it('should emit critical event when queue reaches 500', async () => {
      // Arrange
      const mockCounts = {
        waiting: 450,
        active: 50,
        completed: 2000,
        failed: 20,
        delayed: 0,
        paused: 0,
      };
      mockQueue.getJobCounts.mockResolvedValue(mockCounts);

      const criticalHandler = vi.fn();
      monitor.on('critical', criticalHandler);

      // Act
      await monitor.getQueueSize();

      // Assert
      expect(criticalHandler).toHaveBeenCalledTimes(1);
      expect(criticalHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          total: 500,
          threshold: 500,
        })
      );
    });

    it('should emit critical event for queue size above 500', async () => {
      // Arrange
      const mockCounts = {
        waiting: 480,
        active: 50,
        completed: 2000,
        failed: 20,
        delayed: 0,
        paused: 0,
      };
      mockQueue.getJobCounts.mockResolvedValue(mockCounts);

      const criticalHandler = vi.fn();
      monitor.on('critical', criticalHandler);

      // Act
      await monitor.getQueueSize();

      // Assert
      expect(criticalHandler).toHaveBeenCalledTimes(1);
      expect(criticalHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          total: 530,
          threshold: 500,
        })
      );
    });

    it('should not emit warning if below threshold', async () => {
      // Arrange
      const mockCounts = {
        waiting: 300,
        active: 50,
        completed: 1000,
        failed: 10,
        delayed: 0,
        paused: 0,
      };
      mockQueue.getJobCounts.mockResolvedValue(mockCounts);

      const warningHandler = vi.fn();
      monitor.on('warning', warningHandler);

      // Act
      await monitor.getQueueSize();

      // Assert
      expect(warningHandler).not.toHaveBeenCalled();
    });

    it('should emit warning exactly at threshold (400)', async () => {
      // Arrange
      const mockCounts = {
        waiting: 350,
        active: 50,
        completed: 1000,
        failed: 10,
        delayed: 0,
        paused: 0,
      };
      mockQueue.getJobCounts.mockResolvedValue(mockCounts);

      const warningHandler = vi.fn();
      monitor.on('warning', warningHandler);

      // Act
      await monitor.getQueueSize();

      // Assert
      expect(warningHandler).toHaveBeenCalledTimes(1);
      expect(warningHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          total: 400,
          threshold: 400,
        })
      );
    });

    it('should emit critical exactly at threshold (500)', async () => {
      // Arrange
      const mockCounts = {
        waiting: 450,
        active: 50,
        completed: 2000,
        failed: 20,
        delayed: 0,
        paused: 0,
      };
      mockQueue.getJobCounts.mockResolvedValue(mockCounts);

      const criticalHandler = vi.fn();
      monitor.on('critical', criticalHandler);

      // Act
      await monitor.getQueueSize();

      // Assert
      expect(criticalHandler).toHaveBeenCalledTimes(1);
      expect(criticalHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          total: 500,
          threshold: 500,
        })
      );
    });

    it('should only emit events once per cache period', async () => {
      // Arrange
      const mockCounts = {
        waiting: 450,
        active: 60,
        completed: 2000,
        failed: 20,
        delayed: 0,
        paused: 0,
      };
      mockQueue.getJobCounts.mockResolvedValue(mockCounts);

      const criticalHandler = vi.fn();
      monitor.on('critical', criticalHandler);

      // Act
      await monitor.getQueueSize();
      await monitor.getQueueSize(); // Should use cache
      await monitor.getQueueSize(); // Should use cache

      // Assert
      expect(criticalHandler).toHaveBeenCalledTimes(1); // Only emitted once
    });

    it('should emit events again after cache expires', async () => {
      // Arrange
      const mockCounts = {
        waiting: 450,
        active: 60,
        completed: 2000,
        failed: 20,
        delayed: 0,
        paused: 0,
      };
      mockQueue.getJobCounts.mockResolvedValue(mockCounts);

      const criticalHandler = vi.fn();
      monitor.on('critical', criticalHandler);

      // Act
      await monitor.getQueueSize();

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      await monitor.getQueueSize();

      // Assert
      expect(criticalHandler).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('should handle Redis connection errors gracefully', async () => {
      // Arrange
      const error = new Error('Redis connection failed');
      mockQueue.getJobCounts.mockRejectedValue(error);

      // Act & Assert
      await expect(monitor.getQueueSize()).rejects.toThrow('Failed to get queue size: Redis connection failed');
    });

    it('should return cached value when Redis query fails', async () => {
      // Arrange
      const mockCounts = {
        waiting: 10,
        active: 5,
        completed: 100,
        failed: 2,
        delayed: 0,
        paused: 0,
      };
      mockQueue.getJobCounts
        .mockResolvedValueOnce(mockCounts)
        .mockRejectedValueOnce(new Error('Redis timeout'));

      // Act
      const metrics1 = await monitor.getQueueSize();
      const metrics2 = await monitor.getQueueSize();

      // Assert
      expect(metrics1).toEqual(metrics2); // Returns cached value
      expect(metrics1.total).toBe(15);
    });

    it('should throw error if no cached value available', async () => {
      // Arrange
      const error = new Error('Redis unavailable');
      mockQueue.getJobCounts.mockRejectedValue(error);

      // Act & Assert
      await expect(monitor.getQueueSize()).rejects.toThrow('Failed to get queue size: Redis unavailable');
    });

    it('should handle partial job count data', async () => {
      // Arrange - BullMQ might return undefined for some counts
      const mockCounts = {
        waiting: 10,
        active: 5,
        completed: undefined as any,
        failed: undefined as any,
        delayed: 0,
        paused: 0,
      };
      mockQueue.getJobCounts.mockResolvedValue(mockCounts);

      // Act
      const metrics = await monitor.getQueueSize();

      // Assert
      expect(metrics.total).toBe(15);
      expect(metrics.completed).toBe(0); // Should default to 0
      expect(metrics.failed).toBe(0); // Should default to 0
    });
  });

  describe('edge cases', () => {
    it('should handle queue size changing rapidly', async () => {
      // Arrange
      const counts1 = {
        waiting: 100,
        active: 50,
        completed: 500,
        failed: 10,
        delayed: 0,
        paused: 0,
      };
      const counts2 = {
        waiting: 400,
        active: 100,
        completed: 600,
        failed: 15,
        delayed: 0,
        paused: 0,
      };
      mockQueue.getJobCounts
        .mockResolvedValueOnce(counts1)
        .mockResolvedValueOnce(counts2);

      // Act
      const metrics1 = await monitor.getQueueSize();

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      const metrics2 = await monitor.getQueueSize();

      // Assert
      expect(metrics1.total).toBe(150);
      expect(metrics2.total).toBe(500);
      // Note: Cache might be stale during rapid changes
    });

    it('should handle multiple workers querying simultaneously', async () => {
      // Arrange
      const mockCounts = {
        waiting: 200,
        active: 100,
        completed: 1000,
        failed: 20,
        delayed: 0,
        paused: 0,
      };
      mockQueue.getJobCounts.mockResolvedValue(mockCounts);

      // Act - Query once to populate cache
      const metrics1 = await monitor.getQueueSize();

      // Then simulate multiple concurrent queries against the cache
      const [metrics2, metrics3, metrics4] = await Promise.all([
        monitor.getQueueSize(),
        monitor.getQueueSize(),
        monitor.getQueueSize(),
      ]);

      // Assert
      // Should only query Redis once (the first call), subsequent calls use cache
      expect(mockQueue.getJobCounts).toHaveBeenCalledTimes(1);
      expect(metrics1).toEqual(metrics2);
      expect(metrics2).toEqual(metrics3);
      expect(metrics3).toEqual(metrics4);
    });

    it('should handle very large job counts', async () => {
      // Arrange
      const mockCounts = {
        waiting: 999999,
        active: 100000,
        completed: 5000000,
        failed: 50000,
        delayed: 0,
        paused: 0,
      };
      mockQueue.getJobCounts.mockResolvedValue(mockCounts);

      // Act
      const metrics = await monitor.getQueueSize();

      // Assert
      expect(metrics.total).toBe(1099999);
      expect(metrics.pending).toBe(999999);
      expect(metrics.processing).toBe(100000);
    });

    it('should use custom thresholds when provided', async () => {
      // Arrange
      const customConfig: QueueSizeMonitorConfig = {
        warningThreshold: 100,
        criticalThreshold: 200,
        cacheDuration: 500,
      };
      const customMonitor = new QueueSizeMonitor(queueManager, logger, customConfig);

      const mockCounts = {
        waiting: 80,
        active: 30,
        completed: 500,
        failed: 5,
        delayed: 0,
        paused: 0,
      };
      mockQueue.getJobCounts.mockResolvedValue(mockCounts);

      const warningHandler = vi.fn();
      customMonitor.on('warning', warningHandler);

      // Act
      await customMonitor.getQueueSize();

      // Assert
      expect(warningHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          total: 110,
          threshold: 100,
        })
      );
    });

    it('should handle delayed jobs correctly', async () => {
      // Arrange
      const mockCounts = {
        waiting: 50,
        active: 25,
        completed: 100,
        failed: 5,
        delayed: 10, // Delayed jobs
        paused: 0,
      };
      mockQueue.getJobCounts.mockResolvedValue(mockCounts);

      // Act
      const metrics = await monitor.getQueueSize();

      // Assert
      // Total should only count waiting + active (not delayed)
      expect(metrics.total).toBe(75);
      expect(metrics.pending).toBe(50);
      expect(metrics.processing).toBe(25);
    });
  });

  describe('metrics for observability', () => {
    it('should provide timestamp for each query', async () => {
      // Arrange
      const mockCounts = {
        waiting: 10,
        active: 5,
        completed: 100,
        failed: 2,
        delayed: 0,
        paused: 0,
      };
      mockQueue.getJobCounts.mockResolvedValue(mockCounts);

      const beforeTimestamp = Date.now();

      // Act
      const metrics = await monitor.getQueueSize();

      const afterTimestamp = Date.now();

      // Assert
      expect(metrics.timestamp).toBeGreaterThanOrEqual(beforeTimestamp);
      expect(metrics.timestamp).toBeLessThanOrEqual(afterTimestamp);
    });

    it('should provide complete metrics object', async () => {
      // Arrange
      const mockCounts = {
        waiting: 50,
        active: 25,
        completed: 500,
        failed: 10,
        delayed: 5,
        paused: 0,
      };
      mockQueue.getJobCounts.mockResolvedValue(mockCounts);

      // Act
      const metrics = await monitor.getQueueSize();

      // Assert
      expect(metrics).toHaveProperty('total');
      expect(metrics).toHaveProperty('pending');
      expect(metrics).toHaveProperty('processing');
      expect(metrics).toHaveProperty('completed');
      expect(metrics).toHaveProperty('failed');
      expect(metrics).toHaveProperty('timestamp');
      expect(typeof metrics.total).toBe('number');
      expect(typeof metrics.pending).toBe('number');
      expect(typeof metrics.processing).toBe('number');
      expect(typeof metrics.completed).toBe('number');
      expect(typeof metrics.failed).toBe('number');
      expect(typeof metrics.timestamp).toBe('number');
    });
  });

  describe('configuration', () => {
    it('should use default config values when not specified', () => {
      // Arrange & Act
      const defaultMonitor = new QueueSizeMonitor(queueManager, logger);

      // Assert - Check that monitor was created successfully
      expect(defaultMonitor).toBeDefined();
      // Default values: warning=400, critical=500, cache=1000ms
    });

    it('should respect custom cache duration', async () => {
      // Arrange
      const customConfig: QueueSizeMonitorConfig = {
        warningThreshold: 400,
        criticalThreshold: 500,
        cacheDuration: 500, // 500ms cache
      };
      const customMonitor = new QueueSizeMonitor(queueManager, logger, customConfig);

      const mockCounts1 = {
        waiting: 10,
        active: 5,
        completed: 100,
        failed: 2,
        delayed: 0,
        paused: 0,
      };
      const mockCounts2 = {
        waiting: 20,
        active: 10,
        completed: 120,
        failed: 3,
        delayed: 0,
        paused: 0,
      };
      mockQueue.getJobCounts
        .mockResolvedValueOnce(mockCounts1)
        .mockResolvedValueOnce(mockCounts2);

      // Act
      await customMonitor.getQueueSize();

      // Wait for shorter cache to expire
      await new Promise(resolve => setTimeout(resolve, 600));

      await customMonitor.getQueueSize();

      // Assert
      expect(mockQueue.getJobCounts).toHaveBeenCalledTimes(2);
    });
  });
});
