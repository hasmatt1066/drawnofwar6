/**
 * Creature Save Service
 *
 * TASK-CLS-2.2: Orchestrates the complete save flow for creatures
 *
 * Flow:
 * 1. Fetch BullMQ job and extract GenerationResult
 * 2. Transform GenerationResult → CreatureDocumentInput
 * 3. Upload sprites to Firebase Storage (parallel)
 * 4. Save creature document to Firestore
 * 5. Handle rollback on failure
 */

import type { Queue } from 'bullmq';
import type { GenerationResult } from '../types/generation.js';
import type { CreatureDocument, OwnerId } from '@drawn-of-war/shared';
import { getGenerationToCreatureTransformer } from './transform/generation-to-creature.service.js';
import { getCreatureStorageService } from './storage/creature-storage.service.js';
import { getCreatureRepository } from '../repositories/creature.repository.js';

export interface SaveCreatureRequest {
  jobId: string;
  ownerId: OwnerId;
}

export interface SaveCreatureResult {
  success: boolean;
  creatureId: string;
  creature: CreatureDocument;
}

export class CreatureSaveService {
  private queue: Queue;
  private transformer = getGenerationToCreatureTransformer();
  private storageService = getCreatureStorageService();
  private repository = getCreatureRepository();

  constructor(queue: Queue) {
    this.queue = queue;
  }

  /**
   * Save a creature from a completed generation job
   *
   * Atomic operation: Rolls back storage uploads if Firestore save fails
   */
  async saveCreature(request: SaveCreatureRequest): Promise<SaveCreatureResult> {
    const { jobId, ownerId } = request;

    console.log(`[CreatureSaveService] Starting save for job ${jobId}, owner ${ownerId}`);

    // Step 1: Fetch BullMQ job
    const job = await this.queue.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found in queue`);
    }

    // Ensure job is completed
    const state = await job.getState();
    if (state !== 'completed') {
      throw new Error(`Job ${jobId} is not completed (current state: ${state})`);
    }

    // Get generation result from job return value
    const generationResult = job.returnvalue as GenerationResult;
    if (!generationResult) {
      throw new Error(`Job ${jobId} has no return value`);
    }

    console.log(`[CreatureSaveService] Retrieved generation result for job ${jobId}`);

    // Step 2: Transform to creature document input
    const creatureInput = this.transformer.transform(generationResult, ownerId, jobId);
    console.log(`[CreatureSaveService] Transformed to creature: ${creatureInput.name}`);

    // Step 3: Create initial Firestore document to get ID
    const creatureDoc = await this.repository.create(creatureInput);
    const creatureId = creatureDoc.id;
    console.log(`[CreatureSaveService] Created Firestore document with ID: ${creatureId}`);

    let uploadedSprites = false;

    try {
      // Step 4: Upload sprites to Firebase Storage (parallel)
      console.log(`[CreatureSaveService] Uploading sprites for creature ${creatureId}...`);

      // Validate that we have the required sprite data
      if (!generationResult.spriteImageBase64) {
        throw new Error('Generation result missing menu sprite (spriteImageBase64)');
      }

      // Handle battlefield directional views or fallback to legacy single sprite
      let directionalSprites;

      if (generationResult.battlefieldDirectionalViews) {
        // Use modern multi-directional views
        console.log(`[CreatureSaveService] Using multi-directional battlefield views`);
        directionalSprites = {
          E: {
            sprite: generationResult.battlefieldDirectionalViews.E.sprite,
            walkFrames: generationResult.battlefieldDirectionalViews.E.walkFrames,
            idleFrames: generationResult.battlefieldDirectionalViews.E.idleFrames,
            attackFrames: generationResult.battlefieldDirectionalViews.E.attackFrames
          },
          NE: {
            sprite: generationResult.battlefieldDirectionalViews.NE.sprite,
            walkFrames: generationResult.battlefieldDirectionalViews.NE.walkFrames,
            idleFrames: generationResult.battlefieldDirectionalViews.NE.idleFrames,
            attackFrames: generationResult.battlefieldDirectionalViews.NE.attackFrames
          },
          SE: {
            sprite: generationResult.battlefieldDirectionalViews.SE.sprite,
            walkFrames: generationResult.battlefieldDirectionalViews.SE.walkFrames,
            idleFrames: generationResult.battlefieldDirectionalViews.SE.idleFrames,
            attackFrames: generationResult.battlefieldDirectionalViews.SE.attackFrames
          }
        };
      } else if (generationResult.battlefieldSprite) {
        // Fallback to legacy single battlefield sprite
        // Use the same sprite for all 3 directions (renderer will mirror as needed)
        console.warn(`[CreatureSaveService] No multi-directional views, using legacy battlefield sprite for all directions`);
        const walkFrames = generationResult.battlefieldWalkFrames || [generationResult.battlefieldSprite];
        // Use static sprite for idle/attack animations as fallback (prevents empty texture arrays)
        const idleFrames = [generationResult.battlefieldSprite];
        const attackFrames = [generationResult.battlefieldSprite];
        directionalSprites = {
          E: { sprite: generationResult.battlefieldSprite, walkFrames, idleFrames, attackFrames },
          NE: { sprite: generationResult.battlefieldSprite, walkFrames, idleFrames, attackFrames },
          SE: { sprite: generationResult.battlefieldSprite, walkFrames, idleFrames, attackFrames }
        };
      } else {
        // No battlefield sprites at all - use menu sprite as fallback
        console.warn(`[CreatureSaveService] No battlefield sprites, using menu sprite as fallback`);
        const walkFrames = generationResult.animationFrames || [generationResult.spriteImageBase64];
        // Use static sprite for idle/attack animations as fallback (prevents empty texture arrays)
        const idleFrames = [generationResult.spriteImageBase64];
        const attackFrames = [generationResult.spriteImageBase64];
        directionalSprites = {
          E: { sprite: generationResult.spriteImageBase64, walkFrames, idleFrames, attackFrames },
          NE: { sprite: generationResult.spriteImageBase64, walkFrames, idleFrames, attackFrames },
          SE: { sprite: generationResult.spriteImageBase64, walkFrames, idleFrames, attackFrames }
        };
      }

      // DIAGNOSTIC: Log what we're about to upload
      console.log(`[CreatureSaveService] About to upload sprites for creature ${creatureId}:`);
      console.log(`  E sprite: ${directionalSprites.E.sprite ? 'present' : 'MISSING'}`);
      console.log(`  E walkFrames count: ${directionalSprites.E.walkFrames.length}`);
      console.log(`  E idleFrames count: ${directionalSprites.E.idleFrames?.length ?? 0}`);
      console.log(`  E attackFrames count: ${directionalSprites.E.attackFrames?.length ?? 0}`);

      const spriteUrls = await this.storageService.uploadAllCreatureSprites(creatureId, {
        menuSprite: generationResult.spriteImageBase64,
        directions: directionalSprites
      });

      uploadedSprites = true;
      console.log(`[CreatureSaveService] Successfully uploaded all sprites for creature ${creatureId}`);
      console.log(`  Returned E idleFrames count: ${spriteUrls.directions.E.idleFrames.length}`);
      console.log(`  Returned E attackFrames count: ${spriteUrls.directions.E.attackFrames.length}`);

      // Step 5: Update Firestore document with storage URLs
      await this.repository.update(creatureId, {
        sprites: spriteUrls
      });

      console.log(`[CreatureSaveService] Successfully saved creature ${creatureId}`);

      // Return updated creature document
      const savedCreature = await this.repository.findById(creatureId);
      if (!savedCreature) {
        throw new Error(`Failed to retrieve saved creature ${creatureId}`);
      }

      return {
        success: true,
        creatureId,
        creature: savedCreature
      };

    } catch (error) {
      console.error(`[CreatureSaveService] Error saving creature ${creatureId}:`, error);

      // Rollback: Delete Firestore document if sprites failed to upload
      if (!uploadedSprites) {
        try {
          await this.repository.delete(creatureId);
          console.log(`[CreatureSaveService] Rolled back Firestore document ${creatureId}`);
        } catch (rollbackError) {
          console.error(`[CreatureSaveService] Failed to rollback Firestore document:`, rollbackError);
        }
      } else {
        // If sprites uploaded but Firestore update failed, clean up sprites
        try {
          await this.storageService.deleteCreatureAssets(creatureId);
          await this.repository.delete(creatureId);
          console.log(`[CreatureSaveService] Rolled back sprites and Firestore document ${creatureId}`);
        } catch (rollbackError) {
          console.error(`[CreatureSaveService] Failed to rollback sprites:`, rollbackError);
        }
      }

      throw new Error(`Failed to save creature: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Factory function for creating service instance
export function createCreatureSaveService(queue: Queue): CreatureSaveService {
  return new CreatureSaveService(queue);
}
