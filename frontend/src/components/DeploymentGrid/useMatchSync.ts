/**
 * useMatchSync Hook
 *
 * Synchronizes deployment state with backend match state.
 * Handles API calls for ready/unready and polls for opponent status.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { MatchDeploymentStatus } from '@drawn-of-war/shared';

// Use relative paths to allow Vite proxy to handle API requests
const API_BASE_URL = '';

export interface UseMatchSyncOptions {
  /** Match ID */
  matchId: string;
  /** Current player ID */
  playerId: 'player1' | 'player2';
  /** Whether to enable polling */
  enablePolling?: boolean;
  /** Polling interval in milliseconds */
  pollingInterval?: number;
}

export interface UseMatchSyncResult {
  /** Deployment status from server */
  deploymentStatus: MatchDeploymentStatus | null;
  /** Whether data is loading */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Mark current player as ready */
  markReady: () => Promise<void>;
  /** Unmark current player as ready */
  markUnready: () => Promise<void>;
  /** Manually refresh status */
  refresh: () => Promise<void>;
}

/**
 * Hook to synchronize match state with backend
 */
export function useMatchSync({
  matchId,
  playerId,
  enablePolling = true,
  pollingInterval = 1000
}: UseMatchSyncOptions): UseMatchSyncResult {
  const [deploymentStatus, setDeploymentStatus] = useState<MatchDeploymentStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Fetch deployment status from server
   */
  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/deployment/${matchId}/status`);

      if (!response.ok) {
        if (response.status === 404) {
          // Match not found - create it
          const createResponse = await fetch(`${API_BASE_URL}/api/deployment/${matchId}/create`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ roundNumber: 1 })
          });

          if (!createResponse.ok) {
            throw new Error('Failed to create match');
          }

          const createData = await createResponse.json();
          setDeploymentStatus(createData.matchState.deploymentStatus);
          setError(null);
          return;
        }

        throw new Error(`Failed to fetch status: ${response.statusText}`);
      }

      const data = await response.json();
      setDeploymentStatus(data.deploymentStatus);
      setError(null);
    } catch (err) {
      console.error('Error fetching deployment status:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [matchId]);

  /**
   * Mark player as ready
   */
  const markReady = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/deployment/${matchId}/${playerId}/ready`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to mark ready: ${response.statusText}`);
      }

      const data = await response.json();
      setDeploymentStatus(data.deploymentStatus);
      setError(null);
    } catch (err) {
      console.error('Error marking ready:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [matchId, playerId]);

  /**
   * Unmark player as ready
   */
  const markUnready = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/deployment/${matchId}/${playerId}/unready`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to unmark ready: ${response.statusText}`);
      }

      const data = await response.json();
      setDeploymentStatus(data.deploymentStatus);
      setError(null);
    } catch (err) {
      console.error('Error unmarking ready:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [matchId, playerId]);

  /**
   * Manually refresh status
   */
  const refresh = useCallback(async () => {
    setIsLoading(true);
    await fetchStatus();
    setIsLoading(false);
  }, [fetchStatus]);

  /**
   * Setup polling
   */
  useEffect(() => {
    // Initial fetch
    fetchStatus();

    // Setup polling if enabled
    if (enablePolling) {
      pollingTimerRef.current = setInterval(() => {
        fetchStatus();
      }, pollingInterval);
    }

    // Cleanup
    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    };
  }, [matchId, enablePolling, pollingInterval, fetchStatus]);

  return {
    deploymentStatus,
    isLoading,
    error,
    markReady,
    markUnready,
    refresh
  };
}
