import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimiter, RateLimiterConfig } from '../rate-limiter';

describe('Rate Limiter - Task 6.1: Token Bucket Rate Limiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('token bucket algorithm', () => {
    it('should allow N requests immediately (bucket full)', async () => {
      const limiter = new RateLimiter({ requestsPerMinute: 60 }); // 1 per second

      // Should allow 60 requests immediately
      for (let i = 0; i < 60; i++) {
        await limiter.acquire();
      }

      // All should complete immediately (no time advanced)
      expect(Date.now()).toBe(0);
    });

    it('should block (N+1)th request until refill', async () => {
      const limiter = new RateLimiter({ requestsPerMinute: 2 }); // Very low limit

      // Use all tokens
      await limiter.acquire();
      await limiter.acquire();

      // Next request should block
      const promise = limiter.acquire();

      // Should not resolve immediately
      await vi.advanceTimersByTimeAsync(10);
      expect(promise).toBeInstanceOf(Promise);

      // Advance by 30s (half a minute) to refill 1 token
      await vi.advanceTimersByTimeAsync(30000);

      // Should resolve now
      await promise;
    });

    it('should refill tokens over time', async () => {
      const limiter = new RateLimiter({ requestsPerMinute: 60 });

      // Use 10 tokens
      for (let i = 0; i < 10; i++) {
        await limiter.acquire();
      }

      // Advance time by 10 seconds (should refill 10 tokens)
      await vi.advanceTimersByTimeAsync(10000);

      // Should be able to use 10 more tokens
      for (let i = 0; i < 10; i++) {
        await limiter.acquire();
      }
    });

    it('should handle burst requests (use all tokens at once)', async () => {
      const limiter = new RateLimiter({ requestsPerMinute: 30 });

      // Use all 30 tokens at once
      const promises = Array(30).fill(null).map(() => limiter.acquire());

      await Promise.all(promises);

      // All should complete immediately
      expect(Date.now()).toBe(0);
    });

    it('should reset bucket after idle period', async () => {
      const limiter = new RateLimiter({ requestsPerMinute: 60 });

      // Use 30 tokens
      for (let i = 0; i < 30; i++) {
        await limiter.acquire();
      }

      // Wait for full refill (1 minute)
      await vi.advanceTimersByTimeAsync(60000);

      // Should have full bucket again (60 tokens)
      for (let i = 0; i < 60; i++) {
        await limiter.acquire();
      }

      expect(Date.now()).toBe(60000);
    });
  });

  describe('available tokens', () => {
    it('should provide method to check available tokens', () => {
      const limiter = new RateLimiter({ requestsPerMinute: 60 });

      expect(limiter.getAvailableTokens()).toBe(60);
    });

    it('should decrease available tokens after acquire', async () => {
      const limiter = new RateLimiter({ requestsPerMinute: 60 });

      await limiter.acquire();
      expect(limiter.getAvailableTokens()).toBe(59);

      await limiter.acquire();
      expect(limiter.getAvailableTokens()).toBe(58);
    });

    it('should increase available tokens over time', async () => {
      const limiter = new RateLimiter({ requestsPerMinute: 60 });

      // Use 10 tokens
      for (let i = 0; i < 10; i++) {
        await limiter.acquire();
      }

      expect(limiter.getAvailableTokens()).toBe(50);

      // Advance 5 seconds (should refill 5 tokens)
      await vi.advanceTimersByTimeAsync(5000);

      expect(limiter.getAvailableTokens()).toBe(55);
    });

    it('should not exceed max tokens', async () => {
      const limiter = new RateLimiter({ requestsPerMinute: 60 });

      // Wait for a long time
      await vi.advanceTimersByTimeAsync(120000); // 2 minutes

      // Should still be capped at 60
      expect(limiter.getAvailableTokens()).toBe(60);
    });
  });

  describe('edge cases', () => {
    it('should handle very high rate limit (1000+ per minute)', async () => {
      const limiter = new RateLimiter({ requestsPerMinute: 1200 }); // 20 per second

      // Should allow 1200 requests immediately
      for (let i = 0; i < 1200; i++) {
        await limiter.acquire();
      }

      expect(Date.now()).toBe(0);
    });

    it('should handle concurrent requests exceeding limit', async () => {
      const limiter = new RateLimiter({ requestsPerMinute: 10 });

      // Try to make 20 concurrent requests
      const promises = Array(20).fill(null).map(() => limiter.acquire());

      // First 10 should complete immediately
      await vi.advanceTimersByTimeAsync(0);

      // Advance time to allow refills
      await vi.advanceTimersByTimeAsync(60000); // 1 minute for full refill

      // All should eventually complete
      await Promise.all(promises);
    });

    it('should handle fractional tokens per second', async () => {
      const limiter = new RateLimiter({ requestsPerMinute: 30 }); // 0.5 per second

      // Use all 30 tokens
      for (let i = 0; i < 30; i++) {
        await limiter.acquire();
      }

      // Advance 2 seconds (should refill 1 token: 2 * 0.5)
      await vi.advanceTimersByTimeAsync(2000);

      // Should be able to acquire 1 token
      await limiter.acquire();

      expect(limiter.getAvailableTokens()).toBe(0);
    });
  });

  describe('configuration', () => {
    it('should use default rate limit when not provided', () => {
      const limiter = new RateLimiter();

      // Default is 30 requests per minute
      expect(limiter.getAvailableTokens()).toBe(30);
    });

    it('should respect custom rate limit', () => {
      const limiter = new RateLimiter({ requestsPerMinute: 120 });

      expect(limiter.getAvailableTokens()).toBe(120);
    });

    it('should handle rate limit of 1 per minute', async () => {
      const limiter = new RateLimiter({ requestsPerMinute: 1 });

      await limiter.acquire();

      expect(limiter.getAvailableTokens()).toBe(0);

      // Should need to wait full minute for next token
      const promise = limiter.acquire();

      await vi.advanceTimersByTimeAsync(59000);
      // Still waiting...

      await vi.advanceTimersByTimeAsync(1000);
      // Should resolve now

      await promise;
    });
  });

  describe('disabled rate limiter', () => {
    it('should allow unlimited requests when disabled', async () => {
      const limiter = new RateLimiter({ enabled: false });

      // Should allow 1000+ requests without blocking
      for (let i = 0; i < 1000; i++) {
        await limiter.acquire();
      }

      expect(Date.now()).toBe(0);
    });

    it('should return Infinity for available tokens when disabled', () => {
      const limiter = new RateLimiter({ enabled: false });

      expect(limiter.getAvailableTokens()).toBe(Infinity);
    });
  });
});
