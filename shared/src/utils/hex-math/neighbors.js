/**
 * Hex Math Library - Neighbor Finding & Validation
 *
 * Functions for finding adjacent hexes and validating grid boundaries.
 */
/**
 * Direction vectors for hex neighbors
 * Depends on orientation (flat-top vs pointy-top)
 */
const FLAT_TOP_DIRECTIONS = [
    { q: 1, r: 0 }, // E
    { q: 1, r: -1 }, // NE
    { q: 0, r: -1 }, // NW
    { q: -1, r: 0 }, // W
    { q: -1, r: 1 }, // SW
    { q: 0, r: 1 } // SE
];
const POINTY_TOP_DIRECTIONS = [
    { q: 1, r: -1 }, // NE
    { q: 1, r: 0 }, // E
    { q: 0, r: 1 }, // SE
    { q: -1, r: 1 }, // SW
    { q: -1, r: 0 }, // W
    { q: 0, r: -1 } // NW
];
/**
 * Get 6 neighboring hexes for a given hex
 * Filters out hexes that are outside grid boundaries
 *
 * @param hex - Center hex coordinate
 * @param config - Grid configuration
 * @returns Array of valid adjacent hex coordinates
 */
export function hexNeighbors(hex, config) {
    const directions = config.orientation === 'flat-top'
        ? FLAT_TOP_DIRECTIONS
        : POINTY_TOP_DIRECTIONS;
    return directions
        .map(d => ({ q: hex.q + d.q, r: hex.r + d.r }))
        .filter(h => isValidHex(h, config));
}
/**
 * Check if hex is within grid bounds
 * Simple axial coordinate bounds checking
 *
 * @param hex - Hex coordinate to validate
 * @param config - Grid configuration
 * @returns True if hex is within grid boundaries
 */
export function isValidHex(hex, config) {
    // Simple bounds check on axial coordinates
    // Assumes grid starts at (0,0) and extends to (width-1, height-1)
    return hex.q >= 0 && hex.q < config.width && hex.r >= 0 && hex.r < config.height;
}
//# sourceMappingURL=neighbors.js.map