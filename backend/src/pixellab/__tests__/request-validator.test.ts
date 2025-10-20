import { describe, it, expect } from 'vitest';
import { RequestValidator, GenerationRequest } from '../request-validator';
import { PixelLabError, PixelLabErrorType } from '../errors';

describe('Request Validator - Task 3.3: Payload Validation', () => {
  const validRequest: GenerationRequest = {
    description: 'a wizard with blue robes',
    size: 48,
    detail: 'medium detail',
    shading: 'basic shading',
    outline: 'single color black outline',
    view: 'low top-down',
    nDirections: 8,
  };

  describe('description validation', () => {
    it('should accept valid description', () => {
      expect(() => RequestValidator.validateGenerationRequest(validRequest)).not.toThrow();
    });

    it('should reject empty description', () => {
      const invalid = { ...validRequest, description: '' };

      expect(() => RequestValidator.validateGenerationRequest(invalid)).toThrow(PixelLabError);
      expect(() => RequestValidator.validateGenerationRequest(invalid)).toThrow('Description is required');
    });

    it('should reject whitespace-only description', () => {
      const invalid = { ...validRequest, description: '   ' };

      expect(() => RequestValidator.validateGenerationRequest(invalid)).toThrow(PixelLabError);
    });

    it('should accept very long description', () => {
      const longDescription = 'a'.repeat(10000);
      const request = { ...validRequest, description: longDescription };

      expect(() => RequestValidator.validateGenerationRequest(request)).not.toThrow();
    });
  });

  describe('size validation', () => {
    it('should accept 32px', () => {
      const request = { ...validRequest, size: 32 };

      expect(() => RequestValidator.validateGenerationRequest(request)).not.toThrow();
    });

    it('should accept 48px', () => {
      const request = { ...validRequest, size: 48 };

      expect(() => RequestValidator.validateGenerationRequest(request)).not.toThrow();
    });

    it('should accept 64px', () => {
      const request = { ...validRequest, size: 64 };

      expect(() => RequestValidator.validateGenerationRequest(request)).not.toThrow();
    });

    it('should accept 128px', () => {
      const request = { ...validRequest, size: 128 };

      expect(() => RequestValidator.validateGenerationRequest(request)).not.toThrow();
    });

    it('should reject size below 32px', () => {
      const invalid = { ...validRequest, size: 16 };

      expect(() => RequestValidator.validateGenerationRequest(invalid)).toThrow(PixelLabError);
      expect(() => RequestValidator.validateGenerationRequest(invalid)).toThrow('Size must be one of');
    });

    it('should reject size above 128px', () => {
      const invalid = { ...validRequest, size: 256 };

      expect(() => RequestValidator.validateGenerationRequest(invalid)).toThrow(PixelLabError);
    });

    it('should reject invalid size value', () => {
      const invalid = { ...validRequest, size: 50 };

      expect(() => RequestValidator.validateGenerationRequest(invalid)).toThrow(PixelLabError);
    });

    it('should reject extremely small size', () => {
      const invalid = { ...validRequest, size: 1 };

      expect(() => RequestValidator.validateGenerationRequest(invalid)).toThrow(PixelLabError);
    });

    it('should reject extremely large size', () => {
      const invalid = { ...validRequest, size: 512 };

      expect(() => RequestValidator.validateGenerationRequest(invalid)).toThrow(PixelLabError);
    });
  });

  describe('detail level validation', () => {
    it('should accept "low detail"', () => {
      const request = { ...validRequest, detail: 'low detail' as const };

      expect(() => RequestValidator.validateGenerationRequest(request)).not.toThrow();
    });

    it('should accept "medium detail"', () => {
      const request = { ...validRequest, detail: 'medium detail' as const };

      expect(() => RequestValidator.validateGenerationRequest(request)).not.toThrow();
    });

    it('should accept "high detail"', () => {
      const request = { ...validRequest, detail: 'high detail' as const };

      expect(() => RequestValidator.validateGenerationRequest(request)).not.toThrow();
    });

    it('should reject invalid detail level', () => {
      const invalid = { ...validRequest, detail: 'ultra detail' as any };

      expect(() => RequestValidator.validateGenerationRequest(invalid)).toThrow(PixelLabError);
      expect(() => RequestValidator.validateGenerationRequest(invalid)).toThrow('Detail must be one of');
    });

    it('should accept undefined detail (optional)', () => {
      const request = { ...validRequest, detail: undefined };

      expect(() => RequestValidator.validateGenerationRequest(request)).not.toThrow();
    });
  });

  describe('shading validation', () => {
    it('should accept "flat shading"', () => {
      const request = { ...validRequest, shading: 'flat shading' as const };

      expect(() => RequestValidator.validateGenerationRequest(request)).not.toThrow();
    });

    it('should accept "basic shading"', () => {
      const request = { ...validRequest, shading: 'basic shading' as const };

      expect(() => RequestValidator.validateGenerationRequest(request)).not.toThrow();
    });

    it('should accept "medium shading"', () => {
      const request = { ...validRequest, shading: 'medium shading' as const };

      expect(() => RequestValidator.validateGenerationRequest(request)).not.toThrow();
    });

    it('should accept "detailed shading"', () => {
      const request = { ...validRequest, shading: 'detailed shading' as const };

      expect(() => RequestValidator.validateGenerationRequest(request)).not.toThrow();
    });

    it('should reject invalid shading level', () => {
      const invalid = { ...validRequest, shading: 'ultra shading' as any };

      expect(() => RequestValidator.validateGenerationRequest(invalid)).toThrow(PixelLabError);
    });

    it('should accept undefined shading (optional)', () => {
      const request = { ...validRequest, shading: undefined };

      expect(() => RequestValidator.validateGenerationRequest(request)).not.toThrow();
    });
  });

  describe('directions validation', () => {
    it('should accept 4 directions', () => {
      const request = { ...validRequest, nDirections: 4 };

      expect(() => RequestValidator.validateGenerationRequest(request)).not.toThrow();
    });

    it('should accept 8 directions', () => {
      const request = { ...validRequest, nDirections: 8 };

      expect(() => RequestValidator.validateGenerationRequest(request)).not.toThrow();
    });

    it('should reject invalid direction count', () => {
      const invalid = { ...validRequest, nDirections: 6 };

      expect(() => RequestValidator.validateGenerationRequest(invalid)).toThrow(PixelLabError);
      expect(() => RequestValidator.validateGenerationRequest(invalid)).toThrow('Directions must be 4 or 8');
    });

    it('should accept undefined directions (optional)', () => {
      const request = { ...validRequest, nDirections: undefined };

      expect(() => RequestValidator.validateGenerationRequest(request)).not.toThrow();
    });
  });

  describe('numeric parameter validation', () => {
    it('should accept valid AI freedom value', () => {
      const request = { ...validRequest, aiFreedom: 750 };

      expect(() => RequestValidator.validateGenerationRequest(request)).not.toThrow();
    });

    it('should reject AI freedom below minimum', () => {
      const invalid = { ...validRequest, aiFreedom: 50 };

      expect(() => RequestValidator.validateGenerationRequest(invalid)).toThrow(PixelLabError);
      expect(() => RequestValidator.validateGenerationRequest(invalid)).toThrow('AI freedom must be between');
    });

    it('should reject AI freedom above maximum', () => {
      const invalid = { ...validRequest, aiFreedom: 1000 };

      expect(() => RequestValidator.validateGenerationRequest(invalid)).toThrow(PixelLabError);
    });

    it('should accept valid text guidance scale', () => {
      const request = { ...validRequest, textGuidanceScale: 8 };

      expect(() => RequestValidator.validateGenerationRequest(request)).not.toThrow();
    });

    it('should reject text guidance scale below minimum', () => {
      const invalid = { ...validRequest, textGuidanceScale: 0.5 };

      expect(() => RequestValidator.validateGenerationRequest(invalid)).toThrow(PixelLabError);
    });

    it('should reject text guidance scale above maximum', () => {
      const invalid = { ...validRequest, textGuidanceScale: 25 };

      expect(() => RequestValidator.validateGenerationRequest(invalid)).toThrow(PixelLabError);
    });
  });

  describe('base64 image validation', () => {
    it('should accept valid base64 PNG', () => {
      // Simple 1x1 red PNG in base64
      const validBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
      const request = { ...validRequest, initImage: validBase64 };

      expect(() => RequestValidator.validateGenerationRequest(request)).not.toThrow();
    });

    it('should reject malformed base64', () => {
      const invalid = { ...validRequest, initImage: 'not-valid-base64!@#$' };

      expect(() => RequestValidator.validateGenerationRequest(invalid)).toThrow(PixelLabError);
      expect(() => RequestValidator.validateGenerationRequest(invalid)).toThrow('Invalid base64 image');
    });

    it('should accept undefined initImage (optional)', () => {
      const request = { ...validRequest, initImage: undefined };

      expect(() => RequestValidator.validateGenerationRequest(request)).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should provide clear error for multiple validation failures', () => {
      const invalid = {
        description: '',
        size: 256,
        detail: 'invalid' as any,
        shading: 'basic shading',
        outline: 'single color black outline',
        view: 'low top-down',
        nDirections: 8,
      };

      try {
        RequestValidator.validateGenerationRequest(invalid);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(PixelLabError);
        expect((error as PixelLabError).type).toBe(PixelLabErrorType.INVALID_REQUEST);
      }
    });

    it('should handle missing required fields', () => {
      const invalid = {
        size: 48,
      } as any;

      expect(() => RequestValidator.validateGenerationRequest(invalid)).toThrow(PixelLabError);
    });

    it('should handle null values', () => {
      const invalid = { ...validRequest, description: null as any };

      expect(() => RequestValidator.validateGenerationRequest(invalid)).toThrow(PixelLabError);
    });
  });

  describe('complete request validation', () => {
    it('should accept minimal valid request', () => {
      const minimal: GenerationRequest = {
        description: 'wizard',
        size: 32,
      };

      expect(() => RequestValidator.validateGenerationRequest(minimal)).not.toThrow();
    });

    it('should accept request with all optional fields', () => {
      const complete: GenerationRequest = {
        description: 'wizard with blue robes',
        size: 64,
        detail: 'high detail',
        shading: 'detailed shading',
        outline: 'single color black outline',
        view: 'high top-down',
        nDirections: 8,
        aiFreedom: 800,
        textGuidanceScale: 10,
        initImage: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
      };

      expect(() => RequestValidator.validateGenerationRequest(complete)).not.toThrow();
    });
  });
});
