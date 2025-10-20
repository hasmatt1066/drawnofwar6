/**
 * Hex Math Library - HexGrid Class
 *
 * Convenient wrapper class that encapsulates grid configuration
 * and provides type-safe access to all hex math operations.
 */
import { AxialCoordinate, CubeCoordinate, PixelCoordinate, HexGridConfig } from './types';
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
export declare class HexGrid {
    private config;
    constructor(config: HexGridConfig);
    /**
     * Get grid configuration
     */
    getConfig(): Readonly<HexGridConfig>;
    /**
     * Get grid width (number of columns)
     */
    get width(): number;
    /**
     * Get grid height (number of rows)
     */
    get height(): number;
    /**
     * Get hex size (distance from center to corner)
     */
    get hexSize(): number;
    /**
     * Get hex orientation
     */
    get orientation(): 'flat-top' | 'pointy-top';
    /**
     * Convert axial to cube coordinates
     */
    axialToCube(hex: AxialCoordinate): CubeCoordinate;
    /**
     * Convert cube to axial coordinates
     */
    cubeToAxial(cube: CubeCoordinate): AxialCoordinate;
    /**
     * Convert hex to pixel coordinates
     */
    toPixel(hex: AxialCoordinate): PixelCoordinate;
    /**
     * Convert pixel to hex coordinates (with rounding)
     */
    fromPixel(pixel: PixelCoordinate): AxialCoordinate;
    /**
     * Round fractional hex coordinates to nearest integer hex
     */
    round(hex: {
        q: number;
        r: number;
    }): AxialCoordinate;
    /**
     * Calculate Manhattan distance between two hexes
     */
    distance(a: AxialCoordinate, b: AxialCoordinate): number;
    /**
     * Get all neighboring hexes (up to 6)
     * Filters out hexes outside grid boundaries
     */
    neighbors(hex: AxialCoordinate): AxialCoordinate[];
    /**
     * Get all hexes within specified range
     * Returns hexes sorted by distance (spiral order - closest first)
     */
    inRange(center: AxialCoordinate, range: number): AxialCoordinate[];
    /**
     * Draw a line between two hexes
     * Returns all hexes along the path (inclusive)
     */
    line(start: AxialCoordinate, end: AxialCoordinate): AxialCoordinate[];
    /**
     * Linear interpolation between two hexes
     */
    lerp(start: AxialCoordinate, end: AxialCoordinate, t: number): AxialCoordinate;
    /**
     * Rotate hex around center by 60° steps
     * Positive steps = clockwise, negative = counter-clockwise
     */
    rotate(hex: AxialCoordinate, center: AxialCoordinate, steps: number): AxialCoordinate;
    /**
     * Rotate hex 60° clockwise
     */
    rotateRight(hex: AxialCoordinate, center: AxialCoordinate): AxialCoordinate;
    /**
     * Rotate hex 60° counter-clockwise
     */
    rotateLeft(hex: AxialCoordinate, center: AxialCoordinate): AxialCoordinate;
    /**
     * Check if hex is within grid bounds
     */
    isValid(hex: AxialCoordinate): boolean;
    /**
     * Check if hex equals another hex
     */
    equals(a: AxialCoordinate, b: AxialCoordinate): boolean;
    /**
     * Create a hash key for hex (useful for Set/Map storage)
     */
    hash(hex: AxialCoordinate): string;
    /**
     * Parse hex from hash string
     */
    fromHash(hash: string): AxialCoordinate | null;
    /**
     * Get all hexes in the grid
     * Returns array of all valid hex coordinates
     */
    getAllHexes(): AxialCoordinate[];
    /**
     * Create a Set of hexes for efficient lookup
     */
    createHexSet(hexes: AxialCoordinate[]): Set<string>;
    /**
     * Create a Map from hexes to values
     */
    createHexMap<T>(entries: Array<[AxialCoordinate, T]>): Map<string, T>;
}
//# sourceMappingURL=HexGrid.d.ts.map