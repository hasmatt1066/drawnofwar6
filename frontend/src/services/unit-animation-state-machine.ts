/**
 * TASK-COMBAT-VIZ-007: Unit Animation State Machine Implementation
 *
 * Manages animation state transitions for combat units.
 * Handles idle, walk, attack, cast, and death states with proper priority.
 */

import type { CombatCreature } from '@drawn-of-war/shared/types/combat';

/**
 * Animation states
 */
export enum AnimationState {
  IDLE = 'idle',
  WALK = 'walk',
  ATTACK = 'attack',
  CAST = 'cast',
  DEATH = 'death'
}

/**
 * State update data
 */
export interface StateUpdateData {
  isMoving?: boolean;
  isAttacking?: boolean;
  isCasting?: boolean;
  abilityId?: string;
  health?: number;
}

/**
 * State transition event
 */
export interface StateTransition {
  unitId: string;
  previousState: AnimationState;
  newState: AnimationState;
}

/**
 * State change callback
 */
type StateChangeCallback = (transition: StateTransition) => void;

/**
 * Unit state entry
 */
interface UnitStateEntry {
  currentState: AnimationState;
  isDead: boolean;
}

/**
 * UnitAnimationStateMachine
 *
 * Manages animation state transitions for combat units with priority-based state resolution.
 */
export class UnitAnimationStateMachine {
  private unitStates: Map<string, UnitStateEntry> = new Map();
  private stateChangeCallbacks: StateChangeCallback[] = [];

  /**
   * Register a new unit with initial state
   */
  public registerUnit(unit: CombatCreature): void {
    this.unitStates.set(unit.unitId, {
      currentState: AnimationState.IDLE,
      isDead: unit.status === 'dead'
    });
  }

  /**
   * Unregister a unit
   */
  public unregisterUnit(unitId: string): void {
    this.unitStates.delete(unitId);
  }

  /**
   * Update unit state based on combat data
   */
  public updateState(unitId: string, data: StateUpdateData): void {
    const entry = this.unitStates.get(unitId);
    if (!entry) {
      return; // Unit not registered
    }

    const previousState = entry.currentState;

    // Determine new state based on priority
    const newState = this.resolveState(entry, data);

    // Update death flag if health is 0
    if (data.health !== undefined && data.health <= 0) {
      entry.isDead = true;
    }

    // Only trigger transition if state changed
    if (newState !== previousState) {
      entry.currentState = newState;
      this.triggerStateChange({
        unitId,
        previousState,
        newState
      });
    }
  }

  /**
   * Handle animation completion
   */
  public onAnimationComplete(unitId: string, completedState: AnimationState): void {
    const entry = this.unitStates.get(unitId);
    if (!entry) {
      return;
    }

    // Only transition if still in the completed state
    if (entry.currentState !== completedState) {
      return;
    }

    // Determine next state after animation completes
    let nextState: AnimationState;

    switch (completedState) {
      case AnimationState.ATTACK:
      case AnimationState.CAST:
        // One-shot animations return to idle
        nextState = AnimationState.IDLE;
        break;

      case AnimationState.DEATH:
      case AnimationState.WALK:
      case AnimationState.IDLE:
        // Looping or terminal states stay in current state
        nextState = entry.currentState;
        break;

      default:
        nextState = AnimationState.IDLE;
    }

    if (nextState !== entry.currentState) {
      const previousState = entry.currentState;
      entry.currentState = nextState;
      this.triggerStateChange({
        unitId,
        previousState,
        newState: nextState
      });
    }
  }

  /**
   * Get current state for a unit
   */
  public getState(unitId: string): AnimationState | null {
    const entry = this.unitStates.get(unitId);
    return entry ? entry.currentState : null;
  }

  /**
   * Check if unit is in specific state
   */
  public isInState(unitId: string, state: AnimationState): boolean {
    return this.getState(unitId) === state;
  }

  /**
   * Get all units in specific state
   */
  public getUnitsInState(state: AnimationState): string[] {
    const units: string[] = [];
    for (const [unitId, entry] of this.unitStates.entries()) {
      if (entry.currentState === state) {
        units.push(unitId);
      }
    }
    return units;
  }

  /**
   * Register callback for state changes
   */
  public onStateChange(callback: StateChangeCallback): void {
    this.stateChangeCallbacks.push(callback);
  }

  /**
   * Resolve animation state based on priority
   * Priority: DEATH > CAST > ATTACK > WALK > IDLE
   */
  private resolveState(entry: UnitStateEntry, data: StateUpdateData): AnimationState {
    // Death has highest priority (terminal state)
    if (entry.isDead || (data.health !== undefined && data.health <= 0)) {
      return AnimationState.DEATH;
    }

    // Cast has second priority
    if (data.isCasting) {
      return AnimationState.CAST;
    }

    // Attack has third priority
    if (data.isAttacking) {
      return AnimationState.ATTACK;
    }

    // Walk has fourth priority
    if (data.isMoving) {
      return AnimationState.WALK;
    }

    // Default to idle
    return AnimationState.IDLE;
  }

  /**
   * Trigger state change callbacks
   */
  private triggerStateChange(transition: StateTransition): void {
    this.stateChangeCallbacks.forEach(callback => callback(transition));
  }
}
