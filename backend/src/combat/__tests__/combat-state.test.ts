/**
 * Tests for CombatStateManager (L4-COMBAT-002)
 *
 * TDD Test Suite - These tests are written BEFORE implementation
 */

import { describe, test, expect } from 'vitest';
import { CombatStateManager } from '../combat-state';
import type { CombatState, CombatUnit, Projectile, CombatEvent } from '../combat-state';

// Helper: Create mock state for testing
const createMockState = (): CombatState => ({
  battleId: 'battle-123',
  tick: 0,
  status: 'running',
  units: [
    {
      unitId: 'unit-1',
      creatureId: 'creature-1',
      ownerId: 'player1',
      position: { q: 1, r: 2 },
      health: 100,
      maxHealth: 100,
      status: 'alive',
      currentTarget: null,
      facingDirection: 0,
      attackCooldown: 0,
      stats: {
        movementSpeed: 2,
        attackRange: 1,
        attackDamage: 10,
        armor: 5,
        attackSpeed: 1
      }
    },
    {
      unitId: 'unit-2',
      creatureId: 'creature-2',
      ownerId: 'player1',
      position: { q: 2, r: 3 },
      health: 100,
      maxHealth: 100,
      status: 'alive',
      currentTarget: null,
      facingDirection: 0,
      attackCooldown: 0,
      stats: {
        movementSpeed: 2,
        attackRange: 1,
        attackDamage: 10,
        armor: 5,
        attackSpeed: 1
      }
    },
    {
      unitId: 'unit-3',
      creatureId: 'creature-3',
      ownerId: 'player2',
      position: { q: 10, r: 2 },
      health: 100,
      maxHealth: 100,
      status: 'alive',
      currentTarget: null,
      facingDirection: 180,
      attackCooldown: 0,
      stats: {
        movementSpeed: 2,
        attackRange: 1,
        attackDamage: 10,
        armor: 5,
        attackSpeed: 1
      }
    }
  ],
  projectiles: [],
  activeEffects: [],
  events: [],
  winner: null
});

describe('CombatStateManager (L4-COMBAT-002)', () => {

  /**
   * Test 1: Initialize state from deployments
   */
  test('should initialize combat state from deployments', () => {
    const deployments = [
      {
        playerId: 'player1' as const,
        creature: {
          id: 'c1',
          name: 'Warrior',
          stats: {
            movementSpeed: 2,
            attackRange: 1,
            attackDamage: 15,
            armor: 10,
            attackSpeed: 1
          },
          maxHealth: 120
        },
        hex: { q: 1, r: 2 }
      },
      {
        playerId: 'player2' as const,
        creature: {
          id: 'c2',
          name: 'Archer',
          stats: {
            movementSpeed: 3,
            attackRange: 5,
            attackDamage: 8,
            armor: 3,
            attackSpeed: 1.5
          },
          maxHealth: 80
        },
        hex: { q: 10, r: 2 }
      }
    ];

    const manager = new CombatStateManager();
    const state = manager.initializeState('battle-123', deployments);

    expect(state.battleId).toBe('battle-123');
    expect(state.tick).toBe(0);
    expect(state.status).toBe('initializing');
    expect(state.units).toHaveLength(2);
    expect(state.units[0].position).toEqual({ q: 1, r: 2 });
    expect(state.units[0].health).toBe(state.units[0].maxHealth);
    expect(state.units[0].health).toBe(120);
    expect(state.units[0].status).toBe('alive');
    expect(state.units[1].position).toEqual({ q: 10, r: 2 });
    expect(state.units[1].maxHealth).toBe(80);
  });

  /**
   * Test 2: Update unit immutably
   */
  test('should update unit without mutating original state', () => {
    const state = createMockState();
    const manager = new CombatStateManager();

    const newState = manager.updateUnit(state, 'unit-1', {
      position: { q: 2, r: 3 },
      health: 80
    });

    // Original unchanged
    expect(state.units[0].position).toEqual({ q: 1, r: 2 });
    expect(state.units[0].health).toBe(100);

    // New state updated
    expect(newState.units[0].position).toEqual({ q: 2, r: 3 });
    expect(newState.units[0].health).toBe(80);

    // Other fields preserved
    expect(newState.units[0].unitId).toBe('unit-1');
    expect(newState.units[0].status).toBe('alive');
  });

  /**
   * Test 3: Event pruning (keep last 60 ticks)
   */
  test('should prune events older than 60 ticks', () => {
    let state = createMockState();
    const manager = new CombatStateManager();

    // Add 100 events across different ticks
    for (let i = 0; i < 100; i++) {
      state = manager.addEvent(state, {
        tick: i,
        type: 'damage',
        data: { damage: 10 }
      });
    }

    state = { ...state, tick: 100 };
    const prunedState = manager.pruneOldEvents(state);

    // Should only have events from tick 40+ (last 60 ticks)
    expect(prunedState.events.length).toBeLessThanOrEqual(60);
    expect(prunedState.events[0].tick).toBeGreaterThanOrEqual(40);
  });

  /**
   * Test 4: Serialize/deserialize preserves state
   */
  test('should serialize and deserialize state correctly', () => {
    const state = createMockState();
    const manager = new CombatStateManager();

    const serialized = manager.serialize(state);
    const deserialized = manager.deserialize(serialized);

    expect(deserialized).toEqual(state);
  });

  /**
   * Test 5: Get alive units filters correctly
   */
  test('should return only alive units for specified player', () => {
    const state = createMockState();
    state.units[0].status = 'dead'; // player1 unit
    state.units[1].status = 'alive'; // player1 unit
    state.units[2].status = 'alive'; // player2 unit

    const manager = new CombatStateManager();

    const player1Alive = manager.getAliveUnits(state, 'player1');
    expect(player1Alive).toHaveLength(1);
    expect(player1Alive[0].unitId).toBe('unit-2');

    const allAlive = manager.getAliveUnits(state);
    expect(allAlive).toHaveLength(2);
  });

  /**
   * Test 6: Add and remove projectiles immutably
   */
  test('should add and remove projectiles without mutation', () => {
    const state = createMockState();
    const manager = new CombatStateManager();

    const projectile: Projectile = {
      projectileId: 'proj-1',
      sourceUnitId: 'unit-1',
      targetUnitId: 'unit-3',
      currentPosition: { q: 1, r: 2 },
      targetPosition: { q: 10, r: 2 },
      velocity: 0.5,
      damage: 15,
      spawnTick: 10
    };

    const withProjectile = manager.addProjectile(state, projectile);

    // Original unchanged
    expect(state.projectiles).toHaveLength(0);

    // New state has projectile
    expect(withProjectile.projectiles).toHaveLength(1);
    expect(withProjectile.projectiles[0].projectileId).toBe('proj-1');

    // Remove projectile
    const withoutProjectile = manager.removeProjectile(withProjectile, 'proj-1');
    expect(withoutProjectile.projectiles).toHaveLength(0);
    expect(withProjectile.projectiles).toHaveLength(1); // Original unchanged
  });
});
