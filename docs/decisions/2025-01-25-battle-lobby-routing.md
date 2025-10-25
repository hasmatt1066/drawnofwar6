# Decision Record: Battle Lobby Routing Structure

**Date**: 2025-01-25
**Status**: Implemented
**Context**: User navigation to battle system

---

## Problem

Users were being taken directly to the deployment grid (`/deployment`) when clicking the "Battle" navigation link. This bypassed the battle lobby system where users should be able to:
- Quick Play (auto-match)
- Browse open battles
- Create a new battle
- Join by battle key

This violated the L3 specification for the battle lobby system.

---

## Decision

Implemented a two-tier routing structure:

### 1. Battle Lobby (`/battles`)
**Purpose**: Central hub for battle matchmaking and creation

**Features**:
- Quick Play button
- Create Battle (with modal for battle name)
- Join by Key input
- Browse open battles list (placeholder)

**Navigation to this page**:
- NavBar "Battle" link → `/battles`
- HomePage "Battle Lobby" card → `/battles`

### 2. Deployment Grid (`/deployment`)
**Purpose**: Actual hex grid for deploying creatures before combat

**Access**: Only via Battle Lobby actions with query params:
- `/deployment?matchId={uuid}&playerId={player1|player2}`

**Navigation to this page**:
- After Quick Play action
- After Create Battle action
- After Join by Key action
- After joining from Browse Battles

---

## User Flow

```
1. User clicks "Battle" in navbar
   ↓
2. Lands on /battles (Battle Lobby Page)
   ↓
3. User chooses action:
   - Quick Play → Navigate to /deployment with auto-generated matchId
   - Create Battle → Enter name → Navigate to /deployment with new matchId
   - Join by Key → Enter key → Navigate to /deployment with existing matchId
   - Browse Battles → Click battle → Navigate to /deployment
   ↓
4. User lands on /deployment (Deployment Grid)
   ↓
5. User deploys creatures and starts battle
```

---

## Implementation Details

### Files Created
- `frontend/src/pages/BattleLobbyPage.tsx` - Battle lobby UI

### Files Modified
- `frontend/src/App.tsx` - Added `/battles` route
- `frontend/src/components/NavBar.tsx` - Changed "Battle" link from `/deployment` to `/battles`
- `frontend/src/pages/HomePage.tsx` - Changed Battle Arena card from `/deployment` to `/battles`

### Route Structure

```typescript
// Battle Lobby - Entry point for all battle actions
<Route path="/battles" element={
  <ProtectedRoute>
    <BattleLobbyPage />
  </ProtectedRoute>
} />

// Deployment Grid - Accessed with matchId/playerId query params
<Route path="/deployment" element={
  <ProtectedRoute>
    <DeploymentGridDemoPage />
  </ProtectedRoute>
} />
```

---

## Current Implementation Status

### ✅ Implemented (MVP)
- Battle Lobby page UI
- Quick Play button (generates matchId, navigates to deployment)
- Create Battle modal and flow
- Join by Key input and flow
- Browse Battles placeholder
- Correct routing from NavBar and HomePage

### 🚧 TODO (Future)
- Backend API integration:
  - `POST /api/battles` - Create battle, get battle key
  - `POST /api/battles/:key/join` - Join by key
  - `POST /api/battles/quick-play` - Auto-match or create
  - `GET /api/battles/open` - Get open battles list
- Real-time battle list updates via Socket.IO
- Battle key generation and validation
- Creature count validation (minimum 3)
- Active battle prevention (one battle at a time)

---

## Alignment with L3 Specification

This implementation follows:
- `docs/specs/L3-FEATURES/homepage-hub/battle-lobby-system.md`
- `docs/specs/L3-FEATURES/homepage-hub/homepage-hub-ui.md`

The routing structure matches the intended user flow where:
1. Users visit a lobby to choose battle options
2. API creates/joins battle and returns matchId
3. Frontend redirects to deployment grid with matchId/playerId params
4. Deployment completes, combat begins

---

## Benefits

1. **User Experience**: Clear separation between "finding a battle" and "deploying creatures"
2. **Matches Specification**: Aligns with documented L3 feature design
3. **Scalability**: Easy to add new lobby features (tournaments, rankings, etc.)
4. **API Ready**: Structure prepared for backend battle management API

---

## Related Documents

- L3 Spec: `docs/specs/L3-FEATURES/homepage-hub/battle-lobby-system.md`
- Homepage Spec: `docs/specs/L3-FEATURES/homepage-hub/homepage-hub-ui.md`
