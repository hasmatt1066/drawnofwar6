/**
 * Tests for AStarPathfinder (L4-COMBAT-006)
 *
 * TDD Test Suite - These tests are written BEFORE implementation
 */

import { describe, test, expect } from 'vitest';
import { AStarPathfinder } from '../astar-pathfinder';
import { hexDistance } from '@drawn-of-war/shared';

describe('AStarPathfinder (L4-COMBAT-006)', () => {

  /**
   * Test 1: Finds straight path with no obstacles
   */
  test('should find straight path from (0,0) to (3,0)', () => {
    const pathfinder = new AStarPathfinder();

    const path = pathfinder.findPath(
      { q: 0, r: 0 },
      { q: 3, r: 0 },
      12, // grid width
      8,  // grid height
      new Set()
    );

    expect(path).toEqual([
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 2, r: 0 },
      { q: 3, r: 0 }
    ]);
  });

  /**
   * Test 2: Routes around obstacles
   */
  test('should route around obstacle', () => {
    const pathfinder = new AStarPathfinder();
    const obstacles = new Set(['1,0', '1,1', '1,2']); // Vertical wall

    const path = pathfinder.findPath(
      { q: 0, r: 1 },
      { q: 2, r: 1 },
      12,
      8,
      obstacles
    );

    // Should go around (either over or under wall)
    expect(path).toBeDefined();
    expect(path![0]).toEqual({ q: 0, r: 1 }); // Start
    expect(path![path!.length - 1]).toEqual({ q: 2, r: 1 }); // Goal
    expect(path!.length).toBeGreaterThan(3); // Longer than direct path
  });

  /**
   * Test 3: Returns null if no path exists
   */
  test('should return null when completely blocked', () => {
    const pathfinder = new AStarPathfinder();

    // Surround goal at (5,5) with all 6 neighbors as obstacles
    const obstacles = new Set([
      '6,5',  // E
      '6,4',  // NE
      '5,4',  // NW
      '4,5',  // W
      '4,6',  // SW
      '5,6'   // SE
    ]);

    const path = pathfinder.findPath(
      { q: 0, r: 0 },
      { q: 5, r: 5 }, // Completely surrounded
      12,
      8,
      obstacles
    );

    expect(path).toBe(null);
  });

  /**
   * Test 4: Respects grid boundaries
   */
  test('should not path outside grid boundaries', () => {
    const pathfinder = new AStarPathfinder();

    const path = pathfinder.findPath(
      { q: 0, r: 0 },
      { q: 4, r: 4 },
      5, // Small grid
      5,
      new Set()
    );

    // Verify all hexes in path are within bounds
    path?.forEach(hex => {
      expect(hex.q).toBeGreaterThanOrEqual(0);
      expect(hex.q).toBeLessThan(5);
      expect(hex.r).toBeGreaterThanOrEqual(0);
      expect(hex.r).toBeLessThan(5);
    });
  });

  /**
   * Test 5: Heuristic is admissible (never overestimates)
   */
  test('heuristic should never overestimate distance', () => {
    const pathfinder = new AStarPathfinder();

    const testCases: Array<[{ q: number; r: number }, { q: number; r: number }]> = [
      [{ q: 0, r: 0 }, { q: 3, r: 0 }], // Straight line
      [{ q: 0, r: 0 }, { q: 2, r: 2 }], // Diagonal
      [{ q: 5, r: 3 }, { q: 1, r: 7 }]  // Random
    ];

    testCases.forEach(([a, b]) => {
      const heuristic = (pathfinder as any).heuristic(a, b);
      const actualDistance = hexDistance(a, b);

      expect(heuristic).toBeLessThanOrEqual(actualDistance);
    });
  });

  /**
   * Test 6: Returns single hex path for start == goal
   */
  test('should return single hex when start equals goal', () => {
    const pathfinder = new AStarPathfinder();

    const path = pathfinder.findPath(
      { q: 5, r: 5 },
      { q: 5, r: 5 },
      12,
      8,
      new Set()
    );

    expect(path).toEqual([{ q: 5, r: 5 }]);
  });
});
