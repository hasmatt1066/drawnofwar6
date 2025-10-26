/**
 * TASK-SPAWN-004: Creature Emergence Mask Tests
 *
 * Alpha masking for bottom-to-top creature reveal during spawn effect.
 * Creates a PIXI.Graphics mask that progressively reveals the creature sprite.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreatureEmergenceMask } from '../creature-emergence-mask';
import * as PIXI from 'pixi.js';

// Mock PIXI.Graphics
class MockGraphics {
  public x: number = 0;
  public y: number = 0;
  public width: number = 0;
  public height: number = 0;
  public destroyed: boolean = false;
  private drawRectCalls: any[] = [];
  private clearCalls: number = 0;
  private beginFillCalls: any[] = [];

  public clear() {
    this.clearCalls++;
    this.drawRectCalls = [];
    this.beginFillCalls = [];
    return this;
  }

  public beginFill(color: number) {
    this.beginFillCalls.push({ color });
    return this;
  }

  public drawRect(x: number, y: number, width: number, height: number) {
    this.drawRectCalls.push({ x, y, width, height });
    this.width = width;
    this.height = height;
    return this;
  }

  public endFill() {
    return this;
  }

  public destroy() {
    this.destroyed = true;
  }

  public getDrawRectCalls() {
    return this.drawRectCalls;
  }

  public getClearCalls() {
    return this.clearCalls;
  }

  public getBeginFillCalls() {
    return this.beginFillCalls;
  }
}

// Mock PIXI.Sprite
class MockSprite {
  public mask: any = null;
  public width: number = 100;
  public height: number = 100;
  public x: number = 0;
  public y: number = 0;
}

describe('CreatureEmergenceMask', () => {
  let sprite: MockSprite;
  let mask: CreatureEmergenceMask;

  beforeEach(() => {
    sprite = new MockSprite();
    // Mock PIXI.Graphics constructor
    vi.spyOn(PIXI, 'Graphics').mockImplementation(() => new MockGraphics() as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should create PIXI.Graphics mask', () => {
      mask = new CreatureEmergenceMask(sprite as any);

      expect(PIXI.Graphics).toHaveBeenCalled();
    });

    it('should attach mask to sprite', () => {
      mask = new CreatureEmergenceMask(sprite as any);

      expect(sprite.mask).toBeDefined();
      expect(sprite.mask).not.toBeNull();
    });

    it('should start with 0% reveal (progress = 0)', () => {
      mask = new CreatureEmergenceMask(sprite as any);

      const progress = mask.getProgress();
      expect(progress).toBe(0);
    });

    it('should position mask at sprite origin', () => {
      sprite.x = 50;
      sprite.y = 100;
      mask = new CreatureEmergenceMask(sprite as any);

      const maskGraphics = sprite.mask as MockGraphics;
      expect(maskGraphics.x).toBe(50);
      expect(maskGraphics.y).toBe(100);
    });
  });

  describe('updateMask()', () => {
    beforeEach(() => {
      mask = new CreatureEmergenceMask(sprite as any);
    });

    it('should update mask height based on progress', () => {
      mask.updateMask(0.5); // 50% revealed

      const maskGraphics = sprite.mask as MockGraphics;
      const calls = maskGraphics.getDrawRectCalls();
      expect(calls.length).toBeGreaterThan(0);

      // Last call should have height = sprite.height * 0.5
      const lastCall = calls[calls.length - 1];
      expect(lastCall.height).toBe(50); // 100 * 0.5
    });

    it('should reveal from bottom to top', () => {
      mask.updateMask(0.5);

      const maskGraphics = sprite.mask as MockGraphics;
      const calls = maskGraphics.getDrawRectCalls();
      const lastCall = calls[calls.length - 1];

      // Mask should start from bottom (y = spriteHeight - revealHeight)
      const expectedY = 50; // 100 - (100 * 0.5)
      expect(lastCall.y).toBe(expectedY);
    });

    it('should handle progress = 0 (fully hidden)', () => {
      mask.updateMask(0);

      const maskGraphics = sprite.mask as MockGraphics;
      const calls = maskGraphics.getDrawRectCalls();
      const lastCall = calls[calls.length - 1];

      expect(lastCall.height).toBe(0);
    });

    it('should handle progress = 1 (fully visible)', () => {
      mask.updateMask(1);

      const maskGraphics = sprite.mask as MockGraphics;
      const calls = maskGraphics.getDrawRectCalls();
      const lastCall = calls[calls.length - 1];

      expect(lastCall.height).toBe(100); // Full sprite height
      expect(lastCall.y).toBe(0); // Starts at top
    });

    it('should handle fractional progress smoothly', () => {
      mask.updateMask(0.25);
      const calls1 = (sprite.mask as MockGraphics).getDrawRectCalls();
      const lastCall1 = calls1[calls1.length - 1];
      expect(lastCall1.height).toBe(25);

      mask.updateMask(0.75);
      const calls2 = (sprite.mask as MockGraphics).getDrawRectCalls();
      const lastCall2 = calls2[calls2.length - 1];
      expect(lastCall2.height).toBe(75);
    });

    it('should work with different sprite sizes', () => {
      sprite.width = 200;
      sprite.height = 150;
      mask = new CreatureEmergenceMask(sprite as any);

      mask.updateMask(0.5);

      const maskGraphics = sprite.mask as MockGraphics;
      const calls = maskGraphics.getDrawRectCalls();
      const lastCall = calls[calls.length - 1];

      expect(lastCall.height).toBe(75); // 150 * 0.5
      expect(lastCall.width).toBe(200);
    });

    it('should update stored progress', () => {
      mask.updateMask(0.5);
      expect(mask.getProgress()).toBe(0.5);

      mask.updateMask(0.75);
      expect(mask.getProgress()).toBe(0.75);
    });

    it('should clear graphics before redrawing', () => {
      mask.updateMask(0.5);
      const clearsBefore = (sprite.mask as MockGraphics).getClearCalls();

      mask.updateMask(0.75);
      const clearsAfter = (sprite.mask as MockGraphics).getClearCalls();

      expect(clearsAfter).toBeGreaterThan(clearsBefore);
    });
  });

  describe('removeMask()', () => {
    beforeEach(() => {
      mask = new CreatureEmergenceMask(sprite as any);
      mask.updateMask(0.5);
    });

    it('should remove mask from sprite', () => {
      mask.removeMask();

      expect(sprite.mask).toBeNull();
    });

    it('should show full sprite after removal', () => {
      mask.removeMask();

      // Sprite should be fully visible (no mask)
      expect(sprite.mask).toBeNull();
    });

    it('should allow multiple calls', () => {
      mask.removeMask();
      expect(() => mask.removeMask()).not.toThrow();
    });
  });

  describe('destroy()', () => {
    beforeEach(() => {
      mask = new CreatureEmergenceMask(sprite as any);
    });

    it('should destroy mask graphics', () => {
      const maskGraphics = sprite.mask as MockGraphics;

      mask.destroy();

      expect(maskGraphics.destroyed).toBe(true);
    });

    it('should remove reference to sprite', () => {
      mask.destroy();

      // Sprite mask should be cleared
      expect(sprite.mask).toBeNull();
    });

    it('should handle multiple destroy calls', () => {
      mask.destroy();
      expect(() => mask.destroy()).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      mask = new CreatureEmergenceMask(sprite as any);
    });

    it('should handle updateMask() called after removeMask()', () => {
      mask.removeMask();
      expect(() => mask.updateMask(0.5)).not.toThrow();

      // Mask should not be recreated
      expect(sprite.mask).toBeNull();
    });

    it('should handle progress > 1', () => {
      mask.updateMask(1.5);

      const maskGraphics = sprite.mask as MockGraphics;
      const calls = maskGraphics.getDrawRectCalls();
      const lastCall = calls[calls.length - 1];

      // Should clamp to sprite height
      expect(lastCall.height).toBeLessThanOrEqual(sprite.height);
    });

    it('should handle progress < 0', () => {
      mask.updateMask(-0.5);

      const maskGraphics = sprite.mask as MockGraphics;
      const calls = maskGraphics.getDrawRectCalls();
      const lastCall = calls[calls.length - 1];

      // Should clamp to 0
      expect(lastCall.height).toBeGreaterThanOrEqual(0);
    });

    it('should handle sprite with 0 dimensions', () => {
      sprite.width = 0;
      sprite.height = 0;
      mask = new CreatureEmergenceMask(sprite as any);

      expect(() => mask.updateMask(0.5)).not.toThrow();
    });

    it('should handle null sprite gracefully', () => {
      expect(() => new CreatureEmergenceMask(null as any)).not.toThrow();
    });
  });

  describe('Performance', () => {
    beforeEach(() => {
      mask = new CreatureEmergenceMask(sprite as any);
    });

    it('should handle 100 progress updates efficiently', () => {
      const startTime = performance.now();

      for (let i = 0; i <= 100; i++) {
        mask.updateMask(i / 100);
      }

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(50); // Should complete in < 50ms
    });

    it('should reuse graphics object (not recreate)', () => {
      const maskGraphics = sprite.mask;

      mask.updateMask(0.5);
      mask.updateMask(0.75);
      mask.updateMask(1.0);

      // Should still be same graphics object
      expect(sprite.mask).toBe(maskGraphics);
    });
  });

  describe('Animation Integration', () => {
    beforeEach(() => {
      mask = new CreatureEmergenceMask(sprite as any);
    });

    it('should support smooth 0-1 animation', () => {
      const progressValues = [0, 0.25, 0.5, 0.75, 1.0];

      for (const progress of progressValues) {
        mask.updateMask(progress);
        expect(mask.getProgress()).toBe(progress);
      }
    });

    it('should create consistent reveal pattern', () => {
      mask.updateMask(0.25);
      const calls1 = (sprite.mask as MockGraphics).getDrawRectCalls();
      const height1 = calls1[calls1.length - 1].height;

      mask.updateMask(0.5);
      const calls2 = (sprite.mask as MockGraphics).getDrawRectCalls();
      const height2 = calls2[calls2.length - 1].height;

      // Height should increase linearly
      expect(height2).toBe(height1 * 2);
    });
  });
});
