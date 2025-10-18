import { describe, it, expect, beforeEach } from 'vitest';
import { QuotaTracker, QuotaTrackerConfig } from './quota-tracker';

describe('Quota Tracker - Task 6.3: Track Cumulative Credit Usage', () => {
  describe('credit tracking', () => {
    it('should start with zero credits used', () => {
      const tracker = new QuotaTracker();

      expect(tracker.getCreditsUsed()).toBe(0);
    });

    it('should track credits used for single request', () => {
      const tracker = new QuotaTracker();

      tracker.trackUsage(10);

      expect(tracker.getCreditsUsed()).toBe(10);
    });

    it('should accumulate credits across multiple requests', () => {
      const tracker = new QuotaTracker();

      tracker.trackUsage(5);
      tracker.trackUsage(10);
      tracker.trackUsage(15);

      expect(tracker.getCreditsUsed()).toBe(30);
    });

    it('should handle fractional credits', () => {
      const tracker = new QuotaTracker();

      tracker.trackUsage(2.5);
      tracker.trackUsage(3.7);

      expect(tracker.getCreditsUsed()).toBe(6.2);
    });

    it('should ignore zero credit usage', () => {
      const tracker = new QuotaTracker();

      tracker.trackUsage(10);
      tracker.trackUsage(0);

      expect(tracker.getCreditsUsed()).toBe(10);
    });

    it('should ignore negative credit values', () => {
      const tracker = new QuotaTracker();

      tracker.trackUsage(10);
      tracker.trackUsage(-5); // Should be ignored

      expect(tracker.getCreditsUsed()).toBe(10);
    });
  });

  describe('reset tracking', () => {
    it('should reset credits to zero', () => {
      const tracker = new QuotaTracker();

      tracker.trackUsage(50);
      tracker.reset();

      expect(tracker.getCreditsUsed()).toBe(0);
    });

    it('should allow tracking after reset', () => {
      const tracker = new QuotaTracker();

      tracker.trackUsage(25);
      tracker.reset();
      tracker.trackUsage(15);

      expect(tracker.getCreditsUsed()).toBe(15);
    });
  });

  describe('quota limit tracking', () => {
    it('should track remaining quota when limit is set', () => {
      const tracker = new QuotaTracker({ quotaLimit: 100 });

      expect(tracker.getRemainingQuota()).toBe(100);

      tracker.trackUsage(30);
      expect(tracker.getRemainingQuota()).toBe(70);

      tracker.trackUsage(20);
      expect(tracker.getRemainingQuota()).toBe(50);
    });

    it('should return undefined for remaining quota when no limit', () => {
      const tracker = new QuotaTracker();

      expect(tracker.getRemainingQuota()).toBeUndefined();
    });

    it('should handle quota exceeded scenario', () => {
      const tracker = new QuotaTracker({ quotaLimit: 50 });

      tracker.trackUsage(60);

      expect(tracker.getCreditsUsed()).toBe(60);
      expect(tracker.getRemainingQuota()).toBe(-10);
      expect(tracker.isQuotaExceeded()).toBe(true);
    });

    it('should check if quota is exceeded', () => {
      const tracker = new QuotaTracker({ quotaLimit: 100 });

      tracker.trackUsage(50);
      expect(tracker.isQuotaExceeded()).toBe(false);

      tracker.trackUsage(50);
      expect(tracker.isQuotaExceeded()).toBe(false); // Exactly at limit

      tracker.trackUsage(1);
      expect(tracker.isQuotaExceeded()).toBe(true);
    });

    it('should return false for isQuotaExceeded when no limit', () => {
      const tracker = new QuotaTracker();

      tracker.trackUsage(1000000);
      expect(tracker.isQuotaExceeded()).toBe(false);
    });
  });

  describe('threshold warnings', () => {
    it('should emit warning when threshold reached (90%)', () => {
      const warnings: string[] = [];
      const tracker = new QuotaTracker({
        quotaLimit: 100,
        warningThreshold: 0.9,
        onWarning: (message) => warnings.push(message),
      });

      tracker.trackUsage(50);
      expect(warnings).toHaveLength(0);

      tracker.trackUsage(40); // 90% used
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('90%');
      expect(warnings[0]).toContain('quota');
    });

    it('should emit warning only once at threshold', () => {
      const warnings: string[] = [];
      const tracker = new QuotaTracker({
        quotaLimit: 100,
        warningThreshold: 0.9,
        onWarning: (message) => warnings.push(message),
      });

      tracker.trackUsage(90);
      expect(warnings).toHaveLength(1);

      // Additional usage should not trigger more warnings
      tracker.trackUsage(5);
      tracker.trackUsage(5);
      expect(warnings).toHaveLength(1);
    });

    it('should use default threshold of 90% if not provided', () => {
      const warnings: string[] = [];
      const tracker = new QuotaTracker({
        quotaLimit: 100,
        onWarning: (message) => warnings.push(message),
      });

      tracker.trackUsage(89);
      expect(warnings).toHaveLength(0);

      tracker.trackUsage(1); // 90%
      expect(warnings).toHaveLength(1);
    });

    it('should support custom warning threshold', () => {
      const warnings: string[] = [];
      const tracker = new QuotaTracker({
        quotaLimit: 100,
        warningThreshold: 0.8, // 80%
        onWarning: (message) => warnings.push(message),
      });

      tracker.trackUsage(79);
      expect(warnings).toHaveLength(0);

      tracker.trackUsage(1); // 80%
      expect(warnings).toHaveLength(1);
    });

    it('should reset warning flag on reset', () => {
      const warnings: string[] = [];
      const tracker = new QuotaTracker({
        quotaLimit: 100,
        warningThreshold: 0.9,
        onWarning: (message) => warnings.push(message),
      });

      tracker.trackUsage(90);
      expect(warnings).toHaveLength(1);

      tracker.reset();
      tracker.trackUsage(90);
      expect(warnings).toHaveLength(2); // Warning should trigger again
    });

    it('should not emit warnings when no onWarning callback', () => {
      const tracker = new QuotaTracker({
        quotaLimit: 100,
        warningThreshold: 0.9,
      });

      // Should not throw error
      tracker.trackUsage(90);
      expect(tracker.getCreditsUsed()).toBe(90);
    });

    it('should not emit warnings when no quota limit', () => {
      const warnings: string[] = [];
      const tracker = new QuotaTracker({
        onWarning: (message) => warnings.push(message),
      });

      tracker.trackUsage(1000000);
      expect(warnings).toHaveLength(0);
    });
  });

  describe('usage statistics', () => {
    it('should track request count', () => {
      const tracker = new QuotaTracker();

      expect(tracker.getRequestCount()).toBe(0);

      tracker.trackUsage(10);
      tracker.trackUsage(20);
      tracker.trackUsage(5);

      expect(tracker.getRequestCount()).toBe(3);
    });

    it('should calculate average credits per request', () => {
      const tracker = new QuotaTracker();

      tracker.trackUsage(10);
      tracker.trackUsage(20);
      tracker.trackUsage(30);

      expect(tracker.getAverageCreditsPerRequest()).toBe(20);
    });

    it('should return 0 for average when no requests', () => {
      const tracker = new QuotaTracker();

      expect(tracker.getAverageCreditsPerRequest()).toBe(0);
    });

    it('should get usage summary', () => {
      const tracker = new QuotaTracker({ quotaLimit: 100 });

      tracker.trackUsage(15);
      tracker.trackUsage(25);

      const summary = tracker.getUsageSummary();

      expect(summary.creditsUsed).toBe(40);
      expect(summary.requestCount).toBe(2);
      expect(summary.averagePerRequest).toBe(20);
      expect(summary.quotaLimit).toBe(100);
      expect(summary.remainingQuota).toBe(60);
      expect(summary.percentageUsed).toBe(40);
    });

    it('should handle summary when no quota limit', () => {
      const tracker = new QuotaTracker();

      tracker.trackUsage(50);

      const summary = tracker.getUsageSummary();

      expect(summary.creditsUsed).toBe(50);
      expect(summary.quotaLimit).toBeUndefined();
      expect(summary.remainingQuota).toBeUndefined();
      expect(summary.percentageUsed).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle very large credit values', () => {
      const tracker = new QuotaTracker();

      tracker.trackUsage(Number.MAX_SAFE_INTEGER / 2);
      tracker.trackUsage(Number.MAX_SAFE_INTEGER / 2);

      expect(tracker.getCreditsUsed()).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should handle many small requests', () => {
      const tracker = new QuotaTracker();

      for (let i = 0; i < 10000; i++) {
        tracker.trackUsage(0.1);
      }

      expect(tracker.getRequestCount()).toBe(10000);
      expect(tracker.getCreditsUsed()).toBeCloseTo(1000, 1);
    });

    it('should validate quota limit is positive', () => {
      expect(() => {
        new QuotaTracker({ quotaLimit: -100 });
      }).toThrow('Quota limit must be positive');
    });

    it('should validate warning threshold is between 0 and 1', () => {
      expect(() => {
        new QuotaTracker({ quotaLimit: 100, warningThreshold: 1.5 });
      }).toThrow('Warning threshold must be between 0 and 1');

      expect(() => {
        new QuotaTracker({ quotaLimit: 100, warningThreshold: -0.1 });
      }).toThrow('Warning threshold must be between 0 and 1');
    });
  });
});
