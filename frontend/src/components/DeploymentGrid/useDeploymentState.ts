/**
 * useDeploymentState Hook
 *
 * React hook for managing deployment state including creature placement,
 * validation, and drag-and-drop operations.
 */

import { useState, useCallback } from 'react';
import type {
  DeploymentState,
  PlayerDeploymentState,
  DeploymentCreature,
  PlacementValidation,
  DragState
} from '@drawn-of-war/shared';
import type { AxialCoordinate } from '@drawn-of-war/shared';

// Import constants
const DEPLOYMENT_ZONES_DATA = [
  { playerId: 'player1' as const, minColumn: 0, maxColumn: 2, color: 0x3498db },
  { playerId: 'player2' as const, minColumn: 9, maxColumn: 11, color: 0xe74c3c }
];

const MAX_CREATURES = 8;

export interface UseDeploymentStateResult {
  // State
  deploymentState: DeploymentState;
  dragState: DragState;

  // Placement operations
  placeCreature: (creature: DeploymentCreature, hex: AxialCoordinate) => boolean;
  removeCreature: (creatureId: string) => boolean;
  moveCreature: (creatureId: string, toHex: AxialCoordinate) => boolean;

  // Validation
  validatePlacement: (hex: AxialCoordinate, creature: DeploymentCreature, playerId: 'player1' | 'player2') => PlacementValidation;
  isHexOccupied: (hex: AxialCoordinate) => boolean;
  getCreatureAtHex: (hex: AxialCoordinate) => DeploymentCreature | null;

  // Drag operations
  startDrag: (creature: DeploymentCreature, sourceHex?: AxialCoordinate) => void;
  updateDrag: (targetHex: AxialCoordinate | null) => void;
  endDrag: (dropHex: AxialCoordinate | null) => boolean;
  cancelDrag: () => void;

  // Utility
  clearAllPlacements: (playerId?: 'player1' | 'player2') => void;
  getPlacementCount: (playerId: 'player1' | 'player2') => number;
  isDeploymentComplete: (playerId: 'player1' | 'player2') => boolean;

  // Ready/Lock operations
  markReady: (playerId: 'player1' | 'player2') => void;
  markUnready: (playerId: 'player1' | 'player2') => void;
  isPlayerReady: (playerId: 'player1' | 'player2') => boolean;
  canMarkReady: (playerId: 'player1' | 'player2') => boolean;
}

/**
 * Create initial player deployment state
 */
function createInitialPlayerState(playerId: 'player1' | 'player2', roster: DeploymentCreature[]): PlayerDeploymentState {
  return {
    playerId,
    roster,
    placements: [],
    maxCreatures: MAX_CREATURES,
    isLocked: false,
    isReady: false,
    readyAt: null
  };
}

/**
 * Hook for managing deployment state
 */
export function useDeploymentState(
  player1Roster: DeploymentCreature[],
  player2Roster: DeploymentCreature[],
  currentPlayer: 'player1' | 'player2' = 'player1'
): UseDeploymentStateResult {
  // Deployment state
  const [deploymentState, setDeploymentState] = useState<DeploymentState>({
    player1: createInitialPlayerState('player1', player1Roster),
    player2: createInitialPlayerState('player2', player2Roster),
    currentPlayer,
    countdownSeconds: null,
    countdownStartedAt: null,
    isComplete: false
  });

  // Drag state
  const [dragState, setDragState] = useState<DragState>({
    creature: null,
    sourceHex: null,
    phase: 'idle',
    targetHex: null,
    isValid: false
  });

  /**
   * Validate placement of a creature on a hex
   */
  const validatePlacement = useCallback((
    hex: AxialCoordinate,
    creature: DeploymentCreature,
    playerId: 'player1' | 'player2'
  ): PlacementValidation => {
    const playerState = deploymentState[playerId];

    // Check if deployment is locked
    if (playerState.isLocked) {
      return {
        valid: false,
        reason: 'locked',
        message: 'Deployment is locked. Cannot place creatures.'
      };
    }

    // Check if at max creatures (only if placing new, not moving)
    const existingPlacement = playerState.placements.find(p => p.creature.id === creature.id);
    if (!existingPlacement && playerState.placements.length >= MAX_CREATURES) {
      return {
        valid: false,
        reason: 'max_creatures',
        message: `Maximum ${MAX_CREATURES} creatures allowed.`
      };
    }

    // Check if hex is in player's deployment zone
    const zone = DEPLOYMENT_ZONES_DATA.find(z => z.playerId === playerId);
    if (!zone || hex.q < zone.minColumn || hex.q > zone.maxColumn) {
      return {
        valid: false,
        reason: 'out_of_zone',
        message: 'Hex is outside your deployment zone.'
      };
    }

    // Check if hex is already occupied (by a different creature)
    const occupiedBy = [...deploymentState.player1.placements, ...deploymentState.player2.placements]
      .find(p => p.hex.q === hex.q && p.hex.r === hex.r);

    if (occupiedBy && occupiedBy.creature.id !== creature.id) {
      return {
        valid: false,
        reason: 'occupied',
        message: 'Hex is already occupied.'
      };
    }

    return { valid: true };
  }, [deploymentState]);

  /**
   * Check if a hex is occupied
   */
  const isHexOccupied = useCallback((hex: AxialCoordinate): boolean => {
    return [...deploymentState.player1.placements, ...deploymentState.player2.placements]
      .some(p => p.hex.q === hex.q && p.hex.r === hex.r);
  }, [deploymentState]);

  /**
   * Get creature at a specific hex
   */
  const getCreatureAtHex = useCallback((hex: AxialCoordinate): DeploymentCreature | null => {
    const placement = [...deploymentState.player1.placements, ...deploymentState.player2.placements]
      .find(p => p.hex.q === hex.q && p.hex.r === hex.r);
    return placement ? placement.creature : null;
  }, [deploymentState]);

  /**
   * Place a creature on the grid
   */
  const placeCreature = useCallback((creature: DeploymentCreature, hex: AxialCoordinate): boolean => {
    const validation = validatePlacement(hex, creature, creature.playerId);
    if (!validation.valid) {
      console.warn('Invalid placement:', validation.message);
      return false;
    }

    setDeploymentState(prev => {
      const playerState = prev[creature.playerId];

      // Remove existing placement if moving
      const placements = playerState.placements.filter(p => p.creature.id !== creature.id);

      // Add new placement
      placements.push({ creature, hex });

      return {
        ...prev,
        [creature.playerId]: {
          ...playerState,
          placements
        }
      };
    });

    return true;
  }, [validatePlacement]);

  /**
   * Remove a creature from the grid
   */
  const removeCreature = useCallback((creatureId: string): boolean => {
    setDeploymentState(prev => {
      // Find which player owns the creature
      let updated = false;
      const newState = { ...prev };

      for (const playerId of ['player1', 'player2'] as const) {
        const playerState = newState[playerId];
        const placements = playerState.placements.filter(p => {
          if (p.creature.id === creatureId) {
            updated = true;
            return false;
          }
          return true;
        });

        if (placements.length !== playerState.placements.length) {
          newState[playerId] = { ...playerState, placements };
        }
      }

      return updated ? newState : prev;
    });

    return true;
  }, []);

  /**
   * Move a creature to a new hex
   */
  const moveCreature = useCallback((creatureId: string, toHex: AxialCoordinate): boolean => {
    // Find the creature
    let creature: DeploymentCreature | null = null;
    for (const playerId of ['player1', 'player2'] as const) {
      const placement = deploymentState[playerId].placements.find(p => p.creature.id === creatureId);
      if (placement) {
        creature = placement.creature;
        break;
      }
    }

    if (!creature) {
      return false;
    }

    return placeCreature(creature, toHex);
  }, [deploymentState, placeCreature]);

  /**
   * Start dragging a creature
   */
  const startDrag = useCallback((creature: DeploymentCreature, sourceHex?: AxialCoordinate) => {
    setDragState({
      creature,
      sourceHex: sourceHex || null,
      phase: 'dragging',
      targetHex: null,
      isValid: false
    });
  }, []);

  /**
   * Update drag state with new target hex
   */
  const updateDrag = useCallback((targetHex: AxialCoordinate | null) => {
    setDragState(prev => {
      if (prev.phase !== 'dragging' || !prev.creature) {
        return prev;
      }

      const isValid = targetHex
        ? validatePlacement(targetHex, prev.creature, prev.creature.playerId).valid
        : false;

      return {
        ...prev,
        targetHex,
        isValid
      };
    });
  }, [validatePlacement]);

  /**
   * End drag operation and place creature if valid
   */
  const endDrag = useCallback((dropHex: AxialCoordinate | null): boolean => {
    if (dragState.phase !== 'dragging' || !dragState.creature) {
      return false;
    }

    let success = false;

    if (dropHex && dragState.isValid) {
      // Valid drop - place creature
      success = placeCreature(dragState.creature, dropHex);
    } else if (dragState.sourceHex) {
      // Invalid drop but was repositioning - return to source
      placeCreature(dragState.creature, dragState.sourceHex);
    }

    // Reset drag state
    setDragState({
      creature: null,
      sourceHex: null,
      phase: 'idle',
      targetHex: null,
      isValid: false
    });

    return success;
  }, [dragState, placeCreature]);

  /**
   * Cancel drag operation
   */
  const cancelDrag = useCallback(() => {
    if (dragState.sourceHex && dragState.creature) {
      // Return to source if repositioning
      placeCreature(dragState.creature, dragState.sourceHex);
    }

    setDragState({
      creature: null,
      sourceHex: null,
      phase: 'idle',
      targetHex: null,
      isValid: false
    });
  }, [dragState, placeCreature]);

  /**
   * Clear all placements for a player (or both)
   */
  const clearAllPlacements = useCallback((playerId?: 'player1' | 'player2') => {
    setDeploymentState(prev => {
      if (playerId) {
        return {
          ...prev,
          [playerId]: {
            ...prev[playerId],
            placements: []
          }
        };
      } else {
        return {
          ...prev,
          player1: { ...prev.player1, placements: [] },
          player2: { ...prev.player2, placements: [] }
        };
      }
    });
  }, []);

  /**
   * Get placement count for a player
   */
  const getPlacementCount = useCallback((playerId: 'player1' | 'player2'): number => {
    return deploymentState[playerId].placements.length;
  }, [deploymentState]);

  /**
   * Check if deployment is complete for a player
   */
  const isDeploymentComplete = useCallback((playerId: 'player1' | 'player2'): boolean => {
    return deploymentState[playerId].placements.length === MAX_CREATURES;
  }, [deploymentState]);

  /**
   * Mark player as ready
   */
  const markReady = useCallback((playerId: 'player1' | 'player2') => {
    setDeploymentState(prev => {
      const playerState = prev[playerId];

      // Can't ready if locked
      if (playerState.isLocked) {
        return prev;
      }

      // Can't ready if no creatures placed
      if (playerState.placements.length === 0) {
        return prev;
      }

      const now = new Date();

      return {
        ...prev,
        [playerId]: {
          ...playerState,
          isReady: true,
          readyAt: now
        }
      };
    });
  }, []);

  /**
   * Unmark player as ready
   */
  const markUnready = useCallback((playerId: 'player1' | 'player2') => {
    setDeploymentState(prev => {
      const playerState = prev[playerId];

      // Can't unready if locked
      if (playerState.isLocked) {
        return prev;
      }

      return {
        ...prev,
        [playerId]: {
          ...playerState,
          isReady: false,
          readyAt: null
        }
      };
    });
  }, []);

  /**
   * Check if player is ready
   */
  const isPlayerReady = useCallback((playerId: 'player1' | 'player2'): boolean => {
    return deploymentState[playerId].isReady;
  }, [deploymentState]);

  /**
   * Check if player can mark ready
   */
  const canMarkReady = useCallback((playerId: 'player1' | 'player2'): boolean => {
    const playerState = deploymentState[playerId];
    return !playerState.isLocked && playerState.placements.length >= 1;
  }, [deploymentState]);

  return {
    deploymentState,
    dragState,
    placeCreature,
    removeCreature,
    moveCreature,
    validatePlacement,
    isHexOccupied,
    getCreatureAtHex,
    startDrag,
    updateDrag,
    endDrag,
    cancelDrag,
    clearAllPlacements,
    getPlacementCount,
    isDeploymentComplete,
    markReady,
    markUnready,
    isPlayerReady,
    canMarkReady
  };
}
