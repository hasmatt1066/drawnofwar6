# L3 Feature: Creature Library & Persistent Storage

**Status**: 🟡 In Planning
**Parent Epic**: Battle Engine (L2)
**Created**: 2025-10-11
**Last Updated**: 2025-10-11

## Overview

Implements persistent storage for generated creatures, connecting the generation system to the deployment/battlefield system. Enables players to save generated creatures to a library and deploy them in battles.

### Current State
- ✅ Creature generation system complete (PixelLab + Claude Vision)
- ✅ Deployment grid system complete (drag-and-drop, Socket.IO sync)
- ❌ **No persistent storage** - generated creatures only exist temporarily in BullMQ
- ❌ **No connection** - deployment uses hardcoded mock creatures

### Desired State
- ✅ Generated creatures saved to Firestore + Firebase Storage
- ✅ Deployment page loads real creatures from database
- ✅ Demo testing with pseudo-users (demo-player1, demo-player2)
- ✅ Manual save workflow with "Save to Library" button
- ✅ Roster selection via URL parameters

## Requirements Summary

### Functional Requirements
1. **Creature Persistence**
   - Save complete creature data (sprites, animations, stats) to database
   - Manual save via "Save to Library" button on generation result page
   - Only save successful complete generations
   - Support multiple generations of same description (create separate entries)

2. **Player Isolation**
   - Separate creature pools for demo-player1 and demo-player2
   - No cross-contamination of rosters
   - Each player sees only their creatures

3. **Roster Management**
   - Load creatures via URL parameters: `?creatures=id1,id2,id3`
   - Option to save named rosters (e.g., "My Army")
   - Maximum 8 creatures per roster (deployment grid limit)

4. **Storage Strategy**
   - Firebase Storage for sprite images (base64 too large for Firestore docs)
   - Firestore for creature metadata (stats, animations, storage URLs)
   - Query performance optimized for 100s of creatures

### Non-Functional Requirements
1. **No Authentication** (MVP) - Use pseudo-users for demo testing
2. **Data Integrity** - Only save complete successful generations
3. **Performance** - Sub-second load times for rosters
4. **Error Handling** - Show placeholders for missing/corrupted data

## Technical Architecture

### Database Schema

#### Firestore Collection: `creatures`

```typescript
interface CreatureDocument {
  // Identity
  id: string; // Auto-generated Firestore doc ID
  ownerId: 'demo-player1' | 'demo-player2';
  name: string; // Creature name (from Claude analysis)
  createdAt: Timestamp;

  // Original Generation Data
  generationJobId: string; // Reference to BullMQ job
  inputType: 'text' | 'draw' | 'upload';
  textDescription?: string; // Original prompt (if text input)

  // Claude Vision Analysis
  species: string;
  primaryRole: string;
  combatAttributes: {
    strength: { value: number; reasoning: string; };
    agility: { value: number; reasoning: string; };
    intelligence: { value: number; reasoning: string; };
  };
  abilities: string[];
  physicalDescription: string;

  // Animation Mappings
  animations: {
    [key: string]: string; // animation name → PixelLab animation ID
  };

  // Sprite Storage URLs (Firebase Storage)
  sprites: {
    menuSprite: string; // gs:// URL
    directions: {
      E: { sprite: string; walkFrames: string[]; };
      NE: { sprite: string; walkFrames: string[]; };
      SE: { sprite: string; walkFrames: string[]; };
      // W, NW, SW are mirrored in client
    };
  };

  // Metadata
  generationTimeMs: number;
  version: string; // Schema version for migrations
}
```

#### Firestore Collection: `rosters` (Optional - Phase 2)

```typescript
interface RosterDocument {
  id: string;
  ownerId: 'demo-player1' | 'demo-player2';
  name: string; // User-defined roster name
  creatureIds: string[]; // Max 8 IDs
  createdAt: Timestamp;
  lastUsedAt: Timestamp;
}
```

### Firebase Storage Structure

```
/creatures/
  /{creatureId}/
    menu-sprite.png
    /directions/
      E-sprite.png
      E-walk-0.png
      E-walk-1.png
      E-walk-2.png
      E-walk-3.png
      NE-sprite.png
      NE-walk-0.png
      ...
```

### API Endpoints

#### POST `/api/creatures/save`
Save a generated creature to the database.

**Request:**
```typescript
{
  jobId: string; // BullMQ job ID to pull generation data from
  ownerId: 'demo-player1' | 'demo-player2';
}
```

**Response:**
```typescript
{
  success: boolean;
  creatureId: string;
  creature: CreatureDocument; // Full creature data
}
```

**Error Cases:**
- Job not found
- Job not complete
- Job failed
- Firebase upload failed

#### GET `/api/creatures/list?ownerId=demo-player1`
List all creatures for a player.

**Query Parameters:**
- `ownerId`: 'demo-player1' | 'demo-player2'
- `limit`: number (default: 50)
- `offset`: number (default: 0)

**Response:**
```typescript
{
  creatures: CreatureDocument[];
  total: number;
  hasMore: boolean;
}
```

#### GET `/api/creatures/:id`
Get single creature by ID.

**Response:**
```typescript
{
  creature: CreatureDocument;
}
```

**Error Cases:**
- Creature not found
- Permission denied (wrong ownerId)

#### GET `/api/creatures/batch?ids=id1,id2,id3`
Get multiple creatures by IDs (for roster loading).

**Query Parameters:**
- `ids`: Comma-separated creature IDs
- `ownerId`: 'demo-player1' | 'demo-player2' (for validation)

**Response:**
```typescript
{
  creatures: CreatureDocument[];
  missing: string[]; // IDs that weren't found
}
```

#### POST `/api/rosters/save` (Phase 2 - Optional)
Save a named roster.

**Request:**
```typescript
{
  name: string;
  creatureIds: string[]; // Max 8
  ownerId: 'demo-player1' | 'demo-player2';
}
```

**Response:**
```typescript
{
  rosterId: string;
  roster: RosterDocument;
}
```

#### GET `/api/rosters/list?ownerId=demo-player1` (Phase 2)
List saved rosters for a player.

## Atomic L4 Tasks

### Phase 1: Infrastructure Setup (8 hours)

#### TASK-CLS-1.1: Firebase Admin SDK Setup
**Estimated Time**: 2 hours

**Description**: Initialize Firebase Admin SDK in backend with proper credentials and configuration.

**Acceptance Criteria**:
- [ ] Firebase Admin SDK installed (`npm install firebase-admin`)
- [ ] Service account JSON credentials configured
- [ ] Environment variables for Firebase project ID, storage bucket
- [ ] `src/config/firebase.ts` exports initialized `admin.firestore()` and `admin.storage()`
- [ ] Connection validated with test query

**Dependencies**: None

**Files to Create/Modify**:
- `backend/src/config/firebase.ts` (new)
- `backend/.env` (add Firebase credentials)
- `backend/.env.example` (document required vars)

**Test Strategy**:
- Unit test: Verify firebase config loads without errors
- Integration test: Write and read test document to Firestore
- Integration test: Upload and retrieve test file from Storage

---

#### TASK-CLS-1.2: Creature Storage Service
**Estimated Time**: 4 hours

**Description**: Create service layer for uploading creature sprites to Firebase Storage and returning URLs.

**Acceptance Criteria**:
- [ ] `CreatureStorageService` class with methods:
  - `uploadMenuSprite(creatureId, base64Data): Promise<string>` → Returns gs:// URL
  - `uploadDirectionalSprite(creatureId, direction, base64Data): Promise<string>`
  - `uploadWalkFrame(creatureId, direction, frameIndex, base64Data): Promise<string>`
  - `deleteCreatureAssets(creatureId): Promise<void>` → Cleanup utility
- [ ] Validates base64 format before upload
- [ ] Handles upload errors gracefully
- [ ] Returns consistent URL format

**Dependencies**: TASK-CLS-1.1

**Files to Create/Modify**:
- `backend/src/services/creature-storage.service.ts` (new)

**Test Strategy**:
- Unit test: Base64 validation logic
- Mock test: Upload calls with mocked Storage SDK
- Integration test: Actual upload to test Firebase project
- Error test: Invalid base64, network failures

---

#### TASK-CLS-1.3: Creature Repository
**Estimated Time**: 2 hours

**Description**: Create Firestore repository for CRUD operations on creature documents.

**Acceptance Criteria**:
- [ ] `CreatureRepository` class with methods:
  - `create(creatureData): Promise<CreatureDocument>`
  - `findById(id): Promise<CreatureDocument | null>`
  - `findByOwner(ownerId, limit, offset): Promise<CreatureDocument[]>`
  - `findByIds(ids, ownerId): Promise<CreatureDocument[]>` → Batch query
  - `delete(id): Promise<void>`
- [ ] Type-safe with `CreatureDocument` interface
- [ ] Handles Firestore errors
- [ ] Validates ownerId matches for queries

**Dependencies**: TASK-CLS-1.1

**Files to Create/Modify**:
- `backend/src/repositories/creature.repository.ts` (new)
- `backend/src/types/creature-storage.ts` (new - type definitions)

**Test Strategy**:
- Unit test: Query building logic
- Mock test: Firestore SDK calls mocked
- Integration test: CRUD operations against test Firestore
- Error test: Document not found, permission errors

---

### Phase 2: Save Creature API (12 hours)

#### TASK-CLS-2.1: Generation Result Transformer
**Estimated Time**: 3 hours

**Description**: Transform BullMQ generation result into Firestore-ready creature document structure.

**Acceptance Criteria**:
- [ ] `transformGenerationResult(jobResult, ownerId): CreatureDocumentInput` function
- [ ] Extracts all required fields from `GenerationResult`
- [ ] Validates required fields present (sprites, animations, attributes)
- [ ] Returns structured data matching `CreatureDocument` schema
- [ ] Handles partial data with clear error messages

**Dependencies**: TASK-CLS-1.3

**Files to Create/Modify**:
- `backend/src/services/creature-transform.service.ts` (new)

**Test Strategy**:
- Unit test: Complete generation result → Valid document
- Unit test: Missing sprites → Throws validation error
- Unit test: Missing animations → Throws validation error
- Unit test: Partial attributes → Throws validation error

---

#### TASK-CLS-2.2: Save Creature Service
**Estimated Time**: 5 hours

**Description**: Orchestrate saving creature: fetch job data, upload sprites, save to Firestore.

**Acceptance Criteria**:
- [ ] `CreatureSaveService` class with method:
  - `saveCreatureFromJob(jobId, ownerId): Promise<CreatureDocument>`
- [ ] Workflow:
  1. Fetch generation result from BullMQ
  2. Validate job complete and successful
  3. Transform to creature document structure
  4. Upload all sprites to Firebase Storage (parallel)
  5. Replace base64 with storage URLs
  6. Save document to Firestore
  7. Return complete creature document
- [ ] Atomic operation (rollback storage uploads if Firestore fails)
- [ ] Detailed error logging

**Dependencies**: TASK-CLS-1.2, TASK-CLS-1.3, TASK-CLS-2.1

**Files to Create/Modify**:
- `backend/src/services/creature-save.service.ts` (new)

**Test Strategy**:
- Unit test: Mocked happy path
- Integration test: End-to-end with test Firebase + BullMQ
- Error test: Job not found
- Error test: Incomplete generation
- Error test: Storage upload fails (verify rollback)
- Error test: Firestore save fails (verify cleanup)

---

#### TASK-CLS-2.3: POST /api/creatures/save Endpoint
**Estimated Time**: 2 hours

**Description**: API endpoint to trigger creature save from generation job.

**Acceptance Criteria**:
- [ ] POST route `/api/creatures/save` registered
- [ ] Request validation (jobId, ownerId required)
- [ ] Calls `CreatureSaveService.saveCreatureFromJob()`
- [ ] Returns 201 with creature document on success
- [ ] Returns 400 for invalid input
- [ ] Returns 404 if job not found
- [ ] Returns 500 with error message on save failure

**Dependencies**: TASK-CLS-2.2

**Files to Create/Modify**:
- `backend/src/routes/creatures.routes.ts` (new)
- `backend/src/index.ts` (register routes)

**Test Strategy**:
- E2E test: Valid request → 201 with creature data
- E2E test: Missing jobId → 400
- E2E test: Invalid ownerId → 400
- E2E test: Job not found → 404
- E2E test: Save fails → 500

---

#### TASK-CLS-2.4: Save Button in Generation UI
**Estimated Time**: 2 hours

**Description**: Add "Save to Library" button on generation result page.

**Acceptance Criteria**:
- [ ] "Save to Library" button appears after successful generation
- [ ] Button disabled during save (loading state)
- [ ] Calls POST `/api/creatures/save` with current jobId
- [ ] Shows success toast with creature name
- [ ] Shows error toast if save fails
- [ ] Button becomes "Saved ✓" after successful save
- [ ] Player selection dropdown (demo-player1 / demo-player2)

**Dependencies**: TASK-CLS-2.3

**Files to Create/Modify**:
- `frontend/src/components/GenerationProgress/index.tsx` (modify)
- `frontend/src/services/creatureLibraryService.ts` (new API client)

**Test Strategy**:
- Component test: Button renders after generation complete
- Component test: Loading state during save
- Component test: Success state after save
- Component test: Error state on failure
- Mock test: API call with correct jobId and ownerId

---

### Phase 3: Load Creatures API (8 hours)

#### TASK-CLS-3.1: GET /api/creatures/list Endpoint
**Estimated Time**: 2 hours

**Description**: API endpoint to list all creatures for a player.

**Acceptance Criteria**:
- [ ] GET route `/api/creatures/list` registered
- [ ] Query parameter `ownerId` required
- [ ] Optional `limit` (default: 50) and `offset` (default: 0)
- [ ] Calls `CreatureRepository.findByOwner()`
- [ ] Returns 200 with creature array, total count, hasMore flag
- [ ] Returns 400 if ownerId invalid

**Dependencies**: TASK-CLS-1.3

**Files to Create/Modify**:
- `backend/src/routes/creatures.routes.ts` (modify)

**Test Strategy**:
- E2E test: Valid ownerId → Returns creatures
- E2E test: Empty library → Returns empty array
- E2E test: Pagination works correctly
- E2E test: Missing ownerId → 400

---

#### TASK-CLS-3.2: GET /api/creatures/:id Endpoint
**Estimated Time**: 1 hour

**Description**: API endpoint to get single creature by ID.

**Acceptance Criteria**:
- [ ] GET route `/api/creatures/:id` registered
- [ ] Calls `CreatureRepository.findById()`
- [ ] Returns 200 with creature document
- [ ] Returns 404 if not found

**Dependencies**: TASK-CLS-1.3

**Files to Create/Modify**:
- `backend/src/routes/creatures.routes.ts` (modify)

**Test Strategy**:
- E2E test: Valid ID → Returns creature
- E2E test: Invalid ID → 404

---

#### TASK-CLS-3.3: GET /api/creatures/batch Endpoint
**Estimated Time**: 2 hours

**Description**: API endpoint to get multiple creatures by IDs (for roster loading).

**Acceptance Criteria**:
- [ ] GET route `/api/creatures/batch` registered
- [ ] Query parameter `ids` (comma-separated) required
- [ ] Query parameter `ownerId` required (for validation)
- [ ] Calls `CreatureRepository.findByIds()`
- [ ] Returns 200 with creatures array + missing IDs array
- [ ] Returns 400 if parameters invalid
- [ ] Validates all creatures belong to ownerId

**Dependencies**: TASK-CLS-1.3

**Files to Create/Modify**:
- `backend/src/routes/creatures.routes.ts` (modify)

**Test Strategy**:
- E2E test: Valid IDs → Returns all creatures
- E2E test: Some IDs missing → Returns found + missing list
- E2E test: Wrong ownerId → 400 (permission check)
- E2E test: Malformed IDs parameter → 400

---

#### TASK-CLS-3.4: Creature Library Service (Frontend)
**Estimated Time**: 3 hours

**Description**: Frontend service for fetching creatures from API.

**Acceptance Criteria**:
- [ ] `creatureLibraryService.ts` exports functions:
  - `listCreatures(ownerId, limit?, offset?): Promise<CreatureListResponse>`
  - `getCreature(id): Promise<CreatureDocument>`
  - `batchGetCreatures(ids, ownerId): Promise<BatchCreaturesResponse>`
- [ ] Type-safe response types matching backend
- [ ] Error handling with typed error messages
- [ ] Caching strategy (consider React Query)

**Dependencies**: TASK-CLS-3.1, TASK-CLS-3.2, TASK-CLS-3.3

**Files to Create/Modify**:
- `frontend/src/services/creatureLibraryService.ts` (new)
- `shared/src/types/creature-storage.ts` (new - shared types)

**Test Strategy**:
- Mock test: API calls with correct parameters
- Mock test: Error responses handled correctly
- Mock test: Response data transformed correctly

---

### Phase 4: Deployment Integration (10 hours)

#### TASK-CLS-4.1: URL Parameter Parsing for Rosters
**Estimated Time**: 2 hours

**Description**: Parse `?creatures=id1,id2,id3` URL parameter on deployment page.

**Acceptance Criteria**:
- [ ] `useRosterFromUrl()` custom hook extracts creature IDs from URL
- [ ] Validates IDs format (non-empty, alphanumeric)
- [ ] Returns array of IDs or empty array
- [ ] Updates when URL changes

**Dependencies**: None

**Files to Create/Modify**:
- `frontend/src/hooks/useRosterFromUrl.ts` (new)

**Test Strategy**:
- Unit test: Valid URL → Extracts IDs correctly
- Unit test: Missing parameter → Returns empty array
- Unit test: Malformed IDs → Filters invalid entries

---

#### TASK-CLS-4.2: Load Roster on Deployment Page
**Estimated Time**: 4 hours

**Description**: Load creature data from API based on URL parameters.

**Acceptance Criteria**:
- [ ] `useCreatureRoster()` hook:
  - Takes creature IDs from URL
  - Fetches creatures via `batchGetCreatures()`
  - Returns loading state, creature data, errors
  - Handles missing creatures gracefully
- [ ] Loading spinner while fetching
- [ ] Error message if fetch fails
- [ ] Warning if some creatures not found
- [ ] Falls back to empty roster if no IDs in URL

**Dependencies**: TASK-CLS-3.4, TASK-CLS-4.1

**Files to Create/Modify**:
- `frontend/src/hooks/useCreatureRoster.ts` (new)

**Test Strategy**:
- Mock test: IDs provided → Fetches creatures
- Mock test: Empty IDs → Skips fetch
- Mock test: Fetch error → Returns error state
- Mock test: Some creatures missing → Returns partial data

---

#### TASK-CLS-4.3: Transform Database Creatures to Deployment Format
**Estimated Time**: 2 hours

**Description**: Convert `CreatureDocument` to `DeploymentCreature` format.

**Acceptance Criteria**:
- [ ] `transformToDeploymentCreature(doc): DeploymentCreature` function
- [ ] Maps Firestore URLs to sprite loading system
- [ ] Generates unique deployment IDs
- [ ] Preserves combat attributes
- [ ] Sets default facing based on player

**Dependencies**: TASK-CLS-4.2

**Files to Create/Modify**:
- `frontend/src/services/creature-transform.service.ts` (new)

**Test Strategy**:
- Unit test: Complete creature doc → Valid deployment creature
- Unit test: All sprite URLs correctly mapped
- Unit test: Player ID correctly preserved

---

#### TASK-CLS-4.4: Replace Mock Creatures with Database Creatures
**Estimated Time**: 2 hours

**Description**: Update `DeploymentGridDemoPage` to use loaded creatures instead of hardcoded mocks.

**Acceptance Criteria**:
- [ ] Remove `INITIAL_PLAYER1_CREATURES` and `INITIAL_PLAYER2_CREATURES` constants
- [ ] Use `useCreatureRoster()` hook to load creatures
- [ ] Transform loaded creatures to deployment format
- [ ] Pass to deployment grid component
- [ ] Show loading state while fetching
- [ ] Show empty state if no creatures in roster

**Dependencies**: TASK-CLS-4.3

**Files to Create/Modify**:
- `frontend/src/pages/DeploymentGridDemoPage.tsx` (modify)

**Test Strategy**:
- Integration test: URL with creature IDs → Loads and displays creatures
- Integration test: Empty URL → Shows empty state
- Visual test: Creature sprites render correctly
- Visual test: Opponent creatures show with 50% opacity

---

### Phase 5: End-to-End Testing (6 hours)

#### TASK-CLS-5.1: E2E Test: Generate → Save → Deploy
**Estimated Time**: 3 hours

**Description**: Complete flow test from generation to battlefield display.

**Acceptance Criteria**:
- [ ] Test script or Playwright test:
  1. Navigate to generation page
  2. Generate creature (text input)
  3. Wait for completion
  4. Click "Save to Library" (as demo-player1)
  5. Verify save success
  6. Navigate to deployment page with creature ID in URL
  7. Verify creature loads and displays correctly
  8. Verify sprite image loads (not placeholder)

**Dependencies**: All previous tasks

**Files to Create/Modify**:
- `backend/tests/e2e/creature-library.e2e.test.ts` (new)

**Test Strategy**:
- E2E test: Full happy path
- E2E test: Verify sprite URLs resolve
- E2E test: Verify creature data integrity

---

#### TASK-CLS-5.2: E2E Test: Player Isolation
**Estimated Time**: 2 hours

**Description**: Verify player1 and player2 have separate creature pools.

**Acceptance Criteria**:
- [ ] Test:
  1. Generate and save creature as demo-player1
  2. List creatures as demo-player1 → See new creature
  3. List creatures as demo-player2 → Don't see player1's creature
  4. Generate and save creature as demo-player2
  5. List creatures as demo-player2 → See only player2's creature

**Dependencies**: All previous tasks

**Files to Create/Modify**:
- `backend/tests/e2e/creature-library.e2e.test.ts` (modify)

**Test Strategy**:
- E2E test: Player isolation enforced
- E2E test: No cross-contamination

---

#### TASK-CLS-5.3: E2E Test: Roster with Missing Creatures
**Estimated Time**: 1 hour

**Description**: Handle edge case where roster IDs reference deleted creatures.

**Acceptance Criteria**:
- [ ] Test:
  1. Create roster URL with 3 creature IDs
  2. Delete one creature from Firestore
  3. Load deployment page with roster URL
  4. Verify warning shown for missing creature
  5. Verify other 2 creatures load correctly

**Dependencies**: All previous tasks

**Files to Create/Modify**:
- `backend/tests/e2e/creature-library.e2e.test.ts` (modify)

**Test Strategy**:
- E2E test: Graceful handling of missing data
- E2E test: Partial roster loads successfully

---

## Success Criteria

### MVP Complete When:
- [x] Planning session complete with all requirements gathered
- [ ] L3 specification document created
- [ ] All 15 L4 tasks implemented and tested
- [ ] Can generate creature and save to database
- [ ] Can load saved creatures on deployment page
- [ ] Creatures display with correct sprites (not placeholders)
- [ ] Player1 and Player2 have separate creature pools
- [ ] E2E tests pass

### User Validation:
1. Generate creature (text: "fire dragon")
2. Click "Save to Library" as demo-player1
3. Copy creature ID
4. Navigate to deployment page: `?creatures={id}`
5. See fire dragon sprite on grid (not placeholder)
6. Open player2 in separate browser
7. Verify player2 doesn't see fire dragon in their library

## Deferred to Future Phases

### Phase 6: Named Rosters (Optional)
- Save rosters with names
- List saved rosters
- Load roster by name instead of IDs
- Edit/delete rosters

**Estimated Time**: 8 hours

### Phase 7: Advanced Features (Future)
- Duplicate detection and warnings
- Bulk operations (delete multiple creatures)
- Export/import rosters
- Creature search and filtering
- Sort by date/name/attributes

## Technical Notes

### Performance Considerations
- Batch sprite uploads in parallel (6-10 images per creature)
- Use Firestore composite indexes for queries
- Cache creature lists in frontend (React Query)
- Consider pagination for libraries > 100 creatures

### Error Handling Strategy
- Validate data at every layer (API → Service → Repository)
- Rollback storage uploads if Firestore save fails
- Show user-friendly errors in UI
- Log detailed errors server-side for debugging

### Security Notes (Future Auth)
- When adding real auth, replace `ownerId` with authenticated user ID
- Add Firestore security rules to enforce ownership
- Validate storage permissions match Firestore ownership
- Consider signed URLs for sprite access

## Implementation Order

Recommended implementation sequence (follows dependency graph):

**Week 1: Infrastructure**
- TASK-CLS-1.1 → TASK-CLS-1.2 → TASK-CLS-1.3

**Week 2: Save Flow**
- TASK-CLS-2.1 → TASK-CLS-2.2 → TASK-CLS-2.3 → TASK-CLS-2.4

**Week 3: Load Flow**
- TASK-CLS-3.1, TASK-CLS-3.2, TASK-CLS-3.3 (parallel)
- TASK-CLS-3.4

**Week 4: Integration**
- TASK-CLS-4.1 → TASK-CLS-4.2 → TASK-CLS-4.3 → TASK-CLS-4.4

**Week 5: Testing**
- TASK-CLS-5.1 → TASK-CLS-5.2 → TASK-CLS-5.3

**Total Estimated Time**: 44 hours (~5.5 days of focused work)

## Related Documentation

- `/docs/features/MULTI_DIRECTIONAL_SPRITES.md` - Sprite generation system
- `/backend/src/types/generation.ts` - Generation result types
- `/frontend/src/pages/DeploymentGridDemoPage.tsx` - Current deployment page
- `/PROJECT_STATUS.md` - Overall project status

## Questions for Future Resolution

1. **Roster Size Limit**: Should we enforce max 8 creatures at API level or just in UI?
2. **Creature Deletion**: Should deletion be soft (archived) or hard (permanent)?
3. **Versioning**: How to handle schema migrations when creature structure changes?
4. **Sharing**: Future feature to share creatures between players?
5. **Sprite Caching**: Should we implement CDN caching for frequently accessed sprites?
