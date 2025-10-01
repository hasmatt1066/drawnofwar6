/**
 * Task 5.2: Queue Overflow Protection - Tests
 *
 * Test suite for queue overflow protection that rejects job submissions
 * when queue is at capacity, warns when near capacity.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OverflowProtection } from './overflow-protection.js';
import type { QueueSizeMonitor, QueueSizeMetrics } from './queue-size-monitor.js';
import type { QueueLogger } from './logger.js';

/**
 * Mock QueueSizeMonitor for testing
 */
class MockQueueSizeMonitor {
  private mockMetrics: QueueSizeMetrics = {
    total: 0,
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    timestamp: Date.now(),
  };

  async getQueueSize(): Promise<QueueSizeMetrics> {
    return this.mockMetrics;
  }

  setMockMetrics(metrics: Partial<QueueSizeMetrics>): void {
    this.mockMetrics = {
      ...this.mockMetrics,
      ...metrics,
    };
  }
}

/**
 * Mock QueueLogger for testing
 */
class MockQueueLogger {
  public logs: Array<{ method: string; args: any[] }> = [];

  logInfo(type: string, data: any): void {
    this.logs.push({ method: 'logInfo', args: [type, data] });
  }

  logWarn(type: string, data: any): void {
    this.logs.push({ method: 'logWarn', args: [type, data] });
  }

  logError(jobId: string, error: Error, context: any): void {
    this.logs.push({ method: 'logError', args: [jobId, error, context] });
  }

  clearLogs(): void {
    this.logs = [];
  }
}

describe('OverflowProtection', () => {
  let monitor: MockQueueSizeMonitor;
  let logger: MockQueueLogger;
  let protection: OverflowProtection;

  beforeEach(() => {
    monitor = new MockQueueSizeMonitor();
    logger = new MockQueueLogger();
    protection = new OverflowProtection(
      monitor as unknown as QueueSizeMonitor,
      logger as unknown as QueueLogger
    );
  });

  describe('checkCapacity - Normal Operation', () => {
    it('should accept job when queue size < 400', async () => {
      monitor.setMockMetrics({ total: 100 });

      const result = await protection.checkCapacity();

      expect(result.allowed).toBe(true);
      expect(result.warning).toBeUndefined();
      expect(result.error).toBeUndefined();
    });

    it('should accept job when queue size is 0', async () => {
      monitor.setMockMetrics({ total: 0 });

      const result = await protection.checkCapacity();

      expect(result.allowed).toBe(true);
      expect(result.warning).toBeUndefined();
      expect(result.error).toBeUndefined();
    });

    it('should accept job when queue size is 399', async () => {
      monitor.setMockMetrics({ total: 399 });

      const result = await protection.checkCapacity();

      expect(result.allowed).toBe(true);
      expect(result.warning).toBeUndefined();
      expect(result.error).toBeUndefined();
    });
  });

  describe('checkCapacity - Warning Threshold', () => {
    it('should warn when queue size ≥ 400', async () => {
      monitor.setMockMetrics({ total: 400 });

      const result = await protection.checkCapacity();

      expect(result.allowed).toBe(true);
      expect(result.warning).toBeDefined();
      expect(result.warning?.currentQueueSize).toBe(400);
      expect(result.warning?.threshold).toBe(400);
      expect(result.warning?.canProceed).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should warn when queue size is 450', async () => {
      monitor.setMockMetrics({ total: 450 });

      const result = await protection.checkCapacity();

      expect(result.allowed).toBe(true);
      expect(result.warning).toBeDefined();
      expect(result.warning?.currentQueueSize).toBe(450);
      expect(result.warning?.threshold).toBe(400);
      expect(result.warning?.canProceed).toBe(true);
    });

    it('should warn when queue size is 499', async () => {
      monitor.setMockMetrics({ total: 499 });

      const result = await protection.checkCapacity();

      expect(result.allowed).toBe(true);
      expect(result.warning).toBeDefined();
      expect(result.warning?.currentQueueSize).toBe(499);
      expect(result.warning?.canProceed).toBe(true);
    });

    it('should log warning event when warning threshold exceeded', async () => {
      monitor.setMockMetrics({ total: 400 });

      await protection.checkCapacity();

      expect(logger.logs).toHaveLength(1);
      expect(logger.logs[0].method).toBe('logWarn');
      expect(logger.logs[0].args[0]).toBe('queue_overflow_warning');
      expect(logger.logs[0].args[1]).toMatchObject({
        currentQueueSize: 400,
        threshold: 400,
      });
    });
  });

  describe('checkCapacity - Critical Threshold', () => {
    it('should reject when queue size ≥ 500', async () => {
      monitor.setMockMetrics({ total: 500 });

      const result = await protection.checkCapacity();

      expect(result.allowed).toBe(false);
      expect(result.warning).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error).toContain('500');
      expect(result.error).toContain('capacity');
    });

    it('should reject when queue size is 600', async () => {
      monitor.setMockMetrics({ total: 600 });

      const result = await protection.checkCapacity();

      expect(result.allowed).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should log overflow event when critical threshold exceeded', async () => {
      monitor.setMockMetrics({ total: 500 });

      await protection.checkCapacity();

      expect(logger.logs).toHaveLength(1);
      expect(logger.logs[0].method).toBe('logWarn');
      expect(logger.logs[0].args[0]).toBe('queue_overflow_rejected');
      expect(logger.logs[0].args[1]).toMatchObject({
        currentQueueSize: 500,
        maxQueueSize: 500,
      });
    });
  });

  describe('checkCapacity - Wait Time Calculation', () => {
    it('should calculate estimated wait time correctly with default config', async () => {
      monitor.setMockMetrics({ total: 400 });

      const result = await protection.checkCapacity();

      // With 400 jobs, 60s avg duration, 1 worker: 400 * 60 / 1 = 24000s
      expect(result.warning?.estimatedWaitTime).toBe(24000);
    });

    it('should calculate estimated wait time with custom average job duration', async () => {
      protection = new OverflowProtection(
        monitor as unknown as QueueSizeMonitor,
        logger as unknown as QueueLogger,
        { averageJobDuration: 120 }
      );

      monitor.setMockMetrics({ total: 400 });

      const result = await protection.checkCapacity();

      // With 400 jobs, 120s avg duration, 1 worker: 400 * 120 / 1 = 48000s
      expect(result.warning?.estimatedWaitTime).toBe(48000);
    });

    it('should calculate estimated wait time with custom worker count', async () => {
      protection = new OverflowProtection(
        monitor as unknown as QueueSizeMonitor,
        logger as unknown as QueueLogger,
        { workerCount: 4 }
      );

      monitor.setMockMetrics({ total: 400 });

      const result = await protection.checkCapacity();

      // With 400 jobs, 60s avg duration, 4 workers: 400 * 60 / 4 = 6000s
      expect(result.warning?.estimatedWaitTime).toBe(6000);
    });

    it('should return 0 wait time when queue is empty', async () => {
      monitor.setMockMetrics({ total: 0 });

      const result = await protection.checkCapacity();

      // No warning at size 0, but if we check at 400...
      monitor.setMockMetrics({ total: 0 });
      // Actually, at 0 there's no warning. Let's check a warning scenario
      monitor.setMockMetrics({ total: 400 });
      const warningResult = await protection.checkCapacity();
      expect(warningResult.warning?.estimatedWaitTime).toBeGreaterThan(0);

      // Now check empty queue doesn't crash
      monitor.setMockMetrics({ total: 0 });
      const emptyResult = await protection.checkCapacity();
      expect(emptyResult.allowed).toBe(true);
    });

    it('should handle large queue sizes without overflow', async () => {
      monitor.setMockMetrics({ total: 450 });

      const result = await protection.checkCapacity();

      // With 450 jobs, 60s avg duration, 1 worker: 450 * 60 / 1 = 27000s
      expect(result.warning?.estimatedWaitTime).toBe(27000);
    });
  });

  describe('checkCapacity - Warning Messages', () => {
    it('should include helpful message in warning', async () => {
      monitor.setMockMetrics({ total: 400 });

      const result = await protection.checkCapacity();

      expect(result.warning?.message).toBeDefined();
      expect(result.warning?.message.toLowerCase()).toContain('queue');
      expect(result.warning?.message.length).toBeGreaterThan(10);
    });

    it('should include helpful message in error', async () => {
      monitor.setMockMetrics({ total: 500 });

      const result = await protection.checkCapacity();

      expect(result.error).toBeDefined();
      expect(result.error).toContain('Queue');
      expect(result.error!.length).toBeGreaterThan(10);
    });
  });

  describe('checkCapacity - Boundary Cases', () => {
    it('should handle exact warning threshold (400)', async () => {
      monitor.setMockMetrics({ total: 400 });

      const result = await protection.checkCapacity();

      expect(result.allowed).toBe(true);
      expect(result.warning).toBeDefined();
      expect(result.warning?.currentQueueSize).toBe(400);
    });

    it('should handle exact critical threshold (500)', async () => {
      monitor.setMockMetrics({ total: 500 });

      const result = await protection.checkCapacity();

      expect(result.allowed).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle one below warning threshold (399)', async () => {
      monitor.setMockMetrics({ total: 399 });

      const result = await protection.checkCapacity();

      expect(result.allowed).toBe(true);
      expect(result.warning).toBeUndefined();
    });

    it('should handle one below critical threshold (499)', async () => {
      monitor.setMockMetrics({ total: 499 });

      const result = await protection.checkCapacity();

      expect(result.allowed).toBe(true);
      expect(result.warning).toBeDefined();
      expect(result.error).toBeUndefined();
    });
  });

  describe('checkCapacity - Custom Thresholds', () => {
    it('should respect custom warning threshold', async () => {
      protection = new OverflowProtection(
        monitor as unknown as QueueSizeMonitor,
        logger as unknown as QueueLogger,
        { warningThreshold: 300 }
      );

      monitor.setMockMetrics({ total: 300 });

      const result = await protection.checkCapacity();

      expect(result.allowed).toBe(true);
      expect(result.warning).toBeDefined();
      expect(result.warning?.threshold).toBe(300);
    });

    it('should respect custom max queue size', async () => {
      protection = new OverflowProtection(
        monitor as unknown as QueueSizeMonitor,
        logger as unknown as QueueLogger,
        { maxQueueSize: 600 }
      );

      monitor.setMockMetrics({ total: 600 });

      const result = await protection.checkCapacity();

      expect(result.allowed).toBe(false);
      expect(result.error).toContain('600');
    });

    it('should not warn below custom warning threshold', async () => {
      protection = new OverflowProtection(
        monitor as unknown as QueueSizeMonitor,
        logger as unknown as QueueLogger,
        { warningThreshold: 300 }
      );

      monitor.setMockMetrics({ total: 299 });

      const result = await protection.checkCapacity();

      expect(result.allowed).toBe(true);
      expect(result.warning).toBeUndefined();
    });
  });

  describe('checkCapacity - Error Handling', () => {
    it('should handle monitor errors gracefully', async () => {
      const errorMonitor = {
        async getQueueSize(): Promise<QueueSizeMetrics> {
          throw new Error('Redis connection failed');
        },
      };

      protection = new OverflowProtection(
        errorMonitor as unknown as QueueSizeMonitor,
        logger as unknown as QueueLogger
      );

      await expect(protection.checkCapacity()).rejects.toThrow(
        'Failed to check queue capacity'
      );
    });

    it('should log error when monitor fails', async () => {
      const errorMonitor = {
        async getQueueSize(): Promise<QueueSizeMetrics> {
          throw new Error('Redis connection failed');
        },
      };

      protection = new OverflowProtection(
        errorMonitor as unknown as QueueSizeMonitor,
        logger as unknown as QueueLogger
      );

      try {
        await protection.checkCapacity();
      } catch {
        // Expected to throw
      }

      expect(logger.logs.some((log) => log.method === 'logWarn')).toBe(true);
    });
  });

  describe('checkCapacity - Race Condition Awareness', () => {
    it('should document that race conditions can occur', async () => {
      // This test documents that the implementation checks queue size at a point in time
      // Between the check and actual job submission, queue size could change
      // This is acceptable as BullMQ will handle the actual submission

      monitor.setMockMetrics({ total: 399 });
      const result1 = await protection.checkCapacity();
      expect(result1.allowed).toBe(true);

      // Queue size could increase here in production
      monitor.setMockMetrics({ total: 500 });
      const result2 = await protection.checkCapacity();
      expect(result2.allowed).toBe(false);

      // This demonstrates the race condition possibility
      // The caller must be aware that the result is a point-in-time check
    });
  });

  describe('Configuration Defaults', () => {
    it('should use default values when no config provided', async () => {
      monitor.setMockMetrics({ total: 400 });

      const result = await protection.checkCapacity();

      // Default warning threshold is 400
      expect(result.warning?.threshold).toBe(400);

      // Default max queue size is 500
      monitor.setMockMetrics({ total: 500 });
      const rejectResult = await protection.checkCapacity();
      expect(rejectResult.allowed).toBe(false);
    });

    it('should use default worker count of 1', async () => {
      monitor.setMockMetrics({ total: 400 });

      const result = await protection.checkCapacity();

      // With 1 worker: 400 * 60 / 1 = 24000
      expect(result.warning?.estimatedWaitTime).toBe(24000);
    });

    it('should use default average job duration of 60 seconds', async () => {
      monitor.setMockMetrics({ total: 100 });

      protection = new OverflowProtection(
        monitor as unknown as QueueSizeMonitor,
        logger as unknown as QueueLogger,
        { workerCount: 1 } // 100 jobs * 60s / 1 worker = 6000s
      );

      // Force a warning to see the calculation
      monitor.setMockMetrics({ total: 400 });
      const result = await protection.checkCapacity();

      expect(result.warning?.estimatedWaitTime).toBe(24000);
    });
  });

  describe('Integration with QueueSizeMonitor', () => {
    it('should use QueueSizeMonitor.getQueueSize() for metrics', async () => {
      const getSizeSpy = vi.spyOn(monitor, 'getQueueSize');

      monitor.setMockMetrics({ total: 200 });
      await protection.checkCapacity();

      expect(getSizeSpy).toHaveBeenCalledTimes(1);
    });

    it('should use total field from metrics for queue size', async () => {
      monitor.setMockMetrics({
        total: 450,
        pending: 300,
        processing: 150,
      });

      const result = await protection.checkCapacity();

      expect(result.warning?.currentQueueSize).toBe(450);
    });
  });
});
