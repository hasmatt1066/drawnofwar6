/**
 * Combat Attributes System Types
 *
 * Defines the structure for extracting 1-3 primary combat attributes
 * from creature abilities and mapping them to sprite overlay animations.
 */

/**
 * Attribute category
 */
export type AttributeCategory =
  | 'melee'     // Close-range physical attacks
  | 'ranged'    // Distance attacks (bow, projectile)
  | 'spell'     // Magical abilities and spells
  | 'ability'   // Special abilities (breath, flight, etc.)
  | 'defense';  // Defensive capabilities

/**
 * Damage type for combat attributes
 */
export type DamageType =
  | 'physical'
  | 'fire'
  | 'ice'
  | 'lightning'
  | 'poison'
  | 'dark'
  | 'holy'
  | 'none';

/**
 * Attack type classification
 */
export type AttackType =
  | 'melee'
  | 'ranged'
  | 'aoe'        // Area of effect
  | 'buff'       // Enhancement
  | 'debuff'     // Negative status
  | 'passive';   // Passive ability

/**
 * Single combat attribute extracted from abilities
 */
export interface CombatAttribute {
  attributeId: string;           // Unique ID from ability, e.g., "fire_breath"
  name: string;                  // Display name, e.g., "Fire Breath"
  category: AttributeCategory;   // Type of attribute
  spriteAnimationId: string;     // Animation ID from library
  damageType: DamageType;        // Type of damage dealt
  attackType: AttackType;        // How the attack works
  priority: number;              // Selection priority (1-10, higher = more important)
  effectFrames?: string[];       // Base64-encoded effect animation frames from library
}

/**
 * Result of attribute extraction
 */
export interface AttributeMappingResult {
  attributes: CombatAttribute[];  // 1-3 primary attributes
  totalExtracted: number;         // Total number extracted
  confidence: number;             // 0-1, confidence in selections
}
