/**
 * TASK-COMBAT-VIZ-015: Buff/Debuff Icon Renderer Tests
 *
 * Test-driven development for status effect icon rendering.
 * Displays buff/debuff icons above units with timers and stack counts.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BuffIconRenderer, BuffType, BuffIcon } from '../buff-icon-renderer';

describe('BuffIconRenderer', () => {
  let renderer: BuffIconRenderer;

  beforeEach(() => {
    renderer = new BuffIconRenderer();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      expect(renderer).toBeDefined();
      expect(renderer.getConfig().iconSize).toBe(20);
    });

    it('should accept custom configuration', () => {
      const customRenderer = new BuffIconRenderer({
        iconSize: 24,
        showDuration: true,
        showStacks: true
      });

      expect(customRenderer.getConfig().iconSize).toBe(24);
      expect(customRenderer.getConfig().showDuration).toBe(true);
      expect(customRenderer.getConfig().showStacks).toBe(true);
    });
  });

  describe('Buff Types', () => {
    it('should define poison buff type', () => {
      const props = renderer.getBuffProperties(BuffType.POISON);

      expect(props).toBeDefined();
      expect(props.color).toBeDefined();
      expect(props.isDebuff).toBe(true);
    });

    it('should define burn buff type', () => {
      const props = renderer.getBuffProperties(BuffType.BURN);

      expect(props).toBeDefined();
      expect(props.isDebuff).toBe(true);
    });

    it('should define regeneration buff type', () => {
      const props = renderer.getBuffProperties(BuffType.REGENERATION);

      expect(props).toBeDefined();
      expect(props.isDebuff).toBe(false);
    });

    it('should define shield buff type', () => {
      const props = renderer.getBuffProperties(BuffType.SHIELD);

      expect(props).toBeDefined();
      expect(props.isDebuff).toBe(false);
    });

    it('should define stun debuff type', () => {
      const props = renderer.getBuffProperties(BuffType.STUN);

      expect(props).toBeDefined();
      expect(props.isDebuff).toBe(true);
    });

    it('should define haste buff type', () => {
      const props = renderer.getBuffProperties(BuffType.HASTE);

      expect(props).toBeDefined();
      expect(props.isDebuff).toBe(false);
    });

    it('should define slow debuff type', () => {
      const props = renderer.getBuffProperties(BuffType.SLOW);

      expect(props).toBeDefined();
      expect(props.isDebuff).toBe(true);
    });
  });

  describe('Icon Creation', () => {
    it('should create buff icon', () => {
      const icon = renderer.createBuffIcon(
        BuffType.REGENERATION,
        { x: 100, y: 50 }
      );

      expect(icon).toBeDefined();
      expect(icon.type).toBe(BuffType.REGENERATION);
      expect(icon.container.x).toBe(100);
      expect(icon.container.y).toBe(50);
    });

    it('should create icon with duration', () => {
      const icon = renderer.createBuffIcon(
        BuffType.POISON,
        { x: 100, y: 50 },
        { duration: 5.5 }
      );

      expect(icon.duration).toBe(5.5);
    });

    it('should create icon with stacks', () => {
      const icon = renderer.createBuffIcon(
        BuffType.POISON,
        { x: 100, y: 50 },
        { stacks: 3 }
      );

      expect(icon.stacks).toBe(3);
    });

    it('should create icon without duration or stacks', () => {
      const icon = renderer.createBuffIcon(
        BuffType.SHIELD,
        { x: 100, y: 50 }
      );

      expect(icon.duration).toBeUndefined();
      expect(icon.stacks).toBeUndefined();
    });

    it('should position icon at specified coordinates', () => {
      const icon = renderer.createBuffIcon(
        BuffType.HASTE,
        { x: 200, y: 150 }
      );

      expect(icon.container.x).toBe(200);
      expect(icon.container.y).toBe(150);
    });
  });

  describe('Duration Display', () => {
    it('should show duration when enabled', () => {
      const rendererWithDuration = new BuffIconRenderer({ showDuration: true });

      const icon = rendererWithDuration.createBuffIcon(
        BuffType.POISON,
        { x: 100, y: 50 },
        { duration: 10.5 }
      );

      expect(icon.durationText).toBeDefined();
      expect(icon.durationText?.text.text).toBe('10.5');
    });

    it('should not show duration when disabled', () => {
      const rendererWithoutDuration = new BuffIconRenderer({ showDuration: false });

      const icon = rendererWithoutDuration.createBuffIcon(
        BuffType.POISON,
        { x: 100, y: 50 },
        { duration: 10.5 }
      );

      expect(icon.durationText).toBeUndefined();
    });

    it('should not show duration if not provided', () => {
      const rendererWithDuration = new BuffIconRenderer({ showDuration: true });

      const icon = rendererWithDuration.createBuffIcon(
        BuffType.POISON,
        { x: 100, y: 50 }
      );

      expect(icon.durationText).toBeUndefined();
    });

    it('should format duration to 1 decimal place', () => {
      const rendererWithDuration = new BuffIconRenderer({ showDuration: true });

      const icon = rendererWithDuration.createBuffIcon(
        BuffType.BURN,
        { x: 100, y: 50 },
        { duration: 5.678 }
      );

      expect(icon.durationText?.text.text).toBe('5.7');
    });
  });

  describe('Stack Display', () => {
    it('should show stacks when enabled', () => {
      const rendererWithStacks = new BuffIconRenderer({ showStacks: true });

      const icon = rendererWithStacks.createBuffIcon(
        BuffType.POISON,
        { x: 100, y: 50 },
        { stacks: 5 }
      );

      expect(icon.stackText).toBeDefined();
      expect(icon.stackText?.text.text).toBe('5');
    });

    it('should not show stacks when disabled', () => {
      const rendererWithoutStacks = new BuffIconRenderer({ showStacks: false });

      const icon = rendererWithoutStacks.createBuffIcon(
        BuffType.POISON,
        { x: 100, y: 50 },
        { stacks: 5 }
      );

      expect(icon.stackText).toBeUndefined();
    });

    it('should not show stacks if not provided', () => {
      const rendererWithStacks = new BuffIconRenderer({ showStacks: true });

      const icon = rendererWithStacks.createBuffIcon(
        BuffType.POISON,
        { x: 100, y: 50 }
      );

      expect(icon.stackText).toBeUndefined();
    });

    it('should not show stacks when value is 1', () => {
      const rendererWithStacks = new BuffIconRenderer({ showStacks: true });

      const icon = rendererWithStacks.createBuffIcon(
        BuffType.POISON,
        { x: 100, y: 50 },
        { stacks: 1 }
      );

      expect(icon.stackText).toBeUndefined();
    });
  });

  describe('Update Icon', () => {
    it('should update icon duration', () => {
      const rendererWithDuration = new BuffIconRenderer({ showDuration: true });

      const icon = rendererWithDuration.createBuffIcon(
        BuffType.POISON,
        { x: 100, y: 50 },
        { duration: 10 }
      );

      rendererWithDuration.updateBuffIcon(icon, { duration: 5 });

      expect(icon.duration).toBe(5);
      expect(icon.durationText?.text.text).toBe('5.0');
    });

    it('should update icon stacks', () => {
      const rendererWithStacks = new BuffIconRenderer({ showStacks: true });

      const icon = rendererWithStacks.createBuffIcon(
        BuffType.POISON,
        { x: 100, y: 50 },
        { stacks: 3 }
      );

      rendererWithStacks.updateBuffIcon(icon, { stacks: 5 });

      expect(icon.stacks).toBe(5);
      expect(icon.stackText?.text.text).toBe('5');
    });

    it('should update icon position', () => {
      const icon = renderer.createBuffIcon(
        BuffType.SHIELD,
        { x: 100, y: 50 }
      );

      renderer.updateBuffIcon(icon, { position: { x: 200, y: 150 } });

      expect(icon.container.x).toBe(200);
      expect(icon.container.y).toBe(150);
    });

    it('should update multiple properties at once', () => {
      const rendererWithAll = new BuffIconRenderer({
        showDuration: true,
        showStacks: true
      });

      const icon = rendererWithAll.createBuffIcon(
        BuffType.POISON,
        { x: 100, y: 50 },
        { duration: 10, stacks: 3 }
      );

      rendererWithAll.updateBuffIcon(icon, {
        duration: 5,
        stacks: 7,
        position: { x: 200, y: 100 }
      });

      expect(icon.duration).toBe(5);
      expect(icon.stacks).toBe(7);
      expect(icon.container.x).toBe(200);
      expect(icon.container.y).toBe(100);
    });
  });

  describe('Visual Styling', () => {
    it('should use different colors for buffs vs debuffs', () => {
      const buffProps = renderer.getBuffProperties(BuffType.REGENERATION);
      const debuffProps = renderer.getBuffProperties(BuffType.POISON);

      expect(buffProps.color).not.toBe(debuffProps.color);
    });

    it('should create circular icon shape', () => {
      const icon = renderer.createBuffIcon(
        BuffType.SHIELD,
        { x: 100, y: 50 }
      );

      expect(icon.iconGraphics).toBeDefined();
    });
  });

  describe('Resource Cleanup', () => {
    it('should provide method to destroy buff icon', () => {
      const icon = renderer.createBuffIcon(
        BuffType.POISON,
        { x: 100, y: 50 }
      );

      renderer.destroyBuffIcon(icon);

      expect(icon.container.destroyed).toBe(true);
      expect(icon.iconGraphics.destroyed).toBe(true);
    });

    it('should destroy duration text if present', () => {
      const rendererWithDuration = new BuffIconRenderer({ showDuration: true });

      const icon = rendererWithDuration.createBuffIcon(
        BuffType.POISON,
        { x: 100, y: 50 },
        { duration: 5 }
      );

      rendererWithDuration.destroyBuffIcon(icon);

      expect(icon.durationText?.text.destroyed).toBe(true);
    });

    it('should destroy stack text if present', () => {
      const rendererWithStacks = new BuffIconRenderer({ showStacks: true });

      const icon = rendererWithStacks.createBuffIcon(
        BuffType.POISON,
        { x: 100, y: 50 },
        { stacks: 3 }
      );

      rendererWithStacks.destroyBuffIcon(icon);

      expect(icon.stackText?.text.destroyed).toBe(true);
    });
  });

  describe('Batch Operations', () => {
    it('should handle multiple icons efficiently', () => {
      const icons = [];

      const startTime = performance.now();

      for (let i = 0; i < 20; i++) {
        icons.push(
          renderer.createBuffIcon(
            BuffType.POISON,
            { x: i * 25, y: 50 },
            { duration: 10, stacks: i + 1 }
          )
        );
      }

      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(20); // Should create 20 icons in < 20ms
      expect(icons).toHaveLength(20);
    });

    it('should update multiple icons efficiently', () => {
      const icons = [];

      for (let i = 0; i < 20; i++) {
        icons.push(
          renderer.createBuffIcon(
            BuffType.POISON,
            { x: i * 25, y: 50 },
            { duration: 10 }
          )
        );
      }

      const startTime = performance.now();

      icons.forEach(icon => {
        renderer.updateBuffIcon(icon, { duration: 5 });
      });

      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(10); // Should update 20 icons in < 10ms
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero duration', () => {
      const rendererWithDuration = new BuffIconRenderer({ showDuration: true });

      const icon = rendererWithDuration.createBuffIcon(
        BuffType.POISON,
        { x: 100, y: 50 },
        { duration: 0 }
      );

      expect(icon.duration).toBe(0);
      expect(icon.durationText?.text.text).toBe('0.0');
    });

    it('should handle very large stack counts', () => {
      const rendererWithStacks = new BuffIconRenderer({ showStacks: true });

      const icon = rendererWithStacks.createBuffIcon(
        BuffType.POISON,
        { x: 100, y: 50 },
        { stacks: 999 }
      );

      expect(icon.stacks).toBe(999);
      expect(icon.stackText?.text.text).toBe('999');
    });

    it('should handle fractional coordinates', () => {
      const icon = renderer.createBuffIcon(
        BuffType.SHIELD,
        { x: 100.5, y: 50.7 }
      );

      expect(icon.container.x).toBeCloseTo(100.5, 1);
      expect(icon.container.y).toBeCloseTo(50.7, 1);
    });
  });

  describe('Performance', () => {
    it('should create 50 buff icons efficiently', () => {
      const startTime = performance.now();

      for (let i = 0; i < 50; i++) {
        renderer.createBuffIcon(
          BuffType.POISON,
          { x: 100, y: 50 }
        );
      }

      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(50); // Should create 50 icons in < 50ms
    });
  });
});
