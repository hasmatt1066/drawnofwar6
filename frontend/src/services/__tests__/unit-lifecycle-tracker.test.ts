/**
 * TASK-COMBAT-VIZ-006: Unit Lifecycle Tracker Tests
 *
 * Test-driven development for tracking unit spawning and despawning.
 * Detects unit additions/removals between combat states for rendering updates.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnitLifecycleTracker, UnitSpawnEvent, UnitDespawnEvent } from '../unit-lifecycle-tracker';
import type { CombatState, CombatCreature } from '@drawn-of-war/shared/types/combat';

describe('UnitLifecycleTracker', () => {
  let tracker: UnitLifecycleTracker;

  const createMockUnit = (unitId: string, health: number = 100): CombatCreature => ({
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

  beforeEach(() => {
    tracker = new UnitLifecycleTracker();
  });

  describe('Initial State', () => {
    it('should initialize with empty state', () => {
      const spawned = tracker.getSpawnedUnits();
      const despawned = tracker.getDespawnedUnits();

      expect(spawned).toHaveLength(0);
      expect(despawned).toHaveLength(0);
    });

    it('should accept initial state without detecting spawns', () => {
      const initialState = createMockState([
        createMockUnit('unit-1'),
        createMockUnit('unit-2')
      ]);

      tracker.updateState(initialState);

      const spawned = tracker.getSpawnedUnits();
      expect(spawned).toHaveLength(0); // No spawns on first state
    });
  });

  describe('Unit Spawning Detection', () => {
    it('should detect single unit spawn', () => {
      const state1 = createMockState([
        createMockUnit('unit-1')
      ]);

      const state2 = createMockState([
        createMockUnit('unit-1'),
        createMockUnit('unit-2') // New unit
      ]);

      tracker.updateState(state1);
      tracker.updateState(state2);

      const spawned = tracker.getSpawnedUnits();
      expect(spawned).toHaveLength(1);
      expect(spawned[0].unitId).toBe('unit-2');
    });

    it('should detect multiple unit spawns', () => {
      const state1 = createMockState([
        createMockUnit('unit-1')
      ]);

      const state2 = createMockState([
        createMockUnit('unit-1'),
        createMockUnit('unit-2'),
        createMockUnit('unit-3'),
        createMockUnit('unit-4')
      ]);

      tracker.updateState(state1);
      tracker.updateState(state2);

      const spawned = tracker.getSpawnedUnits();
      expect(spawned).toHaveLength(3);
      expect(spawned.map(u => u.unitId)).toEqual(['unit-2', 'unit-3', 'unit-4']);
    });

    it('should clear spawn list on next update', () => {
      const state1 = createMockState([createMockUnit('unit-1')]);
      const state2 = createMockState([createMockUnit('unit-1'), createMockUnit('unit-2')]);
      const state3 = createMockState([createMockUnit('unit-1'), createMockUnit('unit-2')]);

      tracker.updateState(state1);
      tracker.updateState(state2);

      expect(tracker.getSpawnedUnits()).toHaveLength(1);

      tracker.updateState(state3);

      expect(tracker.getSpawnedUnits()).toHaveLength(0); // Cleared
    });
  });

  describe('Unit Despawning Detection', () => {
    it('should detect single unit despawn', () => {
      const state1 = createMockState([
        createMockUnit('unit-1'),
        createMockUnit('unit-2')
      ]);

      const state2 = createMockState([
        createMockUnit('unit-1')
        // unit-2 removed
      ]);

      tracker.updateState(state1);
      tracker.updateState(state2);

      const despawned = tracker.getDespawnedUnits();
      expect(despawned).toHaveLength(1);
      expect(despawned[0].unitId).toBe('unit-2');
    });

    it('should detect multiple unit despawns', () => {
      const state1 = createMockState([
        createMockUnit('unit-1'),
        createMockUnit('unit-2'),
        createMockUnit('unit-3'),
        createMockUnit('unit-4')
      ]);

      const state2 = createMockState([
        createMockUnit('unit-1')
      ]);

      tracker.updateState(state1);
      tracker.updateState(state2);

      const despawned = tracker.getDespawnedUnits();
      expect(despawned).toHaveLength(3);
      expect(despawned.map(u => u.unitId).sort()).toEqual(['unit-2', 'unit-3', 'unit-4']);
    });

    it('should clear despawn list on next update', () => {
      const state1 = createMockState([createMockUnit('unit-1'), createMockUnit('unit-2')]);
      const state2 = createMockState([createMockUnit('unit-1')]);
      const state3 = createMockState([createMockUnit('unit-1')]);

      tracker.updateState(state1);
      tracker.updateState(state2);

      expect(tracker.getDespawnedUnits()).toHaveLength(1);

      tracker.updateState(state3);

      expect(tracker.getDespawnedUnits()).toHaveLength(0); // Cleared
    });
  });

  describe('Simultaneous Spawn and Despawn', () => {
    it('should detect both spawns and despawns in same update', () => {
      const state1 = createMockState([
        createMockUnit('unit-1'),
        createMockUnit('unit-2')
      ]);

      const state2 = createMockState([
        createMockUnit('unit-1'),
        createMockUnit('unit-3') // unit-2 removed, unit-3 added
      ]);

      tracker.updateState(state1);
      tracker.updateState(state2);

      const spawned = tracker.getSpawnedUnits();
      const despawned = tracker.getDespawnedUnits();

      expect(spawned).toHaveLength(1);
      expect(spawned[0].unitId).toBe('unit-3');
      expect(despawned).toHaveLength(1);
      expect(despawned[0].unitId).toBe('unit-2');
    });
  });

  describe('Callbacks', () => {
    it('should trigger onUnitSpawned callback', () => {
      const callback = vi.fn();
      tracker.onUnitSpawned(callback);

      const state1 = createMockState([createMockUnit('unit-1')]);
      const state2 = createMockState([createMockUnit('unit-1'), createMockUnit('unit-2')]);

      tracker.updateState(state1);
      tracker.updateState(state2);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ unitId: 'unit-2' })
      );
    });

    it('should trigger onUnitDespawned callback', () => {
      const callback = vi.fn();
      tracker.onUnitDespawned(callback);

      const state1 = createMockState([createMockUnit('unit-1'), createMockUnit('unit-2')]);
      const state2 = createMockState([createMockUnit('unit-1')]);

      tracker.updateState(state1);
      tracker.updateState(state2);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ unitId: 'unit-2' })
      );
    });

    it('should trigger multiple callbacks for multiple spawns', () => {
      const callback = vi.fn();
      tracker.onUnitSpawned(callback);

      const state1 = createMockState([createMockUnit('unit-1')]);
      const state2 = createMockState([
        createMockUnit('unit-1'),
        createMockUnit('unit-2'),
        createMockUnit('unit-3')
      ]);

      tracker.updateState(state1);
      tracker.updateState(state2);

      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('should support multiple callback registrations', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      tracker.onUnitSpawned(callback1);
      tracker.onUnitSpawned(callback2);

      const state1 = createMockState([createMockUnit('unit-1')]);
      const state2 = createMockState([createMockUnit('unit-1'), createMockUnit('unit-2')]);

      tracker.updateState(state1);
      tracker.updateState(state2);

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe('Event Data', () => {
    it('should provide full unit data in spawn event', () => {
      const callback = vi.fn();
      tracker.onUnitSpawned(callback);

      const state1 = createMockState([]);
      const state2 = createMockState([createMockUnit('unit-1', 100)]);

      tracker.updateState(state1);
      tracker.updateState(state2);

      const event: UnitSpawnEvent = callback.mock.calls[0][0];
      expect(event.unitId).toBe('unit-1');
      expect(event.unit).toBeDefined();
      expect(event.unit.health).toBe(100);
      expect(event.unit.creatureId).toBe('creature-1');
    });

    it('should provide full unit data in despawn event', () => {
      const callback = vi.fn();
      tracker.onUnitDespawned(callback);

      const state1 = createMockState([createMockUnit('unit-1', 50)]);
      const state2 = createMockState([]);

      tracker.updateState(state1);
      tracker.updateState(state2);

      const event: UnitDespawnEvent = callback.mock.calls[0][0];
      expect(event.unitId).toBe('unit-1');
      expect(event.unit).toBeDefined();
      expect(event.unit.health).toBe(50);
    });

    it('should include tick in spawn event', () => {
      const callback = vi.fn();
      tracker.onUnitSpawned(callback);

      const state1 = createMockState([], 100);
      const state2 = createMockState([createMockUnit('unit-1')], 120);

      tracker.updateState(state1);
      tracker.updateState(state2);

      const event: UnitSpawnEvent = callback.mock.calls[0][0];
      expect(event.tick).toBe(120);
    });

    it('should include tick in despawn event', () => {
      const callback = vi.fn();
      tracker.onUnitDespawned(callback);

      const state1 = createMockState([createMockUnit('unit-1')], 100);
      const state2 = createMockState([], 120);

      tracker.updateState(state1);
      tracker.updateState(state2);

      const event: UnitDespawnEvent = callback.mock.calls[0][0];
      expect(event.tick).toBe(120);
    });
  });

  describe('Active Units Tracking', () => {
    it('should track currently active units', () => {
      const state = createMockState([
        createMockUnit('unit-1'),
        createMockUnit('unit-2'),
        createMockUnit('unit-3')
      ]);

      tracker.updateState(state);

      const activeUnits = tracker.getActiveUnits();
      expect(activeUnits).toHaveLength(3);
      expect(activeUnits.map(u => u.unitId).sort()).toEqual(['unit-1', 'unit-2', 'unit-3']);
    });

    it('should update active units after state change', () => {
      const state1 = createMockState([createMockUnit('unit-1'), createMockUnit('unit-2')]);
      const state2 = createMockState([createMockUnit('unit-1'), createMockUnit('unit-3')]);

      tracker.updateState(state1);
      expect(tracker.getActiveUnits()).toHaveLength(2);

      tracker.updateState(state2);
      const activeUnits = tracker.getActiveUnits();
      expect(activeUnits).toHaveLength(2);
      expect(activeUnits.map(u => u.unitId).sort()).toEqual(['unit-1', 'unit-3']);
    });

    it('should return empty array when no state set', () => {
      const activeUnits = tracker.getActiveUnits();
      expect(activeUnits).toHaveLength(0);
    });
  });

  describe('Clear and Reset', () => {
    it('should clear all tracked state', () => {
      const state1 = createMockState([createMockUnit('unit-1')]);
      const state2 = createMockState([createMockUnit('unit-1'), createMockUnit('unit-2')]);

      tracker.updateState(state1);
      tracker.updateState(state2);

      tracker.clear();

      expect(tracker.getSpawnedUnits()).toHaveLength(0);
      expect(tracker.getDespawnedUnits()).toHaveLength(0);
      expect(tracker.getActiveUnits()).toHaveLength(0);
    });

    it('should accept new state after clear', () => {
      tracker.updateState(createMockState([createMockUnit('unit-1')]));
      tracker.clear();

      const newState = createMockState([createMockUnit('unit-2')]);
      tracker.updateState(newState);

      expect(tracker.getActiveUnits()).toHaveLength(1);
      expect(tracker.getActiveUnits()[0].unitId).toBe('unit-2');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty state transitions', () => {
      const state1 = createMockState([]);
      const state2 = createMockState([]);

      tracker.updateState(state1);
      tracker.updateState(state2);

      expect(tracker.getSpawnedUnits()).toHaveLength(0);
      expect(tracker.getDespawnedUnits()).toHaveLength(0);
    });

    it('should handle all units despawning at once', () => {
      const state1 = createMockState([
        createMockUnit('unit-1'),
        createMockUnit('unit-2'),
        createMockUnit('unit-3')
      ]);

      const state2 = createMockState([]);

      tracker.updateState(state1);
      tracker.updateState(state2);

      expect(tracker.getDespawnedUnits()).toHaveLength(3);
      expect(tracker.getActiveUnits()).toHaveLength(0);
    });

    it('should handle complete unit replacement', () => {
      const state1 = createMockState([
        createMockUnit('unit-1'),
        createMockUnit('unit-2')
      ]);

      const state2 = createMockState([
        createMockUnit('unit-3'),
        createMockUnit('unit-4')
      ]);

      tracker.updateState(state1);
      tracker.updateState(state2);

      expect(tracker.getSpawnedUnits()).toHaveLength(2);
      expect(tracker.getDespawnedUnits()).toHaveLength(2);
    });
  });

  describe('Performance', () => {
    it('should handle large number of units efficiently', () => {
      const units1 = Array.from({ length: 100 }, (_, i) => createMockUnit(`unit-${i}`));
      const units2 = [...units1, createMockUnit('unit-100')];

      const startTime = performance.now();

      tracker.updateState(createMockState(units1));
      tracker.updateState(createMockState(units2));

      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(10); // Should take less than 10ms
      expect(tracker.getSpawnedUnits()).toHaveLength(1);
    });
  });
});
