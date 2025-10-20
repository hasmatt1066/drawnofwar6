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
    console.log(`[Combat Socket] join() called with matchId: ${matchId}`);
    this.matchId = matchId;

    // If already joining, wait for that promise
    if (this.joinPromise) {
      console.log('[Combat Socket] Already joining, waiting for existing promise');
      return this.joinPromise;
    }

    // Create join promise
    this.joinPromise = new Promise<void>((resolve, reject) => {
      console.log('[Combat Socket] Creating new join promise');

      // Ensure we have a socket connection (creates if needed)
      this.ensureConnection();

      if (!this.socket) {
        console.error('[Combat Socket] Failed to create socket');
        reject(new Error('Failed to create socket'));
        return;
      }

      console.log(`[Combat Socket] Socket exists, connected: ${this.socket.connected}`);

      // Listen for successful join confirmation
      const onJoined = (data: { matchId: string; room: string }) => {
        this.socket?.off('combat:joined', onJoined);
        this.socket?.off('combat:error', onError);
        console.log(`[Combat Socket] ✓ Successfully joined match ${data.matchId} in room ${data.room}`);
        resolve();
      };

      const onError = (data: { message: string }) => {
        this.socket?.off('combat:joined', onJoined);
        this.socket?.off('combat:error', onError);
        console.error('[Combat Socket] ✗ Join failed:', data.message);
        reject(new Error(data.message));
      };

      // Set up listeners
      this.socket.once('combat:joined', onJoined);
      this.socket.once('combat:error', onError);

      // Set a timeout in case we never get a response
      const joinTimeout = setTimeout(() => {
        this.socket?.off('combat:joined', onJoined);
        this.socket?.off('combat:error', onError);
        console.error('[Combat Socket] ✗ Join timed out after 5 seconds');
        reject(new Error('Join timed out'));
      }, 5000);

      // Clear timeout on success
      const originalOnJoined = onJoined;
      const wrappedOnJoined = (data: { matchId: string; room: string }) => {
        clearTimeout(joinTimeout);
        originalOnJoined(data);
      };
      this.socket.off('combat:joined', onJoined);
      this.socket.once('combat:joined', wrappedOnJoined);

      // Join immediately if already connected
      if (this.socket.connected) {
        console.log(`[Combat Socket] Emitting combat:join for match ${matchId}`);
        this.socket.emit('combat:join', matchId);
      } else {
        // Wait for connect event
        console.log('[Combat Socket] Waiting for socket to connect...');
        this.socket.once('connect', () => {
          console.log(`[Combat Socket] Socket connected, emitting combat:join for match ${matchId}`);
          this.socket?.emit('combat:join', matchId);
        });
      }
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
