# Ghost Sprite Trail and Fast Movement Fixes

**Date:** 2025-01-23
**Status:** ✅ Implemented - Ready for Testing

---

## Problems Identified

### Problem 1: Ghost Sprite Trail
**Issue:** Multiple ghost sprites ("P" circles) appearing along the movement path, creating a trail effect.

**Root Cause:** The code was only using `renderAnimatedCreature()` (which has sprite reuse logic) when units were **attacking**. For idle/walk states (including spawn movement), it used `renderCreature()` which doesn't prevent sprite recreation. This caused:
1. New sprite created every 100ms (each state update)
2. Old sprites never cleaned up
3. Trail of ghost images left behind

**Evidence from Logs:**
```
[CombatVisualizationManager] Rendering newly spawned unit
[CombatGridRenderer] renderCreature called for mnJxMziyeNYsWQNvm0ch  ← WRONG METHOD!
```

### Problem 2: Movement Too Fast
**Issue:** Units moving "very very fast" from spawn to battle positions, hard to see the animation.

**Root Cause:** Spawn duration was only 24 ticks (~400ms) for the full movement from 4 hexes off-screen to battle position.

---

## Fixes Implemented

### Fix 1: Use Animated Rendering for ALL States

**File:** `/frontend/src/services/combat-visualization-manager.ts`
**Lines:** 632-638

**Changed:**
```typescript
// BEFORE - only animated rendering for attacks:
const shouldAnimate = isAttacking && this.gridRenderer.supportsAnimations() &&
                      creatureData?.battlefieldDirectionalViews;

// AFTER - animated rendering for ALL states:
const shouldAnimate = this.gridRenderer.supportsAnimations() &&
                      creatureData?.battlefieldDirectionalViews;
```

**Why This Works:**
- `renderAnimatedCreature()` has sprite reuse logic on lines 82-89 of CombatGridRenderer.ts
- Checks `spritesByUnitId.get(unitId)` and skips recreation if sprite exists
- Now ALL states (idle, walk, attack) use this method with reuse logic
- No more sprite recreation = no more ghost trails

**Expected Console Logs:**
```
[CombatGridRenderer] Sprite already exists for unit, skipping recreation: player1_...
```

### Fix 2: Increase Spawn Duration to 1.5 Seconds

**File:** `/backend/src/services/combat/combat-engine.ts`

**Change 1 - Initial spawn ticks (line 874):**
```typescript
// BEFORE:
spawnTicksRemaining: 24, // ~0.4 seconds at 60 TPS

// AFTER:
spawnTicksRemaining: 90, // ~1.5 seconds at 60 TPS
```

**Change 2 - Total spawn ticks in updateSpawnMovement() (line 320):**
```typescript
// BEFORE:
const totalSpawnTicks = 24; // ~0.4 seconds at 60 TPS

// AFTER:
const totalSpawnTicks = 90; // ~1.5 seconds at 60 TPS
```

**Why This Works:**
- 90 ticks at 60 TPS = 1.5 seconds of movement
- **3.75x slower** than before (400ms → 1500ms)
- Units move 4 hexes over 1.5 seconds = clearly visible movement
- Walking animation will be much easier to see

---

## Testing Instructions

### Step 1: Hard Refresh Browser
**IMPORTANT:** Press `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac) to clear cached JavaScript and load the new frontend code.

### Step 2: Start New Match
1. Navigate to: `http://localhost:5177/deployment-grid?matchId=test-ghost-fix&playerId=player1`
2. Deploy 1 creature on your side (e.g., Dancing Sword Bear)
3. Open Player 2 in another tab
4. Deploy 1 creature on Player 2 side
5. Mark both ready
6. Watch combat start

### Step 3: Visual Verification

**✅ Expected Behavior:**
1. **No Ghost Trails:** Units should NOT leave copies of themselves behind
2. **Single Sprite:** Only ONE sprite visible per unit at any time
3. **Slow, Visible Movement:** Units glide smoothly from deployment positions over ~1.5 seconds
4. **Animation Visible:** Walking animation clearly visible during movement
5. **Smooth Transitions:** No flicker, teleporting, or jarring jumps

**❌ Previous Problems (Should Be Fixed):**
- Trail of "P" circles along movement path
- Movement so fast you couldn't see it
- Multiple sprites for same unit

### Step 4: Console Validation

**Open DevTools Console (F12) and check for:**

**Good Signs:**
```
[CombatVisualizationManager] Using ANIMATED rendering: {
  unitId: 'player1_...',
  animationState: 'walk',
  frameCount: 4,
  isAttacking: false
}

[CombatGridRenderer] Sprite already exists for unit, skipping recreation: player1_...

[CombatVisualizationManager] Updated sprite position: {
  unitId: 'player1_...',
  hexPos: { q: 0.5, r: 3 },
  pixelPos: { x: 450, y: 380 }
}
```

**Bad Signs (Shouldn't See These):**
```
❌ [CombatGridRenderer] renderCreature called for ...  (means using wrong method)
❌ [CombatVisualizationManager] No sprite found for unit: ...  (sprite lookup failing)
❌ [CombatGridRenderer] Loading idle animation ...  (repeated for same unit = recreation)
```

---

## Technical Details

### Movement Timeline (Now)

| Time | Ticks | Unit Position | Description |
|------|-------|---------------|-------------|
| 0.0s | 0 | (-2, 3) | Spawn 4 hexes off-screen |
| 0.375s | 22.5 | (-1, 3) | 25% complete |
| 0.75s | 45 | (0, 3) | 50% complete - at deployment edge |
| 1.125s | 67.5 | (1, 3) | 75% complete |
| 1.5s | 90 | (2, 3) | 100% complete - at battle position |

**Comparison:**
- **Before:** 400ms total (24 ticks) - too fast to see
- **After:** 1500ms total (90 ticks) - clearly visible movement

### Sprite Management Flow

**Before (Broken):**
```
State Update #1 (tick 0) → renderCreature() → Create sprite A at (-2, 3)
Frame renders        → Sprite A visible
State Update #2 (tick 6) → renderCreature() → Create sprite B at (-1, 3)
Frame renders        → Sprite A AND B visible ← GHOST TRAIL!
State Update #3 (tick 12) → renderCreature() → Create sprite C at (0, 3)
Frame renders        → Sprites A, B, C visible ← MORE GHOSTS!
```

**After (Fixed):**
```
State Update #1 (tick 0) → renderAnimatedCreature() → Create sprite A
State Update #2 (tick 6) → renderAnimatedCreature() → Check: Sprite exists? YES → Skip
State Update #3 (tick 12) → renderAnimatedCreature() → Check: Sprite exists? YES → Skip
renderFrame (60 FPS)     → Update sprite A position via interpolation
```

---

## Files Modified

1. **frontend/src/services/combat-visualization-manager.ts**
   - Line 632-638: Changed `shouldAnimate` condition to remove `isAttacking` check
   - Line 645-649: Updated log message

2. **backend/src/services/combat/combat-engine.ts**
   - Line 874: Changed `spawnTicksRemaining: 24` → `spawnTicksRemaining: 90`
   - Line 320: Changed `totalSpawnTicks = 24` → `totalSpawnTicks = 90`

---

## Troubleshooting

### Issue: Still Seeing Ghost Trails

**Cause:** Browser cached old JavaScript
**Fix:** Hard refresh with `Ctrl+Shift+R` or `Cmd+Shift+R`

### Issue: Movement Still Too Fast

**Possible Solutions:**
1. Verify backend restarted with new code (check it's using 90 ticks)
2. Increase spawn ticks further (try 120 ticks = 2 seconds)
3. Check console for actual tick counts in broadcast messages

### Issue: No Sprites Visible

**Cause:** Player 2 creatures don't have `battlefieldDirectionalViews`
**Expected:** Player 2 shows placeholder "A" circles
**Note:** This is expected behavior - only Player 1's Dancing Sword Bear has full sprite data

---

## Next Steps (Optional Enhancements)

### 1. Ease-Out Interpolation
Add cubic ease-out for smoother deceleration:
```typescript
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
const progress = easeOutCubic(ticksElapsed / totalSpawnTicks);
```

### 2. Configurable Spawn Duration
Make spawn duration configurable per creature or distance-based:
```typescript
const distance = calculateDistance(spawnPos, battlePos);
const spawnTicks = Math.max(60, Math.min(120, distance * 15));
```

### 3. Add Diagnostic Logging
Add temporary logs to verify spawn tick countdown:
```typescript
if (unit.spawnTicksRemaining % 10 === 0) {
  console.log(`[Spawn] Unit ${unit.unitId} - ${unit.spawnTicksRemaining} ticks remaining`);
}
```

---

## Success Criteria

✅ No ghost sprite trails visible
✅ Single sprite per unit at all times
✅ Movement takes ~1.5 seconds (clearly visible)
✅ Walking animation visible and smooth
✅ Console shows "Sprite already exists, skipping recreation"
✅ Console shows "Using ANIMATED rendering" for walk states
✅ No "No sprite found" warnings

---

**Status:** ✅ Ready for Testing

**Backend:** Running on port 3001 with 90-tick spawn duration
**Frontend:** Updated to use animated rendering for all states

Please test and report results!
