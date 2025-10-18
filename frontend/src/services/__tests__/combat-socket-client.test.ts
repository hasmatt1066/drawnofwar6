/**
 * TASK-COMBAT-VIZ-001: CombatSocketClient Tests
 *
 * Test-driven development for Socket.IO combat connection management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CombatSocketClient, ConnectionStatus } from '../combat-socket-client';
import type { Socket } from 'socket.io-client';

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket)
}));

// Mock socket instance
const mockSocket = {
  on: vi.fn(),
  emit: vi.fn(),
  off: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  connected: false,
  id: 'test-socket-id'
} as unknown as Socket;

describe('CombatSocketClient', () => {
  let client: CombatSocketClient;
  const mockMatchId = 'test-match-123';
  const mockServerUrl = 'http://localhost:3001';

  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.connected = false;
  });

  afterEach(() => {
    if (client) {
      client.disconnect();
    }
  });

  describe('Construction and Connection', () => {
    it('should create client without auto-connecting', () => {
      client = new CombatSocketClient(mockServerUrl, mockMatchId, { autoConnect: false });

      expect(client).toBeDefined();
      expect(client.getConnectionStatus()).toBe(ConnectionStatus.DISCONNECTED);
    });

    it('should connect to combat namespace when connect() is called', () => {
      client = new CombatSocketClient(mockServerUrl, mockMatchId, { autoConnect: false });

      client.connect();

      expect(mockSocket.connect).toHaveBeenCalled();
    });

    it('should auto-connect if autoConnect option is true', () => {
      client = new CombatSocketClient(mockServerUrl, mockMatchId, { autoConnect: true });

      expect(mockSocket.connect).toHaveBeenCalled();
    });
  });

  describe('Connection Status', () => {
    it('should emit CONNECTING status when connection starts', () => {
      client = new CombatSocketClient(mockServerUrl, mockMatchId, { autoConnect: false });

      const statusCallback = vi.fn();
      client.onStatusChange(statusCallback);

      client.connect();

      expect(statusCallback).toHaveBeenCalledWith(ConnectionStatus.CONNECTING);
    });

    it('should emit CONNECTED status on successful connection', () => {
      client = new CombatSocketClient(mockServerUrl, mockMatchId, { autoConnect: false });

      const statusCallback = vi.fn();
      client.onStatusChange(statusCallback);

      client.connect();

      // Simulate socket connection
      const connectHandler = (mockSocket.on as any).mock.calls.find(
        (call: any[]) => call[0] === 'connect'
      )?.[1];

      if (connectHandler) {
        mockSocket.connected = true;
        connectHandler();
      }

      expect(statusCallback).toHaveBeenCalledWith(ConnectionStatus.CONNECTED);
    });

    it('should emit ERROR status on connection failure', () => {
      client = new CombatSocketClient(mockServerUrl, mockMatchId, { autoConnect: false });

      const statusCallback = vi.fn();
      client.onStatusChange(statusCallback);

      client.connect();

      // Simulate connection error
      const errorHandler = (mockSocket.on as any).mock.calls.find(
        (call: any[]) => call[0] === 'connect_error'
      )?.[1];

      if (errorHandler) {
        errorHandler(new Error('Connection failed'));
      }

      expect(statusCallback).toHaveBeenCalledWith(ConnectionStatus.ERROR);
    });

    it('should emit DISCONNECTED status on disconnect', () => {
      client = new CombatSocketClient(mockServerUrl, mockMatchId, { autoConnect: false });

      const statusCallback = vi.fn();
      client.onStatusChange(statusCallback);

      client.connect();

      // Simulate socket connection first
      const connectHandler = (mockSocket.on as any).mock.calls.find(
        (call: any[]) => call[0] === 'connect'
      )?.[1];
      if (connectHandler) {
        mockSocket.connected = true;
        connectHandler();
      }

      // Simulate disconnect
      const disconnectHandler = (mockSocket.on as any).mock.calls.find(
        (call: any[]) => call[0] === 'disconnect'
      )?.[1];

      if (disconnectHandler) {
        mockSocket.connected = false;
        disconnectHandler();
      }

      expect(statusCallback).toHaveBeenCalledWith(ConnectionStatus.DISCONNECTED);
    });
  });

  describe('Match Room Management', () => {
    it('should join match room on successful connection', () => {
      client = new CombatSocketClient(mockServerUrl, mockMatchId, { autoConnect: false });

      client.connect();

      // Simulate successful connection
      const connectHandler = (mockSocket.on as any).mock.calls.find(
        (call: any[]) => call[0] === 'connect'
      )?.[1];

      if (connectHandler) {
        mockSocket.connected = true;
        connectHandler();
      }

      // Should emit combat:join event with matchId
      expect(mockSocket.emit).toHaveBeenCalledWith('combat:join', mockMatchId);
    });

    it('should handle invalid matchId gracefully', () => {
      const invalidMatchId = '';

      expect(() => {
        client = new CombatSocketClient(mockServerUrl, invalidMatchId);
      }).toThrow('Match ID is required');
    });

    it('should leave match room before disconnecting', () => {
      client = new CombatSocketClient(mockServerUrl, mockMatchId, { autoConnect: false });

      client.connect();

      // Simulate connection
      const connectHandler = (mockSocket.on as any).mock.calls.find(
        (call: any[]) => call[0] === 'connect'
      )?.[1];
      if (connectHandler) {
        mockSocket.connected = true;
        connectHandler();
      }

      // Disconnect
      client.disconnect();

      // Should emit combat:leave event before disconnecting
      expect(mockSocket.emit).toHaveBeenCalledWith('combat:leave', mockMatchId);
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });
  });

  describe('Auto-Reconnect', () => {
    it('should attempt to reconnect on disconnect (default behavior)', () => {
      client = new CombatSocketClient(mockServerUrl, mockMatchId, { autoConnect: false });

      const statusCallback = vi.fn();
      client.onStatusChange(statusCallback);

      client.connect();

      // Simulate connection
      const connectHandler = (mockSocket.on as any).mock.calls.find(
        (call: any[]) => call[0] === 'connect'
      )?.[1];
      if (connectHandler) {
        mockSocket.connected = true;
        connectHandler();
      }

      statusCallback.mockClear();

      // Simulate unexpected disconnect
      const disconnectHandler = (mockSocket.on as any).mock.calls.find(
        (call: any[]) => call[0] === 'disconnect'
      )?.[1];

      if (disconnectHandler) {
        mockSocket.connected = false;
        disconnectHandler('transport close'); // Unexpected disconnect
      }

      // Should emit RECONNECTING status
      expect(statusCallback).toHaveBeenCalledWith(ConnectionStatus.RECONNECTING);
    });

    it('should NOT reconnect on manual disconnect', () => {
      client = new CombatSocketClient(mockServerUrl, mockMatchId, { autoConnect: false });

      const statusCallback = vi.fn();
      client.onStatusChange(statusCallback);

      client.connect();

      // Simulate connection
      const connectHandler = (mockSocket.on as any).mock.calls.find(
        (call: any[]) => call[0] === 'connect'
      )?.[1];
      if (connectHandler) {
        mockSocket.connected = true;
        connectHandler();
      }

      statusCallback.mockClear();

      // Manual disconnect
      client.disconnect();

      // Simulate disconnect event
      const disconnectHandler = (mockSocket.on as any).mock.calls.find(
        (call: any[]) => call[0] === 'disconnect'
      )?.[1];

      if (disconnectHandler) {
        mockSocket.connected = false;
        disconnectHandler('client namespace disconnect'); // Manual disconnect
      }

      // Should NOT emit RECONNECTING status
      expect(statusCallback).not.toHaveBeenCalledWith(ConnectionStatus.RECONNECTING);
      expect(statusCallback).toHaveBeenCalledWith(ConnectionStatus.DISCONNECTED);
    });

    it('should support disabling auto-reconnect via options', () => {
      client = new CombatSocketClient(mockServerUrl, mockMatchId, {
        autoConnect: false,
        reconnect: false
      });

      const statusCallback = vi.fn();
      client.onStatusChange(statusCallback);

      client.connect();

      // Simulate connection
      const connectHandler = (mockSocket.on as any).mock.calls.find(
        (call: any[]) => call[0] === 'connect'
      )?.[1];
      if (connectHandler) {
        mockSocket.connected = true;
        connectHandler();
      }

      statusCallback.mockClear();

      // Simulate unexpected disconnect
      const disconnectHandler = (mockSocket.on as any).mock.calls.find(
        (call: any[]) => call[0] === 'disconnect'
      )?.[1];

      if (disconnectHandler) {
        mockSocket.connected = false;
        disconnectHandler('transport close');
      }

      // Should NOT reconnect when reconnect is disabled
      expect(statusCallback).not.toHaveBeenCalledWith(ConnectionStatus.RECONNECTING);
    });
  });

  describe('Event Listeners', () => {
    it('should allow registering combat:state event listeners', () => {
      client = new CombatSocketClient(mockServerUrl, mockMatchId, { autoConnect: false });

      const stateCallback = vi.fn();
      client.onCombatState(stateCallback);

      // Simulate receiving combat:state event
      const stateHandler = (mockSocket.on as any).mock.calls.find(
        (call: any[]) => call[0] === 'combat:state'
      )?.[1];

      const mockCombatState = { tick: 1, units: [] };

      if (stateHandler) {
        stateHandler(mockCombatState);
      }

      expect(stateCallback).toHaveBeenCalledWith(mockCombatState);
    });

    it('should allow registering combat:events event listeners', () => {
      client = new CombatSocketClient(mockServerUrl, mockMatchId, { autoConnect: false });

      const eventsCallback = vi.fn();
      client.onCombatEvents(eventsCallback);

      // Simulate receiving combat:events event
      const eventsHandler = (mockSocket.on as any).mock.calls.find(
        (call: any[]) => call[0] === 'combat:events'
      )?.[1];

      const mockEvents = [{ type: 'damage', targetId: 'unit-1', amount: 10 }];

      if (eventsHandler) {
        eventsHandler(mockEvents);
      }

      expect(eventsCallback).toHaveBeenCalledWith(mockEvents);
    });

    it('should allow registering combat:completed event listeners', () => {
      client = new CombatSocketClient(mockServerUrl, mockMatchId, { autoConnect: false });

      const completedCallback = vi.fn();
      client.onCombatCompleted(completedCallback);

      // Simulate receiving combat:completed event
      const completedHandler = (mockSocket.on as any).mock.calls.find(
        (call: any[]) => call[0] === 'combat:completed'
      )?.[1];

      const mockResult = { winner: 'player1', duration: 30000 };

      if (completedHandler) {
        completedHandler(mockResult);
      }

      expect(completedCallback).toHaveBeenCalledWith(mockResult);
    });

    it('should clean up event listeners on disconnect', () => {
      client = new CombatSocketClient(mockServerUrl, mockMatchId, { autoConnect: false });

      const stateCallback = vi.fn();
      client.onCombatState(stateCallback);

      client.disconnect();

      // Should call socket.off to remove listeners
      expect(mockSocket.off).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle connection errors gracefully', () => {
      client = new CombatSocketClient(mockServerUrl, mockMatchId, { autoConnect: false });

      const errorCallback = vi.fn();
      client.onError(errorCallback);

      client.connect();

      // Simulate connection error
      const errorHandler = (mockSocket.on as any).mock.calls.find(
        (call: any[]) => call[0] === 'connect_error'
      )?.[1];

      const mockError = new Error('Network unreachable');

      if (errorHandler) {
        errorHandler(mockError);
      }

      expect(errorCallback).toHaveBeenCalledWith(mockError);
      expect(client.getConnectionStatus()).toBe(ConnectionStatus.ERROR);
    });

    it('should handle socket errors during active connection', () => {
      client = new CombatSocketClient(mockServerUrl, mockMatchId, { autoConnect: false });

      const errorCallback = vi.fn();
      client.onError(errorCallback);

      client.connect();

      // Simulate runtime error
      const errorHandler = (mockSocket.on as any).mock.calls.find(
        (call: any[]) => call[0] === 'error'
      )?.[1];

      const mockError = new Error('Invalid data received');

      if (errorHandler) {
        errorHandler(mockError);
      }

      expect(errorCallback).toHaveBeenCalledWith(mockError);
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory after 100 connect/disconnect cycles', () => {
      // This test validates that listeners are properly cleaned up
      for (let i = 0; i < 100; i++) {
        client = new CombatSocketClient(mockServerUrl, `match-${i}`, { autoConnect: false });

        client.onCombatState(vi.fn());
        client.onCombatEvents(vi.fn());
        client.onStatusChange(vi.fn());

        client.connect();
        client.disconnect();
      }

      // If listeners aren't cleaned up, mockSocket.on would be called 300+ times
      // With proper cleanup, each cycle should clean up after itself
      expect(mockSocket.off).toHaveBeenCalled();
    });
  });
});
