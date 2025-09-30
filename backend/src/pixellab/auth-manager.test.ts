import { describe, it, expect } from 'vitest';
import { AuthManager } from './auth-manager';
import { PixelLabError, PixelLabErrorType } from './errors';

describe('AuthManager - Task 2.1: API Key Validation', () => {
  describe('validateApiKey', () => {
    it('should accept valid API key', () => {
      const validKey = 'c1994b12-b97e-4b29-9991-180e3a0ebe55';

      expect(() => AuthManager.validateApiKey(validKey)).not.toThrow();
    });

    it('should reject empty string', () => {
      expect(() => AuthManager.validateApiKey('')).toThrow(PixelLabError);
      expect(() => AuthManager.validateApiKey('')).toThrow('API key is required');
    });

    it('should reject null', () => {
      expect(() => AuthManager.validateApiKey(null as any)).toThrow(PixelLabError);
    });

    it('should reject undefined', () => {
      expect(() => AuthManager.validateApiKey(undefined as any)).toThrow(PixelLabError);
    });

    it('should reject keys shorter than minimum length', () => {
      const shortKey = 'abc123'; // Less than 32 characters

      expect(() => AuthManager.validateApiKey(shortKey)).toThrow(PixelLabError);
      expect(() => AuthManager.validateApiKey(shortKey)).toThrow('at least 32 characters');
    });

    it('should reject keys with invalid characters', () => {
      const keyWithSpaces = 'c1994b12 b97e 4b29 9991 180e3a0ebe55';

      expect(() => AuthManager.validateApiKey(keyWithSpaces)).toThrow(PixelLabError);
      expect(() => AuthManager.validateApiKey(keyWithSpaces)).toThrow('alphanumeric');
    });

    it('should throw PixelLabError with correct type', () => {
      try {
        AuthManager.validateApiKey('');
      } catch (error) {
        expect(error).toBeInstanceOf(PixelLabError);
        expect((error as PixelLabError).type).toBe(PixelLabErrorType.AUTHENTICATION);
      }
    });
  });

  describe('edge cases', () => {
    it('should reject whitespace-only string', () => {
      expect(() => AuthManager.validateApiKey('   ')).toThrow(PixelLabError);
    });

    it('should reject key with leading whitespace', () => {
      const keyWithLeading = ' c1994b12-b97e-4b29-9991-180e3a0ebe55';

      expect(() => AuthManager.validateApiKey(keyWithLeading)).toThrow(PixelLabError);
    });

    it('should reject key with trailing whitespace', () => {
      const keyWithTrailing = 'c1994b12-b97e-4b29-9991-180e3a0ebe55 ';

      expect(() => AuthManager.validateApiKey(keyWithTrailing)).toThrow(PixelLabError);
    });

    it('should reject key with Unicode characters', () => {
      const keyWithUnicode = 'c1994b12-b97e-4b29-9991-180e3a0ebe5ñ';

      expect(() => AuthManager.validateApiKey(keyWithUnicode)).toThrow(PixelLabError);
    });

    it('should accept key with hyphens', () => {
      const keyWithHyphens = 'c1994b12-b97e-4b29-9991-180e3a0ebe55';

      expect(() => AuthManager.validateApiKey(keyWithHyphens)).not.toThrow();
    });

    it('should reject key with special symbols', () => {
      const keyWithSymbols = 'c1994b12-b97e-4b29-9991-180e3a0ebe5$';

      expect(() => AuthManager.validateApiKey(keyWithSymbols)).toThrow(PixelLabError);
    });
  });

  describe('isValidFormat', () => {
    it('should return true for valid format', () => {
      const validKey = 'c1994b12-b97e-4b29-9991-180e3a0ebe55';

      expect(AuthManager.isValidFormat(validKey)).toBe(true);
    });

    it('should return false for invalid format', () => {
      const invalidKey = 'invalid key!';

      expect(AuthManager.isValidFormat(invalidKey)).toBe(false);
    });

    it('should return false for short key', () => {
      const shortKey = 'abc123';

      expect(AuthManager.isValidFormat(shortKey)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(AuthManager.isValidFormat('')).toBe(false);
    });
  });
});
