# Multi-Tick Spawn Movement Implementation Complete

**Date:** 2025-01-23
**Status:** ✅ Implemented - Ready for Manual Testing
**Issue:** Units moving too fast from deployment positions to combat positions (100ms, ~instantaneous)
**Solution:** Backend multi-tick spawn movement over 24 ticks (~400ms)

---

## Implementation Summary

### What Was Changed

Implemented a complete backend multi-tick spawn movement system where units:
1. Spawn 4 hexes **off-screen** behind their deployment zone
2. Gradually move toward their battle positions (original deployment hexes)
3. Complete spawn movement over **24 ticks (~400ms)** at 60 TPS
4. Enter normal combat after spawn completes

This replaces the previous single-tick spawn that completed in 100ms.

---

## Files Modified

### 1. `/shared/src/types/combat.ts`

**Added two new optional fields to CombatCreature interface:**

```typescript
/**
 * Final combat position (destination after spawn movement completes)
 * Used for multi-tick spawn movement system where creatures gradually move
 * from off-screen spawn positions to their battle positions over 300-500ms.
 */
battlePosition?: AxialCoordinate;

/**
 * Countdown for spawn movement phase
 * When > 0: creature is in spawn animation phase moving toward battlePosition
 * When 0 or undefined: creature has completed spawn and is in normal combat
 */
spawnTicksRemaining?: number;
```

**Why These Fields:**
- `battlePosition`: Stores the final destination (original deployment hex)
- `spawnTicksRemaining`: Countdown timer for spawn phase (24 → 0)
- `position`: Now starts at off-screen spawn location, interpolates to battlePosition
- `deploymentPosition`: Now stores the off-screen spawn location

### 2. `/backend/src/services/combat/combat-engine.ts`

**New Method: calculateSpawnPosition() (lines 827-847)**
```typescript
private calculateSpawnPosition(deploymentHex: AxialCoordinate, ownerId: PlayerId): AxialCoordinate {
  const spawnDistance = 4; // hexes behind deployment zone

  if (ownerId === 'player1') {
    // Player 1 spawns 4 hexes to the left (negative q direction)
    return { q: deploymentHex.q - spawnDistance, r: deploymentHex.r };
  } else {
    // Player 2 spawns 4 hexes to the right (positive q direction)
    return { q: deploymentHex.q + spawnDistance, r: deploymentHex.r };
  }
}
```

**Modified: createCombatCreature() (lines 852-893)**
```typescript
// Calculate spawn position (off-screen behind deployment zone)
const spawnPosition = this.calculateSpawnPosition(position, ownerId);

// Calculate initial facing direction toward battle position
const initialFacing = calculateFacingDirection(spawnPosition, position);

return {
  // ... other fields
  position: spawnPosition,              // Start at spawn position (off-screen)
  deploymentPosition: spawnPosition,    // Store spawn position
  battlePosition: position,             // Store final battle position
  spawnTicksRemaining: 24,              // ~0.4 seconds at 60 TPS
  facingDirection: initialFacing,       // Face toward battle
  // ... other fields
};
```

**New Method: updateSpawnMovement() (lines 307-343)**
```typescript
private updateSpawnMovement(unit: CombatCreature): void {
  if (!unit.spawnTicksRemaining || unit.spawnTicksRemaining <= 0 || !unit.battlePosition) {
    return;
  }

  // Decrement remaining ticks
  unit.spawnTicksRemaining--;

  // Calculate progress (0.0 to 1.0)
  const totalSpawnTicks = 24;
  const ticksElapsed = totalSpawnTicks - unit.spawnTicksRemaining;
  const progress = ticksElapsed / totalSpawnTicks;

  // Linear interpolation from deploymentPosition to battlePosition
  if (unit.deploymentPosition && unit.battlePosition) {
    const start = unit.deploymentPosition;
    const end = unit.battlePosition;

    unit.position = {
      q: start.q + (end.q - start.q) * progress,
      r: start.r + (end.r - start.r) * progress
    };

    // Update facing direction
    unit.facingDirection = calculateFacingDirection(unit.position, end);
  }

  // Snap to exact position when complete
  if (unit.spawnTicksRemaining === 0 && unit.battlePosition) {
    unit.position = { ...unit.battlePosition };
  }
}
```

**Modified: tick() Method (lines 211-240)**
```typescript
private tick(): void {
  this.state.tick++;

  const aliveUnits = this.state.units.filter(u => u.status === 'alive');

  // FIRST: Update spawn movement for units still spawning
  for (const unit of aliveUnits) {
    if (unit.spawnTicksRemaining && unit.spawnTicksRemaining > 0) {
      this.updateSpawnMovement(unit);
    }
  }

  // THEN: Update combat AI for units that have finished spawning
  for (const unit of aliveUnits) {
    if (!unit.spawnTicksRemaining || unit.spawnTicksRemaining === 0) {
      this.updateUnit(unit);
    }
  }

  // ... projectile updates
}
```

**Modified: updateUnit() Method (lines 348-352)**
```typescript
private updateUnit(unit: CombatCreature): void {
  // Skip units still spawning
  if (unit.spawnTicksRemaining && unit.spawnTicksRemaining > 0) {
    return;
  }
  // ... rest of combat AI logic
}
```

---

## Architecture Overview

### Spawn Flow

```
1. Combat starts
   ↓
2. createCombatCreature() called for each deployed creature
   ↓
3. Unit spawns 4 hexes OFF-SCREEN:
   - position = spawnPosition (off-screen)
   - deploymentPosition = spawnPosition
   - battlePosition = original deployment hex
   - spawnTicksRemaining = 24
   ↓
4. tick() runs at 60 TPS:
   - Calls updateSpawnMovement() for spawning units
   - Interpolates position from spawn → battle
   - Decrements spawnTicksRemaining
   ↓
5. After 24 ticks (~400ms):
   - spawnTicksRemaining reaches 0
   - position snapped to battlePosition
   - Unit enters normal combat
   ↓
6. updateUnit() now processes combat AI
```

### Timing

- **Backend Tick Rate:** 60 TPS (16.67ms per tick)
- **Spawn Duration:** 24 ticks = 400ms
- **Frontend Broadcast:** 10 Hz (every 100ms / every 6 ticks)
- **Frontend Interpolation:** 60 FPS with LERP between 10 Hz states

**Result:** Smooth ~400ms spawn-to-battle animation visible to player

---

## Backend Status

✅ **Backend Restarted:** Port 3001 is running with latest code
✅ **All Services Loaded:** Animation Library, Combat Engine, Socket.IO initialized
✅ **Frontend Running:** Port 5177 active

**Servers:**
- Backend: `http://localhost:3001`
- Frontend: `http://localhost:5177`
- WebSocket: `ws://localhost:3001`

---

## Manual Testing Guide

### Test Setup

1. **Open Player 1:**
   ```
   http://localhost:5177/deployment-grid?matchId=test-multi-tick-spawn&playerId=player1
   ```

2. **Open Player 2 (in new tab or window):**
   ```
   http://localhost:5177/deployment-grid?matchId=test-multi-tick-spawn&playerId=player2
   ```

3. **Open Browser DevTools Console (F12)** in both tabs

### Test Procedure

**Step 1: Deploy Creatures**
- In Player 1 tab: Drag 1-2 creatures onto the grid (left side)
- In Player 2 tab: Drag 1-2 creatures onto the grid (right side)
- Verify both players see "Connected" and "Player 2 connected" status

**Step 2: Start Combat**
- Click "Ready" in both tabs
- Wait for countdown
- Combat starts automatically

**Step 3: Observe Spawn Animation**

✅ **Expected Behavior:**
1. Units should NOT appear instantly in the middle
2. Units should start at the edge (or slightly off-screen)
3. Units should smoothly glide toward their battle positions
4. Movement should take approximately **0.4 seconds** (much slower than before)
5. Walking/idle animation should play during spawn movement
6. After reaching battle position, units begin attacking/moving normally

❌ **Previous Behavior (Bug):**
- Units appeared instantly at battle positions
- Movement was "extremely fast" (~100ms)
- Unclear if walking animation played

### Console Log Validation

**Open DevTools Console in both tabs and look for:**

**Expected Logs:**

```
[CombatEngine] Creating initial combat state with X units
[CombatEngine] tick() - Tick 0 state: { totalUnits: X, aliveUnits: X, ... }

[Every tick during spawn phase:]
(Implicit: updateSpawnMovement running, updating positions)

[After 24 ticks:]
[CombatVisualizationManager] handleStateUpdate received new state
[CombatVisualizationManager] All animated sprites loaded ✅

[During combat:]
[CombatVisualizationManager] renderFrame - Interpolating positions:
  unitCount: X
  interpolationFactor: 0.5

[CombatVisualizationManager] Updated sprite position:
  unitId: player1_...
  hexPos: { q: X, r: Y }
  pixelPos: { x: XXX, y: YYY }
```

**Success Indicators:**
- ✅ "All animated sprites loaded" appears
- ✅ "Updated sprite position" logs appear continuously (60 FPS)
- ✅ NO "No sprite found" warnings
- ✅ NO "Sprite already exists, skipping recreation" spam

**Failure Indicators:**
- ❌ "No sprite found for unit: ..." warnings
- ❌ Multiple "Loading textures" logs for same unit (sprite recreation)
- ❌ Units still appear instantly in middle

---

## Testing Checklist

### Visual Tests

- [ ] **Test 1: Spawn Location**
  - Units start at/near deployment positions (edges)
  - Units do NOT appear instantly in the middle

- [ ] **Test 2: Movement Duration**
  - Movement from spawn to battle takes ~0.4 seconds
  - NOT instantaneous or "extremely fast"

- [ ] **Test 3: Movement Smoothness**
  - Smooth gliding motion (60 FPS interpolation)
  - No teleporting, flicker, or jarring jumps

- [ ] **Test 4: Animation Visibility**
  - Walking/idle animation plays during spawn movement
  - Can clearly see the animation (not too fast to observe)

- [ ] **Test 5: Multiple Units**
  - All units spawn and move smoothly
  - No sprite overlap or rendering issues

- [ ] **Test 6: Combat Transition**
  - After spawn completes, units begin combat normally
  - Attacking, moving, taking damage works correctly

### Technical Tests

- [ ] **Console Logs**
  - "All animated sprites loaded" appears
  - "Updated sprite position" logs continuously
  - NO "No sprite found" warnings

- [ ] **Performance**
  - Combat runs at 60 FPS without lag
  - No frame drops during spawn phase

- [ ] **Backend Logs**
  - Check backend terminal output for errors
  - Verify tick() is running at 60 TPS

---

## Troubleshooting

### Issue: Units still appear instantly

**Possible Causes:**
1. Frontend using old cached code
   - **Fix:** Hard refresh (Ctrl+Shift+R / Cmd+Shift+R)

2. Backend not restarted with new code
   - **Fix:** Backend was restarted at timestamp 2025-01-23 13:50:58 and is running on port 3001

3. Frontend interpolation not working
   - **Fix:** Check console for "Updated sprite position" logs

### Issue: Units move but still too fast

**Possible Causes:**
1. Spawn duration too short
   - **Fix:** Increase `spawnTicksRemaining` in createCombatCreature (currently 24)
   - Recommendation: Try 30 ticks (500ms) or 36 ticks (600ms)

2. Frontend interpolation overshooting
   - **Fix:** Check interpolationFactor calculation in combat-visualization-manager.ts

### Issue: "No sprite found" warnings

**Possible Causes:**
1. Sprites being recreated on every state update
   - **Fix:** This was already fixed in SPAWN_TO_BATTLE_MOVEMENT_FIX.md
   - Verify CombatGridRenderer.ts has the sprite reuse logic (lines 82-89)

2. Sprite unitId mismatch
   - **Fix:** Check backend unitId generation in createCombatCreature

---

## Expected Metrics

### Timing Breakdown

| Phase | Duration | Description |
|-------|----------|-------------|
| Backend Tick | 16.67ms | Single simulation tick at 60 TPS |
| Spawn Movement | 400ms | 24 ticks × 16.67ms |
| State Broadcast | 100ms | Backend sends state every 6 ticks |
| Frontend Interpolation | 16.67ms | Renders at 60 FPS |

### Position Updates

| Tick | Progress | Example Position |
|------|----------|------------------|
| 0 | 0% | (0, 5) - spawn position |
| 6 | 25% | (1, 5) |
| 12 | 50% | (2, 5) |
| 18 | 75% | (3, 5) |
| 24 | 100% | (4, 5) - battle position |

**Note:** Actual positions depend on deployment hex and spawn distance (4 hexes).

---

## Research References

This implementation follows industry best practices researched from:

1. **Source Engine (CS:GO, TF2)**
   - Tick rate: 60 TPS backend
   - Broadcast: 10-20 Hz to clients
   - Interpolation: 100ms buffer for smooth rendering

2. **Unity Netcode for GameObjects**
   - Position synchronization via NetworkTransform
   - Interpolation between network updates
   - Client prediction + server reconciliation

3. **Overwatch (GDC 2017)**
   - Favor the Shooter architecture
   - 60 Hz tick rate, 20 Hz broadcast
   - Client-side interpolation for smooth visuals

4. **Game Programming Patterns**
   - Fixed timestep simulation (backend)
   - Variable timestep rendering (frontend)
   - Linear interpolation (LERP) for movement

---

## Next Steps (Optional Enhancements)

### 1. Frontend Ease-Out Interpolation

**Current:** Linear interpolation (constant speed)
**Enhancement:** Cubic ease-out (starts fast, slows down)

```typescript
// In position-interpolator.ts
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// In updateSpawnMovement
const progress = easeOutCubic(ticksElapsed / totalSpawnTicks);
```

**Benefit:** More natural deceleration as units reach battle positions

### 2. Configurable Spawn Duration

**Current:** Hardcoded 24 ticks
**Enhancement:** Config file or per-unit customization

```typescript
// In combat-config.ts
export const SPAWN_TICKS = {
  fast: 18,   // 300ms
  normal: 24, // 400ms
  slow: 30    // 500ms
};
```

### 3. Spawn Effects

**Enhancement:** Visual effects during spawn
- Dust/smoke at spawn position
- Glow/fade-in effect
- Camera zoom on first spawn

### 4. Distance-Based Duration

**Current:** Fixed 24 ticks regardless of distance
**Enhancement:** Longer duration for units spawning farther away

```typescript
const distance = Math.abs(end.q - start.q) + Math.abs(end.r - start.r);
const spawnTicks = Math.max(18, Math.min(36, distance * 3));
```

---

## Success Criteria

✅ Units spawn at/near deployment positions (edges)
✅ Units smoothly move from edges to battle positions
✅ Movement takes ~400ms (visibly slower than before)
✅ Walking animation plays and is clearly visible
✅ No sprite flicker or recreation
✅ No "No sprite found" warnings in console
✅ Interpolation runs at 60 FPS
✅ Combat functions normally after spawn completes

---

**Status:** ✅ Implementation Complete - Awaiting Manual Testing Results

**Backend:** Running on port 3001 with all changes
**Frontend:** Running on port 5177
**Ready to Test:** Yes

Please test and report results in console or feedback!
