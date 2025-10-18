/**
 * TASK-COMBAT-VIZ-003: Combat Event Handler Tests
 *
 * Test-driven development for processing combat:events stream.
 * Handles event buffering, deduplication, and type-specific callbacks.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CombatEventHandler } from '../combat-event-handler';
import type { CombatEvent } from '@drawn-of-war/shared/types/combat';

describe('CombatEventHandler', () => {
  let handler: CombatEventHandler;

  beforeEach(() => {
    handler = new CombatEventHandler();
  });

  describe('Event Processing', () => {
    it('should process single event', () => {
      const event: CombatEvent = {
        tick: 100,
        eventType: 'damage_dealt',
        data: { sourceId: 'unit-1', targetId: 'unit-2', amount: 25 }
      };

      handler.processEvents([event]);

      const events = handler.getRecentEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual(event);
    });

    it('should process multiple events', () => {
      const events: CombatEvent[] = [
        {
          tick: 100,
          eventType: 'damage_dealt',
          data: { sourceId: 'unit-1', targetId: 'unit-2', amount: 25 }
        },
        {
          tick: 101,
          eventType: 'ability_used',
          data: { unitId: 'unit-1', abilityId: 'fireball' }
        },
        {
          tick: 102,
          eventType: 'unit_died',
          data: { unitId: 'unit-2', killer: 'unit-1' }
        }
      ];

      handler.processEvents(events);

      const recentEvents = handler.getRecentEvents();
      expect(recentEvents).toHaveLength(3);
    });

    it('should handle empty event array', () => {
      handler.processEvents([]);

      const events = handler.getRecentEvents();
      expect(events).toHaveLength(0);
    });

    it('should maintain chronological order by tick', () => {
      const events: CombatEvent[] = [
        {
          tick: 105,
          eventType: 'damage_dealt',
          data: { amount: 10 }
        },
        {
          tick: 102,
          eventType: 'damage_dealt',
          data: { amount: 20 }
        },
        {
          tick: 108,
          eventType: 'damage_dealt',
          data: { amount: 30 }
        }
      ];

      handler.processEvents(events);

      const recentEvents = handler.getRecentEvents();
      expect(recentEvents[0].tick).toBe(102);
      expect(recentEvents[1].tick).toBe(105);
      expect(recentEvents[2].tick).toBe(108);
    });
  });

  describe('Event Buffering', () => {
    it('should maintain buffer of last 100 events by default', () => {
      const events: CombatEvent[] = Array.from({ length: 150 }, (_, i) => ({
        tick: i,
        eventType: 'damage_dealt',
        data: { amount: i }
      }));

      handler.processEvents(events);

      const recentEvents = handler.getRecentEvents();
      expect(recentEvents).toHaveLength(100);
      expect(recentEvents[0].tick).toBe(50); // First event should be tick 50
      expect(recentEvents[99].tick).toBe(149); // Last event should be tick 149
    });

    it('should support custom buffer size', () => {
      handler = new CombatEventHandler({ bufferSize: 50 });

      const events: CombatEvent[] = Array.from({ length: 75 }, (_, i) => ({
        tick: i,
        eventType: 'damage_dealt',
        data: { amount: i }
      }));

      handler.processEvents(events);

      const recentEvents = handler.getRecentEvents();
      expect(recentEvents).toHaveLength(50);
      expect(recentEvents[0].tick).toBe(25);
    });

    it('should append new events to existing buffer', () => {
      const firstBatch: CombatEvent[] = [
        { tick: 10, eventType: 'damage_dealt', data: {} },
        { tick: 20, eventType: 'damage_dealt', data: {} }
      ];

      const secondBatch: CombatEvent[] = [
        { tick: 30, eventType: 'damage_dealt', data: {} },
        { tick: 40, eventType: 'damage_dealt', data: {} }
      ];

      handler.processEvents(firstBatch);
      handler.processEvents(secondBatch);

      const recentEvents = handler.getRecentEvents();
      expect(recentEvents).toHaveLength(4);
      expect(recentEvents.map(e => e.tick)).toEqual([10, 20, 30, 40]);
    });
  });

  describe('Event Deduplication', () => {
    it('should deduplicate events with same tick and type', () => {
      const events: CombatEvent[] = [
        {
          tick: 100,
          eventType: 'damage_dealt',
          data: { sourceId: 'unit-1', targetId: 'unit-2', amount: 25 }
        },
        {
          tick: 100,
          eventType: 'damage_dealt',
          data: { sourceId: 'unit-1', targetId: 'unit-2', amount: 25 }
        }
      ];

      handler.processEvents(events);

      const recentEvents = handler.getRecentEvents();
      expect(recentEvents).toHaveLength(1);
    });

    it('should allow duplicate ticks with different event types', () => {
      const events: CombatEvent[] = [
        {
          tick: 100,
          eventType: 'damage_dealt',
          data: { amount: 25 }
        },
        {
          tick: 100,
          eventType: 'ability_used',
          data: { abilityId: 'fireball' }
        }
      ];

      handler.processEvents(events);

      const recentEvents = handler.getRecentEvents();
      expect(recentEvents).toHaveLength(2);
    });

    it('should not deduplicate events across multiple processEvents calls', () => {
      const event: CombatEvent = {
        tick: 100,
        eventType: 'damage_dealt',
        data: { amount: 25 }
      };

      handler.processEvents([event]);
      handler.processEvents([event]);

      const recentEvents = handler.getRecentEvents();
      expect(recentEvents).toHaveLength(1); // Should still deduplicate
    });
  });

  describe('Event Type Callbacks', () => {
    it('should trigger callback for damage_dealt events', () => {
      const callback = vi.fn();
      handler.onDamageDealt(callback);

      const event: CombatEvent = {
        tick: 100,
        eventType: 'damage_dealt',
        data: { sourceId: 'unit-1', targetId: 'unit-2', amount: 25 }
      };

      handler.processEvents([event]);

      expect(callback).toHaveBeenCalledWith(event);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should trigger callback for healing_done events', () => {
      const callback = vi.fn();
      handler.onHealingDone(callback);

      const event: CombatEvent = {
        tick: 100,
        eventType: 'healing_done',
        data: { sourceId: 'unit-1', targetId: 'unit-3', amount: 50 }
      };

      handler.processEvents([event]);

      expect(callback).toHaveBeenCalledWith(event);
    });

    it('should trigger callback for ability_used events', () => {
      const callback = vi.fn();
      handler.onAbilityUsed(callback);

      const event: CombatEvent = {
        tick: 100,
        eventType: 'ability_used',
        data: { unitId: 'unit-1', abilityId: 'fireball' }
      };

      handler.processEvents([event]);

      expect(callback).toHaveBeenCalledWith(event);
    });

    it('should trigger callback for unit_died events', () => {
      const callback = vi.fn();
      handler.onUnitDied(callback);

      const event: CombatEvent = {
        tick: 100,
        eventType: 'unit_died',
        data: { unitId: 'unit-2', killer: 'unit-1' }
      };

      handler.processEvents([event]);

      expect(callback).toHaveBeenCalledWith(event);
    });

    it('should trigger callback for projectile_spawned events', () => {
      const callback = vi.fn();
      handler.onProjectileSpawned(callback);

      const event: CombatEvent = {
        tick: 100,
        eventType: 'projectile_spawned',
        data: { projectileId: 'proj-1', sourceId: 'unit-1' }
      };

      handler.processEvents([event]);

      expect(callback).toHaveBeenCalledWith(event);
    });

    it('should trigger callback for buff_applied events', () => {
      const callback = vi.fn();
      handler.onBuffApplied(callback);

      const event: CombatEvent = {
        tick: 100,
        eventType: 'buff_applied',
        data: { buffId: 'speed-boost', targetId: 'unit-1' }
      };

      handler.processEvents([event]);

      expect(callback).toHaveBeenCalledWith(event);
    });

    it('should trigger callback for debuff_applied events', () => {
      const callback = vi.fn();
      handler.onDebuffApplied(callback);

      const event: CombatEvent = {
        tick: 100,
        eventType: 'debuff_applied',
        data: { debuffId: 'slow', targetId: 'unit-2' }
      };

      handler.processEvents([event]);

      expect(callback).toHaveBeenCalledWith(event);
    });

    it('should support multiple callbacks for same event type', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      handler.onDamageDealt(callback1);
      handler.onDamageDealt(callback2);

      const event: CombatEvent = {
        tick: 100,
        eventType: 'damage_dealt',
        data: { amount: 25 }
      };

      handler.processEvents([event]);

      expect(callback1).toHaveBeenCalledWith(event);
      expect(callback2).toHaveBeenCalledWith(event);
    });

    it('should not trigger callbacks for different event types', () => {
      const damageCallback = vi.fn();
      const healCallback = vi.fn();
      handler.onDamageDealt(damageCallback);
      handler.onHealingDone(healCallback);

      const event: CombatEvent = {
        tick: 100,
        eventType: 'damage_dealt',
        data: { amount: 25 }
      };

      handler.processEvents([event]);

      expect(damageCallback).toHaveBeenCalledTimes(1);
      expect(healCallback).toHaveBeenCalledTimes(0);
    });
  });

  describe('Clear and Reset', () => {
    it('should clear all events from buffer', () => {
      const events: CombatEvent[] = [
        { tick: 10, eventType: 'damage_dealt', data: {} },
        { tick: 20, eventType: 'damage_dealt', data: {} }
      ];

      handler.processEvents(events);
      handler.clear();

      const recentEvents = handler.getRecentEvents();
      expect(recentEvents).toHaveLength(0);
    });

    it('should continue processing events after clear', () => {
      handler.processEvents([
        { tick: 10, eventType: 'damage_dealt', data: {} }
      ]);

      handler.clear();

      handler.processEvents([
        { tick: 20, eventType: 'damage_dealt', data: {} }
      ]);

      const recentEvents = handler.getRecentEvents();
      expect(recentEvents).toHaveLength(1);
      expect(recentEvents[0].tick).toBe(20);
    });
  });

  describe('Event Filtering', () => {
    it('should filter events by type', () => {
      const events: CombatEvent[] = [
        { tick: 10, eventType: 'damage_dealt', data: {} },
        { tick: 20, eventType: 'healing_done', data: {} },
        { tick: 30, eventType: 'damage_dealt', data: {} },
        { tick: 40, eventType: 'ability_used', data: {} }
      ];

      handler.processEvents(events);

      const damageEvents = handler.getEventsByType('damage_dealt');
      expect(damageEvents).toHaveLength(2);
      expect(damageEvents.every(e => e.eventType === 'damage_dealt')).toBe(true);
    });

    it('should filter events by tick range', () => {
      const events: CombatEvent[] = Array.from({ length: 10 }, (_, i) => ({
        tick: i * 10,
        eventType: 'damage_dealt',
        data: {}
      }));

      handler.processEvents(events);

      const filteredEvents = handler.getEventsByTickRange(20, 50);
      expect(filteredEvents).toHaveLength(4); // ticks 20, 30, 40, 50
      expect(filteredEvents[0].tick).toBe(20);
      expect(filteredEvents[3].tick).toBe(50);
    });

    it('should return empty array when no events match filter', () => {
      const events: CombatEvent[] = [
        { tick: 10, eventType: 'damage_dealt', data: {} }
      ];

      handler.processEvents(events);

      const healEvents = handler.getEventsByType('healing_done');
      expect(healEvents).toHaveLength(0);
    });
  });

  describe('Performance', () => {
    it('should handle large event batches efficiently', () => {
      const startTime = performance.now();

      const events: CombatEvent[] = Array.from({ length: 1000 }, (_, i) => ({
        tick: i,
        eventType: 'damage_dealt',
        data: { amount: i }
      }));

      handler.processEvents(events);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should process 1000 events in less than 100ms
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Edge Cases', () => {
    it('should handle events with negative ticks gracefully', () => {
      const event: CombatEvent = {
        tick: -1,
        eventType: 'damage_dealt',
        data: {}
      };

      handler.processEvents([event]);

      const recentEvents = handler.getRecentEvents();
      expect(recentEvents).toHaveLength(1);
    });

    it('should handle events with very large tick numbers', () => {
      const event: CombatEvent = {
        tick: Number.MAX_SAFE_INTEGER,
        eventType: 'damage_dealt',
        data: {}
      };

      handler.processEvents([event]);

      const recentEvents = handler.getRecentEvents();
      expect(recentEvents).toHaveLength(1);
      expect(recentEvents[0].tick).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should handle events with empty data objects', () => {
      const event: CombatEvent = {
        tick: 100,
        eventType: 'damage_dealt',
        data: {}
      };

      handler.processEvents([event]);

      const recentEvents = handler.getRecentEvents();
      expect(recentEvents).toHaveLength(1);
    });
  });
});
