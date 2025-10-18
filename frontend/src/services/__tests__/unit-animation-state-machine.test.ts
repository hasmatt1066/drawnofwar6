/**
 * TASK-COMBAT-VIZ-007: Unit Animation State Machine Tests
 *
 * Test-driven development for managing unit animation states.
 * Handles transitions between idle, walk, attack, cast, death states.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnitAnimationStateMachine, AnimationState, StateTransition } from '../unit-animation-state-machine';
import type { CombatCreature } from '@drawn-of-war/shared/types/combat';

describe('UnitAnimationStateMachine', () => {
  let stateMachine: UnitAnimationStateMachine;

  const createMockUnit = (
    unitId: string,
    health: number = 100,
    isMoving: boolean = false
  ): CombatCreature => ({
    unitId,
    creatureId: 'creature-1',
    ownerId: 'player1',
    position: { q: 0, r: 0 },
    health,
    maxHealth: 100,
    status: health > 0 ? 'alive' : 'dead',
    facingDirection: 0,
    attackCooldownRemaining: 0,
    stats: {
      movementSpeed: 2,
      attackRange: 1,
      attackDamage: 10,
      armor: 5,
      attackSpeed: 1.0,
      damageType: 'physical',
      archetype: 'tank'
    },
    activeBuffs: [],
    activeDebuffs: [],
    abilities: []
  });

  beforeEach(() => {
    stateMachine = new UnitAnimationStateMachine();
  });

  describe('Initial State', () => {
    it('should start in idle state by default', () => {
      const unit = createMockUnit('unit-1');
      stateMachine.registerUnit(unit);

      const state = stateMachine.getState('unit-1');
      expect(state).toBe(AnimationState.IDLE);
    });

    it('should register multiple units independently', () => {
      const unit1 = createMockUnit('unit-1');
      const unit2 = createMockUnit('unit-2');

      stateMachine.registerUnit(unit1);
      stateMachine.registerUnit(unit2);

      expect(stateMachine.getState('unit-1')).toBe(AnimationState.IDLE);
      expect(stateMachine.getState('unit-2')).toBe(AnimationState.IDLE);
    });
  });

  describe('State Transitions', () => {
    it('should transition from idle to walk when moving', () => {
      const unit = createMockUnit('unit-1');
      stateMachine.registerUnit(unit);

      stateMachine.updateState('unit-1', { isMoving: true });

      expect(stateMachine.getState('unit-1')).toBe(AnimationState.WALK);
    });

    it('should transition from walk to idle when stopped', () => {
      const unit = createMockUnit('unit-1');
      stateMachine.registerUnit(unit);

      stateMachine.updateState('unit-1', { isMoving: true });
      expect(stateMachine.getState('unit-1')).toBe(AnimationState.WALK);

      stateMachine.updateState('unit-1', { isMoving: false });
      expect(stateMachine.getState('unit-1')).toBe(AnimationState.IDLE);
    });

    it('should transition to attack state', () => {
      const unit = createMockUnit('unit-1');
      stateMachine.registerUnit(unit);

      stateMachine.updateState('unit-1', { isAttacking: true });

      expect(stateMachine.getState('unit-1')).toBe(AnimationState.ATTACK);
    });

    it('should transition to cast state for ability use', () => {
      const unit = createMockUnit('unit-1');
      stateMachine.registerUnit(unit);

      stateMachine.updateState('unit-1', { isCasting: true, abilityId: 'fireball' });

      expect(stateMachine.getState('unit-1')).toBe(AnimationState.CAST);
    });

    it('should transition to death state when unit dies', () => {
      const unit = createMockUnit('unit-1', 1);
      stateMachine.registerUnit(unit);

      stateMachine.updateState('unit-1', { health: 0 });

      expect(stateMachine.getState('unit-1')).toBe(AnimationState.DEATH);
    });

    it('should stay in death state once dead', () => {
      const unit = createMockUnit('unit-1');
      stateMachine.registerUnit(unit);

      stateMachine.updateState('unit-1', { health: 0 });
      expect(stateMachine.getState('unit-1')).toBe(AnimationState.DEATH);

      // Try to transition to another state
      stateMachine.updateState('unit-1', { isMoving: true });
      expect(stateMachine.getState('unit-1')).toBe(AnimationState.DEATH);
    });
  });

  describe('State Priority', () => {
    it('should prioritize death over all other states', () => {
      const unit = createMockUnit('unit-1');
      stateMachine.registerUnit(unit);

      stateMachine.updateState('unit-1', {
        health: 0,
        isMoving: true,
        isAttacking: true,
        isCasting: true
      });

      expect(stateMachine.getState('unit-1')).toBe(AnimationState.DEATH);
    });

    it('should prioritize cast over attack', () => {
      const unit = createMockUnit('unit-1');
      stateMachine.registerUnit(unit);

      stateMachine.updateState('unit-1', {
        isCasting: true,
        isAttacking: true
      });

      expect(stateMachine.getState('unit-1')).toBe(AnimationState.CAST);
    });

    it('should prioritize attack over walk', () => {
      const unit = createMockUnit('unit-1');
      stateMachine.registerUnit(unit);

      stateMachine.updateState('unit-1', {
        isAttacking: true,
        isMoving: true
      });

      expect(stateMachine.getState('unit-1')).toBe(AnimationState.ATTACK);
    });

    it('should prioritize walk over idle', () => {
      const unit = createMockUnit('unit-1');
      stateMachine.registerUnit(unit);

      stateMachine.updateState('unit-1', { isMoving: true });

      expect(stateMachine.getState('unit-1')).toBe(AnimationState.WALK);
    });
  });

  describe('State Callbacks', () => {
    it('should trigger callback on state change', () => {
      const callback = vi.fn();
      stateMachine.onStateChange(callback);

      const unit = createMockUnit('unit-1');
      stateMachine.registerUnit(unit);

      stateMachine.updateState('unit-1', { isMoving: true });

      expect(callback).toHaveBeenCalledWith({
        unitId: 'unit-1',
        previousState: AnimationState.IDLE,
        newState: AnimationState.WALK
      });
    });

    it('should not trigger callback when state does not change', () => {
      const callback = vi.fn();
      stateMachine.onStateChange(callback);

      const unit = createMockUnit('unit-1');
      stateMachine.registerUnit(unit);

      stateMachine.updateState('unit-1', { isMoving: false });

      expect(callback).not.toHaveBeenCalled();
    });

    it('should trigger callback for each state change', () => {
      const callback = vi.fn();
      stateMachine.onStateChange(callback);

      const unit = createMockUnit('unit-1');
      stateMachine.registerUnit(unit);

      stateMachine.updateState('unit-1', { isMoving: true });
      stateMachine.updateState('unit-1', { isAttacking: true });
      stateMachine.updateState('unit-1', { isMoving: false, isAttacking: false });

      expect(callback).toHaveBeenCalledTimes(3);
    });

    it('should support multiple callback registrations', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      stateMachine.onStateChange(callback1);
      stateMachine.onStateChange(callback2);

      const unit = createMockUnit('unit-1');
      stateMachine.registerUnit(unit);

      stateMachine.updateState('unit-1', { isMoving: true });

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe('Animation Complete', () => {
    it('should handle attack animation completion', () => {
      const unit = createMockUnit('unit-1');
      stateMachine.registerUnit(unit);

      stateMachine.updateState('unit-1', { isAttacking: true });
      expect(stateMachine.getState('unit-1')).toBe(AnimationState.ATTACK);

      stateMachine.onAnimationComplete('unit-1', AnimationState.ATTACK);
      expect(stateMachine.getState('unit-1')).toBe(AnimationState.IDLE);
    });

    it('should handle cast animation completion', () => {
      const unit = createMockUnit('unit-1');
      stateMachine.registerUnit(unit);

      stateMachine.updateState('unit-1', { isCasting: true });
      expect(stateMachine.getState('unit-1')).toBe(AnimationState.CAST);

      stateMachine.onAnimationComplete('unit-1', AnimationState.CAST);
      expect(stateMachine.getState('unit-1')).toBe(AnimationState.IDLE);
    });

    it('should not change state on walk animation complete (looping)', () => {
      const unit = createMockUnit('unit-1');
      stateMachine.registerUnit(unit);

      stateMachine.updateState('unit-1', { isMoving: true });
      expect(stateMachine.getState('unit-1')).toBe(AnimationState.WALK);

      stateMachine.onAnimationComplete('unit-1', AnimationState.WALK);
      expect(stateMachine.getState('unit-1')).toBe(AnimationState.WALK);
    });

    it('should stay in death state after death animation completes', () => {
      const unit = createMockUnit('unit-1');
      stateMachine.registerUnit(unit);

      stateMachine.updateState('unit-1', { health: 0 });
      expect(stateMachine.getState('unit-1')).toBe(AnimationState.DEATH);

      stateMachine.onAnimationComplete('unit-1', AnimationState.DEATH);
      expect(stateMachine.getState('unit-1')).toBe(AnimationState.DEATH);
    });
  });

  describe('Unit Unregistration', () => {
    it('should unregister unit and clear state', () => {
      const unit = createMockUnit('unit-1');
      stateMachine.registerUnit(unit);

      stateMachine.unregisterUnit('unit-1');

      expect(stateMachine.getState('unit-1')).toBeNull();
    });

    it('should handle unregistering non-existent unit', () => {
      expect(() => {
        stateMachine.unregisterUnit('non-existent');
      }).not.toThrow();
    });
  });

  describe('State Query', () => {
    it('should return null for unregistered unit', () => {
      const state = stateMachine.getState('non-existent');
      expect(state).toBeNull();
    });

    it('should check if unit is in specific state', () => {
      const unit = createMockUnit('unit-1');
      stateMachine.registerUnit(unit);

      stateMachine.updateState('unit-1', { isMoving: true });

      expect(stateMachine.isInState('unit-1', AnimationState.WALK)).toBe(true);
      expect(stateMachine.isInState('unit-1', AnimationState.IDLE)).toBe(false);
    });

    it('should get all units in specific state', () => {
      const unit1 = createMockUnit('unit-1');
      const unit2 = createMockUnit('unit-2');
      const unit3 = createMockUnit('unit-3');

      stateMachine.registerUnit(unit1);
      stateMachine.registerUnit(unit2);
      stateMachine.registerUnit(unit3);

      stateMachine.updateState('unit-1', { isMoving: true });
      stateMachine.updateState('unit-2', { isMoving: true });
      stateMachine.updateState('unit-3', { isAttacking: true });

      const walkingUnits = stateMachine.getUnitsInState(AnimationState.WALK);
      expect(walkingUnits).toHaveLength(2);
      expect(walkingUnits).toContain('unit-1');
      expect(walkingUnits).toContain('unit-2');
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid state changes', () => {
      const unit = createMockUnit('unit-1');
      stateMachine.registerUnit(unit);

      stateMachine.updateState('unit-1', { isMoving: true });
      stateMachine.updateState('unit-1', { isAttacking: true });
      stateMachine.updateState('unit-1', { isCasting: true });
      stateMachine.updateState('unit-1', { isMoving: false, isAttacking: false, isCasting: false });

      expect(stateMachine.getState('unit-1')).toBe(AnimationState.IDLE);
    });

    it('should handle conflicting state updates', () => {
      const unit = createMockUnit('unit-1');
      stateMachine.registerUnit(unit);

      // All flags set - should follow priority
      stateMachine.updateState('unit-1', {
        isMoving: true,
        isAttacking: true,
        isCasting: true
      });

      expect(stateMachine.getState('unit-1')).toBe(AnimationState.CAST);
    });
  });

  describe('Performance', () => {
    it('should handle 100 units efficiently', () => {
      const units = Array.from({ length: 100 }, (_, i) => createMockUnit(`unit-${i}`));

      const startTime = performance.now();

      units.forEach(unit => stateMachine.registerUnit(unit));
      units.forEach((_, i) => {
        stateMachine.updateState(`unit-${i}`, { isMoving: i % 2 === 0 });
      });

      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(10);
      expect(stateMachine.getUnitsInState(AnimationState.WALK)).toHaveLength(50);
      expect(stateMachine.getUnitsInState(AnimationState.IDLE)).toHaveLength(50);
    });
  });
});
