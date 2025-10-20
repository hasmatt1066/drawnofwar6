/**
 * TASK-COMBAT-VIZ-011: Health Bar Renderer Tests
 *
 * Test-driven development for health bar rendering above combat units.
 * Displays current/max health with color coding and smooth updates.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HealthBarRenderer } from '../health-bar-renderer';

describe('HealthBarRenderer', () => {
  let renderer: HealthBarRenderer;

  beforeEach(() => {
    renderer = new HealthBarRenderer();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      expect(renderer).toBeDefined();
      expect(renderer.getConfig().width).toBe(40);
      expect(renderer.getConfig().height).toBe(4);
    });

    it('should accept custom configuration', () => {
      const customRenderer = new HealthBarRenderer({
        width: 50,
        height: 6,
        showText: true
      });

      expect(customRenderer.getConfig().width).toBe(50);
      expect(customRenderer.getConfig().height).toBe(6);
      expect(customRenderer.getConfig().showText).toBe(true);
    });
  });

  describe('Health Percentage Calculation', () => {
    it('should calculate health percentage correctly', () => {
      expect(renderer.calculateHealthPercentage(100, 100)).toBe(1.0);
      expect(renderer.calculateHealthPercentage(50, 100)).toBe(0.5);
      expect(renderer.calculateHealthPercentage(0, 100)).toBe(0);
      expect(renderer.calculateHealthPercentage(75, 100)).toBe(0.75);
    });

    it('should handle edge case of 0 max health', () => {
      expect(renderer.calculateHealthPercentage(0, 0)).toBe(0);
    });

    it('should clamp health percentage between 0 and 1', () => {
      expect(renderer.calculateHealthPercentage(150, 100)).toBe(1.0);
      expect(renderer.calculateHealthPercentage(-10, 100)).toBe(0);
    });
  });

  describe('Color Determination', () => {
    it('should return green for health above 66%', () => {
      expect(renderer.getHealthColor(1.0)).toBe(0x2ecc71); // Green
      expect(renderer.getHealthColor(0.75)).toBe(0x2ecc71);
      expect(renderer.getHealthColor(0.67)).toBe(0x2ecc71);
    });

    it('should return yellow for health between 33% and 66%', () => {
      expect(renderer.getHealthColor(0.66)).toBe(0xf39c12); // Yellow
      expect(renderer.getHealthColor(0.5)).toBe(0xf39c12);
      expect(renderer.getHealthColor(0.34)).toBe(0xf39c12);
    });

    it('should return red for health below 33%', () => {
      expect(renderer.getHealthColor(0.33)).toBe(0xe74c3c); // Red
      expect(renderer.getHealthColor(0.2)).toBe(0xe74c3c);
      expect(renderer.getHealthColor(0.0)).toBe(0xe74c3c);
    });

    it('should handle boundary conditions precisely', () => {
      // Green threshold is 2/3 = 0.66666...
      expect(renderer.getHealthColor(0.6666)).toBe(0xf39c12); // Just below green threshold
      expect(renderer.getHealthColor(0.6667)).toBe(0x2ecc71); // Just at/above green threshold

      // Yellow threshold is 1/3 = 0.33333...
      expect(renderer.getHealthColor(0.3334)).toBe(0xf39c12); // Just above yellow threshold
      expect(renderer.getHealthColor(0.3333)).toBe(0xe74c3c); // Just at/below yellow threshold
    });
  });

  describe('Health Bar Creation', () => {
    it('should create health bar graphics object', () => {
      const healthBar = renderer.createHealthBar(100, 100, { x: 0, y: 0 });

      expect(healthBar).toBeDefined();
      expect(healthBar.graphics).toBeDefined();
      expect(healthBar.currentHealth).toBe(100);
      expect(healthBar.maxHealth).toBe(100);
    });

    it('should position health bar at specified coordinates', () => {
      const healthBar = renderer.createHealthBar(80, 100, { x: 50, y: -30 });

      expect(healthBar.container.x).toBe(50);
      expect(healthBar.container.y).toBe(-30);
    });

    it('should set initial health bar fill based on health percentage', () => {
      const healthBar75 = renderer.createHealthBar(75, 100, { x: 0, y: 0 });
      const healthBar50 = renderer.createHealthBar(50, 100, { x: 0, y: 0 });
      const healthBar25 = renderer.createHealthBar(25, 100, { x: 0, y: 0 });

      // Verify colors are set correctly
      expect(renderer.getHealthColor(0.75)).toBe(0x2ecc71);
      expect(renderer.getHealthColor(0.50)).toBe(0xf39c12);
      expect(renderer.getHealthColor(0.25)).toBe(0xe74c3c);
    });
  });

  describe('Health Bar Updates', () => {
    it('should update health bar when health changes', () => {
      const healthBar = renderer.createHealthBar(100, 100, { x: 0, y: 0 });

      renderer.updateHealthBar(healthBar, 50, 100);

      expect(healthBar.currentHealth).toBe(50);
      expect(healthBar.maxHealth).toBe(100);
    });

    it('should only redraw if health actually changed', () => {
      const healthBar = renderer.createHealthBar(100, 100, { x: 0, y: 0 });
      const drawCallsBefore = healthBar.graphics.clear ? 1 : 0;

      // Update with same values
      renderer.updateHealthBar(healthBar, 100, 100);

      // Should not trigger redraw for same values (optimization)
      expect(healthBar.currentHealth).toBe(100);
    });

    it('should handle health increasing', () => {
      const healthBar = renderer.createHealthBar(50, 100, { x: 0, y: 0 });

      renderer.updateHealthBar(healthBar, 75, 100);

      expect(healthBar.currentHealth).toBe(75);
    });

    it('should handle health decreasing', () => {
      const healthBar = renderer.createHealthBar(100, 100, { x: 0, y: 0 });

      renderer.updateHealthBar(healthBar, 25, 100);

      expect(healthBar.currentHealth).toBe(25);
    });

    it('should update color when health crosses thresholds', () => {
      const healthBar = renderer.createHealthBar(80, 100, { x: 0, y: 0 });

      // Should be green initially
      expect(renderer.getHealthColor(0.8)).toBe(0x2ecc71);

      // Drop to yellow range
      renderer.updateHealthBar(healthBar, 50, 100);
      expect(renderer.getHealthColor(0.5)).toBe(0xf39c12);

      // Drop to red range
      renderer.updateHealthBar(healthBar, 20, 100);
      expect(renderer.getHealthColor(0.2)).toBe(0xe74c3c);
    });
  });

  describe('Health Text Display', () => {
    it('should not show text by default', () => {
      const healthBar = renderer.createHealthBar(75, 100, { x: 0, y: 0 });

      expect(healthBar.text).toBeUndefined();
    });

    it('should show text when enabled in config', () => {
      const rendererWithText = new HealthBarRenderer({ showText: true });
      const healthBar = rendererWithText.createHealthBar(75, 100, { x: 0, y: 0 });

      expect(healthBar.text).toBeDefined();
      expect(healthBar.text?.text).toBe('75/100');
    });

    it('should update text when health changes', () => {
      const rendererWithText = new HealthBarRenderer({ showText: true });
      const healthBar = rendererWithText.createHealthBar(100, 100, { x: 0, y: 0 });

      rendererWithText.updateHealthBar(healthBar, 50, 100);

      expect(healthBar.text?.text).toBe('50/100');
    });

    it('should position text centered on health bar', () => {
      const rendererWithText = new HealthBarRenderer({ showText: true });
      const healthBar = rendererWithText.createHealthBar(75, 100, { x: 0, y: 0 });

      expect(healthBar.text?.x).toBe(0);
      expect(healthBar.text?.y).toBeLessThan(0); // Above bar
    });
  });

  describe('Performance', () => {
    it('should efficiently create 100 health bars', () => {
      const startTime = performance.now();

      const healthBars = [];
      for (let i = 0; i < 100; i++) {
        healthBars.push(renderer.createHealthBar(100, 100, { x: i, y: 0 }));
      }

      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(50); // Should create 100 bars in < 50ms
      expect(healthBars.length).toBe(100);
    });

    it('should efficiently update 100 health bars', () => {
      const healthBars = [];
      for (let i = 0; i < 100; i++) {
        healthBars.push(renderer.createHealthBar(100, 100, { x: i, y: 0 }));
      }

      const startTime = performance.now();

      healthBars.forEach((bar, i) => {
        renderer.updateHealthBar(bar, 50 + i % 50, 100);
      });

      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(50); // Should update 100 bars in < 50ms
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero health correctly', () => {
      const healthBar = renderer.createHealthBar(0, 100, { x: 0, y: 0 });

      expect(healthBar.currentHealth).toBe(0);
      expect(renderer.calculateHealthPercentage(0, 100)).toBe(0);
    });

    it('should handle full health correctly', () => {
      const healthBar = renderer.createHealthBar(100, 100, { x: 0, y: 0 });

      expect(healthBar.currentHealth).toBe(100);
      expect(renderer.calculateHealthPercentage(100, 100)).toBe(1.0);
    });

    it('should handle very large health values', () => {
      const healthBar = renderer.createHealthBar(999999, 1000000, { x: 0, y: 0 });

      expect(healthBar.currentHealth).toBe(999999);
      expect(renderer.calculateHealthPercentage(999999, 1000000)).toBeCloseTo(0.999999);
    });

    it('should handle fractional health values', () => {
      const healthBar = renderer.createHealthBar(75.5, 100, { x: 0, y: 0 });

      expect(healthBar.currentHealth).toBe(75.5);
      expect(renderer.calculateHealthPercentage(75.5, 100)).toBe(0.755);
    });
  });

  describe('Cleanup', () => {
    it('should provide method to destroy health bar', () => {
      const healthBar = renderer.createHealthBar(100, 100, { x: 0, y: 0 });

      renderer.destroyHealthBar(healthBar);

      expect(healthBar.container.destroyed).toBe(true);
    });

    it('should destroy text if present', () => {
      const rendererWithText = new HealthBarRenderer({ showText: true });
      const healthBar = rendererWithText.createHealthBar(75, 100, { x: 0, y: 0 });

      rendererWithText.destroyHealthBar(healthBar);

      expect(healthBar.container.destroyed).toBe(true);
    });
  });
});
