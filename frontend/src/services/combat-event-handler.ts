/**
 * TASK-COMBAT-VIZ-003: Combat Event Handler Implementation
 *
 * Processes combat:events stream with buffering, deduplication, and type-specific callbacks.
 * Maintains rolling event buffer for combat log and analytics.
 */

import type { CombatEvent } from '@drawn-of-war/shared/types/combat';

/**
 * Event handler options
 */
export interface CombatEventHandlerOptions {
  /** Maximum number of events to keep in buffer (default: 100) */
  bufferSize?: number;
}

/**
 * Event callback function
 */
type EventCallback = (event: CombatEvent) => void;

/**
 * CombatEventHandler
 *
 * Processes incoming combat events, maintains event buffer, and triggers type-specific callbacks.
 */
export class CombatEventHandler {
  private eventBuffer: CombatEvent[] = [];
  private bufferSize: number;
  private eventSet: Set<string> = new Set();

  // Event type callbacks
  private damageDealtCallbacks: EventCallback[] = [];
  private healingDoneCallbacks: EventCallback[] = [];
  private abilityUsedCallbacks: EventCallback[] = [];
  private unitDiedCallbacks: EventCallback[] = [];
  private projectileSpawnedCallbacks: EventCallback[] = [];
  private buffAppliedCallbacks: EventCallback[] = [];
  private debuffAppliedCallbacks: EventCallback[] = [];

  constructor(options: CombatEventHandlerOptions = {}) {
    this.bufferSize = options.bufferSize ?? 100;
  }

  /**
   * Process incoming combat events
   */
  public processEvents(events: CombatEvent[]): void {
    // Filter out duplicate events
    const newEvents = events.filter(event => {
      const eventKey = this.getEventKey(event);
      if (this.eventSet.has(eventKey)) {
        return false; // Duplicate
      }
      this.eventSet.add(eventKey);
      return true;
    });

    // Add to buffer
    this.eventBuffer.push(...newEvents);

    // Sort by tick to maintain chronological order
    this.eventBuffer.sort((a, b) => a.tick - b.tick);

    // Trim buffer to size limit
    if (this.eventBuffer.length > this.bufferSize) {
      const removed = this.eventBuffer.splice(0, this.eventBuffer.length - this.bufferSize);
      // Remove keys for evicted events
      removed.forEach(event => {
        this.eventSet.delete(this.getEventKey(event));
      });
    }

    // Trigger callbacks for new events
    newEvents.forEach(event => {
      this.triggerCallbacks(event);
    });
  }

  /**
   * Get all recent events
   */
  public getRecentEvents(): CombatEvent[] {
    return [...this.eventBuffer];
  }

  /**
   * Get events by type
   */
  public getEventsByType(eventType: CombatEvent['eventType']): CombatEvent[] {
    return this.eventBuffer.filter(event => event.eventType === eventType);
  }

  /**
   * Get events by tick range (inclusive)
   */
  public getEventsByTickRange(startTick: number, endTick: number): CombatEvent[] {
    return this.eventBuffer.filter(event => event.tick >= startTick && event.tick <= endTick);
  }

  /**
   * Clear all events from buffer
   */
  public clear(): void {
    this.eventBuffer = [];
    this.eventSet.clear();
  }

  /**
   * Register callback for damage_dealt events
   */
  public onDamageDealt(callback: EventCallback): void {
    this.damageDealtCallbacks.push(callback);
  }

  /**
   * Register callback for healing_done events
   */
  public onHealingDone(callback: EventCallback): void {
    this.healingDoneCallbacks.push(callback);
  }

  /**
   * Register callback for ability_used events
   */
  public onAbilityUsed(callback: EventCallback): void {
    this.abilityUsedCallbacks.push(callback);
  }

  /**
   * Register callback for unit_died events
   */
  public onUnitDied(callback: EventCallback): void {
    this.unitDiedCallbacks.push(callback);
  }

  /**
   * Register callback for projectile_spawned events
   */
  public onProjectileSpawned(callback: EventCallback): void {
    this.projectileSpawnedCallbacks.push(callback);
  }

  /**
   * Register callback for buff_applied events
   */
  public onBuffApplied(callback: EventCallback): void {
    this.buffAppliedCallbacks.push(callback);
  }

  /**
   * Register callback for debuff_applied events
   */
  public onDebuffApplied(callback: EventCallback): void {
    this.debuffAppliedCallbacks.push(callback);
  }

  /**
   * Generate unique key for event deduplication
   */
  private getEventKey(event: CombatEvent): string {
    return `${event.tick}:${event.eventType}:${JSON.stringify(event.data)}`;
  }

  /**
   * Trigger callbacks for event based on type
   */
  private triggerCallbacks(event: CombatEvent): void {
    switch (event.eventType) {
      case 'damage_dealt':
        this.damageDealtCallbacks.forEach(cb => cb(event));
        break;
      case 'healing_done':
        this.healingDoneCallbacks.forEach(cb => cb(event));
        break;
      case 'ability_used':
        this.abilityUsedCallbacks.forEach(cb => cb(event));
        break;
      case 'unit_died':
        this.unitDiedCallbacks.forEach(cb => cb(event));
        break;
      case 'projectile_spawned':
        this.projectileSpawnedCallbacks.forEach(cb => cb(event));
        break;
      case 'buff_applied':
        this.buffAppliedCallbacks.forEach(cb => cb(event));
        break;
      case 'debuff_applied':
        this.debuffAppliedCallbacks.forEach(cb => cb(event));
        break;
    }
  }
}
