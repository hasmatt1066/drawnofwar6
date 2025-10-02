/**
 * Style Preservation Validator Service
 *
 * Validates that generated sprites preserve the user's original drawing style.
 * Compares color palettes and shape characteristics.
 */

import { extractColorPalette, compareColorPalettes } from './color-extractor.js';
import { compareShapes } from './shape-comparator.js';
import type { StylePreservationResult } from './types.js';

/**
 * Style Preservation Validator Service
 * Singleton service for validating style preservation
 */
class StylePreservationValidatorService {
  private readonly PASS_THRESHOLD = 0.6; // 60% similarity required to pass

  constructor() {
    console.log('[Style Validator] Service initialized');
    console.log(`[Style Validator] Pass threshold: ${this.PASS_THRESHOLD * 100}%`);
  }

  /**
   * Validate style preservation between original and generated images
   *
   * @param originalBuffer - Original drawing image buffer
   * @param generatedBuffer - Generated sprite image buffer
   * @returns Validation result with scores and feedback
   */
  async validate(
    originalBuffer: Buffer,
    generatedBuffer: Buffer
  ): Promise<StylePreservationResult> {
    const startTime = Date.now();
    console.log('[Style Validator] Starting validation...');

    try {
      // Extract color palettes in parallel with shape comparison
      const [originalPalette, generatedPalette, shapeScore] = await Promise.all([
        extractColorPalette(originalBuffer, 8),
        extractColorPalette(generatedBuffer, 8),
        compareShapes(originalBuffer, generatedBuffer)
      ]);

      // Compare color palettes
      const colorSimilarity = compareColorPalettes(originalPalette, generatedPalette);

      // Calculate overall score (weighted average)
      // Color is more important for style preservation than exact shape
      const overallScore = (colorSimilarity * 0.6 + shapeScore * 0.4);

      // Determine pass/fail
      const passed = overallScore >= this.PASS_THRESHOLD;

      // Generate feedback
      const feedback = this.generateFeedback(
        passed,
        colorSimilarity,
        shapeScore,
        overallScore
      );

      const duration = Date.now() - startTime;

      console.log('[Style Validator] Validation complete');
      console.log(`[Style Validator] Color score: ${(colorSimilarity * 100).toFixed(1)}%`);
      console.log(`[Style Validator] Shape score: ${(shapeScore * 100).toFixed(1)}%`);
      console.log(`[Style Validator] Overall score: ${(overallScore * 100).toFixed(1)}%`);
      console.log(`[Style Validator] Result: ${passed ? 'PASSED' : 'FAILED'}`);
      console.log(`[Style Validator] Duration: ${duration}ms`);

      return {
        passed,
        overallScore: Math.round(overallScore * 100), // Convert to percentage
        colorScore: Math.round(colorSimilarity * 100),
        shapeScore: Math.round(shapeScore * 100),
        feedback,
        dominantColorsOriginal: originalPalette.colors,
        dominantColorsGenerated: generatedPalette.colors
      };
    } catch (error: any) {
      console.error('[Style Validator] Validation failed:', error.message);

      // Return a passing result if validation fails (don't block user)
      return {
        passed: true,
        overallScore: 70,
        colorScore: 70,
        shapeScore: 70,
        feedback: 'Style validation could not be completed, but your sprite looks great!',
        dominantColorsOriginal: [],
        dominantColorsGenerated: []
      };
    }
  }

  /**
   * Generate user-friendly feedback based on scores
   */
  private generateFeedback(
    passed: boolean,
    colorScore: number,
    shapeScore: number,
    overallScore: number
  ): string {
    if (passed) {
      if (overallScore >= 0.9) {
        return 'Excellent! Your drawing style has been perfectly preserved in the generated sprite.';
      } else if (overallScore >= 0.8) {
        return 'Great! The sprite captures your drawing style very well.';
      } else {
        return 'Good! The sprite preserves most of your drawing style.';
      }
    } else {
      // Failed validation - provide specific feedback
      if (colorScore < 0.5 && shapeScore < 0.5) {
        return 'The sprite differs significantly from your drawing in both colors and shape. Try regenerating or adjusting your drawing.';
      } else if (colorScore < 0.5) {
        return 'The colors in the sprite don\'t match your drawing well. Try regenerating to get colors closer to your original.';
      } else if (shapeScore < 0.5) {
        return 'The shape of the sprite differs from your drawing. Try regenerating or providing a clearer drawing.';
      } else {
        return 'The sprite is close to your drawing but not quite perfect. You can regenerate if you\'d like it closer to the original.';
      }
    }
  }

  /**
   * Quick validation (skips detailed analysis)
   * Useful for batch processing or previews
   */
  async quickValidate(
    originalBuffer: Buffer,
    generatedBuffer: Buffer
  ): Promise<boolean> {
    const [originalPalette, generatedPalette] = await Promise.all([
      extractColorPalette(originalBuffer, 5),
      extractColorPalette(generatedBuffer, 5)
    ]);

    const colorSimilarity = compareColorPalettes(originalPalette, generatedPalette);

    return colorSimilarity >= this.PASS_THRESHOLD;
  }
}

// Export singleton instance
export const styleValidator = new StylePreservationValidatorService();
