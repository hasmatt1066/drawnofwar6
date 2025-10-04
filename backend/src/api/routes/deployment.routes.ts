/**
 * Deployment Routes
 *
 * API endpoints for managing deployment phase including ready/lock mechanisms.
 */

import express, { Request, Response } from 'express';
import type { CreaturePlacement } from '@drawn-of-war/shared';
import * as matchStateService from '../../services/match-state.js';
import { deploymentValidator } from '../../services/deployment-validator.js';

export const deploymentRouter = express.Router();

/**
 * POST /api/deployment/:matchId/create
 * Create a new match in deployment phase
 */
deploymentRouter.post('/:matchId/create', (req: Request, res: Response) => {
  const { matchId } = req.params;
  const { roundNumber } = req.body;

  try {
    const matchState = matchStateService.createMatch(matchId, roundNumber || 1);
    res.json({
      success: true,
      matchState
    });
  } catch (error) {
    console.error('Error creating match:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create match'
    });
  }
});

/**
 * GET /api/deployment/:matchId/status
 * Get deployment status for a match (both players' ready states, countdown, etc.)
 */
deploymentRouter.get('/:matchId/status', (req: Request, res: Response) => {
  const { matchId } = req.params;

  try {
    const deploymentStatus = matchStateService.getDeploymentStatus(matchId);

    if (!deploymentStatus) {
      return res.status(404).json({
        success: false,
        error: 'Match not found'
      });
    }

    res.json({
      success: true,
      deploymentStatus
    });
  } catch (error) {
    console.error('Error getting deployment status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get deployment status'
    });
  }
});

/**
 * POST /api/deployment/:matchId/:playerId/ready
 * Mark player as ready (start countdown or lock if both ready)
 */
deploymentRouter.post('/:matchId/:playerId/ready', (req: Request, res: Response) => {
  const { matchId, playerId } = req.params;

  // Validate playerId
  if (playerId !== 'player1' && playerId !== 'player2') {
    return res.status(400).json({
      success: false,
      error: 'Invalid playerId. Must be "player1" or "player2"'
    });
  }

  try {
    const deploymentStatus = matchStateService.markPlayerReady(matchId, playerId);

    if (!deploymentStatus) {
      return res.status(404).json({
        success: false,
        error: 'Match not found'
      });
    }

    res.json({
      success: true,
      deploymentStatus
    });
  } catch (error) {
    console.error('Error marking player ready:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark player ready'
    });
  }
});

/**
 * POST /api/deployment/:matchId/:playerId/unready
 * Unmark player as ready (cancel countdown if neither player ready)
 */
deploymentRouter.post('/:matchId/:playerId/unready', (req: Request, res: Response) => {
  const { matchId, playerId } = req.params;

  // Validate playerId
  if (playerId !== 'player1' && playerId !== 'player2') {
    return res.status(400).json({
      success: false,
      error: 'Invalid playerId. Must be "player1" or "player2"'
    });
  }

  try {
    const deploymentStatus = matchStateService.markPlayerUnready(matchId, playerId);

    if (!deploymentStatus) {
      return res.status(404).json({
        success: false,
        error: 'Match not found'
      });
    }

    res.json({
      success: true,
      deploymentStatus
    });
  } catch (error) {
    console.error('Error unmarking player ready:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unmark player ready'
    });
  }
});

/**
 * POST /api/deployment/:matchId/:playerId/placements
 * Store player's creature placements
 */
deploymentRouter.post('/:matchId/:playerId/placements', (req: Request, res: Response) => {
  const { matchId, playerId } = req.params;
  const { placements } = req.body as { placements: CreaturePlacement[] };

  // Validate playerId
  if (playerId !== 'player1' && playerId !== 'player2') {
    return res.status(400).json({
      success: false,
      error: 'Invalid playerId. Must be "player1" or "player2"'
    });
  }

  // Validate placements
  if (!Array.isArray(placements)) {
    return res.status(400).json({
      success: false,
      error: 'Placements must be an array'
    });
  }

  try {
    // Validate placements using deployment validator
    const validation = validatePlacements(placements, playerId);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid placements',
        validationErrors: validation.errors
      });
    }

    const success = matchStateService.storePlacement(matchId, playerId, placements);

    if (!success) {
      return res.status(400).json({
        success: false,
        error: 'Failed to store placements. Match may be locked or not found.'
      });
    }

    res.json({
      success: true,
      placementCount: placements.length
    });
  } catch (error) {
    console.error('Error storing placements:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to store placements'
    });
  }
});

/**
 * GET /api/deployment/:matchId/:playerId/placements
 * Get player's creature placements
 */
deploymentRouter.get('/:matchId/:playerId/placements', (req: Request, res: Response) => {
  const { matchId, playerId } = req.params;

  // Validate playerId
  if (playerId !== 'player1' && playerId !== 'player2') {
    return res.status(400).json({
      success: false,
      error: 'Invalid playerId. Must be "player1" or "player2"'
    });
  }

  try {
    const placements = matchStateService.getPlacements(matchId, playerId);

    if (placements === null) {
      return res.status(404).json({
        success: false,
        error: 'Match not found'
      });
    }

    res.json({
      success: true,
      placements
    });
  } catch (error) {
    console.error('Error getting placements:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get placements'
    });
  }
});

/**
 * GET /api/deployment/:matchId
 * Get complete match state
 */
deploymentRouter.get('/:matchId', (req: Request, res: Response) => {
  const { matchId } = req.params;

  try {
    const matchState = matchStateService.getMatchState(matchId);

    if (!matchState) {
      return res.status(404).json({
        success: false,
        error: 'Match not found'
      });
    }

    res.json({
      success: true,
      matchState
    });
  } catch (error) {
    console.error('Error getting match state:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get match state'
    });
  }
});

/**
 * DELETE /api/deployment/:matchId
 * Delete match (cleanup)
 */
deploymentRouter.delete('/:matchId', (req: Request, res: Response) => {
  const { matchId } = req.params;

  try {
    const success = matchStateService.deleteMatch(matchId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Match not found'
      });
    }

    res.json({
      success: true
    });
  } catch (error) {
    console.error('Error deleting match:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete match'
    });
  }
});

/**
 * POST /api/deployment/:matchId/:playerId/validate
 * Validate placements without storing (for client-side pre-validation)
 */
deploymentRouter.post('/:matchId/:playerId/validate', (req: Request, res: Response) => {
  const { matchId, playerId } = req.params;
  const { placements } = req.body as { placements: CreaturePlacement[] };

  // Validate playerId
  if (playerId !== 'player1' && playerId !== 'player2') {
    return res.status(400).json({
      success: false,
      error: 'Invalid playerId. Must be "player1" or "player2"'
    });
  }

  // Validate placements array
  if (!Array.isArray(placements)) {
    return res.status(400).json({
      success: false,
      error: 'Placements must be an array'
    });
  }

  try {
    const validation = validatePlacements(placements, playerId);

    res.json({
      success: true,
      valid: validation.valid,
      errors: validation.errors
    });
  } catch (error) {
    console.error('Error validating placements:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate placements'
    });
  }
});

/**
 * Helper function to validate placements
 * Converts deployment validator output to a simpler format
 */
function validatePlacements(
  placements: CreaturePlacement[],
  playerId: 'player1' | 'player2'
): { valid: boolean; errors: Array<{ type: string; message: string; hex?: any; creatureId?: string }> } {
  const errors: Array<{ type: string; message: string; hex?: any; creatureId?: string }> = [];

  // Get deployment zone
  const zone = deploymentValidator.getZone(playerId);
  if (!zone) {
    return {
      valid: false,
      errors: [{ type: 'invalid_player', message: `Invalid player ID: ${playerId}` }]
    };
  }

  // Check max creatures
  if (placements.length > 8) {
    errors.push({
      type: 'max_creatures',
      message: `Maximum 8 creatures allowed per player. Found ${placements.length}.`
    });
  }

  // Track occupied hexes and creature IDs
  const occupiedHexes = new Set<string>();
  const creatureIds = new Set<string>();

  for (const placement of placements) {
    const { creature, hex } = placement;

    // Check for duplicate creature IDs
    if (creatureIds.has(creature.id)) {
      errors.push({
        type: 'duplicate_id',
        message: `Duplicate creature ID: ${creature.id}`,
        creatureId: creature.id
      });
      continue;
    }
    creatureIds.add(creature.id);

    // Validate using deployment validator
    const placementMap = new Map<string, typeof creature>();
    for (const p of placements) {
      if (p !== placement) {
        const hexKey = deploymentValidator.getHexGrid().hash(p.hex);
        placementMap.set(hexKey, p.creature);
      }
    }

    const validation = deploymentValidator.isValidPlacement(
      hex,
      creature,
      playerId,
      placementMap,
      false
    );

    if (!validation.valid) {
      errors.push({
        type: validation.reason || 'unknown',
        message: validation.message || 'Invalid placement',
        hex,
        creatureId: creature.id
      });
    }

    // Track this hex as occupied
    const hexKey = `${hex.q},${hex.r}`;
    occupiedHexes.add(hexKey);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
