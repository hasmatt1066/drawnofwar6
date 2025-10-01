/**
 * Task 8.4: Performance Measurement Tests
 *
 * Detailed performance testing with metrics collection for throughput, latency,
 * cache efficiency, and resource utilization under various load patterns.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Redis from 'ioredis';
import { Worker } from 'bullmq';
import { QueueManager, QueueServiceConfig } from '../queue/queue-manager.js';
import { JobSubmitter } from '../queue/job-submitter.js';
import { JobProcessor } from '../queue/job-processor.js';
import { JobStatusTracker } from '../queue/job-status-tracker.js';
import { QueueLogger } from '../queue/logger.js';
import { CacheManager } from '../cache/cache-manager.js';
import { RedisCache } from '../cache/redis-cache.js';
import { MetricsCollector } from '../metrics/metrics-collector.js';
import { createMockPixelLabClient } from './mock-pixellab-client.js';
import {
  PerformanceMetrics,
  HealthMonitor,
  createTestPrompt,
  formatMetrics,
} from './test-utilities.js';

const PERF_TEST_CONFIG: QueueServiceConfig = {
  redis: {
    host: 'localhost',
    port: 6379,
    db: 15,
  },
  firestore: {
    projectId: 'test-project',
  },
  queue: {
    name: 'perf-test-queue',
    concurrency: 5,
    maxJobsPerUser: 20,
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

describe('Performance Measurement Tests', () => {
  let redis: Redis;
  let queueManager: QueueManager;
  let jobSubmitter: JobSubmitter;
  let jobStatusTracker: JobStatusTracker;
  let workers: Worker[];
  let logger: QueueLogger;
  let metricsCollector: MetricsCollector;
  let cacheManager: CacheManager;

  beforeEach(async () => {
    redis = new Redis({
      host: PERF_TEST_CONFIG.redis.host,
      port: PERF_TEST_CONFIG.redis.port,
      db: PERF_TEST_CONFIG.redis.db,
      maxRetriesPerRequest: null,
    });

    await redis.flushdb();

    logger = new QueueLogger({ enabled: false });
    metricsCollector = new MetricsCollector(logger);

    const mockClient = createMockPixelLabClient({
      responseDelay: 10,
      successRate: 1.0,
    });

    const redisCache = new RedisCache(redis, PERF_TEST_CONFIG, logger);
    const firestoreBackup = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
    } as any;
    cacheManager = new CacheManager(redisCache, firestoreBackup, PERF_TEST_CONFIG, logger);

    const progressIntegrator = {
      trackProgress: vi.fn().mockResolvedValue(undefined),
      broadcastUpdate: vi.fn().mockResolvedValue(undefined),
      broadcastStateChange: vi.fn().mockResolvedValue(undefined),
      broadcastCompletion: vi.fn().mockResolvedValue(undefined),
    } as any;

    const jobProcessor = new JobProcessor(
      mockClient.spriteGenerator as any,
      mockClient.statusPoller as any,
      cacheManager,
      progressIntegrator,
      logger
    );

    queueManager = new QueueManager(PERF_TEST_CONFIG, logger);
    await queueManager.initialize();

    jobSubmitter = new JobSubmitter(queueManager, PERF_TEST_CONFIG, logger);
    jobStatusTracker = new JobStatusTracker(queueManager, PERF_TEST_CONFIG, logger);

    workers = [];
    for (let i = 0; i < PERF_TEST_CONFIG.queue.concurrency; i++) {
      const worker = new Worker(
        PERF_TEST_CONFIG.queue.name,
        async (job) => {
          const submittedAt = job.timestamp || Date.now();
          metricsCollector.recordJobStart(job.id!, submittedAt);
          const startedAt = Date.now();
          try {
            const result = await jobProcessor.processJob(job);
            const completedAt = Date.now();
            metricsCollector.recordJobComplete(job.id!, startedAt, completedAt);
            return result;
          } catch (error) {
            metricsCollector.recordJobFailed(job.id!);
            throw error;
          }
        },
        {
          connection: redis,
          concurrency: 1,
        }
      );

      workers.push(worker);
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  afterEach(async () => {
    for (const worker of workers) {
      await worker.close();
    }
    await queueManager.close();
    await redis.quit();
  });

  describe('Throughput Measurement', () => {
    it('should measure throughput for 50 concurrent jobs', async () => {
      const jobCount = 50;
      const perfMetrics = new PerformanceMetrics();

      // Submit all jobs
      const submissions = await Promise.all(
        Array(jobCount)
          .fill(null)
          .map((_, i) => {
            const prompt = createTestPrompt(i);
            return jobSubmitter.submitJob(`user-${i % 10}`, prompt).then((response) => {
              perfMetrics.recordSubmission(response.jobId);
              return response;
            });
          })
      );

      // Wait for completion
      await Promise.all(
        submissions.map(
          (response) =>
            new Promise<void>((resolve) => {
              const checkInterval = setInterval(async () => {
                const status = await jobStatusTracker.getJobStatus(response.jobId);
                if (status.status === 'completed') {
                  perfMetrics.recordCompletion(response.jobId, true);
                  clearInterval(checkInterval);
                  resolve();
                } else if (status.status === 'failed') {
                  perfMetrics.recordCompletion(response.jobId, false);
                  clearInterval(checkInterval);
                  resolve();
                }
              }, 100);
            })
        )
      );

      perfMetrics.endTest();

      const queueMetrics = await metricsCollector.getMetrics();
      const loadMetrics = perfMetrics.calculate(
        queueMetrics.cache.hits,
        queueMetrics.cache.misses
      );

      console.log(formatMetrics(loadMetrics));

      // Performance assertions
      expect(loadMetrics.throughput).toBeGreaterThan(5); // ≥ 5 jobs/sec
      expect(loadMetrics.errorRate).toBe(0);
      expect(loadMetrics.successfulJobs).toBe(jobCount);

      // Log detailed metrics
      console.log(`
Throughput Analysis:
===================
Jobs/sec: ${loadMetrics.throughput.toFixed(2)}
Total Duration: ${(loadMetrics.totalDuration / 1000).toFixed(2)}s
Jobs Completed: ${loadMetrics.successfulJobs}
      `);
    }, 120000);

    it('should measure throughput for 100 jobs', async () => {
      const jobCount = 100;
      const perfMetrics = new PerformanceMetrics();

      const submissions = await Promise.all(
        Array(jobCount)
          .fill(null)
          .map((_, i) => {
            const prompt = createTestPrompt(i);
            return jobSubmitter.submitJob(`user-${i % 15}`, prompt).then((response) => {
              perfMetrics.recordSubmission(response.jobId);
              return response;
            });
          })
      );

      await Promise.all(
        submissions.map(
          (response) =>
            new Promise<void>((resolve) => {
              const checkInterval = setInterval(async () => {
                const status = await jobStatusTracker.getJobStatus(response.jobId);
                if (status.status === 'completed' || status.status === 'failed') {
                  perfMetrics.recordCompletion(
                    response.jobId,
                    status.status === 'completed'
                  );
                  clearInterval(checkInterval);
                  resolve();
                }
              }, 100);
            })
        )
      );

      perfMetrics.endTest();

      const queueMetrics = await metricsCollector.getMetrics();
      const loadMetrics = perfMetrics.calculate(
        queueMetrics.cache.hits,
        queueMetrics.cache.misses
      );

      console.log(formatMetrics(loadMetrics));

      expect(loadMetrics.throughput).toBeGreaterThan(4); // ≥ 4 jobs/sec for larger batch
      expect(loadMetrics.errorRate).toBeLessThan(0.05); // < 5% error rate
    }, 180000);
  });

  describe('Latency Measurement', () => {
    it('should measure job latency (submission → completion)', async () => {
      const jobCount = 50;
      const perfMetrics = new PerformanceMetrics();

      const submissions = await Promise.all(
        Array(jobCount)
          .fill(null)
          .map((_, i) => {
            const prompt = createTestPrompt(i);
            return jobSubmitter.submitJob(`user-${i % 10}`, prompt).then((response) => {
              perfMetrics.recordSubmission(response.jobId);
              return response;
            });
          })
      );

      await Promise.all(
        submissions.map(
          (response) =>
            new Promise<void>((resolve) => {
              const checkInterval = setInterval(async () => {
                const status = await jobStatusTracker.getJobStatus(response.jobId);
                if (status.status === 'completed' || status.status === 'failed') {
                  perfMetrics.recordCompletion(
                    response.jobId,
                    status.status === 'completed'
                  );
                  clearInterval(checkInterval);
                  resolve();
                }
              }, 100);
            })
        )
      );

      perfMetrics.endTest();
      const loadMetrics = perfMetrics.calculate();

      console.log(`
Latency Analysis:
================
Average: ${loadMetrics.averageLatency.toFixed(2)}ms
P95: ${loadMetrics.p95Latency.toFixed(2)}ms
P99: ${loadMetrics.p99Latency.toFixed(2)}ms
Min: ${loadMetrics.minLatency.toFixed(2)}ms
Max: ${loadMetrics.maxLatency.toFixed(2)}ms
      `);

      // Performance targets
      expect(loadMetrics.averageLatency).toBeLessThan(5000); // < 5s average
      expect(loadMetrics.p95Latency).toBeLessThan(10000); // < 10s P95
      expect(loadMetrics.p99Latency).toBeLessThan(15000); // < 15s P99
    }, 120000);

    it('should measure queue wait time (submission → processing start)', async () => {
      const jobCount = 50;
      const healthMonitor = new HealthMonitor();

      healthMonitor.start(async () => await metricsCollector.getMetrics(), 500);

      const submissions = await Promise.all(
        Array(jobCount)
          .fill(null)
          .map((_, i) => {
            const prompt = createTestPrompt(i);
            return jobSubmitter.submitJob(`user-${i % 10}`, prompt);
          })
      );

      await Promise.all(
        submissions.map(
          (response) =>
            new Promise<void>((resolve) => {
              const checkInterval = setInterval(async () => {
                const status = await jobStatusTracker.getJobStatus(response.jobId);
                if (status.status === 'completed' || status.status === 'failed') {
                  clearInterval(checkInterval);
                  resolve();
                }
              }, 100);
            })
        )
      );

      healthMonitor.stop();

      const peakMetrics = healthMonitor.getPeakMetrics();
      const queueMetrics = await metricsCollector.getMetrics();

      console.log(`
Queue Wait Time Analysis:
========================
Average Wait: ${queueMetrics.queueWaitTime.average.toFixed(2)}ms
P95 Wait: ${queueMetrics.queueWaitTime.p95.toFixed(2)}ms
Peak Wait: ${peakMetrics.maxQueueWait.toFixed(2)}ms
      `);

      // Performance target: sub-second wait time
      expect(queueMetrics.queueWaitTime.average).toBeLessThan(1000);
      expect(peakMetrics.maxQueueWait).toBeLessThan(2000);
    }, 120000);
  });

  describe('Cache Efficiency Under Load', () => {
    it('should measure cache hit rate with duplicate requests', async () => {
      // Phase 1: Submit unique jobs (populate cache)
      const uniqueCount = 20;
      const submissions1 = await Promise.all(
        Array(uniqueCount)
          .fill(null)
          .map((_, i) => {
            const prompt = createTestPrompt(i);
            return jobSubmitter.submitJob(`user-${i % 5}`, prompt);
          })
      );

      await Promise.all(
        submissions1.map(
          (response) =>
            new Promise<void>((resolve) => {
              const checkInterval = setInterval(async () => {
                const status = await jobStatusTracker.getJobStatus(response.jobId);
                if (status.status === 'completed' || status.status === 'failed') {
                  clearInterval(checkInterval);
                  resolve();
                }
              }, 100);
            })
        )
      );

      // Phase 2: Submit duplicates (should hit cache)
      const duplicateCount = 40;
      const submissions2 = await Promise.all(
        Array(duplicateCount)
          .fill(null)
          .map((_, i) => {
            const prompt = createTestPrompt(i % uniqueCount); // Reuse prompts
            return jobSubmitter.submitJob(`user-${i % 5}`, prompt);
          })
      );

      await Promise.all(
        submissions2.map(
          (response) =>
            new Promise<void>((resolve) => {
              const checkInterval = setInterval(async () => {
                const status = await jobStatusTracker.getJobStatus(response.jobId);
                if (status.status === 'completed' || status.status === 'failed') {
                  clearInterval(checkInterval);
                  resolve();
                }
              }, 100);
            })
        )
      );

      const metrics = await metricsCollector.getMetrics();

      console.log(`
Cache Performance:
=================
Total Requests: ${metrics.cache.totalRequests}
Cache Hits: ${metrics.cache.hits}
Cache Misses: ${metrics.cache.misses}
Hit Rate: ${(metrics.cache.hitRate * 100).toFixed(1)}%
      `);

      // Should have high cache hit rate
      expect(metrics.cache.hitRate).toBeGreaterThan(0.5); // ≥ 50% hit rate
      expect(metrics.cache.hits).toBeGreaterThan(uniqueCount); // At least as many hits as unique jobs
    }, 120000);

    it('should measure cache performance impact on latency', async () => {
      const perfMetrics1 = new PerformanceMetrics();
      const perfMetrics2 = new PerformanceMetrics();

      // Scenario 1: All cache misses (unique requests)
      const uniqueCount = 25;
      const submissions1 = await Promise.all(
        Array(uniqueCount)
          .fill(null)
          .map((_, i) => {
            const prompt = createTestPrompt(i);
            return jobSubmitter.submitJob(`user-${i % 5}`, prompt).then((response) => {
              perfMetrics1.recordSubmission(response.jobId);
              return response;
            });
          })
      );

      await Promise.all(
        submissions1.map(
          (response) =>
            new Promise<void>((resolve) => {
              const checkInterval = setInterval(async () => {
                const status = await jobStatusTracker.getJobStatus(response.jobId);
                if (status.status === 'completed' || status.status === 'failed') {
                  perfMetrics1.recordCompletion(response.jobId, status.status === 'completed');
                  clearInterval(checkInterval);
                  resolve();
                }
              }, 100);
            })
        )
      );

      perfMetrics1.endTest();

      // Scenario 2: All cache hits (duplicate requests)
      const duplicateCount = 25;
      const submissions2 = await Promise.all(
        Array(duplicateCount)
          .fill(null)
          .map((_, i) => {
            const prompt = createTestPrompt(i % uniqueCount); // Reuse
            return jobSubmitter.submitJob(`user-${i % 5}`, prompt).then((response) => {
              perfMetrics2.recordSubmission(response.jobId);
              return response;
            });
          })
      );

      await Promise.all(
        submissions2.map(
          (response) =>
            new Promise<void>((resolve) => {
              const checkInterval = setInterval(async () => {
                const status = await jobStatusTracker.getJobStatus(response.jobId);
                if (status.status === 'completed' || status.status === 'failed') {
                  perfMetrics2.recordCompletion(response.jobId, status.status === 'completed');
                  clearInterval(checkInterval);
                  resolve();
                }
              }, 100);
            })
        )
      );

      perfMetrics2.endTest();

      const metrics1 = perfMetrics1.calculate();
      const metrics2 = perfMetrics2.calculate();

      console.log(`
Cache Impact on Latency:
=======================
Cache Miss Latency (avg): ${metrics1.averageLatency.toFixed(2)}ms
Cache Hit Latency (avg): ${metrics2.averageLatency.toFixed(2)}ms
Improvement: ${((metrics1.averageLatency - metrics2.averageLatency) / metrics1.averageLatency * 100).toFixed(1)}%
      `);

      // Cache hits should be faster or similar (due to deduplication)
      expect(metrics2.averageLatency).toBeLessThanOrEqual(metrics1.averageLatency * 1.2); // Within 20%
    }, 180000);
  });

  describe('Resource Utilization', () => {
    it('should monitor active workers and queue size under load', async () => {
      const healthMonitor = new HealthMonitor();
      healthMonitor.start(async () => await metricsCollector.getMetrics(), 500);

      // Submit jobs in waves
      for (let wave = 0; wave < 3; wave++) {
        await Promise.all(
          Array(30)
            .fill(null)
            .map((_, i) => {
              const prompt = createTestPrompt(wave * 30 + i);
              return jobSubmitter.submitJob(`user-${i % 10}`, prompt);
            })
        );

        await new Promise((resolve) => setTimeout(resolve, 3000));
      }

      // Wait for queue to drain
      await new Promise((resolve) => setTimeout(resolve, 10000));

      healthMonitor.stop();

      const samples = healthMonitor.getSamples();
      const peakMetrics = healthMonitor.getPeakMetrics();

      console.log(`
Resource Utilization:
====================
Peak Pending Jobs: ${peakMetrics.maxPending}
Peak Processing Jobs: ${peakMetrics.maxProcessing}
Samples Collected: ${samples.length}
      `);

      // Verify reasonable resource usage
      expect(peakMetrics.maxPending).toBeLessThan(100);
      expect(peakMetrics.maxProcessing).toBeLessThanOrEqual(PERF_TEST_CONFIG.queue.concurrency);
    }, 120000);

    it('should measure active users during concurrent load', async () => {
      const userCount = 20;
      const jobsPerUser = 5;

      const submissions = await Promise.all(
        Array(userCount)
          .fill(null)
          .flatMap((_, userId) =>
            Array(jobsPerUser)
              .fill(null)
              .map((__, jobIndex) => {
                const prompt = createTestPrompt(userId * jobsPerUser + jobIndex);
                return jobSubmitter.submitJob(`user-${userId}`, prompt);
              })
          )
      );

      // Check active users while jobs are processing
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const metrics = await metricsCollector.getMetrics();

      console.log(`
Active Users:
============
Active Users: ${metrics.activeUsers}
Expected Users: ${userCount}
      `);

      // Should track multiple active users
      expect(metrics.activeUsers).toBeGreaterThan(0);
      expect(metrics.activeUsers).toBeLessThanOrEqual(userCount);

      // Wait for completion
      await Promise.all(
        submissions.map(
          (response) =>
            new Promise<void>((resolve) => {
              const checkInterval = setInterval(async () => {
                const status = await jobStatusTracker.getJobStatus(response.jobId);
                if (status.status === 'completed' || status.status === 'failed') {
                  clearInterval(checkInterval);
                  resolve();
                }
              }, 100);
            })
        )
      );
    }, 120000);
  });
});
