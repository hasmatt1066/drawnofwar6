# L3 Feature Specification: Combat Visualization Integration

**Parent Epic:** L2-EPICS/battle-engine/client-rendering-animation-sync.md
**Status:** Ready for Implementation
**Created:** 2025-10-19
**Last Updated:** 2025-10-19

---

## Overview

Integrate the combat visualization renderers (health bars, damage numbers, projectiles, buff icons, combat log) into the live combat system. Create a `CombatVisualizationManager` that orchestrates visual effects based on combat state changes.

---

## User Stories

### As a player, I want to...

1. **See health bars above units in combat** so I know which units are taking damage
2. **See floating damage numbers** when units are hit so I understand combat impact
3. **See projectiles traveling** from attackers to targets for ranged attacks
4. **See buff/debuff icons** above units so I know what status effects are active
5. **View a combat log** to review what happened during battle

---

## Functional Requirements

### FR-1: State Diff Detection

**Requirement:** Detect changes between consecutive `CombatState` snapshots to infer combat events.

**Acceptance Criteria:**
- ✅ Compare two `CombatState` objects
- ✅ Detect health changes (damage/healing)
- ✅ Detect new projectiles spawned
- ✅ Detect buff/debuff applications
- ✅ Detect buff/debuff removals
- ✅ Detect unit deaths
- ✅ Emit typed events for each change detected

**Data Structures:**
```typescript
interface DamageEvent {
  unitId: string;
  oldHealth: number;
  newHealth: number;
  damageAmount: number;
  tick: number;
}

interface ProjectileSpawnEvent {
  projectileId: string;
  sourceUnitId: string;
  targetUnitId: string;
  projectileType: ProjectileType;
  sourcePosition: AxialCoordinate;
  targetPosition: AxialCoordinate;
  tick: number;
}

interface BuffAppliedEvent {
  unitId: string;
  buffId: string;
  buffType: BuffType;
  duration: number;
  stacks?: number;
  tick: number;
}

interface BuffRemovedEvent {
  unitId: string;
  buffId: string;
  tick: number;
}

interface HealingEvent {
  unitId: string;
  oldHealth: number;
  newHealth: number;
  healAmount: number;
  tick: number;
}

interface UnitDeathEvent {
  unitId: string;
  tick: number;
}
```

---

### FR-2: Combat Visualization Manager

**Requirement:** Orchestrate all visual effect renderers in response to combat state updates.

**Acceptance Criteria:**
- ✅ Subscribe to `CombatSocketClient` state updates
- ✅ Use `StateDiffDetector` to identify changes
- ✅ Delegate to appropriate renderers
- ✅ Manage PixiJS containers/layers for effects
- ✅ Implement 60 FPS render loop for animated effects
- ✅ Handle reconnection (rebuild state)

**Architecture:**
```typescript
class CombatVisualizationManager {
  constructor(
    socketClient: CombatSocketClient,
    stage: PIXI.Container,
    gridRenderer: CombatGridRenderer
  )

  // Lifecycle
  public start(): void
  public stop(): void
  public destroy(): void

  // State management
  public setState(state: CombatState): void  // For reconnection

  // Internal orchestration
  private onStateUpdate(state: CombatState): void
  private handleDamageEvent(event: DamageEvent): void
  private handleProjectileSpawn(event: ProjectileSpawnEvent): void
  private handleBuffApplied(event: BuffAppliedEvent): void
  private handleBuffRemoved(event: BuffRemovedEvent): void
  private handleHealing(event: HealingEvent): void
  private handleDeath(event: UnitDeathEvent): void

  // Render loop
  private renderFrame(deltaTime: number): void
}
```

**Container Hierarchy:**
```
PixiJS Stage
├── Grid Layer (existing - from CombatGridRenderer)
├── Unit Layer (existing - animated sprites)
├── Effect Layer (NEW - managed by CombatVisualizationManager)
│   ├── Projectile Container
│   ├── Health Bar Container
│   ├── Buff Icon Container
│   └── Damage Number Container
```

---

### FR-3: Health Bar Display

**Requirement:** Show health bars above units currently in combat.

**Acceptance Criteria:**
- ✅ Health bars appear when unit is attacked or attacks
- ✅ Health bars disappear 3 seconds after last combat action
- ✅ Position 20px above unit sprite
- ✅ Update on every state change (10 Hz)
- ✅ Color-coded: Green (>66%), Yellow (33-66%), Red (<33%)

**Combat Detection:**
- Unit is "in combat" if:
  - Attacked within last 3 seconds, OR
  - Attacked another unit within last 3 seconds, OR
  - Has `currentTarget` set in state

---

### FR-4: Damage Number Display

**Requirement:** Show floating damage/healing numbers when units take damage or heal.

**Acceptance Criteria:**
- ✅ Trigger on attack animation complete callback
- ✅ Display immediately upon callback
- ✅ One number per damage instance (no aggregation)
- ✅ Overlapping numbers stagger vertically (±5px) and horizontally (±10px)
- ✅ Float upward 40px over 1 second
- ✅ Fade out after 0.6 seconds
- ✅ Color-coded by damage type
- ✅ Critical hits 1.5x larger with bold font
- ✅ Healing shows with "+" prefix
- ✅ Max 20 simultaneous damage numbers
- ✅ Implement object pooling (lazy allocation, recycle on complete)

**Object Pooling Strategy (Game Dev Best Practice):**
- **Lazy Pool:** Start with 0 preallocated objects
- **Allocation:** Create new objects on demand up to pool size
- **Recycling:** Return completed objects to pool for reuse
- **Pool Size:** 20 objects (matches max simultaneous)
- **Overflow:** If pool exhausted, reuse oldest active object

---

### FR-5: Projectile Rendering

**Requirement:** Display animated projectiles for ranged attacks.

**Acceptance Criteria:**
- ✅ Trigger when projectile appears in `CombatState.projectiles[]`
- ✅ Launch immediately (animation initiated)
- ✅ Travel time calculated from speed (matches backend simulation)
- ✅ Projectile tracks moving targets (update target position each frame)
- ✅ If target dies mid-flight, continue to last known position
- ✅ Play impact animation at destination
- ✅ Remove after impact
- ✅ Support arcing trajectory (parabolic for arrows, straight for lightning)
- ✅ Rotate to face direction of travel
- ✅ Unlimited simultaneous projectiles (track all from state)

**Projectile Lifecycle:**
1. Detect new projectile ID in `state.projectiles[]`
2. Create visual projectile via `ProjectileRenderer`
3. Each frame: interpolate position toward current target location
4. On arrival: play impact, trigger damage number, destroy visual
5. Remove from tracking when projectile removed from state

---

### FR-6: Buff/Debuff Icon Display

**Requirement:** Show status effect icons above units with active buffs/debuffs.

**Acceptance Criteria:**
- ✅ Display immediately when buff appears in `unit.activeBuffs[]` or `unit.activeDebuffs[]`
- ✅ Position 30px above unit sprite (above health bar)
- ✅ Arrange in 2x4 grid (8 visible max)
- ✅ Show duration countdown (every frame update)
- ✅ Show stack count if > 1
- ✅ If > 8 buffs, show first 8 + "..." ellipsis icon
- ✅ Hover over unit → popup shows all buffs with names/durations
- ✅ Auto-close popup on mouse leave
- ✅ Instant removal when buff removed from state

**Buff Overflow Popup:**
```
╔════════════════════════════╗
║  Active Buffs (12)         ║
╠════════════════════════════╣
║  🟢 Regeneration (5.2s)    ║
║  🔵 Shield (8.7s) x2       ║
║  🟣 Poison (3.1s) x3       ║
║  🔴 Burn (2.5s)            ║
║  ... (8 more)              ║
╚════════════════════════════╝
```

---

### FR-7: Combat Log Panel

**Requirement:** Provide text-based combat event log in slide-out panel.

**Acceptance Criteria:**
- ✅ React component: `<CombatLogPanel />`
- ✅ Slide-out from right side of screen
- ✅ Toggle button to show/hide
- ✅ Scrollable list of combat events
- ✅ Color-coded event types
- ✅ Optional timestamps (HH:MM:SS)
- ✅ Max 200 entries
- ✅ Batching: identical events aggregate (e.g., "Goblin takes 5 damage (x3)")
- ✅ Filter out repetitive movement events
- ✅ Keep only: attacks, damage, healing, deaths, abilities, status effects

**UI Design:**
```
[ <Combat Log> ]  ← Toggle button (fixed position)

When open:
┌─────────────────────────────┐
│  Combat Log            [X]  │ ← Close button
├─────────────────────────────┤
│ [14:23:45] Knight attacks   │
│            Goblin           │
│ [14:23:45] Goblin takes     │
│            15 damage        │
│ [14:23:46] Mage casts       │
│            Fireball         │
│ [14:23:46] Goblin takes     │
│            30 damage (x3)   │ ← Batched
│ [14:23:47] Goblin died      │
│                             │
│ [↓ Scroll for more...]     │
└─────────────────────────────┘
```

---

### FR-8: Reconnection Support

**Requirement:** Rebuild visual state when player reconnects mid-combat.

**Acceptance Criteria:**
- ✅ On reconnection, `setState(state: CombatState)` called
- ✅ Rebuild all health bars for units in combat
- ✅ Rebuild all buff icons from `unit.activeBuffs[]`
- ✅ Rebuild all active projectiles from `state.projectiles[]`
- ✅ Populate combat log from `state.events[]`
- ✅ Resume render loop

---

## Non-Functional Requirements

### NFR-1: Performance

**Target:** 60 FPS sustained during combat

**Constraints:**
- Max 20 simultaneous damage numbers (enforced by pool)
- Max 50 simultaneous projectiles (reasonable worst-case)
- Max 20 units with health bars visible
- Max 100 buff icons across all units
- Combat log updates max 10 times per second

**Optimization Strategies:**
- Object pooling for damage numbers
- Batch DOM updates for combat log
- Use `requestAnimationFrame` for render loop
- Cull off-screen effects
- Throttle buff duration updates to 10 Hz (not every frame)

### NFR-2: Memory Management

**Constraints:**
- Destroy completed animations immediately
- Recycle damage numbers via pool
- Limit combat log to 200 entries
- Clear old projectiles on removal from state

### NFR-3: Visual Clarity

**Requirements:**
- Damage numbers don't obscure units (offset stagger)
- Health bars clearly visible (high contrast)
- Buff icons distinguishable at a glance
- Combat log readable font size (12px minimum)

---

## Technical Design

### State Diff Detection Algorithm

```typescript
class StateDiffDetector {
  private previousState: CombatState | null = null;

  public detectChanges(newState: CombatState): DetectedEvents {
    if (!this.previousState) {
      this.previousState = newState;
      return { damages: [], heals: [], projectiles: [], buffs: [], deaths: [] };
    }

    const events: DetectedEvents = {
      damages: this.detectDamage(this.previousState, newState),
      heals: this.detectHealing(this.previousState, newState),
      projectiles: this.detectNewProjectiles(this.previousState, newState),
      buffs: this.detectBuffChanges(this.previousState, newState),
      deaths: this.detectDeaths(this.previousState, newState)
    };

    this.previousState = newState;
    return events;
  }

  private detectDamage(oldState: CombatState, newState: CombatState): DamageEvent[] {
    const events: DamageEvent[] = [];

    for (const unit of newState.units) {
      const oldUnit = oldState.units.find(u => u.unitId === unit.unitId);
      if (!oldUnit) continue;

      if (unit.health < oldUnit.health) {
        events.push({
          unitId: unit.unitId,
          oldHealth: oldUnit.health,
          newHealth: unit.health,
          damageAmount: oldUnit.health - unit.health,
          tick: newState.tick
        });
      }
    }

    return events;
  }

  // Similar methods for other event types...
}
```

### Object Pool Implementation

```typescript
class DamageNumberPool {
  private pool: DamageNumber[] = [];
  private active: Set<DamageNumber> = new Set();
  private maxSize: number;

  constructor(maxSize: number = 20) {
    this.maxSize = maxSize;
  }

  public acquire(
    value: number,
    type: DamageType,
    position: { x: number; y: number }
  ): DamageNumber {
    let dmgNumber: DamageNumber;

    // Try to get from pool
    if (this.pool.length > 0) {
      dmgNumber = this.pool.pop()!;
      this.resetDamageNumber(dmgNumber, value, type, position);
    } else if (this.active.size < this.maxSize) {
      // Create new if under max
      dmgNumber = this.renderer.createDamageNumber(value, type, position);
    } else {
      // Pool exhausted - reuse oldest active
      const oldest = this.getOldestActive();
      this.release(oldest);
      dmgNumber = this.pool.pop()!;
      this.resetDamageNumber(dmgNumber, value, type, position);
    }

    this.active.add(dmgNumber);
    return dmgNumber;
  }

  public release(dmgNumber: DamageNumber): void {
    this.active.delete(dmgNumber);
    this.pool.push(dmgNumber);
    dmgNumber.container.visible = false; // Hide but don't destroy
  }

  private getOldestActive(): DamageNumber {
    return Array.from(this.active).reduce((oldest, current) =>
      current.startTime < oldest.startTime ? current : oldest
    );
  }
}
```

---

## Integration Points

### With Existing Systems

1. **CombatSocketClient:**
   - Subscribe to `onCombatState()` callback
   - Subscribe to `onCombatCompleted()` for end-of-combat cleanup

2. **CombatRendererIntegration:**
   - Share same PixiJS stage
   - Use `onAnimationComplete()` callback to trigger damage numbers
   - Query unit positions from `CombatGridRenderer.getSpriteAt()`

3. **CombatGridRenderer:**
   - Query sprite positions for effect placement
   - No modifications needed

4. **DeploymentGridDemoPage:**
   - Instantiate `CombatVisualizationManager`
   - Pass `CombatSocketClient` and PixiJS stage
   - Add `<CombatLogPanel />` to React component tree
   - **CRITICAL**: Load complete creature sprite data before starting visualization

### Multiplayer Sprite Data Requirements

**Requirement**: CombatVisualizationManager must receive creature sprite data for ALL creatures in combat, including opponent creatures.

**Data Sources** (must collect from ALL):
1. Local player 1 roster (`player1Creatures`)
2. Local player 2 roster (`player2Creatures`)
3. Current player's deployed creatures (`currentPlayerState.placements`)
4. **Opponent's deployed creatures** (`opponentPlacements`) - CRITICAL for multiplayer

**Implementation Pattern**:
```typescript
// Collect creatures from all sources
const currentPlayerPlacements = currentPlayerState.placements.map(p => p.creature);
const opponentCreatures = opponentPlacements.map(p => p.creature);
const allCreatures = [
  ...player1Creatures,
  ...player2Creatures,
  ...currentPlayerPlacements,
  ...opponentCreatures
];

// Deduplicate by creature ID
const creatureMap = new Map<string, DeploymentCreature>();
allCreatures.forEach(c => creatureMap.set(c.id, c));
const uniqueCreatures = Array.from(creatureMap.values());

// Load into visualization manager
vizManager.setCreatureData(uniqueCreatures);
```

**Why This Matters**:

In multiplayer combat:
1. Player 1 generates creature with sprite → Deploys to backend
2. Backend sends deployment state to Player 2
3. Player 2 receives opponent placement data (includes creature sprite URLs)
4. If Player 2 doesn't extract sprite data from opponent placements → Shows placeholders
5. If Player 2 extracts sprite data → Shows actual opponent sprites ✅

**Data Flow Diagram**:
```
Player 1:
  Generate Creature → Local Roster → Deploy → Backend
                                                 ↓
                                         Match State Storage
                                                 ↓
Player 2:                              Receive Deployment
  Local Roster → CombatVizManager ← OpponentPlacements ← Backend
                        ↓
                  Render Combat
                  (sees both players' sprites)
```

**Common Bug**: Only loading local roster data results in opponent creatures rendering as placeholders in multiplayer matches.

**Fix Date**: 2025-10-20 - Added opponent placement data collection to DeploymentGridDemoPage
**Related Report**: /docs/implementation-reports/MULTIPLAYER_COMBAT_BUG_FIXES.md

---

## Testing Strategy

### Unit Tests (TDD)

1. **StateDiffDetector:**
   - Detect damage correctly
   - Detect healing correctly
   - Detect new projectiles
   - Detect buff applications/removals
   - Handle edge cases (unit deaths, missing data)

2. **DamageNumberPool:**
   - Acquire from empty pool (creates new)
   - Acquire from pool with available objects (reuses)
   - Pool exhaustion (recycles oldest)
   - Release returns to pool correctly

3. **CombatVisualizationManager:**
   - State updates trigger correct renderers
   - Health bars appear/disappear based on combat status
   - Damage numbers created on attack complete
   - Projectiles track moving targets
   - Buffs update duration each frame

### Integration Tests

1. **End-to-End Combat Scenario:**
   - Simulate full combat from deployment → combat → completion
   - Verify all visual effects appear correctly
   - Verify cleanup on combat end

2. **Performance Test:**
   - 20 units in combat simultaneously
   - Measure FPS during intense battle
   - Verify 60 FPS maintained

3. **Reconnection Test:**
   - Disconnect mid-combat
   - Reconnect
   - Verify state rebuilt correctly

4. **Multiplayer Sprite Visibility Test** (CRITICAL):
   - Open two browser windows (Player 1, Player 2)
   - Each player generates unique creature with sprite
   - Both players deploy creatures
   - Start combat
   - **Verify**: Both players can see opponent's actual sprites (not placeholders)
   - **Verify**: Sprite animations play correctly for all creatures
   - **Test File**: Manual test with deployment grid demo page

5. **Combat Log Scroll Behavior Test** (CRITICAL):
   - Start combat with frequent log updates
   - **Verify**: Page stays at top showing battlefield
   - **Verify**: Combat log scrolls internally
   - **Verify**: User can scroll page independently
   - **Verify**: No page jumping or fighting scroll attempts
   - **Test File**: Manual test with combat log panel

---

## Breakdown into L4 Tasks

### TASK-VIZ-016: State Diff Detector
- Implement `StateDiffDetector` class
- Detect damage, healing, projectiles, buffs, deaths
- Unit tests (30+ tests)

### TASK-VIZ-017: Damage Number Pool
- Implement `DamageNumberPool` class
- Lazy allocation, recycling, overflow handling
- Unit tests (15+ tests)

### TASK-VIZ-018: Combat Visualization Manager (Core)
- Implement `CombatVisualizationManager` class
- State update handling, event delegation
- Render loop for animated effects
- Unit tests (40+ tests)

### TASK-VIZ-019: Health Bar Integration
- Integrate `HealthBarRenderer` into manager
- Combat status tracking (3-second timeout)
- Position above units
- Unit tests (20+ tests)

### TASK-VIZ-020: Damage Number Integration
- Integrate `DamageNumberRenderer` + pool into manager
- Hook animation complete callbacks
- Overlap staggering logic
- Unit tests (25+ tests)

### TASK-VIZ-021: Projectile Integration
- Integrate `ProjectileRenderer` into manager
- Target tracking logic
- Impact detection
- Unit tests (30+ tests)

### TASK-VIZ-022: Buff Icon Integration
- Integrate `BuffIconRenderer` into manager
- Grid layout (2x4)
- Overflow popup (React component)
- Unit tests (25+ tests)

### TASK-VIZ-023: Combat Log Panel Component
- Create `<CombatLogPanel />` React component
- Slide-out animation
- Event batching logic
- Unit tests (20+ tests)

### TASK-VIZ-024: Reconnection Support
- Implement `setState()` rebuild logic
- Test disconnect/reconnect scenario
- Unit tests (15+ tests)

### TASK-VIZ-025: End-to-End Integration Testing
- Full combat scenario test
- Performance benchmarking
- Visual regression testing

---

## Success Criteria

✅ **Functional:**
- All visual effects display correctly during combat
- Health bars appear only for units in combat
- Damage numbers show on hit with proper colors/formatting
- Projectiles fly and track targets accurately
- Buff icons display with duration/stacks
- Combat log records all events
- Reconnection rebuilds state correctly

✅ **Performance:**
- 60 FPS sustained with 20 units in combat
- < 100ms lag from damage → visual display
- Combat log updates smoothly without jank

✅ **Quality:**
- 200+ unit tests passing
- E2E integration test passing
- No memory leaks over 5-minute combat

---

## Dependencies

**Requires (Already Complete):**
- ✅ DamageNumberRenderer (TASK-VIZ-012)
- ✅ ProjectileRenderer (TASK-VIZ-013)
- ✅ CombatLog (TASK-VIZ-014)
- ✅ BuffIconRenderer (TASK-VIZ-015)
- ✅ HealthBarRenderer (TASK-VIZ-011)
- ✅ CombatSocketClient
- ✅ CombatRendererIntegration
- ✅ CombatGridRenderer

**Blocks:**
- None (final integration task)

---

## Open Questions

None - all clarified with user.

---

## Implementation Notes

**Game Dev Best Practices Applied:**
- Object pooling for frequently created/destroyed objects
- Lazy allocation to minimize startup cost
- 60 FPS render loop with delta time
- Visual effect layers for proper Z-ordering
- Batching for DOM updates (combat log)
- Cull off-screen effects

**Next Step:** Break down into L4 atomic tasks and implement with TDD.
