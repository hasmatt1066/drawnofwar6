# L2 EPIC: Hex Grid Deployment System

**Epic ID**: `battle-hex-deployment`
**Parent Theme**: Battle Engine (L1)
**Status**: PLANNING
**Version**: 1.0
**Last Updated**: 2025-10-03

---

## Epic Summary

Implement the hexagonal grid-based battlefield with deployment zones, creature placement mechanics, positioning validation, and strategic placement UI. This epic provides the spatial foundation for battles, enabling players to position their 8 creatures on a hex grid with tactical considerations for melee vs ranged units, front-line vs back-line positioning, and counter-formations.

**User Value**: Provides intuitive drag-and-drop creature placement with clear visual feedback for valid/invalid positions, enabling strategic depth through positioning without overwhelming complexity.

**Business Value**: Hex grids are proven for tactical games (Civilization, XCOM, Heroes of Might & Magic), providing familiar UX while enabling interesting positioning strategies and rock-paper-scissors counters (surround tactics, range advantage, flanking).

---

## Purpose

The Hex Grid Deployment System is essential because it transforms creature placement from arbitrary 2D positioning into a structured, fair, and strategically interesting system. Hexagonal grids eliminate the diagonal movement ambiguity of square grids (all 6 neighbors equidistant), provide natural flow for creature movement during combat, and create clear deployment zones that prevent unfair positioning (e.g., starting units directly behind enemy lines).

This system must balance accessibility (easy to understand for first-time players) with strategic depth (experienced players can optimize formations). The hex grid also serves as the spatial foundation for the authoritative server simulation (pathfinding, range calculations, collision detection).

---

## Scope

### Included

- **Hex Grid Battlefield Layout**
  - Flat-top or pointy-top hexagon orientation (TBD in L3)
  - Grid dimensions: 12 columns × 8 rows (96 total hexes) for MVP
  - Deployment zones: Left 3 columns for Player 1, right 3 columns for Player 2
  - Neutral center zone: Middle 6 columns (battle area, no deployment)
  - Grid coordinate system (axial or cube coordinates for hex math)
  - Visual grid rendering (hex outlines, zone colors, hover highlights)

- **Creature Placement Mechanics**
  - Drag-and-drop creature from roster to hex grid
  - Snap-to-hex positioning (no free-form placement)
  - Placement validation (within deployment zone, hex not occupied)
  - Creature repositioning (drag placed creature to new valid hex)
  - Creature removal (drag back to roster to unplace)
  - Visual feedback (green hex = valid, red hex = invalid, yellow = hover)
  - Placement confirmation ("Ready" button locks placements)

- **Deployment Constraints & Validation**
  - Maximum 8 creatures per player (fixed roster size)
  - One creature per hex (no stacking)
  - Creatures must be within player's deployment zone (3 columns)
  - All 8 creatures must be placed before ready (or auto-deploy on timeout)
  - Invalid placements prevented (no placing in opponent zone or neutral zone)
  - Deployment state validation before combat starts

- **Strategic Positioning Features**
  - Front-line vs back-line visual distinction (closer to center = front)
  - Hex distance calculation for range preview (show attack range on hover)
  - Formation templates (optional): Quick-deploy presets (line, spread, wedge)
  - Creature reordering: Click creature to swap with another in roster
  - Mirror opponent formation (auto-place mirroring previous round's opponent)

- **Hex Grid Math & Utilities**
  - Hex-to-pixel coordinate conversion (for rendering)
  - Pixel-to-hex coordinate conversion (for mouse input)
  - Hex distance calculation (Manhattan distance in cube coordinates)
  - Hex neighbor finding (6 adjacent hexes)
  - Pathfinding preparation (hex walkability, occupied hexes)
  - Range checking (hexes within N distance from source)

- **Deployment UI/UX**
  - Creature roster panel (8 creatures with portraits)
  - Drag handles and visual grab indicators
  - Hex hover highlighting (highlight hex under cursor)
  - Placed creature visual (creature sprite on hex)
  - Placement counter ("5/8 creatures placed")
  - Ready button (enabled when 8/8 placed, or force-ready allowed)
  - Reset button (clear all placements and start over)

### Explicitly Excluded

- **Dynamic Grid Size**: Grid dimensions fixed at 12×8 for MVP (post-MVP: larger maps)
- **Terrain Variety**: All hexes flat and identical (no obstacles, elevation, terrain types)
- **Hex-Based Abilities**: No abilities that target specific hexes (post-MVP)
- **Formation Saving**: No saved deployment templates for reuse (post-MVP)
- **AI Opponent Deployment**: No PvE battles with AI placement (post-MVP)
- **Free-Form Placement**: No arbitrary pixel positioning (hex-only)
- **Deployment Animation**: Creatures appear instantly on hex (no spawn animation during deployment)
- **Hex Ownership**: No capturing/controlling hexes (combat only)

---

## Key User Journeys

### 1. First-Time Deployment (Tutorial)
**Setup**: New player's first match, never seen hex grid before
1. Deployment phase begins → Hex grid appears with glowing deployment zone (left 3 columns)
2. Tooltip: "Drag your creatures onto the highlighted hexes"
3. Player drags first creature → Hex highlights green → Player drops → Creature appears on hex
4. Counter updates: "1/8 creatures placed"
5. Player places remaining 7 creatures with visual feedback
6. Ready button glows when 8/8 placed
7. Player clicks Ready → Grid locks → Waiting for opponent

### 2. Strategic Formation Adjustment
**Setup**: Experienced player in Round 3, saw opponent's formation in Round 2
1. Deployment phase → Player remembers opponent placed ranged units in back-right
2. Player places melee tanks in front-left hexes (to absorb damage)
3. Player places fast flanking creatures in middle-left (to rush opponent's back line)
4. Player hovers over placed creature → Attack range preview shows (4-hex radius)
5. Player adjusts placement to optimize range coverage
6. Player confirms placement → Ready

### 3. Placement Mistake & Correction
1. Player drags creature to hex → Drops on occupied hex → Red flash + error message: "Hex already occupied"
2. Player drags creature to opponent's deployment zone → Red hex outline → Can't drop → Returns to roster
3. Player successfully places creature on valid hex
4. Player realizes mistake → Drags placed creature back to roster → Creature removed from grid
5. Player places creature on better hex → Confirms

### 4. Auto-Deploy on Timeout
1. Deployment phase starts → Player places 5/8 creatures
2. Player gets distracted (phone call)
3. Timer reaches 0 → System auto-deploys remaining 3 creatures at default positions (back row, spread out)
4. Notification: "Time's up! Remaining creatures auto-deployed."
5. Countdown to combat starts (3 seconds)

### 5. Formation Template Quick-Deploy
1. Deployment phase starts → Player clicks "Line Formation" preset
2. All 8 creatures instantly placed in horizontal line across deployment zone
3. Player adjusts 2 creatures (moves ranged units to back)
4. Player confirms → Ready

---

## Technical Architecture

### Components

**Grid Logic (Shared - Backend & Frontend)**
- `HexGrid`: Core hex grid data structure and coordinate system
- `HexMath`: Utility functions (distance, neighbors, conversion)
- `DeploymentZone`: Defines valid deployment hexes per player
- `PlacementValidator`: Validates creature placement rules
- `GridSerializer`: Converts grid state to/from JSON for network sync

**Frontend Rendering (PixiJS)**
- `HexGridRenderer`: Renders hex outlines, zones, highlights
- `CreatureRenderer`: Renders creature sprites on hexes
- `DragDropController`: Handles drag-and-drop interactions
- `HoverHighlighter`: Highlights hexes on mouse hover
- `RangePreview`: Shows attack range overlay on creature hover
- `DeploymentUIManager`: Manages roster, buttons, counter

**Backend Validation (Node.js)**
- `DeploymentStateManager`: Tracks player deployments server-side
- `PlacementAuthority`: Validates placements before combat (anti-cheat)
- `GridStateValidator`: Ensures grid state integrity before round start
- `AutoDeploymentGenerator`: Creates default placements on timeout

**Coordinate Systems**
- `AxialCoordinates`: (q, r) two-axis hex coordinates
- `CubeCoordinates`: (x, y, z) three-axis hex coordinates (x+y+z=0)
- `PixelCoordinates`: (x, y) screen pixel positions for rendering

### Key Technologies

- **PixiJS**: Frontend hex grid and creature rendering
- **React**: Deployment UI (roster, buttons, counters)
- **TypeScript**: Shared hex math library (used by both client/server)
- **WebSocket**: Real-time deployment state sync
- **Redis**: Temporary deployment state storage (active matches)

### Data Model

**Primary Entities**
```typescript
interface HexGrid {
  columns: number; // 12 for MVP
  rows: number; // 8 for MVP
  hexSize: number; // radius in pixels for rendering
  orientation: 'flat-top' | 'pointy-top';
  coordinateSystem: 'axial' | 'cube';
}

interface DeploymentZone {
  playerId: PlayerId;
  validHexes: HexCoordinate[]; // List of hexes where player can deploy
  minColumn: number; // e.g., 0 for Player 1
  maxColumn: number; // e.g., 2 for Player 1 (3 columns total)
}

interface HexCoordinate {
  q: number; // axial column
  r: number; // axial row
  // Optional cube coordinates (computed)
  x?: number;
  y?: number;
  z?: number;
}

interface CreaturePlacement {
  creatureId: string;
  position: HexCoordinate;
  playerId: PlayerId;
  placedAt: Date;
}

interface DeploymentState {
  matchId: string;
  roundNumber: number;
  playerId: PlayerId;
  placements: CreaturePlacement[];
  isComplete: boolean; // true when 8/8 placed
  isReady: boolean; // true when player clicked Ready
  validationErrors: string[];
}

interface GridRenderState {
  grid: HexGrid;
  deploymentZones: DeploymentZone[];
  placements: CreaturePlacement[];
  hoverHex?: HexCoordinate;
  selectedCreature?: string;
  validPlacementHexes?: HexCoordinate[]; // Green highlights
  invalidPlacementHexes?: HexCoordinate[]; // Red highlights
}
```

**Hex Math Functions**
```typescript
// Convert axial to cube coordinates
function axialToCube(hex: {q: number, r: number}): {x: number, y: number, z: number} {
  const x = hex.q;
  const z = hex.r;
  const y = -x - z;
  return {x, y, z};
}

// Calculate distance between two hexes
function hexDistance(a: HexCoordinate, b: HexCoordinate): number {
  const ac = axialToCube(a);
  const bc = axialToCube(b);
  return (Math.abs(ac.x - bc.x) + Math.abs(ac.y - bc.y) + Math.abs(ac.z - bc.z)) / 2;
}

// Get 6 neighboring hexes
function hexNeighbors(hex: HexCoordinate): HexCoordinate[] {
  const directions = [
    {q: 1, r: 0}, {q: 1, r: -1}, {q: 0, r: -1},
    {q: -1, r: 0}, {q: -1, r: 1}, {q: 0, r: 1}
  ];
  return directions.map(d => ({q: hex.q + d.q, r: hex.r + d.r}));
}

// Convert hex to pixel coordinates (for rendering)
function hexToPixel(hex: HexCoordinate, hexSize: number, orientation: 'flat-top'): {x: number, y: number} {
  const x = hexSize * (3/2 * hex.q);
  const y = hexSize * (Math.sqrt(3)/2 * hex.q + Math.sqrt(3) * hex.r);
  return {x, y};
}

// Convert pixel to hex coordinates (for mouse input)
function pixelToHex(pixel: {x: number, y: number}, hexSize: number, orientation: 'flat-top'): HexCoordinate {
  const q = (2/3 * pixel.x) / hexSize;
  const r = (-1/3 * pixel.x + Math.sqrt(3)/3 * pixel.y) / hexSize;
  return hexRound({q, r}); // Round to nearest hex
}

// Round fractional hex coordinates to nearest integer hex
function hexRound(hex: {q: number, r: number}): HexCoordinate {
  let {x, y, z} = axialToCube(hex);
  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);

  const x_diff = Math.abs(rx - x);
  const y_diff = Math.abs(ry - y);
  const z_diff = Math.abs(rz - z);

  if (x_diff > y_diff && x_diff > z_diff) {
    rx = -ry - rz;
  } else if (y_diff > z_diff) {
    ry = -rx - rz;
  } else {
    rz = -rx - ry;
  }

  return {q: rx, r: rz};
}

// Get all hexes within range N of source hex
function hexesInRange(source: HexCoordinate, range: number): HexCoordinate[] {
  const results: HexCoordinate[] = [];
  for (let q = -range; q <= range; q++) {
    for (let r = Math.max(-range, -q - range); r <= Math.min(range, -q + range); r++) {
      results.push({q: source.q + q, r: source.r + r});
    }
  }
  return results;
}
```

---

## Dependencies

### Depends On

- **Platform Infrastructure** (L1): WebSocket for real-time placement sync
- **AI Generation Pipeline** (L1): Provides creature sprites for rendering
- **Content Management & Storage** (L1): Serves creature assets

### Depended On By

- **Multi-Round Battle System** (L2): Uses deployment state for each round
- **Authoritative Server Simulation** (L2): Uses hex positions for pathfinding, range, collision
- **Client Rendering & Animation Sync** (L2): Renders creatures on hex grid during combat
- **Combat Mechanics & Ability System** (L2): Uses hex distance for range calculations

---

## Key Technical Challenges

1. **Hex Math Correctness**: Hex grids are notoriously tricky—off-by-one errors in coordinate conversions, rounding issues in pixel-to-hex mapping, and distance calculations that look right but fail edge cases. Requires comprehensive unit tests and visual debugging tools.

2. **Drag-and-Drop Performance**: Dragging creature sprites smoothly at 60fps while computing hex highlights, range previews, and validation in real-time. PixiJS sprite rendering must be optimized (sprite pooling, texture atlases).

3. **Deployment State Synchronization**: Ensuring both players' deployment states stay synchronized despite network latency. If Player A places creature at hex (2, 3) and Player B simultaneously places at same hex, server must resolve conflict without visual jank.

4. **Touch vs Mouse Input**: Drag-and-drop works differently on touch devices (no hover state, different event model). Must support both mouse (desktop) and touch (tablets) without dual codebases.

5. **Auto-Deployment Fairness**: When timeout expires with partial placement (e.g., 5/8 creatures placed), auto-deploying remaining creatures must avoid obviously terrible positions (e.g., all in one hex column). Needs smart default placement algorithm.

6. **Visual Clarity at Scale**: With 8 creatures per player (16 total), grid must remain readable. Creature sprites, hex outlines, zone colors, hover highlights, and range previews must not create visual clutter.

7. **Anti-Cheat Validation**: Client-side placement UI is vulnerable to tampering (modified JavaScript placing creatures in invalid hexes). Server must re-validate all placements before combat starts.

---

## Success Criteria

### MVP Definition of Done

- [ ] Hex grid renders correctly with 12×8 hexes and clear visual zones
- [ ] Players can drag-and-drop creatures from roster to valid hexes
- [ ] Placement validation prevents invalid positions (opponent zone, occupied hex)
- [ ] Visual feedback (green/red hex highlights) works in real-time during drag
- [ ] Creature repositioning (drag placed creature to new hex) works smoothly
- [ ] Placement counter ("5/8 creatures placed") updates correctly
- [ ] Ready button enables when 8/8 placed, locks deployment when clicked
- [ ] Reset button clears all placements and returns creatures to roster
- [ ] Auto-deploy places remaining creatures in valid positions on timeout
- [ ] Server validates all placements before starting combat (anti-cheat)
- [ ] Deployment state syncs between client and server with <100ms latency
- [ ] Hex distance calculations accurate for range checking
- [ ] Pixel-to-hex conversion works for mouse and touch input
- [ ] Grid renders at 60fps with 16 creatures placed

### Exceptional Target (Post-MVP)

- [ ] Formation templates (Line, Spread, Wedge, Custom) for quick-deploy
- [ ] Formation saving: Save custom formations for future matches
- [ ] Range preview: Hover creature shows attack range overlay
- [ ] Mirror opponent: Auto-place creatures mirroring opponent's previous round
- [ ] Undo/redo placement actions (Ctrl+Z style)
- [ ] Accessibility: Keyboard-only placement (arrow keys + Enter)
- [ ] Tutorial overlay: Animated guide for first-time players
- [ ] Larger grid sizes: 16×10 for "epic battles" mode

---

## Open Questions

1. **Hex Orientation**: Flat-top hexagons (hexes wider than tall) or pointy-top (hexes taller than wide)? Flat-top feels more natural for left-right deployment zones, but pointy-top has aesthetic appeal.

2. **Grid Dimensions**: 12×8 hexes (96 total) enough for strategic depth? Too cramped with 16 creatures? Should we test 14×10 or 16×12?

3. **Deployment Zone Size**: 3 columns per player (36 hexes for 8 creatures = 4.5x coverage) enough? Too much space reduces strategic tension. Should we reduce to 2 columns (more cramped, forces clustering)?

4. **Hover Range Preview**: Should hovering over placed creature show attack range by default, or require modifier key (Shift+hover) to avoid visual clutter?

5. **Formation Templates**: Should formation presets be MVP or post-MVP? They speed up deployment (good UX) but add scope. Can we ship without them initially?

6. **Auto-Deploy Strategy**: When timeout expires, should auto-deploy:
   - Place creatures in back row (defensive)
   - Spread creatures evenly across deployment zone (balanced)
   - Replicate previous round's formation (continuity)
   - Random valid positions (unpredictable)

7. **Touch Gesture Support**: Drag-and-drop on touch requires long-press to initiate drag (to avoid conflicting with scroll). Is this discoverable enough, or do we need tutorial prompts?

8. **Creature Sprite Size**: How large should creature sprites be on hexes? Too small = hard to see, too large = overlapping sprites look messy. Should size scale with hex size?

---

## L3 Feature Candidates

### Core Hex Grid System
- **Hex Grid Data Structure** - Grid dimensions, coordinate system, zone definitions
- **Hex Math Library** - Distance, neighbors, conversions, range calculations
- **Deployment Zone Definition** - Valid hex ranges per player
- **Grid Rendering Engine** - PixiJS hex outline rendering, zone colors

### Placement Mechanics
- **Drag-and-Drop Controller** - Mouse/touch input handling for creature dragging
- **Placement Validation Logic** - Real-time validation of creature placement
- **Creature Positioning System** - Place, move, remove creatures on hexes
- **Visual Feedback System** - Green/red hex highlights, hover effects

### Deployment UI
- **Creature Roster Panel** - Display 8 creatures with drag handles
- **Placement Counter** - "X/8 creatures placed" indicator
- **Ready Button & State Management** - Lock deployments when ready
- **Reset Button** - Clear all placements

### Advanced Features
- **Auto-Deployment Generator** - Smart default placement on timeout
- **Formation Templates** - Quick-deploy presets (Line, Spread, Wedge)
- **Range Preview Overlay** - Show attack range on creature hover
- **Placement Undo/Redo** - Revert placement actions

### Server Validation
- **Server-Side Placement Validator** - Anti-cheat validation before combat
- **Deployment State Sync** - WebSocket synchronization of placements
- **Grid State Serialization** - Efficient JSON encoding for network

---

## Metadata

- **Estimated Effort**: 3-4 weeks (core features), 5-6 weeks (with advanced features)
- **Team Size**: 2-3 developers (1 frontend/PixiJS specialist, 1 full-stack, 1 QA)
- **Priority**: CRITICAL (foundational for all battle mechanics)
- **Risks**: Medium (hex math complexity, touch input challenges)
- **Blockers**: None (can develop in parallel with other epics)

---

*This document defines the hexagonal grid battlefield and deployment mechanics. Ready for L3 feature breakdown and task definition.*
