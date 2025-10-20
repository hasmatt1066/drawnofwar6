/**
 * Hex Math Library - Rotation
 *
 * Functions for rotating hexes around a center point by 60° increments.
 */
import { AxialCoordinate } from './types';
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
export declare function hexRotate(hex: AxialCoordinate, center: AxialCoordinate, steps: number): AxialCoordinate;
/**
 * Rotate hex 60° clockwise (one step)
 * Convenience function for common rotation
 *
 * @param hex - Hex coordinate to rotate
 * @param center - Center point of rotation
 * @returns Rotated hex coordinate
 */
export declare function hexRotateRight(hex: AxialCoordinate, center: AxialCoordinate): AxialCoordinate;
/**
 * Rotate hex 60° counter-clockwise (one step)
 * Convenience function for common rotation
 *
 * @param hex - Hex coordinate to rotate
 * @param center - Center point of rotation
 * @returns Rotated hex coordinate
 */
export declare function hexRotateLeft(hex: AxialCoordinate, center: AxialCoordinate): AxialCoordinate;
//# sourceMappingURL=rotation.d.ts.map