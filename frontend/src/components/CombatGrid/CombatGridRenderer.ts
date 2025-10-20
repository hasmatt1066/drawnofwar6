/**
 * TASK-COMBAT-VIZ-010: Combat Grid Renderer Implementation
 *
 * Extends DeploymentGridRenderer with animated sprite support for live combat.
 * Handles smooth interpolation, animation state transitions, and 60 FPS rendering.
 */

import * as PIXI from 'pixi.js';
import { HexGridRenderer, type HexGridRendererConfig } from '../DeploymentGrid/DeploymentGridRenderer';
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

  /**
   * Check if animations are supported
   */
  public supportsAnimations(): boolean {
    return true;
  }

  /**
   * Render creature with animated sprite
   */
  public async renderAnimatedCreature(
    hex: AxialCoordinate,
    unitId: string,
    playerId: 'player1' | 'player2',
    animationState: AnimationState,
    animationData: AnimationData
  ): Promise<void> {
    // Validate inputs
    if (!animationData.frames || animationData.frames.length === 0) {
      throw new Error('Animation data must have at least one frame');
    }

    if (!this.getHexGrid().isValid(hex)) {
      throw new Error(`Invalid hex coordinates: q=${hex.q}, r=${hex.r}`);
    }

    const hash = this.getHexGrid().hash(hex);

    // Remove existing sprite at this location
    const existingSprite = this.animatedSprites.get(hash);
    if (existingSprite) {
      this.destroyAnimatedSprite(existingSprite);
      this.animatedSprites.delete(hash);
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

    // Position sprite
    animatedSprite.x = pixel.x + offsetX;
    animatedSprite.y = pixel.y + offsetY;

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

    // Store sprite data
    this.animatedSprites.set(hash, {
      sprite: animatedSprite,
      unitId,
      animationState,
      isPlaying: true,
      loop: animationData.loop,
      textures,
      scale: { x: animatedSprite.scale.x, y: animatedSprite.scale.y },
      x: animatedSprite.x,
      y: animatedSprite.y,
      onComplete
    });
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
   * Remove creature and its animated sprite
   */
  public override removeCreature(hex: AxialCoordinate): void {
    const hash = this.getHexGrid().hash(hex);
    const spriteData = this.animatedSprites.get(hash);

    if (spriteData) {
      this.destroyAnimatedSprite(spriteData);
      this.animatedSprites.delete(hash);
    }

    // Call parent method to remove from base renderer
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

    // Remove from stage
    if (spriteData.sprite.parent) {
      spriteData.sprite.parent.removeChild(spriteData.sprite);
    }

    // Destroy sprite
    spriteData.sprite.destroy({
      children: true,
      texture: false, // Don't destroy shared textures
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
}
