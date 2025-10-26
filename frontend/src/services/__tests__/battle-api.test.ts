/**
 * Battle API Client Tests
 *
 * Unit tests for battle API service functions.
 * Following TDD approach - tests written first.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createBattle,
  joinBattleByKey,
  quickPlay,
  getOpenBattles
} from '../battle-api';
import {
  InsufficientCreaturesError,
  BattleNotFoundError,
  BattleAlreadyFilledError,
  CannotJoinOwnBattleError,
  ActiveBattleExistsError
} from '../battle-api-errors';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

// Mock window.__getAuthToken
const mockGetAuthToken = vi.fn();

describe('Battle API Client', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    mockGetAuthToken.mockClear();
    mockGetAuthToken.mockResolvedValue('test-token');

    // Set up window.__getAuthToken
    (window as any).__getAuthToken = mockGetAuthToken;
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete (window as any).__getAuthToken;
  });

  describe('createBattle', () => {
    it('should create battle with name and public flag', async () => {
      const mockResponse = {
        success: true,
        battleId: 'battle-123',
        battleKey: 'ABC123',
        matchId: 'match-456',
        playerId: 'player1'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });

      const result = await createBattle('My Epic Battle', true);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/battles'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token'
          }),
          body: JSON.stringify({
            battleName: 'My Epic Battle',
            isPublic: true
          })
        })
      );
    });

    it('should include authorization header', async () => {
      mockGetAuthToken.mockResolvedValue('my-special-token');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ battleKey: 'TEST123', matchId: 'match-1', playerId: 'player1' })
      });

      await createBattle('Test', true);

      const fetchCall = mockFetch.mock.calls[0][1];
      expect(fetchCall.headers.Authorization).toBe('Bearer my-special-token');
    });

    it('should throw InsufficientCreaturesError for insufficient creatures', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'INSUFFICIENT_CREATURES',
          message: 'You need at least 3 creatures to create a battle'
        })
      });

      await expect(createBattle('Test', true)).rejects.toThrow(InsufficientCreaturesError);
      await expect(createBattle('Test', true)).rejects.toThrow('You need at least 3 creatures');
    });

    it('should throw ActiveBattleExistsError when already in battle', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          error: 'BATTLE_IN_PROGRESS',
          message: 'You already have an active battle'
        })
      });

      await expect(createBattle('Test', true)).rejects.toThrow(ActiveBattleExistsError);
    });

    it('should throw generic error for network failures', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(createBattle('Test', true)).rejects.toThrow('Network error');
    });

    it('should default isPublic to true if not specified', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ battleKey: 'TEST', matchId: 'm1', playerId: 'player1' })
      });

      await createBattle('Test');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.isPublic).toBe(true);
    });
  });

  describe('joinBattleByKey', () => {
    it('should join battle with valid key', async () => {
      const mockResponse = {
        success: true,
        battleId: 'battle-789',
        matchId: 'match-999',
        playerId: 'player2'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });

      const result = await joinBattleByKey('ABC123');

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/battles/ABC123/join'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token'
          })
        })
      );
    });

    it('should validate battle key format (6 uppercase alphanumeric)', async () => {
      await expect(joinBattleByKey('invalid')).rejects.toThrow('Invalid battle key format');
      await expect(joinBattleByKey('abc123')).rejects.toThrow('Invalid battle key format');
      await expect(joinBattleByKey('AB12')).rejects.toThrow('Invalid battle key format');
      await expect(joinBattleByKey('ABC1234')).rejects.toThrow('Invalid battle key format');
      await expect(joinBattleByKey('ABC-123')).rejects.toThrow('Invalid battle key format');
    });

    it('should accept valid battle keys', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ battleId: 'b1', matchId: 'm1', playerId: 'player2' })
      });

      // All these should be valid
      await expect(joinBattleByKey('ABC123')).resolves.toBeDefined();
      await expect(joinBattleByKey('XYZ789')).resolves.toBeDefined();
      await expect(joinBattleByKey('K3P9X2')).resolves.toBeDefined();
      await expect(joinBattleByKey('AAAAAA')).resolves.toBeDefined();
      await expect(joinBattleByKey('999999')).resolves.toBeDefined();
    });

    it('should throw BattleNotFoundError for non-existent battle', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          error: 'BATTLE_NOT_FOUND',
          message: 'Battle not found'
        })
      });

      await expect(joinBattleByKey('NOTFND')).rejects.toThrow(BattleNotFoundError);
    });

    it('should throw BattleAlreadyFilledError when battle is full', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'BATTLE_NOT_AVAILABLE',
          message: 'This battle has already started or is full'
        })
      });

      await expect(joinBattleByKey('FULL01')).rejects.toThrow(BattleAlreadyFilledError);
    });

    it('should throw CannotJoinOwnBattleError when joining own battle', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'CANNOT_JOIN_OWN_BATTLE',
          message: 'You cannot join your own battle'
        })
      });

      await expect(joinBattleByKey('MINE01')).rejects.toThrow(CannotJoinOwnBattleError);
    });

    it('should throw InsufficientCreaturesError when not enough creatures', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'INSUFFICIENT_CREATURES',
          message: 'You need at least 3 creatures to join a battle'
        })
      });

      await expect(joinBattleByKey('TEST01')).rejects.toThrow(InsufficientCreaturesError);
    });
  });

  describe('quickPlay', () => {
    it('should return joined battle when match found', async () => {
      const mockResponse = {
        success: true,
        action: 'joined',
        battleId: 'battle-existing',
        battleKey: 'EXIST1',
        matchId: 'match-777',
        playerId: 'player2'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });

      const result = await quickPlay();

      expect(result).toEqual(mockResponse);
      expect(result.action).toBe('joined');
      expect(result.playerId).toBe('player2');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/battles/quick-play'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token'
          })
        })
      );
    });

    it('should return created battle when no match found', async () => {
      const mockResponse = {
        success: true,
        action: 'created',
        battleId: 'battle-new',
        battleKey: 'NEW123',
        matchId: 'match-888',
        playerId: 'player1'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });

      const result = await quickPlay();

      expect(result).toEqual(mockResponse);
      expect(result.action).toBe('created');
      expect(result.playerId).toBe('player1');
    });

    it('should throw InsufficientCreaturesError for insufficient creatures', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: 'INSUFFICIENT_CREATURES',
          message: 'You need at least 3 creatures for Quick Play'
        })
      });

      await expect(quickPlay()).rejects.toThrow(InsufficientCreaturesError);
    });

    it('should throw ActiveBattleExistsError when already in battle', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          error: 'BATTLE_IN_PROGRESS',
          message: 'You already have an active battle'
        })
      });

      await expect(quickPlay()).rejects.toThrow(ActiveBattleExistsError);
    });
  });

  describe('getOpenBattles', () => {
    it('should fetch open battles with default pagination', async () => {
      const mockResponse = {
        battles: [
          {
            battleId: 'b1',
            battleKey: 'KEY001',
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
            battleKey: 'KEY002',
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
        ],
        page: 1,
        limit: 10,
        total: 2
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });

      const result = await getOpenBattles();

      expect(result).toEqual(mockResponse);
      expect(result.battles).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/battles/open?page=1&limit=10'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token'
          })
        })
      );
    });

    it('should fetch open battles with custom pagination', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ battles: [], page: 2, limit: 20, total: 0 })
      });

      await getOpenBattles(2, 20);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('page=2&limit=20'),
        expect.any(Object)
      );
    });

    it('should return empty array when no battles available', async () => {
      const mockResponse = {
        battles: [],
        page: 1,
        limit: 10,
        total: 0
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });

      const result = await getOpenBattles();

      expect(result.battles).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          error: 'INTERNAL_ERROR',
          message: 'Server error'
        })
      });

      await expect(getOpenBattles()).rejects.toThrow('Server error');
    });
  });

  describe('API Configuration', () => {
    it('should use VITE_API_URL environment variable', async () => {
      // Save original
      const originalUrl = import.meta.env.VITE_API_URL;

      // Test with custom URL
      import.meta.env.VITE_API_URL = 'https://custom-api.com';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ battleKey: 'TEST', matchId: 'm1', playerId: 'player1' })
      });

      await createBattle('Test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://custom-api.com'),
        expect.any(Object)
      );

      // Restore
      import.meta.env.VITE_API_URL = originalUrl;
    });

    it('should default to localhost:3001 if VITE_API_URL not set', async () => {
      const originalUrl = import.meta.env.VITE_API_URL;
      delete (import.meta.env as any).VITE_API_URL;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ battleKey: 'TEST', matchId: 'm1', playerId: 'player1' })
      });

      await createBattle('Test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('http://localhost:3001'),
        expect.any(Object)
      );

      import.meta.env.VITE_API_URL = originalUrl;
    });
  });
});
