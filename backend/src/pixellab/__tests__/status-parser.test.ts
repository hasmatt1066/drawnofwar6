import { describe, it, expect } from 'vitest';
import { StatusParser, JobStatus, JobStatusResponse } from '../status-parser';
import { PixelLabError, PixelLabErrorType } from '../errors';
import { AxiosResponse } from 'axios';

describe('Status Parser - Task 4.4: Job Status Parser', () => {
  describe('completed jobs', () => {
    it('should parse completed job (HTTP 200)', () => {
      const mockResponse = {
        status: 200,
        headers: {},
        data: {
          id: 'char-123',
          name: 'Blue Wizard',
          rotations: [],
        },
      } as AxiosResponse;

      const parsed = StatusParser.parseStatusResponse('char-123', mockResponse);

      expect(parsed.status).toBe(JobStatus.COMPLETED);
      expect(parsed.characterId).toBe('char-123');
    });

    it('should include character data for completed job', () => {
      const characterData = {
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

      const mockResponse = {
        status: 200,
        headers: {},
        data: characterData,
      } as AxiosResponse;

      const parsed = StatusParser.parseStatusResponse('char-123', mockResponse);

      expect(parsed.status).toBe(JobStatus.COMPLETED);
      expect(parsed.characterData).toEqual(characterData);
    });
  });

  describe('processing jobs', () => {
    it('should parse processing job (HTTP 423)', () => {
      const mockResponse = {
        status: 423,
        headers: {},
        data: {},
      } as AxiosResponse;

      const parsed = StatusParser.parseStatusResponse('char-123', mockResponse);

      expect(parsed.status).toBe(JobStatus.PROCESSING);
      expect(parsed.characterId).toBe('char-123');
    });

    it('should extract Retry-After header', () => {
      const mockResponse = {
        status: 423,
        headers: {
          'retry-after': '10',
        },
        data: {},
      } as AxiosResponse;

      const parsed = StatusParser.parseStatusResponse('char-123', mockResponse);

      expect(parsed.status).toBe(JobStatus.PROCESSING);
      expect(parsed.retryAfter).toBe(10);
    });

    it('should handle Retry-After header case insensitive', () => {
      const mockResponse = {
        status: 423,
        headers: {
          'Retry-After': '5',
        },
        data: {},
      } as AxiosResponse;

      const parsed = StatusParser.parseStatusResponse('char-123', mockResponse);

      expect(parsed.retryAfter).toBe(5);
    });

    it('should default to 5s if Retry-After missing', () => {
      const mockResponse = {
        status: 423,
        headers: {},
        data: {},
      } as AxiosResponse;

      const parsed = StatusParser.parseStatusResponse('char-123', mockResponse);

      expect(parsed.retryAfter).toBe(5);
    });

    it('should parse progress from message text', () => {
      const mockResponse = {
        status: 423,
        headers: {},
        data: {
          message: 'Generation 75% complete',
        },
      } as AxiosResponse;

      const parsed = StatusParser.parseStatusResponse('char-123', mockResponse);

      expect(parsed.progress).toBe(75);
    });

    it('should handle progress without percentage sign', () => {
      const mockResponse = {
        status: 423,
        headers: {},
        data: {
          detail: 'Processing: 50 percent done',
        },
      } as AxiosResponse;

      const parsed = StatusParser.parseStatusResponse('char-123', mockResponse);

      expect(parsed.progress).toBe(50);
    });

    it('should handle no progress in message', () => {
      const mockResponse = {
        status: 423,
        headers: {},
        data: {
          message: 'Processing...',
        },
      } as AxiosResponse;

      const parsed = StatusParser.parseStatusResponse('char-123', mockResponse);

      expect(parsed.progress).toBeUndefined();
    });
  });

  describe('failed jobs', () => {
    it('should parse failed job from error response', () => {
      const mockResponse = {
        status: 500,
        headers: {},
        data: {
          detail: 'Generation failed',
        },
      } as AxiosResponse;

      const parsed = StatusParser.parseStatusResponse('char-123', mockResponse);

      expect(parsed.status).toBe(JobStatus.FAILED);
      expect(parsed.errorMessage).toBe('Generation failed');
    });

    it('should extract error message from detail field', () => {
      const mockResponse = {
        status: 422,
        headers: {},
        data: {
          detail: 'Invalid parameter: size must be 32-128',
        },
      } as AxiosResponse;

      const parsed = StatusParser.parseStatusResponse('char-123', mockResponse);

      expect(parsed.status).toBe(JobStatus.FAILED);
      expect(parsed.errorMessage).toBe('Invalid parameter: size must be 32-128');
    });

    it('should handle empty error message', () => {
      const mockResponse = {
        status: 500,
        headers: {},
        data: {},
      } as AxiosResponse;

      const parsed = StatusParser.parseStatusResponse('char-123', mockResponse);

      expect(parsed.status).toBe(JobStatus.FAILED);
      expect(parsed.errorMessage).toBe('Unknown error');
    });

    it('should handle 404 not found', () => {
      const mockResponse = {
        status: 404,
        headers: {},
        data: {
          detail: 'Character not found',
        },
      } as AxiosResponse;

      const parsed = StatusParser.parseStatusResponse('char-123', mockResponse);

      expect(parsed.status).toBe(JobStatus.FAILED);
      expect(parsed.errorMessage).toBe('Character not found');
    });
  });

  describe('edge cases', () => {
    it('should handle unexpected HTTP code as failed', () => {
      const mockResponse = {
        status: 418, // I'm a teapot
        headers: {},
        data: {},
      } as AxiosResponse;

      const parsed = StatusParser.parseStatusResponse('char-123', mockResponse);

      expect(parsed.status).toBe(JobStatus.FAILED);
    });

    it('should handle response without data', () => {
      const mockResponse = {
        status: 423,
        headers: {},
        data: null,
      } as AxiosResponse;

      const parsed = StatusParser.parseStatusResponse('char-123', mockResponse);

      expect(parsed.status).toBe(JobStatus.PROCESSING);
    });

    it('should handle malformed Retry-After header', () => {
      const mockResponse = {
        status: 423,
        headers: {
          'retry-after': 'invalid',
        },
        data: {},
      } as AxiosResponse;

      const parsed = StatusParser.parseStatusResponse('char-123', mockResponse);

      expect(parsed.retryAfter).toBe(5); // fallback
    });

    it('should handle negative Retry-After', () => {
      const mockResponse = {
        status: 423,
        headers: {
          'retry-after': '-10',
        },
        data: {},
      } as AxiosResponse;

      const parsed = StatusParser.parseStatusResponse('char-123', mockResponse);

      expect(parsed.retryAfter).toBe(5); // fallback
    });

    it('should handle very large Retry-After', () => {
      const mockResponse = {
        status: 423,
        headers: {
          'retry-after': '999999',
        },
        data: {},
      } as AxiosResponse;

      const parsed = StatusParser.parseStatusResponse('char-123', mockResponse);

      expect(parsed.retryAfter).toBe(999999);
    });

    it('should handle progress over 100%', () => {
      const mockResponse = {
        status: 423,
        headers: {},
        data: {
          message: '150% complete',
        },
      } as AxiosResponse;

      const parsed = StatusParser.parseStatusResponse('char-123', mockResponse);

      expect(parsed.progress).toBe(150);
    });

    it('should parse first percentage in message', () => {
      const mockResponse = {
        status: 423,
        headers: {},
        data: {
          message: 'Step 2 of 5: 40% complete (80% overall)',
        },
      } as AxiosResponse;

      const parsed = StatusParser.parseStatusResponse('char-123', mockResponse);

      expect(parsed.progress).toBe(40);
    });
  });

  describe('validation errors', () => {
    it('should handle Pydantic validation errors', () => {
      const mockResponse = {
        status: 422,
        headers: {},
        data: {
          detail: [
            {
              loc: ['body', 'size'],
              msg: 'size must be between 32 and 128',
              type: 'value_error',
            },
          ],
        },
      } as AxiosResponse;

      const parsed = StatusParser.parseStatusResponse('char-123', mockResponse);

      expect(parsed.status).toBe(JobStatus.FAILED);
      expect(parsed.errorMessage).toContain('Validation failed');
    });

    it('should handle database errors', () => {
      const mockResponse = {
        status: 500,
        headers: {},
        data: {
          detail: 'Database error: invalid UUID format',
        },
      } as AxiosResponse;

      const parsed = StatusParser.parseStatusResponse('char-123', mockResponse);

      expect(parsed.status).toBe(JobStatus.FAILED);
      expect(parsed.errorMessage).toContain('Database error');
    });
  });
});
