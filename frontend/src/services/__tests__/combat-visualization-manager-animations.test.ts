/**
 * TASK-SPAWN-005: Combat Visualization Manager - Animation Transitions Tests
 *
 * Test-driven development for server-driven animation transitions.
 * Detects position changes and triggers WALK/IDLE animations accordingly.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CombatVisualizationManager } from '../combat-visualization-manager';
import { AnimationState } from '../unit-animation-state-machine';
import type { CombatState, CombatCreature } from '@drawn-of-war/shared/src/types/combat';
import type { HexCoordinate } from '@drawn-of-war/shared/src/types/common';

// Mock the socket client
const mockSocketClient = {
  onCombatState: vi.fn(),
  onCombatCompleted: vi.fn(),
  onError: vi.fn(),
  disconnect: vi.fn()
};

// Mock PixiJS stage
const mockStage = {
  addChild: vi.fn(),
  removeChild: vi.fn(),
  children: []
};

// Mock grid renderer
const mockGridRenderer = {
  getSpriteAt: vi.fn(),
  getActiveSprites: vi.fn(() => new Map()),
  getStage: vi.fn(() => mockStage),
  hexToPixel: vi.fn((hex: HexCoordinate) => ({ x: hex.q * 50, y: hex.r * 50 })),
  renderCreature: vi.fn(() => Promise.resolve())
};

// Helper to create minimal CombatCreature
function createUnit(overrides: Partial<CombatCreature> = {}): CombatCreature {
  return {
    unitId: 'unit-1',
    creatureId: 'creature-1',
    ownerId: 'player1',
    position: { q: 0, r: 0 },
    deploymentPosition: { q: 0, r: 0 },
    health: 100,
    maxHealth: 100,
    status: 'alive',
    currentTarget: undefined,
    movementPath: [],
    facingDirection: 0,
    attackCooldownRemaining: 0,
    stats: {
      damage: 10,
      armor: 5,
      speed: 2,
      maxHealth: 100,
      attackSpeed: 1,
      range: 1,
      abilities: []
    },
    activeBuffs: [],
    activeDebuffs: [],
    ...overrides
  } as CombatCreature;
}

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
  } as CombatState;
}

describe('CombatVisualizationManager - Animation Transitions', () => {
  let manager: CombatVisualizationManager;
  let stateCallback: (state: CombatState) => Promise<void>;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new CombatVisualizationManager(
      mockSocketClient as any,
      mockGridRenderer as any
    );

    // Capture the state callback
    stateCallback = mockSocketClient.onCombatState.mock.calls[0][0];
  });

  afterEach(() => {
    if (manager) {
      manager.destroy();
    }
  });

  describe('Position Change Detection', () => {
    it('detect when unit position changes', async () => {
      const unit = createUnit({ unitId: 'unit-1', position: { q: 0, r: 0 } });
      const state1 = createCombatState({ tick: 1, units: [unit] });

      stateCallback(state1);

      const movedUnit = createUnit({ unitId: 'unit-1', position: { q: 1, r: 1 } });
      const state2 = createCombatState({ tick: 2, units: [movedUnit] });

      expect(() => stateCallback(state2)).not.toThrow();
    });

    it('trigger WALK animation on position change', async () => {
      const stateMachine = manager.getAnimationStateMachine();
      const unit = createUnit({ unitId: 'unit-1', position: { q: 0, r: 0 } });

      await stateCallback(createCombatState({ tick: 1, units: [unit] }));

      const movedUnit = createUnit({ unitId: 'unit-1', position: { q: 1, r: 1 } });
      await stateCallback(createCombatState({ tick: 2, units: [movedUnit] }));

      expect(stateMachine.getState('unit-1')).toBe(AnimationState.WALK);
    });

    it('handle multiple units changing position', async () => {
      const stateMachine = manager.getAnimationStateMachine();
      const units = [
        createUnit({ unitId: 'unit-1', position: { q: 0, r: 0 } }),
        createUnit({ unitId: 'unit-2', position: { q: 2, r: 2 } })
      ];

      await stateCallback(createCombatState({ tick: 1, units }));

      const movedUnits = [
        createUnit({ unitId: 'unit-1', position: { q: 1, r: 1 } }),
        createUnit({ unitId: 'unit-2', position: { q: 3, r: 3 } })
      ];
      await stateCallback(createCombatState({ tick: 2, units: movedUnits }));

      expect(stateMachine.getState('unit-1')).toBe(AnimationState.WALK);
      expect(stateMachine.getState('unit-2')).toBe(AnimationState.WALK);
    });

    it('handle unit moving every tick', async () => {
      const stateMachine = manager.getAnimationStateMachine();
      const unit1 = createUnit({ unitId: 'unit-1', position: { q: 0, r: 0 } });

      await stateCallback(createCombatState({ tick: 1, units: [unit1] }));

      for (let i = 1; i <= 5; i++) {
        const movedUnit = createUnit({
          unitId: 'unit-1',
          position: { q: i, r: i }
        });
        await stateCallback(createCombatState({ tick: i + 1, units: [movedUnit] }));

        expect(stateMachine.getState('unit-1')).toBe(AnimationState.WALK);
      }
    });

    it('not trigger animation on same position', async () => {
      const stateMachine = manager.getAnimationStateMachine();
      const unit = createUnit({ unitId: 'unit-1', position: { q: 0, r: 0 } });

      await stateCallback(createCombatState({ tick: 1, units: [unit] }));
      const initialState = stateMachine.getState('unit-1');

      // Same position
      await stateCallback(createCombatState({ tick: 2, units: [unit] }));

      expect(stateMachine.getState('unit-1')).toBe(initialState);
    });
  });

  describe('Stationary Detection', () => {
    it('detect when unit stationary for 2 ticks', async () => {
      const unit = createUnit({ unitId: 'unit-1', position: { q: 5, r: 5 } });

      await stateCallback(createCombatState({ tick: 1, units: [unit] }));
      await stateCallback(createCombatState({ tick: 2, units: [unit] }));
      await stateCallback(createCombatState({ tick: 3, units: [unit] }));

      // Unit was stationary for 2+ ticks
      expect(manager.getAnimationStateMachine().getState('unit-1')).toBe(AnimationState.IDLE);
    });

    it('trigger IDLE animation when stationary', async () => {
      const stateMachine = manager.getAnimationStateMachine();
      const unit = createUnit({ unitId: 'unit-1', position: { q: 0, r: 0 } });

      // Move first
      await stateCallback(createCombatState({ tick: 1, units: [unit] }));
      const movedUnit = createUnit({ unitId: 'unit-1', position: { q: 1, r: 1 } });
      await stateCallback(createCombatState({ tick: 2, units: [movedUnit] }));

      expect(stateMachine.getState('unit-1')).toBe(AnimationState.WALK);

      // Now stay stationary for 2 ticks
      await stateCallback(createCombatState({ tick: 3, units: [movedUnit] }));
      await stateCallback(createCombatState({ tick: 4, units: [movedUnit] }));

      expect(stateMachine.getState('unit-1')).toBe(AnimationState.IDLE);
    });

    it('not trigger IDLE if stationary for only 1 tick', async () => {
      const stateMachine = manager.getAnimationStateMachine();
      const unit = createUnit({ unitId: 'unit-1', position: { q: 0, r: 0 } });

      await stateCallback(createCombatState({ tick: 1, units: [unit] }));
      const movedUnit = createUnit({ unitId: 'unit-1', position: { q: 1, r: 1 } });
      await stateCallback(createCombatState({ tick: 2, units: [movedUnit] }));

      expect(stateMachine.getState('unit-1')).toBe(AnimationState.WALK);

      // Stationary for only 1 tick
      await stateCallback(createCombatState({ tick: 3, units: [movedUnit] }));

      expect(stateMachine.getState('unit-1')).toBe(AnimationState.WALK);
    });

    it('handle unit stopping then moving again', async () => {
      const stateMachine = manager.getAnimationStateMachine();
      const unit = createUnit({ unitId: 'unit-1', position: { q: 0, r: 0 } });

      await stateCallback(createCombatState({ tick: 1, units: [unit] }));

      // Move
      const pos1 = createUnit({ unitId: 'unit-1', position: { q: 1, r: 1 } });
      await stateCallback(createCombatState({ tick: 2, units: [pos1] }));
      expect(stateMachine.getState('unit-1')).toBe(AnimationState.WALK);

      // Stop for 2 ticks
      await stateCallback(createCombatState({ tick: 3, units: [pos1] }));
      await stateCallback(createCombatState({ tick: 4, units: [pos1] }));
      expect(stateMachine.getState('unit-1')).toBe(AnimationState.IDLE);

      // Move again
      const pos2 = createUnit({ unitId: 'unit-1', position: { q: 2, r: 2 } });
      await stateCallback(createCombatState({ tick: 5, units: [pos2] }));
      expect(stateMachine.getState('unit-1')).toBe(AnimationState.WALK);
    });
  });

  describe('Unit Spawn Handling', () => {
    it('detect newly spawned unit', async () => {
      // Start with empty state
      await stateCallback(createCombatState({ tick: 1, units: [] }));

      // Unit spawns
      const unit = createUnit({ unitId: 'unit-1', position: { q: 0, r: 0 } });
      await stateCallback(createCombatState({ tick: 2, units: [unit] }));

      expect(manager.getAnimationStateMachine().getState('unit-1')).toBeDefined();
    });

    it('initialize unit in IDLE state', async () => {
      const stateMachine = manager.getAnimationStateMachine();

      await stateCallback(createCombatState({ tick: 1, units: [] }));

      const unit = createUnit({ unitId: 'unit-1', position: { q: 0, r: 0 } });
      await stateCallback(createCombatState({ tick: 2, units: [unit] }));

      expect(stateMachine.getState('unit-1')).toBe(AnimationState.IDLE);
    });

    it('handle multiple units spawning simultaneously', async () => {
      const stateMachine = manager.getAnimationStateMachine();

      await stateCallback(createCombatState({ tick: 1, units: [] }));

      const units = [
        createUnit({ unitId: 'unit-1', position: { q: 0, r: 0 } }),
        createUnit({ unitId: 'unit-2', position: { q: 1, r: 1 } }),
        createUnit({ unitId: 'unit-3', position: { q: 2, r: 2 } })
      ];
      await stateCallback(createCombatState({ tick: 2, units }));

      expect(stateMachine.getState('unit-1')).toBe(AnimationState.IDLE);
      expect(stateMachine.getState('unit-2')).toBe(AnimationState.IDLE);
      expect(stateMachine.getState('unit-3')).toBe(AnimationState.IDLE);
    });
  });

  describe('Edge Cases', () => {
    it('handle first state update (no previous state)', async () => {
      const unit = createUnit({ unitId: 'unit-1', position: { q: 0, r: 0 } });

      await expect(stateCallback(createCombatState({ tick: 1, units: [unit] }))).resolves.not.toThrow();
    });

    it('handle unit despawning', async () => {
      const stateMachine = manager.getAnimationStateMachine();
      const unit = createUnit({ unitId: 'unit-1', position: { q: 0, r: 0 } });

      await stateCallback(createCombatState({ tick: 1, units: [unit] }));
      expect(stateMachine.getState('unit-1')).toBeDefined();

      // Unit despawns
      await stateCallback(createCombatState({ tick: 2, units: [] }));

      // State machine should still track the unit (not cleaned up yet)
      // This is handled by cleanup logic elsewhere
    });

    it('handle state with no position changes', async () => {
      const stateMachine = manager.getAnimationStateMachine();
      const units = [
        createUnit({ unitId: 'unit-1', position: { q: 0, r: 0 } }),
        createUnit({ unitId: 'unit-2', position: { q: 1, r: 1 } })
      ];

      await stateCallback(createCombatState({ tick: 1, units }));
      await stateCallback(createCombatState({ tick: 2, units }));
      await stateCallback(createCombatState({ tick: 3, units }));

      // Both should be IDLE after 2 ticks
      expect(stateMachine.getState('unit-1')).toBe(AnimationState.IDLE);
      expect(stateMachine.getState('unit-2')).toBe(AnimationState.IDLE);
    });

    it('handle rapid state updates (high tick rate)', async () => {
      const stateMachine = manager.getAnimationStateMachine();
      const unit = createUnit({ unitId: 'unit-1', position: { q: 0, r: 0 } });

      await stateCallback(createCombatState({ tick: 1, units: [unit] }));

      // Rapid updates with position changes
      const startTime = performance.now();
      for (let i = 2; i <= 100; i++) {
        const movedUnit = createUnit({
          unitId: 'unit-1',
          position: { q: i % 10, r: i % 10 }
        });
        await stateCallback(createCombatState({ tick: i, units: [movedUnit] }));
      }
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(100); // Should process 100 states in < 100ms
      expect(stateMachine.getState('unit-1')).toBeDefined();
    });

    it('handle null/undefined gracefully', async () => {
      expect(() => stateCallback(null as any)).not.toThrow();
      expect(() => stateCallback(undefined as any)).not.toThrow();
    });
  });

  describe('Integration with AnimationStateMachine', () => {
    it('create animation state machine on initialization', async () => {
      expect(manager.getAnimationStateMachine()).toBeDefined();
    });

    it('register units with animation state machine', async () => {
      const stateMachine = manager.getAnimationStateMachine();
      const unit = createUnit({ unitId: 'unit-1', position: { q: 0, r: 0 } });

      await stateCallback(createCombatState({ tick: 1, units: [unit] }));

      expect(stateMachine.getState('unit-1')).toBeDefined();
    });

    it('handle animation state machine returning null for unknown unit', async () => {
      const stateMachine = manager.getAnimationStateMachine();

      expect(stateMachine.getState('unknown-unit')).toBeNull();
    });
  });

  describe('Attack Priority Over Movement', () => {
    it('prioritize ATTACK over WALK for moving attacking unit', async () => {
      const stateMachine = manager.getAnimationStateMachine();
      const unit = createUnit({
        unitId: 'unit-1',
        position: { q: 0, r: 0 },
        currentTarget: undefined
      });

      await stateCallback(createCombatState({ tick: 1, units: [unit] }));

      // Unit moves AND starts attacking
      const attackingUnit = createUnit({
        unitId: 'unit-1',
        position: { q: 1, r: 1 },
        currentTarget: 'unit-2' // IS attacking
      });
      await stateCallback(createCombatState({ tick: 2, units: [attackingUnit] }));

      // Should show ATTACK, not WALK
      expect(stateMachine.getState('unit-1')).toBe(AnimationState.ATTACK);
    });

    it('show WALK when moving but not attacking', async () => {
      const stateMachine = manager.getAnimationStateMachine();
      const unit = createUnit({
        unitId: 'unit-1',
        position: { q: 0, r: 0 },
        currentTarget: undefined
      });

      await stateCallback(createCombatState({ tick: 1, units: [unit] }));

      // Unit moves but NOT attacking
      const movingUnit = createUnit({
        unitId: 'unit-1',
        position: { q: 1, r: 1 },
        currentTarget: undefined
      });
      await stateCallback(createCombatState({ tick: 2, units: [movingUnit] }));

      expect(stateMachine.getState('unit-1')).toBe(AnimationState.WALK);
    });
  });
});
