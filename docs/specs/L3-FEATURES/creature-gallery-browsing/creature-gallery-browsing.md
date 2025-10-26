# L3 Feature: Creature Gallery & Browsing

**Parent Epic**: Creature Creation Experience
**Status**: Implemented
**Date**: 2025-10-20
**Version**: 1.0

## Overview

Public gallery UI for viewing all generated creatures with click-through to detailed animation viewer. Future-proofed for individual player history filtering when user authentication is implemented.

## User Story

**As a player**, I want to browse all generated creatures in a visual gallery, so that I can:
- View all creatures that have been created
- Click on any creature to see detailed animations and attributes
- Get inspiration for creating new creatures
- (Future) Filter to see only my own creatures

## Feature Scope

### In Scope (MVP)
- Public gallery showing all creatures (using demo-player1 as data source)
- Responsive grid layout (4-3-2-1 columns based on screen size)
- Creature cards displaying: sprite, name, primary abilities
- Pagination with "Load More" functionality (24 creatures per page)
- Click-through navigation to creature detail page
- Creature detail page with:
  - Animated sprite viewer (idle/walk animations)
  - Directional controls (E, NE, SE, SW, W, NW)
  - Full creature information (race, class, abilities, stats)
  - Combat attributes display
  - Generation metadata (creation date, job ID, generation time)
- Empty state when no creatures exist
- Loading states during data fetch
- Error handling with retry functionality

### Out of Scope (Post-MVP)
- User-specific filtering ("My Creatures" vs "All Creatures")
- Search by name
- Filter by abilities/attributes
- Sort controls (by date, name, stats)
- Creature actions (delete, rename, duplicate, export)
- Favorite/star functionality
- Social sharing features

## Technical Architecture

### Components Created

#### 1. CreatureCard Component
**Location**: `/frontend/src/components/CreatureCard.tsx`

**Props**:
```typescript
interface CreatureCardProps {
  creature: SerializedCreatureDocument;
  onClick?: (creature: SerializedCreatureDocument) => void;
}
```

**Displays**:
- Creature sprite image (menu sprite)
- Creature name
- Top 3 combat attributes
- Metadata (race, class, creation date)

**Features**:
- Lazy loading for images
- Fallback for failed image loads
- Keyboard accessibility (Enter/Space to activate)
- Hover effects with CSS transitions

#### 2. CreatureGalleryPage Component
**Location**: `/frontend/src/pages/CreatureGalleryPage.tsx`

**State Management**:
- `creatures`: Array of SerializedCreatureDocument
- `loading`: Boolean for initial load
- `loadingMore`: Boolean for pagination
- `error`: String for error messages
- `hasMore`: Boolean for pagination state
- `total`: Number of total creatures

**Data Fetching**:
- Uses `getCreatureLibraryService()` singleton
- Calls `listCreatures()` with pagination parameters
- Initial load: 24 creatures, offset 0
- Load More: 24 creatures, offset = current length

**Layout**:
- Responsive grid using CSS Grid
- Desktop (≥1200px): 4 columns
- Tablet (768-1199px): 3 columns
- Small tablet (480-767px): 2 columns
- Mobile (<480px): 1 column

**User Flows**:
- Empty state → "Create Your First Creature" CTA → Navigate to /create
- Click creature card → Navigate to /creatures/:id
- "Create New Creature" button → Navigate to /create
- "Load More" → Fetch next page, append to list
- Error → Display message with "Retry" button

#### 3. CreatureDetailPage Component
**Location**: `/frontend/src/pages/CreatureDetailPage.tsx`

**Route**: `/creatures/:creatureId`

**Data Loading**:
- Extract `creatureId` from URL params
- Call `getCreature(creatureId)` on mount
- Handle loading, error, and success states

**Animation System**:
- Supports 2 animation types: idle, walk
- Supports 6 directions: E, NE, SE, SW, W, NW
- Auto-mirroring for W, NW, SW directions (uses E, NE, SE sprites flipped)
- Animation loop at 8 FPS (125ms per frame)
- Play/Pause controls
- Frame cycling with React state

**Information Displayed**:
- Basic info: race, class, concept, creation date
- Combat abilities: name, category, attack type, damage type, priority
- Detected abilities: tags from Claude Vision analysis
- Generation info: input type, description, generation time, job ID

**Navigation**:
- "Back to Gallery" button → Navigate to /gallery

### Routes Added

**App.tsx Updates**:
```typescript
<Route path="/gallery" element={<CreatureGalleryPage />} />
<Route path="/creatures/:creatureId" element={<CreatureDetailPage />} />
```

### Backend Integration

**API Endpoints Used**:
- `GET /api/creature-library/list?ownerId=demo-player1&limit=24&offset=0`
  - Returns: `{ creatures: [], total: number, hasMore: boolean }`
- `GET /api/creature-library/:id`
  - Returns: `{ creature: SerializedCreatureDocument }`

**Existing Infrastructure**:
- `CreatureLibraryService` (frontend service) ✅
- Creature routes (`creatures.routes.ts`) ✅
- Firestore repository for creature storage ✅
- Firebase URL converter for gs:// → HTTP URLs ✅

### Styling

**Design System**:
- Background: `#1a1a1a` (dark)
- Containers: `#2a2a2a` with `#444` borders
- Primary color: `#6c63ff` (purple)
- Accent color: `#ffd700` (gold) for abilities
- Text: `#fff` (white), `#999` (gray labels)

**Responsive Breakpoints**:
- Mobile: <480px
- Small tablet: 480-767px
- Tablet: 768-1199px
- Desktop: ≥1200px

**Accessibility**:
- Keyboard navigation support (Tab, Enter, Space)
- ARIA labels for interactive elements
- Focus states for all buttons and cards
- Semantic HTML structure

## Future Enhancements

### Phase 2: User Authentication & Filtering
**When**: After Firebase Auth integration

**Changes Required**:
1. Add `filterOwner` state to CreatureGalleryPage:
   ```typescript
   const [filterOwner, setFilterOwner] = useState<OwnerId | 'all'>('all');
   ```

2. Add toggle UI:
   ```jsx
   <div className="filter-controls">
     <button onClick={() => setFilterOwner('all')}>All Creatures</button>
     <button onClick={() => setFilterOwner(currentUserId)}>My Creatures</button>
   </div>
   ```

3. Update API call logic:
   ```typescript
   const response = await libraryService.listCreatures({
     ownerId: filterOwner === 'all' ? 'demo-player1' : filterOwner,
     limit: CREATURES_PER_PAGE,
     offset: 0
   });
   ```

4. Backend changes:
   - Support `ownerId: 'all'` parameter to return all creatures
   - Or create new endpoint: `GET /api/creature-library/all`

### Phase 3: Search & Advanced Filtering
- Text search by creature name
- Filter by abilities (multi-select)
- Filter by race/class
- Sort options (date, name, alphabetical)

### Phase 4: Creature Management Actions
- Delete creature (with confirmation modal)
- Rename creature
- Duplicate creature
- Export creature data (JSON download)
- Add to deployment roster (quick-add button)

## Testing

### Manual Testing Checklist
- [ ] Gallery loads with all creatures from database
- [ ] Empty state displays when no creatures exist
- [ ] Loading spinner shows during data fetch
- [ ] Error state displays on API failure
- [ ] Retry button works after error
- [ ] Creature cards display correct information
- [ ] Images load with lazy loading
- [ ] Failed image loads show fallback
- [ ] Pagination "Load More" works correctly
- [ ] Clicking creature navigates to detail page
- [ ] Detail page loads creature data correctly
- [ ] Animation viewer cycles through frames
- [ ] Direction buttons change sprite orientation
- [ ] Mirroring works for W, NW, SW directions
- [ ] Play/Pause controls work
- [ ] Back to gallery button navigates correctly
- [ ] Responsive layout works on mobile/tablet/desktop
- [ ] Keyboard navigation works (Tab, Enter, Space)

### Edge Cases Handled
- No creatures in database → Empty state
- API error → Error message with retry
- Failed image load → SVG placeholder
- Creature with no combat attributes → Empty section hidden
- Creature with no abilities → Section hidden
- Missing animation frames → Fallback to menu sprite
- Invalid creature ID → Error page with back button

## Success Criteria

**Feature Complete When**:
- [x] Gallery page displays all creatures in responsive grid
- [x] Pagination works with "Load More" button
- [x] Creature cards show sprite, name, abilities
- [x] Clicking creature navigates to detail page
- [x] Detail page shows animated sprite with controls
- [x] Detail page displays all creature information
- [x] Empty state, loading state, error state implemented
- [x] Responsive design works on all screen sizes
- [x] Code is future-proofed for user filtering

## Implementation Notes

**Design Decisions**:
1. **Public gallery first, user filtering later**: Prioritize getting something working quickly, add auth when ready
2. **Load More vs Infinite Scroll**: Load More is simpler and more explicit for users
3. **24 creatures per page**: Balance between performance and UX (not too many API calls, not too much DOM)
4. **Separate detail page vs Modal**: Separate page allows better deep linking and sharing in future
5. **Auto-mirroring W/NW/SW**: Cost optimization (50% fewer sprite generations)
6. **8 FPS animation**: Standard for pixel art animations (not too fast, not too slow)

**Code Organization**:
- Components in `/components` (reusable)
- Pages in `/pages` (route-level)
- Services in `/services` (API integration)
- Types in `@drawn-of-war/shared` (shared with backend)

**No external dependencies added**: Uses existing React, React Router, and creature library service.

## Related Documentation

- **L1 Theme**: Creature Creation Experience
- **L2 Epic**: (To be assigned - currently spans Creature Creation + Content Management)
- **Backend Implementation**: `/backend/src/api/routes/creatures.routes.ts`
- **Frontend Service**: `/frontend/src/services/creatureLibraryService.ts`
- **Type Definitions**: `/shared/src/types/creature-storage.ts`

## Changelog

**v1.0 - 2025-10-20**:
- Initial implementation
- Public gallery with pagination
- Creature detail page with animation viewer
- Responsive design
- Future-proofed for user filtering
