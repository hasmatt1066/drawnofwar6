/**
 * TASK-COMBAT-VIZ-001: CombatSocketClient Implementation
 *
 * Manages Socket.IO connection for real-time combat events.
 * Handles connection lifecycle, room management, and event routing.
 */

import { io, Socket } from 'socket.io-client';
import type { CombatState, CombatResult, CombatEvent } from '@drawn-of-war/shared/types/combat';

/**
 * Connection status enum
 */
export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

/**
 * Client options
 */
export interface CombatSocketClientOptions {
  autoConnect?: boolean;
  reconnect?: boolean;
}

/**
 * CombatSocketClient
 *
 * Manages Socket.IO connection to /combat namespace for real-time combat updates.
 */
export class CombatSocketClient {
  private socket: Socket | null = null;
  private serverUrl: string;
  private matchId: string;
  private options: Required<CombatSocketClientOptions>;
  private status: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private manualDisconnect: boolean = false;

  // Event callbacks
  private statusChangeCallbacks: ((status: ConnectionStatus) => void)[] = [];
  private combatStateCallbacks: ((state: CombatState) => void)[] = [];
  private combatEventsCallbacks: ((events: CombatEvent[]) => void)[] = [];
  private combatCompletedCallbacks: ((result: CombatResult) => void)[] = [];
  private errorCallbacks: ((error: Error) => void)[] = [];

  constructor(serverUrl: string, matchId: string, options: CombatSocketClientOptions = {}) {
    // Validate matchId
    if (!matchId || matchId.trim() === '') {
      throw new Error('Match ID is required');
    }

    this.serverUrl = serverUrl;
    this.matchId = matchId;
    this.options = {
      autoConnect: options.autoConnect ?? false,
      reconnect: options.reconnect ?? true
    };

    // Create socket (but don't connect yet)
    this.socket = io(`${this.serverUrl}/combat`, {
      autoConnect: false,
      reconnection: this.options.reconnect,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity
    });

    // Setup event handlers
    this.setupSocketHandlers();

    // Auto-connect if enabled
    if (this.options.autoConnect) {
      this.connect();
    }
  }

  /**
   * Connect to combat socket
   */
  public connect(): void {
    if (!this.socket || this.socket.connected) {
      return; // Already connected or no socket
    }

    // Update status
    this.updateStatus(ConnectionStatus.CONNECTING);
    this.manualDisconnect = false;

    // Connect
    this.socket.connect();
  }

  /**
   * Disconnect from combat socket
   */
  public disconnect(): void {
    if (!this.socket) {
      return;
    }

    // Mark as manual disconnect to prevent auto-reconnect
    this.manualDisconnect = true;

    // Leave match room before disconnecting
    if (this.socket.connected) {
      this.socket.emit('combat:leave', this.matchId);
    }

    // Cleanup listeners
    this.cleanupSocketHandlers();

    // Disconnect
    this.socket.disconnect();
    this.socket = null;

    // Update status
    this.updateStatus(ConnectionStatus.DISCONNECTED);
  }

  /**
   * Get current connection status
   */
  public getConnectionStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * Register status change callback
   */
  public onStatusChange(callback: (status: ConnectionStatus) => void): void {
    this.statusChangeCallbacks.push(callback);
  }

  /**
   * Register combat state callback
   */
  public onCombatState(callback: (state: CombatState) => void): void {
    this.combatStateCallbacks.push(callback);
  }

  /**
   * Register combat events callback
   */
  public onCombatEvents(callback: (events: CombatEvent[]) => void): void {
    this.combatEventsCallbacks.push(callback);
  }

  /**
   * Register combat completed callback
   */
  public onCombatCompleted(callback: (result: CombatResult) => void): void {
    this.combatCompletedCallbacks.push(callback);
  }

  /**
   * Register error callback
   */
  public onError(callback: (error: Error) => void): void {
    this.errorCallbacks.push(callback);
  }

  /**
   * Setup Socket.IO event handlers
   */
  private setupSocketHandlers(): void {
    if (!this.socket) {
      return;
    }

    // Connection events
    this.socket.on('connect', () => {
      this.updateStatus(ConnectionStatus.CONNECTED);

      // Join match room
      this.socket!.emit('combat:join', this.matchId);
    });

    this.socket.on('connect_error', (error: Error) => {
      this.updateStatus(ConnectionStatus.ERROR);
      this.notifyError(error);
    });

    this.socket.on('disconnect', (reason: string) => {
      // Check if this was a manual disconnect or unexpected
      if (this.manualDisconnect || !this.options.reconnect || !reason) {
        // Manual disconnect, reconnect disabled, or no reason provided
        this.updateStatus(ConnectionStatus.DISCONNECTED);
      } else {
        // Unexpected disconnect with reconnect enabled
        this.updateStatus(ConnectionStatus.RECONNECTING);
      }
    });

    this.socket.on('error', (error: Error) => {
      this.notifyError(error);
    });

    // Combat events
    this.socket.on('combat:state', (state: CombatState) => {
      this.combatStateCallbacks.forEach(callback => callback(state));
    });

    this.socket.on('combat:events', (events: CombatEvent[]) => {
      this.combatEventsCallbacks.forEach(callback => callback(events));
    });

    this.socket.on('combat:completed', (result: CombatResult) => {
      this.combatCompletedCallbacks.forEach(callback => callback(result));
    });
  }

  /**
   * Cleanup Socket.IO event handlers
   */
  private cleanupSocketHandlers(): void {
    if (!this.socket) {
      return;
    }

    // Remove all listeners
    this.socket.off('connect');
    this.socket.off('connect_error');
    this.socket.off('disconnect');
    this.socket.off('error');
    this.socket.off('combat:state');
    this.socket.off('combat:events');
    this.socket.off('combat:completed');
  }

  /**
   * Update connection status and notify listeners
   */
  private updateStatus(status: ConnectionStatus): void {
    this.status = status;
    this.statusChangeCallbacks.forEach(callback => callback(status));
  }

  /**
   * Notify error callbacks
   */
  private notifyError(error: Error): void {
    this.errorCallbacks.forEach(callback => callback(error));
  }
}
