/**
 * Task 3.1: SSE Manager
 *
 * Manages Server-Sent Events (SSE) connections for real-time job progress broadcasting.
 * Supports multiple concurrent connections per user, keep-alive messages, and graceful
 * connection cleanup.
 */

import type { Response } from 'express';
import type { QueueServiceConfig } from '../queue/queue-manager.js';
import type { QueueLogger } from '../queue/logger.js';
import type { JobStatus } from '../queue/job-status-tracker.js';
import { randomUUID } from 'crypto';

/**
 * Progress update message sent to clients via SSE
 */
export interface ProgressUpdate {
  /** Unique job identifier */
  jobId: string;

  /** User who owns the job */
  userId: string;

  /** Current job status */
  status: JobStatus;

  /** Progress percentage (0-100) */
  progress: number;

  /** Human-readable status message */
  message: string;

  /** Estimated time remaining in milliseconds */
  estimatedTimeRemaining?: number;

  /** Timestamp of the update */
  timestamp: number;
}

/**
 * Internal connection tracking structure
 */
interface SSEConnection {
  /** Unique connection identifier */
  connectionId: string;

  /** Express response object for SSE stream */
  response: Response;

  /** User ID associated with this connection */
  userId: string;

  /** Keep-alive timer interval */
  keepAliveTimer: NodeJS.Timeout;

  /** Connection creation timestamp */
  createdAt: number;
}

/**
 * SSE Manager - manages Server-Sent Events connections for real-time updates
 *
 * Responsibilities:
 * - Register and track SSE connections per user
 * - Send progress updates to user's connections
 * - Send periodic keep-alive messages
 * - Handle connection cleanup on close
 * - Support multiple concurrent connections per user (multiple tabs)
 * - Format messages according to SSE specification
 */
export class SSEManager {
  private connections: Map<string, SSEConnection[]> = new Map();
  private config: QueueServiceConfig;
  private logger: QueueLogger;

  /**
   * Creates a new SSEManager instance
   *
   * @param config - Queue service configuration
   * @param logger - Logger instance for structured logging
   */
  constructor(config: QueueServiceConfig, logger: QueueLogger) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * Register a new SSE connection for a user
   *
   * Sets up SSE headers, registers connection, starts keep-alive messages,
   * and sets up cleanup handlers.
   *
   * @param userId - User identifier
   * @param response - Express Response object
   */
  registerConnection(userId: string, response: Response): void {
    const connectionId = randomUUID();

    // Set SSE headers
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    // Send initial connection message
    this.sendMessage(response, {
      type: 'connected',
      connectionId,
      timestamp: Date.now(),
    });

    // Set up keep-alive timer
    const keepAliveTimer = setInterval(() => {
      this.sendKeepAlive(response, connectionId);
    }, this.config.sse.keepAliveInterval);

    // Create connection object
    const connection: SSEConnection = {
      connectionId,
      response,
      userId,
      keepAliveTimer,
      createdAt: Date.now(),
    };

    // Register connection
    if (!this.connections.has(userId)) {
      this.connections.set(userId, []);
    }
    this.connections.get(userId)!.push(connection);

    // Set up close handler
    response.on('close', () => {
      this.handleConnectionClose(userId, connectionId);
    });

    this.logger.logInfo('sse_connection_registered', {
      userId,
      connectionId,
      connectionCount: this.connections.get(userId)!.length,
    });
  }

  /**
   * Broadcast progress update to all connections for a user
   *
   * Sends the progress update to all active connections for the specified user.
   * Handles write errors and automatically removes failed connections.
   *
   * @param userId - User identifier
   * @param update - Progress update to broadcast
   */
  broadcast(userId: string, update: ProgressUpdate): void {
    const userConnections = this.connections.get(userId);

    if (!userConnections || userConnections.length === 0) {
      // No connections for this user
      return;
    }

    // Send to all connections for this user
    const failedConnections: string[] = [];

    for (const connection of userConnections) {
      try {
        this.sendMessage(connection.response, update);
      } catch (error) {
        // Connection failed (client closed without notification)
        this.logger.logWarn('sse_write_error', {
          userId,
          connectionId: connection.connectionId,
          error: error instanceof Error ? error.message : String(error),
        });
        failedConnections.push(connection.connectionId);
      }
    }

    // Remove failed connections
    for (const connectionId of failedConnections) {
      this.closeConnection(userId, connectionId);
    }
  }

  /**
   * Close a specific connection
   *
   * Stops keep-alive messages, closes the response stream, and removes
   * the connection from tracking.
   *
   * @param userId - User identifier
   * @param connectionId - Connection identifier
   */
  closeConnection(userId: string, connectionId: string): void {
    const userConnections = this.connections.get(userId);

    if (!userConnections) {
      return;
    }

    const connectionIndex = userConnections.findIndex(
      conn => conn.connectionId === connectionId
    );

    if (connectionIndex === -1) {
      return;
    }

    const connection = userConnections[connectionIndex];

    // Stop keep-alive timer
    clearInterval(connection.keepAliveTimer);

    // Close response stream
    if (!connection.response.writableEnded) {
      connection.response.end();
    }

    // Remove from connections
    userConnections.splice(connectionIndex, 1);

    // Remove user entry if no more connections
    if (userConnections.length === 0) {
      this.connections.delete(userId);
    }

    this.logger.logInfo('sse_connection_closed', {
      userId,
      connectionId,
      remainingConnections: userConnections.length,
    });
  }

  /**
   * Close all active connections
   *
   * Used for graceful shutdown. Stops all keep-alive timers and
   * closes all response streams.
   */
  closeAllConnections(): void {
    let totalClosed = 0;

    this.connections.forEach((userConnections, userId) => {
      for (const connection of userConnections) {
        clearInterval(connection.keepAliveTimer);
        if (!connection.response.writableEnded) {
          connection.response.end();
        }
        totalClosed++;
      }
    });

    this.connections.clear();

    this.logger.logInfo('sse_all_connections_closed', {
      totalClosed,
    });
  }

  /**
   * Handle connection close event
   *
   * Internal handler for the 'close' event from the response stream.
   *
   * @param userId - User identifier
   * @param connectionId - Connection identifier
   */
  private handleConnectionClose(userId: string, connectionId: string): void {
    this.closeConnection(userId, connectionId);
  }

  /**
   * Send keep-alive message
   *
   * Sends a comment-style keep-alive message to prevent connection timeout.
   *
   * @param response - Express Response object
   * @param connectionId - Connection identifier for logging
   */
  private sendKeepAlive(response: Response, connectionId: string): void {
    try {
      // SSE comment format for keep-alive
      response.write(':keep-alive\n\n');
    } catch (error) {
      // Connection failed - will be cleaned up on next broadcast
      this.logger.logWarn('sse_write_error', {
        connectionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Send message in SSE format
   *
   * Formats and sends a message according to the SSE specification:
   * data: {...}\n\n
   *
   * @param response - Express Response object
   * @param data - Data to send
   */
  private sendMessage(response: Response, data: any): void {
    const json = JSON.stringify(data);
    const message = `data: ${json}\n\n`;
    response.write(message);
  }
}
