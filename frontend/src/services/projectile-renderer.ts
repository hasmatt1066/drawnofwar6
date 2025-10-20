/**
 * TASK-COMBAT-VIZ-013: Projectile Renderer Implementation
 *
 * Renders animated projectiles for ranged attacks in combat.
 * Supports different projectile types with arcing trajectories and rotation.
 */

import * as PIXI from 'pixi.js';

/**
 * Projectile type enumeration
 */
export enum ProjectileType {
  ARROW = 'arrow',
  FIREBALL = 'fireball',
  ICE_SHARD = 'ice_shard',
  LIGHTNING = 'lightning',
  GENERIC = 'generic'
}

/**
 * Projectile renderer configuration
 */
export interface ProjectileConfig {
  speed?: number;        // Pixels per second
  arcHeight?: number;    // Maximum arc height in pixels
}

/**
 * Visual properties for projectile types
 */
export interface ProjectileProperties {
  color: number;
  size: number;
  hasArc: boolean;
}

/**
 * Projectile data structure
 */
export interface Projectile {
  graphics: PIXI.Graphics;
  type: ProjectileType;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  startTime: number;
  progress: number;
  isComplete: boolean;
}

/**
 * Visual projectile for state-based rendering
 * Extends projectile with ID tracking for integration with combat state
 */
export interface VisualProjectile {
  projectileId: string;
  sprite: PIXI.Graphics;
  type: ProjectileType;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  startTime: number;
  progress: number;
  isComplete: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<ProjectileConfig> = {
  speed: 300,      // 300 pixels per second
  arcHeight: 20    // 20 pixel arc
};

/**
 * Visual properties for each projectile type
 */
const PROJECTILE_PROPERTIES: Record<ProjectileType, ProjectileProperties> = {
  [ProjectileType.ARROW]: {
    color: 0x8b4513,  // Brown
    size: 12,
    hasArc: true
  },
  [ProjectileType.FIREBALL]: {
    color: 0xff4500,  // Orange-red
    size: 16,
    hasArc: true
  },
  [ProjectileType.ICE_SHARD]: {
    color: 0x87ceeb,  // Sky blue
    size: 10,
    hasArc: true
  },
  [ProjectileType.LIGHTNING]: {
    color: 0xffff00,  // Yellow
    size: 8,
    hasArc: false     // Lightning travels in straight line
  },
  [ProjectileType.GENERIC]: {
    color: 0xffffff,  // White
    size: 8,
    hasArc: true
  }
};

/**
 * ProjectileRenderer
 *
 * Service for creating and animating combat projectiles.
 * Handles arcing trajectories and rotation to face direction of travel.
 */
export class ProjectileRenderer {
  private config: Required<ProjectileConfig>;

  constructor(config: ProjectileConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get current configuration
   */
  public getConfig(): Required<ProjectileConfig> {
    return { ...this.config };
  }

  /**
   * Get visual properties for a projectile type
   */
  public getProjectileProperties(type: ProjectileType): ProjectileProperties {
    return { ...PROJECTILE_PROPERTIES[type] };
  }

  /**
   * Calculate distance between two points
   */
  public calculateDistance(
    source: { x: number; y: number },
    target: { x: number; y: number }
  ): number {
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculate angle from source to target
   */
  private calculateAngle(
    source: { x: number; y: number },
    target: { x: number; y: number }
  ): number {
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    return Math.atan2(dy, dx);
  }

  /**
   * Create a new projectile
   */
  public createProjectile(
    type: ProjectileType,
    source: { x: number; y: number },
    target: { x: number; y: number }
  ): Projectile {
    const props = this.getProjectileProperties(type);
    const graphics = new PIXI.Graphics();

    // Draw projectile shape
    graphics.circle(0, 0, props.size / 2);
    graphics.fill({ color: props.color, alpha: 1.0 });

    // Position at source
    graphics.x = source.x;
    graphics.y = source.y;

    // Rotate to face target
    const angle = this.calculateAngle(source, target);
    graphics.rotation = angle;

    return {
      graphics,
      type,
      sourceX: source.x,
      sourceY: source.y,
      targetX: target.x,
      targetY: target.y,
      startTime: performance.now(),
      progress: 0,
      isComplete: false
    };
  }

  /**
   * Create a visual projectile with ID tracking for state-based rendering
   * This is used by the visualization manager to sync projectiles with combat state
   */
  public createVisualProjectile(
    projectileId: string,
    source: { x: number; y: number },
    target: { x: number; y: number },
    spritePath?: string
  ): VisualProjectile {
    // Determine projectile type from sprite path if provided
    const type = this.getProjectileTypeFromSpritePath(spritePath);
    const props = this.getProjectileProperties(type);
    const graphics = new PIXI.Graphics();

    // Draw projectile shape
    graphics.circle(0, 0, props.size / 2);
    graphics.fill({ color: props.color, alpha: 1.0 });

    // Position at source
    graphics.x = source.x;
    graphics.y = source.y;

    // Rotate to face target
    const angle = this.calculateAngle(source, target);
    graphics.rotation = angle;

    return {
      projectileId,
      sprite: graphics,
      type,
      sourceX: source.x,
      sourceY: source.y,
      targetX: target.x,
      targetY: target.y,
      startTime: performance.now(),
      progress: 0,
      isComplete: false
    };
  }

  /**
   * Map sprite path to projectile type
   * Used for state-based projectile creation
   */
  private getProjectileTypeFromSpritePath(spritePath?: string): ProjectileType {
    if (!spritePath) return ProjectileType.GENERIC;

    const path = spritePath.toLowerCase();
    if (path.includes('arrow')) return ProjectileType.ARROW;
    if (path.includes('fireball')) return ProjectileType.FIREBALL;
    if (path.includes('ice')) return ProjectileType.ICE_SHARD;
    if (path.includes('lightning')) return ProjectileType.LIGHTNING;

    return ProjectileType.GENERIC;
  }

  /**
   * Update projectile animation
   */
  public updateAnimation(projectile: Projectile, currentTime: number): void {
    const elapsed = currentTime - projectile.startTime;
    const distance = this.calculateDistance(
      { x: projectile.sourceX, y: projectile.sourceY },
      { x: projectile.targetX, y: projectile.targetY }
    );

    // Handle zero distance edge case
    if (distance === 0) {
      projectile.isComplete = true;
      projectile.progress = 1;
      return;
    }

    // Calculate travel time based on distance and speed
    const travelTime = (distance / this.config.speed) * 1000; // Convert to ms
    const progress = Math.min(elapsed / travelTime, 1.0);

    projectile.progress = progress;

    if (progress >= 1.0) {
      projectile.isComplete = true;
      projectile.graphics.x = projectile.targetX;
      projectile.graphics.y = projectile.targetY;
      return;
    }

    // Linear interpolation for X
    const x = projectile.sourceX + (projectile.targetX - projectile.sourceX) * progress;

    // Linear interpolation for Y with optional arc
    let y = projectile.sourceY + (projectile.targetY - projectile.sourceY) * progress;

    const props = this.getProjectileProperties(projectile.type);
    if (props.hasArc) {
      // Parabolic arc: peaks at midpoint (progress = 0.5)
      // Arc formula: -4 * arcHeight * progress * (progress - 1)
      // This gives 0 at progress=0 and progress=1, and max at progress=0.5
      const arcOffset = -4 * this.config.arcHeight * progress * (progress - 1);
      y -= arcOffset; // Subtract because Y increases downward in screen space
    }

    projectile.graphics.x = x;
    projectile.graphics.y = y;

    // Update rotation to face direction of travel (considering arc)
    if (progress > 0 && progress < 1) {
      // Calculate tangent of trajectory
      const nextProgress = Math.min(progress + 0.01, 1.0);
      const nextX = projectile.sourceX + (projectile.targetX - projectile.sourceX) * nextProgress;
      let nextY = projectile.sourceY + (projectile.targetY - projectile.sourceY) * nextProgress;

      if (props.hasArc) {
        const nextArcOffset = -4 * this.config.arcHeight * nextProgress * (nextProgress - 1);
        nextY -= nextArcOffset;
      }

      const angle = Math.atan2(nextY - y, nextX - x);
      projectile.graphics.rotation = angle;
    }
  }

  /**
   * Destroy projectile and cleanup resources
   */
  public destroyProjectile(projectile: Projectile | VisualProjectile): void {
    if ('sprite' in projectile) {
      projectile.sprite.destroy();
    } else {
      projectile.graphics.destroy();
    }
  }
}
