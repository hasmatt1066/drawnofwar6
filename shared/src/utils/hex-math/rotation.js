/**
 * Hex Math Library - Rotation
 *
 * Functions for rotating hexes around a center point by 60° increments.
 */
import { axialToCube, cubeToAxial } from './coordinate-conversion';
/**
 * Rotate a hex around a center point by 60° steps
 * Positive steps = clockwise, negative = counter-clockwise
 *
 * Algorithm:
 * 1. Translate hex to origin (subtract center)
 * 2. Rotate in cube coordinate space
 * 3. Translate back (add center)
 *
 * Cube rotation formula (60° clockwise):
 * (x, y, z) -> (-z, -x, -y)
 *
 * @param hex - Hex coordinate to rotate
 * @param center - Center point of rotation
 * @param steps - Number of 60° steps (positive = clockwise, negative = counter-clockwise)
 * @returns Rotated hex coordinate
 */
export function hexRotate(hex, center, steps) {
    // Normalize steps to [0, 5] range
    const normalizedSteps = ((steps % 6) + 6) % 6;
    // Special case: no rotation
    if (normalizedSteps === 0) {
        return hex;
    }
    // Translate to origin
    const translated = axialToCube({ q: hex.q - center.q, r: hex.r - center.r });
    // Rotate by applying the rotation matrix 'steps' times
    let rotated = translated;
    for (let i = 0; i < normalizedSteps; i++) {
        rotated = rotateCubeClockwise(rotated);
    }
    // Translate back
    const result = cubeToAxial(rotated);
    return {
        q: result.q + center.q,
        r: result.r + center.r
    };
}
/**
 * Rotate a cube coordinate 60° clockwise
 * Formula: (x, y, z) -> (-z, -x, -y)
 *
 * @param cube - Cube coordinate
 * @returns Rotated cube coordinate
 */
function rotateCubeClockwise(cube) {
    return {
        x: -cube.z,
        y: -cube.x,
        z: -cube.y
    };
}
/**
 * Rotate hex 60° clockwise (one step)
 * Convenience function for common rotation
 *
 * @param hex - Hex coordinate to rotate
 * @param center - Center point of rotation
 * @returns Rotated hex coordinate
 */
export function hexRotateRight(hex, center) {
    return hexRotate(hex, center, 1);
}
/**
 * Rotate hex 60° counter-clockwise (one step)
 * Convenience function for common rotation
 *
 * @param hex - Hex coordinate to rotate
 * @param center - Center point of rotation
 * @returns Rotated hex coordinate
 */
export function hexRotateLeft(hex, center) {
    return hexRotate(hex, center, -1);
}
//# sourceMappingURL=rotation.js.map