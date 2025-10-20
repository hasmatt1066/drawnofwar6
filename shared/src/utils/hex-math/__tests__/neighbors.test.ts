/**
 * Unit Tests: Neighbor Finding
 * Tests for getting adjacent hexes
 */

import { describe, it, expect } from 'vitest';
import { hexNeighbors, isValidHex } from '../neighbors';
import { hexDistance } from '../distance';
import { AxialCoordinate, HexGridConfig } from '../types';

describe('Neighbor Finding', () => {
  const flatTopConfig: HexGridConfig = {
    width: 12,
    height: 8,
    hexSize: 32,
    orientation: 'flat-top'
  };

  const pointyTopConfig: HexGridConfig = {
    width: 12,
    height: 8,
    hexSize: 32,
    orientation: 'pointy-top'
  };

  describe('hexNeighbors (flat-top)', () => {
    it('should return 6 neighbors for center hex', () => {
      const hex: AxialCoordinate = { q: 5, r: 4 };
      const neighbors = hexNeighbors(hex, flatTopConfig);
      expect(neighbors).toHaveLength(6);
    });

    it('should return adjacent hexes only (distance 1)', () => {
      const hex: AxialCoordinate = { q: 3, r: 3 };
      const neighbors = hexNeighbors(hex, flatTopConfig);

      neighbors.forEach(n => {
        expect(hexDistance(hex, n)).toBe(1);
      });
    });

    it('should not include the source hex in neighbors', () => {
      const hex: AxialCoordinate = { q: 5, r: 5 };
      const neighbors = hexNeighbors(hex, flatTopConfig);

      const hasSelf = neighbors.some(n => n.q === hex.q && n.r === hex.r);
      expect(hasSelf).toBe(false);
    });

    it('should return unique hexes (no duplicates)', () => {
      const hex: AxialCoordinate = { q: 5, r: 5 };
      const neighbors = hexNeighbors(hex, flatTopConfig);

      const uniqueKeys = new Set(neighbors.map(n => `${n.q},${n.r}`));
      expect(uniqueKeys.size).toBe(neighbors.length);
    });

    it('should filter out-of-bounds neighbors for corner hex', () => {
      const corner: AxialCoordinate = { q: 0, r: 0 };
      const neighbors = hexNeighbors(corner, flatTopConfig);

      expect(neighbors.length).toBeLessThan(6);
      neighbors.forEach(n => {
        expect(isValidHex(n, flatTopConfig)).toBe(true);
      });
    });

    it('should filter out-of-bounds neighbors for edge hex', () => {
      const edge: AxialCoordinate = { q: 0, r: 4 };
      const neighbors = hexNeighbors(edge, flatTopConfig);

      expect(neighbors.length).toBeLessThan(6);
      neighbors.forEach(n => {
        expect(isValidHex(n, flatTopConfig)).toBe(true);
      });
    });

    it('should return all valid neighbors for grid boundary', () => {
      const bottomRight: AxialCoordinate = { q: 11, r: 7 };
      const neighbors = hexNeighbors(bottomRight, flatTopConfig);

      expect(neighbors.length).toBeLessThan(6);
      neighbors.forEach(n => {
        expect(isValidHex(n, flatTopConfig)).toBe(true);
      });
    });
  });

  describe('hexNeighbors (pointy-top)', () => {
    it('should return 6 neighbors for center hex', () => {
      const hex: AxialCoordinate = { q: 5, r: 4 };
      const neighbors = hexNeighbors(hex, pointyTopConfig);
      expect(neighbors).toHaveLength(6);
    });

    it('should have consistent direction vectors', () => {
      const hex: AxialCoordinate = { q: 2, r: 2 };
      const flatNeighbors = hexNeighbors(hex, flatTopConfig);
      const pointyNeighbors = hexNeighbors(hex, pointyTopConfig);

      // Both orientations should return 6 neighbors for center hex
      expect(flatNeighbors).toHaveLength(6);
      expect(pointyNeighbors).toHaveLength(6);

      // All neighbors should be at distance 1
      flatNeighbors.forEach(n => expect(hexDistance(hex, n)).toBe(1));
      pointyNeighbors.forEach(n => expect(hexDistance(hex, n)).toBe(1));
    });

    it('should return adjacent hexes only (distance 1)', () => {
      const hex: AxialCoordinate = { q: 3, r: 3 };
      const neighbors = hexNeighbors(hex, pointyTopConfig);

      neighbors.forEach(n => {
        expect(hexDistance(hex, n)).toBe(1);
      });
    });
  });

  describe('Direction coverage', () => {
    it('should cover all 6 directions for flat-top', () => {
      const center: AxialCoordinate = { q: 5, r: 4 };
      const neighbors = hexNeighbors(center, flatTopConfig);

      // All neighbors should be at distance 1
      expect(neighbors).toHaveLength(6);

      // Check that neighbors form a ring around center
      const angles = neighbors.map(n => {
        const dq = n.q - center.q;
        const dr = n.r - center.r;
        return Math.atan2(dr, dq);
      });

      // Angles should be distributed (no two neighbors in same direction)
      const uniqueAngles = new Set(angles.map(a => a.toFixed(2)));
      expect(uniqueAngles.size).toBe(6);
    });
  });
});

describe('Grid Validation', () => {
  const config: HexGridConfig = {
    width: 12,
    height: 8,
    hexSize: 32,
    orientation: 'flat-top'
  };

  describe('isValidHex', () => {
    it('should return true for origin hex', () => {
      const hex: AxialCoordinate = { q: 0, r: 0 };
      expect(isValidHex(hex, config)).toBe(true);
    });

    it('should return true for hex within grid bounds', () => {
      const testCases: AxialCoordinate[] = [
        { q: 5, r: 4 },
        { q: 0, r: 0 },
        { q: 11, r: 0 },
        { q: 0, r: 7 },
        { q: 11, r: 7 }
      ];

      testCases.forEach(hex => {
        expect(isValidHex(hex, config)).toBe(true);
      });
    });

    it('should return false for negative q', () => {
      const hex: AxialCoordinate = { q: -1, r: 0 };
      expect(isValidHex(hex, config)).toBe(false);
    });

    it('should return false for negative r', () => {
      const hex: AxialCoordinate = { q: 0, r: -1 };
      expect(isValidHex(hex, config)).toBe(false);
    });

    it('should return false for q >= width', () => {
      const hex: AxialCoordinate = { q: 12, r: 0 };
      expect(isValidHex(hex, config)).toBe(false);
    });

    it('should return false for r >= height', () => {
      const hex: AxialCoordinate = { q: 0, r: 8 };
      expect(isValidHex(hex, config)).toBe(false);
    });

    it('should handle edge cases correctly', () => {
      expect(isValidHex({ q: 11, r: 7 }, config)).toBe(true); // Max valid
      expect(isValidHex({ q: 12, r: 7 }, config)).toBe(false); // One past
      expect(isValidHex({ q: 11, r: 8 }, config)).toBe(false); // One past
    });

    it('should return false for far out-of-bounds', () => {
      const hex: AxialCoordinate = { q: 100, r: 100 };
      expect(isValidHex(hex, config)).toBe(false);
    });
  });

  describe('Grid boundary scenarios', () => {
    it('should validate all grid corners', () => {
      const corners: AxialCoordinate[] = [
        { q: 0, r: 0 },
        { q: 11, r: 0 },
        { q: 0, r: 7 },
        { q: 11, r: 7 }
      ];

      corners.forEach(corner => {
        expect(isValidHex(corner, config)).toBe(true);
      });
    });

    it('should invalidate hexes just outside corners', () => {
      const outsideCorners: AxialCoordinate[] = [
        { q: -1, r: -1 },
        { q: 12, r: -1 },
        { q: -1, r: 8 },
        { q: 12, r: 8 }
      ];

      outsideCorners.forEach(hex => {
        expect(isValidHex(hex, config)).toBe(false);
      });
    });
  });
});
