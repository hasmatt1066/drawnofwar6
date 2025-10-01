import { describe, it, expect } from 'vitest';
import { MockPixelLabClient, MockPixelLabClientConfig } from './pixellab-client-mock.js';
import { GenerationRequest } from '../../src/pixellab/request-validator.js';
import { PixelLabError, PixelLabErrorType } from '../../src/pixellab/errors.js';

describe('MockPixelLabClient', () => {
  // Sample request for testing
  const sampleRequest: GenerationRequest = {
    description: 'test warrior',
    size: 64,
    detail: 'medium detail',
    shading: 'basic shading',
    outline: 'single color black outline',
    view: 'low top-down',
    nDirections: 8,
  };

  describe('Success Scenario', () => {
    it('should successfully generate sprite', async () => {
      const config: MockPixelLabClientConfig = {
        scenario: 'success',
        delay: 10,
      };
      const mockClient = new MockPixelLabClient(config);

      const result = await mockClient.generateSprite(sampleRequest);

      // Verify result structure
      expect(result.characterId).toBeDefined();
      expect(typeof result.characterId).toBe('string');
      expect(result.characterId.length).toBeGreaterThan(0);
      expect(result.name).toBeNull();
      expect(result.created).toBeDefined();
      expect(result.specifications).toBeDefined();
      expect(result.specifications.directions).toBe(8);
      expect(result.specifications.canvasSize).toBe('64');
      expect(result.specifications.view).toBe('low top-down');
      expect(result.style).toBeDefined();
      expect(result.style.outline).toBe('single color black outline');
      expect(result.style.shading).toBe('basic shading');
      expect(result.style.detail).toBe('medium detail');
      expect(result.directions).toHaveLength(8);
      expect(result.downloadUrl).toBeDefined();

      // Verify each direction has proper structure
      result.directions.forEach((dir) => {
        expect(dir.direction).toBeDefined();
        expect(dir.url).toBeDefined();
        expect(Buffer.isBuffer(dir.buffer)).toBe(true);
        expect(dir.buffer.length).toBeGreaterThan(0);
      });
    });

    it('should handle 4-direction sprites', async () => {
      const config: MockPixelLabClientConfig = {
        scenario: 'success',
        delay: 10,
      };
      const mockClient = new MockPixelLabClient(config);

      const request: GenerationRequest = {
        ...sampleRequest,
        nDirections: 4,
      };

      const result = await mockClient.generateSprite(request);

      expect(result.specifications.directions).toBe(4);
      expect(result.directions).toHaveLength(4);
      expect(result.directions.map((d) => d.direction)).toEqual([
        'north',
        'east',
        'south',
        'west',
      ]);
    });

    it('should apply configurable delay', async () => {
      const config: MockPixelLabClientConfig = {
        scenario: 'success',
        delay: 100,
      };
      const mockClient = new MockPixelLabClient(config);

      const startTime = Date.now();
      await mockClient.generateSprite(sampleRequest);
      const endTime = Date.now();

      const elapsed = endTime - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(95); // Allow small tolerance for timing
      expect(elapsed).toBeLessThan(200);
    });

    it('should use default delay when not specified', async () => {
      const config: MockPixelLabClientConfig = {
        scenario: 'success',
      };
      const mockClient = new MockPixelLabClient(config);

      const startTime = Date.now();
      await mockClient.generateSprite(sampleRequest);
      const endTime = Date.now();

      const elapsed = endTime - startTime;
      expect(elapsed).toBeLessThan(10); // Default is 0
    });
  });

  describe('Failure Scenarios', () => {
    it('should throw error on failure scenario', async () => {
      const config: MockPixelLabClientConfig = {
        scenario: 'failure',
        errorMessage: 'Generation failed',
      };
      const mockClient = new MockPixelLabClient(config);

      await expect(mockClient.generateSprite(sampleRequest)).rejects.toThrow(
        PixelLabError
      );

      try {
        await mockClient.generateSprite(sampleRequest);
      } catch (error) {
        expect(error).toBeInstanceOf(PixelLabError);
        const pixelLabError = error as PixelLabError;
        expect(pixelLabError.type).toBe(PixelLabErrorType.API_ERROR);
        expect(pixelLabError.message).toBe('Generation failed');
        expect(pixelLabError.retryable).toBe(false);
      }
    });

    it('should throw authentication error', async () => {
      const config: MockPixelLabClientConfig = {
        scenario: 'auth_error',
        errorMessage: 'Invalid API key',
      };
      const mockClient = new MockPixelLabClient(config);

      await expect(mockClient.generateSprite(sampleRequest)).rejects.toThrow(
        'Invalid API key'
      );

      try {
        await mockClient.generateSprite(sampleRequest);
      } catch (error) {
        expect(error).toBeInstanceOf(PixelLabError);
        const pixelLabError = error as PixelLabError;
        expect(pixelLabError.type).toBe(PixelLabErrorType.AUTHENTICATION);
        expect(pixelLabError.statusCode).toBe(401);
        expect(pixelLabError.retryable).toBe(false);
      }
    });

    it('should throw timeout error', async () => {
      const config: MockPixelLabClientConfig = {
        scenario: 'timeout',
        errorMessage: 'Request timeout',
      };
      const mockClient = new MockPixelLabClient(config);

      await expect(mockClient.generateSprite(sampleRequest)).rejects.toThrow(
        'Request timeout'
      );

      try {
        await mockClient.generateSprite(sampleRequest);
      } catch (error) {
        expect(error).toBeInstanceOf(PixelLabError);
        const pixelLabError = error as PixelLabError;
        expect(pixelLabError.type).toBe(PixelLabErrorType.TIMEOUT);
        expect(pixelLabError.retryable).toBe(true);
      }
    });

    it('should throw server error', async () => {
      const config: MockPixelLabClientConfig = {
        scenario: 'server_error',
        errorMessage: 'Internal server error',
      };
      const mockClient = new MockPixelLabClient(config);

      await expect(mockClient.generateSprite(sampleRequest)).rejects.toThrow(
        'Internal server error'
      );

      try {
        await mockClient.generateSprite(sampleRequest);
      } catch (error) {
        expect(error).toBeInstanceOf(PixelLabError);
        const pixelLabError = error as PixelLabError;
        expect(pixelLabError.type).toBe(PixelLabErrorType.API_ERROR);
        expect(pixelLabError.statusCode).toBe(500);
        expect(pixelLabError.retryable).toBe(true);
      }
    });

    it('should use default error message when not provided', async () => {
      const config: MockPixelLabClientConfig = {
        scenario: 'failure',
      };
      const mockClient = new MockPixelLabClient(config);

      await expect(mockClient.generateSprite(sampleRequest)).rejects.toThrow(
        'Mock generation failed'
      );
    });
  });

  describe('Call Tracking', () => {
    it('should track method calls', async () => {
      const config: MockPixelLabClientConfig = {
        scenario: 'success',
        delay: 10,
      };
      const mockClient = new MockPixelLabClient(config);

      expect(mockClient.getCallCount()).toBe(0);
      expect(mockClient.getCallHistory()).toEqual([]);

      await mockClient.generateSprite(sampleRequest);

      expect(mockClient.getCallCount()).toBe(1);
      expect(mockClient.getCallHistory()).toHaveLength(1);
      expect(mockClient.getCallHistory()[0]).toEqual(sampleRequest);
    });

    it('should track multiple calls', async () => {
      const config: MockPixelLabClientConfig = {
        scenario: 'success',
        delay: 10,
      };
      const mockClient = new MockPixelLabClient(config);

      const request1 = { ...sampleRequest, description: 'warrior 1' };
      const request2 = { ...sampleRequest, description: 'warrior 2' };
      const request3 = { ...sampleRequest, description: 'warrior 3' };

      await mockClient.generateSprite(request1);
      await mockClient.generateSprite(request2);
      await mockClient.generateSprite(request3);

      expect(mockClient.getCallCount()).toBe(3);
      expect(mockClient.getCallHistory()).toHaveLength(3);
      expect(mockClient.getCallHistory()[0]).toEqual(request1);
      expect(mockClient.getCallHistory()[1]).toEqual(request2);
      expect(mockClient.getCallHistory()[2]).toEqual(request3);
    });

    it('should track failed calls', async () => {
      const config: MockPixelLabClientConfig = {
        scenario: 'failure',
      };
      const mockClient = new MockPixelLabClient(config);

      try {
        await mockClient.generateSprite(sampleRequest);
      } catch (error) {
        // Expected error
      }

      expect(mockClient.getCallCount()).toBe(1);
      expect(mockClient.getCallHistory()[0]).toEqual(sampleRequest);
    });

    it('should reset call history', async () => {
      const config: MockPixelLabClientConfig = {
        scenario: 'success',
        delay: 10,
      };
      const mockClient = new MockPixelLabClient(config);

      await mockClient.generateSprite(sampleRequest);
      await mockClient.generateSprite(sampleRequest);

      expect(mockClient.getCallCount()).toBe(2);

      mockClient.reset();

      expect(mockClient.getCallCount()).toBe(0);
      expect(mockClient.getCallHistory()).toEqual([]);
    });
  });

  describe('Concurrent Calls', () => {
    it('should handle concurrent calls independently', async () => {
      const config: MockPixelLabClientConfig = {
        scenario: 'success',
        delay: 50,
      };
      const mockClient = new MockPixelLabClient(config);

      const request1 = { ...sampleRequest, description: 'warrior 1' };
      const request2 = { ...sampleRequest, description: 'warrior 2' };
      const request3 = { ...sampleRequest, description: 'warrior 3' };

      // Start all calls concurrently
      const promise1 = mockClient.generateSprite(request1);
      const promise2 = mockClient.generateSprite(request2);
      const promise3 = mockClient.generateSprite(request3);

      const results = await Promise.all([promise1, promise2, promise3]);

      expect(results).toHaveLength(3);
      expect(mockClient.getCallCount()).toBe(3);

      // Each result should have different character IDs
      const characterIds = results.map((r) => r.characterId);
      const uniqueIds = new Set(characterIds);
      expect(uniqueIds.size).toBe(3);
    });

    it('should handle mixed success and failure concurrently', async () => {
      const successMock = new MockPixelLabClient({
        scenario: 'success',
        delay: 50,
      });
      const failureMock = new MockPixelLabClient({
        scenario: 'failure',
        delay: 50,
      });

      const promise1 = successMock.generateSprite(sampleRequest);
      const promise2 = failureMock.generateSprite(sampleRequest);

      const results = await Promise.allSettled([promise1, promise2]);

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
    });
  });

  describe('Progress Updates', () => {
    it('should simulate progress updates when enabled', async () => {
      const config: MockPixelLabClientConfig = {
        scenario: 'success',
        delay: 100,
        progressUpdates: true,
      };
      const mockClient = new MockPixelLabClient(config);

      const progressValues: number[] = [];
      const onProgress = (progress: number) => {
        progressValues.push(progress);
      };

      const result = await mockClient.generateSprite(sampleRequest, onProgress);

      expect(result).toBeDefined();
      expect(progressValues.length).toBeGreaterThan(0);
      expect(progressValues[0]).toBeLessThan(100);

      // Progress values should be increasing
      for (let i = 1; i < progressValues.length; i++) {
        expect(progressValues[i]).toBeGreaterThanOrEqual(progressValues[i - 1]);
      }
    });

    it('should not call progress callback when disabled', async () => {
      const config: MockPixelLabClientConfig = {
        scenario: 'success',
        delay: 50,
        progressUpdates: false,
      };
      const mockClient = new MockPixelLabClient(config);

      const progressValues: number[] = [];
      const onProgress = (progress: number) => {
        progressValues.push(progress);
      };

      await mockClient.generateSprite(sampleRequest, onProgress);

      expect(progressValues).toHaveLength(0);
    });

    it('should handle missing progress callback', async () => {
      const config: MockPixelLabClientConfig = {
        scenario: 'success',
        delay: 50,
        progressUpdates: true,
      };
      const mockClient = new MockPixelLabClient(config);

      // Should not throw when no callback provided
      await expect(
        mockClient.generateSprite(sampleRequest)
      ).resolves.toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should generate unique character IDs for each call', async () => {
      const config: MockPixelLabClientConfig = {
        scenario: 'success',
        delay: 10,
      };
      const mockClient = new MockPixelLabClient(config);

      const result1 = await mockClient.generateSprite(sampleRequest);
      const result2 = await mockClient.generateSprite(sampleRequest);
      const result3 = await mockClient.generateSprite(sampleRequest);

      expect(result1.characterId).not.toBe(result2.characterId);
      expect(result2.characterId).not.toBe(result3.characterId);
      expect(result1.characterId).not.toBe(result3.characterId);
    });

    it('should generate valid PNG buffers', async () => {
      const config: MockPixelLabClientConfig = {
        scenario: 'success',
        delay: 10,
      };
      const mockClient = new MockPixelLabClient(config);

      const result = await mockClient.generateSprite(sampleRequest);

      // Check PNG signature (first 8 bytes)
      result.directions.forEach((dir) => {
        const buffer = dir.buffer;
        expect(buffer[0]).toBe(0x89);
        expect(buffer[1]).toBe(0x50); // P
        expect(buffer[2]).toBe(0x4e); // N
        expect(buffer[3]).toBe(0x47); // G
        expect(buffer[4]).toBe(0x0d);
        expect(buffer[5]).toBe(0x0a);
        expect(buffer[6]).toBe(0x1a);
        expect(buffer[7]).toBe(0x0a);
      });
    });

    it('should preserve request parameters in result', async () => {
      const config: MockPixelLabClientConfig = {
        scenario: 'success',
        delay: 10,
      };
      const mockClient = new MockPixelLabClient(config);

      const request: GenerationRequest = {
        description: 'custom character',
        size: 128,
        detail: 'high detail',
        shading: 'detailed shading',
        outline: 'lineless',
        view: 'side',
        nDirections: 4,
      };

      const result = await mockClient.generateSprite(request);

      expect(result.specifications.canvasSize).toBe('128');
      expect(result.specifications.view).toBe('side');
      expect(result.specifications.directions).toBe(4);
      expect(result.style.detail).toBe('high detail');
      expect(result.style.shading).toBe('detailed shading');
      expect(result.style.outline).toBe('lineless');
    });

    it('should use default values for optional request parameters', async () => {
      const config: MockPixelLabClientConfig = {
        scenario: 'success',
        delay: 10,
      };
      const mockClient = new MockPixelLabClient(config);

      const minimalRequest: GenerationRequest = {
        description: 'minimal character',
        size: 64,
      };

      const result = await mockClient.generateSprite(minimalRequest);

      expect(result).toBeDefined();
      expect(result.specifications.canvasSize).toBe('64');
      expect(result.style.detail).toBeDefined();
      expect(result.style.shading).toBeDefined();
      expect(result.style.outline).toBeDefined();
    });

    it('should handle zero delay', async () => {
      const config: MockPixelLabClientConfig = {
        scenario: 'success',
        delay: 0,
      };
      const mockClient = new MockPixelLabClient(config);

      const startTime = Date.now();
      await mockClient.generateSprite(sampleRequest);
      const endTime = Date.now();

      const elapsed = endTime - startTime;
      expect(elapsed).toBeLessThan(50); // Should be nearly instant
    });
  });

  describe('Configuration Validation', () => {
    it('should throw error for invalid scenario', () => {
      expect(() => {
        new MockPixelLabClient({
          scenario: 'invalid_scenario' as any,
        });
      }).toThrow('Invalid scenario');
    });

    it('should throw error for negative delay', () => {
      expect(() => {
        new MockPixelLabClient({
          scenario: 'success',
          delay: -100,
        });
      }).toThrow('Delay must be non-negative');
    });

    it('should accept all valid scenarios', () => {
      const scenarios: MockPixelLabClientConfig['scenario'][] = [
        'success',
        'failure',
        'timeout',
        'auth_error',
        'server_error',
      ];

      scenarios.forEach((scenario) => {
        expect(() => {
          new MockPixelLabClient({ scenario });
        }).not.toThrow();
      });
    });
  });

  describe('Production Safety', () => {
    it('should include warning in generated data', async () => {
      const config: MockPixelLabClientConfig = {
        scenario: 'success',
        delay: 10,
      };
      const mockClient = new MockPixelLabClient(config);

      const result = await mockClient.generateSprite(sampleRequest);

      // Character ID should indicate it's from mock
      expect(result.characterId).toContain('mock-');
    });

    it('should expose isMock property', () => {
      const config: MockPixelLabClientConfig = {
        scenario: 'success',
      };
      const mockClient = new MockPixelLabClient(config);

      expect(mockClient.isMock).toBe(true);
    });
  });
});
