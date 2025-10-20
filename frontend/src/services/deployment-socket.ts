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

/**
 * Deployment socket client
 */
export class DeploymentSocketClient {
  private socket: Socket<DeploymentServerEvents, DeploymentClientEvents> | null = null;
  private matchId: string | null = null;
  private playerId: 'player1' | 'player2' | null = null;
  private joinPromise: Promise<void> | null = null;

  /**
   * Ensure socket is connected (idempotent)
   */
  private ensureConnection(): void {
    if (this.socket) {
      return; // Already have a socket instance
    }

    console.log('[Deployment Socket] Creating socket connection');

    // Connect to /deployment namespace
    // Omit URL to use current origin - allows Vite proxy to handle WebSocket connections
    this.socket = io('/deployment', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    this.socket.on('connect', () => {
      console.log('[Deployment Socket] Connected');
      // Auto-join match on reconnect
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
   * Connect to deployment socket and join match
   * Returns a promise that resolves when joined
   */
  async connect(matchId: string, playerId: 'player1' | 'player2'): Promise<void> {
    this.matchId = matchId;
    this.playerId = playerId;

    // If already joining, wait for that promise
    if (this.joinPromise) {
      return this.joinPromise;
    }

    // Create join promise
    this.joinPromise = new Promise<void>((resolve, reject) => {
      // Ensure we have a socket connection (creates if needed)
      this.ensureConnection();

      if (!this.socket) {
        reject(new Error('Failed to create socket'));
        return;
      }

      // Listen for successful join (state received means join succeeded)
      const onState = () => {
        this.socket?.off('deployment:state', onState);
        this.socket?.off('deployment:error', onError);
        console.log('[Deployment Socket] Successfully joined match');
        resolve();
      };

      const onError = (data: { message: string }) => {
        this.socket?.off('deployment:state', onState);
        this.socket?.off('deployment:error', onError);
        console.error('[Deployment Socket] Join failed:', data.message);
        reject(new Error(data.message));
      };

      // Set up listeners
      this.socket.once('deployment:state', onState);
      this.socket.once('deployment:error', onError);

      // Join immediately if already connected
      if (this.socket.connected) {
        this.joinMatch(matchId, playerId);
      }
      // Otherwise wait for connect event (which will auto-join via lines 44-49)
    });

    return this.joinPromise;
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
      this.joinPromise = null;
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
   * Listen for combat started
   */
  onCombatStarted(callback: (data: { matchId: string }) => void): void {
    this.socket?.on('deployment:combat-started', callback);
  }

  /**
   * Listen for combat completed
   */
  onCombatCompleted(callback: (data: {
    matchId: string;
    winner: 'player1' | 'player2' | 'draw';
    reason: string;
    duration: number;
  }) => void): void {
    this.socket?.on('deployment:combat-completed', callback);
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
