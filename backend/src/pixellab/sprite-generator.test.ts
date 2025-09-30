import { describe, it, expect, beforeEach } from 'vitest';
import { SpriteGenerator, JobSubmissionResponse } from './sprite-generator';
import { HttpClient } from './http-client';
import { GenerationRequest } from './request-validator';
import { PixelLabError } from './errors';
import MockAdapter from 'axios-mock-adapter';

describe('Sprite Generator - Task 3.1: Sprite Generation Request', () => {
  let httpClient: HttpClient;
  let mockAdapter: MockAdapter;
  let generator: SpriteGenerator;
  const validApiKey = 'c1994b12-b97e-4b29-9991-180e3a0ebe55';

  beforeEach(() => {
    httpClient = new HttpClient({ apiKey: validApiKey });
    mockAdapter = new MockAdapter(httpClient.axiosInstance);
    generator = new SpriteGenerator(httpClient);
  });

  const validRequest: GenerationRequest = {
    description: 'wizard with blue robes',
    size: 48,
    detail: 'medium detail',
    shading: 'basic shading',
    outline: 'single color black outline',
    view: 'low top-down',
    nDirections: 8,
  };

  describe('text-only generation', () => {
    it('should submit text-only request successfully', async () => {
      mockAdapter.onPost('/v1/characters').reply(200, {
        character_id: 'char-123',
        name: 'Blue Wizard',
      });

      const response = await generator.submitGeneration(validRequest);

      expect(response.characterId).toBe('char-123');
      expect(response.name).toBe('Blue Wizard');
    });

    it('should include all required parameters', async () => {
      mockAdapter.onPost('/v1/characters').reply((config) => {
        const data = JSON.parse(config.data);

        expect(data.description).toBe(validRequest.description);
        expect(data.size).toBe(validRequest.size);
        expect(data.n_directions).toBe(validRequest.nDirections);

        return [200, { character_id: 'char-123', name: null }];
      });

      await generator.submitGeneration(validRequest);
    });

    it('should include optional parameters when provided', async () => {
      const requestWithOptional = {
        ...validRequest,
        aiFreedom: 750,
        textGuidanceScale: 8,
      };

      mockAdapter.onPost('/v1/characters').reply((config) => {
        const data = JSON.parse(config.data);

        expect(data.ai_freedom).toBe(750);
        expect(data.text_guidance_scale).toBe(8);
        expect(data.detail).toBe('medium detail');
        expect(data.shading).toBe('basic shading');

        return [200, { character_id: 'char-123', name: null }];
      });

      await generator.submitGeneration(requestWithOptional);
    });

    it('should convert camelCase to snake_case for API', async () => {
      mockAdapter.onPost('/v1/characters').reply((config) => {
        const data = JSON.parse(config.data);

        // Check snake_case conversion
        expect(data.n_directions).toBeDefined();
        expect(data.nDirections).toBeUndefined();

        return [200, { character_id: 'char-123', name: null }];
      });

      await generator.submitGeneration(validRequest);
    });
  });

  describe('generation with init image', () => {
    it('should submit request with init image', async () => {
      const validBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
      const requestWithImage = {
        ...validRequest,
        initImage: validBase64,
      };

      mockAdapter.onPost('/v1/characters').reply((config) => {
        const data = JSON.parse(config.data);

        expect(data.init_image).toBe(validBase64);

        return [200, { character_id: 'char-123', name: null }];
      });

      await generator.submitGeneration(requestWithImage);
    });
  });

  describe('response parsing', () => {
    it('should parse character_id from response', async () => {
      mockAdapter.onPost('/v1/characters').reply(200, {
        character_id: 'char-abc-123',
        name: 'Test Character',
      });

      const response = await generator.submitGeneration(validRequest);

      expect(response.characterId).toBe('char-abc-123');
    });

    it('should handle null name in response', async () => {
      mockAdapter.onPost('/v1/characters').reply(200, {
        character_id: 'char-123',
        name: null,
      });

      const response = await generator.submitGeneration(validRequest);

      expect(response.characterId).toBe('char-123');
      expect(response.name).toBeNull();
    });

    it('should return response with all fields', async () => {
      mockAdapter.onPost('/v1/characters').reply(200, {
        character_id: 'char-123',
        name: 'Wizard',
      });

      const response = await generator.submitGeneration(validRequest);

      expect(response).toHaveProperty('characterId');
      expect(response).toHaveProperty('name');
    });
  });

  describe('validation', () => {
    it('should validate request before submission', async () => {
      const invalidRequest = {
        description: '',
        size: 48,
      } as GenerationRequest;

      await expect(generator.submitGeneration(invalidRequest)).rejects.toThrow(PixelLabError);
    });

    it('should reject invalid size', async () => {
      const invalidRequest = {
        ...validRequest,
        size: 256,
      } as any;

      await expect(generator.submitGeneration(invalidRequest)).rejects.toThrow(PixelLabError);
    });

    it('should reject empty description', async () => {
      const invalidRequest = {
        ...validRequest,
        description: '',
      };

      await expect(generator.submitGeneration(invalidRequest)).rejects.toThrow(PixelLabError);
    });
  });

  describe('error handling', () => {
    it('should handle 401 authentication error', async () => {
      mockAdapter.onPost('/v1/characters').reply(401, {
        detail: 'Invalid API key',
      });

      await expect(generator.submitGeneration(validRequest)).rejects.toThrow(PixelLabError);
    });

    it('should handle 422 validation error', async () => {
      mockAdapter.onPost('/v1/characters').reply(422, {
        detail: [
          {
            loc: ['body', 'size'],
            msg: 'size must be between 32 and 128',
            type: 'value_error',
          },
        ],
      });

      await expect(generator.submitGeneration(validRequest)).rejects.toThrow(PixelLabError);
    });

    it('should handle 500 server error', async () => {
      mockAdapter.onPost('/v1/characters').reply(500, {
        detail: 'Internal server error',
      });

      await expect(generator.submitGeneration(validRequest)).rejects.toThrow(PixelLabError);
    });

    it('should handle network timeout', async () => {
      mockAdapter.onPost('/v1/characters').timeout();

      await expect(generator.submitGeneration(validRequest)).rejects.toThrow(PixelLabError);
    });
  });

  describe('edge cases', () => {
    it('should handle very long description', async () => {
      const longDescription = 'a'.repeat(10000);
      const request = {
        ...validRequest,
        description: longDescription,
      };

      mockAdapter.onPost('/v1/characters').reply(200, {
        character_id: 'char-123',
        name: null,
      });

      const response = await generator.submitGeneration(request);

      expect(response.characterId).toBe('char-123');
    });

    it('should handle minimal request', async () => {
      const minimal: GenerationRequest = {
        description: 'wizard',
        size: 32,
      };

      mockAdapter.onPost('/v1/characters').reply(200, {
        character_id: 'char-123',
        name: null,
      });

      const response = await generator.submitGeneration(minimal);

      expect(response.characterId).toBe('char-123');
    });

    it('should handle maximal request with all optional fields', async () => {
      const maximal: GenerationRequest = {
        description: 'wizard with blue robes and staff',
        size: 128,
        detail: 'high detail',
        shading: 'detailed shading',
        outline: 'selective outline',
        view: 'high top-down',
        nDirections: 8,
        aiFreedom: 900,
        textGuidanceScale: 15,
        initImage: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
      };

      mockAdapter.onPost('/v1/characters').reply(200, {
        character_id: 'char-123',
        name: 'Complex Wizard',
      });

      const response = await generator.submitGeneration(maximal);

      expect(response.characterId).toBe('char-123');
      expect(response.name).toBe('Complex Wizard');
    });

    it('should handle special characters in description', async () => {
      const request = {
        ...validRequest,
        description: 'wizard with "magic" staff & robe',
      };

      mockAdapter.onPost('/v1/characters').reply(200, {
        character_id: 'char-123',
        name: null,
      });

      const response = await generator.submitGeneration(request);

      expect(response.characterId).toBe('char-123');
    });
  });
});
