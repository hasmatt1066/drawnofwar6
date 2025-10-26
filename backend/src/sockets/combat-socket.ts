/**
 * Combat Socket.IO Events
 *
 * Real-time combat state updates via WebSocket.
 * Broadcasts state updates at configurable rate (default 10 updates/sec).
 */

import type { Namespace, Socket } from 'socket.io';
import type { CombatState, CombatResult, CombatEvent } from '@drawn-of-war/shared';
import type { DeploymentState } from '@drawn-of-war/shared';
import { combatStateManager } from '../services/combat/combat-state-manager.js';

/**
 * Combat room name for a match
 */
function getCombatRoom(matchId: string): string {
  return `combat:${matchId}`;
}

/**
 * Combat Socket Handler
 */
export class CombatSocketHandler {
  private namespace: Namespace;
  private updateIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(namespace: Namespace) {
    this.namespace = namespace;
    this.setupEventHandlers();
  }

  /**
   * Setup Socket.IO event handlers
   */
  private setupEventHandlers(): void {
    this.namespace.on('connection', (socket: Socket) => {
      console.log(`[Combat Socket] Client connected: ${socket.id}`);

      // Join combat room
      socket.on('combat:join', (matchId: string) => {
        this.handleJoinCombat(socket, matchId);
      });

      // Leave combat room
      socket.on('combat:leave', (matchId: string) => {
        this.handleLeaveCombat(socket, matchId);
      });

      // Start combat
      socket.on('combat:start', (data: { matchId: string; deployment: DeploymentState }) => {
        this.handleStartCombat(socket, data.matchId, data.deployment);
      });

      // Stop combat
      socket.on('combat:stop', (matchId: string) => {
        this.handleStopCombat(socket, matchId);
      });

      // Get current state
      socket.on('combat:getState', (matchId: string) => {
        this.handleGetState(socket, matchId);
      });

      // Disconnect
      socket.on('disconnect', () => {
        console.log(`[Combat Socket] Client disconnected: ${socket.id}`);
      });
    });
  }

  /**
   * Handle client joining combat room
   */
  private handleJoinCombat(socket: Socket, matchId: string): void {
    console.log(`[Combat Socket] Client ${socket.id} requesting to join match ${matchId}`);

    const room = getCombatRoom(matchId);
    socket.join(room);

    console.log(`[Combat Socket] ✓ Client ${socket.id} joined room ${room}`);

    // Send current state if combat is active
    const state = combatStateManager.getState(matchId);
    if (state) {
      console.log(`[Combat Socket] Sending current combat state (tick ${state.tick}) to ${socket.id}`);
      socket.emit('combat:state', state);
    } else {
      console.log(`[Combat Socket] No active combat state for match ${matchId}`);
    }

    console.log(`[Combat Socket] Emitting combat:joined to ${socket.id}`);
    socket.emit('combat:joined', { matchId, room });
  }

  /**
   * Handle client leaving combat room
   */
  private handleLeaveCombat(socket: Socket, matchId: string): void {
    const room = getCombatRoom(matchId);
    socket.leave(room);

    console.log(`[Combat Socket] Client ${socket.id} left room ${room}`);

    socket.emit('combat:left', { matchId, room });
  }

  /**
   * Handle start combat request
   */
  private async handleStartCombat(
    socket: Socket,
    matchId: string,
    deployment: DeploymentState
  ): Promise<void> {
    try {
      // Validate deployment
      if (!deployment || !deployment.player1 || !deployment.player2) {
        socket.emit('combat:error', {
          message: 'Invalid deployment state'
        });
        return;
      }

      // Check if already active
      if (combatStateManager.isActive(matchId)) {
        socket.emit('combat:error', {
          message: 'Combat already active for this match'
        });
        return;
      }

      // Start combat with callbacks
      await combatStateManager.startCombat(
        matchId,
        deployment,
        (state: CombatState) => this.onStateUpdate(matchId, state),
        (result: CombatResult) => this.onCombatComplete(matchId, result)
      );

      // Start broadcasting state updates
      this.startBroadcasting(matchId);

      // Notify clients
      this.namespace.to(getCombatRoom(matchId)).emit('combat:started', { matchId });
    } catch (error: any) {
      console.error('[Combat Socket] Error starting combat:', error);
      socket.emit('combat:error', {
        message: error.message
      });
    }
  }

  /**
   * Handle stop combat request
   */
  private handleStopCombat(socket: Socket, matchId: string): void {
    try {
      combatStateManager.stopCombat(matchId);
      this.stopBroadcasting(matchId);

      this.namespace.to(getCombatRoom(matchId)).emit('combat:stopped', { matchId });
    } catch (error: any) {
      console.error('[Combat Socket] Error stopping combat:', error);
      socket.emit('combat:error', {
        message: error.message
      });
    }
  }

  /**
   * Handle get state request
   */
  private handleGetState(socket: Socket, matchId: string): void {
    const state = combatStateManager.getState(matchId);

    if (state) {
      socket.emit('combat:state', state);
    } else {
      const result = combatStateManager.getResult(matchId);
      if (result) {
        socket.emit('combat:completed', result);
      } else {
        socket.emit('combat:error', {
          message: 'Combat not found'
        });
      }
    }
  }

  /**
   * State update callback (called by combat engine)
   */
  private onStateUpdate(_matchId: string, _state: CombatState): void {
    // State updates are handled by the broadcasting interval
    // This callback is just for logging/debugging
  }

  /**
   * Combat completion callback
   */
  private onCombatComplete(matchId: string, result: CombatResult): void {
    // Stop broadcasting
    this.stopBroadcasting(matchId);

    // Broadcast final result
    this.namespace.to(getCombatRoom(matchId)).emit('combat:completed', result);

    console.log(`[Combat Socket] Combat completed for match ${matchId}, winner: ${result.winner}`);
  }

  /**
   * Start broadcasting state updates at fixed rate
   */
  public startBroadcasting(matchId: string): void {
    // Broadcast at 10 updates per second (100ms interval)
    const BROADCAST_INTERVAL = 100;

    let tickCounter = 0;

    const interval = setInterval(() => {
      const state = combatStateManager.getState(matchId);

      if (!state) {
        // Combat ended, stop broadcasting
        console.log(`[Combat Socket] No state found, stopping broadcast for match ${matchId}`);
        this.stopBroadcasting(matchId);
        return;
      }

      // Log every 10 broadcasts (once per second) to avoid spam
      tickCounter++;
      if (tickCounter % 10 === 0) {
        const room = getCombatRoom(matchId);
        const clientsInRoom = this.namespace.adapter.rooms.get(room)?.size || 0;
        console.log(`[Combat Socket] Broadcasting state tick ${state.tick} to ${clientsInRoom} clients in room ${room}`);
      }

      // Broadcast state to all clients in room
      this.namespace.to(getCombatRoom(matchId)).emit('combat:state', state);

      // Broadcast recent events separately for immediate feedback
      const recentEvents = state.events.slice(-5); // Last 5 events
      if (recentEvents.length > 0) {
        this.namespace.to(getCombatRoom(matchId)).emit('combat:events', recentEvents);
      }
    }, BROADCAST_INTERVAL);

    this.updateIntervals.set(matchId, interval);

    const room = getCombatRoom(matchId);
    const clientsInRoom = this.namespace.adapter.rooms.get(room)?.size || 0;
    console.log(`[Combat Socket] ✓ Started broadcasting for match ${matchId}, ${clientsInRoom} clients in room ${room}`);
  }

  /**
   * Stop broadcasting state updates
   */
  public stopBroadcasting(matchId: string): void {
    const interval = this.updateIntervals.get(matchId);
    if (interval) {
      clearInterval(interval);
      this.updateIntervals.delete(matchId);
      console.log(`[Combat Socket] Stopped broadcasting for match ${matchId}`);
    }
  }

  /**
   * Broadcast a single event immediately
   */
  public broadcastEvent(matchId: string, event: CombatEvent): void {
    this.namespace.to(getCombatRoom(matchId)).emit('combat:event', event);
  }

  /**
   * Get namespace instance
   */
  public getNamespace(): Namespace {
    return this.namespace;
  }

  /**
   * Cleanup on shutdown
   */
  public cleanup(): void {
    // Stop all broadcasting
    for (const [_matchId, interval] of this.updateIntervals.entries()) {
      clearInterval(interval);
    }
    this.updateIntervals.clear();

    console.log('[Combat Socket] Cleanup complete');
  }
}

// Singleton instance (will be initialized in server startup)
let combatSocketHandler: CombatSocketHandler | null = null;

/**
 * Initialize combat socket handler
 */
export function initializeCombatSocket(namespace: Namespace): CombatSocketHandler {
  if (combatSocketHandler) {
    throw new Error('Combat socket handler already initialized');
  }

  combatSocketHandler = new CombatSocketHandler(namespace);
  return combatSocketHandler;
}

/**
 * Get combat socket handler instance
 */
export function getCombatSocket(): CombatSocketHandler {
  if (!combatSocketHandler) {
    throw new Error('Combat socket handler not initialized');
  }

  return combatSocketHandler;
}
