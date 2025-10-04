/**
 * Deployment Socket.IO Handler
 *
 * Real-time multiplayer synchronization for deployment phase.
 * Handles creature placement, ready states, and countdown sync.
 */

import type { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import type {
  DeploymentClientEvents,
  DeploymentServerEvents,
  CreaturePlacement
} from '@drawn-of-war/shared';
import * as matchStateService from '../services/match-state.js';

/**
 * Socket.IO server instance
 */
let io: SocketIOServer<DeploymentClientEvents, DeploymentServerEvents> | null = null;

/**
 * Track connected players per match
 * matchId -> Set of playerIds
 */
const matchPlayers = new Map<string, Set<'player1' | 'player2'>>();

/**
 * Initialize deployment Socket.IO handler
 */
export function initializeDeploymentSocket(httpServer: HTTPServer): void {
  const frontendUrl = process.env['FRONTEND_URL'] || 'http://localhost:5173';

  io = new SocketIOServer<DeploymentClientEvents, DeploymentServerEvents>(httpServer, {
    cors: {
      origin: frontendUrl,
      credentials: true
    },
    path: '/socket.io'
  });

  io.on('connection', (socket: Socket) => {
    console.log('[Deployment Socket] Client connected:', socket.id);

    // Handle deployment:join
    socket.on('deployment:join', ({ matchId, playerId }) => {
      handleJoin(socket, matchId, playerId);
    });

    // Handle deployment:place
    socket.on('deployment:place', ({ matchId, playerId, placement }) => {
      handlePlace(socket, matchId, playerId, placement);
    });

    // Handle deployment:remove
    socket.on('deployment:remove', ({ matchId, playerId, creatureId }) => {
      handleRemove(socket, matchId, playerId, creatureId);
    });

    // Handle deployment:update-placements
    socket.on('deployment:update-placements', ({ matchId, playerId, placements }) => {
      handleUpdatePlacements(socket, matchId, playerId, placements);
    });

    // Handle deployment:ready
    socket.on('deployment:ready', ({ matchId, playerId }) => {
      handleReady(socket, matchId, playerId);
    });

    // Handle deployment:unready
    socket.on('deployment:unready', ({ matchId, playerId }) => {
      handleUnready(socket, matchId, playerId);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      handleDisconnect(socket);
    });
  });

  console.log('[Deployment Socket] Initialized');
}

/**
 * Handle player joining a match
 */
function handleJoin(
  socket: Socket,
  matchId: string,
  playerId: 'player1' | 'player2'
): void {
  console.log(`[Deployment Socket] ${playerId} joining match ${matchId}`);

  // Validate playerId
  if (playerId !== 'player1' && playerId !== 'player2') {
    socket.emit('deployment:error', {
      message: 'Invalid playerId. Must be "player1" or "player2"',
      code: 'INVALID_PLAYER_ID'
    });
    return;
  }

  // Check if match exists
  const matchState = matchStateService.getMatchState(matchId);
  if (!matchState) {
    socket.emit('deployment:error', {
      message: 'Match not found',
      code: 'MATCH_NOT_FOUND'
    });
    return;
  }

  // Join Socket.IO room
  const roomName = `match-${matchId}`;
  socket.join(roomName);

  // Store socket metadata
  (socket as any).matchId = matchId;
  (socket as any).playerId = playerId;

  // Track player connection
  if (!matchPlayers.has(matchId)) {
    matchPlayers.set(matchId, new Set());
  }
  matchPlayers.get(matchId)!.add(playerId);

  // Get current placements
  const player1Placements = matchStateService.getPlacements(matchId, 'player1') || [];
  const player2Placements = matchStateService.getPlacements(matchId, 'player2') || [];
  const deploymentStatus = matchStateService.getDeploymentStatus(matchId)!;

  // Send current state to joining player
  socket.emit('deployment:state', {
    matchId,
    player1Placements,
    player2Placements,
    deploymentStatus
  });

  // Notify opponent of connection
  const opponentId = playerId === 'player1' ? 'player2' : 'player1';
  socket.to(roomName).emit('deployment:opponent-connected', { playerId });

  console.log(`[Deployment Socket] ${playerId} joined match ${matchId}`);
}

/**
 * Handle placing a creature
 */
function handlePlace(
  socket: Socket,
  matchId: string,
  playerId: 'player1' | 'player2',
  placement: CreaturePlacement
): void {
  // Validate match and player
  if (!validateSocketRequest(socket, matchId, playerId)) {
    return;
  }

  // Check if deployment is locked
  const deploymentStatus = matchStateService.getDeploymentStatus(matchId);
  if (deploymentStatus?.isLocked) {
    socket.emit('deployment:error', {
      message: 'Cannot modify placements - deployment is locked',
      code: 'DEPLOYMENT_LOCKED'
    });
    return;
  }

  // Get current placements
  const currentPlacements = matchStateService.getPlacements(matchId, playerId) || [];

  // Check if creature already placed (repositioning)
  const existingIndex = currentPlacements.findIndex(
    p => p.creature.id === placement.creature.id
  );

  let updatedPlacements: CreaturePlacement[];
  if (existingIndex >= 0) {
    // Update existing placement
    updatedPlacements = [...currentPlacements];
    updatedPlacements[existingIndex] = placement;
  } else {
    // Add new placement
    updatedPlacements = [...currentPlacements, placement];
  }

  // Store updated placements
  const success = matchStateService.storePlacement(matchId, playerId, updatedPlacements);
  if (!success) {
    socket.emit('deployment:error', {
      message: 'Failed to store placement',
      code: 'STORE_FAILED'
    });
    return;
  }

  // Broadcast to opponent
  const roomName = `match-${matchId}`;
  socket.to(roomName).emit('deployment:opponent-placed', {
    playerId,
    placement
  });

  console.log(`[Deployment Socket] ${playerId} placed creature at (${placement.hex.q}, ${placement.hex.r})`);
}

/**
 * Handle removing a creature
 */
function handleRemove(
  socket: Socket,
  matchId: string,
  playerId: 'player1' | 'player2',
  creatureId: string
): void {
  // Validate match and player
  if (!validateSocketRequest(socket, matchId, playerId)) {
    return;
  }

  // Check if deployment is locked
  const deploymentStatus = matchStateService.getDeploymentStatus(matchId);
  if (deploymentStatus?.isLocked) {
    socket.emit('deployment:error', {
      message: 'Cannot modify placements - deployment is locked',
      code: 'DEPLOYMENT_LOCKED'
    });
    return;
  }

  // Get current placements
  const currentPlacements = matchStateService.getPlacements(matchId, playerId) || [];

  // Remove creature
  const updatedPlacements = currentPlacements.filter(
    p => p.creature.id !== creatureId
  );

  // Store updated placements
  const success = matchStateService.storePlacement(matchId, playerId, updatedPlacements);
  if (!success) {
    socket.emit('deployment:error', {
      message: 'Failed to remove creature',
      code: 'STORE_FAILED'
    });
    return;
  }

  // Broadcast to opponent
  const roomName = `match-${matchId}`;
  socket.to(roomName).emit('deployment:opponent-removed', {
    playerId,
    creatureId
  });

  console.log(`[Deployment Socket] ${playerId} removed creature ${creatureId}`);
}

/**
 * Handle bulk placements update
 */
function handleUpdatePlacements(
  socket: Socket,
  matchId: string,
  playerId: 'player1' | 'player2',
  placements: CreaturePlacement[]
): void {
  // Validate match and player
  if (!validateSocketRequest(socket, matchId, playerId)) {
    return;
  }

  // Check if deployment is locked
  const deploymentStatus = matchStateService.getDeploymentStatus(matchId);
  if (deploymentStatus?.isLocked) {
    socket.emit('deployment:error', {
      message: 'Cannot modify placements - deployment is locked',
      code: 'DEPLOYMENT_LOCKED'
    });
    return;
  }

  // Store placements
  const success = matchStateService.storePlacement(matchId, playerId, placements);
  if (!success) {
    socket.emit('deployment:error', {
      message: 'Failed to update placements',
      code: 'STORE_FAILED'
    });
    return;
  }

  // Broadcast to opponent
  const roomName = `match-${matchId}`;
  socket.to(roomName).emit('deployment:opponent-updated', {
    playerId,
    placements
  });

  console.log(`[Deployment Socket] ${playerId} updated placements (${placements.length} creatures)`);
}

/**
 * Handle player marking ready
 */
function handleReady(
  socket: Socket,
  matchId: string,
  playerId: 'player1' | 'player2'
): void {
  // Validate match and player
  if (!validateSocketRequest(socket, matchId, playerId)) {
    return;
  }

  // Mark player ready
  const deploymentStatus = matchStateService.markPlayerReady(matchId, playerId);
  if (!deploymentStatus) {
    socket.emit('deployment:error', {
      message: 'Failed to mark ready',
      code: 'READY_FAILED'
    });
    return;
  }

  // Broadcast updated status to all players in match
  const roomName = `match-${matchId}`;
  io?.to(roomName).emit('deployment:status-changed', deploymentStatus);

  console.log(`[Deployment Socket] ${playerId} marked ready in match ${matchId}`);
}

/**
 * Handle player unmarking ready
 */
function handleUnready(
  socket: Socket,
  matchId: string,
  playerId: 'player1' | 'player2'
): void {
  // Validate match and player
  if (!validateSocketRequest(socket, matchId, playerId)) {
    return;
  }

  // Unmark player ready
  const deploymentStatus = matchStateService.markPlayerUnready(matchId, playerId);
  if (!deploymentStatus) {
    socket.emit('deployment:error', {
      message: 'Failed to unmark ready',
      code: 'UNREADY_FAILED'
    });
    return;
  }

  // Broadcast updated status to all players in match
  const roomName = `match-${matchId}`;
  io?.to(roomName).emit('deployment:status-changed', deploymentStatus);

  console.log(`[Deployment Socket] ${playerId} unmarked ready in match ${matchId}`);
}

/**
 * Handle player disconnection
 */
function handleDisconnect(socket: Socket): void {
  const matchId = (socket as any).matchId as string | undefined;
  const playerId = (socket as any).playerId as 'player1' | 'player2' | undefined;

  if (matchId && playerId) {
    // Remove from tracked players
    const players = matchPlayers.get(matchId);
    if (players) {
      players.delete(playerId);
      if (players.size === 0) {
        matchPlayers.delete(matchId);
      }
    }

    // Notify opponent
    const roomName = `match-${matchId}`;
    socket.to(roomName).emit('deployment:opponent-disconnected', { playerId });

    console.log(`[Deployment Socket] ${playerId} disconnected from match ${matchId}`);
  }

  console.log('[Deployment Socket] Client disconnected:', socket.id);
}

/**
 * Validate socket request has correct match and player context
 */
function validateSocketRequest(
  socket: Socket,
  matchId: string,
  playerId: 'player1' | 'player2'
): boolean {
  // Check if socket joined a match
  const socketMatchId = (socket as any).matchId as string | undefined;
  const socketPlayerId = (socket as any).playerId as 'player1' | 'player2' | undefined;

  if (!socketMatchId || !socketPlayerId) {
    socket.emit('deployment:error', {
      message: 'Must join match first',
      code: 'NOT_JOINED'
    });
    return false;
  }

  // Validate match ID matches
  if (socketMatchId !== matchId) {
    socket.emit('deployment:error', {
      message: 'Match ID mismatch',
      code: 'MATCH_MISMATCH'
    });
    return false;
  }

  // Validate player ID matches
  if (socketPlayerId !== playerId) {
    socket.emit('deployment:error', {
      message: 'Player ID mismatch',
      code: 'PLAYER_MISMATCH'
    });
    return false;
  }

  return true;
}

/**
 * Get Socket.IO server instance (for testing/debugging)
 */
export function getDeploymentSocketIO(): SocketIOServer<DeploymentClientEvents, DeploymentServerEvents> | null {
  return io;
}
