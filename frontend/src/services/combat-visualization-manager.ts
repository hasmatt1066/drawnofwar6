/**
 * TASK-VIZ-018: Combat Visualization Manager Core Implementation
 *
 * Main orchestrator for combat visual effects.
 * Manages all renderers and delegates based on state changes.
 */

import * as PIXI from 'pixi.js';
import { StateDiffDetector } from './state-diff-detector';
import { HealthBarRenderer, HealthBar } from './health-bar-renderer';
import { DamageNumberRenderer, DamageType, DamageNumber } from './damage-number-renderer';
import { DamageNumberPool } from './damage-number-pool';
import { ProjectileRenderer, VisualProjectile } from './projectile-renderer';
import { BuffIconRenderer, BuffIcon, BuffType } from './buff-icon-renderer';
import type { CombatState, CombatResult, Projectile } from '@drawn-of-war/shared/src/types/combat';
import type { CombatGridRenderer } from '../components/CombatGrid/CombatGridRenderer';
import type { DeploymentCreature } from '@drawn-of-war/shared/src/types/deployment';

/**
 * Socket client interface (minimal required methods)
 */
export interface CombatSocketClient {
  onCombatState(callback: (state: CombatState) => void): void;
  onCombatCompleted(callback: (result: CombatResult) => void): void;
  onError(callback: (error: Error) => void): void;
}

/**
 * Effect containers for layering
 */
export interface EffectContainers {
  projectiles: PIXI.Container;
  healthBars: PIXI.Container;
  buffIcons: PIXI.Container;
  damageNumbers: PIXI.Container;
}

/**
 * CombatVisualizationManager
 *
 * Orchestrates all combat visual effects in response to state changes.
 * Manages PixiJS containers, render loop, and event delegation.
 */
export class CombatVisualizationManager {
  private socketClient: CombatSocketClient;
  private stage: PIXI.Container;
  private gridRenderer: CombatGridRenderer;
  private stateDiffDetector: StateDiffDetector;

  private currentState: CombatState | null = null;
  private effectContainers: EffectContainers;

  private isRunning: boolean = false;
  private animationFrameId: number | null = null;
  private lastFrameTime: number = 0;

  private isDestroyed: boolean = false;

  // Health bar integration (TASK-VIZ-019)
  private healthBarRenderer: HealthBarRenderer;
  private healthBars: Map<string, HealthBar> = new Map();
  private unitsInCombat: Map<string, number> = new Map(); // unitId -> last combat timestamp
  private readonly COMBAT_TIMEOUT = 3000; // 3 seconds
  private readonly HEALTH_BAR_OFFSET_Y = 20; // pixels above sprite
  private timeoutCheckInterval: number | null = null;

  // Damage number integration (TASK-VIZ-020)
  private damageNumberRenderer: DamageNumberRenderer;
  private damageNumberPool: DamageNumberPool;
  private activeDamageNumbers: DamageNumber[] = [];

  // Projectile integration (TASK-VIZ-021)
  private projectileRenderer: ProjectileRenderer;
  private activeProjectiles: Map<string, VisualProjectile> = new Map();

  // Buff icon integration (TASK-VIZ-022)
  private buffIconRenderer: BuffIconRenderer;
  private activeBuffIcons: Map<string, BuffIcon> = new Map(); // buffId/debuffId -> icon
  private readonly BUFF_ICON_OFFSET_Y = 35; // pixels above sprite
  private readonly BUFF_ICON_SPACING = 24; // horizontal spacing between icons

  // Creature sprite data map (creatureId -> DeploymentCreature)
  private creatureDataMap: Map<string, DeploymentCreature> = new Map();

  constructor(
    socketClient: CombatSocketClient,
    stage: PIXI.Container,
    gridRenderer: CombatGridRenderer
  ) {
    this.socketClient = socketClient;
    this.stage = stage;
    this.gridRenderer = gridRenderer;
    this.stateDiffDetector = new StateDiffDetector();

    // Initialize renderers
    this.healthBarRenderer = new HealthBarRenderer();
    this.damageNumberRenderer = new DamageNumberRenderer();
    this.damageNumberPool = new DamageNumberPool(this.damageNumberRenderer);
    this.projectileRenderer = new ProjectileRenderer();
    this.buffIconRenderer = new BuffIconRenderer();

    // Create effect container layers
    this.effectContainers = {
      projectiles: new PIXI.Container(),
      healthBars: new PIXI.Container(),
      buffIcons: new PIXI.Container(),
      damageNumbers: new PIXI.Container()
    };

    // Add containers to stage in correct layer order
    // (bottom to top: projectiles, health bars, buff icons, damage numbers)
    this.stage.addChild(this.effectContainers.projectiles);
    this.stage.addChild(this.effectContainers.healthBars);
    this.stage.addChild(this.effectContainers.buffIcons);
    this.stage.addChild(this.effectContainers.damageNumbers);

    // Subscribe to socket events
    this.socketClient.onCombatState(this.handleStateUpdate.bind(this));
    this.socketClient.onCombatCompleted(this.handleCombatCompleted.bind(this));
    this.socketClient.onError(this.handleError.bind(this));

    // Start timeout check interval (every 100ms)
    this.timeoutCheckInterval = setInterval(() => this.checkHealthBarTimeouts(), 100) as unknown as number;
  }

  /**
   * Start the render loop
   */
  public start(): void {
    if (this.isRunning || this.isDestroyed) {
      return;
    }

    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.renderLoop();
  }

  /**
   * Stop the render loop
   */
  public stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Stop timeout check interval
    if (this.timeoutCheckInterval !== null) {
      clearInterval(this.timeoutCheckInterval);
      this.timeoutCheckInterval = null;
    }
  }

  /**
   * Set state (for reconnection)
   */
  public setState(state: CombatState): void {
    if (this.isDestroyed) {
      return;
    }

    this.currentState = state;

    // Reset diff detector with new state
    this.stateDiffDetector = new StateDiffDetector();
    this.stateDiffDetector.detectChanges(state);
  }

  /**
   * Get current state
   */
  public getCurrentState(): CombatState | null {
    return this.currentState;
  }

  /**
   * Set creature sprite data map
   * This should be called before combat starts to provide sprite data for rendering
   */
  public setCreatureData(creatures: DeploymentCreature[]): void {
    this.creatureDataMap.clear();
    for (const creature of creatures) {
      this.creatureDataMap.set(creature.id, creature);
    }
    console.log('[CombatVisualizationManager] Loaded sprite data for', creatures.length, 'creatures');
  }

  /**
   * Get effect containers
   */
  public getEffectContainers(): EffectContainers {
    return this.effectContainers;
  }

  /**
   * Get units currently in combat (TASK-VIZ-019)
   */
  public getUnitsInCombat(): Map<string, number> {
    return new Map(this.unitsInCombat);
  }

  /**
   * Get active health bars (TASK-VIZ-019)
   */
  public getHealthBars(): Map<string, HealthBar> {
    return new Map(this.healthBars);
  }

  /**
   * Get active damage numbers (TASK-VIZ-020)
   */
  public getActiveDamageNumbers(): DamageNumber[] {
    return [...this.activeDamageNumbers];
  }

  /**
   * Get damage number pool statistics (TASK-VIZ-020)
   */
  public getDamageNumberPoolStats() {
    return this.damageNumberPool.getStatistics();
  }

  /**
   * Update damage number animations (TASK-VIZ-020)
   */
  public updateDamageNumbers(deltaTime: number): void {
    const currentTime = Date.now();
    const completedIndices: number[] = [];

    for (let i = 0; i < this.activeDamageNumbers.length; i++) {
      const damageNumber = this.activeDamageNumbers[i];

      this.damageNumberRenderer.updateAnimation(damageNumber, currentTime);

      if (damageNumber.isComplete) {
        // Remove from container
        this.effectContainers.damageNumbers.removeChild(damageNumber.container);

        // Return to pool
        this.damageNumberPool.release(damageNumber);

        completedIndices.push(i);
      }
    }

    // Remove completed damage numbers (reverse order to maintain indices)
    for (let i = completedIndices.length - 1; i >= 0; i--) {
      this.activeDamageNumbers.splice(completedIndices[i], 1);
    }
  }

  /**
   * Get active projectiles (TASK-VIZ-021)
   */
  public getActiveProjectiles(): VisualProjectile[] {
    return Array.from(this.activeProjectiles.values());
  }

  /**
   * Get active buff icons (TASK-VIZ-022)
   */
  public getActiveBuffIcons(): BuffIcon[] {
    return Array.from(this.activeBuffIcons.values());
  }

  /**
   * Destroy and cleanup
   */
  public destroy(): void {
    if (this.isDestroyed) {
      return;
    }

    this.isDestroyed = true;

    // Stop render loop
    this.stop();

    // Remove effect containers from stage
    this.stage.removeChild(this.effectContainers.projectiles);
    this.stage.removeChild(this.effectContainers.healthBars);
    this.stage.removeChild(this.effectContainers.buffIcons);
    this.stage.removeChild(this.effectContainers.damageNumbers);

    // Destroy containers
    this.effectContainers.projectiles.destroy({ children: true });
    this.effectContainers.healthBars.destroy({ children: true });
    this.effectContainers.buffIcons.destroy({ children: true });
    this.effectContainers.damageNumbers.destroy({ children: true });

    // Cleanup damage number pool
    this.damageNumberPool.destroy();
    this.activeDamageNumbers = [];

    // Cleanup projectiles
    for (const visualProjectile of this.activeProjectiles.values()) {
      this.projectileRenderer.destroyProjectile(visualProjectile);
    }
    this.activeProjectiles.clear();

    // Cleanup buff icons
    for (const buffIcon of this.activeBuffIcons.values()) {
      this.buffIconRenderer.destroyBuffIcon(buffIcon);
    }
    this.activeBuffIcons.clear();

    this.currentState = null;
  }

  /**
   * Handle state update from socket
   */
  private handleStateUpdate(state: CombatState): void {
    if (this.isDestroyed || !state) {
      return;
    }

    try {
      // Store current state
      this.currentState = state;

      // Detect changes from previous state
      const events = this.stateDiffDetector.detectChanges(state);

      // CRITICAL: Render units on the grid FIRST (other systems depend on sprite positions)
      this.renderUnits(state);

      // TASK-VIZ-019: Manage health bars
      this.manageHealthBars(state, events);

      // TASK-VIZ-020: Manage damage numbers
      this.manageDamageNumbers(state, events);

      // TASK-VIZ-021: Manage projectiles
      this.manageProjectiles(state, events);

      // TASK-VIZ-022: Manage buff icons
      this.manageBuffIcons(state, events);

      // Process events
      this.processEvents(events);
    } catch (error) {
      console.error('Error processing state update:', error);
    }
  }

  /**
   * Handle combat completed
   */
  private handleCombatCompleted(result: CombatResult): void {
    if (this.isDestroyed) {
      return;
    }

    // Stop render loop when combat ends
    this.stop();

    // TODO: Show victory/defeat screen (TASK-VIZ-023)
  }

  /**
   * Handle errors
   */
  private handleError(error: Error): void {
    console.error('Combat visualization error:', error);
  }

  /**
   * Process detected events
   */
  private processEvents(events: any): void {
    // Placeholder - actual delegation will be implemented in integration tasks
    // TASK-VIZ-019: Health bars
    // TASK-VIZ-020: Damage numbers
    // TASK-VIZ-021: Projectiles
    // TASK-VIZ-022: Buff icons
  }

  /**
   * Render all units from combat state on the grid
   * This is the critical integration between combat state and visual rendering
   */
  private renderUnits(state: CombatState): void {
    console.log('[CombatVisualizationManager] renderUnits - Rendering', state.units.length, 'units');

    // Render all alive units
    for (const unit of state.units) {
      if (unit.status === 'alive') {
        // Look up creature sprite data from the map
        const creatureData = this.creatureDataMap.get(unit.creatureId);

        if (!creatureData) {
          console.warn('[CombatVisualizationManager] No sprite data for creature:', unit.creatureId);
        }

        // Use the base renderer's renderCreature method (static sprites for now)
        // TODO: Upgrade to renderAnimatedCreature for animations
        try {
          this.gridRenderer.renderCreature(
            unit.position,
            unit.creatureId,
            unit.ownerId,
            creatureData, // spriteData - now includes full DeploymentCreature with sprites
            1.0, // full opacity
            unit.facingDirection || 1 // facing direction
          );

          console.log('[CombatVisualizationManager] Rendered unit:', {
            unitId: unit.unitId,
            creatureId: unit.creatureId,
            position: unit.position,
            ownerId: unit.ownerId,
            hasSpriteData: !!creatureData
          });
        } catch (error) {
          console.error('[CombatVisualizationManager] Error rendering unit:', unit.unitId, error);
        }
      }
    }
  }

  /**
   * Manage health bars for units in combat (TASK-VIZ-019)
   */
  private manageHealthBars(state: CombatState, events: any): void {
    const currentTime = Date.now();

    // Track units entering combat
    // 1. From damage events
    for (const damage of events.damages || []) {
      this.unitsInCombat.set(damage.unitId, currentTime);
    }

    // 2. From units with currentTarget
    for (const unit of state.units) {
      if (unit.currentTarget) {
        this.unitsInCombat.set(unit.unitId, currentTime);
      }
    }

    // Create/update health bars for units in combat
    for (const unit of state.units) {
      if (this.unitsInCombat.has(unit.unitId)) {
        // Check if unit still has target (keeps health bar active)
        if (unit.currentTarget) {
          this.unitsInCombat.set(unit.unitId, currentTime);
        }

        // Get sprite position
        const spriteData = this.gridRenderer.getSpriteAt(unit.position);
        if (!spriteData?.sprite) {
          continue; // Skip if no sprite position available
        }

        const position = {
          x: spriteData.sprite.x,
          y: spriteData.sprite.y - this.HEALTH_BAR_OFFSET_Y
        };

        // Get or create health bar
        let healthBar = this.healthBars.get(unit.unitId);

        if (!healthBar) {
          // Create new health bar
          healthBar = this.healthBarRenderer.createHealthBar(unit.health, unit.maxHealth, position);
          this.healthBars.set(unit.unitId, healthBar);
          this.effectContainers.healthBars.addChild(healthBar.container);
        } else {
          // Update existing health bar
          this.healthBarRenderer.updateHealthBar(healthBar, unit.health, unit.maxHealth);

          // Update position
          healthBar.container.x = position.x;
          healthBar.container.y = position.y;
        }
      }
    }

    // Check for dead or removed units (immediate removal)
    const unitsToRemove: string[] = [];

    for (const [unitId] of this.unitsInCombat.entries()) {
      const unit = state.units.find(u => u.unitId === unitId);

      // Remove if unit is dead or removed from state
      if (!unit || unit.status === 'dead') {
        unitsToRemove.push(unitId);
      }
    }

    // Clean up removed units
    for (const unitId of unitsToRemove) {
      this.removeHealthBar(unitId);
    }
  }

  /**
   * Manage damage numbers for damage/healing events (TASK-VIZ-020)
   */
  private manageDamageNumbers(state: CombatState, events: any): void {
    // Create damage numbers for damage events
    for (const damageEvent of events.damages || []) {
      const unit = state.units.find(u => u.unitId === damageEvent.unitId);
      if (!unit) continue;

      // Get sprite position
      const spriteData = this.gridRenderer.getSpriteAt(unit.position);
      if (!spriteData?.sprite) continue;

      const position = {
        x: spriteData.sprite.x,
        y: spriteData.sprite.y
      };

      // Create damage number from pool
      const damageNumber = this.damageNumberPool.acquire(
        damageEvent.damageAmount,
        DamageType.PHYSICAL, // TODO: Determine type from event
        position
      );

      // Add to container and tracking
      this.effectContainers.damageNumbers.addChild(damageNumber.container);
      this.activeDamageNumbers.push(damageNumber);
    }

    // Create healing numbers for heal events
    for (const healEvent of events.heals || []) {
      const unit = state.units.find(u => u.unitId === healEvent.unitId);
      if (!unit) continue;

      // Get sprite position
      const spriteData = this.gridRenderer.getSpriteAt(unit.position);
      if (!spriteData?.sprite) continue;

      const position = {
        x: spriteData.sprite.x,
        y: spriteData.sprite.y
      };

      // Create healing number from pool
      const healNumber = this.damageNumberPool.acquire(
        healEvent.healAmount,
        DamageType.HEAL,
        position
      );

      // Add to container and tracking
      this.effectContainers.damageNumbers.addChild(healNumber.container);
      this.activeDamageNumbers.push(healNumber);
    }
  }

  /**
   * Manage projectiles for ranged attacks (TASK-VIZ-021)
   */
  private manageProjectiles(state: CombatState, events: any): void {
    // Get current projectile IDs from state
    const currentProjectileIds = new Set(state.projectiles.map(p => p.projectileId));

    // Remove projectiles that are no longer in state
    for (const [projectileId, visualProjectile] of this.activeProjectiles.entries()) {
      if (!currentProjectileIds.has(projectileId)) {
        // Remove from container
        this.effectContainers.projectiles.removeChild(visualProjectile.sprite);

        // Destroy sprite
        this.projectileRenderer.destroyProjectile(visualProjectile);

        // Remove from tracking
        this.activeProjectiles.delete(projectileId);
      }
    }

    // Create or update projectiles
    for (const projectile of state.projectiles) {
      let visualProjectile = this.activeProjectiles.get(projectile.projectileId);

      if (!visualProjectile) {
        // Create new projectile
        const sourcePixels = this.hexToPixel(projectile.sourcePosition);
        const targetPixels = this.hexToPixel(projectile.targetPosition);

        visualProjectile = this.projectileRenderer.createVisualProjectile(
          projectile.projectileId,
          sourcePixels,
          targetPixels,
          projectile.spritePath || 'arrow.png'
        );

        // Add to container and tracking
        this.effectContainers.projectiles.addChild(visualProjectile.sprite);
        this.activeProjectiles.set(projectile.projectileId, visualProjectile);
      }

      // Update position
      const currentPixels = this.hexToPixel(projectile.currentPosition);
      visualProjectile.sprite.x = currentPixels.x;
      visualProjectile.sprite.y = currentPixels.y;

      // Update rotation to face target
      const targetPixels = this.hexToPixel(projectile.targetPosition);
      const dx = targetPixels.x - currentPixels.x;
      const dy = targetPixels.y - currentPixels.y;
      visualProjectile.sprite.rotation = Math.atan2(dy, dx);
    }
  }

  /**
   * Convert hex coordinates to pixel coordinates
   */
  private hexToPixel(hexCoord: { q: number; r: number }): { x: number; y: number } {
    const spriteData = this.gridRenderer.getSpriteAt(hexCoord);
    if (spriteData?.sprite) {
      return { x: spriteData.sprite.x, y: spriteData.sprite.y };
    }
    // Fallback to simple calculation if grid renderer doesn't have the position
    return { x: hexCoord.q * 100, y: hexCoord.r * 100 };
  }

  /**
   * Manage buff icons for units (TASK-VIZ-022)
   */
  private manageBuffIcons(state: CombatState, events: any): void {
    // Collect all current buff/debuff IDs from state
    const currentBuffIds = new Set<string>();
    const buffsByUnit = new Map<string, Array<{ id: string; name: string; duration: number; isBuff: boolean }>>();

    for (const unit of state.units) {
      const unitBuffs: Array<{ id: string; name: string; duration: number; isBuff: boolean }> = [];

      // Add buffs
      for (const buff of unit.activeBuffs || []) {
        currentBuffIds.add(buff.buffId);
        unitBuffs.push({
          id: buff.buffId,
          name: buff.name,
          duration: buff.durationRemaining,
          isBuff: true
        });
      }

      // Add debuffs
      for (const debuff of unit.activeDebuffs || []) {
        currentBuffIds.add(debuff.debuffId);
        unitBuffs.push({
          id: debuff.debuffId,
          name: debuff.name,
          duration: debuff.durationRemaining,
          isBuff: false
        });
      }

      if (unitBuffs.length > 0) {
        buffsByUnit.set(unit.unitId, unitBuffs);
      }
    }

    // Remove buff icons that are no longer in state
    for (const [buffId, buffIcon] of this.activeBuffIcons.entries()) {
      if (!currentBuffIds.has(buffId)) {
        // Remove from container
        this.effectContainers.buffIcons.removeChild(buffIcon.container);

        // Destroy icon
        this.buffIconRenderer.destroyBuffIcon(buffIcon);

        // Remove from tracking
        this.activeBuffIcons.delete(buffId);
      }
    }

    // Create or update buff icons for each unit
    for (const unit of state.units) {
      const unitBuffs = buffsByUnit.get(unit.unitId);
      if (!unitBuffs) continue;

      // Get sprite position for this unit
      const spriteData = this.gridRenderer.getSpriteAt(unit.position);
      if (!spriteData?.sprite) continue;

      const spriteX = spriteData.sprite.x;
      const spriteY = spriteData.sprite.y;

      // Calculate starting position for buff icons (centered above unit)
      const totalWidth = unitBuffs.length * this.BUFF_ICON_SPACING;
      const startX = spriteX - (totalWidth / 2) + (this.BUFF_ICON_SPACING / 2);

      // Create or update icons
      for (let i = 0; i < unitBuffs.length; i++) {
        const buffData = unitBuffs[i];
        let buffIcon = this.activeBuffIcons.get(buffData.id);

        if (!buffIcon) {
          // Create new buff icon
          const iconPosition = {
            x: startX + (i * this.BUFF_ICON_SPACING),
            y: spriteY - this.BUFF_ICON_OFFSET_Y
          };

          const buffType = this.mapBuffNameToType(buffData.name);

          buffIcon = this.buffIconRenderer.createBuffIcon(
            buffType,
            iconPosition,
            { duration: buffData.duration }
          );

          // Add to container and tracking
          this.effectContainers.buffIcons.addChild(buffIcon.container);
          this.activeBuffIcons.set(buffData.id, buffIcon);
        } else {
          // Update existing icon position and duration
          buffIcon.container.x = startX + (i * this.BUFF_ICON_SPACING);
          buffIcon.container.y = spriteY - this.BUFF_ICON_OFFSET_Y;

          this.buffIconRenderer.updateBuffIcon(buffIcon, {
            duration: buffData.duration,
            position: {
              x: startX + (i * this.BUFF_ICON_SPACING),
              y: spriteY - this.BUFF_ICON_OFFSET_Y
            }
          });
        }
      }
    }
  }

  /**
   * Map buff/debuff name to BuffType enum
   */
  private mapBuffNameToType(name: string): BuffType {
    const lowerName = name.toLowerCase();

    if (lowerName.includes('poison')) return BuffType.POISON;
    if (lowerName.includes('burn')) return BuffType.BURN;
    if (lowerName.includes('regen')) return BuffType.REGENERATION;
    if (lowerName.includes('shield')) return BuffType.SHIELD;
    if (lowerName.includes('stun')) return BuffType.STUN;
    if (lowerName.includes('haste') || lowerName.includes('speed')) return BuffType.HASTE;
    if (lowerName.includes('slow')) return BuffType.SLOW;

    // Default based on whether it's typically a buff or debuff
    return BuffType.SHIELD; // Safe default
  }

  /**
   * Check for health bar timeouts (called periodically)
   */
  private checkHealthBarTimeouts(): void {
    if (!this.currentState) {
      return;
    }

    const currentTime = Date.now();
    const unitsToRemove: string[] = [];

    for (const [unitId, lastCombatTime] of this.unitsInCombat.entries()) {
      const unit = this.currentState.units.find(u => u.unitId === unitId);

      // Skip if unit doesn't exist
      if (!unit) {
        continue;
      }

      // Remove if timeout expired and unit has no target
      const timeSinceLastCombat = currentTime - lastCombatTime;
      if (timeSinceLastCombat >= this.COMBAT_TIMEOUT && !unit.currentTarget) {
        unitsToRemove.push(unitId);
      }
    }

    // Clean up timed-out units
    for (const unitId of unitsToRemove) {
      this.removeHealthBar(unitId);
    }
  }

  /**
   * Remove health bar for a unit
   */
  private removeHealthBar(unitId: string): void {
    this.unitsInCombat.delete(unitId);

    const healthBar = this.healthBars.get(unitId);
    if (healthBar) {
      this.effectContainers.healthBars.removeChild(healthBar.container);
      this.healthBarRenderer.destroyHealthBar(healthBar);
      this.healthBars.delete(unitId);
    }
  }

  /**
   * Main render loop
   */
  private renderLoop(): void {
    if (!this.isRunning) {
      return;
    }

    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastFrameTime;
    this.lastFrameTime = currentTime;

    try {
      // Render frame
      this.renderFrame(deltaTime);
    } catch (error) {
      console.error('Error in render loop:', error);
    }

    // Schedule next frame
    this.animationFrameId = requestAnimationFrame(() => this.renderLoop());
  }

  /**
   * Render a single frame
   */
  private renderFrame(deltaTime: number): void {
    // TODO: Update animations
    // - Update damage number animations
    // - Update projectile positions
    // - Update buff icon durations
    // - Update health bar values

    // This will be implemented in integration tasks
  }
}
