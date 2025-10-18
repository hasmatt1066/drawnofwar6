/**
 * TASK-COMBAT-VIZ-005: Position Interpolator Tests
 *
 * Test-driven development for interpolating unit positions between state updates.
 * Handles hex coordinate interpolation for smooth 60 FPS rendering from 10 Hz updates.
 */

import { describe, it, expect } from 'vitest';
import { PositionInterpolator, InterpolatedUnitPosition } from '../position-interpolator';
import type { CombatState, CombatCreature } from '@drawn-of-war/shared/types/combat';
import type { AxialCoordinate } from '@drawn-of-war/shared/utils/hex-math/types';

describe('PositionInterpolator', () => {
  const interpolator = new PositionInterpolator();

  const createMockUnit = (
    unitId: string,
    position: AxialCoordinate,
    facingDirection: number = 0
  ): CombatCreature => ({
    unitId,
    creatureId: 'creature-1',
    ownerId: 'player1',
    position,
    health: 100,
    maxHealth: 100,
    status: 'alive',
    facingDirection,
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

  const createMockState = (units: CombatCreature[], tick: number = 0): CombatState => ({
    matchId: 'test-match',
    tick,
    status: 'running',
    units,
    projectiles: [],
    events: [],
    statistics: {
      totalDamageDealt: { player1: 0, player2: 0 },
      totalHealingDone: { player1: 0, player2: 0 },
      unitsLost: { player1: 0, player2: 0 },
      abilitiesUsed: { player1: 0, player2: 0 },
      duration: tick
    },
    startTime: Date.now()
  });

  describe('Linear Position Interpolation', () => {
    it('should interpolate position at factor 0.0 (start position)', () => {
      const previousState = createMockState([
        createMockUnit('unit-1', { q: 0, r: 0 })
      ]);

      const currentState = createMockState([
        createMockUnit('unit-1', { q: 2, r: 0 })
      ]);

      const result = interpolator.interpolatePositions(previousState, currentState, 0.0);

      expect(result).toHaveLength(1);
      expect(result[0].position.q).toBeCloseTo(0, 2);
      expect(result[0].position.r).toBeCloseTo(0, 2);
    });

    it('should interpolate position at factor 1.0 (end position)', () => {
      const previousState = createMockState([
        createMockUnit('unit-1', { q: 0, r: 0 })
      ]);

      const currentState = createMockState([
        createMockUnit('unit-1', { q: 2, r: 0 })
      ]);

      const result = interpolator.interpolatePositions(previousState, currentState, 1.0);

      expect(result).toHaveLength(1);
      expect(result[0].position.q).toBeCloseTo(2, 2);
      expect(result[0].position.r).toBeCloseTo(0, 2);
    });

    it('should interpolate position at factor 0.5 (midpoint)', () => {
      const previousState = createMockState([
        createMockUnit('unit-1', { q: 0, r: 0 })
      ]);

      const currentState = createMockState([
        createMockUnit('unit-1', { q: 4, r: 2 })
      ]);

      const result = interpolator.interpolatePositions(previousState, currentState, 0.5);

      expect(result).toHaveLength(1);
      expect(result[0].position.q).toBeCloseTo(2, 2);
      expect(result[0].position.r).toBeCloseTo(1, 2);
    });

    it('should handle fractional hex coordinates smoothly', () => {
      const previousState = createMockState([
        createMockUnit('unit-1', { q: 1, r: 1 })
      ]);

      const currentState = createMockState([
        createMockUnit('unit-1', { q: 3, r: 3 })
      ]);

      const result = interpolator.interpolatePositions(previousState, currentState, 0.25);

      expect(result[0].position.q).toBeCloseTo(1.5, 2);
      expect(result[0].position.r).toBeCloseTo(1.5, 2);
    });
  });

  describe('Multiple Units', () => {
    it('should interpolate positions for multiple units', () => {
      const previousState = createMockState([
        createMockUnit('unit-1', { q: 0, r: 0 }),
        createMockUnit('unit-2', { q: 5, r: 5 }),
        createMockUnit('unit-3', { q: -2, r: 3 })
      ]);

      const currentState = createMockState([
        createMockUnit('unit-1', { q: 2, r: 0 }),
        createMockUnit('unit-2', { q: 5, r: 7 }),
        createMockUnit('unit-3', { q: 0, r: 3 })
      ]);

      const result = interpolator.interpolatePositions(previousState, currentState, 0.5);

      expect(result).toHaveLength(3);
      expect(result.find(u => u.unitId === 'unit-1')?.position.q).toBeCloseTo(1, 2);
      expect(result.find(u => u.unitId === 'unit-2')?.position.r).toBeCloseTo(6, 2);
      expect(result.find(u => u.unitId === 'unit-3')?.position.q).toBeCloseTo(-1, 2);
    });

    it('should maintain unit order by unitId', () => {
      const previousState = createMockState([
        createMockUnit('unit-a', { q: 0, r: 0 }),
        createMockUnit('unit-b', { q: 1, r: 1 }),
        createMockUnit('unit-c', { q: 2, r: 2 })
      ]);

      const currentState = createMockState([
        createMockUnit('unit-a', { q: 1, r: 0 }),
        createMockUnit('unit-b', { q: 2, r: 1 }),
        createMockUnit('unit-c', { q: 3, r: 2 })
      ]);

      const result = interpolator.interpolatePositions(previousState, currentState, 0.5);

      expect(result[0].unitId).toBe('unit-a');
      expect(result[1].unitId).toBe('unit-b');
      expect(result[2].unitId).toBe('unit-c');
    });
  });

  describe('Unit Spawning and Despawning', () => {
    it('should handle newly spawned units (appear in current but not previous)', () => {
      const previousState = createMockState([
        createMockUnit('unit-1', { q: 0, r: 0 })
      ]);

      const currentState = createMockState([
        createMockUnit('unit-1', { q: 2, r: 0 }),
        createMockUnit('unit-2', { q: 5, r: 5 }) // New unit
      ]);

      const result = interpolator.interpolatePositions(previousState, currentState, 0.5);

      expect(result).toHaveLength(2);
      const newUnit = result.find(u => u.unitId === 'unit-2');
      expect(newUnit).toBeDefined();
      expect(newUnit!.position.q).toBe(5); // Should snap to current position
      expect(newUnit!.position.r).toBe(5);
    });

    it('should handle despawned units (appear in previous but not current)', () => {
      const previousState = createMockState([
        createMockUnit('unit-1', { q: 0, r: 0 }),
        createMockUnit('unit-2', { q: 5, r: 5 })
      ]);

      const currentState = createMockState([
        createMockUnit('unit-1', { q: 2, r: 0 })
        // unit-2 despawned
      ]);

      const result = interpolator.interpolatePositions(previousState, currentState, 0.5);

      expect(result).toHaveLength(1);
      expect(result.find(u => u.unitId === 'unit-2')).toBeUndefined();
    });

    it('should mark spawned units with isNewlySpawned flag', () => {
      const previousState = createMockState([]);
      const currentState = createMockState([
        createMockUnit('unit-1', { q: 0, r: 0 })
      ]);

      const result = interpolator.interpolatePositions(previousState, currentState, 0.5);

      expect(result[0].isNewlySpawned).toBe(true);
    });
  });

  describe('Stationary Units', () => {
    it('should handle units that did not move', () => {
      const previousState = createMockState([
        createMockUnit('unit-1', { q: 3, r: 3 })
      ]);

      const currentState = createMockState([
        createMockUnit('unit-1', { q: 3, r: 3 }) // Same position
      ]);

      const result = interpolator.interpolatePositions(previousState, currentState, 0.5);

      expect(result[0].position.q).toBe(3);
      expect(result[0].position.r).toBe(3);
      expect(result[0].isMoving).toBe(false);
    });

    it('should mark moving units with isMoving flag', () => {
      const previousState = createMockState([
        createMockUnit('unit-1', { q: 0, r: 0 })
      ]);

      const currentState = createMockState([
        createMockUnit('unit-1', { q: 2, r: 0 })
      ]);

      const result = interpolator.interpolatePositions(previousState, currentState, 0.5);

      expect(result[0].isMoving).toBe(true);
    });
  });

  describe('Facing Direction', () => {
    it('should calculate facing direction based on movement vector', () => {
      const previousState = createMockState([
        createMockUnit('unit-1', { q: 0, r: 0 })
      ]);

      const currentState = createMockState([
        createMockUnit('unit-1', { q: 2, r: 0 }) // Moving east
      ]);

      const result = interpolator.interpolatePositions(previousState, currentState, 0.5);

      // East direction should be 0 or 360 degrees
      expect(result[0].facingDirection).toBeCloseTo(0, 0);
    });

    it('should interpolate facing direction smoothly', () => {
      const previousState = createMockState([
        createMockUnit('unit-1', { q: 0, r: 0 }, 0) // Facing east
      ]);

      const currentState = createMockState([
        createMockUnit('unit-1', { q: 0, r: 0 }, 90) // Facing north
      ]);

      const result = interpolator.interpolatePositions(previousState, currentState, 0.5);

      // Should be halfway between 0 and 90
      expect(result[0].facingDirection).toBeCloseTo(45, 1);
    });

    it('should handle 360-degree wraparound in facing direction', () => {
      const previousState = createMockState([
        createMockUnit('unit-1', { q: 0, r: 0 }, 350)
      ]);

      const currentState = createMockState([
        createMockUnit('unit-1', { q: 0, r: 0 }, 10)
      ]);

      const result = interpolator.interpolatePositions(previousState, currentState, 0.5);

      // Should interpolate through 0, not 180
      // Expect 0 or 360 (both valid)
      const direction = result[0].facingDirection;
      expect(direction === 0 || direction === 360).toBe(true);
    });

    it('should maintain facing direction for stationary units', () => {
      const previousState = createMockState([
        createMockUnit('unit-1', { q: 3, r: 3 }, 45)
      ]);

      const currentState = createMockState([
        createMockUnit('unit-1', { q: 3, r: 3 }, 90)
      ]);

      const result = interpolator.interpolatePositions(previousState, currentState, 0.5);

      // Should interpolate facing even when not moving
      expect(result[0].facingDirection).toBeCloseTo(67.5, 1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty states', () => {
      const previousState = createMockState([]);
      const currentState = createMockState([]);

      const result = interpolator.interpolatePositions(previousState, currentState, 0.5);

      expect(result).toHaveLength(0);
    });

    it('should handle interpolation factor outside [0, 1] range', () => {
      const previousState = createMockState([
        createMockUnit('unit-1', { q: 0, r: 0 })
      ]);

      const currentState = createMockState([
        createMockUnit('unit-1', { q: 2, r: 0 })
      ]);

      // Factor > 1 (extrapolation)
      const result1 = interpolator.interpolatePositions(previousState, currentState, 1.5);
      expect(result1[0].position.q).toBeCloseTo(3, 2);

      // Factor < 0 (before start)
      const result2 = interpolator.interpolatePositions(previousState, currentState, -0.5);
      expect(result2[0].position.q).toBeCloseTo(-1, 2);
    });

    it('should handle very large position coordinates', () => {
      const previousState = createMockState([
        createMockUnit('unit-1', { q: 1000, r: 1000 })
      ]);

      const currentState = createMockState([
        createMockUnit('unit-1', { q: 1002, r: 1002 })
      ]);

      const result = interpolator.interpolatePositions(previousState, currentState, 0.5);

      expect(result[0].position.q).toBeCloseTo(1001, 2);
      expect(result[0].position.r).toBeCloseTo(1001, 2);
    });

    it('should handle negative coordinates', () => {
      const previousState = createMockState([
        createMockUnit('unit-1', { q: -5, r: -3 })
      ]);

      const currentState = createMockState([
        createMockUnit('unit-1', { q: -1, r: -1 })
      ]);

      const result = interpolator.interpolatePositions(previousState, currentState, 0.5);

      expect(result[0].position.q).toBeCloseTo(-3, 2);
      expect(result[0].position.r).toBeCloseTo(-2, 2);
    });
  });

  describe('Performance', () => {
    it('should interpolate 100 units efficiently', () => {
      const units = Array.from({ length: 100 }, (_, i) =>
        createMockUnit(`unit-${i}`, { q: i, r: i })
      );

      const previousState = createMockState(units);

      const movedUnits = units.map(u =>
        createMockUnit(u.unitId, { q: u.position.q + 2, r: u.position.r + 2 })
      );
      const currentState = createMockState(movedUnits);

      const startTime = performance.now();
      const result = interpolator.interpolatePositions(previousState, currentState, 0.5);
      const endTime = performance.now();

      expect(result).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(10); // Should take less than 10ms
    });
  });

  describe('Return Type', () => {
    it('should return InterpolatedUnitPosition objects with all required fields', () => {
      const previousState = createMockState([
        createMockUnit('unit-1', { q: 0, r: 0 }, 0)
      ]);

      const currentState = createMockState([
        createMockUnit('unit-1', { q: 2, r: 0 }, 45)
      ]);

      const result = interpolator.interpolatePositions(previousState, currentState, 0.5);

      expect(result[0]).toHaveProperty('unitId');
      expect(result[0]).toHaveProperty('position');
      expect(result[0]).toHaveProperty('facingDirection');
      expect(result[0]).toHaveProperty('isMoving');
      expect(result[0]).toHaveProperty('isNewlySpawned');
    });
  });
});
