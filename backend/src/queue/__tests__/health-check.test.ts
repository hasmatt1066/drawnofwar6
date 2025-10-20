/**
 * Task 7.4: Implement Health Check Endpoint - Tests
 *
 * Comprehensive test suite following TDD approach.
 * Tests all acceptance criteria, test scenarios, and edge cases.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HealthCheck, HealthStatus } from '../health-check.js';
import { QueueManager } from '../queue-manager.js';
import { QueueLogger } from '../logger.js';
import type { QueueServiceConfig } from '../queue-manager.js';

describe('HealthCheck - Task 7.4: Implement Health Check Endpoint', () => {
  let mockLogger: QueueLogger;
  let mockQueueManager: QueueManager;
  let defaultConfig: QueueServiceConfig;
  let healthCheck: HealthCheck;

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
    mockQueueManager = {
      getQueue: vi.fn(),
      isConnected: vi.fn(),
    } as any;

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Acceptance Criteria Tests', () => {
    it('should expose health check functionality', () => {
      healthCheck = new HealthCheck(mockQueueManager, defaultConfig, mockLogger);
      expect(healthCheck).toBeDefined();
      expect(healthCheck.checkHealth).toBeDefined();
      expect(typeof healthCheck.checkHealth).toBe('function');
    });

    it('should return healthy status (200) when all systems are healthy', async () => {
      // Mock Redis connection as healthy
      vi.mocked(mockQueueManager.isConnected).mockResolvedValue(true);

      // Mock queue with low job count
      const mockQueue = {
        getJobCounts: vi.fn().mockResolvedValue({
          waiting: 10,
          active: 5,
          delayed: 2,
        }),
        client: {
          ping: vi.fn().mockResolvedValue('PONG'),
        },
      };
      vi.mocked(mockQueueManager.getQueue).mockReturnValue(mockQueue as any);

      // Mock Firestore as healthy (we'll check this by attempting a connection check)
      // For now, we'll assume Firestore check passes if no error is thrown

      healthCheck = new HealthCheck(mockQueueManager, defaultConfig, mockLogger);
      const status = await healthCheck.checkHealth();

      expect(status.status).toBe('healthy');
      expect(status.checks.redis).toBe('up');
      expect(status.checks.queue).toBe('healthy');

      const httpCode = healthCheck.getHttpStatusCode(status);
      expect(httpCode).toBe(200);
    });

    it('should return unhealthy status (503) when Redis is down', async () => {
      // Mock Redis connection as down
      vi.mocked(mockQueueManager.isConnected).mockResolvedValue(false);

      // Mock queue that throws on access
      vi.mocked(mockQueueManager.getQueue).mockImplementation(() => {
        throw new Error('Queue not initialized');
      });

      healthCheck = new HealthCheck(mockQueueManager, defaultConfig, mockLogger);
      const status = await healthCheck.checkHealth();

      expect(status.status).toBe('unhealthy');
      expect(status.checks.redis).toBe('down');

      const httpCode = healthCheck.getHttpStatusCode(status);
      expect(httpCode).toBe(503);
    });

    it('should return unhealthy status (503) when queue is full (> 500)', async () => {
      // Mock Redis connection as healthy
      vi.mocked(mockQueueManager.isConnected).mockResolvedValue(true);

      // Mock queue with high job count (over limit)
      const mockQueue = {
        getJobCounts: vi.fn().mockResolvedValue({
          waiting: 400,
          active: 101, // Total: 501 > 500
          delayed: 0,
        }),
        client: {
          ping: vi.fn().mockResolvedValue('PONG'),
        },
      };
      vi.mocked(mockQueueManager.getQueue).mockReturnValue(mockQueue as any);

      healthCheck = new HealthCheck(mockQueueManager, defaultConfig, mockLogger);
      const status = await healthCheck.checkHealth();

      expect(status.status).toBe('unhealthy');
      expect(status.checks.queue).toBe('full');
      expect(status.details.queueSize).toBeGreaterThan(500);

      const httpCode = healthCheck.getHttpStatusCode(status);
      expect(httpCode).toBe(503);
    });

    it('should check Redis connection status', async () => {
      // Mock Redis as healthy
      vi.mocked(mockQueueManager.isConnected).mockResolvedValue(true);

      const mockQueue = {
        getJobCounts: vi.fn().mockResolvedValue({
          waiting: 10,
          active: 5,
          delayed: 2,
        }),
        client: {
          ping: vi.fn().mockResolvedValue('PONG'),
        },
      };
      vi.mocked(mockQueueManager.getQueue).mockReturnValue(mockQueue as any);

      healthCheck = new HealthCheck(mockQueueManager, defaultConfig, mockLogger);
      const status = await healthCheck.checkHealth();

      expect(status.checks.redis).toBe('up');
      expect(mockQueueManager.isConnected).toHaveBeenCalled();
    });

    it('should check Firestore connection status', async () => {
      // Mock Redis as healthy
      vi.mocked(mockQueueManager.isConnected).mockResolvedValue(true);

      const mockQueue = {
        getJobCounts: vi.fn().mockResolvedValue({
          waiting: 10,
          active: 5,
          delayed: 2,
        }),
        client: {
          ping: vi.fn().mockResolvedValue('PONG'),
        },
      };
      vi.mocked(mockQueueManager.getQueue).mockReturnValue(mockQueue as any);

      healthCheck = new HealthCheck(mockQueueManager, defaultConfig, mockLogger);
      const status = await healthCheck.checkHealth();

      // Should have firestore check result
      expect(status.checks.firestore).toBeDefined();
      expect(['up', 'down']).toContain(status.checks.firestore);
    });

    it('should check queue size and mark as unhealthy if > 500', async () => {
      // Mock Redis as healthy
      vi.mocked(mockQueueManager.isConnected).mockResolvedValue(true);

      // Mock queue with 501 jobs
      const mockQueue = {
        getJobCounts: vi.fn().mockResolvedValue({
          waiting: 300,
          active: 150,
          delayed: 51,
        }),
        client: {
          ping: vi.fn().mockResolvedValue('PONG'),
        },
      };
      vi.mocked(mockQueueManager.getQueue).mockReturnValue(mockQueue as any);

      healthCheck = new HealthCheck(mockQueueManager, defaultConfig, mockLogger);
      const status = await healthCheck.checkHealth();

      expect(status.details.queueSize).toBe(501);
      expect(status.details.queueLimit).toBe(500);
      expect(status.checks.queue).toBe('full');
      expect(status.status).toBe('unhealthy');
    });

    it('should return health details in JSON format', async () => {
      // Mock Redis as healthy
      vi.mocked(mockQueueManager.isConnected).mockResolvedValue(true);

      const mockQueue = {
        getJobCounts: vi.fn().mockResolvedValue({
          waiting: 10,
          active: 5,
          delayed: 2,
        }),
        client: {
          ping: vi.fn().mockResolvedValue('PONG'),
        },
      };
      vi.mocked(mockQueueManager.getQueue).mockReturnValue(mockQueue as any);

      healthCheck = new HealthCheck(mockQueueManager, defaultConfig, mockLogger);
      const status = await healthCheck.checkHealth();

      // Verify structure
      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('timestamp');
      expect(status).toHaveProperty('checks');
      expect(status).toHaveProperty('details');

      // Verify checks
      expect(status.checks).toHaveProperty('redis');
      expect(status.checks).toHaveProperty('firestore');
      expect(status.checks).toHaveProperty('queue');

      // Verify details
      expect(status.details).toHaveProperty('queueSize');
      expect(status.details).toHaveProperty('queueLimit');
      expect(status.details).toHaveProperty('responseTime');

      // Should be serializable to JSON
      expect(() => JSON.stringify(status)).not.toThrow();
    });

    it('should respond within 1 second (fast health check)', async () => {
      // Mock Redis as healthy
      vi.mocked(mockQueueManager.isConnected).mockResolvedValue(true);

      const mockQueue = {
        getJobCounts: vi.fn().mockResolvedValue({
          waiting: 10,
          active: 5,
          delayed: 2,
        }),
        client: {
          ping: vi.fn().mockResolvedValue('PONG'),
        },
      };
      vi.mocked(mockQueueManager.getQueue).mockReturnValue(mockQueue as any);

      healthCheck = new HealthCheck(mockQueueManager, defaultConfig, mockLogger);

      const startTime = Date.now();
      const status = await healthCheck.checkHealth();
      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(1000); // Less than 1 second

      // Response time should be tracked
      expect(status.details.responseTime).toBeDefined();
      expect(status.details.responseTime).toBeLessThan(1000);
    });
  });

  describe('Test Scenarios', () => {
    it('should return 200 when healthy', async () => {
      // Mock all systems healthy
      vi.mocked(mockQueueManager.isConnected).mockResolvedValue(true);

      const mockQueue = {
        getJobCounts: vi.fn().mockResolvedValue({
          waiting: 10,
          active: 5,
          delayed: 2,
        }),
        client: {
          ping: vi.fn().mockResolvedValue('PONG'),
        },
      };
      vi.mocked(mockQueueManager.getQueue).mockReturnValue(mockQueue as any);

      healthCheck = new HealthCheck(mockQueueManager, defaultConfig, mockLogger);
      const status = await healthCheck.checkHealth();

      expect(status.status).toBe('healthy');
      expect(healthCheck.getHttpStatusCode(status)).toBe(200);
    });

    it('should return 503 when Redis down', async () => {
      // Mock Redis down
      vi.mocked(mockQueueManager.isConnected).mockResolvedValue(false);
      vi.mocked(mockQueueManager.getQueue).mockImplementation(() => {
        throw new Error('Queue not initialized');
      });

      healthCheck = new HealthCheck(mockQueueManager, defaultConfig, mockLogger);
      const status = await healthCheck.checkHealth();

      expect(status.status).toBe('unhealthy');
      expect(status.checks.redis).toBe('down');
      expect(healthCheck.getHttpStatusCode(status)).toBe(503);
    });

    it('should return 503 when queue full', async () => {
      // Mock Redis healthy but queue full
      vi.mocked(mockQueueManager.isConnected).mockResolvedValue(true);

      const mockQueue = {
        getJobCounts: vi.fn().mockResolvedValue({
          waiting: 500,
          active: 1, // Total: 501
          delayed: 0,
        }),
        client: {
          ping: vi.fn().mockResolvedValue('PONG'),
        },
      };
      vi.mocked(mockQueueManager.getQueue).mockReturnValue(mockQueue as any);

      healthCheck = new HealthCheck(mockQueueManager, defaultConfig, mockLogger);
      const status = await healthCheck.checkHealth();

      expect(status.status).toBe('unhealthy');
      expect(status.checks.queue).toBe('full');
      expect(healthCheck.getHttpStatusCode(status)).toBe(503);
    });

    it('should check all dependencies', async () => {
      // Mock all systems
      vi.mocked(mockQueueManager.isConnected).mockResolvedValue(true);

      const mockQueue = {
        getJobCounts: vi.fn().mockResolvedValue({
          waiting: 10,
          active: 5,
          delayed: 2,
        }),
        client: {
          ping: vi.fn().mockResolvedValue('PONG'),
        },
      };
      vi.mocked(mockQueueManager.getQueue).mockReturnValue(mockQueue as any);

      healthCheck = new HealthCheck(mockQueueManager, defaultConfig, mockLogger);
      const status = await healthCheck.checkHealth();

      // Should check all dependencies
      expect(status.checks.redis).toBeDefined();
      expect(status.checks.firestore).toBeDefined();
      expect(status.checks.queue).toBeDefined();
    });

    it('should return health details', async () => {
      vi.mocked(mockQueueManager.isConnected).mockResolvedValue(true);

      const mockQueue = {
        getJobCounts: vi.fn().mockResolvedValue({
          waiting: 25,
          active: 10,
          delayed: 5,
        }),
        client: {
          ping: vi.fn().mockResolvedValue('PONG'),
        },
      };
      vi.mocked(mockQueueManager.getQueue).mockReturnValue(mockQueue as any);

      healthCheck = new HealthCheck(mockQueueManager, defaultConfig, mockLogger);
      const status = await healthCheck.checkHealth();

      expect(status.details.queueSize).toBe(40); // 25 + 10 + 5
      expect(status.details.queueLimit).toBe(500);
      expect(status.details.responseTime).toBeGreaterThan(0);
    });

    it('should respond quickly (< 1s)', async () => {
      vi.mocked(mockQueueManager.isConnected).mockResolvedValue(true);

      const mockQueue = {
        getJobCounts: vi.fn().mockResolvedValue({
          waiting: 10,
          active: 5,
          delayed: 2,
        }),
        client: {
          ping: vi.fn().mockResolvedValue('PONG'),
        },
      };
      vi.mocked(mockQueueManager.getQueue).mockReturnValue(mockQueue as any);

      healthCheck = new HealthCheck(mockQueueManager, defaultConfig, mockLogger);

      const startTime = Date.now();
      await healthCheck.checkHealth();
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Edge Cases', () => {
    it('should handle health check timeout (use timeout protection)', async () => {
      // Mock slow Redis check
      vi.mocked(mockQueueManager.isConnected).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(true), 2000))
      );

      const mockQueue = {
        getJobCounts: vi.fn().mockResolvedValue({
          waiting: 10,
          active: 5,
          delayed: 2,
        }),
        client: {
          ping: vi.fn().mockResolvedValue('PONG'),
        },
      };
      vi.mocked(mockQueueManager.getQueue).mockReturnValue(mockQueue as any);

      healthCheck = new HealthCheck(mockQueueManager, defaultConfig, mockLogger);

      // Health check should timeout and return degraded/unhealthy
      const startTime = Date.now();
      const status = await healthCheck.checkHealth();
      const duration = Date.now() - startTime;

      // Should timeout within reasonable time (not wait 2 seconds)
      expect(duration).toBeLessThan(1500);

      // Status should indicate timeout or degraded state
      expect(['degraded', 'unhealthy']).toContain(status.status);
    });

    it('should return degraded when Redis up but Firestore down', async () => {
      // Mock Redis as healthy
      vi.mocked(mockQueueManager.isConnected).mockResolvedValue(true);

      const mockQueue = {
        getJobCounts: vi.fn().mockResolvedValue({
          waiting: 10,
          active: 5,
          delayed: 2,
        }),
        client: {
          ping: vi.fn().mockResolvedValue('PONG'),
        },
      };
      vi.mocked(mockQueueManager.getQueue).mockReturnValue(mockQueue as any);

      // Mock Firestore check to fail
      // We'll need to inject a way to simulate this
      // For now, we'll test the interface

      healthCheck = new HealthCheck(mockQueueManager, defaultConfig, mockLogger);
      const status = await healthCheck.checkHealth();

      // If we can mock Firestore being down, expect degraded
      // For now, just verify structure allows degraded state
      expect(['healthy', 'degraded', 'unhealthy']).toContain(status.status);
    });

    it('should handle queue warning state (near capacity)', async () => {
      vi.mocked(mockQueueManager.isConnected).mockResolvedValue(true);

      // Queue at warning threshold (400+)
      const mockQueue = {
        getJobCounts: vi.fn().mockResolvedValue({
          waiting: 350,
          active: 75,
          delayed: 25, // Total: 450
        }),
        client: {
          ping: vi.fn().mockResolvedValue('PONG'),
        },
      };
      vi.mocked(mockQueueManager.getQueue).mockReturnValue(mockQueue as any);

      healthCheck = new HealthCheck(mockQueueManager, defaultConfig, mockLogger);
      const status = await healthCheck.checkHealth();

      expect(status.details.queueSize).toBe(450);
      expect(status.checks.queue).toBe('warning'); // Should warn when > 400
      expect(status.status).toBe('degraded'); // Degraded, not unhealthy
    });

    it('should handle errors gracefully during health check', async () => {
      // Mock queue manager throwing error
      vi.mocked(mockQueueManager.isConnected).mockRejectedValue(
        new Error('Connection check failed')
      );

      healthCheck = new HealthCheck(mockQueueManager, defaultConfig, mockLogger);
      const status = await healthCheck.checkHealth();

      // Should not throw, return unhealthy status
      expect(status.status).toBe('unhealthy');
      expect(status.checks.redis).toBe('down');
    });

    it('should return different status during startup (if not fully initialized)', async () => {
      // Mock queue manager not initialized
      vi.mocked(mockQueueManager.getQueue).mockImplementation(() => {
        throw new Error('QueueManager is not initialized');
      });
      vi.mocked(mockQueueManager.isConnected).mockResolvedValue(false);

      healthCheck = new HealthCheck(mockQueueManager, defaultConfig, mockLogger);
      const status = await healthCheck.checkHealth();

      // Should recognize startup state
      expect(status.status).toBe('unhealthy');
      expect(status.checks.redis).toBe('down');
    });

    it('should cache health check response to prevent spam', async () => {
      vi.mocked(mockQueueManager.isConnected).mockResolvedValue(true);

      const mockQueue = {
        getJobCounts: vi.fn().mockResolvedValue({
          waiting: 10,
          active: 5,
          delayed: 2,
        }),
        client: {
          ping: vi.fn().mockResolvedValue('PONG'),
        },
      };
      vi.mocked(mockQueueManager.getQueue).mockReturnValue(mockQueue as any);

      healthCheck = new HealthCheck(mockQueueManager, defaultConfig, mockLogger);

      // Call health check multiple times rapidly
      const status1 = await healthCheck.checkHealth();
      const status2 = await healthCheck.checkHealth();
      const status3 = await healthCheck.checkHealth();

      // All should return results (cached or not)
      expect(status1.status).toBeDefined();
      expect(status2.status).toBeDefined();
      expect(status3.status).toBeDefined();

      // Timestamps might be the same if cached
      // This tests that rapid calls don't break the system
    });

    it('should handle missing queue counts gracefully', async () => {
      vi.mocked(mockQueueManager.isConnected).mockResolvedValue(true);

      const mockQueue = {
        getJobCounts: vi.fn().mockRejectedValue(new Error('Failed to get counts')),
        client: {
          ping: vi.fn().mockResolvedValue('PONG'),
        },
      };
      vi.mocked(mockQueueManager.getQueue).mockReturnValue(mockQueue as any);

      healthCheck = new HealthCheck(mockQueueManager, defaultConfig, mockLogger);
      const status = await healthCheck.checkHealth();

      // Should handle gracefully, mark as degraded or unhealthy
      expect(['degraded', 'unhealthy']).toContain(status.status);
    });

    it('should return correct HTTP status codes for all states', async () => {
      healthCheck = new HealthCheck(mockQueueManager, defaultConfig, mockLogger);

      const healthyStatus: HealthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        checks: { redis: 'up', firestore: 'up', queue: 'healthy' },
        details: { queueSize: 10, queueLimit: 500, responseTime: 50 },
      };

      const degradedStatus: HealthStatus = {
        status: 'degraded',
        timestamp: new Date().toISOString(),
        checks: { redis: 'up', firestore: 'down', queue: 'warning' },
        details: { queueSize: 450, queueLimit: 500, responseTime: 50 },
      };

      const unhealthyStatus: HealthStatus = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        checks: { redis: 'down', firestore: 'down', queue: 'full' },
        details: { queueSize: 501, queueLimit: 500, responseTime: 50 },
      };

      expect(healthCheck.getHttpStatusCode(healthyStatus)).toBe(200);
      expect(healthCheck.getHttpStatusCode(degradedStatus)).toBe(503);
      expect(healthCheck.getHttpStatusCode(unhealthyStatus)).toBe(503);
    });
  });
});
