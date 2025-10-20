/**
 * TASK-VIZ-016: State Diff Detector Tests
 *
 * Test-driven development for detecting combat events from state changes.
 * Compares consecutive CombatState snapshots to identify damage, healing,
 * projectiles, buffs, and other combat events.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StateDiffDetector } from '../state-diff-detector';
import type { CombatState, CombatCreature } from '@drawn-of-war/shared/src/types/combat';
import type { AxialCoordinate } from '@drawn-of-war/shared/src/utils/hex-math/types';

// Helper to create minimal CombatState
function createCombatState(overrides: Partial<CombatState> = {}): CombatState {
  return {
    matchId: 'test-match',
    tick: 0,
    status: 'running',
    units: [],
    projectiles: [],
    events: [],
    statistics: {
      player1: { totalDamageDealt: 0, totalHealingDone: 0, unitsLost: 0 },
      player2: { totalDamageDealt: 0, totalHealingDone: 0, unitsLost: 0 }
    },
    startTime: Date.now(),
    ...overrides
  };
}

// Helper to create minimal CombatCreature
function createUnit(id: string, overrides: Partial<CombatCreature> = {}): CombatCreature {
  return {
    unitId: id,
    creatureId: 'knight',
    ownerId: 'player1',
    position: { q: 0, r: 0 },
    health: 100,
    maxHealth: 100,
    status: 'alive',
    facingDirection: 0,
    attackCooldownRemaining: 0,
    stats: {
      attack: 10,
      defense: 5,
      speed: 3,
      range: 1,
      maxHealth: 100
    },
    activeBuffs: [],
    activeDebuffs: [],
    abilities: [],
    ...overrides
  } as CombatCreature;
}

describe('StateDiffDetector', () => {
  let detector: StateDiffDetector;

  beforeEach(() => {
    detector = new StateDiffDetector();
  });

  describe('Initialization', () => {
    it('should initialize with no previous state', () => {
      expect(detector).toBeDefined();
    });

    it('should return empty events on first state', () => {
      const state = createCombatState();
      const events = detector.detectChanges(state);

      expect(events.damages).toHaveLength(0);
      expect(events.heals).toHaveLength(0);
      expect(events.projectiles).toHaveLength(0);
      expect(events.buffsApplied).toHaveLength(0);
      expect(events.buffsRemoved).toHaveLength(0);
      expect(events.deaths).toHaveLength(0);
    });
  });

  describe('Damage Detection', () => {
    it('should detect damage when unit health decreases', () => {
      const unit = createUnit('unit1', { health: 100 });
      const state1 = createCombatState({ tick: 1, units: [unit] });

      detector.detectChanges(state1);

      const damagedUnit = createUnit('unit1', { health: 75 });
      const state2 = createCombatState({ tick: 2, units: [damagedUnit] });

      const events = detector.detectChanges(state2);

      expect(events.damages).toHaveLength(1);
      expect(events.damages[0]).toEqual({
        unitId: 'unit1',
        oldHealth: 100,
        newHealth: 75,
        damageAmount: 25,
        tick: 2
      });
    });

    it('should detect multiple damage events in same tick', () => {
      const state1 = createCombatState({
        tick: 1,
        units: [
          createUnit('unit1', { health: 100 }),
          createUnit('unit2', { health: 80 })
        ]
      });

      detector.detectChanges(state1);

      const state2 = createCombatState({
        tick: 2,
        units: [
          createUnit('unit1', { health: 70 }),
          createUnit('unit2', { health: 50 })
        ]
      });

      const events = detector.detectChanges(state2);

      expect(events.damages).toHaveLength(2);
      expect(events.damages.find(d => d.unitId === 'unit1')?.damageAmount).toBe(30);
      expect(events.damages.find(d => d.unitId === 'unit2')?.damageAmount).toBe(30);
    });

    it('should not detect damage when health stays same', () => {
      const state1 = createCombatState({
        tick: 1,
        units: [createUnit('unit1', { health: 100 })]
      });

      detector.detectChanges(state1);

      const state2 = createCombatState({
        tick: 2,
        units: [createUnit('unit1', { health: 100 })]
      });

      const events = detector.detectChanges(state2);

      expect(events.damages).toHaveLength(0);
    });

    it('should ignore units that only exist in new state', () => {
      const state1 = createCombatState({ tick: 1, units: [] });
      detector.detectChanges(state1);

      const state2 = createCombatState({
        tick: 2,
        units: [createUnit('new-unit', { health: 50 })]
      });

      const events = detector.detectChanges(state2);

      expect(events.damages).toHaveLength(0);
    });
  });

  describe('Healing Detection', () => {
    it('should detect healing when unit health increases', () => {
      const state1 = createCombatState({
        tick: 1,
        units: [createUnit('unit1', { health: 50, maxHealth: 100 })]
      });

      detector.detectChanges(state1);

      const state2 = createCombatState({
        tick: 2,
        units: [createUnit('unit1', { health: 75, maxHealth: 100 })]
      });

      const events = detector.detectChanges(state2);

      expect(events.heals).toHaveLength(1);
      expect(events.heals[0]).toEqual({
        unitId: 'unit1',
        oldHealth: 50,
        newHealth: 75,
        healAmount: 25,
        tick: 2
      });
    });

    it('should not detect healing when health decreases', () => {
      const state1 = createCombatState({
        tick: 1,
        units: [createUnit('unit1', { health: 100 })]
      });

      detector.detectChanges(state1);

      const state2 = createCombatState({
        tick: 2,
        units: [createUnit('unit1', { health: 75 })]
      });

      const events = detector.detectChanges(state2);

      expect(events.heals).toHaveLength(0);
    });

    it('should cap healing at maxHealth', () => {
      const state1 = createCombatState({
        tick: 1,
        units: [createUnit('unit1', { health: 90, maxHealth: 100 })]
      });

      detector.detectChanges(state1);

      const state2 = createCombatState({
        tick: 2,
        units: [createUnit('unit1', { health: 100, maxHealth: 100 })]
      });

      const events = detector.detectChanges(state2);

      expect(events.heals).toHaveLength(1);
      expect(events.heals[0].healAmount).toBe(10);
    });
  });

  describe('Projectile Detection', () => {
    it('should detect new projectile spawned', () => {
      const state1 = createCombatState({ tick: 1, projectiles: [] });
      detector.detectChanges(state1);

      const state2 = createCombatState({
        tick: 2,
        projectiles: [{
          projectileId: 'proj1',
          sourceUnitId: 'unit1',
          targetUnitId: 'unit2',
          position: { q: 0, r: 0 },
          targetPosition: { q: 5, r: 5 },
          speed: 10,
          damage: 20
        }]
      });

      const events = detector.detectChanges(state2);

      expect(events.projectiles).toHaveLength(1);
      expect(events.projectiles[0]).toEqual({
        projectileId: 'proj1',
        sourceUnitId: 'unit1',
        targetUnitId: 'unit2',
        sourcePosition: { q: 0, r: 0 },
        targetPosition: { q: 5, r: 5 },
        tick: 2
      });
    });

    it('should detect multiple new projectiles', () => {
      const state1 = createCombatState({ tick: 1, projectiles: [] });
      detector.detectChanges(state1);

      const state2 = createCombatState({
        tick: 2,
        projectiles: [
          {
            projectileId: 'proj1',
            sourceUnitId: 'unit1',
            targetUnitId: 'unit2',
            position: { q: 0, r: 0 },
            targetPosition: { q: 5, r: 5 },
            speed: 10,
            damage: 20
          },
          {
            projectileId: 'proj2',
            sourceUnitId: 'unit3',
            targetUnitId: 'unit4',
            position: { q: 1, r: 1 },
            targetPosition: { q: 6, r: 6 },
            speed: 15,
            damage: 30
          }
        ]
      });

      const events = detector.detectChanges(state2);

      expect(events.projectiles).toHaveLength(2);
    });

    it('should not re-detect existing projectiles', () => {
      const projectile = {
        projectileId: 'proj1',
        sourceUnitId: 'unit1',
        targetUnitId: 'unit2',
        position: { q: 0, r: 0 },
        targetPosition: { q: 5, r: 5 },
        speed: 10,
        damage: 20
      };

      const state1 = createCombatState({ tick: 1, projectiles: [projectile] });
      detector.detectChanges(state1);

      const state2 = createCombatState({ tick: 2, projectiles: [projectile] });

      const events = detector.detectChanges(state2);

      expect(events.projectiles).toHaveLength(0);
    });
  });

  describe('Buff Application Detection', () => {
    it('should detect new buff applied', () => {
      const state1 = createCombatState({
        tick: 1,
        units: [createUnit('unit1', { activeBuffs: [] })]
      });

      detector.detectChanges(state1);

      const state2 = createCombatState({
        tick: 2,
        units: [createUnit('unit1', {
          activeBuffs: [{
            buffId: 'buff1',
            name: 'Regeneration',
            appliedTick: 2,
            durationRemaining: 10,
            effects: { healPerTick: 5 }
          }]
        })]
      });

      const events = detector.detectChanges(state2);

      expect(events.buffsApplied).toHaveLength(1);
      expect(events.buffsApplied[0]).toMatchObject({
        unitId: 'unit1',
        buffId: 'buff1',
        buffName: 'Regeneration',
        duration: 10,
        tick: 2
      });
    });

    it('should detect multiple buffs applied to same unit', () => {
      const state1 = createCombatState({
        tick: 1,
        units: [createUnit('unit1', { activeBuffs: [] })]
      });

      detector.detectChanges(state1);

      const state2 = createCombatState({
        tick: 2,
        units: [createUnit('unit1', {
          activeBuffs: [
            {
              buffId: 'buff1',
              name: 'Regeneration',
              appliedTick: 2,
              durationRemaining: 10,
              effects: { healPerTick: 5 }
            },
            {
              buffId: 'buff2',
              name: 'Shield',
              appliedTick: 2,
              durationRemaining: 5,
              effects: { armorBonus: 10 }
            }
          ]
        })]
      });

      const events = detector.detectChanges(state2);

      expect(events.buffsApplied).toHaveLength(2);
    });

    it('should not re-detect existing buffs', () => {
      const buff = {
        buffId: 'buff1',
        name: 'Regeneration',
        appliedTick: 1,
        durationRemaining: 10,
        effects: { healPerTick: 5 }
      };

      const state1 = createCombatState({
        tick: 1,
        units: [createUnit('unit1', { activeBuffs: [buff] })]
      });

      detector.detectChanges(state1);

      const state2 = createCombatState({
        tick: 2,
        units: [createUnit('unit1', {
          activeBuffs: [{ ...buff, durationRemaining: 9 }]
        })]
      });

      const events = detector.detectChanges(state2);

      expect(events.buffsApplied).toHaveLength(0);
    });
  });

  describe('Buff Removal Detection', () => {
    it('should detect buff removed', () => {
      const state1 = createCombatState({
        tick: 1,
        units: [createUnit('unit1', {
          activeBuffs: [{
            buffId: 'buff1',
            name: 'Regeneration',
            appliedTick: 1,
            durationRemaining: 1,
            effects: { healPerTick: 5 }
          }]
        })]
      });

      detector.detectChanges(state1);

      const state2 = createCombatState({
        tick: 2,
        units: [createUnit('unit1', { activeBuffs: [] })]
      });

      const events = detector.detectChanges(state2);

      expect(events.buffsRemoved).toHaveLength(1);
      expect(events.buffsRemoved[0]).toEqual({
        unitId: 'unit1',
        buffId: 'buff1',
        buffName: 'Regeneration',
        tick: 2
      });
    });

    it('should detect multiple buffs removed', () => {
      const state1 = createCombatState({
        tick: 1,
        units: [createUnit('unit1', {
          activeBuffs: [
            {
              buffId: 'buff1',
              name: 'Regeneration',
              appliedTick: 1,
              durationRemaining: 1,
              effects: {}
            },
            {
              buffId: 'buff2',
              name: 'Shield',
              appliedTick: 1,
              durationRemaining: 1,
              effects: {}
            }
          ]
        })]
      });

      detector.detectChanges(state1);

      const state2 = createCombatState({
        tick: 2,
        units: [createUnit('unit1', { activeBuffs: [] })]
      });

      const events = detector.detectChanges(state2);

      expect(events.buffsRemoved).toHaveLength(2);
    });
  });

  describe('Debuff Detection', () => {
    it('should detect debuff applied', () => {
      const state1 = createCombatState({
        tick: 1,
        units: [createUnit('unit1', { activeDebuffs: [] })]
      });

      detector.detectChanges(state1);

      const state2 = createCombatState({
        tick: 2,
        units: [createUnit('unit1', {
          activeDebuffs: [{
            buffId: 'debuff1',
            name: 'Poison',
            appliedTick: 2,
            durationRemaining: 5,
            effects: { damagePerTick: 3 }
          }]
        })]
      });

      const events = detector.detectChanges(state2);

      expect(events.debuffsApplied).toHaveLength(1);
      expect(events.debuffsApplied[0].buffName).toBe('Poison');
    });

    it('should detect debuff removed', () => {
      const state1 = createCombatState({
        tick: 1,
        units: [createUnit('unit1', {
          activeDebuffs: [{
            buffId: 'debuff1',
            name: 'Poison',
            appliedTick: 1,
            durationRemaining: 1,
            effects: {}
          }]
        })]
      });

      detector.detectChanges(state1);

      const state2 = createCombatState({
        tick: 2,
        units: [createUnit('unit1', { activeDebuffs: [] })]
      });

      const events = detector.detectChanges(state2);

      expect(events.debuffsRemoved).toHaveLength(1);
    });
  });

  describe('Death Detection', () => {
    it('should detect unit death', () => {
      const state1 = createCombatState({
        tick: 1,
        units: [createUnit('unit1', { status: 'alive', health: 10 })]
      });

      detector.detectChanges(state1);

      const state2 = createCombatState({
        tick: 2,
        units: [createUnit('unit1', { status: 'dead', health: 0 })]
      });

      const events = detector.detectChanges(state2);

      expect(events.deaths).toHaveLength(1);
      expect(events.deaths[0]).toEqual({
        unitId: 'unit1',
        tick: 2
      });
    });

    it('should detect unit removed from state as death', () => {
      const state1 = createCombatState({
        tick: 1,
        units: [createUnit('unit1')]
      });

      detector.detectChanges(state1);

      const state2 = createCombatState({
        tick: 2,
        units: []
      });

      const events = detector.detectChanges(state2);

      expect(events.deaths).toHaveLength(1);
      expect(events.deaths[0].unitId).toBe('unit1');
    });

    it('should not re-detect already dead units', () => {
      const state1 = createCombatState({
        tick: 1,
        units: [createUnit('unit1', { status: 'dead', health: 0 })]
      });

      detector.detectChanges(state1);

      const state2 = createCombatState({
        tick: 2,
        units: [createUnit('unit1', { status: 'dead', health: 0 })]
      });

      const events = detector.detectChanges(state2);

      expect(events.deaths).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty unit arrays', () => {
      const state1 = createCombatState({ tick: 1, units: [] });
      detector.detectChanges(state1);

      const state2 = createCombatState({ tick: 2, units: [] });
      const events = detector.detectChanges(state2);

      expect(events.damages).toHaveLength(0);
      expect(events.heals).toHaveLength(0);
    });

    it('should handle null/undefined previous state gracefully', () => {
      const detector2 = new StateDiffDetector();
      const state = createCombatState();

      const events = detector2.detectChanges(state);

      expect(events).toBeDefined();
      expect(events.damages).toHaveLength(0);
    });

    it('should handle units with same ID but different data', () => {
      const state1 = createCombatState({
        tick: 1,
        units: [createUnit('unit1', { health: 100, position: { q: 0, r: 0 } })]
      });

      detector.detectChanges(state1);

      const state2 = createCombatState({
        tick: 2,
        units: [createUnit('unit1', { health: 75, position: { q: 1, r: 1 } })]
      });

      const events = detector.detectChanges(state2);

      expect(events.damages).toHaveLength(1);
      expect(events.damages[0].damageAmount).toBe(25);
    });
  });

  describe('Performance', () => {
    it('should handle large state efficiently', () => {
      const units1 = Array.from({ length: 50 }, (_, i) =>
        createUnit(`unit${i}`, { health: 100 })
      );

      const state1 = createCombatState({ tick: 1, units: units1 });
      detector.detectChanges(state1);

      const units2 = units1.map(u =>
        createUnit(u.unitId, { health: 90 })
      );

      const state2 = createCombatState({ tick: 2, units: units2 });

      const startTime = performance.now();
      const events = detector.detectChanges(state2);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(10); // Should process in < 10ms
      expect(events.damages).toHaveLength(50);
    });
  });
});
