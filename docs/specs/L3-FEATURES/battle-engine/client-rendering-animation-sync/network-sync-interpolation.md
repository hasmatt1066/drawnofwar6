# L3 Feature Specification: Network Sync & Interpolation

**Feature ID**: `L3-NETWORK-SYNC-INTERPOLATION`
**Parent Epic**: Client Rendering & Animation Sync (L2)
**Status**: SPECIFICATION COMPLETE
**Version**: 1.0
**Last Updated**: 2025-10-05

---

## Overview

Implement a robust network synchronization and interpolation system that transforms the authoritative server's 60 updates/sec state stream into smooth 60 FPS client-side rendering despite 100-150ms network latency. The system uses a 100ms adaptive client-side buffer for interpolation, delta compression to minimize bandwidth, velocity-based dead reckoning for prediction, and AI intent heuristics to anticipate unit actions. When client predictions diverge from server authority by more than 1 hex distance, the system applies a visual "shimmer" effect to indicate correction.

**User Value**: Combat feels smooth and responsive despite network latency. Players never see units teleport or animations desync. The game predicts intelligently what units will do next, making combat feel fast even with 150ms ping.

**Technical Value**: Decouples rendering framerate from network update rate, gracefully handles variable latency, minimizes bandwidth with delta compression, and provides extensible prediction system for future AI improvements.

---

## Functional Requirements

### FR-1: Server State Update Reception
**Description**: Receive 60 updates/sec from server via WebSocket with delta compression.

**Behavior**:
- **Update Rate**: Server sends 60 state updates/sec (one every ~16.67ms)
- **Delta Compression**: Server only sends changed fields, not full state
  - Example: If 2 units moved, only send those 2 unit positions, not all 16
  - Reduces payload from ~5KB (full state) to ~200 bytes (typical delta)
- **Snapshot Reconciliation**: Every 10th update (every ~167ms), server sends full state snapshot to prevent drift
- **WebSocket Protocol**: JSON messages over WebSocket (could upgrade to binary MessagePack for post-MVP)
- **Message Structure**:
  ```typescript
  interface StateUpdateMessage {
    type: 'state_delta' | 'state_snapshot';
    tick: number; // Server tick number
    serverTimestamp: number; // Server time in milliseconds
    unitUpdates?: UnitDelta[]; // Only changed units
    projectileUpdates?: ProjectileDelta[];
    events?: CombatEvent[]; // Damage, deaths, abilities
    fullState?: CompleteGameState; // Only present for snapshots
  }

  interface UnitDelta {
    unitId: string;
    position?: HexCoordinate; // Only if moved
    health?: number; // Only if changed
    status?: UnitStatus; // Only if changed
    animationChange?: {
      name: string;
      startTimestamp: number; // Server timestamp for sync
    };
  }
  ```

**Edge Cases**:
- If WebSocket disconnects mid-combat, buffer last known state and attempt reconnection
- If update arrives out-of-order (tick N+1 before tick N), discard older update
- If no update received for 1 second, request full state snapshot from server
- If delta update references unknown unitId, request full state snapshot

**Acceptance Criteria**:
- WebSocket receives 60 updates/sec from server
- Delta compression reduces payload to <500 bytes average
- Full state snapshot received every 10th update
- Out-of-order updates discarded
- Missing updates trigger snapshot request after 1 second

---

### FR-2: Client-Side Buffering (100ms Adaptive)
**Description**: Buffer state updates for 100ms before rendering to smooth interpolation.

**Behavior**:
- **Buffer Duration**: 100ms (adjustable based on network conditions)
- **Buffer Implementation**: Ring buffer holding last 10 state updates (~167ms of data)
- **Render Delay**: Client renders state that is 100ms old (not real-time)
- **Adaptive Adjustment**: If jitter detected (variable latency), increase buffer to 150ms
- **Jitter Detection**: If update intervals vary by >20ms, flag as jittery network
- **Visual Trade-off**: 100ms delay is imperceptible, but provides smooth interpolation window

**Buffer Logic**:
```typescript
class StateUpdateBuffer {
  private buffer: StateUpdate[] = []; // Ring buffer, max 10 entries
  private readonly BUFFER_DURATION_MS = 100;
  private adaptiveBufferDuration = 100; // Can adjust based on jitter

  addUpdate(update: StateUpdate): void {
    update.receivedAt = Date.now();
    this.buffer.push(update);

    // Remove updates older than buffer duration
    const cutoffTime = Date.now() - this.adaptiveBufferDuration;
    this.buffer = this.buffer.filter(u => u.receivedAt >= cutoffTime);

    // Detect jitter (variable latency)
    if (this.detectJitter()) {
      this.adaptiveBufferDuration = 150; // Increase buffer
    }
  }

  getBufferedUpdate(): StateUpdate | null {
    // Return update that is ~100ms old
    const targetTime = Date.now() - this.adaptiveBufferDuration;
    return this.buffer.find(u => Math.abs(u.receivedAt - targetTime) < 20);
  }

  detectJitter(): boolean {
    if (this.buffer.length < 5) return false;

    const intervals = [];
    for (let i = 1; i < this.buffer.length; i++) {
      intervals.push(this.buffer[i].receivedAt - this.buffer[i - 1].receivedAt);
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.some(i => Math.abs(i - avgInterval) > 20);

    return variance;
  }
}
```

**Edge Cases**:
- If buffer empty (no recent updates), use last known state and continue prediction
- If buffer overfills (slow client, fast server), drop oldest updates to maintain 100ms window
- If network stabilizes after jitter, gradually reduce buffer back to 100ms

**Acceptance Criteria**:
- Client buffers state updates for 100ms
- Adaptive buffer adjusts to 150ms on jitter detection
- Render uses buffered update (100ms old, not real-time)
- Buffer maintains 10-entry ring buffer
- Jitter detection triggers buffer adjustment

---

### FR-3: Position Interpolation (Smooth Movement)
**Description**: Interpolate unit positions between buffered server states for smooth movement.

**Behavior**:
- **Interpolation Method**: Linear interpolation (lerp) between previous and current server positions
- **Interpolation Window**: 100ms (time between buffered updates)
- **Smoothing**: Exponential smoothing to prevent sudden changes
- **Formula**:
  ```typescript
  // Exponential smoothing (alpha = smoothing factor)
  const alpha = 1 - Math.exp(-deltaTime / interpolationWindow);
  renderPosition.x += (targetPosition.x - renderPosition.x) * alpha;
  renderPosition.y += (targetPosition.y - renderPosition.y) * alpha;
  ```
- **Pixel Coordinates**: Interpolate in pixel space, not hex space (smooth diagonal movement)
- **Movement Threshold**: If server position changes by <2px, skip interpolation (unit is stationary)

**Edge Cases**:
- If unit teleports (position changes by >2 hexes), disable interpolation and snap to new position
- If unit dies during interpolation, complete interpolation to death position before despawning
- If server sends position update for unit not yet spawned client-side, spawn immediately at position

**Acceptance Criteria**:
- Unit positions interpolate smoothly between server states
- Exponential smoothing prevents jarring changes
- Teleports (>2 hexes) snap immediately
- Movement threshold (<2px) skips interpolation
- Interpolation runs at 60 FPS

---

### FR-4: Dead Reckoning Prediction (Velocity-Based)
**Description**: Predict unit positions between server updates using velocity extrapolation.

**Behavior**:
- **Velocity Calculation**: Derive velocity from last 2 server position updates
  ```typescript
  const velocity = {
    x: (currentPos.x - previousPos.x) / deltaTime,
    y: (currentPos.y - previousPos.y) / deltaTime
  };
  ```
- **Extrapolation**: If no server update received for >50ms, extrapolate position using velocity
  ```typescript
  predictedPosition.x = currentPosition.x + velocity.x * timeSinceLastUpdate;
  predictedPosition.y = currentPosition.y + velocity.y * timeSinceLastUpdate;
  ```
- **Max Extrapolation Duration**: Limit prediction to 200ms (don't predict too far ahead)
- **Decay**: Reduce velocity by 10% per 100ms (assume unit will slow/stop)
- **Reconciliation**: When server update arrives, smoothly correct prediction error

**Edge Cases**:
- If unit velocity is 0 (stationary), skip prediction
- If server update contradicts prediction by >1 hex, trigger shimmer effect (see FR-6)
- If unit collides with obstacle during prediction, clamp to valid position

**Acceptance Criteria**:
- Velocity calculated from last 2 server positions
- Extrapolation predicts position for up to 200ms
- Velocity decays by 10% per 100ms
- Prediction stops if velocity is 0
- Server reconciliation corrects prediction errors

---

### FR-5: AI Intent Prediction (Heuristic-Based)
**Description**: Predict unit actions (attacks, abilities, movement targets) using AI heuristics.

**Behavior**:
- **Movement Prediction**: If unit moving toward enemy, predict continued movement along path
  - Calculate shortest path to nearest enemy
  - Assume unit will continue along path for next 100-200ms
- **Attack Prediction**: If unit in attack range of enemy, predict attack animation start
  - Check if attack cooldown ready (estimated based on last attack time)
  - Assume unit will attack if cooldown ready and target in range
- **Ability Prediction**: If unit has ability off cooldown, predict ability use
  - Simple heuristic: AOE abilities used when 2+ enemies in range
  - Single-target abilities used when high-value enemy in range
- **Confidence Score**: Each prediction has confidence 0.0-1.0
  - High confidence (0.8+): Show prediction visually (e.g., faint attack animation)
  - Low confidence (<0.5): Don't show, just use for internal state
- **Prediction Window**: Only predict 100ms ahead (don't overcommit)

**Heuristics**:
```typescript
class AIIntentPredictor {
  predictNextAction(unit: ClientUnit, gameState: ClientGameState): Prediction {
    // Movement prediction: Continue toward nearest enemy
    if (unit.velocity.length > 0) {
      const nearestEnemy = this.findNearestEnemy(unit, gameState);
      const pathToEnemy = this.calculatePath(unit.position, nearestEnemy.position);
      const nextHex = pathToEnemy[1]; // Next step on path

      return {
        type: 'move',
        target: nextHex,
        confidence: 0.7
      };
    }

    // Attack prediction: If target in range and cooldown ready
    const attackTarget = this.findAttackTarget(unit, gameState);
    if (attackTarget && unit.attackCooldownRemaining === 0) {
      return {
        type: 'attack',
        target: attackTarget.unitId,
        confidence: 0.6
      };
    }

    // Ability prediction: If AOE ability ready and 2+ enemies in range
    const aoeAbility = unit.abilities.find(a => a.type === 'aoe' && a.cooldownRemaining === 0);
    if (aoeAbility) {
      const enemiesInRange = this.findEnemiesInRange(unit, aoeAbility.range, gameState);
      if (enemiesInRange.length >= 2) {
        return {
          type: 'ability',
          abilityId: aoeAbility.id,
          confidence: 0.5
        };
      }
    }

    // Default: Idle (no prediction)
    return { type: 'idle', confidence: 1.0 };
  }
}
```

**Edge Cases**:
- If server update contradicts prediction (unit didn't attack when predicted), cancel prediction
- If multiple predictions possible, choose highest confidence
- If confidence < 0.5, don't show prediction visually (only use for internal state)

**Acceptance Criteria**:
- Movement prediction continues path toward nearest enemy
- Attack prediction triggers when cooldown ready + target in range
- Ability prediction triggers for AOE when 2+ enemies in range
- Confidence score calculated for each prediction
- High-confidence predictions (0.8+) shown visually
- Low-confidence predictions (<0.5) hidden

---

### FR-6: Server Reconciliation with Shimmer Effect
**Description**: When server state contradicts client prediction, correct smoothly with visual shimmer.

**Behavior**:
- **Error Threshold**: If prediction error > 1 hex distance, trigger reconciliation
- **Shimmer Effect**: Brief visual effect to indicate correction
  - Sprite flashes with white outline (2px glow)
  - Duration: 200ms
  - Opacity: 50% → 0% fade
- **Correction Method**: Smoothly interpolate to server position over 100ms (not instant snap)
- **Large Errors**: If error > 3 hexes, disable shimmer and snap immediately (teleport)
- **Frequency Limit**: Max 1 shimmer per unit per 2 seconds (avoid spamming)

**Reconciliation Logic**:
```typescript
function reconcilePosition(unit: ClientUnit, serverPosition: HexCoordinate) {
  const error = calculateDistance(unit.renderPosition, serverPosition);

  if (error > 3) {
    // Large error: Snap immediately (teleport)
    unit.renderPosition = hexToPixel(serverPosition);
  } else if (error > 1) {
    // Medium error: Smooth correction with shimmer
    unit.targetPosition = hexToPixel(serverPosition);
    unit.reconciliationStartTime = Date.now();
    unit.reconciliationDuration = 100; // ms

    // Trigger shimmer effect
    if (Date.now() - unit.lastShimmerTime > 2000) {
      applyShimmerEffect(unit);
      unit.lastShimmerTime = Date.now();
    }
  } else {
    // Small error: Normal interpolation handles it
    unit.targetPosition = hexToPixel(serverPosition);
  }
}

function applyShimmerEffect(unit: ClientUnit) {
  const shimmer = new PIXI.Graphics();
  shimmer.lineStyle(2, 0xFFFFFF, 0.5);
  shimmer.drawCircle(0, 0, 32); // 32px radius outline
  shimmer.position.set(unit.sprite.x, unit.sprite.y);

  unit.sprite.parent.addChild(shimmer);

  // Fade out over 200ms
  const startTime = Date.now();
  const fadeInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const progress = elapsed / 200;
    shimmer.alpha = 0.5 * (1 - progress);

    if (progress >= 1.0) {
      unit.sprite.parent.removeChild(shimmer);
      clearInterval(fadeInterval);
    }
  }, 16); // ~60 FPS
}
```

**Edge Cases**:
- If server sends multiple corrections rapidly (unstable network), ignore corrections after first until shimmer completes
- If unit dies during reconciliation, cancel shimmer and play death animation
- If shimmer already active when new correction arrives, restart shimmer timer

**Acceptance Criteria**:
- Prediction errors > 1 hex trigger reconciliation
- Shimmer effect (white outline, 200ms fade) indicates correction
- Smooth interpolation over 100ms for medium errors (1-3 hexes)
- Instant snap for large errors (>3 hexes)
- Max 1 shimmer per unit per 2 seconds

---

### FR-7: Timestamp-Based Animation Sync
**Description**: Synchronize animation playback with server using timestamps (±100ms tolerance).

**Behavior**:
- **Server Sends Timestamps**: When animation starts server-side, server sends animation start timestamp
  ```typescript
  {
    unitId: 'unit-123',
    animationChange: {
      name: 'attack',
      startTimestamp: 1696512345678 // Server time in ms
    }
  }
  ```
- **Client Syncs to Timestamp**: Client calculates elapsed time since animation start
  ```typescript
  const serverTime = animationChange.startTimestamp;
  const clientTime = Date.now();
  const timeDelta = clientTime - serverTime;

  // Calculate which frame to start on
  const fps = animation.fps; // e.g., 15 FPS
  const elapsedFrames = (timeDelta / 1000) * fps;
  const startFrame = Math.floor(elapsedFrames) % animation.frameCount;
  ```
- **Tolerance**: If time delta within ±100ms, sync to server timeline
- **Resync**: If time delta > 100ms (desync), hard reset to server timeline
- **Frame Events**: Projectile spawns, impacts trigger at specific frames (e.g., frame 8 of 12)
  - Client checks current frame each render tick, triggers events when frame reached

**Edge Cases**:
- If client clock ahead of server (negative time delta), start animation at frame 0 and wait
- If animation already playing when server sends timestamp, resync to correct frame
- If animation completes before server sends end event, loop idle animation until server confirms

**Acceptance Criteria**:
- Server sends animation start timestamps
- Client calculates elapsed time and start frame
- Animations sync within ±100ms tolerance
- Desync > 100ms triggers hard reset
- Frame events trigger at correct frames (e.g., projectile spawn at frame 8)

---

## Technical Architecture

### Components

**StateUpdateProcessor** (`frontend/src/services/battle/StateUpdateProcessor.ts`)
- Receive WebSocket state updates
- Parse delta compression (only changed fields)
- Buffer updates for 100ms
- Dispatch to interpolation/prediction systems

**StateUpdateBuffer** (`frontend/src/services/battle/StateUpdateBuffer.ts`)
- Ring buffer for last 10 state updates (~167ms)
- Adaptive buffer duration (100-150ms based on jitter)
- Jitter detection (variable latency)
- Retrieve buffered update for rendering

**PositionInterpolator** (`frontend/src/services/battle/PositionInterpolator.ts`)
- Interpolate unit positions (exponential smoothing)
- Detect teleports (>2 hexes)
- Handle movement threshold (<2px)

**DeadReckoningPredictor** (`frontend/src/services/battle/DeadReckoningPredictor.ts`)
- Calculate velocity from last 2 positions
- Extrapolate position for up to 200ms
- Velocity decay (10% per 100ms)

**AIIntentPredictor** (`frontend/src/services/battle/AIIntentPredictor.ts`)
- Predict movement toward nearest enemy
- Predict attacks when cooldown ready
- Predict ability use (AOE when 2+ enemies in range)
- Confidence scoring (0.0-1.0)

**ServerReconciliation** (`frontend/src/services/battle/ServerReconciliation.ts`)
- Compare client prediction vs server state
- Calculate prediction error
- Trigger shimmer effect if error > 1 hex
- Smooth correction over 100ms

**AnimationSyncManager** (`frontend/src/services/battle/AnimationSyncManager.ts`)
- Sync animation playback to server timestamps
- Calculate start frame from elapsed time
- Trigger frame events (projectile spawns)
- Resync if desync > 100ms

---

### Data Flow

```
Server (60 updates/sec)
  ↓
WebSocket (delta compressed)
  ↓
StateUpdateProcessor
  ↓
StateUpdateBuffer (100ms buffer, adaptive)
  ↓
┌────────────────────┬──────────────────────┐
│                    │                      │
PositionInterpolator  DeadReckoningPredictor  AIIntentPredictor
│                    │                      │
└────────────────────┴──────────────────────┘
  ↓
ServerReconciliation (compare prediction vs server)
  ↓
┌─────────────────┐
│ Error > 1 hex?  │
└────┬────────────┘
     ├─ Yes → Shimmer Effect + Smooth Correction (100ms)
     └─ No  → Normal Interpolation
  ↓
PixiJS Renderer (60 FPS)
```

---

### State Data Structures

**Client Game State**
```typescript
interface ClientGameState {
  tick: number; // Server tick (authoritative)
  clientTick: number; // Client render tick (60 FPS)
  serverTimestamp: number; // Last server timestamp
  units: Map<string, ClientUnit>;
  projectiles: Map<string, ClientProjectile>;
  events: CombatEvent[];
}

interface ClientUnit {
  unitId: string;

  // Server state (authoritative)
  serverPosition: HexCoordinate;
  serverHealth: number;
  serverStatus: 'alive' | 'dead';

  // Client rendering state (interpolated/predicted)
  renderPosition: { x: number, y: number }; // Pixel coords
  targetPosition: { x: number, y: number }; // Interpolation target
  velocity: { x: number, y: number }; // For dead reckoning
  predictedPosition?: { x: number, y: number }; // AI intent prediction
  predictionConfidence: number; // 0.0-1.0

  // Reconciliation state
  reconciliationStartTime: number; // Timestamp
  reconciliationDuration: number; // ms
  lastShimmerTime: number; // Timestamp

  // Animation state
  currentAnimation: AnimationState;
  animationStartTimestamp: number; // Server timestamp
}

interface Prediction {
  type: 'move' | 'attack' | 'ability' | 'idle';
  target?: HexCoordinate | string; // Hex or unitId
  abilityId?: string;
  confidence: number; // 0.0-1.0
}
```

**State Update Message**
```typescript
interface StateUpdateMessage {
  type: 'state_delta' | 'state_snapshot';
  tick: number;
  serverTimestamp: number;
  unitUpdates?: UnitDelta[];
  projectileUpdates?: ProjectileDelta[];
  events?: CombatEvent[];
  fullState?: CompleteGameState;
}

interface UnitDelta {
  unitId: string;
  position?: HexCoordinate;
  health?: number;
  status?: UnitStatus;
  animationChange?: {
    name: string;
    startTimestamp: number;
  };
}
```

---

## Dependencies

### Depends On
- **Authoritative Server Simulation** (L2): Provides 60 updates/sec state stream
- **WebSocket Infrastructure**: Reliable WebSocket connection for state updates
- **PixiJS Battlefield Renderer** (L3): Renders interpolated positions
- **Animation State Machine** (L3): Plays animations synced to server timestamps

### Depended On By
- **All Client Rendering Features** (L3): All rendering depends on smooth state sync
- **Combat UI Feedback** (L3): Damage numbers, health bars depend on accurate state
- **Camera Control System** (L3): Camera follows interpolated positions

---

## Success Criteria

### MVP Definition of Done
- [ ] WebSocket receives 60 state updates/sec from server
- [ ] Delta compression reduces payload to <500 bytes average
- [ ] Full state snapshot received every 10th update (every ~167ms)
- [ ] Client buffers state for 100ms (adaptive to 150ms on jitter)
- [ ] Jitter detection adjusts buffer duration
- [ ] Position interpolation smooths movement (exponential smoothing)
- [ ] Teleports (>2 hexes) snap immediately (no interpolation)
- [ ] Dead reckoning predicts position for up to 200ms
- [ ] Velocity decays by 10% per 100ms
- [ ] AI intent prediction estimates movement, attacks, abilities
- [ ] Prediction confidence score calculated (0.0-1.0)
- [ ] Server reconciliation detects errors > 1 hex
- [ ] Shimmer effect (white outline, 200ms) indicates corrections
- [ ] Smooth correction over 100ms for medium errors (1-3 hexes)
- [ ] Instant snap for large errors (>3 hexes)
- [ ] Max 1 shimmer per unit per 2 seconds
- [ ] Animation sync uses server timestamps (±100ms tolerance)
- [ ] Frame events trigger at correct frames (projectile spawn at frame 8)
- [ ] 60 FPS maintained with full interpolation/prediction system
- [ ] No visible teleportation or animation desync

### Exceptional Targets (Post-MVP)
- [ ] Binary MessagePack protocol for 50% bandwidth reduction
- [ ] Client-side extrapolation for 500ms (extend prediction window)
- [ ] Machine learning prediction (replace heuristics with trained model)
- [ ] Adaptive interpolation window (50-200ms based on latency)
- [ ] Rollback netcode (client simulates, server corrects, client replays)
- [ ] Visual prediction indicator (faint ghost showing predicted position)

---

## L4 Task Candidates

### Phase 1: State Update Reception (4 tasks)
- **L4-SYNC-001**: Implement WebSocket state update listener
  - Subscribe to state_delta and state_snapshot messages
  - Parse JSON messages
  - Validate message structure
  - Handle out-of-order updates (discard older)

- **L4-SYNC-002**: Implement delta compression parsing
  - Apply delta updates to current state (only changed fields)
  - Merge unit/projectile updates
  - Dispatch combat events

- **L4-SYNC-003**: Implement full state snapshot reconciliation
  - Every 10th update, replace entire state with snapshot
  - Prevent drift from accumulated deltas
  - Validate snapshot integrity

- **L4-SYNC-004**: Implement reconnection and missing update handling
  - Detect WebSocket disconnect
  - Request full snapshot after 1 second of no updates
  - Buffer state during reconnection

### Phase 2: Client-Side Buffering (3 tasks)
- **L4-SYNC-005**: Implement `StateUpdateBuffer` ring buffer
  - Store last 10 state updates (~167ms)
  - Add/remove updates based on timestamp
  - Retrieve buffered update (100ms old)

- **L4-SYNC-006**: Implement jitter detection
  - Calculate update interval variance
  - Flag jittery network (>20ms variance)
  - Adaptive buffer duration (100-150ms)

- **L4-SYNC-007**: Implement adaptive buffer adjustment
  - Increase buffer to 150ms on jitter
  - Gradually reduce buffer when network stabilizes
  - Test with simulated jitter

### Phase 3: Position Interpolation (3 tasks)
- **L4-SYNC-008**: Implement `PositionInterpolator` with exponential smoothing
  - Lerp between previous and target positions
  - Exponential smoothing (alpha calculation)
  - Update render position each frame

- **L4-SYNC-009**: Implement teleport detection and snap
  - Calculate position delta (in hexes)
  - If delta > 2 hexes, snap immediately (no interpolation)
  - If delta < 2px, skip interpolation (unit stationary)

- **L4-SYNC-010**: Integrate interpolation with PixiJS renderer
  - Update sprite positions from renderPosition
  - Test smooth movement across 5-10 hexes
  - Measure FPS (must be 60+)

### Phase 4: Dead Reckoning Prediction (3 tasks)
- **L4-SYNC-011**: Implement `DeadReckoningPredictor` velocity calculation
  - Derive velocity from last 2 server positions
  - Store velocity vector per unit
  - Update on each state update

- **L4-SYNC-012**: Implement position extrapolation
  - Extrapolate position using velocity
  - Limit extrapolation to 200ms max
  - Velocity decay (10% per 100ms)

- **L4-SYNC-013**: Implement prediction reconciliation
  - When server update arrives, compare predicted vs actual
  - Calculate prediction error
  - Pass to ServerReconciliation for correction

### Phase 5: AI Intent Prediction (4 tasks)
- **L4-SYNC-014**: Implement `AIIntentPredictor` movement prediction
  - Calculate path to nearest enemy
  - Predict next hex on path
  - Confidence score based on path clarity

- **L4-SYNC-015**: Implement attack prediction
  - Check if attack cooldown ready
  - Check if target in range
  - Confidence score based on cooldown/range

- **L4-SYNC-016**: Implement ability prediction
  - Check if AOE ability ready
  - Check if 2+ enemies in range
  - Confidence score based on ability/range

- **L4-SYNC-017**: Integrate AI predictions with visual rendering
  - If confidence > 0.8, show faint prediction (optional)
  - Use predictions for internal state only if < 0.5
  - Test prediction accuracy over 10 combats

### Phase 6: Server Reconciliation & Shimmer (3 tasks)
- **L4-SYNC-018**: Implement `ServerReconciliation` error detection
  - Compare client render position vs server position
  - Calculate error in hexes
  - Classify error (small <1, medium 1-3, large >3)

- **L4-SYNC-019**: Implement shimmer effect (white outline, 200ms fade)
  - Create PIXI.Graphics outline (2px, white)
  - Fade alpha 0.5 → 0.0 over 200ms
  - Despawn shimmer graphics on completion

- **L4-SYNC-020**: Implement smooth correction for medium errors
  - Interpolate to server position over 100ms
  - Trigger shimmer if not on cooldown (2 sec limit)
  - Instant snap for large errors (>3 hexes)

### Phase 7: Timestamp-Based Animation Sync (3 tasks)
- **L4-SYNC-021**: Implement `AnimationSyncManager` timestamp parsing
  - Receive animation start timestamps from server
  - Calculate time delta (server vs client clock)
  - Determine start frame from elapsed time

- **L4-SYNC-022**: Implement animation resync logic
  - If time delta within ±100ms, sync to server timeline
  - If time delta > 100ms, hard reset to server timeline
  - Test with simulated clock skew

- **L4-SYNC-023**: Implement frame event triggering
  - Check current animation frame each render tick
  - Trigger events (projectile spawn) when frame reached
  - Mark events as triggered (don't trigger twice)

### Phase 8: Testing & Optimization (3 tasks)
- **L4-SYNC-024**: Unit tests for interpolation/prediction math
  - Test exponential smoothing calculation
  - Test velocity extrapolation
  - Test AI intent heuristics

- **L4-SYNC-025**: Integration tests with simulated network conditions
  - Simulate 100ms latency
  - Simulate 20% packet jitter
  - Simulate 5% packet loss
  - Measure smoothness (no visible teleports)

- **L4-SYNC-026**: Performance profiling and optimization
  - Measure CPU usage for interpolation/prediction
  - Optimize hot paths (60 calls/sec)
  - Ensure 60 FPS maintained with 16 units

**Total: 26 tasks**

---

## Open Questions & Clarifications

### Q1: Delta Compression Format
**Question**: Should we use JSON delta compression or upgrade to binary MessagePack for bandwidth savings?

**Options**:
- **JSON**: Simple, human-readable, easy to debug
- **MessagePack**: 50% smaller payloads, but harder to debug

**Recommendation**: Start with JSON for MVP (easier debugging), upgrade to MessagePack post-MVP for bandwidth optimization.

---

### Q2: Prediction Visibility
**Question**: Should high-confidence predictions (0.8+) be shown visually (faint ghost), or kept internal only?

**Options**:
- **Visual**: Shows player what AI is "thinking", interesting feedback
- **Internal only**: Cleaner UI, but less transparency

**Recommendation**: Internal only for MVP (simpler), add visual predictions post-MVP as optional setting.

---

### Q3: Shimmer Effect Intensity
**Question**: Should shimmer effect intensity scale with prediction error magnitude (1 hex vs 3 hexes)?

**Options**:
- **Fixed intensity**: Simpler, all shimmers look the same
- **Scaled intensity**: More informative, but complex

**Recommendation**: Fixed intensity for MVP (2px white outline), scale intensity post-MVP.

---

### Q4: Adaptive Buffer Threshold
**Question**: Should jitter detection threshold be 20ms variance or adjustable based on network quality?

**Options**:
- **Fixed 20ms**: Simple, works for most networks
- **Adaptive**: More robust, but complex

**Recommendation**: Fixed 20ms threshold for MVP, adaptive threshold post-MVP.

---

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Jitter causes visible stuttering | High | Medium | Adaptive buffer (100-150ms), shimmer effect for corrections |
| Prediction errors confuse players | Medium | Medium | Shimmer effect indicates corrections, frequency limit prevents spam |
| Buffer delay feels laggy | Medium | Low | 100ms delay is imperceptible, adaptive buffer minimizes delay |
| Delta compression fails to reduce bandwidth | High | Low | Full state snapshots every 167ms prevent drift, validate compression |
| Animation sync desyncs due to clock skew | High | Low | ±100ms tolerance, hard reset if desync > 100ms |
| AI intent predictions inaccurate | Low | High | Low confidence predictions hidden, only show high-confidence (0.8+) |

---

## Metadata

- **Estimated Effort**: 3-4 weeks
- **Dependencies**: Authoritative Server, WebSocket, PixiJS Renderer, Animation State Machine
- **Priority**: CRITICAL (foundation for all client rendering)
- **Complexity**: HIGH (network, prediction, reconciliation)

---

**Status**: Ready for L4 task breakdown and implementation
**Next Steps**: Review open questions, validate with network testing, proceed to task implementation
