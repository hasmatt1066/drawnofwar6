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
  private creatureSprites: Map<string, PIXI.Container>;

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
   * Render the static hex grid
   */
  private renderStaticGrid(): void {
    const { width, height } = this.hexGrid.getConfig();

    // Calculate grid offset to center it
    const gridPixelWidth = width * this.hexGrid.hexSize * 1.5;
    const gridPixelHeight = height * this.hexGrid.hexSize * Math.sqrt(3);
    const offsetX = (this.config.canvasWidth - gridPixelWidth) / 2;
    const offsetY = (this.config.canvasHeight - gridPixelHeight) / 2;

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
   */
  private getHexVertices(size: number): number[] {
    const angles = [0, 60, 120, 180, 240, 300]; // Degrees for flat-top
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

      // Calculate grid offset
      const { width, height } = this.hexGrid.getConfig();
      const gridPixelWidth = width * this.hexGrid.hexSize * 1.5;
      const gridPixelHeight = height * this.hexGrid.hexSize * Math.sqrt(3);
      const offsetX = (this.config.canvasWidth - gridPixelWidth) / 2;
      const offsetY = (this.config.canvasHeight - gridPixelHeight) / 2;

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

    const { width, height } = this.hexGrid.getConfig();
    const gridPixelWidth = width * this.hexGrid.hexSize * 1.5;
    const gridPixelHeight = height * this.hexGrid.hexSize * Math.sqrt(3);
    const offsetX = (this.config.canvasWidth - gridPixelWidth) / 2;
    const offsetY = (this.config.canvasHeight - gridPixelHeight) / 2;

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
      const gridPixelWidth = width * this.hexGrid.hexSize * 1.5;
      const gridPixelHeight = height * this.hexGrid.hexSize * Math.sqrt(3);
      const offsetX = (this.config.canvasWidth - gridPixelWidth) / 2;
      const offsetY = (this.config.canvasHeight - gridPixelHeight) / 2;

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
   * @param spriteUrl - Optional sprite image URL (base64 or HTTP)
   */
  renderCreature(hex: AxialCoordinate, creatureName: string, playerId: 'player1' | 'player2', spriteUrl?: string, opacity: number = 1.0): void {
    const hash = this.hexGrid.hash(hex);

    // Remove existing sprite if any
    const existingSprite = this.creatureSprites.get(hash);
    if (existingSprite) {
      this.creatureLayer.removeChild(existingSprite);
    }

    // Calculate position
    const { width, height } = this.hexGrid.getConfig();
    const gridPixelWidth = width * this.hexGrid.hexSize * 1.5;
    const gridPixelHeight = height * this.hexGrid.hexSize * Math.sqrt(3);
    const offsetX = (this.config.canvasWidth - gridPixelWidth) / 2;
    const offsetY = (this.config.canvasHeight - gridPixelHeight) / 2;
    const pixel = this.hexGrid.toPixel(hex);

    // Create sprite container
    const spriteContainer = new PIXI.Container();
    spriteContainer.alpha = opacity; // Set opacity for entire container

    if (spriteUrl) {
      // Load and render actual sprite image
      this.loadAndRenderSprite(spriteContainer, spriteUrl, playerId);
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
   * Load and render a sprite image into a container
   */
  private async loadAndRenderSprite(container: PIXI.Container, spriteUrl: string, playerId: 'player1' | 'player2'): Promise<void> {
    try {
      // Load texture from URL
      const texture = await PIXI.Assets.load(spriteUrl);

      // Create sprite from texture
      const sprite = new PIXI.Sprite(texture);

      // Scale sprite to fit hex (with some padding)
      const targetSize = this.hexGrid.hexSize * 1.2; // Slightly smaller than hex
      const scale = Math.min(
        targetSize / texture.width,
        targetSize / texture.height
      );
      sprite.scale.set(scale);

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
    } catch (error) {
      console.error('[DeploymentGridRenderer] Failed to load sprite:', error);

      // Fallback to placeholder on error
      const bg = new PIXI.Graphics();
      const bgColor = playerId === 'player1' ? 0x3498db : 0xe74c3c;
      bg.circle(0, 0, this.hexGrid.hexSize * 0.6);
      bg.fill({ color: bgColor, alpha: 0.8 });
      container.addChild(bg);

      const text = new PIXI.Text({
        text: '?',
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
  renderDragPreview(hex: AxialCoordinate, creatureName: string, playerId: 'player1' | 'player2', spriteUrl?: string): void {
    // First clear any existing preview
    this.clearDragPreview();

    const hash = 'drag-preview';

    // Calculate position
    const { width, height } = this.hexGrid.getConfig();
    const gridPixelWidth = width * this.hexGrid.hexSize * 1.5;
    const gridPixelHeight = height * this.hexGrid.hexSize * Math.sqrt(3);
    const offsetX = (this.config.canvasWidth - gridPixelWidth) / 2;
    const offsetY = (this.config.canvasHeight - gridPixelHeight) / 2;
    const pixel = this.hexGrid.toPixel(hex);

    // Create sprite container
    const spriteContainer = new PIXI.Container();
    spriteContainer.alpha = 0.5; // Ghost effect

    if (spriteUrl) {
      // Load and render actual sprite image (with ghost effect)
      this.loadAndRenderSprite(spriteContainer, spriteUrl, playerId);
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
}
