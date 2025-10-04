/**
 * Combat Engine Performance Test
 *
 * Measure actual tick rate and stability for combat simulation.
 * Run this manually to verify 60 tps performance.
 */

import { CombatEngine } from './combat-engine.js';
import type { DeploymentState } from '../../../../shared/src/types/deployment.js';

// Create max load deployment (8v8)
const maxDeployment: DeploymentState = {
  player1: {
    playerId: 'player1',
    roster: [],
    placements: Array.from({ length: 8 }, (_, i) => ({
      creature: {
        id: `p1_creature${i}`,
        name: `Player 1 Unit ${i}`,
        sprite: 'warrior.png',
        playerId: 'player1' as const
      },
      hex: { q: i % 4, r: Math.floor(i / 4) }
    })),
    maxCreatures: 8,
    isLocked: true,
    isReady: true,
    readyAt: new Date()
  },
  player2: {
    playerId: 'player2',
    roster: [],
    placements: Array.from({ length: 8 }, (_, i) => ({
      creature: {
        id: `p2_creature${i}`,
        name: `Player 2 Unit ${i}`,
        sprite: 'warrior.png',
        playerId: 'player2' as const
      },
      hex: { q: 10 - (i % 4), r: Math.floor(i / 4) }
    })),
    maxCreatures: 8,
    isLocked: true,
    isReady: true,
    readyAt: new Date()
  },
  currentPlayer: 'player1',
  countdownSeconds: null,
  countdownStartedAt: null,
  isComplete: true
};

async function runPerformanceTest() {
  console.log('=== Combat Engine Performance Test ===\n');

  const engine = new CombatEngine();
  engine.initializeFromDeployment('perf-test', maxDeployment);

  let tickCount = 0;
  let lastTick = 0;
  const tickDeltas: number[] = [];
  const startTime = Date.now();

  console.log('Starting combat with 8v8 units (16 total)...');
  console.log('Target: 60 ticks per second\n');

  engine.start((state) => {
    tickCount = state.tick;

    // Track tick deltas
    if (lastTick > 0) {
      tickDeltas.push(state.tick - lastTick);
    }
    lastTick = state.tick;
  });

  // Run for 3 seconds
  await new Promise(resolve => setTimeout(resolve, 3000));

  engine.stop();

  const elapsed = Date.now() - startTime;
  const actualTPS = (tickCount / elapsed) * 1000;

  // Calculate tick stability
  const allSequential = tickDeltas.every(d => d === 1);
  const maxDelta = Math.max(...tickDeltas);
  const minDelta = Math.min(...tickDeltas);

  console.log('=== Results ===');
  console.log(`Duration: ${elapsed}ms`);
  console.log(`Total Ticks: ${tickCount}`);
  console.log(`Actual TPS: ${actualTPS.toFixed(2)} tps`);
  console.log(`Target TPS: 60 tps`);
  console.log(`Performance: ${((actualTPS / 60) * 100).toFixed(1)}%`);
  console.log(`\nTick Stability:`);
  console.log(`  All Sequential: ${allSequential ? 'YES' : 'NO'}`);
  console.log(`  Min Delta: ${minDelta}`);
  console.log(`  Max Delta: ${maxDelta}`);

  // Success criteria
  const meetsTarget = actualTPS >= 55 && actualTPS <= 65; // Within 10% of 60
  const isStable = allSequential;

  console.log(`\n=== Status ===`);
  if (meetsTarget && isStable) {
    console.log('✅ PASS: Combat engine meets 60 tps target with stable ticks');
  } else {
    console.log('❌ FAIL: Performance issues detected');
    if (!meetsTarget) {
      console.log(`  - TPS outside acceptable range (${actualTPS.toFixed(2)} tps)`);
    }
    if (!isStable) {
      console.log(`  - Tick instability detected (delta range: ${minDelta}-${maxDelta})`);
    }
  }
}

// Run the test
runPerformanceTest().catch(console.error);
