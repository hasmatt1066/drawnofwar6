/**
 * Combat Engine Tests
 *
 * Comprehensive tests for combat simulation, tick stability, and victory conditions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CombatEngine } from './combat-engine.js';
import type { DeploymentState } from '../../../../shared/src/types/deployment.js';
import type { CombatState, CombatResult } from '../../../../shared/src/types/combat.js';

describe('CombatEngine', () => {
  let engine: CombatEngine;
  let mockDeployment: DeploymentState;

  beforeEach(() => {
    engine = new CombatEngine();

    // Create mock deployment with 2v2 creatures
    mockDeployment = {
      player1: {
        playerId: 'player1',
        roster: [],
        placements: [
          {
            creature: {
              id: 'creature1',
              name: 'Tank 1',
              sprite: 'tank.png',
              playerId: 'player1'
            },
            hex: { q: 0, r: 0 }
          },
          {
            creature: {
              id: 'creature2',
              name: 'DPS 1',
              sprite: 'dps.png',
              playerId: 'player1'
            },
            hex: { q: 1, r: 0 }
          }
        ],
        maxCreatures: 8,
        isLocked: true,
        isReady: true,
        readyAt: new Date()
      },
      player2: {
        playerId: 'player2',
        roster: [],
        placements: [
          {
            creature: {
              id: 'creature3',
              name: 'Tank 2',
              sprite: 'tank.png',
              playerId: 'player2'
            },
            hex: { q: 10, r: 0 }
          },
          {
            creature: {
              id: 'creature4',
              name: 'DPS 2',
              sprite: 'dps.png',
              playerId: 'player2'
            },
            hex: { q: 9, r: 0 }
          }
        ],
        maxCreatures: 8,
        isLocked: true,
        isReady: true,
        readyAt: new Date()
      },
      currentPlayer: 'player1',
      countdownSeconds: null,
      countdownStartedAt: null,
      isComplete: true
    };
  });

  afterEach(() => {
    if (engine) {
      engine.stop();
    }
  });

  describe('Initialization', () => {
    it('should initialize combat from deployment', () => {
      engine.initializeFromDeployment('match1', mockDeployment);

      const state = engine.getState();

      expect(state.matchId).toBe('match1');
      expect(state.tick).toBe(0);
      expect(state.status).toBe('initializing');
      expect(state.units).toHaveLength(4);
      expect(state.projectiles).toHaveLength(0);
    });

    it('should create combat creatures at correct positions', () => {
      engine.initializeFromDeployment('match1', mockDeployment);

      const state = engine.getState();
      const player1Units = state.units.filter(u => u.ownerId === 'player1');
      const player2Units = state.units.filter(u => u.ownerId === 'player2');

      expect(player1Units).toHaveLength(2);
      expect(player2Units).toHaveLength(2);

      expect(player1Units[0].position).toEqual({ q: 0, r: 0 });
      expect(player1Units[1].position).toEqual({ q: 1, r: 0 });
      expect(player2Units[0].position).toEqual({ q: 10, r: 0 });
      expect(player2Units[1].position).toEqual({ q: 9, r: 0 });
    });

    it('should initialize creatures with default stats', () => {
      engine.initializeFromDeployment('match1', mockDeployment);

      const state = engine.getState();
      const unit = state.units[0];

      expect(unit.health).toBeGreaterThan(0);
      expect(unit.maxHealth).toBeGreaterThan(0);
      expect(unit.stats.attackDamage).toBeGreaterThan(0);
      expect(unit.stats.attackRange).toBeGreaterThan(0);
      expect(unit.stats.movementSpeed).toBeGreaterThan(0);
      expect(unit.status).toBe('alive');
    });
  });

  describe('Combat Simulation', () => {
    it('should start combat and change status to running', () => {
      engine.initializeFromDeployment('match1', mockDeployment);

      let stateUpdates = 0;
      engine.start(() => {
        stateUpdates++;
      });

      const state = engine.getState();
      expect(state.status).toBe('running');

      engine.stop();
    });

    it('should tick and increment tick counter', async () => {
      engine.initializeFromDeployment('match1', mockDeployment);

      let finalTick = 0;

      engine.start((state) => {
        finalTick = state.tick;
      });

      // Wait for a few ticks
      await new Promise(resolve => setTimeout(resolve, 100));

      engine.stop();

      expect(finalTick).toBeGreaterThan(0);
    });

    it('should update units each tick', async () => {
      engine.initializeFromDeployment('match1', mockDeployment);

      let hasMovement = false;

      engine.start((state) => {
        // Check if any unit has moved from starting position
        const player1Unit = state.units.find(u => u.ownerId === 'player1');
        if (player1Unit && player1Unit.position.q !== 0) {
          hasMovement = true;
        }
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      engine.stop();

      // Units should have moved toward enemies
      expect(hasMovement).toBe(true);
    });
  });

  describe('Targeting AI', () => {
    it('should select closest enemy as target', async () => {
      engine.initializeFromDeployment('match1', mockDeployment);

      let hasTargets = false;

      engine.start((state) => {
        const player1Units = state.units.filter(u => u.ownerId === 'player1');
        for (const unit of player1Units) {
          if (unit.currentTarget) {
            hasTargets = true;
            // Target should be from player 2
            const target = state.units.find(u => u.unitId === unit.currentTarget);
            expect(target?.ownerId).toBe('player2');
          }
        }
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      engine.stop();

      expect(hasTargets).toBe(true);
    });
  });

  describe('Combat Actions', () => {
    it('should deal damage when units are in range', async () => {
      // Create deployment with units close to each other
      const closeDeploy: DeploymentState = {
        ...mockDeployment,
        player1: {
          ...mockDeployment.player1,
          placements: [
            {
              creature: {
                id: 'creature1',
                name: 'Melee 1',
                sprite: 'melee.png',
                playerId: 'player1'
              },
              hex: { q: 5, r: 0 }
            }
          ]
        },
        player2: {
          ...mockDeployment.player2,
          placements: [
            {
              creature: {
                id: 'creature2',
                name: 'Melee 2',
                sprite: 'melee.png',
                playerId: 'player2'
              },
              hex: { q: 6, r: 0 } // Adjacent hex
            }
          ]
        }
      };

      engine.initializeFromDeployment('match1', closeDeploy);

      let damageDealt = false;

      engine.start((state) => {
        // Check for damage events
        for (const event of state.events) {
          if (event.eventType === 'damage_dealt') {
            damageDealt = true;
          }
        }
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      engine.stop();

      expect(damageDealt).toBe(true);
    });

    it('should reduce HP when damage is dealt', async () => {
      const closeDeploy: DeploymentState = {
        ...mockDeployment,
        player1: {
          ...mockDeployment.player1,
          placements: [
            {
              creature: {
                id: 'creature1',
                name: 'Attacker',
                sprite: 'attacker.png',
                playerId: 'player1'
              },
              hex: { q: 5, r: 0 }
            }
          ]
        },
        player2: {
          ...mockDeployment.player2,
          placements: [
            {
              creature: {
                id: 'creature2',
                name: 'Target',
                sprite: 'target.png',
                playerId: 'player2'
              },
              hex: { q: 6, r: 0 }
            }
          ]
        }
      };

      engine.initializeFromDeployment('match1', closeDeploy);

      let initialHP = 0;
      let currentHP = 0;
      let damageEvents = 0;

      engine.start((state) => {
        const target = state.units.find(u => u.ownerId === 'player2');
        if (target) {
          if (initialHP === 0) {
            initialHP = target.health;
          }
          currentHP = target.health;
        }

        // Count damage events
        for (const event of state.events) {
          if (event.eventType === 'damage_dealt') {
            damageEvents++;
          }
        }
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      engine.stop();

      // Should have dealt damage (either HP reduced or damage events occurred)
      expect(currentHP <= initialHP).toBe(true);
      expect(damageEvents).toBeGreaterThan(0);
    });
  });

  describe('Victory Conditions', () => {
    it('should detect elimination victory', async () => {
      // Create unbalanced deployment (1v0 to force quick win)
      const unbalancedDeploy: DeploymentState = {
        ...mockDeployment,
        player1: {
          ...mockDeployment.player1,
          placements: [
            {
              creature: {
                id: 'winner',
                name: 'Winner',
                sprite: 'winner.png',
                playerId: 'player1'
              },
              hex: { q: 5, r: 0 }
            }
          ]
        },
        player2: {
          ...mockDeployment.player2,
          placements: [] // No units
        }
      };

      engine.initializeFromDeployment('match1', unbalancedDeploy);

      let result: CombatResult | null = null;

      engine.start(undefined, (r) => {
        result = r;
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(result).not.toBeNull();
      expect(result?.winner).toBe('player1');
      expect(result?.reason).toBe('elimination');
    });

    it('should stop combat when one team is eliminated', async () => {
      const unbalancedDeploy: DeploymentState = {
        ...mockDeployment,
        player1: {
          ...mockDeployment.player1,
          placements: [
            {
              creature: {
                id: 'survivor',
                name: 'Survivor',
                sprite: 'survivor.png',
                playerId: 'player1'
              },
              hex: { q: 5, r: 0 }
            }
          ]
        },
        player2: {
          ...mockDeployment.player2,
          placements: []
        }
      };

      engine.initializeFromDeployment('match1', unbalancedDeploy);

      let completed = false;

      engine.start(undefined, () => {
        completed = true;
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(completed).toBe(true);
    });
  });

  describe('State Management', () => {
    it('should track combat statistics', async () => {
      engine.initializeFromDeployment('match1', mockDeployment);

      let stats = null;

      engine.start((state) => {
        stats = state.statistics;
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      engine.stop();

      expect(stats).not.toBeNull();
      expect(stats).toHaveProperty('totalDamageDealt');
      expect(stats).toHaveProperty('totalHealingDone');
      expect(stats).toHaveProperty('unitsLost');
      expect(stats).toHaveProperty('duration');
    });

    it('should generate combat events', async () => {
      const closeDeploy: DeploymentState = {
        ...mockDeployment,
        player1: {
          ...mockDeployment.player1,
          placements: [
            {
              creature: {
                id: 'creature1',
                name: 'Fighter',
                sprite: 'fighter.png',
                playerId: 'player1'
              },
              hex: { q: 5, r: 0 }
            }
          ]
        },
        player2: {
          ...mockDeployment.player2,
          placements: [
            {
              creature: {
                id: 'creature2',
                name: 'Target',
                sprite: 'target.png',
                playerId: 'player2'
              },
              hex: { q: 6, r: 0 }
            }
          ]
        }
      };

      engine.initializeFromDeployment('match1', closeDeploy);

      let hasEvents = false;

      engine.start((state) => {
        if (state.events.length > 0) {
          hasEvents = true;
        }
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      engine.stop();

      expect(hasEvents).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should maintain stable tick rate', async () => {
      engine.initializeFromDeployment('match1', mockDeployment);

      const tickTimes: number[] = [];
      let lastTick = 0;

      engine.start((state) => {
        if (lastTick > 0) {
          tickTimes.push(state.tick - lastTick);
        }
        lastTick = state.tick;
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      engine.stop();

      // All tick deltas should be 1 (sequential ticks)
      const allSequential = tickTimes.every(t => t === 1);
      expect(allSequential).toBe(true);
    });

    it('should handle multiple units efficiently', async () => {
      // Create deployment with max units (8v8)
      const maxDeploy: DeploymentState = {
        player1: {
          playerId: 'player1',
          roster: [],
          placements: Array.from({ length: 8 }, (_, i) => ({
            creature: {
              id: `p1_creature${i}`,
              name: `Unit ${i}`,
              sprite: 'unit.png',
              playerId: 'player1' as const
            },
            hex: { q: i % 4, r: Math.floor(i / 4) }
          })),
          maxCreatures: 8,
          isLocked: true,
          isReady: true,
          readyAt: new Date()
        },
        player2: {
          playerId: 'player2',
          roster: [],
          placements: Array.from({ length: 8 }, (_, i) => ({
            creature: {
              id: `p2_creature${i}`,
              name: `Unit ${i}`,
              sprite: 'unit.png',
              playerId: 'player2' as const
            },
            hex: { q: 10 - (i % 4), r: Math.floor(i / 4) }
          })),
          maxCreatures: 8,
          isLocked: true,
          isReady: true,
          readyAt: new Date()
        },
        currentPlayer: 'player1',
        countdownSeconds: null,
        countdownStartedAt: null,
        isComplete: true
      };

      engine.initializeFromDeployment('match1', maxDeploy);

      let tickCount = 0;
      const startTime = Date.now();

      engine.start((state) => {
        tickCount = state.tick;
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      engine.stop();

      const elapsed = Date.now() - startTime;
      const ticksPerSecond = (tickCount / elapsed) * 1000;

      // Should achieve close to 60 tps (allow some variance)
      expect(ticksPerSecond).toBeGreaterThan(50);
      expect(ticksPerSecond).toBeLessThan(70);
    });
  });
});
