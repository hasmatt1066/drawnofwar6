/**
 * MovementController - Unit Movement System
 *
 * Implements L4-COMBAT-007: Moves units toward targets using pathfinding.
 *
 * Key Features:
 * - Discrete hex-by-hex movement
 * - Movement speed (hexes per second)
 * - Facing direction updates
 * - Obstacle avoidance via pathfinding
 * - Stops when in attack range
 *
 * Note: Phase 2 uses discrete movement. Continuous sub-hex movement
 * can be added later if needed for smoother animations.
 */

import { hexDistance } from '@drawn-of-war/shared';
import { AStarPathfinder } from '../pathfinding/astar-pathfinder';
import type { CombatUnit, HexCoordinate } from '../combat-state';

export interface MovementUpdate {
  newPosition: HexCoordinate;
  facingDirection: number; // degrees (0 = east, 90 = north, etc.)
  isMoving: boolean;
  path: HexCoordinate[] | null;
}

export class MovementController {
  private pathfinder: AStarPathfinder;
  private movementProgress: Map<string, number>; // Track accumulated movement per unit

  constructor() {
    this.pathfinder = new AStarPathfinder();
    this.movementProgress = new Map();
  }

  /**
   * Update unit movement for this tick
   * @param unit - Unit to move
   * @param targetPosition - Where unit wants to go
   * @param gridWidth - Grid width
   * @param gridHeight - Grid height
   * @param occupiedHexes - Set of occupied hex keys "q,r"
   * @param deltaTime - Time since last update (1/60 for 60 ticks/sec)
   * @returns Movement update with new position and facing
   */
  updateMovement(
    unit: CombatUnit,
    targetPosition: HexCoordinate,
    gridWidth: number,
    gridHeight: number,
    occupiedHexes: Set<string>,
    deltaTime: number
  ): MovementUpdate {
    const currentPos = unit.position;

    // Check if already at target
    if (currentPos.q === targetPosition.q && currentPos.r === targetPosition.r) {
      return {
        newPosition: currentPos,
        facingDirection: unit.facingDirection,
        isMoving: false,
        path: null
      };
    }

    // Check if in attack range (stop moving)
    if (this.isInRange(currentPos, targetPosition, unit.stats.attackRange)) {
      return {
        newPosition: currentPos,
        facingDirection: unit.facingDirection,
        isMoving: false,
        path: null
      };
    }

    // Find path to target
    const path = this.pathfinder.findPath(
      currentPos,
      targetPosition,
      gridWidth,
      gridHeight,
      occupiedHexes
    );

    if (!path || path.length <= 1) {
      // No path or already at start - don't move
      return {
        newPosition: currentPos,
        facingDirection: unit.facingDirection,
        isMoving: false,
        path: null
      };
    }

    // Calculate movement progress
    // movementSpeed is hexes per second
    // deltaTime is fraction of a second (1/60)
    // So movement per tick = movementSpeed * deltaTime
    const movementPerTick = unit.stats.movementSpeed * deltaTime;

    // Track accumulated movement for this unit
    const currentProgress = this.movementProgress.get(unit.unitId) || 0;
    const newProgress = currentProgress + movementPerTick;

    // Move to next hex if we've accumulated >= 1 hex of movement
    if (newProgress >= 1.0) {
      // Reset progress (subtract 1, keep remainder)
      this.movementProgress.set(unit.unitId, newProgress - 1.0);

      // Move to next hex in path
      const nextHex = path[1]; // path[0] is current position
      const facingDirection = this.calculateFacing(currentPos, nextHex);

      return {
        newPosition: nextHex,
        facingDirection,
        isMoving: true,
        path
      };
    } else {
      // Not enough movement accumulated - stay in place
      this.movementProgress.set(unit.unitId, newProgress);

      return {
        newPosition: currentPos,
        facingDirection: unit.facingDirection,
        isMoving: true, // Still moving, just not arrived at next hex yet
        path
      };
    }
  }

  /**
   * Check if unit is within range of target
   * @param unitPosition - Unit's current position
   * @param targetPosition - Target position
   * @param range - Attack range in hexes
   * @returns True if in range
   */
  isInRange(
    unitPosition: HexCoordinate,
    targetPosition: HexCoordinate,
    range: number
  ): boolean {
    const distance = hexDistance(unitPosition, targetPosition);
    return distance <= range;
  }

  /**
   * Calculate facing direction from current to next hex
   * @param from - Starting hex
   * @param to - Target hex
   * @returns Facing angle in degrees (0 = east, 60 = northeast, etc.)
   */
  private calculateFacing(from: HexCoordinate, to: HexCoordinate): number {
    const dq = to.q - from.q;
    const dr = to.r - from.r;

    // Flat-top hex directions (degrees)
    // E: (1, 0) = 0°
    // NE: (1, -1) = 60°
    // NW: (0, -1) = 120°
    // W: (-1, 0) = 180°
    // SW: (-1, 1) = 240°
    // SE: (0, 1) = 300°

    if (dq === 1 && dr === 0) return 0;    // E
    if (dq === 1 && dr === -1) return 60;  // NE
    if (dq === 0 && dr === -1) return 120; // NW
    if (dq === -1 && dr === 0) return 180; // W
    if (dq === -1 && dr === 1) return 240; // SW
    if (dq === 0 && dr === 1) return 300;  // SE

    // Default: no change
    return 0;
  }
}
