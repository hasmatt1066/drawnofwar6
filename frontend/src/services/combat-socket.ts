/**
 * Combat Socket.IO Client
 *
 * Client-side Socket.IO connection for real-time combat state synchronization.
 */

import { io, Socket } from 'socket.io-client';

// TODO: Import from @drawn-of-war/shared once combat types are exported
// For now using any types as combat types are not yet exported from shared package
type CombatState = any;
type CombatResult = any;
type CombatEvent = any;

/**
 * Combat socket client events (server -> client)
 */
interface CombatServerEvents {
  'combat:joined': (data: { matchId: string; room: string }) => void;
  'combat:left': (data: { matchId: string; room: string }) => void;
  'combat:state': (state: CombatState) => void;
  'combat:events': (events: CombatEvent[]) => void;
  'combat:event': (event: CombatEvent) => void;
  'combat:started': (data: { matchId: string }) => void;
  'combat:stopped': (data: { matchId: string }) => void;
  'combat:completed': (result: CombatResult) => void;
  'combat:error': (data: { message: string; code?: string }) => void;
}

/**
 * Combat socket client events (client -> server)
 */
interface CombatClientEvents {
  'combat:join': (matchId: string) => void;
  'combat:leave': (matchId: string) => void;
  'combat:getState': (matchId: string) => void;
}

/**
 * Combat socket client
 */
export class CombatSocketClient {
  private socket: Socket<CombatServerEvents, CombatClientEvents> | null = null;
  private matchId: string | null = null;
  private joinPromise: Promise<void> | null = null;

  /**
   * Ensure socket is connected (idempotent)
   */
  private ensureConnection(): void {
    if (this.socket) {
      return; // Already have a socket instance
    }

    console.log('[Combat Socket] Creating socket connection');

    // Connect to /combat namespace
    // Omit URL to use current origin - allows Vite proxy to handle WebSocket connections
    this.socket = io('/combat', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    this.socket.on('connect', () => {
      console.log('[Combat Socket] Connected');
      // Auto-join match on reconnect
      if (this.matchId) {
        this.join(this.matchId);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Combat Socket] Disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Combat Socket] Connection error:', error);
    });
  }

  /**
   * Join a combat match
   * Returns a promise that resolves when joined
   */
  async join(matchId: string): Promise<void> {
    this.matchId = matchId;

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

      // Listen for successful join confirmation
      const onJoined = () => {
        this.socket?.off('combat:joined', onJoined);
        this.socket?.off('combat:error', onError);
        console.log('[Combat Socket] Successfully joined match');
        resolve();
      };

      const onError = (data: { message: string }) => {
        this.socket?.off('combat:joined', onJoined);
        this.socket?.off('combat:error', onError);
        console.error('[Combat Socket] Join failed:', data.message);
        reject(new Error(data.message));
      };

      // Set up listeners
      this.socket.once('combat:joined', onJoined);
      this.socket.once('combat:error', onError);

      // Join immediately if already connected
      if (this.socket.connected) {
        this.socket.emit('combat:join', matchId);
        console.log(`[Combat Socket] Joining match ${matchId}`);
      }
      // Otherwise wait for connect event (which will auto-join via lines 70-73)
    });

    return this.joinPromise;
  }

  /**
   * Leave the current combat match
   */
  leave(): void {
    if (this.socket && this.matchId) {
      this.socket.emit('combat:leave', this.matchId);
      console.log(`[Combat Socket] Leaving match ${this.matchId}`);
      this.matchId = null;
      this.joinPromise = null;
    }
  }

  /**
   * Disconnect from combat socket
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.matchId = null;
      this.joinPromise = null;
      console.log('[Combat Socket] Disconnected');
    }
  }

  /**
   * Request current combat state
   */
  getState(): void {
    if (!this.socket || !this.matchId) {
      console.error('[Combat Socket] Not connected or not joined');
      return;
    }

    this.socket.emit('combat:getState', this.matchId);
  }

  /**
   * Listen for combat state updates
   */
  onState(callback: (state: CombatState) => void): void {
    this.socket?.on('combat:state', callback);
  }

  /**
   * Listen for combat events (batch)
   */
  onEvents(callback: (events: CombatEvent[]) => void): void {
    this.socket?.on('combat:events', callback);
  }

  /**
   * Listen for individual combat event
   */
  onEvent(callback: (event: CombatEvent) => void): void {
    this.socket?.on('combat:event', callback);
  }

  /**
   * Listen for combat started
   */
  onStarted(callback: (data: { matchId: string }) => void): void {
    this.socket?.on('combat:started', callback);
  }

  /**
   * Listen for combat stopped
   */
  onStopped(callback: (data: { matchId: string }) => void): void {
    this.socket?.on('combat:stopped', callback);
  }

  /**
   * Listen for combat completion
   */
  onCompleted(callback: (result: CombatResult) => void): void {
    this.socket?.on('combat:completed', callback);
  }

  /**
   * Listen for errors
   */
  onError(callback: (data: { message: string; code?: string }) => void): void {
    this.socket?.on('combat:error', callback);
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
}

/**
 * Singleton instance for easy access
 */
export const combatSocket = new CombatSocketClient();
