/**
 * TASK-COMBAT-VIZ-014: Combat Log Tests
 *
 * Test-driven development for combat log system.
 * Displays text-based combat events in a scrollable log.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CombatLog, CombatEventType, CombatLogEntry } from '../combat-log';

describe('CombatLog', () => {
  let log: CombatLog;

  beforeEach(() => {
    log = new CombatLog();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      expect(log).toBeDefined();
      expect(log.getConfig().maxEntries).toBe(100);
    });

    it('should accept custom configuration', () => {
      const customLog = new CombatLog({
        maxEntries: 50,
        showTimestamps: true
      });

      expect(customLog.getConfig().maxEntries).toBe(50);
      expect(customLog.getConfig().showTimestamps).toBe(true);
    });

    it('should start with empty log', () => {
      expect(log.getEntries()).toHaveLength(0);
    });
  });

  describe('Event Types', () => {
    it('should support attack event type', () => {
      log.addEntry({
        type: CombatEventType.ATTACK,
        message: 'Knight attacks Goblin'
      });

      const entries = log.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].type).toBe(CombatEventType.ATTACK);
    });

    it('should support damage event type', () => {
      log.addEntry({
        type: CombatEventType.DAMAGE,
        message: 'Goblin takes 15 damage'
      });

      const entries = log.getEntries();
      expect(entries[0].type).toBe(CombatEventType.DAMAGE);
    });

    it('should support heal event type', () => {
      log.addEntry({
        type: CombatEventType.HEAL,
        message: 'Cleric heals Knight for 20'
      });

      const entries = log.getEntries();
      expect(entries[0].type).toBe(CombatEventType.HEAL);
    });

    it('should support death event type', () => {
      log.addEntry({
        type: CombatEventType.DEATH,
        message: 'Goblin has been slain'
      });

      const entries = log.getEntries();
      expect(entries[0].type).toBe(CombatEventType.DEATH);
    });

    it('should support ability event type', () => {
      log.addEntry({
        type: CombatEventType.ABILITY,
        message: 'Mage casts Fireball'
      });

      const entries = log.getEntries();
      expect(entries[0].type).toBe(CombatEventType.ABILITY);
    });

    it('should support status event type', () => {
      log.addEntry({
        type: CombatEventType.STATUS,
        message: 'Knight is poisoned'
      });

      const entries = log.getEntries();
      expect(entries[0].type).toBe(CombatEventType.STATUS);
    });
  });

  describe('Adding Entries', () => {
    it('should add entry with message', () => {
      log.addEntry({
        type: CombatEventType.ATTACK,
        message: 'Test message'
      });

      const entries = log.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].message).toBe('Test message');
    });

    it('should auto-assign timestamp', () => {
      const before = Date.now();
      log.addEntry({
        type: CombatEventType.ATTACK,
        message: 'Test'
      });
      const after = Date.now();

      const entries = log.getEntries();
      expect(entries[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(entries[0].timestamp).toBeLessThanOrEqual(after);
    });

    it('should auto-assign ID', () => {
      log.addEntry({
        type: CombatEventType.ATTACK,
        message: 'First'
      });

      log.addEntry({
        type: CombatEventType.ATTACK,
        message: 'Second'
      });

      const entries = log.getEntries();
      expect(entries[0].id).toBeDefined();
      expect(entries[1].id).toBeDefined();
      expect(entries[0].id).not.toBe(entries[1].id);
    });

    it('should add multiple entries', () => {
      log.addEntry({
        type: CombatEventType.ATTACK,
        message: 'First'
      });

      log.addEntry({
        type: CombatEventType.DAMAGE,
        message: 'Second'
      });

      log.addEntry({
        type: CombatEventType.HEAL,
        message: 'Third'
      });

      expect(log.getEntries()).toHaveLength(3);
    });

    it('should preserve entry order (newest first)', () => {
      log.addEntry({
        type: CombatEventType.ATTACK,
        message: 'First'
      });

      log.addEntry({
        type: CombatEventType.ATTACK,
        message: 'Second'
      });

      const entries = log.getEntries();
      expect(entries[0].message).toBe('Second'); // Most recent first
      expect(entries[1].message).toBe('First');
    });
  });

  describe('Max Entries Limit', () => {
    it('should respect max entries limit', () => {
      const limitedLog = new CombatLog({ maxEntries: 5 });

      for (let i = 0; i < 10; i++) {
        limitedLog.addEntry({
          type: CombatEventType.ATTACK,
          message: `Entry ${i}`
        });
      }

      expect(limitedLog.getEntries()).toHaveLength(5);
    });

    it('should keep most recent entries when limit exceeded', () => {
      const limitedLog = new CombatLog({ maxEntries: 3 });

      limitedLog.addEntry({
        type: CombatEventType.ATTACK,
        message: 'First'
      });

      limitedLog.addEntry({
        type: CombatEventType.ATTACK,
        message: 'Second'
      });

      limitedLog.addEntry({
        type: CombatEventType.ATTACK,
        message: 'Third'
      });

      limitedLog.addEntry({
        type: CombatEventType.ATTACK,
        message: 'Fourth'
      });

      const entries = limitedLog.getEntries();
      expect(entries).toHaveLength(3);
      expect(entries[0].message).toBe('Fourth');
      expect(entries[1].message).toBe('Third');
      expect(entries[2].message).toBe('Second');
      // 'First' should be dropped
    });
  });

  describe('Clear Log', () => {
    it('should clear all entries', () => {
      log.addEntry({
        type: CombatEventType.ATTACK,
        message: 'First'
      });

      log.addEntry({
        type: CombatEventType.ATTACK,
        message: 'Second'
      });

      log.clear();

      expect(log.getEntries()).toHaveLength(0);
    });

    it('should allow new entries after clear', () => {
      log.addEntry({
        type: CombatEventType.ATTACK,
        message: 'Before'
      });

      log.clear();

      log.addEntry({
        type: CombatEventType.ATTACK,
        message: 'After'
      });

      const entries = log.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].message).toBe('After');
    });
  });

  describe('Filtering', () => {
    beforeEach(() => {
      log.addEntry({ type: CombatEventType.ATTACK, message: 'Attack 1' });
      log.addEntry({ type: CombatEventType.DAMAGE, message: 'Damage 1' });
      log.addEntry({ type: CombatEventType.HEAL, message: 'Heal 1' });
      log.addEntry({ type: CombatEventType.ATTACK, message: 'Attack 2' });
      log.addEntry({ type: CombatEventType.DEATH, message: 'Death 1' });
    });

    it('should filter by event type', () => {
      const attacks = log.getEntries(CombatEventType.ATTACK);

      expect(attacks).toHaveLength(2);
      expect(attacks[0].message).toBe('Attack 2');
      expect(attacks[1].message).toBe('Attack 1');
    });

    it('should return all entries when no filter specified', () => {
      const all = log.getEntries();

      expect(all).toHaveLength(5);
    });

    it('should return empty array for type with no entries', () => {
      const abilities = log.getEntries(CombatEventType.ABILITY);

      expect(abilities).toHaveLength(0);
    });
  });

  describe('Entry Formatting', () => {
    it('should format entry as plain text', () => {
      log.addEntry({
        type: CombatEventType.ATTACK,
        message: 'Test message'
      });

      const formatted = log.formatEntry(log.getEntries()[0]);

      expect(formatted).toContain('Test message');
      expect(typeof formatted).toBe('string');
    });

    it('should include timestamp when enabled', () => {
      const logWithTimestamps = new CombatLog({ showTimestamps: true });

      logWithTimestamps.addEntry({
        type: CombatEventType.ATTACK,
        message: 'Test'
      });

      const formatted = logWithTimestamps.formatEntry(logWithTimestamps.getEntries()[0]);

      expect(formatted).toMatch(/\[\d{2}:\d{2}:\d{2}\]/); // [HH:MM:SS]
    });

    it('should not include timestamp when disabled', () => {
      const logWithoutTimestamps = new CombatLog({ showTimestamps: false });

      logWithoutTimestamps.addEntry({
        type: CombatEventType.ATTACK,
        message: 'Test'
      });

      const formatted = logWithoutTimestamps.formatEntry(logWithoutTimestamps.getEntries()[0]);

      expect(formatted).not.toMatch(/\[\d{2}:\d{2}:\d{2}\]/);
    });
  });

  describe('Batch Operations', () => {
    it('should handle adding many entries efficiently', () => {
      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        log.addEntry({
          type: CombatEventType.ATTACK,
          message: `Entry ${i}`
        });
      }

      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(50); // Should add 100 entries in < 50ms
      expect(log.getEntries()).toHaveLength(100);
    });

    it('should handle filtering large logs efficiently', () => {
      for (let i = 0; i < 100; i++) {
        log.addEntry({
          type: i % 2 === 0 ? CombatEventType.ATTACK : CombatEventType.DAMAGE,
          message: `Entry ${i}`
        });
      }

      const startTime = performance.now();
      const filtered = log.getEntries(CombatEventType.ATTACK);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(5); // Should filter in < 5ms
      expect(filtered).toHaveLength(50);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty message', () => {
      log.addEntry({
        type: CombatEventType.ATTACK,
        message: ''
      });

      const entries = log.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].message).toBe('');
    });

    it('should handle very long messages', () => {
      const longMessage = 'A'.repeat(1000);

      log.addEntry({
        type: CombatEventType.ATTACK,
        message: longMessage
      });

      const entries = log.getEntries();
      expect(entries[0].message).toBe(longMessage);
    });

    it('should handle special characters in messages', () => {
      const specialMessage = 'Test <script>alert("xss")</script> & "quotes"';

      log.addEntry({
        type: CombatEventType.ATTACK,
        message: specialMessage
      });

      const entries = log.getEntries();
      expect(entries[0].message).toBe(specialMessage);
    });
  });

  describe('Performance', () => {
    it('should retrieve entries efficiently', () => {
      for (let i = 0; i < 100; i++) {
        log.addEntry({
          type: CombatEventType.ATTACK,
          message: `Entry ${i}`
        });
      }

      const startTime = performance.now();
      const entries = log.getEntries();
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(2); // Should retrieve in < 2ms
      expect(entries).toHaveLength(100);
    });

    it('should clear log efficiently', () => {
      for (let i = 0; i < 100; i++) {
        log.addEntry({
          type: CombatEventType.ATTACK,
          message: `Entry ${i}`
        });
      }

      const startTime = performance.now();
      log.clear();
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(2); // Should clear in < 2ms
      expect(log.getEntries()).toHaveLength(0);
    });
  });

  describe('Entry Colors', () => {
    it('should assign color based on event type', () => {
      const entry = log.addEntry({
        type: CombatEventType.DAMAGE,
        message: 'Test'
      });

      const color = log.getEventColor(entry.type);
      expect(color).toBeDefined();
      expect(typeof color).toBe('string');
    });

    it('should have different colors for different types', () => {
      const attackColor = log.getEventColor(CombatEventType.ATTACK);
      const healColor = log.getEventColor(CombatEventType.HEAL);
      const deathColor = log.getEventColor(CombatEventType.DEATH);

      expect(attackColor).not.toBe(healColor);
      expect(healColor).not.toBe(deathColor);
      expect(attackColor).not.toBe(deathColor);
    });
  });
});
