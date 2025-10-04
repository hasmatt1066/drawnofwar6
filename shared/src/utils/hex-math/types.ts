/**
 * Hex Math Library - Type Definitions
 *
 * Core type definitions for hexagonal grid mathematics.
 * Supports axial, cube, and pixel coordinate systems.
 */

/**
 * Axial coordinate system (storage format)
 * Two-axis representation for efficient storage
 */
export interface AxialCoordinate {
  /** Column (x-axis) */
  q: number;
  /** Row (z-axis) */
  r: number;
}

/**
 * Cube coordinate system (calculation format)
 * Three-axis representation for simplified calculations
 * Invariant: x + y + z = 0
 */
export interface CubeCoordinate {
  x: number;
  y: number;
  z: number;
}

/**
 * Pixel coordinate system (rendering format)
 * Screen position in pixels
 */
export interface PixelCoordinate {
  /** Screen x position */
  x: number;
  /** Screen y position */
  y: number;
}

/**
 * Hex grid configuration
 */
export interface HexGridConfig {
  /** Grid width in hexes */
  width: number;
  /** Grid height in hexes */
  height: number;
  /** Hex radius in pixels */
  hexSize: number;
  /** Hex orientation */
  orientation: 'flat-top' | 'pointy-top';
}

/**
 * Direction vectors for hex neighbors
 */
export enum HexDirection {
  NE = 0, // North-East
  E = 1,  // East
  SE = 2, // South-East
  SW = 3, // South-West
  W = 4,  // West
  NW = 5  // North-West
}
