# L2 EPIC: Client Rendering & Animation Sync

**Epic ID**: `battle-client-render`
**Parent Theme**: Battle Engine (L1)
**Status**: REFINEMENT COMPLETE
**Version**: 1.1
**Last Updated**: 2025-10-05

---

## Epic Summary

Implement the client-side battlefield renderer using PixiJS that receives authoritative server state updates and renders smooth 60fps combat with synchronized creature animations, projectile effects, impact visuals, and UI overlays. The client interpolates between delayed server updates to create fluid gameplay despite 100-150ms network latency, while maintaining perfect synchronization between animation timelines and gameplay events (attacks trigger at correct frames, projectiles spawn from attachment points, death animations complete before removal).

**User Value**: Provides visually spectacular combat with smooth creature animations, flashy projectile effects, and responsive feedback, making auto-battles feel dynamic and engaging to watch rather than static and boring.

**Business Value**: High-quality rendering showcases the AI-generated creatures' 20+ animations, validates the animation library investment, and creates shareable moments for social media (players record epic battle sequences).

---

## Purpose

The Client Rendering & Animation Sync epic is essential because it's what players actually see and experience during combat. The authoritative server handles all gameplay logic, but the client must make those abstract state updates (unit position changes, HP reductions, ability activations) feel alive through:

1. **Smooth Animation Playback**: Creatures must play idle → walk → attack → idle transitions seamlessly
2. **Effect Synchronization**: Projectiles must spawn when attack animation reaches the "release" frame
3. **Latency Compensation**: Client interpolates between delayed server updates to maintain 60fps rendering
4. **Visual Feedback**: Damage numbers, health bars, impact effects, and screen shake make combat readable
5. **Performance**: Maintain 30+ FPS with 16 animated creatures (8v8 MVP) on screen

Without proper rendering and sync, battles feel disconnected—units teleport instead of moving, attacks look wrong, and players can't follow the action. This epic transforms server state into cinematic gameplay.

### AI-Driven Creature Stats

All creature combat stats are assigned by Claude during generation, not selected by players:
- **Speed**: Determines movement rate (1-3 hexes/turn), assigned based on creature archetype
- **Abilities**: 1-3 unique abilities per creature with cooldowns, selected from abilities catalog
- **Ability Cooldowns**: 2-5 turn cooldowns per ability, balanced during generation
- **Stats**: HP, damage, armor assigned based on creature theme and role

Players see creatures with fully-defined combat capabilities immediately after generation. The client renders these stats through health bars, cooldown indicators, and visual effects. This ensures every battle has tactical variety without requiring manual stat configuration.

---

## Scope

### Included

- **PixiJS Battlefield Renderer**
  - Hex grid rendering (background layer)
  - Creature sprite rendering (16 creatures with layering)
  - Projectile rendering (arrows, fireballs, spells)
  - Effect rendering (impacts, auras, ground effects)
  - UI overlay rendering (health bars, cooldown indicators)
  - Camera controls (pan, zoom, focus on action)
  - Layered rendering (ground → creatures → projectiles → UI)

- **State Update Processing**
  - WebSocket state update reception (60 updates/sec fixed rate)
  - State delta compression (only changed fields per tick)
  - 100ms client-side buffer for smooth interpolation
  - Local state cache (previous state for interpolation)
  - Event queue (damage, death, ability use events)
  - Snapshot reconciliation (full state updates every 10 ticks)

- **Animation State Machine**
  - Idle animation loop (plays when unit not moving/attacking)
  - Walk animation loop (plays when unit moving)
  - Attack animation (one-shot, returns to idle)
  - Ability animation (one-shot, varies per ability)
  - Hit reaction animation (brief flash/shake on damage)
  - Death animation (one-shot, unit despawns after completion)
  - Animation transitions (blend between states)
  - Frame-based event triggers (spawn projectile at frame 8 of attack)
  - Timestamp-based synchronization (±100ms tolerance between client/server)
  - Server sends animation start timestamps for deterministic playback

- **Interpolation & Prediction**
  - Position interpolation (smooth movement between server positions)
  - Dead reckoning (predict next position based on velocity)
  - Animation state prediction (predict next animation based on context)
  - Server reconciliation (correct client prediction when server disagrees)
  - Lag compensation (render units where server says they are, not where client thinks)

- **Animation Library Integration**
  - Load pre-generated library animations (55 effects) on demand
  - Composite library effects onto creature sprites
  - Blend modes for magical effects (screen, multiply, overlay)
  - Effect overlay positioning (centered on creature, offset for weapons)
  - Animation frame synchronization (creature + effect frame alignment)

- **Multi-Directional Sprite Integration**
  - 6-directional sprite support (N, NE, SE, S, SW, NW)
  - Automatic direction selection based on movement vector
  - Crossfade transitions between directions (100-200ms blend)
  - Direction-specific attack animations (face target before attack)
  - Fallback to nearest direction if specific angle not available

- **Projectile Rendering**
  - Projectile sprite loading (arrows, fireballs, spells)
  - Projectile trajectory rendering (linear path from source to target)
  - Projectile rotation (face travel direction)
  - Projectile frame animation (4-frame loops for fire/magic)
  - Trail effects (motion blur, particle trail)
  - Impact effect spawning (explosion, splash, hit spark)

- **Visual Feedback & Polish**
  - **Priority 1 (Core Feedback)**:
    - Damage numbers (floating text above damaged units)
    - Health bars (above each creature, red/green gradient)
    - Movement animations (smooth hex-to-hex transitions)
  - **Priority 2 (Combat Clarity)**:
    - Attack animations (ranged/melee with projectiles)
    - Projectile effects (arrows, fireballs traveling)
    - Impact effects (hit sparks, explosions on contact)
  - **Priority 3 (Polish)**:
    - Screen shake (camera shake on big impacts/AOE)
    - Hit flash (brief white/red tint on damaged unit)
    - Cooldown indicators (circular progress bars on abilities)
  - **Priority 4 (Optional Enhancement)**:
    - Unit outline on hover (highlight selected creature)
    - Combat log feed (scrolling text: "Knight dealt 25 damage to Goblin")

- **Performance Optimization**
  - Sprite pooling (reuse sprite objects for effects)
  - Texture atlases (combine sprites into single texture)
  - Frustum culling (don't render off-screen units)
  - Level-of-detail (reduce animation quality for distant units)
  - Batched rendering (render similar sprites in single draw call)
  - WebGL rendering (hardware acceleration)

- **UI Overlays**
  - Battlefield HUD (round timer, score, round number)
  - Unit selection panel (click unit to see stats/abilities)
  - Combat log window (scrolling event feed)
  - Victory/defeat announcement (full-screen overlay)
  - Pause overlay (waiting for opponent, reconnection)

- **Camera Control System**
  - Player-controlled pan (mouse drag or WASD keys)
  - Player-controlled zoom (mouse wheel or +/- keys)
  - Zoom constraints (min/max zoom levels to prevent disorientation)
  - Optional auto-follow mode (camera tracks current action)
  - Reset to center view (spacebar or button to recenter)
  - Smooth camera transitions (eased movement, no jarring jumps)

### Explicitly Excluded

- **Particle Systems**: No custom particle effects for MVP (use pre-generated sprites only)
- **Post-Processing**: No shaders, bloom, motion blur (post-MVP for polish)
- **Replay Playback**: No scrubbing, rewind, slow-motion (post-MVP)
- **Spectator Mode**: No rendering other players' battles (post-MVP)
- **Mobile Touch Controls**: Desktop-only for MVP (mouse input)
- **Dynamic Lighting**: No shadows, light sources (post-MVP)
- **Terrain Rendering**: Flat battlefield only, no elevation or texture variation
- **Advanced Camera Cinematics**: Auto-follow is optional; no dramatic angle changes or cinematic cuts

---

## Key User Journeys

### 1. Watching Combat as Player
**Setup**: Both players deployed, combat begins
1. Client receives combat start event from server
2. Camera zooms to battlefield, hex grid fades to background
3. Creatures appear at deployment positions, playing idle animations (8 FPS loops)
4. **Tick 1-60**: Server sends position updates → Client interpolates smooth movement
5. Creatures transition from idle to walk animations as they move forward
6. **Tick 61**: Server event: "Unit A attacks Unit B"
7. Client plays Unit A's attack animation (15 FPS, 12 frames = 0.8 seconds)
8. **Frame 8 of attack**: Client spawns arrow projectile from Unit A's hand position
9. Projectile travels toward Unit B (5 hexes/sec, rotating to face direction)
10. Projectile reaches Unit B → Client plays impact effect (explosion sprite)
11. Client shows damage number floating above Unit B ("-25" in red)
12. Unit B's health bar updates (100 → 75)
13. Unit B plays brief hit reaction animation (white flash, 100ms)
14. Units return to idle/walk animations, combat continues

### 2. Ability Activation with AOE Effect
1. Server event: "Mage casts Fireball at (5, 3)"
2. Client plays Mage's spell-cast library animation (4 frames, overlaid on creature)
3. Client uses blend mode `screen` to make magic glow
4. **Frame 4 of cast**: Client spawns fireball projectile with fire particle trail
5. Projectile travels to target hex
6. Projectile reaches hex → Client plays AOE explosion effect (64x64 sprite, 4 frames)
7. Client shows damage numbers above all 3 units in AOE radius
8. Health bars update simultaneously
9. Screen shakes briefly (5px shake, 200ms duration)
10. Explosion fades, combat continues

### 3. Unit Death Sequence
1. Server event: "Unit C died"
2. Client plays Unit C's death library animation (6 frames, 0.6 seconds)
3. Unit C fades out during death animation (alpha 1.0 → 0.0)
4. **Last frame of death animation**: Client despawns Unit C sprite
5. Health bar removed
6. Combat log: "Knight has fallen!"
7. Other units continue fighting

### 4. Network Latency Compensation
1. **Server time 0.0s**: Unit moves from (5, 2) to (5, 3)
2. **Client time 0.15s**: Client receives update (150ms latency)
3. Client sees: Unit is at (5, 2) in local state
4. Client interpolates: Smoothly move Unit from (5, 2) to (5, 3) over next 100ms
5. **Client time 0.25s**: Unit reaches (5, 3) visually
6. **Server time 0.2s**: Server sends next update, Unit now at (5, 4)
7. **Client time 0.35s**: Client receives update, interpolates (5, 3) → (5, 4)
8. Player never sees teleportation, only smooth movement

### 5. Performance with 20 Units
1. Combat starts with 16 units (8 vs 8)
2. Client renders 60 FPS with all units playing idle animations
3. Units start moving → Client plays walk animations for 10 units simultaneously
4. 3 units attack simultaneously → Client plays 3 attack animations + 3 projectiles
5. Client maintains 35+ FPS (above 30 FPS target per L0 metric)
6. Player zooms out → Client reduces animation quality (LOD) to maintain FPS
7. Smooth experience throughout combat

---

## Technical Architecture

### Components

**Rendering Engine (PixiJS)**
- `BattlefieldRenderer`: Main PixiJS application and scene manager
- `HexGridLayer`: Renders hex grid background
- `CreatureLayer`: Renders all creature sprites with Z-ordering
- `ProjectileLayer`: Renders projectiles above creatures
- `EffectLayer`: Renders impacts, auras, ground effects
- `UILayer`: Renders health bars, cooldowns, damage numbers
- `CameraController`: Handles pan, zoom, focus

**State Management**
- `ClientGameState`: Local cache of current game state
- `StateUpdateProcessor`: Parses server state deltas
- `EventQueue`: Queues combat events (damage, death, ability)
- `StateDeltaApplicator`: Applies state changes to local state
- `StateReconciler`: Corrects client predictions vs server authority

**Animation System**
- `AnimationController`: Manages animation state machine per unit
- `AnimationLibraryLoader`: Loads 55 library animations on demand
- `EffectCompositor`: Overlays library effects onto creature sprites
- `FrameEventTrigger`: Triggers events at specific animation frames
- `AnimationBlender`: Smooth transitions between animations

**Interpolation & Prediction**
- `PositionInterpolator`: Smooth movement between server positions
- `DeadReckoning`: Predict next position based on velocity
- `AnimationPredictor`: Guess next animation based on context
- `ServerReconciliation`: Correct client when prediction wrong

**Projectile System**
- `ProjectileRenderer`: Renders projectile sprites
- `TrajectoryAnimator`: Animates projectile along path
- `ImpactEffectSpawner`: Creates explosion/impact effects
- `ProjectilePoolManager`: Reuses projectile sprites

**Visual Effects**
- `DamageNumberRenderer`: Floating damage text
- `HealthBarRenderer`: Health bar above each creature
- `HitFlashEffect`: Brief white/red tint on damage
- `ScreenShakeController`: Camera shake on big impacts
- `CombatLogRenderer`: Scrolling combat event text

**Performance Optimization**
- `SpritePoolManager`: Reuse sprites for effects
- `TextureAtlasManager`: Combine textures for batching
- `FrustumCuller`: Skip rendering off-screen sprites
- `LODManager`: Reduce animation quality for distant units
- `RenderStatCollector`: Track FPS, draw calls, sprite count

### Key Technologies

- **PixiJS v7**: 2D WebGL rendering engine
- **React**: UI overlays and controls
- **TypeScript**: Type-safe rendering code
- **WebSocket**: Receive server state updates
- **GSAP/TweenJS**: Animation tweening and interpolation
- **Howler.js**: Sound effects (attack sounds, impact sounds)

### Data Model

**Client-Side Entities**
```typescript
interface ClientGameState {
  tick: number; // Server tick (authoritative)
  clientTick: number; // Client render tick (60 FPS)
  units: ClientUnit[];
  projectiles: ClientProjectile[];
  effects: ClientEffect[];
  events: CombatEvent[];
}

interface ClientUnit {
  unitId: string;
  creatureId: string;
  // Server state (authoritative)
  serverPosition: HexCoordinate;
  serverHealth: number;
  serverStatus: 'alive' | 'dead';

  // Client rendering state (interpolated)
  renderPosition: { x: number, y: number }; // Pixel coordinates
  renderHealth: number; // Smoothly animates to serverHealth
  currentAnimation: AnimationState;
  animationFrame: number;
  facingDirection: number; // Degrees

  // PixiJS objects
  sprite: PIXI.Sprite;
  animationPlayer: PIXI.AnimatedSprite;
  healthBar: PIXI.Graphics;
  effectOverlay?: PIXI.Sprite; // Library animation effect
}

interface AnimationState {
  name: string; // 'idle' | 'walk' | 'attack' | 'ability' | 'death'
  frameCount: number;
  fps: number;
  loop: boolean;
  startTick: number;
  events?: AnimationEvent[]; // Frame-based triggers
}

interface AnimationEvent {
  frame: number;
  eventType: 'spawn_projectile' | 'impact' | 'sound';
  data: Record<string, any>;
}

interface ClientProjectile {
  projectileId: string;
  sourceUnitId: string;
  targetUnitId: string;
  // Server state
  serverPosition: HexCoordinate;
  // Client rendering state
  renderPosition: { x: number, y: number };
  rotation: number; // Face travel direction
  animationFrame: number; // For animated projectiles (fire, magic)
  // PixiJS objects
  sprite: PIXI.Sprite;
  trailEmitter?: PIXI.ParticleEmitter;
}

interface ClientEffect {
  effectId: string;
  effectType: 'impact' | 'aura' | 'ground' | 'buff_visual';
  position: { x: number, y: number };
  animationFrame: number;
  duration: number; // Milliseconds
  startTime: number;
  // PixiJS objects
  sprite: PIXI.AnimatedSprite;
}

interface RenderConfig {
  targetFPS: number; // 60 for smooth, 30 for low-end
  interpolationDelay: number; // ms (buffer for server updates)
  maxProjectiles: number; // Limit simultaneous projectiles
  maxEffects: number; // Limit simultaneous effects
  enableLOD: boolean; // Level-of-detail
  enableScreenShake: boolean;
  showDamageNumbers: boolean;
  showHealthBars: boolean;
}
```

**State Update Processing**
```typescript
class StateUpdateProcessor {
  private currentState: ClientGameState;
  private previousState: ClientGameState;
  private updateBuffer: StateUpdate[] = []; // 100ms buffer for smooth interpolation
  private readonly BUFFER_DURATION_MS = 100;
  private readonly UPDATE_RATE_HZ = 60; // Server sends 60 updates/sec

  processUpdate(update: StateUpdate) {
    // Add to buffer with timestamp
    update.receivedAt = Date.now();
    this.updateBuffer.push(update);

    // Remove updates older than buffer duration
    const cutoffTime = Date.now() - this.BUFFER_DURATION_MS;
    this.updateBuffer = this.updateBuffer.filter(u => u.receivedAt >= cutoffTime);

    // Apply buffered update (100ms delayed for smoothness)
    const bufferedUpdate = this.updateBuffer[0];
    if (!bufferedUpdate) return;

    this.previousState = this.currentState;

    // Apply state delta (only changed fields sent by server)
    for (const unitUpdate of bufferedUpdate.unitUpdates) {
      const unit = this.findUnit(unitUpdate.unitId);
      if (unit) {
        // Update authoritative server state
        if (unitUpdate.position) unit.serverPosition = unitUpdate.position;
        if (unitUpdate.health !== undefined) unit.serverHealth = unitUpdate.health;
        if (unitUpdate.status) unit.serverStatus = unitUpdate.status;

        // Animation sync with server timestamp
        if (unitUpdate.animationChange) {
          this.syncAnimation(unit, {
            name: unitUpdate.animationChange.name,
            startTimestamp: unitUpdate.animationChange.serverTimestamp
          });
        }
      }
    }

    // Process events (damage, death, ability)
    for (const event of bufferedUpdate.events) {
      this.eventQueue.push(event);
    }

    // Add new projectiles
    for (const projectile of bufferedUpdate.newProjectiles) {
      this.spawnProjectile(projectile);
    }

    // Remove expired projectiles
    for (const projectileId of bufferedUpdate.removedProjectiles) {
      this.despawnProjectile(projectileId);
    }
  }

  syncAnimation(unit: ClientUnit, animData: { name: string, startTimestamp: number }) {
    const serverTime = animData.startTimestamp;
    const clientTime = Date.now();
    const timeDelta = clientTime - serverTime;

    // If within ±100ms tolerance, sync to server timeline
    if (Math.abs(timeDelta) <= 100) {
      const elapsedFrames = (timeDelta / 1000) * unit.currentAnimation.fps;
      this.transitionAnimation(unit, animData.name, elapsedFrames);
    } else {
      // Too far desynced, hard reset to server timeline
      this.transitionAnimation(unit, animData.name, 0);
    }
  }

  interpolateState(deltaTime: number) {
    // For each unit, smoothly interpolate render position toward server position
    for (const unit of this.currentState.units) {
      const serverPixelPos = this.hexToPixel(unit.serverPosition);
      const currentPixelPos = unit.renderPosition;

      // Interpolate with exponential smoothing
      const alpha = 1 - Math.exp(-deltaTime / this.interpolationDelay);
      unit.renderPosition.x += (serverPixelPos.x - currentPixelPos.x) * alpha;
      unit.renderPosition.y += (serverPixelPos.y - currentPixelPos.y) * alpha;

      // Update sprite position
      unit.sprite.position.set(unit.renderPosition.x, unit.renderPosition.y);

      // Interpolate health bar
      unit.renderHealth += (unit.serverHealth - unit.renderHealth) * alpha;
      this.updateHealthBar(unit);
    }

    // Update projectile positions (linear interpolation)
    for (const projectile of this.currentState.projectiles) {
      const targetPixelPos = this.hexToPixel(this.getUnit(projectile.targetUnitId).serverPosition);
      const direction = this.normalize({
        x: targetPixelPos.x - projectile.renderPosition.x,
        y: targetPixelPos.y - projectile.renderPosition.y
      });

      const speed = 300; // pixels/second
      projectile.renderPosition.x += direction.x * speed * deltaTime;
      projectile.renderPosition.y += direction.y * speed * deltaTime;

      // Update sprite
      projectile.sprite.position.set(projectile.renderPosition.x, projectile.renderPosition.y);
      projectile.sprite.rotation = Math.atan2(direction.y, direction.x);
    }
  }

  renderFrame(deltaTime: number) {
    // Interpolate all positions
    this.interpolateState(deltaTime);

    // Update animations
    for (const unit of this.currentState.units) {
      if (unit.animationPlayer) {
        unit.animationPlayer.update(deltaTime);

        // Check for frame events
        const currentFrame = Math.floor(unit.animationPlayer.currentFrame);
        const event = unit.currentAnimation.events?.find(e => e.frame === currentFrame);
        if (event && !this.hasTriggeredEvent(event)) {
          this.triggerAnimationEvent(unit, event);
        }
      }

      // Update effect overlay (library animation)
      if (unit.effectOverlay) {
        unit.effectOverlay.position.set(unit.sprite.x, unit.sprite.y);
        unit.effectOverlay.update(deltaTime);
      }
    }

    // Update projectiles
    for (const projectile of this.currentState.projectiles) {
      if (projectile.sprite.texture.baseTexture.resource) {
        projectile.animationFrame = (projectile.animationFrame + 1) % 4;
        // Update texture frame
      }
    }

    // Update effects
    for (const effect of this.currentState.effects) {
      const elapsed = Date.now() - effect.startTime;
      if (elapsed >= effect.duration) {
        this.despawnEffect(effect);
      } else {
        effect.sprite.update(deltaTime);
      }
    }

    // Render all layers
    this.pixiApp.renderer.render(this.stage);
  }

  triggerAnimationEvent(unit: ClientUnit, event: AnimationEvent) {
    switch (event.eventType) {
      case 'spawn_projectile':
        const projectile = this.createProjectileFromEvent(unit, event);
        this.currentState.projectiles.push(projectile);
        break;
      case 'impact':
        const impact = this.createImpactEffect(unit, event);
        this.currentState.effects.push(impact);
        break;
      case 'sound':
        this.playSound(event.data.soundId);
        break;
    }
  }
}
```

---

## Dependencies

### Depends On

- **Authoritative Server Simulation** (L2): Provides state updates and events
- **Hex Grid Deployment System** (L2): Provides hex-to-pixel conversion
- **AI Generation Pipeline** (L1): Provides creature sprites and walk animations
- **Animation Library** (L3 - AI Generation Pipeline): Provides 55 library effects
- **Platform Infrastructure** (L1): WebSocket for state updates, CDN for assets

### Depended On By

- **Multi-Round Battle System** (L2): Uses rendered battlefield for combat phase
- **Combat Mechanics & Ability System** (L2): Visual representation of abilities

---

## Key Technical Challenges

1. **Latency Compensation at 100-150ms**: Server state arrives 150ms late, but client must render smoothly at 60fps. Requires interpolation buffer, dead reckoning prediction, and graceful correction when server disagrees with client prediction.

2. **Animation Synchronization Across Network**: Attack animation must trigger projectile spawn at exact frame (e.g., frame 8 of 12), but server controls timing. Client must play animation at same rate as server expects, despite variable frame rates.

3. **Effect Compositing Performance**: Overlaying library animations onto 16 creature sprites with blend modes (screen, multiply) is GPU-intensive. Must optimize with sprite batching and texture atlases.

4. **Projectile Spawning from Attachment Points**: Projectiles must spawn from creature's hand/mouth/weapon position, which varies per animation frame. Requires animation metadata with attachment point offsets.

5. **Maintaining 30+ FPS with 20 Units**: PixiJS must render 20+ animated sprites, projectiles, effects, and UI at 30+ FPS (per L0 metric). Requires aggressive optimization: culling, LOD, sprite pooling, batched rendering.

6. **Animation State Transitions**: Smoothly blending idle → walk → attack → idle without visual pops. PixiJS AnimatedSprite doesn't support blending, so must implement custom transition logic.

7. **Death Animation Timing**: Death animation must complete before unit despawns, but server removes unit immediately. Client must delay despawn until animation finishes, while ensuring server state remains authoritative.

---

## Success Criteria

### MVP Definition of Done

**Performance & Technical**
- [ ] Battlefield renders at 60 FPS with 0 units, 30+ FPS with 16 units (8v8 MVP scope)
- [ ] State updates arrive at 60/sec with delta compression (only changed fields)
- [ ] 100ms client-side buffer provides smooth interpolation
- [ ] State interpolation handles 100-150ms latency without visible teleportation
- [ ] Client reconciles smoothly when server corrects client prediction
- [ ] No memory leaks (sprites despawn correctly, no orphaned objects)
- [ ] Timestamp-based animation sync maintains ±100ms tolerance

**Animation & Sprites**
- [ ] Creatures play idle animations when stationary (8 FPS loops)
- [ ] Creatures transition to walk animations when moving
- [ ] 6-directional sprite support with automatic direction selection
- [ ] Crossfade transitions between directions (100-200ms blend, no jarring pops)
- [ ] Attack animations trigger at correct moments (server-controlled timestamps)
- [ ] Death animations play fully before unit despawns (ghost mode during animation)
- [ ] Library animations (55 effects) load on demand and composite correctly
- [ ] Blend modes (screen, multiply) work for magical effects

**Projectiles & Effects**
- [ ] Projectiles spawn from creature center position during attack animations
- [ ] Projectiles travel smoothly along trajectories
- [ ] Impact effects play on projectile collision
- [ ] Frame-based event triggers work (spawn projectile at frame 8 of attack)

**Visual Feedback (Priority 1-3)**
- [ ] Damage numbers appear above damaged units and float upward
- [ ] Health bars render above each creature and update smoothly (interpolated)
- [ ] Movement animations show smooth hex-to-hex transitions
- [ ] Attack animations (ranged/melee) play with projectiles
- [ ] Impact effects (hit sparks, explosions) render on contact
- [ ] Screen shake works on big impacts/AOE abilities
- [ ] Hit flash (white/red tint) shows on damaged units
- [ ] Cooldown indicators (circular progress) show on abilities

**Camera & UI**
- [ ] Player can pan camera (mouse drag or WASD keys)
- [ ] Player can zoom camera (mouse wheel or +/- keys)
- [ ] Zoom constraints prevent disorientation (min/max limits)
- [ ] Optional auto-follow mode tracks current action
- [ ] Reset to center view works (spacebar or button)
- [ ] Smooth camera transitions (eased movement, no jarring jumps)
- [ ] UI overlays (round timer, score, round number) render correctly
- [ ] Victory/defeat announcements display full-screen

**Battle Pacing**
- [ ] 120-second battle duration enforced (2 minutes max)
- [ ] Combat completes within time limit or triggers timeout resolution

### Exceptional Target (Post-MVP)

- [ ] 60 FPS maintained with 40+ units on screen
- [ ] Particle systems for fire, smoke, magic trails
- [ ] Post-processing shaders (bloom, motion blur)
- [ ] Camera cinematics (auto-focus on action, smooth panning)
- [ ] Replay playback with timeline scrubbing
- [ ] Slow-motion mode for dramatic moments
- [ ] Mobile touch controls (tap to select, pinch to zoom)
- [ ] Dynamic lighting and shadows
- [ ] Advanced LOD (texture quality scales with zoom)

---

## Open Questions

### RESOLVED Questions (Refinement Session 2025-10-05)

1. **Interpolation Delay** ✅ RESOLVED
   - **Decision**: 100ms client-side buffer for smooth interpolation
   - **Rationale**: Smoother visual experience outweighs minimal lag; 100ms is imperceptible to players

2. **Animation Frame Rate Sync** ✅ RESOLVED
   - **Decision**: Timestamp-based synchronization with ±100ms tolerance
   - **Rationale**: Server sends animation start timestamps; client syncs to server timeline
   - **Implementation**: Client calculates elapsed frames from server timestamp, resumes at correct frame

3. **Projectile Attachment Points** ✅ RESOLVED
   - **Decision**: Baked metadata per animation frame (post-MVP enhancement)
   - **MVP Decision**: Spawn projectiles from creature center position (simple, good enough)
   - **Rationale**: Accurate attachment points are polish; center-spawn works for 90% of cases

4. **Effect Overlay Positioning** ✅ RESOLVED
   - **Decision**: Centered on creature sprite for MVP
   - **Post-MVP**: Offset based on creature type and animation context
   - **Rationale**: Simple centering works for most effects; offsets add complexity without critical value

5. **Death Animation vs Server State** ✅ RESOLVED
   - **Decision**: Hybrid approach - play death animation while unit is "ghost" (non-interactive)
   - **Implementation**: Server marks unit as dead immediately; client plays death animation then despawns
   - **Rationale**: Maintains server authority while allowing smooth visual transition

6. **Performance vs Quality** ✅ RESOLVED
   - **MVP Target**: 30+ FPS with 16 units (8v8)
   - **Aspirational**: 60 FPS with optimizations (texture atlases, sprite pooling, LOD)
   - **Rationale**: 30 FPS is acceptable per L0; 60 FPS is post-MVP polish goal

7. **Sound Effects** ✅ RESOLVED
   - **Decision**: Play sounds on animation trigger (client-side, immediate)
   - **Rationale**: Immediate audio feedback feels more responsive; slight desync is acceptable
   - **Fallback**: Server can send audio events for critical sounds (ability activations)

8. **Damage Number Styling** ✅ RESOLVED
   - **Decision**: Show all damage numbers (Priority 1 visual feedback)
   - **Implementation**: Floating numbers with smart positioning to avoid overlap
   - **Rationale**: Players want complete feedback; clutter can be mitigated with good layout

9. **Multi-Directional Sprites** ✅ RESOLVED
   - **Decision**: 6-directional sprite support with crossfade transitions (100-200ms)
   - **Implementation**: Automatic direction selection based on movement vector
   - **Rationale**: 6 directions provide good coverage; crossfade prevents jarring transitions

10. **Camera Control** ✅ RESOLVED
    - **Decision**: Full player control (pan/zoom) with optional auto-follow mode
    - **Implementation**: Mouse drag/WASD for pan, mouse wheel/+- for zoom
    - **Rationale**: Players want agency over viewing angle; auto-follow is convenience feature

11. **Battle Pacing** ✅ RESOLVED
    - **Decision**: 120-second battle duration (2 minutes)
    - **Rationale**: Balances engagement vs. attention span; prevents overly long battles

12. **State Update Rate** ✅ RESOLVED
    - **Decision**: 60 updates/sec with delta compression (only changed fields)
    - **Rationale**: Smooth state updates with minimal bandwidth; delta compression reduces payload size

### Remaining Open Questions

None - all critical questions resolved during refinement session.

---

## L3 Feature Candidates

### Core Rendering
- **PixiJS Battlefield Renderer** - Main scene manager, layered rendering
- **Hex Grid Background Layer** - Grid rendering with coordinate system
- **Creature Sprite Layer** - Render 16 creatures (8v8) with Z-ordering
- **Projectile Rendering Layer** - Projectile sprites above creatures
- **Effect Rendering Layer** - Impacts, auras, ground effects

### State Processing
- **State Update Processor with Buffering** - Parse server state deltas with 100ms buffer
- **Delta Compression Handler** - Process only changed fields (60 updates/sec)
- **Event Queue Manager** - Queue combat events (damage, death, ability)
- **State Reconciliation System** - Correct client predictions vs server authority
- **Timestamp Synchronization** - Sync client/server timelines (±100ms tolerance)

### Animation System
- **Animation State Machine** - Manage animation states per unit (idle/walk/attack/death)
- **Timestamp-Based Animation Sync** - Sync animations to server timeline
- **Animation Library Loader** - Load 55 library animations on demand
- **Effect Compositor** - Overlay library effects with blend modes (screen/multiply)
- **Frame Event Trigger System** - Spawn projectiles at specific animation frames
- **Animation Transition System** - Smooth blending between animation states

### Multi-Directional Sprite System
- **6-Direction Sprite Selector** - Choose sprite direction from movement vector
- **Direction Crossfade Renderer** - Blend between directions (100-200ms transitions)
- **Facing Direction Calculator** - Determine unit facing based on target
- **Direction Fallback Handler** - Use nearest direction if specific angle unavailable

### Interpolation & Prediction
- **Position Interpolator with Buffer** - Smooth movement with 100ms delay
- **Dead Reckoning Predictor** - Predict next position based on velocity
- **Server Reconciliation** - Correct client when prediction diverges
- **Lag Compensation System** - Handle 100-150ms network latency

### Visual Feedback System
- **Damage Number Renderer** - Floating damage text (Priority 1)
- **Health Bar System** - Interpolated health bars above creatures (Priority 1)
- **Movement Animation System** - Smooth hex-to-hex transitions (Priority 1)
- **Attack Animation Handler** - Ranged/melee attacks with projectiles (Priority 2)
- **Impact Effect Spawner** - Hit sparks, explosions on contact (Priority 2)
- **Screen Shake Controller** - Camera shake on big impacts (Priority 3)
- **Hit Flash Effect** - Brief tint on damaged units (Priority 3)
- **Cooldown Indicator Renderer** - Circular progress bars (Priority 3)

### Projectile System
- **Projectile Renderer** - Render projectile sprites
- **Trajectory Animator** - Linear path animation from source to target
- **Projectile Spawn Manager** - Spawn from creature center (MVP) or attachment points (post-MVP)
- **Impact Effect Spawner** - Explosion/impact effects on collision
- **Projectile Pool Manager** - Sprite reuse for performance

### Camera Control System
- **Camera Pan Controller** - Mouse drag or WASD key controls
- **Camera Zoom Controller** - Mouse wheel or +/- key controls
- **Zoom Constraint Manager** - Min/max zoom limits
- **Auto-Follow Mode** - Optional camera tracking of current action
- **Camera Reset Handler** - Spacebar or button to recenter view
- **Camera Easing System** - Smooth transitions, no jarring jumps

### Performance Optimization
- **Sprite Pool Manager** - Reuse sprites for effects
- **Texture Atlas Manager** - Combine textures for batching
- **Frustum Culler** - Skip off-screen rendering
- **LOD Manager** - Reduce animation quality for distant units
- **Render Stats Collector** - FPS, draw calls, profiling
- **Delta Compression Optimizer** - Minimize bandwidth with delta updates

### UI Overlays & HUD
- **Battlefield HUD** - Round timer, score, round number
- **Unit Selection Panel** - Click unit to see stats/abilities
- **Combat Log Renderer** - Scrolling event feed (Priority 4, optional)
- **Victory/Defeat Overlay** - Full-screen announcements
- **Pause/Reconnection Overlay** - Waiting states

### Battle Pacing System
- **120-Second Timer** - Enforce 2-minute battle duration
- **Timeout Resolution Handler** - Resolve battles that exceed time limit

---

## Metadata

- **Estimated Effort**: 6-8 weeks (core features), 10-12 weeks (with polish)
- **Team Size**: 2-3 developers (1 PixiJS specialist, 1 frontend, 1 QA)
- **Priority**: CRITICAL (player-facing experience)
- **Risks**: MEDIUM (performance optimization, synchronization complexity)
- **Blockers**: Requires Server Simulation and Animation Library

---

## Change Log

### Version 1.1 (2025-10-05) - Refinement Complete

**Major Updates:**
1. Added "AI-Driven Creature Stats" section explaining stat assignment during generation
2. Updated "State Update Processing" with 60/sec rate, delta compression, 100ms buffer
3. Updated "Animation State Machine" with timestamp-based synchronization (±100ms)
4. Added "Multi-Directional Sprite Integration" section (6 directions, crossfade)
5. Updated "Visual Feedback & Polish" with 4-tier priority system
6. Added "Camera Control System" section (full player control + optional auto-follow)
7. Resolved ALL 12 open questions with final technical decisions
8. Updated "Success Criteria" to reflect MVP scope (8v8, 30+ FPS, 120s battles)
9. Expanded L3 feature candidates with refined subsystems
10. Added timestamp-based animation sync pseudocode to technical examples

**Key Technical Decisions:**
- 60 updates/sec with delta compression (only changed fields)
- 100ms client-side buffer for smooth interpolation
- Timestamp-based animation sync with ±100ms tolerance
- 6-directional sprites with 100-200ms crossfade transitions
- Full player camera control (pan/zoom) with optional auto-follow
- 120-second battle duration (2 minutes)
- MVP scope: 8v8 (16 units) at 30+ FPS
- All visual feedback prioritized (P1-P4) for phased implementation

**Status:** Ready for L3 feature breakdown and task definition.

---

*This document defines the client-side rendering and animation synchronization system for the Battle Engine. All open questions have been resolved, and the epic is ready for L3 feature decomposition.*
