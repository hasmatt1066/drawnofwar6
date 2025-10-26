/**
 * TASK-CLS-4.3: Creature Transform Service
 *
 * Transforms CreatureDocument (from library) → DeploymentCreature (for grid)
 * Maps Firebase Storage URLs to deployment sprite system.
 */

import type { SerializedCreatureDocument } from '@drawn-of-war/shared/types/creature-storage';
import type { DeploymentCreature, BattlefieldDirectionalViews } from '@drawn-of-war/shared/types/deployment';

/**
 * Convert Firebase Storage URL (gs://) to HTTP URL
 *
 * NOTE: In production, you'd use Firebase Storage SDK to get download URLs.
 * For now, we'll use the gs:// URLs directly since we don't have auth set up yet.
 */
function convertStorageUrl(gsUrl: string): string {
  console.log('[CreatureTransform] Converting storage URL:', gsUrl);

  // For Firebase emulator or production, you'd convert gs:// to https://
  // For now, return as-is (backend should handle this conversion if needed)
  return gsUrl;
}

/**
 * Transform directional sprites from storage URLs to base64 format
 *
 * NOTE: This assumes sprites are already in base64 format or will be loaded separately.
 * In production, you'd fetch these URLs and convert to base64 for the sprite system.
 */
function transformDirectionalViews(
  storageViews: SerializedCreatureDocument['sprites']['directions']
): BattlefieldDirectionalViews {
  console.log('[CreatureTransform] Input storage views:', storageViews);

  const result = {
    E: {
      sprite: convertStorageUrl(storageViews.E.sprite),
      walkFrames: storageViews.E.walkFrames.map(convertStorageUrl),
      idleFrames: storageViews.E.idleFrames?.map(convertStorageUrl),
      attackFrames: storageViews.E.attackFrames?.map(convertStorageUrl)
    },
    NE: {
      sprite: convertStorageUrl(storageViews.NE.sprite),
      walkFrames: storageViews.NE.walkFrames.map(convertStorageUrl),
      idleFrames: storageViews.NE.idleFrames?.map(convertStorageUrl),
      attackFrames: storageViews.NE.attackFrames?.map(convertStorageUrl)
    },
    SE: {
      sprite: convertStorageUrl(storageViews.SE.sprite),
      walkFrames: storageViews.SE.walkFrames.map(convertStorageUrl),
      idleFrames: storageViews.SE.idleFrames?.map(convertStorageUrl),
      attackFrames: storageViews.SE.attackFrames?.map(convertStorageUrl)
    }
  };

  console.log('[CreatureTransform] Transformed directional views:', result);
  console.log('[CreatureTransform] E idleFrames count:', result.E.idleFrames?.length ?? 0);
  console.log('[CreatureTransform] E attackFrames count:', result.E.attackFrames?.length ?? 0);

  return result;
}

/**
 * Transform CreatureDocument to DeploymentCreature
 *
 * @param creature - Creature document from library
 * @param playerId - Player who owns this creature
 */
export function transformToDeploymentCreature(
  creature: SerializedCreatureDocument,
  playerId: 'player1' | 'player2'
): DeploymentCreature {
  console.log('[CreatureTransform] Transforming creature:', creature.name);
  console.log('[CreatureTransform] Input creature sprites:', creature.sprites);

  const deploymentCreature = {
    id: creature.id,
    name: creature.name,
    sprite: convertStorageUrl(creature.sprites.menuSprite),
    playerId,
    battlefieldDirectionalViews: transformDirectionalViews(creature.sprites.directions),
    facing: 'E' // Default facing direction
  };

  console.log('[CreatureTransform] Output deployment creature:', deploymentCreature);
  console.log('[CreatureTransform] Battlefield directional views:', deploymentCreature.battlefieldDirectionalViews);

  return deploymentCreature;
}

/**
 * Transform multiple creatures to deployment format
 *
 * @param creatures - Array of creature documents
 * @param playerId - Player who owns these creatures
 */
export function transformManyToDeploymentCreatures(
  creatures: SerializedCreatureDocument[],
  playerId: 'player1' | 'player2'
): DeploymentCreature[] {
  return creatures.map(creature => transformToDeploymentCreature(creature, playerId));
}

/**
 * Extract creature stats from combat attributes
 *
 * This is a utility to extract displayable stats from stored combat attributes.
 * Can be used to show creature info in UI.
 */
export function extractCreatureStats(creature: SerializedCreatureDocument): {
  health?: number;
  attack?: number;
  defense?: number;
} {
  // For now, return empty stats since we don't have numeric stats stored
  // In future, this could extract values from combatAttributes
  return {};
}
