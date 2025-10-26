/**
 * TASK-COMBAT-VIZ-005: Position Interpolator Implementation
 *
 * Interpolates unit positions between combat state updates for smooth rendering.
 * Handles hex coordinates, facing direction, and unit spawning/despawning.
 */

import type { CombatState, CombatCreature } from '@drawn-of-war/shared/types/combat';
import type { AxialCoordinate } from '@drawn-of-war/shared/utils/hex-math/types';

/**
 * Interpolated unit position
 */
export interface InterpolatedUnitPosition {
  unitId: string;
  position: AxialCoordinate;
  facingDirection: number;
  isMoving: boolean;
  isNewlySpawned: boolean;
}

/**
 * PositionInterpolator
 *
 * Interpolates unit positions between two combat states for smooth rendering.
 */
export class PositionInterpolator {
  /**
   * Interpolate unit positions between two states
   *
   * @param previousState - Previous combat state
   * @param currentState - Current combat state
   * @param factor - Interpolation factor [0, 1]
   * @returns Array of interpolated unit positions
   */
  public interpolatePositions(
    previousState: CombatState,
    currentState: CombatState,
    factor: number
  ): InterpolatedUnitPosition[] {
    const result: InterpolatedUnitPosition[] = [];

    // Create unit lookup maps
    const previousUnits = new Map<string, CombatCreature>();
    previousState.units.forEach(unit => previousUnits.set(unit.unitId, unit));

    const currentUnits = new Map<string, CombatCreature>();
    currentState.units.forEach(unit => currentUnits.set(unit.unitId, unit));

    // Interpolate positions for all current units
    currentState.units.forEach(currentUnit => {
      const previousUnit = previousUnits.get(currentUnit.unitId);

      if (!previousUnit) {
        // Newly spawned unit
        // Check if unit has deploymentPosition to show spawn-to-battle movement
        if (currentUnit.deploymentPosition &&
            (currentUnit.deploymentPosition.q !== currentUnit.position.q ||
             currentUnit.deploymentPosition.r !== currentUnit.position.r)) {
          // Interpolate from deployment position to combat position
          const interpolatedPosition = this.interpolatePosition(
            currentUnit.deploymentPosition,
            currentUnit.position,
            factor
          );

          const facingDirection = this.calculateFacingFromMovement(
            currentUnit.deploymentPosition,
            currentUnit.position
          );

          result.push({
            unitId: currentUnit.unitId,
            position: interpolatedPosition,
            facingDirection,
            isMoving: true,
            isNewlySpawned: true
          });
        } else {
          // Snap to current position (no deployment position or already at position)
          result.push({
            unitId: currentUnit.unitId,
            position: { ...currentUnit.position },
            facingDirection: currentUnit.facingDirection,
            isMoving: false,
            isNewlySpawned: true
          });
        }
      } else {
        // Existing unit - interpolate position
        const interpolatedPosition = this.interpolatePosition(
          previousUnit.position,
          currentUnit.position,
          factor
        );

        const isMoving = this.isUnitMoving(previousUnit.position, currentUnit.position);

        let facingDirection: number;
        if (isMoving) {
          // Calculate facing from movement vector
          facingDirection = this.calculateFacingFromMovement(
            previousUnit.position,
            currentUnit.position
          );
        } else {
          // Interpolate facing direction for stationary units
          facingDirection = this.interpolateAngle(
            previousUnit.facingDirection,
            currentUnit.facingDirection,
            factor
          );
        }

        result.push({
          unitId: currentUnit.unitId,
          position: interpolatedPosition,
          facingDirection,
          isMoving,
          isNewlySpawned: false
        });
      }
    });

    return result;
  }

  /**
   * Interpolate between two positions
   */
  private interpolatePosition(
    previous: AxialCoordinate,
    current: AxialCoordinate,
    factor: number
  ): AxialCoordinate {
    return {
      q: previous.q + (current.q - previous.q) * factor,
      r: previous.r + (current.r - previous.r) * factor
    };
  }

  /**
   * Check if unit moved between two positions
   */
  private isUnitMoving(previous: AxialCoordinate, current: AxialCoordinate): boolean {
    return previous.q !== current.q || previous.r !== current.r;
  }

  /**
   * Calculate facing direction from movement vector
   * Returns angle in degrees (0 = east, 90 = north)
   */
  private calculateFacingFromMovement(
    from: AxialCoordinate,
    to: AxialCoordinate
  ): number {
    const dq = to.q - from.q;
    const dr = to.r - from.r;

    if (dq === 0 && dr === 0) {
      return 0; // No movement
    }

    // Convert axial coordinates to cartesian for angle calculation
    const dx = dq;
    const dy = -dr; // Flip Y axis for standard cartesian

    // Calculate angle in radians
    const angleRad = Math.atan2(dy, dx);

    // Convert to degrees
    let angleDeg = (angleRad * 180) / Math.PI;

    // Normalize to [0, 360)
    if (angleDeg < 0) {
      angleDeg += 360;
    }

    return angleDeg;
  }

  /**
   * Interpolate between two angles, taking shortest path around circle
   */
  private interpolateAngle(previous: number, current: number, factor: number): number {
    // Normalize angles to [0, 360)
    previous = this.normalizeAngle(previous);
    current = this.normalizeAngle(current);

    // Calculate shortest angular distance
    let delta = current - previous;

    // Adjust for wraparound
    if (delta > 180) {
      delta -= 360;
    } else if (delta < -180) {
      delta += 360;
    }

    // Interpolate
    let result = previous + delta * factor;

    // Normalize result
    result = this.normalizeAngle(result);

    return result;
  }

  /**
   * Normalize angle to [0, 360) range
   */
  private normalizeAngle(angle: number): number {
    angle = angle % 360;
    if (angle < 0) {
      angle += 360;
    }
    return angle;
  }
}
