/**
 * Deployment Grid Renderer
 *
 * PixiJS-based rendering system for the hexagonal deployment grid.
 * Handles grid rendering, zone overlays, and interactive highlights.
 */

import * as PIXI from 'pixi.js';
import { HexGrid } from '@drawn-of-war/shared';
import type { AxialCoordinate, HexGridConfig } from '@drawn-of-war/shared';

/**
 * Highlight states for hex interaction feedback
 */
export enum HighlightState {
  NONE = 'none',
  HOVER = 'hover',
  VALID = 'valid',
  INVALID = 'invalid',
  SELECTED = 'selected',
  RANGE = 'range'
}

/**
 * Deployment zone configuration
 */
export interface DeploymentZone {
  playerId: 'player1' | 'player2';
  hexes: AxialCoordinate[];
  color: number; // e.g., 0x3498db for blue
  alpha: number; // e.g., 0.2 for 20% opacity
}

/**
 * Configuration for the hex grid renderer
 */
export interface HexGridRendererConfig {
  canvasWidth: number;
  canvasHeight: number;
  hexGridConfig: HexGridConfig;
  showCoordinates?: boolean;
  onHexHover?: (hex: AxialCoordinate | null) => void;
  onHexClick?: (hex: AxialCoordinate) => void;
}

/**
 * Main hex grid renderer using PixiJS
 */
export class HexGridRenderer {
  private app: PIXI.Application;
  private hexGrid: HexGrid;
  private config: HexGridRendererConfig;

  private gridContainer: PIXI.Container;
  private highlightLayer: PIXI.Container;
  private coordinateLayer: PIXI.Container;
  private creatureLayer: PIXI.Container;

  private hexGraphics: Map<string, PIXI.Graphics>;
  private highlightGraphics: Map<string, PIXI.Graphics>;
  private coordinateTexts: Map<string, PIXI.Text>;

  /**
   * Creature sprite storage
   * Protected to allow derived classes (CombatGridRenderer) to access for unified sprite lookup
   * Maps hex hash → PIXI.Container for static sprites
   */
  protected creatureSprites: Map<string, PIXI.Container>;

  private currentHoverHex: AxialCoordinate | null = null;
  private showCoordinates: boolean = false;
  private isInitialized: boolean = false;
  private isDestroyed: boolean = false;

  constructor(config: HexGridRendererConfig) {
    this.config = config;
    this.hexGrid = new HexGrid(config.hexGridConfig);
    this.hexGraphics = new Map();
    this.highlightGraphics = new Map();
    this.coordinateTexts = new Map();
    this.creatureSprites = new Map();
    this.showCoordinates = config.showCoordinates || false;

    // Initialize PixiJS application
    this.app = new PIXI.Application();
    this.gridContainer = new PIXI.Container();
    this.highlightLayer = new PIXI.Container();
    this.coordinateLayer = new PIXI.Container();
    this.creatureLayer = new PIXI.Container();
  }

  /**
   * Initialize the renderer asynchronously
   */
  async init(): Promise<HTMLCanvasElement> {
    // If already destroyed during initialization, abort
    if (this.isDestroyed) {
      throw new Error('Renderer was destroyed before initialization completed');
    }

    await this.app.init({
      width: this.config.canvasWidth,
      height: this.config.canvasHeight,
      backgroundColor: 0x1a1a1a,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true
    });

    // Check again after async operation
    if (this.isDestroyed) {
      // Clean up app if it was initialized but we're now destroyed
      this.app.destroy(true, { children: true, texture: true });
      throw new Error('Renderer was destroyed during initialization');
    }

    // Setup layer hierarchy (order matters for rendering)
    this.app.stage.addChild(this.gridContainer);
    this.app.stage.addChild(this.highlightLayer);
    this.app.stage.addChild(this.creatureLayer);
    this.app.stage.addChild(this.coordinateLayer);

    // Render the static grid
    this.renderStaticGrid();

    // Setup interaction
    this.setupInteraction();

    // Mark as initialized
    this.isInitialized = true;

    return this.app.canvas;
  }

  /**
   * Calculate actual rendered bounding box of the grid
   * Accounts for isometric projection transformation
   */
  private calculateGridBounds(): { width: number; height: number; minX: number; minY: number } {
    const { width, height } = this.hexGrid.getConfig();

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    // Sample all edge hexes to find true bounds after projection
    for (let q = 0; q < width; q++) {
      for (let r = 0; r < height; r++) {
        // Only check edge hexes for efficiency
        if (q === 0 || q === width - 1 || r === 0 || r === height - 1) {
          const pixel = this.hexGrid.toPixel({ q, r });
          minX = Math.min(minX, pixel.x);
          maxX = Math.max(maxX, pixel.x);
          minY = Math.min(minY, pixel.y);
          maxY = Math.max(maxY, pixel.y);
        }
      }
    }

    // Add hex size padding
    const padding = this.hexGrid.hexSize;

    return {
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
      minX: minX - padding,
      minY: minY - padding
    };
  }

  /**
   * Render the static hex grid
   */
  private renderStaticGrid(): void {
    const { width, height } = this.hexGrid.getConfig();
    const isIsometric = this.config.hexGridConfig.projection === 'isometric';

    // Calculate actual grid bounds (accounts for isometric projection)
    const bounds = this.calculateGridBounds();

    // Apply centering with optional visual bias for isometric view
    const verticalBias = isIsometric ? 50 : 0; // Move grid down slightly for better visual balance
    const offsetX = (this.config.canvasWidth - bounds.width) / 2 - bounds.minX;
    const offsetY = (this.config.canvasHeight - bounds.height) / 2 - bounds.minY + verticalBias;

    // Render all hexes
    for (let q = 0; q < width; q++) {
      for (let r = 0; r < height; r++) {
        const hex: AxialCoordinate = { q, r };
        const pixel = this.hexGrid.toPixel(hex);

        // Create hex graphic
        const hexGraphic = this.createHexGraphic(
          hex,
          { x: pixel.x + offsetX, y: pixel.y + offsetY }
        );

        this.gridContainer.addChild(hexGraphic);
        this.hexGraphics.set(this.hexGrid.hash(hex), hexGraphic);

        // Create coordinate text (initially hidden)
        if (this.showCoordinates) {
          const coordText = this.createCoordinateText(
            hex,
            { x: pixel.x + offsetX, y: pixel.y + offsetY }
          );
          this.coordinateLayer.addChild(coordText);
          this.coordinateTexts.set(this.hexGrid.hash(hex), coordText);
        }
      }
    }

    // Render deployment zones
    this.renderDeploymentZones(offsetX, offsetY);
  }

  /**
   * Create a single hex graphic
   */
  private createHexGraphic(_hex: AxialCoordinate, pixel: { x: number; y: number }): PIXI.Graphics {
    const graphic = new PIXI.Graphics();
    const vertices = this.getHexVertices(this.hexGrid.hexSize);

    // Draw hex outline
    graphic.stroke({ width: 2, color: 0x555555, alpha: 0.5 });
    graphic.fill({ color: 0x000000, alpha: 0 }); // Transparent fill
    graphic.poly(vertices);
    graphic.stroke();
    graphic.fill();

    // Position at pixel coordinate
    graphic.x = pixel.x;
    graphic.y = pixel.y;

    // Make interactive
    graphic.eventMode = 'static';
    graphic.cursor = 'pointer';

    return graphic;
  }

  /**
   * Get hex vertices for flat-top orientation
   * Applies isometric projection if enabled in config
   */
  private getHexVertices(size: number): number[] {
    const angles = [0, 60, 120, 180, 240, 300]; // Degrees for flat-top
    const vertices: number[] = [];
    const isIsometric = this.config.hexGridConfig.projection === 'isometric';

    for (const angle of angles) {
      const rad = (Math.PI / 180) * angle;
      let x = size * Math.cos(rad);
      let y = size * Math.sin(rad);

      // Apply isometric projection to vertices if enabled
      if (isIsometric) {
        const x_iso = (x - y) * 0.5;
        const y_iso = (x + y) * 0.25;
        x = x_iso;
        y = y_iso;
      }

      vertices.push(x, y);
    }

    return vertices;
  }

  /**
   * Create coordinate text for debugging
   */
  private createCoordinateText(hex: AxialCoordinate, pixel: { x: number; y: number }): PIXI.Text {
    const text = new PIXI.Text({
      text: `${hex.q},${hex.r}`,
      style: {
        fontSize: 10,
        fill: 0xffffff,
        align: 'center'
      }
    });

    text.alpha = 0.4;
    text.anchor.set(0.5);
    text.x = pixel.x;
    text.y = pixel.y;

    return text;
  }

  /**
   * Render deployment zone overlays
   */
  private renderDeploymentZones(offsetX: number, offsetY: number): void {
    const { width, height } = this.hexGrid.getConfig();

    const zones: DeploymentZone[] = [
      {
        playerId: 'player1',
        hexes: this.getZoneHexes(0, 2, height), // Left 3 columns
        color: 0x3498db, // Blue
        alpha: 0.2
      },
      {
        playerId: 'player2',
        hexes: this.getZoneHexes(width - 3, width - 1, height), // Right 3 columns
        color: 0xe74c3c, // Red
        alpha: 0.2
      }
    ];

    zones.forEach(zone => {
      const overlay = this.createZoneOverlay(zone, offsetX, offsetY);
      this.gridContainer.addChild(overlay);
    });
  }

  /**
   * Get all hexes in a column range
   */
  private getZoneHexes(minCol: number, maxCol: number, height: number): AxialCoordinate[] {
    const hexes: AxialCoordinate[] = [];
    for (let q = minCol; q <= maxCol; q++) {
      for (let r = 0; r < height; r++) {
        hexes.push({ q, r });
      }
    }
    return hexes;
  }

  /**
   * Create zone overlay graphic
   */
  private createZoneOverlay(zone: DeploymentZone, offsetX: number, offsetY: number): PIXI.Graphics {
    const graphic = new PIXI.Graphics();
    const vertices = this.getHexVertices(this.hexGrid.hexSize);

    graphic.fill({ color: zone.color, alpha: zone.alpha });

    zone.hexes.forEach(hex => {
      const pixel = this.hexGrid.toPixel(hex);
      const offsetVertices = vertices.map((v, i) =>
        i % 2 === 0 ? v + pixel.x + offsetX : v + pixel.y + offsetY
      );
      graphic.poly(offsetVertices);
    });

    graphic.fill();
    return graphic;
  }

  /**
   * Setup mouse interaction
   */
  private setupInteraction(): void {
    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = this.app.screen;

    // Track mouse movement for hover
    this.app.stage.on('pointermove', (event) => {
      const point = event.global;

      // Calculate grid offset using consistent bounds calculation
      const isIsometric = this.config.hexGridConfig.projection === 'isometric';
      const bounds = this.calculateGridBounds();
      const verticalBias = isIsometric ? 50 : 0;
      const offsetX = (this.config.canvasWidth - bounds.width) / 2 - bounds.minX;
      const offsetY = (this.config.canvasHeight - bounds.height) / 2 - bounds.minY + verticalBias;

      // Convert to hex coordinate
      const hex = this.hexGrid.fromPixel({
        x: point.x - offsetX,
        y: point.y - offsetY
      });

      // Check if valid hex
      if (this.hexGrid.isValid(hex)) {
        if (!this.currentHoverHex || !this.hexGrid.equals(this.currentHoverHex, hex)) {
          this.currentHoverHex = hex;
          this.updateHighlight(hex, HighlightState.HOVER);
          this.config.onHexHover?.(hex);
        }
      } else {
        if (this.currentHoverHex) {
          this.clearHighlights();
          this.currentHoverHex = null;
          this.config.onHexHover?.(null);
        }
      }
    });

    // Handle clicks
    this.app.stage.on('pointerdown', () => {
      if (this.currentHoverHex) {
        this.config.onHexClick?.(this.currentHoverHex);
      }
    });
  }

  /**
   * Update hex highlight
   */
  updateHighlight(hex: AxialCoordinate, state: HighlightState): void {
    // Clear existing highlights
    this.clearHighlights();

    // Create new highlight
    const highlight = this.createHighlight(hex, state);
    if (highlight) {
      const hash = this.hexGrid.hash(hex);
      this.highlightLayer.addChild(highlight);
      this.highlightGraphics.set(hash, highlight);
    }
  }

  /**
   * Create highlight graphic based on state
   */
  private createHighlight(hex: AxialCoordinate, state: HighlightState): PIXI.Graphics | null {
    if (state === HighlightState.NONE) return null;

    // Calculate position using consistent bounds calculation
    const isIsometric = this.config.hexGridConfig.projection === 'isometric';
    const bounds = this.calculateGridBounds();
    const verticalBias = isIsometric ? 50 : 0;
    const offsetX = (this.config.canvasWidth - bounds.width) / 2 - bounds.minX;
    const offsetY = (this.config.canvasHeight - bounds.height) / 2 - bounds.minY + verticalBias;

    const pixel = this.hexGrid.toPixel(hex);
    const graphic = new PIXI.Graphics();
    const vertices = this.getHexVertices(this.hexGrid.hexSize);

    switch (state) {
      case HighlightState.HOVER:
        graphic.stroke({ width: 3, color: 0xf39c12, alpha: 1 }); // Yellow
        graphic.fill({ color: 0xf39c12, alpha: 0.3 });
        break;

      case HighlightState.VALID:
        graphic.stroke({ width: 3, color: 0x2ecc71, alpha: 1 }); // Green
        graphic.fill({ color: 0x2ecc71, alpha: 0.4 });
        break;

      case HighlightState.INVALID:
        graphic.stroke({ width: 3, color: 0xe74c3c, alpha: 1 }); // Red
        graphic.fill({ color: 0xe74c3c, alpha: 0.4 });
        break;

      case HighlightState.SELECTED:
        graphic.stroke({ width: 4, color: 0xecf0f1, alpha: 1 }); // White
        graphic.fill({ color: 0xecf0f1, alpha: 0.2 });
        break;

      case HighlightState.RANGE:
        graphic.stroke({ width: 2, color: 0x3498db, alpha: 1 }); // Blue
        graphic.fill({ color: 0x3498db, alpha: 0.2 });
        break;
    }

    graphic.poly(vertices);
    graphic.stroke();
    graphic.fill();
    graphic.x = pixel.x + offsetX;
    graphic.y = pixel.y + offsetY;

    return graphic;
  }

  /**
   * Clear all highlights
   */
  clearHighlights(): void {
    this.highlightLayer.removeChildren();
    this.highlightGraphics.clear();
  }

  /**
   * Toggle coordinate display
   */
  toggleCoordinates(): void {
    this.showCoordinates = !this.showCoordinates;
    this.coordinateLayer.visible = this.showCoordinates;

    // Create coordinate texts if they don't exist
    if (this.showCoordinates && this.coordinateTexts.size === 0) {
      const { width, height } = this.hexGrid.getConfig();

      // Calculate grid offset using consistent bounds calculation
      const isIsometric = this.config.hexGridConfig.projection === 'isometric';
      const bounds = this.calculateGridBounds();
      const verticalBias = isIsometric ? 50 : 0;
      const offsetX = (this.config.canvasWidth - bounds.width) / 2 - bounds.minX;
      const offsetY = (this.config.canvasHeight - bounds.height) / 2 - bounds.minY + verticalBias;

      for (let q = 0; q < width; q++) {
        for (let r = 0; r < height; r++) {
          const hex: AxialCoordinate = { q, r };
          const pixel = this.hexGrid.toPixel(hex);
          const coordText = this.createCoordinateText(
            hex,
            { x: pixel.x + offsetX, y: pixel.y + offsetY }
          );
          this.coordinateLayer.addChild(coordText);
          this.coordinateTexts.set(this.hexGrid.hash(hex), coordText);
        }
      }
    }
  }

  /**
   * Render a creature sprite on a hex
   * @param hex - Hex coordinate to render at
   * @param creatureName - Name of the creature (used for fallback)
   * @param playerId - Player ID for color theming
   * @param spriteData - Sprite image URL (base64 or HTTP) OR DeploymentCreature object with battlefield directional views
   * @param opacity - Opacity for the sprite (0-1)
   * @param direction - Facing direction for multi-directional sprites (defaults to E)
   */
  renderCreature(
    hex: AxialCoordinate,
    creatureName: string,
    playerId: 'player1' | 'player2',
    spriteData?: string | import('@drawn-of-war/shared').DeploymentCreature | {
      spriteImageBase64?: string;
      battlefieldSprite?: string;
      battlefieldDirectionalViews?: import('@drawn-of-war/shared').BattlefieldDirectionalViews;
    },
    opacity: number = 1.0,
    direction: number = 1 // HexDirection.E = 1 (East is default)
  ): void {
    const hash = this.hexGrid.hash(hex);

    // Remove existing sprite if any
    const existingSprite = this.creatureSprites.get(hash);
    if (existingSprite) {
      this.creatureLayer.removeChild(existingSprite);
    }

    // Calculate position using consistent bounds calculation
    const isIsometric = this.config.hexGridConfig.projection === 'isometric';
    const bounds = this.calculateGridBounds();
    const verticalBias = isIsometric ? 50 : 0;
    const offsetX = (this.config.canvasWidth - bounds.width) / 2 - bounds.minX;
    const offsetY = (this.config.canvasHeight - bounds.height) / 2 - bounds.minY + verticalBias;
    const pixel = this.hexGrid.toPixel(hex);

    console.log(`[${this.constructor.name}] renderCreature called for ${creatureName}`);
    console.log(`[${this.constructor.name}] spriteData type:`, typeof spriteData);
    console.log(`[${this.constructor.name}] spriteData:`, spriteData);
    console.log(`[${this.constructor.name}] direction:`, direction);

    // Extract sprite URL and animation frames with directional support
    let spriteUrl: string | undefined;
    let idleFrames: string[] | undefined;
    let walkFrames: string[] | undefined;
    let shouldMirror = false;

    if (typeof spriteData === 'string') {
      // Legacy: direct base64 string
      spriteUrl = spriteData;
      console.log(`[${this.constructor.name}] Legacy mode - direct sprite URL`);
    } else if (spriteData && typeof spriteData === 'object') {
      // NEW: Multi-directional support
      console.log(`[${this.constructor.name}] Object mode - checking for battlefieldDirectionalViews`);
      console.log(`[${this.constructor.name}] Has battlefieldDirectionalViews:`, !!spriteData.battlefieldDirectionalViews);

      if (spriteData.battlefieldDirectionalViews) {
        const dirViews = spriteData.battlefieldDirectionalViews;
        console.log(`[${this.constructor.name}] Directional views:`, dirViews);

        // Map direction to sprite and animation frames (with mirroring for W, NW, SW)
        switch (direction) {
          case 1: // E (East)
            spriteUrl = dirViews.E.sprite;
            idleFrames = dirViews.E.idleFrames;
            walkFrames = dirViews.E.walkFrames;
            shouldMirror = false;
            console.log(`[${this.constructor.name}] Direction E - idleFrames:`, idleFrames);
            console.log(`[${this.constructor.name}] Direction E - idleFrames length:`, idleFrames?.length);
            break;
          case 0: // NE (Northeast)
            spriteUrl = dirViews.NE.sprite;
            idleFrames = dirViews.NE.idleFrames;
            walkFrames = dirViews.NE.walkFrames;
            shouldMirror = false;
            break;
          case 2: // SE (Southeast)
            spriteUrl = dirViews.SE.sprite;
            idleFrames = dirViews.SE.idleFrames;
            walkFrames = dirViews.SE.walkFrames;
            shouldMirror = false;
            break;
          case 4: // W (West) - mirror of E
            spriteUrl = dirViews.E.sprite;
            idleFrames = dirViews.E.idleFrames;
            walkFrames = dirViews.E.walkFrames;
            shouldMirror = true;
            break;
          case 5: // NW (Northwest) - mirror of NE
            spriteUrl = dirViews.NE.sprite;
            idleFrames = dirViews.NE.idleFrames;
            walkFrames = dirViews.NE.walkFrames;
            shouldMirror = true;
            break;
          case 3: // SW (Southwest) - mirror of SE
            spriteUrl = dirViews.SE.sprite;
            idleFrames = dirViews.SE.idleFrames;
            walkFrames = dirViews.SE.walkFrames;
            shouldMirror = true;
            break;
          default:
            // Fallback to E if unknown direction
            spriteUrl = dirViews.E.sprite;
            idleFrames = dirViews.E.idleFrames;
            walkFrames = dirViews.E.walkFrames;
            shouldMirror = false;
        }
      } else {
        // Fallback to legacy battlefield sprite, menu sprite, or basic sprite field
        spriteUrl = (spriteData as any).battlefieldSprite || (spriteData as any).spriteImageBase64 || spriteData.sprite;
      }
    }

    console.log(`[${this.constructor.name}] After extraction - idleFrames:`, idleFrames);
    console.log(`[${this.constructor.name}] After extraction - walkFrames:`, walkFrames);
    console.log(`[${this.constructor.name}] After extraction - spriteUrl:`, spriteUrl);

    // Create sprite container
    const spriteContainer = new PIXI.Container();
    spriteContainer.alpha = opacity; // Set opacity for entire container

    if (spriteUrl || idleFrames || walkFrames) {
      // Load and render actual sprite image or animation
      console.log(`[${this.constructor.name}] Calling loadAndRenderSprite with idleFrames:`, idleFrames?.length ?? 0);
      this.loadAndRenderSprite(spriteContainer, spriteUrl, playerId, creatureName, shouldMirror, idleFrames, walkFrames);
    } else {
      // Fallback: Create circular background with text
      const bg = new PIXI.Graphics();
      const bgColor = playerId === 'player1' ? 0x3498db : 0xe74c3c;
      bg.circle(0, 0, this.hexGrid.hexSize * 0.6);
      bg.fill({ color: bgColor, alpha: 0.8 });
      spriteContainer.addChild(bg);

      // Create text label (placeholder)
      const text = new PIXI.Text({
        text: creatureName.charAt(0).toUpperCase(),
        style: {
          fontSize: 24,
          fill: 0xffffff,
          fontWeight: 'bold',
          align: 'center'
        }
      });
      text.anchor.set(0.5);
      spriteContainer.addChild(text);
    }

    // Position sprite
    spriteContainer.x = pixel.x + offsetX;
    spriteContainer.y = pixel.y + offsetY;

    // Add to layer and cache
    this.creatureLayer.addChild(spriteContainer);
    this.creatureSprites.set(hash, spriteContainer);
  }

  /**
   * Load and render a sprite image or animation into a container
   * @param shouldMirror - Whether to horizontally mirror the sprite
   * @param idleFrames - Optional array of idle animation frame URLs
   * @param walkFrames - Optional array of walk animation frame URLs
   */
  private async loadAndRenderSprite(
    container: PIXI.Container,
    spriteUrl: string | undefined,
    playerId: 'player1' | 'player2',
    creatureName: string,
    shouldMirror: boolean = false,
    idleFrames?: string[],
    walkFrames?: string[]
  ): Promise<void> {
    try {
      // PRIORITY 1: Use idle animation frames if available
      if (idleFrames && idleFrames.length > 0) {
        console.log(`[${this.constructor.name}] Loading idle animation with ${idleFrames.length} frames for ${creatureName}`);

        // Load all frame textures in parallel
        const textures = await Promise.all(
          idleFrames.map(url => PIXI.Assets.load(url))
        );

        // Create animated sprite
        const animatedSprite = new PIXI.AnimatedSprite(textures);

        // Configure animation
        animatedSprite.animationSpeed = 0.08; // Slow speed for subtle idle breathing (about 1-2 FPS)
        animatedSprite.play(); // Start animation loop
        animatedSprite.loop = true; // Ensure looping

        // Scale sprite to fit hex (with some padding)
        const targetSize = this.hexGrid.hexSize * 1.2;
        const baseScale = Math.min(
          targetSize / textures[0].width,
          targetSize / textures[0].height
        );

        // Apply mirroring if needed
        if (shouldMirror) {
          animatedSprite.scale.set(-baseScale, baseScale); // Negative X scale for horizontal flip
        } else {
          animatedSprite.scale.set(baseScale, baseScale);
        }

        // Center sprite
        animatedSprite.anchor.set(0.5);

        // Add subtle background glow for team color
        const glow = new PIXI.Graphics();
        const glowColor = playerId === 'player1' ? 0x3498db : 0xe74c3c;
        glow.circle(0, 0, this.hexGrid.hexSize * 0.65);
        glow.fill({ color: glowColor, alpha: 0.2 });
        container.addChild(glow);

        // Add animated sprite
        container.addChild(animatedSprite);

        console.log(`[${this.constructor.name}] Idle animation loaded and playing for ${creatureName}`);
        return;
      }

      // PRIORITY 2: Fallback to static sprite if available
      if (spriteUrl) {
        // Check if spriteUrl is a valid image URL or base64 data
        const isValidImageUrl = spriteUrl.startsWith('data:image/') ||
                                spriteUrl.startsWith('http://') ||
                                spriteUrl.startsWith('https://') ||
                                spriteUrl.startsWith('/');

        if (!isValidImageUrl) {
          // Not a valid image URL, use fallback rendering
          console.warn(`[${this.constructor.name}] Invalid sprite URL format for ${creatureName}, using fallback: ${spriteUrl}`);
          throw new Error(`Invalid sprite URL format: ${spriteUrl}`);
        }

        // Load texture from URL
        const texture = await PIXI.Assets.load(spriteUrl);

        // Check if texture loaded successfully
        if (!texture) {
          throw new Error(`Failed to load texture from URL: ${spriteUrl}`);
        }

        // Validate texture has required properties
        if (!texture.width || !texture.height) {
          throw new Error(`Invalid texture dimensions: ${texture.width}x${texture.height}`);
        }

        // Create sprite from texture
        const sprite = new PIXI.Sprite(texture);

        // Scale sprite to fit hex (with some padding)
        const targetSize = this.hexGrid.hexSize * 1.2; // Slightly smaller than hex
        const baseScale = Math.min(
          targetSize / texture.width,
          targetSize / texture.height
        );

        // Apply mirroring if needed
        if (shouldMirror) {
          sprite.scale.set(-baseScale, baseScale); // Negative X scale for horizontal flip
        } else {
          sprite.scale.set(baseScale, baseScale);
        }

        // Center sprite
        sprite.anchor.set(0.5);

        // Add subtle background glow for team color
        const glow = new PIXI.Graphics();
        const glowColor = playerId === 'player1' ? 0x3498db : 0xe74c3c;
        glow.circle(0, 0, this.hexGrid.hexSize * 0.65);
        glow.fill({ color: glowColor, alpha: 0.2 });
        container.addChild(glow);

        // Add sprite
        container.addChild(sprite);
        return;
      }

      // PRIORITY 3: No sprite data available
      throw new Error('No sprite data available (neither idleFrames nor spriteUrl)');
    } catch (error) {
      console.error('[${this.constructor.name}] Failed to load sprite:', error);

      // Fallback to placeholder on error
      const bg = new PIXI.Graphics();
      const bgColor = playerId === 'player1' ? 0x3498db : 0xe74c3c;
      bg.circle(0, 0, this.hexGrid.hexSize * 0.6);
      bg.fill({ color: bgColor, alpha: 0.8 });
      container.addChild(bg);

      const text = new PIXI.Text({
        text: creatureName.charAt(0).toUpperCase(),
        style: {
          fontSize: 24,
          fill: 0xffffff,
          fontWeight: 'bold',
          align: 'center'
        }
      });
      text.anchor.set(0.5);
      container.addChild(text);
    }
  }

  /**
   * Remove creature sprite from a hex
   */
  removeCreature(hex: AxialCoordinate): void {
    const hash = this.hexGrid.hash(hex);
    const sprite = this.creatureSprites.get(hash);

    if (sprite) {
      this.creatureLayer.removeChild(sprite);
      this.creatureSprites.delete(hash);
    }
  }

  /**
   * Clear all creature sprites
   */
  clearAllCreatures(): void {
    this.creatureLayer.removeChildren();
    this.creatureSprites.clear();
  }

  /**
   * Render a ghost/preview of a creature being dragged
   */
  renderDragPreview(
    hex: AxialCoordinate,
    creatureName: string,
    playerId: 'player1' | 'player2',
    spriteData?: string | import('@drawn-of-war/shared').DeploymentCreature | {
      spriteImageBase64?: string;
      battlefieldSprite?: string;
      battlefieldDirectionalViews?: import('@drawn-of-war/shared').BattlefieldDirectionalViews;
    },
    direction: number = 1 // HexDirection.E = 1 (East is default)
  ): void {
    // First clear any existing preview
    this.clearDragPreview();

    const hash = 'drag-preview';

    // Calculate position using consistent bounds calculation
    const isIsometric = this.config.hexGridConfig.projection === 'isometric';
    const bounds = this.calculateGridBounds();
    const verticalBias = isIsometric ? 50 : 0;
    const offsetX = (this.config.canvasWidth - bounds.width) / 2 - bounds.minX;
    const offsetY = (this.config.canvasHeight - bounds.height) / 2 - bounds.minY + verticalBias;
    const pixel = this.hexGrid.toPixel(hex);

    // Extract sprite URL with directional support
    let spriteUrl: string | undefined;
    let shouldMirror = false;

    if (typeof spriteData === 'string') {
      // Legacy: direct base64 string
      spriteUrl = spriteData;
    } else if (spriteData && typeof spriteData === 'object') {
      // NEW: Multi-directional support
      if (spriteData.battlefieldDirectionalViews) {
        const dirViews = spriteData.battlefieldDirectionalViews;

        // Map direction to sprite (with mirroring for W, NW, SW)
        switch (direction) {
          case 1: // E (East)
            spriteUrl = dirViews.E.sprite;
            shouldMirror = false;
            break;
          case 0: // NE (Northeast)
            spriteUrl = dirViews.NE.sprite;
            shouldMirror = false;
            break;
          case 2: // SE (Southeast)
            spriteUrl = dirViews.SE.sprite;
            shouldMirror = false;
            break;
          case 4: // W (West) - mirror of E
            spriteUrl = dirViews.E.sprite;
            shouldMirror = true;
            break;
          case 5: // NW (Northwest) - mirror of NE
            spriteUrl = dirViews.NE.sprite;
            shouldMirror = true;
            break;
          case 3: // SW (Southwest) - mirror of SE
            spriteUrl = dirViews.SE.sprite;
            shouldMirror = true;
            break;
          default:
            // Fallback to E if unknown direction
            spriteUrl = dirViews.E.sprite;
            shouldMirror = false;
        }
      } else {
        // Fallback to legacy battlefield sprite, menu sprite, or basic sprite field
        spriteUrl = (spriteData as any).battlefieldSprite || (spriteData as any).spriteImageBase64 || spriteData.sprite;
      }
    }

    // Create sprite container
    const spriteContainer = new PIXI.Container();
    spriteContainer.alpha = 0.5; // Ghost effect

    if (spriteUrl) {
      // Load and render actual sprite image (with ghost effect)
      this.loadAndRenderSprite(spriteContainer, spriteUrl, playerId, creatureName, shouldMirror);
    } else {
      // Fallback: Create circular background
      const bg = new PIXI.Graphics();
      const bgColor = playerId === 'player1' ? 0x3498db : 0xe74c3c;
      bg.circle(0, 0, this.hexGrid.hexSize * 0.6);
      bg.fill({ color: bgColor, alpha: 0.6 });
      spriteContainer.addChild(bg);

      // Create text label
      const text = new PIXI.Text({
        text: creatureName.charAt(0).toUpperCase(),
        style: {
          fontSize: 24,
          fill: 0xffffff,
          fontWeight: 'bold',
          align: 'center'
        }
      });
      text.anchor.set(0.5);
      spriteContainer.addChild(text);
    }

    // Position sprite
    spriteContainer.x = pixel.x + offsetX;
    spriteContainer.y = pixel.y + offsetY;

    // Add to layer and cache
    this.creatureLayer.addChild(spriteContainer);
    this.creatureSprites.set(hash, spriteContainer);
  }

  /**
   * Clear drag preview
   */
  clearDragPreview(): void {
    const preview = this.creatureSprites.get('drag-preview');
    if (preview) {
      this.creatureLayer.removeChild(preview);
      this.creatureSprites.delete('drag-preview');
    }
  }

  /**
   * Destroy the renderer and cleanup resources
   */
  destroy(): void {
    // Mark as destroyed to prevent race conditions with async init
    this.isDestroyed = true;

    // Only destroy PixiJS app if it was fully initialized
    if (this.isInitialized && this.app.stage) {
      this.hexGraphics.clear();
      this.highlightGraphics.clear();
      this.coordinateTexts.clear();
      this.creatureSprites.clear();
      this.app.destroy(true, { children: true, texture: true });
    }
    // If init() was called but not completed, it will handle cleanup
  }

  /**
   * Get the PixiJS canvas element
   */
  getCanvas(): HTMLCanvasElement {
    return this.app.canvas;
  }

  /**
   * Get the hex grid instance
   */
  getHexGrid(): HexGrid {
    return this.hexGrid;
  }

  /**
   * Get the PixiJS stage container
   * Used by effect renderers (CombatVisualizationManager) to add visual effect layers
   */
  getStage(): PIXI.Container {
    return this.app.stage;
  }

  /**
   * Get hex coordinate at pixel position (relative to canvas)
   * Used for HTML5 drag-and-drop hit detection
   */
  getHexAtPixel(x: number, y: number): AxialCoordinate | null {
    // Calculate grid offset using consistent bounds calculation
    const isIsometric = this.config.hexGridConfig.projection === 'isometric';
    const bounds = this.calculateGridBounds();
    const verticalBias = isIsometric ? 50 : 0;
    const offsetX = (this.config.canvasWidth - bounds.width) / 2 - bounds.minX;
    const offsetY = (this.config.canvasHeight - bounds.height) / 2 - bounds.minY + verticalBias;

    // Convert pixel coordinates to hex coordinates
    const hex = this.hexGrid.fromPixel({
      x: x - offsetX,
      y: y - offsetY
    });

    // Validate hex is within grid bounds
    if (this.hexGrid.isValid(hex)) {
      return hex;
    }

    return null;
  }
}
