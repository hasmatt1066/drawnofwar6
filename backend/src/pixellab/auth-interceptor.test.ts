import { describe, it, expect, beforeEach } from 'vitest';
import { HttpClient } from './http-client';
import MockAdapter from 'axios-mock-adapter';

describe('Auth Interceptor - Task 1.2: Request Authentication', () => {
  let httpClient: HttpClient;
  let mockAdapter: MockAdapter;
  const validApiKey = 'c1994b12-b97e-4b29-9991-180e3a0ebe55';

  beforeEach(() => {
    httpClient = new HttpClient({ apiKey: validApiKey });
    mockAdapter = new MockAdapter(httpClient.axiosInstance);
  });

  describe('request interceptor', () => {
    it('should add Authorization header to GET request', async () => {
      mockAdapter.onGet('/test').reply((config) => {
        expect(config.headers?.['Authorization']).toBe(`Bearer ${validApiKey}`);
        return [200, { success: true }];
      });

      await httpClient.axiosInstance.get('/test');
    });

    it('should add Authorization header to POST request', async () => {
      mockAdapter.onPost('/test').reply((config) => {
        expect(config.headers?.['Authorization']).toBe(`Bearer ${validApiKey}`);
        return [200, { success: true }];
      });

      await httpClient.axiosInstance.post('/test', { data: 'test' });
    });

    it('should add Authorization header to PUT request', async () => {
      mockAdapter.onPut('/test').reply((config) => {
        expect(config.headers?.['Authorization']).toBe(`Bearer ${validApiKey}`);
        return [200, { success: true }];
      });

      await httpClient.axiosInstance.put('/test', { data: 'test' });
    });

    it('should add Authorization header to DELETE request', async () => {
      mockAdapter.onDelete('/test').reply((config) => {
        expect(config.headers?.['Authorization']).toBe(`Bearer ${validApiKey}`);
        return [200, { success: true }];
      });

      await httpClient.axiosInstance.delete('/test');
    });

    it('should not modify other headers', async () => {
      mockAdapter.onPost('/test').reply((config) => {
        expect(config.headers?.['Content-Type']).toBe('application/json');
        expect(config.headers?.['Accept']).toBe('application/json');
        expect(config.headers?.['X-Custom']).toBe('test');
        return [200, { success: true }];
      });

      await httpClient.axiosInstance.post('/test', { data: 'test' }, {
        headers: { 'X-Custom': 'test' },
      });
    });

    it('should not overwrite existing Authorization header', async () => {
      const customAuth = 'Bearer custom-token-12345';

      mockAdapter.onGet('/test').reply((config) => {
        expect(config.headers?.['Authorization']).toBe(customAuth);
        return [200, { success: true }];
      });

      await httpClient.axiosInstance.get('/test', {
        headers: { 'Authorization': customAuth },
      });
    });

    it('should use current API key for each request', async () => {
      mockAdapter.onGet('/test1').reply((config) => {
        expect(config.headers?.['Authorization']).toBe(`Bearer ${validApiKey}`);
        return [200, { success: true }];
      });

      await httpClient.axiosInstance.get('/test1');

      // Update API key
      const newApiKey = 'd2994b12-b97e-4b29-9991-180e3a0ebe66';
      httpClient.setApiKey(newApiKey);

      mockAdapter.onGet('/test2').reply((config) => {
        expect(config.headers?.['Authorization']).toBe(`Bearer ${newApiKey}`);
        return [200, { success: true }];
      });

      await httpClient.axiosInstance.get('/test2');
    });
  });

  describe('dynamic API key updates', () => {
    it('should update API key and use in next request', async () => {
      const newApiKey = 'd2994b12-b97e-4b29-9991-180e3a0ebe66';

      mockAdapter.onGet('/test').reply((config) => {
        expect(config.headers?.['Authorization']).toBe(`Bearer ${newApiKey}`);
        return [200, { success: true }];
      });

      httpClient.setApiKey(newApiKey);

      await httpClient.axiosInstance.get('/test');
    });

    it('should validate new API key before updating', () => {
      const invalidKey = 'short';

      expect(() => httpClient.setApiKey(invalidKey)).toThrow();
    });

    it('should keep old key if new key is invalid', async () => {
      const invalidKey = 'short';

      try {
        httpClient.setApiKey(invalidKey);
      } catch {
        // Expected to fail
      }

      // Old key should still work
      mockAdapter.onGet('/test').reply((config) => {
        expect(config.headers?.['Authorization']).toBe(`Bearer ${validApiKey}`);
        return [200, { success: true }];
      });

      await httpClient.axiosInstance.get('/test');
    });

    it('should handle setting same API key (no-op)', () => {
      expect(() => httpClient.setApiKey(validApiKey)).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle API key with hyphens', async () => {
      const keyWithHyphens = 'a1234567-89ab-cdef-0123-456789abcdef';
      const client = new HttpClient({ apiKey: keyWithHyphens });
      const mock = new MockAdapter(client.axiosInstance);

      mock.onGet('/test').reply((config) => {
        expect(config.headers?.['Authorization']).toBe(`Bearer ${keyWithHyphens}`);
        return [200, { success: true }];
      });

      await client.axiosInstance.get('/test');
    });

    it('should handle multiple rapid API key updates', () => {
      const key1 = 'a1234567-89ab-cdef-0123-456789abcdef';
      const key2 = 'b1234567-89ab-cdef-0123-456789abcdef';
      const key3 = 'c1234567-89ab-cdef-0123-456789abcdef';

      expect(() => {
        httpClient.setApiKey(key1);
        httpClient.setApiKey(key2);
        httpClient.setApiKey(key3);
      }).not.toThrow();
    });

    it('should handle concurrent requests with same API key', async () => {
      mockAdapter.onGet(/\/test\d/).reply((config) => {
        expect(config.headers?.['Authorization']).toBe(`Bearer ${validApiKey}`);
        return [200, { success: true }];
      });

      const requests = [
        httpClient.axiosInstance.get('/test1'),
        httpClient.axiosInstance.get('/test2'),
        httpClient.axiosInstance.get('/test3'),
      ];

      await Promise.all(requests);
    });
  });
});
