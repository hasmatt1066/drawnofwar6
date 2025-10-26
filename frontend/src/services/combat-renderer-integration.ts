/**
 * TASK-COMBAT-VIZ-009: Combat Renderer Integration Implementation
 *
 * Integrates socket services with PixiJS renderer for live combat visualization.
 * Orchestrates: Socket → Buffer → Interpolation → Animation → Rendering
 */

import type { AxialCoordinate } from '@drawn-of-war/shared';
import type { CombatCreature, CombatState } from '@drawn-of-war/shared/types/combat';
import { CombatSocketClient } from './combat-socket-client';
import { StateUpdateBuffer } from './state-update-buffer';
import { PositionInterpolator } from './position-interpolator';
import { UnitLifecycleTracker } from './unit-lifecycle-tracker';
import { UnitAnimationStateMachine, AnimationState } from './unit-animation-state-machine';
import { AnimationAssetMapper } from './animation-asset-mapper';

/**
 * Minimal renderer interface for combat visualization
 * Note: This uses unitId-based rendering for proper sprite lifecycle management
 */
export interface CombatRenderer {
  // New combat-specific method with unitId for proper sprite lifecycle
  renderCreatureWithId?(
    unitId: string,
    hex: AxialCoordinate,
    creatureName: string,
    playerId: 'player1' | 'player2',
    spriteData?: any,
    opacity?: number,
    direction?: number
  ): void;

  // Keep legacy method for backward compatibility
  renderCreature(
    hex: AxialCoordinate,
    creatureName: string,
    playerId: 'player1' | 'player2',
    spriteData?: any,
    opacity?: number,
    direction?: number
  ): void;

  removeCreatureById?(unitId: string): void;  // Unit ID-based removal
  removeCreature(hex: AxialCoordinate): void;  // Position-based removal (legacy)
  clearAllCreatures(): void;
}

/**
 * CombatRendererIntegration
 *
 * Main orchestrator that connects all combat visualization services
 * and manages the render loop for smooth 60 FPS combat rendering.
 */
export class CombatRendererIntegration {
  private socketClient: CombatSocketClient;
  private renderer: CombatRenderer;

  // Service layer
  private stateBuffer: StateUpdateBuffer;
  private positionInterpolator: PositionInterpolator;
  private lifecycleTracker: UnitLifecycleTracker;
  private animationStateMachine: UnitAnimationStateMachine;
  private assetMapper: AnimationAssetMapper;

  // Render loop state
  private isRendering: boolean = false;
  private animationFrameId: number | null = null;
  private lastRenderTime: number = 0;

  // Unit tracking
  private activeUnitPositions: Map<string, AxialCoordinate> = new Map();

  constructor(socketClient: CombatSocketClient, renderer: CombatRenderer) {
    this.socketClient = socketClient;
    this.renderer = renderer;

    // Initialize services
    this.stateBuffer = new StateUpdateBuffer();
    this.positionInterpolator = new PositionInterpolator();
    this.lifecycleTracker = new UnitLifecycleTracker();
    this.animationStateMachine = new UnitAnimationStateMachine();
    this.assetMapper = new AnimationAssetMapper();

    // Connect socket events to state buffer
    this.setupSocketListeners();

    // Connect lifecycle events to renderer
    this.setupLifecycleHandlers();
  }

  /**
   * Setup socket event listeners
   */
  private setupSocketListeners(): void {
    // Forward combat states to buffer
    this.socketClient.onCombatState(state => {
      this.stateBuffer.addState(state);
    });

    // Handle combat completed
    this.socketClient.onCombatCompleted(() => {
      this.stop();
      this.clearAll();
    });
  }

  /**
   * Setup lifecycle event handlers
   */
  private setupLifecycleHandlers(): void {
    // Handle unit spawns
    this.lifecycleTracker.onUnitSpawned(event => {
      // Register unit in animation state machine
      this.animationStateMachine.registerUnit(event.unit);

      // Track position
      this.activeUnitPositions.set(event.unitId, event.unit.position);
    });

    // Handle unit despawns
    this.lifecycleTracker.onUnitDespawned(event => {
      // Unregister from animation state machine
      this.animationStateMachine.unregisterUnit(event.unitId);

      // Remove from renderer
      if (this.renderer.removeCreatureById) {
        // Use unitId-based removal if available
        this.renderer.removeCreatureById(event.unitId);
      } else if (this.renderer.removeCreature) {
        // Fall back to position-based removal
        const position = this.activeUnitPositions.get(event.unitId);
        if (position) {
          this.renderer.removeCreature(position);
        }
      }

      // Remove from tracking
      this.activeUnitPositions.delete(event.unitId);
    });
  }

  /**
   * Start the render loop
   */
  public start(): void {
    if (this.isRendering) {
      return; // Already running
    }

    this.isRendering = true;
    this.lastRenderTime = performance.now();
    this.renderLoop();
  }

  /**
   * Stop the render loop
   */
  public stop(): void {
    if (!this.isRendering) {
      return; // Already stopped
    }

    this.isRendering = false;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Check if render loop is running
   */
  public isRunning(): boolean {
    return this.isRendering;
  }

  /**
   * Main render loop (60 FPS target)
   */
  private renderLoop = (): void => {
    if (!this.isRendering) {
      return;
    }

    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastRenderTime;
    this.lastRenderTime = currentTime;

    // Render current frame
    this.renderFrame(deltaTime);

    // Schedule next frame
    this.animationFrameId = requestAnimationFrame(this.renderLoop);
  };

  /**
   * Render a single frame
   */
  public renderFrame(deltaTime: number = 16.67): void {
    try {
      // Get current buffered state
      const currentState = this.stateBuffer.getCurrentState();

      if (!currentState) {
        return; // No state to render
      }

      // Update lifecycle tracker
      this.lifecycleTracker.updateState(currentState);

      // Render all active units
      this.renderUnits(currentState, deltaTime);
    } catch (error) {
      console.error('[CombatRendererIntegration] Error rendering frame:', error);
    }
  }

  /**
   * Render all units in current state
   */
  private renderUnits(state: CombatState, _deltaTime: number): void {
    if (!state.units || !Array.isArray(state.units)) {
      return;
    }

    // Get interpolated positions (if we have a previous state)
    const previousState = this.stateBuffer.getStateAtOffset(-1);
    let interpolatedPositions: Map<string, { position: AxialCoordinate; facingDirection: number; isMoving: boolean }> = new Map();

    if (previousState) {
      const interpolated = this.positionInterpolator.interpolatePositions(
        previousState,
        state,
        0.5 // Midpoint interpolation for smooth rendering
      );

      interpolated.forEach(interp => {
        interpolatedPositions.set(interp.unitId, {
          position: interp.position,
          facingDirection: interp.facingDirection,
          isMoving: interp.isMoving
        });
      });
    }

    // Render each unit
    state.units.forEach(unit => {
      this.renderUnit(unit, interpolatedPositions);
    });
  }

  /**
   * Render a single unit
   */
  private renderUnit(
    unit: CombatCreature,
    interpolatedPositions: Map<string, { position: AxialCoordinate; facingDirection: number; isMoving: boolean }>
  ): void {
    if (!this.renderer.renderCreature) {
      return; // Renderer doesn't support creature rendering
    }

    // Ensure unit is registered with animation state machine
    if (this.animationStateMachine.getState(unit.unitId) === null) {
      this.animationStateMachine.registerUnit(unit);
    }

    // Get interpolated position or fallback to unit position
    const interpolated = interpolatedPositions.get(unit.unitId);
    const position = interpolated?.position || unit.position;
    const facingDirection = interpolated?.facingDirection || unit.facingDirection;
    const isMoving = interpolated?.isMoving || false;

    // Update animation state
    // Extract attacking state from currentTarget (if unit has a target, it's attacking)
    const isAttacking = unit.currentTarget !== undefined && unit.currentTarget !== null;

    this.animationStateMachine.updateState(unit.unitId, {
      isMoving,
      isAttacking,
      isCasting: false, // TODO: Add ability casting detection when implemented
      health: unit.health
    });

    // Get current animation state
    const animState = this.animationStateMachine.getState(unit.unitId) || AnimationState.IDLE;

    // Get animation data
    const animation = this.assetMapper.getAnimation(
      animState,
      unit,
      facingDirection
    );

    // Render creature with animation frames
    // Use new unitId-based method if available, otherwise fall back to position-based
    if (this.renderer.renderCreatureWithId) {
      this.renderer.renderCreatureWithId(
        unit.unitId,
        position,
        unit.creatureId,
        unit.ownerId as 'player1' | 'player2',
        {
          battlefieldDirectionalViews: this.createDirectionalViews(unit, animState)
        },
        1.0, // Full opacity
        facingDirection
      );
    } else {
      this.renderer.renderCreature(
        position,
        unit.creatureId,
        unit.ownerId as 'player1' | 'player2',
        {
          battlefieldDirectionalViews: this.createDirectionalViews(unit, animState)
        },
        1.0, // Full opacity
        facingDirection
      );
    }

    // Update tracked position
    this.activeUnitPositions.set(unit.unitId, position);
  }

  /**
   * Create directional views structure for renderer compatibility
   */
  private createDirectionalViews(unit: CombatCreature, animState: AnimationState): any {
    // Create animation data for each direction
    const directions = ['E', 'NE', 'SE'];
    const views: any = {};

    directions.forEach((dir, index) => {
      const animation = this.assetMapper.getAnimation(
        animState,
        unit,
        index === 0 ? 1 : index === 1 ? 0 : 2 // Map to direction indices
      );

      views[dir] = {
        sprite: animation.frames[0], // First frame as static sprite
        idleFrames: animation.frames,
        walkFrames: animation.frames // For now, use same frames
      };
    });

    return views;
  }

  /**
   * Clear all rendered units
   */
  private clearAll(): void {
    if (this.renderer.clearAllCreatures) {
      this.renderer.clearAllCreatures();
    }

    this.activeUnitPositions.clear();
    this.stateBuffer.clear();
    this.lifecycleTracker.clear();
  }

  /**
   * Destroy integration and cleanup resources
   */
  public destroy(): void {
    this.stop();
    this.clearAll();
  }

  // Service getters for testing
  public getStateBuffer(): StateUpdateBuffer {
    return this.stateBuffer;
  }

  public getPositionInterpolator(): PositionInterpolator {
    return this.positionInterpolator;
  }

  public getLifecycleTracker(): UnitLifecycleTracker {
    return this.lifecycleTracker;
  }

  public getAnimationStateMachine(): UnitAnimationStateMachine {
    return this.animationStateMachine;
  }

  public getAssetMapper(): AnimationAssetMapper {
    return this.assetMapper;
  }
}
