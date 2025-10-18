/**
 * TASK-COMBAT-VIZ-006: Unit Lifecycle Tracker Implementation
 *
 * Tracks unit spawning and despawning between combat states.
 * Provides callbacks for rendering unit additions/removals.
 */

import type { CombatState, CombatCreature } from '@drawn-of-war/shared/types/combat';

/**
 * Unit spawn event
 */
export interface UnitSpawnEvent {
  unitId: string;
  unit: CombatCreature;
  tick: number;
}

/**
 * Unit despawn event
 */
export interface UnitDespawnEvent {
  unitId: string;
  unit: CombatCreature;
  tick: number;
}

/**
 * Event callback types
 */
type SpawnCallback = (event: UnitSpawnEvent) => void;
type DespawnCallback = (event: UnitDespawnEvent) => void;

/**
 * UnitLifecycleTracker
 *
 * Tracks unit spawning and despawning between combat state updates.
 */
export class UnitLifecycleTracker {
  private previousUnitIds: Set<string> = new Set();
  private currentUnits: Map<string, CombatCreature> = new Map();
  private spawnedUnits: UnitSpawnEvent[] = [];
  private despawnedUnits: UnitDespawnEvent[] = [];
  private isFirstUpdate: boolean = true;

  // Callbacks
  private spawnCallbacks: SpawnCallback[] = [];
  private despawnCallbacks: DespawnCallback[] = [];

  /**
   * Update with new combat state
   */
  public updateState(state: CombatState): void {
    // Clear previous spawn/despawn lists
    this.spawnedUnits = [];
    this.despawnedUnits = [];

    // Build current unit map
    const currentUnitIds = new Set<string>();
    const currentUnitMap = new Map<string, CombatCreature>();

    state.units.forEach(unit => {
      currentUnitIds.add(unit.unitId);
      currentUnitMap.set(unit.unitId, unit);
    });

    // Skip spawn/despawn detection on first update
    if (!this.isFirstUpdate) {
      // Detect spawned units (in current but not in previous)
      state.units.forEach(unit => {
        if (!this.previousUnitIds.has(unit.unitId)) {
          const spawnEvent: UnitSpawnEvent = {
            unitId: unit.unitId,
            unit,
            tick: state.tick
          };
          this.spawnedUnits.push(spawnEvent);
          this.triggerSpawnCallbacks(spawnEvent);
        }
      });

      // Detect despawned units (in previous but not in current)
      this.previousUnitIds.forEach(unitId => {
        if (!currentUnitIds.has(unitId)) {
          const unit = this.currentUnits.get(unitId)!;
          const despawnEvent: UnitDespawnEvent = {
            unitId,
            unit,
            tick: state.tick
          };
          this.despawnedUnits.push(despawnEvent);
          this.triggerDespawnCallbacks(despawnEvent);
        }
      });
    }

    // Update state for next comparison
    this.previousUnitIds = currentUnitIds;
    this.currentUnits = currentUnitMap;
    this.isFirstUpdate = false;
  }

  /**
   * Get units that spawned in last update
   */
  public getSpawnedUnits(): UnitSpawnEvent[] {
    return [...this.spawnedUnits];
  }

  /**
   * Get units that despawned in last update
   */
  public getDespawnedUnits(): UnitDespawnEvent[] {
    return [...this.despawnedUnits];
  }

  /**
   * Get currently active units
   */
  public getActiveUnits(): CombatCreature[] {
    return Array.from(this.currentUnits.values());
  }

  /**
   * Register callback for unit spawn events
   */
  public onUnitSpawned(callback: SpawnCallback): void {
    this.spawnCallbacks.push(callback);
  }

  /**
   * Register callback for unit despawn events
   */
  public onUnitDespawned(callback: DespawnCallback): void {
    this.despawnCallbacks.push(callback);
  }

  /**
   * Clear all tracked state
   */
  public clear(): void {
    this.previousUnitIds.clear();
    this.currentUnits.clear();
    this.spawnedUnits = [];
    this.despawnedUnits = [];
    this.isFirstUpdate = true;
  }

  /**
   * Trigger spawn callbacks
   */
  private triggerSpawnCallbacks(event: UnitSpawnEvent): void {
    this.spawnCallbacks.forEach(callback => callback(event));
  }

  /**
   * Trigger despawn callbacks
   */
  private triggerDespawnCallbacks(event: UnitDespawnEvent): void {
    this.despawnCallbacks.forEach(callback => callback(event));
  }
}
