# L3-FEATURE: Grid Rendering & Visualization

**Feature ID**: `grid-rendering-visualization`
**Epic**: Hex Grid Deployment System (L2)
**Status**: PLANNING
**Version**: 1.0
**Last Updated**: 2025-10-03

---

## Feature Summary

A PixiJS-based rendering system that draws the hexagonal battlefield grid with deployment zones, hover highlights, placement indicators, and visual feedback for valid/invalid positions. This feature transforms hex coordinates into visual elements, providing clear spatial awareness and real-time feedback during creature deployment.

**Value Proposition**: Enables players to understand the battlefield layout at a glance, see which areas they can deploy to, and receive immediate visual confirmation of placement actions without cognitive overhead.

---

## User Value

**For Players**: Clear visual distinction between deployment zones, neutral battle area, and enemy territory. Instant feedback when hovering over hexes shows whether placement is valid before dropping the creature.

**For Developers**: Separation of rendering logic from game logic, making it easy to update visuals without touching battle mechanics. Performance-optimized rendering handles 96 hexes at 60fps.

---

## Functional Requirements

### Hex Grid Rendering

1. **Grid Layout**
   - Render 12×8 hexagonal grid (96 hexes total)
   - Flat-top hexagon orientation
   - Consistent hex size (32-48px radius based on screen size)
   - Centered on viewport with padding

2. **Hex Visual Elements**
   - Hex outline (stroke): 2px width, semi-transparent
   - Hex fill (background): Transparent by default
   - Corner vertices: Precise polygon rendering
   - Grid lines: Smooth anti-aliasing

3. **Zone Coloring**
   - **Player Deployment Zone** (left 3 columns): Blue tint (#3498db, 20% opacity)
   - **Enemy Deployment Zone** (right 3 columns): Red tint (#e74c3c, 20% opacity)
   - **Neutral Battle Area** (middle 6 columns): No tint (transparent)
   - Zone borders: Thicker outline (3px) for zone boundaries

4. **Grid Coordinates** (Debug Mode)
   - Display (q, r) coordinates in center of each hex
   - Small font size (10px), low opacity (40%)
   - Toggle on/off with keyboard shortcut (G key)
   - Useful for development and debugging

### Interactive Highlights

1. **Hover Highlighting**
   - **Hover State**: Yellow glow (#f39c12, 40% opacity)
   - **Trigger**: Mouse cursor enters hex bounds
   - **Response Time**: < 16ms (60fps)
   - **Visual**: Filled hex background + thicker outline

2. **Placement Validation Feedback**
   - **Valid Placement**: Green highlight (#2ecc71, 50% opacity)
   - **Invalid Placement**: Red highlight (#e74c3c, 50% opacity)
   - **Occupied Hex**: Red X icon in center
   - **Out of Zone**: Faded red with border flash

3. **Selected Hex**
   - **Active Selection**: Bright outline (#ecf0f1, 4px width)
   - **Pulse Animation**: Subtle glow effect (1s cycle)
   - **Clear Indicator**: Visible against all backgrounds

4. **Range Preview** (on creature hover)
   - **Attack Range**: Blue circles at range boundary hexes
   - **Movement Range**: Dotted outline for reachable hexes
   - **AOE Radius**: Semi-transparent overlay for ability range
   - **Toggle**: Hold Shift to show/hide

### Visual Feedback States

1. **Drag-and-Drop States**
   - **Dragging**: Hex follows cursor, semi-transparent (60%)
   - **Valid Drop Zone**: Target hex glows green
   - **Invalid Drop Zone**: Target hex glows red, shake animation
   - **Drop Success**: Flash effect + creature appears
   - **Drop Failure**: Creature snaps back to roster

2. **Placement Confirmation**
   - **Placed Creature**: Hex outline changes to player color
   - **Locked Placement**: Dimmed, no hover state
   - **Ready State**: All placed hexes pulse green briefly

3. **Error States**
   - **Hex Already Occupied**: Red X icon, shake animation
   - **Out of Bounds**: Red border flash (200ms)
   - **Wrong Zone**: Red tint with "Invalid Zone" tooltip

### Performance Optimizations

1. **Rendering Strategy**
   - **Static Grid**: Render once, cache as texture
   - **Dynamic Overlays**: Separate layer for highlights/feedback
   - **Sprite Pooling**: Reuse hex graphics objects
   - **Culling**: Only render visible hexes (if grid large)

2. **Update Batching**
   - Group hover updates in single render pass
   - Debounce rapid mouse movements (16ms threshold)
   - Update only changed hexes, not entire grid
   - Use requestAnimationFrame for smooth rendering

3. **Memory Management**
   - Destroy unused graphics objects
   - Texture atlas for hex sprites
   - Limit active animations (max 10 simultaneous)
   - Release resources on scene cleanup

---

## Technical Specification

### Architecture

**Component Structure**
```typescript
/**
 * Main grid renderer managing all visual elements
 */
class HexGridRenderer {
  private app: PIXI.Application;
  private gridContainer: PIXI.Container;
  private highlightLayer: PIXI.Container;
  private hexGraphics: Map<string, PIXI.Graphics>; // Keyed by "q,r"

  constructor(config: HexGridConfig);
  render(): void;
  updateHighlight(hex: AxialCoordinate, state: HighlightState): void;
  clearHighlights(): void;
  destroy(): void;
}

/**
 * Hex graphics factory for creating visual elements
 */
class HexGraphicsFactory {
  createHexOutline(hex: AxialCoordinate, color: number, width: number): PIXI.Graphics;
  createHexFill(hex: AxialCoordinate, color: number, alpha: number): PIXI.Graphics;
  createZoneOverlay(hexes: AxialCoordinate[], color: number, alpha: number): PIXI.Graphics;
  createHighlight(hex: AxialCoordinate, state: HighlightState): PIXI.Graphics;
}

/**
 * Highlight state enum
 */
enum HighlightState {
  NONE = 'none',
  HOVER = 'hover',
  VALID = 'valid',
  INVALID = 'invalid',
  SELECTED = 'selected',
  RANGE = 'range'
}

/**
 * Zone definition
 */
interface DeploymentZone {
  playerId: 'player1' | 'player2';
  hexes: AxialCoordinate[];
  color: number; // e.g., 0x3498db for blue
  alpha: number; // e.g., 0.2 for 20% opacity
}
```

**Rendering Pipeline**
```typescript
class HexGridRenderer {
  /**
   * Initialize PixiJS application and create grid
   */
  private initializeRenderer(config: HexGridConfig): void {
    // Create PixiJS app
    this.app = new PIXI.Application({
      width: config.canvasWidth,
      height: config.canvasHeight,
      backgroundColor: 0x1a1a1a,
      antialias: true,
      resolution: window.devicePixelRatio || 1
    });

    // Create layer hierarchy
    this.gridContainer = new PIXI.Container();
    this.highlightLayer = new PIXI.Container();

    this.app.stage.addChild(this.gridContainer);
    this.app.stage.addChild(this.highlightLayer);
  }

  /**
   * Render static grid (called once on init)
   */
  private renderStaticGrid(config: HexGridConfig): void {
    const hexMath = new HexGrid(config);

    // Render all hexes
    for (let r = 0; r < config.height; r++) {
      for (let q = 0; q < config.width; q++) {
        const hex: AxialCoordinate = { q, r };
        const pixel = hexMath.toPixel(hex);

        // Create hex outline
        const hexGraphic = this.createHexGraphic(hex, pixel, config);
        this.gridContainer.addChild(hexGraphic);
        this.hexGraphics.set(`${q},${r}`, hexGraphic);
      }
    }

    // Render deployment zones
    this.renderDeploymentZones(config);
  }

  /**
   * Create single hex graphic
   */
  private createHexGraphic(
    hex: AxialCoordinate,
    pixel: PixelCoordinate,
    config: HexGridConfig
  ): PIXI.Graphics {
    const graphic = new PIXI.Graphics();
    const size = config.hexSize;

    // Calculate hex vertices (flat-top)
    const vertices = this.getHexVertices(size);

    // Draw hex outline
    graphic.lineStyle(2, 0x555555, 0.5); // Gray outline, 50% opacity
    graphic.beginFill(0x000000, 0); // Transparent fill
    graphic.drawPolygon(vertices);
    graphic.endFill();

    // Position at pixel coordinate
    graphic.x = pixel.x;
    graphic.y = pixel.y;

    return graphic;
  }

  /**
   * Get hex vertices for polygon drawing (flat-top)
   */
  private getHexVertices(size: number): number[] {
    const angles = [0, 60, 120, 180, 240, 300]; // Degrees
    const vertices: number[] = [];

    for (const angle of angles) {
      const rad = (Math.PI / 180) * angle;
      vertices.push(
        size * Math.cos(rad),
        size * Math.sin(rad)
      );
    }

    return vertices;
  }

  /**
   * Render deployment zone overlays
   */
  private renderDeploymentZones(config: HexGridConfig): void {
    const zones: DeploymentZone[] = [
      {
        playerId: 'player1',
        hexes: this.getZoneHexes(0, 2, config), // Columns 0-2
        color: 0x3498db, // Blue
        alpha: 0.2
      },
      {
        playerId: 'player2',
        hexes: this.getZoneHexes(9, 11, config), // Columns 9-11
        color: 0xe74c3c, // Red
        alpha: 0.2
      }
    ];

    zones.forEach(zone => {
      const overlay = this.createZoneOverlay(zone, config);
      this.gridContainer.addChild(overlay);
    });
  }

  /**
   * Create zone overlay graphic
   */
  private createZoneOverlay(zone: DeploymentZone, config: HexGridConfig): PIXI.Graphics {
    const graphic = new PIXI.Graphics();
    graphic.beginFill(zone.color, zone.alpha);

    zone.hexes.forEach(hex => {
      const pixel = new HexGrid(config).toPixel(hex);
      const vertices = this.getHexVertices(config.hexSize);

      graphic.drawPolygon(
        vertices.map((v, i) => i % 2 === 0 ? v + pixel.x : v + pixel.y)
      );
    });

    graphic.endFill();
    return graphic;
  }

  /**
   * Get all hexes in column range
   */
  private getZoneHexes(minCol: number, maxCol: number, config: HexGridConfig): AxialCoordinate[] {
    const hexes: AxialCoordinate[] = [];
    for (let q = minCol; q <= maxCol; q++) {
      for (let r = 0; r < config.height; r++) {
        hexes.push({ q, r });
      }
    }
    return hexes;
  }

  /**
   * Update hex highlight (called on hover, click, etc.)
   */
  updateHighlight(hex: AxialCoordinate, state: HighlightState): void {
    // Clear existing highlight
    this.clearHighlight(hex);

    // Create new highlight based on state
    const highlight = this.createHighlight(hex, state);
    if (highlight) {
      this.highlightLayer.addChild(highlight);
    }
  }

  /**
   * Create highlight graphic based on state
   */
  private createHighlight(hex: AxialCoordinate, state: HighlightState): PIXI.Graphics | null {
    if (state === HighlightState.NONE) return null;

    const pixel = new HexGrid(this.config).toPixel(hex);
    const graphic = new PIXI.Graphics();
    const size = this.config.hexSize;

    switch (state) {
      case HighlightState.HOVER:
        graphic.lineStyle(3, 0xf39c12, 1); // Yellow, solid
        graphic.beginFill(0xf39c12, 0.3); // Yellow, 30% opacity
        break;

      case HighlightState.VALID:
        graphic.lineStyle(3, 0x2ecc71, 1); // Green, solid
        graphic.beginFill(0x2ecc71, 0.4); // Green, 40% opacity
        break;

      case HighlightState.INVALID:
        graphic.lineStyle(3, 0xe74c3c, 1); // Red, solid
        graphic.beginFill(0xe74c3c, 0.4); // Red, 40% opacity
        break;

      case HighlightState.SELECTED:
        graphic.lineStyle(4, 0xecf0f1, 1); // White, thick
        graphic.beginFill(0xecf0f1, 0.2); // White, 20% opacity
        break;
    }

    const vertices = this.getHexVertices(size);
    graphic.drawPolygon(vertices);
    graphic.endFill();
    graphic.x = pixel.x;
    graphic.y = pixel.y;

    return graphic;
  }

  /**
   * Clear all highlights
   */
  clearHighlights(): void {
    this.highlightLayer.removeChildren();
  }
}
```

### Key Technologies

- **PixiJS v7**: WebGL-based rendering engine
- **TypeScript**: Type-safe graphics code
- **Hex Math Library**: Coordinate conversions
- **RAF (RequestAnimationFrame)**: Smooth 60fps rendering

---

## Success Criteria

### MVP Definition of Done

- [ ] Renders 12×8 hex grid with correct spacing and alignment
- [ ] Deployment zones (left 3, right 3 columns) show distinct colors
- [ ] Hover highlights hexes instantly (< 16ms response)
- [ ] Valid/invalid placement states show clear visual feedback
- [ ] Grid renders at 60fps with no frame drops
- [ ] Hex outlines are smooth and anti-aliased
- [ ] Zone colors are visually distinct but not overwhelming
- [ ] Coordinate debug mode toggles with 'G' key
- [ ] Grid scales correctly to different screen sizes
- [ ] Memory usage stays under 50MB for grid rendering
- [ ] Works on both desktop and tablet viewports

### Exceptional Target (Post-MVP)

- [ ] Animated zone transitions (fade in/out)
- [ ] Hex pulse animation for selected hexes
- [ ] Grid zoom and pan controls
- [ ] Minimap showing full battlefield
- [ ] Hex elevation rendering (3D effect)
- [ ] Dynamic lighting and shadows
- [ ] Particle effects for placement

---

## Testing Strategy

### Visual Regression Tests
- Screenshot comparison for grid layout
- Hover state visual validation
- Zone color accuracy tests
- Cross-browser rendering consistency

### Performance Tests
- 60fps sustained under load (100 rapid hover events)
- Memory leak detection (render/destroy cycles)
- Texture atlas efficiency (single draw call for grid)

### Edge Cases
- Grid rendering at 4K resolution
- Mobile viewport (768px width)
- Hover at grid edges and corners
- Rapid mouse movement stress test

---

## L4 Task Candidates

1. **Setup PixiJS Application** (3 hours) - Initialize renderer, canvas, layers
2. **Implement Hex Polygon Drawing** (2 hours) - Vertex calculation, flat-top geometry
3. **Render Static Grid** (4 hours) - Draw all 96 hexes, optimize with texture atlas
4. **Implement Zone Overlays** (3 hours) - Deployment zone coloring, alpha blending
5. **Implement Hover Highlighting** (4 hours) - Mouse interaction, highlight layer
6. **Implement Placement Feedback** (3 hours) - Valid/invalid states, visual indicators
7. **Optimize Rendering Pipeline** (4 hours) - Sprite pooling, update batching
8. **Implement Coordinate Debug Mode** (2 hours) - Toggle display, text rendering
9. **Add Responsive Scaling** (3 hours) - Canvas resize, hex size adjustment
10. **Performance Testing & Profiling** (4 hours) - 60fps validation, memory monitoring

**Total: 32 hours (~1 week)**

---

## Dependencies

### Depends On
- **Hex Math Library** (L3): Coordinate conversions, hex geometry

### Depended On By
- **Drag-and-Drop Controller** (L3): Visual feedback during drag
- **Deployment Validation** (L3): Highlight valid/invalid zones

---

## Metadata

**Feature ID**: `grid-rendering-visualization`
**Epic**: Hex Grid Deployment System
**Priority**: CRITICAL
**Estimated Effort**: 1 week
**Complexity**: MEDIUM
