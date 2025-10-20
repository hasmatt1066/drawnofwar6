# Combat Engine Implementation Roadmap

**Status:** READY FOR IMPLEMENTATION
**Approach:** Test-Driven Development (TDD)
**Duration:** 8 weeks (Weeks 2-9)
**Total L4 Tasks:** 25
**Total Test Cases:** ~120

---

## Overview

This roadmap details the complete implementation plan for the Authoritative Server Combat Engine. All L4 atomic tasks have been defined with test specifications following TDD principles.

**Architecture:** Server-authoritative combat simulation running at 60 ticks/second, broadcasting state updates to clients for rendering.

---

## Phase Breakdown

### ✅ Phase 0: Prerequisites (Week 1) - COMPLETE
- [x] Fixed deployment socket race condition
- [x] Tested socket reliability
- [x] Defined all L4 tasks with test specs

### 📋 Phase 1: Core Simulation (Weeks 2-3)
**Files:** 4 | **Tests:** 19 | **Status:** Ready

**L4-COMBAT-001: Simulation Loop**
- Fixed 60 ticks/second timestep
- Pause/resume/speed control
- File: `/backend/src/combat/simulation-loop.ts`

**L4-COMBAT-002: Combat State Management**
- Immutable state updates
- Event logging (max 60 ticks)
- Serialization for network
- File: `/backend/src/combat/combat-state.ts`

**L4-COMBAT-003: Victory Detection**
- Elimination victory
- Timeout (defender wins)
- Simultaneous death (draw)
- File: `/backend/src/combat/victory-detector.ts`

**L4-COMBAT-004: Combat Simulator**
- Main orchestrator
- Integrates all systems
- Returns battle results
- File: `/backend/src/combat/combat-simulator.ts`

**Definition of Done:**
- [ ] All 19 tests passing
- [ ] Simulation runs at 60 ticks/sec
- [ ] State is immutable
- [ ] Victory detection works
- [ ] Can run battle start to finish

---

### 📋 Phase 2: AI & Pathfinding (Weeks 3-4)
**Files:** 4 | **Tests:** 18 | **Status:** Ready

**L4-COMBAT-005: Target Selection**
- Closest enemy AI
- Target switching on death
- File: `/backend/src/combat/ai/target-selector.ts`

**L4-COMBAT-006: A* Pathfinding**
- Hex grid pathfinding
- Obstacle avoidance
- File: `/backend/src/combat/pathfinding/astar-pathfinder.ts`

**L4-COMBAT-007: Movement Controller**
- Unit movement at correct speed
- Facing direction updates
- Path recalculation
- File: `/backend/src/combat/movement/movement-controller.ts`

**L4-COMBAT-008: Unit AI Controller**
- AI orchestration
- Move → Attack decision
- File: `/backend/src/combat/ai/unit-ai-controller.ts`

**Definition of Done:**
- [ ] All 18 tests passing
- [ ] Units select closest enemies
- [ ] Pathfinding avoids obstacles
- [ ] Movement at correct speed
- [ ] Units chase and attack

---

### 📋 Phase 3: Combat Mechanics (Weeks 4-5)
**Files:** 4 | **Tests:** 18 | **Status:** Ready

**L4-COMBAT-009: Damage Calculator**
- Damage formula (base - armor*0.5)
- Critical hits (2x, configurable %)
- Magical vs physical
- File: `/backend/src/combat/damage/damage-calculator.ts`

**L4-COMBAT-010: Attack Executor**
- Execute attacks
- Apply damage
- Set cooldowns
- File: `/backend/src/combat/attack/attack-executor.ts`

**L4-COMBAT-011: Range Checker**
- Hex distance validation
- Find units in range
- File: `/backend/src/combat/attack/range-checker.ts`

**L4-COMBAT-012: Death Handler**
- Mark units dead
- Force retargeting
- Free occupied hexes
- File: `/backend/src/combat/death/death-handler.ts`

**Definition of Done:**
- [ ] All 18 tests passing
- [ ] Damage calculation works
- [ ] Critical hits implemented
- [ ] Attack cooldowns enforced
- [ ] Death handling complete

---

### 📋 Phase 4: Abilities & Projectiles (Weeks 5-6)
**Files:** 4 | **Tests:** 20 | **Status:** Ready

**L4-COMBAT-013: Ability Executor**
- Ability activation
- Cooldown management
- File: `/backend/src/combat/abilities/ability-executor.ts`

**L4-COMBAT-014: Projectile System**
- Spawn projectiles
- Update trajectories
- Collision detection
- File: `/backend/src/combat/projectiles/projectile-system.ts`

**L4-COMBAT-015: AOE Resolver**
- Find units in radius
- Apply AOE damage
- File: `/backend/src/combat/abilities/aoe-resolver.ts`

**L4-COMBAT-016: Buff/Debuff System**
- Apply effects
- Duration tracking
- Stat modifications
- File: `/backend/src/combat/effects/buff-debuff-system.ts`

**Definition of Done:**
- [ ] All 20 tests passing
- [ ] Abilities execute correctly
- [ ] Projectiles spawn and hit
- [ ] AOE hits multiple targets
- [ ] Buffs/debuffs modify stats

---

### 📋 Phase 5: WebSocket Broadcasting (Week 7)
**Files:** 3 | **Tests:** 15 | **Status:** Ready

**L4-COMBAT-017: State Delta Compressor**
- Delta compression (send only changes)
- File: `/backend/src/combat/network/state-delta-compressor.ts`

**L4-COMBAT-018: State Broadcaster**
- Broadcast updates at 30/sec
- Handle disconnects
- File: `/backend/src/combat/network/state-broadcaster.ts`

**L4-COMBAT-019: Network Protocol**
- Binary serialization
- Message types
- File: `/backend/src/combat/network/combat-protocol.ts`

**Definition of Done:**
- [ ] All 15 tests passing
- [ ] Delta size < 10% of full state
- [ ] Updates broadcast at 30/sec
- [ ] Network traffic < 50KB/sec

---

### 📋 Phase 6: Integration & Polish (Week 8)
**Files:** 3 | **Tests:** 20 | **Status:** Ready

**L4-COMBAT-020: Full Integration**
- Combine all systems
- End-to-end battles
- File: `/backend/src/combat/combat-simulator-full.ts`

**L4-COMBAT-021: Event Logging**
- Combat logger
- Replay data export
- File: `/backend/src/combat/logging/combat-logger.ts`

**L4-COMBAT-022: Performance Monitor**
- Track tick duration
- Detect lag
- File: `/backend/src/combat/monitoring/performance-monitor.ts`

**Definition of Done:**
- [ ] All 20 tests passing
- [ ] Full battles work
- [ ] Event logging complete
- [ ] Performance monitored

---

### 📋 Phase 7: Testing & Deployment (Week 9)
**Files:** 3 | **Tests:** 20 | **Status:** Ready

**L4-COMBAT-023: E2E Testing**
- Complex battle scenarios
- File: `/backend/src/combat/__tests__/e2e-combat.test.ts`

**L4-COMBAT-024: Load Testing**
- 10 simultaneous battles
- Memory leak checks
- File: `/backend/src/combat/__tests__/load-testing.test.ts`

**L4-COMBAT-025: Edge Cases**
- Handle all edge cases
- File: `/backend/src/combat/__tests__/edge-cases.test.ts`

**Definition of Done:**
- [ ] All 20 tests passing
- [ ] E2E scenarios work
- [ ] Load tested successfully
- [ ] Edge cases handled

---

## TDD Implementation Process

### Daily Workflow

**For Each L4 Task:**

1. **Read Test Specification** (from phase docs)
2. **Write Failing Tests** (RED)
   - Copy test cases from spec
   - Implement test code
   - Run tests → should FAIL
3. **Write Minimal Code** (GREEN)
   - Implement just enough to pass tests
   - Run tests → should PASS
4. **Refactor** (REFACTOR)
   - Clean up code
   - Extract functions
   - Run tests → should still PASS
5. **Document** (if needed)
   - Update JSDoc comments
   - Note design decisions

**Example for L4-COMBAT-001:**
```bash
# Day 1: Simulation Loop
cd backend
npm test -- simulation-loop.test.ts --watch

# 1. Write tests (from spec)
# 2. Run tests → FAIL ✗
# 3. Implement SimulationLoop class
# 4. Run tests → PASS ✓
# 5. Refactor
# 6. Commit
git add src/combat/simulation-loop.ts
git commit -m "feat: implement simulation loop (L4-COMBAT-001)

- Fixed 60 tick/sec timestep
- Pause/resume functionality
- Speed multiplier support
- All 4 tests passing

Part of Phase 1: Core Simulation"
```

---

## Progress Tracking

### Week 2 Goals
- [ ] L4-COMBAT-001: Simulation Loop
- [ ] L4-COMBAT-002: Combat State
- [ ] L4-COMBAT-003: Victory Detector
- [ ] L4-COMBAT-004: Combat Simulator
- [ ] **Milestone:** Core simulation runs battles

### Week 3 Goals
- [ ] L4-COMBAT-005: Target Selection
- [ ] L4-COMBAT-006: A* Pathfinding
- [ ] L4-COMBAT-007: Movement Controller
- [ ] L4-COMBAT-008: Unit AI Controller
- [ ] **Milestone:** Units move and attack

### Week 4 Goals
- [ ] L4-COMBAT-009: Damage Calculator
- [ ] L4-COMBAT-010: Attack Executor
- [ ] L4-COMBAT-011: Range Checker
- [ ] L4-COMBAT-012: Death Handler
- [ ] **Milestone:** Combat mechanics complete

### Week 5 Goals
- [ ] L4-COMBAT-013: Ability Executor
- [ ] L4-COMBAT-014: Projectile System
- [ ] **Milestone:** Abilities work

### Week 6 Goals
- [ ] L4-COMBAT-015: AOE Resolver
- [ ] L4-COMBAT-016: Buff/Debuff System
- [ ] **Milestone:** Advanced abilities complete

### Week 7 Goals
- [ ] L4-COMBAT-017: Delta Compressor
- [ ] L4-COMBAT-018: State Broadcaster
- [ ] L4-COMBAT-019: Network Protocol
- [ ] **Milestone:** Network updates working

### Week 8 Goals
- [ ] L4-COMBAT-020: Full Integration
- [ ] L4-COMBAT-021: Event Logging
- [ ] L4-COMBAT-022: Performance Monitor
- [ ] **Milestone:** Production-ready system

### Week 9 Goals
- [ ] L4-COMBAT-023: E2E Testing
- [ ] L4-COMBAT-024: Load Testing
- [ ] L4-COMBAT-025: Edge Cases
- [ ] **Milestone:** Combat engine deployed

---

## Success Metrics

### Technical Metrics
- **Performance:** 60 ticks/sec stable with 16 units
- **Network:** < 50KB/sec bandwidth per client
- **Latency:** < 100ms state update delay
- **Reliability:** 0 crashes in 1000 battles
- **Test Coverage:** > 95% code coverage

### Functional Metrics
- **AI:** Units intelligently target and attack
- **Combat:** Damage/death work correctly
- **Abilities:** All ability types functional
- **Victory:** All 3 victory conditions work
- **Network:** Multiplayer sync perfect

---

## File Structure

```
backend/src/combat/
├── simulation-loop.ts              # L4-001
├── combat-state.ts                 # L4-002
├── victory-detector.ts             # L4-003
├── combat-simulator.ts             # L4-004
├── combat-simulator-full.ts        # L4-020
│
├── ai/
│   ├── target-selector.ts          # L4-005
│   └── unit-ai-controller.ts       # L4-008
│
├── pathfinding/
│   └── astar-pathfinder.ts         # L4-006
│
├── movement/
│   └── movement-controller.ts      # L4-007
│
├── damage/
│   └── damage-calculator.ts        # L4-009
│
├── attack/
│   ├── attack-executor.ts          # L4-010
│   └── range-checker.ts            # L4-011
│
├── death/
│   └── death-handler.ts            # L4-012
│
├── abilities/
│   ├── ability-executor.ts         # L4-013
│   └── aoe-resolver.ts             # L4-015
│
├── projectiles/
│   └── projectile-system.ts        # L4-014
│
├── effects/
│   └── buff-debuff-system.ts       # L4-016
│
├── network/
│   ├── state-delta-compressor.ts   # L4-017
│   ├── state-broadcaster.ts        # L4-018
│   └── combat-protocol.ts          # L4-019
│
├── logging/
│   └── combat-logger.ts            # L4-021
│
├── monitoring/
│   └── performance-monitor.ts      # L4-022
│
└── __tests__/
    ├── simulation-loop.test.ts
    ├── combat-state.test.ts
    ├── ... (25 test files)
    ├── combat-integration.test.ts
    ├── ai-movement-integration.test.ts
    ├── combat-flow-integration.test.ts
    ├── e2e-combat.test.ts
    ├── load-testing.test.ts
    └── edge-cases.test.ts
```

---

## Next Steps

### Immediate (Today)
1. ✅ Review all L4 task specifications
2. ✅ Understand TDD workflow
3. ⏭️ **Begin L4-COMBAT-001: Simulation Loop**

### This Week (Week 2)
- Implement Phase 1 (Core Simulation)
- Run tests continuously
- Daily commits with task completion

### Next 8 Weeks
- Follow phase-by-phase implementation
- TDD for every task
- Weekly milestone reviews
- Deploy combat engine at end of Week 9

---

## Documentation References

- **Phase 1 Tasks:** `/docs/specs/L4-TASKS/combat-engine/PHASE-1-CORE-SIMULATION.md`
- **Phase 2 Tasks:** `/docs/specs/L4-TASKS/combat-engine/PHASE-2-AI-PATHFINDING.md`
- **Phase 3 Tasks:** `/docs/specs/L4-TASKS/combat-engine/PHASE-3-COMBAT-MECHANICS.md`
- **Phases 4-7 Tasks:** `/docs/specs/L4-TASKS/combat-engine/PHASES-4-7-REMAINING-SYSTEMS.md`
- **L2 Epic:** `/docs/specs/L2-EPICS/battle-engine/authoritative-server-simulation.md`

---

**Status:** Complete roadmap - Ready to begin TDD implementation

**Time Investment:**
- Specification: ~4 hours ✅
- Implementation: ~8 weeks (320 hours)
- Total: ~324 hours to production-ready combat engine

**ROI:** Single source of truth combat engine that powers the entire game, prevents cheating, enables replays, and provides foundation for all future combat features.
