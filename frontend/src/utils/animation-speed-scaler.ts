/**
 * TASK-SPAWN-006: Animation Speed Scaler Implementation
 *
 * Scales animation FPS based on unit speed for visual consistency.
 * Fast units have faster walk animations, slow units have slower animations.
 *
 * Speed Mapping:
 * - Speed 1 (slow) → 4 FPS walk animation
 * - Speed 2 (normal) → 8 FPS walk animation
 * - Speed 3 (fast) → 12 FPS walk animation
 */

import * as PIXI from 'pixi.js';

/**
 * AnimationSpeedScaler
 *
 * Utility class for scaling animation FPS based on unit movement speed.
 * Ensures walk animation speed matches visual movement speed for realistic appearance.
 */
export class AnimationSpeedScaler {
  /** Baseline speed for normal units */
  private readonly BASE_SPEED = 2;

  /** Baseline animation FPS for normal speed units */
  private readonly BASE_ANIMATION_FPS = 8;

  /** PIXI.js runs at 60 FPS by default */
  private readonly PIXI_FRAME_RATE = 60;

  /**
   * Calculate animation FPS based on unit speed
   *
   * Formula: targetFPS = BASE_ANIMATION_FPS * (unitSpeed / BASE_SPEED)
   *
   * @param unitSpeed - Unit's speed attribute (typically 1-3)
   * @returns Animation FPS
   *
   * @example
   * ```typescript
   * const scaler = new AnimationSpeedScaler();
   * scaler.getAnimationFPS(1); // 4 FPS (slow)
   * scaler.getAnimationFPS(2); // 8 FPS (normal)
   * scaler.getAnimationFPS(3); // 12 FPS (fast)
   * ```
   */
  public getAnimationFPS(unitSpeed: number): number {
    const speedRatio = unitSpeed / this.BASE_SPEED;
    return this.BASE_ANIMATION_FPS * speedRatio;
  }

  /**
   * Calculate PIXI.js animationSpeed value for unit speed
   *
   * PIXI.AnimatedSprite.animationSpeed is relative to 60 FPS:
   * - animationSpeed = 1 means 60 FPS
   * - animationSpeed = 0.5 means 30 FPS
   * - animationSpeed = targetFPS / 60
   *
   * @param unitSpeed - Unit's speed attribute
   * @returns PIXI animationSpeed value (0-1 range typically)
   */
  public getPixiAnimationSpeed(unitSpeed: number): number {
    const targetFPS = this.getAnimationFPS(unitSpeed);
    return targetFPS / this.PIXI_FRAME_RATE;
  }

  /**
   * Apply speed scaling to animated sprite
   *
   * Sets the sprite's animationSpeed property to match the unit's movement speed.
   *
   * @param sprite - PIXI.AnimatedSprite to scale
   * @param unitSpeed - Unit's speed attribute
   * @returns The sprite (for chaining)
   *
   * @example
   * ```typescript
   * const scaler = new AnimationSpeedScaler();
   * scaler.applySpeedScaling(walkSprite, unit.stats.speed);
   * ```
   */
  public applySpeedScaling(
    sprite: PIXI.AnimatedSprite | null | undefined,
    unitSpeed: number
  ): PIXI.AnimatedSprite | null | undefined {
    if (!sprite) {
      return sprite; // Handle null/undefined gracefully
    }

    const pixiSpeed = this.getPixiAnimationSpeed(unitSpeed);
    sprite.animationSpeed = pixiSpeed;

    return sprite;
  }

  /**
   * Remove speed scaling from sprite (reset to default)
   *
   * Resets animationSpeed to 1 (default PIXI value).
   *
   * @param sprite - PIXI.AnimatedSprite to reset
   * @returns The sprite (for chaining)
   */
  public removeSpeedScaling(
    sprite: PIXI.AnimatedSprite | null | undefined
  ): PIXI.AnimatedSprite | null | undefined {
    if (!sprite) {
      return sprite;
    }

    sprite.animationSpeed = 1; // Default PIXI value

    return sprite;
  }
}
