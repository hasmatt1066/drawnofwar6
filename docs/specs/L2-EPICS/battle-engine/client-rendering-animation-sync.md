# L2 EPIC: Client Rendering & Animation Sync

**Epic ID**: `battle-client-render`
**Parent Theme**: Battle Engine (L1)
**Status**: PLANNING
**Version**: 1.0
**Last Updated**: 2025-10-03

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
5. **Performance**: Maintain 30+ FPS with 20+ animated creatures on screen (per L0 metric)

Without proper rendering and sync, battles feel disconnected—units teleport instead of moving, attacks look wrong, and players can't follow the action. This epic transforms server state into cinematic gameplay.

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
  - WebSocket state update reception (30-60 updates/sec)
  - State delta parsing (only changes per tick)
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

- **Projectile Rendering**
  - Projectile sprite loading (arrows, fireballs, spells)
  - Projectile trajectory rendering (linear path from source to target)
  - Projectile rotation (face travel direction)
  - Projectile frame animation (4-frame loops for fire/magic)
  - Trail effects (motion blur, particle trail)
  - Impact effect spawning (explosion, splash, hit spark)

- **Visual Feedback & Polish**
  - Damage numbers (floating text above damaged units)
  - Health bars (above each creature, red/green gradient)
  - Cooldown indicators (circular progress bars on abilities)
  - Hit flash (brief white/red tint on damaged unit)
  - Screen shake on big impacts (AOE abilities, deaths)
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

### Explicitly Excluded

- **Particle Systems**: No custom particle effects for MVP (use pre-generated sprites only)
- **Post-Processing**: No shaders, bloom, motion blur (post-MVP for polish)
- **Camera Cinematics**: No auto-focus on action, smooth panning (post-MVP)
- **Replay Playback**: No scrubbing, rewind, slow-motion (post-MVP)
- **Spectator Mode**: No rendering other players' battles (post-MVP)
- **Mobile Touch Controls**: Desktop-only for MVP (mouse input)
- **Dynamic Lighting**: No shadows, light sources (post-MVP)
- **Terrain Rendering**: Flat battlefield only, no elevation or texture variation

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

  processUpdate(update: StateUpdate) {
    this.previousState = this.currentState;

    // Apply state delta
    for (const unitUpdate of update.unitUpdates) {
      const unit = this.findUnit(unitUpdate.unitId);
      if (unit) {
        // Update authoritative server state
        unit.serverPosition = unitUpdate.position;
        unit.serverHealth = unitUpdate.health;
        unit.serverStatus = unitUpdate.status;

        // If animation changed, trigger transition
        if (unitUpdate.animation && unitUpdate.animation !== unit.currentAnimation.name) {
          this.transitionAnimation(unit, unitUpdate.animation);
        }
      }
    }

    // Process events (damage, death, ability)
    for (const event of update.events) {
      this.eventQueue.push(event);
    }

    // Add new projectiles
    for (const projectile of update.newProjectiles) {
      this.spawnProjectile(projectile);
    }

    // Remove expired projectiles
    for (const projectileId of update.removedProjectiles) {
      this.despawnProjectile(projectileId);
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

- [ ] Battlefield renders at 60 FPS with 0 units, 30+ FPS with 20 units (per L0 metric)
- [ ] Creatures play idle animations when stationary (8 FPS loops)
- [ ] Creatures transition to walk animations when moving
- [ ] Attack animations trigger at correct moments (server-controlled)
- [ ] Projectiles spawn at attachment points during attack animations
- [ ] Projectiles travel smoothly along trajectories (5 hexes/sec)
- [ ] Impact effects play on projectile collision
- [ ] Damage numbers appear above damaged units and float upward
- [ ] Health bars update smoothly (interpolated, not instant)
- [ ] Death animations play fully before unit despawns
- [ ] Library animations (55 effects) load on demand and composite correctly
- [ ] Blend modes (screen, multiply) work for magical effects
- [ ] State interpolation handles 100-150ms latency without visible teleportation
- [ ] Client reconciles smoothly when server corrects client prediction
- [ ] Combat log displays major events (damage, death, ability use)
- [ ] UI overlays (round timer, score) render correctly
- [ ] No memory leaks (sprites despawn correctly, no orphaned objects)

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

1. **Interpolation Delay**: Should client buffer server updates for 100ms (smoother) or render immediately (more responsive)? Longer buffer = smoother, but feels laggy.

2. **Animation Frame Rate Sync**: Server simulates at 60 ticks/sec, animations play at 8-15 FPS. How do we ensure frame events (spawn projectile at frame 8) trigger at exact same moment on client and server?

3. **Projectile Attachment Points**: Should attachment points be baked into creature sprites (metadata), or computed dynamically based on animation frame? Baked = accurate, dynamic = flexible but complex.

4. **Effect Overlay Positioning**: Should library animations overlay centered on creature, or offset based on creature size/type? Centered = simple, offset = more accurate (e.g., sword slash in front of unit).

5. **Death Animation vs Server State**: When server says unit is dead, should client:
   - Play death animation, then remove (smooth, but delays server state)
   - Remove immediately, play death effect at position (responsive, but less smooth)
   - Play death animation while unit "ghost" (non-interactive) (hybrid approach)

6. **Performance vs Quality**: Should we target 60 FPS (buttery smooth) or 30 FPS (acceptable per L0, but easier to achieve)? 60 FPS requires more optimization effort.

7. **Sound Effects**: Should attack sounds play when animation triggers (client-side, immediate) or when damage applied (server-side, delayed)? Immediate feels better but can desync.

8. **Damage Number Styling**: Floating numbers are readable but can clutter screen with 20 units. Should we:
   - Show all damage numbers (verbose, but complete info)
   - Only show critical hits (cleaner, but less feedback)
   - Aggregate damage per second (e.g., "125 DPS" above unit)

---

## L3 Feature Candidates

### Core Rendering
- **PixiJS Battlefield Renderer** - Main scene manager, layered rendering
- **Hex Grid Background Layer** - Grid rendering
- **Creature Sprite Layer** - Render 16+ creatures with Z-ordering
- **Projectile Rendering Layer** - Projectile sprites above creatures
- **Effect Rendering Layer** - Impacts, auras, ground effects

### State Processing
- **State Update Processor** - Parse server state deltas
- **Event Queue Manager** - Queue combat events
- **State Reconciliation** - Correct client predictions

### Animation System
- **Animation Controller** - Manage animation state machine per unit
- **Animation Library Loader** - Load 55 library animations
- **Effect Compositor** - Overlay library effects with blend modes
- **Frame Event Trigger** - Spawn projectiles at animation frames
- **Animation Transition System** - Blend between animation states

### Interpolation
- **Position Interpolator** - Smooth movement between server positions
- **Dead Reckoning Predictor** - Predict next position
- **Server Reconciliation** - Correct client when wrong

### Visual Effects
- **Damage Number Renderer** - Floating damage text
- **Health Bar System** - Health bars above creatures
- **Hit Flash Effect** - Brief tint on damage
- **Screen Shake Controller** - Camera shake on impacts
- **Combat Log Renderer** - Scrolling event feed

### Projectile System
- **Projectile Renderer** - Render projectile sprites
- **Trajectory Animator** - Animate along path
- **Impact Effect Spawner** - Explosion/impact effects
- **Projectile Pool Manager** - Sprite reuse

### Performance
- **Sprite Pool Manager** - Reuse sprites
- **Texture Atlas Manager** - Combine textures
- **Frustum Culler** - Skip off-screen rendering
- **LOD Manager** - Reduce quality for distant units
- **Render Stats Collector** - FPS, draw calls, profiling

### UI Overlays
- **Battlefield HUD** - Round timer, score, round number
- **Unit Selection Panel** - Click unit to see stats
- **Victory/Defeat Overlay** - Full-screen announcements

---

## Metadata

- **Estimated Effort**: 6-8 weeks (core features), 10-12 weeks (with polish)
- **Team Size**: 2-3 developers (1 PixiJS specialist, 1 frontend, 1 QA)
- **Priority**: CRITICAL (player-facing experience)
- **Risks**: MEDIUM (performance optimization, synchronization complexity)
- **Blockers**: Requires Server Simulation and Animation Library

---

*This document defines the client-side rendering and animation synchronization system. Ready for L3 feature breakdown and task definition.*
