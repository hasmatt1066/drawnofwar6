import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BalanceChecker, BalanceCheckerConfig } from './balance-checker';
import { HttpClient } from './http-client';
import { PixelLabError, PixelLabErrorType } from './errors';
import { QuotaTracker } from './quota-tracker';

describe('Balance Checker - Task 6.4: Check API Balance', () => {
  let httpClient: HttpClient;

  beforeEach(() => {
    httpClient = new HttpClient({
      apiKey: 'test-api-key-1234567890',
      enableLogging: false,
    });
  });

  describe('balance check', () => {
    it('should query API for current balance', async () => {
      const mockGet = vi.spyOn(httpClient.axiosInstance, 'get').mockResolvedValue({
        data: { balance: 500.5 },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const checker = new BalanceChecker(httpClient);
      const balance = await checker.checkBalance();

      expect(balance).toBe(500.5);
      expect(mockGet).toHaveBeenCalledWith('/balance');
    });

    it('should handle balance check errors', async () => {
      const mockGet = vi.spyOn(httpClient.axiosInstance, 'get').mockRejectedValue(
        new PixelLabError({
          type: PixelLabErrorType.API_ERROR,
          message: 'Server error',
          statusCode: 500,
          retryable: true,
        })
      );

      const checker = new BalanceChecker(httpClient);

      await expect(checker.checkBalance()).rejects.toThrow(PixelLabError);
    });

    it('should handle authentication errors', async () => {
      const mockGet = vi.spyOn(httpClient.axiosInstance, 'get').mockRejectedValue(
        new PixelLabError({
          type: PixelLabErrorType.AUTHENTICATION,
          message: 'Invalid API key',
          statusCode: 401,
          retryable: false,
        })
      );

      const checker = new BalanceChecker(httpClient);

      await expect(checker.checkBalance()).rejects.toThrow(PixelLabError);
    });

    it('should cache balance for specified duration', async () => {
      vi.useFakeTimers();

      const mockGet = vi.spyOn(httpClient.axiosInstance, 'get')
        .mockResolvedValueOnce({
          data: { balance: 100 },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        })
        .mockResolvedValueOnce({
          data: { balance: 200 },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        });

      const checker = new BalanceChecker(httpClient, {
        cacheDuration: 60000, // 1 minute
      });

      // First call
      const balance1 = await checker.checkBalance();
      expect(balance1).toBe(100);
      expect(mockGet).toHaveBeenCalledTimes(1);

      // Second call within cache duration (should use cached value)
      const balance2 = await checker.checkBalance();
      expect(balance2).toBe(100);
      expect(mockGet).toHaveBeenCalledTimes(1); // Not called again

      // Advance time past cache duration
      vi.advanceTimersByTime(60001);

      // Third call after cache expired
      const balance3 = await checker.checkBalance();
      expect(balance3).toBe(200);
      expect(mockGet).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('should allow forcing balance refresh', async () => {
      const mockGet = vi.spyOn(httpClient.axiosInstance, 'get')
        .mockResolvedValueOnce({
          data: { balance: 100 },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        })
        .mockResolvedValueOnce({
          data: { balance: 200 },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        });

      const checker = new BalanceChecker(httpClient);

      const balance1 = await checker.checkBalance();
      expect(balance1).toBe(100);

      const balance2 = await checker.checkBalance(true); // Force refresh
      expect(balance2).toBe(200);
      expect(mockGet).toHaveBeenCalledTimes(2);
    });

    it('should disable caching when cacheDuration is 0', async () => {
      const mockGet = vi.spyOn(httpClient.axiosInstance, 'get')
        .mockResolvedValueOnce({
          data: { balance: 100 },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        })
        .mockResolvedValueOnce({
          data: { balance: 200 },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        });

      const checker = new BalanceChecker(httpClient, {
        cacheDuration: 0,
      });

      const balance1 = await checker.checkBalance();
      expect(balance1).toBe(100);

      const balance2 = await checker.checkBalance();
      expect(balance2).toBe(200);
      expect(mockGet).toHaveBeenCalledTimes(2);
    });
  });

  describe('low balance warnings', () => {
    it('should warn when balance is below threshold', async () => {
      const warnings: string[] = [];

      const mockGet = vi.spyOn(httpClient.axiosInstance, 'get').mockResolvedValue({
        data: { balance: 50 },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const checker = new BalanceChecker(httpClient, {
        lowBalanceThreshold: 100,
        onLowBalance: (balance, threshold) => {
          warnings.push(`Low balance: ${balance} < ${threshold}`);
        },
      });

      await checker.checkBalance();

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('50');
      expect(warnings[0]).toContain('100');
    });

    it('should not warn when balance is above threshold', async () => {
      const warnings: string[] = [];

      const mockGet = vi.spyOn(httpClient.axiosInstance, 'get').mockResolvedValue({
        data: { balance: 150 },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const checker = new BalanceChecker(httpClient, {
        lowBalanceThreshold: 100,
        onLowBalance: (balance, threshold) => {
          warnings.push(`Low balance: ${balance} < ${threshold}`);
        },
      });

      await checker.checkBalance();

      expect(warnings).toHaveLength(0);
    });

    it('should warn only once for low balance', async () => {
      const warnings: string[] = [];

      const mockGet = vi.spyOn(httpClient.axiosInstance, 'get').mockResolvedValue({
        data: { balance: 50 },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const checker = new BalanceChecker(httpClient, {
        lowBalanceThreshold: 100,
        cacheDuration: 0, // Disable caching
        onLowBalance: (balance, threshold) => {
          warnings.push(`Low balance: ${balance} < ${threshold}`);
        },
      });

      await checker.checkBalance();
      await checker.checkBalance();
      await checker.checkBalance();

      expect(warnings).toHaveLength(1); // Only warned once
    });

    it('should warn again after balance increases above threshold and drops again', async () => {
      const warnings: string[] = [];

      const mockGet = vi.spyOn(httpClient.axiosInstance, 'get')
        .mockResolvedValueOnce({
          data: { balance: 50 },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        })
        .mockResolvedValueOnce({
          data: { balance: 150 },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        })
        .mockResolvedValueOnce({
          data: { balance: 50 },
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        });

      const checker = new BalanceChecker(httpClient, {
        lowBalanceThreshold: 100,
        cacheDuration: 0,
        onLowBalance: (balance, threshold) => {
          warnings.push(`Low balance: ${balance} < ${threshold}`);
        },
      });

      await checker.checkBalance(); // Low (50)
      expect(warnings).toHaveLength(1);

      await checker.checkBalance(); // High (150)
      expect(warnings).toHaveLength(1);

      await checker.checkBalance(); // Low again (50)
      expect(warnings).toHaveLength(2); // Should warn again
    });

    it('should not warn when no threshold set', async () => {
      const warnings: string[] = [];

      const mockGet = vi.spyOn(httpClient.axiosInstance, 'get').mockResolvedValue({
        data: { balance: 10 },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const checker = new BalanceChecker(httpClient, {
        onLowBalance: (balance, threshold) => {
          warnings.push(`Low balance: ${balance} < ${threshold}`);
        },
      });

      await checker.checkBalance();

      expect(warnings).toHaveLength(0);
    });
  });

  describe('quota tracker integration', () => {
    it('should integrate with quota tracker to compare usage vs balance', async () => {
      const mockGet = vi.spyOn(httpClient.axiosInstance, 'get').mockResolvedValue({
        data: { balance: 1000 },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const quotaTracker = new QuotaTracker();
      quotaTracker.trackUsage(300);

      const checker = new BalanceChecker(httpClient, {
        quotaTracker,
      });

      const balance = await checker.checkBalance();
      const comparison = checker.getBalanceComparison();

      expect(balance).toBe(1000);
      expect(comparison).toEqual({
        currentBalance: 1000,
        creditsUsed: 300,
        projectedBalance: 700,
      });
    });

    it('should work without quota tracker', async () => {
      const mockGet = vi.spyOn(httpClient.axiosInstance, 'get').mockResolvedValue({
        data: { balance: 500 },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const checker = new BalanceChecker(httpClient);

      const balance = await checker.checkBalance();
      const comparison = checker.getBalanceComparison();

      expect(balance).toBe(500);
      expect(comparison).toEqual({
        currentBalance: 500,
        creditsUsed: 0,
        projectedBalance: 500,
      });
    });

    it('should handle negative projected balance', async () => {
      const mockGet = vi.spyOn(httpClient.axiosInstance, 'get').mockResolvedValue({
        data: { balance: 100 },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const quotaTracker = new QuotaTracker();
      quotaTracker.trackUsage(150);

      const checker = new BalanceChecker(httpClient, {
        quotaTracker,
      });

      const balance = await checker.checkBalance();
      const comparison = checker.getBalanceComparison();

      expect(comparison.projectedBalance).toBe(-50);
    });
  });

  describe('last check tracking', () => {
    it('should track last successful check time', async () => {
      vi.useFakeTimers();
      const now = new Date('2025-01-01T00:00:00Z');
      vi.setSystemTime(now);

      const mockGet = vi.spyOn(httpClient.axiosInstance, 'get').mockResolvedValue({
        data: { balance: 500 },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const checker = new BalanceChecker(httpClient);

      expect(checker.getLastCheckTime()).toBeUndefined();

      await checker.checkBalance();

      expect(checker.getLastCheckTime()).toEqual(now);

      vi.useRealTimers();
    });

    it('should update last check time on each check', async () => {
      vi.useFakeTimers();

      const mockGet = vi.spyOn(httpClient.axiosInstance, 'get').mockResolvedValue({
        data: { balance: 500 },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const checker = new BalanceChecker(httpClient, {
        cacheDuration: 0,
      });

      const time1 = new Date('2025-01-01T00:00:00Z');
      vi.setSystemTime(time1);
      await checker.checkBalance();
      expect(checker.getLastCheckTime()).toEqual(time1);

      const time2 = new Date('2025-01-01T01:00:00Z');
      vi.setSystemTime(time2);
      await checker.checkBalance();
      expect(checker.getLastCheckTime()).toEqual(time2);

      vi.useRealTimers();
    });
  });

  describe('configuration validation', () => {
    it('should validate cacheDuration is non-negative', () => {
      expect(() => {
        new BalanceChecker(httpClient, {
          cacheDuration: -1000,
        });
      }).toThrow('Cache duration must be non-negative');
    });

    it('should validate lowBalanceThreshold is positive', () => {
      expect(() => {
        new BalanceChecker(httpClient, {
          lowBalanceThreshold: -100,
        });
      }).toThrow('Low balance threshold must be positive');
    });

    it('should allow zero cache duration', () => {
      expect(() => {
        new BalanceChecker(httpClient, {
          cacheDuration: 0,
        });
      }).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle zero balance', async () => {
      const mockGet = vi.spyOn(httpClient.axiosInstance, 'get').mockResolvedValue({
        data: { balance: 0 },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const checker = new BalanceChecker(httpClient);
      const balance = await checker.checkBalance();

      expect(balance).toBe(0);
    });

    it('should handle fractional balance', async () => {
      const mockGet = vi.spyOn(httpClient.axiosInstance, 'get').mockResolvedValue({
        data: { balance: 123.456 },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const checker = new BalanceChecker(httpClient);
      const balance = await checker.checkBalance();

      expect(balance).toBe(123.456);
    });

    it('should handle very large balance', async () => {
      const mockGet = vi.spyOn(httpClient.axiosInstance, 'get').mockResolvedValue({
        data: { balance: 1000000000 },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      const checker = new BalanceChecker(httpClient);
      const balance = await checker.checkBalance();

      expect(balance).toBe(1000000000);
    });
  });
});
