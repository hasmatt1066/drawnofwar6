/**
 * Creature Library API Routes
 *
 * TASK-CLS-2.3, TASK-CLS-3.1, TASK-CLS-3.2, TASK-CLS-3.3
 *
 * Handles creature storage, retrieval, and library management.
 */

import { Router } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import type { Request, Response } from 'express';
import { createCreatureSaveService } from '../../services/creature-save.service.js';
import { getCreatureRepository } from '../../repositories/creature.repository.js';
import { queueService } from '../../queue/index.js';
import { convertCreatureUrls, convertManyCreatureUrls } from '../../services/storage/firebase-url-converter.js';
import type { OwnerId, SerializedCreatureDocument } from '@drawn-of-war/shared';

const router = Router();

/**
 * Helper: Serialize creature document for JSON response
 * Converts gs:// URLs to HTTP URLs for browser compatibility
 */
async function serializeCreature(creature: any): Promise<SerializedCreatureDocument> {
  const serialized = {
    ...creature,
    createdAt: creature.createdAt instanceof Date
      ? creature.createdAt.toISOString()
      : creature.createdAt
  };

  // Convert gs:// URLs to HTTP URLs
  return convertCreatureUrls(serialized);
}

/**
 * POST /api/creatures/save
 *
 * Save a creature from a completed generation job.
 *
 * Request body:
 *   { jobId: string, ownerId: 'demo-player1' | 'demo-player2' }
 *
 * Response:
 *   200 OK
 *   { success: true, creatureId: string, creature: SerializedCreatureDocument }
 */
router.post('/save', [
  // Validation middleware
  body('jobId')
    .isString()
    .notEmpty()
    .withMessage('jobId is required'),
  body('ownerId')
    .isIn(['demo-player1', 'demo-player2'])
    .withMessage('ownerId must be demo-player1 or demo-player2'),

  // Handler
  async (req: Request, res: Response) => {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    try {
      const { jobId, ownerId } = req.body as { jobId: string; ownerId: OwnerId };

      console.log(`[Creatures API] Saving creature from job ${jobId} for owner ${ownerId}`);

      // Check if job already saved (duplicate prevention)
      const repository = getCreatureRepository();
      const existingCreature = await repository.findByJobId(jobId);

      if (existingCreature) {
        console.log(`[Creatures API] Job ${jobId} already saved as creature ${existingCreature.id}`);
        res.status(200).json({
          success: true,
          creatureId: existingCreature.id,
          creature: await serializeCreature(existingCreature),
          alreadyExists: true
        });
        return;
      }

      // Proceed with new save
      const queue = queueService.getQueue();
      const saveService = createCreatureSaveService(queue);
      const result = await saveService.saveCreature({ jobId, ownerId });

      res.status(200).json({
        success: true,
        creatureId: result.creatureId,
        creature: await serializeCreature(result.creature)
      });
    } catch (error) {
      console.error('[Creatures API] Error saving creature:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
]);

/**
 * GET /api/creatures/list
 *
 * List creatures owned by a player with pagination.
 *
 * Query params:
 *   ownerId: 'demo-player1' | 'demo-player2' (required)
 *   limit: number (default: 50, max: 100)
 *   offset: number (default: 0)
 *
 * Response:
 *   200 OK
 *   { creatures: SerializedCreatureDocument[], total: number, hasMore: boolean }
 */
router.get('/list', [
  // Validation middleware
  query('ownerId')
    .isIn(['demo-player1', 'demo-player2'])
    .withMessage('ownerId must be demo-player1 or demo-player2'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .toInt()
    .withMessage('limit must be between 1 and 100'),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .toInt()
    .withMessage('offset must be >= 0'),

  // Handler
  async (req: Request, res: Response) => {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    try {
      const ownerId = req.query['ownerId'] as OwnerId;
      const limit = parseInt(req.query['limit'] as string) || 50;
      const offset = parseInt(req.query['offset'] as string) || 0;

      console.log(`[Creatures API] Listing creatures for owner ${ownerId}, limit ${limit}, offset ${offset}`);

      const repository = getCreatureRepository();
      const [creatures, total] = await Promise.all([
        repository.findByOwner(ownerId, limit, offset),
        repository.countByOwner(ownerId)
      ]);

      const hasMore = offset + creatures.length < total;

      // Serialize all creatures (converts gs:// to HTTP URLs)
      const serializedCreatures = await Promise.all(
        creatures.map(creature => serializeCreature(creature))
      );

      res.status(200).json({
        creatures: serializedCreatures,
        total,
        hasMore
      });
    } catch (error) {
      console.error('[Creatures API] Error listing creatures:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
]);

/**
 * GET /api/creatures/batch
 *
 * Get multiple creatures by IDs (validates ownership).
 *
 * IMPORTANT: Must be defined BEFORE /:id route to avoid "batch" being treated as an ID.
 *
 * Query params:
 *   ids: string (comma-separated creature IDs)
 *   ownerId: 'demo-player1' | 'demo-player2' (required)
 *
 * Response:
 *   200 OK
 *   { creatures: SerializedCreatureDocument[], missing: string[] }
 */
router.get('/batch', [
  // Validation middleware
  query('ids')
    .isString()
    .notEmpty()
    .withMessage('ids is required (comma-separated)'),
  query('ownerId')
    .isIn(['demo-player1', 'demo-player2'])
    .withMessage('ownerId must be demo-player1 or demo-player2'),

  // Handler
  async (req: Request, res: Response) => {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    try {
      const idsString = req.query['ids'] as string;
      const ownerId = req.query['ownerId'] as OwnerId;

      // Parse and validate IDs
      const ids = idsString.split(',').map(id => id.trim()).filter(id => id.length > 0);

      if (ids.length === 0) {
        res.status(400).json({ error: 'No valid IDs provided' });
        return;
      }

      console.log(`[Creatures API] Batch fetching ${ids.length} creatures for owner ${ownerId}`);

      const repository = getCreatureRepository();
      const creatures = await repository.findByIds(ids, ownerId);

      // Determine which IDs were not found
      const foundIds = new Set(creatures.map(c => c.id));
      const missing = ids.filter(id => !foundIds.has(id));

      // Serialize all creatures (converts gs:// to HTTP URLs)
      const serializedCreatures = await Promise.all(
        creatures.map(creature => serializeCreature(creature))
      );

      res.status(200).json({
        creatures: serializedCreatures,
        missing
      });
    } catch (error) {
      console.error('[Creatures API] Error batch fetching creatures:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
]);

/**
 * GET /api/creatures/check-saved/:jobId
 *
 * Check if a generation job has already been saved to the gallery.
 *
 * IMPORTANT: Must be defined BEFORE /:id route to avoid "check-saved" being treated as an ID.
 *
 * Response:
 *   200 OK
 *   { saved: true, creatureId: string } (if saved)
 *   { saved: false } (if not saved)
 */
router.get('/check-saved/:jobId', [
  // Validation middleware
  param('jobId')
    .isString()
    .notEmpty()
    .withMessage('jobId is required'),

  // Handler
  async (req: Request, res: Response) => {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    try {
      const jobId = req.params['jobId'];

      console.log(`[Creatures API] Checking if job ${jobId} is saved`);

      const repository = getCreatureRepository();
      const creature = await repository.findByJobId(jobId);

      if (creature) {
        res.status(200).json({
          saved: true,
          creatureId: creature.id
        });
      } else {
        res.status(200).json({
          saved: false
        });
      }
    } catch (error) {
      console.error('[Creatures API] Error checking if job is saved:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
]);

/**
 * GET /api/creatures/:id
 *
 * Get a single creature by ID.
 *
 * IMPORTANT: Must be defined AFTER /batch route to avoid route conflicts.
 *
 * Response:
 *   200 OK
 *   { creature: SerializedCreatureDocument }
 *
 *   404 Not Found
 *   { error: 'Creature not found' }
 */
router.get('/:id', [
  // Validation middleware
  param('id')
    .isString()
    .notEmpty()
    .withMessage('id is required'),

  // Handler
  async (req: Request, res: Response) => {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    try {
      const id = req.params['id'];

      console.log(`[Creatures API] Fetching creature ${id}`);

      const repository = getCreatureRepository();
      const creature = await repository.findById(id);

      if (!creature) {
        res.status(404).json({ error: 'Creature not found' });
        return;
      }

      res.status(200).json({
        creature: await serializeCreature(creature)
      });
    } catch (error) {
      console.error('[Creatures API] Error fetching creature:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
]);

export default router;
export { router as creaturesRouter };
