/**
 * TASK-COMBAT-VIZ-012: Damage Number Renderer Tests
 *
 * Test-driven development for floating damage numbers above combat units.
 * Displays damage/healing with color coding, animation, and auto-cleanup.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DamageNumberRenderer, DamageType } from '../damage-number-renderer';

describe('DamageNumberRenderer', () => {
  let renderer: DamageNumberRenderer;

  beforeEach(() => {
    renderer = new DamageNumberRenderer();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      expect(renderer).toBeDefined();
      expect(renderer.getConfig().duration).toBe(1000);
      expect(renderer.getConfig().fontSize).toBe(16);
    });

    it('should accept custom configuration', () => {
      const customRenderer = new DamageNumberRenderer({
        duration: 1500,
        fontSize: 20,
        floatDistance: 50
      });

      expect(customRenderer.getConfig().duration).toBe(1500);
      expect(customRenderer.getConfig().fontSize).toBe(20);
      expect(customRenderer.getConfig().floatDistance).toBe(50);
    });
  });

  describe('Damage Number Creation', () => {
    it('should create damage number for physical damage', () => {
      const damageNumber = renderer.createDamageNumber(
        50,
        DamageType.PHYSICAL,
        { x: 100, y: 100 }
      );

      expect(damageNumber).toBeDefined();
      expect(damageNumber.value).toBe(50);
      expect(damageNumber.type).toBe(DamageType.PHYSICAL);
      expect(damageNumber.text.text).toBe('50');
    });

    it('should create damage number for magical damage', () => {
      const damageNumber = renderer.createDamageNumber(
        75,
        DamageType.MAGICAL,
        { x: 100, y: 100 }
      );

      expect(damageNumber.type).toBe(DamageType.MAGICAL);
      expect(damageNumber.text.text).toBe('75');
    });

    it('should create heal number with positive styling', () => {
      const healNumber = renderer.createDamageNumber(
        30,
        DamageType.HEAL,
        { x: 100, y: 100 }
      );

      expect(healNumber.type).toBe(DamageType.HEAL);
      expect(healNumber.text.text).toBe('+30');
    });

    it('should create true damage number', () => {
      const trueDamage = renderer.createDamageNumber(
        100,
        DamageType.TRUE,
        { x: 100, y: 100 }
      );

      expect(trueDamage.type).toBe(DamageType.TRUE);
      expect(trueDamage.text.text).toBe('100');
    });

    it('should position damage number at specified coordinates', () => {
      const damageNumber = renderer.createDamageNumber(
        50,
        DamageType.PHYSICAL,
        { x: 200, y: 150 }
      );

      expect(damageNumber.container.x).toBe(200);
      expect(damageNumber.container.y).toBe(150);
    });
  });

  describe('Color Coding', () => {
    it('should use red color for physical damage', () => {
      expect(renderer.getColor(DamageType.PHYSICAL)).toBe(0xff4444);
    });

    it('should use purple color for magical damage', () => {
      expect(renderer.getColor(DamageType.MAGICAL)).toBe(0xaa44ff);
    });

    it('should use green color for healing', () => {
      expect(renderer.getColor(DamageType.HEAL)).toBe(0x44ff44);
    });

    it('should use white color for true damage', () => {
      expect(renderer.getColor(DamageType.TRUE)).toBe(0xffffff);
    });

    it('should use orange color for critical hits', () => {
      expect(renderer.getColor(DamageType.CRITICAL)).toBe(0xffaa00);
    });
  });

  describe('Animation', () => {
    it('should initialize animation state', () => {
      const damageNumber = renderer.createDamageNumber(
        50,
        DamageType.PHYSICAL,
        { x: 100, y: 100 }
      );

      expect(damageNumber.startTime).toBeGreaterThan(0);
      expect(damageNumber.isComplete).toBe(false);
    });

    it('should update animation over time', () => {
      const damageNumber = renderer.createDamageNumber(
        50,
        DamageType.PHYSICAL,
        { x: 100, y: 100 }
      );

      const initialY = damageNumber.container.y;

      // Simulate 500ms passing (halfway through animation)
      const currentTime = damageNumber.startTime + 500;
      renderer.updateAnimation(damageNumber, currentTime);

      // Y position should have moved up
      expect(damageNumber.container.y).toBeLessThan(initialY);
      expect(damageNumber.isComplete).toBe(false);
    });

    it('should mark animation as complete after duration', () => {
      const damageNumber = renderer.createDamageNumber(
        50,
        DamageType.PHYSICAL,
        { x: 100, y: 100 }
      );

      // Simulate full duration passing (1000ms default)
      const currentTime = damageNumber.startTime + 1000;
      renderer.updateAnimation(damageNumber, currentTime);

      expect(damageNumber.isComplete).toBe(true);
    });

    it('should fade out opacity during animation', () => {
      const damageNumber = renderer.createDamageNumber(
        50,
        DamageType.PHYSICAL,
        { x: 100, y: 100 }
      );

      const initialAlpha = damageNumber.container.alpha;

      // Simulate 800ms passing (80% through animation, past fadeStart at 60%)
      const currentTime = damageNumber.startTime + 800;
      renderer.updateAnimation(damageNumber, currentTime);

      // Alpha should have decreased
      expect(damageNumber.container.alpha).toBeLessThan(initialAlpha);
    });

    it('should float upward during animation', () => {
      const damageNumber = renderer.createDamageNumber(
        50,
        DamageType.PHYSICAL,
        { x: 100, y: 100 }
      );

      const initialY = damageNumber.container.y;

      const currentTime = damageNumber.startTime + 500;
      renderer.updateAnimation(damageNumber, currentTime);

      expect(damageNumber.container.y).toBeLessThan(initialY);
    });
  });

  describe('Critical Hit Styling', () => {
    it('should scale up critical hit numbers', () => {
      const criticalDamage = renderer.createDamageNumber(
        150,
        DamageType.CRITICAL,
        { x: 100, y: 100 }
      );

      const normalDamage = renderer.createDamageNumber(
        150,
        DamageType.PHYSICAL,
        { x: 100, y: 100 }
      );

      // Critical should be larger
      expect(criticalDamage.text.style.fontSize).toBeGreaterThan(normalDamage.text.style.fontSize);
    });

    it('should use bold font for critical hits', () => {
      const criticalDamage = renderer.createDamageNumber(
        150,
        DamageType.CRITICAL,
        { x: 100, y: 100 }
      );

      expect(criticalDamage.text.style.fontWeight).toBe('bold');
    });
  });

  describe('Batch Updates', () => {
    it('should update multiple damage numbers efficiently', () => {
      const damageNumbers = [];

      for (let i = 0; i < 10; i++) {
        damageNumbers.push(
          renderer.createDamageNumber(
            10 + i,
            DamageType.PHYSICAL,
            { x: 100 + i * 10, y: 100 }
          )
        );
      }

      const startTime = performance.now();

      damageNumbers.forEach(dn => {
        renderer.updateAnimation(dn, 500);
      });

      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(10); // Should update 10 numbers in < 10ms
    });

    it('should filter out completed animations', () => {
      const active = renderer.createDamageNumber(50, DamageType.PHYSICAL, { x: 100, y: 100 });
      const completed = renderer.createDamageNumber(30, DamageType.PHYSICAL, { x: 100, y: 100 });

      // Make completed animation finish
      const completedTime = completed.startTime + 1500;
      renderer.updateAnimation(completed, completedTime);

      const activeNumbers = [active, completed].filter(dn => !dn.isComplete);

      expect(activeNumbers.length).toBe(1);
      expect(activeNumbers[0]).toBe(active);
    });
  });

  describe('Resource Cleanup', () => {
    it('should provide method to destroy damage number', () => {
      const damageNumber = renderer.createDamageNumber(
        50,
        DamageType.PHYSICAL,
        { x: 100, y: 100 }
      );

      renderer.destroyDamageNumber(damageNumber);

      expect(damageNumber.container.destroyed).toBe(true);
      expect(damageNumber.text.destroyed).toBe(true);
    });

    it('should cleanup completed animations automatically', () => {
      const damageNumber = renderer.createDamageNumber(
        50,
        DamageType.PHYSICAL,
        { x: 100, y: 100 }
      );

      const currentTime = damageNumber.startTime + 1500;
      renderer.updateAnimation(damageNumber, currentTime);

      expect(damageNumber.isComplete).toBe(true);
      // In practice, calling code would filter and destroy completed numbers
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero damage', () => {
      const damageNumber = renderer.createDamageNumber(
        0,
        DamageType.PHYSICAL,
        { x: 100, y: 100 }
      );

      expect(damageNumber.text.text).toBe('0');
    });

    it('should handle large damage numbers', () => {
      const damageNumber = renderer.createDamageNumber(
        9999,
        DamageType.CRITICAL,
        { x: 100, y: 100 }
      );

      expect(damageNumber.text.text).toBe('9999');
    });

    it('should handle fractional damage', () => {
      const damageNumber = renderer.createDamageNumber(
        25.5,
        DamageType.MAGICAL,
        { x: 100, y: 100 }
      );

      expect(damageNumber.text.text).toBe('26'); // Should round
    });

    it('should handle negative values for healing', () => {
      const healNumber = renderer.createDamageNumber(
        -30,
        DamageType.HEAL,
        { x: 100, y: 100 }
      );

      expect(healNumber.text.text).toBe('+30'); // Convert to positive with +
    });
  });

  describe('Performance', () => {
    it('should create 50 damage numbers efficiently', () => {
      const startTime = performance.now();

      for (let i = 0; i < 50; i++) {
        renderer.createDamageNumber(
          10 + i,
          DamageType.PHYSICAL,
          { x: 100, y: 100 }
        );
      }

      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(50); // Should create 50 numbers in < 50ms
    });
  });
});
