/**
 * Unit Tests: Distance Calculation
 * Tests for hex distance calculations using cube coordinates
 */

import { describe, it, expect } from 'vitest';
import { hexDistance } from './distance';
import { AxialCoordinate } from './types';

describe('Hex Distance Calculation', () => {
  describe('Basic distance calculations', () => {
    it('should return 0 for same hex', () => {
      const hex: AxialCoordinate = { q: 5, r: 5 };
      expect(hexDistance(hex, hex)).toBe(0);
    });

    it('should return 0 for origin to origin', () => {
      const origin: AxialCoordinate = { q: 0, r: 0 };
      expect(hexDistance(origin, origin)).toBe(0);
    });

    it('should calculate distance between adjacent hexes as 1', () => {
      const center: AxialCoordinate = { q: 0, r: 0 };
      const adjacent: AxialCoordinate = { q: 1, r: 0 };
      expect(hexDistance(center, adjacent)).toBe(1);
    });

    it('should calculate distance correctly (3,2) to (0,0)', () => {
      const a: AxialCoordinate = { q: 0, r: 0 };
      const b: AxialCoordinate = { q: 3, r: -2 };
      expect(hexDistance(a, b)).toBe(3);
    });

    it('should calculate distance correctly (1,1) to (3,3)', () => {
      const a: AxialCoordinate = { q: 1, r: 1 };
      const b: AxialCoordinate = { q: 3, r: 3 };
      expect(hexDistance(a, b)).toBe(4);
    });
  });

  describe('Distance properties', () => {
    it('should be symmetric (distance A→B === B→A)', () => {
      const testCases: [AxialCoordinate, AxialCoordinate][] = [
        [{ q: 0, r: 0 }, { q: 5, r: 3 }],
        [{ q: 1, r: 2 }, { q: 4, r: -1 }],
        [{ q: -3, r: 7 }, { q: 2, r: -4 }],
        [{ q: 10, r: 10 }, { q: -5, r: -5 }]
      ];

      testCases.forEach(([a, b]) => {
        expect(hexDistance(a, b)).toBe(hexDistance(b, a));
      });
    });

    it('should satisfy triangle inequality', () => {
      const a: AxialCoordinate = { q: 0, r: 0 };
      const b: AxialCoordinate = { q: 5, r: 3 };
      const c: AxialCoordinate = { q: 2, r: 7 };

      const ab = hexDistance(a, b);
      const bc = hexDistance(b, c);
      const ac = hexDistance(a, c);

      expect(ac).toBeLessThanOrEqual(ab + bc);
    });

    it('should return integer values only', () => {
      const testCases: [AxialCoordinate, AxialCoordinate][] = [
        [{ q: 0, r: 0 }, { q: 7, r: 3 }],
        [{ q: -5, r: 2 }, { q: 3, r: -8 }],
        [{ q: 10, r: 10 }, { q: -10, r: -10 }]
      ];

      testCases.forEach(([a, b]) => {
        const distance = hexDistance(a, b);
        expect(Number.isInteger(distance)).toBe(true);
      });
    });
  });

  describe('Negative coordinates', () => {
    it('should handle negative q coordinate', () => {
      const a: AxialCoordinate = { q: -3, r: 0 };
      const b: AxialCoordinate = { q: 0, r: 0 };
      expect(hexDistance(a, b)).toBe(3);
    });

    it('should handle negative r coordinate', () => {
      const a: AxialCoordinate = { q: 0, r: -4 };
      const b: AxialCoordinate = { q: 0, r: 0 };
      expect(hexDistance(a, b)).toBe(4);
    });

    it('should handle both negative coordinates', () => {
      const a: AxialCoordinate = { q: -2, r: -3 };
      const b: AxialCoordinate = { q: 0, r: 0 };
      expect(hexDistance(a, b)).toBe(5);
    });

    it('should handle negative to positive', () => {
      const a: AxialCoordinate = { q: -5, r: -5 };
      const b: AxialCoordinate = { q: 5, r: 5 };
      expect(hexDistance(a, b)).toBe(20);
    });
  });

  describe('Edge cases', () => {
    it('should handle large distances', () => {
      const a: AxialCoordinate = { q: 0, r: 0 };
      const b: AxialCoordinate = { q: 100, r: 100 };
      const distance = hexDistance(a, b);
      expect(distance).toBeGreaterThan(0);
      expect(Number.isInteger(distance)).toBe(true);
    });

    it('should handle maximum grid distance (12x8 grid)', () => {
      const topLeft: AxialCoordinate = { q: 0, r: 0 };
      const bottomRight: AxialCoordinate = { q: 11, r: 7 };
      const distance = hexDistance(topLeft, bottomRight);
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThanOrEqual(18); // Approximate max for 12x8 grid
    });

    it('should handle diagonal movement', () => {
      // Moving diagonally in hex grid
      const start: AxialCoordinate = { q: 0, r: 0 };
      const diagonal: AxialCoordinate = { q: 3, r: 3 };
      expect(hexDistance(start, diagonal)).toBe(6);
    });

    it('should handle straight line movement (same r)', () => {
      const start: AxialCoordinate = { q: 0, r: 5 };
      const end: AxialCoordinate = { q: 7, r: 5 };
      expect(hexDistance(start, end)).toBe(7);
    });

    it('should handle straight line movement (same q)', () => {
      const start: AxialCoordinate = { q: 3, r: 0 };
      const end: AxialCoordinate = { q: 3, r: 6 };
      expect(hexDistance(start, end)).toBe(6);
    });
  });

  describe('Performance characteristics', () => {
    it('should be fast enough for 1000 calculations', () => {
      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        const a: AxialCoordinate = { q: i % 12, r: Math.floor(i / 12) % 8 };
        const b: AxialCoordinate = { q: (i + 5) % 12, r: Math.floor((i + 5) / 12) % 8 };
        hexDistance(a, b);
      }

      const end = performance.now();
      const duration = end - start;

      // Should complete 1000 calculations in less than 10ms
      expect(duration).toBeLessThan(10);
    });
  });
});
