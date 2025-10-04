/**
 * Combat API Routes
 *
 * REST API for combat initialization, state queries, and control.
 */

import express, { type Request, type Response } from 'express';
import type { DeploymentState } from '../../../../shared/src/types/deployment.js';
import { combatStateManager } from '../../services/combat/combat-state-manager.js';

const router = express.Router();

/**
 * POST /api/combat/:matchId/start
 * Initialize and start combat from deployment state
 */
router.post('/:matchId/start', async (req: Request, res: Response) => {
  try {
    const { matchId } = req.params;
    const deployment: DeploymentState = req.body;

    // Validate deployment
    if (!deployment || !deployment.player1 || !deployment.player2) {
      return res.status(400).json({
        error: 'Invalid deployment',
        message: 'Deployment state must include both players'
      });
    }

    // Check if combat already active
    if (combatStateManager.isActive(matchId)) {
      return res.status(409).json({
        error: 'Combat already active',
        message: `Combat is already running for match ${matchId}`
      });
    }

    // Start combat (async, fire and forget for now)
    // In production, you'd use Socket.IO for real-time updates
    combatStateManager.startCombat(matchId, deployment);

    res.json({
      success: true,
      matchId,
      message: 'Combat started successfully'
    });
  } catch (error: any) {
    console.error('[Combat API] Error starting combat:', error);
    res.status(500).json({
      error: 'Failed to start combat',
      message: error.message
    });
  }
});

/**
 * GET /api/combat/:matchId/state
 * Get current combat state snapshot
 */
router.get('/:matchId/state', (req: Request, res: Response) => {
  try {
    const { matchId } = req.params;

    const state = combatStateManager.getState(matchId);

    if (!state) {
      // Check if there's a result (combat completed)
      const result = combatStateManager.getResult(matchId);
      if (result) {
        return res.json({
          status: 'completed',
          result
        });
      }

      return res.status(404).json({
        error: 'Combat not found',
        message: `No active or completed combat found for match ${matchId}`
      });
    }

    res.json({
      status: 'active',
      state
    });
  } catch (error: any) {
    console.error('[Combat API] Error getting state:', error);
    res.status(500).json({
      error: 'Failed to get combat state',
      message: error.message
    });
  }
});

/**
 * POST /api/combat/:matchId/stop
 * Stop/forfeit combat
 */
router.post('/:matchId/stop', (req: Request, res: Response) => {
  try {
    const { matchId } = req.params;

    if (!combatStateManager.isActive(matchId)) {
      return res.status(404).json({
        error: 'Combat not active',
        message: `No active combat found for match ${matchId}`
      });
    }

    combatStateManager.stopCombat(matchId);

    res.json({
      success: true,
      matchId,
      message: 'Combat stopped successfully'
    });
  } catch (error: any) {
    console.error('[Combat API] Error stopping combat:', error);
    res.status(500).json({
      error: 'Failed to stop combat',
      message: error.message
    });
  }
});

/**
 * POST /api/combat/:matchId/pause
 * Pause combat (for debugging/testing)
 */
router.post('/:matchId/pause', (req: Request, res: Response) => {
  try {
    const { matchId } = req.params;

    if (!combatStateManager.isActive(matchId)) {
      return res.status(404).json({
        error: 'Combat not active',
        message: `No active combat found for match ${matchId}`
      });
    }

    combatStateManager.pauseCombat(matchId);

    res.json({
      success: true,
      matchId,
      message: 'Combat paused successfully'
    });
  } catch (error: any) {
    console.error('[Combat API] Error pausing combat:', error);
    res.status(500).json({
      error: 'Failed to pause combat',
      message: error.message
    });
  }
});

/**
 * GET /api/combat/:matchId/result
 * Get combat result (after completion)
 */
router.get('/:matchId/result', (req: Request, res: Response) => {
  try {
    const { matchId } = req.params;

    const result = combatStateManager.getResult(matchId);

    if (!result) {
      return res.status(404).json({
        error: 'Result not found',
        message: `No combat result found for match ${matchId}`
      });
    }

    res.json({
      success: true,
      result
    });
  } catch (error: any) {
    console.error('[Combat API] Error getting result:', error);
    res.status(500).json({
      error: 'Failed to get combat result',
      message: error.message
    });
  }
});

/**
 * GET /api/combat/stats
 * Get combat manager statistics
 */
router.get('/stats', (req: Request, res: Response) => {
  try {
    const stats = combatStateManager.getStatistics();

    res.json({
      success: true,
      statistics: stats
    });
  } catch (error: any) {
    console.error('[Combat API] Error getting stats:', error);
    res.status(500).json({
      error: 'Failed to get statistics',
      message: error.message
    });
  }
});

export const combatRouter = router;
