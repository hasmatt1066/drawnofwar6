/**
 * Library Animations API Routes
 *
 * Serves pre-generated library animation sprites to the frontend.
 */

import express, { Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to library animations directory (in project root/assets)
const LIBRARY_ANIMATIONS_DIR = path.join(__dirname, '../../../../assets/library-animations');

/**
 * GET /api/library-animations/:animationId
 *
 * Returns metadata and frames for a specific library animation
 */
router.get('/:animationId', async (req: Request, res: Response) => {
  try {
    const { animationId } = req.params;

    // Validate animation ID (alphanumeric + underscore only)
    if (!/^[a-z_]+$/.test(animationId)) {
      return res.status(400).json({
        error: 'Invalid animation ID format'
      });
    }

    const animDir = path.join(LIBRARY_ANIMATIONS_DIR, animationId);

    // Check if animation exists
    try {
      await fs.access(animDir);
    } catch {
      return res.status(404).json({
        error: 'Animation not found',
        animationId
      });
    }

    // Read metadata
    const metadataPath = path.join(animDir, 'metadata.json');
    const metadataContent = await fs.readFile(metadataPath, 'utf-8');
    const metadata = JSON.parse(metadataContent);

    // Read base sprite
    const baseSpritePath = path.join(animDir, 'base-sprite.png');
    const baseSpriteBuffer = await fs.readFile(baseSpritePath);
    const baseSpriteBase64 = baseSpriteBuffer.toString('base64');

    // Read animation frames
    const frames: string[] = [];
    for (let i = 0; i < metadata.frameCount; i++) {
      const framePath = path.join(animDir, `frame-${i}.png`);
      const frameBuffer = await fs.readFile(framePath);
      frames.push(frameBuffer.toString('base64'));
    }

    res.json({
      animationId: metadata.animationId,
      action: metadata.action,
      description: metadata.description,
      frameCount: metadata.frameCount,
      generatedAt: metadata.generatedAt,
      baseSprite: baseSpriteBase64,
      frames
    });

  } catch (error: any) {
    console.error('Error serving library animation:', error);
    res.status(500).json({
      error: 'Failed to load library animation',
      message: error.message
    });
  }
});

/**
 * GET /api/library-animations
 *
 * Returns list of all available library animations
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Check if library directory exists
    try {
      await fs.access(LIBRARY_ANIMATIONS_DIR);
    } catch {
      return res.json({
        animations: [],
        total: 0,
        message: 'Library animations not yet generated'
      });
    }

    // Read all animation directories
    const entries = await fs.readdir(LIBRARY_ANIMATIONS_DIR, { withFileTypes: true });
    const animationDirs = entries.filter(entry => entry.isDirectory());

    const animations = await Promise.all(
      animationDirs.map(async (dir) => {
        const metadataPath = path.join(LIBRARY_ANIMATIONS_DIR, dir.name, 'metadata.json');
        try {
          const metadataContent = await fs.readFile(metadataPath, 'utf-8');
          const metadata = JSON.parse(metadataContent);
          return {
            animationId: metadata.animationId,
            action: metadata.action,
            description: metadata.description,
            frameCount: metadata.frameCount
          };
        } catch {
          return null;
        }
      })
    );

    const validAnimations = animations.filter(a => a !== null);

    res.json({
      animations: validAnimations,
      total: validAnimations.length
    });

  } catch (error: any) {
    console.error('Error listing library animations:', error);
    res.status(500).json({
      error: 'Failed to list library animations',
      message: error.message
    });
  }
});

export default router;
