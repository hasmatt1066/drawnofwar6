/**
 * Hex Math Library - Range Queries
 *
 * Functions for getting hexes within a specified range.
 */
import { AxialCoordinate, HexGridConfig } from './types';
/**
 * Get all hexes within range N from center
 * Returns hexes sorted by distance (spiral order - closest first)
 *
 * @param center - Center hex coordinate
 * @param range - Maximum distance (inclusive)
 * @param config - Grid configuration
 * @returns Array of hex coordinates within range, sorted by distance
 */
export declare function hexesInRange(center: AxialCoordinate, range: number, config: HexGridConfig): AxialCoordinate[];
//# sourceMappingURL=range.d.ts.map