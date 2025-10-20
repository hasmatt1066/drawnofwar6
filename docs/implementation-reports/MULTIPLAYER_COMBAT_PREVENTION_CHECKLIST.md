# Multiplayer Combat - Prevention Checklist

**Purpose**: Quick reference for preventing common multiplayer combat bugs
**Related Report**: `/docs/implementation-reports/MULTIPLAYER_COMBAT_BUG_FIXES.md`
**Date**: 2025-10-20

---

## Overview

This checklist distills the prevention strategies from the multiplayer combat bug fixes into actionable items for code review and development.

---

## Combat Log / Scroll Behavior Checklist

### Development Checklist
- [ ] Component has internal scrolling container?
- [ ] Auto-scroll feature implemented?
- [ ] Uses `element.scrollTop` (NOT `scrollIntoView()`)?
- [ ] Container has `ref` attached for scroll control?
- [ ] Scroll updates only target container, not page?

### Code Review Checklist
- [ ] Check for `scrollIntoView()` calls in auto-scroll code
- [ ] Verify ref is attached to scrollable container div
- [ ] Test scroll behavior: does page scroll or just container?
- [ ] Verify user can control page scroll independently
- [ ] Check scroll happens on correct element

### Correct Pattern
```typescript
// ✅ CORRECT: Scroll only container
const logContainerRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (autoScroll && logContainerRef.current) {
    logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
  }
}, [entries, autoScroll]);

<div ref={logContainerRef} className={styles.logContainer}>
  {/* content */}
</div>
```

### Anti-Pattern to Avoid
```typescript
// ❌ WRONG: Scrolls entire page
const logEndRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (autoScroll && logEndRef.current) {
    logEndRef.current.scrollIntoView({ behavior: 'smooth' }); // NO!
  }
}, [entries, autoScroll]);
```

---

## Multiplayer Sprite Visibility Checklist

### Development Checklist
- [ ] System needs data from other players?
- [ ] Collecting from deployment/placement state?
- [ ] Including opponent placements in data collection?
- [ ] Deduplicating by entity ID?
- [ ] Loading all data before initializing visualization?

### Code Review Checklist
- [ ] Check data sources: local roster only or all sources?
- [ ] Verify opponent placements are included
- [ ] Verify deduplication logic is present
- [ ] Check initialization timing (data loaded before visualization starts?)
- [ ] Test with two actual browser windows

### Correct Pattern
```typescript
// ✅ CORRECT: Include all data sources
const currentPlayerPlacements = currentPlayerState.placements.map(p => p.creature);
const opponentCreatures = opponentPlacements.map(p => p.creature);
const allCreatures = [
  ...player1Creatures,
  ...player2Creatures,
  ...currentPlayerPlacements,
  ...opponentCreatures  // CRITICAL: Include opponent data
];

// Deduplicate
const creatureMap = new Map<string, DeploymentCreature>();
allCreatures.forEach(c => creatureMap.set(c.id, c));
const uniqueCreatures = Array.from(creatureMap.values());

// Load before starting visualization
vizManager.setCreatureData(uniqueCreatures);
vizManager.start();
```

### Anti-Pattern to Avoid
```typescript
// ❌ WRONG: Only local roster data
const allCreatures = [...player1Creatures, ...player2Creatures];
vizManager.setCreatureData(allCreatures); // Missing opponent placements!
vizManager.start();
```

---

## General Multiplayer Development Checklist

### Design Phase
- [ ] Identified all data that flows Player 1 → Backend → Player 2?
- [ ] Documented where Player 2 receives this data?
- [ ] Planned how Player 2 extracts and uses this data?
- [ ] Considered what happens if data is missing?

### Implementation Phase
- [ ] Trace data flow: Player 1 → Backend → Player 2
- [ ] Verify Player 2 receives data (check network tab)
- [ ] Verify Player 2 extracts data from received messages
- [ ] Verify Player 2 loads data into relevant systems
- [ ] Add comprehensive logging for debugging

### Testing Phase
- [ ] Test with two actual browser windows (not single player simulation)
- [ ] Verify both players see same data
- [ ] Verify both players see each other's entities/actions
- [ ] Check network tab: is data being sent?
- [ ] Check console logs: is data being received and processed?

### Code Review Phase
- [ ] Are we only looking at local state?
- [ ] Are we ignoring data from other players?
- [ ] Are we initializing systems before data is available?
- [ ] Have we tested with real multiplayer (not simulation)?

---

## Debugging Multiplayer Issues

### When Player 2 Can't See Player 1's Data

**Step 1: Verify Backend Transmission**
```typescript
// Backend: Are we sending the data?
console.log('[Backend] Sending to Player 2:', data);
socket.to(playerId).emit('event', data);
```

**Step 2: Verify Frontend Reception**
```typescript
// Frontend: Are we receiving the data?
socket.on('event', (data) => {
  console.log('[Frontend] Received:', data);
});
```

**Step 3: Verify Data Extraction**
```typescript
// Frontend: Are we extracting the data?
const extractedData = receivedMessage.someField;
console.log('[Frontend] Extracted:', extractedData);
```

**Step 4: Verify Data Loading**
```typescript
// Frontend: Are we loading into the system?
system.setData(extractedData);
console.log('[Frontend] Loaded into system:', extractedData.length, 'items');
```

**Step 5: Verify System Usage**
```typescript
// Frontend: Is the system using the data?
const result = system.getData();
console.log('[Frontend] System has:', result.length, 'items');
```

---

## Common Multiplayer Bugs

### 1. Only Loading Local Data
**Symptom**: Player can see their own entities but not opponent's
**Cause**: Only collecting from local roster/state
**Fix**: Include opponent placements/state in data collection

### 2. Race Condition in Data Loading
**Symptom**: Inconsistent behavior, sometimes works sometimes doesn't
**Cause**: Initializing system before data arrives
**Fix**: Wait for data to load, then initialize system

### 3. Missing Data Extraction
**Symptom**: Backend sends data, frontend receives, but system doesn't have it
**Cause**: Receiving data but not extracting/loading it
**Fix**: Add extraction and loading step after receiving

### 4. Wrong Data Source
**Symptom**: Have the data but looking in wrong place
**Cause**: Checking local state instead of received opponent state
**Fix**: Use correct state source (opponent placements vs local roster)

---

## Testing Multiplayer Features

### Manual Testing Setup
1. Open two browser windows
2. Use different player IDs in URLs:
   - Window 1: `?matchId=test&playerId=player1`
   - Window 2: `?matchId=test&playerId=player2`
3. Open DevTools console in both windows
4. Perform actions in both windows
5. Verify both see the results

### Console Logging Pattern
```typescript
// Prefix logs with component/system name
console.log('[SystemName] Action:', data);

// Log at every step of data flow
console.log('[SystemName] Sending to backend:', data);
console.log('[SystemName] Received from backend:', data);
console.log('[SystemName] Extracted data:', data);
console.log('[SystemName] Loaded into system:', data);
console.log('[SystemName] System using data:', data);
```

### Network Tab Verification
- Check "WS" (WebSocket) tab
- Verify messages are being sent
- Verify messages are being received
- Check message payload structure

---

## Documentation Requirements

### For Each Multiplayer Feature
- [ ] Document data flow (Player 1 → Backend → Player 2)
- [ ] Document what data each player needs
- [ ] Document where data comes from on each player
- [ ] Document initialization requirements
- [ ] Document testing requirements (two browser windows)

### In Code Comments
```typescript
// MULTIPLAYER: Collect creature data from ALL sources
// Including opponent placements is CRITICAL for sprite visibility
const allCreatures = [
  ...localRoster,        // Our creatures
  ...opponentPlacements  // Opponent's creatures (from backend)
];
```

---

## Prevention Strategy Summary

**For Scroll Issues**:
1. Always use `element.scrollTop` for container scrolling
2. Only use `scrollIntoView()` when you want to scroll the page
3. Test scroll behavior manually

**For Multiplayer Data Issues**:
1. Always collect data from all sources (local + opponent)
2. Always trace data flow Player 1 → Backend → Player 2
3. Always test with two browser windows
4. Always add comprehensive logging

**General**:
1. Question assumptions about what data is available where
2. Test in real conditions (not simulations)
3. Add logging for debugging
4. Document data flows in specs

---

## Quick Reference

### Scroll Container Pattern
```typescript
const ref = useRef<HTMLDivElement>(null);
useEffect(() => {
  if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
}, [data]);
<div ref={ref}>{content}</div>
```

### Multiplayer Data Collection Pattern
```typescript
const allData = [
  ...localData,
  ...currentPlayerData,
  ...opponentData  // Don't forget!
];
const unique = new Map();
allData.forEach(d => unique.set(d.id, d));
system.setData(Array.from(unique.values()));
```

### Multiplayer Testing URLs
```
Player 1: http://localhost:5175/page?matchId=test&playerId=player1
Player 2: http://localhost:5175/page?matchId=test&playerId=player2
```

---

**Checklist Status**: ✅ COMPLETE
**Last Updated**: 2025-10-20
**Related Reports**:
- `/docs/implementation-reports/MULTIPLAYER_COMBAT_BUG_FIXES.md`
- `/docs/implementation-reports/DOCUMENTATION_UPDATE_SUMMARY.md`
