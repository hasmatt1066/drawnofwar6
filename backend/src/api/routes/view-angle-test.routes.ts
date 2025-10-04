/**
 * View Angle Test API Routes
 *
 * Routes for testing different camera angles to determine
 * which works best for isometric battlefield display.
 */

import { Router } from 'express';
import { testViewAnglesController } from '../controllers/view-angle-test.controller.js';

const router = Router();

/**
 * POST /api/test/view-angles
 *
 * Generate sprites from all three view angles for comparison.
 *
 * Request body:
 *    {
 *      description: string (required) - Creature description
 *      size?: 32 | 48 | 64 | 128 (optional, default 64) - Sprite size
 *    }
 *
 * Response:
 *    200 OK
 *    {
 *      description: string,
 *      results: [{
 *        view: string,
 *        baseSprite: string (base64),
 *        animationFrames: string[] (base64),
 *        costUsd: number,
 *        timeMs: number
 *      }],
 *      totalCost: number,
 *      totalTime: number
 *    }
 *
 *    207 Multi-Status (partial success)
 *    {
 *      ...same as above with partial results,
 *      error: { message: string, failedView: string }
 *    }
 */
router.post('/view-angles', testViewAnglesController);

export { router as viewAngleTestRouter };
