/**
 * TASK-VIZ-022: Buff Icon Integration Tests
 *
 * Test-driven development for integrating buff/debuff icons into the visualization manager.
 * Icons appear above units and update as buffs are applied, expire, or change.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CombatVisualizationManager } from '../combat-visualization-manager';
import type { CombatState, CombatCreature, Buff, Debuff } from '@drawn-of-war/shared/src/types/combat';

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
    creatureId: 'warrior',
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

// Helper to create buff
function createBuff(id: string, overrides: Partial<Buff> = {}): Buff {
  return {
    buffId: id,
    name: 'Test Buff',
    appliedTick: 0,
    durationRemaining: 10,
    effects: {
      damageMultiplier: 1.5
    },
    ...overrides
  } as Buff;
}

// Helper to create debuff
function createDebuff(id: string, overrides: Partial<Debuff> = {}): Debuff {
  return {
    debuffId: id,
    name: 'Test Debuff',
    appliedTick: 0,
    durationRemaining: 5,
    effects: {
      damageReduction: 0.5
    },
    ...overrides
  } as Debuff;
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

describe('Buff Icon Integration', () => {
  let manager: CombatVisualizationManager;
  let stateCallback: (state: CombatState) => void;

  beforeEach(() => {
    vi.clearAllMocks();

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
  });

  describe('Buff Creation', () => {
    it('should create buff icon when buff appears on unit', () => {
      const state1 = createCombatState({
        tick: 1,
        units: [createUnit('unit1', { position: { q: 0, r: 0 }, activeBuffs: [] })]
      });

      stateCallback(state1);

      const state2 = createCombatState({
        tick: 2,
        units: [
          createUnit('unit1', {
            position: { q: 0, r: 0 },
            activeBuffs: [createBuff('buff1', { name: 'Haste' })]
          })
        ]
      });

      stateCallback(state2);

      const buffIcons = manager.getActiveBuffIcons();
      expect(buffIcons.length).toBeGreaterThan(0);
    });

    it('should create debuff icon when debuff appears on unit', () => {
      const state1 = createCombatState({
        tick: 1,
        units: [createUnit('unit1', { activeDebuffs: [] })]
      });

      stateCallback(state1);

      const state2 = createCombatState({
        tick: 2,
        units: [
          createUnit('unit1', {
            activeDebuffs: [createDebuff('debuff1', { name: 'Poison' })]
          })
        ]
      });

      stateCallback(state2);

      const buffIcons = manager.getActiveBuffIcons();
      expect(buffIcons.length).toBeGreaterThan(0);
    });

    it('should position buff icon above unit sprite', () => {
      mockGridRenderer.getSpriteAt.mockReturnValue({
        sprite: { x: 500, y: 300 },
        unitId: 'unit1'
      });

      const state = createCombatState({
        tick: 1,
        units: [
          createUnit('unit1', {
            position: { q: 5, r: 3 },
            activeBuffs: [createBuff('buff1')]
          })
        ]
      });

      stateCallback(state);

      const buffIcons = manager.getActiveBuffIcons();
      expect(buffIcons.length).toBeGreaterThan(0);
      // Icon should be above the unit (negative Y offset)
      expect(buffIcons[0].container.y).toBeLessThan(300);
    });

    it('should create multiple buff icons for unit with multiple buffs', () => {
      const state = createCombatState({
        tick: 1,
        units: [
          createUnit('unit1', {
            activeBuffs: [
              createBuff('buff1', { name: 'Haste' }),
              createBuff('buff2', { name: 'Shield' })
            ]
          })
        ]
      });

      stateCallback(state);

      const buffIcons = manager.getActiveBuffIcons();
      expect(buffIcons.length).toBe(2);
    });

    it('should arrange multiple icons horizontally', () => {
      const state = createCombatState({
        tick: 1,
        units: [
          createUnit('unit1', {
            position: { q: 0, r: 0 },
            activeBuffs: [
              createBuff('buff1'),
              createBuff('buff2'),
              createBuff('buff3')
            ]
          })
        ]
      });

      stateCallback(state);

      const buffIcons = manager.getActiveBuffIcons();
      expect(buffIcons.length).toBe(3);

      // Icons should have different X positions
      const xPositions = buffIcons.map(icon => icon.container.x);
      expect(new Set(xPositions).size).toBe(3);
    });
  });

  describe('Buff Updates', () => {
    it('should update buff duration as time progresses', () => {
      const state1 = createCombatState({
        tick: 1,
        units: [
          createUnit('unit1', {
            activeBuffs: [createBuff('buff1', { durationRemaining: 10 })]
          })
        ]
      });

      stateCallback(state1);

      const buffIcons = manager.getActiveBuffIcons();
      const initialDuration = buffIcons[0].duration;

      const state2 = createCombatState({
        tick: 2,
        units: [
          createUnit('unit1', {
            activeBuffs: [createBuff('buff1', { durationRemaining: 9 })]
          })
        ]
      });

      stateCallback(state2);

      const updatedIcons = manager.getActiveBuffIcons();
      expect(updatedIcons[0].duration).toBeLessThan(initialDuration!);
    });

    it('should track buff icon by ID across updates', () => {
      const state1 = createCombatState({
        tick: 1,
        units: [
          createUnit('unit1', {
            activeBuffs: [createBuff('buff1')]
          })
        ]
      });

      stateCallback(state1);

      const firstIcon = manager.getActiveBuffIcons()[0];

      const state2 = createCombatState({
        tick: 2,
        units: [
          createUnit('unit1', {
            activeBuffs: [createBuff('buff1', { durationRemaining: 8 })]
          })
        ]
      });

      stateCallback(state2);

      const secondIcon = manager.getActiveBuffIcons()[0];

      // Should be the same visual object
      expect(secondIcon.container).toBe(firstIcon.container);
    });

    it('should update icon position when unit moves', () => {
      const state1 = createCombatState({
        tick: 1,
        units: [
          createUnit('unit1', {
            position: { q: 0, r: 0 },
            activeBuffs: [createBuff('buff1')]
          })
        ]
      });

      stateCallback(state1);

      const initialIcons = manager.getActiveBuffIcons();
      const initialX = initialIcons[0].container.x;

      const state2 = createCombatState({
        tick: 2,
        units: [
          createUnit('unit1', {
            position: { q: 5, r: 0 },
            activeBuffs: [createBuff('buff1')]
          })
        ]
      });

      stateCallback(state2);

      const updatedIcons = manager.getActiveBuffIcons();
      expect(updatedIcons[0].container.x).not.toBe(initialX);
    });
  });

  describe('Buff Removal', () => {
    it('should remove buff icon when buff expires', () => {
      const state1 = createCombatState({
        tick: 1,
        units: [
          createUnit('unit1', {
            activeBuffs: [createBuff('buff1')]
          })
        ]
      });

      stateCallback(state1);

      expect(manager.getActiveBuffIcons().length).toBe(1);

      const state2 = createCombatState({
        tick: 2,
        units: [
          createUnit('unit1', {
            activeBuffs: [] // Buff expired
          })
        ]
      });

      stateCallback(state2);

      expect(manager.getActiveBuffIcons().length).toBe(0);
    });

    it('should remove specific buff while keeping others', () => {
      const state1 = createCombatState({
        tick: 1,
        units: [
          createUnit('unit1', {
            activeBuffs: [
              createBuff('buff1'),
              createBuff('buff2'),
              createBuff('buff3')
            ]
          })
        ]
      });

      stateCallback(state1);

      const state2 = createCombatState({
        tick: 2,
        units: [
          createUnit('unit1', {
            activeBuffs: [
              createBuff('buff1'),
              createBuff('buff3')
            ]
          })
        ]
      });

      stateCallback(state2);

      const buffIcons = manager.getActiveBuffIcons();
      expect(buffIcons.length).toBe(2);
    });

    it('should remove all buff icons when unit dies', () => {
      const state1 = createCombatState({
        tick: 1,
        units: [
          createUnit('unit1', {
            health: 50,
            status: 'alive',
            activeBuffs: [createBuff('buff1'), createBuff('buff2')]
          })
        ]
      });

      stateCallback(state1);

      expect(manager.getActiveBuffIcons().length).toBe(2);

      const state2 = createCombatState({
        tick: 2,
        units: [
          createUnit('unit1', {
            health: 0,
            status: 'dead',
            activeBuffs: []
          })
        ]
      });

      stateCallback(state2);

      expect(manager.getActiveBuffIcons().length).toBe(0);
    });
  });

  describe('Mixed Buffs and Debuffs', () => {
    it('should show both buffs and debuffs on same unit', () => {
      const state = createCombatState({
        tick: 1,
        units: [
          createUnit('unit1', {
            activeBuffs: [
              createBuff('buff1', { name: 'Haste' }),
              createBuff('buff2', { name: 'Shield' })
            ],
            activeDebuffs: [
              createDebuff('debuff1', { name: 'Poison' })
            ]
          })
        ]
      });

      stateCallback(state);

      const buffIcons = manager.getActiveBuffIcons();
      expect(buffIcons.length).toBe(3); // 2 buffs + 1 debuff
    });

    it('should distinguish between buff and debuff types', () => {
      const state = createCombatState({
        tick: 1,
        units: [
          createUnit('unit1', {
            activeBuffs: [createBuff('buff1', { name: 'Haste' })],
            activeDebuffs: [createDebuff('debuff1', { name: 'Poison' })]
          })
        ]
      });

      stateCallback(state);

      const buffIcons = manager.getActiveBuffIcons();
      expect(buffIcons.length).toBe(2);

      // Should have different types based on buff name
      const types = buffIcons.map(icon => icon.type);
      expect(new Set(types).size).toBeGreaterThan(1);
    });
  });

  describe('Multiple Units with Buffs', () => {
    it('should handle buffs on multiple units', () => {
      const state = createCombatState({
        tick: 1,
        units: [
          createUnit('unit1', {
            position: { q: 0, r: 0 },
            activeBuffs: [createBuff('buff1')]
          }),
          createUnit('unit2', {
            position: { q: 5, r: 0 },
            activeBuffs: [createBuff('buff2')]
          }),
          createUnit('unit3', {
            position: { q: 0, r: 5 },
            activeBuffs: [createBuff('buff3')]
          })
        ]
      });

      stateCallback(state);

      const buffIcons = manager.getActiveBuffIcons();
      expect(buffIcons.length).toBe(3);
    });

    it('should correctly associate icons with their units', () => {
      mockGridRenderer.getSpriteAt.mockImplementation((coord: any) => ({
        sprite: { x: coord.q * 100, y: coord.r * 100 },
        unitId: `unit-${coord.q}-${coord.r}`
      }));

      const state = createCombatState({
        tick: 1,
        units: [
          createUnit('unit1', {
            position: { q: 0, r: 0 },
            activeBuffs: [createBuff('buff1')]
          }),
          createUnit('unit2', {
            position: { q: 5, r: 0 },
            activeBuffs: [createBuff('buff2')]
          })
        ]
      });

      stateCallback(state);

      const buffIcons = manager.getActiveBuffIcons();

      // Icons should be near their respective units
      expect(buffIcons.length).toBe(2);

      // First icon near (0, 0)
      expect(Math.abs(buffIcons[0].container.x - 0)).toBeLessThan(50);

      // Second icon near (500, 0)
      expect(Math.abs(buffIcons[1].container.x - 500)).toBeLessThan(50);
    });
  });

  describe('Performance', () => {
    it('should efficiently handle 20 units with multiple buffs', () => {
      const units = Array.from({ length: 20 }, (_, i) =>
        createUnit(`unit${i}`, {
          position: { q: i, r: 0 },
          activeBuffs: [
            createBuff(`buff-${i}-1`),
            createBuff(`buff-${i}-2`)
          ]
        })
      );

      const state = createCombatState({
        tick: 1,
        units
      });

      const startTime = performance.now();
      stateCallback(state);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(100); // Should process in < 100ms
      expect(manager.getActiveBuffIcons().length).toBe(40); // 20 units * 2 buffs each
    });
  });

  describe('Cleanup', () => {
    it('should cleanup all buff icons on destroy', () => {
      const state = createCombatState({
        tick: 1,
        units: [
          createUnit('unit1', {
            activeBuffs: [createBuff('buff1'), createBuff('buff2')]
          })
        ]
      });

      stateCallback(state);

      manager.destroy();

      expect(manager.getActiveBuffIcons().length).toBe(0);
    });
  });
});
