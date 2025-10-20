import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StatusPoller, PollingConfig } from '../status-poller';
import { HttpClient } from '../http-client';
import { JobStatus } from '../status-parser';
import { PixelLabError, PixelLabErrorType } from '../errors';
import MockAdapter from 'axios-mock-adapter';

describe('Status Poller - Task 4.1: Basic Status Polling', () => {
  let httpClient: HttpClient;
  let mockAdapter: MockAdapter;
  let poller: StatusPoller;
  const validApiKey = 'c1994b12-b97e-4b29-9991-180e3a0ebe55';

  beforeEach(() => {
    httpClient = new HttpClient({ apiKey: validApiKey });
    mockAdapter = new MockAdapter(httpClient.axiosInstance);
    poller = new StatusPoller(httpClient);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const completedCharacterData = {
    id: 'char-123',
    name: 'Blue Wizard',
    created: '2025-01-15T10:00:00Z',
    specifications: {
      directions: 8,
      canvas_size: '48x48',
      view: 'low top-down',
    },
    style: {
      outline: 'single color black outline',
      shading: 'basic shading',
      detail: 'medium detail',
    },
    rotations: [
      { direction: 'south', url: 'https://example.com/south.png' },
    ],
    download_url: 'https://example.com/download.zip',
  };

  describe('immediate completion', () => {
    it('should handle immediate completion (1 poll)', async () => {
      mockAdapter.onGet('/v1/characters/char-123').reply(200, completedCharacterData);

      const promise = poller.pollUntilComplete('char-123');

      // No need to advance timers - should complete immediately
      const result = await promise;

      expect(result.status).toBe(JobStatus.COMPLETED);
      expect(result.characterId).toBe('char-123');
      expect(result.characterData).toEqual(completedCharacterData);
    });
  });

  describe('polling until completion', () => {
    it('should poll until completion (processing → completed)', async () => {
      let callCount = 0;

      mockAdapter.onGet('/v1/characters/char-123').reply(() => {
        callCount++;

        if (callCount < 3) {
          return [423, {}, { 'retry-after': '1' }];
        }

        return [200, completedCharacterData];
      });

      const promise = poller.pollUntilComplete('char-123');

      // Advance timers for each polling interval
      await vi.advanceTimersByTimeAsync(1000); // First retry after 1s
      await vi.advanceTimersByTimeAsync(1000); // Second retry after 1s

      const result = await promise;

      expect(result.status).toBe(JobStatus.COMPLETED);
      expect(callCount).toBe(3);
    });

    it('should respect Retry-After header intervals', async () => {
      let callCount = 0;

      mockAdapter.onGet('/v1/characters/char-123').reply(() => {
        callCount++;

        if (callCount === 1) {
          return [423, {}, { 'retry-after': '5' }];
        }
        if (callCount === 2) {
          return [423, {}, { 'retry-after': '10' }];
        }

        return [200, completedCharacterData];
      });

      const promise = poller.pollUntilComplete('char-123');

      await vi.advanceTimersByTimeAsync(5000); // First retry after 5s
      await vi.advanceTimersByTimeAsync(10000); // Second retry after 10s

      const result = await promise;

      expect(result.status).toBe(JobStatus.COMPLETED);
      expect(callCount).toBe(3);
    });

    it('should use default interval when Retry-After missing', async () => {
      let callCount = 0;

      mockAdapter.onGet('/v1/characters/char-123').reply(() => {
        callCount++;

        if (callCount < 2) {
          return [423, {}]; // No Retry-After header
        }

        return [200, completedCharacterData];
      });

      const promise = poller.pollUntilComplete('char-123');

      await vi.advanceTimersByTimeAsync(5000); // Default 5s interval

      const result = await promise;

      expect(result.status).toBe(JobStatus.COMPLETED);
    });
  });

  describe('failure handling', () => {
    it('should stop on failure status', async () => {
      mockAdapter.onGet('/v1/characters/char-123').reply(500, {
        detail: 'Generation failed',
      });

      await expect(poller.pollUntilComplete('char-123')).rejects.toThrow(PixelLabError);
    });

    it('should throw error for 404 not found', async () => {
      mockAdapter.onGet('/v1/characters/char-123').reply(404, {
        detail: 'Character not found',
      });

      await expect(poller.pollUntilComplete('char-123')).rejects.toThrow(PixelLabError);
    });

    it('should handle network errors during polling', async () => {
      mockAdapter.onGet('/v1/characters/char-123').networkError();

      await expect(poller.pollUntilComplete('char-123')).rejects.toThrow(PixelLabError);
    });
  });

  describe('timeout handling', () => {
    it('should timeout after max attempts', async () => {
      mockAdapter.onGet('/v1/characters/char-123').reply(423, {});

      const config: PollingConfig = {
        maxAttempts: 3,
        initialInterval: 1000,
      };

      const promise = poller.pollUntilComplete('char-123', config);

      // Advance through max attempts
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(5000);
      await vi.advanceTimersByTimeAsync(5000);

      await expect(promise).rejects.toThrow(PixelLabError);
      await expect(promise).rejects.toThrow('Maximum polling attempts');
    });

    it('should use custom max attempts', async () => {
      let callCount = 0;

      mockAdapter.onGet('/v1/characters/char-123').reply(() => {
        callCount++;
        return [423, {}];
      });

      const config: PollingConfig = {
        maxAttempts: 5,
        initialInterval: 100,
      };

      const promise = poller.pollUntilComplete('char-123', config);

      // Advance through 5 attempts
      for (let i = 0; i < 5; i++) {
        await vi.advanceTimersByTimeAsync(5000);
      }

      await expect(promise).rejects.toThrow('Maximum polling attempts');
      expect(callCount).toBe(5);
    });
  });

  describe('edge cases', () => {
    it('should handle empty character ID', async () => {
      await expect(poller.pollUntilComplete('')).rejects.toThrow(PixelLabError);
    });

    it('should handle very long polling interval', async () => {
      mockAdapter.onGet('/v1/characters/char-123').reply(423, {}, {
        'retry-after': '3600', // 1 hour
      });

      const config: PollingConfig = {
        maxAttempts: 2,
      };

      const promise = poller.pollUntilComplete('char-123', config);

      await vi.advanceTimersByTimeAsync(3600000); // 1 hour

      await expect(promise).rejects.toThrow('Maximum polling attempts');
    });

    it('should handle progress updates', async () => {
      let callCount = 0;

      mockAdapter.onGet('/v1/characters/char-123').reply(() => {
        callCount++;

        if (callCount === 1) {
          return [423, { message: '25% complete' }];
        }
        if (callCount === 2) {
          return [423, { message: '75% complete' }];
        }

        return [200, completedCharacterData];
      });

      const promise = poller.pollUntilComplete('char-123');

      await vi.advanceTimersByTimeAsync(5000);
      await vi.advanceTimersByTimeAsync(5000);

      const result = await promise;

      expect(result.status).toBe(JobStatus.COMPLETED);
    });
  });

  describe('configuration', () => {
    it('should use default config when not provided', async () => {
      mockAdapter.onGet('/v1/characters/char-123').reply(200, completedCharacterData);

      const result = await poller.pollUntilComplete('char-123');

      expect(result.status).toBe(JobStatus.COMPLETED);
    });

    it('should use custom initial interval', async () => {
      let callCount = 0;

      mockAdapter.onGet('/v1/characters/char-123').reply(() => {
        callCount++;

        if (callCount < 2) {
          return [423, {}];
        }

        return [200, completedCharacterData];
      });

      const config: PollingConfig = {
        initialInterval: 2000, // 2s
      };

      const promise = poller.pollUntilComplete('char-123', config);

      await vi.advanceTimersByTimeAsync(2000); // Custom initial interval

      const result = await promise;

      expect(result.status).toBe(JobStatus.COMPLETED);
    });
  });
});
