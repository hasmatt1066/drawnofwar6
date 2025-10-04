/**
 * Hex Math Library - Distance Calculation
 *
 * Functions for calculating distances between hexes using cube coordinates.
 */

import { AxialCoordinate } from './types';
import { axialToCube } from './coordinate-conversion';

/**
 * Calculate Manhattan distance between two hexes
 * Uses cube coordinates for simplified calculation
 * Formula: (|x1-x2| + |y1-y2| + |z1-z2|) / 2
 *
 * @param a - First hex coordinate
 * @param b - Second hex coordinate
 * @returns Integer distance between hexes
 */
export function hexDistance(a: AxialCoordinate, b: AxialCoordinate): number {
  const ac = axialToCube(a);
  const bc = axialToCube(b);

  return Math.floor(
    (Math.abs(ac.x - bc.x) + Math.abs(ac.y - bc.y) + Math.abs(ac.z - bc.z)) / 2
  );
}
