/**
 * TASK-VIZ-020: Damage Number Integration Tests
 *
 * Test-driven development for integrating damage numbers into the visualization manager.
 * Damage numbers appear on damage/healing events and animate upward with fade out.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
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
  getActiveSprites: vi.fn(() => new Map()),
  getStage: vi.fn(() => mockStage)
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

describe('Damage Number Integration', () => {
  let manager: CombatVisualizationManager;
  let stateCallback: (state: CombatState) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    manager = new CombatVisualizationManager(
      mockSocketClient as any,
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

  describe('Damage Number Creation', () => {
    it('should create damage number when unit takes damage', () => {
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

      const damageNumbers = manager.getActiveDamageNumbers();
      expect(damageNumbers.length).toBeGreaterThan(0);
      expect(damageNumbers[0].value).toBe(25);
    });

    it('should position damage number at unit sprite location', () => {
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
        units: [createUnit('unit1', { health: 80 })]
      });

      stateCallback(state2);

      const damageNumbers = manager.getActiveDamageNumbers();
      expect(damageNumbers[0].container.x).toBe(500);
      expect(damageNumbers[0].container.y).toBe(300);
    });

    it('should create healing number when unit is healed', () => {
      const state1 = createCombatState({
        tick: 1,
        units: [createUnit('unit1', { health: 50, maxHealth: 100 })]
      });

      stateCallback(state1);

      const state2 = createCombatState({
        tick: 2,
        units: [createUnit('unit1', { health: 75, maxHealth: 100 })]
      });

      stateCallback(state2);

      const damageNumbers = manager.getActiveDamageNumbers();
      expect(damageNumbers.length).toBeGreaterThan(0);
      expect(damageNumbers[0].value).toBe(25);
      expect(damageNumbers[0].type).toBe('heal');
    });

    it('should not create damage number for units at full health staying at full health', () => {
      const state1 = createCombatState({
        tick: 1,
        units: [createUnit('unit1', { health: 100, maxHealth: 100 })]
      });

      stateCallback(state1);

      const state2 = createCombatState({
        tick: 2,
        units: [createUnit('unit1', { health: 100, maxHealth: 100 })]
      });

      stateCallback(state2);

      const damageNumbers = manager.getActiveDamageNumbers();
      expect(damageNumbers.length).toBe(0);
    });
  });

  describe('Multiple Damage Numbers', () => {
    it('should create damage numbers for multiple units', () => {
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
          createUnit('unit1', { health: 75 }),  // -25
          createUnit('unit2', { health: 60 }),  // -40
          createUnit('unit3', { health: 100 })  // No change
        ]
      });

      stateCallback(state2);

      const damageNumbers = manager.getActiveDamageNumbers();
      expect(damageNumbers.length).toBe(2); // unit1 and unit2
    });

    it('should create separate damage numbers for consecutive hits', () => {
      const state1 = createCombatState({
        tick: 1,
        units: [createUnit('unit1', { health: 100 })]
      });

      stateCallback(state1);

      const state2 = createCombatState({
        tick: 2,
        units: [createUnit('unit1', { health: 80 })]
      });

      stateCallback(state2);

      const state3 = createCombatState({
        tick: 3,
        units: [createUnit('unit1', { health: 60 })]
      });

      stateCallback(state3);

      const damageNumbers = manager.getActiveDamageNumbers();
      expect(damageNumbers.length).toBe(2); // Two separate damage numbers
    });
  });

  describe('Animation and Cleanup', () => {
    it('should animate damage numbers over time', () => {
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

      const damageNumbers = manager.getActiveDamageNumbers();
      const initialY = damageNumbers[0].container.y;

      // Advance time and update
      vi.advanceTimersByTime(500);
      manager.updateDamageNumbers(0.5);

      // Y position should have moved up
      expect(damageNumbers[0].container.y).toBeLessThan(initialY);
    });

    it('should remove damage numbers after animation completes', () => {
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

      expect(manager.getActiveDamageNumbers().length).toBe(1);

      // Advance time past animation duration (1 second)
      vi.advanceTimersByTime(1100);
      manager.updateDamageNumbers(1.1);

      expect(manager.getActiveDamageNumbers().length).toBe(0);
    });

    it('should fade out damage numbers as they animate', () => {
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

      const damageNumbers = manager.getActiveDamageNumbers();
      expect(damageNumbers[0].container.alpha).toBe(1.0);

      // Advance to 70% through animation (fade starts at 60%)
      vi.advanceTimersByTime(700);
      manager.updateDamageNumbers(0.7);

      // Should have faded
      expect(damageNumbers[0].container.alpha).toBeLessThan(1.0);
      expect(damageNumbers[0].container.alpha).toBeGreaterThan(0);
    });
  });

  describe('Object Pool Integration', () => {
    it('should reuse damage number objects from pool', () => {
      const state1 = createCombatState({
        tick: 1,
        units: [createUnit('unit1', { health: 100 })]
      });

      stateCallback(state1);

      // Create first damage number
      const state2 = createCombatState({
        tick: 2,
        units: [createUnit('unit1', { health: 75 })]
      });

      stateCallback(state2);

      const firstDamageNumber = manager.getActiveDamageNumbers()[0];

      // Complete animation
      vi.advanceTimersByTime(1100);
      manager.updateDamageNumbers(1.1);

      // Create second damage number
      const state3 = createCombatState({
        tick: 3,
        units: [createUnit('unit1', { health: 50 })]
      });

      stateCallback(state3);

      const secondDamageNumber = manager.getActiveDamageNumbers()[0];

      // Should be same object instance (pooled)
      expect(secondDamageNumber).toBe(firstDamageNumber);
    });

    it('should track pool statistics', () => {
      const state1 = createCombatState({
        tick: 1,
        units: [createUnit('unit1', { health: 100 })]
      });

      stateCallback(state1);

      // Create and complete several damage numbers
      for (let i = 0; i < 5; i++) {
        const state = createCombatState({
          tick: i + 2,
          units: [createUnit('unit1', { health: 100 - (i + 1) * 10 })]
        });

        stateCallback(state);

        vi.advanceTimersByTime(1100);
        manager.updateDamageNumbers(1.1);
      }

      const stats = manager.getDamageNumberPoolStats();
      expect(stats.totalAcquisitions).toBe(5);
      expect(stats.reuseCount).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    it('should handle 20 simultaneous damage numbers efficiently', () => {
      const units = Array.from({ length: 20 }, (_, i) =>
        createUnit(`unit${i}`, { health: 100, position: { q: i, r: 0 } })
      );

      const state1 = createCombatState({ tick: 1, units });

      stateCallback(state1);

      const damagedUnits = units.map((u, i) =>
        createUnit(u.unitId, { health: 75, position: { q: i, r: 0 } })
      );

      const state2 = createCombatState({ tick: 2, units: damagedUnits });

      const startTime = performance.now();
      stateCallback(state2);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(50); // Should process in < 50ms
      expect(manager.getActiveDamageNumbers().length).toBe(20);
    });
  });
});
