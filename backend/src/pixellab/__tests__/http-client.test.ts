import { describe, it, expect, beforeEach } from 'vitest';
import { HttpClient, PixelLabClientConfig } from '../http-client';

describe('HttpClient - Task 1.1: Base HTTP Client Class', () => {
  let validConfig: PixelLabClientConfig;

  beforeEach(() => {
    validConfig = {
      apiKey: 'c1994b12-b97e-4b29-9991-180e3a0ebe55',
      baseURL: 'https://api.pixellab.ai',
      timeout: 30000,
      maxRetries: 3,
      rateLimitPerMinute: 30,
      enableLogging: false,
    };
  });

  describe('constructor', () => {
    it('should create instance with valid config', () => {
      const client = new HttpClient(validConfig);

      expect(client).toBeDefined();
      expect(client.axiosInstance).toBeDefined();
    });

    it('should throw error if apiKey is missing', () => {
      const invalidConfig = { ...validConfig, apiKey: '' };

      expect(() => new HttpClient(invalidConfig)).toThrow('API key is required');
    });

    it('should throw error if apiKey is empty string', () => {
      const invalidConfig = { ...validConfig, apiKey: '' };

      expect(() => new HttpClient(invalidConfig)).toThrow('API key is required');
    });

    it('should apply default timeout when not specified', () => {
      const configWithoutTimeout = {
        apiKey: validConfig.apiKey,
        baseURL: validConfig.baseURL,
      };

      const client = new HttpClient(configWithoutTimeout);

      expect(client.axiosInstance.defaults.timeout).toBe(180000); // 3 minutes default
    });

    it('should respect custom timeout when provided', () => {
      const customTimeout = 60000;
      const configWithCustomTimeout = { ...validConfig, timeout: customTimeout };

      const client = new HttpClient(configWithCustomTimeout);

      expect(client.axiosInstance.defaults.timeout).toBe(customTimeout);
    });

    it('should set correct base URL', () => {
      const client = new HttpClient(validConfig);

      expect(client.axiosInstance.defaults.baseURL).toBe('https://api.pixellab.ai');
    });

    it('should set default headers', () => {
      const client = new HttpClient(validConfig);

      expect(client.axiosInstance.defaults.headers.common['Content-Type']).toBe('application/json');
      expect(client.axiosInstance.defaults.headers.common['Accept']).toBe('application/json');
    });
  });

  describe('dynamic API key updates - Task 2.2', () => {
    it('should allow updating API key at runtime', () => {
      const client = new HttpClient(validConfig);
      const newApiKey = 'd1234567-8901-2345-6789-012345678901';

      client.setApiKey(newApiKey);

      const config = client.getConfig();
      expect(config.apiKey).toBe(newApiKey);
    });

    it('should validate new API key before updating', () => {
      const client = new HttpClient(validConfig);

      expect(() => {
        client.setApiKey('');
      }).toThrow();
    });

    it('should use new API key for subsequent requests', async () => {
      const client = new HttpClient(validConfig);
      const newApiKey = 'd1234567-8901-2345-6789-012345678901';

      // Update API key
      client.setApiKey(newApiKey);

      // Verify the new key is in config
      const config = client.getConfig();
      expect(config.apiKey).toBe(newApiKey);

      // The auth interceptor will use this new key for subsequent requests
      // (Full integration test would require mocking actual API calls)
    });

    it('should reject invalid API key format', () => {
      const client = new HttpClient(validConfig);

      expect(() => {
        client.setApiKey('invalid-key');
      }).toThrow();
    });

    it('should reject whitespace-only API key', () => {
      const client = new HttpClient(validConfig);

      expect(() => {
        client.setApiKey('   ');
      }).toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle empty string API key', () => {
      const invalidConfig = { ...validConfig, apiKey: '' };

      expect(() => new HttpClient(invalidConfig)).toThrow();
    });

    it('should handle malformed base URL (missing protocol)', () => {
      const invalidConfig = { ...validConfig, baseURL: 'api.pixellab.ai' };

      expect(() => new HttpClient(invalidConfig)).toThrow('Base URL must include protocol');
    });

    it('should handle negative timeout value', () => {
      const invalidConfig = { ...validConfig, timeout: -1000 };

      expect(() => new HttpClient(invalidConfig)).toThrow('Timeout must be positive');
    });

    it('should handle whitespace-only API key', () => {
      const invalidConfig = { ...validConfig, apiKey: '   ' };

      expect(() => new HttpClient(invalidConfig)).toThrow('API key is required');
    });
  });
});
