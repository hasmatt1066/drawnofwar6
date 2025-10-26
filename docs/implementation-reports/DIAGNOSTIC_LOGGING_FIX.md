# Diagnostic Logging Fix for Combat Visualization

**Date:** 2025-01-22
**Status:** ⏳ Testing
**Purpose:** Add visibility into render loop to diagnose why units aren't moving

---

## Problem

After implementing position interpolation system, units still appear frozen during combat with no visible movement. The render loop has:
- Conditional logging (1% sampling) that hides activity
- Silent error catching that makes failures invisible
- Duplicate `getSpriteByUnitId()` methods causing confusion

---

## Changes Applied

### Fix #1: Enhanced Render Loop Logging

**File:** `/frontend/src/services/combat-visualization-manager.ts`

**Lines 1204-1212:** Added diagnostic logging at start of `renderFrame()` method:

```typescript
// [DIAGNOSTIC] Log render loop activity
if (Math.random() < 0.05) { // Log ~5% of frames for visibility
  console.log('[CombatVisualizationManager] renderFrame executing:', {
    hasCurrentState: !!this.currentState,
    hasPreviousState: !!this.previousState,
    isRunning: this.isRunning,
    deltaTime
  });
}
```

**Why:** Confirms render loop is actually running at 60 FPS, even when no interpolation is happening.

---

### Fix #2: Increased Interpolation Logging Sampling

**Line 1228:** Changed sampling rate from 1% to 5%:

```typescript
if (interpolatedPositions.length > 0 && Math.random() < 0.05) { // Log ~5% of frames for visibility
```

**Why:** Makes interpolation activity more visible in console without overwhelming with logs.

---

### Fix #3: Added Sprite Lookup Failure Logging

**Lines 1248-1257:** Added warnings when sprite lookups fail:

```typescript
// [DIAGNOSTIC] Log sprite lookup failures
if (!spriteData) {
  console.warn('[CombatVisualizationManager] No sprite found for unit:', interpolated.unitId);
  continue;
}

if (!spriteData.sprite) {
  console.warn('[CombatVisualizationManager] Sprite data exists but sprite is null:', interpolated.unitId);
  continue;
}
```

**Why:** Reveals if `getSpriteByUnitId()` is failing to find sprites, which would prevent position updates.

---

### Fix #4: Added Sprite Position Update Success Logging

**Lines 1275-1282:** Log successful sprite position updates (sampled):

```typescript
// [DIAGNOSTIC] Log successful sprite position updates (sampled)
if (Math.random() < 0.01) { // Log ~1% to avoid spam
  console.log('[CombatVisualizationManager] Updated sprite position:', {
    unitId: interpolated.unitId,
    hexPos: interpolated.position,
    pixelPos: { x: spriteData.sprite.parent.x, y: spriteData.sprite.parent.y }
  });
}
```

**Why:** Confirms that sprite positions are actually being updated when lookups succeed.

---

### Fix #5: Added Sprite Parent Missing Warning

**Line 1284:** Log when sprite has no parent container:

```typescript
console.warn('[CombatVisualizationManager] Sprite has no parent container:', interpolated.unitId);
```

**Why:** PIXI sprites need a parent container to be positioned. If missing, position updates won't work.

---

### Fix #6: Enhanced Error Logging

**Lines 1290-1295:** Replace silent catch with detailed error logging:

```typescript
catch (error) {
  // [DIAGNOSTIC] Log errors instead of silently catching
  console.error('[CombatVisualizationManager] Error updating sprite position:', error, {
    unitId: interpolated.unitId,
    position: interpolated.position
  });
}
```

**Why:** Previously errors were caught and ignored silently. Now we'll see exactly what's failing.

---

### Fix #7: Removed Duplicate getSpriteByUnitId() Method

**File:** `/frontend/src/components/CombatGrid/CombatGridRenderer.ts`

**Lines 296-306:** Deleted duplicate method that was overriding the correct implementation:

```typescript
// REMOVED THIS DUPLICATE:
// public getSpriteByUnitId(unitId: string): AnimatedSpriteData | undefined {
//   for (const spriteData of this.animatedSprites.values()) {
//     if (spriteData.unitId === unitId) {
//       return spriteData;
//     }
//   }
//   return undefined;
// }
```

**Why:**
- There were TWO `getSpriteByUnitId()` methods (lines 59-61 and 299-306)
- The second one overrode the first, breaking the intended O(1) hash map lookup
- The duplicate used linear search instead of the `spritesByUnitId` index

**Correct Implementation (lines 59-61):**
```typescript
public getSpriteByUnitId(unitId: string): AnimatedSpriteData | undefined {
  return this.spritesByUnitId.get(unitId); // Fast O(1) lookup
}
```

---

## Expected Diagnostic Output

### If Render Loop is Running:

```
[CombatVisualizationManager] renderFrame executing: {
  hasCurrentState: true,
  hasPreviousState: true,
  isRunning: true,
  deltaTime: 16.67
}
```

This should appear ~3 times per second (5% of 60 FPS).

---

### If Interpolation is Working:

```
[CombatVisualizationManager] renderFrame - Interpolating positions: {
  unitCount: 2,
  interpolationFactor: 0.45,
  timeSinceUpdate: 45,
  sampleUnit: {
    unitId: 'abc123',
    position: { q: 5.5, r: 5.0 },
    isMoving: true,
    isNewlySpawned: false
  }
}
```

This should appear when units are moving, showing fractional hex coordinates during interpolation.

---

### If Sprite Lookups are Failing:

```
⚠️ [CombatVisualizationManager] No sprite found for unit: abc123
```

This means `getSpriteByUnitId()` returned undefined, preventing position updates.

---

### If Sprite Updates are Succeeding:

```
[CombatVisualizationManager] Updated sprite position: {
  unitId: 'abc123',
  hexPos: { q: 5.5, r: 5.0 },
  pixelPos: { x: 450.5, y: 380.2 }
}
```

This confirms sprite positions are actually being updated (will appear occasionally due to 1% sampling).

---

### If Sprite Parent is Missing:

```
⚠️ [CombatVisualizationManager] Sprite has no parent container: abc123
```

This means sprite exists but can't be positioned because it's not in a PIXI container.

---

## Testing Instructions

1. **Navigate to Deployment Grid:**
   ```
   http://localhost:5177/deployment-grid?matchId=test-123&playerId=player1
   ```

2. **Open Browser Console** (F12)

3. **Deploy Units** on both sides and click "Ready"

4. **Watch Console Logs** as combat starts

5. **Analyze Output:**
   - ✅ Should see: `[CombatVisualizationManager] renderFrame executing:` every few seconds
   - ✅ Should see: `renderFrame - Interpolating positions:` when units move
   - ✅ Should see: `Updated sprite position:` occasionally
   - ❌ Should NOT see: `No sprite found for unit:` warnings
   - ❌ Should NOT see: `Sprite has no parent container:` warnings
   - ❌ Should NOT see: `Error updating sprite position:` errors

---

## What This Reveals

### Scenario A: No renderFrame Logs
**Symptom:** Never see `[CombatVisualizationManager] renderFrame executing:`
**Diagnosis:** Render loop isn't running at all
**Next Step:** Check if `start()` is being called, verify `isRunning` flag

### Scenario B: renderFrame Logs but No Interpolation Logs
**Symptom:** See `renderFrame executing` but never `Interpolating positions`
**Diagnosis:** Either no units to interpolate OR `currentState`/`previousState` are null
**Next Step:** Check if combat state is being received from backend

### Scenario C: Interpolation Logs but "No sprite found" Warnings
**Symptom:** See `Interpolating positions` but `No sprite found for unit:` warnings
**Diagnosis:** Sprites aren't being added to `spritesByUnitId` map
**Next Step:** Verify `renderAnimatedCreature()` is being called and line 220 is executing

### Scenario D: Sprite Found but "No parent container" Warnings
**Symptom:** No "No sprite found" warnings but see "Sprite has no parent container"
**Diagnosis:** Sprites exist but aren't properly added to PIXI stage
**Next Step:** Check sprite creation in `renderAnimatedCreature()`, verify container structure

### Scenario E: All Logs Look Good but Units Don't Move
**Symptom:** See interpolation, sprite updates, no warnings, but no visual movement
**Diagnosis:** Position calculations might be returning same position repeatedly
**Next Step:** Check `PositionInterpolator.interpolatePositions()` implementation

---

## Files Modified

1. `/frontend/src/services/combat-visualization-manager.ts`
   - Lines 1204-1212: Added renderFrame execution logging
   - Line 1228: Increased interpolation log sampling to 5%
   - Lines 1248-1257: Added sprite lookup failure warnings
   - Lines 1275-1282: Added sprite update success logging
   - Line 1284: Added sprite parent missing warning
   - Lines 1290-1295: Enhanced error logging

2. `/frontend/src/components/CombatGrid/CombatGridRenderer.ts`
   - Lines 296-306: Removed duplicate `getSpriteByUnitId()` method

---

## Related Issues

- **Original Issue:** Units frozen during combat, no movement visible
- **Previous Fix Attempt:** Added `getSpriteByUnitId()` method and unitId indexing
- **This Fix:** Makes render loop activity visible to diagnose the actual failure point

---

## Next Steps

1. ✅ Test in browser with diagnostic logging
2. ⏳ Analyze console output to identify failure point
3. ⏳ Implement targeted fix based on diagnostic results
4. ⏳ Verify units move smoothly
5. ⏳ Remove/reduce diagnostic logging once fixed

---

**Status:** Ready for testing
**Test URL:** http://localhost:5177/deployment-grid?matchId=test-123&playerId=player1
**Expected Result:** Console logs will reveal exactly where the position interpolation is failing
