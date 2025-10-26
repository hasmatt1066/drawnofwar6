# Homepage Hub & Battle Lobby System - Planning Document

**Planning Session Date**: 2025-10-25
**Documentation Level**: L3 Feature Planning
**Status**: Active Planning
**Epic**: Matchmaking & Session Management (L2)

---

## Executive Summary

This feature creates a **persistent homepage hub** that serves as the central navigation point after user login, connecting the currently disconnected experiences (creature creation, gallery, deployment, battles) into a cohesive user journey.

### Core User Need
> "Players need a home base to manage their creatures, find opponents, and track their battle performance."

### Key Features
1. **Creature Gallery Access** - Quick navigation to browse created creatures
2. **Join Battle by Key** - Enter battle code to join friend's game
3. **Browse Open Games** - View and join available public matches
4. **Battle Stats Display** - Win/loss record and performance metrics

---

## Technical Decisions (Based on Existing Architecture)

### Authentication System

**Decision: Implement Firebase Authentication**

**Rationale:**
- ✅ Firebase Admin SDK already integrated (`firebase-admin@12.0.0`)
- ✅ Frontend Firebase config exists but Auth not yet implemented
- ✅ Firestore already used for creature storage - natural fit for user profiles
- ✅ Supports multiple auth providers (email/password, Google, anonymous)
- ✅ Minimal additional dependencies

**Implementation:**
```typescript
// Backend: Firebase Admin Auth verification
import { admin } from './config/firebase.config';

export async function verifyAuthToken(idToken: string) {
  const decodedToken = await admin.auth().verifyIdToken(idToken);
  return decodedToken.uid; // User ID
}

// Frontend: Firebase Auth SDK
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const auth = getAuth();
const userCredential = await signInWithEmailAndPassword(auth, email, password);
```

**Demo Account Handling:**
- Keep `demo-player1` and `demo-player2` as special test accounts
- These bypass auth for development/testing
- Stored in environment or config, not in Firebase Auth

**MVP Auth Providers:**
1. Email/Password (primary)
2. Anonymous Auth (guest play - converts to permanent account later)

**Post-MVP:**
- Google OAuth
- Discord OAuth
- Steam OAuth

---

### Battle Key Generation

**Decision: Continue using UUID v4 for matchId, add short codes for sharing**

**Current Implementation:**
```typescript
// Already in codebase: frontend/src/pages/DeploymentGridDemoPage.tsx:10
import { v4 as uuidv4 } from 'uuid';
const matchId = uuidv4(); // e.g., "a1b2c3d4-e5f6-..."
```

**Enhancement for User-Friendly Sharing:**
```typescript
// New: Short code generator (6 characters, alphanumeric)
function generateBattleKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Remove ambiguous chars
  return Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

// Database mapping
/battleKeys/{shortCode} -> { matchId: uuid, createdAt, createdBy }
```

**Rationale:**
- UUIDs work but are not user-friendly for sharing ("Join me at K3P9X2" vs "...a1b2c3d4-e5f6...")
- Short codes map to UUIDs in Firestore
- Collision probability: 1 in 1 billion with 6 chars from 32-char alphabet
- Existing UUID infrastructure remains unchanged internally

---

### Stats Storage & Battle History

**Decision: Hybrid Firestore structure with atomic counters**

**Database Schema:**
```typescript
// Firestore structure
/users/{userId}/
  profile: {
    displayName: string
    email: string
    photoURL?: string
    createdAt: Timestamp
    lastLoginAt: Timestamp
  }
  stats: {
    wins: number                    // Atomic counter
    losses: number                  // Atomic counter
    disconnects: number             // Not counted as losses
    totalBattles: number
    currentWinStreak: number
    bestWinStreak: number
    totalDamageDealt: number
    totalCreaturesDeployed: number
  }

/battles/{battleId}/
  matchId: string (uuid)
  battleKey: string (short code, nullable)
  players: {
    player1: { userId, displayName, creaturesDeployed }
    player2: { userId, displayName, creaturesDeployed }
  }
  result: {
    winner: userId
    loser: userId
    endReason: 'victory' | 'forfeit' | 'disconnect'
    duration: number (seconds)
    finalTick: number
  }
  createdAt: Timestamp
  completedAt: Timestamp

/users/{userId}/battleHistory/ (subcollection)
  /{battleId}: {
    opponent: { userId, displayName }
    result: 'win' | 'loss'
    creaturesDeployed: string[] (creature IDs)
    date: Timestamp
    duration: number
  }
```

**Update Strategy:**
```typescript
// Post-battle transaction
async function updateBattleStats(battleId: string, winnerId: string, loserId: string) {
  const batch = firestore.batch();

  // Update winner stats
  const winnerRef = firestore.doc(`users/${winnerId}/profile`);
  batch.update(winnerRef, {
    'stats.wins': FieldValue.increment(1),
    'stats.totalBattles': FieldValue.increment(1),
    'stats.currentWinStreak': FieldValue.increment(1)
  });

  // Update loser stats
  const loserRef = firestore.doc(`users/${loserId}/profile`);
  batch.update(loserRef, {
    'stats.losses': FieldValue.increment(1),
    'stats.totalBattles': FieldValue.increment(1),
    'stats.currentWinStreak': 0
  });

  // Store battle record
  const battleRef = firestore.doc(`battles/${battleId}`);
  batch.set(battleRef, battleData);

  await batch.commit();
}
```

**When Updated:** Post-battle only (via BullMQ queue for reliability)

**Rationale:**
- Firestore atomic increments prevent race conditions
- Battle documents provide audit trail
- Subcollections allow efficient user-scoped queries
- BullMQ queue ensures stats update even if network fails

---

### Stats Display

**Decision: Progressive disclosure - simple on homepage, detailed in profile**

**Homepage Display (MVP):**
```tsx
<StatsCard>
  <StatRow>
    <Label>Wins</Label>
    <Value>{stats.wins}</Value>
  </StatRow>
  <StatRow>
    <Label>Losses</Label>
    <Value>{stats.losses}</Value>
  </StatRow>
  <StatRow>
    <Label>Win Rate</Label>
    <Value>{((stats.wins / stats.totalBattles) * 100).toFixed(1)}%</Value>
  </StatRow>
  <WinStreak current={stats.currentWinStreak} best={stats.bestWinStreak} />
  <Link to="/profile">View Full Stats →</Link>
</StatsCard>
```

**Profile Page (Future - Post-MVP):**
- Charts: Win rate over time (Victory Chart.js)
- Match history table (last 20 battles with opponent, date, result)
- Per-creature stats (most wins, highest damage, etc.)
- Leaderboard (opt-in, friends-only initially)

**Rationale:**
- Homepage should be scannable, not overwhelming
- Detailed stats require visual design polish (defer to post-MVP)
- Users who care about stats will click through to profile

---

### Backend API Endpoints

**Decision: RESTful for resources + Socket.IO for real-time lobby**

**New REST Endpoints:**
```typescript
// User & Auth
POST   /api/auth/register          // Create account
POST   /api/auth/login             // Get Firebase token
GET    /api/auth/me                // Get current user profile
POST   /api/auth/logout            // Revoke tokens

// User Profile & Stats
GET    /api/users/me/profile       // Profile + stats + creatures count
GET    /api/users/me/stats         // Detailed stats
PATCH  /api/users/me/profile       // Update display name, photo

// Battles & Matchmaking
GET    /api/battles/open           // List open battles (paginated)
  ?page=1&limit=10&sortBy=createdAt

POST   /api/battles                // Create new battle
  Body: { battleName, isPublic, maxPlayers, settings }
  Returns: { battleId, battleKey, matchId }

POST   /api/battles/:battleKey/join  // Join by short code
  Returns: { matchId, playerId, deploymentUrl }

GET    /api/battles/:battleId       // Get battle details
POST   /api/battles/:battleId/leave // Leave battle
DELETE /api/battles/:battleId       // Delete (creator only)

// Battle History
GET    /api/users/me/battles       // Paginated battle history
  ?page=1&limit=20&result=win|loss|all
```

**Socket.IO Namespace:**
```typescript
// New namespace: /lobby
io.of('/lobby').on('connection', (socket) => {

  // Subscribe to lobby updates
  socket.on('lobby:subscribe', () => {
    socket.join('lobby-room');
    socket.emit('lobby:battles', getOpenBattles());
  });

  // Create battle
  socket.on('lobby:create', async (data) => {
    const battle = await createBattle(socket.userId, data);
    io.of('/lobby').to('lobby-room').emit('lobby:battle-created', battle);
    socket.emit('lobby:created', { battleKey: battle.battleKey });
  });

  // Join battle
  socket.on('lobby:join', async (battleKey) => {
    const result = await joinBattle(socket.userId, battleKey);
    if (result.success) {
      socket.emit('lobby:joined', result);
      io.of('/lobby').to('lobby-room').emit('lobby:battle-updated', result.battle);
    } else {
      socket.emit('lobby:error', result.error);
    }
  });

  // Leave lobby
  socket.on('disconnect', () => {
    socket.leave('lobby-room');
  });
});
```

**Rationale:**
- Aligns with existing pattern: REST for CRUD, Socket.IO for real-time
- `/lobby` namespace separates concerns from `/deployment` and `/combat`
- Real-time lobby prevents stale data (users see battles fill up instantly)

---

### Real-Time Updates & Data Flow

**Decision: Event-driven architecture with Socket.IO + BullMQ**

**Lobby Updates (Real-time):**
- ✅ Open battles list updates via Socket.IO broadcast
- ✅ Battle status changes (filling/started) pushed to all lobby subscribers
- ❌ Stats NOT real-time (updated post-battle only)

**Battle Completion Flow:**
```typescript
// 1. Combat engine completes
CombatEngine.onComplete(matchId, result)
  ↓
// 2. Emit to clients immediately
io.of('/combat').to(`match-${matchId}`).emit('combat:completed', result)
  ↓
// 3. Queue stats update (async, with retries)
battleResultsQueue.add({
  battleId,
  matchId,
  winnerId,
  loserId,
  result
})
  ↓
// 4. BullMQ worker processes
async function processBattleResult(job) {
  await updateBattleStats(winnerId, loserId);
  await storeBattleRecord(battleId, result);
  await updateBattleHistory(winnerId, loserId, battleId);
  io.of('/lobby').to('lobby-room').emit('lobby:battle-completed', battleId);
}
```

**Rationale:**
- Real-time where it matters (lobby, combat)
- Async where reliability matters (stats persistence)
- BullMQ queue ensures no data loss on network failure
- Consistent with existing generation queue pattern

---

### Edge Cases & Error Handling

#### **1. User Has No Creatures**

**Solution: Onboarding flow with progressive unlock**

```tsx
// Homepage component
if (user.creatures.length === 0) {
  return (
    <OnboardingView>
      <EmptyState
        icon={<WandIcon />}
        title="Create Your First Creature!"
        description="Draw, describe, or upload an image to bring your creature to life."
        primaryAction={
          <Button to="/create" size="large">
            Create Creature
          </Button>
        }
      />
    </OnboardingView>
  );
}

// Enforce minimum creatures for battles
const MIN_CREATURES_FOR_BATTLE = 3;

<BattleSection>
  <QuickPlayButton
    disabled={user.creatures.length < MIN_CREATURES_FOR_BATTLE}
  />
  {user.creatures.length < MIN_CREATURES_FOR_BATTLE && (
    <Tooltip>
      You need at least {MIN_CREATURES_FOR_BATTLE} creatures to battle.
      Create {MIN_CREATURES_FOR_BATTLE - user.creatures.length} more!
    </Tooltip>
  )}
</BattleSection>
```

**Rationale:**
- Clear guidance prevents frustration
- Minimum 3 creatures ensures meaningful battles
- Progressive unlock feels rewarding

---

#### **2. No Open Games Available**

**Solution: Dual CTA for cold-start problem**

```tsx
<OpenGamesSection>
  {openGames.length === 0 ? (
    <EmptyState title="No Open Battles">
      <Stack spacing={2}>
        <Text>Be the first to start a battle!</Text>
        <Button primary onClick={createBattle}>
          Host New Battle
        </Button>
        <Divider>or</Divider>
        <Input
          placeholder="Enter battle key (e.g., K3P9X2)"
          value={battleKey}
          onChange={setBattleKey}
        />
        <Button onClick={() => joinByKey(battleKey)}>
          Join by Key
        </Button>
      </Stack>
    </EmptyState>
  ) : (
    <BattleList battles={openGames} onJoin={joinBattle} />
  )}
</OpenGamesSection>
```

**Rationale:**
- Solves chicken-and-egg problem (no games = no players)
- Dual discovery: browse OR join by code
- Familiar pattern (Discord, Among Us, etc.)

---

#### **3. Battle Interruptions (Disconnects)**

**Solution: Grace period + fair penalty system**

```typescript
// Deployment socket disconnect handler
socket.on('disconnect', (reason) => {
  const battle = getUserActiveBattle(socket.userId);
  if (!battle) return;

  // Give 30s grace period to reconnect
  const disconnectTimer = setTimeout(async () => {
    if (!isUserReconnected(socket.userId)) {
      // Award win to opponent
      await forfeitBattle(battle.matchId, socket.userId, 'disconnect');

      // Update stats (disconnect ≠ loss for user's record)
      await incrementStat(socket.userId, 'disconnects');
      await incrementStat(opponent.userId, 'wins');
    }
  }, 30000);

  // Store timer for cleanup if user reconnects
  disconnectTimers.set(socket.userId, disconnectTimer);
});

// Reconnect handler
socket.on('reconnect', () => {
  const timer = disconnectTimers.get(socket.userId);
  if (timer) {
    clearTimeout(timer);
    disconnectTimers.delete(socket.userId);
  }
});
```

**Stats Impact:**
- **Disconnect**: Opponent gets win, user gets disconnect count (not loss)
- **Forfeit**: Both counted normally (win/loss)
- **Defeat**: Played to end, counted normally

**Rationale:**
- Network failures happen - don't punish harshly
- 30s grace period allows page refresh
- Opponent still gets win (fair)
- Separate "disconnect" stat helps identify chronic quitters vs bad internet

---

#### **4. Concurrent Battles**

**Solution: Enforce "one active battle at a time" for MVP**

```typescript
// Middleware: Check for active battle before join/create
async function requireNoActiveBattle(req, res, next) {
  const userId = req.user.uid;
  const activeBattle = await getActiveBattle(userId);

  if (activeBattle) {
    return res.status(409).json({
      error: 'BATTLE_IN_PROGRESS',
      message: 'Complete your current battle before starting a new one',
      activeBattle: {
        battleId: activeBattle.id,
        battleKey: activeBattle.battleKey,
        phase: activeBattle.phase
      }
    });
  }

  next();
}

// Apply to routes
router.post('/api/battles', authenticate, requireNoActiveBattle, createBattle);
router.post('/api/battles/:key/join', authenticate, requireNoActiveBattle, joinBattle);
```

**Frontend Handling:**
```tsx
// Homepage: Show active battle banner
{user.activeBattle && (
  <ActiveBattleBanner>
    <Text>Battle in progress: {user.activeBattle.battleKey}</Text>
    <Button to={`/deployment?matchId=${user.activeBattle.matchId}`}>
      Resume Battle
    </Button>
  </ActiveBattleBanner>
)}
```

**Rationale:**
- Simplifies state management (no "which battle am I in?" confusion)
- Prevents abandonment (must finish current battle)
- Clear UX (banner shows active battle)
- Post-MVP: Could allow spectating multiple battles

---

### Success Metrics

**Recommendation: AARRR Metrics (Pirate Metrics)**

```typescript
// Analytics tracking
interface AnalyticsEvents {
  // Acquisition
  'user_registered': { method: 'email' | 'google' | 'anonymous' }

  // Activation (first value moment)
  'creature_created': { creatureId, inputMethod, timeToCreate }
  'first_battle_joined': { battleId, timeFromRegistration }

  // Retention
  'user_returned': { daysSinceLastBattle, sessionCount }
  'battle_completed': { battleId, result, duration }

  // Referral
  'battle_key_shared': { battleKey, shareMethod }
  'battle_joined_via_key': { battleKey, referrerId }

  // Revenue (N/A for MVP)
}
```

**Key Metrics:**
1. **Time to First Battle**: Median and p90 (target: <10 minutes)
2. **Creature Creation Rate**: Creatures per user (target: >3)
3. **Battle Completion Rate**: % of started battles that finish (target: >80%)
4. **Join Method Distribution**: Browse vs key vs quick play
5. **7-Day Retention**: % who return within 7 days (target: >40%)
6. **Win Rate Distribution**: Should be ~50/50 if matchmaking balanced

**Implementation:**
```typescript
// Use Firebase Analytics (already in stack)
import { logEvent } from 'firebase/analytics';

logEvent(analytics, 'battle_completed', {
  battleId,
  result: 'win',
  duration: 245,
  creaturesDeployed: 5
});
```

---

## Product/UX Decisions (Remaining Questions)

### Homepage Layout

**Recommendation: Dashboard layout with 4 quadrants**

```
┌─────────────────────────────────────────────────────────┐
│  [Nav Bar: Home | Gallery | Create | Profile | Logout] │
├────────────────────┬────────────────────────────────────┤
│                    │                                    │
│   BATTLE STATS     │    QUICK ACTIONS                   │
│   ┌──────────────┐ │   ┌──────────────────────────┐   │
│   │ Wins: 5      │ │   │ [Quick Play Battle]      │   │
│   │ Losses: 3    │ │   │ [Browse Open Games]      │   │
│   │ Win Rate: 62%│ │   │ [Create Private Battle]  │   │
│   │ Streak: 2🔥  │ │   └──────────────────────────┘   │
│   └──────────────┘ │                                    │
│                    │   JOIN BY KEY                      │
│                    │   ┌──────────────────────────┐   │
│                    │   │ [______] [Join]          │   │
│                    │   └──────────────────────────┘   │
├────────────────────┴────────────────────────────────────┤
│                                                         │
│   YOUR CREATURES                                        │
│   ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐   │
│   │ img │ │ img │ │ img │ │ img │ │ img │ │ img │   │
│   └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘   │
│                                      [View All →]       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Rationale:**
- All 4 features visible without scrolling
- Stats in top-left (standard dashboard pattern)
- Actions in top-right (primary user intent)
- Creatures at bottom (secondary - user already created these)

---

### Persistent Navigation

**Recommendation: Top navigation bar across all pages**

```tsx
<NavBar>
  <Logo />
  <NavLinks>
    <NavLink to="/home" icon={<HomeIcon />}>Home</NavLink>
    <NavLink to="/gallery" icon={<GridIcon />}>Gallery</NavLink>
    <NavLink to="/create" icon={<WandIcon />}>Create</NavLink>
  </NavLinks>
  <UserMenu>
    <Avatar src={user.photoURL} />
    <Dropdown>
      <DropdownItem to="/profile">Profile & Stats</DropdownItem>
      <DropdownItem onClick={logout}>Logout</DropdownItem>
    </Dropdown>
  </UserMenu>
</NavBar>
```

**Responsive (Mobile):**
- Hamburger menu for small screens
- Bottom tab bar on mobile

---

### Gallery Integration

**Recommendation: Preview on homepage + link to full gallery**

```tsx
<CreaturesSection>
  <SectionHeader>
    <Title>Your Creatures ({creatures.length})</Title>
    <Link to="/gallery">View All →</Link>
  </SectionHeader>

  {creatures.length === 0 ? (
    <EmptyState>
      <Button to="/create">Create Your First Creature</Button>
    </EmptyState>
  ) : (
    <CreatureGrid maxItems={6}>
      {creatures.slice(0, 6).map(creature => (
        <CreatureCard key={creature.id} creature={creature} />
      ))}
    </CreatureGrid>
  )}
</CreaturesSection>
```

**Rationale:**
- Show 6 most recent creatures (visual preview)
- Don't duplicate full gallery (that's on /gallery page)
- Clear "View All" link for more

---

### Open Games Display

**Recommendation: List view with key info**

```tsx
<OpenGamesList>
  {openGames.map(game => (
    <GameCard key={game.battleId}>
      <GameInfo>
        <GameName>{game.battleName || "Quick Battle"}</GameName>
        <HostName>Hosted by {game.host.displayName}</HostName>
        <Status>Waiting for opponent ({game.players.length}/2)</Status>
        <CreatedAt>{formatRelativeTime(game.createdAt)}</CreatedAt>
      </GameInfo>
      <GameActions>
        <Button onClick={() => joinGame(game.battleKey)}>
          Join Battle
        </Button>
      </GameActions>
    </GameCard>
  ))}
</OpenGamesList>
```

**Info Shown:**
- Game name (optional, defaults to "Quick Battle")
- Host's display name
- Player count (1/2)
- Time created (e.g., "2 minutes ago")

**NOT Shown (MVP):**
- Creature previews (too much data to load)
- Match settings (all games same rules for MVP)
- Host stats/rank (no matchmaking rating yet)

---

### Matchmaking Approach

**Recommendation: Hybrid - Quick Play + Manual Browse**

```tsx
<BattleActions>
  {/* Option 1: Quick Play (auto-match) */}
  <QuickPlayButton
    onClick={quickPlay}
    disabled={creatures.length < 3}
  >
    <Icon>⚡</Icon>
    Quick Play
    <Subtitle>Auto-match with random opponent</Subtitle>
  </QuickPlayButton>

  {/* Option 2: Browse open games */}
  <BrowseButton onClick={() => setView('browse')}>
    <Icon>🔍</Icon>
    Browse Games
    <Subtitle>{openGames.length} games available</Subtitle>
  </BrowseButton>

  {/* Option 3: Create private */}
  <CreateButton onClick={createBattle}>
    <Icon>➕</Icon>
    Create Private Battle
    <Subtitle>Share key with friends</Subtitle>
  </CreateButton>
</BattleActions>
```

**Quick Play Logic:**
```typescript
async function quickPlay(userId: string) {
  // Try to join oldest open game
  const openGame = await getOldestOpenGame();

  if (openGame) {
    return joinBattle(userId, openGame.battleKey);
  }

  // No games available - create one and mark as public
  return createBattle(userId, {
    isPublic: true,
    battleName: 'Quick Battle'
  });
}
```

**Rationale:**
- Quick Play for impatient users (fastest path to battle)
- Browse for selective users (choose opponent/game name)
- Create for playing with friends (private key sharing)

---

## Route Structure

**Proposed Routes:**
```typescript
// Public routes (no auth)
/login
/register

// Protected routes (require auth)
/                     → Redirect to /home
/home                 → Homepage hub (new)
/gallery              → Full creature gallery (existing)
/creatures/:id        → Creature details (existing)
/create               → Creature creation (existing)
/generation/:jobId    → Generation progress (existing)
/profile              → User profile & detailed stats (new)

// Battle routes
/battles              → Browse open games (new, or integrated in /home)
/deployment           → Deployment grid (existing, now requires matchId from lobby)
/deployment?matchId=X&playerId=Y

// Dev/test routes
/animation-studio     → Animation testing (existing)
```

**Navigation Flow:**
```
Login → /home
  ├─ Click "Gallery" → /gallery → /creatures/:id
  ├─ Click "Create" → /create → /generation/:jobId → /home
  ├─ Click "Quick Play" → API auto-creates/joins → /deployment
  ├─ Enter battle key → /deployment
  └─ Browse open games → Click game → /deployment
```

---

## Implementation Sequence

### Phase 1: Foundation (Week 1)
1. Firebase Auth integration (frontend + backend)
2. User profile schema in Firestore
3. Auth middleware for protected routes
4. Login/Register UI

### Phase 2: Homepage Hub (Week 2)
1. Homepage layout with 4 sections
2. Persistent nav bar component
3. Creature preview integration (fetch user's creatures)
4. Routing updates

### Phase 3: Battle Lobby System (Week 2-3)
1. Battle creation API + short code generation
2. Open games list API + real-time Socket.IO
3. Join by key flow
4. Quick Play implementation

### Phase 4: Stats & History (Week 3)
1. Battle results queue (BullMQ)
2. Stats update transactions
3. Battle history storage
4. Stats display on homepage

### Phase 5: Polish & Testing (Week 4)
1. Empty states and error handling
2. Loading states and optimistic UI
3. E2E testing for full user journey
4. Performance optimization

---

## Product Decisions (Confirmed)

### ✅ Answered by User:
1. **Battle naming**: ✅ User enters battle name when creating
2. **Public vs private default**: ✅ Default to public (with toggle option)
3. **Creature click behavior**: ✅ Navigate to `/creatures/:id` (detail view)
4. **Creation flow**: ✅ `/create` → generation → `/creatures/:id` with "Add to Gallery" button

### Technical Blockers:
None identified - all required infrastructure exists or is straightforward to implement.

---

## Next Steps

1. **User approval** on planning decisions above
2. **Create L3 feature specs** for each component:
   - `firebase-auth-integration.md`
   - `homepage-hub-ui.md`
   - `battle-lobby-system.md`
   - `stats-tracking-system.md`
3. **Break down into L4 tasks** with TDD requirements
4. **Begin implementation** following sequence above

---

**Planning Status:** ✅ Complete - Awaiting user approval to proceed
