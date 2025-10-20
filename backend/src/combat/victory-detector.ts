/**
 * VictoryDetector - Determines Victory Conditions
 *
 * Implements L4-COMBAT-003: Detects victory conditions in combat battles.
 *
 * Victory Conditions:
 * 1. Elimination - All units of one side are dead
 * 2. Timeout - Battle reaches max ticks (defender wins)
 * 3. Draw - Both sides' last units die simultaneously
 */

import type { CombatState } from './combat-state';

export interface VictoryResult {
  isGameOver: boolean;
  winner: 'player1' | 'player2' | 'draw' | null;
  reason: 'elimination' | 'timeout' | 'simultaneous_death' | null;
  finalState: CombatState;
}

export class VictoryDetector {
  /**
   * Check if victory condition has been met
   * @param state - Current combat state
   * @param maxTicks - Maximum ticks before timeout (default: 18000 = 5 minutes at 60 ticks/sec)
   */
  checkVictory(state: CombatState, maxTicks: number = 18000): VictoryResult {
    const player1Alive = state.units.filter(u => u.ownerId === 'player1' && u.status === 'alive').length;
    const player2Alive = state.units.filter(u => u.ownerId === 'player2' && u.status === 'alive').length;

    // Check for simultaneous death (draw)
    if (player1Alive === 0 && player2Alive === 0) {
      return {
        isGameOver: true,
        winner: 'draw',
        reason: 'simultaneous_death',
        finalState: {
          ...state,
          status: 'completed',
          winner: 'draw'
        }
      };
    }

    // Check for elimination victory
    if (player1Alive === 0) {
      return {
        isGameOver: true,
        winner: 'player2',
        reason: 'elimination',
        finalState: {
          ...state,
          status: 'completed',
          winner: 'player2'
        }
      };
    }

    if (player2Alive === 0) {
      return {
        isGameOver: true,
        winner: 'player1',
        reason: 'elimination',
        finalState: {
          ...state,
          status: 'completed',
          winner: 'player1'
        }
      };
    }

    // Check for timeout (defender wins)
    if (state.tick >= maxTicks) {
      return {
        isGameOver: true,
        winner: 'player2', // Defender advantage
        reason: 'timeout',
        finalState: {
          ...state,
          status: 'completed',
          winner: 'player2'
        }
      };
    }

    // No victory condition met
    return {
      isGameOver: false,
      winner: null,
      reason: null,
      finalState: {
        ...state,
        winner: null
      }
    };
  }
}
