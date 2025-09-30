# L1-THEME: Matchmaking & Session Management

## Purpose

The Matchmaking & Session Management theme owns the complete player pairing, lobby coordination, and battle session lifecycle management. This theme bridges the gap between creature creation and combat—ensuring players find opponents, battles start smoothly, and sessions are properly managed from initiation through cleanup. It encompasses matchmaking queues, lobby systems, session state management, disconnection handling, and post-battle result processing.

This theme is essential because even perfect creature creation and battle systems fail if players cannot reliably find matches and start battles. The "Fast to Fun" principle (under 2 minutes from launch to first battle) depends on this theme working efficiently. Poor matchmaking creates dead queues, long wait times, and frustrated players who leave before experiencing combat.

## Scope

### Included

- **Matchmaking Queue System**
  - Queue entry with creature validation (must have valid creature)
  - Simple pairing algorithm (first-come-first-served for MVP)
  - Queue position and estimated wait time display
  - Queue cancellation and re-entry handling
  - Timeout management (remove inactive players from queue)

- **Lobby & Pre-Battle Coordination**
  - Lobby creation when match found
  - Player readiness confirmation
  - Countdown timer before battle start
  - Lobby abandonment detection (player leaves before ready)
  - Replacement matchmaking if lobby fails

- **Battle Session Lifecycle**
  - Session initialization and resource allocation
  - Player connection management
  - Session state tracking (deployment, combat, finished)
  - Session timeout handling
  - Session cleanup and resource deallocation

- **Connection & Disconnection Management**
  - WebSocket connection establishment per session
  - Heartbeat/ping monitoring
  - Disconnection detection and grace period
  - Reconnection handling with state restoration
  - Forfeit declaration on prolonged disconnection

- **Post-Battle Processing**
  - Battle result recording
  - Statistics calculation and storage
  - Return-to-lobby or rematch options
  - Session archival

- **Session State Synchronization**
  - Persistent session state in Redis
  - State recovery on server restart
  - Multi-server session awareness (if scaled horizontally)

### Explicitly Excluded

- **Ranked Matchmaking/ELO**: No skill-based matching for MVP (post-MVP)
- **Team Battles**: No 2v2 or larger team modes (post-MVP)
- **Custom Lobbies**: No private room codes or friend invites (post-MVP)
- **Matchmaking Preferences**: No region selection, connection quality filtering (post-MVP)
- **Queue Priority Systems**: No premium queue, streak bonuses, or priority (post-MVP)
- **Advanced Pairing Algorithms**: No balancing by creature power, player behavior (post-MVP)
- **In-Queue Chat**: No communication with other queued players (post-MVP)
- **Spectator Join-In-Progress**: No joining ongoing battles to spectate (post-MVP)
- **Rematch Continuity**: No persistent "best of 3" or tournament tracking (post-MVP)

## Key User Journeys

1. **Standard Matchmaking**: Player completes creature creation → clicks "Find Battle" → enters queue → sees queue position (3rd) → waits 15 seconds → match found → lobby appears with opponent → both players ready → 3-second countdown → battle begins

2. **Quick Rematch**: Battle ends → victory screen → player clicks "Rematch" → if opponent also clicks "Rematch", instant lobby → if not, returns to queue → finds new opponent

3. **Queue Cancellation**: Player enters queue → waits 30 seconds → decides to modify creature → clicks "Cancel" → returns to creation → finishes changes → re-enters queue → match found immediately

4. **Lobby Abandonment**: Match found → lobby created → opponent doesn't click "Ready" within 15 seconds → lobby disbanded → player automatically re-enters queue → finds new opponent

5. **Mid-Battle Disconnection**: Battle in progress → player's internet drops → disconnection detected → server waits 15 seconds → player reconnects → session state restored → battle continues from current state

6. **Disconnection Forfeit**: Battle in progress → opponent disconnects → 30-second grace period → opponent doesn't reconnect → server declares forfeit → player wins → victory screen shown

## Technical Architecture

### Components

**Backend Services (Node.js)**
- `MatchmakingQueue`: Manages active queue of players seeking matches
- `PairingEngine`: Pairs players from queue (simple FIFO for MVP)
- `LobbyManager`: Creates and manages pre-battle lobbies
- `SessionManager`: Tracks active battle sessions
- `ConnectionRegistry`: Maps players to WebSocket connections
- `HeartbeatMonitor`: Pings connections to detect disconnections
- `SessionCleanupWorker`: Background job for cleanup and timeouts
- `ReconnectionHandler`: Manages disconnection grace periods and state restoration

**Data Management**
- `SessionStore`: Redis-based session state persistence
- `QueueStore`: Redis-based queue state with TTL
- `BattleArchiver`: PostgreSQL storage for completed battle results

**API Layer**
- `MatchmakingAPI`: REST endpoints for queue entry/exit
- `LobbyAPI`: WebSocket events for lobby coordination
- `SessionAPI`: WebSocket events for battle session communication

### Key Technologies

- **Redis**: Queue state, session state, connection registry
- **Socket.io**: WebSocket management for real-time communication
- **PostgreSQL**: Battle result archival and analytics
- **BullMQ**: Background jobs for cleanup and timeouts
- **Node.js Cluster**: Horizontal scaling with session affinity

### Data Model

**Primary Entities**
```typescript
interface QueueEntry {
  playerId: string;
  creatureId: string;
  enteredAt: Date;
  estimatedWaitTime: number; // seconds
  status: 'queued' | 'matched' | 'cancelled';
}

interface MatchmakingQueue {
  queueId: string; // global queue or multiple queues
  entries: QueueEntry[];
  averageWaitTime: number;
  activeMatching: boolean;
}

interface Lobby {
  lobbyId: string;
  players: [LobbyPlayer, LobbyPlayer];
  createdAt: Date;
  status: 'waiting_ready' | 'countdown' | 'starting' | 'abandoned';
  countdownStartedAt?: Date;
  expiresAt: Date; // auto-disband if not ready
}

interface LobbyPlayer {
  playerId: string;
  creatureId: string;
  isReady: boolean;
  connectionStatus: 'connected' | 'disconnected';
}

interface BattleSession {
  sessionId: string;
  battleId: string;
  lobbyId: string;
  players: [SessionPlayer, SessionPlayer];
  startedAt: Date;
  lastActivityAt: Date;
  status: 'active' | 'paused' | 'finished' | 'abandoned';
  serverNode?: string; // for horizontal scaling
}

interface SessionPlayer {
  playerId: string;
  creatureId: string;
  socketId: string;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  lastHeartbeatAt: Date;
  disconnectedAt?: Date;
  reconnectionAttempts: number;
}

interface DisconnectionGracePeriod {
  sessionId: string;
  playerId: string;
  disconnectedAt: Date;
  gracePeriodSeconds: number; // 30 for MVP
  forfeitAt: Date;
}

interface BattleArchive {
  battleId: string;
  sessionId: string;
  players: [PlayerId, PlayerId];
  winner: PlayerId;
  finishedAt: Date;
  duration: number; // seconds
  disconnectionEvents: DisconnectionEvent[];
  finalStatistics: BattleStatistics;
}
```

**Key Relationships**
- One QueueEntry → One Lobby (when matched)
- One Lobby → One BattleSession (when both ready)
- One BattleSession → One BattleArchive (when finished)
- Many BattleSession distributed across server nodes (horizontal scaling)

## Dependencies

### Depends On

- **Creature Creation Experience** (L1): Must have valid creature before entering queue
- **AI Generation Pipeline** (L1): Validates creature exists and is complete
- **Platform Infrastructure** (L1): WebSocket infrastructure, Redis, monitoring
- **Battle Engine** (L1): Initiates battle sessions and receives results

### Depended On By

- **Battle Engine** (L1): Consumes matched players and session initialization
- All gameplay features require successful matchmaking

## Key Technical Challenges

1. **Fast Matchmaking Under Low Population**: With small player base at launch, ensuring matches form quickly without waiting for "perfect" pairings. May need bot opponents or incentivize off-peak play to maintain queue velocity.

2. **Lobby Abandonment Edge Cases**: Handling complex scenarios where one player readies, other disconnects, first player wants rematch but second is gone. Requires clear state machine and fast recovery paths.

3. **Graceful Disconnection vs Rage Quit Detection**: Distinguishing genuine network issues (deserving grace period) from intentional quitting (should forfeit faster). Could check disconnection patterns, but MVP likely uses fixed timer.

4. **Session State Recovery After Server Crash**: If server dies mid-battle, Redis has session state, but reconnecting players to new server instance requires careful handoff and state synchronization with Battle Engine.

5. **Horizontal Scaling with Session Affinity**: As player base grows, need multiple servers handling battles. Matchmaking must assign sessions to servers, and reconnections must route to correct server. Requires session-to-server registry.

6. **Queue Fairness Under High Volume**: Simple FIFO queue works at low scale, but at high volume need to prevent edge cases like players getting skipped, duplicate matches, or queue starvation.

7. **WebSocket Connection Management**: Maintaining thousands of persistent connections, handling reconnection storms after network incidents, and preventing connection leaks or memory issues.

## Success Criteria

### MVP Definition of Done

- [ ] Players enter queue and are paired with first available opponent (FIFO)
- [ ] Average matchmaking time under 30 seconds when 10+ players queued
- [ ] Lobby requires both players to ready within 30 seconds or disbands
- [ ] Battle sessions start within 5 seconds of lobby ready confirmation
- [ ] Disconnection detection within 5 seconds of connection loss
- [ ] Reconnection grace period of 30 seconds before forfeit
- [ ] Successfully reconnected players resume battle from exact state
- [ ] Battle results recorded in database within 2 seconds of finish
- [ ] Session cleanup releases resources within 10 seconds of battle end
- [ ] Queue handles 100+ concurrent players without performance degradation
- [ ] No duplicate matches (same player in multiple simultaneous sessions)
- [ ] No ghost sessions (sessions persist after both players gone)
- [ ] Rematch option available immediately after battle ends
- [ ] Queue cancellation works instantly without errors
- [ ] Less than 1% of matches fail to start due to system errors

### Exceptional Target (Post-MVP)

- [ ] ELO-based skill matchmaking for competitive fairness
- [ ] 2v2 team battles with 4-player lobbies
- [ ] Private lobbies with room codes for friend matches
- [ ] Regional matchmaking for lower latency
- [ ] Queue priority for returning players or streak bonuses
- [ ] Pre-match chat during lobby phase
- [ ] Advanced pairing algorithms (balance by creature power)
- [ ] Spectator mode for watching friends' matches
- [ ] Tournament bracket management and seeding
- [ ] Automated best-of-3 series with rematch tracking
- [ ] Queue position guarantees (never lose position due to system error)
- [ ] Reconnection from different device/browser mid-session

## Open Questions

1. **Queue Display Transparency**: Show exact queue position (#3 of 12) or vague estimate ("~30 seconds")?
2. **Bot Opponents for Empty Queues**: If no human opponent available after 60 seconds, offer PvE battle vs AI, or keep waiting?
3. **Rematch Incentive**: Should rematch bypass queue (instant lobby), or rejoin queue with priority?
4. **Disconnection Grace Period Length**: 15 seconds, 30 seconds, 60 seconds? Should vary by phase (deployment vs combat)?
5. **Lobby Readiness Timeout**: 15 seconds, 30 seconds, or no timeout (wait indefinitely)?
6. **Queue Cancellation Penalty**: Should frequent cancellers face timeout penalty, or no restrictions for MVP?
7. **Multi-Queue Support**: Single global queue, or separate queues for game modes (when added)?
8. **Session Persistence After Crash**: Should server crash forfeit battle for both players, or attempt recovery?

## L2 Epic Candidates

- **Epic: Matchmaking Queue System** - Queue entry, FIFO pairing, wait time estimation
- **Epic: Lobby & Pre-Battle Coordination** - Lobby creation, ready system, countdown
- **Epic: Battle Session Lifecycle Management** - Session initialization, state tracking, cleanup
- **Epic: Connection & Disconnection Handling** - WebSocket management, heartbeats, reconnection
- **Epic: Post-Battle Processing** - Result recording, statistics, rematch handling
- **Epic: Session State Persistence & Recovery** - Redis state management, crash recovery
- **Epic: Horizontal Scaling & Session Affinity** - Multi-server session distribution
- **Epic: Queue Performance & Fairness** - High-volume queue optimization, edge case handling

---

**Version**: 1.0
**Status**: Ready for L2 Epic Development
**Dependencies Validated**: Yes (pending Creature Creation Experience and Battle Engine L1 completion)