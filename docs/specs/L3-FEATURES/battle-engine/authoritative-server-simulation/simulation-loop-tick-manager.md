# L3-FEATURE: Simulation Loop & Tick Manager

**Feature ID**: `simulation-loop-tick-manager`
**Epic**: Authoritative Server Simulation (L2)
**Status**: PLANNING
**Version**: 1.0
**Last Updated**: 2025-10-03

---

## Feature Summary

A deterministic 60-tick-per-second simulation loop that drives all combat logic, maintains fixed timestep execution independent of frame rate, manages simulation state snapshots, and provides precise timing for unit updates, ability activations, and state broadcasting. This is the heartbeat of the battle system.

**Value Proposition**: Ensures consistent, fair, and predictable combat across all players regardless of server load or network conditions. Deterministic timing enables replay functionality and makes debugging possible.

---

## User Value

**For Players**: Battles execute at consistent speed with no jank or slowdown. Actions happen when expected, abilities fire on cooldown, and combat feels responsive.

**For Developers**: Predictable simulation enables easy testing, debugging, and balancing. Replay capability allows bug reproduction and competitive integrity verification.

---

## Functional Requirements

### Fixed Timestep Loop

1. **Tick Rate**
   - **Target**: 60 ticks per second (16.67ms per tick)
   - **Precision**: ±0.5ms variance allowed
   - **Method**: Fixed timestep, not variable delta time
   - **Recovery**: Catch up if behind, never skip ticks

2. **Tick Counter**
   - **Start**: Tick 0 at combat initialization
   - **Increment**: +1 per tick
   - **Maximum**: 18,000 ticks (5 minutes at 60 tps)
   - **Usage**: Timestamp for events, replay synchronization

3. **Simulation Phases Per Tick**
   - **Phase 1**: Update unit AI (target selection, movement)
   - **Phase 2**: Process attacks and damage
   - **Phase 3**: Update abilities and cooldowns
   - **Phase 4**: Update projectiles and effects
   - **Phase 5**: Check victory conditions
   - **Phase 6**: Broadcast state updates (every 2nd tick)

4. **Time Scaling** (Debug/Testing)
   - **1.0x**: Normal speed (60 ticks/sec)
   - **0.5x**: Slow motion (30 ticks/sec)
   - **2.0x**: Fast forward (120 ticks/sec)
   - **Pause**: Stop at current tick, resume later

### State Management

1. **Immutable State Snapshots**
   - **Every Tick**: Create new state object
   - **No Mutations**: Previous states never modified
   - **Copy-on-Write**: Efficient state cloning
   - **Garbage Collection**: Auto-cleanup old states (keep last 60)

2. **State Serialization**
   - **Format**: JSON for readability, msgpack for efficiency
   - **Delta Encoding**: Only transmit changes between ticks
   - **Compression**: Gzip for network transmission
   - **Size Target**: < 1KB per tick delta

3. **Event Log**
   - **Capture**: All state changes (damage, death, ability use)
   - **Structure**: `{ tick, eventType, data }`
   - **Storage**: Ring buffer (last 1000 events)
   - **Usage**: Debugging, analytics, replay generation

4. **Snapshot Broadcast**
   - **Full State**: Every 10 ticks (recovery snapshots)
   - **Delta State**: Every 2 ticks (bandwidth optimization)
   - **Client Sync**: Interpolate between received states
   - **Late Join**: Send full snapshot to reconnecting clients

### Victory Condition Detection

1. **Elimination Victory**
   - **Check**: Every tick, count alive units per team
   - **Condition**: One team has 0 alive units
   - **Winner**: Team with units remaining
   - **Timing**: Detected within 1 tick of last unit death

2. **Timeout Draw**
   - **Check**: Every tick, compare tick counter to max
   - **Condition**: Tick >= 18,000 (5 minutes elapsed)
   - **Winner**: Defender (attacker loses on timeout)
   - **Reason**: Prevent infinite stalling

3. **Simultaneous Death**
   - **Check**: Both teams reach 0 units same tick
   - **Result**: Draw → Re-deploy round
   - **Rare**: < 1% of matches
   - **Handling**: Return to deployment phase

4. **Victory Broadcast**
   - **Event**: `{ type: 'victory', winner, reason, finalState }`
   - **Timing**: Immediate (same tick as detection)
   - **Actions**: Stop simulation, persist result, notify clients

### Performance Monitoring

1. **Tick Duration Tracking**
   - **Measure**: Time to execute single tick
   - **Target**: < 15ms (leave 1.67ms buffer)
   - **Alert**: If > 20ms, log warning
   - **Threshold**: If > 30ms, pause and investigate

2. **Simulation Health**
   - **Lag Detection**: Tick duration exceeds budget
   - **Recovery**: Skip non-critical updates (effects, animations)
   - **Graceful Degradation**: Reduce update frequency
   - **Client Notification**: Warn about lag

3. **Metrics Collection**
   - **Tick Rate**: Actual ticks/sec (should be 60 ± 2)
   - **Tick Duration**: Min, max, average, p95, p99
   - **Event Count**: Events per tick (damage, ability, etc.)
   - **State Size**: Bytes per tick (memory usage)

---

## Technical Specification

### Architecture

**Simulation Loop**
```typescript
/**
 * Main simulation loop manager
 */
class CombatSimulator {
  private state: CombatState;
  private tickRate = 60; // ticks per second
  private tickDuration = 1000 / this.tickRate; // 16.67ms
  private maxTicks = 18000; // 5 minutes
  private timescale = 1.0; // Normal speed
  private isPaused = false;
  private metrics: SimulationMetrics;

  /**
   * Run simulation from deployment to victory
   */
  async runSimulation(deployments: DeploymentState[]): Promise<BattleResult> {
    this.state = this.initializeCombatState(deployments);
    this.metrics.startTime = Date.now();

    while (this.state.tick < this.maxTicks && !this.isRoundOver()) {
      if (this.isPaused) {
        await this.sleep(100); // Check pause state every 100ms
        continue;
      }

      const tickStartTime = performance.now();

      // Execute simulation tick
      this.tick();

      // Track tick duration
      const tickElapsed = performance.now() - tickStartTime;
      this.metrics.tickDurations.push(tickElapsed);

      // Broadcast state update (every 2nd tick = 30 updates/sec)
      if (this.state.tick % 2 === 0) {
        this.broadcastStateUpdate();
      }

      // Full snapshot every 10 ticks (for late joiners)
      if (this.state.tick % 10 === 0) {
        this.broadcastSnapshot();
      }

      // Fixed timestep: Wait until next tick
      const sleepTime = Math.max(
        0,
        this.tickDuration * this.timescale - tickElapsed
      );
      await this.sleep(sleepTime);
    }

    // Round over - finalize and return result
    const result = this.finalizeRound();
    this.broadcastRoundEnd(result);
    return result;
  }

  /**
   * Execute single simulation tick
   */
  private tick(): void {
    // Increment tick counter
    this.state.tick++;

    // Create new state snapshot (immutable)
    const newState = this.cloneState(this.state);

    // Phase 1: Update unit AI
    for (const unit of newState.units.filter(u => u.status === 'alive')) {
      this.updateUnitAI(unit, newState);
    }

    // Phase 2: Process attacks
    for (const unit of newState.units.filter(u => u.status === 'alive')) {
      this.processUnitAttack(unit, newState);
    }

    // Phase 3: Update abilities
    for (const unit of newState.units.filter(u => u.status === 'alive')) {
      this.updateUnitAbilities(unit, newState);
    }

    // Phase 4: Update projectiles
    for (const projectile of newState.projectiles) {
      this.updateProjectile(projectile, newState);
    }

    // Phase 5: Update effects (buffs, debuffs, DOT)
    this.updateStatusEffects(newState);

    // Phase 6: Check victory conditions
    const victoryCheck = this.checkVictoryCondition(newState);
    if (victoryCheck.hasWinner) {
      newState.status = 'completed';
      newState.winner = victoryCheck.winner;
      newState.victoryReason = victoryCheck.reason;
    }

    // Commit new state
    this.state = newState;

    // Log events (for debugging and replay)
    this.logTickEvents(newState);
  }

  /**
   * Initialize combat state from deployments
   */
  private initializeCombatState(deployments: DeploymentState[]): CombatState {
    const units: Unit[] = [];

    for (const deployment of deployments) {
      for (const placement of deployment.placements) {
        units.push({
          unitId: `${deployment.playerId}-${placement.creature.id}`,
          creatureId: placement.creature.id,
          ownerId: deployment.playerId,
          position: placement.position,
          health: placement.creature.stats.hp,
          maxHealth: placement.creature.stats.hp,
          status: 'alive',
          currentTarget: null,
          movementPath: null,
          facingDirection: 0,
          attackCooldownRemaining: 0,
          abilities: this.initializeAbilities(placement.creature.abilities),
          activeBuffs: [],
          activeDebuffs: [],
          stats: { ...placement.creature.stats }
        });
      }
    }

    return {
      battleId: crypto.randomUUID(),
      tick: 0,
      status: 'running',
      units,
      projectiles: [],
      activeEffects: [],
      events: [],
      statistics: {
        totalDamageDealt: {},
        totalHealingDone: {},
        unitsLost: {},
        abilitiesUsed: {}
      }
    };
  }

  /**
   * Check victory conditions
   */
  private checkVictoryCondition(state: CombatState): VictoryCheck {
    const player1Units = state.units.filter(
      u => u.ownerId === 'player1' && u.status === 'alive'
    );
    const player2Units = state.units.filter(
      u => u.ownerId === 'player2' && u.status === 'alive'
    );

    // Elimination victory
    if (player1Units.length === 0 && player2Units.length > 0) {
      return { hasWinner: true, winner: 'player2', reason: 'elimination' };
    }
    if (player2Units.length === 0 && player1Units.length > 0) {
      return { hasWinner: true, winner: 'player1', reason: 'elimination' };
    }

    // Simultaneous death (draw)
    if (player1Units.length === 0 && player2Units.length === 0) {
      return { hasWinner: true, winner: null, reason: 'draw' };
    }

    // Timeout (attacker loses)
    if (state.tick >= this.maxTicks) {
      return { hasWinner: true, winner: 'player2', reason: 'timeout' }; // Defender wins
    }

    return { hasWinner: false };
  }

  /**
   * Create immutable state copy (copy-on-write)
   */
  private cloneState(state: CombatState): CombatState {
    return {
      ...state,
      units: state.units.map(u => ({ ...u })),
      projectiles: state.projectiles.map(p => ({ ...p })),
      activeEffects: state.activeEffects.map(e => ({ ...e })),
      events: [...state.events],
      statistics: { ...state.statistics }
    };
  }

  /**
   * Broadcast state delta to clients
   */
  private broadcastStateUpdate(): void {
    if (!this.previousState) return;

    const delta = this.computeStateDelta(this.previousState, this.state);
    const compressed = this.compressDelta(delta);

    this.websocket.broadcast('state_update', {
      tick: this.state.tick,
      delta: compressed
    });

    this.previousState = this.state;
  }

  /**
   * Broadcast full snapshot (for late joiners)
   */
  private broadcastSnapshot(): void {
    const snapshot = this.serializeState(this.state);
    const compressed = this.compressSnapshot(snapshot);

    this.websocket.broadcast('state_snapshot', {
      tick: this.state.tick,
      state: compressed
    });
  }

  /**
   * Compute delta between two states
   */
  private computeStateDelta(oldState: CombatState, newState: CombatState): StateDelta {
    const delta: StateDelta = {
      tick: newState.tick,
      unitChanges: [],
      projectileChanges: [],
      events: newState.events.slice(oldState.events.length) // New events only
    };

    // Find changed units
    for (const newUnit of newState.units) {
      const oldUnit = oldState.units.find(u => u.unitId === newUnit.unitId);
      if (!oldUnit || !this.unitsEqual(oldUnit, newUnit)) {
        delta.unitChanges.push(newUnit);
      }
    }

    // Find changed projectiles
    for (const newProj of newState.projectiles) {
      const oldProj = oldState.projectiles.find(p => p.projectileId === newProj.projectileId);
      if (!oldProj || !this.projectilesEqual(oldProj, newProj)) {
        delta.projectileChanges.push(newProj);
      }
    }

    return delta;
  }

  /**
   * Pause simulation
   */
  pause(): void {
    this.isPaused = true;
    this.broadcastEvent('simulation_paused', { tick: this.state.tick });
  }

  /**
   * Resume simulation
   */
  resume(): void {
    this.isPaused = false;
    this.broadcastEvent('simulation_resumed', { tick: this.state.tick });
  }

  /**
   * Set simulation speed (1.0 = normal, 2.0 = 2x speed)
   */
  setTimescale(scale: number): void {
    this.timescale = Math.max(0.1, Math.min(5.0, scale)); // Clamp 0.1x to 5x
  }
}
```

**Performance Monitoring**
```typescript
interface SimulationMetrics {
  startTime: number;
  endTime?: number;
  tickDurations: number[]; // Milliseconds per tick
  averageTickRate: number; // Actual ticks/sec
  eventCounts: Map<string, number>; // Events by type
  stateSizes: number[]; // Bytes per tick
}

class PerformanceMonitor {
  /**
   * Calculate tick rate statistics
   */
  getTickRateStats(metrics: SimulationMetrics): TickRateStats {
    const durations = metrics.tickDurations;
    const ticksPerSecond = durations.map(d => 1000 / d);

    return {
      average: this.average(ticksPerSecond),
      min: Math.min(...ticksPerSecond),
      max: Math.max(...ticksPerSecond),
      p95: this.percentile(ticksPerSecond, 0.95),
      p99: this.percentile(ticksPerSecond, 0.99),
      target: 60
    };
  }

  /**
   * Check if simulation is lagging
   */
  isLagging(metrics: SimulationMetrics): boolean {
    const recentDurations = metrics.tickDurations.slice(-10); // Last 10 ticks
    const avgDuration = this.average(recentDurations);
    return avgDuration > 20; // 20ms = lagging (target is 16.67ms)
  }

  /**
   * Get performance report
   */
  generateReport(metrics: SimulationMetrics): PerformanceReport {
    return {
      tickRate: this.getTickRateStats(metrics),
      tickDuration: {
        average: this.average(metrics.tickDurations),
        min: Math.min(...metrics.tickDurations),
        max: Math.max(...metrics.tickDurations),
        p95: this.percentile(metrics.tickDurations, 0.95),
        p99: this.percentile(metrics.tickDurations, 0.99)
      },
      totalTicks: metrics.tickDurations.length,
      totalTime: (metrics.endTime || Date.now()) - metrics.startTime,
      isLagging: this.isLagging(metrics)
    };
  }
}
```

### Key Technologies

- **Node.js**: Server runtime
- **TypeScript**: Type-safe simulation logic
- **high-resolution timers**: `performance.now()` for precise timing
- **msgpack**: Efficient state serialization
- **WebSocket**: Real-time state broadcasting

---

## Success Criteria

### MVP Definition of Done

- [ ] Simulation runs at stable 60 ticks/second
- [ ] Fixed timestep prevents timing drift
- [ ] State snapshots are immutable (no mutations)
- [ ] Victory detection within 1 tick of condition
- [ ] Tick duration < 15ms for 16 unit battles
- [ ] State delta reduces bandwidth by 80%+
- [ ] Pause/resume works without state corruption
- [ ] Timescale adjustment (0.5x to 2x) works correctly
- [ ] Tick counter increments reliably
- [ ] 5-minute timeout triggers correctly (tick 18,000)
- [ ] Full snapshots sent every 10 ticks for recovery
- [ ] Performance metrics tracked accurately

---

## L4 Task Candidates

1. **Implement Fixed Timestep Loop** (4 hours)
2. **Implement Tick Counter** (1 hour)
3. **Implement State Cloning** (3 hours)
4. **Implement Victory Detection** (3 hours)
5. **Implement State Delta Compression** (4 hours)
6. **Implement Snapshot Broadcasting** (3 hours)
7. **Implement Pause/Resume** (2 hours)
8. **Implement Timescale Control** (2 hours)
9. **Implement Performance Monitoring** (4 hours)
10. **Write Unit Tests** (6 hours)

**Total: 32 hours (~1 week)**

---

## Dependencies

### Depends On
- **Hex Grid Math** (L3): Unit positions
- **WebSocket Infrastructure** (Platform): State broadcasting

### Depended On By
- **Unit AI Controller** (L3): Tick-based updates
- **Combat Resolution** (L3): Damage per tick
- **Pathfinding Engine** (L3): Movement per tick

---

## Metadata

**Feature ID**: `simulation-loop-tick-manager`
**Epic**: Authoritative Server Simulation
**Priority**: CRITICAL
**Estimated Effort**: 1 week
**Complexity**: HIGH
