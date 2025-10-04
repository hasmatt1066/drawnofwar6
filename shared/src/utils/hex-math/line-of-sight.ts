/**
 * Hex Math Library - Line of Sight
 *
 * Functions for drawing lines between hexes and interpolation.
 */

import { AxialCoordinate } from './types';
import { hexRound } from './coordinate-conversion';
import { hexDistance } from './distance';

/**
 * Linear interpolation between two hexes
 * Uses cube coordinate lerp with proper rounding
 *
 * @param start - Starting hex coordinate
 * @param end - Ending hex coordinate
 * @param t - Interpolation parameter [0, 1] where 0=start, 1=end
 * @returns Interpolated hex coordinate (rounded to nearest hex)
 */
export function hexLerp(start: AxialCoordinate, end: AxialCoordinate, t: number): AxialCoordinate {
  // Clamp t to [0, 1]
  const clampedT = Math.max(0, Math.min(1, t));

  // Linear interpolation in axial space
  const q = start.q + (end.q - start.q) * clampedT;
  const r = start.r + (end.r - start.r) * clampedT;

  // Round to nearest valid hex
  return hexRound({ q, r });
}

/**
 * Draw a line between two hexes using linear interpolation
 * Returns all hexes along the path from start to end (inclusive)
 *
 * Algorithm:
 * - Sample the line at N+1 points where N = distance
 * - Round each sample to nearest hex
 * - This produces a continuous path with no gaps
 *
 * @param start - Starting hex coordinate
 * @param end - Ending hex coordinate
 * @returns Array of hex coordinates forming a line from start to end
 */
export function hexLine(start: AxialCoordinate, end: AxialCoordinate): AxialCoordinate[] {
  const distance = hexDistance(start, end);

  // Special case: same hex
  if (distance === 0) {
    return [start];
  }

  const results: AxialCoordinate[] = [];

  // Sample at N+1 points (including both endpoints)
  for (let i = 0; i <= distance; i++) {
    const t = i / distance;
    results.push(hexLerp(start, end, t));
  }

  return results;
}
