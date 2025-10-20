/**
 * Tests for VictoryDetector (L4-COMBAT-003)
 *
 * TDD Test Suite - These tests are written BEFORE implementation
 */

import { describe, test, expect } from 'vitest';
import { VictoryDetector } from '../victory-detector';
import type { CombatState } from '../combat-state';

// Helper: Create mock state for testing
const createMockState = (): CombatState => ({
  battleId: 'battle-123',
  tick: 0,
  status: 'running',
  units: [
    {
      unitId: 'unit-1',
      creatureId: 'creature-1',
      ownerId: 'player1',
      position: { q: 1, r: 2 },
      health: 100,
      maxHealth: 100,
      status: 'alive',
      currentTarget: null,
      facingDirection: 0,
      attackCooldown: 0,
      stats: {
        movementSpeed: 2,
        attackRange: 1,
        attackDamage: 10,
        armor: 5,
        attackSpeed: 1
      }
    },
    {
      unitId: 'unit-2',
      creatureId: 'creature-2',
      ownerId: 'player2',
      position: { q: 10, r: 2 },
      health: 100,
      maxHealth: 100,
      status: 'alive',
      currentTarget: null,
      facingDirection: 180,
      attackCooldown: 0,
      stats: {
        movementSpeed: 2,
        attackRange: 1,
        attackDamage: 10,
        armor: 5,
        attackSpeed: 1
      }
    }
  ],
  projectiles: [],
  activeEffects: [],
  events: [],
  winner: null
});

describe('VictoryDetector (L4-COMBAT-003)', () => {

  /**
   * Test 1: Player 1 wins by elimination
   */
  test('should detect player1 victory when all player2 units dead', () => {
    const state = createMockState();
    state.units.forEach(u => {
      if (u.ownerId === 'player2') u.status = 'dead';
    });

    const detector = new VictoryDetector();
    const result = detector.checkVictory(state, 18000);

    expect(result.isGameOver).toBe(true);
    expect(result.winner).toBe('player1');
    expect(result.reason).toBe('elimination');
    expect(result.finalState.winner).toBe('player1');
  });

  /**
   * Test 2: Player 2 wins by elimination
   */
  test('should detect player2 victory when all player1 units dead', () => {
    const state = createMockState();
    state.units.forEach(u => {
      if (u.ownerId === 'player1') u.status = 'dead';
    });

    const detector = new VictoryDetector();
    const result = detector.checkVictory(state, 18000);

    expect(result.isGameOver).toBe(true);
    expect(result.winner).toBe('player2');
    expect(result.reason).toBe('elimination');
    expect(result.finalState.winner).toBe('player2');
  });

  /**
   * Test 3: Timeout - defender (player2) wins
   */
  test('should declare player2 winner on timeout (defender advantage)', () => {
    const state = createMockState();
    state.tick = 18000; // Max ticks reached
    // Both players have units alive

    const detector = new VictoryDetector();
    const result = detector.checkVictory(state, 18000);

    expect(result.isGameOver).toBe(true);
    expect(result.winner).toBe('player2'); // Defender wins
    expect(result.reason).toBe('timeout');
    expect(result.finalState.winner).toBe('player2');
  });

  /**
   * Test 4: Simultaneous death = draw
   */
  test('should declare draw when last units die same tick', () => {
    const state = createMockState();
    // All units dead (simultaneous death)
    state.units.forEach(u => {
      u.status = 'dead';
    });

    const detector = new VictoryDetector();
    const result = detector.checkVictory(state, 18000);

    expect(result.isGameOver).toBe(true);
    expect(result.winner).toBe('draw');
    expect(result.reason).toBe('simultaneous_death');
    expect(result.finalState.winner).toBe('draw');
  });

  /**
   * Test 5: No victory if both sides have units
   */
  test('should return no victory if both sides alive', () => {
    const state = createMockState();
    state.tick = 1000;
    // All units alive

    const detector = new VictoryDetector();
    const result = detector.checkVictory(state, 18000);

    expect(result.isGameOver).toBe(false);
    expect(result.winner).toBe(null);
    expect(result.reason).toBe(null);
    expect(result.finalState.winner).toBe(null);
  });
});
