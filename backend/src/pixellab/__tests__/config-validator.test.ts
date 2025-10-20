import { describe, it, expect } from 'vitest';
import { ConfigValidator, PixelLabClientConfig } from '../config-validator';
import { PixelLabError } from '../errors';

describe('ConfigValidator - Task 2.3: Configuration Validation', () => {
  const validConfig: PixelLabClientConfig = {
    apiKey: 'c1994b12-b97e-4b29-9991-180e3a0ebe55',
    baseURL: 'https://api.pixellab.ai',
    timeout: 180000,
    maxRetries: 3,
    rateLimitPerMinute: 30,
    enableLogging: true,
  };

  describe('validateConfig', () => {
    it('should accept valid config with all fields', () => {
      const validated = ConfigValidator.validateConfig(validConfig);

      expect(validated).toBeDefined();
      expect(validated.apiKey).toBe(validConfig.apiKey);
      expect(validated.baseURL).toBe(validConfig.baseURL);
      expect(validated.timeout).toBe(validConfig.timeout);
    });

    it('should accept config with only required fields', () => {
      const minimalConfig = {
        apiKey: validConfig.apiKey,
      };

      const validated = ConfigValidator.validateConfig(minimalConfig);

      expect(validated.apiKey).toBe(minimalConfig.apiKey);
      expect(validated.baseURL).toBe('https://api.pixellab.ai'); // default
      expect(validated.timeout).toBe(180000); // default
      expect(validated.maxRetries).toBe(3); // default
      expect(validated.rateLimitPerMinute).toBe(30); // default
      expect(validated.enableLogging).toBe(true); // default
    });

    it('should reject config missing apiKey', () => {
      const invalidConfig = {
        baseURL: 'https://api.pixellab.ai',
      } as PixelLabClientConfig;

      expect(() => ConfigValidator.validateConfig(invalidConfig)).toThrow(PixelLabError);
    });

    it('should reject negative timeout', () => {
      const invalidConfig = {
        ...validConfig,
        timeout: -1000,
      };

      expect(() => ConfigValidator.validateConfig(invalidConfig)).toThrow(PixelLabError);
      expect(() => ConfigValidator.validateConfig(invalidConfig)).toThrow('Timeout must be positive');
    });

    it('should reject invalid base URL', () => {
      const invalidConfig = {
        ...validConfig,
        baseURL: 'not-a-url',
      };

      expect(() => ConfigValidator.validateConfig(invalidConfig)).toThrow(PixelLabError);
      expect(() => ConfigValidator.validateConfig(invalidConfig)).toThrow('Base URL');
    });

    it('should validate all field types', () => {
      const invalidConfig = {
        apiKey: validConfig.apiKey,
        timeout: 'not a number' as any,
      };

      expect(() => ConfigValidator.validateConfig(invalidConfig)).toThrow(PixelLabError);
    });

    it('should validate ranges', () => {
      const configWithInvalidRate = {
        ...validConfig,
        rateLimitPerMinute: -5,
      };

      expect(() => ConfigValidator.validateConfig(configWithInvalidRate)).toThrow(PixelLabError);
    });

    it('should apply defaults for optional fields', () => {
      const partialConfig = {
        apiKey: validConfig.apiKey,
        timeout: 60000, // custom timeout
      };

      const validated = ConfigValidator.validateConfig(partialConfig);

      expect(validated.timeout).toBe(60000); // custom value preserved
      expect(validated.baseURL).toBe('https://api.pixellab.ai'); // default applied
      expect(validated.maxRetries).toBe(3); // default applied
    });

    it('should throw descriptive error for invalid config', () => {
      try {
        ConfigValidator.validateConfig({ apiKey: '' });
      } catch (error) {
        expect(error).toBeInstanceOf(PixelLabError);
        expect((error as Error).message).toContain('API key');
      }
    });
  });

  describe('edge cases', () => {
    it('should handle config with extra unknown fields', () => {
      const configWithExtra = {
        ...validConfig,
        unknownField: 'should be ignored',
      } as any;

      const validated = ConfigValidator.validateConfig(configWithExtra);

      expect(validated).toBeDefined();
      expect((validated as any).unknownField).toBeUndefined();
    });

    it('should handle config with null values for optional fields', () => {
      const configWithNulls = {
        apiKey: validConfig.apiKey,
        baseURL: null as any,
      };

      // Null should be treated as missing and default should be applied
      const validated = ConfigValidator.validateConfig(configWithNulls);

      expect(validated.baseURL).toBe('https://api.pixellab.ai');
    });

    it('should handle base URL with trailing slash', () => {
      const configWithTrailingSlash = {
        ...validConfig,
        baseURL: 'https://api.pixellab.ai/',
      };

      const validated = ConfigValidator.validateConfig(configWithTrailingSlash);

      // Should normalize by removing trailing slash
      expect(validated.baseURL).toBe('https://api.pixellab.ai');
    });

    it('should handle base URL without trailing slash', () => {
      const config = {
        ...validConfig,
        baseURL: 'https://api.pixellab.ai',
      };

      const validated = ConfigValidator.validateConfig(config);

      expect(validated.baseURL).toBe('https://api.pixellab.ai');
    });

    it('should reject zero timeout', () => {
      const configWithZeroTimeout = {
        ...validConfig,
        timeout: 0,
      };

      expect(() => ConfigValidator.validateConfig(configWithZeroTimeout)).toThrow(PixelLabError);
    });

    it('should accept zero maxRetries (no retries)', () => {
      const configWithNoRetries = {
        ...validConfig,
        maxRetries: 0,
      };

      const validated = ConfigValidator.validateConfig(configWithNoRetries);

      expect(validated.maxRetries).toBe(0);
    });

    it('should reject negative maxRetries', () => {
      const configWithNegativeRetries = {
        ...validConfig,
        maxRetries: -1,
      };

      expect(() => ConfigValidator.validateConfig(configWithNegativeRetries)).toThrow(PixelLabError);
    });
  });

  describe('type validation', () => {
    it('should reject non-string API key', () => {
      const configWithNumberKey = {
        apiKey: 12345 as any,
      };

      expect(() => ConfigValidator.validateConfig(configWithNumberKey)).toThrow(PixelLabError);
    });

    it('should reject non-number timeout', () => {
      const configWithStringTimeout = {
        ...validConfig,
        timeout: '5000' as any,
      };

      expect(() => ConfigValidator.validateConfig(configWithStringTimeout)).toThrow(PixelLabError);
    });

    it('should reject non-boolean enableLogging', () => {
      const configWithStringLogging = {
        ...validConfig,
        enableLogging: 'true' as any,
      };

      expect(() => ConfigValidator.validateConfig(configWithStringLogging)).toThrow(PixelLabError);
    });
  });
});
