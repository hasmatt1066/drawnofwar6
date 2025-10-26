/**
 * TASK-COMBAT-VIZ-008: Animation Asset Mapper Implementation
 *
 * Maps combat animation states to sprite animation assets.
 * Handles directional animations, frame durations, and blend modes.
 */

import { AnimationState } from './unit-animation-state-machine';
import type { CombatCreature } from '@drawn-of-war/shared/types/combat';

/**
 * Animation data for unit sprites
 */
export interface AnimationData {
  frames: string[];
  frameDuration: number; // milliseconds per frame
  loop: boolean;
  shouldMirror: boolean; // For horizontal flipping
}

/**
 * Effect animation data for abilities
 */
export interface EffectAnimationData {
  frames: string[];
  frameDuration: number;
  loop: boolean;
  blendMode: 'ADD' | 'MULTIPLY' | 'SCREEN';
}

/**
 * Direction enum matching hex directions
 */
enum HexDirection {
  NE = 0,
  E = 1,
  SE = 2,
  SW = 3,
  W = 4,
  NW = 5
}

/**
 * AnimationAssetMapper
 *
 * Maps animation states and abilities to sprite frame data.
 */
export class AnimationAssetMapper {
  private animationCache: Map<string, AnimationData> = new Map();
  private effectCache: Map<string, EffectAnimationData> = new Map();

  /**
   * Get animation data for a combat state
   */
  public getAnimation(
    state: AnimationState,
    creature: CombatCreature,
    direction: number
  ): AnimationData {
    // Generate cache key
    const cacheKey = `${creature.creatureId}:${state}:${direction}`;

    // Check cache
    if (this.animationCache.has(cacheKey)) {
      return this.animationCache.get(cacheKey)!;
    }

    // Resolve animation data
    const animationData = this.resolveAnimation(state, creature, direction);

    // Cache and return
    this.animationCache.set(cacheKey, animationData);
    return animationData;
  }

  /**
   * Get effect animation data for an ability
   */
  public getEffectAnimation(abilityId: string): EffectAnimationData {
    // Check cache
    if (this.effectCache.has(abilityId)) {
      return this.effectCache.get(abilityId)!;
    }

    // Resolve effect data
    const effectData = this.resolveEffect(abilityId);

    // Cache and return
    this.effectCache.set(abilityId, effectData);
    return effectData;
  }

  /**
   * Resolve animation data based on state, creature, and direction
   */
  private resolveAnimation(
    state: AnimationState,
    creature: CombatCreature,
    direction: number
  ): AnimationData {
    // Normalize direction to valid range
    const normalizedDir = this.normalizeDirection(direction);

    // Check if direction needs mirroring (western directions)
    const shouldMirror = this.shouldMirrorDirection(normalizedDir);

    // Get base direction (map W/NW/SW to E/NE/SE)
    const baseDir = this.getBaseDirection(normalizedDir);

    // Get frames based on state and direction
    const frames = this.getFramesForState(state, creature.creatureId, baseDir);

    // Get timing configuration
    const { frameDuration, loop } = this.getTimingConfig(state);

    return {
      frames,
      frameDuration,
      loop,
      shouldMirror
    };
  }

  /**
   * Resolve effect animation data
   */
  private resolveEffect(abilityId: string): EffectAnimationData {
    // Get frames from library
    const frames = this.getLibraryEffectFrames(abilityId);

    // Determine blend mode based on effect type
    const blendMode = this.getBlendMode(abilityId);

    return {
      frames,
      frameDuration: 80, // Fast animation (80ms = 12.5 FPS)
      loop: false,
      blendMode
    };
  }

  /**
   * Get animation frames for a specific state
   */
  private getFramesForState(
    state: AnimationState,
    creatureId: string,
    direction: HexDirection
  ): string[] {
    const dirName = this.getDirectionName(direction);

    switch (state) {
      case AnimationState.IDLE:
        return this.getIdleFrames(creatureId, dirName);

      case AnimationState.WALK:
        return this.getWalkFrames(creatureId, dirName);

      case AnimationState.ATTACK:
        return this.getAttackFrames(creatureId, dirName);

      case AnimationState.CAST:
        return this.getCastFrames(creatureId, dirName);

      case AnimationState.DEATH:
        return this.getDeathFrames(creatureId, dirName);

      default:
        // Fallback to idle
        return this.getIdleFrames(creatureId, dirName);
    }
  }

  /**
   * Get timing configuration for animation state
   */
  private getTimingConfig(state: AnimationState): { frameDuration: number; loop: boolean } {
    switch (state) {
      case AnimationState.IDLE:
        return { frameDuration: 800, loop: true }; // Slow breathing

      case AnimationState.WALK:
        return { frameDuration: 150, loop: true }; // Medium speed walking

      case AnimationState.ATTACK:
        return { frameDuration: 120, loop: false }; // Fast attack

      case AnimationState.CAST:
        return { frameDuration: 200, loop: false }; // Medium cast

      case AnimationState.DEATH:
        return { frameDuration: 300, loop: false }; // Slow dramatic death

      default:
        return { frameDuration: 800, loop: true };
    }
  }

  /**
   * Get idle animation frames
   */
  private getIdleFrames(creatureId: string, direction: string): string[] {
    // Path format: /api/creatures/{creatureId}/animations/idle/{direction}/{frame}.png
    const basePath = `/api/creatures/${creatureId}/animations/idle/${direction}`;
    return [
      `${basePath}/frame-0.png`,
      `${basePath}/frame-1.png`,
      `${basePath}/frame-2.png`,
      `${basePath}/frame-3.png`
    ];
  }

  /**
   * Get walk animation frames
   */
  private getWalkFrames(creatureId: string, direction: string): string[] {
    const basePath = `/api/creatures/${creatureId}/animations/walk/${direction}`;
    return [
      `${basePath}/frame-0.png`,
      `${basePath}/frame-1.png`,
      `${basePath}/frame-2.png`,
      `${basePath}/frame-3.png`
    ];
  }

  /**
   * Get attack animation frames
   * Falls back to idle frames if attack frames don't exist
   */
  private getAttackFrames(creatureId: string, direction: string): string[] {
    // TODO: Once attack frames are available via API, use them
    // For now, fall back to idle frames with different timing (configured in getTimingConfig)
    const basePath = `/api/creatures/${creatureId}/animations/attack/${direction}`;

    // Check if attack frames exist - for now, always fall back to idle
    // This will be updated when backend serves attack animations
    return this.getIdleFrames(creatureId, direction);
  }

  /**
   * Get cast animation frames
   */
  private getCastFrames(creatureId: string, direction: string): string[] {
    const basePath = `/api/creatures/${creatureId}/animations/cast/${direction}`;
    return [
      `${basePath}/frame-0.png`,
      `${basePath}/frame-1.png`,
      `${basePath}/frame-2.png`,
      `${basePath}/frame-3.png`
    ];
  }

  /**
   * Get death animation frames
   */
  private getDeathFrames(creatureId: string, direction: string): string[] {
    const basePath = `/api/creatures/${creatureId}/animations/death/${direction}`;
    return [
      `${basePath}/frame-0.png`,
      `${basePath}/frame-1.png`,
      `${basePath}/frame-2.png`,
      `${basePath}/frame-3.png`
    ];
  }

  /**
   * Get library effect frames for ability
   */
  private getLibraryEffectFrames(abilityId: string): string[] {
    // Path format: /assets/library-animations/{abilityId}/frame-{n}.png
    const basePath = `/assets/library-animations/${abilityId}`;
    return [
      `${basePath}/frame-0.png`,
      `${basePath}/frame-1.png`,
      `${basePath}/frame-2.png`,
      `${basePath}/frame-3.png`
    ];
  }

  /**
   * Determine blend mode for effect
   */
  private getBlendMode(abilityId: string): 'ADD' | 'MULTIPLY' | 'SCREEN' {
    // Fire/energy effects use ADD
    if (abilityId.includes('fire') || abilityId.includes('lightning') || abilityId.includes('energy')) {
      return 'ADD';
    }

    // Heal/buff effects use SCREEN
    if (abilityId.includes('heal') || abilityId.includes('buff') || abilityId.includes('shield')) {
      return 'SCREEN';
    }

    // Dark/shadow effects use MULTIPLY
    if (abilityId.includes('shadow') || abilityId.includes('dark') || abilityId.includes('poison')) {
      return 'MULTIPLY';
    }

    // Default to ADD for most effects
    return 'ADD';
  }

  /**
   * Normalize direction to valid range [0-5]
   */
  private normalizeDirection(direction: number): number {
    // Handle invalid directions by wrapping to valid range
    if (direction < 0 || direction > 5) {
      return Math.abs(direction % 6);
    }
    return direction;
  }

  /**
   * Check if direction should be mirrored (western directions)
   */
  private shouldMirrorDirection(direction: number): boolean {
    // Western directions (SW, W, NW) should be mirrored
    return direction === HexDirection.SW ||
           direction === HexDirection.W ||
           direction === HexDirection.NW;
  }

  /**
   * Get base direction for mirrored directions
   */
  private getBaseDirection(direction: number): HexDirection {
    switch (direction) {
      case HexDirection.W:
        return HexDirection.E; // Mirror of E
      case HexDirection.NW:
        return HexDirection.NE; // Mirror of NE
      case HexDirection.SW:
        return HexDirection.SE; // Mirror of SE
      default:
        return direction as HexDirection;
    }
  }

  /**
   * Get direction name string
   */
  private getDirectionName(direction: HexDirection): string {
    switch (direction) {
      case HexDirection.NE:
        return 'NE';
      case HexDirection.E:
        return 'E';
      case HexDirection.SE:
        return 'SE';
      default:
        return 'E'; // Fallback
    }
  }
}
