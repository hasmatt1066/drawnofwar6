import { describe, it, expect, beforeEach } from 'vitest';
import { HttpClient } from '../http-client';
import { PixelLabError, PixelLabErrorType } from '../errors';
import MockAdapter from 'axios-mock-adapter';

describe('Error Interceptor - Task 1.3: Response Error Handling', () => {
  let httpClient: HttpClient;
  let mockAdapter: MockAdapter;
  const validApiKey = 'c1994b12-b97e-4b29-9991-180e3a0ebe55';

  beforeEach(() => {
    httpClient = new HttpClient({ apiKey: validApiKey });
    mockAdapter = new MockAdapter(httpClient.axiosInstance);
  });

  describe('authentication errors', () => {
    it('should classify 401 as AUTHENTICATION error (non-retryable)', async () => {
      mockAdapter.onGet('/test').reply(401, {
        detail: 'Invalid API key',
      });

      try {
        await httpClient.axiosInstance.get('/test');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(PixelLabError);
        const pixelError = error as PixelLabError;
        expect(pixelError.type).toBe(PixelLabErrorType.AUTHENTICATION);
        expect(pixelError.statusCode).toBe(401);
        expect(pixelError.retryable).toBe(false);
      }
    });

    it('should classify 403 as AUTHENTICATION error (non-retryable)', async () => {
      mockAdapter.onGet('/test').reply(403, {
        detail: 'Forbidden',
      });

      try {
        await httpClient.axiosInstance.get('/test');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(PixelLabError);
        const pixelError = error as PixelLabError;
        expect(pixelError.type).toBe(PixelLabErrorType.AUTHENTICATION);
        expect(pixelError.statusCode).toBe(403);
        expect(pixelError.retryable).toBe(false);
      }
    });
  });

  describe('rate limit errors', () => {
    it('should classify 429 as RATE_LIMIT error (retryable)', async () => {
      mockAdapter.onGet('/test').reply(429, {
        detail: 'Rate limit exceeded',
      });

      try {
        await httpClient.axiosInstance.get('/test');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(PixelLabError);
        const pixelError = error as PixelLabError;
        expect(pixelError.type).toBe(PixelLabErrorType.RATE_LIMIT);
        expect(pixelError.statusCode).toBe(429);
        expect(pixelError.retryable).toBe(true);
      }
    });
  });

  describe('quota errors', () => {
    it('should classify 402 as QUOTA_EXCEEDED error (non-retryable)', async () => {
      mockAdapter.onGet('/test').reply(402, {
        detail: 'Insufficient credits',
      });

      try {
        await httpClient.axiosInstance.get('/test');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(PixelLabError);
        const pixelError = error as PixelLabError;
        expect(pixelError.type).toBe(PixelLabErrorType.QUOTA_EXCEEDED);
        expect(pixelError.statusCode).toBe(402);
        expect(pixelError.retryable).toBe(false);
      }
    });
  });

  describe('validation errors', () => {
    it('should classify 422 with Pydantic errors as VALIDATION error', async () => {
      mockAdapter.onPost('/test').reply(422, {
        detail: [
          {
            loc: ['body', 'description'],
            msg: 'field required',
            type: 'value_error.missing',
          },
        ],
      });

      try {
        await httpClient.axiosInstance.post('/test', {});
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(PixelLabError);
        const pixelError = error as PixelLabError;
        expect(pixelError.type).toBe(PixelLabErrorType.VALIDATION);
        expect(pixelError.statusCode).toBe(422);
        expect(pixelError.retryable).toBe(false);
        expect(pixelError.fieldErrors).toBeDefined();
        expect(pixelError.fieldErrors?.length).toBe(1);
      }
    });

    it('should classify 422 with parameter constraint as PARAMETER error', async () => {
      mockAdapter.onPost('/test').reply(422, {
        detail: 'size must be between 32 and 128',
      });

      try {
        await httpClient.axiosInstance.post('/test', { size: 256 });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(PixelLabError);
        const pixelError = error as PixelLabError;
        expect(pixelError.type).toBe(PixelLabErrorType.PARAMETER);
        expect(pixelError.statusCode).toBe(422);
        expect(pixelError.retryable).toBe(false);
      }
    });

    it('should classify 400 as INVALID_REQUEST error', async () => {
      mockAdapter.onPost('/test').reply(400, {
        detail: 'Invalid request format',
      });

      try {
        await httpClient.axiosInstance.post('/test', {});
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(PixelLabError);
        const pixelError = error as PixelLabError;
        expect(pixelError.type).toBe(PixelLabErrorType.INVALID_REQUEST);
        expect(pixelError.statusCode).toBe(400);
        expect(pixelError.retryable).toBe(false);
      }
    });
  });

  describe('server errors', () => {
    it('should classify 500 as API_ERROR (retryable)', async () => {
      mockAdapter.onGet('/test').reply(500, {
        detail: 'Internal server error',
      });

      try {
        await httpClient.axiosInstance.get('/test');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(PixelLabError);
        const pixelError = error as PixelLabError;
        expect(pixelError.type).toBe(PixelLabErrorType.API_ERROR);
        expect(pixelError.statusCode).toBe(500);
        expect(pixelError.retryable).toBe(true);
      }
    });

    it('should classify 502 as API_ERROR (retryable)', async () => {
      mockAdapter.onGet('/test').reply(502, {
        detail: 'Bad gateway',
      });

      try {
        await httpClient.axiosInstance.get('/test');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(PixelLabError);
        const pixelError = error as PixelLabError;
        expect(pixelError.type).toBe(PixelLabErrorType.API_ERROR);
        expect(pixelError.statusCode).toBe(502);
        expect(pixelError.retryable).toBe(true);
      }
    });

    it('should classify 503 as API_ERROR (retryable)', async () => {
      mockAdapter.onGet('/test').reply(503, {
        detail: 'Service unavailable',
      });

      try {
        await httpClient.axiosInstance.get('/test');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(PixelLabError);
        const pixelError = error as PixelLabError;
        expect(pixelError.type).toBe(PixelLabErrorType.API_ERROR);
        expect(pixelError.statusCode).toBe(503);
        expect(pixelError.retryable).toBe(true);
      }
    });
  });

  describe('network errors', () => {
    it('should classify timeout as TIMEOUT error (retryable)', async () => {
      mockAdapter.onGet('/test').timeout();

      try {
        await httpClient.axiosInstance.get('/test');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(PixelLabError);
        const pixelError = error as PixelLabError;
        expect(pixelError.type).toBe(PixelLabErrorType.TIMEOUT);
        expect(pixelError.retryable).toBe(true);
      }
    });

    it('should classify network error as NETWORK error (retryable)', async () => {
      mockAdapter.onGet('/test').networkError();

      try {
        await httpClient.axiosInstance.get('/test');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(PixelLabError);
        const pixelError = error as PixelLabError;
        expect(pixelError.type).toBe(PixelLabErrorType.NETWORK);
        expect(pixelError.retryable).toBe(true);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle response with no body', async () => {
      mockAdapter.onGet('/test').reply(500);

      try {
        await httpClient.axiosInstance.get('/test');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(PixelLabError);
        const pixelError = error as PixelLabError;
        expect(pixelError.type).toBe(PixelLabErrorType.API_ERROR);
        expect(pixelError.message).toBeDefined();
      }
    });

    it('should handle malformed JSON error response', async () => {
      mockAdapter.onGet('/test').reply(500, 'Not JSON');

      try {
        await httpClient.axiosInstance.get('/test');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(PixelLabError);
        const pixelError = error as PixelLabError;
        expect(pixelError.type).toBe(PixelLabErrorType.API_ERROR);
      }
    });

    it('should handle unexpected status code', async () => {
      mockAdapter.onGet('/test').reply(418, {
        detail: "I'm a teapot",
      });

      try {
        await httpClient.axiosInstance.get('/test');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(PixelLabError);
        const pixelError = error as PixelLabError;
        expect(pixelError.statusCode).toBe(418);
      }
    });

    it('should preserve original error for debugging', async () => {
      mockAdapter.onGet('/test').reply(500, {
        detail: 'Internal error',
      });

      try {
        await httpClient.axiosInstance.get('/test');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(PixelLabError);
        const pixelError = error as PixelLabError;
        expect(pixelError.originalError).toBeDefined();
      }
    });

    it('should handle database errors with SQL traceback', async () => {
      mockAdapter.onGet('/test').reply(500, {
        detail: 'Database error: invalid UUID format',
      });

      try {
        await httpClient.axiosInstance.get('/test');
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(PixelLabError);
        const pixelError = error as PixelLabError;
        expect(pixelError.type).toBe(PixelLabErrorType.DATABASE);
        expect(pixelError.retryable).toBe(false);
      }
    });
  });

  describe('successful responses', () => {
    it('should not intercept successful responses', async () => {
      mockAdapter.onGet('/test').reply(200, {
        success: true,
      });

      const response = await httpClient.axiosInstance.get('/test');

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
    });

    it('should not intercept 2xx responses', async () => {
      mockAdapter.onPost('/test').reply(201, {
        id: '123',
      });

      const response = await httpClient.axiosInstance.post('/test', {});

      expect(response.status).toBe(201);
      expect(response.data.id).toBe('123');
    });
  });
});
