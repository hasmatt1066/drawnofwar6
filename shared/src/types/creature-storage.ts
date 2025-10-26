/**
 * Creature Storage Types
 *
 * Type definitions for creature persistence in Firestore and Firebase Storage.
 * Shared between backend and frontend.
 */

import type { Timestamp } from 'firebase-admin/firestore';

/**
 * Owner ID for demo testing (no auth yet)
 */
export type OwnerId = 'demo-player1' | 'demo-player2';

/**
 * Single combat attribute (from generation system)
 */
export interface StoredCombatAttribute {
  attributeId: string;
  name: string;
  category: string;
  spriteAnimationId: string;
  damageType: string;
  attackType: string;
  priority: number;
}

/**
 * Stored directional sprite data (Firebase Storage URLs)
 */
export interface StoredDirectionalSprite {
  sprite: string; // Firebase Storage URL (gs://) - static sprite
  walkFrames: string[]; // Array of Firebase Storage URLs for walking animation
  idleFrames: string[]; // Array of Firebase Storage URLs for idle animation
  attackFrames: string[]; // Array of Firebase Storage URLs for attack animation
}

/**
 * Complete creature document in Firestore
 */
export interface CreatureDocument {
  // Identity
  id: string; // Firestore document ID
  ownerId: OwnerId;
  name: string;
  createdAt: Timestamp | Date; // Timestamp in Firestore, Date when serialized

  // Original Generation Data
  generationJobId: string;
  inputType: 'text' | 'draw' | 'upload';
  textDescription?: string;

  // Claude Vision Analysis (from ClaudeAnalysisResult)
  concept: string; // e.g., "fierce dragon"
  race: string; // e.g., "dragon", "human"
  class: string; // e.g., "warrior", "mage"
  abilities: string[]; // Ability names from generation

  // Combat Attributes (from AttributeMappingResult)
  combatAttributes: StoredCombatAttribute[]; // 1-3 primary attributes

  // Animation Mappings
  animations: {
    [key: string]: string; // animation name → PixelLab animation ID
  };

  // Sprite Storage URLs (Firebase Storage gs:// URLs)
  sprites: {
    menuSprite: string;
    directions: {
      E: StoredDirectionalSprite;
      NE: StoredDirectionalSprite;
      SE: StoredDirectionalSprite;
      // W, NW, SW are mirrored in client
    };
  };

  // Metadata
  generationTimeMs: number;
  version: string; // Schema version for migrations
}

/**
 * Input data for creating a creature document (before Firestore ID assigned)
 */
export interface CreatureDocumentInput {
  ownerId: OwnerId;
  name: string;
  generationJobId: string;
  inputType: 'text' | 'draw' | 'upload';
  textDescription?: string;
  concept: string;
  race: string;
  class: string;
  abilities: string[];
  combatAttributes: StoredCombatAttribute[];
  animations: {
    [key: string]: string;
  };
  sprites: {
    menuSprite: string;
    directions: {
      E: StoredDirectionalSprite;
      NE: StoredDirectionalSprite;
      SE: StoredDirectionalSprite;
    };
  };
  generationTimeMs: number;
  version?: string;
}

/**
 * Serialized creature document (JSON-safe, Timestamps as ISO strings)
 */
export interface SerializedCreatureDocument extends Omit<CreatureDocument, 'createdAt'> {
  createdAt: string; // ISO 8601 string
}

/**
 * Paginated list response
 */
export interface CreatureListResponse {
  creatures: SerializedCreatureDocument[];
  total: number;
  hasMore: boolean;
}

/**
 * Batch get response
 */
export interface BatchCreaturesResponse {
  creatures: SerializedCreatureDocument[];
  missing: string[]; // IDs that weren't found
}
