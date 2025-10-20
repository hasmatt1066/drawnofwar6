import { describe, it, expect } from 'vitest';
import { ImageDecoder } from '../image-decoder';
import { PixelLabError, PixelLabErrorType } from '../errors';

describe('Image Decoder - Task 5.1: Base64 Image Decoder', () => {
  // Valid 1x1 red PNG in base64
  const validPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

  // Valid 2x2 transparent PNG in base64
  const validPng2x2Base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mNgYGD4z8DAwMDAwAAGAA78Agwzw3rqAAAAAElFTkSuQmCC';

  describe('single image decoding', () => {
    it('should decode single base64 string to buffer', () => {
      const buffer = ImageDecoder.decodeBase64(validPngBase64);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should validate PNG magic bytes', () => {
      const buffer = ImageDecoder.decodeBase64(validPngBase64);

      // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
      expect(buffer[0]).toBe(0x89);
      expect(buffer[1]).toBe(0x50);
      expect(buffer[2]).toBe(0x4e);
      expect(buffer[3]).toBe(0x47);
    });

    it('should decode different sized images', () => {
      const buffer1 = ImageDecoder.decodeBase64(validPngBase64);
      const buffer2 = ImageDecoder.decodeBase64(validPng2x2Base64);

      expect(buffer1).toBeInstanceOf(Buffer);
      expect(buffer2).toBeInstanceOf(Buffer);
      expect(buffer1.length).not.toBe(buffer2.length);
    });
  });

  describe('array decoding', () => {
    it('should decode array of base64 strings to array of buffers', () => {
      const base64Array = [validPngBase64, validPng2x2Base64];

      const buffers = ImageDecoder.decodeBase64Array(base64Array);

      expect(buffers).toHaveLength(2);
      expect(buffers[0]).toBeInstanceOf(Buffer);
      expect(buffers[1]).toBeInstanceOf(Buffer);
    });

    it('should preserve image order in arrays', () => {
      const base64Array = [validPng2x2Base64, validPngBase64, validPng2x2Base64];

      const buffers = ImageDecoder.decodeBase64Array(base64Array);

      expect(buffers).toHaveLength(3);
      // First and third should be same (2x2), middle should be different (1x1)
      expect(buffers[0].equals(buffers[2])).toBe(true);
      expect(buffers[0].equals(buffers[1])).toBe(false);
    });

    it('should handle empty array', () => {
      const buffers = ImageDecoder.decodeBase64Array([]);

      expect(buffers).toHaveLength(0);
    });

    it('should handle single element array', () => {
      const buffers = ImageDecoder.decodeBase64Array([validPngBase64]);

      expect(buffers).toHaveLength(1);
      expect(buffers[0]).toBeInstanceOf(Buffer);
    });
  });

  describe('error handling', () => {
    it('should throw error for invalid base64', () => {
      const invalidBase64 = 'not-valid-base64!@#$%';

      expect(() => ImageDecoder.decodeBase64(invalidBase64)).toThrow(PixelLabError);
    });

    it('should throw error for empty string', () => {
      expect(() => ImageDecoder.decodeBase64('')).toThrow(PixelLabError);
    });

    it('should throw error for non-PNG data', () => {
      // Valid base64 but not PNG data (just "hello")
      const nonPngBase64 = 'aGVsbG8=';

      expect(() => ImageDecoder.decodeBase64(nonPngBase64)).toThrow(PixelLabError);
      expect(() => ImageDecoder.decodeBase64(nonPngBase64)).toThrow('Not a valid PNG');
    });

    it('should throw error with correct type for invalid base64', () => {
      const invalidBase64 = '!!!invalid!!!';

      try {
        ImageDecoder.decodeBase64(invalidBase64);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(PixelLabError);
        expect((error as PixelLabError).type).toBe(PixelLabErrorType.INVALID_REQUEST);
      }
    });

    it('should throw error for truncated base64', () => {
      const truncated = validPngBase64.substring(0, 20);

      expect(() => ImageDecoder.decodeBase64(truncated)).toThrow(PixelLabError);
    });
  });

  describe('edge cases', () => {
    it('should handle base64 with whitespace', () => {
      const withWhitespace = `  ${validPngBase64}  `;

      const buffer = ImageDecoder.decodeBase64(withWhitespace);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer[0]).toBe(0x89); // PNG magic byte
    });

    it('should handle base64 with newlines', () => {
      const withNewlines = validPngBase64.substring(0, 20) + '\n' + validPngBase64.substring(20);

      const buffer = ImageDecoder.decodeBase64(withNewlines);

      expect(buffer).toBeInstanceOf(Buffer);
    });

    it('should handle minimum valid PNG', () => {
      // Very small but valid PNG
      const buffer = ImageDecoder.decodeBase64(validPngBase64);

      expect(buffer.length).toBeGreaterThanOrEqual(8); // Minimum PNG size
    });

    it('should reject buffer smaller than PNG header', () => {
      // Base64 that decodes to less than 8 bytes
      const tooSmall = 'YWJj'; // "abc" - only 3 bytes

      expect(() => ImageDecoder.decodeBase64(tooSmall)).toThrow(PixelLabError);
    });

    it('should handle array with one invalid element', () => {
      const mixedArray = [validPngBase64, 'invalid!'];

      expect(() => ImageDecoder.decodeBase64Array(mixedArray)).toThrow(PixelLabError);
    });
  });

  describe('performance', () => {
    it('should handle large arrays efficiently', () => {
      const largeArray = Array(100).fill(validPngBase64);

      const buffers = ImageDecoder.decodeBase64Array(largeArray);

      expect(buffers).toHaveLength(100);
      buffers.forEach((buffer) => {
        expect(buffer).toBeInstanceOf(Buffer);
      });
    });
  });
});
