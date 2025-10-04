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
export function axialToCube(hex: AxialCoordinate): CubeCoordinate {
  const x = hex.q;
  const z = hex.r;
  const y = -x - z;
  // Avoid -0 by using explicit 0 when result is 0
  return { x: x || 0, y: y || 0, z: z || 0 };
}

/**
 * Convert cube to axial coordinates
 * Formula: q = x, r = z
 *
 * @param cube - Cube coordinate
 * @returns Axial coordinate
 */
export function cubeToAxial(cube: CubeCoordinate): AxialCoordinate {
  return { q: cube.x, r: cube.z };
}

/**
 * Convert hex to pixel coordinates
 *
 * @param hex - Axial hex coordinate
 * @param config - Grid configuration (size, orientation)
 * @returns Pixel coordinate for hex center
 */
export function hexToPixel(hex: AxialCoordinate, config: HexGridConfig): PixelCoordinate {
  const size = config.hexSize;

  if (config.orientation === 'flat-top') {
    const x = size * (3/2 * hex.q);
    const y = size * (Math.sqrt(3)/2 * hex.q + Math.sqrt(3) * hex.r);
    return { x, y };
  } else {
    // Pointy-top orientation
    const x = size * (Math.sqrt(3) * hex.q + Math.sqrt(3)/2 * hex.r);
    const y = size * (3/2 * hex.r);
    return { x, y };
  }
}

/**
 * Convert pixel to hex coordinates with rounding
 * Returns nearest hex to pixel position
 *
 * @param pixel - Pixel coordinate
 * @param config - Grid configuration (size, orientation)
 * @returns Nearest axial hex coordinate
 */
export function pixelToHex(pixel: PixelCoordinate, config: HexGridConfig): AxialCoordinate {
  const size = config.hexSize;
  let q: number, r: number;

  if (config.orientation === 'flat-top') {
    q = (2/3 * pixel.x) / size;
    r = (-1/3 * pixel.x + Math.sqrt(3)/3 * pixel.y) / size;
  } else {
    // Pointy-top orientation
    q = (Math.sqrt(3)/3 * pixel.x - 1/3 * pixel.y) / size;
    r = (2/3 * pixel.y) / size;
  }

  return hexRound({ q, r });
}

/**
 * Round fractional hex coordinates to nearest integer hex
 * Uses cube coordinates for accurate rounding
 *
 * @param hex - Fractional axial coordinates
 * @returns Rounded axial coordinates
 */
export function hexRound(hex: { q: number; r: number }): AxialCoordinate {
  // Convert to cube coordinates
  let { x, y, z } = axialToCube({ q: hex.q, r: hex.r });

  // Round each component
  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);

  // Calculate rounding errors
  const x_diff = Math.abs(rx - x);
  const y_diff = Math.abs(ry - y);
  const z_diff = Math.abs(rz - z);

  // Reset the component with largest rounding error to maintain invariant
  if (x_diff > y_diff && x_diff > z_diff) {
    rx = -ry - rz;
  } else if (y_diff > z_diff) {
    ry = -rx - rz;
  } else {
    rz = -rx - ry;
  }

  // Avoid -0 by converting to explicit 0
  return cubeToAxial({
    x: rx === 0 ? 0 : rx,
    y: ry === 0 ? 0 : ry,
    z: rz === 0 ? 0 : rz
  });
}
