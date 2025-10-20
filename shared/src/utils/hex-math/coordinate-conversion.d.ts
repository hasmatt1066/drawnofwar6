/**
 * Hex Math Library - Coordinate Conversion
 *
 * Functions for converting between axial, cube, and pixel coordinate systems.
 */
import { AxialCoordinate, CubeCoordinate, PixelCoordinate, HexGridConfig } from './types';
/**
 * Convert axial to cube coordinates
 * Formula: x = q, z = r, y = -x - z
 *
 * @param hex - Axial coordinate
 * @returns Cube coordinate (maintains invariant x + y + z = 0)
 */
export declare function axialToCube(hex: AxialCoordinate): CubeCoordinate;
/**
 * Convert cube to axial coordinates
 * Formula: q = x, r = z
 *
 * @param cube - Cube coordinate
 * @returns Axial coordinate
 */
export declare function cubeToAxial(cube: CubeCoordinate): AxialCoordinate;
/**
 * Apply isometric projection to 2D coordinates (2:1 dimetric)
 * Transforms flat coordinates into isometric view
 *
 * @param pixel - Flat 2D pixel coordinate
 * @returns Isometric pixel coordinate
 */
export declare function applyIsometricProjection(pixel: PixelCoordinate): PixelCoordinate;
/**
 * Reverse isometric projection to 2D coordinates
 * Transforms isometric view back to flat coordinates
 *
 * @param pixel - Isometric pixel coordinate
 * @returns Flat 2D pixel coordinate
 */
export declare function reverseIsometricProjection(pixel: PixelCoordinate): PixelCoordinate;
/**
 * Convert hex to pixel coordinates
 *
 * @param hex - Axial hex coordinate
 * @param config - Grid configuration (size, orientation, projection)
 * @returns Pixel coordinate for hex center
 */
export declare function hexToPixel(hex: AxialCoordinate, config: HexGridConfig): PixelCoordinate;
/**
 * Convert pixel to hex coordinates with rounding
 * Returns nearest hex to pixel position
 *
 * @param pixel - Pixel coordinate
 * @param config - Grid configuration (size, orientation, projection)
 * @returns Nearest axial hex coordinate
 */
export declare function pixelToHex(pixel: PixelCoordinate, config: HexGridConfig): AxialCoordinate;
/**
 * Round fractional hex coordinates to nearest integer hex
 * Uses cube coordinates for accurate rounding
 *
 * @param hex - Fractional axial coordinates
 * @returns Rounded axial coordinates
 */
export declare function hexRound(hex: {
    q: number;
    r: number;
}): AxialCoordinate;
//# sourceMappingURL=coordinate-conversion.d.ts.map