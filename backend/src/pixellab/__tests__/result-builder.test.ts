import { describe, it, expect } from 'vitest';
import { ResultBuilder, GenerationResult, DirectionResult } from '../result-builder';
import { PixelLabError } from '../errors';

describe('Result Builder - Task 5.3: Generation Result Builder', () => {
  // Valid 1x1 red PNG in base64
  const validPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

  // Valid 48x48 PNG (example)
  const png48x48Base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

  const mockCharacterData = {
    id: 'char-123',
    name: 'Blue Wizard',
    created: '2025-01-15T10:00:00Z',
    specifications: {
      directions: 8 as const,
      canvas_size: '48x48',
      view: 'low top-down',
    },
    style: {
      outline: 'single color black outline',
      shading: 'basic shading',
      detail: 'medium detail',
    },
    rotations: [
      { direction: 'south' as const, url: 'https://example.com/south.png' },
      { direction: 'north' as const, url: 'https://example.com/north.png' },
    ],
    download_url: 'https://example.com/download.zip',
  };

  describe('single sprite generation', () => {
    it('should build result for single sprite', () => {
      const result = ResultBuilder.buildResult({
        characterData: mockCharacterData,
        images: [Buffer.from(validPngBase64, 'base64')],
      });

      expect(result.characterId).toBe('char-123');
      expect(result.name).toBe('Blue Wizard');
      expect(result.directions).toHaveLength(1);
    });

    it('should include metadata fields', () => {
      const result = ResultBuilder.buildResult({
        characterData: mockCharacterData,
        images: [Buffer.from(validPngBase64, 'base64')],
      });

      expect(result.specifications).toEqual({
        directions: 8,
        canvasSize: '48x48',
        view: 'low top-down',
      });

      expect(result.style).toEqual({
        outline: 'single color black outline',
        shading: 'basic shading',
        detail: 'medium detail',
      });
    });

    it('should include download URL', () => {
      const result = ResultBuilder.buildResult({
        characterData: mockCharacterData,
        images: [Buffer.from(validPngBase64, 'base64')],
      });

      expect(result.downloadUrl).toBe('https://example.com/download.zip');
    });

    it('should include created timestamp', () => {
      const result = ResultBuilder.buildResult({
        characterData: mockCharacterData,
        images: [Buffer.from(validPngBase64, 'base64')],
      });

      expect(result.created).toBe('2025-01-15T10:00:00Z');
    });
  });

  describe('multi-directional sprites', () => {
    it('should build result for 8-directional sprite', () => {
      const eightDirections = [
        { direction: 'south' as const, url: 'https://example.com/south.png' },
        { direction: 'south-west' as const, url: 'https://example.com/south-west.png' },
        { direction: 'west' as const, url: 'https://example.com/west.png' },
        { direction: 'north-west' as const, url: 'https://example.com/north-west.png' },
        { direction: 'north' as const, url: 'https://example.com/north.png' },
        { direction: 'north-east' as const, url: 'https://example.com/north-east.png' },
        { direction: 'east' as const, url: 'https://example.com/east.png' },
        { direction: 'south-east' as const, url: 'https://example.com/south-east.png' },
      ];

      const data = {
        ...mockCharacterData,
        rotations: eightDirections,
      };

      const images = Array(8).fill(Buffer.from(validPngBase64, 'base64'));

      const result = ResultBuilder.buildResult({
        characterData: data,
        images,
      });

      expect(result.directions).toHaveLength(8);
      expect(result.directions[0].direction).toBe('south');
      expect(result.directions[7].direction).toBe('south-east');
    });

    it('should build result for 4-directional sprite', () => {
      const fourDirections = [
        { direction: 'south' as const, url: 'https://example.com/south.png' },
        { direction: 'west' as const, url: 'https://example.com/west.png' },
        { direction: 'north' as const, url: 'https://example.com/north.png' },
        { direction: 'east' as const, url: 'https://example.com/east.png' },
      ];

      const data = {
        ...mockCharacterData,
        specifications: {
          ...mockCharacterData.specifications,
          directions: 4 as const,
        },
        rotations: fourDirections,
      };

      const images = Array(4).fill(Buffer.from(validPngBase64, 'base64'));

      const result = ResultBuilder.buildResult({
        characterData: data,
        images,
      });

      expect(result.directions).toHaveLength(4);
      expect(result.specifications.directions).toBe(4);
    });

    it('should preserve direction order', () => {
      const result = ResultBuilder.buildResult({
        characterData: mockCharacterData,
        images: [
          Buffer.from(validPngBase64, 'base64'),
          Buffer.from(validPngBase64, 'base64'),
        ],
      });

      expect(result.directions[0].direction).toBe('south');
      expect(result.directions[1].direction).toBe('north');
    });
  });

  describe('image processing', () => {
    it('should attach buffer to each direction', () => {
      const buffer = Buffer.from(validPngBase64, 'base64');

      const result = ResultBuilder.buildResult({
        characterData: mockCharacterData,
        images: [buffer],
      });

      expect(result.directions[0].buffer).toEqual(buffer);
    });

    it('should include image URL from API', () => {
      const result = ResultBuilder.buildResult({
        characterData: mockCharacterData,
        images: [Buffer.from(validPngBase64, 'base64')],
      });

      expect(result.directions[0].url).toBe('https://example.com/south.png');
    });

    it('should handle multiple images', () => {
      const buffer1 = Buffer.from(validPngBase64, 'base64');
      const buffer2 = Buffer.from(png48x48Base64, 'base64');

      const result = ResultBuilder.buildResult({
        characterData: mockCharacterData,
        images: [buffer1, buffer2],
      });

      expect(result.directions).toHaveLength(2);
      expect(result.directions[0].buffer).toEqual(buffer1);
      expect(result.directions[1].buffer).toEqual(buffer2);
    });
  });

  describe('error handling', () => {
    it('should throw error for zero images', () => {
      expect(() =>
        ResultBuilder.buildResult({
          characterData: mockCharacterData,
          images: [],
        })
      ).toThrow(PixelLabError);
    });

    it('should throw error for mismatched counts', () => {
      const data = {
        ...mockCharacterData,
        rotations: [
          { direction: 'south' as const, url: 'https://example.com/south.png' },
        ],
      };

      const images = [
        Buffer.from(validPngBase64, 'base64'),
        Buffer.from(validPngBase64, 'base64'),
      ];

      expect(() =>
        ResultBuilder.buildResult({
          characterData: data,
          images,
        })
      ).toThrow(PixelLabError);
    });

    it('should handle null name gracefully', () => {
      const data = {
        ...mockCharacterData,
        name: null,
      };

      const result = ResultBuilder.buildResult({
        characterData: data,
        images: [Buffer.from(validPngBase64, 'base64')],
      });

      expect(result.name).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle minimum valid result', () => {
      const minimal = {
        id: 'char-123',
        name: null,
        created: '2025-01-15T10:00:00Z',
        specifications: {
          directions: 4 as const,
          canvas_size: '32x32',
          view: 'low top-down',
        },
        style: {
          outline: 'lineless',
          shading: 'flat shading',
          detail: 'low detail',
        },
        rotations: [
          { direction: 'south' as const, url: 'https://example.com/south.png' },
        ],
        download_url: 'https://example.com/download.zip',
      };

      const result = ResultBuilder.buildResult({
        characterData: minimal,
        images: [Buffer.from(validPngBase64, 'base64')],
      });

      expect(result.characterId).toBe('char-123');
      expect(result.directions).toHaveLength(1);
    });

    it('should convert snake_case to camelCase', () => {
      const result = ResultBuilder.buildResult({
        characterData: mockCharacterData,
        images: [Buffer.from(validPngBase64, 'base64')],
      });

      expect(result.downloadUrl).toBeDefined();
      expect(result.specifications.canvasSize).toBeDefined();
      expect((result as any).download_url).toBeUndefined();
      expect((result as any).canvas_size).toBeUndefined();
    });
  });
});
