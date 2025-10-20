/**
 * TASK-VIZ-017: Damage Number Pool Tests
 *
 * Test-driven development for object pooling system.
 * Implements lazy allocation with recycling for damage numbers.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DamageNumberPool } from '../damage-number-pool';
import { DamageNumberRenderer, DamageType } from '../damage-number-renderer';

describe('DamageNumberPool', () => {
  let pool: DamageNumberPool;
  let renderer: DamageNumberRenderer;

  beforeEach(() => {
    renderer = new DamageNumberRenderer();
    pool = new DamageNumberPool(renderer);
  });

  describe('Initialization', () => {
    it('should initialize with empty pool', () => {
      expect(pool).toBeDefined();
      expect(pool.getActiveCount()).toBe(0);
      expect(pool.getPoolSize()).toBe(0);
    });

    it('should accept custom max size', () => {
      const customPool = new DamageNumberPool(renderer, { maxSize: 10 });
      expect(customPool.getMaxSize()).toBe(10);
    });

    it('should use default max size of 20', () => {
      expect(pool.getMaxSize()).toBe(20);
    });
  });

  describe('Lazy Allocation', () => {
    it('should create new object on first acquisition', () => {
      const dmgNumber = pool.acquire(50, DamageType.PHYSICAL, { x: 100, y: 100 });

      expect(dmgNumber).toBeDefined();
      expect(dmgNumber.value).toBe(50);
      expect(dmgNumber.type).toBe(DamageType.PHYSICAL);
      expect(pool.getActiveCount()).toBe(1);
      expect(pool.getPoolSize()).toBe(0);
    });

    it('should create multiple new objects up to max size', () => {
      const objects = [];

      for (let i = 0; i < 5; i++) {
        objects.push(pool.acquire(10, DamageType.PHYSICAL, { x: 100, y: 100 }));
      }

      expect(pool.getActiveCount()).toBe(5);
      expect(pool.getPoolSize()).toBe(0);
    });

    it('should not preallocate any objects', () => {
      const newPool = new DamageNumberPool(renderer);

      expect(newPool.getPoolSize()).toBe(0);
      expect(newPool.getActiveCount()).toBe(0);
    });
  });

  describe('Recycling', () => {
    it('should release object back to pool', () => {
      const dmgNumber = pool.acquire(50, DamageType.PHYSICAL, { x: 100, y: 100 });

      pool.release(dmgNumber);

      expect(pool.getActiveCount()).toBe(0);
      expect(pool.getPoolSize()).toBe(1);
    });

    it('should hide released object', () => {
      const dmgNumber = pool.acquire(50, DamageType.PHYSICAL, { x: 100, y: 100 });

      pool.release(dmgNumber);

      expect(dmgNumber.container.visible).toBe(false);
    });

    it('should reuse pooled object on next acquisition', () => {
      const first = pool.acquire(50, DamageType.PHYSICAL, { x: 100, y: 100 });
      pool.release(first);

      const second = pool.acquire(30, DamageType.MAGICAL, { x: 200, y: 200 });

      expect(second).toBe(first); // Same object instance
      expect(second.value).toBe(30); // Updated value
      expect(second.type).toBe(DamageType.MAGICAL); // Updated type
      expect(second.container.visible).toBe(true); // Made visible again
      expect(pool.getActiveCount()).toBe(1);
      expect(pool.getPoolSize()).toBe(0);
    });

    it('should handle multiple release-acquire cycles', () => {
      const objects = [];

      // Acquire 3 objects
      for (let i = 0; i < 3; i++) {
        objects.push(pool.acquire(10, DamageType.PHYSICAL, { x: 100, y: 100 }));
      }

      // Release all
      objects.forEach(obj => pool.release(obj));

      expect(pool.getActiveCount()).toBe(0);
      expect(pool.getPoolSize()).toBe(3);

      // Acquire again - should reuse
      const reused1 = pool.acquire(20, DamageType.HEAL, { x: 100, y: 100 });
      const reused2 = pool.acquire(30, DamageType.HEAL, { x: 100, y: 100 });

      expect(objects).toContain(reused1);
      expect(objects).toContain(reused2);
      expect(pool.getActiveCount()).toBe(2);
      expect(pool.getPoolSize()).toBe(1);
    });
  });

  describe('Pool Exhaustion', () => {
    it('should create up to max size', () => {
      const smallPool = new DamageNumberPool(renderer, { maxSize: 3 });

      const obj1 = smallPool.acquire(10, DamageType.PHYSICAL, { x: 100, y: 100 });
      const obj2 = smallPool.acquire(20, DamageType.PHYSICAL, { x: 100, y: 100 });
      const obj3 = smallPool.acquire(30, DamageType.PHYSICAL, { x: 100, y: 100 });

      expect(smallPool.getActiveCount()).toBe(3);
    });

    it('should reuse oldest active when pool exhausted', () => {
      const smallPool = new DamageNumberPool(renderer, { maxSize: 2 });

      const first = smallPool.acquire(10, DamageType.PHYSICAL, { x: 100, y: 100 });
      const second = smallPool.acquire(20, DamageType.PHYSICAL, { x: 100, y: 100 });

      // Pool is now full (2/2 active, 0 pooled)
      // Next acquisition should recycle oldest (first)
      const third = smallPool.acquire(30, DamageType.MAGICAL, { x: 100, y: 100 });

      expect(third).toBe(first); // Recycled oldest
      expect(third.value).toBe(30);
      expect(third.type).toBe(DamageType.MAGICAL);
      expect(smallPool.getActiveCount()).toBe(2); // Still 2 active
    });

    it('should track oldest by start time', () => {
      const smallPool = new DamageNumberPool(renderer, { maxSize: 2 });

      const first = smallPool.acquire(10, DamageType.PHYSICAL, { x: 100, y: 100 });
      const firstStartTime = first.startTime;

      // Wait a bit
      const second = smallPool.acquire(20, DamageType.PHYSICAL, { x: 100, y: 100 });

      expect(second.startTime).toBeGreaterThan(firstStartTime);

      // Acquire third - should recycle first (oldest)
      const third = smallPool.acquire(30, DamageType.MAGICAL, { x: 100, y: 100 });

      expect(third).toBe(first);
    });
  });

  describe('Object Reset', () => {
    it('should reset damage number properties on reuse', () => {
      const dmgNumber = pool.acquire(50, DamageType.PHYSICAL, { x: 100, y: 100 });

      // Modify properties
      dmgNumber.container.x = 200;
      dmgNumber.container.y = 200;
      dmgNumber.container.alpha = 0.5;

      pool.release(dmgNumber);

      const reused = pool.acquire(75, DamageType.CRITICAL, { x: 300, y: 400 });

      expect(reused).toBe(dmgNumber);
      expect(reused.value).toBe(75);
      expect(reused.type).toBe(DamageType.CRITICAL);
      expect(reused.container.x).toBe(300);
      expect(reused.container.y).toBe(400);
      expect(reused.container.alpha).toBe(1.0);
      expect(reused.container.visible).toBe(true);
      expect(reused.isComplete).toBe(false);
    });

    it('should update text content on reuse', () => {
      const dmgNumber = pool.acquire(50, DamageType.PHYSICAL, { x: 100, y: 100 });
      expect(dmgNumber.text.text).toBe('50');

      pool.release(dmgNumber);

      const reused = pool.acquire(100, DamageType.PHYSICAL, { x: 100, y: 100 });
      expect(reused.text.text).toBe('100');
    });

    it('should update text color on type change', () => {
      const dmgNumber = pool.acquire(50, DamageType.PHYSICAL, { x: 100, y: 100 });
      const physicalColor = dmgNumber.text.style.fill;

      pool.release(dmgNumber);

      const reused = pool.acquire(50, DamageType.HEAL, { x: 100, y: 100 });
      const healColor = reused.text.style.fill;

      expect(healColor).not.toBe(physicalColor);
    });
  });

  describe('Statistics', () => {
    it('should track total acquisitions', () => {
      pool.acquire(10, DamageType.PHYSICAL, { x: 100, y: 100 });
      pool.acquire(20, DamageType.PHYSICAL, { x: 100, y: 100 });

      const stats = pool.getStatistics();

      expect(stats.totalAcquisitions).toBe(2);
    });

    it('should track reuse count', () => {
      const dmgNumber = pool.acquire(10, DamageType.PHYSICAL, { x: 100, y: 100 });
      pool.release(dmgNumber);

      pool.acquire(20, DamageType.PHYSICAL, { x: 100, y: 100 });

      const stats = pool.getStatistics();

      expect(stats.reuseCount).toBe(1);
    });

    it('should track recycle count (overflow)', () => {
      const smallPool = new DamageNumberPool(renderer, { maxSize: 1 });

      smallPool.acquire(10, DamageType.PHYSICAL, { x: 100, y: 100 });
      smallPool.acquire(20, DamageType.PHYSICAL, { x: 100, y: 100 }); // Triggers recycle

      const stats = smallPool.getStatistics();

      expect(stats.recycleCount).toBe(1);
    });
  });

  describe('Performance', () => {
    it('should handle rapid acquire-release cycles efficiently', () => {
      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        const dmgNumber = pool.acquire(10, DamageType.PHYSICAL, { x: 100, y: 100 });
        pool.release(dmgNumber);
      }

      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(50); // Should complete in < 50ms
      expect(pool.getPoolSize()).toBe(1); // Only 1 object created due to reuse
    });

    it('should maintain max size constraint under load', () => {
      const smallPool = new DamageNumberPool(renderer, { maxSize: 5 });

      const objects = [];
      for (let i = 0; i < 20; i++) {
        objects.push(smallPool.acquire(10, DamageType.PHYSICAL, { x: 100, y: 100 }));
      }

      expect(smallPool.getActiveCount()).toBe(5); // Never exceeds max
      expect(objects).toHaveLength(20);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero max size gracefully', () => {
      const zeroPool = new DamageNumberPool(renderer, { maxSize: 0 });

      const dmgNumber = zeroPool.acquire(10, DamageType.PHYSICAL, { x: 100, y: 100 });

      expect(dmgNumber).toBeDefined();
      expect(zeroPool.getActiveCount()).toBe(1); // Still needs to return usable object
    });

    it('should handle releasing same object twice', () => {
      const dmgNumber = pool.acquire(10, DamageType.PHYSICAL, { x: 100, y: 100 });

      pool.release(dmgNumber);
      pool.release(dmgNumber); // Release again

      expect(pool.getPoolSize()).toBe(1); // Should not duplicate in pool
    });

    it('should handle different damage types', () => {
      const types = [
        DamageType.PHYSICAL,
        DamageType.MAGICAL,
        DamageType.TRUE,
        DamageType.HEAL,
        DamageType.CRITICAL
      ];

      types.forEach(type => {
        const dmgNumber = pool.acquire(50, type, { x: 100, y: 100 });
        expect(dmgNumber.type).toBe(type);
        pool.release(dmgNumber);
      });
    });
  });

  describe('Cleanup', () => {
    it('should provide destroy method', () => {
      pool.acquire(10, DamageType.PHYSICAL, { x: 100, y: 100 });
      pool.acquire(20, DamageType.PHYSICAL, { x: 100, y: 100 });

      pool.destroy();

      expect(pool.getActiveCount()).toBe(0);
      expect(pool.getPoolSize()).toBe(0);
    });

    it('should destroy all objects on cleanup', () => {
      const dmgNumber1 = pool.acquire(10, DamageType.PHYSICAL, { x: 100, y: 100 });
      const dmgNumber2 = pool.acquire(20, DamageType.PHYSICAL, { x: 100, y: 100 });

      pool.release(dmgNumber1);

      pool.destroy();

      expect(dmgNumber1.container.destroyed).toBe(true);
      expect(dmgNumber2.container.destroyed).toBe(true);
    });
  });
});
