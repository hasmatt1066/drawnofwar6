/**
 * TASK-SPAWN-003: SpawnEffectPool Tests
 *
 * Object pooling for spawn effect sprites to reduce memory allocations
 * and improve performance during repeated spawn sequences.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SpawnEffectPool } from '../spawn-effect-pool';
import * as PIXI from 'pixi.js';

// Mock PIXI.AnimatedSprite
class MockAnimatedSprite {
  public visible: boolean = true;
  public position = {
    x: 0,
    y: 0,
    set: function(x: number, y: number) {
      this.x = x;
      this.y = y;
    }
  };
  public scale = {
    x: 1,
    y: 1,
    set: function(x: number, y: number) {
      this.x = x;
      this.y = y;
    }
  };
  public alpha = 1;
  public rotation = 0;
  public destroyed = false;
  public playing = false;
  public textures: any[] = [];

  public destroy() {
    this.destroyed = true;
  }

  public stop() {
    this.playing = false;
  }

  public gotoAndStop(frame: number) {
    // Mock implementation
  }
}

describe('SpawnEffectPool', () => {
  let createSpriteFn: () => PIXI.AnimatedSprite;
  let createdSprites: MockAnimatedSprite[];

  beforeEach(() => {
    createdSprites = [];
    createSpriteFn = vi.fn(() => {
      const sprite = new MockAnimatedSprite() as unknown as PIXI.AnimatedSprite;
      createdSprites.push(sprite as unknown as MockAnimatedSprite);
      return sprite;
    });
  });

  describe('Initialization', () => {
    it('should start with empty pool', () => {
      const pool = new SpawnEffectPool(20, createSpriteFn);
      const stats = pool.getStats();

      expect(stats.poolSize).toBe(0);
      expect(stats.activeCount).toBe(0);
      expect(stats.totalCreated).toBe(0);
    });

    it('should store maxSize', () => {
      const pool = new SpawnEffectPool(10, createSpriteFn);

      // maxSize should limit creation
      expect(pool).toBeDefined();
    });

    it('should store createSpriteFn', () => {
      const pool = new SpawnEffectPool(20, createSpriteFn);

      // First acquire should call createSpriteFn
      pool.acquire();

      expect(createSpriteFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('acquire()', () => {
    it('should create new sprite on first acquire', () => {
      const pool = new SpawnEffectPool(20, createSpriteFn);

      const sprite = pool.acquire();

      expect(sprite).toBeDefined();
      expect(createSpriteFn).toHaveBeenCalledTimes(1);
    });

    it('should reuse released sprite', () => {
      const pool = new SpawnEffectPool(20, createSpriteFn);

      const sprite1 = pool.acquire();
      pool.release(sprite1);
      const sprite2 = pool.acquire();

      expect(sprite2).toBe(sprite1);
      expect(createSpriteFn).toHaveBeenCalledTimes(1); // Only created once
    });

    it('should create up to maxSize sprites', () => {
      const pool = new SpawnEffectPool(5, createSpriteFn);

      const sprites: PIXI.AnimatedSprite[] = [];
      for (let i = 0; i < 5; i++) {
        sprites.push(pool.acquire());
      }

      expect(createSpriteFn).toHaveBeenCalledTimes(5);
      expect(pool.getStats().totalCreated).toBe(5);
    });

    it('should reuse oldest active sprite when pool exhausted', () => {
      const pool = new SpawnEffectPool(3, createSpriteFn);

      const sprite1 = pool.acquire(); // Oldest
      const sprite2 = pool.acquire();
      const sprite3 = pool.acquire();

      // Pool exhausted (3/3 active), should reuse oldest (sprite1)
      const sprite4 = pool.acquire();

      expect(sprite4).toBe(sprite1); // Reused oldest
      expect(createSpriteFn).toHaveBeenCalledTimes(3); // No new creation
    });

    it('should increment totalCreated counter', () => {
      const pool = new SpawnEffectPool(20, createSpriteFn);

      pool.acquire();
      pool.acquire();
      pool.acquire();

      expect(pool.getStats().totalCreated).toBe(3);
    });

    it('should mark sprite as visible when acquired', () => {
      const pool = new SpawnEffectPool(20, createSpriteFn);

      const sprite = pool.acquire() as unknown as MockAnimatedSprite;

      expect(sprite.visible).toBe(true);
    });
  });

  describe('release()', () => {
    it('should reset sprite properties', () => {
      const pool = new SpawnEffectPool(20, createSpriteFn);
      const sprite = pool.acquire() as unknown as MockAnimatedSprite;

      // Modify sprite
      sprite.position.x = 100;
      sprite.position.y = 200;
      sprite.scale.x = 2;
      sprite.scale.y = 2;
      sprite.alpha = 0.5;
      sprite.rotation = Math.PI / 2;

      pool.release(sprite as unknown as PIXI.AnimatedSprite);

      // Properties should be reset
      expect(sprite.position.x).toBe(0);
      expect(sprite.position.y).toBe(0);
      expect(sprite.scale.x).toBe(1);
      expect(sprite.scale.y).toBe(1);
      expect(sprite.alpha).toBe(1);
      expect(sprite.rotation).toBe(0);
    });

    it('should hide sprite (visible = false)', () => {
      const pool = new SpawnEffectPool(20, createSpriteFn);
      const sprite = pool.acquire() as unknown as MockAnimatedSprite;

      pool.release(sprite as unknown as PIXI.AnimatedSprite);

      expect(sprite.visible).toBe(false);
    });

    it('should add sprite back to pool', () => {
      const pool = new SpawnEffectPool(20, createSpriteFn);
      const sprite1 = pool.acquire();

      pool.release(sprite1);
      const sprite2 = pool.acquire();

      expect(sprite2).toBe(sprite1); // Reused from pool
      expect(createSpriteFn).toHaveBeenCalledTimes(1); // Only created once
    });

    it('should decrement active count', () => {
      const pool = new SpawnEffectPool(20, createSpriteFn);
      pool.acquire();
      pool.acquire();
      const sprite3 = pool.acquire();

      expect(pool.getStats().activeCount).toBe(3);

      pool.release(sprite3);

      expect(pool.getStats().activeCount).toBe(2);
    });

    it('should handle releasing same sprite multiple times gracefully', () => {
      const pool = new SpawnEffectPool(20, createSpriteFn);
      const sprite = pool.acquire();

      pool.release(sprite);
      pool.release(sprite); // Release again

      // Should not crash or cause errors
      expect(pool.getStats().poolSize).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getStats()', () => {
    it('should return accurate poolSize', () => {
      const pool = new SpawnEffectPool(20, createSpriteFn);

      const sprite1 = pool.acquire();
      const sprite2 = pool.acquire();
      pool.release(sprite1);
      pool.release(sprite2);

      expect(pool.getStats().poolSize).toBe(2); // Both released
    });

    it('should return accurate activeCount', () => {
      const pool = new SpawnEffectPool(20, createSpriteFn);

      pool.acquire();
      pool.acquire();
      const sprite3 = pool.acquire();

      expect(pool.getStats().activeCount).toBe(3);

      pool.release(sprite3);

      expect(pool.getStats().activeCount).toBe(2);
    });

    it('should return accurate totalCreated', () => {
      const pool = new SpawnEffectPool(20, createSpriteFn);

      for (let i = 0; i < 10; i++) {
        pool.acquire();
      }

      expect(pool.getStats().totalCreated).toBe(10);
    });

    it('should update stats after acquire/release cycles', () => {
      const pool = new SpawnEffectPool(20, createSpriteFn);

      const sprite1 = pool.acquire();
      const sprite2 = pool.acquire();

      expect(pool.getStats().activeCount).toBe(2);
      expect(pool.getStats().poolSize).toBe(0);

      pool.release(sprite1);

      expect(pool.getStats().activeCount).toBe(1);
      expect(pool.getStats().poolSize).toBe(1);

      pool.release(sprite2);

      expect(pool.getStats().activeCount).toBe(0);
      expect(pool.getStats().poolSize).toBe(2);
    });
  });

  describe('destroy()', () => {
    it('should destroy all sprites', () => {
      const pool = new SpawnEffectPool(20, createSpriteFn);

      pool.acquire();
      pool.acquire();
      pool.acquire();

      pool.destroy();

      // All created sprites should be destroyed
      for (const sprite of createdSprites) {
        expect(sprite.destroyed).toBe(true);
      }
    });

    it('should clear pool', () => {
      const pool = new SpawnEffectPool(20, createSpriteFn);

      const sprite1 = pool.acquire();
      const sprite2 = pool.acquire();
      pool.release(sprite1);
      pool.release(sprite2);

      pool.destroy();

      expect(pool.getStats().poolSize).toBe(0);
    });

    it('should reset stats', () => {
      const pool = new SpawnEffectPool(20, createSpriteFn);

      pool.acquire();
      pool.acquire();

      pool.destroy();

      const stats = pool.getStats();
      expect(stats.poolSize).toBe(0);
      expect(stats.activeCount).toBe(0);
      expect(stats.totalCreated).toBe(0);
    });

    it('should handle destroy with active sprites', () => {
      const pool = new SpawnEffectPool(20, createSpriteFn);

      pool.acquire(); // Active, not released
      pool.acquire();

      expect(() => pool.destroy()).not.toThrow();
    });
  });

  describe('Performance', () => {
    it('should handle 100 acquire/release cycles efficiently', () => {
      const pool = new SpawnEffectPool(20, createSpriteFn);

      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        const sprite = pool.acquire();
        pool.release(sprite);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete in < 100ms (very fast)
      expect(duration).toBeLessThan(100);

      // Should have created at most 20 sprites (maxSize)
      expect(pool.getStats().totalCreated).toBeLessThanOrEqual(20);
    });

    it('should reuse sprites efficiently', () => {
      const pool = new SpawnEffectPool(5, createSpriteFn);

      // Acquire and release 50 times
      for (let i = 0; i < 50; i++) {
        const sprite = pool.acquire();
        pool.release(sprite);
      }

      // Should have only created 1 sprite (reused 49 times)
      // This is efficient: since we release immediately, the pool always has a sprite available
      expect(pool.getStats().totalCreated).toBe(1);
      expect(createSpriteFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle maxSize = 1', () => {
      const pool = new SpawnEffectPool(1, createSpriteFn);

      const sprite1 = pool.acquire();
      const sprite2 = pool.acquire(); // Should reuse sprite1

      expect(sprite2).toBe(sprite1);
      expect(createSpriteFn).toHaveBeenCalledTimes(1);
    });

    it('should handle maxSize = 0 gracefully', () => {
      const pool = new SpawnEffectPool(0, createSpriteFn);

      // Should not create any sprites or should handle gracefully
      expect(() => pool.acquire()).not.toThrow();
    });

    it('should handle releasing sprite not from pool', () => {
      const pool = new SpawnEffectPool(20, createSpriteFn);
      const externalSprite = createSpriteFn();

      // Should handle gracefully
      expect(() => pool.release(externalSprite)).not.toThrow();
    });

    it('should handle null/undefined in release gracefully', () => {
      const pool = new SpawnEffectPool(20, createSpriteFn);

      expect(() => pool.release(null as any)).not.toThrow();
      expect(() => pool.release(undefined as any)).not.toThrow();
    });
  });
});
