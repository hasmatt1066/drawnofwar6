/**
 * Deployment Controller
 *
 * Handles HTTP requests for deployment validation and management.
 * Enforces server-side validation to prevent cheating.
 */

import type { Request, Response, NextFunction } from 'express';
import { deploymentValidator } from '../../services/deployment-validator.js';
import { deploymentStore } from '../../services/deployment-store.js';
import type { PlayerDeploymentState } from '@drawn-of-war/shared';

/**
 * POST /api/deployment/validate
 *
 * Validate a deployment without storing it.
 * Used for real-time validation feedback.
 *
 * Request body:
 *   - deployment: PlayerDeploymentState
 *
 * Response:
 *   200 OK - { valid: true, ... }
 *   400 Bad Request - { valid: false, errors: [...] }
 */
export async function validateDeploymentController(
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const deployment = req.body.deployment as PlayerDeploymentState;

    // Validate request body
    if (!deployment) {
      res.status(400).json({
        error: 'Missing Deployment',
        message: 'Request body must include deployment object',
        code: 'MISSING_DEPLOYMENT'
      });
      return;
    }

    if (!deployment.playerId) {
      res.status(400).json({
        error: 'Invalid Deployment',
        message: 'deployment.playerId is required',
        code: 'INVALID_DEPLOYMENT'
      });
      return;
    }

    // Validate deployment
    const validation = deploymentValidator.validateDeploymentComplete(deployment);

    if (validation.valid) {
      res.status(200).json({
        valid: true,
        complete: validation.complete,
        placedCount: validation.placedCount,
        totalCount: validation.totalCount,
        message: 'Deployment is valid and complete'
      });
    } else {
      res.status(400).json({
        valid: false,
        complete: validation.complete,
        placedCount: validation.placedCount,
        totalCount: validation.totalCount,
        errors: validation.errors,
        message: `Deployment validation failed with ${validation.errors.length} error(s)`
      });
    }
  } catch (error: any) {
    console.error('[Deployment Validate] Error:', error);
    res.status(500).json({
      error: 'Validation Error',
      message: error.message || 'Failed to validate deployment',
      code: 'VALIDATION_ERROR'
    });
  }
}

/**
 * POST /api/deployment/submit
 *
 * Submit and lock final deployment.
 * Performs server-side validation with anti-cheat checks.
 *
 * Request body:
 *   - matchId: string
 *   - deployment: PlayerDeploymentState
 *
 * Response:
 *   200 OK - { accepted: true, locked: true }
 *   400 Bad Request - { accepted: false, reason: ..., errors: [...] }
 *   409 Conflict - { error: 'Already Locked' }
 */
export async function submitDeploymentController(
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const { matchId, deployment } = req.body as {
      matchId: string;
      deployment: PlayerDeploymentState;
    };

    // Validate request body
    if (!matchId) {
      res.status(400).json({
        error: 'Missing Match ID',
        message: 'Request body must include matchId',
        code: 'MISSING_MATCH_ID'
      });
      return;
    }

    if (!deployment) {
      res.status(400).json({
        error: 'Missing Deployment',
        message: 'Request body must include deployment object',
        code: 'MISSING_DEPLOYMENT'
      });
      return;
    }

    // Check if already locked
    if (deploymentStore.isLocked(matchId, deployment.playerId)) {
      res.status(409).json({
        error: 'Already Locked',
        message: 'Deployment is already locked and cannot be modified',
        code: 'DEPLOYMENT_LOCKED'
      });
      return;
    }

    // Perform server-side validation (anti-cheat)
    const serverValidation = deploymentValidator.validateServerDeployment(deployment);

    if (!serverValidation.accepted) {
      res.status(400).json({
        accepted: false,
        reason: serverValidation.reason,
        tamperedFields: serverValidation.tamperedFields,
        message: 'Deployment rejected due to validation failure or tampering',
        code: 'VALIDATION_FAILED'
      });
      return;
    }

    // Mark deployment as locked
    const lockedDeployment: PlayerDeploymentState = {
      ...deployment,
      isLocked: true,
      isReady: true,
      readyAt: new Date()
    };

    // Store locked deployment
    const stored = deploymentStore.setDeployment(matchId, lockedDeployment);

    if (!stored) {
      res.status(500).json({
        error: 'Storage Error',
        message: 'Failed to store deployment',
        code: 'STORAGE_ERROR'
      });
      return;
    }

    // Lock the deployment
    const locked = deploymentStore.lockDeployment(matchId, deployment.playerId);

    if (!locked) {
      res.status(500).json({
        error: 'Lock Error',
        message: 'Failed to lock deployment',
        code: 'LOCK_ERROR'
      });
      return;
    }

    // Check if both players are ready
    const bothLocked = deploymentStore.areBothPlayersLocked(matchId);

    res.status(200).json({
      accepted: true,
      locked: true,
      playerId: deployment.playerId,
      matchId,
      bothPlayersReady: bothLocked,
      message: 'Deployment submitted and locked successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[Deployment Submit] Error:', error);
    res.status(500).json({
      error: 'Submit Error',
      message: error.message || 'Failed to submit deployment',
      code: 'SUBMIT_ERROR'
    });
  }
}

/**
 * GET /api/deployment/:matchId/:playerId
 *
 * Get current deployment for a player.
 *
 * Response:
 *   200 OK - { deployment: PlayerDeploymentState }
 *   404 Not Found - { error: 'Not Found' }
 */
export async function getDeploymentController(
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const { matchId, playerId } = req.params;

    // Validate playerId
    if (playerId !== 'player1' && playerId !== 'player2') {
      res.status(400).json({
        error: 'Invalid Player ID',
        message: 'playerId must be "player1" or "player2"',
        code: 'INVALID_PLAYER_ID',
        received: playerId
      });
      return;
    }

    // Get deployment
    const deployment = deploymentStore.getDeployment(matchId, playerId);

    if (!deployment) {
      res.status(404).json({
        error: 'Not Found',
        message: `No deployment found for ${playerId} in match ${matchId}`,
        code: 'DEPLOYMENT_NOT_FOUND',
        matchId,
        playerId
      });
      return;
    }

    // Get entry metadata
    const entry = deploymentStore.getDeploymentEntry(matchId, playerId);

    res.status(200).json({
      deployment,
      metadata: {
        createdAt: entry?.createdAt.toISOString(),
        updatedAt: entry?.updatedAt.toISOString(),
        isLocked: entry?.isLocked || false,
        lockedAt: entry?.lockedAt?.toISOString() || null
      }
    });
  } catch (error: any) {
    console.error('[Deployment Get] Error:', error);
    res.status(500).json({
      error: 'Retrieval Error',
      message: error.message || 'Failed to retrieve deployment',
      code: 'RETRIEVAL_ERROR'
    });
  }
}

/**
 * DELETE /api/deployment/:matchId/:playerId
 *
 * Clear deployment for a player (only if not locked).
 *
 * Response:
 *   200 OK - { deleted: true }
 *   404 Not Found - { error: 'Not Found' }
 *   409 Conflict - { error: 'Cannot Delete Locked Deployment' }
 */
export async function deleteDeploymentController(
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const { matchId, playerId } = req.params;

    // Validate playerId
    if (playerId !== 'player1' && playerId !== 'player2') {
      res.status(400).json({
        error: 'Invalid Player ID',
        message: 'playerId must be "player1" or "player2"',
        code: 'INVALID_PLAYER_ID',
        received: playerId
      });
      return;
    }

    // Check if exists
    const deployment = deploymentStore.getDeployment(matchId, playerId);
    if (!deployment) {
      res.status(404).json({
        error: 'Not Found',
        message: `No deployment found for ${playerId} in match ${matchId}`,
        code: 'DEPLOYMENT_NOT_FOUND',
        matchId,
        playerId
      });
      return;
    }

    // Check if locked
    if (deploymentStore.isLocked(matchId, playerId)) {
      res.status(409).json({
        error: 'Cannot Delete Locked Deployment',
        message: 'Deployment is locked and cannot be deleted',
        code: 'DEPLOYMENT_LOCKED',
        matchId,
        playerId
      });
      return;
    }

    // Delete deployment
    const deleted = deploymentStore.deleteDeployment(matchId, playerId);

    if (!deleted) {
      res.status(500).json({
        error: 'Deletion Error',
        message: 'Failed to delete deployment',
        code: 'DELETION_ERROR'
      });
      return;
    }

    res.status(200).json({
      deleted: true,
      matchId,
      playerId,
      message: 'Deployment deleted successfully'
    });
  } catch (error: any) {
    console.error('[Deployment Delete] Error:', error);
    res.status(500).json({
      error: 'Deletion Error',
      message: error.message || 'Failed to delete deployment',
      code: 'DELETION_ERROR'
    });
  }
}

/**
 * GET /api/deployment/:matchId/status
 *
 * Get deployment status for both players in a match.
 *
 * Response:
 *   200 OK - { player1: {...}, player2: {...}, bothReady: boolean }
 */
export async function getMatchStatusController(
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const { matchId } = req.params;

    const deployments = deploymentStore.getMatchDeployments(matchId);
    const bothLocked = deploymentStore.areBothPlayersLocked(matchId);

    res.status(200).json({
      matchId,
      player1: deployments.player1
        ? {
            hasDeployment: true,
            isLocked: deploymentStore.isLocked(matchId, 'player1'),
            placedCount: deployments.player1.placements.length,
            maxCreatures: deployments.player1.maxCreatures,
            isReady: deployments.player1.isReady
          }
        : {
            hasDeployment: false,
            isLocked: false,
            placedCount: 0,
            maxCreatures: 8,
            isReady: false
          },
      player2: deployments.player2
        ? {
            hasDeployment: true,
            isLocked: deploymentStore.isLocked(matchId, 'player2'),
            placedCount: deployments.player2.placements.length,
            maxCreatures: deployments.player2.maxCreatures,
            isReady: deployments.player2.isReady
          }
        : {
            hasDeployment: false,
            isLocked: false,
            placedCount: 0,
            maxCreatures: 8,
            isReady: false
          },
      bothPlayersReady: bothLocked,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[Match Status] Error:', error);
    res.status(500).json({
      error: 'Status Error',
      message: error.message || 'Failed to get match status',
      code: 'STATUS_ERROR'
    });
  }
}
