/**
 * useLobbySocket Hook Tests
 *
 * Tests for React hook that manages lobby socket connection
 * Following TDD approach - tests written first
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useLobbySocket } from '../useLobbySocket';
import { LobbySocket, LobbyBattle } from '../../services/lobby-socket';

// Mock LobbySocket
vi.mock('../../services/lobby-socket');

describe('useLobbySocket', () => {
  let mockSocket: any;
  let connectCallback: Function;
  let disconnectCallback: Function;
  let battlesCallback: Function;
  let battleCreatedCallback: Function;
  let battleFilledCallback: Function;
  let battleCancelledCallback: Function;

  beforeEach(() => {
    // Create mock socket with callback storage
    mockSocket = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      onBattles: vi.fn((cb) => { battlesCallback = cb; }),
      onBattleCreated: vi.fn((cb) => { battleCreatedCallback = cb; }),
      onBattleFilled: vi.fn((cb) => { battleFilledCallback = cb; }),
      onBattleCancelled: vi.fn((cb) => { battleCancelledCallback = cb; }),
      isConnected: vi.fn(() => false)
    };

    // Mock LobbySocket constructor
    (LobbySocket as any).mockImplementation(() => mockSocket);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Lifecycle', () => {
    it('should connect to lobby socket on mount', () => {
      renderHook(() => useLobbySocket());

      expect(mockSocket.connect).toHaveBeenCalled();
    });

    it('should set up event listeners on mount', () => {
      renderHook(() => useLobbySocket());

      expect(mockSocket.onBattles).toHaveBeenCalled();
      expect(mockSocket.onBattleCreated).toHaveBeenCalled();
      expect(mockSocket.onBattleFilled).toHaveBeenCalled();
      expect(mockSocket.onBattleCancelled).toHaveBeenCalled();
    });

    it('should disconnect on unmount', () => {
      const { unmount } = renderHook(() => useLobbySocket());

      unmount();

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('should clean up only once on unmount', () => {
      const { unmount } = renderHook(() => useLobbySocket());

      unmount();

      expect(mockSocket.disconnect).toHaveBeenCalledTimes(1);
    });
  });

  describe('Battle List Updates', () => {
    it('should initialize with empty battles array', () => {
      const { result } = renderHook(() => useLobbySocket());

      expect(result.current.battles).toEqual([]);
    });

    it('should update battles when lobby:battles event received', () => {
      const { result } = renderHook(() => useLobbySocket());

      const testBattles: LobbyBattle[] = [
        {
          battleId: 'b1',
          battleKey: 'ABC123',
          battleName: 'Epic Battle',
          status: 'waiting',
          isPublic: true,
          players: {
            host: {
              userId: 'user1',
              displayName: 'Player One',
              joinedAt: new Date().toISOString()
            }
          },
          createdAt: new Date().toISOString()
        },
        {
          battleId: 'b2',
          battleKey: 'XYZ789',
          battleName: 'Quick Match',
          status: 'waiting',
          isPublic: true,
          players: {
            host: {
              userId: 'user2',
              displayName: 'Player Two',
              joinedAt: new Date().toISOString()
            }
          },
          createdAt: new Date().toISOString()
        }
      ];

      act(() => {
        battlesCallback(testBattles);
      });

      expect(result.current.battles).toHaveLength(2);
      expect(result.current.battles[0].battleId).toBe('b1');
      expect(result.current.battles[1].battleId).toBe('b2');
    });

    it('should add battle when lobby:battle-created event received', () => {
      const { result } = renderHook(() => useLobbySocket());

      // Set initial battles
      act(() => {
        battlesCallback([
          {
            battleId: 'b1',
            battleKey: 'ABC123',
            battleName: 'Existing Battle',
            status: 'waiting',
            isPublic: true,
            players: {
              host: {
                userId: 'user1',
                displayName: 'Player One',
                joinedAt: new Date().toISOString()
              }
            },
            createdAt: new Date().toISOString()
          }
        ]);
      });

      // Add new battle
      const newBattle: LobbyBattle = {
        battleId: 'b2',
        battleKey: 'XYZ789',
        battleName: 'New Battle',
        status: 'waiting',
        isPublic: true,
        players: {
          host: {
            userId: 'user2',
            displayName: 'Player Two',
            joinedAt: new Date().toISOString()
          }
        },
        createdAt: new Date().toISOString()
      };

      act(() => {
        battleCreatedCallback(newBattle);
      });

      expect(result.current.battles).toHaveLength(2);
      expect(result.current.battles[1].battleId).toBe('b2');
      expect(result.current.battles[1].battleName).toBe('New Battle');
    });

    it('should remove battle when lobby:battle-filled event received', () => {
      const { result } = renderHook(() => useLobbySocket());

      // Set initial battles
      act(() => {
        battlesCallback([
          {
            battleId: 'b1',
            battleKey: 'ABC123',
            battleName: 'Battle 1',
            status: 'waiting',
            isPublic: true,
            players: {
              host: {
                userId: 'user1',
                displayName: 'Player One',
                joinedAt: new Date().toISOString()
              }
            },
            createdAt: new Date().toISOString()
          },
          {
            battleId: 'b2',
            battleKey: 'XYZ789',
            battleName: 'Battle 2',
            status: 'waiting',
            isPublic: true,
            players: {
              host: {
                userId: 'user2',
                displayName: 'Player Two',
                joinedAt: new Date().toISOString()
              }
            },
            createdAt: new Date().toISOString()
          }
        ]);
      });

      // Remove first battle
      act(() => {
        battleFilledCallback({ battleId: 'b1' });
      });

      expect(result.current.battles).toHaveLength(1);
      expect(result.current.battles[0].battleId).toBe('b2');
    });

    it('should remove battle when lobby:battle-cancelled event received', () => {
      const { result } = renderHook(() => useLobbySocket());

      // Set initial battles
      act(() => {
        battlesCallback([
          {
            battleId: 'b1',
            battleKey: 'ABC123',
            battleName: 'Battle 1',
            status: 'waiting',
            isPublic: true,
            players: {
              host: {
                userId: 'user1',
                displayName: 'Player One',
                joinedAt: new Date().toISOString()
              }
            },
            createdAt: new Date().toISOString()
          },
          {
            battleId: 'b2',
            battleKey: 'XYZ789',
            battleName: 'Battle 2',
            status: 'waiting',
            isPublic: true,
            players: {
              host: {
                userId: 'user2',
                displayName: 'Player Two',
                joinedAt: new Date().toISOString()
              }
            },
            createdAt: new Date().toISOString()
          }
        ]);
      });

      // Cancel second battle
      act(() => {
        battleCancelledCallback({ battleId: 'b2' });
      });

      expect(result.current.battles).toHaveLength(1);
      expect(result.current.battles[0].battleId).toBe('b1');
    });

    it('should not duplicate battles when same battle created twice', () => {
      const { result } = renderHook(() => useLobbySocket());

      const battle: LobbyBattle = {
        battleId: 'b1',
        battleKey: 'ABC123',
        battleName: 'Test Battle',
        status: 'waiting',
        isPublic: true,
        players: {
          host: {
            userId: 'user1',
            displayName: 'Player One',
            joinedAt: new Date().toISOString()
          }
        },
        createdAt: new Date().toISOString()
      };

      act(() => {
        battleCreatedCallback(battle);
        battleCreatedCallback(battle); // Try adding same battle again
      });

      expect(result.current.battles).toHaveLength(1);
    });
  });

  describe('Connection State', () => {
    it('should initialize with isConnected as false', () => {
      const { result } = renderHook(() => useLobbySocket());

      expect(result.current.isConnected).toBe(false);
    });

    it('should update isConnected based on socket connection', () => {
      mockSocket.isConnected = vi.fn(() => true);

      const { result } = renderHook(() => useLobbySocket());

      // Trigger a state update by receiving battles
      act(() => {
        battlesCallback([]);
      });

      expect(result.current.isConnected).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should initialize with no error', () => {
      const { result } = renderHook(() => useLobbySocket());

      expect(result.current.error).toBeNull();
    });

    it('should handle connection errors gracefully', () => {
      mockSocket.connect = vi.fn(() => {
        throw new Error('Connection failed');
      });

      const { result } = renderHook(() => useLobbySocket());

      expect(result.current.error).toBe('Connection failed');
    });
  });
});
