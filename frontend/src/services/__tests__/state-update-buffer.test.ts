/**
 * TASK-COMBAT-VIZ-004: StateUpdateBuffer Tests
 *
 * Test-driven development for buffering combat state updates.
 * Handles 10 updates/sec from backend, provides smooth interpolation for 60 FPS rendering.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StateUpdateBuffer } from '../state-update-buffer';
import type { CombatState } from '@drawn-of-war/shared/types/combat';

describe('StateUpdateBuffer', () => {
  let buffer: StateUpdateBuffer;

  const createMockState = (tick: number, timestamp?: number): CombatState => ({
    matchId: 'test-match',
    tick,
    status: 'running',
    units: [],
    projectiles: [],
    events: [],
    statistics: {
      totalDamageDealt: { player1: 0, player2: 0 },
      totalHealingDone: { player1: 0, player2: 0 },
      unitsLost: { player1: 0, player2: 0 },
      abilitiesUsed: { player1: 0, player2: 0 },
      duration: tick
    },
    startTime: timestamp ?? Date.now()
  });

  beforeEach(() => {
    buffer = new StateUpdateBuffer();
  });

  describe('State Buffering', () => {
    it('should store incoming state updates', () => {
      const state = createMockState(0);
      buffer.addState(state);

      const current = buffer.getCurrentState();
      expect(current).toEqual(state);
    });

    it('should maintain buffer of last N states (default 5)', () => {
      for (let i = 0; i < 10; i++) {
        buffer.addState(createMockState(i));
      }

      const bufferSize = buffer.getBufferSize();
      expect(bufferSize).toBe(5);
    });

    it('should support custom buffer size', () => {
      buffer = new StateUpdateBuffer({ bufferSize: 10 });

      for (let i = 0; i < 15; i++) {
        buffer.addState(createMockState(i));
      }

      const bufferSize = buffer.getBufferSize();
      expect(bufferSize).toBe(10);
    });

    it('should store states in chronological order by tick', () => {
      buffer.addState(createMockState(5));
      buffer.addState(createMockState(2));
      buffer.addState(createMockState(8));
      buffer.addState(createMockState(1));

      const current = buffer.getCurrentState();
      expect(current!.tick).toBe(8); // Most recent tick
    });

    it('should discard oldest states when buffer is full', () => {
      buffer = new StateUpdateBuffer({ bufferSize: 3 });

      buffer.addState(createMockState(1));
      buffer.addState(createMockState(2));
      buffer.addState(createMockState(3));
      buffer.addState(createMockState(4)); // Should evict tick 1

      const bufferSize = buffer.getBufferSize();
      expect(bufferSize).toBe(3);

      const current = buffer.getCurrentState();
      expect(current!.tick).toBe(4);
    });
  });

  describe('Current State Retrieval', () => {
    it('should return null when buffer is empty', () => {
      const current = buffer.getCurrentState();
      expect(current).toBeNull();
    });

    it('should return most recent state', () => {
      buffer.addState(createMockState(1));
      buffer.addState(createMockState(2));
      buffer.addState(createMockState(3));

      const current = buffer.getCurrentState();
      expect(current!.tick).toBe(3);
    });

    it('should update current state when new state added', () => {
      buffer.addState(createMockState(1));
      expect(buffer.getCurrentState()!.tick).toBe(1);

      buffer.addState(createMockState(2));
      expect(buffer.getCurrentState()!.tick).toBe(2);
    });
  });

  describe('State History', () => {
    it('should provide access to previous states', () => {
      buffer.addState(createMockState(1));
      buffer.addState(createMockState(2));
      buffer.addState(createMockState(3));

      const previous = buffer.getPreviousState();
      expect(previous!.tick).toBe(2);
    });

    it('should return null for previous state when only one state exists', () => {
      buffer.addState(createMockState(1));

      const previous = buffer.getPreviousState();
      expect(previous).toBeNull();
    });

    it('should allow getting state N steps back', () => {
      for (let i = 0; i < 5; i++) {
        buffer.addState(createMockState(i));
      }

      const twoStepsBack = buffer.getStateAtOffset(2);
      expect(twoStepsBack!.tick).toBe(2); // Current is 4, 2 steps back is 2
    });

    it('should return null when requesting offset beyond buffer', () => {
      buffer.addState(createMockState(1));
      buffer.addState(createMockState(2));

      const state = buffer.getStateAtOffset(5);
      expect(state).toBeNull();
    });
  });

  describe('Interpolation Support', () => {
    it('should calculate interpolation factor between states', () => {
      const now = Date.now();
      buffer.addState(createMockState(0, now));

      // Simulate 100ms update interval (10 updates/sec)
      buffer.addState(createMockState(6, now + 100));

      // Check interpolation at 50ms (halfway)
      const factor = buffer.getInterpolationFactor(now + 50);
      expect(factor).toBeCloseTo(0.5, 1);
    });

    it('should clamp interpolation factor to [0, 1]', () => {
      const now = Date.now();
      buffer.addState(createMockState(0, now));
      buffer.addState(createMockState(6, now + 100));

      // Before first state
      const factorBefore = buffer.getInterpolationFactor(now - 50);
      expect(factorBefore).toBe(0);

      // After second state
      const factorAfter = buffer.getInterpolationFactor(now + 150);
      expect(factorAfter).toBe(1);
    });

    it('should return 0 when only one state exists', () => {
      buffer.addState(createMockState(0));

      const factor = buffer.getInterpolationFactor(Date.now());
      expect(factor).toBe(0);
    });

    it('should provide both states needed for interpolation', () => {
      const now = Date.now();
      buffer.addState(createMockState(0, now));
      buffer.addState(createMockState(6, now + 100));

      const { current, previous, factor } = buffer.getInterpolationData(now + 50);

      expect(current).toBeDefined();
      expect(previous).toBeDefined();
      expect(current!.tick).toBe(6);
      expect(previous!.tick).toBe(0);
      expect(factor).toBeCloseTo(0.5, 1);
    });
  });

  describe('Buffering Window', () => {
    it('should maintain 100ms buffering window by default', () => {
      const windowSize = buffer.getBufferWindowMs();
      expect(windowSize).toBe(100);
    });

    it('should support custom buffering window', () => {
      buffer = new StateUpdateBuffer({ bufferWindowMs: 150 });

      const windowSize = buffer.getBufferWindowMs();
      expect(windowSize).toBe(150);
    });

    it('should apply buffering delay to render time', () => {
      const now = Date.now();
      buffer.addState(createMockState(0, now));
      buffer.addState(createMockState(6, now + 100));

      // Render time should be buffered by 100ms
      const renderTime = buffer.getBufferedRenderTime(now + 200);
      expect(renderTime).toBe(now + 100); // 200 - 100ms buffer
    });
  });

  describe('State Validation', () => {
    it('should reject states with decreasing ticks', () => {
      buffer.addState(createMockState(5));
      buffer.addState(createMockState(3)); // Should be ignored

      const current = buffer.getCurrentState();
      expect(current!.tick).toBe(5);
    });

    it('should accept states with same tick (state update within same tick)', () => {
      buffer.addState(createMockState(5));
      buffer.addState(createMockState(5)); // Should replace

      const bufferSize = buffer.getBufferSize();
      expect(bufferSize).toBe(1); // Only one state
    });

    it('should handle out-of-order state arrival gracefully', () => {
      buffer.addState(createMockState(1));
      buffer.addState(createMockState(5));
      buffer.addState(createMockState(3)); // Arrives late

      const current = buffer.getCurrentState();
      expect(current!.tick).toBe(5); // Should still be 5
    });
  });

  describe('Clear and Reset', () => {
    it('should clear all buffered states', () => {
      buffer.addState(createMockState(1));
      buffer.addState(createMockState(2));
      buffer.addState(createMockState(3));

      buffer.clear();

      expect(buffer.getCurrentState()).toBeNull();
      expect(buffer.getBufferSize()).toBe(0);
    });

    it('should accept new states after clear', () => {
      buffer.addState(createMockState(1));
      buffer.clear();
      buffer.addState(createMockState(2));

      const current = buffer.getCurrentState();
      expect(current!.tick).toBe(2);
    });
  });

  describe('Performance', () => {
    it('should handle rapid state updates efficiently', () => {
      const startTime = performance.now();

      for (let i = 0; i < 1000; i++) {
        buffer.addState(createMockState(i));
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should process 1000 states in less than 50ms
      expect(duration).toBeLessThan(50);
    });

    it('should perform interpolation calculations quickly', () => {
      const now = Date.now();
      for (let i = 0; i < 5; i++) {
        buffer.addState(createMockState(i * 6, now + i * 100));
      }

      const startTime = performance.now();

      for (let i = 0; i < 1000; i++) {
        buffer.getInterpolationFactor(now + i);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // 1000 interpolation calculations should take less than 10ms
      expect(duration).toBeLessThan(10);
    });
  });

  describe('Edge Cases', () => {
    it('should handle states with identical timestamps', () => {
      const now = Date.now();
      buffer.addState(createMockState(0, now));
      buffer.addState(createMockState(6, now)); // Same timestamp

      const factor = buffer.getInterpolationFactor(now);
      expect(factor).toBe(0); // No interpolation possible
    });

    it('should handle very large tick numbers', () => {
      buffer.addState(createMockState(Number.MAX_SAFE_INTEGER - 1));
      buffer.addState(createMockState(Number.MAX_SAFE_INTEGER));

      const current = buffer.getCurrentState();
      expect(current!.tick).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should handle zero buffer size gracefully', () => {
      buffer = new StateUpdateBuffer({ bufferSize: 1 });

      buffer.addState(createMockState(1));
      buffer.addState(createMockState(2));

      // Should keep at least current state
      expect(buffer.getCurrentState()).toBeDefined();
    });
  });

  describe('Statistics', () => {
    it('should track number of state updates received', () => {
      for (let i = 0; i < 10; i++) {
        buffer.addState(createMockState(i));
      }

      const stats = buffer.getStatistics();
      expect(stats.totalUpdates).toBe(10);
    });

    it('should track number of dropped (out-of-order) updates', () => {
      buffer.addState(createMockState(5));
      buffer.addState(createMockState(3)); // Dropped
      buffer.addState(createMockState(2)); // Dropped
      buffer.addState(createMockState(6)); // Accepted

      const stats = buffer.getStatistics();
      expect(stats.droppedUpdates).toBe(2);
    });

    it('should calculate average update interval', () => {
      const now = Date.now();
      for (let i = 0; i < 5; i++) {
        buffer.addState(createMockState(i * 6, now + i * 100));
      }

      const stats = buffer.getStatistics();
      expect(stats.averageUpdateIntervalMs).toBeCloseTo(100, 0);
    });
  });
});
