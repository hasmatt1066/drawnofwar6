/**
 * TASK-SPAWN-003: Spawn Effect Pool Implementation
 *
 * Object pooling for spawn effect sprites to reduce memory allocations
 * and improve performance during repeated spawn sequences (multi-round matches).
 *
 * Design Pattern: Object Pool (Game Development Best Practice)
 * - Lazy initialization: Start with 0 objects
 * - Acquire/release pattern for sprite reuse
 * - Maximum pool size: Configurable (default 20)
 * - Overflow handling: Reuse oldest active sprite if pool exhausted
 */

import * as PIXI from 'pixi.js';

/**
 * Pool statistics for monitoring and debugging
 */
export interface PoolStats {
  /** Number of sprites available in pool (not currently active) */
  poolSize: number;
  /** Number of sprites currently active (acquired but not released) */
  activeCount: number;
  /** Total number of sprites created since pool initialization */
  totalCreated: number;
}

/**
 * Object pool for PIXI.AnimatedSprite instances used in spawn effects
 *
 * Reduces memory allocations and garbage collection overhead by reusing
 * sprite instances across multiple spawn sequences.
 *
 * @example
 * ```typescript
 * const pool = new SpawnEffectPool(20, () => {
 *   return new PIXI.AnimatedSprite(frames);
 * });
 *
 * // Acquire sprite from pool
 * const sprite = pool.acquire();
 * sprite.position.set(100, 200);
 * sprite.play();
 *
 * // Release back to pool when done
 * pool.release(sprite);
 * ```
 */
export class SpawnEffectPool {
  /** Available sprites in pool (not currently active) */
  private pool: PIXI.AnimatedSprite[] = [];

  /** Currently active sprites (acquired but not released) */
  private active: Map<PIXI.AnimatedSprite, number> = new Map(); // Value is timestamp for oldest tracking

  /** All sprites created by this pool (for cleanup) */
  private allSprites: Set<PIXI.AnimatedSprite> = new Set();

  /** Maximum number of sprites to create */
  private maxSize: number;

  /** Factory function to create new sprites */
  private createSpriteFn: () => PIXI.AnimatedSprite;

  /** Total number of sprites created */
  private totalCreated: number = 0;

  /**
   * Initialize sprite pool
   *
   * @param maxSize - Maximum number of pooled objects (default: 20)
   * @param createSpriteFn - Factory function to create new sprites
   */
  constructor(maxSize: number, createSpriteFn: () => PIXI.AnimatedSprite) {
    this.maxSize = Math.max(0, maxSize); // Ensure non-negative
    this.createSpriteFn = createSpriteFn;
  }

  /**
   * Acquire sprite from pool
   *
   * - If pool has available sprites, reuses one
   * - If pool empty but under maxSize, creates new sprite
   * - If pool exhausted (at maxSize), reuses oldest active sprite
   *
   * @returns Sprite ready for use
   */
  public acquire(): PIXI.AnimatedSprite {
    let sprite: PIXI.AnimatedSprite;

    // Try to get from pool
    if (this.pool.length > 0) {
      sprite = this.pool.pop()!;
    }
    // Create new if under max
    else if (this.allSprites.size < this.maxSize) {
      sprite = this.createSpriteFn();
      this.allSprites.add(sprite);
      this.totalCreated++;
    }
    // Pool exhausted - reuse oldest active
    else {
      sprite = this.getOldestActive();
      if (!sprite) {
        // Fallback: create one even if over limit (shouldn't happen normally)
        sprite = this.createSpriteFn();
        this.allSprites.add(sprite);
        this.totalCreated++;
      } else {
        // Remove from active (will be re-added with new timestamp)
        this.active.delete(sprite);
        // Reset sprite before reuse
        this.resetSprite(sprite);
      }
    }

    // Mark as active with current timestamp
    this.active.set(sprite, Date.now());

    // Ensure sprite is visible
    sprite.visible = true;

    return sprite;
  }

  /**
   * Release sprite back to pool
   *
   * Resets sprite properties and marks it as available for reuse.
   *
   * @param sprite - Sprite to release
   */
  public release(sprite: PIXI.AnimatedSprite | null | undefined): void {
    if (!sprite) return; // Handle null/undefined gracefully

    // Remove from active set
    this.active.delete(sprite);

    // Reset sprite properties
    this.resetSprite(sprite);

    // Hide sprite
    sprite.visible = false;

    // Add back to pool (if it's one of ours)
    if (this.allSprites.has(sprite) && !this.pool.includes(sprite)) {
      this.pool.push(sprite);
    }
  }

  /**
   * Get pool statistics
   *
   * @returns Current pool statistics
   */
  public getStats(): PoolStats {
    return {
      poolSize: this.pool.length,
      activeCount: this.active.size,
      totalCreated: this.totalCreated
    };
  }

  /**
   * Destroy all sprites and clear pool
   *
   * Call this when the pool is no longer needed to free resources.
   */
  public destroy(): void {
    // Destroy all sprites
    for (const sprite of this.allSprites) {
      if (sprite && !sprite.destroyed) {
        sprite.destroy();
      }
    }

    // Clear collections
    this.pool = [];
    this.active.clear();
    this.allSprites.clear();

    // Reset stats
    this.totalCreated = 0;
  }

  /**
   * Reset sprite to default state
   *
   * @param sprite - Sprite to reset
   */
  private resetSprite(sprite: PIXI.AnimatedSprite): void {
    // Reset transform
    sprite.position.set(0, 0);
    sprite.scale.set(1, 1);
    sprite.rotation = 0;
    sprite.alpha = 1;

    // Stop animation if playing
    if (sprite.playing) {
      sprite.stop();
    }

    // Reset to first frame
    if (sprite.textures && sprite.textures.length > 0) {
      sprite.gotoAndStop(0);
    }
  }

  /**
   * Get oldest active sprite for reuse when pool exhausted
   *
   * @returns Oldest active sprite, or undefined if no active sprites
   */
  private getOldestActive(): PIXI.AnimatedSprite | undefined {
    if (this.active.size === 0) return undefined;

    let oldestSprite: PIXI.AnimatedSprite | undefined;
    let oldestTimestamp = Infinity;

    for (const [sprite, timestamp] of this.active.entries()) {
      if (timestamp < oldestTimestamp) {
        oldestTimestamp = timestamp;
        oldestSprite = sprite;
      }
    }

    return oldestSprite;
  }
}
