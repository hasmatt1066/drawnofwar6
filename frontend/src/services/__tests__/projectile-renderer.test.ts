/**
 * TASK-COMBAT-VIZ-013: Projectile Renderer Tests
 *
 * Test-driven development for projectile rendering in combat.
 * Displays animated projectiles (arrows, fireballs) traveling from source to target.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectileRenderer, ProjectileType } from '../projectile-renderer';

describe('ProjectileRenderer', () => {
  let renderer: ProjectileRenderer;

  beforeEach(() => {
    renderer = new ProjectileRenderer();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      expect(renderer).toBeDefined();
      expect(renderer.getConfig().speed).toBe(300);
    });

    it('should accept custom configuration', () => {
      const customRenderer = new ProjectileRenderer({
        speed: 500,
        arcHeight: 30
      });

      expect(customRenderer.getConfig().speed).toBe(500);
      expect(customRenderer.getConfig().arcHeight).toBe(30);
    });
  });

  describe('Projectile Type Properties', () => {
    it('should define arrow projectile type', () => {
      const props = renderer.getProjectileProperties(ProjectileType.ARROW);

      expect(props).toBeDefined();
      expect(props.color).toBeDefined();
      expect(props.size).toBeGreaterThan(0);
    });

    it('should define fireball projectile type', () => {
      const props = renderer.getProjectileProperties(ProjectileType.FIREBALL);

      expect(props).toBeDefined();
      expect(props.color).toBeDefined();
    });

    it('should define ice shard projectile type', () => {
      const props = renderer.getProjectileProperties(ProjectileType.ICE_SHARD);

      expect(props).toBeDefined();
      expect(props.color).toBeDefined();
    });

    it('should define lightning bolt projectile type', () => {
      const props = renderer.getProjectileProperties(ProjectileType.LIGHTNING);

      expect(props).toBeDefined();
      expect(props.color).toBeDefined();
    });

    it('should define generic projectile type', () => {
      const props = renderer.getProjectileProperties(ProjectileType.GENERIC);

      expect(props).toBeDefined();
      expect(props.color).toBeDefined();
    });
  });

  describe('Projectile Creation', () => {
    it('should create arrow projectile', () => {
      const projectile = renderer.createProjectile(
        ProjectileType.ARROW,
        { x: 100, y: 100 },
        { x: 200, y: 150 }
      );

      expect(projectile).toBeDefined();
      expect(projectile.type).toBe(ProjectileType.ARROW);
      expect(projectile.isComplete).toBe(false);
    });

    it('should create fireball projectile', () => {
      const projectile = renderer.createProjectile(
        ProjectileType.FIREBALL,
        { x: 100, y: 100 },
        { x: 200, y: 150 }
      );

      expect(projectile.type).toBe(ProjectileType.FIREBALL);
    });

    it('should position projectile at source coordinates', () => {
      const projectile = renderer.createProjectile(
        ProjectileType.ARROW,
        { x: 150, y: 200 },
        { x: 300, y: 250 }
      );

      expect(projectile.graphics.x).toBe(150);
      expect(projectile.graphics.y).toBe(200);
    });

    it('should calculate correct angle to target', () => {
      const projectile = renderer.createProjectile(
        ProjectileType.ARROW,
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      );

      // Arrow pointing right should have 0 rotation
      expect(projectile.graphics.rotation).toBeCloseTo(0, 1);
    });

    it('should store source and target positions', () => {
      const source = { x: 100, y: 100 };
      const target = { x: 200, y: 150 };

      const projectile = renderer.createProjectile(
        ProjectileType.ARROW,
        source,
        target
      );

      expect(projectile.sourceX).toBe(source.x);
      expect(projectile.sourceY).toBe(source.y);
      expect(projectile.targetX).toBe(target.x);
      expect(projectile.targetY).toBe(target.y);
    });
  });

  describe('Distance Calculation', () => {
    it('should calculate distance correctly', () => {
      const distance = renderer.calculateDistance(
        { x: 0, y: 0 },
        { x: 3, y: 4 }
      );

      expect(distance).toBe(5); // 3-4-5 triangle
    });

    it('should handle same position', () => {
      const distance = renderer.calculateDistance(
        { x: 100, y: 100 },
        { x: 100, y: 100 }
      );

      expect(distance).toBe(0);
    });

    it('should handle negative coordinates', () => {
      const distance = renderer.calculateDistance(
        { x: -10, y: -10 },
        { x: 10, y: 10 }
      );

      expect(distance).toBeCloseTo(28.28, 1);
    });
  });

  describe('Animation Progress', () => {
    it('should initialize animation state', () => {
      const projectile = renderer.createProjectile(
        ProjectileType.ARROW,
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      );

      expect(projectile.startTime).toBeGreaterThan(0);
      expect(projectile.progress).toBe(0);
      expect(projectile.isComplete).toBe(false);
    });

    it('should update animation over time', () => {
      const projectile = renderer.createProjectile(
        ProjectileType.ARROW,
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      );

      const currentTime = projectile.startTime + 50;
      renderer.updateAnimation(projectile, currentTime);

      expect(projectile.progress).toBeGreaterThan(0);
      expect(projectile.progress).toBeLessThan(1);
      expect(projectile.isComplete).toBe(false);
    });

    it('should mark projectile complete when reaching target', () => {
      const projectile = renderer.createProjectile(
        ProjectileType.ARROW,
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      );

      // Fast forward past travel time
      const currentTime = projectile.startTime + 2000;
      renderer.updateAnimation(projectile, currentTime);

      expect(projectile.isComplete).toBe(true);
      expect(projectile.progress).toBe(1);
    });

    it('should move projectile toward target', () => {
      const projectile = renderer.createProjectile(
        ProjectileType.ARROW,
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      );

      const initialX = projectile.graphics.x;

      const currentTime = projectile.startTime + 50;
      renderer.updateAnimation(projectile, currentTime);

      expect(projectile.graphics.x).toBeGreaterThan(initialX);
    });
  });

  describe('Arc Trajectory', () => {
    it('should apply arc to arrow projectiles', () => {
      const projectile = renderer.createProjectile(
        ProjectileType.ARROW,
        { x: 0, y: 100 },
        { x: 100, y: 100 }
      );

      // At midpoint, Y should be higher (arcing up)
      const currentTime = projectile.startTime + 50;
      renderer.updateAnimation(projectile, currentTime);

      // Y should be less than 100 (upward is negative in screen coords)
      expect(projectile.graphics.y).toBeLessThan(100);
    });

    it('should have max arc at midpoint', () => {
      const rendererWithArc = new ProjectileRenderer({ arcHeight: 50 });
      const projectile = rendererWithArc.createProjectile(
        ProjectileType.ARROW,
        { x: 0, y: 100 },
        { x: 200, y: 100 }
      );

      // Progress to exactly 50%
      const distance = rendererWithArc.calculateDistance(
        { x: 0, y: 100 },
        { x: 200, y: 100 }
      );
      const travelTime = distance / rendererWithArc.getConfig().speed * 1000;
      const currentTime = projectile.startTime + (travelTime / 2);

      rendererWithArc.updateAnimation(projectile, currentTime);

      // Should be at peak of arc (50 pixels above baseline)
      expect(projectile.graphics.y).toBeCloseTo(50, 0);
    });

    it('should not apply arc to instant projectiles like lightning', () => {
      const projectile = renderer.createProjectile(
        ProjectileType.LIGHTNING,
        { x: 0, y: 100 },
        { x: 100, y: 100 }
      );

      const currentTime = projectile.startTime + 50;
      renderer.updateAnimation(projectile, currentTime);

      // Lightning should travel in straight line
      // No arc means Y should be interpolating linearly
      expect(projectile.graphics.y).toBeCloseTo(100, 1);
    });
  });

  describe('Rotation', () => {
    it('should rotate arrow to face direction of travel', () => {
      const projectile = renderer.createProjectile(
        ProjectileType.ARROW,
        { x: 0, y: 0 },
        { x: 100, y: 100 }
      );

      // Diagonal down-right should be ~45 degrees (π/4 radians)
      expect(projectile.graphics.rotation).toBeCloseTo(Math.PI / 4, 1);
    });

    it('should update rotation during arc', () => {
      const projectile = renderer.createProjectile(
        ProjectileType.ARROW,
        { x: 0, y: 100 },
        { x: 100, y: 100 }
      );

      const initialRotation = projectile.graphics.rotation;

      // At midpoint of arc, rotation should change (pointing upward)
      const currentTime = projectile.startTime + 50;
      renderer.updateAnimation(projectile, currentTime);

      // Rotation should be different due to arc trajectory
      expect(projectile.graphics.rotation).not.toBe(initialRotation);
    });
  });

  describe('Batch Updates', () => {
    it('should update multiple projectiles efficiently', () => {
      const projectiles = [];

      for (let i = 0; i < 20; i++) {
        projectiles.push(
          renderer.createProjectile(
            ProjectileType.ARROW,
            { x: i * 10, y: 100 },
            { x: i * 10 + 100, y: 150 }
          )
        );
      }

      const startTime = performance.now();

      projectiles.forEach(proj => {
        const currentTime = proj.startTime + 50;
        renderer.updateAnimation(proj, currentTime);
      });

      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(10); // Should update 20 projectiles in < 10ms
    });

    it('should filter out completed projectiles', () => {
      const active = renderer.createProjectile(
        ProjectileType.ARROW,
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      );

      const completed = renderer.createProjectile(
        ProjectileType.ARROW,
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      );

      // Complete one projectile
      const currentTime = completed.startTime + 2000;
      renderer.updateAnimation(completed, currentTime);

      const activeProjectiles = [active, completed].filter(p => !p.isComplete);

      expect(activeProjectiles.length).toBe(1);
      expect(activeProjectiles[0]).toBe(active);
    });
  });

  describe('Resource Cleanup', () => {
    it('should provide method to destroy projectile', () => {
      const projectile = renderer.createProjectile(
        ProjectileType.ARROW,
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      );

      renderer.destroyProjectile(projectile);

      expect(projectile.graphics.destroyed).toBe(true);
    });

    it('should cleanup completed projectiles', () => {
      const projectile = renderer.createProjectile(
        ProjectileType.ARROW,
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      );

      const currentTime = projectile.startTime + 2000;
      renderer.updateAnimation(projectile, currentTime);

      expect(projectile.isComplete).toBe(true);
      // Calling code would filter and destroy
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero distance', () => {
      const projectile = renderer.createProjectile(
        ProjectileType.ARROW,
        { x: 100, y: 100 },
        { x: 100, y: 100 }
      );

      // Should complete immediately
      const currentTime = projectile.startTime + 1;
      renderer.updateAnimation(projectile, currentTime);

      expect(projectile.isComplete).toBe(true);
    });

    it('should handle very long distances', () => {
      const projectile = renderer.createProjectile(
        ProjectileType.ARROW,
        { x: 0, y: 0 },
        { x: 1000, y: 1000 }
      );

      expect(projectile).toBeDefined();
      expect(projectile.isComplete).toBe(false);
    });

    it('should handle fractional coordinates', () => {
      const projectile = renderer.createProjectile(
        ProjectileType.ARROW,
        { x: 10.5, y: 20.7 },
        { x: 30.2, y: 40.9 }
      );

      expect(projectile.graphics.x).toBeCloseTo(10.5, 1);
      expect(projectile.graphics.y).toBeCloseTo(20.7, 1);
    });
  });

  describe('Performance', () => {
    it('should create 50 projectiles efficiently', () => {
      const startTime = performance.now();

      for (let i = 0; i < 50; i++) {
        renderer.createProjectile(
          ProjectileType.ARROW,
          { x: 0, y: 0 },
          { x: 100, y: 100 }
        );
      }

      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(50); // Should create 50 projectiles in < 50ms
    });
  });

  describe('Projectile Types', () => {
    it('should render different types with different properties', () => {
      const arrow = renderer.createProjectile(
        ProjectileType.ARROW,
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      );

      const fireball = renderer.createProjectile(
        ProjectileType.FIREBALL,
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      );

      // Different types should have different visual properties
      const arrowProps = renderer.getProjectileProperties(ProjectileType.ARROW);
      const fireballProps = renderer.getProjectileProperties(ProjectileType.FIREBALL);

      expect(arrowProps.color).not.toBe(fireballProps.color);
    });
  });
});
