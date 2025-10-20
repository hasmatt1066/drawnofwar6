import { describe, it, expect, beforeEach } from 'vitest';
import { RotateSprite, RotateRequest } from '../rotate-sprite';
import { HttpClient } from '../http-client';
import { PixelLabError } from '../errors';
import MockAdapter from 'axios-mock-adapter';

describe('RotateSprite - Multi-directional Sprite Rotation', () => {
  let httpClient: HttpClient;
  let mockAdapter: MockAdapter;
  let rotateSprite: RotateSprite;
  const validApiKey = 'c1994b12-b97e-4b29-9991-180e3a0ebe55';
  const validBase64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

  beforeEach(() => {
    httpClient = new HttpClient({ apiKey: validApiKey });
    mockAdapter = new MockAdapter(httpClient.axiosInstance);
    rotateSprite = new RotateSprite(httpClient);
  });

  describe('basic rotation', () => {
    it('should rotate sprite successfully', async () => {
      const request: RotateRequest = {
        referenceImage: validBase64Image,
        fromView: 'side',
        toView: 'top-down',
        fromDirection: 'south',
        toDirection: 'east'
      };

      mockAdapter.onPost('/v1/rotate').reply(200, {
        usage: {
          type: 'usd',
          usd: 0.05
        },
        image: {
          type: 'base64',
          base64: 'rotated-image-base64'
        }
      });

      const response = await rotateSprite.rotateSprite(request);

      expect(response.imageBase64).toBe('rotated-image-base64');
      expect(response.costUsd).toBe(0.05);
    });

    it('should include all required parameters', async () => {
      const request: RotateRequest = {
        referenceImage: validBase64Image,
        fromView: 'side',
        toView: 'top-down',
        fromDirection: 'south',
        toDirection: 'northeast'
      };

      mockAdapter.onPost('/v1/rotate').reply((config) => {
        const data = JSON.parse(config.data);

        expect(data.from_image).toEqual({
          type: 'base64',
          base64: validBase64Image
        });
        expect(data.image_size).toEqual({ width: 64, height: 64 });
        expect(data.from_view).toBe('side');
        expect(data.to_view).toBe('top-down');
        expect(data.from_direction).toBe('south');
        expect(data.to_direction).toBe('northeast');

        return [200, {
          usage: { type: 'usd', usd: 0.05 },
          image: { type: 'base64', base64: 'rotated' }
        }];
      });

      await rotateSprite.rotateSprite(request);
    });

    it('should apply default parameters', async () => {
      const request: RotateRequest = {
        referenceImage: validBase64Image
      };

      mockAdapter.onPost('/v1/rotate').reply((config) => {
        const data = JSON.parse(config.data);

        expect(data.from_view).toBe('side');
        expect(data.to_view).toBe('top-down');
        expect(data.from_direction).toBe('south');
        expect(data.to_direction).toBe('east');
        expect(data.image_guidance_scale).toBe(3.0);
        expect(data.init_image_strength).toBe(300);
        expect(data.isometric).toBe(false);
        expect(data.oblique_projection).toBe(false);

        return [200, {
          usage: { type: 'usd', usd: 0.05 },
          image: { type: 'base64', base64: 'rotated' }
        }];
      });

      await rotateSprite.rotateSprite(request);
    });
  });

  describe('all 8 directions', () => {
    const directions = [
      'north',
      'northeast',
      'east',
      'southeast',
      'south',
      'southwest',
      'west',
      'northwest'
    ] as const;

    directions.forEach(direction => {
      it(`should rotate to ${direction} direction`, async () => {
        const request: RotateRequest = {
          referenceImage: validBase64Image,
          fromView: 'side',
          toView: 'top-down',
          fromDirection: 'south',
          toDirection: direction
        };

        mockAdapter.onPost('/v1/rotate').reply(200, {
          usage: { type: 'usd', usd: 0.05 },
          image: { type: 'base64', base64: `${direction}-sprite` }
        });

        const response = await rotateSprite.rotateSprite(request);

        expect(response.imageBase64).toBe(`${direction}-sprite`);
      });
    });
  });

  describe('view angle options', () => {
    it('should rotate from side to top-down view', async () => {
      mockAdapter.onPost('/v1/rotate').reply((config) => {
        const data = JSON.parse(config.data);
        expect(data.from_view).toBe('side');
        expect(data.to_view).toBe('top-down');

        return [200, {
          usage: { type: 'usd', usd: 0.05 },
          image: { type: 'base64', base64: 'top-down-view' }
        }];
      });

      await rotateSprite.rotateSprite({
        referenceImage: validBase64Image,
        fromView: 'side',
        toView: 'top-down'
      });
    });

    it('should support isometric view', async () => {
      mockAdapter.onPost('/v1/rotate').reply((config) => {
        const data = JSON.parse(config.data);
        expect(data.isometric).toBe(true);

        return [200, {
          usage: { type: 'usd', usd: 0.05 },
          image: { type: 'base64', base64: 'isometric-view' }
        }];
      });

      await rotateSprite.rotateSprite({
        referenceImage: validBase64Image,
        isometric: true
      });
    });

    it('should support oblique projection', async () => {
      mockAdapter.onPost('/v1/rotate').reply((config) => {
        const data = JSON.parse(config.data);
        expect(data.oblique_projection).toBe(true);

        return [200, {
          usage: { type: 'usd', usd: 0.05 },
          image: { type: 'base64', base64: 'oblique-view' }
        }];
      });

      await rotateSprite.rotateSprite({
        referenceImage: validBase64Image,
        obliqueProjection: true
      });
    });
  });

  describe('numeric angle control', () => {
    it('should support view angle change in degrees', async () => {
      mockAdapter.onPost('/v1/rotate').reply((config) => {
        const data = JSON.parse(config.data);
        expect(data.view_change).toBe(45);

        return [200, {
          usage: { type: 'usd', usd: 0.05 },
          image: { type: 'base64', base64: 'angled-view' }
        }];
      });

      await rotateSprite.rotateSprite({
        referenceImage: validBase64Image,
        viewChange: 45
      });
    });

    it('should support direction angle change in degrees', async () => {
      mockAdapter.onPost('/v1/rotate').reply((config) => {
        const data = JSON.parse(config.data);
        expect(data.direction_change).toBe(90);

        return [200, {
          usage: { type: 'usd', usd: 0.05 },
          image: { type: 'base64', base64: 'rotated-90' }
        }];
      });

      await rotateSprite.rotateSprite({
        referenceImage: validBase64Image,
        directionChange: 90
      });
    });

    it('should handle negative angles', async () => {
      mockAdapter.onPost('/v1/rotate').reply((config) => {
        const data = JSON.parse(config.data);
        expect(data.view_change).toBe(-45);
        expect(data.direction_change).toBe(-90);

        return [200, {
          usage: { type: 'usd', usd: 0.05 },
          image: { type: 'base64', base64: 'negative-angles' }
        }];
      });

      await rotateSprite.rotateSprite({
        referenceImage: validBase64Image,
        viewChange: -45,
        directionChange: -90
      });
    });
  });

  describe('image guidance and strength parameters', () => {
    it('should support custom image guidance scale', async () => {
      mockAdapter.onPost('/v1/rotate').reply((config) => {
        const data = JSON.parse(config.data);
        expect(data.image_guidance_scale).toBe(5.0);

        return [200, {
          usage: { type: 'usd', usd: 0.05 },
          image: { type: 'base64', base64: 'high-guidance' }
        }];
      });

      await rotateSprite.rotateSprite({
        referenceImage: validBase64Image,
        imageGuidanceScale: 5.0
      });
    });

    it('should support custom init image strength', async () => {
      mockAdapter.onPost('/v1/rotate').reply((config) => {
        const data = JSON.parse(config.data);
        expect(data.init_image_strength).toBe(500);

        return [200, {
          usage: { type: 'usd', usd: 0.05 },
          image: { type: 'base64', base64: 'strong-influence' }
        }];
      });

      await rotateSprite.rotateSprite({
        referenceImage: validBase64Image,
        initImageStrength: 500
      });
    });
  });

  describe('helper method: rotateToTopDown', () => {
    it('should rotate to top-down east direction', async () => {
      mockAdapter.onPost('/v1/rotate').reply((config) => {
        const data = JSON.parse(config.data);

        expect(data.from_view).toBe('side');
        expect(data.to_view).toBe('top-down');
        expect(data.from_direction).toBe('south');
        expect(data.to_direction).toBe('east');

        return [200, {
          usage: { type: 'usd', usd: 0.05 },
          image: { type: 'base64', base64: 'top-down-east' }
        }];
      });

      const response = await rotateSprite.rotateToTopDown(validBase64Image, 'east');

      expect(response.imageBase64).toBe('top-down-east');
      expect(response.costUsd).toBe(0.05);
    });

    it('should rotate to top-down northeast direction (no hyphen)', async () => {
      mockAdapter.onPost('/v1/rotate').reply((config) => {
        const data = JSON.parse(config.data);
        expect(data.to_direction).toBe('northeast');

        return [200, {
          usage: { type: 'usd', usd: 0.05 },
          image: { type: 'base64', base64: 'top-down-northeast' }
        }];
      });

      const response = await rotateSprite.rotateToTopDown(validBase64Image, 'northeast');

      expect(response.imageBase64).toBe('top-down-northeast');
    });
  });

  describe('error handling', () => {
    it('should handle 401 authentication error', async () => {
      mockAdapter.onPost('/v1/rotate').reply(401, {
        detail: 'Invalid API key'
      });

      await expect(rotateSprite.rotateSprite({
        referenceImage: validBase64Image
      })).rejects.toThrow(PixelLabError);
    });

    it('should handle 422 validation error', async () => {
      mockAdapter.onPost('/v1/rotate').reply(422, {
        detail: [
          {
            loc: ['body', 'image_size', 'width'],
            msg: 'width must be between 16 and 200',
            type: 'value_error'
          }
        ]
      });

      await expect(rotateSprite.rotateSprite({
        referenceImage: validBase64Image
      })).rejects.toThrow(PixelLabError);
    });

    it('should handle 500 server error', async () => {
      mockAdapter.onPost('/v1/rotate').reply(500, {
        detail: 'Internal server error'
      });

      await expect(rotateSprite.rotateSprite({
        referenceImage: validBase64Image
      })).rejects.toThrow(PixelLabError);
    });

    it('should handle network timeout', async () => {
      mockAdapter.onPost('/v1/rotate').timeout();

      await expect(rotateSprite.rotateSprite({
        referenceImage: validBase64Image
      })).rejects.toThrow(PixelLabError);
    });
  });

  describe('cost tracking', () => {
    it('should track API costs correctly', async () => {
      mockAdapter.onPost('/v1/rotate').reply(200, {
        usage: { type: 'usd', usd: 0.075 },
        image: { type: 'base64', base64: 'rotated' }
      });

      const response = await rotateSprite.rotateSprite({
        referenceImage: validBase64Image
      });

      expect(response.costUsd).toBe(0.075);
    });

    it('should handle zero cost', async () => {
      mockAdapter.onPost('/v1/rotate').reply(200, {
        usage: { type: 'usd', usd: 0.0 },
        image: { type: 'base64', base64: 'rotated' }
      });

      const response = await rotateSprite.rotateSprite({
        referenceImage: validBase64Image
      });

      expect(response.costUsd).toBe(0.0);
    });
  });

  describe('edge cases', () => {
    it('should handle very large base64 images', async () => {
      const largeBase64 = 'a'.repeat(100000);

      mockAdapter.onPost('/v1/rotate').reply(200, {
        usage: { type: 'usd', usd: 0.05 },
        image: { type: 'base64', base64: 'rotated-large' }
      });

      const response = await rotateSprite.rotateSprite({
        referenceImage: largeBase64
      });

      expect(response.imageBase64).toBe('rotated-large');
    });

    it('should handle maximal parameters', async () => {
      const maximalRequest: RotateRequest = {
        referenceImage: validBase64Image,
        fromView: 'side',
        toView: 'top-down',
        fromDirection: 'south',
        toDirection: 'northeast',
        viewChange: 45,
        directionChange: 90,
        isometric: true,
        obliqueProjection: false,
        imageGuidanceScale: 10.0,
        initImageStrength: 800
      };

      mockAdapter.onPost('/v1/rotate').reply(200, {
        usage: { type: 'usd', usd: 0.05 },
        image: { type: 'base64', base64: 'maximal-rotation' }
      });

      const response = await rotateSprite.rotateSprite(maximalRequest);

      expect(response.imageBase64).toBe('maximal-rotation');
    });

    it('should handle minimal parameters (only referenceImage)', async () => {
      const minimalRequest: RotateRequest = {
        referenceImage: validBase64Image
      };

      mockAdapter.onPost('/v1/rotate').reply(200, {
        usage: { type: 'usd', usd: 0.05 },
        image: { type: 'base64', base64: 'minimal-rotation' }
      });

      const response = await rotateSprite.rotateSprite(minimalRequest);

      expect(response.imageBase64).toBe('minimal-rotation');
    });
  });
});
