# L2 EPIC: Multi-Round Battle System

**Epic ID**: `battle-multi-round`
**Parent Theme**: Battle Engine (L1)
**Status**: PLANNING
**Version**: 1.0
**Last Updated**: 2025-10-03

---

## Epic Summary

Implement the multi-round tournament-style battle structure where two players compete in a Best-of-5 or Best-of-7 series, with each round featuring simultaneous blind deployment followed by auto-battle resolution. This epic provides the overarching match framework that coordinates deployment phases, combat rounds, score tracking, and series victory conditions.

**User Value**: Creates strategic depth through multi-round adaptation, where players learn from each round and adjust their deployment strategies to counter their opponent's patterns.

**Business Value**: Increases session length and engagement compared to single-round matches, while maintaining the simple auto-battler gameplay that requires no mid-combat decision-making.

---

## Purpose

The Multi-Round Battle System is essential because it transforms Drawn of War from a single-round luck-fest into a strategic game of adaptation. Players bring their 8 creatures into a multi-round series where they can adjust placement and creature selection between rounds based on what they learned. This system must coordinate the entire match lifecycle: matchmaking → round 1 deployment → combat → round 2 deployment → combat → ... → series victory screen.

Without multi-round structure, there's no opportunity for strategic adaptation, no comeback mechanics, and battles feel too random and short. The Best-of-5/7 format creates tension, momentum swings, and satisfying victories through consistency rather than single-round luck.

---

## Scope

### Included

- **Match Series Management**
  - Best-of-5 (first to 3 wins) and Best-of-7 (first to 4 wins) formats
  - Match session creation and player pairing
  - Series score tracking (rounds won per player)
  - Series state persistence (current round number, scores, history)
  - Victory condition detection (first player to required wins)
  - Match timeout handling (inactive players forfeit)

- **Round Lifecycle Coordination**
  - Round initialization (new battlefield state)
  - Deployment phase activation (both players simultaneously)
  - Deployment completion detection (both players ready)
  - Countdown timer before combat begins
  - Combat phase handoff to server simulation
  - Round result capture (winner, stats, replay data)
  - Between-round transition screen with round summary

- **Deployment Phase State Machine**
  - Simultaneous blind deployment (players can't see opponent's placements)
  - Fixed 8-creature roster per player (selected pre-match)
  - Deployment confirmation ("Ready" button locks placements)
  - Deployment timer (60 seconds to place all creatures)
  - Auto-deployment fallback (default positions if timer expires)
  - Deployment validation (all creatures placed in valid positions)

- **Round Transition UI**
  - Round start announcement ("Round 2 - Fight!")
  - Between-round summary (winner, damage dealt, creatures lost)
  - Series scoreboard (Player A: 2 wins, Player B: 1 win)
  - Countdown timer to next deployment phase (10 seconds)
  - Match point indicator ("Match Point!" when 1 win away)

- **Series Victory & Match End**
  - Victory screen with series summary (final score, MVP creature)
  - Match statistics (total damage, rounds won, comeback victories)
  - Rematch option (start new series with same opponent)
  - Return to lobby option
  - Match history persistence (for future stats/leaderboards)

- **Reconnection & Resilience**
  - Disconnection detection during deployment or combat
  - Grace period for reconnection (30 seconds)
  - State recovery (rejoin match at current round)
  - Forfeit handling (if player doesn't reconnect in time)
  - Partial match credit (losing player gets credit for rounds won)

### Explicitly Excluded

- **Real-time Mid-Combat Control**: No player actions during combat phase (post-MVP)
- **Creature Swapping Between Rounds**: Fixed 8-creature roster for entire series (post-MVP)
- **Dynamic Format Selection**: Only Best-of-5 for MVP, Best-of-7 post-launch
- **Spectator Support**: No live spectating of other matches (post-MVP)
- **Pause/Resume**: No pausing mid-match (post-MVP)
- **Best-of-3 Format**: Too short, lacks comeback potential (excluded permanently)
- **Draw Rounds**: All rounds must have a winner (timeout = attacker loses)
- **Manual Round Skip**: Players must complete all rounds (no forfeit individual rounds)

---

## Key User Journeys

### 1. Standard Best-of-5 Series
**Setup**: Two players matched, both have 8 creatures selected
1. Match created → "Best of 5 - First to 3 Wins"
2. **Round 1**: Deployment phase (60s) → Both ready → Countdown (3s) → Combat → Player A wins
3. Round summary screen (10s) → "Round 1 Winner: Player A | Score: 1-0"
4. **Round 2**: Deployment phase → Player B adjusts strategy → Combat → Player B wins → "Score: 1-1"
5. **Round 3**: Deployment phase → Combat → Player A wins → "Score: 2-1"
6. **Round 4**: Deployment phase → Combat → Player B wins → "Score: 2-2 | MATCH POINT!"
7. **Round 5**: Deployment phase → Combat → Player A wins → **VICTORY SCREEN**
8. Series summary: "Player A wins 3-2! | Total damage: 24,500 | MVP: Fire Dragon"
9. Rematch or return to lobby

### 2. Quick 3-0 Sweep
1. Match created → Best of 5
2. Player A dominates with perfect counter strategy
3. Rounds 1, 2, 3 all won by Player A (3-0)
4. Series ends early (no need for rounds 4-5)
5. Victory screen: "Flawless Victory! 3-0"

### 3. Disconnection & Reconnection
1. Match in progress → Round 2 → Player B disconnects during deployment
2. System waits 30 seconds → Player B reconnects
3. Player B rejoins at deployment phase (placements not yet locked)
4. Match continues normally

### 4. Disconnection & Forfeit
1. Match in progress → Round 3 → Player A disconnects
2. System waits 30 seconds → Player A doesn't reconnect
3. Player B awarded match victory
4. Match record shows: "Player B wins by forfeit (score was 1-1)"

### 5. Deployment Timeout Handling
1. Round 2 deployment phase → Player A actively placing creatures
2. Player B idle (distracted, AFK)
3. 60-second timer expires
4. System auto-deploys Player B's creatures at default positions
5. Countdown starts → Combat begins with auto-deployed army

---

## Technical Architecture

### Components

**Match Orchestration (Backend)**
- `MatchSessionManager`: Creates and manages multi-round matches
- `RoundCoordinator`: Orchestrates individual round lifecycle
- `SeriesScorekeeper`: Tracks wins, round history, statistics
- `VictoryConditionChecker`: Detects series winners
- `DeploymentPhaseManager`: Coordinates simultaneous blind deployment
- `DeploymentValidator`: Validates creature placements before combat
- `StateTransitionManager`: Handles round transitions and state changes
- `MatchPersistence`: Saves match state to database for recovery

**Client State Management (Frontend)**
- `MatchStateStore`: Redux/Zustand store for match series state
- `RoundStateManager`: Tracks current round, phase, and timer
- `DeploymentUIController`: Manages deployment interface and interactions
- `ScoreboardRenderer`: Displays series score and round history
- `TransitionScreenManager`: Shows between-round summaries

**Network Synchronization**
- `MatchWebSocket`: Real-time bidirectional match communication
- `DeploymentSync`: Syncs deployment completion between players
- `StateReconciliation`: Handles reconnection state recovery
- `HeartbeatMonitor`: Detects player disconnections

### Key Technologies

- **Node.js + Express**: Match orchestration backend
- **WebSocket (Socket.io)**: Real-time match communication
- **Redis**: Match session state (in-memory for active matches)
- **PostgreSQL**: Match history persistence
- **React + Zustand**: Frontend state management
- **PixiJS**: Deployment UI and combat rendering

### Data Model

**Primary Entities**
```typescript
interface MatchSeries {
  matchId: string;
  format: 'best-of-5' | 'best-of-7';
  requiredWins: number; // 3 for BO5, 4 for BO7
  players: [PlayerId, PlayerId];
  createdAt: Date;
  status: 'in-progress' | 'completed' | 'forfeited';
  currentRound: number;
  scores: {
    [playerId: string]: number; // wins count
  };
  rounds: RoundResult[];
  winner?: PlayerId;
  completedAt?: Date;
}

interface RoundResult {
  roundNumber: number;
  deploymentPhase: {
    player1Deployments: CreatureDeployment[];
    player2Deployments: CreatureDeployment[];
    player1ReadyAt: Date;
    player2ReadyAt: Date;
  };
  combatPhase: {
    startedAt: Date;
    completedAt: Date;
    duration: number; // ms
    winner: PlayerId;
    finalState: CombatState;
  };
  statistics: {
    damageDealt: Record<PlayerId, number>;
    creaturesLost: Record<PlayerId, number>;
    abilitiesUsed: Record<PlayerId, number>;
  };
}

interface CreatureDeployment {
  creatureId: string;
  position: HexPosition;
  placedAt: Date;
}

interface MatchPhase {
  matchId: string;
  currentPhase: 'deployment' | 'countdown' | 'combat' | 'transition' | 'complete';
  roundNumber: number;
  phaseStartedAt: Date;
  deploymentTimer?: number; // seconds remaining
  countdownTimer?: number; // seconds remaining
  playersReady: {
    [playerId: string]: boolean;
  };
}

interface DeploymentState {
  matchId: string;
  roundNumber: number;
  playerId: PlayerId;
  deployments: CreatureDeployment[];
  isReady: boolean;
  submittedAt?: Date;
  timedOut: boolean;
}
```

**Key Relationships**
- One MatchSeries → Many RoundResult (up to 5 or 7)
- One RoundResult → Two DeploymentState (one per player)
- One DeploymentState → 8 CreatureDeployment (fixed roster size)
- MatchPhase shared by both players (synchronized state)

---

## Dependencies

### Depends On

- **Hex Grid Deployment System** (L2): Provides hex grid logic and deployment UI
- **Authoritative Server Simulation** (L2): Executes combat phase for each round
- **Matchmaking & Session Management** (L1): Pairs players and initiates matches
- **Platform Infrastructure** (L1): WebSocket infrastructure, Redis, PostgreSQL

### Depended On By

- **Combat Mechanics & Ability System** (L2): Receives round initialization to start combat
- **Client Rendering & Animation Sync** (L2): Renders deployment and combat phases
- **Matchmaking & Session Management** (L1): Receives match results for potential ELO

---

## Key Technical Challenges

1. **Simultaneous Blind Deployment Synchronization**: Both players deploy simultaneously without seeing each other's placements. Must ensure deployments are hidden until both players ready, handle timing discrepancies (one player fast, one slow), and prevent cheating (inspecting network traffic for opponent positions).

2. **State Consistency Across Disconnections**: If a player disconnects mid-deployment or mid-combat, system must preserve exact match state (current round, scores, deployments) for seamless reconnection. Requires robust state serialization and recovery.

3. **Deployment Timeout Edge Cases**: When timer expires, must auto-deploy creatures at valid positions while handling edge cases (player deployed 4/8 creatures, invalid placements, overlapping positions). Auto-deployment must be fair and not punish too severely.

4. **Round Transition Timing**: Between-round screens must give enough time to review results (10 seconds) but not break flow. If one player ready early, do we wait for timeout or allow "skip"? Must balance pacing with information absorption.

5. **Series Victory Detection & Early Exit**: Detecting series winner as soon as required wins reached (e.g., 3-0 in BO5 means rounds 4-5 skipped). Must cleanly exit round loop and transition to victory screen without state corruption.

6. **Forfeit vs Legitimate Loss**: Distinguishing player who disconnects intentionally (rage quit) from network failure. Grace period must be generous enough for accidental disconnects but not so long it wastes winner's time.

---

## Success Criteria

### MVP Definition of Done

- [ ] Players can complete full Best-of-5 series from deployment to victory screen
- [ ] Series score correctly tracks wins per player across all rounds
- [ ] Deployment phase enforces 60-second timer with auto-deployment fallback
- [ ] Blind deployment: Players cannot see opponent's placements until combat starts
- [ ] Both players must ready before combat begins (or timer expires)
- [ ] Round transition screens display correct winner, stats, and series score
- [ ] Victory screen appears when player reaches 3 wins (BO5) or 4 wins (BO7)
- [ ] Match ends early if series decided (no unnecessary rounds played)
- [ ] Disconnection during deployment or combat triggers 30-second grace period
- [ ] Reconnecting player rejoins at correct round/phase with state intact
- [ ] Forfeit declared if player doesn't reconnect within grace period
- [ ] Match history persisted to database (all rounds, deployments, results)
- [ ] Rematch option creates new series with same players and creatures

### Exceptional Target (Post-MVP)

- [ ] Best-of-7 format available as option (selectable in matchmaking)
- [ ] Creature roster swapping between rounds (select different 8 from collection)
- [ ] Pause/resume match functionality for friendly matches
- [ ] Spectator support (friends can watch live matches)
- [ ] Tournament bracket integration (multi-match series)
- [ ] Advanced stats tracking (win rate by round number, comeback percentage)
- [ ] Replay system (watch any round from completed match)

---

## Open Questions

1. **Best-of-5 vs Best-of-7 Default**: Should MVP launch with BO5 only, or offer both formats? BO7 increases match length by ~40% (good for engagement, but may be too long for casual players).

2. **Deployment Timer Duration**: Is 60 seconds enough for 8-creature placement? Too short causes stress, too long kills pacing. Should it scale with experience (veterans get less time)?

3. **Auto-Deployment Strategy**: When timer expires, where do we place undeployed creatures? Random valid positions? Default formation (front line → back line)? Player's previous round positions?

4. **Between-Round Timer**: 10-second forced wait vs "Ready to continue" button? Forced wait ensures both players see results, but button allows faster players to skip.

5. **Reconnection Grace Period**: 30 seconds enough? Too short for mobile users switching networks, too long wastes opponent's time. Should it scale based on how many rounds completed (later rounds = more patience)?

6. **Forfeit Penalty**: Should intentional forfeit (leaving match) have consequences (temporary matchmaking ban, rank penalty) vs accidental disconnect (no penalty)? How to distinguish?

7. **Draw Round Handling**: If combat reaches time limit with creatures remaining on both sides, who wins? Attacker loses (defender advantage)? Most HP remaining? Re-deploy and fight again?

8. **Rematch Behavior**: Does rematch use same creature roster, or allow both players to swap creatures? Does it reset to 0-0 or continue series?

---

## L3 Feature Candidates

### Core Match Flow
- **Match Session Creation** - Initialize BO5/BO7 series with player pairing
- **Round Initialization** - Create new round state and reset battlefield
- **Series Score Tracking** - Track wins per player and detect victory conditions
- **Victory Screen & Match Summary** - Display series results and statistics

### Deployment Phase
- **Simultaneous Blind Deployment** - Hide opponent placements until both ready
- **Deployment Timer & Auto-Deploy** - 60s countdown with fallback placement
- **Deployment Validation** - Ensure all creatures in valid positions before combat
- **Ready State Synchronization** - Coordinate both players confirming deployments

### Round Transitions
- **Round Start Announcement** - "Round 2 - Fight!" with scoreboard
- **Between-Round Summary Screen** - Winner, stats, damage dealt
- **Transition Countdown** - 10s timer before next deployment phase
- **Match Point Indicator** - Visual alert when series decisive round

### Resilience & Recovery
- **Disconnection Detection & Grace Period** - Monitor heartbeat, 30s reconnect window
- **State Persistence & Recovery** - Save/restore match state on reconnection
- **Forfeit Handling** - Award victory to opponent after grace period
- **Timeout Management** - Handle inactive players during deployment

### Post-Match
- **Match History Persistence** - Save all rounds, deployments, results to DB
- **Rematch System** - Create new series with same players
- **Match Statistics** - Aggregate stats across all rounds

---

## Metadata

- **Estimated Effort**: 4-6 weeks (full epic, all features)
- **Team Size**: 2-3 developers (1 backend, 1 frontend, 1 full-stack)
- **Priority**: CRITICAL (core game loop)
- **Risks**: Medium (complex state management, synchronization challenges)
- **Blockers**: Requires Hex Grid Deployment System and Server Simulation epics in parallel

---

*This document defines the multi-round tournament structure that coordinates all battle phases. Ready for L3 feature breakdown and task definition.*
