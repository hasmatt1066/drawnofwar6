# Combat Scroll Bug Fix Report

## Problem Summary

When both players hit ready and combat starts, the page automatically scrolls to the bottom and stays there. When attempting to scroll back up, the page fights the user and immediately scrolls back down, making the battlefield invisible and the page unusable during combat.

## Symptoms

1. Page scrolls to bottom when combat starts
2. Scrolling up is blocked - page immediately jumps back down
3. Holding arrow keys or dragging scrollbar is fought by automatic scrolling
4. Combat battlefield is visible at top of page but user can't see it
5. Happens continuously throughout combat (every ~100ms)

## Root Cause

**File: `frontend/src/components/CombatLogPanel/CombatLogPanel.tsx`**
**Lines: 56-58**

```tsx
// BUG: This scrolls the ENTIRE PAGE, not just the log container
if (autoScroll && logEndRef.current && logEndRef.current.scrollIntoView) {
  logEndRef.current.scrollIntoView({ behavior: 'smooth' });
}
```

### Why This Caused the Bug

1. **Combat updates arrive every 100ms** (10 times per second)
2. Each update adds new entries to the CombatLog
3. The `useEffect` on line 55 triggers whenever entries change
4. **`scrollIntoView()` scrolls the entire page** to bring the element into view
5. Since the CombatLogPanel is at the bottom of the page, this scrolls the whole page down
6. This happens continuously during combat, overriding any user scroll attempts

### The Critical Mistake

The bug was using `element.scrollIntoView()` which scrolls **the entire document** to bring an element into view. What we actually wanted was to scroll **only the log container** to show new entries.

## The Fix

**Changed**: Auto-scroll behavior to only scroll the log container, not the page

**File**: `frontend/src/components/CombatLogPanel/CombatLogPanel.tsx`

### Change 1: Add container ref (Line 45)
```tsx
const logContainerRef = useRef<HTMLDivElement>(null);
```

### Change 2: Fix auto-scroll logic (Lines 56-62)
```tsx
// BEFORE (scrolls entire page):
if (autoScroll && logEndRef.current && logEndRef.current.scrollIntoView) {
  logEndRef.current.scrollIntoView({ behavior: 'smooth' });
}

// AFTER (scrolls only container):
if (autoScroll && logContainerRef.current) {
  // Scroll the container to its bottom, not the page
  logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
}
```

### Change 3: Attach ref to container (Line 118)
```tsx
<div
  ref={logContainerRef}  // <-- Added
  className={styles.logContainer}
  role="log"
  style={{
    maxHeight,
    overflowY: 'auto'
  }}
>
```

## Technical Explanation

### scrollIntoView() vs scrollTop

**`element.scrollIntoView()`**:
- Scrolls the **nearest scrollable ancestor** AND the **document** to bring element into view
- Use case: Bringing an element into viewport when it might be anywhere on page
- Problem: Scrolls everything, including the page itself

**`element.scrollTop = value`**:
- Only scrolls the **specific element's content**
- Use case: Scrolling within a specific container
- Solution: Only affects that container, page stays put

### Why This Wasn't a Workaround

The original approach I tried (scroll locking on body) was a workaround that fought the symptom. This fix addresses the actual cause - we simply need to scroll the right thing (the log container) instead of the wrong thing (the entire page).

## Files Changed

1. **`frontend/src/components/CombatLogPanel/CombatLogPanel.tsx`**
   - Added `logContainerRef` to reference the scrollable container
   - Changed auto-scroll from `scrollIntoView()` to `scrollTop` manipulation
   - Attached ref to the log container div

## Testing

### Manual Test

1. Open two browser windows:
   - Window 1: `http://localhost:5175/deployment?matchId=test&playerId=player1`
   - Window 2: `http://localhost:5175/deployment?matchId=test&playerId=player2`

2. Place creatures and both click "Ready"

3. **Expected Behavior**:
   - ✅ Page stays at top showing battlefield
   - ✅ User can scroll freely without interference
   - ✅ Combat log scrolls internally to show new entries
   - ✅ Page scroll is independent of log scroll

4. **What to verify**:
   - Combat battlefield is visible at top
   - Page does NOT auto-scroll
   - Combat log (right panel) auto-scrolls internally
   - User can scroll page up/down freely

## Why Puppeteer Tests Failed

Puppeteer tests couldn't reproduce this bug because:
1. PixiJS requires WebGL/Canvas support
2. Puppeteer's headless browser has limited WebGL support
3. Renderer initialization failed in Puppeteer: `[DeploymentGridWithDragDrop] Renderer initialization aborted`
4. Without the canvas rendering, the bug scenario couldn't be reproduced

**For future automated testing**: Consider using Playwright with `chromium` browser which has better WebGL support, or add a test mode that mocks the canvas rendering.

## Prevention

To prevent similar bugs in the future:

1. **Always specify scroll target**: When auto-scrolling, ask "what should scroll?" - the container or the page?
2. **Use `scrollTop` for containers**: When scrolling within a container, use `element.scrollTop` not `scrollIntoView()`
3. **Use `scrollIntoView()` carefully**: Only use when you actually want to scroll the page itself
4. **Add scroll behavior to component specs**: Document expected scroll behavior in component documentation

## Impact

- **Severity**: Critical - Made combat completely unusable
- **User Experience**: Fixed - Users can now view and interact with combat battlefield
- **Performance**: No impact - Same rendering, just correct scroll target
- **Scope**: Isolated fix - Only CombatLogPanel changed, no side effects

## Lessons Learned

1. **Symptoms vs Root Cause**: The scroll locking approach was treating symptoms. The real bug was one line using the wrong scroll method.

2. **Test in Real Browsers**: Automated tests failed because of environment limitations. Real browser testing revealed the actual issue.

3. **Question Assumptions**: When the bug "wasn't happening before", it's worth asking what changed. The CombatLogPanel with autoScroll was likely a recent addition.

4. **Simple Fixes Are Better**: The final fix was changing 3 lines. The workaround would have been 20+ lines of scroll locking logic.
