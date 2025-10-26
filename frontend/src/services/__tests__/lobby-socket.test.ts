/**
 * Lobby Socket Service Tests
 *
 * Tests for Socket.IO client service for lobby namespace
 * Following TDD approach - tests written first
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { io, Socket } from 'socket.io-client';
import { LobbySocket } from '../lobby-socket';

// Mock socket.io-client
vi.mock('socket.io-client');

// Mock Socket type for testing
interface MockSocket extends Partial<Socket> {
  on: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  connected: boolean;
}

// Helper to create mock socket
function createMockSocket(): MockSocket {
  const listeners: Map<string, Function[]> = new Map();

  return {
    on: vi.fn((event: string, callback: Function) => {
      if (!listeners.has(event)) {
        listeners.set(event, []);
      }
      listeners.get(event)!.push(callback);
      return {} as Socket;
    }),
    emit: vi.fn((event: string, ...args: any[]) => {
      // Trigger listeners for this event (for testing)
      const eventListeners = listeners.get(event);
      if (eventListeners) {
        eventListeners.forEach(cb => cb(...args));
      }
      return {} as Socket;
    }),
    disconnect: vi.fn(),
    connected: true
  };
}

// Mock window.__getAuthToken
const mockGetAuthToken = vi.fn();

describe('LobbySocket', () => {
  let mockSocket: MockSocket;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket = createMockSocket();
    (io as any).mockReturnValue(mockSocket);

    // Set up window.__getAuthToken
    (window as any).__getAuthToken = mockGetAuthToken;
    mockGetAuthToken.mockResolvedValue('test-token');
  });

  afterEach(() => {
    delete (window as any).__getAuthToken;
  });

  describe('Connection', () => {
    it('should connect to /lobby namespace with correct URL', () => {
      const socket = new LobbySocket();
      socket.connect();

      expect(io).toHaveBeenCalledWith(
        expect.stringContaining('/lobby'),
        expect.any(Object)
      );
    });

    it('should include auth token in connection options', async () => {
      mockGetAuthToken.mockResolvedValue('my-secret-token');

      const socket = new LobbySocket();
      socket.connect();

      // Get the connection options
      const ioCall = (io as any).mock.calls[0];
      expect(ioCall).toBeDefined();

      const options = ioCall[1];
      expect(options).toBeDefined();
      expect(options.auth).toBeDefined();

      // Test the auth callback
      const authCallback = vi.fn();
      await options.auth(authCallback);

      expect(authCallback).toHaveBeenCalledWith({ token: 'my-secret-token' });
    });

    it('should enable auto-reconnect', () => {
      const socket = new LobbySocket();
      socket.connect();

      const options = (io as any).mock.calls[0][1];
      expect(options.reconnection).toBe(true);
    });

    it('should subscribe to lobby on connect event', () => {
      const socket = new LobbySocket();
      socket.connect();

      // Simulate connect event
      const connectCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'connect'
      )?.[1];

      expect(connectCallback).toBeDefined();
      connectCallback();

      expect(mockSocket.emit).toHaveBeenCalledWith('lobby:subscribe');
    });
  });

  describe('Disconnection', () => {
    it('should emit unsubscribe before disconnecting', () => {
      const socket = new LobbySocket();
      socket.connect();
      socket.disconnect();

      expect(mockSocket.emit).toHaveBeenCalledWith('lobby:unsubscribe');
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('should call disconnect on socket', () => {
      const socket = new LobbySocket();
      socket.connect();
      socket.disconnect();

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });
  });

  describe('Event Listeners', () => {
    it('should listen for lobby:battles event', () => {
      const callback = vi.fn();
      const socket = new LobbySocket();
      socket.connect();
      socket.onBattles(callback);

      // Simulate receiving battles event
      const battlesCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'lobby:battles'
      )?.[1];

      expect(battlesCallback).toBeDefined();

      const testBattles = [{ battleId: 'b1' }, { battleId: 'b2' }];
      battlesCallback(testBattles);

      expect(callback).toHaveBeenCalledWith(testBattles);
    });

    it('should listen for lobby:battle-created event', () => {
      const callback = vi.fn();
      const socket = new LobbySocket();
      socket.connect();
      socket.onBattleCreated(callback);

      const battleCreatedCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'lobby:battle-created'
      )?.[1];

      expect(battleCreatedCallback).toBeDefined();

      const testBattle = { battleId: 'new-battle', battleKey: 'ABC123' };
      battleCreatedCallback(testBattle);

      expect(callback).toHaveBeenCalledWith(testBattle);
    });

    it('should listen for lobby:battle-filled event', () => {
      const callback = vi.fn();
      const socket = new LobbySocket();
      socket.connect();
      socket.onBattleFilled(callback);

      const battleFilledCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'lobby:battle-filled'
      )?.[1];

      expect(battleFilledCallback).toBeDefined();

      const testData = { battleId: 'filled-battle' };
      battleFilledCallback(testData);

      expect(callback).toHaveBeenCalledWith(testData);
    });

    it('should listen for lobby:battle-cancelled event', () => {
      const callback = vi.fn();
      const socket = new LobbySocket();
      socket.connect();
      socket.onBattleCancelled(callback);

      const battleCancelledCallback = mockSocket.on.mock.calls.find(
        call => call[0] === 'lobby:battle-cancelled'
      )?.[1];

      expect(battleCancelledCallback).toBeDefined();

      const testData = { battleId: 'cancelled-battle' };
      battleCancelledCallback(testData);

      expect(callback).toHaveBeenCalledWith(testData);
    });
  });

  describe('Singleton Pattern', () => {
    it('should reuse the same socket instance on multiple connects', () => {
      const socket = new LobbySocket();
      socket.connect();

      const firstCallCount = (io as any).mock.calls.length;

      socket.connect(); // Try connecting again

      // Should not create a new socket instance
      expect((io as any).mock.calls.length).toBe(firstCallCount);
    });

    it('should allow reconnecting after disconnect', () => {
      const socket = new LobbySocket();
      socket.connect();
      socket.disconnect();

      vi.clearAllMocks();
      mockSocket = createMockSocket();
      (io as any).mockReturnValue(mockSocket);

      socket.connect();

      expect(io).toHaveBeenCalled();
    });
  });

  describe('Subscribe/Unsubscribe', () => {
    it('should emit lobby:subscribe when subscribe is called', () => {
      const socket = new LobbySocket();
      socket.connect();
      socket.subscribe();

      expect(mockSocket.emit).toHaveBeenCalledWith('lobby:subscribe');
    });

    it('should emit lobby:unsubscribe when unsubscribe is called', () => {
      const socket = new LobbySocket();
      socket.connect();
      socket.unsubscribe();

      expect(mockSocket.emit).toHaveBeenCalledWith('lobby:unsubscribe');
    });
  });
});
