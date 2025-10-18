/**
 * Unit Tests: Line of Sight
 * Tests for hex line drawing and interpolation
 */

import { describe, it, expect } from 'vitest';
import { hexLine, hexLerp } from './line-of-sight';
import { hexDistance } from './distance';
import { AxialCoordinate } from './types';

describe('Line of Sight', () => {
  describe('hexLerp', () => {
    it('should return start hex when t=0', () => {
      const start: AxialCoordinate = { q: 0, r: 0 };
      const end: AxialCoordinate = { q: 5, r: 3 };
      const result = hexLerp(start, end, 0);

      expect(result).toEqual(start);
    });

    it('should return end hex when t=1', () => {
      const start: AxialCoordinate = { q: 0, r: 0 };
      const end: AxialCoordinate = { q: 5, r: 3 };
      const result = hexLerp(start, end, 1);

      expect(result).toEqual(end);
    });

    it('should interpolate midpoint correctly', () => {
      const start: AxialCoordinate = { q: 0, r: 0 };
      const end: AxialCoordinate = { q: 4, r: 2 };
      const result = hexLerp(start, end, 0.5);

      expect(result.q).toBe(2);
      expect(result.r).toBe(1);
    });

    it('should handle negative coordinates', () => {
      const start: AxialCoordinate = { q: -3, r: -2 };
      const end: AxialCoordinate = { q: 3, r: 2 };
      const result = hexLerp(start, end, 0.5);

      expect(result.q).toBe(0);
      expect(result.r).toBe(0);
    });

    it('should round fractional results to nearest hex', () => {
      const start: AxialCoordinate = { q: 0, r: 0 };
      const end: AxialCoordinate = { q: 5, r: 3 };
      const result = hexLerp(start, end, 0.33);

      // Verify it's a valid integer coordinate
      expect(Number.isInteger(result.q)).toBe(true);
      expect(Number.isInteger(result.r)).toBe(true);
    });

    it('should handle same start and end', () => {
      const hex: AxialCoordinate = { q: 3, r: 3 };
      const result = hexLerp(hex, hex, 0.5);

      expect(result).toEqual(hex);
    });

    it('should clamp t values outside [0,1]', () => {
      const start: AxialCoordinate = { q: 0, r: 0 };
      const end: AxialCoordinate = { q: 5, r: 3 };

      const resultNegative = hexLerp(start, end, -0.5);
      expect(resultNegative).toEqual(start);

      const resultOver = hexLerp(start, end, 1.5);
      expect(resultOver).toEqual(end);
    });
  });

  describe('hexLine', () => {
    it('should return single hex for same start and end', () => {
      const hex: AxialCoordinate = { q: 3, r: 3 };
      const line = hexLine(hex, hex);

      expect(line).toHaveLength(1);
      expect(line[0]).toEqual(hex);
    });

    it('should return straight horizontal line', () => {
      const start: AxialCoordinate = { q: 0, r: 0 };
      const end: AxialCoordinate = { q: 5, r: 0 };
      const line = hexLine(start, end);

      expect(line).toHaveLength(6);
      expect(line[0]).toEqual(start);
      expect(line[5]).toEqual(end);

      // All hexes should have r=0
      line.forEach(hex => {
        expect(hex.r).toBe(0);
      });
    });

    it('should return straight vertical line', () => {
      const start: AxialCoordinate = { q: 0, r: 0 };
      const end: AxialCoordinate = { q: 0, r: 5 };
      const line = hexLine(start, end);

      expect(line).toHaveLength(6);
      expect(line[0]).toEqual(start);
      expect(line[5]).toEqual(end);

      // All hexes should have q=0
      line.forEach(hex => {
        expect(hex.q).toBe(0);
      });
    });

    it('should return diagonal line', () => {
      const start: AxialCoordinate = { q: 0, r: 0 };
      const end: AxialCoordinate = { q: 3, r: 3 };
      const line = hexLine(start, end);

      expect(line[0]).toEqual(start);
      expect(line[line.length - 1]).toEqual(end);
    });

    it('should have length equal to distance + 1', () => {
      const start: AxialCoordinate = { q: 2, r: 1 };
      const end: AxialCoordinate = { q: 5, r: 4 };
      const line = hexLine(start, end);
      const dist = hexDistance(start, end);

      expect(line.length).toBe(dist + 1);
    });

    it('should include both endpoints', () => {
      const start: AxialCoordinate = { q: 1, r: 1 };
      const end: AxialCoordinate = { q: 7, r: 4 };
      const line = hexLine(start, end);

      expect(line[0]).toEqual(start);
      expect(line[line.length - 1]).toEqual(end);
    });

    it('should return continuous path (all adjacent hexes)', () => {
      const start: AxialCoordinate = { q: 0, r: 0 };
      const end: AxialCoordinate = { q: 5, r: 3 };
      const line = hexLine(start, end);

      // Each hex should be distance 1 from the next
      for (let i = 0; i < line.length - 1; i++) {
        const dist = hexDistance(line[i], line[i + 1]);
        expect(dist).toBeLessThanOrEqual(1);
      }
    });

    it('should handle negative coordinates', () => {
      const start: AxialCoordinate = { q: -3, r: -2 };
      const end: AxialCoordinate = { q: 2, r: 1 };
      const line = hexLine(start, end);

      expect(line[0]).toEqual(start);
      expect(line[line.length - 1]).toEqual(end);
      expect(line.length).toBe(hexDistance(start, end) + 1);
    });

    it('should be reversible (same path backwards)', () => {
      const start: AxialCoordinate = { q: 0, r: 0 };
      const end: AxialCoordinate = { q: 5, r: 3 };

      const forward = hexLine(start, end);
      const backward = hexLine(end, start);

      expect(forward.length).toBe(backward.length);

      // Paths should be reverses of each other
      for (let i = 0; i < forward.length; i++) {
        expect(forward[i]).toEqual(backward[backward.length - 1 - i]);
      }
    });

    it('should not have duplicate hexes in path', () => {
      const start: AxialCoordinate = { q: 0, r: 0 };
      const end: AxialCoordinate = { q: 5, r: 3 };
      const line = hexLine(start, end);

      const uniqueKeys = new Set(line.map(h => `${h.q},${h.r}`));
      expect(uniqueKeys.size).toBe(line.length);
    });

    it('should handle long distance lines', () => {
      const start: AxialCoordinate = { q: 0, r: 0 };
      const end: AxialCoordinate = { q: 20, r: 15 };
      const line = hexLine(start, end);

      expect(line[0]).toEqual(start);
      expect(line[line.length - 1]).toEqual(end);
      expect(line.length).toBe(hexDistance(start, end) + 1);
    });
  });

  describe('Line of sight integration', () => {
    it('should produce consistent results for lerp and line', () => {
      const start: AxialCoordinate = { q: 0, r: 0 };
      const end: AxialCoordinate = { q: 6, r: 3 };
      const line = hexLine(start, end);

      // Lerp at specific intervals should match line hexes
      const dist = hexDistance(start, end);
      const midpoint = hexLerp(start, end, 0.5);

      // Midpoint should be in the line
      const midpointInLine = line.some(h => h.q === midpoint.q && h.r === midpoint.r);
      expect(midpointInLine).toBe(true);
    });

    it('should handle all 6 cardinal directions', () => {
      const center: AxialCoordinate = { q: 5, r: 5 };
      const directions: AxialCoordinate[] = [
        { q: 10, r: 5 },   // E
        { q: 10, r: 0 },   // NE
        { q: 5, r: 0 },    // NW
        { q: 0, r: 5 },    // W
        { q: 0, r: 10 },   // SW
        { q: 5, r: 10 }    // SE
      ];

      directions.forEach(dir => {
        const line = hexLine(center, dir);
        expect(line[0]).toEqual(center);
        expect(line[line.length - 1]).toEqual(dir);
        expect(line.length).toBe(hexDistance(center, dir) + 1);
      });
    });
  });
});
