/**
 * Unit Tests: Rotation
 * Tests for rotating hexes around a center point
 */

import { describe, it, expect } from 'vitest';
import { hexRotate, hexRotateLeft, hexRotateRight } from '../rotation';
import { hexDistance } from '../distance';
import { AxialCoordinate } from '../types';

describe('Rotation', () => {
  describe('hexRotate', () => {
    it('should return same hex when rotating around itself', () => {
      const hex: AxialCoordinate = { q: 3, r: 3 };
      const rotated = hexRotate(hex, hex, 1);

      expect(rotated).toEqual(hex);
    });

    it('should rotate 60° clockwise (steps=1)', () => {
      const center: AxialCoordinate = { q: 0, r: 0 };
      const hex: AxialCoordinate = { q: 1, r: 0 }; // E
      const rotated = hexRotate(hex, center, 1);

      // 60° clockwise from E should be SE
      expect(rotated).toEqual({ q: 0, r: 1 });
    });

    it('should rotate 120° clockwise (steps=2)', () => {
      const center: AxialCoordinate = { q: 0, r: 0 };
      const hex: AxialCoordinate = { q: 1, r: 0 }; // E
      const rotated = hexRotate(hex, center, 2);

      // 120° clockwise from E should be SW
      expect(rotated).toEqual({ q: -1, r: 1 });
    });

    it('should rotate 180° (steps=3)', () => {
      const center: AxialCoordinate = { q: 0, r: 0 };
      const hex: AxialCoordinate = { q: 1, r: 0 }; // E
      const rotated = hexRotate(hex, center, 3);

      // 180° from E should be W
      expect(rotated).toEqual({ q: -1, r: 0 });
    });

    it('should rotate 240° clockwise (steps=4)', () => {
      const center: AxialCoordinate = { q: 0, r: 0 };
      const hex: AxialCoordinate = { q: 1, r: 0 }; // E
      const rotated = hexRotate(hex, center, 4);

      // 240° clockwise from E should be NW
      expect(rotated).toEqual({ q: 0, r: -1 });
    });

    it('should rotate 300° clockwise (steps=5)', () => {
      const center: AxialCoordinate = { q: 0, r: 0 };
      const hex: AxialCoordinate = { q: 1, r: 0 }; // E
      const rotated = hexRotate(hex, center, 5);

      // 300° clockwise from E should be NE
      expect(rotated).toEqual({ q: 1, r: -1 });
    });

    it('should return original hex after 360° rotation (steps=6)', () => {
      const center: AxialCoordinate = { q: 0, r: 0 };
      const hex: AxialCoordinate = { q: 2, r: 1 };
      const rotated = hexRotate(hex, center, 6);

      expect(rotated).toEqual(hex);
    });

    it('should handle negative rotation (counter-clockwise)', () => {
      const center: AxialCoordinate = { q: 0, r: 0 };
      const hex: AxialCoordinate = { q: 1, r: 0 }; // E
      const rotated = hexRotate(hex, center, -1);

      // -60° (counter-clockwise) from E should be NE
      expect(rotated).toEqual({ q: 1, r: -1 });
    });

    it('should handle multiple full rotations', () => {
      const center: AxialCoordinate = { q: 0, r: 0 };
      const hex: AxialCoordinate = { q: 2, r: 1 };

      // 2 full rotations + 1 step = 13 steps
      const rotated = hexRotate(hex, center, 13);
      const expected = hexRotate(hex, center, 1);

      expect(rotated).toEqual(expected);
    });

    it('should preserve distance from center', () => {
      const center: AxialCoordinate = { q: 3, r: 3 };
      const hex: AxialCoordinate = { q: 5, r: 4 };
      const originalDistance = hexDistance(hex, center);

      // Rotate by various amounts
      for (let steps = 0; steps < 6; steps++) {
        const rotated = hexRotate(hex, center, steps);
        const rotatedDistance = hexDistance(rotated, center);
        expect(rotatedDistance).toBe(originalDistance);
      }
    });

    it('should work with non-origin centers', () => {
      const center: AxialCoordinate = { q: 5, r: 5 };
      const hex: AxialCoordinate = { q: 6, r: 5 }; // One hex to the east
      const rotated = hexRotate(hex, center, 1);

      // Should rotate 60° clockwise around (5,5)
      expect(rotated).toEqual({ q: 5, r: 6 });
    });

    it('should handle negative coordinates', () => {
      const center: AxialCoordinate = { q: -2, r: -2 };
      const hex: AxialCoordinate = { q: -1, r: -2 };
      const rotated = hexRotate(hex, center, 2);

      const originalDist = hexDistance(hex, center);
      const rotatedDist = hexDistance(rotated, center);
      expect(rotatedDist).toBe(originalDist);
    });

    it('should form identity after 6 rotations (cycle property)', () => {
      const center: AxialCoordinate = { q: 0, r: 0 };
      const hex: AxialCoordinate = { q: 3, r: 2 };

      let current = hex;
      for (let i = 0; i < 6; i++) {
        current = hexRotate(current, center, 1);
      }

      expect(current).toEqual(hex);
    });

    it('should handle rotation of all 6 neighbors around center', () => {
      const center: AxialCoordinate = { q: 0, r: 0 };
      // Clockwise rotation order for flat-top: E → SE → SW → W → NW → NE
      const neighbors: AxialCoordinate[] = [
        { q: 1, r: 0 },   // E
        { q: 0, r: 1 },   // SE
        { q: -1, r: 1 },  // SW
        { q: -1, r: 0 },  // W
        { q: 0, r: -1 },  // NW
        { q: 1, r: -1 }   // NE
      ];

      // Rotating each neighbor by 1 step should produce the next neighbor
      for (let i = 0; i < 6; i++) {
        const rotated = hexRotate(neighbors[i], center, 1);
        const expected = neighbors[(i + 1) % 6];
        expect(rotated).toEqual(expected);
      }
    });
  });

  describe('hexRotateRight', () => {
    it('should rotate one step clockwise', () => {
      const center: AxialCoordinate = { q: 0, r: 0 };
      const hex: AxialCoordinate = { q: 1, r: 0 };
      const rotated = hexRotateRight(hex, center);

      expect(rotated).toEqual({ q: 0, r: 1 });
    });

    it('should be equivalent to hexRotate with steps=1', () => {
      const center: AxialCoordinate = { q: 2, r: 3 };
      const hex: AxialCoordinate = { q: 4, r: 2 };

      const rotated1 = hexRotateRight(hex, center);
      const rotated2 = hexRotate(hex, center, 1);

      expect(rotated1).toEqual(rotated2);
    });
  });

  describe('hexRotateLeft', () => {
    it('should rotate one step counter-clockwise', () => {
      const center: AxialCoordinate = { q: 0, r: 0 };
      const hex: AxialCoordinate = { q: 1, r: 0 };
      const rotated = hexRotateLeft(hex, center);

      expect(rotated).toEqual({ q: 1, r: -1 });
    });

    it('should be equivalent to hexRotate with steps=-1', () => {
      const center: AxialCoordinate = { q: 2, r: 3 };
      const hex: AxialCoordinate = { q: 4, r: 2 };

      const rotated1 = hexRotateLeft(hex, center);
      const rotated2 = hexRotate(hex, center, -1);

      expect(rotated1).toEqual(rotated2);
    });

    it('should be inverse of hexRotateRight', () => {
      const center: AxialCoordinate = { q: 3, r: 3 };
      const hex: AxialCoordinate = { q: 5, r: 4 };

      const right = hexRotateRight(hex, center);
      const left = hexRotateLeft(right, center);

      expect(left).toEqual(hex);
    });
  });

  describe('Rotation edge cases', () => {
    it('should handle zero steps rotation', () => {
      const center: AxialCoordinate = { q: 0, r: 0 };
      const hex: AxialCoordinate = { q: 3, r: 2 };
      const rotated = hexRotate(hex, center, 0);

      expect(rotated).toEqual(hex);
    });

    it('should handle large positive steps', () => {
      const center: AxialCoordinate = { q: 0, r: 0 };
      const hex: AxialCoordinate = { q: 2, r: 1 };

      const rotated1 = hexRotate(hex, center, 100);
      const rotated2 = hexRotate(hex, center, 100 % 6);

      expect(rotated1).toEqual(rotated2);
    });

    it('should handle large negative steps', () => {
      const center: AxialCoordinate = { q: 0, r: 0 };
      const hex: AxialCoordinate = { q: 2, r: 1 };

      const rotated1 = hexRotate(hex, center, -100);
      const rotated2 = hexRotate(hex, center, -100 % 6);

      expect(rotated1).toEqual(rotated2);
    });

    it('should handle rotation at distance > 1', () => {
      const center: AxialCoordinate = { q: 0, r: 0 };
      const hex: AxialCoordinate = { q: 3, r: 0 }; // Distance 3 to the east
      const rotated = hexRotate(hex, center, 2);

      // Should maintain distance 3
      expect(hexDistance(rotated, center)).toBe(3);
    });
  });

  describe('Rotation invariants', () => {
    it('should preserve distance invariant for all rotations', () => {
      const center: AxialCoordinate = { q: 5, r: 3 };
      const hex: AxialCoordinate = { q: 8, r: 1 };
      const originalDist = hexDistance(hex, center);

      for (let steps = -12; steps <= 12; steps++) {
        const rotated = hexRotate(hex, center, steps);
        expect(hexDistance(rotated, center)).toBe(originalDist);
      }
    });

    it('should be associative: R(R(h,n),m) = R(h,n+m)', () => {
      const center: AxialCoordinate = { q: 0, r: 0 };
      const hex: AxialCoordinate = { q: 2, r: 1 };

      const rotate2Then3 = hexRotate(hexRotate(hex, center, 2), center, 3);
      const rotate5 = hexRotate(hex, center, 5);

      expect(rotate2Then3).toEqual(rotate5);
    });

    it('should have identity at steps=0', () => {
      const center: AxialCoordinate = { q: 3, r: 3 };
      const hex: AxialCoordinate = { q: 5, r: 2 };
      const rotated = hexRotate(hex, center, 0);

      expect(rotated).toEqual(hex);
    });

    it('should have cycle of 6 (group property)', () => {
      const center: AxialCoordinate = { q: 0, r: 0 };
      const hex: AxialCoordinate = { q: 4, r: 2 };

      const rotated6 = hexRotate(hex, center, 6);
      const rotated12 = hexRotate(hex, center, 12);
      const rotated0 = hexRotate(hex, center, 0);

      expect(rotated6).toEqual(hex);
      expect(rotated12).toEqual(hex);
      expect(rotated0).toEqual(hex);
    });
  });
});
