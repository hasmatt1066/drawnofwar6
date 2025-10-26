/**
 * TASK-SPAWN-007, TASK-SPAWN-008, TASK-SPAWN-009: Spawn Edge Case Tests
 *
 * Test-driven development for spawn-to-battle edge cases:
 * - TASK-SPAWN-007: Unit already in position (no movement needed)
 * - TASK-SPAWN-008: Late position updates (unit spawned but position update delayed)
 * - TASK-SPAWN-009: Death during spawn (unit dies while spawning)
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
  renderCreature: vi.fn(() => Promise.resolve()),
  supportsAnimations: vi.fn(() => false)
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

describe('Spawn Edge Cases', () => {
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

  describe('TASK-SPAWN-007: Already in Position', () => {
    it('should stay IDLE when unit spawns at final position', async () => {
      const stateMachine = manager.getAnimationStateMachine();

      // Unit spawns already at combat position (deploymentPosition === position)
      const unit = createUnit({
        unitId: 'unit-1',
        position: { q: 5, r: 5 },
        deploymentPosition: { q: 5, r: 5 }, // Same as position
        currentTarget: undefined
      });

      await stateCallback(createCombatState({ tick: 1, units: [unit] }));

      // Should be IDLE, not WALK
      expect(stateMachine.getState('unit-1')).toBe(AnimationState.IDLE);
    });

    it('should transition to ATTACK if spawned in position and attacking', async () => {
      const stateMachine = manager.getAnimationStateMachine();

      const unit = createUnit({
        unitId: 'unit-1',
        position: { q: 5, r: 5 },
        deploymentPosition: { q: 5, r: 5 },
        currentTarget: 'unit-2' // IS attacking
      });

      await stateCallback(createCombatState({ tick: 1, units: [unit] }));

      // Should transition to ATTACK immediately
      expect(stateMachine.getState('unit-1')).toBe(AnimationState.ATTACK);
    });

    it('should not show WALK animation for already-in-position unit', async () => {
      const stateMachine = manager.getAnimationStateMachine();

      const unit = createUnit({
        position: { q: 5, r: 5 },
        deploymentPosition: { q: 5, r: 5 }
      });

      await stateCallback(createCombatState({ tick: 1, units: [unit] }));
      await stateCallback(createCombatState({ tick: 2, units: [unit] }));
      await stateCallback(createCombatState({ tick: 3, units: [unit] }));

      // Should remain IDLE, never WALK
      expect(stateMachine.getState('unit-1')).toBe(AnimationState.IDLE);
    });

    it('should handle multiple units all in position', async () => {
      const stateMachine = manager.getAnimationStateMachine();

      const units = [
        createUnit({ unitId: 'unit-1', position: { q: 5, r: 5 }, deploymentPosition: { q: 5, r: 5 } }),
        createUnit({ unitId: 'unit-2', position: { q: 6, r: 6 }, deploymentPosition: { q: 6, r: 6 } }),
        createUnit({ unitId: 'unit-3', position: { q: 7, r: 7 }, deploymentPosition: { q: 7, r: 7 } })
      ];

      await stateCallback(createCombatState({ tick: 1, units }));

      expect(stateMachine.getState('unit-1')).toBe(AnimationState.IDLE);
      expect(stateMachine.getState('unit-2')).toBe(AnimationState.IDLE);
      expect(stateMachine.getState('unit-3')).toBe(AnimationState.IDLE);
    });

    it('should handle mixed case: some in position, some not', async () => {
      const stateMachine = manager.getAnimationStateMachine();

      const units = [
        createUnit({ unitId: 'unit-1', position: { q: 5, r: 5 }, deploymentPosition: { q: 5, r: 5 } }), // In position
        createUnit({ unitId: 'unit-2', position: { q: 6, r: 6 }, deploymentPosition: { q: 0, r: 0 } })  // Not in position
      ];

      await stateCallback(createCombatState({ tick: 1, units }));

      expect(stateMachine.getState('unit-1')).toBe(AnimationState.IDLE); // Already in position
      expect(stateMachine.getState('unit-2')).toBe(AnimationState.IDLE); // Will move later
    });
  });

  describe('TASK-SPAWN-008: Late Position Updates', () => {
    it('should stay IDLE when waiting for position update', async () => {
      const stateMachine = manager.getAnimationStateMachine();

      // Unit spawns but server hasn't sent position update yet
      const unit = createUnit({
        unitId: 'unit-1',
        position: { q: 0, r: 0 },
        deploymentPosition: { q: 0, r: 0 },
        movementPath: [] // No path yet
      });

      await stateCallback(createCombatState({ tick: 1, units: [unit] }));

      // Should stay IDLE until position changes
      expect(stateMachine.getState('unit-1')).toBe(AnimationState.IDLE);
    });

    it('should transition to WALK when position update arrives', async () => {
      const stateMachine = manager.getAnimationStateMachine();

      // Spawn at deployment
      const unit1 = createUnit({
        unitId: 'unit-1',
        position: { q: 0, r: 0 },
        deploymentPosition: { q: 0, r: 0 }
      });

      await stateCallback(createCombatState({ tick: 1, units: [unit1] }));
      expect(stateMachine.getState('unit-1')).toBe(AnimationState.IDLE);

      // Position update arrives (late)
      const unit2 = createUnit({
        unitId: 'unit-1',
        position: { q: 5, r: 5 }, // Moved
        deploymentPosition: { q: 0, r: 0 }
      });

      await stateCallback(createCombatState({ tick: 2, units: [unit2] }));

      // Should now be WALK
      expect(stateMachine.getState('unit-1')).toBe(AnimationState.WALK);
    });

    it('should handle delayed position update after multiple ticks', async () => {
      const stateMachine = manager.getAnimationStateMachine();

      const unitStatic = createUnit({
        unitId: 'unit-1',
        position: { q: 0, r: 0 },
        deploymentPosition: { q: 0, r: 0 }
      });

      // Unit stays at spawn for 5 ticks (late update)
      await stateCallback(createCombatState({ tick: 1, units: [unitStatic] }));
      await stateCallback(createCombatState({ tick: 2, units: [unitStatic] }));
      await stateCallback(createCombatState({ tick: 3, units: [unitStatic] }));
      await stateCallback(createCombatState({ tick: 4, units: [unitStatic] }));
      await stateCallback(createCombatState({ tick: 5, units: [unitStatic] }));

      expect(stateMachine.getState('unit-1')).toBe(AnimationState.IDLE);

      // Finally moves
      const unitMoved = createUnit({
        unitId: 'unit-1',
        position: { q: 5, r: 5 },
        deploymentPosition: { q: 0, r: 0 }
      });

      await stateCallback(createCombatState({ tick: 6, units: [unitMoved] }));

      expect(stateMachine.getState('unit-1')).toBe(AnimationState.WALK);
    });

    it('should not show false WALK animation during delayed updates', async () => {
      const stateMachine = manager.getAnimationStateMachine();

      const unit = createUnit({
        position: { q: 0, r: 0 },
        deploymentPosition: { q: 0, r: 0 }
      });

      // Wait 3 ticks with no movement
      await stateCallback(createCombatState({ tick: 1, units: [unit] }));
      await stateCallback(createCombatState({ tick: 2, units: [unit] }));
      await stateCallback(createCombatState({ tick: 3, units: [unit] }));

      // Unit should be IDLE throughout (no false WALK)
      expect(stateMachine.getState('unit-1')).toBe(AnimationState.IDLE);
    });
  });

  describe('TASK-SPAWN-009: Death During Spawn', () => {
    it('should transition to DEATH when unit dies while spawning', async () => {
      const stateMachine = manager.getAnimationStateMachine();

      // Unit spawns healthy
      const unitAlive = createUnit({
        unitId: 'unit-1',
        position: { q: 0, r: 0 },
        deploymentPosition: { q: 0, r: 0 },
        health: 100,
        status: 'alive'
      });

      await stateCallback(createCombatState({ tick: 1, units: [unitAlive] }));
      expect(stateMachine.getState('unit-1')).toBe(AnimationState.IDLE);

      // Unit dies before reaching combat position
      const unitDead = createUnit({
        unitId: 'unit-1',
        position: { q: 0, r: 0 }, // Still at spawn
        deploymentPosition: { q: 0, r: 0 },
        health: 0,
        status: 'dead'
      });

      await stateCallback(createCombatState({ tick: 2, units: [unitDead] }));

      // Should transition to DEATH immediately
      expect(stateMachine.getState('unit-1')).toBe(AnimationState.DEATH);
    });

    it('should prioritize DEATH over WALK for dying moving unit', async () => {
      const stateMachine = manager.getAnimationStateMachine();

      // Unit starts moving
      const unitMoving = createUnit({
        unitId: 'unit-1',
        position: { q: 1, r: 1 },
        deploymentPosition: { q: 0, r: 0 },
        health: 100,
        status: 'alive'
      });

      await stateCallback(createCombatState({ tick: 1, units: [unitMoving] }));

      // Unit dies mid-movement
      const unitDead = createUnit({
        unitId: 'unit-1',
        position: { q: 2, r: 2 }, // Moved further
        deploymentPosition: { q: 0, r: 0 },
        health: 0,
        status: 'dead'
      });

      await stateCallback(createCombatState({ tick: 2, units: [unitDead] }));

      // DEATH has highest priority
      expect(stateMachine.getState('unit-1')).toBe(AnimationState.DEATH);
    });

    it('should handle unit dying at spawn before first movement', async () => {
      const stateMachine = manager.getAnimationStateMachine();

      // Unit spawns
      const unit1 = createUnit({
        position: { q: 0, r: 0 },
        deploymentPosition: { q: 0, r: 0 },
        health: 100,
        status: 'alive'
      });

      await stateCallback(createCombatState({ tick: 1, units: [unit1] }));
      expect(stateMachine.getState('unit-1')).toBe(AnimationState.IDLE);

      // Dies immediately
      const unit2 = createUnit({
        position: { q: 0, r: 0 },
        deploymentPosition: { q: 0, r: 0 },
        health: 0,
        status: 'dead'
      });

      await stateCallback(createCombatState({ tick: 2, units: [unit2] }));

      expect(stateMachine.getState('unit-1')).toBe(AnimationState.DEATH);
    });

    it('should handle multiple units dying during spawn', async () => {
      const stateMachine = manager.getAnimationStateMachine();

      const unitsAlive = [
        createUnit({ unitId: 'unit-1', health: 100, status: 'alive' }),
        createUnit({ unitId: 'unit-2', health: 100, status: 'alive' }),
        createUnit({ unitId: 'unit-3', health: 100, status: 'alive' })
      ];

      await stateCallback(createCombatState({ tick: 1, units: unitsAlive }));

      // All die
      const unitsDead = [
        createUnit({ unitId: 'unit-1', health: 0, status: 'dead' }),
        createUnit({ unitId: 'unit-2', health: 0, status: 'dead' }),
        createUnit({ unitId: 'unit-3', health: 0, status: 'dead' })
      ];

      await stateCallback(createCombatState({ tick: 2, units: unitsDead }));

      expect(stateMachine.getState('unit-1')).toBe(AnimationState.DEATH);
      expect(stateMachine.getState('unit-2')).toBe(AnimationState.DEATH);
      expect(stateMachine.getState('unit-3')).toBe(AnimationState.DEATH);
    });

    it('should not revive dead units', async () => {
      const stateMachine = manager.getAnimationStateMachine();

      const unitAlive = createUnit({ health: 100, status: 'alive' });
      await stateCallback(createCombatState({ tick: 1, units: [unitAlive] }));

      const unitDead = createUnit({ health: 0, status: 'dead' });
      await stateCallback(createCombatState({ tick: 2, units: [unitDead] }));

      expect(stateMachine.getState('unit-1')).toBe(AnimationState.DEATH);

      // Try to move dead unit (shouldn't happen, but handle it)
      const unitDeadMoved = createUnit({
        health: 0,
        status: 'dead',
        position: { q: 5, r: 5 }
      });
      await stateCallback(createCombatState({ tick: 3, units: [unitDeadMoved] }));

      // Should remain DEATH
      expect(stateMachine.getState('unit-1')).toBe(AnimationState.DEATH);
    });
  });

  describe('Combined Edge Cases', () => {
    it('should handle unit in position that gets attacked and dies', async () => {
      const stateMachine = manager.getAnimationStateMachine();

      // Spawn in position
      const unit1 = createUnit({
        position: { q: 5, r: 5 },
        deploymentPosition: { q: 5, r: 5 },
        health: 100,
        status: 'alive'
      });

      await stateCallback(createCombatState({ tick: 1, units: [unit1] }));
      expect(stateMachine.getState('unit-1')).toBe(AnimationState.IDLE);

      // Gets attacked
      const unit2 = createUnit({
        position: { q: 5, r: 5 },
        deploymentPosition: { q: 5, r: 5 },
        health: 50,
        status: 'alive',
        currentTarget: 'unit-2' // Fights back
      });

      await stateCallback(createCombatState({ tick: 2, units: [unit2] }));
      expect(stateMachine.getState('unit-1')).toBe(AnimationState.ATTACK);

      // Dies
      const unit3 = createUnit({
        position: { q: 5, r: 5 },
        deploymentPosition: { q: 5, r: 5 },
        health: 0,
        status: 'dead'
      });

      await stateCallback(createCombatState({ tick: 3, units: [unit3] }));
      expect(stateMachine.getState('unit-1')).toBe(AnimationState.DEATH);
    });

    it('should handle late update followed by immediate death', async () => {
      const stateMachine = manager.getAnimationStateMachine();

      // Spawn
      const unit1 = createUnit({
        position: { q: 0, r: 0 },
        deploymentPosition: { q: 0, r: 0 },
        health: 100
      });

      await stateCallback(createCombatState({ tick: 1, units: [unit1] }));

      // Late update with movement AND death
      const unit2 = createUnit({
        position: { q: 5, r: 5 },
        deploymentPosition: { q: 0, r: 0 },
        health: 0,
        status: 'dead'
      });

      await stateCallback(createCombatState({ tick: 2, units: [unit2] }));

      // DEATH takes priority over WALK
      expect(stateMachine.getState('unit-1')).toBe(AnimationState.DEATH);
    });
  });
});
