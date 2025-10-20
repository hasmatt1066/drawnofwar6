/**
 * Tests for UnitAIController (L4-COMBAT-008)
 *
 * TDD Test Suite - These tests are written BEFORE implementation
 */

import { describe, test, expect } from 'vitest';
import { UnitAIController } from '../unit-ai-controller';
import type { CombatUnit } from '../../combat-state';

// Helper: Create mock unit
const createUnit = (
  unitId: string,
  ownerId: 'player1' | 'player2',
  q: number,
  r: number,
  status: 'alive' | 'dead' = 'alive',
  currentTarget: string | null = null,
  attackCooldown: number = 0
): CombatUnit => ({
  unitId,
  creatureId: `creature-${unitId}`,
  ownerId,
  position: { q, r },
  health: status === 'alive' ? 100 : 0,
  maxHealth: 100,
  status,
  currentTarget,
  facingDirection: 0,
  attackCooldown,
  stats: {
    movementSpeed: 3,
    attackRange: 1,
    attackDamage: 10,
    armor: 5,
    attackSpeed: 1
  }
});

describe('UnitAIController (L4-COMBAT-008)', () => {

  /**
   * Test 1: Selects target
   */
  test('should select closest enemy as target', () => {
    const unit = createUnit('u1', 'player1', 0, 0, 'alive', null);
    const enemy = createUnit('e1', 'player2', 5, 0, 'alive');

    const aiController = new UnitAIController();
    const update = aiController.updateUnit(
      unit,
      [unit, enemy],
      12,
      8,
      1 / 60
    );

    expect(update.currentTarget).toBe('e1');
    expect(update.shouldAttack).toBe(false); // Not in range yet
  });

  /**
   * Test 2: Attacks when in range
   */
  test('should attack when in range of target', () => {
    const unit = createUnit('u1', 'player1', 5, 5, 'alive', 'e1', 0);
    unit.stats.attackRange = 2;

    const enemy = createUnit('e1', 'player2', 6, 5, 'alive'); // Distance 1, within range 2

    const aiController = new UnitAIController();
    const update = aiController.updateUnit(
      unit,
      [unit, enemy],
      12,
      8,
      1 / 60
    );

    expect(update.isMoving).toBe(false); // Stopped to attack
    expect(update.shouldAttack).toBe(true);
  });

  /**
   * Test 3: Respects attack cooldown
   */
  test('should NOT attack when cooldown active', () => {
    const unit = createUnit('u1', 'player1', 5, 5, 'alive', 'e1', 30);
    unit.stats.attackRange = 2;

    const enemy = createUnit('e1', 'player2', 6, 5, 'alive');

    const aiController = new UnitAIController();
    const update = aiController.updateUnit(
      unit,
      [unit, enemy],
      12,
      8,
      1 / 60
    );

    expect(update.shouldAttack).toBe(false);
  });

  /**
   * Test 4: Switches target when current dies
   */
  test('should switch to new target when current dies', () => {
    const unit = createUnit('u1', 'player1', 5, 5, 'alive', 'e1');
    const deadEnemy = createUnit('e1', 'player2', 6, 5, 'dead');
    const newEnemy = createUnit('e2', 'player2', 7, 5, 'alive');

    const aiController = new UnitAIController();
    const update = aiController.updateUnit(
      unit,
      [unit, deadEnemy, newEnemy],
      12,
      8,
      1 / 60
    );

    expect(update.currentTarget).toBe('e2');
  });

  /**
   * Test 5: Does nothing when no enemies exist
   */
  test('should idle when no enemies exist', () => {
    const unit = createUnit('u1', 'player1', 5, 5, 'alive', null);

    const aiController = new UnitAIController();
    const update = aiController.updateUnit(
      unit,
      [unit],
      12,
      8,
      1 / 60
    );

    expect(update.currentTarget).toBe(null);
    expect(update.isMoving).toBe(false);
    expect(update.shouldAttack).toBe(false);
  });

  /**
   * Test 6: Dead units don't act
   */
  test('should not act when unit is dead', () => {
    const unit = createUnit('u1', 'player1', 5, 5, 'dead', null);
    const enemy = createUnit('e1', 'player2', 6, 5, 'alive');

    const aiController = new UnitAIController();
    const update = aiController.updateUnit(
      unit,
      [unit, enemy],
      12,
      8,
      1 / 60
    );

    expect(update.currentTarget).toBe(null);
    expect(update.isMoving).toBe(false);
    expect(update.shouldAttack).toBe(false);
  });
});
