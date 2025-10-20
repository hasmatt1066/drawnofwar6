/**
 * Task 3.1 Tests: SSE Manager
 *
 * Comprehensive test suite for SSE (Server-Sent Events) Manager
 * Testing connection management, broadcasting, keep-alive, and edge cases
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SSEManager } from '../sse-manager.js';
import type { ProgressUpdate } from '../sse-manager.js';
import type { QueueServiceConfig } from '../../queue/queue-manager.js';
import type { QueueLogger } from '../../queue/logger.js';

/**
 * Mock Response object for SSE testing
 */
class MockResponse {
  public writableEnded = false;
  public headersSent = false;
  private headers: Record<string, string> = {};
  private chunks: string[] = [];
  private eventListeners: Record<string, Function[]> = {};
  public writeError: Error | null = null;

  writeHead(statusCode: number, headers: Record<string, string>): void {
    this.headersSent = true;
    this.headers = headers;
  }

  write(chunk: string): boolean {
    if (this.writeError) {
      throw this.writeError;
    }
    this.chunks.push(chunk);
    return true;
  }

  end(): void {
    this.writableEnded = true;
  }

  on(event: string, listener: Function): void {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(listener);
  }

  emit(event: string, ...args: any[]): void {
    const listeners = this.eventListeners[event] || [];
    listeners.forEach(listener => listener(...args));
  }

  getChunks(): string[] {
    return this.chunks;
  }

  getHeaders(): Record<string, string> {
    return this.headers;
  }

  reset(): void {
    this.writableEnded = false;
    this.headersSent = false;
    this.headers = {};
    this.chunks = [];
    this.eventListeners = {};
    this.writeError = null;
  }
}

describe('SSEManager', () => {
  let sseManager: SSEManager;
  let mockConfig: QueueServiceConfig;
  let mockLogger: QueueLogger;

  beforeEach(() => {
    mockConfig = {
      redis: {
        host: 'localhost',
        port: 6379,
      },
      firestore: {
        projectId: 'test-project',
      },
      queue: {
        name: 'test-queue',
        concurrency: 5,
        maxJobsPerUser: 5,
        systemQueueLimit: 500,
        warningThreshold: 400,
      },
      cache: {
        ttlDays: 30,
        strategy: 'moderate' as const,
      },
      retry: {
        maxRetries: 1,
        backoffDelay: 5000,
        backoffMultiplier: 2.0,
      },
      sse: {
        updateInterval: 2500,
        keepAliveInterval: 30000,
      },
      deduplication: {
        windowSeconds: 10,
      },
    };

    mockLogger = {
      logInfo: vi.fn(),
      logWarn: vi.fn(),
      logError: vi.fn(),
    } as any;

    sseManager = new SSEManager(mockConfig, mockLogger);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('registerConnection', () => {
    it('should set correct SSE headers', () => {
      const mockResponse = new MockResponse();

      sseManager.registerConnection('user123', mockResponse as any);

      const headers = mockResponse.getHeaders();
      expect(headers['Content-Type']).toBe('text/event-stream');
      expect(headers['Cache-Control']).toBe('no-cache');
      expect(headers['Connection']).toBe('keep-alive');
    });

    it('should register connection for new user', () => {
      const mockResponse = new MockResponse();

      sseManager.registerConnection('user123', mockResponse as any);

      expect(mockLogger.logInfo).toHaveBeenCalledWith(
        'sse_connection_registered',
        expect.objectContaining({
          userId: 'user123',
        })
      );
    });

    it('should support multiple connections per user (multiple tabs)', () => {
      const mockResponse1 = new MockResponse();
      const mockResponse2 = new MockResponse();

      sseManager.registerConnection('user123', mockResponse1 as any);
      sseManager.registerConnection('user123', mockResponse2 as any);

      // Both connections should be registered
      expect(mockLogger.logInfo).toHaveBeenCalledTimes(2);
    });

    it('should send initial connection message', () => {
      const mockResponse = new MockResponse();

      sseManager.registerConnection('user123', mockResponse as any);

      const chunks = mockResponse.getChunks();
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]).toContain('data:');
      expect(chunks[0]).toContain('connected');
    });

    it('should set up close event listener', () => {
      const mockResponse = new MockResponse();

      sseManager.registerConnection('user123', mockResponse as any);

      // Emit close event
      mockResponse.emit('close');

      expect(mockLogger.logInfo).toHaveBeenCalledWith(
        'sse_connection_closed',
        expect.objectContaining({
          userId: 'user123',
        })
      );
    });

    it('should start keep-alive messages', async () => {
      vi.useFakeTimers();
      const mockResponse = new MockResponse();

      sseManager.registerConnection('user123', mockResponse as any);

      // Advance time by keep-alive interval
      vi.advanceTimersByTime(mockConfig.sse.keepAliveInterval);

      const chunks = mockResponse.getChunks();
      const keepAliveMessages = chunks.filter(chunk => chunk.includes(':keep-alive'));
      expect(keepAliveMessages.length).toBeGreaterThan(0);
    });

    it('should send keep-alive messages every 30 seconds', async () => {
      vi.useFakeTimers();
      const mockResponse = new MockResponse();

      sseManager.registerConnection('user123', mockResponse as any);

      // Advance time by 90 seconds (should trigger 3 keep-alive messages)
      vi.advanceTimersByTime(mockConfig.sse.keepAliveInterval * 3);

      const chunks = mockResponse.getChunks();
      const keepAliveMessages = chunks.filter(chunk => chunk.includes(':keep-alive'));
      expect(keepAliveMessages.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('broadcast', () => {
    it('should send progress update to user\'s connections', () => {
      const mockResponse = new MockResponse();
      sseManager.registerConnection('user123', mockResponse as any);

      const update: ProgressUpdate = {
        jobId: 'job123',
        userId: 'user123',
        status: 'processing' as any,
        progress: 50,
        message: 'Processing sprite generation',
        timestamp: Date.now(),
      };

      sseManager.broadcast('user123', update);

      const chunks = mockResponse.getChunks();
      const updateMessage = chunks.find(chunk => chunk.includes('job123'));
      expect(updateMessage).toBeDefined();
      expect(updateMessage).toContain('data:');
      expect(updateMessage).toContain('"jobId":"job123"');
    });

    it('should format messages according to SSE spec (data: {...}\\n\\n)', () => {
      const mockResponse = new MockResponse();
      sseManager.registerConnection('user123', mockResponse as any);

      const update: ProgressUpdate = {
        jobId: 'job123',
        userId: 'user123',
        status: 'processing' as any,
        progress: 50,
        message: 'Processing',
        timestamp: Date.now(),
      };

      sseManager.broadcast('user123', update);

      const chunks = mockResponse.getChunks();
      const updateMessage = chunks.find(chunk => chunk.includes('job123'));
      expect(updateMessage).toMatch(/^data: \{.*\}\n\n$/);
    });

    it('should broadcast to all connections for a user', () => {
      const mockResponse1 = new MockResponse();
      const mockResponse2 = new MockResponse();
      sseManager.registerConnection('user123', mockResponse1 as any);
      sseManager.registerConnection('user123', mockResponse2 as any);

      const update: ProgressUpdate = {
        jobId: 'job123',
        userId: 'user123',
        status: 'processing' as any,
        progress: 50,
        message: 'Processing',
        timestamp: Date.now(),
      };

      sseManager.broadcast('user123', update);

      const chunks1 = mockResponse1.getChunks();
      const chunks2 = mockResponse2.getChunks();

      const updateMessage1 = chunks1.find(chunk => chunk.includes('job123'));
      const updateMessage2 = chunks2.find(chunk => chunk.includes('job123'));

      expect(updateMessage1).toBeDefined();
      expect(updateMessage2).toBeDefined();
    });

    it('should not broadcast to other users', () => {
      const mockResponse1 = new MockResponse();
      const mockResponse2 = new MockResponse();
      sseManager.registerConnection('user123', mockResponse1 as any);
      sseManager.registerConnection('user456', mockResponse2 as any);

      const update: ProgressUpdate = {
        jobId: 'job123',
        userId: 'user123',
        status: 'processing' as any,
        progress: 50,
        message: 'Processing',
        timestamp: Date.now(),
      };

      sseManager.broadcast('user123', update);

      const chunks1 = mockResponse1.getChunks();
      const chunks2 = mockResponse2.getChunks();

      const updateMessage1 = chunks1.find(chunk => chunk.includes('job123'));
      const updateMessage2 = chunks2.find(chunk => chunk.includes('job123'));

      expect(updateMessage1).toBeDefined();
      expect(updateMessage2).toBeUndefined();
    });

    it('should include estimatedTimeRemaining if provided', () => {
      const mockResponse = new MockResponse();
      sseManager.registerConnection('user123', mockResponse as any);

      const update: ProgressUpdate = {
        jobId: 'job123',
        userId: 'user123',
        status: 'processing' as any,
        progress: 50,
        message: 'Processing',
        estimatedTimeRemaining: 15000,
        timestamp: Date.now(),
      };

      sseManager.broadcast('user123', update);

      const chunks = mockResponse.getChunks();
      const updateMessage = chunks.find(chunk => chunk.includes('job123'));
      expect(updateMessage).toContain('estimatedTimeRemaining');
      expect(updateMessage).toContain('15000');
    });

    it('should handle broadcast to user with no connections gracefully', () => {
      const update: ProgressUpdate = {
        jobId: 'job123',
        userId: 'user999',
        status: 'processing' as any,
        progress: 50,
        message: 'Processing',
        timestamp: Date.now(),
      };

      // Should not throw
      expect(() => sseManager.broadcast('user999', update)).not.toThrow();
    });
  });

  describe('closeConnection', () => {
    it('should close specific connection by connectionId', () => {
      const mockResponse = new MockResponse();
      sseManager.registerConnection('user123', mockResponse as any);

      // Get the connection ID from the log call
      const logCall = (mockLogger.logInfo as any).mock.calls.find(
        (call: any) => call[0] === 'sse_connection_registered'
      );
      const connectionId = logCall[1].connectionId;

      sseManager.closeConnection('user123', connectionId);

      expect(mockResponse.writableEnded).toBe(true);
    });

    it('should log connection closure', () => {
      const mockResponse = new MockResponse();
      sseManager.registerConnection('user123', mockResponse as any);

      const logCall = (mockLogger.logInfo as any).mock.calls.find(
        (call: any) => call[0] === 'sse_connection_registered'
      );
      const connectionId = logCall[1].connectionId;

      sseManager.closeConnection('user123', connectionId);

      expect(mockLogger.logInfo).toHaveBeenCalledWith(
        'sse_connection_closed',
        expect.objectContaining({
          userId: 'user123',
          connectionId,
        })
      );
    });

    it('should stop keep-alive messages after closure', async () => {
      vi.useFakeTimers();
      const mockResponse = new MockResponse();
      sseManager.registerConnection('user123', mockResponse as any);

      const logCall = (mockLogger.logInfo as any).mock.calls.find(
        (call: any) => call[0] === 'sse_connection_registered'
      );
      const connectionId = logCall[1].connectionId;

      // Get initial chunk count
      const initialChunks = mockResponse.getChunks().length;

      sseManager.closeConnection('user123', connectionId);

      // Advance time and verify no new keep-alive messages
      vi.advanceTimersByTime(mockConfig.sse.keepAliveInterval * 2);

      const finalChunks = mockResponse.getChunks().length;
      expect(finalChunks).toBe(initialChunks);
    });

    it('should handle closing non-existent connection gracefully', () => {
      expect(() => sseManager.closeConnection('user999', 'conn999')).not.toThrow();
    });
  });

  describe('closeAllConnections', () => {
    it('should close all active connections', () => {
      const mockResponse1 = new MockResponse();
      const mockResponse2 = new MockResponse();
      const mockResponse3 = new MockResponse();

      sseManager.registerConnection('user123', mockResponse1 as any);
      sseManager.registerConnection('user123', mockResponse2 as any);
      sseManager.registerConnection('user456', mockResponse3 as any);

      sseManager.closeAllConnections();

      expect(mockResponse1.writableEnded).toBe(true);
      expect(mockResponse2.writableEnded).toBe(true);
      expect(mockResponse3.writableEnded).toBe(true);
    });

    it('should log closure of all connections', () => {
      const mockResponse1 = new MockResponse();
      const mockResponse2 = new MockResponse();

      sseManager.registerConnection('user123', mockResponse1 as any);
      sseManager.registerConnection('user456', mockResponse2 as any);

      sseManager.closeAllConnections();

      expect(mockLogger.logInfo).toHaveBeenCalledWith(
        'sse_all_connections_closed',
        expect.objectContaining({
          totalClosed: 2,
        })
      );
    });

    it('should stop all keep-alive timers', async () => {
      vi.useFakeTimers();
      const mockResponse1 = new MockResponse();
      const mockResponse2 = new MockResponse();

      sseManager.registerConnection('user123', mockResponse1 as any);
      sseManager.registerConnection('user456', mockResponse2 as any);

      const initialChunks1 = mockResponse1.getChunks().length;
      const initialChunks2 = mockResponse2.getChunks().length;

      sseManager.closeAllConnections();

      // Advance time and verify no new keep-alive messages
      vi.advanceTimersByTime(mockConfig.sse.keepAliveInterval * 2);

      expect(mockResponse1.getChunks().length).toBe(initialChunks1);
      expect(mockResponse2.getChunks().length).toBe(initialChunks2);
    });
  });

  describe('Edge Cases', () => {
    it('should detect client close without notification via write error', () => {
      const mockResponse = new MockResponse();
      sseManager.registerConnection('user123', mockResponse as any);

      // Simulate write error (connection closed)
      mockResponse.writeError = new Error('EPIPE');

      const update: ProgressUpdate = {
        jobId: 'job123',
        userId: 'user123',
        status: 'processing' as any,
        progress: 50,
        message: 'Processing',
        timestamp: Date.now(),
      };

      // Broadcast should handle the error and remove the connection
      sseManager.broadcast('user123', update);

      expect(mockLogger.logWarn).toHaveBeenCalledWith(
        'sse_write_error',
        expect.objectContaining({
          userId: 'user123',
          error: expect.stringContaining('EPIPE'),
        })
      );
    });

    it('should handle server restart (all connections lost)', () => {
      const mockResponse1 = new MockResponse();
      const mockResponse2 = new MockResponse();

      sseManager.registerConnection('user123', mockResponse1 as any);
      sseManager.registerConnection('user456', mockResponse2 as any);

      // Simulate server restart by creating new SSEManager instance
      const newSSEManager = new SSEManager(mockConfig, mockLogger);

      // Old connections should be gone
      const update: ProgressUpdate = {
        jobId: 'job123',
        userId: 'user123',
        status: 'processing' as any,
        progress: 50,
        message: 'Processing',
        timestamp: Date.now(),
      };

      // Broadcast to new manager should not affect old connections
      newSSEManager.broadcast('user123', update);

      const chunks1 = mockResponse1.getChunks();
      const updateMessage = chunks1.find(chunk => chunk.includes('job123'));
      expect(updateMessage).toBeUndefined();
    });

    it('should handle client reconnect with same userId', () => {
      const mockResponse1 = new MockResponse();
      sseManager.registerConnection('user123', mockResponse1 as any);

      // Client disconnects
      mockResponse1.emit('close');

      // Client reconnects
      const mockResponse2 = new MockResponse();
      sseManager.registerConnection('user123', mockResponse2 as any);

      const update: ProgressUpdate = {
        jobId: 'job123',
        userId: 'user123',
        status: 'processing' as any,
        progress: 50,
        message: 'Processing',
        timestamp: Date.now(),
      };

      sseManager.broadcast('user123', update);

      // New connection should receive the update
      const chunks2 = mockResponse2.getChunks();
      const updateMessage = chunks2.find(chunk => chunk.includes('job123'));
      expect(updateMessage).toBeDefined();

      // Old connection should not receive it
      const chunks1 = mockResponse1.getChunks();
      const oldUpdateMessage = chunks1.find(chunk => chunk.includes('job123'));
      expect(oldUpdateMessage).toBeUndefined();
    });

    it('should handle network interruption (connection timeout)', async () => {
      vi.useFakeTimers();
      const mockResponse = new MockResponse();
      sseManager.registerConnection('user123', mockResponse as any);

      // Simulate write failing after network interruption
      mockResponse.writeError = new Error('ETIMEDOUT');

      // Advance time to trigger keep-alive
      vi.advanceTimersByTime(mockConfig.sse.keepAliveInterval);

      // Write error should be logged and connection removed
      expect(mockLogger.logWarn).toHaveBeenCalledWith(
        'sse_write_error',
        expect.objectContaining({
          error: expect.stringContaining('ETIMEDOUT'),
        })
      );
    });

    it('should handle malformed progress updates gracefully', () => {
      const mockResponse = new MockResponse();
      sseManager.registerConnection('user123', mockResponse as any);

      const malformedUpdate = {
        jobId: 'job123',
        userId: 'user123',
        // Missing required fields
      } as ProgressUpdate;

      // Should not throw
      expect(() => sseManager.broadcast('user123', malformedUpdate)).not.toThrow();
    });

    it('should handle very large progress messages', () => {
      const mockResponse = new MockResponse();
      sseManager.registerConnection('user123', mockResponse as any);

      const largeMessage = 'A'.repeat(10000);
      const update: ProgressUpdate = {
        jobId: 'job123',
        userId: 'user123',
        status: 'processing' as any,
        progress: 50,
        message: largeMessage,
        timestamp: Date.now(),
      };

      // Should not throw
      expect(() => sseManager.broadcast('user123', update)).not.toThrow();

      const chunks = mockResponse.getChunks();
      const updateMessage = chunks.find(chunk => chunk.includes('job123'));
      expect(updateMessage).toBeDefined();
    });
  });

  describe('Connection Management', () => {
    it('should generate unique connection IDs', () => {
      const mockResponse1 = new MockResponse();
      const mockResponse2 = new MockResponse();

      sseManager.registerConnection('user123', mockResponse1 as any);
      sseManager.registerConnection('user123', mockResponse2 as any);

      const logCalls = (mockLogger.logInfo as any).mock.calls.filter(
        (call: any) => call[0] === 'sse_connection_registered'
      );

      const connectionId1 = logCalls[0][1].connectionId;
      const connectionId2 = logCalls[1][1].connectionId;

      expect(connectionId1).not.toBe(connectionId2);
    });

    it('should track connection count per user', () => {
      const mockResponse1 = new MockResponse();
      const mockResponse2 = new MockResponse();
      const mockResponse3 = new MockResponse();

      sseManager.registerConnection('user123', mockResponse1 as any);
      sseManager.registerConnection('user123', mockResponse2 as any);
      sseManager.registerConnection('user456', mockResponse3 as any);

      const logCalls = (mockLogger.logInfo as any).mock.calls.filter(
        (call: any) => call[0] === 'sse_connection_registered'
      );

      const user123Connections = logCalls.filter(
        (call: any) => call[1].userId === 'user123'
      );

      expect(user123Connections[1][1].connectionCount).toBe(2);
    });
  });
});
