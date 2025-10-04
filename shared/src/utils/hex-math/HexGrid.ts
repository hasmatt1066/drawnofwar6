/**
 * Hex Math Library - HexGrid Class
 *
 * Convenient wrapper class that encapsulates grid configuration
 * and provides type-safe access to all hex math operations.
 */

import {
  AxialCoordinate,
  CubeCoordinate,
  PixelCoordinate,
  HexGridConfig
} from './types';

import {
  axialToCube,
  cubeToAxial,
  hexToPixel,
  pixelToHex,
  hexRound
} from './coordinate-conversion';

import { hexDistance } from './distance';
import { hexNeighbors, isValidHex } from './neighbors';
import { hexesInRange } from './range';
import { hexLine, hexLerp } from './line-of-sight';
import { hexRotate, hexRotateLeft, hexRotateRight } from './rotation';

/**
 * HexGrid class - Encapsulates hex grid configuration and operations
 *
 * Example usage:
 * ```typescript
 * const grid = new HexGrid({ width: 12, height: 8, hexSize: 32, orientation: 'flat-top' });
 * const neighbors = grid.neighbors({ q: 5, r: 4 });
 * const distance = grid.distance({ q: 0, r: 0 }, { q: 5, r: 3 });
 * const pixel = grid.toPixel({ q: 3, r: 2 });
 * ```
 */
export class HexGrid {
  private config: HexGridConfig;

  constructor(config: HexGridConfig) {
    this.config = config;
  }

  // ==================== Grid Configuration ====================

  /**
   * Get grid configuration
   */
  getConfig(): Readonly<HexGridConfig> {
    return { ...this.config };
  }

  /**
   * Get grid width (number of columns)
   */
  get width(): number {
    return this.config.width;
  }

  /**
   * Get grid height (number of rows)
   */
  get height(): number {
    return this.config.height;
  }

  /**
   * Get hex size (distance from center to corner)
   */
  get hexSize(): number {
    return this.config.hexSize;
  }

  /**
   * Get hex orientation
   */
  get orientation(): 'flat-top' | 'pointy-top' {
    return this.config.orientation;
  }

  // ==================== Coordinate Conversion ====================

  /**
   * Convert axial to cube coordinates
   */
  axialToCube(hex: AxialCoordinate): CubeCoordinate {
    return axialToCube(hex);
  }

  /**
   * Convert cube to axial coordinates
   */
  cubeToAxial(cube: CubeCoordinate): AxialCoordinate {
    return cubeToAxial(cube);
  }

  /**
   * Convert hex to pixel coordinates
   */
  toPixel(hex: AxialCoordinate): PixelCoordinate {
    return hexToPixel(hex, this.config);
  }

  /**
   * Convert pixel to hex coordinates (with rounding)
   */
  fromPixel(pixel: PixelCoordinate): AxialCoordinate {
    return pixelToHex(pixel, this.config);
  }

  /**
   * Round fractional hex coordinates to nearest integer hex
   */
  round(hex: { q: number; r: number }): AxialCoordinate {
    return hexRound(hex);
  }

  // ==================== Distance & Navigation ====================

  /**
   * Calculate Manhattan distance between two hexes
   */
  distance(a: AxialCoordinate, b: AxialCoordinate): number {
    return hexDistance(a, b);
  }

  /**
   * Get all neighboring hexes (up to 6)
   * Filters out hexes outside grid boundaries
   */
  neighbors(hex: AxialCoordinate): AxialCoordinate[] {
    return hexNeighbors(hex, this.config);
  }

  /**
   * Get all hexes within specified range
   * Returns hexes sorted by distance (spiral order - closest first)
   */
  inRange(center: AxialCoordinate, range: number): AxialCoordinate[] {
    return hexesInRange(center, range, this.config);
  }

  // ==================== Line of Sight ====================

  /**
   * Draw a line between two hexes
   * Returns all hexes along the path (inclusive)
   */
  line(start: AxialCoordinate, end: AxialCoordinate): AxialCoordinate[] {
    return hexLine(start, end);
  }

  /**
   * Linear interpolation between two hexes
   */
  lerp(start: AxialCoordinate, end: AxialCoordinate, t: number): AxialCoordinate {
    return hexLerp(start, end, t);
  }

  // ==================== Rotation ====================

  /**
   * Rotate hex around center by 60° steps
   * Positive steps = clockwise, negative = counter-clockwise
   */
  rotate(hex: AxialCoordinate, center: AxialCoordinate, steps: number): AxialCoordinate {
    return hexRotate(hex, center, steps);
  }

  /**
   * Rotate hex 60° clockwise
   */
  rotateRight(hex: AxialCoordinate, center: AxialCoordinate): AxialCoordinate {
    return hexRotateRight(hex, center);
  }

  /**
   * Rotate hex 60° counter-clockwise
   */
  rotateLeft(hex: AxialCoordinate, center: AxialCoordinate): AxialCoordinate {
    return hexRotateLeft(hex, center);
  }

  // ==================== Validation ====================

  /**
   * Check if hex is within grid bounds
   */
  isValid(hex: AxialCoordinate): boolean {
    return isValidHex(hex, this.config);
  }

  /**
   * Check if hex equals another hex
   */
  equals(a: AxialCoordinate, b: AxialCoordinate): boolean {
    return a.q === b.q && a.r === b.r;
  }

  // ==================== Utilities ====================

  /**
   * Create a hash key for hex (useful for Set/Map storage)
   */
  hash(hex: AxialCoordinate): string {
    return `${hex.q},${hex.r}`;
  }

  /**
   * Parse hex from hash string
   */
  fromHash(hash: string): AxialCoordinate | null {
    const parts = hash.split(',');
    if (parts.length !== 2) return null;

    const part0 = parts[0];
    const part1 = parts[1];
    if (!part0 || !part1) return null;

    const q = parseInt(part0, 10);
    const r = parseInt(part1, 10);

    if (isNaN(q) || isNaN(r)) return null;

    return { q, r };
  }

  /**
   * Get all hexes in the grid
   * Returns array of all valid hex coordinates
   */
  getAllHexes(): AxialCoordinate[] {
    const hexes: AxialCoordinate[] = [];

    for (let q = 0; q < this.config.width; q++) {
      for (let r = 0; r < this.config.height; r++) {
        hexes.push({ q, r });
      }
    }

    return hexes;
  }

  /**
   * Create a Set of hexes for efficient lookup
   */
  createHexSet(hexes: AxialCoordinate[]): Set<string> {
    return new Set(hexes.map(h => this.hash(h)));
  }

  /**
   * Create a Map from hexes to values
   */
  createHexMap<T>(entries: Array<[AxialCoordinate, T]>): Map<string, T> {
    return new Map(entries.map(([hex, value]) => [this.hash(hex), value]));
  }
}
