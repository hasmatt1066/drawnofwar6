/**
 * Tests for Prompt Fixtures
 *
 * Verifies that prompt fixtures are valid, deterministic, and pass validation.
 */

import { describe, it, expect } from 'vitest';
import {
  createMinimalPrompt,
  createTypicalPrompt,
  createMaximalPrompt,
  createInvalidPrompt,
  createEdgeCasePrompt,
  createMaxTextGuidancePrompt,
  createLargeSizePrompt,
} from './prompts.js';

describe('Prompt Fixtures', () => {
  describe('createMinimalPrompt', () => {
    it('should create a valid minimal prompt with only required fields', () => {
      const prompt = createMinimalPrompt();

      expect(prompt).toBeDefined();
      expect(prompt.type).toBe('character');
      expect(prompt.style).toBe('pixel-art');
      expect(prompt.size.width).toBe(32);
      expect(prompt.size.height).toBe(32);
      expect(prompt.action).toBe('idle');
      expect(prompt.description).toBe('A brave knight');
      expect(prompt.raw).toBe('knight');
      expect(prompt.options).toBeUndefined();
    });

    it('should be deterministic (same output each call)', () => {
      const prompt1 = createMinimalPrompt();
      const prompt2 = createMinimalPrompt();

      expect(prompt1).toEqual(prompt2);
    });

    it('should have non-empty required fields', () => {
      const prompt = createMinimalPrompt();

      expect(prompt.type.length).toBeGreaterThan(0);
      expect(prompt.style.length).toBeGreaterThan(0);
      expect(prompt.description.length).toBeGreaterThan(0);
      expect(prompt.raw.length).toBeGreaterThan(0);
    });

    it('should have valid size values', () => {
      const prompt = createMinimalPrompt();

      expect(prompt.size.width).toBeGreaterThan(0);
      expect(prompt.size.height).toBeGreaterThan(0);
    });
  });

  describe('createTypicalPrompt', () => {
    it('should create a valid typical prompt with optional fields', () => {
      const prompt = createTypicalPrompt();

      expect(prompt).toBeDefined();
      expect(prompt.type).toBe('character');
      expect(prompt.style).toBe('pixel-art');
      expect(prompt.size.width).toBe(64);
      expect(prompt.size.height).toBe(64);
      expect(prompt.action).toBe('walking');
      expect(prompt.description).toBe('A brave knight with golden armor');
      expect(prompt.raw).toBe('knight with golden armor walking');
      expect(prompt.options).toBeDefined();
      expect(prompt.options?.noBackground).toBe(true);
      expect(prompt.options?.textGuidanceScale).toBe(7.5);
    });

    it('should be deterministic', () => {
      const prompt1 = createTypicalPrompt();
      const prompt2 = createTypicalPrompt();

      expect(prompt1).toEqual(prompt2);
    });

    it('should have valid text guidance scale', () => {
      const prompt = createTypicalPrompt();

      expect(prompt.options?.textGuidanceScale).toBeGreaterThanOrEqual(1.0);
      expect(prompt.options?.textGuidanceScale).toBeLessThanOrEqual(20.0);
    });
  });

  describe('createMaximalPrompt', () => {
    it('should create a valid maximal prompt with all optional fields', () => {
      const prompt = createMaximalPrompt();

      expect(prompt).toBeDefined();
      expect(prompt.type).toBe('character');
      expect(prompt.style).toBe('pixel-art');
      expect(prompt.size.width).toBe(128);
      expect(prompt.size.height).toBe(128);
      expect(prompt.action).toBe('attacking');
      expect(prompt.description).toContain('knight');
      expect(prompt.options).toBeDefined();
      expect(prompt.options?.noBackground).toBe(true);
      expect(prompt.options?.textGuidanceScale).toBe(10.0);
      expect(prompt.options?.paletteImage).toBeDefined();
      expect(typeof prompt.options?.paletteImage).toBe('string');
    });

    it('should be deterministic', () => {
      const prompt1 = createMaximalPrompt();
      const prompt2 = createMaximalPrompt();

      expect(prompt1).toEqual(prompt2);
    });

    it('should have valid palette image (base64)', () => {
      const prompt = createMaximalPrompt();

      expect(prompt.options?.paletteImage).toBeDefined();
      expect(prompt.options?.paletteImage?.length).toBeGreaterThan(0);

      // Test base64 can be decoded
      const decoded = Buffer.from(prompt.options!.paletteImage!, 'base64');
      expect(decoded).toBeInstanceOf(Buffer);
    });
  });

  describe('createInvalidPrompt', () => {
    it('should create an invalid prompt for negative testing', () => {
      const prompt = createInvalidPrompt();

      expect(prompt).toBeDefined();
      expect(prompt.type).toBe('');
      expect(prompt.style).toBe('');
      expect(prompt.size.width).toBe(0);
      expect(prompt.size.height).toBe(0);
      expect(prompt.action).toBe('');
      expect(prompt.description).toBe('');
      expect(prompt.raw).toBe('');
    });

    it('should be deterministic', () => {
      const prompt1 = createInvalidPrompt();
      const prompt2 = createInvalidPrompt();

      expect(prompt1).toEqual(prompt2);
    });
  });

  describe('createEdgeCasePrompt', () => {
    it('should create a prompt with edge case values', () => {
      const prompt = createEdgeCasePrompt();

      expect(prompt).toBeDefined();
      expect(prompt.type).toBe('tile');
      expect(prompt.description).toBe('A');
      expect(prompt.description.length).toBe(1);
      expect(prompt.options?.textGuidanceScale).toBe(1.0);
    });

    it('should be deterministic', () => {
      const prompt1 = createEdgeCasePrompt();
      const prompt2 = createEdgeCasePrompt();

      expect(prompt1).toEqual(prompt2);
    });
  });

  describe('createMaxTextGuidancePrompt', () => {
    it('should create a prompt with maximum text guidance scale', () => {
      const prompt = createMaxTextGuidancePrompt();

      expect(prompt).toBeDefined();
      expect(prompt.options?.textGuidanceScale).toBe(20.0);
    });

    it('should be deterministic', () => {
      const prompt1 = createMaxTextGuidancePrompt();
      const prompt2 = createMaxTextGuidancePrompt();

      expect(prompt1).toEqual(prompt2);
    });
  });

  describe('createLargeSizePrompt', () => {
    it('should create a prompt with large dimensions', () => {
      const prompt = createLargeSizePrompt();

      expect(prompt).toBeDefined();
      expect(prompt.size.width).toBe(128);
      expect(prompt.size.height).toBe(128);
    });

    it('should be deterministic', () => {
      const prompt1 = createLargeSizePrompt();
      const prompt2 = createLargeSizePrompt();

      expect(prompt1).toEqual(prompt2);
    });
  });
});
