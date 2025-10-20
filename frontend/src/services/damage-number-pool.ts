/**
 * TASK-VIZ-017: Damage Number Pool Implementation
 *
 * Object pooling system for damage numbers.
 * Uses lazy allocation with recycling for efficient memory management.
 */

import { DamageNumberRenderer, DamageType, DamageNumber } from './damage-number-renderer';

/**
 * Pool configuration
 */
export interface DamageNumberPoolConfig {
  maxSize?: number;
}

/**
 * Pool statistics
 */
export interface PoolStatistics {
  totalAcquisitions: number;
  reuseCount: number;
  recycleCount: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<DamageNumberPoolConfig> = {
  maxSize: 20
};

/**
 * DamageNumberPool
 *
 * Object pool for damage numbers following game dev best practices.
 * - Lazy allocation: Creates objects on demand
 * - Recycling: Reuses objects from pool when available
 * - Overflow handling: Recycles oldest active when pool exhausted
 */
export class DamageNumberPool {
  private config: Required<DamageNumberPoolConfig>;
  private renderer: DamageNumberRenderer;
  private pool: DamageNumber[] = [];
  private active: Set<DamageNumber> = new Set();
  private stats: PoolStatistics = {
    totalAcquisitions: 0,
    reuseCount: 0,
    recycleCount: 0
  };

  constructor(renderer: DamageNumberRenderer, config: DamageNumberPoolConfig = {}) {
    this.renderer = renderer;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Acquire a damage number from the pool
   */
  public acquire(
    value: number,
    type: DamageType,
    position: { x: number; y: number }
  ): DamageNumber {
    this.stats.totalAcquisitions++;

    let damageNumber: DamageNumber;

    // Try to get from pool first (reuse)
    if (this.pool.length > 0) {
      damageNumber = this.pool.pop()!;
      this.resetDamageNumber(damageNumber, value, type, position);
      this.stats.reuseCount++;
    }
    // Create new if under max size
    else if (this.active.size < this.config.maxSize) {
      damageNumber = this.renderer.createDamageNumber(value, type, position);
    }
    // Pool exhausted - recycle oldest active
    else {
      const oldest = this.getOldestActive();
      if (oldest) {
        this.active.delete(oldest);
        this.resetDamageNumber(oldest, value, type, position);
        damageNumber = oldest;
        this.stats.recycleCount++;
      } else {
        // Fallback: create new (shouldn't happen unless maxSize = 0)
        damageNumber = this.renderer.createDamageNumber(value, type, position);
      }
    }

    this.active.add(damageNumber);
    return damageNumber;
  }

  /**
   * Release a damage number back to the pool
   */
  public release(damageNumber: DamageNumber): void {
    // Remove from active
    if (!this.active.delete(damageNumber)) {
      // Not in active set, already released
      return;
    }

    // Hide but don't destroy
    damageNumber.container.visible = false;

    // Add to pool for reuse
    this.pool.push(damageNumber);
  }

  /**
   * Reset damage number properties for reuse
   */
  private resetDamageNumber(
    damageNumber: DamageNumber,
    value: number,
    type: DamageType,
    position: { x: number; y: number }
  ): void {
    // Update value and type
    damageNumber.value = Math.round(Math.abs(value));
    damageNumber.type = type;

    // Update text
    let displayText = damageNumber.value.toString();
    if (type === DamageType.HEAL) {
      displayText = `+${damageNumber.value}`;
    }
    damageNumber.text.text = displayText;

    // Update text color
    const color = this.renderer.getColor(type);
    damageNumber.text.style.fill = color;

    // Update font size for critical hits
    if (type === DamageType.CRITICAL) {
      damageNumber.text.style.fontSize = this.renderer.getConfig().fontSize * 1.5;
      damageNumber.text.style.fontWeight = 'bold';
    } else {
      damageNumber.text.style.fontSize = this.renderer.getConfig().fontSize;
      damageNumber.text.style.fontWeight = 'normal';
    }

    // Reset position
    damageNumber.container.x = position.x;
    damageNumber.container.y = position.y;
    damageNumber.initialY = position.y;

    // Reset animation state
    damageNumber.container.alpha = 1.0;
    damageNumber.container.visible = true;
    damageNumber.isComplete = false;
    damageNumber.startTime = performance.now();
  }

  /**
   * Get oldest active damage number (for recycling)
   */
  private getOldestActive(): DamageNumber | null {
    if (this.active.size === 0) {
      return null;
    }

    return Array.from(this.active).reduce((oldest, current) =>
      current.startTime < oldest.startTime ? current : oldest
    );
  }

  /**
   * Get number of active damage numbers
   */
  public getActiveCount(): number {
    return this.active.size;
  }

  /**
   * Get number of pooled damage numbers
   */
  public getPoolSize(): number {
    return this.pool.length;
  }

  /**
   * Get maximum pool size
   */
  public getMaxSize(): number {
    return this.config.maxSize;
  }

  /**
   * Get pool statistics
   */
  public getStatistics(): PoolStatistics {
    return { ...this.stats };
  }

  /**
   * Destroy all damage numbers and cleanup
   */
  public destroy(): void {
    // Destroy all active
    for (const damageNumber of this.active) {
      this.renderer.destroyDamageNumber(damageNumber);
    }

    // Destroy all pooled
    for (const damageNumber of this.pool) {
      this.renderer.destroyDamageNumber(damageNumber);
    }

    this.active.clear();
    this.pool = [];
  }
}
