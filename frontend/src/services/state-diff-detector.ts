/**
 * TASK-VIZ-016: State Diff Detector Implementation
 *
 * Detects changes between consecutive CombatState snapshots.
 * Infers combat events from state differences (damage, healing, projectiles, buffs, deaths).
 */

import type { CombatState, CombatCreature, Projectile, Buff } from '@drawn-of-war/shared/src/types/combat';

/**
 * Damage event detected from health decrease
 */
export interface DamageEvent {
  unitId: string;
  oldHealth: number;
  newHealth: number;
  damageAmount: number;
  tick: number;
}

/**
 * Healing event detected from health increase
 */
export interface HealingEvent {
  unitId: string;
  oldHealth: number;
  newHealth: number;
  healAmount: number;
  tick: number;
}

/**
 * Projectile spawn event detected from new projectile in state
 */
export interface ProjectileSpawnEvent {
  projectileId: string;
  sourceUnitId: string;
  targetUnitId: string;
  sourcePosition: { q: number; r: number };
  targetPosition: { q: number; r: number };
  tick: number;
}

/**
 * Buff/debuff application event
 */
export interface BuffAppliedEvent {
  unitId: string;
  buffId: string;
  buffName: string;
  duration: number;
  stacks?: number;
  tick: number;
}

/**
 * Buff/debuff removal event
 */
export interface BuffRemovedEvent {
  unitId: string;
  buffId: string;
  buffName: string;
  tick: number;
}

/**
 * Unit death event
 */
export interface UnitDeathEvent {
  unitId: string;
  tick: number;
}

/**
 * Collection of all detected events
 */
export interface DetectedEvents {
  damages: DamageEvent[];
  heals: HealingEvent[];
  projectiles: ProjectileSpawnEvent[];
  buffsApplied: BuffAppliedEvent[];
  buffsRemoved: BuffRemovedEvent[];
  debuffsApplied: BuffAppliedEvent[];
  debuffsRemoved: BuffRemovedEvent[];
  deaths: UnitDeathEvent[];
}

/**
 * StateDiffDetector
 *
 * Compares consecutive CombatState snapshots to detect combat events.
 * Uses state differencing to infer what happened between ticks.
 */
export class StateDiffDetector {
  private previousState: CombatState | null = null;

  /**
   * Detect changes between previous and new state
   */
  public detectChanges(newState: CombatState): DetectedEvents {
    // Process events from state.events array (server-authoritative events)
    const serverEvents = this.processServerEvents(newState);

    // First state - only use server events
    if (!this.previousState) {
      this.previousState = newState;
      return serverEvents;
    }

    // Merge server events with state-diff detected events
    const stateDiffEvents: DetectedEvents = {
      damages: this.detectDamage(this.previousState, newState),
      heals: this.detectHealing(this.previousState, newState),
      projectiles: this.detectNewProjectiles(this.previousState, newState),
      buffsApplied: this.detectBuffsApplied(this.previousState, newState),
      buffsRemoved: this.detectBuffsRemoved(this.previousState, newState),
      debuffsApplied: this.detectDebuffsApplied(this.previousState, newState),
      debuffsRemoved: this.detectDebuffsRemoved(this.previousState, newState),
      deaths: this.detectDeaths(this.previousState, newState)
    };

    // Merge events (server events take priority)
    const merged: DetectedEvents = {
      damages: [...serverEvents.damages, ...stateDiffEvents.damages],
      heals: [...serverEvents.heals, ...stateDiffEvents.heals],
      projectiles: [...serverEvents.projectiles, ...stateDiffEvents.projectiles],
      buffsApplied: [...serverEvents.buffsApplied, ...stateDiffEvents.buffsApplied],
      buffsRemoved: [...serverEvents.buffsRemoved, ...stateDiffEvents.buffsRemoved],
      debuffsApplied: [...serverEvents.debuffsApplied, ...stateDiffEvents.debuffsApplied],
      debuffsRemoved: [...serverEvents.debuffsRemoved, ...stateDiffEvents.debuffsRemoved],
      deaths: [...serverEvents.deaths, ...stateDiffEvents.deaths]
    };

    this.previousState = newState;
    return merged;
  }

  /**
   * Process server-sent events from state.events array
   */
  private processServerEvents(state: CombatState): DetectedEvents {
    const events: DetectedEvents = this.createEmptyEvents();

    if (!state.events || state.events.length === 0) {
      return events;
    }

    for (const event of state.events) {
      switch (event.eventType) {
        case 'damage_dealt':
          if (event.data.targetUnitId && event.data.damage) {
            events.damages.push({
              unitId: event.data.targetUnitId,
              oldHealth: (event.data.oldHealth !== undefined) ? event.data.oldHealth : 0,
              newHealth: (event.data.newHealth !== undefined) ? event.data.newHealth : 0,
              damageAmount: event.data.damage,
              tick: event.tick
            });
          }
          break;

        case 'healing_done':
          if (event.data.targetUnitId && event.data.healing) {
            events.heals.push({
              unitId: event.data.targetUnitId,
              oldHealth: (event.data.oldHealth !== undefined) ? event.data.oldHealth : 0,
              newHealth: (event.data.newHealth !== undefined) ? event.data.newHealth : 0,
              healAmount: event.data.healing,
              tick: event.tick
            });
          }
          break;

        case 'projectile_spawned':
          if (event.data.projectileId && event.data.sourceUnitId && event.data.targetUnitId) {
            events.projectiles.push({
              projectileId: event.data.projectileId,
              sourceUnitId: event.data.sourceUnitId,
              targetUnitId: event.data.targetUnitId,
              sourcePosition: event.data.sourcePosition || { q: 0, r: 0 },
              targetPosition: event.data.targetPosition || { q: 0, r: 0 },
              tick: event.tick
            });
          }
          break;

        case 'unit_died':
          if (event.data.unitId) {
            events.deaths.push({
              unitId: event.data.unitId,
              tick: event.tick
            });
          }
          break;

        case 'buff_applied':
          if (event.data.unitId && event.data.buffId) {
            events.buffsApplied.push({
              unitId: event.data.unitId,
              buffId: event.data.buffId,
              buffName: event.data.buffName || 'Unknown Buff',
              duration: event.data.duration || 0,
              stacks: event.data.stacks,
              tick: event.tick
            });
          }
          break;

        case 'debuff_applied':
          if (event.data.unitId && event.data.debuffId) {
            events.debuffsApplied.push({
              unitId: event.data.unitId,
              buffId: event.data.debuffId,
              buffName: event.data.debuffName || 'Unknown Debuff',
              duration: event.data.duration || 0,
              stacks: event.data.stacks,
              tick: event.tick
            });
          }
          break;
      }
    }

    return events;
  }

  /**
   * Create empty events object
   */
  private createEmptyEvents(): DetectedEvents {
    return {
      damages: [],
      heals: [],
      projectiles: [],
      buffsApplied: [],
      buffsRemoved: [],
      debuffsApplied: [],
      debuffsRemoved: [],
      deaths: []
    };
  }

  /**
   * Detect damage events (health decreasing)
   */
  private detectDamage(oldState: CombatState, newState: CombatState): DamageEvent[] {
    const events: DamageEvent[] = [];

    for (const newUnit of newState.units) {
      const oldUnit = oldState.units.find(u => u.unitId === newUnit.unitId);
      if (!oldUnit) continue; // New unit, not damage

      if (newUnit.health < oldUnit.health) {
        events.push({
          unitId: newUnit.unitId,
          oldHealth: oldUnit.health,
          newHealth: newUnit.health,
          damageAmount: oldUnit.health - newUnit.health,
          tick: newState.tick
        });
      }
    }

    return events;
  }

  /**
   * Detect healing events (health increasing)
   */
  private detectHealing(oldState: CombatState, newState: CombatState): HealingEvent[] {
    const events: HealingEvent[] = [];

    for (const newUnit of newState.units) {
      const oldUnit = oldState.units.find(u => u.unitId === newUnit.unitId);
      if (!oldUnit) continue; // New unit, not healing

      if (newUnit.health > oldUnit.health) {
        events.push({
          unitId: newUnit.unitId,
          oldHealth: oldUnit.health,
          newHealth: newUnit.health,
          healAmount: newUnit.health - oldUnit.health,
          tick: newState.tick
        });
      }
    }

    return events;
  }

  /**
   * Detect new projectiles spawned
   */
  private detectNewProjectiles(oldState: CombatState, newState: CombatState): ProjectileSpawnEvent[] {
    const events: ProjectileSpawnEvent[] = [];

    const oldProjectileIds = new Set(oldState.projectiles.map(p => p.projectileId));

    for (const projectile of newState.projectiles) {
      if (!oldProjectileIds.has(projectile.projectileId)) {
        events.push({
          projectileId: projectile.projectileId,
          sourceUnitId: projectile.sourceUnitId,
          targetUnitId: projectile.targetUnitId,
          sourcePosition: projectile.position,
          targetPosition: projectile.targetPosition,
          tick: newState.tick
        });
      }
    }

    return events;
  }

  /**
   * Detect buffs applied
   */
  private detectBuffsApplied(oldState: CombatState, newState: CombatState): BuffAppliedEvent[] {
    const events: BuffAppliedEvent[] = [];

    for (const newUnit of newState.units) {
      const oldUnit = oldState.units.find(u => u.unitId === newUnit.unitId);
      if (!oldUnit) continue;

      const oldBuffIds = new Set(oldUnit.activeBuffs.map(b => b.buffId));

      for (const buff of newUnit.activeBuffs) {
        if (!oldBuffIds.has(buff.buffId)) {
          events.push({
            unitId: newUnit.unitId,
            buffId: buff.buffId,
            buffName: buff.name,
            duration: buff.durationRemaining,
            tick: newState.tick
          });
        }
      }
    }

    return events;
  }

  /**
   * Detect buffs removed
   */
  private detectBuffsRemoved(oldState: CombatState, newState: CombatState): BuffRemovedEvent[] {
    const events: BuffRemovedEvent[] = [];

    for (const oldUnit of oldState.units) {
      const newUnit = newState.units.find(u => u.unitId === oldUnit.unitId);
      if (!newUnit) continue;

      const newBuffIds = new Set(newUnit.activeBuffs.map(b => b.buffId));

      for (const buff of oldUnit.activeBuffs) {
        if (!newBuffIds.has(buff.buffId)) {
          events.push({
            unitId: oldUnit.unitId,
            buffId: buff.buffId,
            buffName: buff.name,
            tick: newState.tick
          });
        }
      }
    }

    return events;
  }

  /**
   * Detect debuffs applied
   */
  private detectDebuffsApplied(oldState: CombatState, newState: CombatState): BuffAppliedEvent[] {
    const events: BuffAppliedEvent[] = [];

    for (const newUnit of newState.units) {
      const oldUnit = oldState.units.find(u => u.unitId === newUnit.unitId);
      if (!oldUnit) continue;

      const oldDebuffIds = new Set(oldUnit.activeDebuffs.map(b => b.buffId));

      for (const debuff of newUnit.activeDebuffs) {
        if (!oldDebuffIds.has(debuff.buffId)) {
          events.push({
            unitId: newUnit.unitId,
            buffId: debuff.buffId,
            buffName: debuff.name,
            duration: debuff.durationRemaining,
            tick: newState.tick
          });
        }
      }
    }

    return events;
  }

  /**
   * Detect debuffs removed
   */
  private detectDebuffsRemoved(oldState: CombatState, newState: CombatState): BuffRemovedEvent[] {
    const events: BuffRemovedEvent[] = [];

    for (const oldUnit of oldState.units) {
      const newUnit = newState.units.find(u => u.unitId === oldUnit.unitId);
      if (!newUnit) continue;

      const newDebuffIds = new Set(newUnit.activeDebuffs.map(b => b.buffId));

      for (const debuff of oldUnit.activeDebuffs) {
        if (!newDebuffIds.has(debuff.buffId)) {
          events.push({
            unitId: oldUnit.unitId,
            buffId: debuff.buffId,
            buffName: debuff.name,
            tick: newState.tick
          });
        }
      }
    }

    return events;
  }

  /**
   * Detect unit deaths
   */
  private detectDeaths(oldState: CombatState, newState: CombatState): UnitDeathEvent[] {
    const events: UnitDeathEvent[] = [];

    const newUnitIds = new Set(newState.units.map(u => u.unitId));

    for (const oldUnit of oldState.units) {
      const newUnit = newState.units.find(u => u.unitId === oldUnit.unitId);

      // Unit removed from state = death
      if (!newUnit) {
        events.push({
          unitId: oldUnit.unitId,
          tick: newState.tick
        });
        continue;
      }

      // Status changed to dead
      if (oldUnit.status === 'alive' && newUnit.status === 'dead') {
        events.push({
          unitId: oldUnit.unitId,
          tick: newState.tick
        });
      }
    }

    return events;
  }
}
