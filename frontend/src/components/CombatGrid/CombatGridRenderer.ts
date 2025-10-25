/**
 * TASK-COMBAT-VIZ-010: Combat Grid Renderer Implementation
 *
 * Extends DeploymentGridRenderer with animated sprite support for live combat.
 * Handles smooth interpolation, animation state transitions, and 60 FPS rendering.
 */

import * as PIXI from 'pixi.js';
import { HexGridRenderer } from '../DeploymentGrid/DeploymentGridRenderer';
import type { AxialCoordinate } from '@drawn-of-war/shared';
import type { AnimationData } from '../../services/animation-asset-mapper';
import { AnimationState } from '../../services/unit-animation-state-machine';

/**
 * Animation completion event
 */
export interface AnimationCompleteEvent {
  unitId: string;
  animationState: AnimationState;
}

/**
 * Animated sprite wrapper
 */
interface AnimatedSpriteData {
  container: PIXI.Container;   // Store container reference
  sprite: PIXI.AnimatedSprite;
  unitId: string;
  animationState: AnimationState;
  isPlaying: boolean;
  loop: boolean;
  textures: PIXI.Texture[];
  scale: { x: number; y: number };
  x: number;
  y: number;
  onComplete?: () => void;
}

/**
 * CombatGridRenderer
 *
 * Extends HexGridRenderer with animated sprite support for combat visualization.
 */
export class CombatGridRenderer extends HexGridRenderer {
  private animatedSprites: Map<string, AnimatedSpriteData> = new Map();
  private animationCompleteCallbacks: ((event: AnimationCompleteEvent) => void)[] = [];
  private lastUpdateTime: number = 0;
  private pendingCreations: Set<string> = new Set();

  /**
   * Check if animations are supported
   */
  public supportsAnimations(): boolean {
    return true;
  }

  /**
   * Render creature with unit ID for proper sprite lifecycle management
   * This is the combat-specific method that prevents ghost trails
   */
  public renderCreatureWithId(
    unitId: string,
    hex: AxialCoordinate,
    _creatureName: string,
    playerId: 'player1' | 'player2',
    spriteData?: any,
    opacity: number = 1.0,
    direction: number = 1
  ): void {
    // Check if unit already has a sprite
    const existing = this.animatedSprites.get(unitId);

    if (existing) {
      // UPDATE EXISTING SPRITE IN-PLACE
      this.updateSpritePosition(existing, hex);
      // Animation state changes handled by renderAnimatedCreature if needed
      return;
    }

    // NEW UNIT - Extract animation data from spriteData
    const battlefieldViews = this.extractBattlefieldViews(spriteData);

    if (battlefieldViews) {
      const animationData = this.selectDirectionalAnimation(battlefieldViews, direction);

      // Try synchronous texture retrieval from cache
      const textures: (PIXI.Texture | null)[] = animationData.frames.map(frame => {
        try {
          return PIXI.Assets.get(frame) as PIXI.Texture;
        } catch {
          return null;
        }
      });

      // Check if all textures are cached
      const allCached = textures.every(t => t !== null);

      if (allCached) {
        // CACHE HIT - Create sprite synchronously
        console.log('[CombatGridRenderer] Cache HIT - creating sprite synchronously:', unitId);
        this.createSpriteSync(
          unitId,
          hex,
          playerId,
          AnimationState.IDLE,
          animationData,
          textures as PIXI.Texture[]
        );
      } else {
        // CACHE MISS - Fall back to async with pending tracker
        console.log('[CombatGridRenderer] Cache MISS - falling back to async load:', unitId);
        this.renderAnimatedCreature(
          hex,
          unitId,
          playerId,
          AnimationState.IDLE,
          animationData
        ).catch(err => {
          console.error('[CombatGridRenderer] Failed to render animated creature:', err);
        });
      }
    } else {
      // Fallback for non-directional sprites (using unitId tracking to prevent ghost trails)
      console.log('[CombatGridRenderer] No battlefieldDirectionalViews - using static sprite fallback with unitId tracking');

      // Extract sprite URL from spriteData
      let spriteUrl: string | undefined;
      if (typeof spriteData === 'string') {
        spriteUrl = spriteData;
      } else if (spriteData && typeof spriteData === 'object') {
        spriteUrl = (spriteData as any).sprite || (spriteData as any).battlefieldSprite || (spriteData as any).spriteImageBase64;
      }

      if (!spriteUrl) {
        console.warn('[CombatGridRenderer] No sprite URL found for unit:', unitId);
        return;
      }

      // Convert base64 data to proper data URI if needed
      const processedUrl = this.normalizeImageUrl(spriteUrl);
      console.log('[CombatGridRenderer] Sprite URL type:', {
        original: spriteUrl.substring(0, 50),
        processed: processedUrl.substring(0, 50),
        isDataUri: processedUrl.startsWith('data:')
      });

      // Create static sprite with unitId tracking (prevents ghost trails)
      this.renderStaticSpriteWithId(unitId, hex, playerId, processedUrl, opacity);
    }
  }

  /**
   * Create animated sprite synchronously using pre-loaded textures
   */
  private createSpriteSync(
    unitId: string,
    hex: AxialCoordinate,
    playerId: 'player1' | 'player2',
    animationState: AnimationState,
    animationData: AnimationData,
    textures: PIXI.Texture[]
  ): void {
    // Validate textures array
    if (!textures || textures.length === 0) {
      console.error('[CombatGridRenderer] createSpriteSync called with empty textures array');
      return;
    }

    // Calculate position (matching DeploymentGridRenderer logic)
    const bounds = this.calculateGridBoundsPublic();
    const isIsometric = this.getHexGrid().getConfig().projection === 'isometric';
    const verticalBias = isIsometric ? 50 : 0;
    const offsetX = (this.getCanvas().width - bounds.width) / 2 - bounds.minX;
    const offsetY = (this.getCanvas().height - bounds.height) / 2 - bounds.minY + verticalBias;
    const pixel = this.getHexGrid().toPixel(hex);

    // Create animated sprite
    const animatedSprite = new PIXI.AnimatedSprite(textures);

    // Configure animation
    animatedSprite.animationSpeed = animationData.frameDuration / 1000 * 0.06; // Convert ms to PixiJS speed
    animatedSprite.loop = animationData.loop;
    animatedSprite.anchor.set(0.5);

    // Scale sprite to fit hex
    const targetSize = this.getHexGrid().hexSize * 1.2;
    const baseScale = Math.min(
      targetSize / textures[0].width,
      targetSize / textures[0].height
    );

    // Apply mirroring if needed
    if (animationData.shouldMirror) {
      animatedSprite.scale.set(-baseScale, baseScale);
    } else {
      animatedSprite.scale.set(baseScale, baseScale);
    }

    // Position sprite at (0,0) relative to container
    animatedSprite.x = 0;
    animatedSprite.y = 0;

    // Add team color glow
    const container = new PIXI.Container();
    const glow = new PIXI.Graphics();
    const glowColor = playerId === 'player1' ? 0x3498db : 0xe74c3c;
    glow.circle(0, 0, this.getHexGrid().hexSize * 0.65);
    glow.fill({ color: glowColor, alpha: 0.2 });
    container.addChild(glow);
    container.addChild(animatedSprite);

    container.x = pixel.x + offsetX;
    container.y = pixel.y + offsetY;

    // Setup animation completion handler for non-looping animations
    let onComplete: (() => void) | undefined;
    if (!animationData.loop) {
      onComplete = () => {
        this.triggerAnimationComplete({
          unitId,
          animationState
        });
      };
      animatedSprite.onComplete = onComplete;
    }

    // Add to stage
    this.getCreatureLayer().addChild(container);

    // Start playing
    animatedSprite.play();

    // Store sprite data (key by unitId)
    const spriteData: AnimatedSpriteData = {
      container,
      sprite: animatedSprite,
      unitId,
      animationState,
      isPlaying: true,
      loop: animationData.loop,
      textures,
      scale: { x: animatedSprite.scale.x, y: animatedSprite.scale.y },
      x: container.x,
      y: container.y
    };

    // Only add onComplete if defined
    if (onComplete) {
      spriteData.onComplete = onComplete;
    }

    this.animatedSprites.set(unitId, spriteData);
  }

  /**
   * Render creature with animated sprite (async fallback path)
   */
  public async renderAnimatedCreature(
    hex: AxialCoordinate,
    unitId: string,
    playerId: 'player1' | 'player2',
    animationState: AnimationState,
    animationData: AnimationData
  ): Promise<void> {
    // Check if already pending (prevent duplicate async operations)
    if (this.pendingCreations.has(unitId)) {
      console.warn('[CombatGridRenderer] Async creation already pending for unit:', unitId);
      return;
    }

    // Add to pending tracker
    this.pendingCreations.add(unitId);

    try {
      // Validate inputs
      if (!animationData.frames || animationData.frames.length === 0) {
        throw new Error('Animation data must have at least one frame');
      }

      // SPAWN-TO-BATTLE: Allow off-grid coordinates for deployment positions
      // Units can spawn outside the combat grid and move into it
      const isOffGrid = !this.getHexGrid().isValid(hex);
      if (isOffGrid) {
        console.log('[CombatGridRenderer] Rendering at off-grid position (spawn-to-battle):', {
          unitId,
          hex,
          animationState
        });
      }

      // Check if this unit already has a sprite (should not happen, but defensive)
      const existingSprite = this.animatedSprites.get(unitId);
      if (existingSprite) {
        console.warn('[CombatGridRenderer] Sprite already exists for unit, destroying old one:', unitId);
        this.destroyAnimatedSprite(existingSprite);
        this.animatedSprites.delete(unitId);
      }

      // Load textures
      const textures = await Promise.all(
        animationData.frames.map(frame => PIXI.Assets.load(frame))
      );

      // Calculate position (matching DeploymentGridRenderer logic)
      const bounds = this.calculateGridBoundsPublic();
      const isIsometric = this.getHexGrid().getConfig().projection === 'isometric';
      const verticalBias = isIsometric ? 50 : 0;
      const offsetX = (this.getCanvas().width - bounds.width) / 2 - bounds.minX;
      const offsetY = (this.getCanvas().height - bounds.height) / 2 - bounds.minY + verticalBias;
      const pixel = this.getHexGrid().toPixel(hex);

      // Create animated sprite
      const animatedSprite = new PIXI.AnimatedSprite(textures);

      // Configure animation
      animatedSprite.animationSpeed = animationData.frameDuration / 1000 * 0.06; // Convert ms to PixiJS speed
      animatedSprite.loop = animationData.loop;
      animatedSprite.anchor.set(0.5);

      // Scale sprite to fit hex
      const targetSize = this.getHexGrid().hexSize * 1.2;
      const baseScale = Math.min(
        targetSize / textures[0].width,
        targetSize / textures[0].height
      );

      // Apply mirroring if needed
      if (animationData.shouldMirror) {
        animatedSprite.scale.set(-baseScale, baseScale);
      } else {
        animatedSprite.scale.set(baseScale, baseScale);
      }

      // Position sprite at (0,0) relative to container
      animatedSprite.x = 0;
      animatedSprite.y = 0;

      // Add team color glow
      const container = new PIXI.Container();
      const glow = new PIXI.Graphics();
      const glowColor = playerId === 'player1' ? 0x3498db : 0xe74c3c;
      glow.circle(0, 0, this.getHexGrid().hexSize * 0.65);
      glow.fill({ color: glowColor, alpha: 0.2 });
      container.addChild(glow);
      container.addChild(animatedSprite);

      container.x = pixel.x + offsetX;
      container.y = pixel.y + offsetY;

      // Setup animation completion handler for non-looping animations
      let onComplete: (() => void) | undefined;
      if (!animationData.loop) {
        onComplete = () => {
          this.triggerAnimationComplete({
            unitId,
            animationState
          });
        };
        animatedSprite.onComplete = onComplete;
      }

      // Add to stage
      this.getCreatureLayer().addChild(container);

      // Start playing
      animatedSprite.play();

      // Store sprite data (key by unitId, not hash)
      const spriteData: AnimatedSpriteData = {
        container,                        // Store container
        sprite: animatedSprite,
        unitId,
        animationState,
        isPlaying: true,
        loop: animationData.loop,
        textures,
        scale: { x: animatedSprite.scale.x, y: animatedSprite.scale.y },
        x: container.x,
        y: container.y
      };

      // Only add onComplete if defined
      if (onComplete) {
        spriteData.onComplete = onComplete;
      }

      this.animatedSprites.set(unitId, spriteData);
    } finally {
      // Always remove from pending tracker (success or failure)
      this.pendingCreations.delete(unitId);
    }
  }

  /**
   * Render static sprite with unitId tracking (fallback for non-directional sprites)
   * This prevents ghost trails by using unitId instead of position hash
   */
  private async renderStaticSpriteWithId(
    unitId: string,
    hex: AxialCoordinate,
    playerId: 'player1' | 'player2',
    spriteUrl: string,
    opacity: number = 1.0
  ): Promise<void> {
    // Check if unit already has a sprite
    const existing = this.animatedSprites.get(unitId);

    if (existing) {
      // UPDATE EXISTING SPRITE IN-PLACE
      this.updateSpritePosition(existing, hex);
      if (existing.container.alpha !== opacity) {
        existing.container.alpha = opacity;
      }
      return;
    }

    // NEW UNIT - Create static sprite
    try {
      // Load texture
      const texture = await PIXI.Assets.load(spriteUrl);

      // Calculate position
      const bounds = this.calculateGridBoundsPublic();
      const isIsometric = this.getHexGrid().getConfig().projection === 'isometric';
      const verticalBias = isIsometric ? 50 : 0;
      const offsetX = (this.getCanvas().width - bounds.width) / 2 - bounds.minX;
      const offsetY = (this.getCanvas().height - bounds.height) / 2 - bounds.minY + verticalBias;
      const pixel = this.getHexGrid().toPixel(hex);

      // Create static sprite
      const sprite = new PIXI.Sprite(texture);
      sprite.anchor.set(0.5);

      // Scale sprite to fit hex
      const targetSize = this.getHexGrid().hexSize * 1.2;
      const scale = Math.min(
        targetSize / texture.width,
        targetSize / texture.height
      );
      sprite.scale.set(scale, scale);

      // Position sprite at (0,0) relative to container
      sprite.x = 0;
      sprite.y = 0;

      // Add team color glow
      const container = new PIXI.Container();
      const glow = new PIXI.Graphics();
      const glowColor = playerId === 'player1' ? 0x3498db : 0xe74c3c;
      glow.circle(0, 0, this.getHexGrid().hexSize * 0.65);
      glow.fill({ color: glowColor, alpha: 0.2 });
      container.addChild(glow);
      container.addChild(sprite);

      container.x = pixel.x + offsetX;
      container.y = pixel.y + offsetY;
      container.alpha = opacity;

      // Add to stage
      this.getCreatureLayer().addChild(container);

      // Store sprite data (using AnimatedSpriteData structure for consistency)
      const spriteData: AnimatedSpriteData = {
        container,
        sprite: sprite as any, // Static sprite treated as single-frame animation
        unitId,
        animationState: AnimationState.IDLE,
        isPlaying: false, // Static sprite doesn't animate
        loop: false,
        textures: [texture],
        scale: { x: sprite.scale.x, y: sprite.scale.y },
        x: container.x,
        y: container.y
      };

      this.animatedSprites.set(unitId, spriteData);
    } catch (error) {
      console.error('[CombatGridRenderer] Failed to load static sprite:', error);
    }
  }

  /**
   * Normalize image URL to ensure proper format for PixiJS
   * Converts raw base64 data to data URI format
   */
  private normalizeImageUrl(url: string): string {
    // Already a data URI
    if (url.startsWith('data:')) {
      return url;
    }

    // Already a HTTP(S) URL
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    // Already a relative path starting with /
    if (url.startsWith('/')) {
      return url;
    }

    // Assume raw base64 data - convert to data URI
    // Detect image format from base64 header
    let mimeType = 'image/png'; // default
    if (url.startsWith('/9j/')) {
      mimeType = 'image/jpeg';
    } else if (url.startsWith('R0lGOD')) {
      mimeType = 'image/gif';
    } else if (url.startsWith('PHN2Zy')) {
      mimeType = 'image/svg+xml';
    }

    console.log('[CombatGridRenderer] Converting raw base64 to data URI:', {
      detectedType: mimeType,
      base64Preview: url.substring(0, 20)
    });

    return `data:${mimeType};base64,${url}`;
  }

  /**
   * Get sprite at hex position
   */
  public getSpriteAt(hex: AxialCoordinate): AnimatedSpriteData | undefined {
    const hash = this.getHexGrid().hash(hex);
    return this.animatedSprites.get(hash);
  }

  /**
   * Get all active animated sprites
   */
  public getActiveSprites(): Map<string, AnimatedSpriteData> {
    return this.animatedSprites;
  }

  /**
   * Update all animations (call each frame at 60 FPS)
   */
  public updateAnimations(deltaTime: number): void {
    this.lastUpdateTime += deltaTime;

    // PixiJS AnimatedSprite updates automatically via ticker
    // This method is here for manual control if needed
    this.animatedSprites.forEach(spriteData => {
      if (spriteData.isPlaying && !spriteData.sprite.playing) {
        spriteData.sprite.play();
      }
    });
  }

  /**
   * Register callback for animation completion
   */
  public onAnimationComplete(callback: (event: AnimationCompleteEvent) => void): void {
    this.animationCompleteCallbacks.push(callback);
  }

  /**
   * Remove creature by unit ID (combat-specific method)
   */
  public removeCreatureById(unitId: string): void {
    const spriteData = this.animatedSprites.get(unitId);

    if (spriteData) {
      this.destroyAnimatedSprite(spriteData);
      this.animatedSprites.delete(unitId);
    }
  }

  /**
   * Remove creature by hex position (legacy method for backward compatibility)
   */
  public override removeCreature(hex: AxialCoordinate): void {
    // Scan for unit at this position in animated sprites
    for (const [unitId, spriteData] of Array.from(this.animatedSprites.entries())) {
      // Check if container is at this position
      const containerPos = this.getHexFromPixel({
        x: spriteData.container.x,
        y: spriteData.container.y
      });

      if (containerPos && this.hexEquals(containerPos, hex)) {
        this.removeCreatureById(unitId);
        return;
      }
    }

    // Fallback to parent
    super.removeCreature(hex);
  }

  /**
   * Clear all creatures including animated sprites
   */
  public override clearAllCreatures(): void {
    // Destroy all animated sprites
    this.animatedSprites.forEach(spriteData => {
      this.destroyAnimatedSprite(spriteData);
    });
    this.animatedSprites.clear();

    // Call parent method
    super.clearAllCreatures();
  }

  /**
   * Destroy the renderer and cleanup resources
   */
  public override destroy(): void {
    // Stop all animations and clear sprites
    this.clearAllCreatures();

    // Call parent destroy
    super.destroy();
  }

  /**
   * Destroy an animated sprite and its resources
   */
  private destroyAnimatedSprite(spriteData: AnimatedSpriteData): void {
    // Stop animation
    spriteData.sprite.stop();

    // Remove CONTAINER from stage (not just sprite from container!)
    if (spriteData.container.parent) {
      spriteData.container.parent.removeChild(spriteData.container);
    }

    // Destroy container (which destroys children including sprite)
    spriteData.container.destroy({
      children: true,
      texture: false,  // Don't destroy shared textures
      textureSource: false
    });
  }

  /**
   * Trigger animation completion callbacks
   */
  private triggerAnimationComplete(event: AnimationCompleteEvent): void {
    this.animationCompleteCallbacks.forEach(callback => callback(event));
  }

  /**
   * Expose protected method for positioning calculations
   */
  private calculateGridBoundsPublic() {
    // Access protected method via type assertion
    const hexGrid = this.getHexGrid();
    const { width, height } = hexGrid.getConfig();

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    // Sample all edge hexes to find true bounds after projection
    for (let q = 0; q < width; q++) {
      for (let r = 0; r < height; r++) {
        // Only check edge hexes for efficiency
        if (q === 0 || q === width - 1 || r === 0 || r === height - 1) {
          const pixel = hexGrid.toPixel({ q, r });
          minX = Math.min(minX, pixel.x);
          maxX = Math.max(maxX, pixel.x);
          minY = Math.min(minY, pixel.y);
          maxY = Math.max(maxY, pixel.y);
        }
      }
    }

    // Add hex size padding
    const padding = hexGrid.hexSize;

    return {
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
      minX: minX - padding,
      minY: minY - padding
    };
  }

  /**
   * Get creature layer for adding sprites
   */
  private getCreatureLayer(): PIXI.Container {
    // Access private property via type assertion
    return (this as any).creatureLayer;
  }

  /**
   * Get canvas element
   */
  public override getCanvas(): HTMLCanvasElement {
    return super.getCanvas();
  }

  /**
   * Update sprite position without recreating
   */
  private updateSpritePosition(
    spriteData: AnimatedSpriteData,
    hex: AxialCoordinate
  ): void {
    const bounds = this.calculateGridBoundsPublic();
    const isIsometric = this.getHexGrid().getConfig().projection === 'isometric';
    const verticalBias = isIsometric ? 50 : 0;
    const offsetX = (this.getCanvas().width - bounds.width) / 2 - bounds.minX;
    const offsetY = (this.getCanvas().height - bounds.height) / 2 - bounds.minY + verticalBias;
    const pixel = this.getHexGrid().toPixel(hex);

    spriteData.container.x = pixel.x + offsetX;
    spriteData.container.y = pixel.y + offsetY;
  }

  /**
   * Extract battlefield views from sprite data
   */
  private extractBattlefieldViews(spriteData: any): any {
    if (!spriteData) return null;

    if (spriteData.battlefieldDirectionalViews) {
      return spriteData.battlefieldDirectionalViews;
    }

    return null;
  }

  /**
   * Select animation for direction
   */
  private selectDirectionalAnimation(views: any, direction: number): AnimationData {
    // Map direction to view key
    const dirKey = direction === 0 ? 'NE' : direction === 1 ? 'E' : 'SE';
    const view = views[dirKey] || views['E']; // Fallback to E

    return {
      frames: view.idle || [view.sprite],
      frameDuration: 100,
      loop: true,
      shouldMirror: false
    };
  }

  /**
   * Check if two hexes are equal
   */
  private hexEquals(a: AxialCoordinate, b: AxialCoordinate): boolean {
    return a.q === b.q && a.r === b.r;
  }

  /**
   * Get hex coordinate from pixel position (inverse of toPixel)
   */
  private getHexFromPixel(pixel: { x: number; y: number }): AxialCoordinate | null {
    // Remove offsets
    const bounds = this.calculateGridBoundsPublic();
    const isIsometric = this.getHexGrid().getConfig().projection === 'isometric';
    const verticalBias = isIsometric ? 50 : 0;
    const offsetX = (this.getCanvas().width - bounds.width) / 2 - bounds.minX;
    const offsetY = (this.getCanvas().height - bounds.height) / 2 - bounds.minY + verticalBias;

    const adjustedX = pixel.x - offsetX;
    const adjustedY = pixel.y - offsetY;

    // Use hex grid's fromPixel method
    return this.getHexGrid().fromPixel({ x: adjustedX, y: adjustedY });
  }
}
