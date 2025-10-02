/**
 * Generation Pipeline Types
 *
 * Types for the complete creature generation pipeline.
 */

import type { ClaudeAnalysisResult } from '../services/claude/types.js';
import type { AnimationMappingResult } from '../services/animations/types.js';
import type { StylePreservationResult } from '../services/style/types.js';
import type { NormalizedImage } from './input/index.js';

/**
 * Complete generation result
 * Contains all data needed for a creature
 */
export interface GenerationResult {
  // Input information
  inputType: 'text' | 'draw' | 'upload';
  textDescription?: string | undefined;
  originalImage?: string | undefined; // Base64 if visual input

  // Claude Vision analysis (only for visual inputs)
  claudeAnalysis?: ClaudeAnalysisResult | undefined;

  // Animation mapping
  animations: AnimationMappingResult;

  // Style validation (only for visual inputs)
  styleValidation?: StylePreservationResult | undefined;

  // PixelLab sprite generation
  spriteImageBase64?: string | undefined;
  animationFrames?: string[] | undefined; // Array of base64-encoded animation frames
  pixelLabCharacterId?: string | undefined; // Deprecated - API now returns image directly

  // Metadata
  generatedAt: Date;
  processingTimeMs: number;
}

/**
 * Generation request
 */
export interface GenerationRequest {
  inputType: 'text' | 'draw' | 'upload';
  textDescription?: string | undefined;
  normalizedImage?: NormalizedImage | undefined;
}
