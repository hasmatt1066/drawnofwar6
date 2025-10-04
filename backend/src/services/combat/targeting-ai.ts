/**
 * Targeting AI System
 *
 * Implements simple AI for target selection and basic pathfinding.
 * Uses "closest enemy" strategy (Mechabellum-inspired).
 */

import type { CombatCreature, PlayerId } from '../../../../shared/src/types/combat.js';
import type { AxialCoordinate } from '../../../../shared/src/utils/hex-math/types.js';
import { hexDistance } from '../../../../shared/src/utils/hex-math/distance.js';

/**
 * Find the closest enemy to a unit
 */
export function findClosestEnemy(
  unit: CombatCreature,
  allUnits: CombatCreature[]
): CombatCreature | null {
  const enemies = allUnits.filter(
    u => u.status === 'alive' && u.ownerId !== unit.ownerId
  );

  if (enemies.length === 0) {
    return null;
  }

  let closestEnemy = enemies[0];
  if (!closestEnemy) {
    return null;
  }

  let closestDistance = hexDistance(unit.position, closestEnemy.position);

  for (let i = 1; i < enemies.length; i++) {
    const enemy = enemies[i];
    if (!enemy) continue;

    const distance = hexDistance(unit.position, enemy.position);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestEnemy = enemy;
    }
  }

  return closestEnemy ?? null;
}

/**
 * Check if target is in attack range
 */
export function isInAttackRange(
  unit: CombatCreature,
  target: CombatCreature
): boolean {
  const distance = hexDistance(unit.position, target.position);
  return distance <= unit.stats.attackRange;
}

/**
 * Check if target is in ability range
 */
export function isInAbilityRange(
  unit: CombatCreature,
  target: CombatCreature,
  abilityRange: number
): boolean {
  const distance = hexDistance(unit.position, target.position);
  return distance <= abilityRange;
}

/**
 * Find all units within AOE radius of a position
 */
export function findUnitsInRadius(
  center: AxialCoordinate,
  radius: number,
  allUnits: CombatCreature[],
  playerId?: PlayerId // Filter by player, or undefined for all
): CombatCreature[] {
  return allUnits.filter(unit => {
    if (unit.status !== 'alive') return false;
    if (playerId !== undefined && unit.ownerId !== playerId) return false;

    const distance = hexDistance(center, unit.position);
    return distance <= radius;
  });
}

/**
 * Find allies of a unit
 */
export function findAllies(
  unit: CombatCreature,
  allUnits: CombatCreature[]
): CombatCreature[] {
  return allUnits.filter(
    u => u.status === 'alive' && u.ownerId === unit.ownerId && u.unitId !== unit.unitId
  );
}

/**
 * Find allies with low HP (for healing AI)
 */
export function findLowHPAllies(
  unit: CombatCreature,
  allUnits: CombatCreature[],
  hpThreshold: number // 0.0 to 1.0 (percentage)
): CombatCreature[] {
  const allies = findAllies(unit, allUnits);
  return allies.filter(ally => (ally.health / ally.maxHealth) <= hpThreshold);
}

/**
 * Simple pathfinding: Move directly toward target
 * For MVP, we use simple direct movement without obstacle avoidance
 */
export function calculateMovementPath(
  from: AxialCoordinate,
  to: AxialCoordinate
): AxialCoordinate[] {
  // For MVP: Return single-step path toward target
  // This creates smooth movement toward target without complex A*
  const distance = hexDistance(from, to);

  if (distance === 0) {
    return [];
  }

  // Calculate direction vector (simplified)
  const dq = to.q - from.q;
  const dr = to.r - from.r;

  // Normalize to get one step
  const steps = Math.max(Math.abs(dq), Math.abs(dr));
  const stepQ = dq / steps;
  const stepR = dr / steps;

  // Return next position
  const nextQ = Math.round(from.q + stepQ);
  const nextR = Math.round(from.r + stepR);

  return [{ q: nextQ, r: nextR }];
}

/**
 * Interpolate position for smooth movement (fraction of a hex)
 * Used for sub-hex precision in rendering
 */
export function interpolatePosition(
  from: AxialCoordinate,
  to: AxialCoordinate,
  fraction: number // 0.0 to 1.0
): AxialCoordinate {
  const q = from.q + (to.q - from.q) * fraction;
  const r = from.r + (to.r - from.r) * fraction;

  return { q, r };
}

/**
 * Calculate facing direction (in degrees) from one position to another
 */
export function calculateFacingDirection(
  from: AxialCoordinate,
  to: AxialCoordinate
): number {
  const dq = to.q - from.q;
  const dr = to.r - from.r;

  // Convert to degrees (0 = right, 90 = down, etc.)
  const radians = Math.atan2(dr, dq);
  const degrees = radians * (180 / Math.PI);

  return degrees;
}

/**
 * Check if a hex is occupied by any unit
 */
export function isHexOccupied(
  hex: AxialCoordinate,
  allUnits: CombatCreature[]
): boolean {
  return allUnits.some(
    unit =>
      unit.status === 'alive' &&
      unit.position.q === hex.q &&
      unit.position.r === hex.r
  );
}

/**
 * Get unit at a specific hex
 */
export function getUnitAtHex(
  hex: AxialCoordinate,
  allUnits: CombatCreature[]
): CombatCreature | null {
  const unit = allUnits.find(
    u =>
      u.status === 'alive' &&
      u.position.q === hex.q &&
      u.position.r === hex.r
  );

  return unit ?? null;
}
