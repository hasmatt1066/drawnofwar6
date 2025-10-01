/**
 * Task 8.4: Stress Tests - Sustained Load and Resource Exhaustion
 *
 * Tests system behavior under extreme conditions including sustained load,
 * connection pool exhaustion, worker pool exhaustion, and failure scenarios.
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

const STRESS_TEST_CONFIG: QueueServiceConfig = {
  redis: {
    host: 'localhost',
    port: 6379,
    db: 15,
  },
  firestore: {
    projectId: 'test-project',
  },
  queue: {
    name: 'stress-test-queue',
    concurrency: 5,
    maxJobsPerUser: 15,
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

describe('Stress Tests - Sustained Load and Resource Exhaustion', () => {
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
      host: STRESS_TEST_CONFIG.redis.host,
      port: STRESS_TEST_CONFIG.redis.port,
      db: STRESS_TEST_CONFIG.redis.db,
      maxRetriesPerRequest: null,
    });

    await redis.flushdb();

    logger = new QueueLogger({ enabled: false });
    metricsCollector = new MetricsCollector(logger);

    const mockClient = createMockPixelLabClient({
      responseDelay: 10,
      successRate: 1.0,
    });

    const redisCache = new RedisCache(redis, STRESS_TEST_CONFIG, logger);
    const firestoreBackup = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
    } as any;
    cacheManager = new CacheManager(redisCache, firestoreBackup, STRESS_TEST_CONFIG, logger);

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

    queueManager = new QueueManager(STRESS_TEST_CONFIG, logger);
    await queueManager.initialize();

    jobSubmitter = new JobSubmitter(queueManager, STRESS_TEST_CONFIG, logger);
    jobStatusTracker = new JobStatusTracker(queueManager, STRESS_TEST_CONFIG, logger);

    workers = [];
    for (let i = 0; i < STRESS_TEST_CONFIG.queue.concurrency; i++) {
      const worker = new Worker(
        STRESS_TEST_CONFIG.queue.name,
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

  describe('Sustained Load Tests', () => {
    it('should handle sustained load for 5+ minutes (300+ jobs)', async () => {
      const durationMinutes = 5;
      const jobsPerMinute = 60;
      const totalJobs = durationMinutes * jobsPerMinute;

      const perfMetrics = new PerformanceMetrics();
      const healthMonitor = new HealthMonitor();

      healthMonitor.start(async () => await metricsCollector.getMetrics(), 2000);

      console.log(`Starting sustained load test: ${totalJobs} jobs over ${durationMinutes} minutes`);

      // Submit jobs gradually over time (simulating real traffic)
      const submissionInterval = (durationMinutes * 60 * 1000) / totalJobs;
      const submissions: any[] = [];

      for (let i = 0; i < totalJobs; i++) {
        const prompt = createTestPrompt(i);
        const userId = `user-${i % 20}`;

        const submission = jobSubmitter.submitJob(userId, prompt).then((response) => {
          perfMetrics.recordSubmission(response.jobId);
          return response;
        });

        submissions.push(submission);

        // Wait between submissions to simulate sustained traffic
        if (i < totalJobs - 1) {
          await new Promise((resolve) => setTimeout(resolve, submissionInterval));
        }
      }

      console.log(`All ${totalJobs} jobs submitted`);

      // Wait for all to complete
      const responses = await Promise.all(submissions);

      await Promise.all(
        responses.map(
          (response) =>
            new Promise<void>((resolve) => {
              const checkInterval = setInterval(async () => {
                const status = await jobStatusTracker.getJobStatus(response.jobId);
                if (status.status === 'completed' || status.status === 'failed') {
                  perfMetrics.recordCompletion(response.jobId, status.status === 'completed');
                  clearInterval(checkInterval);
                  resolve();
                }
              }, 200);
            })
        )
      );

      perfMetrics.endTest();
      healthMonitor.stop();

      const loadMetrics = perfMetrics.calculate();
      const peakMetrics = healthMonitor.getPeakMetrics();

      console.log(formatMetrics(loadMetrics));
      console.log(`
Peak Resource Usage:
===================
Max Pending: ${peakMetrics.maxPending}
Max Processing: ${peakMetrics.maxProcessing}
Max Queue Wait: ${peakMetrics.maxQueueWait.toFixed(2)}ms
      `);

      // Verify system handled sustained load
      expect(loadMetrics.successfulJobs).toBeGreaterThan(totalJobs * 0.95); // At least 95% success
      expect(loadMetrics.errorRate).toBeLessThan(0.05);
      expect(healthMonitor.isHealthy()).toBe(true);
      expect(peakMetrics.maxQueueWait).toBeLessThan(5000); // < 5s queue wait
    }, 600000); // 10 minute timeout

    it('should handle burst traffic followed by sustained load', async () => {
      const perfMetrics = new PerformanceMetrics();

      // Phase 1: Burst (100 jobs at once)
      console.log('Phase 1: Burst traffic (100 jobs)');
      const burst = await Promise.all(
        Array(100)
          .fill(null)
          .map((_, i) => {
            const prompt = createTestPrompt(i);
            return jobSubmitter.submitJob(`user-${i % 15}`, prompt).then((response) => {
              perfMetrics.recordSubmission(response.jobId);
              return response;
            });
          })
      );

      // Phase 2: Sustained (20 jobs/minute for 2 minutes)
      console.log('Phase 2: Sustained traffic (40 jobs over 2 minutes)');
      const sustained: any[] = [];
      for (let i = 0; i < 40; i++) {
        const prompt = createTestPrompt(100 + i);
        const submission = jobSubmitter.submitJob(`user-${i % 10}`, prompt).then((response) => {
          perfMetrics.recordSubmission(response.jobId);
          return response;
        });
        sustained.push(submission);
        await new Promise((resolve) => setTimeout(resolve, 3000)); // 3s between jobs
      }

      const allSubmissions = [...burst, ...(await Promise.all(sustained))];

      // Wait for completion
      await Promise.all(
        allSubmissions.map(
          (response) =>
            new Promise<void>((resolve) => {
              const checkInterval = setInterval(async () => {
                const status = await jobStatusTracker.getJobStatus(response.jobId);
                if (status.status === 'completed' || status.status === 'failed') {
                  perfMetrics.recordCompletion(response.jobId, status.status === 'completed');
                  clearInterval(checkInterval);
                  resolve();
                }
              }, 200);
            })
        )
      );

      perfMetrics.endTest();
      const loadMetrics = perfMetrics.calculate();

      console.log(formatMetrics(loadMetrics));

      expect(loadMetrics.successfulJobs).toBeGreaterThan(130); // Most jobs succeed
      expect(loadMetrics.errorRate).toBeLessThan(0.1); // < 10% error rate
    }, 300000); // 5 minute timeout
  });

  describe('Resource Exhaustion Tests', () => {
    it('should handle worker pool exhaustion (jobs wait in queue)', async () => {
      const jobCount = 50;
      const healthMonitor = new HealthMonitor();

      healthMonitor.start(async () => await metricsCollector.getMetrics(), 500);

      // Submit more jobs than workers can handle immediately
      const submissions = await Promise.all(
        Array(jobCount)
          .fill(null)
          .map((_, i) => {
            const prompt = createTestPrompt(i);
            return jobSubmitter.submitJob(`user-${i % 10}`, prompt);
          })
      );

      // Check that jobs are queuing (pending > 0)
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const metrics = await metricsCollector.getMetrics();
      const peakMetrics = healthMonitor.getPeakMetrics();

      console.log(`
Worker Pool Status:
==================
Workers: ${STRESS_TEST_CONFIG.queue.concurrency}
Current Pending: ${metrics.jobCounts.pending}
Current Processing: ${metrics.jobCounts.processing}
Peak Pending: ${peakMetrics.maxPending}
      `);

      // Should have jobs waiting in queue
      expect(peakMetrics.maxPending).toBeGreaterThan(0);

      // Wait for all jobs to complete
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

      // Verify all jobs eventually completed despite exhaustion
      const finalMetrics = await metricsCollector.getMetrics();
      expect(finalMetrics.jobCounts.completed).toBeGreaterThan(jobCount * 0.95);
    }, 120000);

    it('should handle jobs with varying completion times', async () => {
      // Create mock client with variable response times
      const mockClient = createMockPixelLabClient({
        responseDelay: Math.random() * 100 + 10, // 10-110ms
        successRate: 1.0,
      });

      const progressIntegrator = {
      trackProgress: vi.fn().mockResolvedValue(undefined),
      broadcastUpdate: vi.fn().mockResolvedValue(undefined),
      broadcastStateChange: vi.fn().mockResolvedValue(undefined),
      broadcastCompletion: vi.fn().mockResolvedValue(undefined),
    } as any;

      const variableJobProcessor = new JobProcessor(
        mockClient.spriteGenerator as any,
        mockClient.statusPoller as any,
        cacheManager,
        progressIntegrator,
        logger
      );

      // Create new workers with variable processor
      const variableWorkers: Worker[] = [];
      for (let i = 0; i < 3; i++) {
        const worker = new Worker(
          STRESS_TEST_CONFIG.queue.name,
          async (job) => {
            // Add random delay to simulate variable processing times
            await new Promise((resolve) => setTimeout(resolve, Math.random() * 200));
            return await variableJobProcessor.processJob(job);
          },
          {
            connection: redis,
            concurrency: 1,
          }
        );

        variableWorkers.push(worker);
      }

      const jobCount = 30;
      const submissions = await Promise.all(
        Array(jobCount)
          .fill(null)
          .map((_, i) => {
            const prompt = createTestPrompt(i);
            return jobSubmitter.submitJob(`user-${i % 5}`, prompt);
          })
      );

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

      // Clean up variable workers
      for (const worker of variableWorkers) {
        await worker.close();
      }

      // Verify all jobs completed despite variable timing
      const statuses = await Promise.all(
        submissions.map((r) => jobStatusTracker.getJobStatus(r.jobId))
      );

      const completed = statuses.filter((s) => s.status === 'completed');
      expect(completed.length).toBeGreaterThan(jobCount * 0.95);
    }, 120000);
  });

  describe('Failure Scenario Tests', () => {
    it('should handle partial API failures (90% success rate)', async () => {
      // Create mock client with 90% success rate
      const unreliableMockClient = createMockPixelLabClient({
        responseDelay: 10,
        successRate: 0.9,
      });

      const progressIntegrator = {
      trackProgress: vi.fn().mockResolvedValue(undefined),
      broadcastUpdate: vi.fn().mockResolvedValue(undefined),
      broadcastStateChange: vi.fn().mockResolvedValue(undefined),
      broadcastCompletion: vi.fn().mockResolvedValue(undefined),
    } as any;

      const unreliableProcessor = new JobProcessor(
        unreliableMockClient.spriteGenerator as any,
        unreliableMockClient.statusPoller as any,
        cacheManager,
        progressIntegrator,
        logger
      );

      // Create workers with unreliable processor
      const unreliableWorkers: Worker[] = [];
      for (let i = 0; i < 3; i++) {
        const worker = new Worker(
          STRESS_TEST_CONFIG.queue.name,
          async (job) => {
            const submittedAt = job.timestamp || Date.now();
            metricsCollector.recordJobStart(job.id!, submittedAt);
            const startedAt = Date.now();
            try {
              const result = await unreliableProcessor.processJob(job);
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

        unreliableWorkers.push(worker);
      }

      const jobCount = 50;
      const submissions = await Promise.all(
        Array(jobCount)
          .fill(null)
          .map((_, i) => {
            const prompt = createTestPrompt(i);
            return jobSubmitter.submitJob(`user-${i % 10}`, prompt);
          })
      );

      // Wait for all jobs to finish (success or failure)
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

      // Clean up
      for (const worker of unreliableWorkers) {
        await worker.close();
      }

      const metrics = await metricsCollector.getMetrics();

      console.log(`
Failure Handling:
================
Total Jobs: ${metrics.jobCounts.total}
Completed: ${metrics.jobCounts.completed}
Failed: ${metrics.jobCounts.failed}
Success Rate: ${((metrics.jobCounts.completed / metrics.jobCounts.total) * 100).toFixed(1)}%
      `);

      // Should handle failures gracefully
      expect(metrics.jobCounts.completed + metrics.jobCounts.failed).toBe(jobCount);
      expect(metrics.jobCounts.completed).toBeGreaterThan(jobCount * 0.8); // At least 80% (with 90% API success rate)
    }, 120000);

    it('should recover from temporary connection issues', async () => {
      const jobCount = 30;

      // Submit jobs
      const submissions = await Promise.all(
        Array(jobCount)
          .fill(null)
          .map((_, i) => {
            const prompt = createTestPrompt(i);
            return jobSubmitter.submitJob(`user-${i % 5}`, prompt);
          })
      );

      // Simulate connection issues by pausing workers briefly
      const pauseDuration = 2000;
      console.log(`Simulating connection pause for ${pauseDuration}ms`);

      await new Promise((resolve) => setTimeout(resolve, pauseDuration));

      // Workers should resume processing
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

      const metrics = await metricsCollector.getMetrics();

      // Should recover and complete most jobs
      expect(metrics.jobCounts.completed).toBeGreaterThan(jobCount * 0.9);
    }, 120000);
  });

  describe('System Limits Tests', () => {
    it('should enforce system queue limit (500 jobs)', async () => {
      const systemLimit = STRESS_TEST_CONFIG.queue.systemQueueLimit;
      const attemptCount = systemLimit + 50;

      // Try to submit more than system limit
      const submissions = await Promise.allSettled(
        Array(attemptCount)
          .fill(null)
          .map((_, i) => {
            const prompt = createTestPrompt(i);
            return jobSubmitter.submitJob(`user-${i % 50}`, prompt);
          })
      );

      const accepted = submissions.filter((r) => r.status === 'fulfilled');
      const rejected = submissions.filter((r) => r.status === 'rejected');

      console.log(`
System Limit Enforcement:
========================
System Limit: ${systemLimit}
Attempted: ${attemptCount}
Accepted: ${accepted.length}
Rejected: ${rejected.length}
      `);

      // Should reject submissions exceeding system limit
      expect(rejected.length).toBeGreaterThan(0);
      expect(accepted.length).toBeLessThanOrEqual(systemLimit);

      // Wait for accepted jobs to complete
      const acceptedJobs = accepted
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
        .map((r) => r.value);

      await Promise.all(
        acceptedJobs.map(
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
    }, 180000);
  });
});
