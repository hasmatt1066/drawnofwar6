# L3 Feature: Battle Lobby System

**Epic**: Matchmaking & Session Management
**Feature ID**: LOBBY-001
**Status**: Partially Implemented
**Created**: 2025-10-25
**Last Updated**: 2025-01-25

---

## Overview

Implement a real-time battle lobby system that allows players to create public/private battles, browse open games, join by battle key, and use quick play matchmaking.

---

## User Story

**As a** player
**I want to** find and join battles quickly
**So that** I can play against other players without manual coordination

---

## Acceptance Criteria

### Must Have (MVP)
- [ ] Players can create new battles (with user-entered name) - UI implemented, API pending
- [ ] Battles default to public (with toggle for private) - UI implemented, API pending
- [ ] Each battle gets a unique 6-character battle key - Pending
- [ ] Players can join battles by entering battle key - UI implemented, API pending
- [ ] Players can browse list of open public battles - Pending
- [ ] Quick Play auto-matches or creates public battle - Pending
- [ ] Battle list updates in real-time as games fill/start - Pending
- [ ] Only players with 3+ creatures can create/join battles - Pending
- [ ] Players can only be in one active battle at a time - Pending
- [ ] Battle transitions to deployment when second player joins - Pending

**Implementation Status**:
- ✅ Implemented: UI components for battle creation, join by key input
- ⏳ Pending: All backend API endpoints, battle key generation, matchmaking logic, Socket.IO lobby namespace

### Should Have (Post-MVP)
- [ ] Battle settings (time limits, creature limits, ranked vs casual)
- [ ] Battle invitations (send to specific friends)
- [ ] Spectator mode
- [ ] Matchmaking based on skill rating

### Won't Have (Out of Scope)
- AI opponents
- Tournament brackets
- Team battles (2v2, 3v3)

---

## Technical Specification

### Utility Services

#### Battle Key Generation

```typescript
// backend/src/services/battle-key-generator.ts

const BATTLE_KEY_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 chars (no ambiguous)
const KEY_LENGTH = 6;

export function generateBattleKey(): string {
  return Array.from({ length: KEY_LENGTH }, () =>
    BATTLE_KEY_CHARS[Math.floor(Math.random() * BATTLE_KEY_CHARS.length)]
  ).join('');
}

export async function generateUniqueBattleKey(): Promise<string> {
  const maxAttempts = 10;

  for (let i = 0; i < maxAttempts; i++) {
    const key = generateBattleKey();

    // Check if key already exists
    const existing = await firestore.doc(`battleKeys/${key}`).get();
    if (!existing.exists) {
      return key;
    }
  }

  throw new Error('Failed to generate unique battle key');
}
```

**Collision Probability:** 1 in ~1 billion with 32^6 = 1,073,741,824 combinations

---

#### Creature Count Utility (MAJOR GAP ADDRESSED)

```typescript
// backend/src/services/creature-count.service.ts

/**
 * Get number of creatures a user owns
 * Used for validating minimum creature requirement (3+) for battles
 */
export async function getCreatureCount(userId: string): Promise<number> {
  const snapshot = await firestore
    .collection('creatures')
    .where('ownerId', '==', userId)
    .select() // Don't fetch full documents, just count
    .get();

  return snapshot.size;
}

/**
 * Check if user has minimum creatures for battle
 */
export async function hasMinimumCreaturesForBattle(
  userId: string,
  minimum: number = 3
): Promise<boolean> {
  const count = await getCreatureCount(userId);
  return count >= minimum;
}
```

---

#### Battle Cleanup Job (MAJOR GAP ADDRESSED)

```typescript
// backend/src/queue/battle-cleanup-queue.ts

import { Queue, Worker } from 'bullmq';
import { redis } from '../config/redis';
import { firestore, FieldValue } from '../config/firebase.config';

/**
 * Scheduled job to cleanup abandoned battles
 * Runs every hour to delete battles stuck in 'waiting' for >24 hours
 */
export const battleCleanupQueue = new Queue('battle-cleanup', {
  connection: redis
});

export const battleCleanupWorker = new Worker(
  'battle-cleanup',
  async (job) => {
    console.log('[BattleCleanup] Starting cleanup job');

    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

    // Find abandoned battles
    const snapshot = await firestore.collection('battles')
      .where('status', '==', 'waiting')
      .where('createdAt', '<', FieldValue.serverTimestamp(cutoffTime))
      .get();

    console.log(`[BattleCleanup] Found ${snapshot.size} abandoned battles`);

    const batch = firestore.batch();

    for (const doc of snapshot.docs) {
      const battle = doc.data();

      // Delete battle document
      batch.delete(doc.ref);

      // Delete battle key mapping
      if (battle.battleKey) {
        batch.delete(firestore.doc(`battleKeys/${battle.battleKey}`));
      }

      // Delete match state (in-memory, so just log)
      console.log(`[BattleCleanup] Cleaning up match: ${battle.matchId}`);
      deleteMatch(battle.matchId);
    }

    await batch.commit();

    console.log(`[BattleCleanup] Cleaned up ${snapshot.size} battles`);
    return { cleaned: snapshot.size };
  },
  {
    connection: redis
  }
);

// Schedule cleanup to run every hour
battleCleanupQueue.add(
  'cleanup',
  {},
  {
    repeat: {
      pattern: '0 * * * *' // Every hour at minute 0
    }
  }
);
```

---

### Data Model

#### Firestore Schema

```typescript
/battles/{battleId}/
  battleKey: string           // Short code (e.g., "K3P9X2")
  battleName: string          // User-entered name
  matchId: string             // UUID for match-state system
  createdBy: string           // User ID of host
  createdAt: Timestamp
  status: 'waiting' | 'starting' | 'active' | 'completed'
  isPublic: boolean
  players: {
    host: {
      userId: string
      displayName: string
      joinedAt: Timestamp
    }
    opponent?: {
      userId: string
      displayName: string
      joinedAt: Timestamp
    }
  }
  settings: {
    maxPlayers: 2
    minCreatures: 3
    maxCreatures: 8
  }

/battleKeys/{shortCode}/
  battleId: string            // Maps short code to battle document
  createdAt: Timestamp
  expiresAt: Timestamp        // Auto-delete after 24h if not started
```

#### In-Memory State (Existing)

```typescript
// backend/src/services/match-state.ts
// Already handles matchId → deployment state
// No changes needed to existing match-state system
```

---

### Match State Enhancement

**CRITICAL: Match state must track user IDs for stats updates**

```typescript
// backend/src/services/match-state.ts (ENHANCEMENT REQUIRED)

interface MatchData {
  matchId: string;
  phase: MatchPhase;
  roundNumber: number;
  phaseStartedAt: Date;
  deploymentStatus: MatchDeploymentStatus;
  player1Placements: CreaturePlacement[];
  player2Placements: CreaturePlacement[];

  // NEW: Track Firebase user IDs for stats updates
  playerUserIds: {
    player1: string;  // Firebase userId (or 'demo-player1')
    player2: string | null;  // null until opponent joins
  };

  // NEW: Link to battle document for metadata
  battleId: string;
}

// Enhanced createMatch function
export function createMatchWithUsers(
  matchId: string,
  battleId: string,
  player1UserId: string,
  roundNumber: number = 1
): MatchState {
  const matchData: MatchData = {
    // ... existing fields ...
    playerUserIds: {
      player1: player1UserId,
      player2: null
    },
    battleId
  };

  activeMatches.set(matchId, matchData);
  return toMatchState(matchData);
}

// Add opponent to match
export function addOpponentToMatch(
  matchId: string,
  player2UserId: string
): boolean {
  const match = activeMatches.get(matchId);
  if (!match) return false;

  match.playerUserIds.player2 = player2UserId;
  return true;
}

// Get user ID for player
export function getPlayerUserId(
  matchId: string,
  playerId: 'player1' | 'player2'
): string | null {
  const match = activeMatches.get(matchId);
  return match?.playerUserIds?.[playerId] || null;
}

// Get battle ID from match
export function getBattleIdFromMatchId(matchId: string): string | null {
  const match = activeMatches.get(matchId);
  return match?.battleId || null;
}
```

---

### Backend API Endpoints

```typescript
// backend/src/api/routes/battles.routes.ts

/**
 * Create a new battle
 *
 * FLOW:
 * 1. Validate user has 3+ creatures
 * 2. Generate battle document in Firestore
 * 3. Create match in match-state system (links battle → match)
 * 4. Return battleKey + matchId + playerId to frontend
 * 5. Frontend navigates to /deployment?matchId=X&playerId=player1
 */
router.post('/api/battles', authenticate, requireNoActiveBattle, async (req: AuthRequest, res) => {
  const { battleName, isPublic = true } = req.body;
  const userId = req.user!.uid;

  // Validate user has minimum creatures
  const creatures = await getCreatureCount(userId);
  if (creatures < 3) {
    return res.status(400).json({
      error: 'INSUFFICIENT_CREATURES',
      message: 'You need at least 3 creatures to create a battle'
    });
  }

  // Generate unique IDs
  const battleId = uuidv4();
  const matchId = uuidv4();
  const battleKey = await generateUniqueBattleKey();

  // Create battle document
  await firestore.doc(`battles/${battleId}`).set({
    battleKey,
    battleName: battleName || 'Quick Battle',
    matchId,
    createdBy: userId,
    createdAt: FieldValue.serverTimestamp(),
    status: 'waiting',
    isPublic,
    players: {
      host: {
        userId,
        displayName: req.user!.displayName,
        joinedAt: FieldValue.serverTimestamp()
      }
    },
    settings: {
      maxPlayers: 2,
      minCreatures: 3,
      maxCreatures: 8
    }
  });

  // Map short code to battle
  await firestore.doc(`battleKeys/${battleKey}`).set({
    battleId,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000))
  });

  // CRITICAL: Create match in match-state system WITH user ID tracking
  // This links the battle document to the match state and enables stats updates
  createMatchWithUsers(matchId, battleId, userId, 1);

  // Broadcast to lobby
  io.of('/lobby').to('lobby-room').emit('lobby:battle-created', {
    battleId,
    battleKey,
    battleName,
    host: req.user!.displayName,
    isPublic
  });

  res.json({
    success: true,
    battleId,
    battleKey,
    matchId,
    playerId: 'player1' // Host is always player1
  });
});

/**
 * Join battle by key
 */
router.post('/api/battles/:battleKey/join', authenticate, requireNoActiveBattle, async (req: AuthRequest, res) => {
  const { battleKey } = req.params;
  const userId = req.user!.uid;

  // Validate battle key format
  if (!/^[A-Z0-9]{6}$/.test(battleKey)) {
    return res.status(400).json({ error: 'Invalid battle key format' });
  }

  // Look up battle ID
  const keyDoc = await firestore.doc(`battleKeys/${battleKey}`).get();
  if (!keyDoc.exists) {
    return res.status(404).json({ error: 'Battle not found' });
  }

  const battleId = keyDoc.data()!.battleId;

  // Get battle document
  const battleDoc = await firestore.doc(`battles/${battleId}`).get();
  if (!battleDoc.exists) {
    return res.status(404).json({ error: 'Battle not found' });
  }

  const battle = battleDoc.data()!;

  // Validate battle status
  if (battle.status !== 'waiting') {
    return res.status(400).json({
      error: 'BATTLE_NOT_AVAILABLE',
      message: 'This battle has already started or is full'
    });
  }

  // Validate not joining own battle
  if (battle.createdBy === userId) {
    return res.status(400).json({
      error: 'CANNOT_JOIN_OWN_BATTLE',
      message: 'You cannot join your own battle'
    });
  }

  // Validate user has minimum creatures
  const creatures = await getCreatureCount(userId);
  if (creatures < 3) {
    return res.status(400).json({
      error: 'INSUFFICIENT_CREATURES',
      message: 'You need at least 3 creatures to join a battle'
    });
  }

  // Add opponent to battle (MAJOR GAP ADDRESSED: Race condition prevention)
  // Use Firestore transaction to atomically check and update
  try {
    await firestore.runTransaction(async (transaction) => {
      const battleRef = firestore.doc(`battles/${battleId}`);
      const battleSnapshot = await transaction.get(battleRef);

      if (!battleSnapshot.exists) {
        throw new Error('BATTLE_NOT_FOUND');
      }

      const currentBattle = battleSnapshot.data()!;

      // Verify still in waiting status (prevents race condition)
      if (currentBattle.status !== 'waiting') {
        throw new Error('BATTLE_ALREADY_FILLED');
      }

      // Atomically add opponent
      transaction.update(battleRef, {
        'players.opponent': {
          userId,
          displayName: req.user!.displayName,
          joinedAt: FieldValue.serverTimestamp()
        },
        status: 'starting'
      });
    });
  } catch (error) {
    if (error.message === 'BATTLE_ALREADY_FILLED') {
      return res.status(400).json({
        error: 'BATTLE_NOT_AVAILABLE',
        message: 'This battle was just filled by another player'
      });
    }
    throw error;
  }

  // CRITICAL: Add opponent to match-state system for stats tracking
  addOpponentToMatch(battle.matchId, userId);

  // Broadcast update to lobby
  io.of('/lobby').to('lobby-room').emit('lobby:battle-filled', {
    battleId,
    battleKey
  });

  res.json({
    success: true,
    battleId,
    matchId: battle.matchId,
    playerId: 'player2' // Opponent is always player2
  });
});

/**
 * Get list of open battles
 */
router.get('/api/battles/open', authenticate, async (req: AuthRequest, res) => {
  const { page = 1, limit = 10 } = req.query;

  const snapshot = await firestore.collection('battles')
    .where('status', '==', 'waiting')
    .where('isPublic', '==', true)
    .orderBy('createdAt', 'desc')
    .limit(Number(limit))
    .offset((Number(page) - 1) * Number(limit))
    .get();

  const battles = snapshot.docs.map(doc => ({
    battleId: doc.id,
    ...doc.data()
  }));

  res.json({
    battles,
    page: Number(page),
    limit: Number(limit),
    total: battles.length
  });
});

/**
 * Quick Play - Auto-match or create
 */
router.post('/api/battles/quick-play', authenticate, requireNoActiveBattle, async (req: AuthRequest, res) => {
  const userId = req.user!.uid;

  // Validate user has minimum creatures
  const creatures = await getCreatureCount(userId);
  if (creatures < 3) {
    return res.status(400).json({
      error: 'INSUFFICIENT_CREATURES',
      message: 'You need at least 3 creatures for Quick Play'
    });
  }

  // Try to find oldest waiting battle
  const snapshot = await firestore.collection('battles')
    .where('status', '==', 'waiting')
    .where('isPublic', '==', true)
    .where('createdBy', '!=', userId) // Don't join own battles
    .orderBy('createdAt', 'asc')
    .limit(1)
    .get();

  if (!snapshot.empty) {
    // Join existing battle
    const battle = snapshot.docs[0];
    const battleData = battle.data();

    // Add opponent
    await battle.ref.update({
      'players.opponent': {
        userId,
        displayName: req.user!.displayName,
        joinedAt: FieldValue.serverTimestamp()
      },
      status: 'starting'
    });

    // Broadcast
    io.of('/lobby').to('lobby-room').emit('lobby:battle-filled', {
      battleId: battle.id,
      battleKey: battleData.battleKey
    });

    return res.json({
      success: true,
      action: 'joined',
      battleId: battle.id,
      battleKey: battleData.battleKey,
      matchId: battleData.matchId,
      playerId: 'player2'
    });
  }

  // No battles available - create one
  const battleId = uuidv4();
  const matchId = uuidv4();
  const battleKey = await generateUniqueBattleKey();

  await firestore.doc(`battles/${battleId}`).set({
    battleKey,
    battleName: 'Quick Battle',
    matchId,
    createdBy: userId,
    createdAt: FieldValue.serverTimestamp(),
    status: 'waiting',
    isPublic: true,
    players: {
      host: {
        userId,
        displayName: req.user!.displayName,
        joinedAt: FieldValue.serverTimestamp()
      }
    },
    settings: {
      maxPlayers: 2,
      minCreatures: 3,
      maxCreatures: 8
    }
  });

  await firestore.doc(`battleKeys/${battleKey}`).set({
    battleId,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000))
  });

  createMatch(matchId, 1);

  io.of('/lobby').to('lobby-room').emit('lobby:battle-created', {
    battleId,
    battleKey,
    battleName: 'Quick Battle',
    host: req.user!.displayName,
    isPublic: true
  });

  res.json({
    success: true,
    action: 'created',
    battleId,
    battleKey,
    matchId,
    playerId: 'player1'
  });
});

/**
 * Leave battle (before it starts)
 */
router.post('/api/battles/:battleId/leave', authenticate, async (req: AuthRequest, res) => {
  const { battleId } = req.params;
  const userId = req.user!.uid;

  const battleDoc = await firestore.doc(`battles/${battleId}`).get();
  if (!battleDoc.exists) {
    return res.status(404).json({ error: 'Battle not found' });
  }

  const battle = battleDoc.data()!;

  if (battle.status !== 'waiting') {
    return res.status(400).json({ error: 'Battle has already started' });
  }

  // If host leaves, delete battle
  if (battle.createdBy === userId) {
    await firestore.doc(`battles/${battleId}`).delete();
    await firestore.doc(`battleKeys/${battle.battleKey}`).delete();
    deleteMatch(battle.matchId);

    io.of('/lobby').to('lobby-room').emit('lobby:battle-cancelled', {
      battleId,
      battleKey: battle.battleKey
    });
  } else {
    // Opponent leaves - just remove them
    await battleDoc.ref.update({
      'players.opponent': FieldValue.delete(),
      status: 'waiting'
    });

    io.of('/lobby').to('lobby-room').emit('lobby:battle-updated', {
      battleId,
      battleKey: battle.battleKey
    });
  }

  res.json({ success: true });
});
```

---

### Socket.IO Lobby Namespace

```typescript
// backend/src/sockets/lobby-socket.ts

export function setupLobbySocket(io: Server) {
  const lobbyNamespace = io.of('/lobby');

  lobbyNamespace.on('connection', (socket) => {
    console.log(`[Lobby] Client connected: ${socket.id}`);

    // Subscribe to lobby updates
    socket.on('lobby:subscribe', () => {
      socket.join('lobby-room');
      console.log(`[Lobby] Client subscribed: ${socket.id}`);

      // Send current open battles
      getOpenBattles().then(battles => {
        socket.emit('lobby:battles', battles);
      });
    });

    // Unsubscribe
    socket.on('lobby:unsubscribe', () => {
      socket.leave('lobby-room');
      console.log(`[Lobby] Client unsubscribed: ${socket.id}`);
    });

    socket.on('disconnect', () => {
      console.log(`[Lobby] Client disconnected: ${socket.id}`);
    });
  });

  return lobbyNamespace;
}

async function getOpenBattles() {
  const snapshot = await firestore.collection('battles')
    .where('status', '==', 'waiting')
    .where('isPublic', '==', true)
    .orderBy('createdAt', 'desc')
    .limit(20)
    .get();

  return snapshot.docs.map(doc => ({
    battleId: doc.id,
    ...doc.data()
  }));
}
```

**Events Emitted:**
- `lobby:battle-created` - New battle created
- `lobby:battle-filled` - Battle got second player (removed from list)
- `lobby:battle-updated` - Battle info changed
- `lobby:battle-cancelled` - Battle deleted by host

---

### Frontend Integration

```typescript
// frontend/src/services/lobby-socket.ts
import { io, Socket } from 'socket.io-client';

class LobbySocket {
  private socket: Socket | null = null;

  connect() {
    this.socket = io(`${WS_URL}/lobby`, {
      auth: async (cb) => {
        const token = await getIdToken();
        cb({ token });
      }
    });

    this.socket.on('connect', () => {
      console.log('[Lobby] Connected');
      this.subscribe();
    });

    return this.socket;
  }

  subscribe() {
    this.socket?.emit('lobby:subscribe');
  }

  onBattles(callback: (battles: Battle[]) => void) {
    this.socket?.on('lobby:battles', callback);
  }

  onBattleCreated(callback: (battle: Battle) => void) {
    this.socket?.on('lobby:battle-created', callback);
  }

  onBattleFilled(callback: (data: { battleId: string }) => void) {
    this.socket?.on('lobby:battle-filled', callback);
  }

  disconnect() {
    this.socket?.emit('lobby:unsubscribe');
    this.socket?.disconnect();
  }
}

export const lobbySocket = new LobbySocket();
```

**Usage in Component:**
```typescript
// frontend/src/pages/BrowseBattlesPage.tsx
export function BrowseBattlesPage() {
  const [battles, setBattles] = useState<Battle[]>([]);

  useEffect(() => {
    lobbySocket.connect();

    lobbySocket.onBattles(setBattles);

    lobbySocket.onBattleCreated((battle) => {
      setBattles(prev => [battle, ...prev]);
    });

    lobbySocket.onBattleFilled(({ battleId }) => {
      setBattles(prev => prev.filter(b => b.battleId !== battleId));
    });

    return () => lobbySocket.disconnect();
  }, []);

  return (
    <BattlesList>
      {battles.map(battle => (
        <BattleCard key={battle.battleId} battle={battle} />
      ))}
    </BattlesList>
  );
}
```

---

## UI Components

### Create Battle Modal

```tsx
<CreateBattleModal>
  <Input
    label="Battle Name"
    placeholder="Epic Showdown"
    value={battleName}
    onChange={setBattleName}
    maxLength={50}
  />

  <Toggle
    label="Public Battle"
    description="Other players can find and join this battle"
    checked={isPublic}
    onChange={setIsPublic}
  />

  {!isPublic && (
    <Info>
      Share the battle key with your friend to let them join.
    </Info>
  )}

  <ButtonGroup>
    <Button onClick={onCancel} variant="secondary">Cancel</Button>
    <Button onClick={handleCreate} variant="primary">Create Battle</Button>
  </ButtonGroup>
</CreateBattleModal>
```

### Open Battles List

```tsx
<OpenBattlesList>
  {battles.length === 0 ? (
    <EmptyState>
      <Text>No open battles</Text>
      <Button onClick={createBattle}>Create New Battle</Button>
    </EmptyState>
  ) : (
    battles.map(battle => (
      <BattleCard key={battle.battleId}>
        <BattleInfo>
          <BattleName>{battle.battleName}</BattleName>
          <HostInfo>
            Hosted by {battle.players.host.displayName}
          </HostInfo>
          <TimeAgo>{formatRelativeTime(battle.createdAt)}</TimeAgo>
        </BattleInfo>
        <BattleActions>
          <BattleKey>{battle.battleKey}</BattleKey>
          <Button onClick={() => joinBattle(battle.battleKey)}>
            Join Battle
          </Button>
        </BattleActions>
      </BattleCard>
    ))
  )}
</OpenBattlesList>
```

---

## Middleware: Require No Active Battle

```typescript
// backend/src/middleware/battle.middleware.ts
export async function requireNoActiveBattle(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const userId = req.user!.uid;

  // Check for active battle
  const snapshot = await firestore.collection('battles')
    .where('status', 'in', ['waiting', 'starting', 'active'])
    .where('createdBy', '==', userId)
    .limit(1)
    .get();

  if (!snapshot.empty) {
    const battle = snapshot.docs[0].data();
    return res.status(409).json({
      error: 'BATTLE_IN_PROGRESS',
      message: 'You already have an active battle',
      activeBattle: {
        battleId: snapshot.docs[0].id,
        battleKey: battle.battleKey,
        matchId: battle.matchId
      }
    });
  }

  // Also check if player is opponent in any battle
  const opponentSnapshot = await firestore.collection('battles')
    .where('status', 'in', ['waiting', 'starting', 'active'])
    .where('players.opponent.userId', '==', userId)
    .limit(1)
    .get();

  if (!opponentSnapshot.empty) {
    const battle = opponentSnapshot.docs[0].data();
    return res.status(409).json({
      error: 'BATTLE_IN_PROGRESS',
      message: 'You already have an active battle',
      activeBattle: {
        battleId: opponentSnapshot.docs[0].id,
        battleKey: battle.battleKey,
        matchId: battle.matchId
      }
    });
  }

  next();
}
```

---

## Battle Lifecycle

```
1. Host creates battle
   → Status: 'waiting'
   → Appears in open battles list (if public)

2. Opponent joins
   → Status: 'starting'
   → Removed from open battles list
   → Both players redirect to /deployment

3. Deployment completes
   → Status: 'active'
   → Combat begins

4. Combat completes
   → Status: 'completed'
   → Battle document archived
   → Stats updated
```

---

## Testing Strategy

### Unit Tests
- [ ] Battle key generator creates 6-character codes
- [ ] Battle key generator avoids collisions
- [ ] Quick Play joins oldest battle if available
- [ ] Quick Play creates new battle if none available

### Integration Tests
- [ ] Create battle API works
- [ ] Join by key API validates key format
- [ ] Cannot join own battle
- [ ] Cannot join if already in active battle

### E2E Tests
- [ ] Full flow: Create → Share key → Join → Deploy
- [ ] Quick Play matches two players
- [ ] Battle list updates in real-time

---

## Success Metrics

- Battle creation success rate: >99%
- Time to find match (Quick Play): <30 seconds
- Battle key collision rate: 0%
- Real-time update latency: <500ms

---

## Related Documents

- Planning: `docs/active/L3-FEATURES/homepage-hub-battle-lobby-planning.md`
- Homepage UI: `docs/specs/L3-FEATURES/homepage-hub/homepage-hub-ui.md`
- Stats Tracking: `docs/specs/L3-FEATURES/homepage-hub/stats-tracking-system.md`
