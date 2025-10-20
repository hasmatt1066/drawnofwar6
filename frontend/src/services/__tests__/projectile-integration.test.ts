/**
 * TASK-VIZ-021: Projectile Integration Tests
 *
 * Test-driven development for integrating projectiles into the visualization manager.
 * Projectiles are created when they appear in state and animate from source to target.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CombatVisualizationManager } from '../combat-visualization-manager';
import type { CombatState, CombatCreature, Projectile } from '@drawn-of-war/shared/src/types/combat';

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
    creatureId: 'archer',
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
      range: 5,
      maxHealth: 100
    },
    activeBuffs: [],
    activeDebuffs: [],
    abilities: [],
    ...overrides
  } as CombatCreature;
}

// Helper to create projectile
function createProjectile(id: string, overrides: Partial<Projectile> = {}): Projectile {
  return {
    projectileId: id,
    sourceUnitId: 'unit1',
    targetUnitId: 'unit2',
    sourcePosition: { q: 0, r: 0 },
    targetPosition: { q: 5, r: 0 },
    currentPosition: { q: 2, r: 0 },
    speed: 10,
    spritePath: 'arrow.png',
    ...overrides
  } as Projectile;
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

describe('Projectile Integration', () => {
  let manager: CombatVisualizationManager;
  let stateCallback: (state: CombatState) => void;

  beforeEach(() => {
    vi.clearAllMocks();

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
  });

  describe('Projectile Creation', () => {
    it('should create visual projectile when projectile appears in state', () => {
      const state1 = createCombatState({
        tick: 1,
        units: [
          createUnit('unit1', { position: { q: 0, r: 0 } }),
          createUnit('unit2', { position: { q: 5, r: 0 } })
        ],
        projectiles: []
      });

      stateCallback(state1);

      const state2 = createCombatState({
        tick: 2,
        units: [
          createUnit('unit1', { position: { q: 0, r: 0 } }),
          createUnit('unit2', { position: { q: 5, r: 0 } })
        ],
        projectiles: [createProjectile('proj1')]
      });

      stateCallback(state2);

      const projectiles = manager.getActiveProjectiles();
      expect(projectiles.length).toBe(1);
      expect(projectiles[0].projectileId).toBe('proj1');
    });

    it('should position projectile at source position initially', () => {
      const state = createCombatState({
        tick: 1,
        units: [
          createUnit('unit1', { position: { q: 0, r: 0 } }),
          createUnit('unit2', { position: { q: 5, r: 0 } })
        ],
        projectiles: [createProjectile('proj1', {
          sourcePosition: { q: 0, r: 0 },
          targetPosition: { q: 5, r: 0 },
          currentPosition: { q: 0, r: 0 }
        })]
      });

      stateCallback(state);

      const projectiles = manager.getActiveProjectiles();
      expect(projectiles[0].sprite.x).toBe(0);
      expect(projectiles[0].sprite.y).toBe(0);
    });

    it('should create multiple projectiles', () => {
      const state = createCombatState({
        tick: 1,
        projectiles: [
          createProjectile('proj1'),
          createProjectile('proj2'),
          createProjectile('proj3')
        ]
      });

      stateCallback(state);

      const projectiles = manager.getActiveProjectiles();
      expect(projectiles.length).toBe(3);
    });
  });

  describe('Projectile Updates', () => {
    it('should update projectile position as it moves in state', () => {
      const state1 = createCombatState({
        tick: 1,
        projectiles: [createProjectile('proj1', {
          currentPosition: { q: 0, r: 0 }
        })]
      });

      stateCallback(state1);

      const state2 = createCombatState({
        tick: 2,
        projectiles: [createProjectile('proj1', {
          currentPosition: { q: 2, r: 0 }
        })]
      });

      stateCallback(state2);

      const projectiles = manager.getActiveProjectiles();
      expect(projectiles[0].sprite.x).toBe(200);
      expect(projectiles[0].sprite.y).toBe(0);
    });

    it('should track projectile by ID across updates', () => {
      const state1 = createCombatState({
        tick: 1,
        projectiles: [createProjectile('proj1')]
      });

      stateCallback(state1);

      const firstProjectile = manager.getActiveProjectiles()[0];

      const state2 = createCombatState({
        tick: 2,
        projectiles: [createProjectile('proj1', {
          currentPosition: { q: 3, r: 0 }
        })]
      });

      stateCallback(state2);

      const secondProjectile = manager.getActiveProjectiles()[0];

      // Should be the same visual object
      expect(secondProjectile.sprite).toBe(firstProjectile.sprite);
    });
  });

  describe('Projectile Removal', () => {
    it('should remove projectile when it disappears from state', () => {
      const state1 = createCombatState({
        tick: 1,
        projectiles: [createProjectile('proj1')]
      });

      stateCallback(state1);

      expect(manager.getActiveProjectiles().length).toBe(1);

      const state2 = createCombatState({
        tick: 2,
        projectiles: [] // Projectile removed
      });

      stateCallback(state2);

      expect(manager.getActiveProjectiles().length).toBe(0);
    });

    it('should remove specific projectile while keeping others', () => {
      const state1 = createCombatState({
        tick: 1,
        projectiles: [
          createProjectile('proj1'),
          createProjectile('proj2'),
          createProjectile('proj3')
        ]
      });

      stateCallback(state1);

      const state2 = createCombatState({
        tick: 2,
        projectiles: [
          createProjectile('proj1'),
          createProjectile('proj3')
        ]
      });

      stateCallback(state2);

      const projectiles = manager.getActiveProjectiles();
      expect(projectiles.length).toBe(2);
      expect(projectiles.find(p => p.projectileId === 'proj2')).toBeUndefined();
    });
  });

  describe('Projectile Rotation', () => {
    it('should rotate projectile to face target', () => {
      const state = createCombatState({
        tick: 1,
        projectiles: [createProjectile('proj1', {
          sourcePosition: { q: 0, r: 0 },
          targetPosition: { q: 5, r: 0 }
        })]
      });

      stateCallback(state);

      const projectiles = manager.getActiveProjectiles();
      expect(projectiles[0].sprite.rotation).toBeDefined();
    });

    it('should update rotation as projectile changes direction', () => {
      const state1 = createCombatState({
        tick: 1,
        projectiles: [createProjectile('proj1', {
          sourcePosition: { q: 0, r: 0 },
          targetPosition: { q: 5, r: 0 },
          currentPosition: { q: 1, r: 0 }
        })]
      });

      stateCallback(state1);

      const initialRotation = manager.getActiveProjectiles()[0].sprite.rotation;

      const state2 = createCombatState({
        tick: 2,
        projectiles: [createProjectile('proj1', {
          sourcePosition: { q: 0, r: 0 },
          targetPosition: { q: 0, r: 5 }, // Changed direction
          currentPosition: { q: 0, r: 2 }
        })]
      });

      stateCallback(state2);

      const newRotation = manager.getActiveProjectiles()[0].sprite.rotation;
      expect(newRotation).not.toBe(initialRotation);
    });
  });

  describe('Performance', () => {
    it('should handle 20 simultaneous projectiles efficiently', () => {
      const projectiles = Array.from({ length: 20 }, (_, i) =>
        createProjectile(`proj${i}`, {
          currentPosition: { q: i, r: 0 }
        })
      );

      const state = createCombatState({
        tick: 1,
        projectiles
      });

      const startTime = performance.now();
      stateCallback(state);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(50); // Should process in < 50ms
      expect(manager.getActiveProjectiles().length).toBe(20);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup all projectiles on destroy', () => {
      const state = createCombatState({
        tick: 1,
        projectiles: [
          createProjectile('proj1'),
          createProjectile('proj2')
        ]
      });

      stateCallback(state);

      manager.destroy();

      expect(manager.getActiveProjectiles().length).toBe(0);
    });
  });
});
