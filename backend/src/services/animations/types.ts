/**
 * Animation System Types
 *
 * Defines the structure for animation definitions and mapping.
 */

/**
 * Animation category
 */
export type AnimationCategory =
  | 'idle'       // Standing still, breathing, waiting
  | 'locomotion' // Walking, running, flying, swimming
  | 'combat'     // Attacks, defends, dodges
  | 'abilities'  // Special moves, spells, skills
  | 'reactions'  // Hit, death, celebrate, taunt
  | 'custom';    // Creature-specific animations

/**
 * Animation definition in the library
 */
export interface AnimationDefinition {
  id: string;              // Unique identifier, e.g., "attack_melee_sword_01"
  name: string;            // Human-readable name, e.g., "Sword Slash"
  category: AnimationCategory;
  tags: string[];          // Search tags, e.g., ["melee", "sword", "physical"]
  description?: string;    // Optional description
  frames?: number;         // Number of frames (if known)
  fps?: number;            // Playback speed (if known)
}

/**
 * Complete animation set for a creature
 */
export interface AnimationSet {
  // Required base animations
  idle: string;         // Must have idle animation
  walk: string;         // Must have walk animation
  attack: string;       // Must have at least one attack
  death: string;        // Must have death animation

  // Additional animations (15-25+)
  additional: string[]; // All other animations
}

/**
 * Animation mapping result
 */
export interface AnimationMappingResult {
  animationSet: AnimationSet;
  totalAnimations: number;     // Total count (should be 20+)
  mappedFromClaude: number;    // How many were from Claude suggestions
  filledWithDefaults: number;  // How many were filled with defaults
  confidence: number;          // 0-1, confidence in mapping quality
}
