/**
 * Claude Vision Service Types
 *
 * TypeScript interfaces for Claude Vision API responses and creature analysis.
 */

/**
 * Result of Claude Vision analysis
 * Contains all extracted creature attributes from image analysis
 */
export interface ClaudeAnalysisResult {
  // Basic creature identification
  concept: string; // e.g., "fierce dragon", "armored knight"
  race: string; // e.g., "dragon", "human", "orc"
  class: string; // e.g., "warrior", "mage", "rogue"

  // Game attributes
  primaryAttributes: {
    hp: number; // Health points (10-200)
    attack: number; // Attack power (1-50)
    defense: number; // Defense rating (0-30)
    speed: number; // Movement speed (1-10)
  };

  // Abilities identified from visual features
  abilities: string[]; // e.g., ["fire_breath", "claw_strike", "flight"]

  // Animation suggestions (15-25 animations)
  suggestedAnimations: string[]; // e.g., ["idle", "walk", "attack", "fly", "breathe_fire"]

  // Visual style characteristics for preservation
  styleCharacteristics: {
    dominantColors: string[]; // Hex color codes, e.g., ["#FF0000", "#8B0000"]
    shapeComplexity: 'simple' | 'moderate' | 'complex';
    artStyle: string; // e.g., "cartoon", "realistic", "pixelated", "sketch"
  };

  // Metadata
  confidence: number; // 0-1, Claude's confidence in analysis
  tokenUsage: number; // Tokens consumed by this request
}

/**
 * Request to Claude Vision API
 */
export interface ClaudeVisionRequest {
  image: {
    base64: string; // Base64-encoded PNG image
    format: 'png' | 'jpeg';
  };
  textContext?: string | undefined; // Optional text description from user
}

/**
 * Error from Claude Vision API
 */
export interface ClaudeVisionError {
  code: string; // 'rate_limit', 'invalid_image', 'api_error', 'parse_error'
  message: string;
  retryAfter?: number | undefined; // Seconds to wait before retrying (for rate limits)
  fallback?: ClaudeAnalysisResult | undefined; // Fallback result if available
}

/**
 * Cost tracking for Claude API usage
 */
export interface ClaudeCostMetrics {
  timestamp: Date;
  tokensUsed: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  model: string;
  requestDurationMs: number;
}
