/**
 * TASK-SPAWN-006: Animation Speed Scaler Tests
 *
 * Test-driven development for animation FPS scaling based on unit speed.
 * Faster units have faster walk animations for visual consistency.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnimationSpeedScaler } from '../animation-speed-scaler';
import * as PIXI from 'pixi.js';

// Mock PIXI.AnimatedSprite
class MockAnimatedSprite {
  public animationSpeed: number = 1;
  public textures: any[] = [];
  public playing: boolean = false;

  public play() {
    this.playing = true;
  }

  public stop() {
    this.playing = false;
  }

  public gotoAndStop(frame: number) {
    // Mock implementation
  }
}

describe('AnimationSpeedScaler', () => {
  let scaler: AnimationSpeedScaler;

  beforeEach(() => {
    scaler = new AnimationSpeedScaler();
  });

  describe('Initialization', () => {
    it('should initialize with default values', () => {
      expect(scaler).toBeDefined();
    });

    it('should have BASE_SPEED of 2', () => {
      // Base speed is 2 (normal speed)
      const normalFPS = scaler.getAnimationFPS(2);
      expect(normalFPS).toBe(8); // BASE_ANIMATION_FPS = 8
    });

    it('should have BASE_ANIMATION_FPS of 8', () => {
      const normalFPS = scaler.getAnimationFPS(2);
      expect(normalFPS).toBe(8);
    });
  });

  describe('getAnimationFPS()', () => {
    it('should return 4 FPS for speed 1 (slow)', () => {
      const fps = scaler.getAnimationFPS(1);
      expect(fps).toBe(4);
    });

    it('should return 8 FPS for speed 2 (normal)', () => {
      const fps = scaler.getAnimationFPS(2);
      expect(fps).toBe(8);
    });

    it('should return 12 FPS for speed 3 (fast)', () => {
      const fps = scaler.getAnimationFPS(3);
      expect(fps).toBe(12);
    });

    it('should scale linearly with speed', () => {
      // Speed 1.5 should be 6 FPS (halfway between 4 and 8)
      const fps = scaler.getAnimationFPS(1.5);
      expect(fps).toBe(6);
    });

    it('should handle speed 0', () => {
      const fps = scaler.getAnimationFPS(0);
      expect(fps).toBe(0);
    });

    it('should handle very high speed', () => {
      const fps = scaler.getAnimationFPS(10);
      expect(fps).toBe(40); // 8 * (10 / 2) = 40
    });

    it('should handle fractional speeds', () => {
      const fps = scaler.getAnimationFPS(2.5);
      expect(fps).toBe(10); // 8 * (2.5 / 2) = 10
    });

    it('should return same result for multiple calls with same speed', () => {
      const fps1 = scaler.getAnimationFPS(2);
      const fps2 = scaler.getAnimationFPS(2);
      expect(fps1).toBe(fps2);
    });
  });

  describe('applySpeedScaling()', () => {
    it('should set animationSpeed on sprite for speed 1', () => {
      const sprite = new MockAnimatedSprite() as unknown as PIXI.AnimatedSprite;

      scaler.applySpeedScaling(sprite, 1);

      // 4 FPS / 60 = 0.0667 (approximately)
      expect(sprite.animationSpeed).toBeCloseTo(0.0667, 4);
    });

    it('should set animationSpeed on sprite for speed 2', () => {
      const sprite = new MockAnimatedSprite() as unknown as PIXI.AnimatedSprite;

      scaler.applySpeedScaling(sprite, 2);

      // 8 FPS / 60 = 0.1333 (approximately)
      expect(sprite.animationSpeed).toBeCloseTo(0.1333, 4);
    });

    it('should set animationSpeed on sprite for speed 3', () => {
      const sprite = new MockAnimatedSprite() as unknown as PIXI.AnimatedSprite;

      scaler.applySpeedScaling(sprite, 3);

      // 12 FPS / 60 = 0.2
      expect(sprite.animationSpeed).toBe(0.2);
    });

    it('should overwrite existing animationSpeed', () => {
      const sprite = new MockAnimatedSprite() as unknown as PIXI.AnimatedSprite;
      sprite.animationSpeed = 0.5;

      scaler.applySpeedScaling(sprite, 2);

      expect(sprite.animationSpeed).toBeCloseTo(0.1333, 4);
    });

    it('should handle speed 0', () => {
      const sprite = new MockAnimatedSprite() as unknown as PIXI.AnimatedSprite;

      scaler.applySpeedScaling(sprite, 0);

      expect(sprite.animationSpeed).toBe(0);
    });

    it('should return the sprite', () => {
      const sprite = new MockAnimatedSprite() as unknown as PIXI.AnimatedSprite;

      const result = scaler.applySpeedScaling(sprite, 2);

      expect(result).toBe(sprite);
    });
  });

  describe('removeSpeedScaling()', () => {
    it('should reset animationSpeed to 1', () => {
      const sprite = new MockAnimatedSprite() as unknown as PIXI.AnimatedSprite;
      sprite.animationSpeed = 0.5;

      scaler.removeSpeedScaling(sprite);

      expect(sprite.animationSpeed).toBe(1);
    });

    it('should work after applySpeedScaling', () => {
      const sprite = new MockAnimatedSprite() as unknown as PIXI.AnimatedSprite;

      scaler.applySpeedScaling(sprite, 3);
      expect(sprite.animationSpeed).toBe(0.2);

      scaler.removeSpeedScaling(sprite);
      expect(sprite.animationSpeed).toBe(1);
    });

    it('should return the sprite', () => {
      const sprite = new MockAnimatedSprite() as unknown as PIXI.AnimatedSprite;

      const result = scaler.removeSpeedScaling(sprite);

      expect(result).toBe(sprite);
    });
  });

  describe('getPixiAnimationSpeed()', () => {
    it('should calculate PIXI animationSpeed for speed 1', () => {
      const pixiSpeed = scaler.getPixiAnimationSpeed(1);
      expect(pixiSpeed).toBeCloseTo(0.0667, 4);
    });

    it('should calculate PIXI animationSpeed for speed 2', () => {
      const pixiSpeed = scaler.getPixiAnimationSpeed(2);
      expect(pixiSpeed).toBeCloseTo(0.1333, 4);
    });

    it('should calculate PIXI animationSpeed for speed 3', () => {
      const pixiSpeed = scaler.getPixiAnimationSpeed(3);
      expect(pixiSpeed).toBe(0.2);
    });

    it('should divide by 60 (PIXI frame rate)', () => {
      const fps = scaler.getAnimationFPS(2); // 8 FPS
      const pixiSpeed = scaler.getPixiAnimationSpeed(2);
      expect(pixiSpeed).toBe(fps / 60);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null sprite gracefully', () => {
      expect(() => scaler.applySpeedScaling(null as any, 2)).not.toThrow();
    });

    it('should handle undefined sprite gracefully', () => {
      expect(() => scaler.applySpeedScaling(undefined as any, 2)).not.toThrow();
    });

    it('should handle negative speed', () => {
      const fps = scaler.getAnimationFPS(-1);
      expect(fps).toBe(-4); // Negative speed = negative FPS
    });

    it('should handle NaN speed', () => {
      const fps = scaler.getAnimationFPS(NaN);
      expect(fps).toBeNaN();
    });

    it('should handle Infinity speed', () => {
      const fps = scaler.getAnimationFPS(Infinity);
      expect(fps).toBe(Infinity);
    });
  });

  describe('Performance', () => {
    it('should handle 1000 FPS calculations efficiently', () => {
      const startTime = performance.now();

      for (let i = 0; i < 1000; i++) {
        scaler.getAnimationFPS(i % 3 + 1); // Speeds 1, 2, 3
      }

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(10); // Should complete in < 10ms
    });

    it('should handle 1000 sprite scalings efficiently', () => {
      const sprites: PIXI.AnimatedSprite[] = [];
      for (let i = 0; i < 1000; i++) {
        sprites.push(new MockAnimatedSprite() as unknown as PIXI.AnimatedSprite);
      }

      const startTime = performance.now();

      for (const sprite of sprites) {
        scaler.applySpeedScaling(sprite, 2);
      }

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(50); // Should complete in < 50ms
    });
  });

  describe('Integration Scenarios', () => {
    it('should support dynamic speed changes', () => {
      const sprite = new MockAnimatedSprite() as unknown as PIXI.AnimatedSprite;

      // Start slow
      scaler.applySpeedScaling(sprite, 1);
      expect(sprite.animationSpeed).toBeCloseTo(0.0667, 4);

      // Speed up
      scaler.applySpeedScaling(sprite, 3);
      expect(sprite.animationSpeed).toBe(0.2);

      // Slow down
      scaler.applySpeedScaling(sprite, 2);
      expect(sprite.animationSpeed).toBeCloseTo(0.1333, 4);
    });

    it('should work with multiple sprites', () => {
      const sprite1 = new MockAnimatedSprite() as unknown as PIXI.AnimatedSprite;
      const sprite2 = new MockAnimatedSprite() as unknown as PIXI.AnimatedSprite;
      const sprite3 = new MockAnimatedSprite() as unknown as PIXI.AnimatedSprite;

      scaler.applySpeedScaling(sprite1, 1);
      scaler.applySpeedScaling(sprite2, 2);
      scaler.applySpeedScaling(sprite3, 3);

      expect(sprite1.animationSpeed).toBeCloseTo(0.0667, 4);
      expect(sprite2.animationSpeed).toBeCloseTo(0.1333, 4);
      expect(sprite3.animationSpeed).toBe(0.2);
    });

    it('should maintain speed scaling across animation state changes', () => {
      const sprite = new MockAnimatedSprite() as unknown as PIXI.AnimatedSprite;

      scaler.applySpeedScaling(sprite, 2);
      const speedBeforePlay = sprite.animationSpeed;

      sprite.play();
      const speedWhilePlaying = sprite.animationSpeed;

      sprite.stop();
      const speedAfterStop = sprite.animationSpeed;

      expect(speedBeforePlay).toBe(speedWhilePlaying);
      expect(speedWhilePlaying).toBe(speedAfterStop);
    });
  });
});
