# L1-THEME: Battle Engine (Multi-Round Auto-Battler)

## Purpose

The Battle Engine theme owns the complete multi-round auto-battle system where player-created creatures engage in strategic tactical combat across multiple rounds with economic progression. This is the culmination of the Drawn of War experience—where imagination meets deep strategic gameplay. Players deploy AI-generated creatures on a hex grid in simultaneous blind deployment, watch them battle automatically using intelligent targeting AI, then adapt their strategy based on results and an evolving economy between rounds.

This theme is essential because it validates the entire game loop while providing replayability and strategic depth. The multi-round structure transforms each match from a single encounter into a best-of-5 or best-of-7 journey where players must adapt, counter, and outthink their opponent across successive engagements. The Battle Engine must showcase the 55-animation library effects composited on unique creatures, execute abilities with synchronized projectile and melee mechanics, and maintain 30+ FPS with 20 units on screen while handling 100ms+ network latency.

**Core Experience**: Mechabellum-style multi-round battles with hex grid tactical positioning, simultaneous blind deployment, fixed 8-creature armies per round, pure auto-battle execution with simple targeting AI, and economic progression between rounds.

## Scope

### Included

- **Multi-Round Match Structure**
  - Best-of-5 or Best-of-7 match format with win tracking
  - Round progression system (Round 1, 2, 3, etc.)
  - Match victory conditions (first to 3 wins in best-of-5, or 4 wins in best-of-7)
  - Round transitions with economy and deployment phases between rounds
  - Match summary screen showing round-by-round results

- **Economy Between Rounds**
  - Starting budget for Round 1 deployment
  - Income generation per round (fixed amount + bonus for round wins)
  - Budget persistence across rounds within a match
  - Economy display showing available funds and income sources
  - Creature cost system (creatures have deployment costs)

- **Hex Grid Deployment System**
  - Hex-based battlefield grid for tactical positioning
  - Deployment zone per player (e.g., bottom 3 rows for Player 1, top 3 rows for Player 2)
  - Simultaneous blind deployment (both players place without seeing opponent)
  - Locked deployment - no changes once submitted
  - Validation: Exactly 8 creatures must be deployed per round
  - Budget validation: Total creature costs cannot exceed available funds

- **Fixed 8-Creature Armies**
  - Each player deploys exactly 8 creatures per round
  - Creatures selected from player's generated creature library
  - Each creature can be deployed multiple times (duplicate units allowed)
  - Deployment costs vary per creature based on stats/abilities

- **Pure Auto-Battle Execution**
  - Zero player intervention during combat phase
  - Creatures controlled entirely by AI
  - Simple targeting AI (closest enemy by default)
  - Rock-paper-scissors counter mechanics (melee > ranged > magic > melee)
  - Automatic ability usage based on cooldowns and range
  - Battle continues until one side fully eliminated or timeout reached

- **Authoritative Server Simulation**
  - Server-side combat logic (all calculations, damage, ability execution)
  - Deterministic simulation tick (60 ticks per second)
  - State synchronization to all connected clients
  - Cheat prevention and validation
  - Round resolution and win condition detection
  - Match state persistence between rounds

- **Client-Side Rendering & Interpolation**
  - PixiJS-based hex battlefield renderer
  - Smooth animation playback for all creature actions
  - Client-side interpolation for network latency compensation
  - Effect compositing system (projectiles, melee effects, impacts, ground effects)
  - Camera controls and battlefield visualization
  - Round transition animations

- **Combat Mechanics**
  - Hex grid movement, pathfinding (A* on hex grid), and targeting
  - Unit movement speed based on creature stats
  - Attack execution (melee, ranged, magic) with rock-paper-scissors counters
  - Ability activation with cooldowns (no resource costs for MVP)
  - Damage calculation with armor/resistance systems
  - Death handling (unit removed, no respawn within round)
  - Persistent unit state across a single round only (reset between rounds)

- **Ability & Animation System**
  - 55 pre-generated library animations (isolated effects)
  - Effect compositing system (overlay effects on creature sprites)
  - Ranged ability execution: cast animation → projectile spawn → travel → hit detection
  - Melee ability execution: swing animation → frame-based hit detection → hit feedback
  - Ability execution synced with animation timelines
  - Projectile spawning, trajectory, and collision detection
  - Impact effects on hit (damage flash, particle effects)
  - Buff/debuff visual indicators
  - Cooldown management (visual cooldown indicators)

- **Animation & Effect Coordination**
  - Synchronizing creature animations with ability timelines
  - Spawning projectiles/effects at appropriate animation frames
  - Triggering impact effects on collision/hit
  - Playing death animations and removal
  - Layered rendering (ground effects, creatures, projectiles, UI)
  - Blend mode compositing (ADD for flashes, SCREEN for glows, OVERLAY for statuses)

- **Combat UI**
  - Unit health bars and status indicators
  - Ability cooldown displays
  - Combat log/feed of major events (kills, ability uses)
  - Round counter and score display (Player 1: 2 | Player 2: 1)
  - Economy display (current funds, income preview)
  - Deployment grid UI with hex highlighting
  - Deployment confirmation button
  - Round transition screens ("Round 2 - Deploy your forces!")
  - Match victory/defeat screens with match summary

- **Hex Battlefield Management**
  - Flat hex grid battlefield (MVP - no elevation)
  - Grid-based positioning and movement
  - Full visibility (no fog of war for MVP)
  - Hex boundary detection
  - Collision detection between units (cannot occupy same hex)
  - Deployment zone visualization

- **Targeting AI**
  - Simple closest-enemy targeting by default
  - Counter-based target prioritization (prefer advantageous matchups)
  - Range-based targeting (ranged units keep distance, melee units close in)
  - Ability targeting (single target, AOE, self-cast)
  - Target switching on death or out-of-range

- **Round Progression System**
  - Round end detection (all units on one side eliminated or timeout)
  - Winner determination for round
  - Economy update (grant income to both players, bonus to winner)
  - Transition to next deployment phase
  - Match end detection (first to required wins)
  - Match result calculation and storage

### Explicitly Excluded

- **Player Intervention During Combat**: No mid-battle commands, pausing, or ability activation (pure auto-battle)
- **Real-time Creature Generation**: Creatures must be generated before match starts (post-MVP feature)
- **Persistent Unit Progression Across Rounds**: Units reset stats/health between rounds, no leveling within a match
- **Formation Templates**: No saved deployment patterns (post-MVP)
- **Terrain Variety**: Only flat hex grid—no hills, obstacles, environmental effects (post-MVP)
- **Environmental Hazards**: No lava, traps, or dynamic battlefield elements (post-MVP)
- **Spectator Mode for Other Players**: Can only watch own matches (post-MVP)
- **Replay System**: No saved replays or replay controls (post-MVP)
- **Advanced Ability Synergies**: No combo detection or multi-unit coordinated abilities (post-MVP)
- **In-Battle Creature Summoning**: No real-time generation or summoning mid-combat (post-MVP)
- **AI-Controlled Opponent**: No PvE battles or bot opponents (post-MVP)
- **Tournament Features**: No bracket management, seeding, or competitive infrastructure (post-MVP)
- **Custom Ability Targeting**: No player-directed targeting during deployment (auto-targeting only)

## Key User Journeys

1. **Full Multi-Round Match Flow**: Players enter match lobby → create/select 8+ creatures from library → Ready Up → Round 1 begins → deployment phase: both players place 8 creatures on hex grid within budget → submit deployment (locked in) → countdown timer → combat executes automatically with targeting AI → creatures animate, projectiles fly, melee effects trigger → one side eliminated → "Round 1 Winner: Player 1!" → economy updated (+$100 base, +$50 winner bonus) → Round 2 deployment phase begins → players adapt strategy based on Round 1 results → deploy new formation → combat → continue until first to 3 wins (best-of-5) → match victory screen with round-by-round summary → rematch option or return to lobby

2. **Strategic Hex Deployment**: Player analyzes available creatures and budget ($500 starting) → places 3 melee tanks in front hex row (2 hexes from enemy side) → places 3 ranged archers in middle row behind tanks → places 2 magic support units in back row → verifies total cost = $480 (within budget) → opponent simultaneously deploying (hidden) → both submit → combat reveals opponent deployed swarm of 8 cheap melee units → player's ranged units counter effectively due to positioning → Round 1 victory → earns $150 income → Round 2: deploys more expensive elite units with $650 budget

3. **Ranged Ability Execution with Effect Compositing**: Player's fire mage creature (positioned on hex) reaches casting range to enemy → server triggers "fireball" ability → client plays `cast_spell_default` animation overlaid on mage sprite using SCREEN blend mode → projectile spawns from mage's position on frame 3 of cast animation → projectile travels across hex grid toward target at 5px/frame → projectile frame cycles through 4 effect frames during flight → collision detection when projectile reaches target hex → impact effect plays → enemy takes damage (damage calculation: base 50 + magic modifier) → health bar updates → cooldown starts (15 seconds)

4. **Melee Ability Execution with Frame-Based Hit**: Player's sword warrior (adjacent hex to enemy) initiates melee attack → server triggers "sword slash" ability → client plays `attack_melee_sword` animation positioned in front of warrior (80px offset, not overlaid) → animation cycles through 4 frames → hit detection triggers on frame 3 (peak of swing) → enemy receives damage → white flash feedback animation (200ms) on enemy sprite → warrior health bar unchanged → combat continues → warrior moves to next closest enemy

5. **Rock-Paper-Scissors Counter Scenario**: Round 3 → Player 1 deployed 5 ranged archers + 3 melee tanks → Player 2 deployed 6 magic casters + 2 melee units → Combat begins → Player 2's magic units prioritize Player 1's ranged units (magic > ranged) → Player 1's melee tanks push forward to engage magic units (melee > magic) → Player 2's melee units intercept tanks → targeting AI constantly re-evaluates closest enemies → Player 2 wins due to counter advantage → earns economy bonus → Round 4: Player 1 adapts by deploying anti-magic melee composition

6. **Epic Economic Comeback**: Player losing 0-2 in best-of-5 → has accumulated $800 budget while opponent spent heavily → Round 3: deploys team of 8 elite high-cost creatures ($750 total) → opponent can only afford 8 mid-tier creatures ($450) → combat begins → elite units dominate with superior stats and abilities → Round 3 victory → Round 4: deploys balanced mix → victory → Round 5: all-out expensive comp → wins match 3-2 comeback

7. **Network Recovery During Round**: Mid-combat Round 2 → network hiccup → client loses packets → server continues simulation → client reconnects within 3 seconds → receives state update (tick 450, unit positions, health values) → client interpolates smoothly to current state → battle continues without visible disruption → round completes normally → match continues to Round 3

8. **Deployment Budget Management**: Round 1 → Player has $500 starting budget → attempts to place 8 high-cost elite creatures ($650 total) → UI shows red "Over budget! $150 over limit" → player removes 1 elite ($100) and replaces with 2 cheaper units ($60 total) → new total: $610, still over → removes another unit and adjusts → final total: $490 → "8/8 creatures deployed, $10 remaining" → Submit button enabled → deployment locked in

## Technical Architecture

### Components

**Server-Side (Authoritative)**
- `MatchManager`: Manages multi-round match lifecycle, scoring, round progression
- `RoundOrchestrator`: Controls single round flow (deployment → combat → resolution)
- `EconomyManager`: Tracks budgets, grants income, validates costs
- `CombatSimulator`: Core simulation loop running at 60 ticks/second
- `CombatState`: Immutable state representation of battle (hex positions, unit stats)
- `HexGrid`: Hex coordinate system, pathfinding (A* on hex grid), distance calculation
- `UnitController`: Manages individual unit AI, movement, targeting
- `TargetingAI`: Closest-enemy targeting with counter-based prioritization
- `AbilityExecutor`: Processes ability activation and effects (ranged/melee)
- `DamageCalculator`: Computes damage/healing with rock-paper-scissors modifiers
- `CollisionDetector`: Handles projectile-to-unit collisions
- `RoundLogger`: Tracks events for post-match analytics
- `StateSerializer`: Packages state updates for client transmission (delta compression)
- `RoundVictoryChecker`: Detects round end conditions (all units dead or timeout)
- `MatchVictoryChecker`: Detects match end conditions (first to N wins)

**Client-Side (Rendering)**
- `HexBattlefieldRenderer`: PixiJS hex grid scene manager
- `HexGridUI`: Deployment interface with hex highlighting and placement
- `CreatureRenderer`: Handles creature sprite rendering on hex positions
- `EffectCompositor`: Manages effect overlay with blend modes (ADD, SCREEN, OVERLAY)
- `RangedEffectRenderer`: Ranged ability animation (cast → projectile → hit)
- `MeleeEffectRenderer`: Melee ability animation (positioned effect + frame-based hit)
- `ProjectileRenderer`: Projectile travel and frame cycling
- `StateInterpolator`: Smooths server state updates for 60fps rendering
- `DeploymentInputHandler`: Hex grid unit placement during deployment
- `CombatUI`: Health bars, cooldowns, combat log, economy display, round counter
- `RoundTransitionUI`: Round start/end screens, victory announcements
- `CameraController`: View panning and zooming on hex battlefield
- `EconomyUI`: Budget display, creature costs, income preview

**Shared Logic**
- `MatchStateModel`: Data structures for multi-round matches
- `HexCoordinate`: Hex grid coordinate system (cube or axial coordinates)
- `UnitCostCalculator`: Determines creature deployment costs based on stats
- `Constants`: Balance values (damage, range, cooldowns, economy values)
- `PathfindingAlgorithm`: A* pathfinding on hex grid

**Networking**
- `MatchSessionManager`: WebSocket connection per match (persists across rounds)
- `RoundStateSync`: Delta compression for bandwidth efficiency
- `LatencyCompensator`: Client-side interpolation and reconciliation
- `DeploymentSubmission`: Secure submission and validation of deployment choices

### Key Technologies

- **Node.js + Express**: Server-side simulation runtime
- **WebSocket (Socket.io)**: Real-time bidirectional communication
- **PixiJS**: Client-side 2D rendering engine (hex grid + sprite rendering)
- **Redis**: Match session state storage, round persistence, pub/sub
- **PostgreSQL**: Match history, analytics, economy balancing data (post-match)
- **SpineJS (PixiJS plugin)**: NOT USED - PixelLab provides pre-rendered sprite frames
- **Custom Hex Grid Library**: Hex coordinate system, A* pathfinding
- **Msgpack/Protobuf**: Efficient state serialization

### Data Model

**Primary Entities**
```typescript
interface MatchSession {
  matchId: string;
  players: [PlayerId, PlayerId];
  matchFormat: 'best-of-5' | 'best-of-7';
  status: 'lobby' | 'in_progress' | 'finished';
  startedAt: Date;
  finishedAt?: Date;
  winner?: PlayerId;
  rounds: RoundResult[];
  currentRound?: RoundSession;
  score: { [playerId: string]: number }; // wins per player
}

interface RoundSession {
  roundId: string;
  roundNumber: number;
  matchId: string;
  status: 'deployment' | 'countdown' | 'combat' | 'finished';
  deployments: { [playerId: string]: Deployment };
  combatState?: CombatState;
  startedAt: Date;
  finishedAt?: Date;
  winner?: PlayerId;
}

interface Deployment {
  playerId: PlayerId;
  units: DeployedUnit[];
  totalCost: number;
  submittedAt: Date;
  locked: boolean;
}

interface DeployedUnit {
  slotId: string; // unique within deployment
  creatureId: string; // references generated creature
  hexPosition: HexCoordinate;
  cost: number;
}

interface HexCoordinate {
  q: number; // axial coordinate
  r: number; // axial coordinate
  // derived: s = -q - r (cube coordinate)
}

interface PlayerEconomy {
  playerId: PlayerId;
  currentBudget: number;
  incomePerRound: number;
  totalEarned: number;
  totalSpent: number;
}

interface CombatState {
  tick: number; // server simulation tick
  units: Unit[];
  projectiles: Projectile[];
  activeEffects: ActiveEffect[];
  combatEvents: CombatEvent[]; // recent events for UI
}

interface Unit {
  unitId: string;
  slotId: string; // links back to deployment slot
  creatureId: string;
  ownerId: PlayerId;
  hexPosition: HexCoordinate;
  health: number;
  maxHealth: number;
  status: 'alive' | 'dead';
  currentAnimation: string;
  targetUnitId?: string;
  abilities: UnitAbility[];
  activeBuffs: Buff[];
  activeDebuffs: Debuff[];
  movementSpeed: number;
  attackType: 'melee' | 'ranged' | 'magic'; // for rock-paper-scissors
  attackRange: number; // in hex units
}

interface UnitAbility {
  abilityId: string;
  abilityType: 'ranged' | 'melee';
  animationId: string; // references library animation
  cooldownRemaining: number;
  cooldownTotal: number;
  lastUsedTick: number;
  damageAmount: number;
  range: number; // in hex units
}

interface Projectile {
  projectileId: string;
  abilityId: string;
  sourceUnitId: string;
  targetUnitId: string;
  position: { x: number; y: number }; // pixel coordinates
  targetPosition: { x: number; y: number };
  velocity: { x: number; y: number };
  speed: number; // pixels per tick
  spawnTick: number;
  currentFrame: number; // 0-3 for 4-frame animation
  damageAmount: number;
  effectAnimationId: string; // library animation ID
}

interface ActiveEffect {
  effectId: string;
  effectType: 'melee_swing' | 'buff_visual' | 'ground_aoe';
  position: { x: number; y: number };
  attachedUnitId?: string;
  animationId: string; // library animation ID
  currentFrame: number;
  spawnTick: number;
  durationTicks: number;
  blendMode: 'ADD' | 'SCREEN' | 'OVERLAY' | 'ALPHA';
}

interface CombatEvent {
  tick: number;
  eventType: 'damage_dealt' | 'ability_used' | 'unit_died' | 'ability_on_cooldown';
  data: {
    sourceUnitId?: string;
    targetUnitId?: string;
    abilityId?: string;
    damageAmount?: number;
  };
}

interface RoundResult {
  roundNumber: number;
  roundId: string;
  winner: PlayerId;
  duration: number;
  economySnapshot: { [playerId: string]: PlayerEconomy };
  statistics: {
    totalDamageDealt: { [playerId: string]: number };
    unitsLost: { [playerId: string]: number };
    abilitiesUsed: { [playerId: string]: number };
  };
}

interface MatchResult {
  matchId: string;
  matchFormat: 'best-of-5' | 'best-of-7';
  players: [PlayerId, PlayerId];
  winner: PlayerId;
  finalScore: { [playerId: string]: number };
  rounds: RoundResult[];
  duration: number;
  finishedAt: Date;
}
```

**Key Relationships**
- One MatchSession → Many RoundSession → One CombatState per Round
- One RoundSession → Two Deployments (one per player) → Many DeployedUnit
- One Unit → One CreatureGeneration (from AI Pipeline, referenced by creatureId)
- One Unit → Many UnitAbility → References AnimationLibrary (by animationId)
- MatchSession persists in Redis during match, MatchResult archived in PostgreSQL post-match
- PlayerEconomy tracked per match, reset between matches

## Dependencies

### Depends On

- **AI Generation Pipeline** (L1): Provides creatures with animations, abilities, stats
  - Specifically: 55-animation library (ranged/melee effects), effect compositing system
  - References: `/docs/specs/L3-FEATURES/ai-generation-pipeline/animation-library.md`
  - References: `/docs/specs/L3-FEATURES/ai-generation-pipeline/effect-compositing-system.md`
- **Matchmaking & Session Management** (L1): Pairs players and initiates match sessions
- **Platform Infrastructure** (L1): WebSocket infrastructure, monitoring, logging
- **Content Management & Storage** (L1): Serves creature sprites and animation assets via CDN

### Depended On By

- No direct dependencies (Battle Engine is a terminal node)
- **Matchmaking & Session Management** (L1) consumes match results for potential ELO/ranking (post-MVP)

## Key Technical Challenges

1. **Multi-Round State Management Across Network**: Persisting match state, economy, and round history across multiple rounds (5-7 rounds per match) while maintaining synchronization between two clients over 100ms+ latency. Requires robust state persistence in Redis, efficient delta updates, and graceful handling of disconnections between rounds vs during rounds.

2. **Hex Grid Pathfinding Performance**: A* pathfinding on hex grid with 16 units (8 per player) calculating paths every tick at 60 ticks/second. Must optimize pathfinding to avoid performance bottlenecks (path caching, grid segmentation, pre-computed distance maps).

3. **Simultaneous Blind Deployment Security**: Preventing players from seeing opponent's deployment before committing their own. Requires server-side deployment locking, validation that both deployments are submitted before revealing, and cheat prevention against client manipulation.

4. **Authoritative Server with Smooth Client Rendering**: Clients render at 60fps with sprite animations and effect compositing while server simulates at 60 ticks/sec over 100ms+ latency. Requires client-side interpolation, dead reckoning, and state reconciliation without visual artifacts, especially for hex-to-hex movement.

5. **Synchronizing Effect Compositing with Gameplay Logic**: Ensuring ranged projectiles spawn at correct positions when creatures play cast animations, travel smoothly across hex grid, and trigger hit effects on collision. Melee effects must position correctly relative to attacker, trigger hit detection on specific animation frames (frame 3 for sword slash), and show target feedback. Requires precise timeline coordination across server logic and client rendering, plus blend mode management for visual quality.

6. **Performance with 16 Units + Effects on Screen**: Maintaining 30+ FPS (per L0 metric) with 16 animated creatures, multiple projectiles in flight, melee effect overlays, particle effects, and hex grid UI elements. Requires aggressive PixiJS optimization (culling, batching, texture atlases, sprite pooling for projectiles).

7. **Balancing Rock-Paper-Scissors Combat**: Ensuring melee > ranged > magic > melee counter system produces interesting combat without degenerate strategies (e.g., all-melee always wins). Requires tuning damage modifiers, ability cooldowns, movement speeds, and deployment costs to maintain strategic diversity.

8. **Economy Balancing Across Rounds**: Starting budget, income per round, and creature costs must produce escalating strategic choices without snowballing (winner gets too far ahead) or rubber-banding (loser always catches up). Requires statistical balancing, income curves, and cost scaling based on creature power level.

9. **Targeting AI Simplicity vs Strategic Depth**: Simple "closest enemy" AI must produce interesting battles while respecting rock-paper-scissors counters and range preferences (ranged units kite, melee units close). Must avoid pathological cases (units walking past enemies, ranged units charging into melee).

10. **Cheat Prevention in Blind Deployment**: Players could manipulate client to see opponent deployment, exceed budget, or place units in invalid hexes. Server must validate all deployments (budget, unit count, hex validity, deployment zone) before allowing combat to start.

11. **Graceful Degradation on Disconnect**: When player disconnects mid-round or between rounds, determine if match pauses (wait for reconnect with 30s timer), forfeits current round, or forfeits entire match. Must handle partial disconnects and reconnection with full state restoration.

## Success Criteria

### MVP Definition of Done

**Multi-Round Match Flow**
- [ ] Two players can complete full best-of-5 match: 5 rounds with deployment → combat → economy → deployment cycle
- [ ] Match progression tracks wins correctly (first to 3 wins declared match winner)
- [ ] Round transitions display correctly (round number, economy update, deployment phase)
- [ ] Match victory screen shows round-by-round results and final score

**Economy System**
- [ ] Round 1 starts with defined budget ($500 default)
- [ ] Income granted each round ($100 base + $50 winner bonus)
- [ ] Budget persists across rounds within match
- [ ] Deployment validation prevents over-budget placements
- [ ] Economy UI displays current funds, income, and costs accurately

**Hex Grid Deployment**
- [ ] Hex grid battlefield renders correctly with deployment zones highlighted
- [ ] Players can place exactly 8 creatures on hex grid within deployment zone
- [ ] Simultaneous blind deployment (neither player sees opponent until both submit)
- [ ] Deployment locked after submission (no changes)
- [ ] Invalid placements rejected (out of zone, exceeding budget, wrong unit count)

**Pure Auto-Battle Execution**
- [ ] Combat executes without player intervention after deployment
- [ ] Creatures move and attack using targeting AI (closest enemy)
- [ ] Rock-paper-scissors counters apply damage modifiers correctly (melee > ranged > magic > melee)
- [ ] Abilities trigger automatically based on cooldowns and range
- [ ] Combat ends when all units on one side eliminated or timeout reached

**Server Simulation & Client Rendering**
- [ ] Server simulation runs at stable 60 ticks/second under load
- [ ] Client renders at 30+ FPS with 16 units on screen per L0 metric
- [ ] Match stability: <1% disconnection rate per L0 metric
- [ ] Network latency compensation provides smooth experience up to 150ms RTT

**Animation & Effect Compositing**
- [ ] All creature animations play correctly in battle (movement, idle, attack, death)
- [ ] Ranged abilities: cast animation → projectile spawns → travels → hits target → impact effect
- [ ] Melee abilities: swing animation positioned near attacker → hit detection on frame 3 → target feedback
- [ ] Effect compositing uses correct blend modes (ADD for flashes, SCREEN for glows, OVERLAY for status)
- [ ] 55 library animations load and display correctly when assigned to creatures

**Combat Mechanics**
- [ ] Hex grid pathfinding moves units correctly (A* on hex grid)
- [ ] Collision detection prevents units from occupying same hex
- [ ] Damage calculation follows formulas with rock-paper-scissors modifiers
- [ ] Health bars update instantly on damage
- [ ] Death animations play before unit removal
- [ ] Targeting AI switches targets correctly on death or out-of-range

**Combat UI**
- [ ] Health bars and status indicators visible per unit
- [ ] Ability cooldown displays show remaining time
- [ ] Combat log shows major events (kills, ability uses)
- [ ] Round counter displays current round number and score (Player 1: 2 | Player 2: 1)
- [ ] Economy display shows current budget and income
- [ ] Deployment grid UI highlights valid placement hexes
- [ ] Deployment confirmation button enables when 8 units placed within budget

**Security & Validation**
- [ ] Server prevents client-side cheating (invalid deployments, budget manipulation)
- [ ] Deployment submissions validated before combat starts
- [ ] Match state persists correctly in Redis between rounds
- [ ] Disconnection handling: forfeit after 30s timeout or successful reconnection

### Exceptional Target (Post-MVP)

- [ ] 60 FPS rendering on average laptops with 20+ units on screen
- [ ] <0.1% disconnection rate with automatic reconnection
- [ ] Best-of-7 and custom match formats (best-of-3, single elimination)
- [ ] Advanced targeting AI with counter-based prioritization and positioning
- [ ] Replay system with round-by-round playback
- [ ] Formation templates and saved deployment patterns
- [ ] Spectator mode for watching other players' matches
- [ ] Dynamic terrain with elevation and obstacles affecting pathfinding
- [ ] In-battle creature summoning via rapid generation
- [ ] PvE mode with AI-controlled opponents
- [ ] Tournament brackets and competitive ranking system
- [ ] Real-time creature generation during deployment phase
- [ ] Advanced ability synergies and combo detection
- [ ] Mobile client support with touch controls for hex grid

## Open Questions

1. **Match Format**: Best-of-5 or Best-of-7 by default? Player choice or ranked vs casual?
2. **Starting Budget**: $500 feels right, but needs playtesting for strategic depth
3. **Income Formula**: $100 base + $50 winner bonus? Should loser get catch-up bonus?
4. **Creature Cost Calculation**: Based on stats sum, ability count, or manual balancing?
5. **Rock-Paper-Scissors Modifiers**: What % damage bonus for counters (25%, 50%, 100%)?
6. **Hex Grid Size**: 10x10 hexes? 12x12? Affects deployment zone size and movement distances
7. **Deployment Zone Size**: Bottom 3 rows per player? 2 rows? 4 rows?
8. **Combat Timeout**: 3 minutes per round? 5 minutes? Draw condition?
9. **Draw Resolution**: Most HP remaining wins? Both lose the round? Rematch that round?
10. **Reconnection Grace Period**: 30 seconds? 60 seconds? Auto-forfeit after timeout?
11. **Duplicate Unit Limit**: Can deploy 8 of same creature? Max 4 duplicates? No duplicates?
12. **Targeting AI Complexity**: Pure closest-enemy or add counter prioritization in MVP?
13. **Ability Auto-Usage**: Use abilities on cooldown always, or only when advantageous?
14. **Pathfinding Cost**: Uniform hex costs or terrain-based costs (even for flat battlefield)?

## L2 Epic Candidates

### Core Systems (Priority 1 - MVP Blockers)
1. **Epic: Multi-Round Match Orchestration** - Match lifecycle, round progression, win tracking, match victory conditions
2. **Epic: Hex Grid Deployment System** - Hex grid rendering, simultaneous blind deployment, validation, deployment UI
3. **Epic: Economy & Budget Management** - Starting budget, income generation, creature costs, budget validation
4. **Epic: Authoritative Server Simulation** - 60-tick combat loop, hex grid state management, round resolution

### Combat Mechanics (Priority 2 - MVP Critical)
5. **Epic: Pure Auto-Battle Execution** - Targeting AI (closest enemy), rock-paper-scissors counters, ability auto-usage
6. **Epic: Hex Grid Movement & Pathfinding** - A* pathfinding on hex grid, movement speed, collision avoidance
7. **Epic: Effect Compositing & Animation System** - Ranged effects (cast → projectile → hit), melee effects (frame-based hit), blend modes

### Client Rendering (Priority 3 - MVP Critical)
8. **Epic: Hex Battlefield Renderer** - PixiJS hex grid scene, creature rendering on hexes, camera controls
9. **Epic: Combat UI & Feedback** - Health bars, cooldowns, combat log, round counter, economy display, deployment UI
10. **Epic: Network Synchronization & Latency Compensation** - WebSocket state sync, client interpolation, disconnection handling

### Balancing & Polish (Priority 4 - Post-MVP)
11. **Epic: Combat Balance & Formula Tuning** - Damage calculation, counter modifiers, ability cooldowns, creature costs, economy curves
12. **Epic: Performance Optimization** - PixiJS optimizations (culling, batching, sprite pooling), pathfinding caching, state delta compression

---

**Version**: 2.0 (Multi-Round Auto-Battler Refinement)
**Status**: Ready for L2 Epic Development
**Dependencies Validated**: Yes (pending AI Generation Pipeline completion, Animation Library complete)
**Based On**: Original L1 Battle Engine v1.0, Mechabellum research, User decisions (2025-10-03)
**Key Changes from v1.0**:
- Multi-round match structure (best-of-5/7) with round progression
- Economy system between rounds (budget, income, creature costs)
- Hex grid deployment instead of free-form positioning
- Simultaneous blind deployment (locked submissions)
- Fixed 8-creature armies per round
- Pure auto-battle execution (no player intervention during combat)
- Simple targeting AI (closest enemy with counter prioritization)
- Rock-paper-scissors counter mechanics (melee > ranged > magic > melee)
- Effect compositing system integration (55 library animations)
- Ranged vs melee ability execution patterns
- Match persistence across rounds with Redis
