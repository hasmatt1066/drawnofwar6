# Battle Engine L2 Epic Summary

**Theme**: Battle Engine (L1)
**Created**: 2025-10-03
**Status**: Ready for L3 Feature Development

---

## Overview

The Battle Engine theme has been broken down into **5 critical L2 Epics** that collectively implement the multi-round, hex-based, auto-battler combat system. These epics represent the complete technical architecture required to deliver strategic, fair, and visually engaging battles between player-created creatures.

---

## Epic Breakdown

### 1. Multi-Round Battle System
**Epic ID**: `battle-multi-round`
**File**: `/docs/specs/L2-EPICS/battle-engine/multi-round-battle-system.md`

**Purpose**: Tournament-style battle structure with Best-of-5/7 series, simultaneous blind deployment, and round-by-round adaptation.

**Key Capabilities**:
- Best-of-5 (first to 3 wins) and Best-of-7 (first to 4 wins) formats
- Round lifecycle: Deployment → Countdown → Combat → Result → Next Round
- Series score tracking and victory detection
- Deployment phase with 60-second timer and auto-deploy fallback
- Between-round summary screens
- Disconnection handling with 30-second grace period
- Match history persistence

**Estimated Effort**: 4-6 weeks
**Team Size**: 2-3 developers (1 backend, 1 frontend, 1 full-stack)
**Priority**: CRITICAL

---

### 2. Hex Grid Deployment System
**Epic ID**: `battle-hex-deployment`
**File**: `/docs/specs/L2-EPICS/battle-engine/hex-grid-deployment-system.md`

**Purpose**: Hexagonal grid battlefield with strategic placement mechanics, drag-and-drop UI, and deployment validation.

**Key Capabilities**:
- 12×8 hex grid battlefield (96 hexes total)
- Deployment zones: 3 columns per player
- Drag-and-drop creature placement with snap-to-hex
- Placement validation (within zone, no stacking)
- Hex math library (distance, neighbors, conversions)
- Visual feedback (green/red hex highlights)
- Formation templates (optional MVP feature)
- Auto-deployment on timeout

**Estimated Effort**: 3-4 weeks (core), 5-6 weeks (with advanced features)
**Team Size**: 2-3 developers (1 frontend/PixiJS, 1 full-stack, 1 QA)
**Priority**: CRITICAL

---

### 3. Authoritative Server Simulation
**Epic ID**: `battle-server-sim`
**File**: `/docs/specs/L2-EPICS/battle-engine/authoritative-server-simulation.md`

**Purpose**: Server-side combat engine running at 60 ticks/sec with deterministic simulation, unit AI, pathfinding, and state synchronization.

**Key Capabilities**:
- 60 ticks/second simulation loop
- Simple AI: Closest enemy targeting (Mechabellum-inspired)
- A* pathfinding on hex grid
- Attack execution (melee, ranged, magic)
- Ability activation with cooldown tracking
- Projectile physics and collision detection
- Victory condition detection (elimination, timeout)
- State delta compression for network efficiency
- Combat event logging for analytics

**Estimated Effort**: 6-8 weeks (core), 10-12 weeks (with advanced AI)
**Team Size**: 2-3 developers (1 backend/simulation, 1 full-stack, 1 QA)
**Priority**: CRITICAL

---

### 4. Client Rendering & Animation Sync
**Epic ID**: `battle-client-render`
**File**: `/docs/specs/L2-EPICS/battle-engine/client-rendering-animation-sync.md`

**Purpose**: PixiJS battlefield renderer with smooth 60fps animations, latency compensation, and synchronized visual effects.

**Key Capabilities**:
- PixiJS layered rendering (grid, creatures, projectiles, effects, UI)
- Animation state machine (idle, walk, attack, ability, death)
- Position interpolation for smooth movement (100-150ms latency compensation)
- Animation library integration (55 pre-generated effects)
- Effect compositing with blend modes
- Projectile rendering with trajectory animation
- Visual feedback (damage numbers, health bars, hit flash, screen shake)
- Performance optimization (sprite pooling, texture atlases, frustum culling)
- Target: 30+ FPS with 20 units (per L0 metric)

**Estimated Effort**: 6-8 weeks (core), 10-12 weeks (with polish)
**Team Size**: 2-3 developers (1 PixiJS specialist, 1 frontend, 1 QA)
**Priority**: CRITICAL

---

### 5. Combat Mechanics & Ability System
**Epic ID**: `battle-combat-mechanics`
**File**: `/docs/specs/L2-EPICS/battle-engine/combat-mechanics-ability-system.md`

**Purpose**: Core combat formulas, damage calculation, ability execution logic, buff/debuff system, and rock-paper-scissors balance.

**Key Capabilities**:
- Damage formula: `FinalDamage = max(1, BaseDamage - Armor)`
- Critical hits (10% chance, 1.5x damage)
- Damage types (physical, magic, true)
- Ability types (single-target, AOE, buff, debuff, heal)
- Buff/debuff system with stacking rules and duration tracking
- Rock-paper-scissors counters: Melee beats magic, ranged beats melee, magic beats ranged
- Creature archetypes (tank, melee DPS, ranged DPS, mage, support)
- Power budget formula to balance AI-generated creatures
- Combat analytics (damage dealt, healing done, abilities used)

**Estimated Effort**: 4-6 weeks (core), 8-10 weeks (with balance tuning)
**Team Size**: 2-3 developers (1 backend, 1 game designer/balancer, 1 QA)
**Priority**: CRITICAL

---

## Epic Dependencies

### Dependency Graph

```
Multi-Round Battle System
    ├── depends on: Hex Grid Deployment System
    ├── depends on: Authoritative Server Simulation
    └── depends on: Matchmaking & Session Management (L1)

Hex Grid Deployment System
    ├── depends on: Platform Infrastructure (L1)
    ├── depends on: AI Generation Pipeline (L1) - creature sprites
    └── no blockers (can start immediately)

Authoritative Server Simulation
    ├── depends on: Hex Grid Deployment System - hex math
    ├── depends on: Combat Mechanics & Ability System - formulas
    ├── depends on: AI Generation Pipeline (L1) - creature stats
    └── depends on: Platform Infrastructure (L1) - WebSocket, Redis

Client Rendering & Animation Sync
    ├── depends on: Authoritative Server Simulation - state updates
    ├── depends on: Hex Grid Deployment System - hex-to-pixel conversion
    ├── depends on: Animation Library (L3) - 55 effects
    └── depends on: AI Generation Pipeline (L1) - creature sprites

Combat Mechanics & Ability System
    ├── depends on: Authoritative Server Simulation - execution engine
    ├── depends on: AI Generation Pipeline (L1) - creature base stats
    └── depends on: Hex Grid Deployment System - distance calculations
```

### Cross-Epic Dependencies

1. **Hex Grid Deployment System** → **Authoritative Server Simulation**
   - Provides hex coordinate system and distance calculations
   - Must be completed first (or developed in parallel with shared interfaces)

2. **Combat Mechanics & Ability System** → **Authoritative Server Simulation**
   - Defines formulas that server executes
   - Can develop in parallel, integrate via interfaces

3. **Authoritative Server Simulation** → **Client Rendering & Animation Sync**
   - Server produces state updates, client consumes them
   - Can develop with mock data initially

4. **Animation Library (L3)** → **Client Rendering & Animation Sync**
   - 55 pre-generated effects required for visual polish
   - Already completed (per AI Generation Pipeline epic status)

5. **All Epics** → **Multi-Round Battle System**
   - Multi-Round orchestrates all components
   - Should be developed last (or integration layer added late)

---

## Critical Path for Implementation

### Phase 1: Foundation (Weeks 1-6)
**Goal**: Establish spatial and combat logic foundations

**Parallel Development**:
1. **Hex Grid Deployment System** (3-4 weeks)
   - Start immediately (no blockers)
   - Priority: Hex math library, grid rendering, placement validation
   - Deliverable: Working deployment UI with 8 creatures placeable

2. **Combat Mechanics & Ability System** (4 weeks initial)
   - Start immediately (formulas can be unit-tested independently)
   - Priority: Damage formulas, ability definitions, stat archetypes
   - Deliverable: Tested combat formula library

**Dependencies Resolved**: Hex Grid provides coordinate system for Server Simulation

---

### Phase 2: Simulation Engine (Weeks 5-12)
**Goal**: Build authoritative combat engine

**Development**:
3. **Authoritative Server Simulation** (6-8 weeks)
   - Start week 5 (after Hex Grid hex math is ready)
   - Priority: Simulation loop, unit AI, pathfinding, state sync
   - Integration: Use Combat Mechanics formulas, Hex Grid distance calculations
   - Deliverable: Server can run full combat simulation, emit state updates

**Dependencies Resolved**: Server Simulation provides state updates for Client Rendering

---

### Phase 3: Visual Layer (Weeks 8-16)
**Goal**: Render battles beautifully

**Development**:
4. **Client Rendering & Animation Sync** (6-8 weeks)
   - Start week 8 (can use mock server data initially, integrate real server at week 12)
   - Priority: PixiJS renderer, animation state machine, interpolation
   - Integration: Consume Server Simulation state updates, use Animation Library effects
   - Deliverable: Client renders smooth 30+ FPS battles with animations

**Dependencies Resolved**: All core systems operational

---

### Phase 4: Integration (Weeks 14-18)
**Goal**: Connect all epics into cohesive match flow

**Development**:
5. **Multi-Round Battle System** (4-6 weeks)
   - Start week 14 (after Deployment, Simulation, and Rendering are functional)
   - Priority: Round orchestration, score tracking, transitions
   - Integration: Coordinate all epics into Best-of-5 series
   - Deliverable: Complete match flow from deployment to victory screen

---

### Phase 5: Tuning & Polish (Weeks 16-20)
**Goal**: Balance, optimize, and polish

**Activities**:
- **Combat Balance Tuning** (2-3 weeks)
  - Playtest and adjust damage formulas, ability cooldowns, stat ranges
  - Ensure rock-paper-scissors balance works
  - Target: Average battle duration 60-120s, 60% win rate for counters

- **Performance Optimization** (1-2 weeks)
  - Profile server simulation (target: <10ms per tick)
  - Optimize client rendering (target: 30+ FPS with 20 units)
  - Reduce network bandwidth (state delta compression)

- **Visual Polish** (1-2 weeks)
  - Screen shake, damage numbers, hit flash effects
  - UI/UX improvements based on playtesting
  - Animation timing fine-tuning

---

## Risk Assessment

### High-Risk Areas

1. **Server Simulation Performance** (Epic 3)
   - **Risk**: 60 ticks/sec with 16 units, pathfinding, and abilities may exceed performance budget
   - **Mitigation**: Early profiling, optimize pathfinding (cache paths), spatial partitioning for collision

2. **Client Rendering Performance** (Epic 4)
   - **Risk**: Maintaining 30+ FPS with 20 animated sprites may be challenging on low-end devices
   - **Mitigation**: Sprite pooling, texture atlases, frustum culling, LOD system

3. **Combat Balance** (Epic 5)
   - **Risk**: AI-generated creatures with wildly varying stats may break balance
   - **Mitigation**: Power budget enforcement, archetype classification, extensive playtesting

4. **Latency Compensation** (Epic 4)
   - **Risk**: 100-150ms latency may cause visible desyncs or teleportation
   - **Mitigation**: Interpolation buffer, dead reckoning, server reconciliation

### Medium-Risk Areas

5. **Hex Grid Complexity** (Epic 2)
   - **Risk**: Hex math is notoriously error-prone (off-by-one errors, rounding issues)
   - **Mitigation**: Comprehensive unit tests, visual debugging tools, use proven hex libraries

6. **Multi-Round State Management** (Epic 1)
   - **Risk**: Disconnection/reconnection across multiple rounds may corrupt state
   - **Mitigation**: Robust state serialization, Redis persistence, recovery testing

---

## Success Metrics (MVP)

### Functional Completeness
- [ ] Two players can complete full Best-of-5 series end-to-end
- [ ] All 5 epics integrated and functional
- [ ] No critical bugs blocking gameplay

### Performance (Per L0 Vision)
- [ ] Server simulation: 60 ticks/sec stable
- [ ] Client rendering: 30+ FPS with 20 units on screen
- [ ] Match stability: <1% disconnection rate
- [ ] Average battle duration: 60-120 seconds

### Quality
- [ ] Animations synchronized correctly (projectiles spawn at right frame)
- [ ] Combat feels fair (rock-paper-scissors balance works)
- [ ] Deployment intuitive (new player can place creatures without tutorial)
- [ ] Visual feedback clear (players can follow combat action)

---

## Next Steps

### Immediate Actions (Week 1)
1. **Start Hex Grid Deployment System Development**
   - Set up PixiJS hex grid renderer
   - Implement hex math library (distance, neighbors, conversions)
   - Create drag-and-drop placement prototype

2. **Start Combat Mechanics Formulas**
   - Define damage formula with unit tests
   - Specify ability types and activation conditions
   - Create archetype stat templates

3. **Validate Animation Library Completion**
   - Confirm all 55 effects generated and accessible
   - Test effect compositing with creature sprites
   - Verify API endpoints working

### Week 2-4 Deliverables
- **Hex Grid**: Working deployment UI with placement validation
- **Combat Mechanics**: Tested formula library
- **Server Simulation**: Simulation loop skeleton running

### Month 2 Milestone
- **Integration Test**: Server simulation running with hex grid logic and combat formulas
- **Visual Test**: Client rendering mock battles with animations

### Month 3 Milestone
- **Alpha Playable**: Full match flow from deployment to victory screen
- **Internal Playtesting**: Balance tuning begins

### Month 4 Target
- **MVP Complete**: All 5 epics integrated, balanced, and polished
- **Ready for Closed Beta**

---

## Epic File Locations

All L2 Epic documents are located at:
`/mnt/c/Users/mhast/Desktop/drawnofwar6/docs/specs/L2-EPICS/battle-engine/`

1. `multi-round-battle-system.md`
2. `hex-grid-deployment-system.md`
3. `authoritative-server-simulation.md`
4. `client-rendering-animation-sync.md`
5. `combat-mechanics-ability-system.md`
6. `EPIC_SUMMARY.md` (this document)

---

## Alignment with L0 Vision

All epics align with L0 Vision success criteria:

- **Generation Success**: Creatures from AI pipeline integrate into battles ✓
- **Animation Variety**: Animation library (55 effects) used in combat ✓
- **Match Stability**: <1% disconnection target (Multi-Round epic) ✓
- **Performance**: 30+ FPS target (Client Rendering epic) ✓
- **Strategic Depth**: Hex grid + rock-paper-scissors (Deployment + Combat Mechanics epics) ✓

All epics support the core experience loop:
*Create → Deploy → Battle → Adapt → Share*

---

**Status**: All 5 L2 Epics documented and ready for L3 Feature breakdown.

**Next Layer**: Each epic should be broken down into L3 Features (implementable features) with specific L4 Tasks (unit-testable functions).
