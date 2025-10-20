/**
 * AStarPathfinder - A* Pathfinding on Hex Grid
 *
 * Implements L4-COMBAT-006: Finds optimal paths on hexagonal grid using A* algorithm.
 *
 * Key Features:
 * - Optimal pathfinding with A* algorithm
 * - Obstacle avoidance
 * - Grid boundary respect
 * - Admissible heuristic (hex distance)
 */

import { hexDistance, hexNeighbors } from '@drawn-of-war/shared';
import type { HexCoordinate } from '../combat-state';

interface PathNode {
  hex: HexCoordinate;
  g: number; // Cost from start
  h: number; // Heuristic to goal
  f: number; // Total cost (g + h)
  parent: PathNode | null;
}

export class AStarPathfinder {
  /**
   * Find path from start to goal using A* algorithm
   * @param start - Starting hex coordinate
   * @param goal - Goal hex coordinate
   * @param gridWidth - Grid width (for boundary checking)
   * @param gridHeight - Grid height (for boundary checking)
   * @param obstacles - Set of obstacle hex keys "q,r"
   * @returns Array of hex coordinates from start to goal, or null if no path
   */
  findPath(
    start: HexCoordinate,
    goal: HexCoordinate,
    gridWidth: number,
    gridHeight: number,
    obstacles: Set<string>
  ): HexCoordinate[] | null {
    // If start equals goal, return single-hex path
    if (start.q === goal.q && start.r === goal.r) {
      return [start];
    }

    // Initialize open and closed sets
    const openSet: PathNode[] = [];
    const closedSet = new Set<string>();

    // Create start node
    const startNode: PathNode = {
      hex: start,
      g: 0,
      h: this.heuristic(start, goal),
      f: 0,
      parent: null
    };
    startNode.f = startNode.g + startNode.h;
    openSet.push(startNode);

    // A* main loop
    while (openSet.length > 0) {
      // Find node with lowest f score
      let currentIndex = 0;
      for (let i = 1; i < openSet.length; i++) {
        if (openSet[i].f < openSet[currentIndex].f) {
          currentIndex = i;
        }
      }

      const current = openSet[currentIndex];

      // Goal reached - reconstruct path
      if (current.hex.q === goal.q && current.hex.r === goal.r) {
        return this.reconstructPath(current);
      }

      // Move current from open to closed
      openSet.splice(currentIndex, 1);
      closedSet.add(this.hexKey(current.hex));

      // Check neighbors
      const neighbors = this.getNeighbors(current.hex, gridWidth, gridHeight);

      for (const neighborHex of neighbors) {
        const neighborKey = this.hexKey(neighborHex);

        // Skip if in closed set or is obstacle
        if (closedSet.has(neighborKey) || obstacles.has(neighborKey)) {
          continue;
        }

        // Calculate g score (cost from start)
        const tentativeG = current.g + 1; // Each step costs 1

        // Check if neighbor is already in open set
        let neighborNode = openSet.find(n => this.hexKey(n.hex) === neighborKey);

        if (!neighborNode) {
          // New node - add to open set
          neighborNode = {
            hex: neighborHex,
            g: tentativeG,
            h: this.heuristic(neighborHex, goal),
            f: 0,
            parent: current
          };
          neighborNode.f = neighborNode.g + neighborNode.h;
          openSet.push(neighborNode);
        } else if (tentativeG < neighborNode.g) {
          // Better path found - update node
          neighborNode.g = tentativeG;
          neighborNode.f = neighborNode.g + neighborNode.h;
          neighborNode.parent = current;
        }
      }
    }

    // No path found
    return null;
  }

  /**
   * Heuristic function - uses hex distance (admissible)
   * @param a - First hex
   * @param b - Second hex
   * @returns Estimated distance
   */
  private heuristic(a: HexCoordinate, b: HexCoordinate): number {
    return hexDistance(a, b);
  }

  /**
   * Get valid neighboring hexes
   * @param hex - Center hex
   * @param gridWidth - Grid width
   * @param gridHeight - Grid height
   * @returns Array of valid neighbor coordinates
   */
  private getNeighbors(hex: HexCoordinate, gridWidth: number, gridHeight: number): HexCoordinate[] {
    const config = {
      width: gridWidth,
      height: gridHeight,
      orientation: 'flat-top' as const
    };

    return hexNeighbors(hex, config);
  }

  /**
   * Create unique key for hex coordinate
   * @param hex - Hex coordinate
   * @returns String key "q,r"
   */
  private hexKey(hex: HexCoordinate): string {
    return `${hex.q},${hex.r}`;
  }

  /**
   * Reconstruct path from goal node to start
   * @param goalNode - Final node in path
   * @returns Array of hex coordinates from start to goal
   */
  private reconstructPath(goalNode: PathNode): HexCoordinate[] {
    const path: HexCoordinate[] = [];
    let current: PathNode | null = goalNode;

    while (current !== null) {
      path.unshift(current.hex);
      current = current.parent;
    }

    return path;
  }
}
