# L3 Feature: Stats Tracking System

**Epic**: Matchmaking & Session Management
**Feature ID**: STATS-001
**Status**: Partially Implemented
**Created**: 2025-10-25
**Last Updated**: 2025-01-25

---

## Overview

Implement a reliable stats tracking system that persists battle results, updates player statistics, and maintains battle history using BullMQ queues for fault tolerance.

---

## User Story

**As a** player
**I want to** see my win/loss record and battle history
**So that** I can track my progress and improve my performance

---

## Acceptance Criteria

### Must Have (MVP)
- [ ] Battle results persisted to Firestore after combat completes - Pending
- [ ] Player stats updated atomically (no race conditions) - Pending
- [ ] Win/loss counters increment correctly - Pending
- [ ] Win streak tracking (current and best) - Pending
- [ ] Battle history stored per user (subcollection) - Pending
- [ ] Stats update via BullMQ queue (fault tolerant with retries) - Pending
- [ ] Disconnects tracked separately from losses - Pending
- [x] Stats API returns current user stats - Implemented
- [ ] Battle history API with pagination - Pending

**Implementation Status**:
- ✅ Implemented: User profile creation with stats initialization, GET /api/users/me/profile endpoint
- ⏳ Pending: Battle result processing queue, stats update logic, battle history subcollections, win streak calculations

### Should Have (Post-MVP)
- [ ] Per-creature stats (most wins, highest damage, etc.)
- [ ] Achievement/badge system
- [ ] Leaderboards (opt-in)
- [ ] Detailed combat analytics (damage dealt, abilities used, etc.)

### Won't Have (Out of Scope)
- Real-time stats during battle
- Elo/MMR rating system
- Replays

---

## Technical Specification

### Data Model

#### Firestore Schema

```typescript
/users/{userId}/
  profile: {
    displayName: string
    email: string
    photoURL?: string
    createdAt: Timestamp
    lastLoginAt: Timestamp
    stats: {
      wins: number                    // Atomic counter
      losses: number                  // Atomic counter
      disconnects: number             // Separate from losses
      totalBattles: number
      currentWinStreak: number
      bestWinStreak: number
      totalDamageDealt: number        // (Post-MVP)
      totalCreaturesDeployed: number  // (Post-MVP)
    }
  }

/battles/{battleId}/
  battleKey: string
  battleName: string
  matchId: string
  players: {
    player1: {
      userId: string
      displayName: string
      creaturesDeployed: string[]     // Creature IDs
      damageDealt?: number            // (Post-MVP)
    }
    player2: {
      userId: string
      displayName: string
      creaturesDeployed: string[]
      damageDealt?: number
    }
  }
  result: {
    winner: 'player1' | 'player2'
    winnerUserId: string
    loserUserId: string
    endReason: 'victory' | 'forfeit' | 'disconnect'
    duration: number (seconds)
    finalTick: number
  }
  createdAt: Timestamp
  startedAt: Timestamp
  completedAt: Timestamp

/users/{userId}/battleHistory/ (subcollection)
  /{battleId}: {
    battleKey: string
    battleName: string
    opponent: {
      userId: string
      displayName: string
    }
    result: 'win' | 'loss'
    endReason: 'victory' | 'forfeit' | 'disconnect'
    creaturesDeployed: string[]
    date: Timestamp
    duration: number
  }
```

---

### BullMQ Queue for Stats Updates

```typescript
// backend/src/queue/battle-results-queue.ts
import { Queue, Worker } from 'bullmq';
import { redis } from '../config/redis';
import { firestore } from '../config/firebase.config';
import { FieldValue } from 'firebase-admin/firestore';

interface BattleResultJob {
  battleId: string;
  matchId: string;
  winner: 'player1' | 'player2';
  loser: 'player1' | 'player2';
  endReason: 'victory' | 'forfeit' | 'disconnect';
  duration: number;
  finalTick: number;
  players: {
    player1: {
      userId: string;
      displayName: string;
      creaturesDeployed: string[];
    };
    player2: {
      userId: string;
      displayName: string;
      creaturesDeployed: string[];
    };
  };
}

export const battleResultsQueue = new Queue('battle-results', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: {
      age: 24 * 60 * 60 // Keep completed jobs for 24 hours
    },
    removeOnFail: {
      age: 7 * 24 * 60 * 60 // Keep failed jobs for 7 days
    }
  }
});

export const battleResultsWorker = new Worker(
  'battle-results',
  async (job) => {
    const data: BattleResultJob = job.data;

    console.log(`[Stats] Processing battle result: ${data.battleId}`);

    await processBattleResult(data);

    console.log(`[Stats] Completed battle result: ${data.battleId}`);
  },
  {
    connection: redis,
    concurrency: 5
  }
);

async function processBattleResult(data: BattleResultJob) {
  const winnerId = data.players[data.winner].userId;
  const loserId = data.players[data.loser].userId;
  const winnerData = data.players[data.winner];
  const loserData = data.players[data.loser];

  // Get battle document for metadata
  const battleSnapshot = await firestore.doc(`battles/${data.battleId}`).get();
  const battleMeta = battleSnapshot.exists ? battleSnapshot.data() : {};

  // Use batch for atomic updates
  const batch = firestore.batch();

  // 1. Store battle result document
  const battleRef = firestore.doc(`battles/${data.battleId}`);
  batch.set(battleRef, {
    battleKey: battleMeta?.battleKey || '',
    battleName: battleMeta?.battleName || 'Battle',
    matchId: data.matchId,
    players: {
      player1: data.players.player1,
      player2: data.players.player2
    },
    result: {
      winner: data.winner,
      winnerUserId: winnerId,
      loserUserId: loserId,
      endReason: data.endReason,
      duration: data.duration,
      finalTick: data.finalTick
    },
    createdAt: battleMeta?.createdAt || FieldValue.serverTimestamp(),
    startedAt: battleMeta?.startedAt || FieldValue.serverTimestamp(),
    completedAt: FieldValue.serverTimestamp()
  });

  // 2. Update winner stats
  const winnerProfileRef = firestore.doc(`users/${winnerId}/profile`);
  const winnerProfile = await winnerProfileRef.get();
  const currentWinnerStreak = winnerProfile.data()?.stats?.currentWinStreak || 0;
  const bestWinnerStreak = winnerProfile.data()?.stats?.bestWinStreak || 0;
  const newWinStreak = currentWinnerStreak + 1;

  batch.update(winnerProfileRef, {
    'stats.wins': FieldValue.increment(1),
    'stats.totalBattles': FieldValue.increment(1),
    'stats.currentWinStreak': newWinStreak,
    'stats.bestWinStreak': Math.max(newWinStreak, bestWinnerStreak),
    'stats.totalCreaturesDeployed': FieldValue.increment(winnerData.creaturesDeployed.length)
  });

  // 3. Update loser stats
  const loserProfileRef = firestore.doc(`users/${loserId}/profile`);

  if (data.endReason === 'disconnect') {
    // Disconnect doesn't count as loss, but resets streak
    batch.update(loserProfileRef, {
      'stats.disconnects': FieldValue.increment(1),
      'stats.totalBattles': FieldValue.increment(1),
      'stats.currentWinStreak': 0,
      'stats.totalCreaturesDeployed': FieldValue.increment(loserData.creaturesDeployed.length)
    });
  } else {
    // Normal loss
    batch.update(loserProfileRef, {
      'stats.losses': FieldValue.increment(1),
      'stats.totalBattles': FieldValue.increment(1),
      'stats.currentWinStreak': 0,
      'stats.totalCreaturesDeployed': FieldValue.increment(loserData.creaturesDeployed.length)
    });
  }

  // 4. Add to winner's battle history
  const winnerHistoryRef = firestore.doc(`users/${winnerId}/battleHistory/${data.battleId}`);
  batch.set(winnerHistoryRef, {
    battleKey: battleMeta?.battleKey || '',
    battleName: battleMeta?.battleName || 'Battle',
    opponent: {
      userId: loserId,
      displayName: loserData.displayName
    },
    result: 'win',
    endReason: data.endReason,
    creaturesDeployed: winnerData.creaturesDeployed,
    date: FieldValue.serverTimestamp(),
    duration: data.duration
  });

  // 5. Add to loser's battle history
  const loserHistoryRef = firestore.doc(`users/${loserId}/battleHistory/${data.battleId}`);
  batch.set(loserHistoryRef, {
    battleKey: battleMeta?.battleKey || '',
    battleName: battleMeta?.battleName || 'Battle',
    opponent: {
      userId: winnerId,
      displayName: winnerData.displayName
    },
    result: 'loss',
    endReason: data.endReason,
    creaturesDeployed: loserData.creaturesDeployed,
    date: FieldValue.serverTimestamp(),
    duration: data.duration
  });

  // Commit all updates atomically
  await batch.commit();

  console.log(`[Stats] Updated stats for winner: ${winnerId}, loser: ${loserId}`);
}
```

---

### Integration with Combat Engine

```typescript
// backend/src/services/combat/combat-engine.ts (modified)

// When combat completes
function onCombatComplete(matchId: string, result: CombatResult) {
  // ... existing code ...

  // Get player IDs from deployment state
  const deployment = getDeploymentState(matchId);
  const player1UserId = getUserIdForPlayer(matchId, 'player1');
  const player2UserId = getUserIdForPlayer(matchId, 'player2');

  // Queue battle result for processing
  battleResultsQueue.add('process-result', {
    battleId: getBattleIdFromMatchId(matchId),
    matchId,
    winner: result.winner,
    loser: result.winner === 'player1' ? 'player2' : 'player1',
    endReason: result.reason,
    duration: result.duration,
    finalTick: result.tick,
    players: {
      player1: {
        userId: player1UserId,
        displayName: getPlayerDisplayName(player1UserId),
        creaturesDeployed: deployment.player1.placements.map(p => p.creature.id)
      },
      player2: {
        userId: player2UserId,
        displayName: getPlayerDisplayName(player2UserId),
        creaturesDeployed: deployment.player2.placements.map(p => p.creature.id)
      }
    }
  });
}
```

**Important:** Need to track userId alongside playerId in deployment/match state.

---

### Tracking User ID in Match State

```typescript
// backend/src/services/match-state.ts (enhancement)

interface MatchData {
  matchId: string;
  phase: MatchPhase;
  roundNumber: number;
  phaseStartedAt: Date;
  deploymentStatus: MatchDeploymentStatus;
  player1Placements: CreaturePlacement[];
  player2Placements: CreaturePlacement[];

  // NEW: Track actual user IDs
  playerUserIds?: {
    player1: string;
    player2: string;
  };
}

// When battle is created, store user IDs
export function createMatchWithUsers(
  matchId: string,
  player1UserId: string,
  player2UserId: string
): MatchState {
  // ... existing code ...

  matchData.playerUserIds = {
    player1: player1UserId,
    player2: player2UserId
  };

  // ...
}

export function getPlayerUserId(matchId: string, playerId: 'player1' | 'player2'): string | null {
  const match = activeMatches.get(matchId);
  return match?.playerUserIds?.[playerId] || null;
}
```

---

### API Endpoints

```typescript
// backend/src/api/routes/stats.routes.ts

/**
 * Get current user's stats
 */
router.get('/api/users/me/stats', authenticate, async (req: AuthRequest, res) => {
  const userId = req.user!.uid;

  const profileDoc = await firestore.doc(`users/${userId}/profile`).get();

  if (!profileDoc.exists) {
    return res.status(404).json({ error: 'Profile not found' });
  }

  const profile = profileDoc.data()!;

  res.json({
    stats: profile.stats,
    displayName: profile.displayName
  });
});

/**
 * Get battle history (paginated)
 */
router.get('/api/users/me/battles', authenticate, async (req: AuthRequest, res) => {
  const userId = req.user!.uid;
  const { page = 1, limit = 20, result } = req.query;

  let query = firestore.collection(`users/${userId}/battleHistory`)
    .orderBy('date', 'desc');

  // Filter by result if specified
  if (result === 'win' || result === 'loss') {
    query = query.where('result', '==', result);
  }

  const snapshot = await query
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
 * Get specific battle details
 */
router.get('/api/battles/:battleId', authenticate, async (req: AuthRequest, res) => {
  const { battleId } = req.params;
  const userId = req.user!.uid;

  const battleDoc = await firestore.doc(`battles/${battleId}`).get();

  if (!battleDoc.exists) {
    return res.status(404).json({ error: 'Battle not found' });
  }

  const battle = battleDoc.data()!;

  // Verify user was in this battle
  if (
    battle.result.winnerUserId !== userId &&
    battle.result.loserUserId !== userId
  ) {
    return res.status(403).json({ error: 'Not authorized to view this battle' });
  }

  res.json(battle);
});
```

---

### Disconnect Handling

```typescript
// backend/src/sockets/combat-socket.ts (enhancement)

socket.on('disconnect', (reason) => {
  const matchId = getMatchIdForSocket(socket.id);
  if (!matchId) return;

  const playerId = getPlayerIdForSocket(socket.id);
  const userId = getPlayerUserId(matchId, playerId);

  console.log(`[Combat] Player ${playerId} disconnected: ${reason}`);

  // Give 30s grace period
  const disconnectTimer = setTimeout(async () => {
    if (!isPlayerReconnected(socket.id)) {
      console.log(`[Combat] Player ${playerId} failed to reconnect, forfeiting`);

      // Stop combat
      await combatStateManager.stopCombat(matchId);

      // Determine winner (opponent)
      const winner = playerId === 'player1' ? 'player2' : 'player1';

      // Queue stats update with disconnect reason
      const deployment = getDeploymentState(matchId);
      battleResultsQueue.add('process-result', {
        battleId: getBattleIdFromMatchId(matchId),
        matchId,
        winner,
        loser: playerId,
        endReason: 'disconnect',
        duration: getCombatDuration(matchId),
        finalTick: getCurrentTick(matchId),
        players: {
          player1: {
            userId: getPlayerUserId(matchId, 'player1'),
            displayName: getPlayerDisplayName('player1'),
            creaturesDeployed: deployment.player1.placements.map(p => p.creature.id)
          },
          player2: {
            userId: getPlayerUserId(matchId, 'player2'),
            displayName: getPlayerDisplayName('player2'),
            creaturesDeployed: deployment.player2.placements.map(p => p.creature.id)
          }
        }
      });
    }
  }, 30000);

  disconnectTimers.set(socket.id, disconnectTimer);
});

// Reconnect handling
socket.on('reconnect', () => {
  const timer = disconnectTimers.get(socket.id);
  if (timer) {
    clearTimeout(timer);
    disconnectTimers.delete(socket.id);
    console.log(`[Combat] Player reconnected in time`);
  }
});
```

---

## Frontend Integration

### Custom Hook: useUserStats

```typescript
// frontend/src/hooks/useUserStats.ts
import { useQuery } from '@tanstack/react-query';

export function useUserStats(userId: string) {
  return useQuery({
    queryKey: ['stats', userId],
    queryFn: async () => {
      const token = await getIdToken();
      const response = await fetch('/api/users/me/stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }

      return response.json();
    },
    staleTime: 60000, // Cache for 1 minute
    refetchOnWindowFocus: true
  });
}
```

### Custom Hook: useBattleHistory

```typescript
// frontend/src/hooks/useBattleHistory.ts
export function useBattleHistory(page: number = 1, limit: number = 20, filter?: 'win' | 'loss') {
  return useQuery({
    queryKey: ['battleHistory', page, limit, filter],
    queryFn: async () => {
      const token = await getIdToken();
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(filter && { result: filter })
      });

      const response = await fetch(`/api/users/me/battles?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      return response.json();
    }
  });
}
```

---

## UI Components

### Profile Page (Detailed Stats)

```tsx
// frontend/src/pages/ProfilePage.tsx
export function ProfilePage() {
  const { user } = useAuth();
  const { data: stats } = useUserStats(user.uid);
  const { data: history } = useBattleHistory(1, 10);

  return (
    <ProfileLayout>
      <NavBar />

      <ProfileHeader>
        <Avatar src={user.photoURL} size="large" />
        <DisplayName>{user.displayName}</DisplayName>
      </ProfileHeader>

      <StatsSection>
        <StatCard>
          <Label>Total Battles</Label>
          <Value>{stats.totalBattles}</Value>
        </StatCard>
        <StatCard>
          <Label>Wins</Label>
          <Value className="success">{stats.wins}</Value>
        </StatCard>
        <StatCard>
          <Label>Losses</Label>
          <Value className="danger">{stats.losses}</Value>
        </StatCard>
        <StatCard>
          <Label>Win Rate</Label>
          <Value>
            {((stats.wins / stats.totalBattles) * 100).toFixed(1)}%
          </Value>
        </StatCard>
        <StatCard>
          <Label>Best Streak</Label>
          <Value>{stats.bestWinStreak}</Value>
        </StatCard>
      </StatsSection>

      <BattleHistorySection>
        <SectionHeader>
          <Title>Recent Battles</Title>
          <FilterButtons>
            <FilterButton onClick={() => setFilter(undefined)}>All</FilterButton>
            <FilterButton onClick={() => setFilter('win')}>Wins</FilterButton>
            <FilterButton onClick={() => setFilter('loss')}>Losses</FilterButton>
          </FilterButtons>
        </SectionHeader>

        <BattleHistoryTable>
          {history.battles.map(battle => (
            <BattleRow key={battle.battleId}>
              <BattleDate>{formatDate(battle.date)}</BattleDate>
              <OpponentName>{battle.opponent.displayName}</OpponentName>
              <BattleResult className={battle.result}>
                {battle.result === 'win' ? '✓ Win' : '✗ Loss'}
              </BattleResult>
              <BattleDuration>{formatDuration(battle.duration)}</BattleDuration>
            </BattleRow>
          ))}
        </BattleHistoryTable>
      </BattleHistorySection>
    </ProfileLayout>
  );
}
```

---

## Error Handling & Retries

### BullMQ Retry Strategy
- Attempts: 3
- Backoff: Exponential (2s, 4s, 8s)
- Failed jobs retained for 7 days for debugging

### Dead Letter Queue
```typescript
battleResultsWorker.on('failed', (job, err) => {
  console.error(`[Stats] Battle result failed: ${job?.id}`, err);

  // Alert if multiple consecutive failures
  if (recentFailureCount > 5) {
    sendAdminAlert('Stats processing failing repeatedly');
  }
});
```

---

## Testing Strategy

### Unit Tests
- [ ] Battle results queue adds jobs correctly
- [ ] Stats update increments counters atomically
- [ ] Win streak logic works correctly
- [ ] Disconnect doesn't count as loss

### Integration Tests
- [ ] Combat completion triggers stats queue
- [ ] Stats API returns correct data
- [ ] Battle history pagination works

### E2E Tests
- [ ] Full battle → Stats update → View on profile
- [ ] Disconnect handling updates stats correctly

---

## Success Metrics

- Stats update success rate: >99.9%
- Stats update latency: <5 seconds from battle end
- Battle history query time: <500ms
- Data consistency: 100% (no race conditions)

---

## Related Documents

- Planning: `docs/active/L3-FEATURES/homepage-hub-battle-lobby-planning.md`
- Homepage UI: `docs/specs/L3-FEATURES/homepage-hub/homepage-hub-ui.md`
- Battle Lobby: `docs/specs/L3-FEATURES/homepage-hub/battle-lobby-system.md`
- Auth: `docs/specs/L3-FEATURES/homepage-hub/firebase-auth-integration.md`
