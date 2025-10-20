/**
 * TASK-COMBAT-VIZ-010: Combat Grid Renderer Tests
 *
 * Test-driven development for combat-specific rendering with animated sprites.
 * Extends DeploymentGridRenderer with combat animations and smooth interpolation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CombatGridRenderer } from '../CombatGridRenderer';
import type { HexGridRendererConfig } from '../../DeploymentGrid/DeploymentGridRenderer';
import type { AnimationData } from '../../../services/animation-asset-mapper';
import { AnimationState } from '../../../services/unit-animation-state-machine';

describe('CombatGridRenderer', () => {
  let renderer: CombatGridRenderer;
  let config: HexGridRendererConfig;

  beforeEach(async () => {
    config = {
      canvasWidth: 800,
      canvasHeight: 600,
      hexGridConfig: {
        width: 10,
        height: 8,
        hexSize: 30,
        projection: 'isometric'
      }
    };

    renderer = new CombatGridRenderer(config);
    await renderer.init();
  });

  afterEach(() => {
    renderer.destroy();
  });

  describe('Initialization', () => {
    it('should extend DeploymentGridRenderer', () => {
      expect(renderer).toBeDefined();
      expect(renderer.getCanvas()).toBeDefined();
    });

    it('should initialize with animation support', () => {
      expect(renderer.supportsAnimations()).toBe(true);
    });
  });

  describe('Animated Sprite Rendering', () => {
    it('should render creature with animated sprite', async () => {
      const animationData: AnimationData = {
        frames: ['/test/frame-0.png', '/test/frame-1.png', '/test/frame-2.png'],
        frameDuration: 100,
        loop: true,
        shouldMirror: false
      };

      await renderer.renderAnimatedCreature(
        { q: 0, r: 0 },
        'test-creature',
        'player1',
        AnimationState.IDLE,
        animationData
      );

      // Verify creature was rendered
      const sprites = renderer.getActiveSprites();
      expect(sprites.size).toBeGreaterThan(0);
    });

    it('should play animation loop for looping animations', async () => {
      const animationData: AnimationData = {
        frames: ['/test/frame-0.png', '/test/frame-1.png'],
        frameDuration: 100,
        loop: true,
        shouldMirror: false
      };

      await renderer.renderAnimatedCreature(
        { q: 0, r: 0 },
        'test-creature',
        'player1',
        AnimationState.IDLE,
        animationData
      );

      const sprite = renderer.getSpriteAt({ q: 0, r: 0 });
      expect(sprite).toBeDefined();
      expect(sprite?.isPlaying).toBe(true);
    });

    it('should not loop non-looping animations', async () => {
      const animationData: AnimationData = {
        frames: ['/test/frame-0.png', '/test/frame-1.png'],
        frameDuration: 100,
        loop: false,
        shouldMirror: false
      };

      await renderer.renderAnimatedCreature(
        { q: 0, r: 0 },
        'test-creature',
        'player1',
        AnimationState.ATTACK,
        animationData
      );

      const sprite = renderer.getSpriteAt({ q: 0, r: 0 });
      expect(sprite).toBeDefined();
      expect(sprite?.loop).toBe(false);
    });

    it('should apply horizontal mirroring when shouldMirror is true', async () => {
      const animationData: AnimationData = {
        frames: ['/test/frame-0.png'],
        frameDuration: 100,
        loop: true,
        shouldMirror: true
      };

      await renderer.renderAnimatedCreature(
        { q: 0, r: 0 },
        'test-creature',
        'player1',
        AnimationState.WALK,
        animationData
      );

      const sprite = renderer.getSpriteAt({ q: 0, r: 0 });
      expect(sprite).toBeDefined();
      expect(sprite?.scale.x).toBeLessThan(0); // Negative scale = mirrored
    });
  });

  describe('Animation State Transitions', () => {
    it('should update animation when state changes', async () => {
      const idleAnimation: AnimationData = {
        frames: ['/test/idle-0.png'],
        frameDuration: 800,
        loop: true,
        shouldMirror: false
      };

      const walkAnimation: AnimationData = {
        frames: ['/test/walk-0.png', '/test/walk-1.png'],
        frameDuration: 150,
        loop: true,
        shouldMirror: false
      };

      // Render with idle
      await renderer.renderAnimatedCreature(
        { q: 0, r: 0 },
        'test-creature',
        'player1',
        AnimationState.IDLE,
        idleAnimation
      );

      // Update to walk
      await renderer.renderAnimatedCreature(
        { q: 0, r: 0 },
        'test-creature',
        'player1',
        AnimationState.WALK,
        walkAnimation
      );

      const sprite = renderer.getSpriteAt({ q: 0, r: 0 });
      expect(sprite).toBeDefined();
      expect(sprite?.textures.length).toBe(2); // Walk has 2 frames
    });

    it('should handle rapid animation state changes', async () => {
      const animations = [
        {
          state: AnimationState.IDLE,
          data: { frames: ['/test/idle.png'], frameDuration: 800, loop: true, shouldMirror: false }
        },
        {
          state: AnimationState.WALK,
          data: { frames: ['/test/walk.png'], frameDuration: 150, loop: true, shouldMirror: false }
        },
        {
          state: AnimationState.ATTACK,
          data: { frames: ['/test/attack.png'], frameDuration: 120, loop: false, shouldMirror: false }
        }
      ];

      for (const anim of animations) {
        await renderer.renderAnimatedCreature(
          { q: 0, r: 0 },
          'test-creature',
          'player1',
          anim.state,
          anim.data
        );
      }

      // Should not crash and sprite should exist
      const sprite = renderer.getSpriteAt({ q: 0, r: 0 });
      expect(sprite).toBeDefined();
    });
  });

  describe('Animation Completion Callbacks', () => {
    it('should trigger callback when non-looping animation completes', async () => {
      const callback = vi.fn();
      renderer.onAnimationComplete(callback);

      const animationData: AnimationData = {
        frames: ['/test/frame-0.png', '/test/frame-1.png'],
        frameDuration: 10, // Fast for testing
        loop: false,
        shouldMirror: false
      };

      await renderer.renderAnimatedCreature(
        { q: 0, r: 0 },
        'test-creature',
        'player1',
        AnimationState.ATTACK,
        animationData
      );

      // Simulate animation completion
      const sprite = renderer.getSpriteAt({ q: 0, r: 0 });
      sprite?.onComplete?.();

      expect(callback).toHaveBeenCalledWith({
        unitId: expect.any(String),
        animationState: AnimationState.ATTACK
      });
    });

    it('should not trigger callback for looping animations', async () => {
      const callback = vi.fn();
      renderer.onAnimationComplete(callback);

      const animationData: AnimationData = {
        frames: ['/test/frame-0.png'],
        frameDuration: 100,
        loop: true,
        shouldMirror: false
      };

      await renderer.renderAnimatedCreature(
        { q: 0, r: 0 },
        'test-creature',
        'player1',
        AnimationState.IDLE,
        animationData
      );

      // Looping animations don't have onComplete
      const sprite = renderer.getSpriteAt({ q: 0, r: 0 });
      sprite?.onComplete?.();

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Smooth Position Updates', () => {
    it('should smoothly interpolate position changes', async () => {
      const animationData: AnimationData = {
        frames: ['/test/frame.png'],
        frameDuration: 100,
        loop: true,
        shouldMirror: false
      };

      // Initial position
      await renderer.renderAnimatedCreature(
        { q: 0, r: 0 },
        'test-creature',
        'player1',
        AnimationState.WALK,
        animationData
      );

      const sprite1 = renderer.getSpriteAt({ q: 0, r: 0 });
      const initialX = sprite1?.x;

      // Move to new position
      await renderer.renderAnimatedCreature(
        { q: 2, r: 0 },
        'test-creature',
        'player1',
        AnimationState.WALK,
        animationData
      );

      const sprite2 = renderer.getSpriteAt({ q: 2, r: 0 });
      const finalX = sprite2?.x;

      // Position should have changed
      expect(finalX).not.toBe(initialX);
    });
  });

  describe('Performance', () => {
    it('should handle 50 animated creatures efficiently', async () => {
      const animationData: AnimationData = {
        frames: ['/test/frame-0.png', '/test/frame-1.png'],
        frameDuration: 100,
        loop: true,
        shouldMirror: false
      };

      const startTime = performance.now();

      for (let i = 0; i < 50; i++) {
        await renderer.renderAnimatedCreature(
          { q: i % 10, r: Math.floor(i / 10) },
          `creature-${i}`,
          i % 2 === 0 ? 'player1' : 'player2',
          AnimationState.IDLE,
          animationData
        );
      }

      const duration = performance.now() - startTime;

      // Should render 50 creatures in less than 500ms
      expect(duration).toBeLessThan(500);
      expect(renderer.getActiveSprites().size).toBe(50);
    });

    it('should maintain 60 FPS target with animation updates', async () => {
      const animationData: AnimationData = {
        frames: ['/test/frame-0.png', '/test/frame-1.png'],
        frameDuration: 100,
        loop: true,
        shouldMirror: false
      };

      // Render 20 creatures
      for (let i = 0; i < 20; i++) {
        await renderer.renderAnimatedCreature(
          { q: i % 10, r: Math.floor(i / 10) },
          `creature-${i}`,
          'player1',
          AnimationState.WALK,
          animationData
        );
      }

      // Simulate 60 frames (1 second)
      const startTime = performance.now();

      for (let frame = 0; frame < 60; frame++) {
        // Update all sprites (simulating render loop)
        renderer.updateAnimations(16.67); // ~60 FPS
      }

      const duration = performance.now() - startTime;

      // 60 frame updates should take less than 100ms
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Resource Cleanup', () => {
    it('should remove animated sprite when creature is removed', async () => {
      const animationData: AnimationData = {
        frames: ['/test/frame.png'],
        frameDuration: 100,
        loop: true,
        shouldMirror: false
      };

      await renderer.renderAnimatedCreature(
        { q: 0, r: 0 },
        'test-creature',
        'player1',
        AnimationState.IDLE,
        animationData
      );

      expect(renderer.getActiveSprites().size).toBe(1);

      renderer.removeCreature({ q: 0, r: 0 });

      expect(renderer.getActiveSprites().size).toBe(0);
    });

    it('should stop animations when creature is removed', async () => {
      const animationData: AnimationData = {
        frames: ['/test/frame.png'],
        frameDuration: 100,
        loop: true,
        shouldMirror: false
      };

      await renderer.renderAnimatedCreature(
        { q: 0, r: 0 },
        'test-creature',
        'player1',
        AnimationState.IDLE,
        animationData
      );

      const sprite = renderer.getSpriteAt({ q: 0, r: 0 });
      expect(sprite?.isPlaying).toBe(true);

      renderer.removeCreature({ q: 0, r: 0 });

      // Sprite should be destroyed
      expect(renderer.getSpriteAt({ q: 0, r: 0 })).toBeUndefined();
    });

    it('should clear all animated sprites', async () => {
      const animationData: AnimationData = {
        frames: ['/test/frame.png'],
        frameDuration: 100,
        loop: true,
        shouldMirror: false
      };

      for (let i = 0; i < 5; i++) {
        await renderer.renderAnimatedCreature(
          { q: i, r: 0 },
          `creature-${i}`,
          'player1',
          AnimationState.IDLE,
          animationData
        );
      }

      expect(renderer.getActiveSprites().size).toBe(5);

      renderer.clearAllCreatures();

      expect(renderer.getActiveSprites().size).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing animation frames gracefully', async () => {
      const animationData: AnimationData = {
        frames: [], // Empty frames
        frameDuration: 100,
        loop: true,
        shouldMirror: false
      };

      await expect(async () => {
        await renderer.renderAnimatedCreature(
          { q: 0, r: 0 },
          'test-creature',
          'player1',
          AnimationState.IDLE,
          animationData
        );
      }).rejects.toThrow();
    });

    it('should handle invalid hex coordinates gracefully', async () => {
      const animationData: AnimationData = {
        frames: ['/test/frame.png'],
        frameDuration: 100,
        loop: true,
        shouldMirror: false
      };

      await expect(async () => {
        await renderer.renderAnimatedCreature(
          { q: -1, r: -1 }, // Invalid coordinates
          'test-creature',
          'player1',
          AnimationState.IDLE,
          animationData
        );
      }).rejects.toThrow();
    });
  });
});
