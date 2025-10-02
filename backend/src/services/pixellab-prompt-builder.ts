/**
 * PixelLab Prompt Builder Service
 *
 * Transforms Claude Vision analysis results into PixelLab API generation requests.
 * Maps AI-extracted attributes and style characteristics to PixelLab parameters.
 */

import type { ClaudeAnalysisResult } from './claude/types.js';
import type { GenerationRequest } from '../pixellab/request-validator.js';

/**
 * Maps shape complexity to PixelLab detail levels
 */
const COMPLEXITY_TO_DETAIL_MAP = {
  simple: 'low detail' as const,
  moderate: 'medium detail' as const,
  complex: 'high detail' as const,
};

/**
 * Maps art styles to PixelLab view angles
 */
const ART_STYLE_TO_VIEW_MAP: Record<string, 'low top-down' | 'high top-down' | 'side'> = {
  pixelated: 'side',
  cartoon: 'high top-down',
  realistic: 'side',
  sketch: 'side',
};

/**
 * PixelLab Prompt Builder
 *
 * Converts Claude Vision analysis into PixelLab API parameters
 */
export class PixelLabPromptBuilder {
  /**
   * Build PixelLab generation request from Claude analysis
   *
   * @param claudeAnalysis - Claude Vision analysis result
   * @param originalImage - Optional base64-encoded original image for style reference
   * @returns PixelLab-compatible generation request
   */
  public buildPrompt(
    claudeAnalysis: ClaudeAnalysisResult,
    originalImage?: string | undefined
  ): GenerationRequest {
    // Build description from Claude's concept and attributes
    const description = this.buildDescription(claudeAnalysis);

    // Determine size based on complexity
    const size = this.determineSize(claudeAnalysis);

    // Map shape complexity to detail level
    const detail = COMPLEXITY_TO_DETAIL_MAP[claudeAnalysis.styleCharacteristics.shapeComplexity];

    // Determine shading level
    const shading = this.determineShadingLevel(claudeAnalysis);

    // Determine view angle from art style
    const view = this.determineViewAngle(claudeAnalysis);

    // Build request
    const request: GenerationRequest = {
      description,
      size,
      detail,
      shading,
      outline: 'single color black outline', // Default for pixel art
      view,
      textGuidanceScale: 7.5, // Balanced creativity
    };

    // Add init image if provided (for style preservation)
    if (originalImage) {
      // Strip data URL prefix if present (PixelLab expects pure base64)
      const base64Only = originalImage.includes(',')
        ? originalImage.split(',')[1]
        : originalImage;
      request.initImage = base64Only;
    }

    return request;
  }

  /**
   * Build description string from Claude analysis
   *
   * Combines concept, race, class, and visual features into a prompt
   */
  private buildDescription(analysis: ClaudeAnalysisResult): string {
    const parts: string[] = [];

    // Start with concept
    parts.push(analysis.concept);

    // Add race if not already in concept
    if (!analysis.concept.toLowerCase().includes(analysis.race.toLowerCase())) {
      parts.push(analysis.race);
    }

    // Add class if not already mentioned
    if (!analysis.concept.toLowerCase().includes(analysis.class.toLowerCase())) {
      parts.push(analysis.class);
    }

    // Add dominant colors as style hint
    const colorHints = analysis.styleCharacteristics.dominantColors.slice(0, 3);
    if (colorHints.length > 0) {
      parts.push(`colors: ${colorHints.join(', ')}`);
    }

    // Add art style
    parts.push(`style: ${analysis.styleCharacteristics.artStyle} pixel art`);

    return parts.join(', ');
  }

  /**
   * Determine sprite size based on complexity
   *
   * More complex shapes need larger canvas
   */
  private determineSize(analysis: ClaudeAnalysisResult): 32 | 48 | 64 | 128 {
    const complexity = analysis.styleCharacteristics.shapeComplexity;
    const abilityCount = analysis.abilities.length;

    // High complexity or many abilities → larger size
    if (complexity === 'complex' || abilityCount > 5) {
      return 64;
    }

    // Moderate complexity
    if (complexity === 'moderate' || abilityCount > 3) {
      return 48;
    }

    // Simple creatures
    return 32;
  }

  /**
   * Determine shading level based on art style and complexity
   */
  private determineShadingLevel(
    analysis: ClaudeAnalysisResult
  ): 'flat shading' | 'basic shading' | 'medium shading' | 'detailed shading' {
    const artStyle = analysis.styleCharacteristics.artStyle.toLowerCase();
    const complexity = analysis.styleCharacteristics.shapeComplexity;

    // Pixelated style → less shading
    if (artStyle.includes('pixel')) {
      return complexity === 'simple' ? 'flat shading' : 'basic shading';
    }

    // Realistic style → more shading
    if (artStyle.includes('realistic')) {
      return complexity === 'complex' ? 'detailed shading' : 'medium shading';
    }

    // Default: medium shading for balanced look
    return complexity === 'complex' ? 'medium shading' : 'basic shading';
  }

  /**
   * Determine view angle based on art style
   */
  private determineViewAngle(
    analysis: ClaudeAnalysisResult
  ): 'low top-down' | 'high top-down' | 'side' {
    const artStyle = analysis.styleCharacteristics.artStyle.toLowerCase();

    // Check known mappings
    for (const [style, view] of Object.entries(ART_STYLE_TO_VIEW_MAP)) {
      if (artStyle.includes(style)) {
        return view;
      }
    }

    // Default to side view for pixel art
    return 'side';
  }
}

// Export singleton instance
export const pixelLabPromptBuilder = new PixelLabPromptBuilder();
