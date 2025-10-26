/**
 * TASK-SPAWN-004: Creature Emergence Mask Implementation
 *
 * Alpha masking for bottom-to-top creature reveal during spawn effect.
 * Uses PIXI.Graphics to create a progressive reveal mask.
 *
 * Visual Effect:
 * - Creature appears to emerge from blue liquid (Westworld-style)
 * - Mask reveals sprite from bottom to top over 800-1000ms
 * - Synchronized with spawn effect animation
 */

import * as PIXI from 'pixi.js';

/**
 * CreatureEmergenceMask
 *
 * Manages alpha masking for creature spawn reveal effect.
 * Creates a PIXI.Graphics mask that progressively reveals the sprite from bottom to top.
 *
 * @example
 * ```typescript
 * const mask = new CreatureEmergenceMask(creatureSprite);
 *
 * // Animate reveal (0 = hidden, 1 = fully visible)
 * for (let progress = 0; progress <= 1; progress += 0.01) {
 *   mask.updateMask(progress);
 *   await wait(10); // 1000ms total
 * }
 *
 * // Remove mask when complete
 * mask.removeMask();
 * mask.destroy();
 * ```
 */
export class CreatureEmergenceMask {
  private sprite: PIXI.Sprite | null;
  private maskGraphics: PIXI.Graphics | null;
  private currentProgress: number = 0;
  private spriteWidth: number;
  private spriteHeight: number;
  private spriteX: number;
  private spriteY: number;

  /**
   * Create emergence mask for sprite
   *
   * @param sprite - PIXI.Sprite to apply mask to
   */
  constructor(sprite: PIXI.Sprite) {
    if (!sprite) {
      this.sprite = null;
      this.maskGraphics = null;
      this.spriteWidth = 0;
      this.spriteHeight = 0;
      this.spriteX = 0;
      this.spriteY = 0;
      return;
    }

    this.sprite = sprite;
    this.spriteWidth = sprite.width;
    this.spriteHeight = sprite.height;
    this.spriteX = sprite.x;
    this.spriteY = sprite.y;

    // Create mask graphics
    this.maskGraphics = new PIXI.Graphics();
    this.maskGraphics.x = this.spriteX;
    this.maskGraphics.y = this.spriteY;

    // Apply mask to sprite
    this.sprite.mask = this.maskGraphics;

    // Initialize with 0% reveal
    this.updateMask(0);
  }

  /**
   * Update mask reveal progress
   *
   * @param progress - Reveal progress (0 = hidden, 1 = fully visible)
   *
   * Progress mapping:
   * - 0.0 → Sprite 0% visible (fully masked)
   * - 0.5 → Sprite 50% visible (bottom half revealed)
   * - 1.0 → Sprite 100% visible (fully revealed)
   */
  public updateMask(progress: number): void {
    if (!this.maskGraphics || !this.sprite) {
      return; // Destroyed or invalid
    }

    // Clamp progress to [0, 1]
    const clampedProgress = Math.max(0, Math.min(1, progress));
    this.currentProgress = clampedProgress;

    // Calculate reveal height (bottom to top)
    const revealHeight = this.spriteHeight * clampedProgress;

    // Calculate starting Y position (reveal from bottom)
    const maskY = this.spriteHeight - revealHeight;

    // Clear and redraw mask
    this.maskGraphics.clear();
    this.maskGraphics.beginFill(0xffffff); // White mask (reveals what's underneath)
    this.maskGraphics.drawRect(0, maskY, this.spriteWidth, revealHeight);
    this.maskGraphics.endFill();
  }

  /**
   * Remove mask from sprite (show full sprite)
   */
  public removeMask(): void {
    if (this.sprite) {
      this.sprite.mask = null;
    }
  }

  /**
   * Get current reveal progress
   *
   * @returns Current progress (0-1)
   */
  public getProgress(): number {
    return this.currentProgress;
  }

  /**
   * Destroy mask and cleanup
   */
  public destroy(): void {
    // Remove mask from sprite
    this.removeMask();

    // Destroy graphics
    if (this.maskGraphics && !this.maskGraphics.destroyed) {
      this.maskGraphics.destroy();
    }

    // Clear references
    this.maskGraphics = null;
    this.sprite = null;
  }
}
