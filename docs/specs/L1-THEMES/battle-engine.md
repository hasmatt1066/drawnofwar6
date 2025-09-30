# L1-THEME: Battle Engine

## Purpose

The Battle Engine theme owns the complete real-time combat system where player-created creatures engage in strategic battles. This is the culmination of the Drawn of War experience—where imagination meets gameplay, and players see their creations animated with full movesets in competitive combat. The Battle Engine encompasses authoritative server-side simulation, client-side rendering, combat mechanics, ability execution, and all supporting systems to ensure battles are fair, performant, and visually spectacular.

This theme is essential because it validates the entire game loop. Players create creatures to see them battle—if combat feels shallow, unfair, or visually underwhelming, the creative effort feels wasted. The Battle Engine must showcase the 20+ animations per creature, execute abilities with synchronized effects, and maintain 30+ FPS with 20 units on screen while handling 100ms+ network latency.

## Scope

### Included

- **Authoritative Server Simulation**
  - Server-side combat logic (all calculations, damage, ability execution)
  - Deterministic simulation tick (60 ticks per second)
  - State synchronization to all connected clients
  - Cheat prevention and validation
  - Combat resolution and win condition detection

- **Client-Side Rendering & Interpolation**
  - PixiJS-based battlefield renderer
  - Smooth animation playback for all creature actions
  - Client-side interpolation for network latency compensation
  - Effect rendering (projectiles, auras, impacts, ground effects)
  - Camera controls and battlefield visualization

- **Combat Mechanics**
  - Turn-based deployment phase with strategic placement
  - Real-time combat execution phase
  - Unit movement, pathfinding, and targeting
  - Attack execution (melee, ranged, magic)
  - Ability activation with cooldowns and resource costs
  - Damage calculation with armor/resistance systems
  - Death and respawn handling

- **Ability System**
  - Ability execution engine synced with animation timelines
  - Projectile spawning, trajectory, and collision detection
  - Area-of-effect abilities (ground effects, auras)
  - Buff/debuff application and tracking
  - Cooldown management
  - Ability targeting (single target, AOE, self-cast)

- **Animation & Effect Coordination**
  - Synchronizing creature skeletal animations with ability timelines
  - Spawning projectiles at attachment points
  - Triggering impact effects on hit
  - Playing death animations and removal
  - Layered rendering (ground effects, creatures, projectiles, UI)

- **Combat UI**
  - Unit health bars and status indicators
  - Ability cooldown displays
  - Combat log/feed of major events
  - Victory/defeat screens with match summary
  - Spectator UI for viewing own battles

- **Battlefield Management**
  - Flat battlefield terrain (MVP)
  - Grid-based or free-form positioning
  - Fog of war or full visibility (TBD in L2)
  - Out-of-bounds detection
  - Collision detection between units

### Explicitly Excluded

- **Terrain Variety**: Only flat battlefield for MVP—no hills, obstacles, environmental effects (post-MVP)
- **Environmental Hazards**: No lava, traps, or dynamic battlefield elements (post-MVP)
- **Spectator Mode for Other Players**: Can only watch own matches (post-MVP)
- **Replay System**: No saved replays or replay controls (post-MVP)
- **Advanced Ability Synergies**: No combo detection or multi-unit coordinated abilities (post-MVP)
- **In-Battle Creature Summoning**: No real-time generation or summoning mid-combat (post-MVP)
- **Persistent Unit Progression**: Units don't level up or gain XP during battles (post-MVP)
- **Formation Templates**: No saved deployment patterns (post-MVP)
- **AI-Controlled Units**: No PvE battles or bot opponents (post-MVP)
- **Tournament Features**: No bracket management, seeding, or competitive infrastructure (post-MVP)

## Key User Journeys

1. **Standard Battle Flow**: Players enter battle → deployment phase → each places 5 creatures strategically → countdown timer → combat begins → creatures execute animations and abilities → projectiles fly, effects trigger → one side eliminated → victory screen with stats → option to rematch or create new creature

2. **Strategic Deployment**: Player sees opponent's creatures → analyzes their formations → places tank units front, ranged units back → anticipates opponent strategy → adjusts placement → combat reveals whether strategy worked

3. **Ability Execution**: Player's fire mage creature reaches casting distance → server triggers "fireball" ability → client plays cast animation → fireball projectile spawns from hand attachment point → projectile travels toward target → impact effect on hit → enemy takes damage → health bar updates

4. **Epic Comeback**: Player losing badly with 2 creatures vs opponent's 4 → surviving creature has AOE ultimate ability → ability executes with massive visual effect → multiple enemies damaged → tide turns → player wins with last creature standing

5. **Network Recovery**: Mid-battle network hiccup → client loses packets → server continues simulation → client reconnects → receives state update → interpolates to current state smoothly → battle continues without visible disruption to player

## Technical Architecture

### Components

**Server-Side (Authoritative)**
- `CombatSimulator`: Core simulation loop running at 60 ticks/second
- `CombatState`: Immutable state representation of battle
- `UnitController`: Manages individual unit AI, movement, and actions
- `AbilityExecutor`: Processes ability activation and effects
- `DamageCalculator`: Computes damage/healing with formulas
- `CollisionDetector`: Handles unit-to-unit and projectile collisions
- `CombatLogger`: Tracks events for analytics and potential replay
- `StateSerializer`: Packages state updates for client transmission
- `VictoryConditionChecker`: Detects battle end conditions

**Client-Side (Rendering)**
- `BattlefieldRenderer`: PixiJS scene manager
- `CreatureRenderer`: Handles creature sprite and animation playback
- `EffectRenderer`: Manages projectiles, auras, impacts, ground effects
- `StateInterpolator`: Smooths server state updates for 60fps rendering
- `InputHandler`: Deployment phase unit placement
- `CombatUI`: Health bars, cooldowns, combat log
- `CameraController`: View panning and zooming

**Shared Logic**
- `CombatStateModel`: Data structures for creatures, abilities, effects
- `Constants`: Balance values (damage, range, cooldowns)
- `PathfindingAlgorithm`: A* or similar for unit movement

**Networking**
- `BattleSessionManager`: WebSocket connection per battle
- `StateSync`: Delta compression for bandwidth efficiency
- `LatencyCompensator`: Client-side prediction and reconciliation

### Key Technologies

- **Node.js + Express/Fastify**: Server-side simulation runtime
- **WebSocket (Socket.io)**: Real-time bidirectional communication
- **PixiJS**: Client-side 2D rendering engine
- **Redis**: Battle session state storage and pub/sub
- **PostgreSQL**: Match history and analytics (post-battle)
- **SpineJS (PixiJS plugin)**: Skeletal animation playback
- **Matter.js or Custom**: Physics/collision detection
- **Msgpack/Protobuf**: Efficient state serialization

### Data Model

**Primary Entities**
```typescript
interface BattleSession {
  battleId: string;
  players: [PlayerId, PlayerId];
  status: 'deployment' | 'countdown' | 'combat' | 'finished';
  startedAt: Date;
  finishedAt?: Date;
  winner?: PlayerId;
  combatState: CombatState;
}

interface CombatState {
  tick: number; // server simulation tick
  units: Unit[];
  projectiles: Projectile[];
  effects: ActiveEffect[];
  combatEvents: CombatEvent[]; // recent events for UI
}

interface Unit {
  unitId: string;
  creatureId: string;
  ownerId: PlayerId;
  position: { x: number; y: number };
  health: number;
  maxHealth: number;
  status: 'alive' | 'dead';
  currentAnimation: string;
  targetUnitId?: string;
  abilities: UnitAbility[];
  activeBuffs: Buff[];
  activeDebuffs: Debuff[];
  movementSpeed: number;
}

interface UnitAbility {
  abilityId: string;
  cooldownRemaining: number;
  cooldownTotal: number;
  manaCost?: number;
  lastUsedTick: number;
}

interface Projectile {
  projectileId: string;
  abilityId: string;
  sourceUnitId: string;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  spawnTick: number;
  lifetimeTicks: number;
  damageAmount: number;
  effectOnImpact: string;
}

interface ActiveEffect {
  effectId: string;
  effectType: 'aura' | 'ground' | 'buff_visual';
  position: { x: number; y: number };
  attachedUnitId?: string;
  spawnTick: number;
  durationTicks: number;
  animationState: string;
}

interface CombatEvent {
  tick: number;
  eventType: 'damage_dealt' | 'ability_used' | 'unit_died' | 'buff_applied';
  data: Record<string, any>;
}

interface BattleResult {
  battleId: string;
  players: [PlayerId, PlayerId];
  winner: PlayerId;
  duration: number;
  finalState: CombatState;
  statistics: {
    totalDamageDealt: Record<PlayerId, number>;
    unitsLost: Record<PlayerId, number>;
    abilitiesUsed: Record<PlayerId, number>;
  };
}
```

**Key Relationships**
- One BattleSession → Two Players → Many Units per Player
- One Unit → One CreatureGeneration (from AI Pipeline)
- One Unit → Many UnitAbility → Many EffectAsset
- BattleSession persists temporarily in Redis, BattleResult archived in PostgreSQL

## Dependencies

### Depends On

- **AI Generation Pipeline** (L1): Provides creatures with animations, abilities, stats
- **Matchmaking & Session Management** (L1): Pairs players and initiates battle sessions
- **Platform Infrastructure** (L1): WebSocket infrastructure, monitoring, logging
- **Content Management & Storage** (L1): Serves creature sprites and animation assets via CDN

### Depended On By

- No direct dependencies (Battle Engine is a terminal node)
- **Matchmaking & Session Management** (L1) consumes battle results for potential ELO/ranking (post-MVP)

## Key Technical Challenges

1. **Authoritative Server with Smooth Client Rendering**: Clients render at 60fps with skeletal animations while server simulates at 60 ticks/sec over 100ms+ latency. Requires client-side interpolation, dead reckoning, and state reconciliation without visual artifacts.

2. **Synchronizing Animations with Gameplay Logic**: Ensuring projectiles spawn at exact attachment point locations when creature plays attack animation, impact effects trigger at correct collision moments, and death animations complete before unit removal. Requires precise timeline coordination across server logic and client rendering.

3. **Performance with 20+ Units on Screen**: Maintaining 30+ FPS (per L0 metric) with 20 skeletal-animated creatures, multiple projectiles, particle effects, and UI elements. Requires aggressive PixiJS optimization (culling, batching, texture atlases).

4. **Fair Combat Under Network Variability**: Preventing lag from giving advantage/disadvantage. Server must be authoritative but clients need to feel responsive. Requires lag compensation techniques (client prediction, input buffering).

5. **Balancing AI-Generated Creatures**: Creatures with wildly different stats/abilities must produce interesting, balanced combat. Requires robust damage formulas, ability design constraints, and statistical balancing across diverse creature types.

6. **Cheat Prevention**: Players could manipulate client state to fake ability cooldowns, unit positions, or damage. Server must validate all actions and never trust client input beyond initial placement.

7. **Graceful Degradation on Disconnect**: When player disconnects mid-battle, determine if battle continues (AI takes over), pauses (wait for reconnect), or ends (forfeit). Must handle partial disconnects and reconnection smoothly.

## Success Criteria

### MVP Definition of Done

- [ ] Two players can complete full battle: deployment → combat → victory screen
- [ ] Server simulation runs at stable 60 ticks/second under load
- [ ] Client renders at 30+ FPS with 20 units on screen per L0 metric
- [ ] Match stability: <1% disconnection rate per L0 metric
- [ ] All creature animations play correctly in battle (movement, attack, abilities, death)
- [ ] Projectiles spawn from correct attachment points and travel to targets
- [ ] Collision detection accurately detects hits and triggers impact effects
- [ ] Damage calculation follows defined formulas and updates health bars instantly
- [ ] Abilities trigger on correct cooldowns and execute animation timelines
- [ ] Victory conditions correctly detect battle end (all enemy units dead)
- [ ] Combat UI displays health, cooldowns, and combat log clearly
- [ ] Deployment phase allows strategic unit placement with validation
- [ ] Network latency compensation provides smooth experience up to 150ms RTT
- [ ] Server prevents client-side cheating (ability spam, invalid moves)
- [ ] Battle sessions clean up resources after completion

### Exceptional Target (Post-MVP)

- [ ] 60 FPS rendering on average laptops with 40+ units on screen
- [ ] <0.1% disconnection rate with automatic reconnection
- [ ] Advanced ability synergies automatically detected and executed
- [ ] Replay system with playback controls and slow-motion
- [ ] Spectator mode for watching other players' battles
- [ ] Dynamic terrain with environmental effects (fire zones, ice patches)
- [ ] In-battle real-time creature summoning via rapid generation
- [ ] Formation templates and saved strategies
- [ ] PvE mode with AI-controlled opponents
- [ ] Tournament brackets and competitive ranking system
- [ ] Mobile client support with touch controls

## Open Questions

1. **Deployment Grid vs Free-Form**: Should unit placement be grid-based (easier balance) or free-form (more strategic depth)?
2. **Fog of War**: Should players see opponent units during deployment, or only when combat begins?
3. **Unit Count Per Player**: 5 creatures each, 10, or variable based on creature "cost"?
4. **Ability Targeting**: Auto-targeting by AI, or player-directed targeting during deployment?
5. **Draw Conditions**: If battle reaches time limit, how to determine winner (most HP remaining, attackers lose, both lose)?
6. **Reconnection Grace Period**: How long to wait for disconnected player before declaring forfeit (10s, 30s, 60s)?
7. **Simulation Tick Rate**: 60 ticks/sec feels right, but could we reduce to 30 for bandwidth savings without quality loss?
8. **Creature Respawn**: Do dead creatures respawn mid-battle, or single elimination per unit?

## L2 Epic Candidates

- **Epic: Authoritative Server Simulation** - Core combat loop, damage calculation, ability execution
- **Epic: Client Rendering & Interpolation** - PixiJS battlefield, animation playback, state synchronization
- **Epic: Deployment Phase System** - Unit placement interface, validation, turn coordination
- **Epic: Ability Execution & Timeline Sync** - Ability triggers, animation coordination, effect spawning
- **Epic: Projectile & Collision System** - Projectile physics, collision detection, impact handling
- **Epic: Combat UI & Feedback** - Health bars, cooldowns, combat log, victory screens
- **Epic: Network Synchronization** - WebSocket state sync, latency compensation, disconnection handling
- **Epic: Combat Balance & Formulas** - Damage calculation, ability tuning, statistical balancing
- **Epic: Performance Optimization** - PixiJS optimizations, culling, batching, profiling

---

**Version**: 1.0
**Status**: Ready for L2 Epic Development
**Dependencies Validated**: Yes (pending AI Generation Pipeline and Matchmaking L1 completion)