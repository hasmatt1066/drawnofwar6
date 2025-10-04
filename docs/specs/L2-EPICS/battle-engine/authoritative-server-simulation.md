# L2 EPIC: Authoritative Server Simulation

**Epic ID**: `battle-server-sim`
**Parent Theme**: Battle Engine (L1)
**Status**: PLANNING
**Version**: 1.0
**Last Updated**: 2025-10-03

---

## Epic Summary

Implement the authoritative server-side combat simulation engine that executes all gameplay logic, damage calculations, ability activations, unit AI, and victory condition detection. The server runs a deterministic 60-tick-per-second simulation loop and broadcasts state updates to connected clients for rendering, ensuring fairness, cheat prevention, and consistent game state across all players despite network latency.

**User Value**: Guarantees fair gameplay where no player can gain advantage through client-side manipulation, provides smooth combat experience by handling all game logic server-side, and ensures both players see identical battle outcomes.

**Business Value**: Authoritative server architecture prevents cheating (critical for competitive integrity), enables reliable battle outcomes for future ranking systems, and provides centralized combat data for analytics and balancing.

---

## Purpose

The Authoritative Server Simulation is the combat engine's foundation—the single source of truth for all battle state. In an auto-battler, the server must handle everything: unit movement, pathfinding, target selection, attack timing, ability activation, damage calculation, projectile physics, collision detection, and victory conditions. Clients are purely presentational—they receive state updates and render animations, but never make gameplay decisions.

This architecture is essential because:
1. **Cheat Prevention**: Clients cannot modify damage, cooldowns, or positions
2. **Fairness**: Both players experience identical combat (no desync)
3. **Latency Tolerance**: Server simulation continues smoothly even if client lags
4. **Determinism**: Same deployments always produce same results (for testing and potential replays)
5. **Scalability**: Server can run multiple battles simultaneously

The server must balance authoritative control with responsiveness—combat must feel fluid despite 100-150ms network latency.

---

## Scope

### Included

- **Simulation Loop & Tick Management**
  - 60 ticks per second deterministic simulation
  - Fixed timestep loop (immune to frame rate variations)
  - Tick counter (for replay synchronization)
  - Game speed control (pause, 1x, 2x for testing)
  - Max simulation time limit (5 minutes per round)

- **Combat State Management**
  - Immutable state snapshots per tick
  - Unit registry (all creatures, positions, health, status)
  - Projectile registry (active projectiles, trajectories)
  - Active effect registry (auras, ground effects, buffs/debuffs)
  - Combat event log (damage dealt, abilities used, deaths)
  - State serialization for network transmission

- **Unit AI & Behavior**
  - Simple AI: Closest enemy targeting (Mechabellum-inspired)
  - Movement AI: Pathfind toward target until in range
  - Attack AI: Execute attack when in range and off cooldown
  - Ability AI: Use abilities when available and conditions met
  - Retreat AI: No retreat (units fight until death for MVP)
  - Target switching: Re-target when current target dies

- **Pathfinding & Movement**
  - A* pathfinding on hex grid (avoid obstacles and other units)
  - Unit collision avoidance (units block hexes)
  - Movement speed in hexes/second (varies per creature)
  - Smooth interpolation points for client rendering
  - Stuck detection and recovery (edge case: units blocked)

- **Attack & Damage System**
  - Attack range checking (hex distance from target)
  - Melee attacks (range 1-2 hexes)
  - Ranged attacks (range 3-6 hexes)
  - Attack cooldown timers (different per creature)
  - Damage calculation formula (base damage, armor reduction, critical hits)
  - Health reduction and death detection
  - Attack animation event triggering (for client sync)

- **Ability Execution**
  - Ability cooldown tracking (per ability, per unit)
  - Ability activation conditions (range, target count, HP threshold)
  - Projectile spawning (fireballs, arrows, spells)
  - Area-of-effect abilities (damage/healing multiple targets)
  - Buff/debuff application (duration tracking, stacking rules)
  - Self-targeting abilities (heals, shields, buffs)

- **Projectile Physics & Collision**
  - Projectile spawning at unit positions
  - Linear trajectory calculation (source → target)
  - Projectile movement per tick (speed in hexes/second)
  - Collision detection (projectile reaches target hex)
  - Impact resolution (damage application, effect spawning)
  - Projectile lifetime limits (despawn after N ticks or max distance)

- **Victory Condition Detection**
  - Team elimination: All units of one side dead
  - Timeout: If simulation reaches time limit, attacker loses (defender advantage)
  - Simultaneous deaths: If both last units die same tick, round is draw → re-deploy
  - Victory event broadcasting to clients

- **State Synchronization**
  - State delta compression (only send changes per tick)
  - Snapshot updates (every 10 ticks for late joiners)
  - Event-driven updates (damage, death, ability use)
  - Network protocol (msgpack or protobuf for efficiency)
  - Update rate throttling (30 updates/sec to clients, even though sim is 60 ticks/sec)

- **Combat Logging & Analytics**
  - Tick-by-tick event log (for debugging and potential replays)
  - Aggregate statistics (damage dealt, healing done, abilities used)
  - Performance metrics (tick duration, simulation lag)
  - Battle outcome data (winner, duration, final state)

### Explicitly Excluded

- **Complex Unit AI**: No flanking tactics, focus fire, or advanced behavior (post-MVP)
- **Terrain Interaction**: Flat battlefield only, no elevation or obstacles (post-MVP)
- **Environmental Effects**: No weather, hazards, or dynamic terrain (post-MVP)
- **Unit Spawning Mid-Combat**: No summoning new creatures during battle (post-MVP)
- **Player Intervention**: No mid-combat controls or ability triggers (pure auto-battle)
- **Replay Recording**: Event logging included, but replay playback is post-MVP
- **AI Difficulty Levels**: Fixed AI behavior for MVP (no easy/hard modes)
- **Persistent Damage**: Units reset health between rounds (no carry-over)

---

## Key User Journeys

### 1. Standard Combat Simulation (Player Perspective)
**Setup**: Both players deployed 8 creatures, clicked Ready
1. Server receives deployment states from both players
2. Server initializes combat state (16 units at starting positions)
3. Server starts simulation loop at 60 ticks/second
4. **Tick 1-60**: Units pathfind toward closest enemies, move 1-2 hexes forward
5. **Tick 61**: Melee units reach range 1, trigger attack animations
6. **Tick 62-70**: Attack cooldowns tick down, projectiles travel
7. **Tick 71**: Projectile hits target, damage dealt (HP 100 → 75)
8. **Tick 100**: Ranged unit activates fireball ability, spawns projectile
9. **Tick 120**: Fireball explodes, AOE damage to 3 enemies
10. **Tick 200**: First unit dies (HP reaches 0), death event sent
11. **Tick 400**: All Player 2 units dead → Victory condition triggered
12. Server broadcasts: "Player 1 Wins!" → Combat ends
13. Server persists round result to database

### 2. Projectile Lifecycle (Server Perspective)
1. **Tick 100**: Archer unit has target in range (5 hexes), ability off cooldown
2. Server triggers ability: `SpawnProjectile(arrow, sourcePos, targetPos)`
3. Server calculates trajectory: linear path from source to target
4. Server adds projectile to `activeProjectiles` registry
5. **Tick 101-110**: Each tick, projectile moves 0.5 hexes toward target
6. **Tick 110**: Projectile reaches target hex → Collision detected
7. Server applies damage to target unit: `ApplyDamage(target, 25)`
8. Server broadcasts impact event to clients (for visual effect)
9. Server removes projectile from registry

### 3. Ability Cooldown & Re-Use
1. **Tick 50**: Mage unit activates "Fireball" ability (cooldown: 180 ticks = 3 seconds)
2. Server sets `unit.abilities.fireball.cooldownRemaining = 180`
3. **Tick 51-229**: Each tick, `cooldownRemaining--`
4. **Tick 230**: Cooldown reaches 0 → Ability available again
5. Server AI checks: "Target in range? Yes. Cooldown ready? Yes. Activate!"
6. Fireball cast again

### 4. Victory by Elimination
1. Combat starts with 8 vs 8 units
2. **Tick 150**: Player 2 loses 3 units (5 remaining)
3. **Tick 250**: Player 1 loses 2 units (6 remaining)
4. **Tick 400**: Player 2 loses 3 more units (2 remaining)
5. **Tick 450**: Player 2 loses last 2 units → All Player 2 units dead
6. Server checks victory condition: `player2Units.length === 0` → TRUE
7. Server broadcasts: `{ event: 'roundEnd', winner: 'player1', finalState: {...} }`
8. Server stops simulation loop
9. Server saves round result to database

### 5. Timeout Draw Handling
1. Combat starts, simulation tick limit = 18,000 ticks (5 minutes at 60 ticks/sec)
2. Both players have tanky creatures that heal frequently
3. **Tick 18,000**: Simulation time limit reached, both sides have units alive
4. Server checks victory condition: Timeout reached, no elimination
5. Server declares: Attacker loses (defender advantage rule)
6. Server broadcasts: `{ event: 'roundEnd', winner: 'defender', reason: 'timeout' }`

---

## Technical Architecture

### Components

**Core Simulation Engine (Node.js)**
- `CombatSimulator`: Main simulation loop, tick management
- `CombatState`: Immutable state snapshot per tick
- `TickScheduler`: Fixed timestep scheduling (60 ticks/sec)
- `VictoryConditionChecker`: Detects round end conditions
- `StateSerializer`: Converts state to network-efficient format

**Unit Management**
- `UnitController`: Individual unit AI and behavior
- `UnitRegistry`: Tracks all active units and their state
- `TargetSelector`: Closest enemy targeting logic
- `HealthManager`: HP tracking, damage application, death handling
- `StatusEffectManager`: Buff/debuff tracking and expiration

**Movement & Pathfinding**
- `PathfindingEngine`: A* algorithm on hex grid
- `MovementController`: Executes unit movement along paths
- `CollisionDetector`: Unit-to-unit and unit-to-obstacle collision
- `NavigationMesh`: Hex grid walkability map

**Combat Mechanics**
- `AttackExecutor`: Processes attack actions (melee/ranged)
- `DamageCalculator`: Computes damage (base, armor, criticals)
- `RangeChecker`: Hex distance validation for attacks
- `CooldownManager`: Tracks attack and ability cooldowns

**Ability System**
- `AbilityExecutor`: Activates abilities based on AI conditions
- `ProjectileSpawner`: Creates projectiles for ranged abilities
- `AOEResolver`: Calculates area-of-effect targets
- `BuffDebuffApplicator`: Applies status effects to units

**Projectile Physics**
- `ProjectileRegistry`: Tracks all active projectiles
- `ProjectileController`: Updates projectile positions per tick
- `TrajectoryCalculator`: Computes projectile paths
- `ImpactResolver`: Handles collision and damage on impact

**Networking & State Sync**
- `StateUpdateBroadcaster`: Sends state deltas to clients
- `EventEmitter`: Broadcasts combat events (damage, death, ability)
- `StateDeltaCompressor`: Efficient delta encoding
- `SnapshotGenerator`: Full state snapshots for synchronization

**Logging & Analytics**
- `CombatLogger`: Tick-by-tick event recording
- `PerformanceMonitor`: Track tick duration, lag detection
- `StatisticsAggregator`: Compile battle statistics
- `ReplayDataRecorder`: Event log for future replay system

### Key Technologies

- **Node.js**: Server runtime for simulation engine
- **TypeScript**: Type-safe combat logic and state management
- **Redis**: In-memory combat state storage (active battles)
- **PostgreSQL**: Persistent storage for battle results
- **WebSocket (Socket.io)**: Real-time state updates to clients
- **Msgpack/Protobuf**: Efficient state serialization
- **Bull/BullMQ**: Job queue for async battle processing (if needed)

### Data Model

**Primary Entities**
```typescript
interface CombatState {
  battleId: string;
  tick: number; // Current simulation tick
  status: 'running' | 'paused' | 'completed';
  units: Unit[];
  projectiles: Projectile[];
  activeEffects: ActiveEffect[];
  events: CombatEvent[]; // Recent events (last 60 ticks)
  statistics: CombatStatistics;
}

interface Unit {
  unitId: string;
  creatureId: string;
  ownerId: PlayerId;
  position: HexCoordinate;
  health: number;
  maxHealth: number;
  status: 'alive' | 'dead';
  currentTarget?: string; // unitId of target
  movementPath?: HexCoordinate[]; // Current pathfinding path
  facingDirection: number; // Degrees for animation
  attackCooldownRemaining: number; // Ticks until next attack
  abilities: UnitAbility[];
  activeBuffs: Buff[];
  activeDebuffs: Debuff[];
  stats: {
    movementSpeed: number; // hexes per second
    attackRange: number; // hexes
    attackDamage: number;
    armor: number;
    attackSpeed: number; // attacks per second
  };
}

interface UnitAbility {
  abilityId: string;
  name: string;
  cooldownTotal: number; // ticks
  cooldownRemaining: number; // ticks
  range: number; // hexes
  manaCost?: number;
  damageAmount?: number;
  healAmount?: number;
  aoeRadius?: number; // hexes
  buffEffect?: BuffEffect;
}

interface Projectile {
  projectileId: string;
  abilityId: string;
  sourceUnitId: string;
  targetUnitId: string;
  currentPosition: HexCoordinate;
  targetPosition: HexCoordinate;
  velocity: number; // hexes per tick
  spawnTick: number;
  lifetimeTicks: number;
  damageAmount: number;
  effectOnImpact: string; // Visual effect ID
}

interface ActiveEffect {
  effectId: string;
  effectType: 'aura' | 'ground' | 'buff_visual' | 'debuff_visual';
  position: HexCoordinate;
  attachedUnitId?: string; // If following a unit
  spawnTick: number;
  durationTicks: number;
  radiusHexes?: number; // For auras
}

interface Buff {
  buffId: string;
  name: string;
  appliedTick: number;
  durationTicks: number;
  effects: {
    damageMultiplier?: number;
    armorBonus?: number;
    speedMultiplier?: number;
    healPerTick?: number;
  };
}

interface Debuff {
  debuffId: string;
  name: string;
  appliedTick: number;
  durationTicks: number;
  effects: {
    damageReduction?: number;
    armorPenalty?: number;
    slowMultiplier?: number;
    damagePerTick?: number; // Poison/burn
    stunned?: boolean;
  };
}

interface CombatEvent {
  tick: number;
  eventType: 'damage_dealt' | 'healing_done' | 'ability_used' | 'unit_died' | 'projectile_spawned' | 'buff_applied';
  data: Record<string, any>;
}

interface CombatStatistics {
  totalDamageDealt: Record<PlayerId, number>;
  totalHealingDone: Record<PlayerId, number>;
  unitsLost: Record<PlayerId, number>;
  abilitiesUsed: Record<PlayerId, number>;
  longestCombat: number; // ticks
}

interface BattleResult {
  battleId: string;
  roundNumber: number;
  winner: PlayerId;
  reason: 'elimination' | 'timeout';
  duration: number; // ticks
  finalState: CombatState;
  statistics: CombatStatistics;
  eventLog: CombatEvent[]; // Full log for potential replay
}
```

**Simulation Loop Pseudocode**
```typescript
class CombatSimulator {
  private state: CombatState;
  private tickRate = 60; // ticks per second
  private tickDuration = 1000 / this.tickRate; // 16.67ms
  private maxTicks = 18000; // 5 minutes

  async runSimulation(deployments: DeploymentState[]) {
    this.state = this.initializeCombatState(deployments);

    while (this.state.tick < this.maxTicks && !this.isRoundOver()) {
      const tickStartTime = Date.now();

      // Execute simulation tick
      this.tick();

      // Broadcast state update to clients (every other tick = 30 updates/sec)
      if (this.state.tick % 2 === 0) {
        this.broadcastStateUpdate();
      }

      // Fixed timestep: Wait until next tick
      const tickElapsed = Date.now() - tickStartTime;
      const sleepTime = Math.max(0, this.tickDuration - tickElapsed);
      await this.sleep(sleepTime);
    }

    // Round over
    const result = this.finalizeRound();
    this.broadcastRoundEnd(result);
    return result;
  }

  private tick() {
    this.state.tick++;

    // Update all units
    for (const unit of this.state.units.filter(u => u.status === 'alive')) {
      this.updateUnit(unit);
    }

    // Update all projectiles
    for (const projectile of this.state.projectiles) {
      this.updateProjectile(projectile);
    }

    // Update all active effects
    for (const effect of this.state.activeEffects) {
      this.updateEffect(effect);
    }

    // Check victory conditions
    if (this.checkVictoryCondition()) {
      this.state.status = 'completed';
    }
  }

  private updateUnit(unit: Unit) {
    // AI: Select target (closest enemy)
    if (!unit.currentTarget || this.isTargetDead(unit.currentTarget)) {
      unit.currentTarget = this.findClosestEnemy(unit);
    }

    if (!unit.currentTarget) return; // No enemies left

    // Check if in attack range
    const distance = this.hexDistance(unit.position, this.getTargetPosition(unit.currentTarget));

    if (distance <= unit.stats.attackRange) {
      // In range: Attack if cooldown ready
      if (unit.attackCooldownRemaining === 0) {
        this.executeAttack(unit, unit.currentTarget);
        unit.attackCooldownRemaining = 60 / unit.stats.attackSpeed; // Convert attacks/sec to ticks
      } else {
        unit.attackCooldownRemaining--;
      }

      // Check abilities
      for (const ability of unit.abilities) {
        if (ability.cooldownRemaining === 0 && this.shouldUseAbility(unit, ability)) {
          this.executeAbility(unit, ability);
          ability.cooldownRemaining = ability.cooldownTotal;
        } else {
          ability.cooldownRemaining = Math.max(0, ability.cooldownRemaining - 1);
        }
      }
    } else {
      // Not in range: Move closer
      if (!unit.movementPath || unit.movementPath.length === 0) {
        unit.movementPath = this.pathfind(unit.position, this.getTargetPosition(unit.currentTarget));
      }

      if (unit.movementPath.length > 0) {
        const nextHex = unit.movementPath[0];
        const moveDistance = unit.stats.movementSpeed / this.tickRate; // hexes per tick

        if (this.hexDistance(unit.position, nextHex) <= moveDistance) {
          // Reached next hex
          unit.position = nextHex;
          unit.movementPath.shift();
        } else {
          // Interpolate toward next hex (for smooth rendering)
          unit.position = this.interpolatePosition(unit.position, nextHex, moveDistance);
        }
      }
    }

    // Update buffs/debuffs
    this.updateStatusEffects(unit);
  }

  private executeAttack(unit: Unit, targetId: string) {
    const target = this.getUnit(targetId);
    if (!target || target.status === 'dead') return;

    // Calculate damage
    const baseDamage = unit.stats.attackDamage;
    const armorReduction = target.stats.armor * 0.5; // Simple formula
    const finalDamage = Math.max(1, baseDamage - armorReduction);

    // Apply damage
    target.health = Math.max(0, target.health - finalDamage);

    // Log event
    this.state.events.push({
      tick: this.state.tick,
      eventType: 'damage_dealt',
      data: { sourceUnitId: unit.unitId, targetUnitId: targetId, damage: finalDamage }
    });

    // Check death
    if (target.health === 0) {
      target.status = 'dead';
      this.state.events.push({
        tick: this.state.tick,
        eventType: 'unit_died',
        data: { unitId: targetId }
      });
    }

    // Update statistics
    this.state.statistics.totalDamageDealt[unit.ownerId] += finalDamage;
  }

  private updateProjectile(projectile: Projectile) {
    // Move projectile toward target
    const distance = this.hexDistance(projectile.currentPosition, projectile.targetPosition);

    if (distance <= projectile.velocity) {
      // Reached target: Apply damage and remove projectile
      const target = this.getUnit(projectile.targetUnitId);
      if (target && target.status === 'alive') {
        target.health = Math.max(0, target.health - projectile.damageAmount);

        if (target.health === 0) {
          target.status = 'dead';
          this.state.events.push({ tick: this.state.tick, eventType: 'unit_died', data: { unitId: target.unitId } });
        }
      }

      // Remove projectile
      this.state.projectiles = this.state.projectiles.filter(p => p.projectileId !== projectile.projectileId);
    } else {
      // Continue moving
      projectile.currentPosition = this.interpolatePosition(
        projectile.currentPosition,
        projectile.targetPosition,
        projectile.velocity
      );
    }
  }

  private checkVictoryCondition(): boolean {
    const player1Units = this.state.units.filter(u => u.ownerId === 'player1' && u.status === 'alive');
    const player2Units = this.state.units.filter(u => u.ownerId === 'player2' && u.status === 'alive');

    if (player1Units.length === 0 || player2Units.length === 0) {
      return true; // Elimination victory
    }

    if (this.state.tick >= this.maxTicks) {
      return true; // Timeout
    }

    return false;
  }
}
```

---

## Dependencies

### Depends On

- **Hex Grid Deployment System** (L2): Provides hex coordinates and grid layout
- **Multi-Round Battle System** (L2): Provides deployment state and round context
- **AI Generation Pipeline** (L1): Provides creature stats, abilities, animations
- **Platform Infrastructure** (L1): WebSocket infrastructure, Redis, PostgreSQL

### Depended On By

- **Client Rendering & Animation Sync** (L2): Consumes state updates for rendering
- **Combat Mechanics & Ability System** (L2): Implements damage formulas and ability logic
- **Multi-Round Battle System** (L2): Receives round results for series scoring

---

## Key Technical Challenges

1. **60 Ticks/Second Performance**: Simulating 16 units with pathfinding, collision detection, projectiles, and effects at 60 ticks/sec without lag. Each tick must complete in <16ms to maintain real-time. Requires optimized algorithms (spatial partitioning for collision, cached pathfinding).

2. **Deterministic Simulation**: Same deployments must always produce same results (critical for testing and potential replays). Requires seeded RNG, fixed-point arithmetic (avoid floating-point drift), and deterministic AI (no random targeting).

3. **State Delta Compression**: Full state updates are too large (16 units × 20 fields = 320+ values). Must send only changes per tick (e.g., "unit 3 moved from (5,2) to (5,3), HP 100→98"). Requires efficient diff algorithm.

4. **Network Latency Tolerance**: Clients receive state updates 100-150ms after they occur. Client rendering must smoothly interpolate between delayed updates without jank. Server must continue simulating even if client disconnects.

5. **Pathfinding Performance**: A* pathfinding for 16 units every tick is expensive. Needs optimization: path caching, only recompute when target moves significantly, use flow fields for groups.

6. **Ability Complexity**: Some abilities (AOE, multi-hit, chain lightning) require complex logic. Must balance expressiveness with performance. Ability execution must be atomic (no partial state changes).

7. **Fair Timeout Handling**: 5-minute timeout must favor defender (attacker loses) to prevent "run away and stall" strategies. But must detect legitimate stalemates (two healing tanks) vs intentional stalling.

---

## Success Criteria

### MVP Definition of Done

- [ ] Server simulation runs at stable 60 ticks/second with 16 units
- [ ] Simple AI (closest enemy targeting) works for all unit types
- [ ] Pathfinding navigates units around obstacles and other units
- [ ] Melee and ranged attacks execute with correct range checking
- [ ] Damage calculation applies armor reduction and updates HP correctly
- [ ] Abilities activate on cooldown with projectile spawning
- [ ] Projectiles travel and apply damage on impact
- [ ] Victory condition detects elimination (all units of one side dead)
- [ ] Timeout after 5 minutes declares defender winner
- [ ] State updates broadcast to clients at 30 updates/second
- [ ] State delta compression reduces network traffic by 70%+
- [ ] Combat events logged for debugging and analytics
- [ ] Battle results persisted to database
- [ ] Simulation recovers gracefully from client disconnection

### Exceptional Target (Post-MVP)

- [ ] Advanced AI: Focus fire on low-HP targets, protect healers
- [ ] Terrain interaction: Obstacles block line-of-sight, elevation affects range
- [ ] Dynamic ability combos: Detect synergies (e.g., oil + fire = explosion)
- [ ] Replay recording and playback with timeline scrubbing
- [ ] AI difficulty levels (easy, medium, hard for PvE mode)
- [ ] Simulation runs at 120 ticks/second for higher fidelity
- [ ] Spectator mode support (multiple clients watching same simulation)
- [ ] Advanced pathfinding: Formations, unit coordination, avoid AOE zones

---

## Open Questions

1. **Tick Rate Trade-off**: 60 ticks/sec feels responsive but is CPU-intensive. Could we reduce to 30 ticks/sec and still feel smooth? Would save 50% server CPU.

2. **State Update Rate**: Clients receive updates at 30/sec (every other tick). Is this enough for smooth interpolation, or should we send every tick (60/sec) despite bandwidth cost?

3. **Determinism vs Randomness**: Should critical hits, dodge chances, and ability procs be deterministic (seeded RNG) or truly random? Determinism helps testing but reduces replay value.

4. **Pathfinding Frequency**: Recompute paths every tick (expensive) or only when target moves >2 hexes (cheaper but less responsive)?

5. **AOE Targeting Priority**: When multiple enemies in AOE range, does AI always use AOE ability or evaluate single-target DPS? Complex AI vs simple rules.

6. **Timeout Victory Logic**: Defender wins on timeout—but what if defender is winning 7 units vs 1 unit? Should timeout victory scale with unit count differential?

7. **Simulation Pause/Resume**: Should server support pausing mid-combat (for friendly matches, debugging) or always run to completion?

8. **Projectile Speed**: Should all projectiles move at same speed (simpler), or vary by ability (arrows fast, fireballs slow)? Variable speed adds complexity but feels better.

---

## L3 Feature Candidates

### Core Simulation Engine
- **Simulation Loop & Tick Scheduler** - 60 ticks/sec fixed timestep loop
- **Combat State Management** - Immutable state snapshots, registry
- **Victory Condition Checker** - Elimination, timeout, draw detection

### Unit AI & Behavior
- **Simple AI Controller** - Closest enemy targeting, basic behavior
- **Pathfinding Engine** - A* algorithm on hex grid
- **Movement Controller** - Execute unit movement along paths
- **Target Selection System** - Find nearest enemy, switch on death

### Combat Mechanics
- **Attack Execution System** - Melee/ranged attack processing
- **Damage Calculation Engine** - Base damage, armor, criticals
- **Range Checking** - Hex distance validation
- **Cooldown Management** - Track attack and ability cooldowns

### Ability System
- **Ability Executor** - Activate abilities based on AI conditions
- **Projectile Spawner** - Create projectiles for ranged abilities
- **AOE Resolver** - Calculate area targets
- **Buff/Debuff Applicator** - Apply status effects

### Projectile & Collision
- **Projectile Physics** - Update projectile positions per tick
- **Collision Detector** - Projectile impact detection
- **Trajectory Calculator** - Compute projectile paths

### State Synchronization
- **State Update Broadcaster** - Send state deltas to clients
- **State Delta Compressor** - Efficient delta encoding
- **Event Emitter** - Combat events (damage, death, ability)

### Logging & Analytics
- **Combat Logger** - Tick-by-tick event recording
- **Performance Monitor** - Track tick duration, lag
- **Statistics Aggregator** - Battle statistics compilation

---

## Metadata

- **Estimated Effort**: 6-8 weeks (core features), 10-12 weeks (with advanced AI)
- **Team Size**: 2-3 developers (1 backend/simulation specialist, 1 full-stack, 1 QA)
- **Priority**: CRITICAL (core game logic)
- **Risks**: HIGH (performance, complexity, balancing)
- **Blockers**: Requires Hex Grid Deployment System for spatial logic

---

*This document defines the authoritative server-side combat simulation engine. Ready for L3 feature breakdown and task definition.*
