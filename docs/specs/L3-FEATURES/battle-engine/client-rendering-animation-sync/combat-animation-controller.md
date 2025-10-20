# L3 FEATURE: Combat Animation Controller

**Feature ID**: `combat-animation-controller`
**Parent Epic**: Client Rendering & Animation Sync (L2)
**Status**: PLANNING
**Version**: 1.0
**Last Updated**: 2025-10-05

---

## Overview

The **Combat Animation Controller** is the client-side animation state machine that manages creature animation playback during combat. It receives server state updates (60/sec) via WebSocket, transitions animations based on combat events (idle → walk → attack → death), synchronizes animation timing using server timestamps (±100ms tolerance), and triggers frame-based events (spawn projectile at frame 8 of attack animation).

**Purpose**: Transform abstract server combat state (position changes, attack events, death flags) into smooth, synchronized creature animations that make battles feel alive and responsive.

**User Value**: Players see creatures naturally animate through combat—walking toward enemies, winding up attacks, playing ability animations, and falling in death—creating an engaging visual spectacle that makes auto-battles entertaining to watch rather than static and boring.

---

## Functional Requirements

### FR-1: Animation State Machine

**What**: Per-creature state machine managing animation transitions based on combat state

**States**:
1. **Idle**: Looping idle animation (8 FPS) when creature is stationary and not attacking
2. **Walk**: Looping walk animation (12 FPS) when creature is moving toward target
3. **Attack**: One-shot attack animation (15 FPS, 0.8s duration) triggered by server attack event
4. **Ability**: One-shot ability animation (12-15 FPS, varies by ability) for special abilities
5. **Hit**: Brief hit reaction (white flash, 100ms) overlaid on current animation
6. **Death**: One-shot death animation (12 FPS, 0.6s duration) before despawn

**Transition Rules**:
```typescript
interface AnimationTransitions {
  idle: {
    walk: 'when unit.serverPosition changes',
    attack: 'on server attack event',
    ability: 'on server ability event',
    death: 'on server death event'
  };
  walk: {
    idle: 'when unit reaches serverPosition',
    attack: 'on server attack event (stop movement)',
    ability: 'on server ability event (stop movement)',
    death: 'on server death event'
  };
  attack: {
    idle: 'when attack animation completes',
    walk: 'when attack completes AND still moving',
    death: 'on server death event (interrupt attack)'
  };
  ability: {
    idle: 'when ability animation completes',
    walk: 'when ability completes AND still moving',
    death: 'on server death event (interrupt ability)'
  };
  death: {
    // Terminal state - no transitions
  };
}
```

**Transition Timing**:
- State changes are **event-driven** (server sends animation change event)
- Transitions happen immediately on event receipt (no delay)
- One-shot animations (attack, ability, death) **cannot be interrupted** except by death
- Hit reactions **overlay** on current animation (don't interrupt)

---

### FR-2: Timestamp-Based Animation Synchronization

**What**: Sync animation playback between client and server using timestamps to ensure deterministic frame triggers

**Problem**: Server simulates combat at 60 tps (ticks per second) and decides when attacks occur. Client must play attack animation at same rate so projectile spawns at correct frame (e.g., frame 8 of 12-frame attack = 533ms after start).

**Solution**: Server sends animation start timestamps; client syncs to server timeline.

**Server Broadcast**:
```typescript
interface AnimationChangeEvent {
  unitId: string;
  animationName: 'idle' | 'walk' | 'attack' | 'ability_fire_breath' | 'death';
  serverTimestamp: number; // Unix timestamp in milliseconds when animation started
  abilityId?: string; // If ability animation
}
```

**Client Synchronization Algorithm**:
```typescript
function syncAnimation(
  unit: ClientUnit,
  event: AnimationChangeEvent,
  clientReceiveTime: number
) {
  const serverStartTime = event.serverTimestamp;
  const networkLatency = clientReceiveTime - serverStartTime; // ~100-150ms

  // Calculate how many frames elapsed since server started animation
  const elapsedMs = networkLatency;
  const animation = getAnimation(event.animationName);
  const elapsedFrames = (elapsedMs / 1000) * animation.fps;

  // If within ±100ms tolerance, resume at correct frame
  if (Math.abs(elapsedMs) <= 100) {
    unit.animationPlayer.gotoAndPlay(Math.floor(elapsedFrames));
    unit.animationSyncTimestamp = serverStartTime;
  } else {
    // Too far desynced, hard reset to frame 0
    unit.animationPlayer.gotoAndPlay(0);
    unit.animationSyncTimestamp = clientReceiveTime;
    console.warn(`Animation desync > 100ms for ${unit.unitId}, resetting`);
  }
}
```

**Why Timestamps**:
- Server simulates at 60 tps but client renders at variable FPS (30-60)
- Without sync, frame events (spawn projectile) trigger at wrong times
- Timestamp sync ensures projectile spawns at same moment on all clients
- ±100ms tolerance accounts for network jitter

---

### FR-3: Frame-Based Event Triggers

**What**: Trigger gameplay events (projectile spawns, impact effects, sounds) at specific animation frames

**Use Cases**:
1. **Projectile Spawn**: Archer releases arrow at frame 8 of 12-frame attack (bow fully drawn)
2. **Impact Effect**: Sword slash creates spark effect at frame 6 of 10-frame melee attack
3. **Sound Effect**: Fireball whoosh sound plays at frame 4 of 8-frame spell cast

**Animation Metadata**:
```typescript
interface AnimationDefinition {
  name: string;
  frameCount: number;
  fps: number;
  loop: boolean;
  events: AnimationFrameEvent[];
}

interface AnimationFrameEvent {
  frame: number; // 0-indexed frame number
  eventType: 'spawn_projectile' | 'impact_effect' | 'sound' | 'screen_shake';
  data: Record<string, any>;
}

// Example: Bow attack animation
const BOW_ATTACK_ANIMATION: AnimationDefinition = {
  name: 'attack_ranged_bow',
  frameCount: 12,
  fps: 15, // 0.8 seconds total
  loop: false,
  events: [
    {
      frame: 2,
      eventType: 'sound',
      data: { soundId: 'bow_draw' }
    },
    {
      frame: 8,
      eventType: 'spawn_projectile',
      data: { projectileType: 'arrow', spawnPoint: 'hand' }
    },
    {
      frame: 9,
      eventType: 'sound',
      data: { soundId: 'bow_release' }
    }
  ]
};
```

**Event Triggering Logic**:
```typescript
class AnimationController {
  private triggeredEvents = new Set<string>(); // Track triggered events to avoid duplicates

  update(deltaTime: number) {
    for (const unit of this.units) {
      const anim = unit.currentAnimation;
      const player = unit.animationPlayer;

      // Get current frame
      const currentFrame = Math.floor(player.currentFrame);
      const previousFrame = Math.floor(player.currentFrame - (deltaTime * anim.fps));

      // Check for frame events between previous and current frame
      for (const event of anim.events) {
        if (event.frame >= previousFrame && event.frame <= currentFrame) {
          const eventKey = `${unit.unitId}-${anim.name}-${event.frame}`;

          // Only trigger once per animation playback
          if (!this.triggeredEvents.has(eventKey)) {
            this.triggerEvent(unit, event);
            this.triggeredEvents.add(eventKey);
          }
        }
      }

      // Clear triggered events when animation completes
      if (player.currentFrame >= anim.frameCount - 1) {
        this.clearTriggeredEvents(unit.unitId, anim.name);
      }
    }
  }

  private triggerEvent(unit: ClientUnit, event: AnimationFrameEvent) {
    switch (event.eventType) {
      case 'spawn_projectile':
        this.projectileSystem.spawn({
          sourceUnit: unit,
          projectileType: event.data.projectileType,
          spawnPoint: unit.renderPosition // MVP: spawn from center
        });
        break;

      case 'impact_effect':
        this.effectSystem.spawn({
          effectType: event.data.effectType,
          position: unit.renderPosition,
          duration: event.data.duration || 300
        });
        break;

      case 'sound':
        this.audioManager.playSound(event.data.soundId);
        break;

      case 'screen_shake':
        this.cameraController.shake(event.data.intensity || 5, event.data.duration || 200);
        break;
    }
  }
}
```

---

### FR-4: Multi-Directional Sprite Support

**What**: Automatically select and transition between 6 directional sprites based on creature movement direction

**Directions Supported**:
- **Generated** (3): E (East), NE (Northeast), SE (Southeast)
- **Mirrored** (3): W (West), NW (Northwest), SW (Southwest)

**Direction Selection Algorithm**:
```typescript
function selectDirection(movementVector: { x: number, y: number }): HexDirection {
  // Calculate angle from movement vector
  const angle = Math.atan2(movementVector.y, movementVector.x);
  const degrees = (angle * 180 / Math.PI + 360) % 360; // Normalize to 0-360

  // Map angle to nearest direction
  // E: 330-30°, NE: 30-90°, NW: 90-150°, W: 150-210°, SW: 210-270°, SE: 270-330°
  if (degrees >= 330 || degrees < 30) return 'E';
  if (degrees >= 30 && degrees < 90) return 'NE';
  if (degrees >= 90 && degrees < 150) return 'NW';
  if (degrees >= 150 && degrees < 210) return 'W';
  if (degrees >= 210 && degrees < 270) return 'SW';
  if (degrees >= 270 && degrees < 330) return 'SE';

  return 'E'; // Fallback
}
```

**Crossfade Transitions**:
- When direction changes, crossfade between old and new sprite over 100-200ms
- Prevents jarring "pops" when creature turns
- Implemented using PIXI.js alpha blending:

```typescript
async function transitionDirection(
  unit: ClientUnit,
  newDirection: HexDirection
) {
  const oldSprite = unit.sprite;
  const newSprite = await this.loadDirectionalSprite(unit.creatureId, newDirection);

  // Position new sprite at same location
  newSprite.position.set(oldSprite.x, oldSprite.y);
  newSprite.alpha = 0;
  this.stage.addChild(newSprite);

  // Crossfade over 150ms
  const duration = 150;
  const startTime = Date.now();

  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    oldSprite.alpha = 1 - progress;
    newSprite.alpha = progress;

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      // Remove old sprite
      this.stage.removeChild(oldSprite);
      unit.sprite = newSprite;
      unit.currentDirection = newDirection;
    }
  };

  animate();
}
```

**Mirroring**:
```typescript
function loadDirectionalSprite(
  creatureId: string,
  direction: HexDirection
): PIXI.Sprite {
  const mirrorMap = {
    W: { generated: 'E', flip: true },
    NW: { generated: 'NE', flip: true },
    SW: { generated: 'SE', flip: true },
    E: { generated: 'E', flip: false },
    NE: { generated: 'NE', flip: false },
    SE: { generated: 'SE', flip: false }
  };

  const config = mirrorMap[direction];
  const spriteData = this.getSpriteData(creatureId, config.generated);
  const sprite = PIXI.Sprite.from(spriteData);

  if (config.flip) {
    sprite.scale.x = -1; // Horizontal flip
  }

  return sprite;
}
```

---

### FR-5: Animation Library Integration

**What**: Composite 55 pre-generated library animations onto creature sprites for abilities and effects

**Library Animations** (examples):
- Fire: `breathe_fire`, `cast_fire_spell`, `flame_aura`
- Ice: `breathe_ice`, `cast_ice_spell`, `frost_nova`
- Lightning: `breathe_lightning`, `cast_lightning_spell`, `chain_lightning`
- Melee: `attack_melee_claw`, `attack_melee_bite`, `attack_melee_sword`
- Buffs: `buff_glow`, `heal_effect`, `shield_up`

**Compositing Strategy**:
```typescript
class EffectCompositor {
  async overlayLibraryAnimation(
    unit: ClientUnit,
    animationId: string,
    blendMode: PIXI.BLEND_MODES = PIXI.BLEND_MODES.NORMAL
  ): Promise<void> {
    // Load library animation frames
    const frames = await this.loadLibraryAnimation(animationId);

    // Create animated sprite
    const effectSprite = new PIXI.AnimatedSprite(frames);
    effectSprite.animationSpeed = 0.5; // 12 FPS at 60 FPS ticker
    effectSprite.loop = false;
    effectSprite.blendMode = blendMode;

    // Position centered on creature
    effectSprite.anchor.set(0.5, 0.5);
    effectSprite.position.set(unit.sprite.x, unit.sprite.y);

    // Scale based on creature size
    const sizeMultiplier = this.getCreatureSizeMultiplier(unit);
    effectSprite.scale.set(sizeMultiplier, sizeMultiplier);

    // Add to effect layer (renders above creatures)
    this.effectLayer.addChild(effectSprite);
    effectSprite.play();

    // Remove when animation completes
    effectSprite.onComplete = () => {
      this.effectLayer.removeChild(effectSprite);
      effectSprite.destroy();
    };

    // Store reference for cleanup
    unit.activeEffects.push(effectSprite);
  }

  private getCreatureSizeMultiplier(unit: ClientUnit): number {
    // Scale library effects based on creature size
    const sizeMap = {
      small: 0.7,
      medium: 1.0,
      large: 1.3
    };
    return sizeMap[unit.size] || 1.0;
  }
}
```

**Blend Modes for Magic**:
- **NORMAL**: Default blending (physical effects, impacts)
- **SCREEN**: Additive blending (fire, lightning, holy magic - makes bright areas brighter)
- **MULTIPLY**: Darkening blending (shadow, dark magic - makes dark areas darker)
- **OVERLAY**: Contrast enhancement (buffs, auras)

```typescript
const EFFECT_BLEND_MODES = {
  fire: PIXI.BLEND_MODES.SCREEN,
  ice: PIXI.BLEND_MODES.NORMAL,
  lightning: PIXI.BLEND_MODES.SCREEN,
  dark: PIXI.BLEND_MODES.MULTIPLY,
  holy: PIXI.BLEND_MODES.SCREEN,
  buff: PIXI.BLEND_MODES.OVERLAY,
  physical: PIXI.BLEND_MODES.NORMAL
};
```

---

### FR-6: Death Animation & Ghost Mode

**What**: Handle death animation gracefully while respecting server authority

**Server Behavior**:
- Server marks unit as `status: 'dead'` immediately when HP reaches 0
- Server removes unit from combat state on next tick
- Server broadcasts `unit_died` event

**Client Behavior** (Hybrid Approach):
1. **Receive Death Event**: Server sends `{ unitId: 'abc', status: 'dead' }`
2. **Enter Ghost Mode**: Mark unit as non-interactive but keep visible
3. **Play Death Animation**: Transition to death animation (one-shot, 0.6s duration)
4. **Fade Out**: Alpha fade from 1.0 → 0.0 during death animation
5. **Despawn**: Remove sprite from stage when animation completes

```typescript
function handleDeathEvent(unitId: string) {
  const unit = this.findUnit(unitId);
  if (!unit) return;

  // Mark as ghost (non-interactive)
  unit.isGhost = true;
  unit.status = 'dead';

  // Remove health bar immediately
  this.removeHealthBar(unit);

  // Transition to death animation
  this.transitionAnimation(unit, 'death');

  // Fade out during death animation
  const deathDuration = 600; // 0.6 seconds
  const startTime = Date.now();

  const fadeOut = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / deathDuration, 1);

    unit.sprite.alpha = 1 - progress;

    if (progress < 1) {
      requestAnimationFrame(fadeOut);
    } else {
      // Death animation complete, despawn
      this.despawnUnit(unit);
    }
  };

  fadeOut();

  // Add combat log entry
  this.combatLog.add(`${unit.name} has fallen!`);
}

function despawnUnit(unit: ClientUnit) {
  // Remove sprite from stage
  this.creatureLayer.removeChild(unit.sprite);

  // Clean up effects
  for (const effect of unit.activeEffects) {
    this.effectLayer.removeChild(effect);
    effect.destroy();
  }

  // Remove from units array
  const index = this.units.indexOf(unit);
  if (index !== -1) {
    this.units.splice(index, 1);
  }

  // Destroy PIXI objects
  unit.sprite.destroy();
  unit.animationPlayer.destroy();
}
```

**Ghost Mode Properties**:
- Unit is **visible** (playing death animation)
- Unit is **non-interactive** (cannot be targeted, no collision)
- Unit **does not block pathing** (other units can walk through)
- Unit **fades out** during death animation
- Unit **despawns** when animation completes

---

## Technical Architecture

### Components

**Frontend Services** (`/frontend/src/services/`):

1. **Animation Controller** (`animation/animation-controller.ts`):
   - Main animation state machine
   - Manages per-unit animation state
   - Handles state transitions
   - Exports: `AnimationController` class

2. **Animation Synchronizer** (`animation/animation-synchronizer.ts`):
   - Timestamp-based sync logic
   - Calculates elapsed frames from server timestamp
   - Handles ±100ms tolerance checks
   - Exports: `syncAnimation(unit, event)`

3. **Frame Event Manager** (`animation/frame-event-manager.ts`):
   - Tracks triggered events (prevent duplicates)
   - Triggers projectile spawns, effects, sounds
   - Exports: `FrameEventManager` class

4. **Direction Manager** (`animation/direction-manager.ts`):
   - Direction selection from movement vector
   - Crossfade transitions between directions
   - Sprite mirroring for W/NW/SW
   - Exports: `DirectionManager` class

5. **Effect Compositor** (`animation/effect-compositor.ts`):
   - Library animation loading and compositing
   - Blend mode application
   - Size-based scaling
   - Exports: `EffectCompositor` class

6. **Death Animation Handler** (`animation/death-handler.ts`):
   - Ghost mode management
   - Fade-out animation
   - Despawn after completion
   - Exports: `DeathAnimationHandler` class

**Integration Point** (`/frontend/src/services/combat/combat-renderer.ts`):
```typescript
class CombatRenderer {
  private animationController: AnimationController;
  private stateProcessor: StateUpdateProcessor;

  constructor() {
    this.animationController = new AnimationController({
      creatureLayer: this.creatureLayer,
      effectLayer: this.effectLayer,
      projectileSystem: this.projectileSystem,
      audioManager: this.audioManager
    });
  }

  onServerStateUpdate(update: StateUpdate) {
    // Process server state
    this.stateProcessor.processUpdate(update);

    // Handle animation changes
    for (const animChange of update.animationChanges) {
      this.animationController.syncAnimation(animChange, Date.now());
    }

    // Handle death events
    for (const event of update.events) {
      if (event.eventType === 'unit_died') {
        this.animationController.handleDeath(event.data.unitId);
      }
    }
  }

  renderFrame(deltaTime: number) {
    // Update animation state
    this.animationController.update(deltaTime);

    // Interpolate positions
    this.stateProcessor.interpolateState(deltaTime);

    // Render all layers
    this.pixiApp.renderer.render(this.stage);
  }
}
```

---

### Key Algorithms

**Algorithm 1: Animation State Transition**
```typescript
function transitionAnimation(
  unit: ClientUnit,
  newAnimationName: string,
  startFrame: number = 0
): void {
  const oldAnimation = unit.currentAnimation;
  const newAnimation = this.getAnimationDefinition(newAnimationName);

  // Skip if already playing this animation
  if (oldAnimation?.name === newAnimationName && unit.animationPlayer.playing) {
    return;
  }

  // Load animation frames
  const frames = this.loadAnimationFrames(unit.creatureId, newAnimationName, unit.currentDirection);

  // Create new animation player
  const player = new PIXI.AnimatedSprite(frames);
  player.animationSpeed = newAnimation.fps / 60; // Convert to 60 FPS ticker speed
  player.loop = newAnimation.loop;
  player.gotoAndPlay(startFrame);

  // Replace old player
  if (unit.animationPlayer) {
    unit.sprite.removeChild(unit.animationPlayer);
    unit.animationPlayer.destroy();
  }

  unit.sprite.addChild(player);
  unit.animationPlayer = player;
  unit.currentAnimation = newAnimation;

  console.log(`[Animation] ${unit.name}: ${oldAnimation?.name} → ${newAnimationName}`);
}
```

**Algorithm 2: Animation Update Loop**
```typescript
class AnimationController {
  private units: ClientUnit[] = [];
  private frameEventManager: FrameEventManager;

  update(deltaTime: number): void {
    for (const unit of this.units) {
      // Skip dead/ghost units
      if (unit.isGhost) continue;

      // Update animation player
      if (unit.animationPlayer) {
        unit.animationPlayer.update(deltaTime);

        // Check for frame events
        this.frameEventManager.checkFrameEvents(unit, deltaTime);

        // Handle animation completion
        if (unit.animationPlayer.currentFrame >= unit.currentAnimation.frameCount - 1) {
          this.handleAnimationComplete(unit);
        }
      }

      // Update directional sprite if moving
      if (this.isMoving(unit)) {
        const movementVector = this.calculateMovementVector(unit);
        const newDirection = this.directionManager.selectDirection(movementVector);

        if (newDirection !== unit.currentDirection) {
          this.directionManager.transitionDirection(unit, newDirection);
        }
      }

      // Update library effect overlays
      for (const effect of unit.activeEffects) {
        effect.position.set(unit.sprite.x, unit.sprite.y); // Follow creature
        effect.update(deltaTime);
      }
    }
  }

  private handleAnimationComplete(unit: ClientUnit): void {
    const anim = unit.currentAnimation;

    // One-shot animations return to idle or walk
    if (!anim.loop) {
      if (this.isMoving(unit)) {
        this.transitionAnimation(unit, 'walk');
      } else {
        this.transitionAnimation(unit, 'idle');
      }
    }
  }

  private isMoving(unit: ClientUnit): boolean {
    const serverPos = unit.serverPosition;
    const renderPos = this.hexToPixel(serverPos);
    const distance = Math.hypot(renderPos.x - unit.sprite.x, renderPos.y - unit.sprite.y);
    return distance > 5; // Moving if more than 5 pixels away from target
  }
}
```

---

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ 1. SERVER STATE UPDATE (60/sec)                             │
│    - Position changes, attack events, death flags           │
│    - Animation change events with server timestamps         │
│    - WebSocket broadcast to all clients                     │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. STATE UPDATE PROCESSOR                                   │
│    - Buffer updates (100ms delay for smoothness)            │
│    - Apply state deltas to local game state                 │
│    - Extract animation change events                        │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. ANIMATION SYNCHRONIZER                                   │
│    - Receive animation change event with server timestamp   │
│    - Calculate elapsed time since server start              │
│    - Resume animation at correct frame (±100ms tolerance)   │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. ANIMATION CONTROLLER                                     │
│    - Update animation state machine per unit                │
│    - Transition animations based on state                   │
│    - Check for frame events (projectile spawn at frame 8)   │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. FRAME EVENT MANAGER                                      │
│    - Trigger projectile spawns at frame 8                   │
│    - Trigger impact effects at frame 6                      │
│    - Trigger sound effects at frame 4                       │
│    - Trigger screen shake on AOE abilities                  │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. EFFECT COMPOSITOR (for ability animations)              │
│    - Load library animation frames                          │
│    - Composite onto creature sprite with blend mode         │
│    - Scale based on creature size (0.7x / 1.0x / 1.3x)      │
│    - Play one-shot animation, remove on completion          │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. DIRECTION MANAGER (for movement)                        │
│    - Calculate movement vector from position delta          │
│    - Select nearest direction (E/NE/SE/W/NW/SW)             │
│    - Crossfade transition if direction changed (150ms)      │
│    - Apply horizontal flip for mirrored directions          │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. DEATH ANIMATION HANDLER (on death event)                │
│    - Enter ghost mode (non-interactive)                     │
│    - Play death animation (0.6s one-shot)                   │
│    - Fade out alpha 1.0 → 0.0 during animation              │
│    - Despawn sprite when animation completes                │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 9. PIXI.JS RENDERER                                         │
│    - Render all animated sprites at 60 FPS                  │
│    - Apply blend modes for library effects                  │
│    - Display smooth, synchronized combat animations         │
└─────────────────────────────────────────────────────────────┘
```

---

## Dependencies

### Depends On

- **AI-Driven Creature Stats** (L3 - this epic): Provides ability definitions for ability animations
- **Authoritative Server Simulation** (L2): Broadcasts animation change events with timestamps
- **WebSocket Infrastructure** (L1): Transmits 60 state updates/sec to clients
- **Animation Library** (L3 - AI Generation Pipeline): Provides 55 library animation effects
- **Multi-Directional Sprite Generation** (L3 - AI Generation Pipeline): Provides 6-directional sprites

### Depended On By

- **Projectile Effect System** (L3 - this epic): Receives projectile spawn triggers from frame events
- **Combat UI Overlays** (L3 - this epic): Displays unit state during animations (health bars, cooldowns)
- **Combat Replay System** (Post-MVP): Uses same animation controller for replay playback

---

## Success Criteria

### MVP Definition of Done

**Functional**:
- [ ] Animation state machine correctly transitions idle → walk → attack → idle
- [ ] Timestamp-based sync maintains ±100ms tolerance across all animations
- [ ] Frame events trigger at correct frames (projectile spawn at frame 8 of attack)
- [ ] Multi-directional sprites automatically select based on movement vector (6 directions)
- [ ] Crossfade transitions between directions are smooth (100-200ms, no jarring pops)
- [ ] Library animations composite correctly with blend modes (fire uses SCREEN, dark uses MULTIPLY)
- [ ] Death animations play fully before despawn with fade-out (ghost mode)
- [ ] One-shot animations (attack, ability) cannot be interrupted except by death
- [ ] Looping animations (idle, walk) play continuously until state change
- [ ] Animation controller handles 16 units simultaneously without lag

**Non-Functional**:
- [ ] Animation transitions complete in <50ms (imperceptible to player)
- [ ] Frame event detection has <16ms latency (one frame at 60 FPS)
- [ ] Library animation compositing adds <5ms per effect to render time
- [ ] Direction transitions are smooth at 30+ FPS
- [ ] Memory usage stays constant (no animation memory leaks)

**Testing**:
- [ ] Unit test: Animation state machine transitions (10 test cases for all transition paths)
- [ ] Unit test: Timestamp sync algorithm (edge cases: early, late, perfect timing)
- [ ] Unit test: Frame event triggering (verify frame 8 triggers projectile)
- [ ] Unit test: Direction selection (verify all 6 directions chosen correctly)
- [ ] Integration test: Full animation lifecycle (idle → walk → attack → death)
- [ ] Integration test: Library animation compositing (verify blend modes work)
- [ ] E2E test: 16 units animating simultaneously maintains 30+ FPS

---

## L4 Task Candidates

### Core Animation Controller (5 tasks)

1. **TASK-1.1**: Create `AnimationController` class with state machine
   - Implement state enum and transition map
   - Export `AnimationController` with `update(deltaTime)` method

2. **TASK-1.2**: Implement animation transition logic
   - `transitionAnimation(unit, newAnim, startFrame)`
   - Handle PIXI.AnimatedSprite creation and replacement

3. **TASK-1.3**: Implement looping vs one-shot animation handling
   - Auto-return to idle/walk when one-shot completes
   - Ensure looping animations continue until interrupted

4. **TASK-1.4**: Implement movement detection for idle/walk transitions
   - Check if unit is moving toward serverPosition
   - Trigger walk → idle when unit reaches destination

5. **TASK-1.5**: Create animation definition metadata system
   - Define `AnimationDefinition` with frameCount, fps, loop, events
   - Load definitions from JSON config file

### Timestamp Synchronization (3 tasks)

6. **TASK-2.1**: Create `AnimationSynchronizer` service
   - Implement timestamp-based sync algorithm
   - Export `syncAnimation(unit, event, clientTime)`

7. **TASK-2.2**: Implement ±100ms tolerance check
   - Calculate elapsed frames from server timestamp
   - Hard reset if desync > 100ms

8. **TASK-2.3**: Add animation sync logging and debugging
   - Log sync events with timestamps
   - Track desync occurrences for monitoring

### Frame Event System (4 tasks)

9. **TASK-3.1**: Create `FrameEventManager` class
   - Track triggered events to prevent duplicates
   - Export `checkFrameEvents(unit, deltaTime)`

10. **TASK-3.2**: Implement frame event detection algorithm
    - Compare currentFrame vs previousFrame
    - Trigger events in frame range

11. **TASK-3.3**: Integrate frame events with projectile system
    - Trigger projectile spawn at frame 8
    - Pass unit position and projectile type

12. **TASK-3.4**: Integrate frame events with effect system and audio
    - Trigger impact effects at specified frames
    - Play sounds at animation keyframes

### Multi-Directional Sprites (4 tasks)

13. **TASK-4.1**: Create `DirectionManager` service
    - Implement direction selection from movement vector
    - Export `selectDirection(movementVector) → HexDirection`

14. **TASK-4.2**: Implement crossfade transition between directions
    - Alpha blend old and new sprites over 150ms
    - Remove old sprite when transition completes

15. **TASK-4.3**: Implement sprite mirroring for W/NW/SW directions
    - Horizontal flip for mirrored directions
    - Load generated E/NE/SE sprites only

16. **TASK-4.4**: Add direction caching to prevent redundant transitions
    - Track current direction per unit
    - Skip transition if direction unchanged

### Library Animation Integration (3 tasks)

17. **TASK-5.1**: Create `EffectCompositor` service
    - Load library animation frames from assets
    - Export `overlayLibraryAnimation(unit, animId, blendMode)`

18. **TASK-5.2**: Implement blend mode application
    - Map ability types to blend modes (fire → SCREEN, dark → MULTIPLY)
    - Apply blend mode to PIXI.AnimatedSprite

19. **TASK-5.3**: Implement size-based effect scaling
    - Scale library effects 0.7x (small), 1.0x (medium), 1.3x (large)
    - Center effects on creature sprite

### Death Animation (2 tasks)

20. **TASK-6.1**: Create `DeathAnimationHandler` class
    - Implement ghost mode (non-interactive but visible)
    - Export `handleDeath(unitId)`

21. **TASK-6.2**: Implement fade-out and despawn
    - Alpha fade 1.0 → 0.0 during death animation (0.6s)
    - Despawn sprite when animation completes

### Testing (3 tasks)

22. **TASK-7.1**: Write unit tests for `AnimationController`
    - Test state transitions (idle → walk → attack → death)
    - Test looping vs one-shot behavior

23. **TASK-7.2**: Write unit tests for timestamp sync and frame events
    - Test sync algorithm with various latencies
    - Test frame event triggering accuracy

24. **TASK-7.3**: Write integration test for full animation lifecycle
    - Mock server state updates
    - Verify complete animation cycle with frame events

---

## Metadata

- **Estimated Effort**: 3-4 weeks
- **Team Size**: 1-2 frontend developers
- **Priority**: CRITICAL (player-facing visual experience)
- **Risks**: MEDIUM (animation sync complexity, performance with 16 units)
- **Blockers**: Requires Authoritative Server Simulation for animation events, Animation Library for effects

---

*This document defines the combat animation controller system. Ready for L4 task implementation.*
