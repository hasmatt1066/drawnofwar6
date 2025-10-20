/**
 * Tests for CombatSimulator (L4-COMBAT-004)
 *
 * TDD Test Suite - These tests are written BEFORE implementation
 */

import { describe, test, expect } from 'vitest';
import { CombatSimulator } from '../combat-simulator';
import type { Deployment } from '../combat-state';

// Helper: Create mock deployments
const createMockDeployments = (): Deployment[] => [
  {
    playerId: 'player1',
    creature: {
      id: 'c1',
      name: 'Warrior',
      stats: {
        movementSpeed: 0, // No movement for simplicity
        attackRange: 10, // Can hit from anywhere
        attackDamage: 20,
        armor: 5,
        attackSpeed: 1 // 1 attack per second = every 60 ticks
      },
      maxHealth: 100
    },
    hex: { q: 1, r: 2 }
  },
  {
    playerId: 'player2',
    creature: {
      id: 'c2',
      name: 'Knight',
      stats: {
        movementSpeed: 0,
        attackRange: 10,
        attackDamage: 15,
        armor: 3,
        attackSpeed: 1
      },
      maxHealth: 80
    },
    hex: { q: 10, r: 2 }
  }
];

// Helper: Create quick battle (player1 has advantage)
const createQuickBattleDeployments = (): Deployment[] => [
  {
    playerId: 'player1',
    creature: {
      id: 'c1',
      name: 'Strong',
      stats: {
        movementSpeed: 0,
        attackRange: 10,
        attackDamage: 50, // High damage
        armor: 5,
        attackSpeed: 2 // Fast attacks
      },
      maxHealth: 100
    },
    hex: { q: 1, r: 2 }
  },
  {
    playerId: 'player2',
    creature: {
      id: 'c2',
      name: 'Weak',
      stats: {
        movementSpeed: 0,
        attackRange: 10,
        attackDamage: 5, // Low damage
        armor: 0,
        attackSpeed: 0.5 // Slow attacks
      },
      maxHealth: 50
    },
    hex: { q: 10, r: 2 }
  }
];

// Helper: Create stalemate deployments (for timeout test)
const createStalemateDeployments = (): Deployment[] => [
  {
    playerId: 'player1',
    creature: {
      id: 'c1',
      name: 'Tank',
      stats: {
        movementSpeed: 0,
        attackRange: 10,
        attackDamage: 1, // Very low damage
        armor: 50, // High armor
        attackSpeed: 0.1
      },
      maxHealth: 1000
    },
    hex: { q: 1, r: 2 }
  },
  {
    playerId: 'player2',
    creature: {
      id: 'c2',
      name: 'Tank',
      stats: {
        movementSpeed: 0,
        attackRange: 10,
        attackDamage: 1,
        armor: 50,
        attackSpeed: 0.1
      },
      maxHealth: 1000
    },
    hex: { q: 10, r: 2 }
  }
];

describe('CombatSimulator (L4-COMBAT-004)', () => {

  /**
   * Test 1: Runs simulation from start to finish
   */
  test('should run complete simulation loop', async () => {
    const deployments = createMockDeployments();
    const simulator = new CombatSimulator();

    const updates: any[] = [];
    const result = await simulator.runCombat('battle-1', deployments, (state) => {
      updates.push(state);
    });

    expect(result.battleId).toBe('battle-1');
    expect(result.winner).toBeDefined();
    expect(['player1', 'player2', 'draw']).toContain(result.winner);
    expect(result.duration).toBeGreaterThan(0);
    expect(updates.length).toBeGreaterThan(0);
  }, 10000);

  /**
   * Test 2: Stops on victory condition
   */
  test('should stop simulation when victory detected', async () => {
    const deployments = createQuickBattleDeployments();
    const simulator = new CombatSimulator();

    const result = await simulator.runCombat('battle-2', deployments);

    expect(result.winner).toBe('player1'); // Player1 has advantage
    expect(result.reason).toBe('elimination');
    expect(result.duration).toBeLessThan(18000); // Didn't timeout
    expect(result.duration).toBeGreaterThan(0);
  }, 10000);

  /**
   * Test 3: Timeout at max ticks
   */
  test('should timeout at max ticks with small limit', async () => {
    const deployments = createStalemateDeployments();
    const simulator = new CombatSimulator();

    // Use small tick limit for faster test
    const result = await simulator.runCombat('battle-3', deployments, undefined, 100);

    expect(result.reason).toBe('timeout');
    expect(result.duration).toBe(100);
    expect(result.winner).toBe('player2'); // Defender advantage
  }, 10000);

  /**
   * Test 4: Calls onUpdate callback per tick
   */
  test('should call onUpdate for each tick', async () => {
    const deployments = createQuickBattleDeployments();
    const simulator = new CombatSimulator();

    let updateCount = 0;
    await simulator.runCombat('battle-4', deployments, (state) => {
      expect(state.tick).toBe(updateCount);
      updateCount++;
    });

    expect(updateCount).toBeGreaterThan(10); // At least some updates
  }, 10000);

  /**
   * Test 5: Returns complete event log
   */
  test('should return event log in result', async () => {
    const deployments = createMockDeployments();
    const simulator = new CombatSimulator();

    const result = await simulator.runCombat('battle-5', deployments);

    expect(result.eventLog).toBeDefined();
    expect(Array.isArray(result.eventLog)).toBe(true);
    // Event log might be empty in simple Phase 1 implementation
    // Will be populated in Phase 3 when we add damage/death events
  }, 10000);
});
