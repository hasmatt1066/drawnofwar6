/**
 * Generation Pipeline Types
 *
 * Types for the complete creature generation pipeline.
 */

import type { ClaudeAnalysisResult } from '../services/claude/types.js';
import type { AnimationMappingResult } from '../services/animations/types.js';
import type { AttributeMappingResult } from '../services/attributes/types.js';
import type { StylePreservationResult } from '../services/style/types.js';
import type { NormalizedImage } from './input/index.js';

/**
 * Directional sprite data for a single direction
 */
export interface DirectionalSprite {
  /** Static sprite image (base64) */
  sprite: string;
  /** Walk animation frames (base64 array) */
  walkFrames: string[];
  /** Idle animation frames (base64 array) */
  idleFrames: string[];
  /** Attack animation frames (base64 array) */
  attackFrames: string[];
}

/**
 * Battlefield directional views
 * Uses 3 generated directions + 3 mirrored directions for cost efficiency
 */
export interface BattlefieldDirectionalViews {
  // Generated directions (low top-down perspective)
  E: DirectionalSprite;   // East
  NE: DirectionalSprite;  // Northeast
  SE: DirectionalSprite;  // Southeast

  // Mirrored directions (use horizontal flip in renderer)
  // W: mirror of E
  // NW: mirror of NE
  // SW: mirror of SE
}

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

  // Combat attributes (1-3 primary attributes for sprite overlays)
  combatAttributes?: AttributeMappingResult | undefined;

  // Baseline attack type (determined from attack animation)
  baselineAttackType?: 'melee' | 'ranged' | undefined;

  // Style validation (only for visual inputs)
  styleValidation?: StylePreservationResult | undefined;

  // PixelLab sprite generation - Menu/Gallery view (side profile)
  spriteImageBase64?: string | undefined;
  animationFrames?: string[] | undefined; // Array of base64-encoded animation frames (walk animation for side view)
  pixelLabCharacterId?: string | undefined; // Deprecated - API now returns image directly

  // Battlefield directional views (NEW multi-directional system)
  battlefieldDirectionalViews?: BattlefieldDirectionalViews | undefined;

  // DEPRECATED: Legacy single battlefield view (kept for backward compatibility)
  battlefieldSprite?: string | undefined; // Base64-encoded battlefield sprite
  battlefieldWalkFrames?: string[] | undefined; // Walk animation for battlefield view
  viewAngles?: {
    menu: 'side';
    battlefield?: 'low top-down';
  };

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
