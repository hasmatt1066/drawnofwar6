/**
 * Creature Sprites API Routes
 *
 * Handles creature sprite loading and generation for deployment grid.
 */

import { Router, Request, Response } from 'express';
import { getCreatureSpriteManager } from '../../services/creature-sprite-manager.js';

const router = Router();

/**
 * GET /api/creatures/sprites/:creatureId
 *
 * Get sprite for a specific creature.
 *
 * Query parameters:
 *   - name: Creature name (required if generating new sprite)
 *   - regenerate: Force regeneration (optional, default: false)
 *
 * Response:
 *   200 OK
 *   {
 *     creatureId: string,
 *     name: string,
 *     imageBase64: string,
 *     generatedAt: string,
 *     costUsd?: number,
 *     source: 'generated' | 'cached' | 'placeholder'
 *   }
 */
router.get('/sprites/:creatureId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { creatureId } = req.params;
    const name = req.query['name'] as string || creatureId;
    const regenerate = req.query['regenerate'] === 'true';

    // Validate creatureId
    if (!creatureId || typeof creatureId !== 'string') {
      res.status(400).json({
        error: 'Invalid creature ID',
        message: 'creatureId parameter is required and must be a string'
      });
      return;
    }

    // Get sprite manager
    const spriteManager = await getCreatureSpriteManager();

    // Get or generate sprite
    const sprite = await spriteManager.getSprite(creatureId, name, regenerate);

    res.status(200).json(sprite);
  } catch (error) {
    console.error('[CreatureSprites] Error fetching sprite:', error);
    res.status(500).json({
      error: 'Failed to fetch creature sprite',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/creatures/sprites/batch
 *
 * Get sprites for multiple creatures in a single request.
 *
 * Request body:
 *   {
 *     creatures: Array<{ id: string, name: string }>,
 *     regenerate?: boolean
 *   }
 *
 * Response:
 *   200 OK
 *   {
 *     sprites: Array<CreatureSpriteMetadata>
 *   }
 */
router.post('/sprites/batch', async (req: Request, res: Response): Promise<void> => {
  try {
    const { creatures, regenerate = false } = req.body;

    // Validate request
    if (!Array.isArray(creatures)) {
      res.status(400).json({
        error: 'Invalid request',
        message: 'creatures must be an array of { id, name } objects'
      });
      return;
    }

    // Get sprite manager
    const spriteManager = await getCreatureSpriteManager();

    // Fetch all sprites (in parallel for efficiency)
    const spritePromises = creatures.map((creature: { id: string; name: string }) =>
      spriteManager.getSprite(creature.id, creature.name, regenerate as boolean)
    );

    const sprites = await Promise.all(spritePromises);

    res.status(200).json({ sprites });
  } catch (error) {
    console.error('[CreatureSprites] Error fetching batch sprites:', error);
    res.status(500).json({
      error: 'Failed to fetch creature sprites',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/creatures/sprites/cache
 *
 * Clear the sprite cache.
 *
 * Response:
 *   200 OK
 *   { message: string }
 */
router.delete('/sprites/cache', async (_req: Request, res: Response): Promise<void> => {
  try {
    const spriteManager = await getCreatureSpriteManager();
    await spriteManager.clearCache();

    res.status(200).json({
      message: 'Sprite cache cleared successfully'
    });
  } catch (error) {
    console.error('[CreatureSprites] Error clearing cache:', error);
    res.status(500).json({
      error: 'Failed to clear sprite cache',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/creatures/sprites
 *
 * List all cached sprite IDs.
 *
 * Response:
 *   200 OK
 *   { cachedSpriteIds: string[] }
 */
router.get('/sprites', async (_req: Request, res: Response): Promise<void> => {
  try {
    const spriteManager = await getCreatureSpriteManager();
    const cachedSpriteIds = spriteManager.getCachedSpriteIds();

    res.status(200).json({ cachedSpriteIds });
  } catch (error) {
    console.error('[CreatureSprites] Error listing sprites:', error);
    res.status(500).json({
      error: 'Failed to list sprites',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
