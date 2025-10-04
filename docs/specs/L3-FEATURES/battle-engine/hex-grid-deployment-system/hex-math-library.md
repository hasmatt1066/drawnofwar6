# L3-FEATURE: Hex Math Library

**Feature ID**: `hex-math-library`
**Epic**: Hex Grid Deployment System (L2)
**Status**: PLANNING
**Version**: 1.0
**Last Updated**: 2025-10-03

---

## Feature Summary

A comprehensive TypeScript library implementing hexagonal grid mathematics including coordinate systems (axial, cube, pixel), distance calculations, neighbor finding, range queries, and coordinate conversions. This library provides the mathematical foundation for all hex-based operations in the battle system, ensuring consistent and correct spatial calculations across client and server.

**Value Proposition**: Eliminates hex grid math errors through battle-tested algorithms, provides type-safe coordinate operations, and enables rapid development of hex-based features without reinventing mathematical primitives.

---

## User Value

**For Players**: Ensures accurate pathfinding, range calculations, and positioning - creatures move to where players expect them to, abilities hit the intended hexes, and deployment zones are clearly defined.

**For Developers**: Provides a single source of truth for all hex math, preventing coordinate system bugs, off-by-one errors, and ensuring consistent behavior between client rendering and server simulation.

---

## Functional Requirements

### Coordinate Systems

1. **Axial Coordinates** (Primary System)
   - Two-axis representation: `(q, r)` where q = column, r = row
   - Storage-efficient (2 numbers vs 3 for cube)
   - Natural for hex grids with flat-top or pointy-top orientation
   - Used for network serialization and database storage

2. **Cube Coordinates** (Calculation System)
   - Three-axis representation: `(x, y, z)` where x + y + z = 0
   - Simplifies distance and range calculations
   - Enables rotation and reflection operations
   - Used internally for algorithms

3. **Pixel Coordinates** (Rendering System)
   - Screen position: `(x, y)` in pixels
   - Depends on hex size and orientation
   - Used for mouse input and sprite positioning
   - Requires rounding for pixel-to-hex conversion

### Core Operations

1. **Coordinate Conversion**
   - Axial ↔ Cube: Bidirectional conversion
   - Hex ↔ Pixel: For rendering and input handling
   - Pixel ↔ Hex: With proper rounding (nearest hex)
   - Support for both flat-top and pointy-top hexagons

2. **Distance Calculation**
   - Manhattan distance in cube coordinates
   - Always returns integer (no fractional hexes)
   - Formula: `(|x1-x2| + |y1-y2| + |z1-z2|) / 2`
   - Performance: O(1) operation

3. **Neighbor Finding**
   - Get 6 adjacent hexes for any coordinate
   - Direction constants: NE, E, SE, SW, W, NW (pointy-top)
   - Boundary checking (filter out-of-grid neighbors)
   - Support for diagonal neighbors (12 hexes total)

4. **Range Queries**
   - Get all hexes within N distance from source
   - Inclusive range (distance ≤ N, not distance < N)
   - Returns hexes in spiral order (closest first)
   - Filter by grid boundaries

5. **Line of Sight**
   - Check if path between two hexes is clear
   - Raycast algorithm using lerp and rounding
   - Detect blocking hexes (occupied or impassable)
   - Used for ranged attack validation

6. **Rotation and Reflection**
   - Rotate hex coordinates around center point
   - 60° increments (6 possible rotations)
   - Reflect across axes (for mirroring formations)
   - Preserve distance relationships

### Validation and Error Handling

1. **Coordinate Validation**
   - Check if hex is within grid bounds
   - Validate cube coordinate constraint (x + y + z = 0)
   - Detect invalid coordinate values (NaN, Infinity)
   - Provide clear error messages

2. **Grid Boundary Handling**
   - Define grid dimensions (width × height)
   - Check if hex is valid placement zone
   - Filter operations to grid bounds
   - Handle edge cases (corners, borders)

3. **Precision Handling**
   - Round fractional coordinates to nearest hex
   - Use integer arithmetic where possible
   - Avoid floating-point drift in conversions
   - Ensure deterministic results

---

## Technical Specification

### Architecture

**Type Definitions**
```typescript
/**
 * Axial coordinate system (storage format)
 */
interface AxialCoordinate {
  q: number; // column (x-axis)
  r: number; // row (z-axis)
}

/**
 * Cube coordinate system (calculation format)
 */
interface CubeCoordinate {
  x: number;
  y: number;
  z: number;
}

/**
 * Pixel coordinate system (rendering format)
 */
interface PixelCoordinate {
  x: number; // screen x
  y: number; // screen y
}

/**
 * Hex grid configuration
 */
interface HexGridConfig {
  width: number; // hexes wide
  height: number; // hexes tall
  hexSize: number; // radius in pixels
  orientation: 'flat-top' | 'pointy-top';
}

/**
 * Direction vectors for neighbors
 */
enum HexDirection {
  NE = 0, // North-East
  E = 1,  // East
  SE = 2, // South-East
  SW = 3, // South-West
  W = 4,  // West
  NW = 5  // North-West
}
```

**Core Functions**

```typescript
/**
 * Convert axial to cube coordinates
 * Formula: x = q, z = r, y = -x - z
 */
function axialToCube(hex: AxialCoordinate): CubeCoordinate {
  const x = hex.q;
  const z = hex.r;
  const y = -x - z;
  return { x, y, z };
}

/**
 * Convert cube to axial coordinates
 * Formula: q = x, r = z
 */
function cubeToAxial(cube: CubeCoordinate): AxialCoordinate {
  return { q: cube.x, r: cube.z };
}

/**
 * Calculate distance between two hexes
 * Uses cube coordinates for simplicity
 */
function hexDistance(a: AxialCoordinate, b: AxialCoordinate): number {
  const ac = axialToCube(a);
  const bc = axialToCube(b);
  return Math.floor(
    (Math.abs(ac.x - bc.x) + Math.abs(ac.y - bc.y) + Math.abs(ac.z - bc.z)) / 2
  );
}

/**
 * Get 6 neighboring hexes
 * Direction vectors for flat-top hexagons
 */
function hexNeighbors(hex: AxialCoordinate, config: HexGridConfig): AxialCoordinate[] {
  const directions: AxialCoordinate[] = config.orientation === 'flat-top'
    ? [
        { q: 1, r: 0 },  // E
        { q: 1, r: -1 }, // NE
        { q: 0, r: -1 }, // NW
        { q: -1, r: 0 }, // W
        { q: -1, r: 1 }, // SW
        { q: 0, r: 1 }   // SE
      ]
    : [
        { q: 1, r: 0 },  // E
        { q: 0, r: -1 }, // NE
        { q: -1, r: -1 }, // NW
        { q: -1, r: 0 }, // W
        { q: 0, r: 1 },  // SW
        { q: 1, r: 1 }   // SE
      ];

  return directions
    .map(d => ({ q: hex.q + d.q, r: hex.r + d.r }))
    .filter(h => isValidHex(h, config));
}

/**
 * Get all hexes within range N
 * Returns hexes sorted by distance (spiral order)
 */
function hexesInRange(
  center: AxialCoordinate,
  range: number,
  config: HexGridConfig
): AxialCoordinate[] {
  const results: AxialCoordinate[] = [];

  for (let q = -range; q <= range; q++) {
    const r1 = Math.max(-range, -q - range);
    const r2 = Math.min(range, -q + range);

    for (let r = r1; r <= r2; r++) {
      const hex = { q: center.q + q, r: center.r + r };
      if (isValidHex(hex, config)) {
        results.push(hex);
      }
    }
  }

  // Sort by distance from center (spiral order)
  return results.sort((a, b) => hexDistance(center, a) - hexDistance(center, b));
}

/**
 * Convert hex to pixel coordinates
 * Flat-top orientation formula
 */
function hexToPixel(hex: AxialCoordinate, config: HexGridConfig): PixelCoordinate {
  const size = config.hexSize;

  if (config.orientation === 'flat-top') {
    const x = size * (3/2 * hex.q);
    const y = size * (Math.sqrt(3)/2 * hex.q + Math.sqrt(3) * hex.r);
    return { x, y };
  } else {
    const x = size * (Math.sqrt(3) * hex.q + Math.sqrt(3)/2 * hex.r);
    const y = size * (3/2 * hex.r);
    return { x, y };
  }
}

/**
 * Convert pixel to hex coordinates with rounding
 * Returns nearest hex to pixel position
 */
function pixelToHex(pixel: PixelCoordinate, config: HexGridConfig): AxialCoordinate {
  const size = config.hexSize;
  let q: number, r: number;

  if (config.orientation === 'flat-top') {
    q = (2/3 * pixel.x) / size;
    r = (-1/3 * pixel.x + Math.sqrt(3)/3 * pixel.y) / size;
  } else {
    q = (Math.sqrt(3)/3 * pixel.x - 1/3 * pixel.y) / size;
    r = (2/3 * pixel.y) / size;
  }

  return hexRound({ q, r });
}

/**
 * Round fractional hex coordinates to nearest integer hex
 * Uses cube coordinates for accurate rounding
 */
function hexRound(hex: { q: number; r: number }): AxialCoordinate {
  let { x, y, z } = axialToCube({ q: hex.q, r: hex.r });

  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);

  const x_diff = Math.abs(rx - x);
  const y_diff = Math.abs(ry - y);
  const z_diff = Math.abs(rz - z);

  // Reset the component with largest rounding error
  if (x_diff > y_diff && x_diff > z_diff) {
    rx = -ry - rz;
  } else if (y_diff > z_diff) {
    ry = -rx - rz;
  } else {
    rz = -rx - ry;
  }

  return cubeToAxial({ x: rx, y: ry, z: rz });
}

/**
 * Check if hex is within grid bounds
 */
function isValidHex(hex: AxialCoordinate, config: HexGridConfig): boolean {
  // Convert to offset coordinates for boundary check
  const row = hex.r;
  const col = hex.q + Math.floor(hex.r / 2); // Offset for odd-r layout

  return col >= 0 && col < config.width && row >= 0 && row < config.height;
}

/**
 * Get hexes along line from A to B (for line of sight)
 * Uses linear interpolation and rounding
 */
function hexLine(a: AxialCoordinate, b: AxialCoordinate): AxialCoordinate[] {
  const distance = hexDistance(a, b);
  const results: AxialCoordinate[] = [];

  for (let i = 0; i <= distance; i++) {
    const t = distance === 0 ? 0 : i / distance;
    const hex = hexLerp(a, b, t);
    results.push(hexRound(hex));
  }

  return results;
}

/**
 * Linear interpolation between two hexes
 */
function hexLerp(a: AxialCoordinate, b: AxialCoordinate, t: number): { q: number; r: number } {
  return {
    q: a.q * (1 - t) + b.q * t,
    r: a.r * (1 - t) + b.r * t
  };
}

/**
 * Rotate hex around center point
 * @param steps - Number of 60° rotations (0-5)
 */
function hexRotate(hex: AxialCoordinate, center: AxialCoordinate, steps: number): AxialCoordinate {
  const cube = axialToCube(hex);
  const centerCube = axialToCube(center);

  // Translate to origin
  let x = cube.x - centerCube.x;
  let y = cube.y - centerCube.y;
  let z = cube.z - centerCube.z;

  // Rotate (each step is 60° clockwise)
  for (let i = 0; i < (steps % 6); i++) {
    const temp = x;
    x = -z;
    z = -y;
    y = -temp;
  }

  // Translate back
  x += centerCube.x;
  y += centerCube.y;
  z += centerCube.z;

  return cubeToAxial({ x, y, z });
}
```

### Data Structures

**Hex Grid Class**
```typescript
class HexGrid {
  private config: HexGridConfig;

  constructor(config: HexGridConfig) {
    this.config = config;
  }

  // Coordinate conversions
  toPixel(hex: AxialCoordinate): PixelCoordinate {
    return hexToPixel(hex, this.config);
  }

  fromPixel(pixel: PixelCoordinate): AxialCoordinate {
    return pixelToHex(pixel, this.config);
  }

  // Spatial queries
  distance(a: AxialCoordinate, b: AxialCoordinate): number {
    return hexDistance(a, b);
  }

  neighbors(hex: AxialCoordinate): AxialCoordinate[] {
    return hexNeighbors(hex, this.config);
  }

  inRange(center: AxialCoordinate, range: number): AxialCoordinate[] {
    return hexesInRange(center, range, this.config);
  }

  // Validation
  isValid(hex: AxialCoordinate): boolean {
    return isValidHex(hex, this.config);
  }

  // Line operations
  lineTo(a: AxialCoordinate, b: AxialCoordinate): AxialCoordinate[] {
    return hexLine(a, b);
  }

  // Transformations
  rotate(hex: AxialCoordinate, center: AxialCoordinate, steps: number): AxialCoordinate {
    return hexRotate(hex, center, steps);
  }
}
```

### Key Technologies

- **TypeScript**: Strict mode, no `any` types
- **Pure Functions**: No side effects, deterministic
- **Shared Library**: Used by both frontend and backend
- **Tree-shakeable**: Export individual functions for optimal bundling

---

## Success Criteria

### MVP Definition of Done

- [ ] Axial ↔ Cube coordinate conversion works correctly
- [ ] Hex ↔ Pixel conversion accurate for both orientations
- [ ] Distance calculation returns correct integer values
- [ ] Neighbor finding returns 6 valid adjacent hexes
- [ ] Range queries return all hexes within N distance
- [ ] Hex rounding (pixel → hex) selects nearest hex correctly
- [ ] Grid boundary validation works for 12×8 grid
- [ ] Line-of-sight raycast detects blocking hexes
- [ ] Rotation preserves distance relationships
- [ ] All functions handle edge cases (corners, boundaries)
- [ ] 100% test coverage with edge case validation
- [ ] Performance: All operations < 1ms for 96-hex grid
- [ ] Zero external dependencies (pure TypeScript)

### Exceptional Target (Post-MVP)

- [ ] Hexagonal pathfinding (A* algorithm integration)
- [ ] Flood fill operations (area marking)
- [ ] Hex spiral iteration (outward from center)
- [ ] Field of view calculations (vision cones)
- [ ] Hex-to-hex angle calculation (for sprite facing)
- [ ] Weighted distance (terrain cost modifiers)
- [ ] Hex ring queries (hollow circles)
- [ ] 3D hex grid support (multi-layer battles)

---

## Testing Strategy

### Unit Tests

**Coordinate Conversion**
```typescript
describe('Coordinate Conversion', () => {
  it('should convert axial to cube correctly', () => {
    const axial = { q: 2, r: 3 };
    const cube = axialToCube(axial);
    expect(cube).toEqual({ x: 2, y: -5, z: 3 });
    expect(cube.x + cube.y + cube.z).toBe(0); // Invariant
  });

  it('should round-trip axial → cube → axial', () => {
    const original = { q: 5, r: -2 };
    const cube = axialToCube(original);
    const result = cubeToAxial(cube);
    expect(result).toEqual(original);
  });
});
```

**Distance Calculation**
```typescript
describe('Distance Calculation', () => {
  it('should calculate distance between hexes', () => {
    const a = { q: 0, r: 0 };
    const b = { q: 3, r: -2 };
    expect(hexDistance(a, b)).toBe(3);
  });

  it('should return 0 for same hex', () => {
    const hex = { q: 5, r: 5 };
    expect(hexDistance(hex, hex)).toBe(0);
  });

  it('should be symmetric', () => {
    const a = { q: 1, r: 2 };
    const b = { q: 4, r: -1 };
    expect(hexDistance(a, b)).toBe(hexDistance(b, a));
  });
});
```

**Neighbor Finding**
```typescript
describe('Neighbor Finding', () => {
  const config: HexGridConfig = {
    width: 12,
    height: 8,
    hexSize: 32,
    orientation: 'flat-top'
  };

  it('should return 6 neighbors for center hex', () => {
    const hex = { q: 5, r: 4 };
    const neighbors = hexNeighbors(hex, config);
    expect(neighbors).toHaveLength(6);
  });

  it('should filter out-of-bounds neighbors', () => {
    const corner = { q: 0, r: 0 };
    const neighbors = hexNeighbors(corner, config);
    expect(neighbors.length).toBeLessThan(6);
  });

  it('should return adjacent hexes only (distance 1)', () => {
    const hex = { q: 3, r: 3 };
    const neighbors = hexNeighbors(hex, config);
    neighbors.forEach(n => {
      expect(hexDistance(hex, n)).toBe(1);
    });
  });
});
```

**Range Queries**
```typescript
describe('Range Queries', () => {
  const config: HexGridConfig = {
    width: 12,
    height: 8,
    hexSize: 32,
    orientation: 'flat-top'
  };

  it('should return hexes within range', () => {
    const center = { q: 5, r: 4 };
    const range = 2;
    const hexes = hexesInRange(center, range, config);

    hexes.forEach(h => {
      expect(hexDistance(center, h)).toBeLessThanOrEqual(range);
    });
  });

  it('should include center hex in range', () => {
    const center = { q: 3, r: 3 };
    const hexes = hexesInRange(center, 2, config);
    expect(hexes).toContainEqual(center);
  });

  it('should return hexes in spiral order (closest first)', () => {
    const center = { q: 5, r: 4 };
    const hexes = hexesInRange(center, 3, config);

    for (let i = 1; i < hexes.length; i++) {
      const dist1 = hexDistance(center, hexes[i - 1]);
      const dist2 = hexDistance(center, hexes[i]);
      expect(dist2).toBeGreaterThanOrEqual(dist1);
    }
  });
});
```

**Pixel Conversion**
```typescript
describe('Pixel Conversion', () => {
  const config: HexGridConfig = {
    width: 12,
    height: 8,
    hexSize: 32,
    orientation: 'flat-top'
  };

  it('should convert hex to pixel', () => {
    const hex = { q: 0, r: 0 };
    const pixel = hexToPixel(hex, config);
    expect(pixel.x).toBeCloseTo(0);
    expect(pixel.y).toBeCloseTo(0);
  });

  it('should round-trip hex → pixel → hex', () => {
    const original = { q: 5, r: 3 };
    const pixel = hexToPixel(original, config);
    const result = pixelToHex(pixel, config);
    expect(result).toEqual(original);
  });

  it('should round fractional pixels to nearest hex', () => {
    const hex = { q: 2, r: 2 };
    const pixel = hexToPixel(hex, config);

    // Add small offset (should still round to same hex)
    const offset = { x: pixel.x + 5, y: pixel.y + 5 };
    const rounded = pixelToHex(offset, config);
    expect(rounded).toEqual(hex);
  });
});
```

### Edge Cases

1. **Grid Corners**: Test hexes at (0,0), (11,0), (0,7), (11,7)
2. **Grid Center**: Test symmetric operations around center hex
3. **Large Distances**: Test distance calculation for opposite corners
4. **Negative Coordinates**: Test with negative q/r values (if used)
5. **Precision**: Test rounding with values like 0.5, 0.4999, 0.5001
6. **Boundary**: Test neighbor finding for edge hexes
7. **Rotation**: Test 360° rotation (6 steps = identity)
8. **Line of Sight**: Test diagonal, straight, and blocked paths

### Performance Benchmarks

- Distance calculation: < 0.001ms per call
- Neighbor finding: < 0.01ms per call
- Range query (range 5): < 0.1ms
- Pixel-to-hex conversion: < 0.01ms per call
- 1000 hex operations: < 10ms total

---

## L4 Task Candidates

### Core Math (8 tasks)

1. **Implement Axial ↔ Cube Conversion** (2 hours)
   - `axialToCube()` function
   - `cubeToAxial()` function
   - Validate cube constraint (x+y+z=0)
   - Unit tests with edge cases

2. **Implement Distance Calculation** (2 hours)
   - `hexDistance()` function using cube coordinates
   - Manhattan distance formula
   - Optimize for integer arithmetic
   - Test symmetric property

3. **Implement Neighbor Finding** (3 hours)
   - Direction vectors for flat-top and pointy-top
   - `hexNeighbors()` function
   - Boundary filtering
   - Test all 6 directions

4. **Implement Range Queries** (4 hours)
   - `hexesInRange()` function
   - Spiral ordering algorithm
   - Grid boundary filtering
   - Performance optimization

5. **Implement Hex → Pixel Conversion** (3 hours)
   - `hexToPixel()` for flat-top orientation
   - `hexToPixel()` for pointy-top orientation
   - Test coordinate accuracy
   - Handle hex size scaling

6. **Implement Pixel → Hex Conversion** (4 hours)
   - `pixelToHex()` with rounding
   - `hexRound()` using cube coordinates
   - Test fractional coordinates
   - Validate nearest-hex selection

7. **Implement Line of Sight** (3 hours)
   - `hexLine()` raycast algorithm
   - `hexLerp()` interpolation
   - Blocking detection
   - Test diagonal and straight lines

8. **Implement Rotation** (2 hours)
   - `hexRotate()` around center
   - 60° rotation in cube coordinates
   - Test 6 rotations (identity check)
   - Preserve distance invariants

### Validation & Utilities (4 tasks)

9. **Implement Grid Validation** (2 hours)
   - `isValidHex()` boundary check
   - Offset coordinate conversion
   - Test grid corners and edges
   - Handle different grid sizes

10. **Create HexGrid Class** (3 hours)
    - Wrap functions in class API
    - Store grid configuration
    - Provide convenience methods
    - Type-safe coordinate handling

11. **Implement Coordinate Utilities** (2 hours)
    - Equality check (same hex)
    - Hash function (for Set/Map storage)
    - String serialization (for debugging)
    - Parse from string

12. **Create Test Fixtures** (2 hours)
    - Sample grid configurations
    - Common hex coordinates
    - Expected pixel conversions
    - Distance lookup tables

### Testing & Documentation (2 tasks)

13. **Write Comprehensive Unit Tests** (8 hours)
    - Test all core functions
    - Edge case coverage (corners, boundaries)
    - Property-based tests (symmetry, invariants)
    - Performance benchmarks

14. **Write API Documentation** (3 hours)
    - JSDoc comments for all functions
    - Usage examples
    - Coordinate system diagrams
    - Performance notes

---

## Dependencies

### Depends On
- None (foundational library)

### Depended On By
- **Grid Rendering Engine** (L3): Uses hex-to-pixel conversion
- **Drag-and-Drop Controller** (L3): Uses pixel-to-hex conversion
- **Deployment Validation** (L3): Uses distance and boundary checks
- **Hex Pathfinding Engine** (L3): Uses neighbors and distance
- **Range Checking** (L3): Uses range queries and line of sight

---

## Open Questions

1. **Hex Orientation**: Should we support both flat-top and pointy-top, or lock to one for MVP? (Flat-top recommended for left-right deployment zones)

2. **Coordinate Storage**: Should we store axial or cube coordinates in database? (Axial is more space-efficient: 2 numbers vs 3)

3. **Precision**: Do we need high-precision (double) or integer arithmetic sufficient? (Integer is faster and deterministic)

4. **Grid Size**: Should library support dynamic grid sizes or hardcode 12×8 for MVP? (Hardcode for simplicity, make configurable later)

5. **Performance**: Is pure TypeScript fast enough or need WASM/native acceleration? (Profile first, optimize if needed)

---

## Risk Assessment

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| **Off-by-one errors** | HIGH | MEDIUM | Comprehensive unit tests with edge cases |
| **Floating-point drift** | MEDIUM | LOW | Use integer arithmetic where possible |
| **Performance bottleneck** | MEDIUM | LOW | Benchmark early, optimize hot paths |
| **Coordinate confusion** | HIGH | MEDIUM | Strong typing, clear naming conventions |
| **Rounding errors** | MEDIUM | MEDIUM | Test pixel-to-hex extensively |

---

## Metadata

**Feature ID**: `hex-math-library`
**Epic**: Hex Grid Deployment System
**Status**: PLANNING
**Estimated Effort**: 2-3 weeks (1 developer)
**Task Count**: 14 atomic tasks
**Priority**: CRITICAL (foundational)
**Complexity**: MEDIUM-HIGH (mathematical precision required)
**Risks**: MEDIUM (coordinate system complexity)

---

*This L3 Feature provides the mathematical foundation for all hexagonal grid operations in the battle system. All other hex-based features depend on this library being correct and performant.*
