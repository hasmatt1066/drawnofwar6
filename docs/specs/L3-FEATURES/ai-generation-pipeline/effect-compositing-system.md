# Effect Compositing System

## Status: IN PROGRESS (Proof-of-Concept Complete, Full Implementation Planned)

## Overview

The Effect Compositing System provides the rendering pipeline to overlay pre-generated library animation effects onto player-created creature sprites during gameplay. This system enables rich visual combat and movement animations without requiring per-creature effect generation, achieving maximum visual impact while maintaining performance targets (30+ FPS with 20 units on screen).

### Purpose

Transform static creature sprites into dynamic, animated game characters by:
1. **Real-Time Overlay**: Composite 64x64px library effects onto creature sprites during gameplay
2. **Visual Enrichment**: Add sword slashes, fire breath, shield impacts, and 52+ other effects
3. **Universal Application**: Single effect works on any creature regardless of size, shape, or art style
4. **Performance**: Maintain 30+ FPS with 20 creatures simultaneously displaying effects

### Benefits

- **Cost Efficiency**: $0.00 per creature (vs $0.80 for per-creature animation generation)
- **Visual Consistency**: Professional effects enhance all creatures equally
- **Flexibility**: Mix and match any effect with any creature
- **Performance**: Pre-rendered PNGs composited via PixiJS blend modes (GPU-accelerated)
- **Scalability**: Add new effects to library without regenerating creatures

### Scope

**✅ Proof-of-Concept Complete (SpellCastDemo)**:
- Single effect overlay per creature at a time ✅
- Fixed positioning (center-aligned on creature) ✅
- CSS blend mode (Screen) for magical glow effects ✅
- 4-frame animation at 10 FPS ✅
- Projectile spawn and travel mechanics ✅
- Hit detection and cleanup ✅
- Debug panel for state visualization ✅

**MVP (Full Implementation):**
- Single effect overlay per creature at a time
- Fixed positioning (center-aligned on creature)
- 5 core blend modes (Normal, Add, Multiply, Screen, Overlay)
- Frame synchronization between creature walk animation and effect animation
- AnimationDebugger integration for testing

**Post-MVP Enhancements:**
- Multi-effect stacking (buff + attack effect simultaneously)
- Dynamic anchor points (attach effects to weapon hand, overhead, ground)
- Effect scaling based on creature size
- Particle system integration
- Effect color tinting to match creature palette
- Advanced blend modes (Soft Light, Hard Light, Difference)

**Explicitly Excluded from MVP:**
- Physics-based particle effects (sparks bouncing realistically)
- Dynamic effect generation based on creature stats
- Per-pixel collision detection between effects and creatures
- 3D perspective transformations
- Effect audio synchronization (handled by separate audio system)

---

## Proof-of-Concept Implementation: SpellCastDemo

### Overview
**Component**: `/frontend/src/components/SpellCastDemo/SpellCastDemo.tsx`
**Status**: COMPLETE (2025-10-02)
**Purpose**: Validates the core concept of effect compositing - overlaying library animations onto creature sprites

### What Was Validated

#### 1. Library Animation Loading
- Loads `cast_spell_default` animation from library via API (`/api/library-animations/:animationId`)
- API returns base64-encoded animation frames
- Frames loaded and cached in component state

#### 2. Visual Compositing Strategy
- **Blend Mode**: CSS `mix-blend-mode: screen` for magical glow effect
- **Layering**: Effect overlay positioned on top of creature sprite
- **Result**: Magical glow effect successfully overlays on wizard sprite, achieving desired visual impact

#### 3. Animation Playback System
- **Casting Animation**: 4 frames cycle at 10 FPS (100ms per frame)
- **Frame Cycling**: Uses `setInterval` to advance through frames
- **Synchronization**: Effect animation plays smoothly over creature sprite

#### 4. Projectile Spawn System
- **Trigger**: Projectile spawns when casting animation completes (400ms)
- **Initial Position**: Spawns at caster position
- **Animation**: Cycles through all 4 effect frames during flight

#### 5. Projectile Travel Mechanics
- **Movement**: Travels toward target at 5px/frame (20 FPS = 50ms interval)
- **Frame Cycling**: Animates through effect frames during travel
- **Hit Detection**: Disappears when reaching target position

#### 6. Debug Visualization
- **Real-time State**: Shows casting state, current frame, projectiles in flight
- **Transparency**: Debug panel helps understand effect compositing mechanics
- **Testing Aid**: Enables rapid iteration on animation timing and positioning

### Technical Implementation

```tsx
// Effect overlay with CSS blend mode
<img
  src={`data:image/png;base64,${frames[currentFrame]}`}
  alt="Spell Effect"
  style={{
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    mixBlendMode: 'screen',  // ✅ Validates blend mode strategy
    pointerEvents: 'none',
    imageRendering: 'pixelated'
  }}
/>

// Projectile with frame animation
<img
  src={`data:image/png;base64,${frames[projectile.currentFrame]}`}
  style={{
    position: 'absolute',
    left: `${projectile.x}px`,
    top: `${projectile.y}px`,
    width: '64px',
    height: '64px',
    mixBlendMode: 'screen',
    pointerEvents: 'none',
    imageRendering: 'pixelated'
  }}
/>
```

### Key Insights from Proof-of-Concept

1. **Blend Mode Effectiveness**: `mix-blend-mode: screen` successfully creates magical glow effect on wizard sprite, validating the compositing strategy for magical effects.

2. **Animation Timing**: 10 FPS (100ms per frame) feels appropriate for casting animations. Projectile travel at 20 FPS (50ms) provides smooth motion.

3. **Frame Cycling**: Cycling through 4 frames during projectile flight adds visual interest and reinforces that the projectile is an active magical effect.

4. **Simplicity**: CSS-based compositing is performant and easy to implement compared to canvas-based approaches.

5. **Scalability**: Approach works for any creature sprite + any library effect, confirming universal application concept.

### What Remains for Full Implementation

1. **PixiJS Integration**: Move from CSS/React to PixiJS for game engine compatibility
2. **Multiple Blend Modes**: Implement ADD, MULTIPLY, OVERLAY in addition to SCREEN
3. **Dynamic Anchor Points**: Support OVERHEAD, GROUND, FRONT, WEAPON_HAND positions
4. **Effect Scaling**: Scale effects based on creature size
5. **Multi-Effect Stacking**: Support multiple simultaneous effects (buff + attack)
6. **Performance Optimization**: Sprite pooling, texture caching, batch rendering
7. **Comprehensive Testing**: All 55 library animations on diverse creature sprites

### Integration Status
- ✅ Added to GenerationProgress component
- ✅ Shows for creatures with animations (`result.spriteImageBase64 && result.animations?.totalAnimations`)
- ✅ Successfully tested with wizard creature (35.8s generation, 20 animations assigned)
- ✅ Proves concept: isolated library animations work with any creature sprite

---

## Technical Architecture

### Compositing Pipeline

```typescript
// High-level flow: Effect Selection → Loading → Rendering → Cleanup

1. Game Event Triggers Effect
   └─> AnimationController.playAnimation('attack_melee_sword')

2. Effect Loading (if not cached)
   └─> EffectLoader.loadLibraryAnimation('attack_melee_sword')
   └─> Returns: { baseSprite, frames[], metadata }

3. Effect Compositing Setup
   └─> CreatureRenderer.attachEffect(creatureId, effectData, config)
   └─> Config: { blendMode, anchor, scale, offset, zIndex }

4. Real-Time Rendering Loop (60 FPS)
   └─> Render creature base sprite
   └─> Render current effect frame (synced to creature animation frame)
   └─> Apply blend mode and positioning

5. Cleanup on Animation End
   └─> EffectManager.removeCompletedEffects()
   └─> Free memory, return to sprite pool
```

### Layer System (Z-Index Ordering)

```typescript
// Rendering order from back to front:

Layer 0: Background Terrain (flat battlefield)
Layer 1: Ground Effects (dust clouds, shadows, magic circles)
Layer 2: Creature Base Sprites (player-generated creatures)
Layer 3: Mid-Layer Effects (auras, shields, motion trails)
Layer 4: Top-Layer Effects (sword slashes, projectiles, impacts)
Layer 5: Above-Creature Effects (overhead buffs, stun stars, healing)
Layer 6: UI Elements (health bars, cooldowns, names)

// Implementation in PixiJS:
const layerConfig = {
  groundEffects: { zIndex: 1 },
  creatureSprites: { zIndex: 2 },
  midEffects: { zIndex: 3 },
  topEffects: { zIndex: 4 },
  overheadEffects: { zIndex: 5 },
  ui: { zIndex: 6 }
};
```

### Coordinate System & Positioning

```typescript
// Anchor Points (relative to creature sprite center)

enum EffectAnchor {
  CENTER = 'center',           // (0, 0) - Most common for auras, buffs
  OVERHEAD = 'overhead',       // (0, -40) - Floating above creature
  GROUND = 'ground',           // (0, +32) - At creature's feet
  FRONT = 'front',             // (+24, 0) - In front of creature (attacks)
  BACK = 'back',               // (-24, 0) - Behind creature (trails)
  WEAPON_HAND = 'weaponHand'   // (+16, -8) - Right hand position (MVP: fixed offset)
}

// Offset Calculations (pixels)
function getAnchorOffset(anchor: EffectAnchor, creatureSize: number): { x: number, y: number } {
  const scale = creatureSize / 64; // 64px = standard creature size

  switch (anchor) {
    case EffectAnchor.CENTER:
      return { x: 0, y: 0 };
    case EffectAnchor.OVERHEAD:
      return { x: 0, y: -40 * scale };
    case EffectAnchor.GROUND:
      return { x: 0, y: 32 * scale };
    case EffectAnchor.FRONT:
      return { x: 24 * scale, y: 0 };
    case EffectAnchor.BACK:
      return { x: -24 * scale, y: 0 };
    case EffectAnchor.WEAPON_HAND:
      return { x: 16 * scale, y: -8 * scale };
  }
}

// Scaling Rules
interface EffectScaling {
  scaleWithCreature: boolean;    // Should effect resize based on creature?
  minScale: number;              // Minimum scale (0.5 = 50%)
  maxScale: number;              // Maximum scale (2.0 = 200%)
  baseScale: number;             // Default scale for 64px creature
}

// Example: Sword slash should scale with creature size
const swordSlashScaling: EffectScaling = {
  scaleWithCreature: true,
  minScale: 0.75,
  maxScale: 1.5,
  baseScale: 1.0
};

// Example: Stun stars should stay consistent size
const stunStarsScaling: EffectScaling = {
  scaleWithCreature: false,
  minScale: 1.0,
  maxScale: 1.0,
  baseScale: 1.0
};
```

---

## Blend Mode Strategy

### Understanding Blend Modes

Blend modes determine how effect pixels combine with creature sprite pixels. PixiJS supports all standard blend modes via WebGL.

**Key Concepts:**
- **Source**: Effect layer (foreground)
- **Destination**: Creature sprite (background)
- **Alpha**: Transparency value (0.0 - 1.0)

### Blend Mode Reference

| Blend Mode | Formula | Visual Result | Best For |
|------------|---------|---------------|----------|
| **NORMAL** | Source over destination | Effect fully opaque, covers creature | Solid overlays (shields) |
| **ADD** | Source + Destination | Brightens combined colors | Bright flashes, fire, lightning |
| **MULTIPLY** | Source × Destination | Darkens combined colors | Shadows, smoke, darken effects |
| **SCREEN** | Inverse multiply (brightens) | Softly brightens without washing out | Glows, auras, magical energy |
| **OVERLAY** | Multiply + Screen hybrid | Enhances contrast | Status indicators, highlights |

### Category-Specific Recommendations

#### 1. Idle Effects (5 animations)

**Animations**: `idle_default`, `idle_breathing`, `idle_alert`, `idle_tired`, `idle_flying`

**Compositing Strategy:**
```typescript
const idleEffects = {
  idle_default: {
    blendMode: 'NORMAL',
    anchor: 'CENTER',
    scale: 1.0,
    alpha: 0.0,  // No visible effect for default idle
    zIndex: 3,
    looping: true,
    triggerTiming: 'immediate'
  },
  idle_breathing: {
    blendMode: 'SCREEN',
    anchor: 'CENTER',
    scale: 1.1,
    alpha: 0.3,  // Subtle breathing aura
    zIndex: 3,
    looping: true,
    triggerTiming: 'immediate'
  },
  idle_alert: {
    blendMode: 'ADD',
    anchor: 'OVERHEAD',
    scale: 0.8,
    alpha: 0.6,  // Alert indicator (exclamation mark)
    zIndex: 5,
    looping: true,
    triggerTiming: 'immediate'
  },
  idle_tired: {
    blendMode: 'MULTIPLY',
    anchor: 'OVERHEAD',
    scale: 0.7,
    alpha: 0.5,  // Tired icon (sweat drops)
    zIndex: 5,
    looping: true,
    triggerTiming: 'immediate'
  },
  idle_flying: {
    blendMode: 'SCREEN',
    anchor: 'GROUND',
    scale: 0.9,
    alpha: 0.4,  // Wing flutter or levitation glow
    zIndex: 1,
    looping: true,
    triggerTiming: 'immediate'
  }
};
```

**Rationale:**
- Most idle effects are subtle atmospheric enhancements
- Screen blend for soft glows (breathing, flying)
- Add blend for alert states (needs to stand out)
- Multiply for status indicators (tired = darker overlay)

---

#### 2. Locomotion Effects (12 animations)

**Animations**: `walk_default`, `run_default`, `fly_default`, `glide_default`, `swim_default`, `jump_default`, `land_default`, `dash_default`, `crawl_default`, `turn_left`, `turn_right`, `teleport`

**Compositing Strategy:**
```typescript
const locomotionEffects = {
  walk_default: {
    blendMode: 'NORMAL',
    anchor: 'GROUND',
    scale: 0.8,
    alpha: 0.6,  // Dust cloud at feet
    zIndex: 1,
    looping: true,
    triggerTiming: 'continuous',
    scaleWithCreature: true
  },
  run_default: {
    blendMode: 'ADD',
    anchor: 'BACK',
    scale: 1.2,
    alpha: 0.5,  // Speed lines trailing behind
    zIndex: 3,
    looping: true,
    triggerTiming: 'continuous',
    scaleWithCreature: true
  },
  fly_default: {
    blendMode: 'SCREEN',
    anchor: 'BACK',
    scale: 1.0,
    alpha: 0.4,  // Wing trail effect
    zIndex: 3,
    looping: true,
    triggerTiming: 'continuous',
    scaleWithCreature: true
  },
  glide_default: {
    blendMode: 'SCREEN',
    anchor: 'CENTER',
    scale: 1.3,
    alpha: 0.3,  // Smooth air current glow
    zIndex: 3,
    looping: true,
    triggerTiming: 'continuous',
    scaleWithCreature: false
  },
  swim_default: {
    blendMode: 'SCREEN',
    anchor: 'BACK',
    scale: 1.0,
    alpha: 0.5,  // Water splash/ripple
    zIndex: 3,
    looping: true,
    triggerTiming: 'continuous',
    scaleWithCreature: true
  },
  jump_default: {
    blendMode: 'ADD',
    anchor: 'GROUND',
    scale: 0.9,
    alpha: 0.7,  // Takeoff burst
    zIndex: 1,
    looping: false,
    triggerTiming: 'onAnimationStart',
    scaleWithCreature: true
  },
  land_default: {
    blendMode: 'ADD',
    anchor: 'GROUND',
    scale: 1.1,
    alpha: 0.8,  // Impact dust/shockwave
    zIndex: 1,
    looping: false,
    triggerTiming: 'onAnimationStart',
    scaleWithCreature: true
  },
  dash_default: {
    blendMode: 'ADD',
    anchor: 'CENTER',
    scale: 1.5,
    alpha: 0.6,  // Intense speed burst
    zIndex: 4,
    looping: false,
    triggerTiming: 'onAnimationStart',
    scaleWithCreature: true
  },
  crawl_default: {
    blendMode: 'MULTIPLY',
    anchor: 'GROUND',
    scale: 0.7,
    alpha: 0.4,  // Subtle dirt scrape
    zIndex: 1,
    looping: true,
    triggerTiming: 'continuous',
    scaleWithCreature: true
  },
  turn_left: {
    blendMode: 'NORMAL',
    anchor: 'GROUND',
    scale: 0.8,
    alpha: 0.5,  // Pivot dust
    zIndex: 1,
    looping: false,
    triggerTiming: 'onAnimationStart',
    scaleWithCreature: true
  },
  turn_right: {
    blendMode: 'NORMAL',
    anchor: 'GROUND',
    scale: 0.8,
    alpha: 0.5,  // Pivot dust
    zIndex: 1,
    looping: false,
    triggerTiming: 'onAnimationStart',
    scaleWithCreature: true
  },
  teleport: {
    blendMode: 'ADD',
    anchor: 'CENTER',
    scale: 1.5,
    alpha: 0.9,  // Magical teleportation flash
    zIndex: 4,
    looping: false,
    triggerTiming: 'onAnimationStart',
    scaleWithCreature: false
  }
};
```

**Rationale:**
- **Ground effects (walk, run, land)**: NORMAL/ADD blend, anchored at feet, creates grounded feel
- **Speed effects (run, dash)**: ADD blend for brightness, trails behind creature
- **Magical movement (teleport)**: ADD blend for intense flash, center-aligned, non-looping
- **Continuous loops**: Walk/run/fly play continuously during movement
- **One-shot effects**: Jump/land/dash trigger once per action

---

#### 3. Combat Effects (15 animations)

**Animations**: `attack_melee_default`, `attack_melee_sword`, `attack_melee_punch`, `attack_melee_claw`, `attack_melee_bite`, `attack_ranged_default`, `attack_ranged_bow`, `attack_ranged_throw`, `defend_default`, `defend_shield`, `dodge_default`, `roll_default`, `parry_default`, `counter_attack`, `charge_attack`

**Compositing Strategy:**
```typescript
const combatEffects = {
  attack_melee_sword: {
    blendMode: 'ADD',
    anchor: 'FRONT',
    scale: 1.2,
    alpha: 0.85,  // Bright sword slash arc
    zIndex: 4,
    looping: false,
    triggerTiming: 'onAttackFrame',  // Frame 2 of creature attack animation
    duration: 400,  // 4 frames at 10fps = 400ms
    scaleWithCreature: true,
    rotation: 0  // Can be adjusted based on attack direction
  },
  attack_melee_punch: {
    blendMode: 'ADD',
    anchor: 'WEAPON_HAND',
    scale: 0.9,
    alpha: 0.8,  // Impact stars on contact
    zIndex: 4,
    looping: false,
    triggerTiming: 'onHitDetection',  // When punch connects
    duration: 200,
    scaleWithCreature: false
  },
  attack_melee_claw: {
    blendMode: 'ADD',
    anchor: 'FRONT',
    scale: 1.0,
    alpha: 0.85,  // Claw swipe trail
    zIndex: 4,
    looping: false,
    triggerTiming: 'onAttackFrame',
    duration: 300,
    scaleWithCreature: true
  },
  attack_melee_bite: {
    blendMode: 'ADD',
    anchor: 'FRONT',
    scale: 0.8,
    alpha: 0.75,  // Bite chomp effect
    zIndex: 4,
    looping: false,
    triggerTiming: 'onHitDetection',
    duration: 200,
    scaleWithCreature: true
  },
  attack_ranged_bow: {
    blendMode: 'SCREEN',
    anchor: 'WEAPON_HAND',
    scale: 0.7,
    alpha: 0.6,  // Arrow release flash
    zIndex: 4,
    looping: false,
    triggerTiming: 'onAttackFrame',
    duration: 150,
    scaleWithCreature: false
  },
  defend_shield: {
    blendMode: 'SCREEN',
    anchor: 'FRONT',
    scale: 1.3,
    alpha: 0.7,  // Shield glow barrier
    zIndex: 3,
    looping: true,  // Active while defending
    triggerTiming: 'immediate',
    scaleWithCreature: true
  },
  dodge_default: {
    blendMode: 'ADD',
    anchor: 'CENTER',
    scale: 1.1,
    alpha: 0.5,  // Dodge blur/afterimage
    zIndex: 3,
    looping: false,
    triggerTiming: 'onAnimationStart',
    duration: 300,
    scaleWithCreature: true
  },
  roll_default: {
    blendMode: 'NORMAL',
    anchor: 'GROUND',
    scale: 1.0,
    alpha: 0.6,  // Rolling dust cloud
    zIndex: 1,
    looping: false,
    triggerTiming: 'continuous',
    duration: 600,
    scaleWithCreature: true
  },
  parry_default: {
    blendMode: 'ADD',
    anchor: 'FRONT',
    scale: 1.0,
    alpha: 0.9,  // Parry spark/clash
    zIndex: 4,
    looping: false,
    triggerTiming: 'onHitDetection',
    duration: 200,
    scaleWithCreature: false
  },
  counter_attack: {
    blendMode: 'ADD',
    anchor: 'FRONT',
    scale: 1.3,
    alpha: 0.9,  // Powerful counter flash
    zIndex: 4,
    looping: false,
    triggerTiming: 'onAttackFrame',
    duration: 400,
    scaleWithCreature: true
  },
  charge_attack: {
    blendMode: 'ADD',
    anchor: 'BACK',
    scale: 1.5,
    alpha: 0.7,  // Charge trail
    zIndex: 3,
    looping: true,  // Active during charge
    triggerTiming: 'immediate',
    scaleWithCreature: true
  }
};
```

**Rationale:**
- **ADD blend dominates combat**: Bright flashes make impacts satisfying and visible
- **Weapon effects (sword, claw)**: Anchored to FRONT, scale with creature for consistency
- **Impact effects (punch, parry)**: Non-scaling, triggered on hit detection (server event)
- **Defensive effects (shield)**: SCREEN blend for protective glow, looping while active
- **Trigger timing critical**: Effects must sync with attack animation frames for believability

**WHY ADD Blend for Combat:**
- Creates bright, attention-grabbing flashes that signal "hit happened"
- Works well on any creature background (light or dark sprites)
- GPU-accelerated, performant even with 20 simultaneous effects
- Matches player expectations from other action games

---

#### 4. Abilities Effects (15 animations)

**Animations**: `cast_spell_default`, `cast_fire_spell`, `cast_ice_spell`, `cast_lightning_spell`, `heal_spell`, `buff_spell`, `breathe_fire`, `roar`, `tail_whip`, `wing_attack`, `stomp`, `summon`, `special_move_1`, `special_move_2`, `stealth`

**Compositing Strategy:**
```typescript
const abilitiesEffects = {
  cast_spell_default: {
    blendMode: 'SCREEN',
    anchor: 'CENTER',
    scale: 1.2,
    alpha: 0.7,  // Generic magic aura
    zIndex: 3,
    looping: true,  // While casting
    triggerTiming: 'onAbilityStart',
    scaleWithCreature: true
  },
  cast_fire_spell: {
    blendMode: 'ADD',
    anchor: 'WEAPON_HAND',
    scale: 1.0,
    alpha: 0.85,  // Fire flames and embers
    zIndex: 4,
    looping: true,
    triggerTiming: 'onAbilityStart',
    duration: 1000,  // 1 second cast time
    scaleWithCreature: false
  },
  cast_ice_spell: {
    blendMode: 'SCREEN',
    anchor: 'WEAPON_HAND',
    scale: 1.0,
    alpha: 0.75,  // Ice crystals forming
    zIndex: 4,
    looping: true,
    triggerTiming: 'onAbilityStart',
    duration: 1000,
    scaleWithCreature: false
  },
  cast_lightning_spell: {
    blendMode: 'ADD',
    anchor: 'OVERHEAD',
    scale: 1.5,
    alpha: 0.9,  // Lightning bolts crackling
    zIndex: 5,
    looping: true,
    triggerTiming: 'onAbilityStart',
    duration: 800,
    scaleWithCreature: false
  },
  heal_spell: {
    blendMode: 'SCREEN',
    anchor: 'CENTER',
    scale: 1.4,
    alpha: 0.6,  // Healing glow (green/golden)
    zIndex: 3,
    looping: false,
    triggerTiming: 'onAbilityComplete',
    duration: 600,
    scaleWithCreature: true
  },
  buff_spell: {
    blendMode: 'SCREEN',
    anchor: 'CENTER',
    scale: 1.3,
    alpha: 0.5,  // Buff aura (persistent)
    zIndex: 3,
    looping: true,  // Persists while buff active
    triggerTiming: 'onAbilityComplete',
    scaleWithCreature: true
  },
  breathe_fire: {
    blendMode: 'ADD',
    anchor: 'FRONT',
    scale: 1.6,
    alpha: 0.9,  // Fire breath stream
    zIndex: 4,
    looping: false,
    triggerTiming: 'onAttackFrame',
    duration: 800,
    scaleWithCreature: true
  },
  roar: {
    blendMode: 'ADD',
    anchor: 'FRONT',
    scale: 1.5,
    alpha: 0.6,  // Soundwave/shockwave visual
    zIndex: 4,
    looping: false,
    triggerTiming: 'onAnimationStart',
    duration: 600,
    scaleWithCreature: true
  },
  tail_whip: {
    blendMode: 'ADD',
    anchor: 'BACK',
    scale: 1.2,
    alpha: 0.8,  // Tail swing motion blur
    zIndex: 3,
    looping: false,
    triggerTiming: 'onAttackFrame',
    duration: 400,
    scaleWithCreature: true
  },
  wing_attack: {
    blendMode: 'SCREEN',
    anchor: 'CENTER',
    scale: 1.8,
    alpha: 0.5,  // Wing gust/wind effect
    zIndex: 4,
    looping: false,
    triggerTiming: 'onAttackFrame',
    duration: 500,
    scaleWithCreature: true
  },
  stomp: {
    blendMode: 'ADD',
    anchor: 'GROUND',
    scale: 1.5,
    alpha: 0.85,  // Ground shockwave
    zIndex: 1,
    looping: false,
    triggerTiming: 'onHitDetection',
    duration: 500,
    scaleWithCreature: true
  },
  summon: {
    blendMode: 'ADD',
    anchor: 'GROUND',
    scale: 1.7,
    alpha: 0.8,  // Magic circle summoning
    zIndex: 1,
    looping: false,
    triggerTiming: 'onAbilityStart',
    duration: 1200,
    scaleWithCreature: false
  },
  special_move_1: {
    blendMode: 'ADD',
    anchor: 'CENTER',
    scale: 2.0,
    alpha: 0.9,  // Ultimate ability explosion
    zIndex: 4,
    looping: false,
    triggerTiming: 'onAbilityStart',
    duration: 1000,
    scaleWithCreature: true
  },
  stealth: {
    blendMode: 'MULTIPLY',
    anchor: 'CENTER',
    scale: 1.2,
    alpha: 0.7,  // Vanishing smoke/fade
    zIndex: 3,
    looping: false,
    triggerTiming: 'onAbilityStart',
    duration: 800,
    scaleWithCreature: true
  }
};
```

**Rationale:**
- **Elemental spells**: ADD for fire/lightning (bright), SCREEN for ice/heal (soft glow)
- **Buff/Heal effects**: SCREEN blend, looping or persistent, center-aligned auras
- **Offensive abilities**: ADD blend, larger scale for dramatic impact
- **Ground effects (stomp, summon)**: Anchored at GROUND, zIndex 1 (below creature)
- **Stealth**: MULTIPLY blend darkens creature, creates fade-out effect

**WHY SCREEN for Healing/Buffs:**
- SCREEN brightens without washing out creature details
- Creates soft, magical glow that feels protective/restorative
- Contrast with ADD's harsh brightness (healing should feel gentle)

---

#### 5. Reactions Effects (8 animations)

**Animations**: `hit_default`, `death_default`, `celebrate`, `taunt`, `scared`, `stun`, `knockback`, `revive`

**Compositing Strategy:**
```typescript
const reactionsEffects = {
  hit_default: {
    blendMode: 'ADD',
    anchor: 'CENTER',
    scale: 1.0,
    alpha: 0.8,  // Impact flash/stars
    zIndex: 4,
    looping: false,
    triggerTiming: 'onDamageTaken',  // Server event
    duration: 200,
    scaleWithCreature: false
  },
  death_default: {
    blendMode: 'MULTIPLY',
    anchor: 'CENTER',
    scale: 1.5,
    alpha: 0.7,  // Death fade/dissipate
    zIndex: 3,
    looping: false,
    triggerTiming: 'onHealthZero',
    duration: 1000,
    scaleWithCreature: true
  },
  celebrate: {
    blendMode: 'ADD',
    anchor: 'OVERHEAD',
    scale: 1.0,
    alpha: 0.7,  // Victory stars/confetti
    zIndex: 5,
    looping: true,
    triggerTiming: 'onVictory',
    scaleWithCreature: false
  },
  taunt: {
    blendMode: 'NORMAL',
    anchor: 'OVERHEAD',
    scale: 0.8,
    alpha: 0.8,  // Taunt icon (speech bubble)
    zIndex: 5,
    looping: false,
    triggerTiming: 'onAnimationStart',
    duration: 600,
    scaleWithCreature: false
  },
  scared: {
    blendMode: 'NORMAL',
    anchor: 'OVERHEAD',
    scale: 0.8,
    alpha: 0.8,  // Fear icon (sweat drops)
    zIndex: 5,
    looping: true,
    triggerTiming: 'onDebuffApplied',
    scaleWithCreature: false
  },
  stun: {
    blendMode: 'ADD',
    anchor: 'OVERHEAD',
    scale: 0.9,
    alpha: 0.9,  // Stun stars circling
    zIndex: 5,
    looping: true,  // While stunned
    triggerTiming: 'onDebuffApplied',
    scaleWithCreature: false
  },
  knockback: {
    blendMode: 'ADD',
    anchor: 'CENTER',
    scale: 1.1,
    alpha: 0.7,  // Impact force lines
    zIndex: 4,
    looping: false,
    triggerTiming: 'onKnockback',
    duration: 300,
    scaleWithCreature: true
  },
  revive: {
    blendMode: 'SCREEN',
    anchor: 'CENTER',
    scale: 1.6,
    alpha: 0.8,  // Resurrection glow
    zIndex: 3,
    looping: false,
    triggerTiming: 'onRevive',
    duration: 1000,
    scaleWithCreature: true
  }
};
```

**Rationale:**
- **Status indicators (stun, scared)**: Anchored OVERHEAD, non-scaling, highly visible
- **Hit feedback**: ADD blend, center-aligned, instant (200ms) for snappy feel
- **Death effect**: MULTIPLY darkens creature as it fades, slow (1000ms) for drama
- **Celebration**: ADD blend, overhead, looping for sustained victory moment
- **Revive**: SCREEN blend for bright, hopeful resurrection glow

**WHY Overhead for Status Effects:**
- Clear visual communication (players instantly recognize stun stars above head)
- Doesn't obscure creature sprite
- Consistent with UI conventions (healthbars also overhead)
- Non-scaling ensures readability regardless of creature size

---

## Animation Synchronization

### Trigger Points

Effects must trigger at specific moments in creature animations or game events:

```typescript
enum TriggerType {
  IMMEDIATE = 'immediate',                // Start effect instantly (idle states)
  ON_ANIMATION_START = 'onAnimationStart',  // First frame of creature animation
  ON_ATTACK_FRAME = 'onAttackFrame',        // Specific frame (e.g., frame 2 of 4)
  ON_HIT_DETECTION = 'onHitDetection',      // Server confirms hit landed
  ON_ABILITY_START = 'onAbilityStart',      // Ability begins casting
  ON_ABILITY_COMPLETE = 'onAbilityComplete',// Ability finishes casting
  ON_DAMAGE_TAKEN = 'onDamageTaken',        // Server event: health decreased
  ON_HEALTH_ZERO = 'onHealthZero',          // Creature died
  ON_VICTORY = 'onVictory',                 // Battle won
  ON_DEBUFF_APPLIED = 'onDebuffApplied',    // Status effect applied (stun, fear)
  ON_KNOCKBACK = 'onKnockback',             // Server event: knockback force
  ON_REVIVE = 'onRevive',                   // Server event: creature revived
  CONTINUOUS = 'continuous'                 // Every frame during animation (walk dust)
}

// Implementation example:
class AnimationController {
  playCreatureAnimation(creatureId: string, animationId: string) {
    const effectConfig = effectConfigs[animationId];

    switch (effectConfig.triggerTiming) {
      case TriggerType.IMMEDIATE:
        this.attachEffect(creatureId, animationId, effectConfig);
        break;

      case TriggerType.ON_ATTACK_FRAME:
        // Wait for specific frame (e.g., frame 2 of 4)
        this.scheduleEffectTrigger(creatureId, animationId, {
          frame: 2,
          totalFrames: 4
        });
        break;

      case TriggerType.ON_HIT_DETECTION:
        // Server will send event, client waits
        this.registerHitCallback(creatureId, () => {
          this.attachEffect(creatureId, animationId, effectConfig);
        });
        break;

      // ... other trigger types
    }
  }
}
```

### Duration Handling

Effects have three duration behaviors:

```typescript
enum DurationBehavior {
  LOOP_INDEFINITE = 'loop_indefinite',    // Loops until manually stopped (buff auras)
  LOOP_FIXED = 'loop_fixed',              // Loops for fixed duration, then stops (casting)
  PLAY_ONCE = 'play_once'                 // Plays 4 frames once, then removes (hit flash)
}

interface EffectDuration {
  behavior: DurationBehavior;
  duration?: number;         // Milliseconds (only for LOOP_FIXED, PLAY_ONCE)
  frameCount: number;        // Total frames in animation (always 4 for library effects)
  fps: number;               // Playback speed (default 10)
}

// Examples:
const hitEffect: EffectDuration = {
  behavior: DurationBehavior.PLAY_ONCE,
  duration: 400,  // 4 frames × 100ms = 400ms
  frameCount: 4,
  fps: 10
};

const buffAura: EffectDuration = {
  behavior: DurationBehavior.LOOP_INDEFINITE,
  duration: undefined,  // Loops forever until buff expires
  frameCount: 4,
  fps: 10
};

const fireSpellCast: EffectDuration = {
  behavior: DurationBehavior.LOOP_FIXED,
  duration: 1000,  // 1 second cast time
  frameCount: 4,
  fps: 10  // Will loop ~2.5 times during cast
};
```

### Frame Synchronization

Keep creature animation and effect animation in sync:

```typescript
class EffectRenderer {
  private currentFrame: number = 0;
  private lastFrameTime: number = 0;
  private fps: number = 10;  // Match creature animation FPS

  update(deltaTime: number) {
    this.lastFrameTime += deltaTime;

    // Advance frame every 100ms (10 FPS)
    if (this.lastFrameTime >= 1000 / this.fps) {
      this.currentFrame = (this.currentFrame + 1) % this.frameCount;
      this.lastFrameTime = 0;
    }
  }

  // Sync with creature animation
  syncToCreatureFrame(creatureFrame: number) {
    // If creature is on frame 2, effect should also be on frame 2
    this.currentFrame = creatureFrame % this.frameCount;
  }
}
```

### Cleanup

Remove effects when they complete or are no longer needed:

```typescript
class EffectManager {
  private activeEffects: Map<string, EffectInstance> = new Map();

  update(deltaTime: number) {
    for (const [effectId, effect] of this.activeEffects) {
      effect.update(deltaTime);

      // Cleanup conditions:
      if (this.shouldRemoveEffect(effect)) {
        this.removeEffect(effectId);
      }
    }
  }

  private shouldRemoveEffect(effect: EffectInstance): boolean {
    // Remove if play-once animation completed
    if (effect.behavior === 'play_once' && effect.hasCompletedLoop()) {
      return true;
    }

    // Remove if fixed-duration expired
    if (effect.behavior === 'loop_fixed' && effect.elapsedTime >= effect.duration) {
      return true;
    }

    // Remove if creature died (unless it's the death effect itself)
    if (effect.creatureDead && effect.animationId !== 'death_default') {
      return true;
    }

    // Remove if creature switched to different animation (unless persistent buff)
    if (effect.creatureAnimationChanged && !effect.isPersistentBuff) {
      return true;
    }

    return false;
  }

  private removeEffect(effectId: string) {
    const effect = this.activeEffects.get(effectId);
    if (!effect) return;

    // Return sprite to pool for reuse
    this.spritePool.release(effect.sprite);

    // Remove from scene
    this.scene.removeChild(effect.sprite);

    // Delete from active effects
    this.activeEffects.delete(effectId);
  }
}
```

---

## Implementation Specifications

### Effect Loading and Caching

```typescript
// EffectLoader.ts - Responsible for loading library animations from API

interface LibraryAnimationData {
  animationId: string;
  action: string;
  description: string;
  frameCount: number;
  baseSprite: string;      // Base64-encoded PNG
  frames: string[];        // Array of base64-encoded PNGs
}

class EffectLoader {
  private cache: Map<string, LibraryAnimationData> = new Map();
  private loading: Map<string, Promise<LibraryAnimationData>> = new Map();

  /**
   * Load library animation from API
   * Returns cached data if already loaded
   * Deduplicates simultaneous requests for same animation
   */
  async loadLibraryAnimation(animationId: string): Promise<LibraryAnimationData> {
    // Check cache first
    if (this.cache.has(animationId)) {
      return this.cache.get(animationId)!;
    }

    // Check if already loading
    if (this.loading.has(animationId)) {
      return this.loading.get(animationId)!;
    }

    // Start loading
    const loadPromise = this.fetchFromAPI(animationId);
    this.loading.set(animationId, loadPromise);

    try {
      const data = await loadPromise;

      // Cache loaded data
      this.cache.set(animationId, data);

      // Preload textures into PixiJS
      await this.preloadTextures(data);

      return data;
    } finally {
      this.loading.delete(animationId);
    }
  }

  private async fetchFromAPI(animationId: string): Promise<LibraryAnimationData> {
    const response = await fetch(
      `http://localhost:3001/api/library-animations/${animationId}`
    );

    if (!response.ok) {
      throw new Error(`Failed to load animation: ${animationId}`);
    }

    return response.json();
  }

  private async preloadTextures(data: LibraryAnimationData): Promise<void> {
    // Convert base64 to PixiJS textures
    const promises = data.frames.map(async (frame, index) => {
      const img = new Image();
      img.src = `data:image/png;base64,${frame}`;

      return new Promise<PIXI.Texture>((resolve) => {
        img.onload = () => {
          const texture = PIXI.Texture.from(img);
          this.textureCache.set(`${data.animationId}_frame_${index}`, texture);
          resolve(texture);
        };
      });
    });

    await Promise.all(promises);
  }

  /**
   * Get texture for specific frame
   */
  getFrameTexture(animationId: string, frameIndex: number): PIXI.Texture | null {
    return this.textureCache.get(`${animationId}_frame_${frameIndex}`) || null;
  }

  /**
   * Preload commonly used effects
   * Call this during game initialization
   */
  async preloadCommonEffects(): Promise<void> {
    const commonEffects = [
      'hit_default',
      'attack_melee_sword',
      'idle_default',
      'walk_default',
      'death_default'
    ];

    await Promise.all(
      commonEffects.map(id => this.loadLibraryAnimation(id))
    );
  }

  /**
   * Clear cache to free memory
   */
  clearCache() {
    this.cache.clear();
    this.textureCache.clear();
  }
}
```

### Real-Time Compositing During Gameplay

```typescript
// CreatureRenderer.ts - Renders creature + effects

class CreatureRenderer {
  private container: PIXI.Container;
  private creatureSprite: PIXI.Sprite;
  private effectSprite: PIXI.Sprite | null = null;
  private effectAnimator: EffectAnimator | null = null;

  constructor(creatureId: string, baseSprite: string) {
    this.container = new PIXI.Container();
    this.container.sortableChildren = true;  // Enable z-index

    // Creature base sprite (zIndex 2)
    this.creatureSprite = PIXI.Sprite.from(baseSprite);
    this.creatureSprite.zIndex = 2;
    this.container.addChild(this.creatureSprite);
  }

  /**
   * Attach effect overlay to creature
   */
  attachEffect(animationId: string, config: EffectConfig) {
    // Remove previous effect if exists
    this.removeEffect();

    // Create effect sprite
    this.effectSprite = this.spritePool.acquire();
    this.effectSprite.blendMode = this.getBlendMode(config.blendMode);
    this.effectSprite.alpha = config.alpha;
    this.effectSprite.zIndex = config.zIndex;

    // Position effect
    const offset = this.getAnchorOffset(config.anchor);
    this.effectSprite.position.set(offset.x, offset.y);

    // Scale effect
    const scale = this.calculateScale(config);
    this.effectSprite.scale.set(scale, scale);

    // Add to container
    this.container.addChild(this.effectSprite);

    // Start animation
    this.effectAnimator = new EffectAnimator(
      this.effectSprite,
      animationId,
      config
    );
  }

  /**
   * Update effect animation frame
   */
  update(deltaTime: number) {
    if (this.effectAnimator) {
      this.effectAnimator.update(deltaTime);

      // Remove if animation completed
      if (this.effectAnimator.isComplete()) {
        this.removeEffect();
      }
    }
  }

  private removeEffect() {
    if (this.effectSprite) {
      this.container.removeChild(this.effectSprite);
      this.spritePool.release(this.effectSprite);
      this.effectSprite = null;
    }

    this.effectAnimator = null;
  }

  private getBlendMode(mode: string): PIXI.BLEND_MODES {
    switch (mode) {
      case 'ADD': return PIXI.BLEND_MODES.ADD;
      case 'MULTIPLY': return PIXI.BLEND_MODES.MULTIPLY;
      case 'SCREEN': return PIXI.BLEND_MODES.SCREEN;
      case 'OVERLAY': return PIXI.BLEND_MODES.OVERLAY;
      default: return PIXI.BLEND_MODES.NORMAL;
    }
  }

  private getAnchorOffset(anchor: EffectAnchor): { x: number, y: number } {
    // Implementation from Coordinate System section above
    const creatureSize = this.creatureSprite.width;
    const scale = creatureSize / 64;

    // ... (see Coordinate System section)
  }

  private calculateScale(config: EffectConfig): number {
    if (!config.scaleWithCreature) {
      return config.scale;
    }

    const creatureSize = this.creatureSprite.width;
    const scaleFactor = creatureSize / 64;  // 64px = base creature size

    let finalScale = config.scale * scaleFactor;

    // Clamp to min/max
    if (config.minScale !== undefined) {
      finalScale = Math.max(finalScale, config.minScale);
    }
    if (config.maxScale !== undefined) {
      finalScale = Math.min(finalScale, config.maxScale);
    }

    return finalScale;
  }
}
```

### Performance Optimization

```typescript
// SpritePool.ts - Object pooling to avoid GC pressure

class SpritePool {
  private available: PIXI.Sprite[] = [];
  private inUse: Set<PIXI.Sprite> = new Set();
  private maxPoolSize: number = 100;

  /**
   * Get sprite from pool or create new one
   */
  acquire(): PIXI.Sprite {
    let sprite: PIXI.Sprite;

    if (this.available.length > 0) {
      sprite = this.available.pop()!;
    } else {
      sprite = new PIXI.Sprite();
      sprite.anchor.set(0.5, 0.5);  // Center anchor
    }

    this.inUse.add(sprite);
    return sprite;
  }

  /**
   * Return sprite to pool for reuse
   */
  release(sprite: PIXI.Sprite) {
    if (!this.inUse.has(sprite)) {
      return;  // Not from this pool
    }

    this.inUse.delete(sprite);

    // Reset sprite state
    sprite.texture = PIXI.Texture.EMPTY;
    sprite.alpha = 1.0;
    sprite.blendMode = PIXI.BLEND_MODES.NORMAL;
    sprite.scale.set(1, 1);
    sprite.rotation = 0;
    sprite.position.set(0, 0);

    // Add back to pool if not at capacity
    if (this.available.length < this.maxPoolSize) {
      this.available.push(sprite);
    } else {
      sprite.destroy();  // Pool full, destroy excess
    }
  }

  /**
   * Prewarm pool with sprites
   */
  prewarm(count: number) {
    for (let i = 0; i < count; i++) {
      const sprite = new PIXI.Sprite();
      sprite.anchor.set(0.5, 0.5);
      this.available.push(sprite);
    }
  }

  /**
   * Clear pool and destroy all sprites
   */
  clear() {
    for (const sprite of this.available) {
      sprite.destroy();
    }
    this.available = [];
    this.inUse.clear();
  }
}

// BatchRenderer.ts - Batch rendering for performance

class BatchRenderer {
  private renderer: PIXI.Renderer;

  /**
   * Optimize rendering by batching draw calls
   */
  enableBatchMode() {
    // PixiJS automatically batches sprites with same texture/blend mode
    // We can help by:

    // 1. Use texture atlases (combine multiple effect frames into one texture)
    this.createTextureAtlases();

    // 2. Sort sprites by texture/blend mode before rendering
    this.enableContainerSorting();

    // 3. Enable caching for static sprites
    this.enableCaching();
  }

  private createTextureAtlases() {
    // Combine all frames of an effect into a single spritesheet
    // PixiJS will batch draw calls for sprites from same texture
    // (Post-MVP optimization)
  }

  private enableContainerSorting() {
    // Sort children by zIndex, then by texture
    // Reduces context switches between textures
  }

  private enableCaching() {
    // Cache creature base sprites as textures
    // Only re-render when creature animation frame changes
  }
}
```

---

## Testing & Validation

### Manual Testing Checklist

```markdown
## Effect Compositing Test Plan

### Rendering Tests
- [ ] Effect renders on top of creature sprite (correct z-index)
- [ ] Effect positioned at correct anchor point (center, overhead, ground, etc.)
- [ ] Effect scales correctly with creature size (64px vs 128px creature)
- [ ] Effect alpha blending looks correct (no hard edges on transparent areas)
- [ ] Effect blend mode produces expected visual result (ADD bright, MULTIPLY dark, etc.)

### Animation Tests
- [ ] Effect animation plays at 10 FPS (same as creature animation)
- [ ] Effect frames sync with creature animation frames
- [ ] Effect loops correctly for continuous animations (walk, buff)
- [ ] Effect plays once and removes for one-shot animations (hit, jump)
- [ ] Effect duration matches expected timing (400ms for 4-frame effect)

### Trigger Tests
- [ ] Immediate triggers start effect instantly (idle states)
- [ ] onAnimationStart triggers on first frame of creature animation
- [ ] onAttackFrame triggers on correct frame (frame 2 of attack)
- [ ] onHitDetection triggers when server confirms hit
- [ ] onAbilityStart triggers when ability casting begins

### Performance Tests
- [ ] 30+ FPS maintained with 5 creatures on screen
- [ ] 30+ FPS maintained with 10 creatures on screen
- [ ] 30+ FPS maintained with 20 creatures on screen (MVP target)
- [ ] No memory leaks after 100+ effect spawns
- [ ] Sprite pool correctly reuses sprites (no unbounded growth)

### Edge Cases
- [ ] Effect handles creature death mid-animation
- [ ] Effect handles creature teleport/position change
- [ ] Effect handles rapid animation switches
- [ ] Effect handles creature sprite swap (evolve/transform)
- [ ] Effect handles missing/failed texture loads gracefully
```

### Visual Quality Criteria

Effects must meet these visual standards:

1. **Clarity**: Effect clearly visible on both light and dark creature sprites
2. **Consistency**: Same effect looks similar on different creature types
3. **No Artifacts**: No jagged edges, z-fighting, or flickering
4. **Smooth Animation**: No frame skips or stuttering at 10 FPS
5. **Appropriate Intensity**: Effects enhance but don't overwhelm creature sprite

### Performance Benchmarks

Target metrics on reference hardware (mid-range laptop, 2019):

```typescript
interface PerformanceBenchmarks {
  fps: {
    target: 30,                    // Minimum FPS (L0 Vision requirement)
    ideal: 60,                     // Ideal FPS for smooth experience
    measured: {
      '5_creatures': number,       // Should be 60 FPS
      '10_creatures': number,      // Should be 60 FPS
      '20_creatures': number,      // Should be 30+ FPS (MVP target)
      '40_creatures': number        // Post-MVP stretch goal
    }
  },

  memory: {
    spritePoolSize: 100,           // Max pooled sprites
    textureMemory: '50MB',         // Max texture cache size
    effectInstancesMax: 40         // Max simultaneous effects
  },

  loading: {
    cacheHitTime: '0ms',           // Cached effect load time
    apiLoadTime: '<500ms',         // First-time API load
    textureUploadTime: '<100ms'    // GPU texture upload
  }
}
```

### Automated Testing (Post-MVP)

```typescript
// Unit tests for effect system

describe('EffectCompositing', () => {
  it('should render effect at correct z-index', () => {
    const creature = new CreatureRenderer('test', baseSprite);
    creature.attachEffect('attack_melee_sword', swordConfig);

    expect(creature.effectSprite.zIndex).toBe(4);  // Top layer
  });

  it('should apply correct blend mode', () => {
    const creature = new CreatureRenderer('test', baseSprite);
    creature.attachEffect('cast_fire_spell', fireConfig);

    expect(creature.effectSprite.blendMode).toBe(PIXI.BLEND_MODES.ADD);
  });

  it('should remove effect after play-once completion', () => {
    const creature = new CreatureRenderer('test', baseSprite);
    creature.attachEffect('hit_default', hitConfig);

    // Advance time by 400ms (4 frames at 10fps)
    creature.update(400);

    expect(creature.effectSprite).toBeNull();
  });

  it('should pool sprites efficiently', () => {
    const pool = new SpritePool();
    const sprite1 = pool.acquire();
    const sprite2 = pool.acquire();

    pool.release(sprite1);
    const sprite3 = pool.acquire();

    expect(sprite3).toBe(sprite1);  // Reused from pool
  });
});
```

---

## Future Enhancements

### Phase 2: Multi-Effect Stacking

Allow multiple effects on single creature simultaneously:

```typescript
// Example: Creature with shield buff + attack animation + footstep dust

class CreatureRenderer {
  private effects: Map<string, EffectInstance> = new Map();

  attachEffect(slot: string, animationId: string, config: EffectConfig) {
    // Remove previous effect in this slot
    if (this.effects.has(slot)) {
      this.removeEffect(slot);
    }

    // Add new effect
    const effect = new EffectInstance(animationId, config);
    this.effects.set(slot, effect);
  }

  // Render all active effects
  update(deltaTime: number) {
    for (const [slot, effect] of this.effects) {
      effect.update(deltaTime);

      if (effect.isComplete()) {
        this.removeEffect(slot);
      }
    }
  }
}

// Usage:
creature.attachEffect('persistent_buff', 'buff_spell', buffConfig);
creature.attachEffect('attack', 'attack_melee_sword', swordConfig);
creature.attachEffect('locomotion', 'walk_default', walkConfig);
```

**Benefits:**
- Richer visual representation (buffed creature attacking while walking)
- More accurate game state visualization
- Better player feedback

**Challenges:**
- Visual clutter (too many effects)
- Performance impact (more sprites rendered)
- Z-index conflicts (which effect on top?)

---

### Phase 3: Dynamic Anchor Points

Attach effects to specific creature body parts:

```typescript
// Advanced anchor system

interface AdvancedAnchor {
  type: 'skeleton' | 'pixel' | 'calculated';

  // Skeleton-based (if creature has bone data)
  boneName?: string;  // 'right_hand', 'head', 'tail_tip'

  // Pixel-based (detect specific color in sprite)
  pixelColor?: string;  // '#FF0000' for red weapon pixel

  // Calculated (algorithm-based)
  algorithm?: 'center_of_mass' | 'highest_point' | 'leading_edge';
}

// Example: Attach sword slash to actual weapon location
const dynamicSwordConfig: EffectConfig = {
  anchor: {
    type: 'skeleton',
    boneName: 'right_hand'  // If creature has skeletal data
  },
  fallback: EffectAnchor.WEAPON_HAND  // Fixed offset if no skeleton
};
```

**Benefits:**
- Effects follow creature animations (hand moves, effect moves)
- More believable visuals (sword slash originates from sword)
- Supports diverse creature shapes (four-legged vs bipedal)

**Challenges:**
- Requires skeletal animation data (not available in MVP)
- Increased computational cost (bone lookups per frame)
- Complexity for non-skeletal sprites

---

### Phase 4: Effect Intensity Variations

Adjust effect based on game state:

```typescript
// Variable intensity effects

interface IntensityModifiers {
  scale?: number;        // Size multiplier (1.5x for critical hit)
  alpha?: number;        // Transparency override (0.5 for weak attack)
  tint?: number;         // Color tint (red for fire, blue for ice)
  speed?: number;        // Animation speed (2x for haste buff)
}

// Example: Critical hit = bigger, brighter sword slash
creature.attachEffect('attack_melee_sword', {
  ...swordConfig,
  intensityModifiers: {
    scale: 1.5,      // 50% larger
    alpha: 1.0,      // Fully opaque
    tint: 0xFFFF00   // Yellow tint for critical
  }
});

// Example: Low-health creature has weaker effects
creature.attachEffect('attack_melee_punch', {
  ...punchConfig,
  intensityModifiers: {
    scale: 0.7,      // 30% smaller
    alpha: 0.6       // More transparent
  }
});
```

**Benefits:**
- Communicates game state visually (critical hits obvious)
- Adds variety to repeated effects
- Player feedback (seeing weak attack motivates healing)

**Challenges:**
- Balance (too subtle = invisible, too extreme = confusing)
- Performance (tinting requires shader operations)
- Consistency (when to vary vs when to keep uniform)

---

### Phase 5: Particle System Integration

Combine library effects with procedural particles:

```typescript
// Hybrid effect system

class HybridEffect {
  private libraryEffect: EffectInstance;
  private particleEmitter: PIXI.particles.Emitter;

  constructor(animationId: string, config: EffectConfig) {
    // Base library animation
    this.libraryEffect = new EffectInstance(animationId, config);

    // Add procedural particles for extra flair
    if (config.addParticles) {
      this.particleEmitter = new PIXI.particles.Emitter(
        container,
        particleConfig
      );
    }
  }

  update(deltaTime: number) {
    this.libraryEffect.update(deltaTime);
    this.particleEmitter?.update(deltaTime);
  }
}

// Example: Fire spell with base flame + flying embers
const fireSpellWithParticles = {
  ...fireSpellConfig,
  addParticles: {
    type: 'embers',
    count: 20,
    lifetime: 1000,
    velocity: { x: 0, y: -50 },  // Float upward
    color: 0xFF6600
  }
};
```

**Benefits:**
- Richer visual effects (library + particles > library alone)
- Dynamic, non-repeating visuals (particles randomized)
- Better immersion (fire feels alive, not looped animation)

**Challenges:**
- Performance (particles are expensive)
- Design complexity (tuning particle systems)
- Consistency (ensure particles match library effect style)

---

## Related Documentation

- **L0 Vision**: `/docs/specs/L0-VISION/creating-speical-creature-animations.md`
- **L1 Theme**: `/docs/specs/L1-THEMES/battle-engine.md` (rendering requirements)
- **L3 Feature**: `/docs/specs/L3-FEATURES/ai-generation-pipeline/animation-library.md` (effect generation)
- **Implementation**: `/frontend/src/components/AnimationDebugger/AnimationDebugger.tsx` (current viewer)

---

## Decision Log

### Decision 1: Blend Modes Over Shaders
**Date**: 2025-10-02
**Decision**: Use PixiJS blend modes (ADD, MULTIPLY, SCREEN) instead of custom shaders
**Reasoning**:
- Blend modes are GPU-accelerated and performant
- Easier to understand and maintain (no GLSL code)
- Cross-platform compatibility (works on all WebGL devices)
- Sufficient visual variety for MVP (5 blend modes cover all use cases)

**Trade-offs**:
- Less flexibility than custom shaders (can't create exotic effects)
- Can't implement advanced techniques (outline glow, chromatic aberration)
- Post-MVP may require shader upgrade for AAA-quality effects

---

### Decision 2: Fixed Anchor Points (MVP)
**Date**: 2025-10-02
**Decision**: Use fixed offset anchors (CENTER, OVERHEAD, GROUND, etc.) instead of skeletal attachments
**Reasoning**:
- Creatures don't have skeletal data (static PNGs)
- Fixed offsets work for 90% of use cases
- Simpler implementation (no bone hierarchy lookups)
- Better performance (no per-frame skeleton calculations)

**Trade-offs**:
- Effects won't follow animated body parts (hand moving during attack)
- Less accurate for diverse creature shapes (centaur vs quadruped)
- Post-MVP will need upgrade for AAA-quality attachment

---

### Decision 3: Single Effect Per Creature (MVP)
**Date**: 2025-10-02
**Decision**: Allow only one effect at a time, new effect replaces old
**Reasoning**:
- Simplifies implementation (no effect slot management)
- Reduces performance overhead (fewer sprites rendered)
- Prevents visual clutter (too many effects confusing)
- MVP focuses on core mechanics (multi-stacking post-MVP)

**Trade-offs**:
- Can't show buff + attack simultaneously (less rich visualization)
- Some game states invisible (shield active during attack)
- Post-MVP will need effect slot system

---

### Decision 4: 10 FPS Animation Playback
**Date**: 2025-10-02
**Decision**: Play library effects at 10 FPS (100ms per frame)
**Reasoning**:
- Matches creature walk animation FPS (consistency)
- 4 frames at 10 FPS = 400ms (feels snappy for impacts)
- Pixel art style works at low FPS (no motion blur needed)
- Reduces file size (fewer frames to generate/store)

**Trade-offs**:
- Less smooth than 30/60 FPS (visible frame steps)
- Some effects may feel choppy (fast motions)
- Post-MVP could interpolate frames for smoothness

---

## Open Questions for Implementation

1. **Effect Priority**: When creature switches animations mid-effect, should effect complete or be interrupted immediately?
   - **Option A**: Complete effect (better visuals, more confusing)
   - **Option B**: Interrupt (more responsive, but jarring cuts)

2. **Effect Scaling Limits**: Should we enforce min/max scale to prevent tiny/huge effects?
   - **Proposed**: Min 0.5x, Max 2.0x (prevents extremes)
   - **Concern**: Limits creative expression for giant/tiny creatures

3. **Memory Budget**: How many effects should we cache before evicting?
   - **Proposed**: Cache all 55 effects (~20MB textures)
   - **Alternative**: Cache 20 most-used, load-on-demand for rare effects

4. **Blend Mode Fallback**: What if player's device doesn't support advanced blend modes?
   - **Proposed**: Fallback to NORMAL blend (safe but less pretty)
   - **Concern**: Quality degradation on old hardware

5. **Effect Audio**: Should effects trigger sound effects, or is that separate system?
   - **Proposed**: Separate audio system listens for same triggers
   - **Alternative**: Effect system emits audio events directly

---

**Version**: 1.0
**Status**: PLANNED (Implementation begins after Animation Library complete)
**Dependencies**: Animation Library (L3), PixiJS Renderer (Battle Engine), API Endpoints (Backend)
