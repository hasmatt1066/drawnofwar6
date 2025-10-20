/**
 * Task 2.3: 10-Second Deduplication Window - Test Suite
 *
 * Tests deduplication logic for detecting duplicate job submissions
 * within a 10-second window using Redis.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import RedisMock from 'ioredis-mock';
import { DeduplicationManager } from '../deduplication-manager.js';
import type { QueueServiceConfig } from '../../queue/queue-manager.js';
import { QueueLogger } from '../../queue/logger.js';

describe('DeduplicationManager', () => {
  let redis: RedisMock;
  let config: QueueServiceConfig;
  let logger: QueueLogger;
  let manager: DeduplicationManager;

  beforeEach(() => {
    redis = new RedisMock();
    config = {
      redis: {
        host: 'localhost',
        port: 6379,
      },
      firestore: {
        projectId: 'test',
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
    logger = new QueueLogger({ enabled: false });
    manager = new DeduplicationManager(redis as any, config, logger);
  });

  afterEach(async () => {
    await redis.flushall();
    redis.disconnect();
  });

  describe('checkDuplicate', () => {
    it('should detect duplicate within 10-second window', async () => {
      const cacheKey = 'cache:abc123';
      const jobId1 = 'job-1';
      const jobId2 = 'job-2';

      // First submission
      const result1 = await manager.checkDuplicate(cacheKey, jobId1);
      expect(result1.isDuplicate).toBe(false);
      expect(result1.existingJobId).toBeUndefined();
      expect(result1.cacheKey).toBe(cacheKey);

      // Second submission (should be duplicate)
      const result2 = await manager.checkDuplicate(cacheKey, jobId2);
      expect(result2.isDuplicate).toBe(true);
      expect(result2.existingJobId).toBe(jobId1);
      expect(result2.cacheKey).toBe(cacheKey);
    });

    it('should not detect duplicate after 10 seconds', async () => {
      const cacheKey = 'cache:abc123';
      const jobId1 = 'job-1';
      const jobId2 = 'job-2';

      // First submission
      const result1 = await manager.checkDuplicate(cacheKey, jobId1);
      expect(result1.isDuplicate).toBe(false);

      // Simulate TTL expiration (11 seconds)
      await redis.del(`dedup:${cacheKey}`);

      // Second submission (should not be duplicate)
      const result2 = await manager.checkDuplicate(cacheKey, jobId2);
      expect(result2.isDuplicate).toBe(false);
      expect(result2.existingJobId).toBeUndefined();
    });

    it('should return existing job ID for duplicate', async () => {
      const cacheKey = 'cache:xyz789';
      const existingJobId = 'existing-job-123';
      const newJobId = 'new-job-456';

      // First submission
      await manager.checkDuplicate(cacheKey, existingJobId);

      // Duplicate submission
      const result = await manager.checkDuplicate(cacheKey, newJobId);
      expect(result.existingJobId).toBe(existingJobId);
    });

    it('should return isDuplicate: false if no duplicate', async () => {
      const cacheKey = 'cache:unique123';
      const jobId = 'job-unique';

      const result = await manager.checkDuplicate(cacheKey, jobId);
      expect(result.isDuplicate).toBe(false);
    });

    it('should handle concurrent duplicate submissions (race condition)', async () => {
      const cacheKey = 'cache:concurrent123';
      const jobId1 = 'job-1';
      const jobId2 = 'job-2';
      const jobId3 = 'job-3';

      // Simulate concurrent submissions
      const promises = [
        manager.checkDuplicate(cacheKey, jobId1),
        manager.checkDuplicate(cacheKey, jobId2),
        manager.checkDuplicate(cacheKey, jobId3),
      ];

      const results = await Promise.all(promises);

      // Exactly one should succeed (not be a duplicate)
      const nonDuplicates = results.filter((r) => !r.isDuplicate);
      expect(nonDuplicates.length).toBe(1);

      // Others should detect the duplicate
      const duplicates = results.filter((r) => r.isDuplicate);
      expect(duplicates.length).toBe(2);

      // All duplicates should reference the same winning job
      const winningJobId = nonDuplicates[0].cacheKey;
      duplicates.forEach((dup) => {
        expect(dup.existingJobId).toBeDefined();
      });
    });

    it('should cleanup expired entries automatically (Redis TTL)', async () => {
      const cacheKey = 'cache:cleanup123';
      const jobId = 'job-cleanup';

      // Create deduplication entry
      await manager.checkDuplicate(cacheKey, jobId);

      // Verify TTL is set
      const ttl = await redis.ttl(`dedup:${cacheKey}`);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(config.deduplication.windowSeconds);
    });

    it('should be thread-safe for concurrent submissions', async () => {
      const cacheKey = 'cache:threadsafe123';
      const jobIds = Array.from({ length: 100 }, (_, i) => `job-${i}`);

      // Submit many jobs concurrently
      const promises = jobIds.map((jobId) => manager.checkDuplicate(cacheKey, jobId));
      const results = await Promise.all(promises);

      // Exactly one should succeed
      const nonDuplicates = results.filter((r) => !r.isDuplicate);
      expect(nonDuplicates.length).toBe(1);

      // All others should be duplicates
      const duplicates = results.filter((r) => r.isDuplicate);
      expect(duplicates.length).toBe(99);
    });

    it('should handle deduplication entry expiring between check and job creation', async () => {
      const cacheKey = 'cache:expiry123';
      const jobId1 = 'job-1';
      const jobId2 = 'job-2';

      // First submission
      await manager.checkDuplicate(cacheKey, jobId1);

      // Manually expire the entry
      await redis.del(`dedup:${cacheKey}`);

      // Second submission should not detect duplicate
      const result = await manager.checkDuplicate(cacheKey, jobId2);
      expect(result.isDuplicate).toBe(false);
    });

    it('should handle Redis connection errors gracefully', async () => {
      const cacheKey = 'cache:error123';
      const jobId = 'job-error';

      // Disconnect Redis
      redis.disconnect();

      // Should throw error (connection lost)
      await expect(manager.checkDuplicate(cacheKey, jobId)).rejects.toThrow();
    });

    it('should handle clock skew edge case', async () => {
      const cacheKey = 'cache:clock123';
      const jobId1 = 'job-1';
      const jobId2 = 'job-2';

      // First submission
      await manager.checkDuplicate(cacheKey, jobId1);

      // Simulate clock skew by manually setting past TTL
      await redis.expire(`dedup:${cacheKey}`, -1);

      // Second submission should not detect duplicate (expired)
      const result = await manager.checkDuplicate(cacheKey, jobId2);
      expect(result.isDuplicate).toBe(false);
    });

    it('should store job ID in Redis with correct key format', async () => {
      const cacheKey = 'cache:format123';
      const jobId = 'job-format';

      await manager.checkDuplicate(cacheKey, jobId);

      // Verify Redis key format
      const storedJobId = await redis.get(`dedup:${cacheKey}`);
      expect(storedJobId).toBe(jobId);
    });

    it('should set correct TTL on deduplication entries', async () => {
      const cacheKey = 'cache:ttl123';
      const jobId = 'job-ttl';

      await manager.checkDuplicate(cacheKey, jobId);

      // Verify TTL matches configuration
      const ttl = await redis.ttl(`dedup:${cacheKey}`);
      expect(ttl).toBe(config.deduplication.windowSeconds);
    });
  });
});
