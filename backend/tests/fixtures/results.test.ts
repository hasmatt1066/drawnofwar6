/**
 * Tests for Result Fixtures
 *
 * Verifies that result fixtures are valid, deterministic, and contain proper data.
 */

import { describe, it, expect } from 'vitest';
import {
  createMinimalImageBuffer,
  createSmallImageBuffer,
  createMinimalSpriteResult,
  createTypicalSpriteResult,
  createMaximalSpriteResult,
  createCachedSpriteResult,
  createMinimalGenerationResult,
  createTypicalGenerationResult,
  createMaximalGenerationResult,
} from './results.js';

describe('Result Fixtures', () => {
  describe('Image Buffer Fixtures', () => {
    describe('createMinimalImageBuffer', () => {
      it('should create a valid PNG buffer', () => {
        const buffer = createMinimalImageBuffer();

        expect(buffer).toBeInstanceOf(Buffer);
        expect(buffer.length).toBeGreaterThan(0);
      });

      it('should be deterministic', () => {
        const buffer1 = createMinimalImageBuffer();
        const buffer2 = createMinimalImageBuffer();

        expect(buffer1.equals(buffer2)).toBe(true);
      });

      it('should have PNG signature', () => {
        const buffer = createMinimalImageBuffer();

        // PNG signature: 89 50 4E 47 0D 0A 1A 0A
        expect(buffer[0]).toBe(0x89);
        expect(buffer[1]).toBe(0x50);
        expect(buffer[2]).toBe(0x4e);
        expect(buffer[3]).toBe(0x47);
      });
    });

    describe('createSmallImageBuffer', () => {
      it('should create a valid PNG buffer', () => {
        const buffer = createSmallImageBuffer();

        expect(buffer).toBeInstanceOf(Buffer);
        expect(buffer.length).toBeGreaterThan(0);
      });

      it('should be deterministic', () => {
        const buffer1 = createSmallImageBuffer();
        const buffer2 = createSmallImageBuffer();

        expect(buffer1.equals(buffer2)).toBe(true);
      });

      it('should have PNG signature', () => {
        const buffer = createSmallImageBuffer();

        expect(buffer[0]).toBe(0x89);
        expect(buffer[1]).toBe(0x50);
        expect(buffer[2]).toBe(0x4e);
        expect(buffer[3]).toBe(0x47);
      });
    });
  });

  describe('SpriteGenerationResult Fixtures', () => {
    describe('createMinimalSpriteResult', () => {
      it('should create a valid minimal sprite result', () => {
        const result = createMinimalSpriteResult();

        expect(result).toBeDefined();
        expect(result.jobId).toBe('test-job-minimal');
        expect(result.frames).toHaveLength(1);
        expect(result.metadata.dimensions.width).toBe(32);
        expect(result.metadata.dimensions.height).toBe(32);
        expect(result.metadata.frameCount).toBe(1);
        expect(result.metadata.cacheHit).toBe(false);
      });

      it('should be deterministic', () => {
        const result1 = createMinimalSpriteResult();
        const result2 = createMinimalSpriteResult();

        expect(result1.jobId).toEqual(result2.jobId);
        expect(result1.metadata).toEqual(result2.metadata);
        expect(result1.frames.length).toEqual(result2.frames.length);
      });

      it('should have valid frame buffers', () => {
        const result = createMinimalSpriteResult();

        result.frames.forEach((frame) => {
          expect(frame).toBeInstanceOf(Buffer);
          expect(frame.length).toBeGreaterThan(0);
        });
      });
    });

    describe('createTypicalSpriteResult', () => {
      it('should create a valid typical sprite result with 4 frames', () => {
        const result = createTypicalSpriteResult();

        expect(result).toBeDefined();
        expect(result.jobId).toBe('test-job-typical');
        expect(result.frames).toHaveLength(4);
        expect(result.metadata.dimensions.width).toBe(64);
        expect(result.metadata.dimensions.height).toBe(64);
        expect(result.metadata.frameCount).toBe(4);
        expect(result.metadata.cacheHit).toBe(false);
        expect(result.metadata.pixelLabJobId).toBe('pixellab-123');
      });

      it('should be deterministic', () => {
        const result1 = createTypicalSpriteResult();
        const result2 = createTypicalSpriteResult();

        expect(result1.jobId).toEqual(result2.jobId);
        expect(result1.metadata).toEqual(result2.metadata);
      });
    });

    describe('createMaximalSpriteResult', () => {
      it('should create a valid maximal sprite result with 8 frames', () => {
        const result = createMaximalSpriteResult();

        expect(result).toBeDefined();
        expect(result.jobId).toBe('test-job-maximal');
        expect(result.frames).toHaveLength(8);
        expect(result.metadata.dimensions.width).toBe(128);
        expect(result.metadata.dimensions.height).toBe(128);
        expect(result.metadata.frameCount).toBe(8);
      });

      it('should be deterministic', () => {
        const result1 = createMaximalSpriteResult();
        const result2 = createMaximalSpriteResult();

        expect(result1.jobId).toEqual(result2.jobId);
        expect(result1.metadata).toEqual(result2.metadata);
      });
    });

    describe('createCachedSpriteResult', () => {
      it('should create a cached sprite result', () => {
        const result = createCachedSpriteResult();

        expect(result).toBeDefined();
        expect(result.metadata.cacheHit).toBe(true);
        expect(result.metadata.generationTimeMs).toBeLessThan(1000);
      });

      it('should be deterministic', () => {
        const result1 = createCachedSpriteResult();
        const result2 = createCachedSpriteResult();

        expect(result1.metadata).toEqual(result2.metadata);
      });
    });
  });

  describe('GenerationResult Fixtures (PixelLab API)', () => {
    describe('createMinimalGenerationResult', () => {
      it('should create a valid minimal generation result', () => {
        const result = createMinimalGenerationResult();

        expect(result).toBeDefined();
        expect(result.characterId).toBe('char-minimal-123');
        expect(result.name).toBeNull();
        expect(result.specifications.directions).toBe(4);
        expect(result.specifications.canvasSize).toBe('32x32');
        expect(result.directions).toHaveLength(4);
      });

      it('should be deterministic', () => {
        const result1 = createMinimalGenerationResult();
        const result2 = createMinimalGenerationResult();

        expect(result1.characterId).toEqual(result2.characterId);
        expect(result1.specifications).toEqual(result2.specifications);
      });

      it('should have valid direction results', () => {
        const result = createMinimalGenerationResult();

        expect(result.directions).toHaveLength(4);
        result.directions.forEach((dir) => {
          expect(dir.direction).toBeDefined();
          expect(dir.url).toContain('https://');
          expect(dir.buffer).toBeInstanceOf(Buffer);
        });
      });

      it('should have correct direction names for 4-direction sprite', () => {
        const result = createMinimalGenerationResult();

        const directionNames = result.directions.map((d) => d.direction);
        expect(directionNames).toContain('north');
        expect(directionNames).toContain('east');
        expect(directionNames).toContain('south');
        expect(directionNames).toContain('west');
      });
    });

    describe('createTypicalGenerationResult', () => {
      it('should create a valid typical generation result with 8 directions', () => {
        const result = createTypicalGenerationResult();

        expect(result).toBeDefined();
        expect(result.characterId).toBe('char-typical-456');
        expect(result.name).toBe('brave-knight');
        expect(result.specifications.directions).toBe(8);
        expect(result.specifications.canvasSize).toBe('64x64');
        expect(result.directions).toHaveLength(8);
      });

      it('should be deterministic', () => {
        const result1 = createTypicalGenerationResult();
        const result2 = createTypicalGenerationResult();

        expect(result1.characterId).toEqual(result2.characterId);
        expect(result1.specifications).toEqual(result2.specifications);
      });

      it('should have all 8 directions', () => {
        const result = createTypicalGenerationResult();

        const directionNames = result.directions.map((d) => d.direction);
        expect(directionNames).toContain('north');
        expect(directionNames).toContain('north-east');
        expect(directionNames).toContain('east');
        expect(directionNames).toContain('south-east');
        expect(directionNames).toContain('south');
        expect(directionNames).toContain('south-west');
        expect(directionNames).toContain('west');
        expect(directionNames).toContain('north-west');
      });
    });

    describe('createMaximalGenerationResult', () => {
      it('should create a valid maximal generation result', () => {
        const result = createMaximalGenerationResult();

        expect(result).toBeDefined();
        expect(result.characterId).toBe('char-maximal-789');
        expect(result.name).toBe('epic-dragon');
        expect(result.specifications.directions).toBe(8);
        expect(result.specifications.canvasSize).toBe('128x128');
        expect(result.style.outline).toBe('selective outline');
        expect(result.style.shading).toBe('detailed shading');
        expect(result.style.detail).toBe('high detail');
      });

      it('should be deterministic', () => {
        const result1 = createMaximalGenerationResult();
        const result2 = createMaximalGenerationResult();

        expect(result1.characterId).toEqual(result2.characterId);
        expect(result1.specifications).toEqual(result2.specifications);
        expect(result1.style).toEqual(result2.style);
      });

      it('should have valid URLs', () => {
        const result = createMaximalGenerationResult();

        expect(result.downloadUrl).toContain('https://');
        result.directions.forEach((dir) => {
          expect(dir.url).toContain('https://');
          expect(dir.url).toContain(result.characterId);
        });
      });
    });
  });
});
