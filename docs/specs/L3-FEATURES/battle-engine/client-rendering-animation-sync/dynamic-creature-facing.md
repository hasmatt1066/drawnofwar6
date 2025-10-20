# L3 FEATURE: Dynamic Creature Facing During Movement

**Feature ID**: `dynamic-creature-facing`
**Parent Epic**: Client Rendering & Animation Sync (L2)
**Status**: PLANNING
**Version**: 1.0
**Last Updated**: 2025-10-07

---

## Overview

**Dynamic Creature Facing** enables creatures to automatically update their facing direction based on movement, with smooth rotation transitions between directional sprites. When a creature moves from one hex to another, the system calculates the movement vector, selects the appropriate directional sprite (from 6 available directions: E, NE, SE, W, NW, SW), and smoothly transitions to the new facing using alpha-blended crossfades.

**Purpose**: Transform static creatures into dynamic entities that naturally orient themselves toward their movement destination, enhancing spatial awareness and visual realism in tactical combat.

**User Value**: Players can intuitively understand creature intentions and movement patterns by seeing which direction creatures are facing. This visual feedback eliminates cognitive overhead, as creatures naturally look toward where they're moving or attacking, making the battlefield more readable and engaging.

---

## Functional Requirements

### FR-1: Direction Calculation from Movement Vector

**What**: Calculate the appropriate facing direction based on a creature's movement from source hex to destination hex.

**Direction Mapping**:
- **E (East)**: 330° - 30° (moving right)
- **NE (Northeast)**: 30° - 90° (moving up-right)
- **NW (Northwest)**: 90° - 150° (moving up-left)
- **W (West)**: 150° - 210° (moving left)
- **SW (Southwest)**: 210° - 270° (moving down-left)
- **SE (Southeast)**: 270° - 330° (moving down-right)

**Algorithm**:
```typescript
/**
 * Calculate facing direction from movement vector
 * @param from - Source hex coordinate
 * @param to - Destination hex coordinate
 * @returns HexDirection enum value (0-5)
 */
function calculateFacingDirection(
  from: AxialCoordinate,
  to: AxialCoordinate
): HexDirection {
  // Convert hex coordinates to pixel space
  const fromPixel = hexGrid.toPixel(from);
  const toPixel = hexGrid.toPixel(to);

  // Calculate movement vector
  const dx = toPixel.x - fromPixel.x;
  const dy = toPixel.y - fromPixel.y;

  // Calculate angle in radians
  const angle = Math.atan2(dy, dx);

  // Convert to degrees (0-360)
  const degrees = ((angle * 180 / Math.PI) + 360) % 360;

  // Map angle to nearest hex direction
  if (degrees >= 330 || degrees < 30) return HexDirection.E;
  if (degrees >= 30 && degrees < 90) return HexDirection.NE;
  if (degrees >= 90 && degrees < 150) return HexDirection.NW;
  if (degrees >= 150 && degrees < 210) return HexDirection.W;
  if (degrees >= 210 && degrees < 270) return HexDirection.SW;
  if (degrees >= 270 && degrees < 330) return HexDirection.SE;

  return HexDirection.E; // Fallback
}
```

**Edge Cases**:
1. **No Movement**: If from === to, maintain current facing direction
2. **Adjacent Hex Movement**: Single-hex moves should still trigger direction updates
3. **Diagonal Movement**: System naturally handles diagonals via angle calculation
4. **Isometric Projection**: Pixel coordinates account for projection transformation

---

### FR-2: Smooth Crossfade Transitions

**What**: Smoothly transition between directional sprites when facing changes, preventing jarring visual "pops".

**Transition Behavior**:
- **Duration**: 150ms crossfade (configurable, 100-200ms range)
- **Blending**: Alpha blend from old sprite (1.0 → 0.0) to new sprite (0.0 → 1.0)
- **Interruption**: New direction change cancels in-progress transition
- **Frame Rate**: Smooth at 30+ FPS using requestAnimationFrame

**Algorithm**:
```typescript
interface DirectionTransition {
  oldSprite: PIXI.Container;
  newSprite: PIXI.Container;
  startTime: number;
  duration: number;
  fromDirection: HexDirection;
  toDirection: HexDirection;
}

/**
 * Start crossfade transition to new direction
 */
async function startDirectionTransition(
  creature: DeploymentCreature,
  hex: AxialCoordinate,
  newDirection: HexDirection,
  duration: number = 150
): Promise<void> {
  // Cancel any in-progress transition
  if (creature.activeTransition) {
    cancelTransition(creature.activeTransition);
  }

  // Skip if already facing this direction
  if (creature.facing === newDirection) {
    return;
  }

  // Get old sprite container
  const oldSprite = renderer.getCreatureSpriteAt(hex);
  if (!oldSprite) return;

  // Create new sprite at same position
  const newSprite = await createCreatureSprite(
    creature,
    hex,
    newDirection
  );
  newSprite.alpha = 0;

  // Add to scene
  creatureLayer.addChild(newSprite);

  // Store transition state
  const transition: DirectionTransition = {
    oldSprite,
    newSprite,
    startTime: performance.now(),
    duration,
    fromDirection: creature.facing || HexDirection.E,
    toDirection: newDirection
  };

  creature.activeTransition = transition;

  // Animate crossfade
  animateTransition(creature, transition);
}

/**
 * Animate crossfade using RAF
 */
function animateTransition(
  creature: DeploymentCreature,
  transition: DirectionTransition
): void {
  const elapsed = performance.now() - transition.startTime;
  const progress = Math.min(elapsed / transition.duration, 1.0);

  // Ease-in-out curve for smooth transition
  const eased = easeInOutQuad(progress);

  // Update alphas
  transition.oldSprite.alpha = 1.0 - eased;
  transition.newSprite.alpha = eased;

  if (progress < 1.0) {
    // Continue animation
    requestAnimationFrame(() => animateTransition(creature, transition));
  } else {
    // Transition complete
    completeTransition(creature, transition);
  }
}

/**
 * Finalize transition and cleanup
 */
function completeTransition(
  creature: DeploymentCreature,
  transition: DirectionTransition
): void {
  // Remove old sprite
  creatureLayer.removeChild(transition.oldSprite);
  transition.oldSprite.destroy({ children: true });

  // Ensure new sprite is fully opaque
  transition.newSprite.alpha = 1.0;

  // Update creature facing
  creature.facing = transition.toDirection;
  creature.activeTransition = null;
}

/**
 * Ease-in-out quadratic curve
 */
function easeInOutQuad(t: number): number {
  return t < 0.5
    ? 2 * t * t
    : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
```

**Transition Cancellation**:
```typescript
function cancelTransition(transition: DirectionTransition): void {
  // Stop animation immediately
  transition.oldSprite.destroy({ children: true });

  // Keep new sprite visible at current alpha
  // (will be replaced by next transition)
}
```

---

### FR-3: Directional Sprite Loading & Mirroring

**What**: Load appropriate directional sprite from `BattlefieldDirectionalViews` data structure, applying horizontal mirroring for W/NW/SW directions.

**Data Structure** (from `shared/src/types/deployment.ts`):
```typescript
interface BattlefieldDirectionalViews {
  // Generated directions (low top-down perspective)
  E: DirectionalSprite;   // East
  NE: DirectionalSprite;  // Northeast
  SE: DirectionalSprite;  // Southeast

  // Mirrored directions (use horizontal flip in renderer)
  // W: mirror of E
  // NW: mirror of NE
  // SW: mirror of SE
}

interface DirectionalSprite {
  sprite: string;           // Static sprite image (base64)
  walkFrames: string[];     // Walk animation frames (base64 array)
}
```

**Loading Algorithm**:
```typescript
/**
 * Load directional sprite with automatic mirroring
 */
function loadDirectionalSprite(
  creature: DeploymentCreature,
  direction: HexDirection
): { spriteUrl: string; shouldMirror: boolean } {
  const dirViews = creature.battlefieldDirectionalViews;

  if (!dirViews) {
    // Fallback to legacy sprite if no directional views
    return {
      spriteUrl: creature.sprite,
      shouldMirror: false
    };
  }

  // Map direction to sprite (with mirroring for W, NW, SW)
  switch (direction) {
    case HexDirection.E:
      return { spriteUrl: dirViews.E.sprite, shouldMirror: false };

    case HexDirection.NE:
      return { spriteUrl: dirViews.NE.sprite, shouldMirror: false };

    case HexDirection.SE:
      return { spriteUrl: dirViews.SE.sprite, shouldMirror: false };

    case HexDirection.W:
      return { spriteUrl: dirViews.E.sprite, shouldMirror: true };

    case HexDirection.NW:
      return { spriteUrl: dirViews.NE.sprite, shouldMirror: true };

    case HexDirection.SW:
      return { spriteUrl: dirViews.SE.sprite, shouldMirror: true };

    default:
      return { spriteUrl: dirViews.E.sprite, shouldMirror: false };
  }
}

/**
 * Apply mirroring to PIXI sprite
 */
function applyMirroring(sprite: PIXI.Sprite, shouldMirror: boolean): void {
  if (shouldMirror) {
    // Flip horizontally by inverting X scale
    sprite.scale.x = Math.abs(sprite.scale.x) * -1;
  } else {
    // Ensure positive X scale
    sprite.scale.x = Math.abs(sprite.scale.x);
  }
}
```

---

### FR-4: Deployment Phase Facing Updates

**What**: During deployment phase, update creature facing when dragged to different hexes on the grid.

**Behavior**:
1. **Initial Placement**: Creatures face East (default) when first placed
2. **Drag Preview**: While dragging, calculate facing based on:
   - **Source hex** (if repositioning) to **target hex**
   - **Roster position** to **target hex** (if placing new)
3. **Drop Confirmation**: Apply calculated facing when creature is placed
4. **Repositioning**: Update facing when moving existing creature to new hex

**Implementation**:
```typescript
/**
 * Handle drag preview with facing calculation
 */
function handleDragOver(event: DragEvent): void {
  const targetHex = renderer.getHexAtPixel(event.clientX, event.clientY);

  if (!targetHex || !dragState.creature) return;

  // Calculate facing direction
  let facingDirection = HexDirection.E;

  if (dragState.sourceHex) {
    // Repositioning: face from source to target
    facingDirection = calculateFacingDirection(
      dragState.sourceHex,
      targetHex
    );
  } else {
    // New placement: face toward center of battlefield
    const centerHex = { q: 6, r: 4 }; // 12x8 grid center
    facingDirection = calculateFacingDirection(targetHex, centerHex);
  }

  // Render drag preview with facing
  renderer.renderDragPreview(
    targetHex,
    dragState.creature.name,
    dragState.creature.playerId,
    dragState.creature,
    facingDirection
  );
}

/**
 * Handle drop with facing confirmation
 */
function handleDrop(event: DragEvent): void {
  const targetHex = renderer.getHexAtPixel(event.clientX, event.clientY);

  if (!targetHex || !dragState.creature) return;

  // Calculate final facing
  let facingDirection = HexDirection.E;

  if (dragState.sourceHex) {
    facingDirection = calculateFacingDirection(
      dragState.sourceHex,
      targetHex
    );
  }

  // Update creature state with facing
  const updatedCreature = {
    ...dragState.creature,
    facing: facingDirection
  };

  // Emit placement event with facing
  emitPlacement({
    creature: updatedCreature,
    hex: targetHex
  });
}
```

---

### FR-5: Combat Phase Facing Updates

**What**: During combat phase, continuously update creature facing based on server-provided movement state.

**Server State**:
```typescript
interface CombatUnitState {
  unitId: string;
  position: AxialCoordinate;
  previousPosition?: AxialCoordinate;
  targetPosition?: AxialCoordinate;
  status: 'idle' | 'moving' | 'attacking' | 'dead';
  facingDirection?: HexDirection; // Server-calculated facing
}
```

**Client Synchronization**:
```typescript
/**
 * Update facing from combat state update
 */
function handleCombatStateUpdate(update: CombatStateUpdate): void {
  for (const unit of update.units) {
    const creature = findCreatureByUnitId(unit.unitId);
    if (!creature) continue;

    // Option 1: Server provides explicit facing
    if (unit.facingDirection !== undefined) {
      updateCreatureFacing(creature, unit.position, unit.facingDirection);
    }

    // Option 2: Client calculates from movement
    else if (unit.previousPosition && unit.position) {
      const facingDirection = calculateFacingDirection(
        unit.previousPosition,
        unit.position
      );
      updateCreatureFacing(creature, unit.position, facingDirection);
    }

    // Option 3: Face toward target
    else if (unit.targetPosition) {
      const facingDirection = calculateFacingDirection(
        unit.position,
        unit.targetPosition
      );
      updateCreatureFacing(creature, unit.position, facingDirection);
    }
  }
}

/**
 * Update creature facing with smooth transition
 */
function updateCreatureFacing(
  creature: DeploymentCreature,
  hex: AxialCoordinate,
  newDirection: HexDirection
): void {
  // Skip if no change
  if (creature.facing === newDirection) return;

  // Start smooth crossfade transition
  startDirectionTransition(creature, hex, newDirection, 150);
}
```

---

### FR-6: 180° Turn Handling

**What**: Special handling for 180-degree turns to prevent unnatural rotation directions.

**Problem**: When creature turns from E → W, which intermediate direction should it pass through?
- Clockwise: E → SE → SW → W (270°)
- Counter-clockwise: E → NE → NW → W (90°)

**Solution**: Choose shortest rotation path based on angle difference.

```typescript
/**
 * Calculate rotation direction for 180° turns
 * @returns 'clockwise' | 'counter-clockwise' | 'direct'
 */
function determineRotationPath(
  fromDirection: HexDirection,
  toDirection: HexDirection
): 'clockwise' | 'counter-clockwise' | 'direct' {
  const angleDiff = Math.abs(toDirection - fromDirection);

  // Direct transition (< 180°)
  if (angleDiff <= 3) {
    return 'direct';
  }

  // 180° turn - choose shortest path based on context
  // For now, use clockwise for simplicity (can be enhanced with context)
  return 'clockwise';
}

/**
 * Get intermediate directions for multi-step rotation
 */
function getIntermediateDirections(
  from: HexDirection,
  to: HexDirection,
  path: 'clockwise' | 'counter-clockwise'
): HexDirection[] {
  const directions: HexDirection[] = [];
  let current = from;

  while (current !== to) {
    if (path === 'clockwise') {
      current = (current + 1) % 6;
    } else {
      current = (current - 1 + 6) % 6;
    }
    directions.push(current);
  }

  return directions;
}
```

**MVP Decision**: For initial implementation, use **direct crossfade** for all transitions (including 180° turns). Multi-step rotation can be added post-MVP if needed for visual polish.

---

### FR-7: Rapid Direction Change Handling

**What**: Handle rapid direction changes during fast movement without visual artifacts.

**Scenarios**:
1. **Zigzag Movement**: Creature moves E → NE → E → NE (rapid changes)
2. **Combat Strafing**: Creature circles around target (continuous rotation)
3. **Network Jitter**: State updates arrive out-of-order

**Solution: Transition Queue**:
```typescript
interface TransitionQueue {
  pending: DirectionTransition[];
  current: DirectionTransition | null;
}

/**
 * Queue transition to prevent interruption artifacts
 */
function queueDirectionTransition(
  creature: DeploymentCreature,
  newDirection: HexDirection,
  priority: 'normal' | 'high' = 'normal'
): void {
  // High priority: cancel current and start immediately
  if (priority === 'high') {
    if (creature.transitionQueue.current) {
      cancelTransition(creature.transitionQueue.current);
    }
    creature.transitionQueue.pending = [];
    startDirectionTransition(creature, creature.hex, newDirection);
    return;
  }

  // Normal priority: queue if transition in progress
  if (creature.transitionQueue.current) {
    // Deduplicate: remove pending transition to same direction
    creature.transitionQueue.pending = creature.transitionQueue.pending.filter(
      t => t.toDirection !== newDirection
    );

    // Add to queue
    creature.transitionQueue.pending.push({
      toDirection: newDirection,
      duration: 150
    });
  } else {
    // No transition in progress, start immediately
    startDirectionTransition(creature, creature.hex, newDirection);
  }
}

/**
 * Process next queued transition
 */
function processNextTransition(creature: DeploymentCreature): void {
  if (creature.transitionQueue.pending.length === 0) {
    return;
  }

  const next = creature.transitionQueue.pending.shift()!;
  startDirectionTransition(creature, creature.hex, next.toDirection, next.duration);
}
```

**Rate Limiting**:
```typescript
/**
 * Debounce rapid facing updates (within 50ms window)
 */
function debounceFacingUpdate(
  creature: DeploymentCreature,
  newDirection: HexDirection,
  debounceMs: number = 50
): void {
  // Clear existing debounce timer
  if (creature.facingDebounceTimer) {
    clearTimeout(creature.facingDebounceTimer);
  }

  // Set new debounce timer
  creature.facingDebounceTimer = setTimeout(() => {
    queueDirectionTransition(creature, newDirection, 'normal');
    creature.facingDebounceTimer = null;
  }, debounceMs);
}
```

---

### FR-8: Combat Facing (Attacking)

**What**: When creature attacks, face toward target enemy regardless of movement direction.

**Behavior**:
1. **Attack Start**: Face toward target before attack animation
2. **Attack Duration**: Maintain facing during attack
3. **Attack End**: Resume movement-based facing if still moving

**Priority**: Attack facing overrides movement facing.

```typescript
/**
 * Handle attack event with facing update
 */
function handleAttackEvent(event: AttackEvent): void {
  const attacker = findCreatureByUnitId(event.attackerId);
  const target = findCreatureByUnitId(event.targetId);

  if (!attacker || !target) return;

  // Calculate facing toward target
  const facingDirection = calculateFacingDirection(
    attacker.position,
    target.position
  );

  // Update facing with high priority (interrupt movement transition)
  queueDirectionTransition(attacker, facingDirection, 'high');

  // Lock facing during attack animation
  attacker.facingLocked = true;

  // Unlock after attack completes
  setTimeout(() => {
    attacker.facingLocked = false;

    // Resume movement-based facing if still moving
    if (attacker.status === 'moving' && attacker.targetPosition) {
      const movementFacing = calculateFacingDirection(
        attacker.position,
        attacker.targetPosition
      );
      queueDirectionTransition(attacker, movementFacing, 'normal');
    }
  }, event.attackDuration);
}
```

---

## Technical Architecture

### Components

**Frontend Services** (`/frontend/src/services/`):

1. **Direction Calculator** (`direction/direction-calculator.ts`):
   - Calculate facing from movement vector
   - Angle-to-direction mapping
   - Exports: `calculateFacingDirection(from, to) → HexDirection`

2. **Direction Transition Manager** (`direction/direction-transition-manager.ts`):
   - Manage crossfade transitions
   - Queue and priority handling
   - Transition cancellation
   - Exports: `DirectionTransitionManager` class

3. **Directional Sprite Loader** (`direction/directional-sprite-loader.ts`):
   - Load directional sprites from `BattlefieldDirectionalViews`
   - Apply horizontal mirroring for W/NW/SW
   - Cache loaded sprites
   - Exports: `DirectionalSpriteLoader` class

**Integration Points**:

1. **Deployment Grid Renderer** (`/frontend/src/components/DeploymentGrid/DeploymentGridRenderer.ts`):
   - Already supports `direction` parameter in `renderCreature()` and `renderDragPreview()`
   - Needs integration with `DirectionTransitionManager` for smooth transitions

2. **Deployment Socket Sync** (`/frontend/src/hooks/useDeploymentSocketSync.ts`):
   - Add facing updates to placement events
   - Broadcast facing changes to other players

3. **Combat Animation Controller** (`/frontend/src/services/animation/animation-controller.ts`):
   - Integrate facing updates with combat state updates
   - Coordinate facing with animation state machine

---

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ 1. MOVEMENT INPUT (Drag-and-Drop or Server State)          │
│    - Source hex, destination hex, or target position       │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. DIRECTION CALCULATOR                                     │
│    - Convert hex coordinates to pixel space                 │
│    - Calculate movement vector (dx, dy)                     │
│    - Calculate angle: atan2(dy, dx)                         │
│    - Map angle to HexDirection (0-5)                        │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. TRANSITION PRIORITY CHECK                                │
│    - Check if transition already in progress                │
│    - Determine priority (attack > movement > idle)          │
│    - Queue or execute immediately                           │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. DIRECTIONAL SPRITE LOADER                                │
│    - Load sprite for new direction from BattlefieldViews    │
│    - Apply mirroring if W/NW/SW direction                   │
│    - Create PIXI.Sprite with texture                        │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. TRANSITION MANAGER                                       │
│    - Start crossfade animation (150ms)                      │
│    - Alpha blend: old sprite 1.0→0.0, new sprite 0.0→1.0   │
│    - Use RAF for smooth 30-60 FPS animation                 │
│    - Apply ease-in-out curve                                │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. TRANSITION COMPLETION                                    │
│    - Remove old sprite from scene                           │
│    - Destroy old sprite resources                           │
│    - Update creature.facing property                        │
│    - Process next queued transition (if any)                │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. STATE SYNCHRONIZATION                                    │
│    - Emit facing update to server (deployment phase)        │
│    - Update local creature state                            │
│    - Broadcast to other players via WebSocket               │
└─────────────────────────────────────────────────────────────┘
```

---

## Dependencies

### Depends On

- **Multi-Directional Sprite Generation** (L3 - AI Generation Pipeline): Provides 6-directional `BattlefieldDirectionalViews`
- **Hex Grid Deployment System** (L3 - Battle Engine): Provides hex coordinate system and rendering
- **Deployment Grid Renderer** (L3 - Battle Engine): Provides `renderCreature()` with direction support

### Depended On By

- **Combat Animation Controller** (L3 - this epic): Uses facing system for combat animations
- **AI Tactical Behavior** (L2 - post-MVP): AI units need facing updates for realistic behavior
- **Replay System** (L2 - post-MVP): Replay needs to restore facing state

---

## Edge Cases & Special Handling

### Edge Case 1: No Movement (Idle Rotation)

**Scenario**: Creature rotates to face enemy without moving position.

**Handling**:
```typescript
function rotateFacingInPlace(
  creature: DeploymentCreature,
  targetDirection: HexDirection
): void {
  // Same as movement-based rotation
  queueDirectionTransition(creature, targetDirection, 'normal');
}
```

### Edge Case 2: Diagonal Movement on Hex Grid

**Scenario**: Moving from (0, 0) to (2, 2) - diagonal path.

**Handling**: Direction calculator naturally handles diagonals via angle calculation. No special handling needed.

### Edge Case 3: Sprite Not Loaded

**Scenario**: Directional sprite data missing or failed to load.

**Handling**:
```typescript
function loadDirectionalSprite(
  creature: DeploymentCreature,
  direction: HexDirection
): { spriteUrl: string; shouldMirror: boolean } {
  const dirViews = creature.battlefieldDirectionalViews;

  if (!dirViews) {
    // Fallback to legacy sprite (no rotation)
    console.warn(`No directional views for ${creature.name}, using static sprite`);
    return {
      spriteUrl: creature.sprite,
      shouldMirror: false
    };
  }

  // Proceed with directional loading...
}
```

### Edge Case 4: Transition Interruption

**Scenario**: New facing change occurs mid-transition.

**Handling**: Cancel current transition, start new one immediately (handled by `queueDirectionTransition`).

### Edge Case 5: Simultaneous Movement and Attack

**Scenario**: Creature receives move and attack commands simultaneously.

**Handling**: Attack facing takes priority (high priority queue), movement facing resumes after attack.

### Edge Case 6: Networked Multiplayer Desyncs

**Scenario**: Player A sees creature facing E, Player B sees facing W (different latency).

**Handling**: Server broadcasts authoritative facing updates periodically (every 500ms) to resync clients.

```typescript
interface FacingSyncEvent {
  unitId: string;
  facing: HexDirection;
  timestamp: number;
}

function handleFacingSync(event: FacingSyncEvent): void {
  const creature = findCreatureByUnitId(event.unitId);
  if (!creature) return;

  // Only update if timestamp is newer than last update
  if (event.timestamp > creature.lastFacingUpdate) {
    queueDirectionTransition(creature, event.facing, 'high');
    creature.lastFacingUpdate = event.timestamp;
  }
}
```

### Edge Case 7: Death During Transition

**Scenario**: Creature dies while facing transition is in progress.

**Handling**:
```typescript
function handleDeath(creature: DeploymentCreature): void {
  // Cancel all transitions
  if (creature.activeTransition) {
    cancelTransition(creature.activeTransition);
  }
  creature.transitionQueue.pending = [];

  // Proceed with death animation (maintains current facing)
  playDeathAnimation(creature);
}
```

---

## Success Criteria

### MVP Definition of Done

**Functional**:
- [ ] Direction calculator correctly maps all 360° angles to 6 hex directions
- [ ] Crossfade transitions complete smoothly in 150ms without visual artifacts
- [ ] Directional sprites load correctly with automatic mirroring for W/NW/SW
- [ ] Deployment phase: Creatures update facing during drag-and-drop placement
- [ ] Deployment phase: Facing persists after placement and syncs across players
- [ ] Combat phase: Creatures update facing when moving between hexes
- [ ] Combat phase: Creatures face targets when attacking
- [ ] 180° turns use direct crossfade (no intermediate steps)
- [ ] Rapid direction changes queue properly without artifacts
- [ ] Facing locked during attack animations, resumes after completion
- [ ] Transitions maintain 30+ FPS on target hardware
- [ ] Memory usage remains constant (no sprite leak from transitions)

**Non-Functional**:
- [ ] Direction calculation completes in <1ms per creature
- [ ] Crossfade animation runs at 60 FPS with 16ms frame budget
- [ ] Sprite loading uses cache to prevent redundant texture loads
- [ ] Transition queue handles up to 10 pending transitions per creature
- [ ] System supports 16 simultaneous creatures with active transitions

**Testing**:
- [ ] Unit test: Direction calculator with all 6 direction mappings
- [ ] Unit test: Angle-to-direction edge cases (0°, 30°, 60°, etc.)
- [ ] Unit test: Mirroring logic for W/NW/SW directions
- [ ] Unit test: Transition queue priority and deduplication
- [ ] Integration test: Full facing lifecycle (calculate → load → transition → complete)
- [ ] Integration test: Combat facing override during attack
- [ ] E2E test: Deployment drag-and-drop with facing preview
- [ ] E2E test: Combat movement with continuous facing updates

---

## L4 Task Breakdown

### Core Direction Calculation (2 tasks)

**TASK-1.1**: Create `DirectionCalculator` service
- Implement `calculateFacingDirection(from, to)` function
- Hex-to-pixel conversion integration with `HexGrid`
- Angle calculation using `Math.atan2()`
- Angle-to-direction mapping (6 directions, 60° sectors)
- Export pure function for use in deployment and combat
- **Estimate**: 3 hours

**TASK-1.2**: Write unit tests for direction calculation
- Test all 6 directions (E, NE, SE, W, NW, SW)
- Test edge cases: 0°, 30°, 60°, 90°, etc.
- Test diagonal movements on hex grid
- Test no-movement scenario (from === to)
- Verify correct direction for common movement patterns
- **Estimate**: 2 hours

### Sprite Loading & Mirroring (2 tasks)

**TASK-2.1**: Create `DirectionalSpriteLoader` service
- Implement `loadDirectionalSprite(creature, direction)`
- Extract sprite URL from `BattlefieldDirectionalViews`
- Map W/NW/SW to mirrored E/NE/SE sprites
- Texture caching to prevent redundant loads
- Fallback to legacy sprite if directional views missing
- Export loader class with cache management
- **Estimate**: 4 hours

**TASK-2.2**: Write unit tests for sprite loading
- Test loading all 6 directions
- Test mirroring flags (W, NW, SW should mirror)
- Test cache hit/miss behavior
- Test fallback when directional views missing
- Mock PIXI.Assets.load for isolated testing
- **Estimate**: 2 hours

### Transition Manager (3 tasks)

**TASK-3.1**: Create `DirectionTransitionManager` class
- Implement `startDirectionTransition(creature, hex, newDirection, duration)`
- Create transition state structure (old/new sprites, timing)
- RAF-based animation loop with alpha blending
- Ease-in-out curve implementation
- Transition completion and cleanup
- Export manager class with lifecycle methods
- **Estimate**: 5 hours

**TASK-3.2**: Implement transition queue and priority system
- Queue structure for pending transitions
- Priority levels (high for attack, normal for movement)
- Deduplication logic (remove duplicate pending directions)
- Transition cancellation and interruption
- Process next transition on completion
- **Estimate**: 4 hours

**TASK-3.3**: Write unit tests for transition manager
- Test single transition lifecycle
- Test transition interruption (mid-transition direction change)
- Test queue priority (high vs normal)
- Test deduplication (remove duplicate pending)
- Mock RAF for deterministic testing
- **Estimate**: 3 hours

### Deployment Integration (2 tasks)

**TASK-4.1**: Integrate facing into deployment drag-and-drop
- Update `handleDragOver()` to calculate facing
- Render drag preview with calculated direction
- Update `handleDrop()` to persist facing in placement
- Emit facing in placement Socket.IO events
- Update `DeploymentCreature` state with facing
- **Estimate**: 3 hours

**TASK-4.2**: Add facing synchronization to deployment socket
- Extend `PlacementEvent` type with `facing` field
- Broadcast facing updates to other players
- Receive and apply facing updates from server
- Handle repositioning with facing updates
- **Estimate**: 2 hours

### Combat Integration (2 tasks)

**TASK-5.1**: Integrate facing into combat state updates
- Update `handleCombatStateUpdate()` to calculate facing
- Trigger facing transitions on position changes
- Face toward target on attack events
- Lock facing during attack animations
- Resume movement-based facing after attack
- **Estimate**: 4 hours

**TASK-5.2**: Add facing debouncing for rapid updates
- Implement `debounceFacingUpdate()` with 50ms window
- Prevent transition spam during zigzag movement
- Maintain responsiveness for important changes (attacks)
- **Estimate**: 2 hours

### Renderer Integration (2 tasks)

**TASK-6.1**: Update `DeploymentGridRenderer` for smooth transitions
- Integrate with `DirectionTransitionManager`
- Update `renderCreature()` to support transition state
- Handle sprite replacement during crossfade
- Cleanup old sprites after transition completes
- **Estimate**: 3 hours

**TASK-6.2**: Add facing indicator overlay (optional, post-MVP)
- Render small directional arrow on creature sprite
- Show facing direction visually when hovering
- Toggle with debug mode (keyboard shortcut)
- **Estimate**: 2 hours

### Testing & Polish (2 tasks)

**TASK-7.1**: Write integration tests for full facing system
- Test deployment drag-and-drop with facing
- Test combat movement with facing updates
- Test attack facing override
- Test transition lifecycle with real PixiJS renderer
- **Estimate**: 4 hours

**TASK-7.2**: Performance profiling and optimization
- Profile direction calculation performance (target <1ms)
- Profile transition animation performance (target 60 FPS)
- Profile memory usage (detect sprite leaks)
- Optimize cache efficiency
- Add performance metrics logging
- **Estimate**: 3 hours

---

**Total Estimated Effort**: 46 hours (~1.5 weeks for 1 developer)

---

## Metadata

- **Estimated Effort**: 1.5 weeks
- **Team Size**: 1 frontend developer
- **Priority**: HIGH (enhances visual feedback and player experience)
- **Complexity**: MEDIUM (coordinate math, animation transitions, state management)
- **Risks**:
  - LOW: Direction calculation is straightforward trigonometry
  - MEDIUM: Transition queue complexity if many rapid updates
  - LOW: Sprite loading already implemented in renderer
- **Blockers**:
  - Requires multi-directional sprites from AI generation pipeline (COMPLETE)
  - Requires deployment grid renderer with direction support (COMPLETE)

---

*This document defines the dynamic creature facing system for movement-based sprite rotation. Ready for L4 task implementation.*
