# Hex Math Library

Complete hexagonal grid mathematics library for tactical deployment system in Drawn of War.

## Features

- ✅ **Coordinate Systems**: Axial, cube, and pixel coordinate conversion
- ✅ **Distance Calculation**: Manhattan distance in hexagonal space
- ✅ **Neighbor Finding**: Get adjacent hexes with boundary validation
- ✅ **Range Queries**: Get all hexes within N distance (spiral order)
- ✅ **Line of Sight**: Draw lines between hexes with linear interpolation
- ✅ **Rotation**: Rotate hexes around a center point (60° increments)
- ✅ **Grid Validation**: Boundary checking and coordinate validation
- ✅ **HexGrid Class**: Convenient wrapper with all operations

## Test Coverage

- **154 tests passing** across 7 test files
- 100% coverage of all core functions
- Comprehensive edge case testing

## Installation

```typescript
import { HexGrid } from '@drawn-of-war/shared/utils/hex-math';
```

## Quick Start

```typescript
// Create a 12×8 flat-top hex grid with 32px hexes
const grid = new HexGrid({
  width: 12,
  height: 8,
  hexSize: 32,
  orientation: 'flat-top'
});

// Get neighbors of a hex
const neighbors = grid.neighbors({ q: 5, r: 4 });
// Returns: Up to 6 adjacent hexes (filtered by boundaries)

// Calculate distance between two hexes
const distance = grid.distance({ q: 0, r: 0 }, { q: 5, r: 3 });
// Returns: 8

// Get all hexes within range 2
const range = grid.inRange({ q: 5, r: 4 }, 2);
// Returns: Array of hexes sorted by distance (closest first)

// Draw a line between two hexes
const line = grid.line({ q: 0, r: 0 }, { q: 5, r: 3 });
// Returns: Array of hexes forming a path

// Convert hex to pixel coordinates
const pixel = grid.toPixel({ q: 3, r: 2 });
// Returns: { x: 144, y: 166.28 }

// Convert pixel to hex (with rounding)
const hex = grid.fromPixel({ x: 150, y: 170 });
// Returns: Nearest hex coordinate

// Rotate hex around center
const rotated = grid.rotate({ q: 1, r: 0 }, { q: 0, r: 0 }, 1);
// Returns: { q: 0, r: 1 } (60° clockwise)
```

## API Reference

### HexGrid Class

#### Configuration
- `getConfig()` - Get grid configuration
- `width` - Grid width (columns)
- `height` - Grid height (rows)
- `hexSize` - Hex size (center to corner)
- `orientation` - 'flat-top' | 'pointy-top'

#### Coordinate Conversion
- `axialToCube(hex)` - Convert axial → cube coordinates
- `cubeToAxial(cube)` - Convert cube → axial coordinates
- `toPixel(hex)` - Convert hex → pixel coordinates
- `fromPixel(pixel)` - Convert pixel → hex coordinates
- `round(hex)` - Round fractional hex to nearest integer

#### Distance & Navigation
- `distance(a, b)` - Manhattan distance between hexes
- `neighbors(hex)` - Get adjacent hexes (up to 6)
- `inRange(center, range)` - Get all hexes within distance N

#### Line of Sight
- `line(start, end)` - Draw line between hexes
- `lerp(start, end, t)` - Linear interpolation (t ∈ [0, 1])

#### Rotation
- `rotate(hex, center, steps)` - Rotate by 60° steps
- `rotateRight(hex, center)` - Rotate 60° clockwise
- `rotateLeft(hex, center)` - Rotate 60° counter-clockwise

#### Validation
- `isValid(hex)` - Check if hex is within grid bounds
- `equals(a, b)` - Check hex equality

#### Utilities
- `hash(hex)` - Create hash key for Set/Map storage
- `fromHash(hash)` - Parse hex from hash string
- `getAllHexes()` - Get all hexes in grid
- `createHexSet(hexes)` - Create Set of hex hashes
- `createHexMap(entries)` - Create Map with hex keys

## Coordinate Systems

### Axial Coordinates (Storage)
```typescript
interface AxialCoordinate {
  q: number; // Column (x-axis)
  r: number; // Row (z-axis)
}
```

### Cube Coordinates (Calculations)
```typescript
interface CubeCoordinate {
  x: number;
  y: number;
  z: number;
  // Invariant: x + y + z = 0
}
```

### Pixel Coordinates (Rendering)
```typescript
interface PixelCoordinate {
  x: number; // Screen x position
  y: number; // Screen y position
}
```

## Orientations

### Flat-Top
- Hex has flat edge on top
- Used for Drawn of War deployment grid
- Direction order: E, SE, SW, W, NW, NE

### Pointy-Top
- Hex has pointy vertex on top
- Alternative orientation
- Direction order: NE, E, SE, SW, W, NW

## Implementation Details

### Distance Algorithm
Uses cube coordinate system for accurate Manhattan distance:
```
distance = (|x1-x2| + |y1-y2| + |z1-z2|) / 2
```

### Line Drawing
Uses linear interpolation with proper rounding to ensure continuous paths with no gaps.

### Rotation
Rotates in cube coordinate space using rotation matrix:
```
60° clockwise: (x, y, z) → (-z, -x, -y)
```

### Range Queries
Iterates cube-shaped bounding box with efficient bounds calculation, returning results sorted by distance (spiral order).

## Performance

- All operations are O(1) except:
  - `inRange(center, N)`: O(N²)
  - `line(start, end)`: O(distance)
  - `getAllHexes()`: O(width × height)

- 100 range-3 queries complete in < 50ms
- All functions are pure (no side effects)
- Type-safe with TypeScript strict mode

## Files

```
src/utils/hex-math/
├── types.ts                          # Type definitions
├── coordinate-conversion.ts          # Axial ↔ cube ↔ pixel conversion
├── coordinate-conversion.test.ts     # 25 tests
├── distance.ts                       # Distance calculation
├── distance.test.ts                  # 18 tests
├── neighbors.ts                      # Neighbor finding & validation
├── neighbors.test.ts                 # 21 tests
├── range.ts                          # Range queries
├── range.test.ts                     # 13 tests
├── line-of-sight.ts                  # Line drawing & interpolation
├── line-of-sight.test.ts             # 20 tests
├── rotation.ts                       # Hex rotation
├── rotation.test.ts                  # 27 tests
├── HexGrid.ts                        # Wrapper class
├── HexGrid.test.ts                   # 30 tests
├── index.ts                          # Public API
└── README.md                         # This file
```

## Usage in Battle Engine

This library will be used for:

1. **Deployment System**: Validate hex placement, show valid deployment zones
2. **Movement**: Calculate pathfinding costs, get movement range
3. **Targeting**: Line of sight checks, ability ranges
4. **Rendering**: Convert hex coordinates to screen positions
5. **AI**: Tactical positioning, threat assessment

## Next Steps

With the Hex Math Library complete, the next feature to implement is:

**Deployment Grid Component** - Visual representation of the 12×8 hex grid with:
- Interactive hex highlighting on hover
- Drag-and-drop creature placement
- Valid placement zone visualization
- Deployment zone restrictions (first 3 columns)

See `/docs/specs/L3-FEATURES/battle-engine/hex-grid-deployment-system/deployment-grid-component.md`
