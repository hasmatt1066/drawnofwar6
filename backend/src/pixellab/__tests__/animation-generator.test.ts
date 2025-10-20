import { describe, it, expect, beforeEach } from 'vitest';
import { AnimationGenerator, AnimationRequest, AnimationResponse } from '../animation-generator';
import { HttpClient } from '../http-client';
import { PixelLabError } from '../errors';
import MockAdapter from 'axios-mock-adapter';

describe('Animation Generator - Task 3.2: Animation Generation Request', () => {
  let httpClient: HttpClient;
  let mockAdapter: MockAdapter;
  let generator: AnimationGenerator;
  const validApiKey = 'c1994b12-b97e-4b29-9991-180e3a0ebe55';

  beforeEach(() => {
    httpClient = new HttpClient({ apiKey: validApiKey });
    mockAdapter = new MockAdapter(httpClient.axiosInstance);
    generator = new AnimationGenerator(httpClient);
  });

  const validRequest: AnimationRequest = {
    characterId: 'char-123',
    templateAnimationId: 'walking',
    actionDescription: 'walking forward',
  };

  describe('animation request submission', () => {
    it('should submit animation request successfully', async () => {
      const mockResponse = {
        character_id: 'char-123',
        animation_id: 'anim-456',
        job_ids: ['job-1', 'job-2', 'job-3', 'job-4'],
      };

      mockAdapter.onPost('/v1/characters/char-123/animations').reply(200, mockResponse);

      const response = await generator.submitAnimation(validRequest);

      expect(response.characterId).toBe('char-123');
      expect(response.animationId).toBe('anim-456');
      expect(response.jobIds).toEqual(['job-1', 'job-2', 'job-3', 'job-4']);
    });

    it('should include template animation ID', async () => {
      mockAdapter.onPost('/v1/characters/char-123/animations').reply((config) => {
        const data = JSON.parse(config.data);

        expect(data.template_animation_id).toBe('walking');

        return [200, {
          character_id: 'char-123',
          animation_id: 'anim-456',
          job_ids: [],
        }];
      });

      await generator.submitAnimation(validRequest);
    });

    it('should include action description when provided', async () => {
      mockAdapter.onPost('/v1/characters/char-123/animations').reply((config) => {
        const data = JSON.parse(config.data);

        expect(data.action_description).toBe('walking forward');

        return [200, {
          character_id: 'char-123',
          animation_id: 'anim-456',
          job_ids: [],
        }];
      });

      await generator.submitAnimation(validRequest);
    });

    it('should handle optional animation name', async () => {
      const requestWithName = {
        ...validRequest,
        animationName: 'Forward Walk',
      };

      mockAdapter.onPost('/v1/characters/char-123/animations').reply((config) => {
        const data = JSON.parse(config.data);

        expect(data.animation_name).toBe('Forward Walk');

        return [200, {
          character_id: 'char-123',
          animation_id: 'anim-456',
          job_ids: [],
        }];
      });

      await generator.submitAnimation(requestWithName);
    });

    it('should work without action description', async () => {
      const minimalRequest = {
        characterId: 'char-123',
        templateAnimationId: 'walking',
      };

      mockAdapter.onPost('/v1/characters/char-123/animations').reply(200, {
        character_id: 'char-123',
        animation_id: 'anim-456',
        job_ids: [],
      });

      const response = await generator.submitAnimation(minimalRequest);

      expect(response.characterId).toBe('char-123');
    });
  });

  describe('validation', () => {
    it('should validate character ID is required', async () => {
      const invalid = {
        ...validRequest,
        characterId: '',
      };

      await expect(generator.submitAnimation(invalid)).rejects.toThrow(PixelLabError);
    });

    it('should validate template animation ID is required', async () => {
      const invalid = {
        ...validRequest,
        templateAnimationId: '',
      };

      await expect(generator.submitAnimation(invalid)).rejects.toThrow(PixelLabError);
    });

    it('should accept valid template animation IDs', async () => {
      const validTemplates = [
        'walking',
        'running-4-frames',
        'jumping-1',
        'fight-stance-idle-8-frames',
        'fireball',
      ];

      for (const template of validTemplates) {
        mockAdapter.onPost(`/v1/characters/char-123/animations`).reply(200, {
          character_id: 'char-123',
          animation_id: 'anim-456',
          job_ids: [],
        });

        const request = {
          ...validRequest,
          templateAnimationId: template,
        };

        const response = await generator.submitAnimation(request);
        expect(response.characterId).toBe('char-123');
      }
    });
  });

  describe('error handling', () => {
    it('should handle 401 authentication error', async () => {
      mockAdapter.onPost('/v1/characters/char-123/animations').reply(401, {
        detail: 'Invalid API key',
      });

      await expect(generator.submitAnimation(validRequest)).rejects.toThrow(PixelLabError);
    });

    it('should handle 404 character not found', async () => {
      mockAdapter.onPost('/v1/characters/char-123/animations').reply(404, {
        detail: 'Character not found',
      });

      await expect(generator.submitAnimation(validRequest)).rejects.toThrow(PixelLabError);
    });

    it('should handle 422 validation error', async () => {
      mockAdapter.onPost('/v1/characters/char-123/animations').reply(422, {
        detail: [
          {
            loc: ['body', 'template_animation_id'],
            msg: 'invalid template',
            type: 'value_error',
          },
        ],
      });

      await expect(generator.submitAnimation(validRequest)).rejects.toThrow(PixelLabError);
    });

    it('should handle 500 server error', async () => {
      mockAdapter.onPost('/v1/characters/char-123/animations').reply(500, {
        detail: 'Internal server error',
      });

      await expect(generator.submitAnimation(validRequest)).rejects.toThrow(PixelLabError);
    });

    it('should handle network timeout', async () => {
      mockAdapter.onPost('/v1/characters/char-123/animations').timeout();

      await expect(generator.submitAnimation(validRequest)).rejects.toThrow(PixelLabError);
    });
  });

  describe('response parsing', () => {
    it('should parse all job IDs from response', async () => {
      mockAdapter.onPost('/v1/characters/char-123/animations').reply(200, {
        character_id: 'char-123',
        animation_id: 'anim-456',
        job_ids: ['job-1', 'job-2', 'job-3', 'job-4', 'job-5', 'job-6', 'job-7', 'job-8'],
      });

      const response = await generator.submitAnimation(validRequest);

      expect(response.jobIds).toHaveLength(8);
      expect(response.jobIds[0]).toBe('job-1');
      expect(response.jobIds[7]).toBe('job-8');
    });

    it('should handle empty job IDs array', async () => {
      mockAdapter.onPost('/v1/characters/char-123/animations').reply(200, {
        character_id: 'char-123',
        animation_id: 'anim-456',
        job_ids: [],
      });

      const response = await generator.submitAnimation(validRequest);

      expect(response.jobIds).toHaveLength(0);
    });

    it('should convert snake_case to camelCase', async () => {
      mockAdapter.onPost('/v1/characters/char-123/animations').reply(200, {
        character_id: 'char-123',
        animation_id: 'anim-456',
        job_ids: ['job-1'],
      });

      const response = await generator.submitAnimation(validRequest);

      expect(response.characterId).toBeDefined();
      expect(response.animationId).toBeDefined();
      expect(response.jobIds).toBeDefined();
      expect((response as any).character_id).toBeUndefined();
      expect((response as any).animation_id).toBeUndefined();
      expect((response as any).job_ids).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle very long action description', async () => {
      const longDescription = 'a'.repeat(10000);
      const request = {
        ...validRequest,
        actionDescription: longDescription,
      };

      mockAdapter.onPost('/v1/characters/char-123/animations').reply(200, {
        character_id: 'char-123',
        animation_id: 'anim-456',
        job_ids: [],
      });

      const response = await generator.submitAnimation(request);

      expect(response.characterId).toBe('char-123');
    });

    it('should handle special characters in descriptions', async () => {
      const request = {
        ...validRequest,
        actionDescription: 'walking "quickly" & carefully',
      };

      mockAdapter.onPost('/v1/characters/char-123/animations').reply(200, {
        character_id: 'char-123',
        animation_id: 'anim-456',
        job_ids: [],
      });

      const response = await generator.submitAnimation(request);

      expect(response.characterId).toBe('char-123');
    });

    it('should handle UUID character IDs', async () => {
      const request = {
        ...validRequest,
        characterId: 'd4398893-03dc-4949-8753-d2de8a4d1659',
      };

      mockAdapter.onPost('/v1/characters/d4398893-03dc-4949-8753-d2de8a4d1659/animations').reply(200, {
        character_id: 'd4398893-03dc-4949-8753-d2de8a4d1659',
        animation_id: 'anim-456',
        job_ids: [],
      });

      const response = await generator.submitAnimation(request);

      expect(response.characterId).toBe('d4398893-03dc-4949-8753-d2de8a4d1659');
    });
  });
});
