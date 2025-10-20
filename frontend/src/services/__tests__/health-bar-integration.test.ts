/**
 * TASK-VIZ-019: Health Bar Integration Tests
 *
 * Test-driven development for integrating health bars into the visualization manager.
 * Health bars appear for units in combat and disappear after 3 seconds of inactivity.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CombatVisualizationManager } from '../combat-visualization-manager';
import type { CombatState, CombatCreature } from '@drawn-of-war/shared/src/types/combat';

// Mock dependencies
const mockSocketClient = {
  onCombatState: vi.fn(),
  onCombatCompleted: vi.fn(),
  onError: vi.fn()
};

const mockStage = {
  addChild: vi.fn(),
  removeChild: vi.fn(),
  children: []
};

const mockGridRenderer = {
  getSpriteAt: vi.fn(),
  getActiveSprites: vi.fn(() => new Map())
};

// Helper to create unit
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

// Helper to create combat state
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
  } as CombatState;
}

describe('Health Bar Integration', () => {
  let manager: CombatVisualizationManager;
  let stateCallback: (state: CombatState) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    manager = new CombatVisualizationManager(
      mockSocketClient as any,
      mockStage as any,
      mockGridRenderer as any
    );

    // Get the state callback
    stateCallback = mockSocketClient.onCombatState.mock.calls[0][0];

    // Mock sprite positions
    mockGridRenderer.getSpriteAt.mockImplementation((coord: any) => ({
      sprite: { x: coord.q * 100, y: coord.r * 100 },
      unitId: `unit-${coord.q}-${coord.r}`
    }));
  });

  afterEach(() => {
    manager.destroy();
    vi.useRealTimers();
  });

  describe('Combat Detection', () => {
    it('should detect unit entering combat when damaged', () => {
      const state1 = createCombatState({
        tick: 1,
        units: [createUnit('unit1', { health: 100 })]
      });

      stateCallback(state1);

      const state2 = createCombatState({
        tick: 2,
        units: [createUnit('unit1', { health: 75 })] // Damaged
      });

      stateCallback(state2);

      const combatUnits = manager.getUnitsInCombat();
      expect(combatUnits.has('unit1')).toBe(true);
    });

    it('should detect unit entering combat when it attacks', () => {
      const state1 = createCombatState({
        tick: 1,
        units: [createUnit('unit1', { currentTarget: undefined })]
      });

      stateCallback(state1);

      const state2 = createCombatState({
        tick: 2,
        units: [createUnit('unit1', { currentTarget: 'unit2' })]
      });

      stateCallback(state2);

      const combatUnits = manager.getUnitsInCombat();
      expect(combatUnits.has('unit1')).toBe(true);
    });

    it('should keep unit in combat while it has a target', () => {
      const state = createCombatState({
        tick: 1,
        units: [createUnit('unit1', { currentTarget: 'unit2' })]
      });

      stateCallback(state);

      const combatUnits = manager.getUnitsInCombat();
      expect(combatUnits.has('unit1')).toBe(true);
    });
  });

  describe('Health Bar Creation', () => {
    it('should create health bar for unit in combat', () => {
      const state1 = createCombatState({
        tick: 1,
        units: [createUnit('unit1', { health: 100, position: { q: 5, r: 3 } })]
      });

      stateCallback(state1);

      const state2 = createCombatState({
        tick: 2,
        units: [createUnit('unit1', { health: 75, position: { q: 5, r: 3 } })]
      });

      stateCallback(state2);

      const healthBars = manager.getHealthBars();
      expect(healthBars.has('unit1')).toBe(true);
    });

    it('should position health bar above unit sprite', () => {
      mockGridRenderer.getSpriteAt.mockReturnValue({
        sprite: { x: 500, y: 300 },
        unitId: 'unit1'
      });

      const state1 = createCombatState({
        tick: 1,
        units: [createUnit('unit1', { health: 100 })]
      });

      stateCallback(state1);

      const state2 = createCombatState({
        tick: 2,
        units: [createUnit('unit1', { health: 75 })]
      });

      stateCallback(state2);

      const healthBars = manager.getHealthBars();
      const healthBar = healthBars.get('unit1');

      expect(healthBar).toBeDefined();
      expect(healthBar.container.x).toBe(500);
      expect(healthBar.container.y).toBe(280); // 300 - 20px offset
    });

    it('should not create health bar for unit not in combat', () => {
      const state = createCombatState({
        tick: 1,
        units: [createUnit('unit1', { health: 100 })]
      });

      stateCallback(state);

      const healthBars = manager.getHealthBars();
      expect(healthBars.has('unit1')).toBe(false);
    });
  });

  describe('Health Bar Updates', () => {
    it('should update health bar when health changes', () => {
      const state1 = createCombatState({
        tick: 1,
        units: [createUnit('unit1', { health: 100 })]
      });

      stateCallback(state1);

      const state2 = createCombatState({
        tick: 2,
        units: [createUnit('unit1', { health: 75 })]
      });

      stateCallback(state2);

      const state3 = createCombatState({
        tick: 3,
        units: [createUnit('unit1', { health: 50 })]
      });

      stateCallback(state3);

      const healthBars = manager.getHealthBars();
      const healthBar = healthBars.get('unit1');

      // Health bar should reflect current health
      expect(healthBar).toBeDefined();
    });

    it('should update health bar position when unit moves', () => {
      const state1 = createCombatState({
        tick: 1,
        units: [createUnit('unit1', { health: 100, position: { q: 0, r: 0 } })]
      });

      stateCallback(state1);

      const state2 = createCombatState({
        tick: 2,
        units: [createUnit('unit1', { health: 75, position: { q: 0, r: 0 } })]
      });

      stateCallback(state2);

      mockGridRenderer.getSpriteAt.mockReturnValue({
        sprite: { x: 600, y: 400 },
        unitId: 'unit1'
      });

      const state3 = createCombatState({
        tick: 3,
        units: [createUnit('unit1', { health: 75, position: { q: 6, r: 4 } })]
      });

      stateCallback(state3);

      const healthBars = manager.getHealthBars();
      const healthBar = healthBars.get('unit1');

      expect(healthBar.container.x).toBe(600);
      expect(healthBar.container.y).toBe(380); // 400 - 20
    });
  });

  describe('Combat Timeout', () => {
    it('should remove health bar 3 seconds after last combat action', () => {
      const state1 = createCombatState({
        tick: 1,
        units: [createUnit('unit1', { health: 100 })]
      });

      stateCallback(state1);

      const state2 = createCombatState({
        tick: 2,
        units: [createUnit('unit1', { health: 75 })]
      });

      stateCallback(state2);

      expect(manager.getHealthBars().has('unit1')).toBe(true);

      // Advance time 2.9 seconds (still in combat)
      vi.advanceTimersByTime(2900);

      expect(manager.getHealthBars().has('unit1')).toBe(true);

      // Advance time 0.2 more seconds (3.1 total - should exit combat)
      vi.advanceTimersByTime(200);

      expect(manager.getHealthBars().has('unit1')).toBe(false);
    });

    it('should reset combat timer when unit takes more damage', () => {
      const state1 = createCombatState({
        tick: 1,
        units: [createUnit('unit1', { health: 100 })]
      });

      stateCallback(state1);

      const state2 = createCombatState({
        tick: 2,
        units: [createUnit('unit1', { health: 75 })]
      });

      stateCallback(state2);

      // Advance 2.5 seconds
      vi.advanceTimersByTime(2500);

      // Take more damage - should reset timer
      const state3 = createCombatState({
        tick: 3,
        units: [createUnit('unit1', { health: 50 })]
      });

      stateCallback(state3);

      // Advance 2.9 seconds (from new damage) - should still be in combat
      vi.advanceTimersByTime(2900);

      expect(manager.getHealthBars().has('unit1')).toBe(true);

      // Advance 0.2 more seconds - should exit combat
      vi.advanceTimersByTime(200);

      expect(manager.getHealthBars().has('unit1')).toBe(false);
    });

    it('should keep health bar while unit has target', () => {
      const state = createCombatState({
        tick: 1,
        units: [createUnit('unit1', { currentTarget: 'unit2' })]
      });

      stateCallback(state);

      // Advance 5 seconds
      vi.advanceTimersByTime(5000);

      // Should still have health bar because unit has target
      expect(manager.getHealthBars().has('unit1')).toBe(true);
    });
  });

  describe('Unit Death', () => {
    it('should remove health bar when unit dies', () => {
      const state1 = createCombatState({
        tick: 1,
        units: [createUnit('unit1', { health: 100 })]
      });

      stateCallback(state1);

      const state2 = createCombatState({
        tick: 2,
        units: [createUnit('unit1', { health: 10 })]
      });

      stateCallback(state2);

      expect(manager.getHealthBars().has('unit1')).toBe(true);

      const state3 = createCombatState({
        tick: 3,
        units: [createUnit('unit1', { health: 0, status: 'dead' })]
      });

      stateCallback(state3);

      expect(manager.getHealthBars().has('unit1')).toBe(false);
    });

    it('should remove health bar when unit removed from state', () => {
      const state1 = createCombatState({
        tick: 1,
        units: [createUnit('unit1', { health: 100 })]
      });

      stateCallback(state1);

      const state2 = createCombatState({
        tick: 2,
        units: [createUnit('unit1', { health: 50 })]
      });

      stateCallback(state2);

      expect(manager.getHealthBars().has('unit1')).toBe(true);

      const state3 = createCombatState({
        tick: 3,
        units: [] // Unit removed
      });

      stateCallback(state3);

      expect(manager.getHealthBars().has('unit1')).toBe(false);
    });
  });

  describe('Multiple Units', () => {
    it('should manage health bars for multiple units', () => {
      const state1 = createCombatState({
        tick: 1,
        units: [
          createUnit('unit1', { health: 100 }),
          createUnit('unit2', { health: 100 }),
          createUnit('unit3', { health: 100 })
        ]
      });

      stateCallback(state1);

      const state2 = createCombatState({
        tick: 2,
        units: [
          createUnit('unit1', { health: 75 }), // Damaged
          createUnit('unit2', { health: 100 }),
          createUnit('unit3', { health: 50 })  // Damaged
        ]
      });

      stateCallback(state2);

      const healthBars = manager.getHealthBars();
      expect(healthBars.has('unit1')).toBe(true);
      expect(healthBars.has('unit2')).toBe(false); // Not in combat
      expect(healthBars.has('unit3')).toBe(true);
    });

    it('should update all health bars on state change', () => {
      const state1 = createCombatState({
        tick: 1,
        units: [
          createUnit('unit1', { health: 100 }),
          createUnit('unit2', { health: 100 })
        ]
      });

      stateCallback(state1);

      const state2 = createCombatState({
        tick: 2,
        units: [
          createUnit('unit1', { health: 75 }),
          createUnit('unit2', { health: 60 })
        ]
      });

      stateCallback(state2);

      const healthBars = manager.getHealthBars();
      expect(healthBars.size).toBe(2);
    });
  });

  describe('Performance', () => {
    it('should handle 20 units efficiently', () => {
      const units = Array.from({ length: 20 }, (_, i) =>
        createUnit(`unit${i}`, { health: 100, position: { q: i, r: 0 } })
      );

      const state1 = createCombatState({ tick: 1, units });

      stateCallback(state1);

      const damagedUnits = units.map(u =>
        createUnit(u.unitId, { health: 75, position: u.position })
      );

      const state2 = createCombatState({ tick: 2, units: damagedUnits });

      const startTime = performance.now();
      stateCallback(state2);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(50); // Should process in < 50ms
      expect(manager.getHealthBars().size).toBe(20);
    });
  });
});
