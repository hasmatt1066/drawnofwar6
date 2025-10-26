# L3 Feature: Gallery-Based Creature Selection in Deployment

**Parent Epic**: Battle Deployment System
**Status**: Defined
**Priority**: High
**Created**: 2025-10-26

## Overview

Replace the current creature selection system with direct gallery integration, allowing players to browse and select creatures from their personal gallery during battle deployment.

## User Story

```
As a player
When I join a battle deployment phase
I want to see my entire creature gallery
So that I can drag and drop creatures onto the battlefield (max 6)
```

## Current Behavior

- Deployment page shows predefined creature selections via URL parameters
- Example: `/deployment?creatures=id1,id2,id3`
- Creatures are loaded via batch fetch with hardcoded IDs
- Player has no way to browse or select from their collection
- Limited to creatures passed via URL

## Desired Behavior

### Deployment Phase UX

1. **Player joins battle** → Deployment page loads
2. **Left panel: Gallery Browser**
   - Displays all creatures owned by current player (demo-player1)
   - Grid layout with creature cards (sprite preview + name)
   - Scrollable if > 12 creatures
   - Search/filter by name (nice-to-have)
3. **Center panel: Battlefield Grid**
   - Hex grid for creature placement (existing)
   - Shows deployed creatures
4. **Drag & Drop Interaction**
   - Drag creature card from gallery → drop on hex
   - Visual feedback (card follows cursor)
   - Valid drop zones highlighted
   - Invalid drops show error message
5. **Deployment Limits**
   - Max 6 creatures per player
   - Counter shows "3/6 deployed"
   - Gallery cards dim/disable after 6 deployed
6. **Remove Creatures**
   - Click deployed creature → removes from grid
   - Returns to available count

## Acceptance Criteria

### AC1: Gallery Panel Display
- [ ] Left sidebar shows player's creature gallery
- [ ] Gallery fetches creatures with `ownerId=demo-player1`
- [ ] Each card shows: sprite thumbnail (64x64), creature name
- [ ] Gallery supports pagination (load 24 at a time)
- [ ] Shows "No creatures" message if gallery empty

### AC2: Drag & Drop Functionality
- [ ] Creature cards are draggable from gallery
- [ ] Battlefield hexes highlight as valid drop zones
- [ ] Dropping creature on hex places it at that position
- [ ] Invalid drops (non-hex, occupied hex) show error
- [ ] Cursor shows drag preview (creature sprite)

### AC3: Deployment Limits
- [ ] Maximum 6 creatures can be deployed per player
- [ ] Counter displays "X/6 deployed" in UI
- [ ] Attempting to deploy 7th creature shows error "Max 6 creatures"
- [ ] Gallery cards become unclickable after limit reached

### AC4: Creature Removal
- [ ] Clicking deployed creature removes it from battlefield
- [ ] Removed creature becomes selectable again in gallery
- [ ] Deployment count updates correctly

### AC5: Data Persistence
- [ ] Deployment state is saved when player locks in
- [ ] Other player sees updated deployment in real-time (Socket.IO)
- [ ] Refresh preserves deployed creatures (session storage)

## Technical Approach

### Frontend Components

**New Component**: `GalleryPanel.tsx`
```typescript
interface Props {
  ownerId: 'demo-player1' | 'demo-player2';
  onCreatureSelect: (creature: SerializedCreatureDocument) => void;
  deployedCount: number;
  maxDeployment: number;
}
```

**Updated Component**: `DeploymentGridDemoPage.tsx`
- Add left sidebar with `<GalleryPanel />`
- Integrate with existing deployment grid
- Add drag-drop handlers
- Track deployed creatures

### State Management

```typescript
interface DeploymentState {
  gallery: SerializedCreatureDocument[];  // All available creatures
  deployed: Map<string, DeployedCreature>; // creatureId → position
  deploymentCount: number;
  maxDeployment: 6;
}
```

### API Integration

- Use existing `/api/creature-library/list?ownerId=demo-player1` endpoint
- No backend changes needed
- Frontend service: `creatureLibraryService.listCreatures()`

### Drag & Drop Implementation

**Library**: `react-dnd` or `dnd-kit` (recommended: built-in HTML5 drag-drop API)

**Drag Source**: Gallery creature cards
**Drop Target**: Hex grid cells
**onDrop Handler**:
1. Get hex coordinates from drop target
2. Check if hex is empty
3. Check deployment limit (< 6)
4. Add creature to deployment state
5. Emit Socket.IO event to sync with opponent

### Socket.IO Events

**Emit**: `deployment:place-creature`
```json
{
  "matchId": "...",
  "playerId": "player1",
  "creatureId": "...",
  "position": { "q": 2, "r": 3 }
}
```

**Receive**: `deployment:creature-placed` (opponent's placement)

## Dependencies

- Existing creature gallery API (implemented)
- Existing deployment grid (implemented)
- Existing Socket.IO deployment events (implemented)
- Drag-drop library (to be added)

## Out of Scope

- Creature stats preview in gallery cards
- Gallery search/filter
- Creature favoriting/sorting
- Pre-saved deployment templates
- Editing creature metadata from deployment page

## Edge Cases

1. **Empty gallery**: Show "Create creatures first" message with link to /create
2. **< 6 creatures in gallery**: Allow deploying all available
3. **Network error loading gallery**: Show retry button
4. **Socket.IO disconnection**: Show warning "Connection lost"
5. **Opponent deploys while player dragging**: Handle concurrent updates gracefully

## Success Metrics

- Players can select creatures from gallery 100% of the time
- Drag-drop success rate > 95%
- Deployment limit enforced 100% of the time
- Zero duplicate creatures deployed
- Page load time < 2 seconds with 50 creatures in gallery

## Migration Path

### Phase 1: Add Gallery Panel (Non-Breaking)
- Add gallery panel alongside existing creature selection
- Both systems work in parallel
- URL-based selection still supported

### Phase 2: Default to Gallery (Deprecate URL)
- Gallery becomes primary selection method
- URL parameters optional (for testing)

### Phase 3: Remove URL-Based Selection
- Delete URL parameter parsing
- Gallery is only selection method

## Next Steps

Break down into L4 tasks for TDD implementation.
