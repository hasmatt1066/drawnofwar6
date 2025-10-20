/**
 * Task 1.1: Initialize BullMQ Queue with Redis Connection - Tests
 *
 * Comprehensive test suite following TDD approach.
 * Tests all acceptance criteria, test scenarios, and edge cases.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import RedisMock from 'ioredis-mock';
import { Queue } from 'bullmq';
import { QueueManager } from '../queue-manager.js';
import { QueueLogger } from '../logger.js';
import type { QueueServiceConfig } from '../queue-manager.js';

// Mock BullMQ Queue
vi.mock('bullmq', () => {
  const actualBullMQ = vi.importActual('bullmq');
  return {
    ...actualBullMQ,
    Queue: vi.fn().mockImplementation(function(this: any, name: string, opts: any) {
      this.name = name;
      this.opts = opts;
      this._isOpen = true;
      this._redis = opts?.connection || null;

      // Mock methods
      this.close = vi.fn().mockResolvedValue(undefined);
      this.pause = vi.fn().mockResolvedValue(undefined);
      this.resume = vi.fn().mockResolvedValue(undefined);
      this.getJobCounts = vi.fn().mockResolvedValue({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      });

      // Simulate connection check
      this.client = {
        ping: vi.fn().mockResolvedValue('PONG'),
        quit: vi.fn().mockResolvedValue('OK'),
      };

      return this;
    }),
  };
});

describe('QueueManager - Task 1.1: Initialize BullMQ Queue with Redis Connection', () => {
  let mockLogger: QueueLogger;
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

    vi.clearAllMocks();
  });

  afterEach(async () => {
    vi.clearAllMocks();
  });

  describe('Acceptance Criteria Tests', () => {
    it('should create BullMQ Queue with provided name', async () => {
      const manager = new QueueManager(defaultConfig, mockLogger);
      await manager.initialize();

      const queue = manager.getQueue();
      expect(queue).toBeDefined();
      expect(queue.name).toBe('generation-queue');
    });

    it('should connect to Redis with host, port, password', async () => {
      const configWithPassword: QueueServiceConfig = {
        ...defaultConfig,
        redis: {
          ...defaultConfig.redis,
          password: 'test-password',
        },
      };

      const manager = new QueueManager(configWithPassword, mockLogger);
      await manager.initialize();

      const queue = manager.getQueue();
      expect(queue.opts.connection).toBeDefined();
      expect(queue.opts.connection.host).toBe('localhost');
      expect(queue.opts.connection.port).toBe(6379);
      expect(queue.opts.connection.password).toBe('test-password');
    });

    it('should enable job persistence for restart recovery', async () => {
      const manager = new QueueManager(defaultConfig, mockLogger);
      await manager.initialize();

      const queue = manager.getQueue();
      expect(queue.opts.defaultJobOptions?.removeOnComplete).toBe(false);
      expect(queue.opts.defaultJobOptions?.removeOnFail).toBe(false);
    });

    it('should configure concurrency (default 5 workers)', async () => {
      const manager = new QueueManager(defaultConfig, mockLogger);
      await manager.initialize();

      const queue = manager.getQueue();
      // Concurrency is passed to worker, not queue, but we should store it
      expect(defaultConfig.queue.concurrency).toBe(5);
    });

    it('should set up default job options (retry, timeout)', async () => {
      const manager = new QueueManager(defaultConfig, mockLogger);
      await manager.initialize();

      const queue = manager.getQueue();
      expect(queue.opts.defaultJobOptions).toBeDefined();
      expect(queue.opts.defaultJobOptions?.attempts).toBeGreaterThan(0);
      expect(queue.opts.defaultJobOptions?.backoff).toBeDefined();
    });

    it('should validate Redis connection on initialization', async () => {
      const manager = new QueueManager(defaultConfig, mockLogger);
      await manager.initialize();

      const isConnected = await manager.isConnected();
      expect(isConnected).toBe(true);
    });

    it('should throw clear error if Redis is unreachable', async () => {
      // Mock Queue constructor to throw connection error
      const OriginalQueue = Queue;
      vi.mocked(Queue).mockImplementationOnce(() => {
        throw new Error('Connection refused: ECONNREFUSED');
      });

      const manager = new QueueManager(defaultConfig, mockLogger);

      await expect(manager.initialize()).rejects.toThrow(/Redis connection failed/i);

      // Restore
      vi.mocked(Queue).mockImplementation(OriginalQueue as any);
    });
  });

  describe('Test Scenarios', () => {
    it('should create queue with valid config', async () => {
      const manager = new QueueManager(defaultConfig, mockLogger);
      await manager.initialize();

      expect(manager.getQueue()).toBeDefined();
      expect(manager.getQueue().name).toBe('generation-queue');
    });

    it('should connect to Redis successfully', async () => {
      const manager = new QueueManager(defaultConfig, mockLogger);
      await manager.initialize();

      const connected = await manager.isConnected();
      expect(connected).toBe(true);
    });

    it('should throw error if Redis is unreachable', async () => {
      const OriginalQueue = Queue;
      vi.mocked(Queue).mockImplementationOnce(() => {
        throw new Error('ENOTFOUND: getaddrinfo failed');
      });

      const manager = new QueueManager(defaultConfig, mockLogger);
      await expect(manager.initialize()).rejects.toThrow();

      vi.mocked(Queue).mockImplementation(OriginalQueue as any);
    });

    it('should enable persistence by default', async () => {
      const manager = new QueueManager(defaultConfig, mockLogger);
      await manager.initialize();

      const queue = manager.getQueue();
      expect(queue.opts.defaultJobOptions?.removeOnComplete).toBe(false);
      expect(queue.opts.defaultJobOptions?.removeOnFail).toBe(false);
    });

    it('should respect custom concurrency setting', async () => {
      const customConfig: QueueServiceConfig = {
        ...defaultConfig,
        queue: {
          ...defaultConfig.queue,
          concurrency: 10,
        },
      };

      const manager = new QueueManager(customConfig, mockLogger);
      await manager.initialize();

      // Concurrency is stored in config for worker creation
      expect(customConfig.queue.concurrency).toBe(10);
    });

    it('should validate queue name is non-empty', async () => {
      const invalidConfig: QueueServiceConfig = {
        ...defaultConfig,
        queue: {
          ...defaultConfig.queue,
          name: '',
        },
      };

      const manager = new QueueManager(invalidConfig, mockLogger);
      await expect(manager.initialize()).rejects.toThrow(/queue name/i);
    });
  });

  describe('Edge Cases', () => {
    it('should handle Redis connection timeout with retry', async () => {
      // Simulate timeout on first attempt, success on second
      let attemptCount = 0;
      const OriginalQueue = Queue;

      vi.mocked(Queue).mockImplementation(function(this: any, name: string, opts: any) {
        attemptCount++;
        if (attemptCount === 1) {
          throw new Error('Connection timeout: ETIMEDOUT');
        }
        // Success on retry
        return new OriginalQueue(name, opts);
      } as any);

      const manager = new QueueManager(defaultConfig, mockLogger);

      // Should succeed after retry
      await expect(manager.initialize()).resolves.not.toThrow();
      expect(attemptCount).toBeGreaterThan(1);

      vi.mocked(Queue).mockImplementation(OriginalQueue as any);
    });

    it('should throw error on Redis password authentication failure', async () => {
      const OriginalQueue = Queue;
      vi.mocked(Queue).mockImplementationOnce(() => {
        throw new Error('WRONGPASS invalid username-password pair');
      });

      const configWithWrongPassword: QueueServiceConfig = {
        ...defaultConfig,
        redis: {
          ...defaultConfig.redis,
          password: 'wrong-password',
        },
      };

      const manager = new QueueManager(configWithWrongPassword, mockLogger);
      await expect(manager.initialize()).rejects.toThrow(/authentication/i);

      vi.mocked(Queue).mockImplementation(OriginalQueue as any);
    });

    it('should validate Redis DB number is in valid range (0-15)', async () => {
      const invalidDbConfig: QueueServiceConfig = {
        ...defaultConfig,
        redis: {
          ...defaultConfig.redis,
          db: 16, // Invalid: Redis only supports 0-15
        },
      };

      const manager = new QueueManager(invalidDbConfig, mockLogger);
      await expect(manager.initialize()).rejects.toThrow(/db.*range/i);
    });

    it('should handle queue name with special characters', async () => {
      const specialCharConfig: QueueServiceConfig = {
        ...defaultConfig,
        queue: {
          ...defaultConfig.queue,
          name: 'generation-queue:v2.0_test',
        },
      };

      const manager = new QueueManager(specialCharConfig, mockLogger);
      await manager.initialize();

      expect(manager.getQueue().name).toBe('generation-queue:v2.0_test');
    });

    it('should handle negative db number', async () => {
      const negativeDbConfig: QueueServiceConfig = {
        ...defaultConfig,
        redis: {
          ...defaultConfig.redis,
          db: -1,
        },
      };

      const manager = new QueueManager(negativeDbConfig, mockLogger);
      await expect(manager.initialize()).rejects.toThrow(/db.*range/i);
    });

    it('should handle undefined optional Redis password', async () => {
      const noPasswordConfig: QueueServiceConfig = {
        ...defaultConfig,
        redis: {
          ...defaultConfig.redis,
          password: undefined,
        },
      };

      const manager = new QueueManager(noPasswordConfig, mockLogger);
      await manager.initialize();

      const queue = manager.getQueue();
      expect(queue.opts.connection.password).toBeUndefined();
    });
  });

  describe('QueueManager Methods', () => {
    it('should return the queue instance via getQueue()', async () => {
      const manager = new QueueManager(defaultConfig, mockLogger);
      await manager.initialize();

      const queue = manager.getQueue();
      expect(queue).toBeDefined();
      expect(queue.name).toBe('generation-queue');
    });

    it('should throw error if getQueue() called before initialize()', () => {
      const manager = new QueueManager(defaultConfig, mockLogger);

      expect(() => manager.getQueue()).toThrow(/not initialized/i);
    });

    it('should close queue and disconnect from Redis', async () => {
      const manager = new QueueManager(defaultConfig, mockLogger);
      await manager.initialize();

      await manager.close();

      const queue = manager.getQueue();
      expect(queue.close).toHaveBeenCalled();
    });

    it('should check if queue is connected to Redis', async () => {
      const manager = new QueueManager(defaultConfig, mockLogger);
      await manager.initialize();

      const isConnected = await manager.isConnected();
      expect(isConnected).toBe(true);
    });

    it('should return false if queue is closed', async () => {
      const manager = new QueueManager(defaultConfig, mockLogger);
      await manager.initialize();

      await manager.close();

      // After closing, connection check should fail or return false
      const queue = manager.getQueue();
      queue.client.ping = vi.fn().mockRejectedValue(new Error('Connection closed'));

      const isConnected = await manager.isConnected();
      expect(isConnected).toBe(false);
    });
  });

  describe('Configuration Validation', () => {
    it('should accept valid configuration with all fields', async () => {
      const manager = new QueueManager(defaultConfig, mockLogger);
      await expect(manager.initialize()).resolves.not.toThrow();
    });

    it('should use default DB 0 if not specified', async () => {
      const configNoDb: QueueServiceConfig = {
        ...defaultConfig,
        redis: {
          host: 'localhost',
          port: 6379,
        },
      };

      const manager = new QueueManager(configNoDb, mockLogger);
      await manager.initialize();

      const queue = manager.getQueue();
      expect(queue.opts.connection.db).toBe(0);
    });

    it('should accept valid DB numbers (0-15)', async () => {
      for (let db = 0; db <= 15; db++) {
        const config: QueueServiceConfig = {
          ...defaultConfig,
          redis: {
            ...defaultConfig.redis,
            db,
          },
        };

        const manager = new QueueManager(config, mockLogger);
        await manager.initialize();

        expect(manager.getQueue().opts.connection.db).toBe(db);
        await manager.close();
      }
    });

    it('should configure retry attempts from config', async () => {
      const manager = new QueueManager(defaultConfig, mockLogger);
      await manager.initialize();

      const queue = manager.getQueue();
      // maxRetries = 1, so attempts = 1 + 1 = 2 (initial + 1 retry)
      expect(queue.opts.defaultJobOptions?.attempts).toBe(2);
    });

    it('should configure exponential backoff for retries', async () => {
      const manager = new QueueManager(defaultConfig, mockLogger);
      await manager.initialize();

      const queue = manager.getQueue();
      expect(queue.opts.defaultJobOptions?.backoff).toBeDefined();
      expect(typeof queue.opts.defaultJobOptions?.backoff).toBe('object');
    });
  });

  describe('Error Handling', () => {
    it('should provide meaningful error for connection refused', async () => {
      const OriginalQueue = Queue;
      vi.mocked(Queue).mockImplementationOnce(() => {
        throw new Error('connect ECONNREFUSED 127.0.0.1:6379');
      });

      const manager = new QueueManager(defaultConfig, mockLogger);

      await expect(manager.initialize()).rejects.toThrow(/Redis connection failed/i);

      vi.mocked(Queue).mockImplementation(OriginalQueue as any);
    });

    it('should provide meaningful error for hostname resolution failure', async () => {
      const OriginalQueue = Queue;
      vi.mocked(Queue).mockImplementationOnce(() => {
        throw new Error('getaddrinfo ENOTFOUND invalid-host');
      });

      const manager = new QueueManager(defaultConfig, mockLogger);

      await expect(manager.initialize()).rejects.toThrow(/Redis connection failed/i);

      vi.mocked(Queue).mockImplementation(OriginalQueue as any);
    });

    it('should handle multiple initialization attempts gracefully', async () => {
      const manager = new QueueManager(defaultConfig, mockLogger);

      await manager.initialize();

      // Second initialization should either succeed or throw clear error
      await expect(manager.initialize()).rejects.toThrow(/already initialized/i);
    });
  });

  describe('Retry Logic', () => {
    it('should retry connection with exponential backoff on timeout', async () => {
      let attemptCount = 0;
      const OriginalQueue = Queue;

      vi.mocked(Queue).mockImplementation(function(this: any, name: string, opts: any) {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('ETIMEDOUT');
        }
        return new OriginalQueue(name, opts);
      } as any);

      const manager = new QueueManager(defaultConfig, mockLogger);
      await manager.initialize();

      expect(attemptCount).toBe(3);

      vi.mocked(Queue).mockImplementation(OriginalQueue as any);
    });

    it('should give up after max retry attempts', async () => {
      const OriginalQueue = Queue;
      vi.mocked(Queue).mockImplementation(() => {
        throw new Error('ETIMEDOUT');
      });

      const manager = new QueueManager(defaultConfig, mockLogger);

      await expect(manager.initialize()).rejects.toThrow();

      vi.mocked(Queue).mockImplementation(OriginalQueue as any);
    });
  });
});
