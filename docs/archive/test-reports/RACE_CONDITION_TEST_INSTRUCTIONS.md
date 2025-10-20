# Race Condition Fix - Manual Verification Instructions

## What We're Testing

The race condition bug caused creatures to be removed from the grid immediately after placement because both `onDragEnd` (from roster) and `onDrop` (from grid) fired simultaneously, with `onDragEnd` checking an outdated placements array.

The fix changes the check from:
```javascript
// OLD - race condition prone
if (placements.includes(creature.id)) {
  return; // Already placed
}
```

To:
```javascript
// NEW - phase-based check
if (dragState.phase === 'idle') {
  console.log('Drag already completed, skipping');
  return;
}
```

## Manual Test Steps

1. **Open the deployment grid page**
   ```
   http://localhost:5177/deployment-grid
   ```

2. **Open Browser DevTools**
   - Press F12 or right-click > Inspect
   - Go to the Console tab
   - Keep it visible during testing

3. **Drag 3 creatures onto valid hexes** (columns 0-2, blue zone)
   - Drag "Warrior" from roster to left side of grid
   - Drag "Archer" from roster to left side of grid
   - Drag "Mage" from roster to left side of grid

4. **Monitor Console Logs**

   For EACH drag, you should see logs in this pattern:

   ```
   Drag started: [CreatureName]
   [HexHover] During drag, updating target to: {q: X, r: Y}
   Drop on hex: {q: X, r: Y}
   Placement success: true
   Drag ended from roster
   Drag already completed, skipping    ← THE FIX WORKING!
   ```

## Success Criteria

### ✅ FIX IS WORKING if you see:

1. **"Drag already completed, skipping"** appears in console for each drag
2. **"Placement success: true"** appears for each drag
3. **NO** "Cancelling invalid drag" messages for valid placements
4. **All 3 creatures stay on the grid** (don't disappear)
5. **Placement counter shows "3/8"** at the bottom

### ❌ FIX IS NOT WORKING if you see:

1. "Cancelling invalid drag" appears for valid placements
2. Creatures disappear from grid immediately after placement
3. Placement counter doesn't increment or goes back to 0
4. No "Drag already completed, skipping" messages

## What Each Log Message Means

- `Drag started:` - Creature picked up from roster
- `[HexHover] During drag` - Mouse is over a hex (updates target)
- `Drop on hex:` - `onDrop` handler fired from grid
- `Placement success: true` - Creature was successfully placed
- `Drag ended from roster` - `onDragEnd` handler fired from roster
- `Drag already completed, skipping` - **THE FIX!** Phase check prevented duplicate processing
- `Cancelling invalid drag` - Drag was cancelled (should NOT happen for valid drops)

## Expected Behavior

### Before the Fix:
```
Drag started: Warrior
Drop on hex: {q: 0, r: 7}
Placement success: true
Drag ended from roster
Cancelling invalid drag          ← BUG! Should not cancel valid placement
[Creature disappears from grid]
```

### After the Fix:
```
Drag started: Warrior
Drop on hex: {q: 0, r: 7}
Placement success: true
Drag ended from roster
Drag already completed, skipping  ← FIX! Recognized drag already processed
[Creature stays on grid]
```

## Screenshot Evidence

After testing, take screenshots showing:

1. **Console logs** with the "Drag already completed, skipping" messages
2. **Final grid state** with all 3 creatures placed
3. **Placement counter** showing "3/8"

## Code Location

The fix is in: `/mnt/c/Users/mhast/Desktop/drawnofwar6/frontend/src/pages/DeploymentGridDemoPage.tsx`

Lines 200-204:
```typescript
// If drag is no longer active, it was already handled (prevents race condition)
if (dragState.phase === 'idle') {
  console.log('Drag already completed, skipping');
  return;
}
```

## Additional Tests

### Test 1: Invalid Placement
- Drag a creature to the RED zone (right side of grid)
- Should see: "Cancelling invalid drag" (this is expected for invalid drops)
- Creature should return to roster

### Test 2: Repositioning
- Click on a placed creature
- Drag it to a new valid hex
- Should work the same as initial placement

### Test 3: ESC Key
- Start dragging a creature
- Press ESC before dropping
- Should see: "Drag cancelled"
- Creature should return to roster

## Troubleshooting

### If you don't see ANY console logs:
1. Make sure DevTools Console is open
2. Check that the page is http://localhost:5177/deployment-grid (not /deployment-grid-demo)
3. Refresh the page

### If canvas doesn't appear:
1. Check console for renderer errors
2. Try a different browser (Chrome/Edge recommended)
3. Ensure backend is running (some sprite loading happens)

### If creatures can't be dragged:
1. Check that they're not already placed (should not have "Deployed" badge)
2. Try refreshing the page
3. Check console for JavaScript errors

## Report Format

After testing, report:

1. **How many creatures were successfully placed?** ___ / 3
2. **Did you see "Drag already completed, skipping"?** Yes / No
3. **Did you see "Cancelling invalid drag" for VALID drops?** Yes / No
4. **Final placement count shown:** ___ / 8
5. **Did all creatures stay on grid?** Yes / No

## Conclusion

The fix works correctly if:
- ✅ "Drag already completed, skipping" appears
- ✅ All creatures stay on grid
- ✅ No "Cancelling invalid drag" for valid placements
