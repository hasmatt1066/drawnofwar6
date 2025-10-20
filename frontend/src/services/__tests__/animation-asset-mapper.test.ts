/**
 * TASK-COMBAT-VIZ-008: Animation Asset Mapper Tests
 *
 * Test-driven development for mapping combat states to animation assets.
 * Maps AnimationState → sprite frames, frame durations, and blend modes.
 */

import { describe, it, expect } from 'vitest';
import { AnimationAssetMapper, AnimationData, EffectAnimationData } from '../animation-asset-mapper';
import { AnimationState } from '../unit-animation-state-machine';
import type { CombatCreature } from '@drawn-of-war/shared/types/combat';

describe('AnimationAssetMapper', () => {
  let mapper: AnimationAssetMapper;

  const createMockCreature = (creatureId: string): CombatCreature => ({
    unitId: 'unit-1',
    creatureId,
    ownerId: 'player1',
    position: { q: 0, r: 0 },
    health: 100,
    maxHealth: 100,
    status: 'alive',
    facingDirection: 0,
    attackCooldownRemaining: 0,
    stats: {
      movementSpeed: 2,
      attackRange: 1,
      attackDamage: 10,
      armor: 5,
      attackSpeed: 1.0,
      damageType: 'physical',
      archetype: 'tank'
    },
    activeBuffs: [],
    activeDebuffs: [],
    abilities: []
  });

  beforeEach(() => {
    mapper = new AnimationAssetMapper();
  });

  describe('Idle Animation', () => {
    it('should return idle animation frames for IDLE state', () => {
      const creature = createMockCreature('creature-1');
      const animation = mapper.getAnimation(AnimationState.IDLE, creature, 1); // Direction E

      expect(animation).toBeDefined();
      expect(animation.frames).toBeDefined();
      expect(animation.frames.length).toBeGreaterThan(0);
      expect(animation.loop).toBe(true);
      expect(animation.frameDuration).toBeGreaterThan(0);
    });

    it('should support all 6 directions for idle', () => {
      const creature = createMockCreature('creature-1');
      const directions = [0, 1, 2, 3, 4, 5]; // NE, E, SE, SW, W, NW

      directions.forEach(dir => {
        const animation = mapper.getAnimation(AnimationState.IDLE, creature, dir);
        expect(animation.frames.length).toBeGreaterThan(0);
      });
    });

    it('should set appropriate frame duration for idle (slow breathing)', () => {
      const creature = createMockCreature('creature-1');
      const animation = mapper.getAnimation(AnimationState.IDLE, creature, 1);

      // Idle should be slow (600-1000ms per frame for subtle breathing)
      expect(animation.frameDuration).toBeGreaterThanOrEqual(600);
      expect(animation.frameDuration).toBeLessThanOrEqual(1000);
    });
  });

  describe('Walk Animation', () => {
    it('should return walk animation frames for WALK state', () => {
      const creature = createMockCreature('creature-1');
      const animation = mapper.getAnimation(AnimationState.WALK, creature, 1);

      expect(animation.frames).toBeDefined();
      expect(animation.frames.length).toBeGreaterThan(0);
      expect(animation.loop).toBe(true);
    });

    it('should set faster frame duration for walk than idle', () => {
      const creature = createMockCreature('creature-1');
      const idleAnim = mapper.getAnimation(AnimationState.IDLE, creature, 1);
      const walkAnim = mapper.getAnimation(AnimationState.WALK, creature, 1);

      expect(walkAnim.frameDuration).toBeLessThan(idleAnim.frameDuration);
    });

    it('should have different frames for walk vs idle', () => {
      const creature = createMockCreature('creature-1');
      const idleAnim = mapper.getAnimation(AnimationState.IDLE, creature, 1);
      const walkAnim = mapper.getAnimation(AnimationState.WALK, creature, 1);

      expect(walkAnim.frames[0]).not.toBe(idleAnim.frames[0]);
    });
  });

  describe('Attack Animation', () => {
    it('should return attack animation for ATTACK state', () => {
      const creature = createMockCreature('creature-1');
      const animation = mapper.getAnimation(AnimationState.ATTACK, creature, 1);

      expect(animation.frames).toBeDefined();
      expect(animation.frames.length).toBeGreaterThan(0);
      expect(animation.loop).toBe(false); // Attack should not loop
    });

    it('should have fast frame duration for attack', () => {
      const creature = createMockCreature('creature-1');
      const animation = mapper.getAnimation(AnimationState.ATTACK, creature, 1);

      // Attack should be fast (100-200ms per frame)
      expect(animation.frameDuration).toBeGreaterThanOrEqual(100);
      expect(animation.frameDuration).toBeLessThanOrEqual(200);
    });
  });

  describe('Cast Animation', () => {
    it('should return cast animation for CAST state', () => {
      const creature = createMockCreature('creature-1');
      const animation = mapper.getAnimation(AnimationState.CAST, creature, 1);

      expect(animation.frames).toBeDefined();
      expect(animation.frames.length).toBeGreaterThan(0);
      expect(animation.loop).toBe(false); // Cast should not loop
    });
  });

  describe('Death Animation', () => {
    it('should return death animation for DEATH state', () => {
      const creature = createMockCreature('creature-1');
      const animation = mapper.getAnimation(AnimationState.DEATH, creature, 1);

      expect(animation.frames).toBeDefined();
      expect(animation.frames.length).toBeGreaterThan(0);
      expect(animation.loop).toBe(false); // Death should not loop
    });

    it('should have slow frame duration for death (dramatic)', () => {
      const creature = createMockCreature('creature-1');
      const animation = mapper.getAnimation(AnimationState.DEATH, creature, 1);

      // Death should be slow/dramatic (200-400ms per frame)
      expect(animation.frameDuration).toBeGreaterThanOrEqual(200);
      expect(animation.frameDuration).toBeLessThanOrEqual(400);
    });
  });

  describe('Direction Mapping', () => {
    it('should return mirrored flag for western directions', () => {
      const creature = createMockCreature('creature-1');

      // Eastern directions should not mirror
      expect(mapper.getAnimation(AnimationState.IDLE, creature, 0).shouldMirror).toBe(false); // NE
      expect(mapper.getAnimation(AnimationState.IDLE, creature, 1).shouldMirror).toBe(false); // E
      expect(mapper.getAnimation(AnimationState.IDLE, creature, 2).shouldMirror).toBe(false); // SE

      // Western directions should mirror
      expect(mapper.getAnimation(AnimationState.IDLE, creature, 3).shouldMirror).toBe(true); // SW
      expect(mapper.getAnimation(AnimationState.IDLE, creature, 4).shouldMirror).toBe(true); // W
      expect(mapper.getAnimation(AnimationState.IDLE, creature, 5).shouldMirror).toBe(true); // NW
    });

    it('should map western directions to eastern sprite sets', () => {
      const creature = createMockCreature('creature-1');

      // W should use E frames
      const wAnim = mapper.getAnimation(AnimationState.IDLE, creature, 4); // W
      const eAnim = mapper.getAnimation(AnimationState.IDLE, creature, 1); // E
      expect(wAnim.frames).toEqual(eAnim.frames);
      expect(wAnim.shouldMirror).toBe(true);

      // NW should use NE frames
      const nwAnim = mapper.getAnimation(AnimationState.IDLE, creature, 5); // NW
      const neAnim = mapper.getAnimation(AnimationState.IDLE, creature, 0); // NE
      expect(nwAnim.frames).toEqual(neAnim.frames);
      expect(nwAnim.shouldMirror).toBe(true);
    });
  });

  describe('Library Effect Animations', () => {
    it('should return effect animation data for ability', () => {
      const effect = mapper.getEffectAnimation('fireball');

      expect(effect).toBeDefined();
      expect(effect.frames).toBeDefined();
      expect(effect.frames.length).toBeGreaterThan(0);
      expect(effect.frameDuration).toBeGreaterThan(0);
      expect(effect.blendMode).toBeDefined();
    });

    it('should support different blend modes', () => {
      const fireEffect = mapper.getEffectAnimation('fireball');
      const healEffect = mapper.getEffectAnimation('heal');

      // Fire effects typically use ADD blend mode
      expect(['ADD', 'SCREEN', 'MULTIPLY']).toContain(fireEffect.blendMode);

      // Heal effects might use different blend mode
      expect(['ADD', 'SCREEN', 'MULTIPLY']).toContain(healEffect.blendMode);
    });

    it('should have fast frame duration for effects', () => {
      const effect = mapper.getEffectAnimation('fireball');

      // Effects should be fast (60-120ms per frame)
      expect(effect.frameDuration).toBeGreaterThanOrEqual(60);
      expect(effect.frameDuration).toBeLessThanOrEqual(120);
    });

    it('should not loop effect animations', () => {
      const effect = mapper.getEffectAnimation('fireball');
      expect(effect.loop).toBe(false);
    });
  });

  describe('Fallback Behavior', () => {
    it('should provide fallback animation for unknown creature', () => {
      const creature = createMockCreature('unknown-creature-id');
      const animation = mapper.getAnimation(AnimationState.IDLE, creature, 1);

      expect(animation).toBeDefined();
      expect(animation.frames.length).toBeGreaterThan(0);
    });

    it('should provide fallback for invalid direction', () => {
      const creature = createMockCreature('creature-1');
      const animation = mapper.getAnimation(AnimationState.IDLE, creature, 99);

      expect(animation).toBeDefined();
      expect(animation.frames.length).toBeGreaterThan(0);
    });

    it('should provide fallback for unknown effect', () => {
      const effect = mapper.getEffectAnimation('unknown-effect');

      expect(effect).toBeDefined();
      expect(effect.frames.length).toBeGreaterThan(0);
    });
  });

  describe('Asset Path Construction', () => {
    it('should construct valid asset paths', () => {
      const creature = createMockCreature('creature-1');
      const animation = mapper.getAnimation(AnimationState.IDLE, creature, 1);

      animation.frames.forEach(frame => {
        // Should be valid URL or base64
        expect(
          frame.startsWith('http') ||
          frame.startsWith('/') ||
          frame.startsWith('data:image')
        ).toBe(true);
      });
    });

    it('should construct library effect paths correctly', () => {
      const effect = mapper.getEffectAnimation('fireball');

      effect.frames.forEach(frame => {
        // Library effects should be at /assets/library-animations/
        expect(frame).toContain('/assets/library-animations/');
      });
    });
  });

  describe('Performance', () => {
    it('should cache animation data for repeated requests', () => {
      const creature = createMockCreature('creature-1');

      // Warm up cache
      mapper.getAnimation(AnimationState.IDLE, creature, 1);

      // Measure repeated calls (should use cache)
      const calls = 100;
      const startTime = performance.now();

      for (let i = 0; i < calls; i++) {
        const result = mapper.getAnimation(AnimationState.IDLE, creature, 1);
        expect(result).toBeDefined();
      }

      const duration = performance.now() - startTime;

      // 100 cached calls should complete in less than 5ms
      expect(duration).toBeLessThan(5);
    });

    it('should handle 100 animation requests efficiently', () => {
      const creature = createMockCreature('creature-1');

      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        mapper.getAnimation(AnimationState.IDLE, creature, i % 6);
      }

      const duration = performance.now() - startTime;

      // Should complete in less than 50ms
      expect(duration).toBeLessThan(50);
    });
  });
});
