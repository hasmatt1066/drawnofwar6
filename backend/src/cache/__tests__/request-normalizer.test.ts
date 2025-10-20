/**
 * Task 2.1: Request Normalization Tests
 *
 * Tests for standardizing user input for consistent cache key generation.
 * Following TDD: tests written BEFORE implementation.
 */

import { describe, it, expect } from 'vitest';
import { RequestNormalizer } from '../request-normalizer.js';
import type { StructuredPrompt } from '../../queue/job-submitter.js';

describe('RequestNormalizer', () => {
  describe('normalize', () => {
    // Basic normalization tests
    describe('text field normalization', () => {
      it('should trim leading whitespace from all text fields', () => {
        const prompt: StructuredPrompt = {
          type: '  character',
          style: '  pixel-art',
          size: { width: 32, height: 32 },
          action: '  walking',
          description: '  A brave knight',
          raw: '  brave knight walking',
        };

        const normalized = RequestNormalizer.normalize(prompt);
        expect(normalized).toContain('"type":"character"');
        expect(normalized).toContain('"style":"pixel-art"');
        expect(normalized).toContain('"action":"walking"');
        expect(normalized).toContain('"description":"a brave knight"');
        expect(normalized).toContain('"raw":"brave knight walking"');
      });

      it('should trim trailing whitespace from all text fields', () => {
        const prompt: StructuredPrompt = {
          type: 'character  ',
          style: 'pixel-art  ',
          size: { width: 32, height: 32 },
          action: 'walking  ',
          description: 'A brave knight  ',
          raw: 'brave knight walking  ',
        };

        const normalized = RequestNormalizer.normalize(prompt);
        expect(normalized).toContain('"type":"character"');
        expect(normalized).toContain('"style":"pixel-art"');
        expect(normalized).toContain('"action":"walking"');
        expect(normalized).toContain('"description":"a brave knight"');
        expect(normalized).toContain('"raw":"brave knight walking"');
      });

      it('should trim whitespace from both ends', () => {
        const prompt: StructuredPrompt = {
          type: '  character  ',
          style: '  pixel-art  ',
          size: { width: 32, height: 32 },
          action: '  walking  ',
          description: '  A brave knight  ',
          raw: '  brave knight walking  ',
        };

        const normalized = RequestNormalizer.normalize(prompt);
        expect(normalized).toContain('"type":"character"');
        expect(normalized).toContain('"style":"pixel-art"');
        expect(normalized).toContain('"action":"walking"');
        expect(normalized).toContain('"description":"a brave knight"');
        expect(normalized).toContain('"raw":"brave knight walking"');
      });

      it('should lowercase all text fields', () => {
        const prompt: StructuredPrompt = {
          type: 'CHARACTER',
          style: 'PIXEL-ART',
          size: { width: 32, height: 32 },
          action: 'WALKING',
          description: 'A BRAVE KNIGHT',
          raw: 'BRAVE KNIGHT WALKING',
        };

        const normalized = RequestNormalizer.normalize(prompt);
        expect(normalized).toContain('"type":"character"');
        expect(normalized).toContain('"style":"pixel-art"');
        expect(normalized).toContain('"action":"walking"');
        expect(normalized).toContain('"description":"a brave knight"');
        expect(normalized).toContain('"raw":"brave knight walking"');
      });

      it('should handle mixed case input', () => {
        const prompt: StructuredPrompt = {
          type: 'ChArAcTeR',
          style: 'PiXeL-aRt',
          size: { width: 32, height: 32 },
          action: 'WaLkInG',
          description: 'A BrAvE KnIgHt',
          raw: 'BrAvE kNiGhT wAlKiNg',
        };

        const normalized = RequestNormalizer.normalize(prompt);
        expect(normalized).toContain('"type":"character"');
        expect(normalized).toContain('"style":"pixel-art"');
        expect(normalized).toContain('"action":"walking"');
        expect(normalized).toContain('"description":"a brave knight"');
        expect(normalized).toContain('"raw":"brave knight walking"');
      });

      it('should handle description with multiple spaces', () => {
        const prompt: StructuredPrompt = {
          type: 'character',
          style: 'pixel-art',
          size: { width: 32, height: 32 },
          action: 'walking',
          description: 'A   brave   knight   with   sword',
          raw: 'brave knight walking',
        };

        const normalized = RequestNormalizer.normalize(prompt);
        // Internal spaces should be preserved, only trim and lowercase
        expect(normalized).toContain('"description":"a   brave   knight   with   sword"');
      });
    });

    // Options sorting tests
    describe('options object key sorting', () => {
      it('should sort options keys alphabetically', () => {
        const prompt: StructuredPrompt = {
          type: 'character',
          style: 'pixel-art',
          size: { width: 32, height: 32 },
          action: 'walking',
          description: 'A brave knight',
          raw: 'brave knight walking',
          options: {
            textGuidanceScale: 8.0,
            noBackground: true,
            paletteImage: 'data:image/png;base64,abc123',
          },
        };

        const normalized = RequestNormalizer.normalize(prompt);

        // Keys should appear in alphabetical order: noBackground, paletteImage, textGuidanceScale
        const optionsStartIndex = normalized.indexOf('"options"');
        const noBackgroundIndex = normalized.indexOf('"noBackground"', optionsStartIndex);
        const paletteImageIndex = normalized.indexOf('"paletteImage"', optionsStartIndex);
        const textGuidanceScaleIndex = normalized.indexOf('"textGuidanceScale"', optionsStartIndex);

        expect(noBackgroundIndex).toBeLessThan(paletteImageIndex);
        expect(paletteImageIndex).toBeLessThan(textGuidanceScaleIndex);
      });

      it('should produce same output regardless of input key order', () => {
        const prompt1: StructuredPrompt = {
          type: 'character',
          style: 'pixel-art',
          size: { width: 32, height: 32 },
          action: 'walking',
          description: 'A brave knight',
          raw: 'brave knight walking',
          options: {
            noBackground: true,
            textGuidanceScale: 8.0,
          },
        };

        const prompt2: StructuredPrompt = {
          type: 'character',
          style: 'pixel-art',
          size: { width: 32, height: 32 },
          action: 'walking',
          description: 'A brave knight',
          raw: 'brave knight walking',
          options: {
            textGuidanceScale: 8.0,
            noBackground: true,
          },
        };

        const normalized1 = RequestNormalizer.normalize(prompt1);
        const normalized2 = RequestNormalizer.normalize(prompt2);

        expect(normalized1).toBe(normalized2);
      });
    });

    // Missing optional fields tests
    describe('missing optional fields handling', () => {
      it('should handle missing options object', () => {
        const prompt: StructuredPrompt = {
          type: 'character',
          style: 'pixel-art',
          size: { width: 32, height: 32 },
          action: 'walking',
          description: 'A brave knight',
          raw: 'brave knight walking',
        };

        const normalized = RequestNormalizer.normalize(prompt);
        expect(normalized).toBeTruthy();
        expect(normalized).toContain('"type":"character"');
      });

      it('should handle null vs undefined vs empty string consistently', () => {
        const promptWithUndefined: StructuredPrompt = {
          type: 'character',
          style: 'pixel-art',
          size: { width: 32, height: 32 },
          action: 'walking',
          description: 'A brave knight',
          raw: 'brave knight walking',
          options: undefined,
        };

        const promptWithoutOptions: StructuredPrompt = {
          type: 'character',
          style: 'pixel-art',
          size: { width: 32, height: 32 },
          action: 'walking',
          description: 'A brave knight',
          raw: 'brave knight walking',
        };

        const normalized1 = RequestNormalizer.normalize(promptWithUndefined);
        const normalized2 = RequestNormalizer.normalize(promptWithoutOptions);

        // Both should produce the same normalized output
        expect(normalized1).toBe(normalized2);
      });

      it('should handle empty string action (allowed by schema)', () => {
        const prompt: StructuredPrompt = {
          type: 'character',
          style: 'pixel-art',
          size: { width: 32, height: 32 },
          action: '',
          description: 'A brave knight',
          raw: 'brave knight',
        };

        const normalized = RequestNormalizer.normalize(prompt);
        expect(normalized).toContain('"action":""');
      });

      it('should handle partial options object', () => {
        const prompt: StructuredPrompt = {
          type: 'character',
          style: 'pixel-art',
          size: { width: 32, height: 32 },
          action: 'walking',
          description: 'A brave knight',
          raw: 'brave knight walking',
          options: {
            noBackground: true,
            // textGuidanceScale and paletteImage are missing
          },
        };

        const normalized = RequestNormalizer.normalize(prompt);
        expect(normalized).toContain('"noBackground":true');
      });
    });

    // Base64 preservation tests
    describe('base64 image data preservation', () => {
      it('should preserve base64 image data exactly (no normalization)', () => {
        const base64Data = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

        const prompt: StructuredPrompt = {
          type: 'character',
          style: 'pixel-art',
          size: { width: 32, height: 32 },
          action: 'walking',
          description: 'A brave knight',
          raw: 'brave knight walking',
          options: {
            paletteImage: base64Data,
          },
        };

        const normalized = RequestNormalizer.normalize(prompt);
        expect(normalized).toContain(`"paletteImage":"${base64Data}"`);
      });

      it('should handle base64 with whitespace without modifying it', () => {
        // Note: This tests that even if base64 has whitespace, we preserve it exactly
        const base64WithSpaces = 'data:image/png;base64, iVBORw0KGgo AAAANSUhEUgAAAA ';

        const prompt: StructuredPrompt = {
          type: 'character',
          style: 'pixel-art',
          size: { width: 32, height: 32 },
          action: 'walking',
          description: 'A brave knight',
          raw: 'brave knight walking',
          options: {
            paletteImage: base64WithSpaces,
          },
        };

        const normalized = RequestNormalizer.normalize(prompt);
        expect(normalized).toContain(`"paletteImage":"${base64WithSpaces}"`);
      });
    });

    // Determinism tests
    describe('deterministic output', () => {
      it('should produce same output for equivalent inputs', () => {
        const prompt: StructuredPrompt = {
          type: 'character',
          style: 'pixel-art',
          size: { width: 32, height: 32 },
          action: 'walking',
          description: 'A brave knight',
          raw: 'brave knight walking',
        };

        const normalized1 = RequestNormalizer.normalize(prompt);
        const normalized2 = RequestNormalizer.normalize(prompt);

        expect(normalized1).toBe(normalized2);
      });

      it('should produce same output for inputs with different whitespace', () => {
        const prompt1: StructuredPrompt = {
          type: 'character',
          style: 'pixel-art',
          size: { width: 32, height: 32 },
          action: 'walking',
          description: 'A brave knight',
          raw: 'brave knight walking',
        };

        const prompt2: StructuredPrompt = {
          type: '  character  ',
          style: '  pixel-art  ',
          size: { width: 32, height: 32 },
          action: '  walking  ',
          description: '  A brave knight  ',
          raw: '  brave knight walking  ',
        };

        const normalized1 = RequestNormalizer.normalize(prompt1);
        const normalized2 = RequestNormalizer.normalize(prompt2);

        expect(normalized1).toBe(normalized2);
      });

      it('should produce same output for inputs with different casing', () => {
        const prompt1: StructuredPrompt = {
          type: 'character',
          style: 'pixel-art',
          size: { width: 32, height: 32 },
          action: 'walking',
          description: 'a brave knight',
          raw: 'brave knight walking',
        };

        const prompt2: StructuredPrompt = {
          type: 'CHARACTER',
          style: 'PIXEL-ART',
          size: { width: 32, height: 32 },
          action: 'WALKING',
          description: 'A BRAVE KNIGHT',
          raw: 'BRAVE KNIGHT WALKING',
        };

        const normalized1 = RequestNormalizer.normalize(prompt1);
        const normalized2 = RequestNormalizer.normalize(prompt2);

        expect(normalized1).toBe(normalized2);
      });
    });

    // Return type tests
    describe('return value', () => {
      it('should return deterministic string for hashing', () => {
        const prompt: StructuredPrompt = {
          type: 'character',
          style: 'pixel-art',
          size: { width: 32, height: 32 },
          action: 'walking',
          description: 'A brave knight',
          raw: 'brave knight walking',
        };

        const normalized = RequestNormalizer.normalize(prompt);

        expect(typeof normalized).toBe('string');
        expect(normalized.length).toBeGreaterThan(0);
      });

      it('should return valid JSON string', () => {
        const prompt: StructuredPrompt = {
          type: 'character',
          style: 'pixel-art',
          size: { width: 32, height: 32 },
          action: 'walking',
          description: 'A brave knight',
          raw: 'brave knight walking',
        };

        const normalized = RequestNormalizer.normalize(prompt);

        // Should be parseable as JSON
        expect(() => JSON.parse(normalized)).not.toThrow();
      });
    });

    // Size field tests (numbers should not be affected)
    describe('size field handling', () => {
      it('should preserve numeric size values exactly', () => {
        const prompt: StructuredPrompt = {
          type: 'character',
          style: 'pixel-art',
          size: { width: 64, height: 128 },
          action: 'walking',
          description: 'A brave knight',
          raw: 'brave knight walking',
        };

        const normalized = RequestNormalizer.normalize(prompt);
        expect(normalized).toContain('"width":64');
        expect(normalized).toContain('"height":128');
      });

      it('should sort size object keys alphabetically', () => {
        const prompt: StructuredPrompt = {
          type: 'character',
          style: 'pixel-art',
          size: { width: 32, height: 32 },
          action: 'walking',
          description: 'A brave knight',
          raw: 'brave knight walking',
        };

        const normalized = RequestNormalizer.normalize(prompt);

        // Keys should appear in alphabetical order: height, width
        const sizeStartIndex = normalized.indexOf('"size"');
        const heightIndex = normalized.indexOf('"height"', sizeStartIndex);
        const widthIndex = normalized.indexOf('"width"', sizeStartIndex);

        expect(heightIndex).toBeLessThan(widthIndex);
      });
    });

    // Top-level key sorting
    describe('top-level key sorting', () => {
      it('should sort top-level prompt keys alphabetically', () => {
        const prompt: StructuredPrompt = {
          type: 'character',
          style: 'pixel-art',
          size: { width: 32, height: 32 },
          action: 'walking',
          description: 'A brave knight',
          raw: 'brave knight walking',
        };

        const normalized = RequestNormalizer.normalize(prompt);

        // Keys should appear in alphabetical order: action, description, raw, size, style, type
        const actionIndex = normalized.indexOf('"action"');
        const descriptionIndex = normalized.indexOf('"description"');
        const rawIndex = normalized.indexOf('"raw"');
        const sizeIndex = normalized.indexOf('"size"');
        const styleIndex = normalized.indexOf('"style"');
        const typeIndex = normalized.indexOf('"type"');

        expect(actionIndex).toBeLessThan(descriptionIndex);
        expect(descriptionIndex).toBeLessThan(rawIndex);
        expect(rawIndex).toBeLessThan(sizeIndex);
        expect(sizeIndex).toBeLessThan(styleIndex);
        expect(styleIndex).toBeLessThan(typeIndex);
      });
    });
  });
});
