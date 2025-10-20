/**
 * UnitAIController - Main AI Orchestrator
 *
 * Implements L4-COMBAT-008: Orchestrates unit AI by combining target selection
 * and movement control. Units autonomously select targets, chase enemies, and attack.
 *
 * Key Features:
 * - Target selection (closest enemy)
 * - Movement toward target
 * - Attack when in range
 * - Target switching on death
 * - Idle when no enemies
 */

import { TargetSelector } from './target-selector';
import { MovementController } from '../movement/movement-controller';
import type { CombatUnit, HexCoordinate } from '../combat-state';

export interface UnitUpdate {
  position: HexCoordinate;
  currentTarget: string | null;
  facingDirection: number;
  isMoving: boolean;
  shouldAttack: boolean;
  path: HexCoordinate[] | null;
}

export class UnitAIController {
  private targetSelector: TargetSelector;
  private movementController: MovementController;

  constructor() {
    this.targetSelector = new TargetSelector();
    this.movementController = new MovementController();
  }

  /**
   * Update unit AI for this tick
   * @param unit - Unit to update
   * @param allUnits - All units in battle
   * @param gridWidth - Grid width
   * @param gridHeight - Grid height
   * @param deltaTime - Time since last update (1/60 for 60 ticks/sec)
   * @returns Unit update with new state
   */
  updateUnit(
    unit: CombatUnit,
    allUnits: CombatUnit[],
    gridWidth: number,
    gridHeight: number,
    deltaTime: number
  ): UnitUpdate {
    // Dead units don't act
    if (unit.status === 'dead') {
      return {
        position: unit.position,
        currentTarget: null,
        facingDirection: unit.facingDirection,
        isMoving: false,
        shouldAttack: false,
        path: null
      };
    }

    // Get current target unit
    let currentTargetUnit: CombatUnit | null = null;
    if (unit.currentTarget) {
      currentTargetUnit = allUnits.find(u => u.unitId === unit.currentTarget) || null;
    }

    // Check if should switch target
    const shouldSwitch = this.targetSelector.shouldSwitchTarget(
      unit,
      currentTargetUnit,
      allUnits
    );

    // Update target if needed
    let targetUnit: CombatUnit | null = currentTargetUnit;
    if (shouldSwitch || !currentTargetUnit) {
      targetUnit = this.targetSelector.findClosestEnemy(unit, allUnits);
    }

    // No enemies - idle
    if (!targetUnit) {
      return {
        position: unit.position,
        currentTarget: null,
        facingDirection: unit.facingDirection,
        isMoving: false,
        shouldAttack: false,
        path: null
      };
    }

    // Check if in attack range
    const inRange = this.movementController.isInRange(
      unit.position,
      targetUnit.position,
      unit.stats.attackRange
    );

    // In range and cooldown ready - attack
    if (inRange && unit.attackCooldown === 0) {
      return {
        position: unit.position,
        currentTarget: targetUnit.unitId,
        facingDirection: unit.facingDirection,
        isMoving: false,
        shouldAttack: true,
        path: null
      };
    }

    // In range but cooldown not ready - wait
    if (inRange && unit.attackCooldown > 0) {
      return {
        position: unit.position,
        currentTarget: targetUnit.unitId,
        facingDirection: unit.facingDirection,
        isMoving: false,
        shouldAttack: false,
        path: null
      };
    }

    // Not in range - move toward target
    const occupiedHexes = new Set(
      allUnits
        .filter(u => u.unitId !== unit.unitId && u.status === 'alive')
        .map(u => `${u.position.q},${u.position.r}`)
    );

    const movementUpdate = this.movementController.updateMovement(
      unit,
      targetUnit.position,
      gridWidth,
      gridHeight,
      occupiedHexes,
      deltaTime
    );

    return {
      position: movementUpdate.newPosition,
      currentTarget: targetUnit.unitId,
      facingDirection: movementUpdate.facingDirection,
      isMoving: movementUpdate.isMoving || (movementUpdate.path !== null && movementUpdate.path.length > 1),
      shouldAttack: false,
      path: movementUpdate.path
    };
  }
}
