/**
 * Tests for MovementController (L4-COMBAT-007)
 *
 * TDD Test Suite - These tests are written BEFORE implementation
 *
 * Note: Phase 2 uses discrete hex-by-hex movement for simplicity.
 * Continuous sub-hex movement can be added in future phases if needed.
 */

import { describe, test, expect } from 'vitest';
import { MovementController } from '../movement-controller';
import type { CombatUnit } from '../../combat-state';

// Helper: Create mock unit
const createUnit = (
  unitId: string,
  q: number,
  r: number,
  movementSpeed: number = 2,
  attackRange: number = 1
): CombatUnit => ({
  unitId,
  creatureId: `creature-${unitId}`,
  ownerId: 'player1',
  position: { q, r },
  health: 100,
  maxHealth: 100,
  status: 'alive',
  currentTarget: null,
  facingDirection: 0,
  attackCooldown: 0,
  stats: {
    movementSpeed,
    attackRange,
    attackDamage: 10,
    armor: 5,
    attackSpeed: 1
  }
});

describe('MovementController (L4-COMBAT-007)', () => {

  /**
   * Test 1: Check if in range
   */
  test('should correctly detect when in range', () => {
    const controller = new MovementController();

    // Distance 1, range 2 - in range
    expect(controller.isInRange({ q: 5, r: 5 }, { q: 6, r: 5 }, 2)).toBe(true);

    // Distance 3, range 2 - out of range
    expect(controller.isInRange({ q: 5, r: 5 }, { q: 8, r: 5 }, 2)).toBe(false);

    // Distance 2, range 2 - exactly in range
    expect(controller.isInRange({ q: 5, r: 5 }, { q: 7, r: 5 }, 2)).toBe(true);
  });

  /**
   * Test 2: Moves toward target position
   */
  test('should move one hex toward target per second at speed 1', () => {
    const unit = createUnit('u1', 0, 0, 1); // Speed 1 hex/sec
    const controller = new MovementController();

    // After 60 ticks (1 second), should move 1 hex
    let position = unit.position;
    for (let i = 0; i < 60; i++) {
      const update = controller.updateMovement(
        { ...unit, position },
        { q: 3, r: 0 },
        12, // grid width
        8,  // grid height
        new Set(),
        1 / 60 // deltaTime
      );
      position = update.newPosition;
    }

    expect(position).toEqual({ q: 1, r: 0 });
  });

  /**
   * Test 3: Stops when in range
   */
  test('should stop moving when in attack range', () => {
    const unit = createUnit('u1', 5, 5, 2, 2); // Attack range 2
    const controller = new MovementController();

    const update = controller.updateMovement(
      unit,
      { q: 6, r: 5 }, // Distance 1, within range 2
      12,
      8,
      new Set(),
      1 / 60
    );

    expect(update.isMoving).toBe(false);
    expect(update.newPosition).toEqual({ q: 5, r: 5 }); // Didn't move
  });

  /**
   * Test 4: Routes around obstacles
   */
  test('should path around obstacles', () => {
    const unit = createUnit('u1', 0, 1, 10); // High speed for faster test
    const controller = new MovementController();

    // Create wall of obstacles
    const obstacles = new Set(['1,0', '1,1', '1,2']);

    // Move toward goal past obstacle
    const update = controller.updateMovement(
      unit,
      { q: 2, r: 1 },
      12,
      8,
      obstacles,
      1 / 60
    );

    // Should find a path around (not blocked)
    expect(update.path).toBeDefined();
    expect(update.path!.length).toBeGreaterThan(0);
  });

  /**
   * Test 5: Updates facing direction
   */
  test('should update facing direction toward movement', () => {
    const unit = createUnit('u1', 5, 5, 2);
    const controller = new MovementController();

    const update = controller.updateMovement(
      unit,
      { q: 8, r: 5 }, // Move right
      12,
      8,
      new Set(),
      1 / 60
    );

    // Facing should be toward the right (0° in flat-top hex)
    expect(update.facingDirection).toBeGreaterThanOrEqual(0);
    expect(update.facingDirection).toBeLessThanOrEqual(60); // East-ish direction
  });

  /**
   * Test 6: No movement when already at goal
   */
  test('should not move when already at goal', () => {
    const unit = createUnit('u1', 5, 5, 2);
    const controller = new MovementController();

    const update = controller.updateMovement(
      unit,
      { q: 5, r: 5 }, // Same position
      12,
      8,
      new Set(),
      1 / 60
    );

    expect(update.isMoving).toBe(false);
    expect(update.newPosition).toEqual({ q: 5, r: 5 });
  });
});
