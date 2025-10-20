# L4 Tasks: Combat Engine - Phases 4-7 (Remaining Systems)

**Phase Duration:** Weeks 5-9
**Parent Epic:** Authoritative Server Simulation (L2)
**Status:** READY FOR IMPLEMENTATION
**Last Updated:** 2025-10-05

---

## Phase 4: Ability System & Projectiles (Weeks 5-6)

### L4-COMBAT-013: Ability Executor

**File:** `/backend/src/combat/abilities/ability-executor.ts`

**Function Signature:**
```typescript
class AbilityExecutor {
  canUseAbility(unit: CombatUnit, ability: Ability, target: CombatUnit | HexCoordinate): boolean
  executeAbility(unit: CombatUnit, ability: Ability, target: CombatUnit | HexCoordinate, state: CombatState): AbilityResult
}

interface AbilityResult {
  success: boolean;
  projectile?: Projectile; // If ability spawns projectile
  affectedUnits: string[]; // Unit IDs affected by ability
  events: CombatEvent[];
  newCooldown: number;
}
```

**Test Cases (5):**
1. Ability respects cooldown
2. Ability respects range
3. AOE ability hits multiple targets
4. Single-target ability spawns projectile
5. Self-buff ability applies to caster

---

### L4-COMBAT-014: Projectile System

**File:** `/backend/src/combat/projectiles/projectile-system.ts`

**Function Signature:**
```typescript
class ProjectileSystem {
  spawnProjectile(source: CombatUnit, target: CombatUnit, ability: Ability): Projectile
  updateProjectiles(state: CombatState, deltaTime: number): ProjectileUpdate[]
  checkCollision(projectile: Projectile, targetPos: HexCoordinate): boolean
}

interface ProjectileUpdate {
  projectileId: string;
  newPosition: HexCoordinate;
  hitTarget: boolean;
  impactEvent?: CombatEvent;
}
```

**Test Cases (5):**
1. Projectile spawns at correct position
2. Projectile moves toward target at correct speed
3. Projectile hits target when reaching hex
4. Projectile applies damage on impact
5. Projectile despawns after max lifetime

---

### L4-COMBAT-015: AOE Resolver

**File:** `/backend/src/combat/abilities/aoe-resolver.ts`

**Function Signature:**
```typescript
class AOEResolver {
  getUnitsInAOE(center: HexCoordinate, radius: number, allUnits: CombatUnit[]): CombatUnit[]
  applyAOEDamage(center: HexCoordinate, radius: number, damage: number, state: CombatState): AOEResult
}

interface AOEResult {
  affectedUnits: Array<{ unitId: string; damage: number }>;
  events: CombatEvent[];
}
```

**Test Cases (5):**
1. Finds all units in radius
2. Applies damage to all units in AOE
3. Respects friendly fire rules
4. Handles edge of grid AOE
5. Damage falls off with distance (optional)

---

### L4-COMBAT-016: Buff/Debuff System

**File:** `/backend/src/combat/effects/buff-debuff-system.ts`

**Function Signature:**
```typescript
class BuffDebuffSystem {
  applyBuff(unit: CombatUnit, buff: Buff): void
  applyDebuff(unit: CombatUnit, debuff: Debuff): void
  updateEffects(unit: CombatUnit, deltaTime: number): EffectUpdate
  removeExpiredEffects(unit: CombatUnit): void
}

interface EffectUpdate {
  statsModified: boolean;
  newStats: UnitStats;
  expiredEffects: string[];
}
```

**Test Cases (5):**
1. Buff increases stats
2. Debuff decreases stats
3. Effects expire after duration
4. Multiple buffs stack correctly
5. Same buff doesn't stack (refreshes duration)

---

## Phase 5: WebSocket Broadcasting (Week 7)

### L4-COMBAT-017: State Delta Compressor

**File:** `/backend/src/combat/network/state-delta-compressor.ts`

**Function Signature:**
```typescript
class StateDeltaCompressor {
  createDelta(previousState: CombatState, currentState: CombatState): StateDelta
  applyDelta(baseState: CombatState, delta: StateDelta): CombatState
}

interface StateDelta {
  tick: number;
  changedUnits: Partial<CombatUnit>[]; // Only changed fields
  addedProjectiles: Projectile[];
  removedProjectiles: string[];
  newEvents: CombatEvent[];
}
```

**Test Cases (5):**
1. Delta only includes changed fields
2. Delta size < 10% of full state
3. Applying delta recreates state
4. Handles unit deaths correctly
5. Empty delta when no changes

---

### L4-COMBAT-018: State Update Broadcaster

**File:** `/backend/src/combat/network/state-broadcaster.ts`

**Function Signature:**
```typescript
class StateBroadcaster {
  broadcastUpdate(state: CombatState, matchId: string): void
  broadcastEvent(event: CombatEvent, matchId: string): void
  sendSnapshot(state: CombatState, playerId: string): void
}
```

**Test Cases (5):**
1. Broadcasts to all players in match
2. Sends delta updates (not full state)
3. Sends full snapshot every 10 ticks
4. Events broadcast immediately
5. Handles disconnected players gracefully

---

### L4-COMBAT-019: Network Protocol

**File:** `/backend/src/combat/network/combat-protocol.ts`

**Function Signature:**
```typescript
interface CombatUpdateMessage {
  type: 'state_delta' | 'state_snapshot' | 'combat_event';
  tick: number;
  data: StateDelta | CombatState | CombatEvent;
}

class CombatProtocol {
  serialize(message: CombatUpdateMessage): Buffer
  deserialize(buffer: Buffer): CombatUpdateMessage
}
```

**Test Cases (5):**
1. Serializes state to compact binary
2. Deserializes correctly
3. Handles large states (16+ units)
4. Version compatibility
5. Error handling for corrupt data

---

## Phase 6: Integration & Polish (Week 8)

### L4-COMBAT-020: Combat Simulation Integration

**File:** `/backend/src/combat/combat-simulator-full.ts`

**Integration:** Combines all systems into working simulation

**Test Cases (10):**
1. **Full 2v2 battle**: Units move, attack, use abilities, and fight to victory
2. **Projectile combat**: Archer vs Mage with projectile abilities
3. **AOE abilities**: Fireball hits multiple targets
4. **Buff/debuff flow**: Healer buffs ally who then kills enemy
5. **Victory by elimination**: All units of one side die
6. **Victory by timeout**: Defender wins after 5 minutes
7. **Simultaneous death**: Both last units die → draw
8. **Network updates**: State broadcast at 30 updates/sec
9. **Delta compression**: Network traffic < 50KB/sec
10. **Performance**: Stable 60 ticks/sec with 16 units

---

### L4-COMBAT-021: Event Logging & Replay

**File:** `/backend/src/combat/logging/combat-logger.ts`

**Function Signature:**
```typescript
class CombatLogger {
  logEvent(event: CombatEvent): void
  getEventLog(battleId: string): CombatEvent[]
  exportReplayData(battleId: string): ReplayData
}

interface ReplayData {
  battleId: string;
  initialState: CombatState;
  events: CombatEvent[];
  tickRate: number;
}
```

**Test Cases (5):**
1. Logs all combat events
2. Event log contains full battle history
3. Replay data can recreate battle
4. Event filtering by type
5. Export to JSON format

---

### L4-COMBAT-022: Performance Monitor

**File:** `/backend/src/combat/monitoring/performance-monitor.ts`

**Function Signature:**
```typescript
class PerformanceMonitor {
  recordTickDuration(duration: number): void
  getAverageTickDuration(): number
  detectLag(): boolean
  getPerformanceReport(): PerformanceReport
}

interface PerformanceReport {
  averageTickDuration: number;
  maxTickDuration: number;
  lagSpikes: number;
  ticksPerSecond: number;
}
```

**Test Cases (5):**
1. Records tick durations accurately
2. Calculates average correctly
3. Detects lag spikes (>20ms ticks)
4. Reports actual tick rate
5. Performance data exportable

---

## Phase 7: Testing & Deployment (Week 9)

### L4-COMBAT-023: End-to-End Combat Flow

**File:** `/backend/src/combat/__tests__/e2e-combat.test.ts`

**Test Scenarios (5):**
1. **Balanced 4v4 battle**: Multiple unit types, abilities, projectiles
2. **Melee vs Ranged**: Knights chase archers
3. **Tank & Healer combo**: Support units enable victory
4. **AOE spam**: Mages with fireball vs clustered units
5. **Timeout stalemate**: Two healing tanks can't kill each other

---

### L4-COMBAT-024: Load Testing

**File:** `/backend/src/combat/__tests__/load-testing.test.ts`

**Test Cases (5):**
1. Run 10 simultaneous battles (60 ticks/sec each)
2. 100 battles in sequence (memory leak check)
3. Max units (8v8 = 16 units total)
4. Network saturation test (100 clients)
5. CPU profiling (identify bottlenecks)

---

### L4-COMBAT-025: Edge Case Handling

**File:** `/backend/src/combat/__tests__/edge-cases.test.ts`

**Test Cases (10):**
1. All units spawn in same hex (collision resolution)
2. Unit dies while projectile in flight
3. Target switches mid-ability cast
4. Ability cooldown reduced while on cooldown
5. Negative damage (heal overflow)
6. Unit surrounded by enemies (stuck pathfinding)
7. Projectile target dies before impact
8. AOE hits caster (friendly fire)
9. Simultaneous kills (who gets credit)
10. Battle cleanup on crash/disconnect

---

## Summary: All Phases

### Total L4 Tasks: 25
- **Phase 1 (Weeks 2-3):** 4 tasks - Core Simulation
- **Phase 2 (Weeks 3-4):** 4 tasks - AI & Pathfinding
- **Phase 3 (Weeks 4-5):** 4 tasks - Combat Mechanics
- **Phase 4 (Weeks 5-6):** 4 tasks - Abilities & Projectiles
- **Phase 5 (Week 7):** 3 tasks - WebSocket Broadcasting
- **Phase 6 (Week 8):** 3 tasks - Integration & Polish
- **Phase 7 (Week 9):** 3 tasks - Testing & Deployment

### Total Test Cases: ~120
- Unit tests: ~85
- Integration tests: ~20
- E2E tests: ~15

### Files to Create: 25

### Complete Definition of Done

**Phase 1-3 (Core Combat):**
- [x] Simulation runs at 60 ticks/sec
- [x] Units select targets and pathfind
- [x] Combat deals damage and kills units
- [x] Victory detection works

**Phase 4-5 (Advanced Systems):**
- [ ] Abilities execute with cooldowns
- [ ] Projectiles spawn and hit targets
- [ ] AOE abilities hit multiple units
- [ ] Buffs/debuffs modify stats
- [ ] Network updates broadcast at 30/sec
- [ ] State delta compression < 50KB/sec

**Phase 6-7 (Production Ready):**
- [ ] Full battle runs start to finish
- [ ] Event logging for replays
- [ ] Performance monitoring active
- [ ] All edge cases handled
- [ ] Load tested (10 simultaneous battles)
- [ ] Production deployment ready

---

## Implementation Schedule (8 Weeks Total)

**Week 2:** Phase 1 - Core Simulation (Tasks 1-4)
**Week 3:** Phase 2 - AI & Pathfinding (Tasks 5-8)
**Week 4:** Phase 3 - Combat Mechanics (Tasks 9-12)
**Week 5:** Phase 4 Part 1 - Abilities (Tasks 13-14)
**Week 6:** Phase 4 Part 2 - Projectiles & Effects (Tasks 15-16)
**Week 7:** Phase 5 - WebSocket Broadcasting (Tasks 17-19)
**Week 8:** Phase 6 - Integration & Polish (Tasks 20-22)
**Week 9:** Phase 7 - Testing & Deployment (Tasks 23-25)

---

## Next Steps

1. **Begin TDD Implementation:**
   - Start with Phase 1, Task 1 (Simulation Loop)
   - Write tests first, then implementation
   - Run tests continuously

2. **Daily Progress Tracking:**
   - Complete 1-2 L4 tasks per day
   - Review and refactor
   - Update documentation

3. **Weekly Milestones:**
   - End of Week 3: Core simulation complete
   - End of Week 5: Combat mechanics complete
   - End of Week 7: Network broadcasting complete
   - End of Week 9: Production ready

---

**Status:** Complete L4 task breakdown - Ready for TDD implementation

**Total Specification Time:** ~4 hours
**Total Implementation Time:** ~8 weeks (following TDD)
**Total Project Time:** ~9 weeks to production-ready combat engine
