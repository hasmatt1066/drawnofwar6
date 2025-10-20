/**
 * Tests for SimulationLoop (L4-COMBAT-001)
 *
 * TDD Test Suite - These tests are written BEFORE implementation
 */

import { describe, test, expect, afterEach } from 'vitest';
import { SimulationLoop } from '../simulation-loop';

// Helper: Sleep utility
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: Busy wait (simulate slow processing)
const busyWait = (ms: number) => {
  const start = Date.now();
  while (Date.now() - start < ms) {
    // Busy loop
  }
};

describe('SimulationLoop (L4-COMBAT-001)', () => {

  /**
   * Test 1: Ticks at correct rate (60 per second)
   */
  test('should execute 60 ticks per second', async () => {
    const loop = new SimulationLoop();
    const ticks: number[] = [];

    loop.start((tick) => ticks.push(tick));

    await sleep(1000); // Wait 1 second
    loop.stop();

    expect(ticks.length).toBeGreaterThanOrEqual(58);
    expect(ticks.length).toBeLessThanOrEqual(62);
  });

  /**
   * Test 2: Fixed timestep (immune to processing delays)
   */
  test('should maintain fixed timestep despite slow processing', async () => {
    const loop = new SimulationLoop();
    const tickTimestamps: number[] = [];

    loop.start((tick) => {
      tickTimestamps.push(Date.now());
      // Simulate slow processing (5ms)
      busyWait(5);
    });

    await sleep(100);
    loop.stop();

    // Check intervals between ticks are ~16.67ms ± 2ms
    for (let i = 1; i < tickTimestamps.length; i++) {
      const interval = tickTimestamps[i] - tickTimestamps[i-1];
      expect(interval).toBeGreaterThanOrEqual(14);
      expect(interval).toBeLessThanOrEqual(19);
    }
  });

  /**
   * Test 3: Pause/resume maintains tick count
   */
  test('should preserve tick count across pause/resume', async () => {
    const loop = new SimulationLoop();
    let lastTick = 0;

    loop.start((tick) => { lastTick = tick; });

    await sleep(100); // ~6 ticks
    const tickBeforePause = lastTick;

    loop.pause();
    await sleep(100); // Paused, no ticks

    loop.resume();
    await sleep(100); // ~6 more ticks

    loop.stop();

    expect(lastTick).toBeGreaterThan(tickBeforePause);
    expect(lastTick).toBeLessThan(tickBeforePause + 15); // Not double
  });

  /**
   * Test 4: Speed multiplier affects tick rate
   */
  test('should double tick rate with 2x speed', async () => {
    const loop = new SimulationLoop();
    const ticks: number[] = [];

    loop.setSpeed(2.0);
    loop.start((tick) => ticks.push(tick));

    await sleep(1000);
    loop.stop();

    // Should have ~120 ticks in 1 second (60 * 2)
    expect(ticks.length).toBeGreaterThanOrEqual(116);
    expect(ticks.length).toBeLessThanOrEqual(124);
  });

  /**
   * Additional Test: Stop should cleanup properly
   */
  test('should stop cleanly without memory leaks', async () => {
    const loop = new SimulationLoop();
    let tickCount = 0;

    loop.start((tick) => { tickCount++; });

    await sleep(50);
    const ticksBeforeStop = tickCount;

    loop.stop();
    await sleep(50);

    // Should not have more ticks after stop
    expect(tickCount).toBe(ticksBeforeStop);
  });

  /**
   * Additional Test: Start is idempotent
   */
  test('should not create multiple loops on repeated start', async () => {
    const loop = new SimulationLoop();
    const ticks: number[] = [];

    loop.start((tick) => ticks.push(tick));
    loop.start((tick) => ticks.push(tick)); // Second call should be ignored

    await sleep(100);
    loop.stop();

    // Should only have one callback execution per tick
    // If two loops, we'd see ~12 ticks, but we should see ~6
    expect(ticks.length).toBeLessThan(10);
  });
});
