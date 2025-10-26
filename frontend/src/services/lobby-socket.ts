/**
 * Lobby Socket Service
 *
 * Socket.IO client for lobby namespace with typed events.
 * Handles real-time updates for battle list in the lobby.
 */

import { io, Socket } from 'socket.io-client';

/**
 * Get the Socket.IO server URL from environment or default
 */
function getSocketUrl(): string {
  return import.meta.env.VITE_API_URL || 'http://localhost:3001';
}

/**
 * Get authentication token for Socket.IO connection
 * Note: Uses global function set by components (same as battle-api)
 */
async function getAuthToken(): Promise<string> {
  if (typeof window !== 'undefined' && (window as any).__getAuthToken) {
    return await (window as any).__getAuthToken();
  }
  throw new Error('Authentication token not available');
}

/**
 * Battle data structure from lobby events
 */
export interface LobbyBattle {
  battleId: string;
  battleKey: string;
  battleName: string;
  status: 'waiting' | 'starting' | 'active' | 'completed';
  isPublic: boolean;
  players: {
    host: {
      userId: string;
      displayName: string;
      joinedAt: string;
    };
    opponent?: {
      userId: string;
      displayName: string;
      joinedAt: string;
    };
  };
  createdAt: string;
}

/**
 * Lobby Socket Client
 *
 * Singleton Socket.IO client for real-time lobby updates.
 * Connects to /lobby namespace and handles battle list events.
 *
 * @example
 * ```typescript
 * const lobbySocket = new LobbySocket();
 * lobbySocket.connect();
 * lobbySocket.onBattles((battles) => {
 *   console.log('Received battles:', battles);
 * });
 * lobbySocket.subscribe();
 * ```
 */
export class LobbySocket {
  private socket: Socket | null = null;

  /**
   * Connect to the lobby namespace
   * Creates Socket.IO connection with auth token
   */
  connect(): void {
    // Don't create multiple connections
    if (this.socket?.connected) {
      return;
    }

    const url = `${getSocketUrl()}/lobby`;

    this.socket = io(url, {
      auth: async (callback) => {
        try {
          const token = await getAuthToken();
          callback({ token });
        } catch (error) {
          console.error('Failed to get auth token:', error);
          callback({});
        }
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    // Auto-subscribe on connect
    this.socket.on('connect', () => {
      this.subscribe();
    });
  }

  /**
   * Disconnect from the lobby
   * Unsubscribes and closes Socket.IO connection
   */
  disconnect(): void {
    if (this.socket) {
      this.unsubscribe();
      this.socket.disconnect();
      this.socket = null; // Clear reference to allow reconnection
    }
  }

  /**
   * Subscribe to lobby updates
   * Emits 'lobby:subscribe' event to start receiving battle list updates
   */
  subscribe(): void {
    if (this.socket) {
      this.socket.emit('lobby:subscribe');
    }
  }

  /**
   * Unsubscribe from lobby updates
   * Emits 'lobby:unsubscribe' event to stop receiving battle list updates
   */
  unsubscribe(): void {
    if (this.socket) {
      this.socket.emit('lobby:unsubscribe');
    }
  }

  /**
   * Listen for full battle list updates
   *
   * @param callback - Called when 'lobby:battles' event received
   *
   * @example
   * ```typescript
   * lobbySocket.onBattles((battles) => {
   *   setBattles(battles);
   * });
   * ```
   */
  onBattles(callback: (battles: LobbyBattle[]) => void): void {
    if (this.socket) {
      this.socket.on('lobby:battles', callback);
    }
  }

  /**
   * Listen for new battle created events
   *
   * @param callback - Called when 'lobby:battle-created' event received
   *
   * @example
   * ```typescript
   * lobbySocket.onBattleCreated((battle) => {
   *   setBattles(prev => [...prev, battle]);
   * });
   * ```
   */
  onBattleCreated(callback: (battle: LobbyBattle) => void): void {
    if (this.socket) {
      this.socket.on('lobby:battle-created', callback);
    }
  }

  /**
   * Listen for battle filled events (opponent joined)
   *
   * @param callback - Called when 'lobby:battle-filled' event received
   *
   * @example
   * ```typescript
   * lobbySocket.onBattleFilled((data) => {
   *   setBattles(prev => prev.filter(b => b.battleId !== data.battleId));
   * });
   * ```
   */
  onBattleFilled(callback: (data: { battleId: string }) => void): void {
    if (this.socket) {
      this.socket.on('lobby:battle-filled', callback);
    }
  }

  /**
   * Listen for battle cancelled events
   *
   * @param callback - Called when 'lobby:battle-cancelled' event received
   *
   * @example
   * ```typescript
   * lobbySocket.onBattleCancelled((data) => {
   *   setBattles(prev => prev.filter(b => b.battleId !== data.battleId));
   * });
   * ```
   */
  onBattleCancelled(callback: (data: { battleId: string }) => void): void {
    if (this.socket) {
      this.socket.on('lobby:battle-cancelled', callback);
    }
  }

  /**
   * Get current connection status
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}
