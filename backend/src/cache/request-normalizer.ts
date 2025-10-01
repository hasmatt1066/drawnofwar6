/**
 * Task 2.1: Request Normalization
 *
 * Standardizes user input for consistent cache key generation.
 * Ensures deterministic output for identical semantic requests.
 */

import type { StructuredPrompt } from '../queue/job-submitter.js';

/**
 * Normalizes structured prompts for cache key generation
 *
 * Responsibilities:
 * - Trim whitespace from all text fields
 * - Lowercase text fields (description, action, style, type, raw)
 * - Sort object keys alphabetically for deterministic JSON output
 * - Preserve base64 image data exactly (no normalization)
 * - Handle missing optional fields gracefully
 */
export class RequestNormalizer {
  /**
   * Normalize a structured prompt for cache key generation
   *
   * @param prompt - Structured prompt to normalize
   * @returns Deterministic JSON string representation of normalized prompt
   *
   * @example
   * ```typescript
   * const prompt = {
   *   type: '  Character  ',
   *   style: '  PIXEL-ART  ',
   *   size: { width: 32, height: 32 },
   *   action: 'Walking',
   *   description: 'A Brave Knight',
   *   raw: 'brave knight walking',
   * };
   *
   * const normalized = RequestNormalizer.normalize(prompt);
   * // Returns: '{"action":"walking","description":"a brave knight",...}'
   * ```
   */
  public static normalize(prompt: StructuredPrompt): string {
    // Create normalized copy of prompt
    const normalized = {
      // Normalize text fields: trim and lowercase
      action: this.normalizeTextField(prompt.action),
      description: this.normalizeTextField(prompt.description),
      raw: this.normalizeTextField(prompt.raw),
      style: this.normalizeTextField(prompt.style),
      type: this.normalizeTextField(prompt.type),

      // Normalize size object: sort keys alphabetically
      size: this.normalizeSizeObject(prompt.size),

      // Normalize options object if present: sort keys alphabetically
      ...(prompt.options !== undefined && { options: this.normalizeOptionsObject(prompt.options) }),
    };

    // Convert to JSON with sorted keys at top level
    return this.stringifyWithSortedKeys(normalized);
  }

  /**
   * Normalize a text field: trim whitespace and lowercase
   *
   * @param text - Text to normalize
   * @returns Normalized text (trimmed and lowercased)
   */
  private static normalizeTextField(text: string): string {
    return text.trim().toLowerCase();
  }

  /**
   * Normalize size object: sort keys alphabetically
   *
   * @param size - Size object to normalize
   * @returns Size object with sorted keys
   */
  private static normalizeSizeObject(size: { width: number; height: number }): { height: number; width: number } {
    // Return with keys in alphabetical order: height, width
    return {
      height: size.height,
      width: size.width,
    };
  }

  /**
   * Normalize options object: sort keys alphabetically, preserve base64 exactly
   *
   * @param options - Options object to normalize
   * @returns Options object with sorted keys
   */
  private static normalizeOptionsObject(
    options: StructuredPrompt['options']
  ): {
    noBackground?: boolean;
    paletteImage?: string;
    textGuidanceScale?: number;
  } {
    if (!options) {
      return {};
    }

    // Build result with keys in alphabetical order: noBackground, paletteImage, textGuidanceScale
    const result: {
      noBackground?: boolean;
      paletteImage?: string;
      textGuidanceScale?: number;
    } = {};

    // Add keys in alphabetical order if they exist
    if (options.noBackground !== undefined) {
      result.noBackground = options.noBackground;
    }

    if (options.paletteImage !== undefined) {
      // Preserve base64 image data exactly - no normalization
      result.paletteImage = options.paletteImage;
    }

    if (options.textGuidanceScale !== undefined) {
      result.textGuidanceScale = options.textGuidanceScale;
    }

    return result;
  }

  /**
   * Convert object to JSON string with sorted keys
   *
   * This ensures deterministic output for cache key generation.
   * Uses a custom replacer to sort keys alphabetically at all levels.
   *
   * @param obj - Object to stringify
   * @returns JSON string with sorted keys
   */
  private static stringifyWithSortedKeys(obj: unknown): string {
    return JSON.stringify(obj, (_key, value) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        // Sort object keys alphabetically
        const sortedKeys = Object.keys(value).sort();
        const sortedObj: Record<string, unknown> = {};
        for (const sortedKey of sortedKeys) {
          sortedObj[sortedKey] = (value as Record<string, unknown>)[sortedKey];
        }
        return sortedObj;
      }
      return value;
    });
  }
}
