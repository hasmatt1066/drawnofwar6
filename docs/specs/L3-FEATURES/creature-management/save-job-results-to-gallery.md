# L3 Feature: Save Job Results to Gallery from Animation Studio

**Parent Epic**: Creature Management System
**Status**: Defined
**Priority**: High
**Created**: 2025-10-26

## Overview

Allow users to save generation job results to their gallery directly from the Animation Studio page, enabling them to persist creatures that were generated but not immediately saved.

## User Story

```
As a player
When I view old generation results in the Animation Studio
I want to save the creature to my gallery
So that I can use it in battles without re-generating
```

## Current Behavior

- Generation results are shown on the Generation Progress page with a "Save to Library" button
- If user navigates away or server restarts, job results remain accessible via job ID
- Animation Studio can load job results by job ID
- **NO save button exists** in Animation Studio - user cannot persist viewed job results

## Desired Behavior

- Animation Studio displays "Add to Gallery" button in top navigation bar
- Button is only visible when viewing **unsaved** job results
- Clicking button:
  1. Validates creature hasn't already been saved
  2. Saves creature with current player's ownerId (demo-player1)
  3. Shows success notification with creature ID
  4. Remains on Animation Studio page (no redirect)
  5. Button changes to "Saved ✓" or hides after successful save

## Acceptance Criteria

### AC1: Save Button Display
- [ ] "Add to Gallery" button appears in top nav bar when viewing job results
- [ ] Button is disabled/hidden if creature is already saved
- [ ] Button shows loading state during save operation

### AC2: Save Operation
- [ ] Clicking button saves creature to Firestore with ownerId='demo-player1'
- [ ] All sprite data (menu, directional views, animations) are persisted
- [ ] Creature metadata (name, class, race, abilities) are saved
- [ ] Returns creatureId on success

### AC3: User Feedback
- [ ] Success notification displays "Creature saved to gallery!" with creature ID
- [ ] Error notification displays if save fails
- [ ] Button state updates to "Saved ✓" after successful save

### AC4: Duplicate Prevention
- [ ] System checks if job was already saved
- [ ] If duplicate, shows notification "Already in gallery" instead of saving
- [ ] No error thrown for duplicates (graceful handling)

## Technical Approach

### Frontend (Animation Studio)

**File**: `/frontend/src/pages/CreatureAnimationStudio.tsx`

1. Add state tracking for save status
2. Check if job was already saved (call backend check endpoint)
3. Render "Add to Gallery" button in top nav
4. On click: call `libraryService.saveCreature({ jobId, ownerId: 'demo-player1' })`
5. Handle success/error with notifications
6. Update button state

### Backend (Existing Endpoint)

**File**: `/backend/src/api/routes/creatures.routes.ts`

- Reuse existing `POST /api/creature-library/save` endpoint
- No changes needed (already handles jobId → creature save)
- Returns: `{ success: true, creatureId, creature }`

### Edge Cases

1. **Job ID doesn't exist**: Show error "Generation not found"
2. **Job still processing**: Show error "Generation not complete"
3. **Job failed**: Show error "Generation failed - cannot save"
4. **Already saved**: Show success "Already in gallery"
5. **Network error**: Show retry button

## Dependencies

- Existing save API endpoint (already implemented)
- CreatureSaveService (already implemented)
- Job results API (already implemented)

## Out of Scope

- Editing creature metadata before save
- Choosing different ownerId (hardcoded to demo-player1 for now)
- Batch save multiple jobs
- Auto-save on generation completion

## Success Metrics

- Users can save 100% of viewable job results
- Zero duplicate creatures created
- Save operation completes in < 2 seconds

## Next Steps

Break down into L4 tasks for TDD implementation.
