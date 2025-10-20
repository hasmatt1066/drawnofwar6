/**
 * TargetSelector - AI Target Selection
 *
 * Implements L4-COMBAT-005: Finds closest enemy for units to attack.
 *
 * Key Features:
 * - Selects closest enemy by hex distance
 * - Ignores dead units
 * - Maintains target focus (doesn't switch to closer targets)
 * - Only switches when current target dies
 */

import { hexDistance } from '@drawn-of-war/shared';
import type { CombatUnit } from '../combat-state';

export class TargetSelector {
  /**
   * Find the closest living enemy to a unit
   * @param unit - The unit looking for a target
   * @param allUnits - All units in the battle
   * @returns Closest enemy unit or null if no enemies exist
   */
  findClosestEnemy(unit: CombatUnit, allUnits: CombatUnit[]): CombatUnit | null {
    // Filter to enemies only (different owner, alive)
    const enemies = allUnits.filter(u =>
      u.ownerId !== unit.ownerId && u.status === 'alive'
    );

    if (enemies.length === 0) {
      return null;
    }

    // Find closest enemy by hex distance
    let closestEnemy = enemies[0];
    let closestDistance = hexDistance(unit.position, closestEnemy.position);

    for (let i = 1; i < enemies.length; i++) {
      const enemy = enemies[i];
      const distance = hexDistance(unit.position, enemy.position);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestEnemy = enemy;
      }
    }

    return closestEnemy;
  }

  /**
   * Determine if unit should switch targets
   * Only switches if:
   * - Current target is null (no target)
   * - Current target is dead
   *
   * Does NOT switch to closer targets (maintains focus)
   *
   * @param unit - The unit with current target
   * @param currentTarget - The unit's current target (or null)
   * @param allUnits - All units in the battle
   * @returns True if should switch targets
   */
  shouldSwitchTarget(
    unit: CombatUnit,
    currentTarget: CombatUnit | null,
    allUnits: CombatUnit[]
  ): boolean {
    // No current target - should find one
    if (!currentTarget) {
      return true;
    }

    // Current target is dead - must switch
    if (currentTarget.status === 'dead') {
      return true;
    }

    // Target is alive - maintain focus
    return false;
  }
}
