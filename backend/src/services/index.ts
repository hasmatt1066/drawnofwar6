/**
 * Services Export Index
 *
 * Central export point for all Phase 2 services.
 * Import from this file for convenience.
 */

// Claude Vision Services
export { claudeVisionService } from './claude/vision.service.js';
export type {
  ClaudeAnalysisResult,
  ClaudeVisionRequest,
  ClaudeVisionError,
  ClaudeCostMetrics
} from './claude/types.js';

// Animation Services
export { animationMapper } from './animations/mapper.service.js';
export {
  animationLibrary,
  getAnimationsByCategory,
  getAnimationById,
  searchAnimationsByTags,
  getDefaultBaseAnimations,
  getLibraryStats
} from './animations/library.js';
export type {
  AnimationDefinition,
  AnimationSet,
  AnimationMappingResult,
  AnimationCategory
} from './animations/types.js';

// Style Validation Services
export { styleValidator } from './style/validator.service.js';
export { extractColorPalette, compareColorPalettes } from './style/color-extractor.js';
export { analyzeShape, compareShapes, extractEdgeMap } from './style/shape-comparator.js';
export type {
  ColorPalette,
  ShapeAnalysis,
  StylePreservationResult
} from './style/types.js';

// Input Services (from Phase 1)
export { inputNormalizer } from './input/normalizer.service.js';
export type { NormalizedImage } from '../types/input/index.js';
