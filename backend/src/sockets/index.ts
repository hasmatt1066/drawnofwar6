/**
 * Unified Socket.IO Server Initialization
 *
 * Creates a single Socket.IO server with multiple namespaces
 * to avoid "handleUpgrade() called more than once" error.
 *
 * Namespaces:
 * - /combat: Real-time combat state updates
 * - /deployment: Multiplayer deployment synchronization
 */

import type { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import type { Namespace } from 'socket.io';

/**
 * Single Socket.IO server instance
 */
let io: SocketIOServer | null = null;

/**
 * Combat namespace
 */
let combatNamespace: Namespace | null = null;

/**
 * Deployment namespace
 */
let deploymentNamespace: Namespace | null = null;

/**
 * Initialize unified Socket.IO server with namespaces
 */
export function initializeSocketIO(httpServer: HTTPServer): void {
  if (io) {
    console.warn('[Socket.IO] Already initialized, skipping...');
    return;
  }

  // Create single Socket.IO server
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175',
        'http://localhost:5176',
        process.env['FRONTEND_URL']
      ].filter(Boolean) as string[],
      credentials: true
    },
    path: '/socket.io'
  });

  // Create namespaces
  combatNamespace = io.of('/combat');
  deploymentNamespace = io.of('/deployment');

  console.log('[Socket.IO] Initialized with namespaces: /combat, /deployment');
}

/**
 * Get combat namespace
 */
export function getCombatNamespace(): Namespace {
  if (!combatNamespace) {
    throw new Error('Socket.IO not initialized. Call initializeSocketIO() first.');
  }
  return combatNamespace;
}

/**
 * Get deployment namespace
 */
export function getDeploymentNamespace(): Namespace {
  if (!deploymentNamespace) {
    throw new Error('Socket.IO not initialized. Call initializeSocketIO() first.');
  }
  return deploymentNamespace;
}

/**
 * Get Socket.IO server instance
 */
export function getSocketIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initializeSocketIO() first.');
  }
  return io;
}

/**
 * Cleanup on shutdown
 */
export function cleanupSocketIO(): void {
  if (io) {
    io.close();
    io = null;
    combatNamespace = null;
    deploymentNamespace = null;
    console.log('[Socket.IO] Cleaned up and closed');
  }
}
