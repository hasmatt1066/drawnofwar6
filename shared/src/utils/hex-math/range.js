/**
 * Hex Math Library - Range Queries
 *
 * Functions for getting hexes within a specified range.
 */
import { hexDistance } from './distance';
import { isValidHex } from './neighbors';
/**
 * Get all hexes within range N from center
 * Returns hexes sorted by distance (spiral order - closest first)
 *
 * @param center - Center hex coordinate
 * @param range - Maximum distance (inclusive)
 * @param config - Grid configuration
 * @returns Array of hex coordinates within range, sorted by distance
 */
export function hexesInRange(center, range, config) {
    const results = [];
    // Iterate over cube-shaped bounding box
    for (let q = -range; q <= range; q++) {
        // Calculate r bounds for this q to stay within range
        const r1 = Math.max(-range, -q - range);
        const r2 = Math.min(range, -q + range);
        for (let r = r1; r <= r2; r++) {
            const hex = { q: center.q + q, r: center.r + r };
            // Only include if within grid bounds
            if (isValidHex(hex, config)) {
                results.push(hex);
            }
        }
    }
    // Sort by distance from center (spiral order)
    return results.sort((a, b) => hexDistance(center, a) - hexDistance(center, b));
}
//# sourceMappingURL=range.js.map