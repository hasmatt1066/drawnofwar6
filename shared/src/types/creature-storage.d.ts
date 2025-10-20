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
 * Directional sprite data
 */
export interface DirectionalSprite {
    sprite: string;
    walkFrames: string[];
    idleFrames: string[];
}
/**
 * Complete creature document in Firestore
 */
export interface CreatureDocument {
    id: string;
    ownerId: OwnerId;
    name: string;
    createdAt: Timestamp | Date;
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
            E: DirectionalSprite;
            NE: DirectionalSprite;
            SE: DirectionalSprite;
        };
    };
    generationTimeMs: number;
    version: string;
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
            E: DirectionalSprite;
            NE: DirectionalSprite;
            SE: DirectionalSprite;
        };
    };
    generationTimeMs: number;
    version?: string;
}
/**
 * Serialized creature document (JSON-safe, Timestamps as ISO strings)
 */
export interface SerializedCreatureDocument extends Omit<CreatureDocument, 'createdAt'> {
    createdAt: string;
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
    missing: string[];
}
//# sourceMappingURL=creature-storage.d.ts.map