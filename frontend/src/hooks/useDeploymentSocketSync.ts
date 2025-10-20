/**
 * useDeploymentSocketSync Hook
 *
 * React hook for synchronizing deployment state via Socket.IO.
 * Manages connection, events, and state synchronization.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
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

  // Use refs to avoid dependency issues with callbacks
  const callbacksRef = useRef({
    onStateReceived,
    onOpponentPlaced,
    onOpponentRemoved,
    onOpponentUpdated,
    onStatusChanged,
    onError
  });

  // Update refs on every render
  useEffect(() => {
    callbacksRef.current = {
      onStateReceived,
      onOpponentPlaced,
      onOpponentRemoved,
      onOpponentUpdated,
      onStatusChanged,
      onError
    };
  });

  // Connect and setup event listeners
  useEffect(() => {
    if (!enabled) {
      return;
    }

    console.log(`[useDeploymentSocketSync] Connecting to match ${matchId} as ${playerId}`);

    // Connect to socket (async)
    deploymentSocket.connect(matchId, playerId).catch((error) => {
      console.error('[useDeploymentSocketSync] Connection failed:', error);
      setState((prev) => ({ ...prev, error: error.message, isConnected: false }));
    });

    // Handle initial state (only set isConnected true here - after join completes)
    deploymentSocket.onState((data) => {
      console.log('[useDeploymentSocketSync] Received initial state - join completed');
      setState((prev) => ({ ...prev, isConnected: true, error: null }));
      callbacksRef.current.onStateReceived?.(data);
    });

    // Handle opponent placed
    deploymentSocket.onOpponentPlaced((data) => {
      if (data.playerId === opponentPlayerId) {
        console.log('[useDeploymentSocketSync] Opponent placed creature');
        callbacksRef.current.onOpponentPlaced?.(data.placement);
      }
    });

    // Handle opponent removed
    deploymentSocket.onOpponentRemoved((data) => {
      if (data.playerId === opponentPlayerId) {
        console.log('[useDeploymentSocketSync] Opponent removed creature');
        callbacksRef.current.onOpponentRemoved?.(data.creatureId);
      }
    });

    // Handle opponent updated
    deploymentSocket.onOpponentUpdated((data) => {
      if (data.playerId === opponentPlayerId) {
        console.log('[useDeploymentSocketSync] Opponent updated placements');
        callbacksRef.current.onOpponentUpdated?.(data.placements);
      }
    });

    // Handle status changed
    deploymentSocket.onStatusChanged((status) => {
      console.log('[useDeploymentSocketSync] Deployment status changed');
      callbacksRef.current.onStatusChanged?.(status);
    });

    // Handle errors
    deploymentSocket.onError((data) => {
      console.error('[useDeploymentSocketSync] Error:', data.message);
      setState((prev) => ({ ...prev, error: data.message }));
      callbacksRef.current.onError?.(data.message, data.code);
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

    // NOTE: Do NOT set isConnected based on raw socket state here!
    // isConnected should ONLY be set to true when deployment:state is received (line 97)
    // This ensures the socket has fully joined the match before allowing operations

    // Cleanup on unmount - only remove listeners, keep socket alive
    return () => {
      console.log('[useDeploymentSocketSync] Cleaning up listeners');
      deploymentSocket.removeAllListeners();
      // Note: We keep the socket connection alive for reuse
    };
  }, [
    matchId,
    playerId,
    enabled,
    opponentPlayerId
  ]);

  // Emit placement
  const emitPlacement = useCallback((placement: CreaturePlacement) => {
    console.log('[useDeploymentSocketSync] Emitting placement:', {
      creatureName: placement.creature.name,
      hex: placement.hex,
      isSocketConnected: deploymentSocket.isConnected
    });
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
    console.log('[useDeploymentSocketSync] Emitting ready, socket connected:', deploymentSocket.isConnected);
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
