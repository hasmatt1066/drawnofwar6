/**
 * Tests for TargetSelector (L4-COMBAT-005)
 *
 * TDD Test Suite - These tests are written BEFORE implementation
 */

import { describe, test, expect } from 'vitest';
import { TargetSelector } from '../target-selector';
import type { CombatUnit } from '../../combat-state';

// Helper: Create mock unit
const createUnit = (
  unitId: string,
  ownerId: 'player1' | 'player2',
  q: number,
  r: number,
  status: 'alive' | 'dead' = 'alive'
): CombatUnit => ({
  unitId,
  creatureId: `creature-${unitId}`,
  ownerId,
  position: { q, r },
  health: status === 'alive' ? 100 : 0,
  maxHealth: 100,
  status,
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
});

describe('TargetSelector (L4-COMBAT-005)', () => {

  /**
   * Test 1: Finds closest enemy by hex distance
   */
  test('should select closest enemy by hex distance', () => {
    const unit = createUnit('u1', 'player1', 5, 5);
    const enemies = [
      createUnit('e1', 'player2', 8, 5), // distance 3
      createUnit('e2', 'player2', 6, 5), // distance 1 (closest)
      createUnit('e3', 'player2', 10, 5) // distance 5
    ];

    const selector = new TargetSelector();
    const target = selector.findClosestEnemy(unit, [unit, ...enemies]);

    expect(target?.unitId).toBe('e2'); // Closest at distance 1
  });

  /**
   * Test 2: Ignores dead enemies
   */
  test('should ignore dead enemies', () => {
    const unit = createUnit('u1', 'player1', 5, 5);
    const enemies = [
      createUnit('e1', 'player2', 6, 5, 'dead'), // Closest but dead
      createUnit('e2', 'player2', 8, 5, 'alive') // Farther but alive
    ];

    const selector = new TargetSelector();
    const target = selector.findClosestEnemy(unit, [unit, ...enemies]);

    expect(target?.unitId).toBe('e2');
  });

  /**
   * Test 3: Returns null if no enemies alive
   */
  test('should return null when no enemies exist', () => {
    const unit = createUnit('u1', 'player1', 5, 5);
    const allies = [
      createUnit('a1', 'player1', 4, 5)
    ];

    const selector = new TargetSelector();
    const target = selector.findClosestEnemy(unit, [unit, ...allies]);

    expect(target).toBe(null);
  });

  /**
   * Test 4: Switches target when current dies
   */
  test('should switch target when current target dies', () => {
    const unit = createUnit('u1', 'player1', 5, 5);
    const currentTarget = createUnit('e1', 'player2', 6, 5, 'dead');
    const enemies = [
      currentTarget,
      createUnit('e2', 'player2', 8, 5, 'alive')
    ];

    const selector = new TargetSelector();
    const shouldSwitch = selector.shouldSwitchTarget(unit, currentTarget, [unit, ...enemies]);

    expect(shouldSwitch).toBe(true);
  });

  /**
   * Test 5: Maintains target if closer enemy appears
   */
  test('should NOT switch to closer enemy (maintain focus)', () => {
    const unit = createUnit('u1', 'player1', 5, 5);
    const currentTarget = createUnit('e1', 'player2', 8, 5, 'alive');
    const newEnemy = createUnit('e2', 'player2', 6, 5, 'alive'); // Closer but should maintain e1

    const selector = new TargetSelector();
    const shouldSwitch = selector.shouldSwitchTarget(unit, currentTarget, [unit, currentTarget, newEnemy]);

    expect(shouldSwitch).toBe(false); // Maintain current target
  });

  /**
   * Test 6: Should switch if current target is null
   */
  test('should switch when current target is null', () => {
    const unit = createUnit('u1', 'player1', 5, 5);
    const enemies = [
      createUnit('e1', 'player2', 6, 5, 'alive')
    ];

    const selector = new TargetSelector();
    const shouldSwitch = selector.shouldSwitchTarget(unit, null, [unit, ...enemies]);

    expect(shouldSwitch).toBe(true);
  });
});
