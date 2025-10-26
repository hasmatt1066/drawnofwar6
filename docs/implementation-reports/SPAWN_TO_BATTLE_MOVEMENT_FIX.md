# Spawn-to-Battle Movement Fix

**Date:** 2025-01-22
**Status:** ✅ Implemented - Ready for Testing
**Issue:** Units spawning in middle of battlefield instead of at deployment positions (edges)

---

## Problem Summary

**User Report:**
> "I DO see the sprite of the bear render, but it just renders immediately in the middle of the battlefield."

**Expected Behavior:**
1. Units should appear at deployment positions (edges) when combat starts
2. Units should smoothly move from deployment positions toward each other
3. Movement should be fluid at 60 FPS via interpolation

**Actual Behavior:**
1. Units appeared immediately in the middle (combat position)
2. No movement visible
3. Console showed "No sprite found" warnings continuously

---

## Root Cause Analysis

### Problem 1: Wrong Initial Render Position

**Location:** `/frontend/src/services/combat-visualization-manager.ts:606`

**Issue:**
```typescript
// BEFORE (WRONG):
const renderPosition = unit.position;  // Always used combat position
```

Even though logs said "Rendering newly spawned unit at deployment position", the code was using `unit.position` (combat position in middle) instead of `unit.deploymentPosition` (edge position).

**Evidence from Logs:**
```
[CombatVisualizationManager] Rendering newly spawned unit at deployment position:
  deploymentPosition: { q: 2, r: 3 }  ← Edge position
  combatPosition: { q: 5, r: 5 }      ← Middle position
  renderPosition: { q: 5, r: 5 }      ← WRONG! Used combat instead of deployment
```

**Why This Happened:**
The synthetic previous state logic (lines 349-366) correctly created interpolation data, but the sprite was still rendered at the END position (combat) instead of START position (deployment).

---

### Problem 2: Sprites Recreated on Every State Update

**Location:** `/frontend/src/components/CombatGrid/CombatGridRenderer.ts:84-90`

**Issue:**
```typescript
// BEFORE (WRONG):
const hash = this.getHexGrid().hash(hex);  // Position-based hash
const existingSprite = this.animatedSprites.get(hash);  // Lookup by position
if (existingSprite) {
  this.destroyAnimatedSprite(existingSprite);  // Destroy and recreate
  this.animatedSprites.delete(hash);
  this.spritesByUnitId.delete(existingSprite.unitId);
}
```

**Problem Flow:**
1. First state update: Sprite created at deployment position with hash(0,2)
2. renderFrame(): Interpolation updates sprite position
3. Second state update: Unit position changed to (5,5) → hash(5,5)
4. Code looks up hash(5,5) → finds nothing (sprite is at hash(0,2))
5. Creates NEW sprite at (5,5)
6. Old sprite at (0,2) becomes orphaned
7. `spritesByUnitId` gets overwritten with new sprite
8. renderFrame() can't find sprites anymore → "No sprite found" warnings

**Evidence from Logs:**
```
[CombatGridRenderer] renderAnimatedCreature - Loading textures (first render)
[CombatVisualizationManager] All animated sprites loaded ✅
[CombatVisualizationManager] No sprite found for unit: player1_...  ← Sprite disappeared!
[CombatGridRenderer] renderAnimatedCreature - Loading textures (second render)  ← Recreated!
```

Sprites were being created, then lost, then recreated on every state update (every 100ms).

---

## Implemented Fixes

### Fix 1: Render Sprites at Deployment Position Initially

**File:** `/frontend/src/services/combat-visualization-manager.ts`
**Lines:** 602-608

**Change:**
```typescript
// BEFORE:
const renderPosition = unit.position;

// AFTER:
const renderPosition = (isNewlySpawned && unit.deploymentPosition)
  ? unit.deploymentPosition
  : unit.position;
```

**Why This Works:**
- Newly spawned units with `deploymentPosition` render at edge (deployment position)
- Existing units render at current position (normal behavior)
- Interpolation smoothly moves sprites from deployment to combat positions

**Expected Result:**
✅ Units appear at edges when combat starts
✅ Logs show `renderPosition` matching `deploymentPosition`

---

### Fix 2: Prevent Sprite Recreation on Position Changes

**File:** `/frontend/src/components/CombatGrid/CombatGridRenderer.ts`
**Lines:** 82-104

**Change:**
```typescript
// BEFORE:
const hash = this.getHexGrid().hash(hex);
const existingSprite = this.animatedSprites.get(hash);  // Position-based
if (existingSprite) {
  this.destroyAnimatedSprite(existingSprite);  // Always destroy
}

// AFTER:
// Check if sprite already exists for this unit ID
const existingSpriteByUnitId = this.spritesByUnitId.get(unitId);
if (existingSpriteByUnitId) {
  console.log('[CombatGridRenderer] Sprite already exists, skipping recreation');
  return;  // Don't recreate - renderFrame() handles position updates
}

// Only remove sprite if DIFFERENT unit is at this position
const existingSpriteByPosition = this.animatedSprites.get(hash);
if (existingSpriteByPosition) {
  // Different unit at this position - clean it up
  this.destroyAnimatedSprite(existingSpriteByPosition);
  this.animatedSprites.delete(hash);
  this.spritesByUnitId.delete(existingSpriteByPosition.unitId);
}
```

**Why This Works:**
- Sprites are looked up by `unitId` (persistent) instead of position (changes)
- If sprite exists for a unit, skip recreation entirely
- Position updates handled by `renderFrame()` interpolation (its job!)
- Sprites stay in `spritesByUnitId` index across state updates
- No more sprite recreation on every tick

**Expected Result:**
✅ Sprites created once and reused
✅ No "Sprite already exists, skipping recreation" logs after first render
✅ No "No sprite found" warnings in renderFrame
✅ Smooth interpolation without flicker

---

## Architecture

### Responsibilities

**handleStateUpdate() (10 Hz):**
- Receives combat state from backend every 100ms
- Creates sprites ONCE when units first appear
- Updates `currentState` and `previousState` for interpolation
- Does NOT update sprite positions

**renderFrame() (60 FPS):**
- Runs 60 times per second via requestAnimationFrame
- Interpolates positions between previous and current state
- Updates sprite positions for smooth movement
- Looks up sprites by `unitId` using `getSpriteByUnitId()`

**Before Fix:**
```
handleStateUpdate (tick 1) → Create sprite at (0,2)
renderFrame × 6             → Update position to (1,2), (2,2), ...
handleStateUpdate (tick 2) → Destroy sprite, create NEW sprite at (5,5)  ← BAD!
renderFrame × 6             → Can't find sprite! "No sprite found" warnings
```

**After Fix:**
```
handleStateUpdate (tick 1) → Create sprite at (0,2)
renderFrame × 6             → Update position to (1,2), (2,2), ...
handleStateUpdate (tick 2) → Skip (sprite exists), update state only
renderFrame × 6             → Update position to (3,2), (4,2), (5,5)  ← GOOD!
```

---

## Testing Checklist

### Visual Tests

- [ ] **Test 1: Units Spawn at Edges**
  - Deploy creatures on both sides
  - Start combat
  - Expected: Units appear at deployment positions (edges), NOT in middle

- [ ] **Test 2: Smooth Movement**
  - Watch units move from edges to middle
  - Expected: Smooth gliding motion at 60 FPS
  - Expected: No teleporting, flicker, or jarring jumps

- [ ] **Test 3: Multiple Units**
  - Deploy 3-4 units per side
  - Expected: All units spawn at edges and move smoothly
  - Expected: No sprite overlap or z-index issues

### Log Analysis

**Success Pattern:**
```
[CombatVisualizationManager] Rendering newly spawned unit at deployment position:
  deploymentPosition: { q: 0, r: 5 }
  renderPosition: { q: 0, r: 5 }  ← Should match deployment!

[CombatGridRenderer] renderAnimatedCreature - Loading textures
[CombatGridRenderer] All textures loaded: 4
[CombatVisualizationManager] All animated sprites loaded ✅

[Second state update arrives]
[CombatGridRenderer] Sprite already exists, skipping recreation  ← GOOD!

[CombatVisualizationManager] renderFrame - Interpolating positions:
  unitCount: 2
  interpolationFactor: 0.5

[CombatVisualizationManager] Updated sprite position:  ← Should see these!
  unitId: unit-1
  hexPos: { q: 2.5, r: 5 }
  pixelPos: { x: 450, y: 380 }
```

**Failure Indicators:**
```
❌ renderPosition: { q: 5, r: 5 } (should match deploymentPosition)
❌ [CombatVisualizationManager] No sprite found for unit: ...
❌ Multiple "Loading textures" logs for same unit (recreation)
```

### Console Checks

**Before navigating away from deployment grid:**
1. Open DevTools Console (F12)
2. Clear console
3. Filter for: `CombatVisualizationManager OR CombatGridRenderer`

**During combat:**
1. Look for "Rendering newly spawned unit" logs
2. Verify `renderPosition` matches `deploymentPosition`
3. Look for "Sprite already exists" logs on subsequent updates
4. Verify NO "No sprite found" warnings
5. Verify "Updated sprite position" logs appear occasionally

---

## Edge Cases

### Case 1: Unit Spawns Without Deployment Position
**Scenario:** Unit has `position` but no `deploymentPosition`
**Expected:** Render at `position`, no interpolation
**Code:** `renderPosition = unit.position` (fallback works correctly)

### Case 2: Deployment Position Equals Combat Position
**Scenario:** `deploymentPosition === position`
**Expected:** Unit appears at position, no movement
**Code:** Interpolation detects no movement, sprite stays at position

### Case 3: Multiple State Updates During Sprite Loading
**Scenario:** Second state arrives while first sprite still loading textures
**Expected:** Texture loading completes, sprite not recreated
**Code:** `existingSpriteByUnitId` check happens before texture loading

### Case 4: Unit Dies During Movement
**Scenario:** Unit moving from edge to middle, dies mid-journey
**Expected:** Death animation plays at current interpolated position
**Code:** TODO - Need to verify death handling doesn't recreate sprite

---

## Files Modified

### 1. `/frontend/src/services/combat-visualization-manager.ts`

**Line 606:** Changed renderPosition logic
```diff
- const renderPosition = unit.position;
+ const renderPosition = (isNewlySpawned && unit.deploymentPosition)
+   ? unit.deploymentPosition
+   : unit.position;
```

### 2. `/frontend/src/components/CombatGrid/CombatGridRenderer.ts`

**Lines 82-104:** Added sprite reuse logic
```diff
+ // Check if sprite already exists for this unit ID
+ const existingSpriteByUnitId = this.spritesByUnitId.get(unitId);
+ if (existingSpriteByUnitId) {
+   console.log('[CombatGridRenderer] Sprite already exists, skipping recreation');
+   return;
+ }

  const hash = this.getHexGrid().hash(hex);

- const existingSprite = this.animatedSprites.get(hash);
+ const existingSpriteByPosition = this.animatedSprites.get(hash);
- if (existingSprite) {
+ if (existingSpriteByPosition) {
+   console.log('[CombatGridRenderer] Removing sprite at position for different unit');
-   this.destroyAnimatedSprite(existingSprite);
+   this.destroyAnimatedSprite(existingSpriteByPosition);
    this.animatedSprites.delete(hash);
-   this.spritesByUnitId.delete(existingSprite.unitId);
+   this.spritesByUnitId.delete(existingSpriteByPosition.unitId);
  }
```

---

## Known Limitations

### Animation State Transitions
**Issue:** When a unit changes animation state (WALK → ATTACK), the sprite is NOT recreated. This means the animation won't change until we handle state transitions.

**TODO:**
```typescript
// In renderAnimatedCreature, after checking existingSpriteByUnitId:
if (existingSpriteByUnitId) {
  // Check if animation state changed
  if (existingSpriteByUnitId.animationState !== animationState) {
    // Transition to new animation state
    // Need to implement animation state machine updates
  }
  return;
}
```

**Current Workaround:** Animation states are set at creation time. First state usually has units attacking, so they render with attack animations and keep them.

**Impact:** Medium - Units might show wrong animation until we implement state transitions

---

## Success Criteria

✅ Units spawn at deployment positions (edges)
✅ Units smoothly move from edges to combat positions
✅ No sprite flicker or recreation
✅ No "No sprite found" warnings in console
✅ Interpolation runs at 60 FPS
✅ Console shows "Sprite already exists, skipping recreation" on state updates

---

## Testing URL

**Frontend:** http://localhost:5177/deployment-grid?matchId=test-spawn-fix&playerId=player1
**Backend:** Already running on port 3001

**Test Steps:**
1. Navigate to deployment grid URL
2. Deploy 1-2 creatures on your side
3. Open Player 2 in another tab
4. Deploy 1-2 creatures on Player 2 side
5. Mark both players ready
6. Watch combat start
7. Verify units appear at edges first
8. Verify smooth movement toward center
9. Check console for expected log patterns

---

**Status:** ✅ Fixes Implemented - Awaiting Manual Testing
