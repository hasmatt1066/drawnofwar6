/**
 * TASK-COMBAT-VIZ-015: Buff/Debuff Icon Renderer Implementation
 *
 * Renders status effect icons above combat units.
 * Supports duration timers and stack counts.
 */

import * as PIXI from 'pixi.js';

/**
 * Buff/Debuff type enumeration
 */
export enum BuffType {
  POISON = 'poison',
  BURN = 'burn',
  REGENERATION = 'regeneration',
  SHIELD = 'shield',
  STUN = 'stun',
  HASTE = 'haste',
  SLOW = 'slow'
}

/**
 * Buff icon renderer configuration
 */
export interface BuffIconConfig {
  iconSize?: number;
  showDuration?: boolean;
  showStacks?: boolean;
}

/**
 * Visual properties for buff types
 */
export interface BuffProperties {
  color: number;
  isDebuff: boolean;
}

/**
 * Optional buff data
 */
export interface BuffIconData {
  duration?: number;
  stacks?: number;
}

/**
 * Update parameters for buff icons
 */
export interface BuffIconUpdate {
  duration?: number;
  stacks?: number;
  position?: { x: number; y: number };
}

/**
 * Text display for buff info
 */
export interface BuffText {
  text: PIXI.Text;
  container: PIXI.Container;
}

/**
 * Buff icon data structure
 */
export interface BuffIcon {
  container: PIXI.Container;
  iconGraphics: PIXI.Graphics;
  type: BuffType;
  duration?: number;
  stacks?: number;
  durationText?: BuffText;
  stackText?: BuffText;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<BuffIconConfig> = {
  iconSize: 20,
  showDuration: false,
  showStacks: false
};

/**
 * Visual properties for each buff type
 */
const BUFF_PROPERTIES: Record<BuffType, BuffProperties> = {
  [BuffType.POISON]: {
    color: 0x9944cc,  // Purple
    isDebuff: true
  },
  [BuffType.BURN]: {
    color: 0xff4400,  // Orange-red
    isDebuff: true
  },
  [BuffType.REGENERATION]: {
    color: 0x44ff44,  // Green
    isDebuff: false
  },
  [BuffType.SHIELD]: {
    color: 0x4488ff,  // Blue
    isDebuff: false
  },
  [BuffType.STUN]: {
    color: 0xffaa00,  // Yellow-orange
    isDebuff: true
  },
  [BuffType.HASTE]: {
    color: 0x00ffff,  // Cyan
    isDebuff: false
  },
  [BuffType.SLOW]: {
    color: 0x8888ff,  // Light blue
    isDebuff: true
  }
};

/**
 * BuffIconRenderer
 *
 * Service for creating and managing status effect icons.
 * Displays buff/debuff indicators with optional timers and stacks.
 */
export class BuffIconRenderer {
  private config: Required<BuffIconConfig>;

  constructor(config: BuffIconConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get current configuration
   */
  public getConfig(): Required<BuffIconConfig> {
    return { ...this.config };
  }

  /**
   * Get visual properties for a buff type
   */
  public getBuffProperties(type: BuffType): BuffProperties {
    return { ...BUFF_PROPERTIES[type] };
  }

  /**
   * Create a new buff icon
   */
  public createBuffIcon(
    type: BuffType,
    position: { x: number; y: number },
    data?: BuffIconData
  ): BuffIcon {
    const props = this.getBuffProperties(type);
    const container = new PIXI.Container();

    container.x = position.x;
    container.y = position.y;

    // Create icon graphics (circular background)
    const iconGraphics = new PIXI.Graphics();
    const radius = this.config.iconSize / 2;

    iconGraphics.circle(0, 0, radius);
    iconGraphics.fill({ color: props.color, alpha: 0.8 });

    // Add border
    iconGraphics.circle(0, 0, radius);
    iconGraphics.stroke({ width: 2, color: 0xffffff, alpha: 1.0 });

    container.addChild(iconGraphics);

    const buffIcon: BuffIcon = {
      container,
      iconGraphics,
      type,
      duration: data?.duration,
      stacks: data?.stacks
    };

    // Add duration text if enabled and provided
    if (this.config.showDuration && data?.duration !== undefined) {
      buffIcon.durationText = this.createText(data.duration.toFixed(1));
      buffIcon.durationText.text.y = radius + 4; // Below icon
      container.addChild(buffIcon.durationText.text);
    }

    // Add stack text if enabled and provided (and > 1)
    if (this.config.showStacks && data?.stacks !== undefined && data.stacks > 1) {
      buffIcon.stackText = this.createText(data.stacks.toString());
      buffIcon.stackText.text.x = radius - 6; // Top right corner
      buffIcon.stackText.text.y = -radius + 2;
      container.addChild(buffIcon.stackText.text);
    }

    return buffIcon;
  }

  /**
   * Create text element
   */
  private createText(content: string): BuffText {
    const text = new PIXI.Text({
      text: content,
      style: {
        fontSize: 10,
        fill: 0xffffff,
        stroke: { color: 0x000000, width: 2 },
        align: 'center'
      }
    });

    text.anchor.set(0.5);

    const textContainer = new PIXI.Container();
    textContainer.addChild(text);

    return { text, container: textContainer };
  }

  /**
   * Update buff icon
   */
  public updateBuffIcon(icon: BuffIcon, update: BuffIconUpdate): void {
    // Update position
    if (update.position) {
      icon.container.x = update.position.x;
      icon.container.y = update.position.y;
    }

    // Update duration
    if (update.duration !== undefined) {
      icon.duration = update.duration;

      if (icon.durationText) {
        icon.durationText.text.text = update.duration.toFixed(1);
      }
    }

    // Update stacks
    if (update.stacks !== undefined) {
      icon.stacks = update.stacks;

      if (icon.stackText) {
        icon.stackText.text.text = update.stacks.toString();
      }
    }
  }

  /**
   * Destroy buff icon and cleanup resources
   */
  public destroyBuffIcon(icon: BuffIcon): void {
    // Destroy text elements
    if (icon.durationText) {
      icon.durationText.text.destroy();
      icon.durationText.container.destroy();
    }

    if (icon.stackText) {
      icon.stackText.text.destroy();
      icon.stackText.container.destroy();
    }

    // Destroy graphics and container
    icon.iconGraphics.destroy();
    icon.container.destroy();
  }
}
