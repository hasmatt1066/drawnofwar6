/**
 * Battle API Client
 *
 * HTTP client for battle-related API endpoints. Handles battle creation,
 * joining, quick play, and browsing open battles.
 */

import { parseBattleApiError } from './battle-api-errors';

/**
 * Get the API base URL from environment or default
 */
function getApiUrl(): string {
  return import.meta.env.VITE_API_URL || 'http://localhost:3001';
}

/**
 * Get authentication token for API requests
 * Note: This is a workaround since we can't use hooks outside components.
 * In production, this should be injected via dependency injection.
 */
async function getAuthToken(): Promise<string> {
  // For now, we'll use a global function that components can set
  // This will be improved when we refactor to use React Query or similar
  if (typeof window !== 'undefined' && (window as any).__getAuthToken) {
    return await (window as any).__getAuthToken();
  }
  throw new Error('Authentication token not available');
}

/**
 * Make authenticated API request
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken();
  const url = `${getApiUrl()}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw parseBattleApiError(data);
  }

  return data;
}

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Battle player information
 */
export interface BattlePlayer {
  userId: string;
  displayName: string;
  joinedAt: string;
}

/**
 * Battle entity returned from API
 */
export interface Battle {
  battleId: string;
  battleKey: string;
  battleName: string;
  matchId: string;
  status: 'waiting' | 'starting' | 'active' | 'completed';
  isPublic: boolean;
  players: {
    host: BattlePlayer;
    opponent?: BattlePlayer;
  };
  createdAt: string;
  settings?: {
    maxPlayers: number;
    minCreatures: number;
    maxCreatures: number;
  };
}

/**
 * Response from creating a battle
 */
export interface CreateBattleResponse {
  success: true;
  battleId: string;
  battleKey: string;
  matchId: string;
  playerId: 'player1' | 'player2';
}

/**
 * Response from joining a battle
 */
export interface JoinBattleResponse {
  success: true;
  battleId: string;
  matchId: string;
  playerId: 'player1' | 'player2';
}

/**
 * Response from quick play
 */
export interface QuickPlayResponse {
  success: true;
  action: 'joined' | 'created';
  battleId: string;
  battleKey: string;
  matchId: string;
  playerId: 'player1' | 'player2';
}

/**
 * Response from getting open battles
 */
export interface BattleListResponse {
  battles: Battle[];
  page: number;
  limit: number;
  total: number;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Create a new battle
 *
 * @param battleName - Name for the battle
 * @param isPublic - Whether battle is public (default: true)
 * @returns Battle creation response with battleKey and matchId
 * @throws InsufficientCreaturesError - User doesn't have enough creatures
 * @throws ActiveBattleExistsError - User already in an active battle
 *
 * @example
 * ```typescript
 * const result = await createBattle('Epic Showdown', true);
 * console.log('Battle Key:', result.battleKey);
 * navigate(`/deployment?matchId=${result.matchId}&playerId=${result.playerId}`);
 * ```
 */
export async function createBattle(
  battleName: string,
  isPublic: boolean = true
): Promise<CreateBattleResponse> {
  return apiRequest<CreateBattleResponse>('/api/battles', {
    method: 'POST',
    body: JSON.stringify({
      battleName,
      isPublic
    })
  });
}

/**
 * Join a battle by its 6-character key
 *
 * @param battleKey - 6-character battle key (uppercase alphanumeric)
 * @returns Join response with matchId and playerId
 * @throws Error - Invalid battle key format
 * @throws BattleNotFoundError - Battle with key doesn't exist
 * @throws BattleAlreadyFilledError - Battle is full or already started
 * @throws CannotJoinOwnBattleError - Trying to join own battle
 * @throws InsufficientCreaturesError - User doesn't have enough creatures
 *
 * @example
 * ```typescript
 * const result = await joinBattleByKey('ABC123');
 * navigate(`/deployment?matchId=${result.matchId}&playerId=${result.playerId}`);
 * ```
 */
export async function joinBattleByKey(
  battleKey: string
): Promise<JoinBattleResponse> {
  // Validate battle key format: 6 uppercase alphanumeric characters
  if (!/^[A-Z0-9]{6}$/.test(battleKey)) {
    throw new Error('Invalid battle key format. Must be 6 uppercase letters/numbers.');
  }

  return apiRequest<JoinBattleResponse>(`/api/battles/${battleKey}/join`, {
    method: 'POST'
  });
}

/**
 * Quick Play - Auto-match with existing battle or create new one
 *
 * @returns Quick play response indicating whether joined or created
 * @throws InsufficientCreaturesError - User doesn't have enough creatures
 * @throws ActiveBattleExistsError - User already in an active battle
 *
 * @example
 * ```typescript
 * const result = await quickPlay();
 * if (result.action === 'joined') {
 *   console.log('Matched with existing battle!');
 * } else {
 *   console.log('Created new battle, waiting for opponent...');
 * }
 * navigate(`/deployment?matchId=${result.matchId}&playerId=${result.playerId}`);
 * ```
 */
export async function quickPlay(): Promise<QuickPlayResponse> {
  return apiRequest<QuickPlayResponse>('/api/battles/quick-play', {
    method: 'POST'
  });
}

/**
 * Get list of open battles
 *
 * @param page - Page number (default: 1)
 * @param limit - Battles per page (default: 10)
 * @returns List of open battles with pagination info
 *
 * @example
 * ```typescript
 * const { battles, total } = await getOpenBattles(1, 20);
 * console.log(`Showing ${battles.length} of ${total} battles`);
 * ```
 */
export async function getOpenBattles(
  page: number = 1,
  limit: number = 10
): Promise<BattleListResponse> {
  return apiRequest<BattleListResponse>(
    `/api/battles/open?page=${page}&limit=${limit}`,
    {
      method: 'GET'
    }
  );
}
