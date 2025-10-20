# L4 Tasks: Combat Engine - Phase 1 (Core Simulation)

**Phase Duration:** Weeks 2-3
**Parent Epic:** Authoritative Server Simulation (L2)
**Status:** READY FOR IMPLEMENTATION
**Last Updated:** 2025-10-05

---

## Overview

Phase 1 establishes the foundation of the combat engine: the simulation loop, state management, and victory detection. This phase creates the skeleton that all other systems (AI, combat, abilities) will plug into.

**Deliverable:** A working combat simulator that can run a battle from start to finish, even with minimal/stubbed combat logic.

---

## L4-COMBAT-001: Fixed Timestep Simulation Loop

**File:** `/backend/src/combat/simulation-loop.ts`

### Function Signature
```typescript
class SimulationLoop {
  private tickRate: number = 60; // ticks per second
  private tickDuration: number = 1000 / 60; // ~16.67ms
  private currentTick: number = 0;
  private isRunning: boolean = false;

  async start(onTick: (tick: number) => void): Promise<void>
  stop(): void
  pause(): void
  resume(): void
  setSpeed(multiplier: number): void // 0.5x, 1x, 2x
}
```

### Test Cases

**Test 1: Ticks at correct rate (60 per second)**
```typescript
test('should execute 60 ticks per second', async () => {
  const loop = new SimulationLoop();
  const ticks: number[] = [];

  loop.start((tick) => ticks.push(tick));

  await sleep(1000); // Wait 1 second
  loop.stop();

  expect(ticks.length).toBeGreaterThanOrEqual(59);
  expect(ticks.length).toBeLessThanOrEqual(61);
});
```

**Test 2: Fixed timestep (immune to processing delays)**
```typescript
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
```

**Test 3: Pause/resume maintains tick count**
```typescript
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
```

**Test 4: Speed multiplier affects tick rate**
```typescript
test('should double tick rate with 2x speed', async () => {
  const loop = new SimulationLoop();
  const ticks: number[] = [];

  loop.setSpeed(2.0);
  loop.start((tick) => ticks.push(tick));

  await sleep(1000);
  loop.stop();

  // Should have ~120 ticks in 1 second (60 * 2)
  expect(ticks.length).toBeGreaterThanOrEqual(118);
  expect(ticks.length).toBeLessThanOrEqual(122);
});
```

### Acceptance Criteria
- [ ] Runs at stable 60 ticks/second
- [ ] Fixed timestep (compensates for processing delays)
- [ ] Pause/resume functionality
- [ ] Speed multiplier (0.5x, 1x, 2x)
- [ ] Tick counter increments correctly
- [ ] Graceful stop/cleanup

---

## L4-COMBAT-002: Combat State Management

**File:** `/backend/src/combat/combat-state.ts`

### Type Definitions
```typescript
interface CombatState {
  battleId: string;
  tick: number;
  status: 'initializing' | 'running' | 'paused' | 'completed';
  units: CombatUnit[];
  projectiles: Projectile[];
  activeEffects: ActiveEffect[];
  events: CombatEvent[]; // Last 60 ticks only
  winner: 'player1' | 'player2' | 'draw' | null;
}

interface CombatUnit {
  unitId: string;
  creatureId: string;
  ownerId: 'player1' | 'player2';
  position: HexCoordinate;
  health: number;
  maxHealth: number;
  status: 'alive' | 'dead';
  currentTarget: string | null;
  facingDirection: number; // degrees
  attackCooldown: number; // ticks remaining
  stats: UnitStats;
}

interface UnitStats {
  movementSpeed: number; // hexes per second
  attackRange: number; // hexes
  attackDamage: number;
  armor: number;
  attackSpeed: number; // attacks per second
}

interface Projectile {
  projectileId: string;
  sourceUnitId: string;
  targetUnitId: string;
  currentPosition: HexCoordinate;
  targetPosition: HexCoordinate;
  velocity: number; // hexes per tick
  damage: number;
  spawnTick: number;
}

interface CombatEvent {
  tick: number;
  type: 'damage' | 'death' | 'ability' | 'movement';
  data: Record<string, any>;
}
```

### Function Signatures
```typescript
class CombatStateManager {
  initializeState(battleId: string, deployments: Deployment[]): CombatState
  updateUnit(state: CombatState, unitId: string, updates: Partial<CombatUnit>): CombatState
  addProjectile(state: CombatState, projectile: Projectile): CombatState
  removeProjectile(state: CombatState, projectileId: string): CombatState
  addEvent(state: CombatState, event: CombatEvent): CombatState
  pruneOldEvents(state: CombatState): CombatState // Keep last 60 ticks
  getAliveUnits(state: CombatState, playerId?: 'player1' | 'player2'): CombatUnit[]
  serialize(state: CombatState): string // For network transmission
  deserialize(data: string): CombatState
}
```

### Test Cases

**Test 1: Initialize state from deployments**
```typescript
test('should initialize combat state from deployments', () => {
  const deployments = [
    { playerId: 'player1', creature: { id: 'c1', stats: {...} }, hex: {q: 1, r: 2} },
    { playerId: 'player2', creature: { id: 'c2', stats: {...} }, hex: {q: 10, r: 2} }
  ];

  const manager = new CombatStateManager();
  const state = manager.initializeState('battle-123', deployments);

  expect(state.battleId).toBe('battle-123');
  expect(state.tick).toBe(0);
  expect(state.status).toBe('initializing');
  expect(state.units).toHaveLength(2);
  expect(state.units[0].position).toEqual({q: 1, r: 2});
  expect(state.units[0].health).toBe(state.units[0].maxHealth);
  expect(state.units[0].status).toBe('alive');
});
```

**Test 2: Update unit immutably**
```typescript
test('should update unit without mutating original state', () => {
  const state = createMockState();
  const manager = new CombatStateManager();

  const newState = manager.updateUnit(state, 'unit-1', {
    position: {q: 2, r: 3},
    health: 80
  });

  // Original unchanged
  expect(state.units[0].position).toEqual({q: 1, r: 2});
  expect(state.units[0].health).toBe(100);

  // New state updated
  expect(newState.units[0].position).toEqual({q: 2, r: 3});
  expect(newState.units[0].health).toBe(80);
});
```

**Test 3: Event pruning (keep last 60 ticks)**
```typescript
test('should prune events older than 60 ticks', () => {
  const state = createMockState();
  const manager = new CombatStateManager();

  // Add 100 events across different ticks
  let updatedState = state;
  for (let i = 0; i < 100; i++) {
    updatedState = manager.addEvent(updatedState, {
      tick: i,
      type: 'damage',
      data: { damage: 10 }
    });
  }

  updatedState.tick = 100;
  const prunedState = manager.pruneOldEvents(updatedState);

  // Should only have events from tick 40+ (last 60 ticks)
  expect(prunedState.events).toHaveLength(60);
  expect(prunedState.events[0].tick).toBe(40);
  expect(prunedState.events[59].tick).toBe(99);
});
```

**Test 4: Serialize/deserialize preserves state**
```typescript
test('should serialize and deserialize state correctly', () => {
  const state = createMockState();
  const manager = new CombatStateManager();

  const serialized = manager.serialize(state);
  const deserialized = manager.deserialize(serialized);

  expect(deserialized).toEqual(state);
});
```

**Test 5: Get alive units filters correctly**
```typescript
test('should return only alive units for specified player', () => {
  const state = createMockState();
  state.units[0].status = 'dead'; // player1 unit
  state.units[1].status = 'alive'; // player1 unit
  state.units[2].status = 'alive'; // player2 unit

  const manager = new CombatStateManager();

  const player1Alive = manager.getAliveUnits(state, 'player1');
  expect(player1Alive).toHaveLength(1);
  expect(player1Alive[0].unitId).toBe('unit-2');

  const allAlive = manager.getAliveUnits(state);
  expect(allAlive).toHaveLength(2);
});
```

### Acceptance Criteria
- [ ] Initializes state from deployment data
- [ ] Immutable state updates (no mutations)
- [ ] Event log pruning (max 60 ticks)
- [ ] Serialization for network transmission
- [ ] Efficient filtering (alive units, by player)
- [ ] Type-safe state transitions

---

## L4-COMBAT-003: Victory Condition Detection

**File:** `/backend/src/combat/victory-detector.ts`

### Function Signatures
```typescript
class VictoryDetector {
  checkVictory(state: CombatState, maxTicks: number): VictoryResult
}

interface VictoryResult {
  isGameOver: boolean;
  winner: 'player1' | 'player2' | 'draw' | null;
  reason: 'elimination' | 'timeout' | 'simultaneous_death' | null;
  finalState: CombatState;
}
```

### Test Cases

**Test 1: Player 1 wins by elimination**
```typescript
test('should detect player1 victory when all player2 units dead', () => {
  const state = createMockState();
  state.units.forEach(u => {
    if (u.ownerId === 'player2') u.status = 'dead';
  });

  const detector = new VictoryDetector();
  const result = detector.checkVictory(state, 18000);

  expect(result.isGameOver).toBe(true);
  expect(result.winner).toBe('player1');
  expect(result.reason).toBe('elimination');
});
```

**Test 2: Player 2 wins by elimination**
```typescript
test('should detect player2 victory when all player1 units dead', () => {
  const state = createMockState();
  state.units.forEach(u => {
    if (u.ownerId === 'player1') u.status = 'dead';
  });

  const detector = new VictoryDetector();
  const result = detector.checkVictory(state, 18000);

  expect(result.isGameOver).toBe(true);
  expect(result.winner).toBe('player2');
  expect(result.reason).toBe('elimination');
});
```

**Test 3: Timeout - defender (player2) wins**
```typescript
test('should declare player2 winner on timeout (defender advantage)', () => {
  const state = createMockState();
  state.tick = 18000; // Max ticks reached
  // Both players have units alive

  const detector = new VictoryDetector();
  const result = detector.checkVictory(state, 18000);

  expect(result.isGameOver).toBe(true);
  expect(result.winner).toBe('player2'); // Defender wins
  expect(result.reason).toBe('timeout');
});
```

**Test 4: Simultaneous death = draw**
```typescript
test('should declare draw when last units die same tick', () => {
  const state = createMockState();
  // Only 1 unit per side, both dead
  state.units = [
    { ...mockUnit, ownerId: 'player1', status: 'dead' },
    { ...mockUnit, ownerId: 'player2', status: 'dead' }
  ];

  const detector = new VictoryDetector();
  const result = detector.checkVictory(state, 18000);

  expect(result.isGameOver).toBe(true);
  expect(result.winner).toBe('draw');
  expect(result.reason).toBe('simultaneous_death');
});
```

**Test 5: No victory if both sides have units**
```typescript
test('should return no victory if both sides alive', () => {
  const state = createMockState();
  state.tick = 1000;
  // All units alive

  const detector = new VictoryDetector();
  const result = detector.checkVictory(state, 18000);

  expect(result.isGameOver).toBe(false);
  expect(result.winner).toBe(null);
  expect(result.reason).toBe(null);
});
```

### Acceptance Criteria
- [ ] Detects elimination victory (all units of one side dead)
- [ ] Detects timeout victory (defender wins)
- [ ] Detects draw (simultaneous last unit deaths)
- [ ] Returns null if no victory condition met
- [ ] Provides final state in result

---

## L4-COMBAT-004: Combat Simulator Orchestration

**File:** `/backend/src/combat/combat-simulator.ts`

### Function Signature
```typescript
class CombatSimulator {
  async runCombat(
    battleId: string,
    deployments: Deployment[],
    onUpdate?: (state: CombatState) => void
  ): Promise<BattleResult>
}

interface BattleResult {
  battleId: string;
  winner: 'player1' | 'player2' | 'draw';
  reason: 'elimination' | 'timeout' | 'simultaneous_death';
  duration: number; // ticks
  finalState: CombatState;
  eventLog: CombatEvent[];
}
```

### Test Cases

**Test 1: Runs simulation from start to finish**
```typescript
test('should run complete simulation loop', async () => {
  const deployments = createMockDeployments();
  const simulator = new CombatSimulator();

  const updates: CombatState[] = [];
  const result = await simulator.runCombat('battle-1', deployments, (state) => {
    updates.push(state);
  });

  expect(result.battleId).toBe('battle-1');
  expect(result.winner).toBeDefined();
  expect(result.duration).toBeGreaterThan(0);
  expect(updates.length).toBeGreaterThan(0);
});
```

**Test 2: Stops on victory condition**
```typescript
test('should stop simulation when victory detected', async () => {
  const deployments = [
    // 1 unit per side, player1 has more HP
    { playerId: 'player1', creature: { stats: { hp: 100, attack: 20 } }, hex: {q: 1, r: 2} },
    { playerId: 'player2', creature: { stats: { hp: 50, attack: 10 } }, hex: {q: 2, r: 2} }
  ];

  const simulator = new CombatSimulator();
  const result = await simulator.runCombat('battle-1', deployments);

  expect(result.winner).toBe('player1');
  expect(result.reason).toBe('elimination');
  expect(result.duration).toBeLessThan(18000); // Didn't timeout
});
```

**Test 3: Timeout at max ticks**
```typescript
test('should timeout at max ticks (18000)', async () => {
  // Create balanced units that won't kill each other
  const deployments = [
    { playerId: 'player1', creature: { stats: { hp: 1000, attack: 1 } }, hex: {q: 1, r: 2} },
    { playerId: 'player2', creature: { stats: { hp: 1000, attack: 1 } }, hex: {q: 10, r: 2} }
  ];

  const simulator = new CombatSimulator();
  const result = await simulator.runCombat('battle-1', deployments);

  expect(result.reason).toBe('timeout');
  expect(result.duration).toBe(18000);
  expect(result.winner).toBe('player2'); // Defender advantage
}, 30000); // Increase test timeout
```

**Test 4: Calls onUpdate callback per tick**
```typescript
test('should call onUpdate for each tick', async () => {
  const deployments = createQuickBattleDeployments(); // Battle lasts ~100 ticks
  const simulator = new CombatSimulator();

  let updateCount = 0;
  await simulator.runCombat('battle-1', deployments, (state) => {
    updateCount++;
    expect(state.tick).toBe(updateCount - 1);
  });

  expect(updateCount).toBeGreaterThan(50);
  expect(updateCount).toBeLessThan(200);
});
```

**Test 5: Returns complete event log**
```typescript
test('should return full event log in result', async () => {
  const deployments = createMockDeployments();
  const simulator = new CombatSimulator();

  const result = await simulator.runCombat('battle-1', deployments);

  expect(result.eventLog).toBeDefined();
  expect(result.eventLog.length).toBeGreaterThan(0);

  // Should have at least damage and death events
  const damageEvents = result.eventLog.filter(e => e.type === 'damage');
  const deathEvents = result.eventLog.filter(e => e.type === 'death');

  expect(damageEvents.length).toBeGreaterThan(0);
  expect(deathEvents.length).toBeGreaterThan(0);
});
```

### Acceptance Criteria
- [ ] Orchestrates complete simulation loop
- [ ] Integrates simulation loop, state manager, victory detector
- [ ] Calls onUpdate callback each tick
- [ ] Stops on victory condition
- [ ] Returns complete battle result with event log
- [ ] Handles errors gracefully

---

## Integration Test: Full Combat Flow

**File:** `/backend/src/combat/__tests__/combat-integration.test.ts`

### Test Case
```typescript
test('INTEGRATION: Full combat from deployment to victory', async () => {
  // Setup: 2v2 battle
  const deployments = [
    { playerId: 'player1', creature: { id: 'warrior', stats: { hp: 100, attack: 25, armor: 5, range: 1 } }, hex: {q: 1, r: 4} },
    { playerId: 'player1', creature: { id: 'archer', stats: { hp: 60, attack: 30, armor: 0, range: 5 } }, hex: {q: 2, r: 4} },
    { playerId: 'player2', creature: { id: 'goblin1', stats: { hp: 50, attack: 15, armor: 2, range: 1 } }, hex: {q: 10, r: 4} },
    { playerId: 'player2', creature: { id: 'goblin2', stats: { hp: 50, attack: 15, armor: 2, range: 1 } }, hex: {q: 9, r: 4} }
  ];

  const simulator = new CombatSimulator();
  const stateHistory: CombatState[] = [];

  const result = await simulator.runCombat('integration-test', deployments, (state) => {
    stateHistory.push(state);
  });

  // Verify battle completed
  expect(result.winner).toBeDefined();
  expect(['player1', 'player2', 'draw']).toContain(result.winner);

  // Verify state progression
  expect(stateHistory.length).toBeGreaterThan(0);
  expect(stateHistory[0].tick).toBe(0);
  expect(stateHistory[0].status).toBe('running');

  // Verify final state
  const finalState = stateHistory[stateHistory.length - 1];
  expect(finalState.status).toBe('completed');

  // Verify at least one side is eliminated
  const player1Alive = finalState.units.filter(u => u.ownerId === 'player1' && u.status === 'alive');
  const player2Alive = finalState.units.filter(u => u.ownerId === 'player2' && u.status === 'alive');

  expect(player1Alive.length === 0 || player2Alive.length === 0).toBe(true);

  // Verify events recorded
  expect(result.eventLog.length).toBeGreaterThan(0);
});
```

---

## Phase 1 Summary

### Files to Create (4)
1. `/backend/src/combat/simulation-loop.ts` - Fixed timestep loop
2. `/backend/src/combat/combat-state.ts` - State management
3. `/backend/src/combat/victory-detector.ts` - Victory detection
4. `/backend/src/combat/combat-simulator.ts` - Main orchestrator

### Total L4 Tasks: 4
- L4-COMBAT-001: Simulation Loop
- L4-COMBAT-002: Combat State Management
- L4-COMBAT-003: Victory Detector
- L4-COMBAT-004: Combat Simulator Orchestration

### Total Test Cases: 19
- Simulation Loop: 4 tests
- Combat State: 5 tests
- Victory Detector: 5 tests
- Combat Simulator: 5 tests
- Integration: 1 test

### Phase 1 Definition of Done
- [ ] All 19 test cases passing
- [ ] Simulation runs at stable 60 ticks/second
- [ ] State is immutable (no mutations)
- [ ] Victory detection works for all scenarios
- [ ] Can run battle from start to finish
- [ ] Integration test passes (full combat flow)

---

**Next Phase:** Week 3-4 will add Unit AI, Pathfinding, and Movement (Phase 2)

**Status:** Ready for TDD implementation
