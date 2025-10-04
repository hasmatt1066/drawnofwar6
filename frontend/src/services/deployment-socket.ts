/**
 * Deployment Socket.IO Client
 *
 * Client-side Socket.IO connection for real-time deployment synchronization.
 */

import { io, Socket } from 'socket.io-client';
import type {
  DeploymentClientEvents,
  DeploymentServerEvents,
  CreaturePlacement,
  MatchDeploymentStatus
} from '@drawn-of-war/shared';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

/**
 * Deployment socket client
 */
export class DeploymentSocketClient {
  private socket: Socket<DeploymentServerEvents, DeploymentClientEvents> | null = null;
  private matchId: string | null = null;
  private playerId: 'player1' | 'player2' | null = null;

  /**
   * Connect to deployment socket
   */
  connect(matchId: string, playerId: 'player1' | 'player2'): void {
    if (this.socket?.connected) {
      console.warn('[Deployment Socket] Already connected');
      return;
    }

    this.matchId = matchId;
    this.playerId = playerId;

    this.socket = io(BACKEND_URL, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    this.socket.on('connect', () => {
      console.log('[Deployment Socket] Connected');
      // Auto-join match on connect
      if (this.matchId && this.playerId) {
        this.joinMatch(this.matchId, this.playerId);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Deployment Socket] Disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Deployment Socket] Connection error:', error);
    });
  }

  /**
   * Disconnect from deployment socket
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.matchId = null;
      this.playerId = null;
      console.log('[Deployment Socket] Disconnected');
    }
  }

  /**
   * Join a match room
   */
  joinMatch(matchId: string, playerId: 'player1' | 'player2'): void {
    if (!this.socket) {
      console.error('[Deployment Socket] Not connected');
      return;
    }

    this.socket.emit('deployment:join', { matchId, playerId });
    console.log(`[Deployment Socket] Joining match ${matchId} as ${playerId}`);
  }

  /**
   * Place a creature
   */
  placeCreature(placement: CreaturePlacement): void {
    if (!this.socket || !this.matchId || !this.playerId) {
      console.error('[Deployment Socket] Not connected or not joined');
      return;
    }

    this.socket.emit('deployment:place', {
      matchId: this.matchId,
      playerId: this.playerId,
      placement
    });
  }

  /**
   * Remove a creature
   */
  removeCreature(creatureId: string): void {
    if (!this.socket || !this.matchId || !this.playerId) {
      console.error('[Deployment Socket] Not connected or not joined');
      return;
    }

    this.socket.emit('deployment:remove', {
      matchId: this.matchId,
      playerId: this.playerId,
      creatureId
    });
  }

  /**
   * Update all placements (bulk update)
   */
  updatePlacements(placements: CreaturePlacement[]): void {
    if (!this.socket || !this.matchId || !this.playerId) {
      console.error('[Deployment Socket] Not connected or not joined');
      return;
    }

    this.socket.emit('deployment:update-placements', {
      matchId: this.matchId,
      playerId: this.playerId,
      placements
    });
  }

  /**
   * Mark player as ready
   */
  markReady(): void {
    if (!this.socket || !this.matchId || !this.playerId) {
      console.error('[Deployment Socket] Not connected or not joined');
      return;
    }

    this.socket.emit('deployment:ready', {
      matchId: this.matchId,
      playerId: this.playerId
    });
  }

  /**
   * Unmark player as ready
   */
  markUnready(): void {
    if (!this.socket || !this.matchId || !this.playerId) {
      console.error('[Deployment Socket] Not connected or not joined');
      return;
    }

    this.socket.emit('deployment:unready', {
      matchId: this.matchId,
      playerId: this.playerId
    });
  }

  /**
   * Listen for initial state
   */
  onState(
    callback: (data: {
      matchId: string;
      player1Placements: CreaturePlacement[];
      player2Placements: CreaturePlacement[];
      deploymentStatus: MatchDeploymentStatus;
    }) => void
  ): void {
    this.socket?.on('deployment:state', callback);
  }

  /**
   * Listen for opponent placing a creature
   */
  onOpponentPlaced(
    callback: (data: { playerId: 'player1' | 'player2'; placement: CreaturePlacement }) => void
  ): void {
    this.socket?.on('deployment:opponent-placed', callback);
  }

  /**
   * Listen for opponent removing a creature
   */
  onOpponentRemoved(
    callback: (data: { playerId: 'player1' | 'player2'; creatureId: string }) => void
  ): void {
    this.socket?.on('deployment:opponent-removed', callback);
  }

  /**
   * Listen for opponent bulk update
   */
  onOpponentUpdated(
    callback: (data: { playerId: 'player1' | 'player2'; placements: CreaturePlacement[] }) => void
  ): void {
    this.socket?.on('deployment:opponent-updated', callback);
  }

  /**
   * Listen for deployment status changes
   */
  onStatusChanged(callback: (status: MatchDeploymentStatus) => void): void {
    this.socket?.on('deployment:status-changed', callback);
  }

  /**
   * Listen for errors
   */
  onError(callback: (data: { message: string; code?: string }) => void): void {
    this.socket?.on('deployment:error', callback);
  }

  /**
   * Listen for opponent connection
   */
  onOpponentConnected(callback: (data: { playerId: 'player1' | 'player2' }) => void): void {
    this.socket?.on('deployment:opponent-connected', callback);
  }

  /**
   * Listen for opponent disconnection
   */
  onOpponentDisconnected(callback: (data: { playerId: 'player1' | 'player2' }) => void): void {
    this.socket?.on('deployment:opponent-disconnected', callback);
  }

  /**
   * Remove all event listeners
   */
  removeAllListeners(): void {
    this.socket?.removeAllListeners();
  }

  /**
   * Check if connected
   */
  get isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Get current match ID
   */
  get currentMatchId(): string | null {
    return this.matchId;
  }

  /**
   * Get current player ID
   */
  get currentPlayerId(): 'player1' | 'player2' | null {
    return this.playerId;
  }
}

/**
 * Singleton instance for easy access
 */
export const deploymentSocket = new DeploymentSocketClient();
