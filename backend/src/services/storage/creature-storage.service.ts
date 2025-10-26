/**
 * Creature Storage Service
 *
 * Handles uploading creature sprite images to Firebase Storage.
 * Converts base64 data to binary and uploads to structured paths.
 */

import { getStorageBucket } from '../../config/firebase.config.js';
import type { Bucket } from '@google-cloud/storage';

export class CreatureStorageService {
  private bucket: Bucket;

  constructor() {
    this.bucket = getStorageBucket();
  }

  /**
   * Validate base64 format
   */
  private validateBase64(base64Data: string): void {
    if (!base64Data) {
      throw new Error('Base64 data is required');
    }

    // Check if it's a data URL (data:image/png;base64,...)
    const dataUrlPattern = /^data:image\/(png|jpeg|jpg|gif|webp);base64,(.+)$/;
    const match = base64Data.match(dataUrlPattern);

    if (!match) {
      // Not a data URL, check if it's raw base64
      const base64Pattern = /^[A-Za-z0-9+/]+={0,2}$/;
      if (!base64Pattern.test(base64Data.replace(/\s/g, ''))) {
        throw new Error('Invalid base64 format');
      }
    }
  }

  /**
   * Extract buffer from base64 (handles both data URLs and raw base64)
   */
  private extractBuffer(base64Data: string): Buffer {
    // Check if it's a data URL
    const dataUrlPattern = /^data:image\/[^;]+;base64,(.+)$/;
    const match = base64Data.match(dataUrlPattern);

    if (match) {
      // Extract base64 from data URL
      return Buffer.from(match[1], 'base64');
    } else {
      // Raw base64
      return Buffer.from(base64Data, 'base64');
    }
  }

  /**
   * Upload menu sprite (main sprite shown in selection UI)
   */
  async uploadMenuSprite(creatureId: string, base64Data: string): Promise<string> {
    this.validateBase64(base64Data);

    const fileName = `creatures/${creatureId}/menu-sprite.png`;
    const file = this.bucket.file(fileName);

    const buffer = this.extractBuffer(base64Data);

    await file.save(buffer, {
      metadata: {
        contentType: 'image/png',
        metadata: {
          creatureId,
          spriteType: 'menu'
        }
      }
    });

    // Return gs:// URL
    return `gs://${this.bucket.name}/${fileName}`;
  }

  /**
   * Upload directional sprite (E, NE, SE)
   */
  async uploadDirectionalSprite(
    creatureId: string,
    direction: 'E' | 'NE' | 'SE',
    base64Data: string
  ): Promise<string> {
    this.validateBase64(base64Data);

    const fileName = `creatures/${creatureId}/directions/${direction}-sprite.png`;
    const file = this.bucket.file(fileName);

    const buffer = this.extractBuffer(base64Data);

    await file.save(buffer, {
      metadata: {
        contentType: 'image/png',
        metadata: {
          creatureId,
          spriteType: 'directional',
          direction
        }
      }
    });

    return `gs://${this.bucket.name}/${fileName}`;
  }

  /**
   * Upload walk animation frame
   */
  async uploadWalkFrame(
    creatureId: string,
    direction: 'E' | 'NE' | 'SE',
    frameIndex: number,
    base64Data: string
  ): Promise<string> {
    this.validateBase64(base64Data);

    const fileName = `creatures/${creatureId}/directions/${direction}-walk-${frameIndex}.png`;
    const file = this.bucket.file(fileName);

    const buffer = this.extractBuffer(base64Data);

    await file.save(buffer, {
      metadata: {
        contentType: 'image/png',
        metadata: {
          creatureId,
          spriteType: 'walk-frame',
          direction,
          frameIndex: frameIndex.toString()
        }
      }
    });

    return `gs://${this.bucket.name}/${fileName}`;
  }

  /**
   * Upload idle animation frame
   */
  async uploadIdleFrame(
    creatureId: string,
    direction: 'E' | 'NE' | 'SE',
    frameIndex: number,
    base64Data: string
  ): Promise<string> {
    this.validateBase64(base64Data);

    const fileName = `creatures/${creatureId}/directions/${direction}-idle-${frameIndex}.png`;
    const file = this.bucket.file(fileName);

    const buffer = this.extractBuffer(base64Data);

    await file.save(buffer, {
      metadata: {
        contentType: 'image/png',
        metadata: {
          creatureId,
          spriteType: 'idle-frame',
          direction,
          frameIndex: frameIndex.toString()
        }
      }
    });

    return `gs://${this.bucket.name}/${fileName}`;
  }

  /**
   * Upload attack animation frame
   */
  async uploadAttackFrame(
    creatureId: string,
    direction: 'E' | 'NE' | 'SE',
    frameIndex: number,
    base64Data: string
  ): Promise<string> {
    this.validateBase64(base64Data);

    const fileName = `creatures/${creatureId}/directions/${direction}-attack-${frameIndex}.png`;
    const file = this.bucket.file(fileName);

    const buffer = this.extractBuffer(base64Data);

    await file.save(buffer, {
      metadata: {
        contentType: 'image/png',
        metadata: {
          creatureId,
          spriteType: 'attack-frame',
          direction,
          frameIndex: frameIndex.toString()
        }
      }
    });

    return `gs://${this.bucket.name}/${fileName}`;
  }

  /**
   * Delete all assets for a creature (cleanup utility)
   */
  async deleteCreatureAssets(creatureId: string): Promise<void> {
    const prefix = `creatures/${creatureId}/`;

    try {
      const [files] = await this.bucket.getFiles({ prefix });

      if (files.length === 0) {
        console.log(`[CreatureStorageService] No files found for creature ${creatureId}`);
        return;
      }

      // Delete all files in parallel
      await Promise.all(files.map(file => file.delete()));

      console.log(`[CreatureStorageService] Deleted ${files.length} files for creature ${creatureId}`);
    } catch (error) {
      console.error(`[CreatureStorageService] Error deleting assets for creature ${creatureId}:`, error);
      throw new Error(`Failed to delete creature assets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload all sprites for a creature in parallel (optimized batch upload)
   */
  async uploadAllCreatureSprites(creatureId: string, sprites: {
    menuSprite: string;
    directions: {
      E: { sprite: string; walkFrames: string[]; idleFrames?: string[]; attackFrames?: string[] };
      NE: { sprite: string; walkFrames: string[]; idleFrames?: string[]; attackFrames?: string[] };
      SE: { sprite: string; walkFrames: string[]; idleFrames?: string[]; attackFrames?: string[] };
    };
  }): Promise<{
    menuSprite: string;
    directions: {
      E: { sprite: string; walkFrames: string[]; idleFrames: string[]; attackFrames: string[] };
      NE: { sprite: string; walkFrames: string[]; idleFrames: string[]; attackFrames: string[] };
      SE: { sprite: string; walkFrames: string[]; idleFrames: string[]; attackFrames: string[] };
    };
  }> {
    // DIAGNOSTIC: Log what we received
    console.log(`[CreatureStorageService] uploadAllCreatureSprites received:`);
    console.log(`  E idleFrames count: ${sprites.directions.E.idleFrames?.length ?? 0}`);
    console.log(`  E attackFrames count: ${sprites.directions.E.attackFrames?.length ?? 0}`);

    try {
      // Upload all sprites in parallel for maximum performance
      const [
        menuSpriteUrl,
        eSpriteUrl,
        neSpriteUrl,
        seSpriteUrl,
        eWalkFrameUrls,
        neWalkFrameUrls,
        seWalkFrameUrls,
        eIdleFrameUrls,
        neIdleFrameUrls,
        seIdleFrameUrls,
        eAttackFrameUrls,
        neAttackFrameUrls,
        seAttackFrameUrls
      ] = await Promise.all([
        this.uploadMenuSprite(creatureId, sprites.menuSprite),
        this.uploadDirectionalSprite(creatureId, 'E', sprites.directions.E.sprite),
        this.uploadDirectionalSprite(creatureId, 'NE', sprites.directions.NE.sprite),
        this.uploadDirectionalSprite(creatureId, 'SE', sprites.directions.SE.sprite),
        Promise.all(sprites.directions.E.walkFrames.map((frame, i) =>
          this.uploadWalkFrame(creatureId, 'E', i, frame)
        )),
        Promise.all(sprites.directions.NE.walkFrames.map((frame, i) =>
          this.uploadWalkFrame(creatureId, 'NE', i, frame)
        )),
        Promise.all(sprites.directions.SE.walkFrames.map((frame, i) =>
          this.uploadWalkFrame(creatureId, 'SE', i, frame)
        )),
        // Upload idle frames if available (optional for backward compatibility)
        sprites.directions.E.idleFrames && sprites.directions.E.idleFrames.length > 0
          ? Promise.all(sprites.directions.E.idleFrames.map((frame, i) =>
              this.uploadIdleFrame(creatureId, 'E', i, frame)
            ))
          : Promise.resolve([]),
        sprites.directions.NE.idleFrames && sprites.directions.NE.idleFrames.length > 0
          ? Promise.all(sprites.directions.NE.idleFrames.map((frame, i) =>
              this.uploadIdleFrame(creatureId, 'NE', i, frame)
            ))
          : Promise.resolve([]),
        sprites.directions.SE.idleFrames && sprites.directions.SE.idleFrames.length > 0
          ? Promise.all(sprites.directions.SE.idleFrames.map((frame, i) =>
              this.uploadIdleFrame(creatureId, 'SE', i, frame)
            ))
          : Promise.resolve([]),
        // Upload attack frames if available
        sprites.directions.E.attackFrames && sprites.directions.E.attackFrames.length > 0
          ? Promise.all(sprites.directions.E.attackFrames.map((frame, i) =>
              this.uploadAttackFrame(creatureId, 'E', i, frame)
            ))
          : Promise.resolve([]),
        sprites.directions.NE.attackFrames && sprites.directions.NE.attackFrames.length > 0
          ? Promise.all(sprites.directions.NE.attackFrames.map((frame, i) =>
              this.uploadAttackFrame(creatureId, 'NE', i, frame)
            ))
          : Promise.resolve([]),
        sprites.directions.SE.attackFrames && sprites.directions.SE.attackFrames.length > 0
          ? Promise.all(sprites.directions.SE.attackFrames.map((frame, i) =>
              this.uploadAttackFrame(creatureId, 'SE', i, frame)
            ))
          : Promise.resolve([])
      ]);

      // DIAGNOSTIC: Log what we're returning
      console.log(`[CreatureStorageService] uploadAllCreatureSprites returning:`);
      console.log(`  E idleFrames count: ${eIdleFrameUrls.length}`);
      console.log(`  E attackFrames count: ${eAttackFrameUrls.length}`);

      return {
        menuSprite: menuSpriteUrl,
        directions: {
          E: {
            sprite: eSpriteUrl,
            walkFrames: eWalkFrameUrls,
            idleFrames: eIdleFrameUrls,
            attackFrames: eAttackFrameUrls
          },
          NE: {
            sprite: neSpriteUrl,
            walkFrames: neWalkFrameUrls,
            idleFrames: neIdleFrameUrls,
            attackFrames: neAttackFrameUrls
          },
          SE: {
            sprite: seSpriteUrl,
            walkFrames: seWalkFrameUrls,
            idleFrames: seIdleFrameUrls,
            attackFrames: seAttackFrameUrls
          }
        }
      };
    } catch (error) {
      console.error(`[CreatureStorageService] Error uploading sprites for creature ${creatureId}:`, error);

      // Attempt cleanup on failure
      try {
        await this.deleteCreatureAssets(creatureId);
      } catch (cleanupError) {
        console.error(`[CreatureStorageService] Failed to cleanup after upload error:`, cleanupError);
      }

      throw new Error(`Failed to upload creature sprites: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Singleton instance
let storageServiceInstance: CreatureStorageService | null = null;

export function getCreatureStorageService(): CreatureStorageService {
  if (!storageServiceInstance) {
    storageServiceInstance = new CreatureStorageService();
  }
  return storageServiceInstance;
}
