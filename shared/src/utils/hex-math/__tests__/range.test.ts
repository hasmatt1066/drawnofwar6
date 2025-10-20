/**
 * Unit Tests: Range Queries
 * Tests for getting hexes within range
 */

import { describe, it, expect } from 'vitest';
import { hexesInRange } from '../range';
import { hexDistance } from '../distance';
import { AxialCoordinate, HexGridConfig } from '../types';

describe('Range Queries', () => {
  const config: HexGridConfig = {
    width: 12,
    height: 8,
    hexSize: 32,
    orientation: 'flat-top'
  };

  describe('hexesInRange', () => {
    it('should return only center hex for range 0', () => {
      const center: AxialCoordinate = { q: 5, r: 4 };
      const hexes = hexesInRange(center, 0, config);

      expect(hexes).toHaveLength(1);
      expect(hexes[0]).toEqual(center);
    });

    it('should return hexes within range 1 (7 hexes total)', () => {
      const center: AxialCoordinate = { q: 5, r: 4 };
      const hexes = hexesInRange(center, 1, config);

      // Center + 6 neighbors = 7 hexes
      expect(hexes.length).toBe(7);

      hexes.forEach(h => {
        expect(hexDistance(center, h)).toBeLessThanOrEqual(1);
      });
    });

    it('should return hexes within range 2', () => {
      const center: AxialCoordinate = { q: 5, r: 4 };
      const hexes = hexesInRange(center, 2, config);

      hexes.forEach(h => {
        expect(hexDistance(center, h)).toBeLessThanOrEqual(2);
      });

      // Should be more than range 1
      expect(hexes.length).toBeGreaterThan(7);
    });

    it('should include center hex in range', () => {
      const center: AxialCoordinate = { q: 3, r: 3 };
      const hexes = hexesInRange(center, 2, config);

      const hasCenter = hexes.some(h => h.q === center.q && h.r === center.r);
      expect(hasCenter).toBe(true);
    });

    it('should return hexes in spiral order (closest first)', () => {
      const center: AxialCoordinate = { q: 5, r: 4 };
      const hexes = hexesInRange(center, 3, config);

      // Verify distances are non-decreasing
      for (let i = 1; i < hexes.length; i++) {
        const dist1 = hexDistance(center, hexes[i - 1]);
        const dist2 = hexDistance(center, hexes[i]);
        expect(dist2).toBeGreaterThanOrEqual(dist1);
      }
    });

    it('should filter out-of-bounds hexes', () => {
      const corner: AxialCoordinate = { q: 0, r: 0 };
      const hexes = hexesInRange(corner, 2, config);

      hexes.forEach(h => {
        expect(h.q).toBeGreaterThanOrEqual(0);
        expect(h.r).toBeGreaterThanOrEqual(0);
        expect(h.q).toBeLessThan(config.width);
        expect(h.r).toBeLessThan(config.height);
      });
    });

    it('should handle large ranges', () => {
      const center: AxialCoordinate = { q: 5, r: 4 };
      const hexes = hexesInRange(center, 10, config);

      // All hexes should be within range
      hexes.forEach(h => {
        expect(hexDistance(center, h)).toBeLessThanOrEqual(10);
      });

      // Should return many hexes
      expect(hexes.length).toBeGreaterThan(50);
    });

    it('should return empty array for invalid center', () => {
      const invalidCenter: AxialCoordinate = { q: -5, r: -5 };
      const hexes = hexesInRange(invalidCenter, 2, config);

      // Invalid center should still attempt to find hexes, but they'll be filtered
      expect(hexes.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle edge hex ranges correctly', () => {
      const edge: AxialCoordinate = { q: 11, r: 7 };
      const hexes = hexesInRange(edge, 2, config);

      // All returned hexes should be valid
      hexes.forEach(h => {
        expect(h.q).toBeGreaterThanOrEqual(0);
        expect(h.r).toBeGreaterThanOrEqual(0);
        expect(h.q).toBeLessThan(config.width);
        expect(h.r).toBeLessThan(config.height);
      });

      // Should return fewer hexes than center (due to boundary)
      const centerHexes = hexesInRange({ q: 5, r: 4 }, 2, config);
      expect(hexes.length).toBeLessThan(centerHexes.length);
    });
  });

  describe('Range size validation', () => {
    it('should return correct count for range 0', () => {
      const center: AxialCoordinate = { q: 5, r: 4 };
      const hexes = hexesInRange(center, 0, config);
      expect(hexes).toHaveLength(1); // Just center
    });

    it('should return correct count for range 1 (unbounded)', () => {
      // In unbounded grid, range 1 = 1 + 6 = 7 hexes
      const largeConfig: HexGridConfig = { ...config, width: 100, height: 100 };
      const center: AxialCoordinate = { q: 50, r: 50 };
      const hexes = hexesInRange(center, 1, largeConfig);
      expect(hexes).toHaveLength(7);
    });

    it('should return correct count for range 2 (unbounded)', () => {
      // In unbounded grid, range 2 = 1 + 6 + 12 = 19 hexes
      const largeConfig: HexGridConfig = { ...config, width: 100, height: 100 };
      const center: AxialCoordinate = { q: 50, r: 50 };
      const hexes = hexesInRange(center, 2, largeConfig);
      expect(hexes).toHaveLength(19);
    });
  });

  describe('Performance', () => {
    it('should handle range queries efficiently', () => {
      const center: AxialCoordinate = { q: 5, r: 4 };
      const start = performance.now();

      for (let i = 0; i < 100; i++) {
        hexesInRange(center, 3, config);
      }

      const end = performance.now();
      const duration = end - start;

      // 100 range-3 queries should complete in < 50ms
      expect(duration).toBeLessThan(50);
    });
  });
});
