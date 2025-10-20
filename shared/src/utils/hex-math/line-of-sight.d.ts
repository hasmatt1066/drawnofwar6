/**
 * Hex Math Library - Line of Sight
 *
 * Functions for drawing lines between hexes and interpolation.
 */
import { AxialCoordinate } from './types';
/**
 * Linear interpolation between two hexes
 * Uses cube coordinate lerp with proper rounding
 *
 * @param start - Starting hex coordinate
 * @param end - Ending hex coordinate
 * @param t - Interpolation parameter [0, 1] where 0=start, 1=end
 * @returns Interpolated hex coordinate (rounded to nearest hex)
 */
export declare function hexLerp(start: AxialCoordinate, end: AxialCoordinate, t: number): AxialCoordinate;
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
export declare function hexLine(start: AxialCoordinate, end: AxialCoordinate): AxialCoordinate[];
//# sourceMappingURL=line-of-sight.d.ts.map