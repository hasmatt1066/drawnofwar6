/**
 * CombatSimulator - Main Combat Orchestrator
 *
 * Implements L4-COMBAT-004: Orchestrates complete combat simulation by
 * integrating SimulationLoop, CombatStateManager, VictoryDetector, and Phase 3 combat mechanics.
 *
 * Key Features:
 * - Runs simulation from start to finish
 * - Unit AI (movement, target selection)
 * - Combat mechanics (damage, attacks, death)
 * - Checks victory conditions each tick
 * - Provides state updates via callback
 * - Returns complete battle result
 */

import { SimulationLoop } from './simulation-loop';
import { CombatStateManager, type CombatState, type Deployment, type CombatEvent } from './combat-state';
import { VictoryDetector } from './victory-detector';
import { UnitAIController } from './ai/unit-ai-controller';
import { AttackExecutor } from './attack/attack-executor';
import { DeathHandler } from './death/death-handler';

export interface BattleResult {
  battleId: string;
  winner: 'player1' | 'player2' | 'draw';
  reason: 'elimination' | 'timeout' | 'simultaneous_death';
  duration: number; // ticks
  finalState: CombatState;
  eventLog: CombatEvent[];
}

export class CombatSimulator {
  private stateManager: CombatStateManager;
  private victoryDetector: VictoryDetector;
  private simulationLoop: SimulationLoop;
  private aiController: UnitAIController;
  private attackExecutor: AttackExecutor;
  private deathHandler: DeathHandler;

  constructor() {
    this.stateManager = new CombatStateManager();
    this.victoryDetector = new VictoryDetector();
    this.simulationLoop = new SimulationLoop();
    this.aiController = new UnitAIController();
    this.attackExecutor = new AttackExecutor();
    this.deathHandler = new DeathHandler();
  }

  /**
   * Run complete combat simulation
   * @param battleId - Unique battle identifier
   * @param deployments - Initial unit deployments
   * @param onUpdate - Optional callback for state updates each tick
   * @param maxTicks - Maximum ticks before timeout (default: 18000 = 5 minutes)
   * @returns Battle result with winner and event log
   */
  async runCombat(
    battleId: string,
    deployments: Deployment[],
    onUpdate?: (state: CombatState) => void,
    maxTicks: number = 18000
  ): Promise<BattleResult> {
    return new Promise((resolve) => {
      // Initialize combat state
      let currentState = this.stateManager.initializeState(battleId, deployments);
      currentState.status = 'running';

      // Start simulation loop
      this.simulationLoop.start((tick) => {
        // Update tick counter
        currentState = { ...currentState, tick };

        // Process combat for this tick (skip tick 0 - initialization phase)
        if (tick > 0) {
          currentState = this.processCombatTick(currentState);
        }

        // Check victory condition
        const victoryResult = this.victoryDetector.checkVictory(currentState, maxTicks);

        if (victoryResult.isGameOver) {
          // Battle complete - stop simulation
          this.simulationLoop.stop();

          const result: BattleResult = {
            battleId,
            winner: victoryResult.winner as 'player1' | 'player2' | 'draw',
            reason: victoryResult.reason as 'elimination' | 'timeout' | 'simultaneous_death',
            duration: currentState.tick,
            finalState: victoryResult.finalState,
            eventLog: currentState.events
          };

          resolve(result);
        } else {
          // Battle continues - send update
          if (onUpdate) {
            onUpdate(currentState);
          }
        }
      });
    });
  }

  /**
   * Stop simulation (for cleanup/testing)
   */
  stop(): void {
    this.simulationLoop.stop();
  }

  /**
   * Process combat for a single tick
   * Integrates AI, movement, attacks, damage, and death handling
   */
  private processCombatTick(state: CombatState): CombatState {
    let currentState = state;
    const gridWidth = 12;
    const gridHeight = 8;
    const deltaTime = 1 / 60; // 60 ticks per second

    // Phase 1: Update all unit AI (movement, target selection)
    for (const unit of currentState.units) {
      if (unit.status === 'dead') continue;

      const aiUpdate = this.aiController.updateUnit(
        unit,
        currentState.units,
        gridWidth,
        gridHeight,
        deltaTime
      );

      // Update unit with AI decisions (only persistent state)
      currentState = this.stateManager.updateUnit(currentState, unit.unitId, {
        position: aiUpdate.position,
        currentTarget: aiUpdate.currentTarget,
        facingDirection: aiUpdate.facingDirection
      });

      // Phase 2: Execute attack if unit should attack
      if (aiUpdate.shouldAttack && aiUpdate.currentTarget) {
        const attacker = currentState.units.find(u => u.unitId === unit.unitId);
        const defender = currentState.units.find(u => u.unitId === aiUpdate.currentTarget);

        if (attacker && defender && defender.status === 'alive') {
          const attackResult = this.attackExecutor.executeAttack(attacker, defender);

          // Update defender health
          currentState = this.stateManager.updateUnit(currentState, defender.unitId, {
            health: attackResult.newDefenderHealth
          });

          // Update attacker cooldown
          currentState = this.stateManager.updateUnit(currentState, attacker.unitId, {
            attackCooldown: attackResult.attackerCooldown
          });

          // Add damage event
          currentState = this.stateManager.addEvent(currentState, {
            tick: currentState.tick,
            type: 'damage',
            data: {
              attackerId: attacker.unitId,
              defenderId: defender.unitId,
              damage: attackResult.damageDealt,
              isCritical: attackResult.isCritical,
              defenderHealth: attackResult.newDefenderHealth
            }
          });

          // Phase 3: Handle death if defender died
          if (attackResult.defenderDied) {
            const deathResult = this.deathHandler.handleDeath({
              ...defender,
              health: attackResult.newDefenderHealth
            });

            currentState = this.stateManager.updateUnit(currentState, defender.unitId, {
              status: deathResult.newStatus,
              currentTarget: deathResult.currentTarget
            });

            // Add death event
            currentState = this.stateManager.addEvent(currentState, {
              tick: currentState.tick,
              type: 'death',
              data: {
                unitId: defender.unitId,
                killerId: attacker.unitId
              }
            });
          }
        }
      }
    }

    // Phase 4: Decrement all attack cooldowns
    for (const unit of currentState.units) {
      if (unit.status === 'alive' && unit.attackCooldown > 0) {
        currentState = this.stateManager.updateUnit(currentState, unit.unitId, {
          attackCooldown: Math.max(0, unit.attackCooldown - 1)
        });
      }
    }

    // Phase 5: Prune old events (keep last 60 ticks)
    currentState = this.stateManager.pruneOldEvents(currentState);

    return currentState;
  }
}
