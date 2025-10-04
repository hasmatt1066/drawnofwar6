/**
 * Unit Tests: Coordinate Conversion
 * Tests for axial ↔ cube ↔ pixel coordinate conversions
 */

import { describe, it, expect } from 'vitest';
import {
  axialToCube,
  cubeToAxial,
  hexToPixel,
  pixelToHex,
  hexRound
} from './coordinate-conversion';
import { AxialCoordinate, CubeCoordinate, HexGridConfig } from './types';

describe('Axial ↔ Cube Conversion', () => {
  describe('axialToCube', () => {
    it('should convert axial (0,0) to cube (0,0,0)', () => {
      const axial: AxialCoordinate = { q: 0, r: 0 };
      const cube = axialToCube(axial);
      expect(cube.x).toBe(0);
      expect(cube.y).toBe(0);
      expect(cube.z).toBe(0);
    });

    it('should convert axial (2,3) to cube (2,-5,3)', () => {
      const axial: AxialCoordinate = { q: 2, r: 3 };
      const cube = axialToCube(axial);
      expect(cube).toEqual({ x: 2, y: -5, z: 3 });
    });

    it('should maintain cube coordinate invariant (x+y+z=0)', () => {
      const testCases: AxialCoordinate[] = [
        { q: 0, r: 0 },
        { q: 5, r: -2 },
        { q: -3, r: 7 },
        { q: 10, r: 10 }
      ];

      testCases.forEach(axial => {
        const cube = axialToCube(axial);
        expect(cube.x + cube.y + cube.z).toBe(0);
      });
    });

    it('should handle negative coordinates', () => {
      const axial: AxialCoordinate = { q: -5, r: -3 };
      const cube = axialToCube(axial);
      expect(cube).toEqual({ x: -5, y: 8, z: -3 });
      expect(cube.x + cube.y + cube.z).toBe(0);
    });
  });

  describe('cubeToAxial', () => {
    it('should convert cube (0,0,0) to axial (0,0)', () => {
      const cube: CubeCoordinate = { x: 0, y: 0, z: 0 };
      const axial = cubeToAxial(cube);
      expect(axial).toEqual({ q: 0, r: 0 });
    });

    it('should convert cube (2,-5,3) to axial (2,3)', () => {
      const cube: CubeCoordinate = { x: 2, y: -5, z: 3 };
      const axial = cubeToAxial(cube);
      expect(axial).toEqual({ q: 2, r: 3 });
    });

    it('should handle negative coordinates', () => {
      const cube: CubeCoordinate = { x: -3, y: 5, z: -2 };
      const axial = cubeToAxial(cube);
      expect(axial).toEqual({ q: -3, r: -2 });
    });
  });

  describe('Round-trip conversion', () => {
    it('should round-trip axial → cube → axial', () => {
      const testCases: AxialCoordinate[] = [
        { q: 0, r: 0 },
        { q: 5, r: -2 },
        { q: -3, r: 7 },
        { q: 10, r: 10 },
        { q: -8, r: -5 }
      ];

      testCases.forEach(original => {
        const cube = axialToCube(original);
        const result = cubeToAxial(cube);
        expect(result).toEqual(original);
      });
    });

    it('should round-trip cube → axial → cube', () => {
      const testCases: CubeCoordinate[] = [
        { x: 0, y: 0, z: 0 },
        { x: 3, y: -5, z: 2 },
        { x: -4, y: 7, z: -3 },
        { x: 10, y: -15, z: 5 }
      ];

      testCases.forEach(original => {
        const axial = cubeToAxial(original);
        const result = axialToCube(axial);
        expect(result.x).toBe(original.x);
        expect(result.y).toBe(original.y);
        expect(result.z).toBe(original.z);
      });
    });
  });
});

describe('Hex ↔ Pixel Conversion', () => {
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

  describe('hexToPixel (flat-top)', () => {
    it('should convert origin hex (0,0) to pixel (0,0)', () => {
      const hex: AxialCoordinate = { q: 0, r: 0 };
      const pixel = hexToPixel(hex, flatTopConfig);
      expect(pixel.x).toBeCloseTo(0, 1);
      expect(pixel.y).toBeCloseTo(0, 1);
    });

    it('should convert hex (1,0) correctly', () => {
      const hex: AxialCoordinate = { q: 1, r: 0 };
      const pixel = hexToPixel(hex, flatTopConfig);
      const expectedX = 32 * (3/2); // 48
      const expectedY = 32 * (Math.sqrt(3)/2); // ~27.71
      expect(pixel.x).toBeCloseTo(expectedX, 1);
      expect(pixel.y).toBeCloseTo(expectedY, 1);
    });

    it('should convert hex (0,1) correctly', () => {
      const hex: AxialCoordinate = { q: 0, r: 1 };
      const pixel = hexToPixel(hex, flatTopConfig);
      const expectedY = 32 * Math.sqrt(3);
      expect(pixel.x).toBeCloseTo(0, 1);
      expect(pixel.y).toBeCloseTo(expectedY, 1);
    });

    it('should scale with hex size', () => {
      const hex: AxialCoordinate = { q: 2, r: 2 };
      const config16 = { ...flatTopConfig, hexSize: 16 };
      const config64 = { ...flatTopConfig, hexSize: 64 };

      const pixel16 = hexToPixel(hex, config16);
      const pixel64 = hexToPixel(hex, config64);

      expect(pixel64.x).toBeCloseTo(pixel16.x * 4, 1);
      expect(pixel64.y).toBeCloseTo(pixel16.y * 4, 1);
    });
  });

  describe('hexToPixel (pointy-top)', () => {
    it('should convert origin hex (0,0) to pixel (0,0)', () => {
      const hex: AxialCoordinate = { q: 0, r: 0 };
      const pixel = hexToPixel(hex, pointyTopConfig);
      expect(pixel.x).toBeCloseTo(0, 1);
      expect(pixel.y).toBeCloseTo(0, 1);
    });

    it('should produce different coordinates than flat-top', () => {
      const hex: AxialCoordinate = { q: 2, r: 3 };
      const flatPixel = hexToPixel(hex, flatTopConfig);
      const pointyPixel = hexToPixel(hex, pointyTopConfig);

      expect(flatPixel.x).not.toBeCloseTo(pointyPixel.x, 0);
      expect(flatPixel.y).not.toBeCloseTo(pointyPixel.y, 0);
    });
  });

  describe('pixelToHex (flat-top)', () => {
    it('should convert pixel (0,0) to hex (0,0)', () => {
      const pixel = { x: 0, y: 0 };
      const hex = pixelToHex(pixel, flatTopConfig);
      expect(hex).toEqual({ q: 0, r: 0 });
    });

    it('should round to nearest hex', () => {
      const hex: AxialCoordinate = { q: 2, r: 2 };
      const pixel = hexToPixel(hex, flatTopConfig);

      // Add small offset (should still round to same hex)
      const offsetPixel = { x: pixel.x + 5, y: pixel.y + 5 };
      const rounded = pixelToHex(offsetPixel, flatTopConfig);
      expect(rounded).toEqual(hex);
    });

    it('should round fractional coordinates correctly', () => {
      // Pixel halfway between two hexes should round to one of them
      const hex1: AxialCoordinate = { q: 0, r: 0 };
      const hex2: AxialCoordinate = { q: 1, r: 0 };
      const pixel1 = hexToPixel(hex1, flatTopConfig);
      const pixel2 = hexToPixel(hex2, flatTopConfig);

      const midPixel = {
        x: (pixel1.x + pixel2.x) / 2,
        y: (pixel1.y + pixel2.y) / 2
      };

      const result = pixelToHex(midPixel, flatTopConfig);
      const isValidRound = (result.q === hex1.q && result.r === hex1.r) ||
                           (result.q === hex2.q && result.r === hex2.r);
      expect(isValidRound).toBe(true);
    });
  });

  describe('Round-trip hex → pixel → hex', () => {
    it('should round-trip for flat-top orientation', () => {
      const testCases: AxialCoordinate[] = [
        { q: 0, r: 0 },
        { q: 5, r: 3 },
        { q: -2, r: 4 },
        { q: 7, r: -3 }
      ];

      testCases.forEach(original => {
        const pixel = hexToPixel(original, flatTopConfig);
        const result = pixelToHex(pixel, flatTopConfig);
        expect(result).toEqual(original);
      });
    });

    it('should round-trip for pointy-top orientation', () => {
      const testCases: AxialCoordinate[] = [
        { q: 0, r: 0 },
        { q: 5, r: 3 },
        { q: -2, r: 4 },
        { q: 7, r: -3 }
      ];

      testCases.forEach(original => {
        const pixel = hexToPixel(original, pointyTopConfig);
        const result = pixelToHex(pixel, pointyTopConfig);
        expect(result).toEqual(original);
      });
    });
  });
});

describe('Hex Rounding', () => {
  it('should round integer coordinates to themselves', () => {
    const hex = { q: 3, r: 5 };
    const rounded = hexRound(hex);
    expect(rounded).toEqual(hex);
  });

  it('should round fractional coordinates to nearest hex', () => {
    const fractional = { q: 2.4, r: 3.6 };
    const rounded = hexRound(fractional);
    expect(Number.isInteger(rounded.q)).toBe(true);
    expect(Number.isInteger(rounded.r)).toBe(true);
  });

  it('should maintain cube coordinate invariant after rounding', () => {
    const fractional = { q: 1.7, r: -0.3 };
    const rounded = hexRound(fractional);
    const cube = axialToCube(rounded);
    expect(cube.x + cube.y + cube.z).toBe(0);
  });

  it('should handle edge case: q=0.5, r=0.5', () => {
    const fractional = { q: 0.5, r: 0.5 };
    const rounded = hexRound(fractional);
    expect(Number.isInteger(rounded.q)).toBe(true);
    expect(Number.isInteger(rounded.r)).toBe(true);
  });

  it('should correctly reset component with largest rounding error', () => {
    // Test case where z has largest error and should be reset
    const fractional = { q: 0.1, r: 0.9 }; // Will round to q=0, r=1 initially
    const rounded = hexRound(fractional);
    const cube = axialToCube(rounded);
    expect(cube.x + cube.y + cube.z).toBe(0);
  });
});
