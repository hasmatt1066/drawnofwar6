/**
 * Firebase Storage URL Converter
 *
 * Converts gs:// URLs to publicly accessible HTTP URLs.
 * Handles both emulator and production environments.
 */

import { getStorageBucket } from '../../config/firebase.config.js';

const USE_FIREBASE_EMULATOR = process.env['USE_FIREBASE_EMULATOR'] === 'true';
const FIREBASE_PROJECT_ID = process.env['FIREBASE_PROJECT_ID'];
const FIREBASE_STORAGE_BUCKET = process.env['FIREBASE_STORAGE_BUCKET'] || `${FIREBASE_PROJECT_ID}.appspot.com`;

/**
 * Extract file path from gs:// URL
 *
 * @param gsUrl - Firebase Storage URL (gs://bucket-name/path/to/file)
 * @returns File path within the bucket
 */
function extractFilePath(gsUrl: string): string {
  const match = gsUrl.match(/^gs:\/\/[^/]+\/(.+)$/);
  if (!match) {
    throw new Error(`Invalid gs:// URL format: ${gsUrl}`);
  }
  return match[1];
}

/**
 * Convert gs:// URL to HTTP URL
 *
 * For emulator: http://localhost:9199/v0/b/{bucket}/o/{encodedPath}?alt=media
 * For production: Uses signed URL or public URL from Firebase Storage
 *
 * @param gsUrl - Firebase Storage URL (gs://bucket-name/path/to/file)
 * @returns HTTP URL that can be accessed by browsers
 */
export async function convertGsUrlToHttp(gsUrl: string): Promise<string> {
  try {
    // If it's not a gs:// URL, return as-is (might be http:// or data:)
    if (!gsUrl.startsWith('gs://')) {
      return gsUrl;
    }

    const filePath = extractFilePath(gsUrl);

    if (USE_FIREBASE_EMULATOR) {
      // Emulator URL format
      // http://localhost:9199/v0/b/{bucket}/o/{encodedPath}?alt=media
      const encodedPath = encodeURIComponent(filePath);
      return `http://localhost:9199/v0/b/${FIREBASE_STORAGE_BUCKET}/o/${encodedPath}?alt=media`;
    } else {
      // Production: Use Firebase Storage to get signed URL
      const bucket = getStorageBucket();
      const file = bucket.file(filePath);

      // Get signed URL valid for 1 hour
      // In production with public files, you could use makePublic() instead
      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 60 * 60 * 1000 // 1 hour from now
      });

      return url;
    }
  } catch (error) {
    console.error(`[URL Converter] Error converting ${gsUrl}:`, error);
    throw new Error(`Failed to convert storage URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Convert all gs:// URLs in a creature document to HTTP URLs
 *
 * @param creature - Creature document with gs:// URLs
 * @returns Creature document with HTTP URLs
 */
export async function convertCreatureUrls<T extends {
  sprites: {
    menuSprite: string;
    directions: {
      E: { sprite: string; walkFrames: string[]; idleFrames?: string[]; attackFrames?: string[] };
      NE: { sprite: string; walkFrames: string[]; idleFrames?: string[]; attackFrames?: string[] };
      SE: { sprite: string; walkFrames: string[]; idleFrames?: string[]; attackFrames?: string[] };
    };
  };
}>(creature: T): Promise<T> {
  console.log('[URL Converter] Converting creature URLs');
  console.log('[URL Converter] E idleFrames count:', creature.sprites.directions.E.idleFrames?.length ?? 0);
  console.log('[URL Converter] E attackFrames count:', creature.sprites.directions.E.attackFrames?.length ?? 0);
  console.log('[URL Converter] NE idleFrames count:', creature.sprites.directions.NE.idleFrames?.length ?? 0);
  console.log('[URL Converter] NE attackFrames count:', creature.sprites.directions.NE.attackFrames?.length ?? 0);
  console.log('[URL Converter] SE idleFrames count:', creature.sprites.directions.SE.idleFrames?.length ?? 0);
  console.log('[URL Converter] SE attackFrames count:', creature.sprites.directions.SE.attackFrames?.length ?? 0);

  try {
    // Convert all URLs in parallel for performance
    const [
      menuSprite,
      eSprite,
      neSprite,
      seSprite,
      eWalkFrames,
      neWalkFrames,
      seWalkFrames,
      eIdleFrames,
      neIdleFrames,
      seIdleFrames,
      eAttackFrames,
      neAttackFrames,
      seAttackFrames
    ] = await Promise.all([
      convertGsUrlToHttp(creature.sprites.menuSprite),
      convertGsUrlToHttp(creature.sprites.directions.E.sprite),
      convertGsUrlToHttp(creature.sprites.directions.NE.sprite),
      convertGsUrlToHttp(creature.sprites.directions.SE.sprite),
      Promise.all(creature.sprites.directions.E.walkFrames.map(convertGsUrlToHttp)),
      Promise.all(creature.sprites.directions.NE.walkFrames.map(convertGsUrlToHttp)),
      Promise.all(creature.sprites.directions.SE.walkFrames.map(convertGsUrlToHttp)),
      // Convert idle frames (optional, may not exist on older creatures)
      creature.sprites.directions.E.idleFrames
        ? Promise.all(creature.sprites.directions.E.idleFrames.map(convertGsUrlToHttp))
        : Promise.resolve(undefined),
      creature.sprites.directions.NE.idleFrames
        ? Promise.all(creature.sprites.directions.NE.idleFrames.map(convertGsUrlToHttp))
        : Promise.resolve(undefined),
      creature.sprites.directions.SE.idleFrames
        ? Promise.all(creature.sprites.directions.SE.idleFrames.map(convertGsUrlToHttp))
        : Promise.resolve(undefined),
      // Convert attack frames (optional, may not exist on older creatures)
      creature.sprites.directions.E.attackFrames
        ? Promise.all(creature.sprites.directions.E.attackFrames.map(convertGsUrlToHttp))
        : Promise.resolve(undefined),
      creature.sprites.directions.NE.attackFrames
        ? Promise.all(creature.sprites.directions.NE.attackFrames.map(convertGsUrlToHttp))
        : Promise.resolve(undefined),
      creature.sprites.directions.SE.attackFrames
        ? Promise.all(creature.sprites.directions.SE.attackFrames.map(convertGsUrlToHttp))
        : Promise.resolve(undefined)
    ]);

    const result = {
      ...creature,
      sprites: {
        menuSprite,
        directions: {
          E: {
            sprite: eSprite,
            walkFrames: eWalkFrames,
            ...(eIdleFrames && { idleFrames: eIdleFrames }),
            ...(eAttackFrames && { attackFrames: eAttackFrames })
          },
          NE: {
            sprite: neSprite,
            walkFrames: neWalkFrames,
            ...(neIdleFrames && { idleFrames: neIdleFrames }),
            ...(neAttackFrames && { attackFrames: neAttackFrames })
          },
          SE: {
            sprite: seSprite,
            walkFrames: seWalkFrames,
            ...(seIdleFrames && { idleFrames: seIdleFrames }),
            ...(seAttackFrames && { attackFrames: seAttackFrames })
          }
        }
      }
    };

    console.log('[URL Converter] Conversion complete');
    console.log('[URL Converter] Result E idleFrames count:', result.sprites.directions.E.idleFrames?.length ?? 0);
    console.log('[URL Converter] Result E attackFrames count:', result.sprites.directions.E.attackFrames?.length ?? 0);
    console.log('[URL Converter] Sample E idle frame URL:', result.sprites.directions.E.idleFrames?.[0]);
    console.log('[URL Converter] Sample E attack frame URL:', result.sprites.directions.E.attackFrames?.[0]);

    return result;
  } catch (error) {
    console.error('[URL Converter] Error converting creature URLs:', error);
    throw new Error(`Failed to convert creature URLs: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Convert URLs for multiple creatures in parallel
 *
 * @param creatures - Array of creatures with gs:// URLs
 * @returns Array of creatures with HTTP URLs
 */
export async function convertManyCreatureUrls<T extends {
  sprites: {
    menuSprite: string;
    directions: {
      E: { sprite: string; walkFrames: string[]; idleFrames?: string[]; attackFrames?: string[] };
      NE: { sprite: string; walkFrames: string[]; idleFrames?: string[]; attackFrames?: string[] };
      SE: { sprite: string; walkFrames: string[]; idleFrames?: string[]; attackFrames?: string[] };
    };
  };
}>(creatures: T[]): Promise<T[]> {
  return Promise.all(creatures.map(creature => convertCreatureUrls(creature)));
}
