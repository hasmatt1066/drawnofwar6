/**
 * useDeploymentSocketSync Hook
 *
 * React hook for synchronizing deployment state via Socket.IO.
 * Manages connection, events, and state synchronization.
 */

import { useEffect, useState, useCallback } from 'react';
import type { CreaturePlacement, MatchDeploymentStatus } from '@drawn-of-war/shared';
import { deploymentSocket } from '../services/deployment-socket';

interface UseDeploymentSocketSyncOptions {
  matchId: string;
  playerId: 'player1' | 'player2';
  enabled?: boolean;
  onStateReceived?: (data: {
    player1Placements: CreaturePlacement[];
    player2Placements: CreaturePlacement[];
    deploymentStatus: MatchDeploymentStatus;
  }) => void;
  onOpponentPlaced?: (placement: CreaturePlacement) => void;
  onOpponentRemoved?: (creatureId: string) => void;
  onOpponentUpdated?: (placements: CreaturePlacement[]) => void;
  onStatusChanged?: (status: MatchDeploymentStatus) => void;
  onError?: (message: string, code?: string) => void;
}

interface DeploymentSocketState {
  isConnected: boolean;
  opponentConnected: boolean;
  opponentPlayerId: 'player1' | 'player2' | null;
  error: string | null;
}

export function useDeploymentSocketSync(options: UseDeploymentSocketSyncOptions) {
  const {
    matchId,
    playerId,
    enabled = true,
    onStateReceived,
    onOpponentPlaced,
    onOpponentRemoved,
    onOpponentUpdated,
    onStatusChanged,
    onError
  } = options;

  const [state, setState] = useState<DeploymentSocketState>({
    isConnected: false,
    opponentConnected: false,
    opponentPlayerId: null,
    error: null
  });

  // Determine opponent player ID
  const opponentPlayerId = playerId === 'player1' ? 'player2' : 'player1';

  // Connect and setup event listeners
  useEffect(() => {
    if (!enabled) {
      return;
    }

    console.log(`[useDeploymentSocketSync] Connecting to match ${matchId} as ${playerId}`);

    // Connect to socket
    deploymentSocket.connect(matchId, playerId);

    // Handle initial state
    deploymentSocket.onState((data) => {
      console.log('[useDeploymentSocketSync] Received initial state');
      setState((prev) => ({ ...prev, isConnected: true }));
      onStateReceived?.(data);
    });

    // Handle opponent placed
    deploymentSocket.onOpponentPlaced((data) => {
      if (data.playerId === opponentPlayerId) {
        console.log('[useDeploymentSocketSync] Opponent placed creature');
        onOpponentPlaced?.(data.placement);
      }
    });

    // Handle opponent removed
    deploymentSocket.onOpponentRemoved((data) => {
      if (data.playerId === opponentPlayerId) {
        console.log('[useDeploymentSocketSync] Opponent removed creature');
        onOpponentRemoved?.(data.creatureId);
      }
    });

    // Handle opponent updated
    deploymentSocket.onOpponentUpdated((data) => {
      if (data.playerId === opponentPlayerId) {
        console.log('[useDeploymentSocketSync] Opponent updated placements');
        onOpponentUpdated?.(data.placements);
      }
    });

    // Handle status changed
    deploymentSocket.onStatusChanged((status) => {
      console.log('[useDeploymentSocketSync] Deployment status changed');
      onStatusChanged?.(status);
    });

    // Handle errors
    deploymentSocket.onError((data) => {
      console.error('[useDeploymentSocketSync] Error:', data.message);
      setState((prev) => ({ ...prev, error: data.message }));
      onError?.(data.message, data.code);
    });

    // Handle opponent connected
    deploymentSocket.onOpponentConnected((data) => {
      if (data.playerId === opponentPlayerId) {
        console.log('[useDeploymentSocketSync] Opponent connected');
        setState((prev) => ({
          ...prev,
          opponentConnected: true,
          opponentPlayerId: data.playerId
        }));
      }
    });

    // Handle opponent disconnected
    deploymentSocket.onOpponentDisconnected((data) => {
      if (data.playerId === opponentPlayerId) {
        console.log('[useDeploymentSocketSync] Opponent disconnected');
        setState((prev) => ({
          ...prev,
          opponentConnected: false
        }));
      }
    });

    // Update connection state
    setState((prev) => ({
      ...prev,
      isConnected: deploymentSocket.isConnected
    }));

    // Cleanup on unmount
    return () => {
      console.log('[useDeploymentSocketSync] Cleaning up');
      deploymentSocket.removeAllListeners();
      deploymentSocket.disconnect();
      setState({
        isConnected: false,
        opponentConnected: false,
        opponentPlayerId: null,
        error: null
      });
    };
  }, [
    matchId,
    playerId,
    enabled,
    opponentPlayerId,
    onStateReceived,
    onOpponentPlaced,
    onOpponentRemoved,
    onOpponentUpdated,
    onStatusChanged,
    onError
  ]);

  // Emit placement
  const emitPlacement = useCallback((placement: CreaturePlacement) => {
    deploymentSocket.placeCreature(placement);
  }, []);

  // Emit removal
  const emitRemoval = useCallback((creatureId: string) => {
    deploymentSocket.removeCreature(creatureId);
  }, []);

  // Emit bulk update
  const emitUpdate = useCallback((placements: CreaturePlacement[]) => {
    deploymentSocket.updatePlacements(placements);
  }, []);

  // Emit ready
  const emitReady = useCallback(() => {
    deploymentSocket.markReady();
  }, []);

  // Emit unready
  const emitUnready = useCallback(() => {
    deploymentSocket.markUnready();
  }, []);

  return {
    ...state,
    emitPlacement,
    emitRemoval,
    emitUpdate,
    emitReady,
    emitUnready
  };
}
