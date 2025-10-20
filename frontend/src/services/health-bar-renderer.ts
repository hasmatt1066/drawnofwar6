/**
 * TASK-COMBAT-VIZ-011: Health Bar Renderer Implementation
 *
 * Renders health bars above combat units with color coding and text display.
 * Supports smooth updates and performant batch rendering.
 */

import * as PIXI from 'pixi.js';

/**
 * Health bar configuration
 */
export interface HealthBarConfig {
  width?: number;
  height?: number;
  showText?: boolean;
  backgroundColor?: number;
  borderColor?: number;
  borderWidth?: number;
}

/**
 * Health bar data structure
 */
export interface HealthBar {
  container: PIXI.Container;
  graphics: PIXI.Graphics;
  currentHealth: number;
  maxHealth: number;
  text?: PIXI.Text;
}

/**
 * Default health bar configuration
 */
const DEFAULT_CONFIG: Required<HealthBarConfig> = {
  width: 40,
  height: 4,
  showText: false,
  backgroundColor: 0x000000,
  borderColor: 0x333333,
  borderWidth: 1
};

/**
 * Health color thresholds
 */
const HEALTH_COLORS = {
  GREEN: 0x2ecc71,
  YELLOW: 0xf39c12,
  RED: 0xe74c3c
};

const HEALTH_THRESHOLDS = {
  GREEN: 2/3,  // Above 66.67%
  YELLOW: 1/3  // Above 33.33%
};

/**
 * HealthBarRenderer
 *
 * Service for creating and updating health bars above combat units.
 * Uses PixiJS Graphics for efficient rendering.
 */
export class HealthBarRenderer {
  private config: Required<HealthBarConfig>;

  constructor(config: HealthBarConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get current configuration
   */
  public getConfig(): Required<HealthBarConfig> {
    return { ...this.config };
  }

  /**
   * Calculate health percentage (clamped 0-1)
   */
  public calculateHealthPercentage(currentHealth: number, maxHealth: number): number {
    if (maxHealth === 0) return 0;
    const percentage = currentHealth / maxHealth;
    return Math.max(0, Math.min(1, percentage));
  }

  /**
   * Get health bar color based on percentage
   */
  public getHealthColor(healthPercentage: number): number {
    if (healthPercentage > HEALTH_THRESHOLDS.GREEN) {
      return HEALTH_COLORS.GREEN;
    } else if (healthPercentage > HEALTH_THRESHOLDS.YELLOW) {
      return HEALTH_COLORS.YELLOW;
    } else {
      return HEALTH_COLORS.RED;
    }
  }

  /**
   * Create a new health bar
   */
  public createHealthBar(
    currentHealth: number,
    maxHealth: number,
    position: { x: number; y: number }
  ): HealthBar {
    const graphics = new PIXI.Graphics();

    // Create container for health bar
    const container = new PIXI.Container();
    container.x = position.x;
    container.y = position.y;
    container.addChild(graphics);

    const healthBar: HealthBar = {
      container,
      graphics,
      currentHealth,
      maxHealth
    };

    // Draw initial health bar
    this.drawHealthBar(graphics, currentHealth, maxHealth);

    // Add text if enabled
    if (this.config.showText) {
      const text = new PIXI.Text({
        text: `${Math.floor(currentHealth)}/${Math.floor(maxHealth)}`,
        style: {
          fontSize: 10,
          fill: 0xffffff,
          stroke: { color: 0x000000, width: 2 },
          align: 'center'
        }
      });

      text.anchor.set(0.5);
      text.x = 0;
      text.y = -this.config.height - 8; // Position above bar
      container.addChild(text);

      healthBar.text = text;
    }

    return healthBar;
  }

  /**
   * Update health bar with new values
   */
  public updateHealthBar(
    healthBar: HealthBar,
    newHealth: number,
    newMaxHealth: number
  ): void {
    // Only update if values changed
    if (healthBar.currentHealth === newHealth && healthBar.maxHealth === newMaxHealth) {
      return;
    }

    healthBar.currentHealth = newHealth;
    healthBar.maxHealth = newMaxHealth;

    // Redraw health bar
    this.drawHealthBar(healthBar.graphics, newHealth, newMaxHealth);

    // Update text if present
    if (healthBar.text) {
      healthBar.text.text = `${Math.floor(newHealth)}/${Math.floor(newMaxHealth)}`;
    }
  }

  /**
   * Draw health bar graphics
   */
  private drawHealthBar(
    graphics: PIXI.Graphics,
    currentHealth: number,
    maxHealth: number
  ): void {
    const healthPercent = this.calculateHealthPercentage(currentHealth, maxHealth);
    const healthColor = this.getHealthColor(healthPercent);

    graphics.clear();

    // Draw background
    graphics.rect(
      -this.config.width / 2,
      -this.config.height / 2,
      this.config.width,
      this.config.height
    );
    graphics.fill({ color: this.config.backgroundColor, alpha: 0.8 });

    // Draw health fill
    const fillWidth = this.config.width * healthPercent;
    if (fillWidth > 0) {
      graphics.rect(
        -this.config.width / 2,
        -this.config.height / 2,
        fillWidth,
        this.config.height
      );
      graphics.fill({ color: healthColor, alpha: 1.0 });
    }

    // Draw border
    graphics.rect(
      -this.config.width / 2,
      -this.config.height / 2,
      this.config.width,
      this.config.height
    );
    graphics.stroke({
      width: this.config.borderWidth,
      color: this.config.borderColor,
      alpha: 1.0
    });
  }

  /**
   * Destroy health bar and cleanup resources
   */
  public destroyHealthBar(healthBar: HealthBar): void {
    // Destroy container (includes graphics and text)
    healthBar.container.destroy({ children: true });
  }
}
