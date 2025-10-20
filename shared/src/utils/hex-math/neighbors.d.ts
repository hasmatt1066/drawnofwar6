/**
 * Hex Math Library - Neighbor Finding & Validation
 *
 * Functions for finding adjacent hexes and validating grid boundaries.
 */
import { AxialCoordinate, HexGridConfig } from './types';
/**
 * Get 6 neighboring hexes for a given hex
 * Filters out hexes that are outside grid boundaries
 *
 * @param hex - Center hex coordinate
 * @param config - Grid configuration
 * @returns Array of valid adjacent hex coordinates
 */
export declare function hexNeighbors(hex: AxialCoordinate, config: HexGridConfig): AxialCoordinate[];
/**
 * Check if hex is within grid bounds
 * Simple axial coordinate bounds checking
 *
 * @param hex - Hex coordinate to validate
 * @param config - Grid configuration
 * @returns True if hex is within grid boundaries
 */
export declare function isValidHex(hex: AxialCoordinate, config: HexGridConfig): boolean;
//# sourceMappingURL=neighbors.d.ts.map