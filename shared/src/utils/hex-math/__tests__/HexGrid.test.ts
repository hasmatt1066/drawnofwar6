/**
 * Unit Tests: HexGrid Class
 * Tests for the HexGrid wrapper class
 */

import { describe, it, expect } from 'vitest';
import { HexGrid } from './HexGrid';
import { AxialCoordinate } from './types';

describe('HexGrid Class', () => {
  const grid = new HexGrid({
    width: 12,
    height: 8,
    hexSize: 32,
    orientation: 'flat-top'
  });

  describe('Configuration', () => {
    it('should store grid configuration', () => {
      const config = grid.getConfig();
      expect(config.width).toBe(12);
      expect(config.height).toBe(8);
      expect(config.hexSize).toBe(32);
      expect(config.orientation).toBe('flat-top');
    });

    it('should expose width property', () => {
      expect(grid.width).toBe(12);
    });

    it('should expose height property', () => {
      expect(grid.height).toBe(8);
    });

    it('should expose hexSize property', () => {
      expect(grid.hexSize).toBe(32);
    });

    it('should expose orientation property', () => {
      expect(grid.orientation).toBe('flat-top');
    });
  });

  describe('Coordinate Conversion', () => {
    it('should convert axial to cube', () => {
      const cube = grid.axialToCube({ q: 2, r: 3 });
      expect(cube).toEqual({ x: 2, y: -5, z: 3 });
    });

    it('should convert cube to axial', () => {
      const axial = grid.cubeToAxial({ x: 2, y: -5, z: 3 });
      expect(axial).toEqual({ q: 2, r: 3 });
    });

    it('should convert hex to pixel', () => {
      const pixel = grid.toPixel({ q: 1, r: 0 });
      expect(pixel.x).toBe(48); // 32 * 3/2 * 1
    });

    it('should convert pixel to hex', () => {
      // Use pixel from hex (1,0) to ensure round-trip accuracy
      const pixel = grid.toPixel({ q: 1, r: 0 });
      const hex = grid.fromPixel(pixel);
      expect(hex.q).toBe(1);
      expect(hex.r).toBe(0);
    });

    it('should round fractional coordinates', () => {
      const rounded = grid.round({ q: 2.6, r: 1.4 });
      expect(rounded.q).toBe(3);
      expect(rounded.r).toBe(1);
    });
  });

  describe('Distance & Navigation', () => {
    it('should calculate distance', () => {
      const dist = grid.distance({ q: 0, r: 0 }, { q: 3, r: 2 });
      expect(dist).toBe(5);
    });

    it('should get neighbors', () => {
      const neighbors = grid.neighbors({ q: 5, r: 4 });
      expect(neighbors).toHaveLength(6);
    });

    it('should get hexes in range', () => {
      const hexes = grid.inRange({ q: 5, r: 4 }, 2);
      expect(hexes.length).toBeGreaterThan(7);
      hexes.forEach(h => {
        expect(grid.distance({ q: 5, r: 4 }, h)).toBeLessThanOrEqual(2);
      });
    });
  });

  describe('Line of Sight', () => {
    it('should draw line between hexes', () => {
      const line = grid.line({ q: 0, r: 0 }, { q: 3, r: 2 });
      expect(line[0]).toEqual({ q: 0, r: 0 });
      expect(line[line.length - 1]).toEqual({ q: 3, r: 2 });
    });

    it('should lerp between hexes', () => {
      const mid = grid.lerp({ q: 0, r: 0 }, { q: 4, r: 2 }, 0.5);
      expect(mid).toEqual({ q: 2, r: 1 });
    });
  });

  describe('Rotation', () => {
    it('should rotate hex around center', () => {
      const rotated = grid.rotate({ q: 1, r: 0 }, { q: 0, r: 0 }, 1);
      expect(rotated).toEqual({ q: 0, r: 1 });
    });

    it('should rotate right', () => {
      const rotated = grid.rotateRight({ q: 1, r: 0 }, { q: 0, r: 0 });
      expect(rotated).toEqual({ q: 0, r: 1 });
    });

    it('should rotate left', () => {
      const rotated = grid.rotateLeft({ q: 1, r: 0 }, { q: 0, r: 0 });
      expect(rotated).toEqual({ q: 1, r: -1 });
    });
  });

  describe('Validation', () => {
    it('should validate hex within bounds', () => {
      expect(grid.isValid({ q: 5, r: 4 })).toBe(true);
    });

    it('should invalidate hex outside bounds', () => {
      expect(grid.isValid({ q: 15, r: 4 })).toBe(false);
      expect(grid.isValid({ q: 5, r: 10 })).toBe(false);
      expect(grid.isValid({ q: -1, r: 0 })).toBe(false);
    });

    it('should check hex equality', () => {
      const a: AxialCoordinate = { q: 3, r: 2 };
      const b: AxialCoordinate = { q: 3, r: 2 };
      const c: AxialCoordinate = { q: 3, r: 3 };

      expect(grid.equals(a, b)).toBe(true);
      expect(grid.equals(a, c)).toBe(false);
    });
  });

  describe('Utilities', () => {
    it('should create hash from hex', () => {
      const hash = grid.hash({ q: 3, r: 5 });
      expect(hash).toBe('3,5');
    });

    it('should parse hex from hash', () => {
      const hex = grid.fromHash('3,5');
      expect(hex).toEqual({ q: 3, r: 5 });
    });

    it('should return null for invalid hash', () => {
      expect(grid.fromHash('invalid')).toBeNull();
      expect(grid.fromHash('3,5,7')).toBeNull();
      expect(grid.fromHash('a,b')).toBeNull();
    });

    it('should get all hexes in grid', () => {
      const hexes = grid.getAllHexes();
      expect(hexes).toHaveLength(12 * 8);

      hexes.forEach(hex => {
        expect(grid.isValid(hex)).toBe(true);
      });
    });

    it('should create hex set', () => {
      const hexes: AxialCoordinate[] = [
        { q: 1, r: 2 },
        { q: 3, r: 4 },
        { q: 5, r: 6 }
      ];
      const set = grid.createHexSet(hexes);

      expect(set.size).toBe(3);
      expect(set.has('1,2')).toBe(true);
      expect(set.has('3,4')).toBe(true);
      expect(set.has('5,6')).toBe(true);
      expect(set.has('7,8')).toBe(false);
    });

    it('should create hex map', () => {
      const entries: Array<[AxialCoordinate, string]> = [
        [{ q: 1, r: 2 }, 'A'],
        [{ q: 3, r: 4 }, 'B'],
        [{ q: 5, r: 6 }, 'C']
      ];
      const map = grid.createHexMap(entries);

      expect(map.size).toBe(3);
      expect(map.get('1,2')).toBe('A');
      expect(map.get('3,4')).toBe('B');
      expect(map.get('5,6')).toBe('C');
      expect(map.get('7,8')).toBeUndefined();
    });
  });

  describe('Integration', () => {
    it('should support chaining operations', () => {
      const start: AxialCoordinate = { q: 0, r: 0 };
      const end: AxialCoordinate = { q: 5, r: 3 };

      const line = grid.line(start, end);
      const validLine = line.filter(h => grid.isValid(h));
      const pixels = validLine.map(h => grid.toPixel(h));

      expect(line.length).toBe(grid.distance(start, end) + 1);
      expect(validLine.length).toBe(line.length); // All in bounds
      expect(pixels.length).toBe(line.length);
    });

    it('should support hex set operations', () => {
      const center: AxialCoordinate = { q: 5, r: 4 };
      const range1 = grid.inRange(center, 1);
      const range2 = grid.inRange(center, 2);

      const set1 = grid.createHexSet(range1);
      const set2 = grid.createHexSet(range2);

      // Range 2 should include all range 1 hexes
      range1.forEach(hex => {
        expect(set2.has(grid.hash(hex))).toBe(true);
      });

      // Range 2 should have more hexes than range 1
      expect(set2.size).toBeGreaterThan(set1.size);
    });

    it('should support grid boundary queries', () => {
      const allHexes = grid.getAllHexes();
      const corners = [
        { q: 0, r: 0 },
        { q: 11, r: 0 },
        { q: 0, r: 7 },
        { q: 11, r: 7 }
      ];

      corners.forEach(corner => {
        expect(grid.isValid(corner)).toBe(true);

        const neighbors = grid.neighbors(corner);
        expect(neighbors.length).toBeLessThan(6);

        neighbors.forEach(n => {
          expect(grid.isValid(n)).toBe(true);
        });
      });
    });
  });
});
