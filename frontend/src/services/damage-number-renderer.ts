/**
 * TASK-COMBAT-VIZ-012: Damage Number Renderer Implementation
 *
 * Renders floating damage/healing numbers above combat units with animation.
 * Supports color coding by damage type and auto-cleanup after animation.
 */

import * as PIXI from 'pixi.js';

/**
 * Damage type enumeration
 */
export enum DamageType {
  PHYSICAL = 'physical',
  MAGICAL = 'magical',
  TRUE = 'true',
  HEAL = 'heal',
  CRITICAL = 'critical'
}

/**
 * Damage number configuration
 */
export interface DamageNumberConfig {
  duration?: number;        // Animation duration in ms
  fontSize?: number;        // Base font size
  floatDistance?: number;   // Pixels to float upward
  fadeStart?: number;       // When to start fading (0-1)
}

/**
 * Damage number data structure
 */
export interface DamageNumber {
  container: PIXI.Container;
  text: PIXI.Text;
  value: number;
  type: DamageType;
  startTime: number;
  initialY: number;
  isComplete: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<DamageNumberConfig> = {
  duration: 1000,
  fontSize: 16,
  floatDistance: 40,
  fadeStart: 0.6
};

/**
 * Color mapping for damage types
 */
const DAMAGE_COLORS: Record<DamageType, number> = {
  [DamageType.PHYSICAL]: 0xff4444,
  [DamageType.MAGICAL]: 0xaa44ff,
  [DamageType.TRUE]: 0xffffff,
  [DamageType.HEAL]: 0x44ff44,
  [DamageType.CRITICAL]: 0xffaa00
};

/**
 * DamageNumberRenderer
 *
 * Service for creating and animating floating damage numbers.
 * Numbers float upward and fade out over time.
 */
export class DamageNumberRenderer {
  private config: Required<DamageNumberConfig>;

  constructor(config: DamageNumberConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get current configuration
   */
  public getConfig(): Required<DamageNumberConfig> {
    return { ...this.config };
  }

  /**
   * Get color for damage type
   */
  public getColor(type: DamageType): number {
    return DAMAGE_COLORS[type];
  }

  /**
   * Create a new damage number
   */
  public createDamageNumber(
    value: number,
    type: DamageType,
    position: { x: number; y: number }
  ): DamageNumber {
    // Format value based on type
    const absValue = Math.abs(value);
    const roundedValue = Math.round(absValue);
    let displayText = roundedValue.toString();

    if (type === DamageType.HEAL) {
      displayText = `+${roundedValue}`;
    }

    // Determine styling based on type
    const color = this.getColor(type);
    let fontSize = this.config.fontSize;
    let fontWeight: string = 'normal';

    if (type === DamageType.CRITICAL) {
      fontSize = this.config.fontSize * 1.5;
      fontWeight = 'bold';
    }

    // Create text
    const text = new PIXI.Text({
      text: displayText,
      style: {
        fontSize,
        fill: color,
        stroke: { color: 0x000000, width: 3 },
        fontWeight,
        align: 'center'
      }
    });

    text.anchor.set(0.5);

    // Create container
    const container = new PIXI.Container();
    container.addChild(text);
    container.x = position.x;
    container.y = position.y;
    container.alpha = 1.0;

    return {
      container,
      text,
      value: roundedValue,
      type,
      startTime: Date.now(),
      initialY: position.y,
      isComplete: false
    };
  }

  /**
   * Update damage number animation
   */
  public updateAnimation(damageNumber: DamageNumber, currentTime: number): void {
    const elapsed = currentTime - damageNumber.startTime;
    const progress = Math.min(elapsed / this.config.duration, 1.0);

    if (progress >= 1.0) {
      damageNumber.isComplete = true;
      damageNumber.container.alpha = 0;
      return;
    }

    // Float upward
    const floatProgress = this.easeOutCubic(progress);
    damageNumber.container.y = damageNumber.initialY - (this.config.floatDistance * floatProgress);

    // Fade out after fadeStart threshold
    if (progress > this.config.fadeStart) {
      const fadeProgress = (progress - this.config.fadeStart) / (1.0 - this.config.fadeStart);
      damageNumber.container.alpha = 1.0 - fadeProgress;
    }
  }

  /**
   * Easing function for smooth animation
   */
  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  /**
   * Destroy damage number and cleanup resources
   */
  public destroyDamageNumber(damageNumber: DamageNumber): void {
    damageNumber.text.destroy();
    damageNumber.container.destroy();
  }
}
