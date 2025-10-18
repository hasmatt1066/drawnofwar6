/**
 * TASK-COMBAT-VIZ-002: Combat State Parser Tests
 *
 * Test-driven development for parsing and validating raw Socket.IO combat:state events.
 */

import { describe, it, expect } from 'vitest';
import { parseCombatState, CombatStateParseError } from '../combat-state-parser';
import type { CombatState } from '@drawn-of-war/shared/types/combat';

describe('Combat State Parser', () => {
  describe('Valid Combat State', () => {
    it('should parse minimal valid combat state', () => {
      const rawData = {
        matchId: 'match-123',
        tick: 0,
        status: 'initializing',
        units: [],
        projectiles: [],
        events: [],
        statistics: {
          totalDamageDealt: { player1: 0, player2: 0 },
          totalHealingDone: { player1: 0, player2: 0 },
          unitsLost: { player1: 0, player2: 0 },
          abilitiesUsed: { player1: 0, player2: 0 },
          duration: 0
        },
        startTime: Date.now()
      };

      const result = parseCombatState(rawData);

      expect(result).toMatchObject(rawData);
      expect(result.matchId).toBe('match-123');
      expect(result.tick).toBe(0);
      expect(result.status).toBe('initializing');
    });

    it('should parse combat state with units', () => {
      const rawData = {
        matchId: 'match-456',
        tick: 120,
        status: 'running',
        units: [
          {
            unitId: 'unit-1',
            creatureId: 'creature-a',
            ownerId: 'player1',
            position: { q: 0, r: 0 },
            health: 100,
            maxHealth: 100,
            status: 'alive',
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
          }
        ],
        projectiles: [],
        events: [],
        statistics: {
          totalDamageDealt: { player1: 0, player2: 0 },
          totalHealingDone: { player1: 0, player2: 0 },
          unitsLost: { player1: 0, player2: 0 },
          abilitiesUsed: { player1: 0, player2: 0 },
          duration: 120
        },
        startTime: Date.now()
      };

      const result = parseCombatState(rawData);

      expect(result.units).toHaveLength(1);
      expect(result.units[0].unitId).toBe('unit-1');
      expect(result.units[0].health).toBe(100);
      expect(result.units[0].stats.archetype).toBe('tank');
    });

    it('should parse combat state with projectiles', () => {
      const rawData = {
        matchId: 'match-789',
        tick: 240,
        status: 'running',
        units: [],
        projectiles: [
          {
            projectileId: 'proj-1',
            abilityId: 'fireball',
            sourceUnitId: 'unit-1',
            targetUnitId: 'unit-2',
            currentPosition: { q: 1, r: 1 },
            targetPosition: { q: 3, r: 3 },
            velocity: 0.5,
            spawnTick: 230,
            lifetimeTicks: 20,
            damageAmount: 50,
            effectOnImpact: 'explosion'
          }
        ],
        events: [],
        statistics: {
          totalDamageDealt: { player1: 50, player2: 0 },
          totalHealingDone: { player1: 0, player2: 0 },
          unitsLost: { player1: 0, player2: 0 },
          abilitiesUsed: { player1: 1, player2: 0 },
          duration: 240
        },
        startTime: Date.now()
      };

      const result = parseCombatState(rawData);

      expect(result.projectiles).toHaveLength(1);
      expect(result.projectiles[0].projectileId).toBe('proj-1');
      expect(result.projectiles[0].velocity).toBe(0.5);
    });

    it('should parse combat state with events', () => {
      const rawData = {
        matchId: 'match-abc',
        tick: 60,
        status: 'running',
        units: [],
        projectiles: [],
        events: [
          {
            tick: 55,
            eventType: 'damage_dealt',
            data: { sourceId: 'unit-1', targetId: 'unit-2', amount: 25 }
          },
          {
            tick: 58,
            eventType: 'ability_used',
            data: { unitId: 'unit-1', abilityId: 'shield_bash' }
          }
        ],
        statistics: {
          totalDamageDealt: { player1: 25, player2: 0 },
          totalHealingDone: { player1: 0, player2: 0 },
          unitsLost: { player1: 0, player2: 0 },
          abilitiesUsed: { player1: 1, player2: 0 },
          duration: 60
        },
        startTime: Date.now()
      };

      const result = parseCombatState(rawData);

      expect(result.events).toHaveLength(2);
      expect(result.events[0].eventType).toBe('damage_dealt');
      expect(result.events[1].eventType).toBe('ability_used');
    });

    it('should parse completed combat state with endTime', () => {
      const startTime = Date.now();
      const endTime = startTime + 30000;

      const rawData = {
        matchId: 'match-complete',
        tick: 1800,
        status: 'completed',
        units: [],
        projectiles: [],
        events: [],
        statistics: {
          totalDamageDealt: { player1: 1000, player2: 800 },
          totalHealingDone: { player1: 200, player2: 150 },
          unitsLost: { player1: 2, player2: 3 },
          abilitiesUsed: { player1: 15, player2: 12 },
          duration: 1800
        },
        startTime,
        endTime
      };

      const result = parseCombatState(rawData);

      expect(result.status).toBe('completed');
      expect(result.endTime).toBe(endTime);
    });
  });

  describe('Invalid Data Handling', () => {
    it('should throw error for null input', () => {
      expect(() => parseCombatState(null as any)).toThrow(CombatStateParseError);
    });

    it('should throw error for undefined input', () => {
      expect(() => parseCombatState(undefined as any)).toThrow(CombatStateParseError);
    });

    it('should throw error for non-object input', () => {
      expect(() => parseCombatState('invalid' as any)).toThrow(CombatStateParseError);
      expect(() => parseCombatState(123 as any)).toThrow(CombatStateParseError);
      expect(() => parseCombatState([] as any)).toThrow(CombatStateParseError);
    });

    it('should throw error for missing matchId', () => {
      const rawData = {
        tick: 0,
        status: 'running',
        units: [],
        projectiles: [],
        events: [],
        statistics: {
          totalDamageDealt: { player1: 0, player2: 0 },
          totalHealingDone: { player1: 0, player2: 0 },
          unitsLost: { player1: 0, player2: 0 },
          abilitiesUsed: { player1: 0, player2: 0 },
          duration: 0
        },
        startTime: Date.now()
      };

      expect(() => parseCombatState(rawData as any)).toThrow(CombatStateParseError);
      expect(() => parseCombatState(rawData as any)).toThrow(/matchId/);
    });

    it('should throw error for missing tick', () => {
      const rawData = {
        matchId: 'match-123',
        status: 'running',
        units: [],
        projectiles: [],
        events: [],
        statistics: {
          totalDamageDealt: { player1: 0, player2: 0 },
          totalHealingDone: { player1: 0, player2: 0 },
          unitsLost: { player1: 0, player2: 0 },
          abilitiesUsed: { player1: 0, player2: 0 },
          duration: 0
        },
        startTime: Date.now()
      };

      expect(() => parseCombatState(rawData as any)).toThrow(CombatStateParseError);
      expect(() => parseCombatState(rawData as any)).toThrow(/tick/);
    });

    it('should throw error for invalid status', () => {
      const rawData = {
        matchId: 'match-123',
        tick: 0,
        status: 'invalid_status',
        units: [],
        projectiles: [],
        events: [],
        statistics: {
          totalDamageDealt: { player1: 0, player2: 0 },
          totalHealingDone: { player1: 0, player2: 0 },
          unitsLost: { player1: 0, player2: 0 },
          abilitiesUsed: { player1: 0, player2: 0 },
          duration: 0
        },
        startTime: Date.now()
      };

      expect(() => parseCombatState(rawData as any)).toThrow(CombatStateParseError);
      expect(() => parseCombatState(rawData as any)).toThrow(/status/);
    });

    it('should throw error for non-array units', () => {
      const rawData = {
        matchId: 'match-123',
        tick: 0,
        status: 'running',
        units: 'not-an-array',
        projectiles: [],
        events: [],
        statistics: {
          totalDamageDealt: { player1: 0, player2: 0 },
          totalHealingDone: { player1: 0, player2: 0 },
          unitsLost: { player1: 0, player2: 0 },
          abilitiesUsed: { player1: 0, player2: 0 },
          duration: 0
        },
        startTime: Date.now()
      };

      expect(() => parseCombatState(rawData as any)).toThrow(CombatStateParseError);
      expect(() => parseCombatState(rawData as any)).toThrow(/units/);
    });

    it('should throw error for non-array projectiles', () => {
      const rawData = {
        matchId: 'match-123',
        tick: 0,
        status: 'running',
        units: [],
        projectiles: null,
        events: [],
        statistics: {
          totalDamageDealt: { player1: 0, player2: 0 },
          totalHealingDone: { player1: 0, player2: 0 },
          unitsLost: { player1: 0, player2: 0 },
          abilitiesUsed: { player1: 0, player2: 0 },
          duration: 0
        },
        startTime: Date.now()
      };

      expect(() => parseCombatState(rawData as any)).toThrow(CombatStateParseError);
      expect(() => parseCombatState(rawData as any)).toThrow(/projectiles/);
    });

    it('should throw error for non-array events', () => {
      const rawData = {
        matchId: 'match-123',
        tick: 0,
        status: 'running',
        units: [],
        projectiles: [],
        events: {},
        statistics: {
          totalDamageDealt: { player1: 0, player2: 0 },
          totalHealingDone: { player1: 0, player2: 0 },
          unitsLost: { player1: 0, player2: 0 },
          abilitiesUsed: { player1: 0, player2: 0 },
          duration: 0
        },
        startTime: Date.now()
      };

      expect(() => parseCombatState(rawData as any)).toThrow(CombatStateParseError);
      expect(() => parseCombatState(rawData as any)).toThrow(/events/);
    });

    it('should throw error for missing statistics', () => {
      const rawData = {
        matchId: 'match-123',
        tick: 0,
        status: 'running',
        units: [],
        projectiles: [],
        events: [],
        startTime: Date.now()
      };

      expect(() => parseCombatState(rawData as any)).toThrow(CombatStateParseError);
      expect(() => parseCombatState(rawData as any)).toThrow(/statistics/);
    });

    it('should throw error for invalid tick (negative)', () => {
      const rawData = {
        matchId: 'match-123',
        tick: -1,
        status: 'running',
        units: [],
        projectiles: [],
        events: [],
        statistics: {
          totalDamageDealt: { player1: 0, player2: 0 },
          totalHealingDone: { player1: 0, player2: 0 },
          unitsLost: { player1: 0, player2: 0 },
          abilitiesUsed: { player1: 0, player2: 0 },
          duration: 0
        },
        startTime: Date.now()
      };

      expect(() => parseCombatState(rawData as any)).toThrow(CombatStateParseError);
      expect(() => parseCombatState(rawData as any)).toThrow(/tick/);
    });
  });

  describe('Type Safety', () => {
    it('should return correctly typed CombatState', () => {
      const rawData = {
        matchId: 'match-type-test',
        tick: 100,
        status: 'running',
        units: [],
        projectiles: [],
        events: [],
        statistics: {
          totalDamageDealt: { player1: 0, player2: 0 },
          totalHealingDone: { player1: 0, player2: 0 },
          unitsLost: { player1: 0, player2: 0 },
          abilitiesUsed: { player1: 0, player2: 0 },
          duration: 100
        },
        startTime: Date.now()
      };

      const result: CombatState = parseCombatState(rawData);

      // TypeScript compilation validates this is correctly typed
      expect(result.matchId).toBeDefined();
      expect(result.tick).toBeDefined();
      expect(result.status).toBeDefined();
      expect(result.units).toBeDefined();
      expect(result.projectiles).toBeDefined();
      expect(result.events).toBeDefined();
      expect(result.statistics).toBeDefined();
    });
  });

  describe('Error Messages', () => {
    it('should provide helpful error message for validation failure', () => {
      const rawData = {
        matchId: '',
        tick: 0,
        status: 'running',
        units: [],
        projectiles: [],
        events: [],
        statistics: {
          totalDamageDealt: { player1: 0, player2: 0 },
          totalHealingDone: { player1: 0, player2: 0 },
          unitsLost: { player1: 0, player2: 0 },
          abilitiesUsed: { player1: 0, player2: 0 },
          duration: 0
        },
        startTime: Date.now()
      };

      try {
        parseCombatState(rawData as any);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(CombatStateParseError);
        expect((error as Error).message).toContain('matchId');
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string matchId', () => {
      const rawData = {
        matchId: '',
        tick: 0,
        status: 'running',
        units: [],
        projectiles: [],
        events: [],
        statistics: {
          totalDamageDealt: { player1: 0, player2: 0 },
          totalHealingDone: { player1: 0, player2: 0 },
          unitsLost: { player1: 0, player2: 0 },
          abilitiesUsed: { player1: 0, player2: 0 },
          duration: 0
        },
        startTime: Date.now()
      };

      expect(() => parseCombatState(rawData as any)).toThrow(CombatStateParseError);
    });

    it('should handle very large tick numbers', () => {
      const rawData = {
        matchId: 'match-large-tick',
        tick: Number.MAX_SAFE_INTEGER,
        status: 'running',
        units: [],
        projectiles: [],
        events: [],
        statistics: {
          totalDamageDealt: { player1: 0, player2: 0 },
          totalHealingDone: { player1: 0, player2: 0 },
          unitsLost: { player1: 0, player2: 0 },
          abilitiesUsed: { player1: 0, player2: 0 },
          duration: 0
        },
        startTime: Date.now()
      };

      const result = parseCombatState(rawData);
      expect(result.tick).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should handle large arrays of units', () => {
      const units = Array.from({ length: 100 }, (_, i) => ({
        unitId: `unit-${i}`,
        creatureId: `creature-${i}`,
        ownerId: i % 2 === 0 ? 'player1' : 'player2',
        position: { q: i, r: i },
        health: 100,
        maxHealth: 100,
        status: 'alive',
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
      }));

      const rawData = {
        matchId: 'match-many-units',
        tick: 0,
        status: 'running',
        units,
        projectiles: [],
        events: [],
        statistics: {
          totalDamageDealt: { player1: 0, player2: 0 },
          totalHealingDone: { player1: 0, player2: 0 },
          unitsLost: { player1: 0, player2: 0 },
          abilitiesUsed: { player1: 0, player2: 0 },
          duration: 0
        },
        startTime: Date.now()
      };

      const result = parseCombatState(rawData);
      expect(result.units).toHaveLength(100);
    });
  });
});
