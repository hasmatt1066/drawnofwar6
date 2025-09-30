import { describe, it, expect, beforeEach } from 'vitest';
import { MockPixelLabServer } from './mock-server';
import { HttpClient } from '../http-client';
import MockAdapter from 'axios-mock-adapter';

describe('MockPixelLabServer - Task 9.1: Mock Server', () => {
  let httpClient: HttpClient;
  let mockAdapter: InstanceType<typeof MockAdapter>;
  let mockServer: MockPixelLabServer;
  const validApiKey = 'c1994b12-b97e-4b29-9991-180e3a0ebe55';

  beforeEach(() => {
    httpClient = new HttpClient({ apiKey: validApiKey });
    mockAdapter = new MockAdapter(httpClient.axiosInstance);
    mockServer = new MockPixelLabServer(mockAdapter);
  });

  describe('character creation endpoint', () => {
    it('should mock POST /v1/characters endpoint', async () => {
      mockServer.setupCharacterCreation();

      const response = await httpClient.axiosInstance.post('/v1/characters', {
        description: 'test wizard',
        size: 48,
        n_directions: 8,
      });

      expect(response.status).toBe(200);
      expect(response.data.character_id).toBeDefined();
      expect(typeof response.data.character_id).toBe('string');
    });

    it('should return realistic character_id format', async () => {
      mockServer.setupCharacterCreation();

      const response = await httpClient.axiosInstance.post('/v1/characters', {
        description: 'test wizard',
        size: 48,
      });

      // Character ID should be UUID format
      expect(response.data.character_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('should return name field from request', async () => {
      mockServer.setupCharacterCreation();

      const response = await httpClient.axiosInstance.post('/v1/characters', {
        description: 'blue wizard with staff',
        size: 48,
      });

      expect(response.data).toHaveProperty('name');
    });

    it('should support custom response data', async () => {
      mockServer.setupCharacterCreation({
        character_id: 'custom-123',
        name: 'Custom Name',
      });

      const response = await httpClient.axiosInstance.post('/v1/characters', {
        description: 'test',
        size: 32,
      });

      expect(response.data.character_id).toBe('custom-123');
      expect(response.data.name).toBe('Custom Name');
    });
  });

  describe('character status endpoint', () => {
    it('should mock GET /v1/characters/:id with 423 status', async () => {
      const characterId = 'char-123';
      mockServer.setupCharacterStatus(characterId, { status: 'processing' });

      const response = await httpClient.axiosInstance.get(
        `/v1/characters/${characterId}`,
        { validateStatus: () => true }
      );

      expect(response.status).toBe(423);
    });

    it('should transition from 423 to 200 status', async () => {
      const characterId = 'char-123';
      mockServer.setupCharacterStatus(characterId, {
        status: 'processing',
        completionTime: 100, // Complete after 100ms
      });

      // First request - should be processing
      const response1 = await httpClient.axiosInstance.get(
        `/v1/characters/${characterId}`,
        { validateStatus: () => true }
      );

      expect(response1.status).toBe(423);

      // Wait for completion
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Second request - should be completed
      const response2 = await httpClient.axiosInstance.get(
        `/v1/characters/${characterId}`,
        { validateStatus: () => true }
      );

      expect(response2.status).toBe(200);
      expect(response2.data.id).toBe(characterId);
      expect(response2.data.rotations).toBeDefined();
    });

    it('should include Retry-After header in 423 response', async () => {
      const characterId = 'char-123';
      mockServer.setupCharacterStatus(characterId, { status: 'processing' });

      const response = await httpClient.axiosInstance.get(
        `/v1/characters/${characterId}`,
        { validateStatus: () => true }
      );

      expect(response.headers['retry-after']).toBeDefined();
    });

    it('should return completed character data', async () => {
      const characterId = 'char-123';
      mockServer.setupCharacterStatus(characterId, { status: 'completed' });

      const response = await httpClient.axiosInstance.get(
        `/v1/characters/${characterId}`
      );

      expect(response.status).toBe(200);
      expect(response.data.id).toBe(characterId);
      expect(response.data.rotations).toBeInstanceOf(Array);
      expect(response.data.download_url).toBeDefined();
    });

    it('should support 4-directional characters', async () => {
      const characterId = 'char-4dir';
      mockServer.setupCharacterStatus(characterId, {
        status: 'completed',
        nDirections: 4,
      });

      const response = await httpClient.axiosInstance.get(
        `/v1/characters/${characterId}`
      );

      expect(response.data.rotations).toHaveLength(4);
      expect(response.data.rotations[0].direction).toBe('south');
    });

    it('should support 8-directional characters', async () => {
      const characterId = 'char-8dir';
      mockServer.setupCharacterStatus(characterId, {
        status: 'completed',
        nDirections: 8,
      });

      const response = await httpClient.axiosInstance.get(
        `/v1/characters/${characterId}`
      );

      expect(response.data.rotations).toHaveLength(8);
      const directions = response.data.rotations.map((r: any) => r.direction);
      expect(directions).toContain('south-east');
      expect(directions).toContain('north-west');
    });
  });

  describe('animation creation endpoint', () => {
    it('should mock POST /v1/characters/:id/animations endpoint', async () => {
      const characterId = 'char-123';
      mockServer.setupAnimationCreation(characterId);

      const response = await httpClient.axiosInstance.post(
        `/v1/characters/${characterId}/animations`,
        {
          template_animation_id: 'walking',
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.animation_id).toBeDefined();
    });

    it('should return realistic animation_id format', async () => {
      const characterId = 'char-123';
      mockServer.setupAnimationCreation(characterId);

      const response = await httpClient.axiosInstance.post(
        `/v1/characters/${characterId}/animations`,
        {
          template_animation_id: 'walking',
        }
      );

      // Animation ID should be UUID format
      expect(response.data.animation_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });
  });

  describe('balance endpoint', () => {
    it('should mock GET /balance endpoint', async () => {
      mockServer.setupBalance();

      const response = await httpClient.axiosInstance.get('/balance');

      expect(response.status).toBe(200);
      expect(response.data.credits).toBeDefined();
      expect(typeof response.data.credits).toBe('number');
    });

    it('should support custom balance value', async () => {
      mockServer.setupBalance(500);

      const response = await httpClient.axiosInstance.get('/balance');

      expect(response.data.credits).toBe(500);
    });
  });

  describe('error simulation', () => {
    it('should simulate 401 authentication error', async () => {
      mockServer.setupError('/v1/characters', 401);

      const response = await httpClient.axiosInstance.post(
        '/v1/characters',
        { description: 'test', size: 32 },
        { validateStatus: () => true }
      );

      expect(response.status).toBe(401);
      expect(response.data.detail).toBeDefined();
    });

    it('should simulate 422 validation error', async () => {
      mockServer.setupError('/v1/characters', 422);

      const response = await httpClient.axiosInstance.post(
        '/v1/characters',
        { description: 'test', size: 32 },
        { validateStatus: () => true }
      );

      expect(response.status).toBe(422);
      expect(response.data.detail).toBeInstanceOf(Array);
    });

    it('should simulate 429 rate limit error', async () => {
      mockServer.setupError('/v1/characters', 429);

      const response = await httpClient.axiosInstance.post(
        '/v1/characters',
        { description: 'test', size: 32 },
        { validateStatus: () => true }
      );

      expect(response.status).toBe(429);
      expect(response.headers['retry-after']).toBeDefined();
    });

    it('should simulate 500 server error', async () => {
      mockServer.setupError('/v1/characters', 500);

      const response = await httpClient.axiosInstance.post(
        '/v1/characters',
        { description: 'test', size: 32 },
        { validateStatus: () => true }
      );

      expect(response.status).toBe(500);
      expect(response.data.detail).toBeDefined();
    });

    it('should simulate network timeout', async () => {
      mockServer.setupTimeout('/v1/characters');

      await expect(
        httpClient.axiosInstance.post('/v1/characters', {
          description: 'test',
          size: 32,
        })
      ).rejects.toThrow();
    });
  });

  describe('configuration', () => {
    it('should use default completion time when not specified', async () => {
      const characterId = 'char-123';
      mockServer.setupCharacterStatus(characterId, { status: 'processing' });

      const response = await httpClient.axiosInstance.get(
        `/v1/characters/${characterId}`,
        { validateStatus: () => true }
      );

      expect(response.status).toBe(423);
    });

    it('should allow resetting all mocks', () => {
      mockServer.setupCharacterCreation();
      mockServer.setupBalance();

      expect(() => mockServer.reset()).not.toThrow();
    });
  });
});
