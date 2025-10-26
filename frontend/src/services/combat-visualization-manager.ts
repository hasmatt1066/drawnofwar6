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
import { PositionInterpolator } from './position-interpolator';
import { UnitLifecycleTracker } from './unit-lifecycle-tracker';
import { UnitAnimationStateMachine, AnimationState } from './unit-animation-state-machine';
import type { CombatState, CombatResult, Projectile } from '@drawn-of-war/shared/src/types/combat';
import type { AxialCoordinate } from '@drawn-of-war/shared';
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
  private previousState: CombatState | null = null;
  private lastStateUpdateTime: number = 0;
  private effectContainers: EffectContainers;

  // Position interpolation (TASK-RENDER-006)
  private positionInterpolator: PositionInterpolator;
  private readonly STATE_UPDATE_INTERVAL = 100; // 100ms = 10 Hz (server tick rate)

  // Sprite lifecycle management (TASK-RENDER-007)
  private unitLifecycleTracker: UnitLifecycleTracker;
  private activeSpriteUnits: Set<string> = new Set(); // Track which units have sprites

  // Animation state management (TASK-COMBAT-VIZ-007)
  private animationStateMachine: UnitAnimationStateMachine;

  private isRunning: boolean = false;
  private lastFrameTime: number = 0;
  private renderLoopId: number | null = null;

  private isDestroyed: boolean = false;

  // Health bar integration (TASK-VIZ-019)
  private healthBarRenderer: HealthBarRenderer;
  private healthBars: Map<string, HealthBar> = new Map();
  private unitsInCombat: Map<string, number> = new Map(); // unitId -> last combat timestamp
  private readonly COMBAT_TIMEOUT = 3000; // 3 seconds
  private readonly HEALTH_BAR_OFFSET_Y = 20; // pixels above sprite
  private readonly MAX_DELTA_TIME = 0.1; // Maximum delta time (100ms) to prevent huge jumps from tab backgrounding
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
    gridRenderer: CombatGridRenderer
  ) {
    this.socketClient = socketClient;
    this.gridRenderer = gridRenderer;

    console.log('[CombatVisualizationManager] Constructor - gridRenderer:', gridRenderer);
    console.log('[CombatVisualizationManager] Constructor - typeof gridRenderer.getStage:', typeof gridRenderer.getStage);

    const stage = gridRenderer.getStage();
    console.log('[CombatVisualizationManager] Constructor - stage:', stage);
    console.log('[CombatVisualizationManager] Constructor - stage type:', typeof stage);
    console.log('[CombatVisualizationManager] Constructor - stage.addChild:', typeof stage?.addChild);

    this.stage = stage;
    this.stateDiffDetector = new StateDiffDetector();

    // Initialize renderers
    this.healthBarRenderer = new HealthBarRenderer();
    this.damageNumberRenderer = new DamageNumberRenderer();
    this.damageNumberPool = new DamageNumberPool(this.damageNumberRenderer);
    this.projectileRenderer = new ProjectileRenderer();
    this.buffIconRenderer = new BuffIconRenderer();

    // Initialize position interpolator (TASK-RENDER-006)
    this.positionInterpolator = new PositionInterpolator();

    // Initialize unit lifecycle tracker (TASK-RENDER-007)
    this.unitLifecycleTracker = new UnitLifecycleTracker();
    this.setupLifecycleEventListeners();

    // Initialize animation state machine (TASK-COMBAT-VIZ-007)
    this.animationStateMachine = new UnitAnimationStateMachine();
    this.setupAnimationStateListeners();

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
   * Start the visualization manager with 60 FPS render loop
   */
  public start(): void {
    console.log('[CombatVisualizationManager] start() called - isRunning:', this.isRunning, 'isDestroyed:', this.isDestroyed);

    if (this.isRunning || this.isDestroyed) {
      console.warn('[CombatVisualizationManager] Cannot start - already running or destroyed');
      return;
    }

    this.isRunning = true;
    this.startRenderLoop();
    console.log('[CombatVisualizationManager] Started with render loop');
  }

  /**
   * Stop the render loop
   */
  public stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    this.stopRenderLoop();

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

    // Cleanup sprite lifecycle tracker (TASK-RENDER-007)
    this.unitLifecycleTracker.clear();
    this.activeSpriteUnits.clear();

    this.currentState = null;
  }

  /**
   * Setup lifecycle event listeners (TASK-RENDER-007)
   */
  private setupLifecycleEventListeners(): void {
    // Listen for unit spawns
    this.unitLifecycleTracker.onUnitSpawned((event) => {
      // Mark unit as having a sprite
      this.activeSpriteUnits.add(event.unitId);
      console.log('[CombatVisualizationManager] Unit spawned:', event.unitId);
    });

    // Listen for unit despawns
    this.unitLifecycleTracker.onUnitDespawned((event) => {
      // Remove sprite via grid renderer
      if (this.gridRenderer.removeCreatureById) {
        this.gridRenderer.removeCreatureById(event.unitId);
      }

      // Remove from active sprite registry
      this.activeSpriteUnits.delete(event.unitId);
      console.log('[CombatVisualizationManager] Unit despawned:', event.unitId);
    });
  }

  /**
   * Setup animation state listeners (TASK-COMBAT-VIZ-007)
   */
  private setupAnimationStateListeners(): void {
    // Listen for animation state transitions
    this.animationStateMachine.onStateChange((transition) => {
      console.log('[CombatVisualizationManager] Animation state transition:', {
        unitId: transition.unitId,
        from: transition.previousState,
        to: transition.newState
      });

      // Tell the renderer to change animation state
      if (this.gridRenderer.changeAnimationState) {
        this.gridRenderer.changeAnimationState(transition.unitId, transition.newState);
      } else {
        console.warn('[CombatVisualizationManager] Renderer does not support changeAnimationState()');
      }
    });

    // Listen for animation completions from the renderer
    if (this.gridRenderer.onAnimationComplete) {
      this.gridRenderer.onAnimationComplete((event) => {
        console.log('[CombatVisualizationManager] Animation completed:', event);

        // Tell state machine that animation finished
        this.animationStateMachine.onAnimationComplete(event.unitId, event.animationState);
      });
    }
  }

  /**
   * Handle state update from socket
   */
  private async handleStateUpdate(state: CombatState): Promise<void> {
    if (this.isDestroyed || !state) {
      return;
    }

    try {
      // Track previous state for interpolation (TASK-RENDER-006)
      if (this.currentState) {
        this.previousState = this.currentState;
      }

      // Store current state
      this.currentState = state;

      // Update state timestamp for interpolation (TASK-RENDER-006)
      this.lastStateUpdateTime = Date.now();

      // Update lifecycle tracker for spawn/despawn detection (TASK-RENDER-007)
      this.unitLifecycleTracker.updateState(state);

      // Detect changes from previous state
      const events = this.stateDiffDetector.detectChanges(state);

      // CRITICAL: Render units on the grid FIRST (other systems depend on sprite positions)
      await this.renderUnits(state);

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
   *
   * IMPORTANT: Units are rendered at their PREVIOUS positions (if available) to allow
   * smooth interpolation to their current positions via renderFrame()
   */
  private async renderUnits(state: CombatState): Promise<void> {
    console.log('[CombatVisualizationManager] renderUnits - Rendering', state.units.length, 'units');

    // Render all alive units at their current positions
    for (const unit of state.units) {
      if (unit.status === 'alive') {
        // Look up creature sprite data from the map
        const creatureData = this.creatureDataMap.get(unit.creatureId);

        if (!creatureData) {
          console.warn('[CombatVisualizationManager] No sprite data for creature:', unit.creatureId);
        }

        try {
          // Use unitId-based rendering if available (combat-specific)
          if (this.gridRenderer.renderCreatureWithId) {
            this.gridRenderer.renderCreatureWithId(
              unit.unitId,
              unit.position,
              unit.creatureId,
              unit.ownerId,
              creatureData, // spriteData - includes full DeploymentCreature with sprites
              1.0, // full opacity
              unit.facingDirection || 1 // facing direction
            );
          } else {
            // Fallback to position-based rendering
            this.gridRenderer.renderCreature(
              unit.position,
              unit.creatureId,
              unit.ownerId,
              creatureData,
              1.0,
              unit.facingDirection || 1
            );
          }

          // Track that this unit has a sprite (TASK-RENDER-007)
          this.activeSpriteUnits.add(unit.unitId);

          // Register unit with animation state machine (TASK-COMBAT-VIZ-007)
          if (this.animationStateMachine.getState(unit.unitId) === null) {
            this.animationStateMachine.registerUnit(unit);
            console.log('[CombatVisualizationManager] Registered unit with animation state machine:', unit.unitId);
          }

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

    console.log('[CombatVisualizationManager] manageHealthBars - events.damages:', events.damages?.length || 0, 'state.units:', state.units.length);

    // Track units entering combat and trigger attack animations
    // 1. From damage events - animate the victim and find attackers
    for (const damage of events.damages || []) {
      console.log('[CombatVisualizationManager] Damage event detected for unit:', damage.unitId);
      this.unitsInCombat.set(damage.unitId, currentTime);

      // Find units attacking this damaged unit and trigger attack animation
      for (const potentialAttacker of state.units) {
        if (potentialAttacker.currentTarget === damage.unitId) {
          console.log('[CombatVisualizationManager] Unit attacking detected:', potentialAttacker.unitId, '-> target:', damage.unitId);
          this.animationStateMachine.updateState(potentialAttacker.unitId, {
            isAttacking: true
          });
        }
      }
    }

    // 2. From units with currentTarget (may be moving to target or attacking)
    for (const unit of state.units) {
      if (unit.currentTarget) {
        this.unitsInCombat.set(unit.unitId, currentTime);

        // Check if unit is in range (if they have a ranged attack or melee distance check)
        // For now, assume if they have a target, they're attacking
        // This will be refined when we have proper attack detection
        this.animationStateMachine.updateState(unit.unitId, {
          isAttacking: true
        });
      } else {
        // Unit has no target - return to idle
        this.animationStateMachine.updateState(unit.unitId, {
          isAttacking: false,
          isMoving: false
        });
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
          console.log('[CombatVisualizationManager] Creating health bar for unit:', unit.unitId, 'at position:', position);
          healthBar = this.healthBarRenderer.createHealthBar(unit.health, unit.maxHealth, position);
          this.healthBars.set(unit.unitId, healthBar);
          this.effectContainers.healthBars.addChild(healthBar.container);
          console.log('[CombatVisualizationManager] Health bar created. Total health bars:', this.healthBars.size);
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
   * Convert hex coordinates to pixel coordinates (looks up from rendered sprites)
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
   * Convert hex coordinates to pixel coordinates (direct calculation, supports off-grid)
   * This method can handle deployment positions that are outside the combat grid
   */
  private hexToPixelDirect(hexCoord: { q: number; r: number }): { x: number; y: number } {
    // Use the grid renderer's hex-to-pixel conversion directly
    const hexGrid = this.gridRenderer.getHexGrid();
    const pixel = hexGrid.toPixel(hexCoord);

    // Apply the same offsets as used in rendering
    const bounds = this.calculateGridBounds();
    const isIsometric = hexGrid.getConfig().projection === 'isometric';
    const verticalBias = isIsometric ? 50 : 0;
    const offsetX = (this.gridRenderer.getCanvas().width - bounds.width) / 2 - bounds.minX;
    const offsetY = (this.gridRenderer.getCanvas().height - bounds.height) / 2 - bounds.minY + verticalBias;

    return {
      x: pixel.x + offsetX,
      y: pixel.y + offsetY
    };
  }

  /**
   * Calculate grid bounds for positioning (matches CombatGridRenderer logic)
   */
  private calculateGridBounds() {
    const hexGrid = this.gridRenderer.getHexGrid();
    const { width, height } = hexGrid.getConfig();

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    // Sample all edge hexes to find true bounds after projection
    for (let q = 0; q < width; q++) {
      for (let r = 0; r < height; r++) {
        // Only check edge hexes for efficiency
        if (q === 0 || q === width - 1 || r === 0 || r === height - 1) {
          const pixel = hexGrid.toPixel({ q, r });
          minX = Math.min(minX, pixel.x);
          maxX = Math.max(maxX, pixel.x);
          minY = Math.min(minY, pixel.y);
          maxY = Math.max(maxY, pixel.y);
        }
      }
    }

    // Add hex size padding
    const padding = hexGrid.hexSize;

    return {
      minX: minX - padding,
      maxX: maxX + padding,
      minY: minY - padding,
      maxY: maxY + padding,
      width: maxX - minX + 2 * padding,
      height: maxY - minY + 2 * padding
    };
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
   * Start the 60 FPS render loop (TASK-RENDER-001)
   */
  private startRenderLoop(): void {
    console.log('[CombatVisualizationManager] startRenderLoop() called - renderLoopId:', this.renderLoopId);

    if (this.renderLoopId !== null) {
      console.warn('[CombatVisualizationManager] Render loop already running, renderLoopId:', this.renderLoopId);
      return;
    }

    this.lastFrameTime = 0;
    console.log('[CombatVisualizationManager] Calling requestAnimationFrame...');
    this.renderLoopId = requestAnimationFrame(this.renderLoop);
    console.log('[CombatVisualizationManager] Render loop started with ID:', this.renderLoopId);
  }

  /**
   * Stop the render loop (TASK-RENDER-001)
   */
  private stopRenderLoop(): void {
    if (this.renderLoopId !== null) {
      cancelAnimationFrame(this.renderLoopId);
      this.renderLoopId = null;
      console.log('[CombatVisualizationManager] Render loop stopped');
    }
  }

  /**
   * Main render loop - called at 60 FPS (TASK-RENDER-001, TASK-RENDER-002)
   */
  private renderLoop = (currentTime: number): void => {
    // DEBUG: Log first frame only
    if (this.lastFrameTime === 0) {
      console.log('[CombatVisualizationManager] First render loop frame at', currentTime);
    }

    // Calculate delta time (TASK-RENDER-002)
    let deltaTime = 0;
    if (this.lastFrameTime !== 0) {
      deltaTime = (currentTime - this.lastFrameTime) / 1000; // Convert to seconds
      deltaTime = Math.min(deltaTime, this.MAX_DELTA_TIME); // Clamp to max (prevents huge jumps from tab backgrounding)
    }
    this.lastFrameTime = currentTime;

    // Render the current frame
    this.renderFrame(deltaTime);

    // Schedule next frame
    if (this.isRunning) {
      this.renderLoopId = requestAnimationFrame(this.renderLoop);
    } else {
      console.log('[CombatVisualizationManager] Render loop stopped - isRunning is false');
    }
  };

  /**
   * Render a single frame - called 60 times per second (TASK-RENDER-001)
   * This is where continuous visual updates happen between state ticks
   */
  private renderFrame(deltaTime: number): void {
    if (this.isDestroyed) {
      return;
    }

    try {
      // Update sprite transforms (TASK-RENDER-005)
      this.updateSpriteTransforms();

      // Update health bar positions (TASK-RENDER-008)
      this.updateHealthBarPositions();

      // Update damage numbers (TASK-RENDER-011)
      this.updateDamageNumbers(deltaTime);

      // Update projectile positions (TASK-RENDER-014)
      this.updateProjectiles(deltaTime);
    } catch (error) {
      console.error('[CombatVisualizationManager] Error in renderFrame:', error);
    }
  }

  /**
   * Update sprite transforms at 60 FPS (TASK-RENDER-005, TASK-RENDER-006)
   *
   * Uses PositionInterpolator to smooth movement between server state updates (10 Hz → 60 FPS).
   */
  private updateSpriteTransforms(): void {
    if (!this.currentState || !this.currentState.units) {
      return;
    }

    // Calculate interpolation factor (TASK-RENDER-006)
    let interpolationFactor = 0.0;

    if (this.previousState && this.lastStateUpdateTime > 0) {
      const currentTime = Date.now();
      const timeSinceUpdate = currentTime - this.lastStateUpdateTime;

      // Calculate factor: 0.0 at state arrival, approaches 1.0 over time
      interpolationFactor = Math.min(timeSinceUpdate / this.STATE_UPDATE_INTERVAL, 1.0);
    }

    // Get interpolated positions (TASK-RENDER-006)
    let interpolatedPositions = new Map<string, { position: AxialCoordinate; facingDirection: number }>();

    if (this.previousState && interpolationFactor > 0) {
      const interpolated = this.positionInterpolator.interpolatePositions(
        this.previousState,
        this.currentState,
        interpolationFactor
      );

      interpolated.forEach(interp => {
        interpolatedPositions.set(interp.unitId, {
          position: interp.position,
          facingDirection: interp.facingDirection
        });
      });
    }

    // Update transform for each alive unit
    for (const unit of this.currentState.units) {
      // Skip dead units
      if (unit.status === 'dead') {
        continue;
      }

      // Get interpolated position if available, otherwise use current position
      const interpolated = interpolatedPositions.get(unit.unitId);
      const renderPosition = interpolated?.position || unit.position;

      // Get sprite reference from grid renderer
      const spriteData = this.gridRenderer.getSpriteAt(unit.position);

      // Skip if sprite doesn't exist yet (may not be rendered yet)
      if (!spriteData || !spriteData.sprite) {
        continue;
      }

      // Note: Actual sprite.x and sprite.y updates will happen when we have
      // direct access to sprite transforms. For now, this establishes the
      // interpolation infrastructure. The gridRenderer positions sprites via
      // renderCreatureWithId() which is called at 10 Hz in handleStateUpdate.
      //
      // Future enhancement: Update sprite.x and sprite.y directly here for
      // true 60 FPS smooth movement between hex positions.
    }
  }

  /**
   * Update health bar positions to track sprite positions (TASK-RENDER-008)
   *
   * Called every frame (60 FPS) to ensure health bars follow their unit sprites smoothly.
   */
  private updateHealthBarPositions(): void {
    if (!this.currentState || !this.currentState.units) {
      return;
    }

    // Iterate through all active health bars
    for (const [unitId, healthBar] of this.healthBars.entries()) {
      // Find the unit in current state
      const unit = this.currentState.units.find(u => u.unitId === unitId);

      if (!unit) {
        // Unit not in current state (may have been removed), skip update
        continue;
      }

      // Get sprite position from grid renderer
      const spriteData = this.gridRenderer.getSpriteAt(unit.position);

      if (!spriteData || !spriteData.sprite) {
        // Sprite not found (may not be rendered yet), skip update
        continue;
      }

      // Update health bar position to track sprite
      // Apply offset above sprite
      healthBar.container.x = spriteData.sprite.x;
      healthBar.container.y = spriteData.sprite.y - this.HEALTH_BAR_OFFSET_Y;
    }
  }

  /**
   * Update projectile positions with interpolation (TASK-RENDER-014)
   *
   * Interpolates projectile positions between server state updates for smooth 60 FPS movement.
   * This runs every frame to ensure projectiles move smoothly even though the server only
   * updates at 10 Hz.
   */
  private updateProjectiles(_deltaTime: number): void {
    if (!this.currentState || !this.activeProjectiles.size) {
      return;
    }

    // Calculate interpolation factor based on time since last state update
    let interpolationFactor = 0.0;

    if (this.previousState && this.lastStateUpdateTime > 0) {
      const currentTime = Date.now();
      const timeSinceUpdate = currentTime - this.lastStateUpdateTime;

      // Calculate factor: 0.0 at state arrival, approaches 1.0 over time
      interpolationFactor = Math.min(timeSinceUpdate / this.STATE_UPDATE_INTERVAL, 1.0);
    }

    // Update each active projectile
    for (const [projectileId, visualProjectile] of this.activeProjectiles.entries()) {
      // Find the projectile in current state
      const currentProjectile = this.currentState.projectiles.find(p => p.projectileId === projectileId);

      if (!currentProjectile) {
        // Projectile not in current state (may have been removed), skip update
        continue;
      }

      // Get current server position
      const currentPixels = this.hexToPixel(currentProjectile.currentPosition);

      // If we have a previous state, interpolate between previous and current position
      if (this.previousState && interpolationFactor > 0) {
        const previousProjectile = this.previousState.projectiles.find(p => p.projectileId === projectileId);

        if (previousProjectile) {
          // Get previous position
          const previousPixels = this.hexToPixel(previousProjectile.currentPosition);

          // Linear interpolation between previous and current position
          visualProjectile.sprite.x = previousPixels.x + (currentPixels.x - previousPixels.x) * interpolationFactor;
          visualProjectile.sprite.y = previousPixels.y + (currentPixels.y - previousPixels.y) * interpolationFactor;

          // Update rotation to face direction of travel
          const dx = currentPixels.x - previousPixels.x;
          const dy = currentPixels.y - previousPixels.y;

          if (dx !== 0 || dy !== 0) {
            visualProjectile.sprite.rotation = Math.atan2(dy, dx);
          }
        } else {
          // Projectile didn't exist in previous state (newly spawned), use current position
          visualProjectile.sprite.x = currentPixels.x;
          visualProjectile.sprite.y = currentPixels.y;
        }
      } else {
        // No previous state or no interpolation needed, use current position
        visualProjectile.sprite.x = currentPixels.x;
        visualProjectile.sprite.y = currentPixels.y;
      }
    }
  }

  // REMOVED: handleAnimationTransitions(), hasUnitsWithDeploymentPositions(), and createSyntheticSpawnState()
  // These were part of the over-engineered animation system and spawn-to-battle synthetic state creation
  // that was causing the rendering regression. Rendering is now simple and state-driven.
}
