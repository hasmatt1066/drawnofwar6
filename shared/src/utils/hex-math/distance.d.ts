/**
 * Hex Math Library - Distance Calculation
 *
 * Functions for calculating distances between hexes using cube coordinates.
 */
import { AxialCoordinate } from './types';
/**
 * Calculate Manhattan distance between two hexes
 * Uses cube coordinates for simplified calculation
 * Formula: (|x1-x2| + |y1-y2| + |z1-z2|) / 2
 *
 * @param a - First hex coordinate
 * @param b - Second hex coordinate
 * @returns Integer distance between hexes
 */
export declare function hexDistance(a: AxialCoordinate, b: AxialCoordinate): number;
//# sourceMappingURL=distance.d.ts.map