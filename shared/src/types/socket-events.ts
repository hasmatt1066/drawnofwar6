/**
 * Socket.IO Event Types
 *
 * Type definitions for Socket.IO events used in real-time multiplayer features.
 */

import type { CreaturePlacement, MatchDeploymentStatus } from './deployment.js';

/**
 * Deployment socket events (client -> server)
 */
export interface DeploymentClientEvents {
  /**
   * Join a deployment match room
   */
  'deployment:join': (data: { matchId: string; playerId: 'player1' | 'player2' }) => void;

  /**
   * Place a creature on the grid
   */
  'deployment:place': (data: {
    matchId: string;
    playerId: 'player1' | 'player2';
    placement: CreaturePlacement;
  }) => void;

  /**
   * Remove a creature from the grid
   */
  'deployment:remove': (data: {
    matchId: string;
    playerId: 'player1' | 'player2';
    creatureId: string;
  }) => void;

  /**
   * Mark player as ready
   */
  'deployment:ready': (data: { matchId: string; playerId: 'player1' | 'player2' }) => void;

  /**
   * Unmark player as ready
   */
  'deployment:unready': (data: { matchId: string; playerId: 'player1' | 'player2' }) => void;

  /**
   * Update all placements (bulk update)
   */
  'deployment:update-placements': (data: {
    matchId: string;
    playerId: 'player1' | 'player2';
    placements: CreaturePlacement[];
  }) => void;
}

/**
 * Deployment socket events (server -> client)
 */
export interface DeploymentServerEvents {
  /**
   * Initial state after joining match
   */
  'deployment:state': (data: {
    matchId: string;
    player1Placements: CreaturePlacement[];
    player2Placements: CreaturePlacement[];
    deploymentStatus: MatchDeploymentStatus;
  }) => void;

  /**
   * Opponent placed a creature
   */
  'deployment:opponent-placed': (data: {
    playerId: 'player1' | 'player2';
    placement: CreaturePlacement;
  }) => void;

  /**
   * Opponent removed a creature
   */
  'deployment:opponent-removed': (data: {
    playerId: 'player1' | 'player2';
    creatureId: string;
  }) => void;

  /**
   * Opponent's placements updated (bulk)
   */
  'deployment:opponent-updated': (data: {
    playerId: 'player1' | 'player2';
    placements: CreaturePlacement[];
  }) => void;

  /**
   * Deployment status changed (ready/countdown/lock)
   */
  'deployment:status-changed': (data: MatchDeploymentStatus) => void;

  /**
   * Error occurred
   */
  'deployment:error': (data: { message: string; code?: string }) => void;

  /**
   * Opponent connected
   */
  'deployment:opponent-connected': (data: { playerId: 'player1' | 'player2' }) => void;

  /**
   * Opponent disconnected
   */
  'deployment:opponent-disconnected': (data: { playerId: 'player1' | 'player2' }) => void;

  /**
   * Combat has started for this match
   */
  'deployment:combat-started': (data: { matchId: string }) => void;

  /**
   * Combat has completed with result
   */
  'deployment:combat-completed': (data: {
    matchId: string;
    winner: 'player1' | 'player2' | 'draw';
    reason: string;
    duration: number;
  }) => void;
}

/**
 * Combined deployment socket events
 */
export interface DeploymentSocketEvents extends DeploymentClientEvents, DeploymentServerEvents {}
