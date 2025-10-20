# L3 FEATURE: Projectile Effect System

**Feature ID**: `projectile-effect-system`
**Parent Epic**: Client Rendering & Animation Sync (L2)
**Status**: PLANNING
**Version**: 1.0
**Last Updated**: 2025-10-05

---

## Overview

The **Projectile Effect System** renders ranged attack projectiles (arrows, fireballs, lightning bolts) traveling from source creature to target creature, synchronized with attack animations. Projectiles spawn at specific animation frames (frame 8 of bow attack), travel along trajectories at realistic speeds (5 hexes/sec), rotate to face direction, and trigger impact effects (explosions, sparks) on collision with targets.

**Purpose**: Make ranged attacks visually spectacular and readable—players see arrows fly, fireballs arc, and lightning streak across the battlefield, creating dynamic combat that feels alive rather than abstract damage numbers appearing out of nowhere.

**User Value**: Players understand what's happening in combat at a glance: archer fires arrow → arrow travels → arrow hits target → damage number appears. Visual clarity transforms auto-battles from confusing chaos into coherent tactical storytelling.

---

## Functional Requirements

### FR-1: Projectile Spawning from Frame Events

**What**: Spawn projectile sprites when attack animation reaches the "release" frame

**Trigger**: Animation Controller's Frame Event Manager calls `projectileSystem.spawn()` at frame 8

**Spawn Data**:
```typescript
interface ProjectileSpawnData {
  projectileId: string;         // Unique ID for tracking
  sourceUnitId: string;         // Unit firing the projectile
  targetUnitId: string;         // Unit being targeted
  projectileType: string;       // 'arrow' | 'fireball' | 'lightning' | 'ice_shard' | etc
  spawnPosition: Vector2;       // Pixel coordinates (MVP: creature center)
  targetPosition: Vector2;      // Target creature's current position
  velocity: number;             // Travel speed in hexes/sec (5 default)
  rotateToFace: boolean;        // Rotate sprite to face direction (true for arrows)
  trailEffect?: string;         // Optional particle trail ('fire_trail', 'magic_sparkle')
}
```

**Spawn Process**:
```typescript
class ProjectileSystem {
  spawn(data: ProjectileSpawnData): ClientProjectile {
    // Load projectile sprite
    const sprite = this.loadProjectileSprite(data.projectileType);

    // Position at spawn point
    sprite.position.set(data.spawnPosition.x, data.spawnPosition.y);

    // Calculate initial rotation
    if (data.rotateToFace) {
      const angle = Math.atan2(
        data.targetPosition.y - data.spawnPosition.y,
        data.targetPosition.x - data.spawnPosition.x
      );
      sprite.rotation = angle;
    }

    // Create projectile instance
    const projectile: ClientProjectile = {
      projectileId: data.projectileId,
      sourceUnitId: data.sourceUnitId,
      targetUnitId: data.targetUnitId,
      projectileType: data.projectileType,
      renderPosition: { ...data.spawnPosition },
      targetPosition: { ...data.targetPosition },
      velocity: data.velocity,
      sprite: sprite,
      spawnTime: Date.now(),
      hasImpacted: false
    };

    // Add trail effect if specified
    if (data.trailEffect) {
      projectile.trailSprite = this.createTrailEffect(data.trailEffect, sprite);
    }

    // Add to projectile layer (renders above creatures)
    this.projectileLayer.addChild(sprite);
    this.activeProjectiles.push(projectile);

    console.log(`[Projectile] Spawned ${data.projectileType} from ${data.sourceUnitId} to ${data.targetUnitId}`);

    return projectile;
  }
}
```

**Spawn Position** (MVP):
- Projectiles spawn from **creature center** position
- Post-MVP enhancement: attachment points (hand, mouth, weapon tip)

---

### FR-2: Projectile Trajectory Animation

**What**: Animate projectile movement from source to target along linear path

**Movement Algorithm**:
```typescript
class ProjectileSystem {
  update(deltaTime: number): void {
    for (const projectile of this.activeProjectiles) {
      if (projectile.hasImpacted) continue;

      // Get current target position (target may be moving)
      const target = this.getUnit(projectile.targetUnitId);
      if (!target) {
        // Target died, despawn projectile
        this.despawn(projectile);
        continue;
      }

      projectile.targetPosition = target.renderPosition;

      // Calculate direction vector
      const dx = projectile.targetPosition.x - projectile.renderPosition.x;
      const dy = projectile.targetPosition.y - projectile.renderPosition.y;
      const distance = Math.hypot(dx, dy);

      // Check for impact (within 10 pixels)
      if (distance < 10) {
        this.triggerImpact(projectile);
        continue;
      }

      // Normalize direction
      const dirX = dx / distance;
      const dirY = dy / distance;

      // Calculate movement (velocity in hexes/sec → pixels/sec)
      const pixelsPerSec = projectile.velocity * HEX_SIZE_PIXELS; // 5 hexes/sec * 64px/hex = 320px/sec
      const moveDistance = pixelsPerSec * deltaTime;

      // Update position
      projectile.renderPosition.x += dirX * moveDistance;
      projectile.renderPosition.y += dirY * moveDistance;

      // Update sprite position
      projectile.sprite.position.set(
        projectile.renderPosition.x,
        projectile.renderPosition.y
      );

      // Update rotation to face direction
      if (projectile.rotateToFace) {
        projectile.sprite.rotation = Math.atan2(dy, dx);
      }

      // Update trail effect position
      if (projectile.trailSprite) {
        projectile.trailSprite.position.set(
          projectile.renderPosition.x,
          projectile.renderPosition.y
        );
      }
    }
  }
}
```

**Velocity Calculation**:
- Default: 5 hexes/sec (per reference decision)
- Converts to pixels: `5 hexes/sec * 64 pixels/hex = 320 pixels/sec`
- Fast projectiles (lightning): 8 hexes/sec = 512 pixels/sec
- Slow projectiles (boulder): 3 hexes/sec = 192 pixels/sec

**Target Tracking**:
- Projectiles track **moving targets** (recalculate target position each frame)
- If target dies mid-flight, projectile despawns immediately
- No homing behavior (projectiles travel in straight line, target just moves)

---

### FR-3: Projectile Rotation & Facing

**What**: Rotate projectile sprite to face travel direction for realism

**Applicable Projectiles**:
- ✅ **Arrows**: Must rotate to show arrow pointing toward target
- ✅ **Javelins**: Spear rotates in flight
- ✅ **Crossbow Bolts**: Bolt rotates toward target
- ❌ **Fireballs**: Spherical, no rotation needed
- ❌ **Ice Shards**: Crystalline, rotates for visual flair (optional)
- ❌ **Lightning**: Instant visual effect, no projectile rotation

**Rotation Calculation**:
```typescript
function updateProjectileRotation(projectile: ClientProjectile): void {
  if (!projectile.rotateToFace) return;

  const dx = projectile.targetPosition.x - projectile.renderPosition.x;
  const dy = projectile.targetPosition.y - projectile.renderPosition.y;

  // Calculate angle in radians (0 = right, Math.PI/2 = down)
  const angle = Math.atan2(dy, dx);

  // Apply rotation to sprite
  projectile.sprite.rotation = angle;
}
```

**Rotation Smoothing** (optional polish):
- Smooth rotation changes over 50ms to prevent jarring snaps
- Use GSAP or manual interpolation:
```typescript
const targetRotation = Math.atan2(dy, dx);
const currentRotation = projectile.sprite.rotation;
const rotationDelta = targetRotation - currentRotation;

// Smooth rotation (exponential ease)
projectile.sprite.rotation += rotationDelta * 0.2;
```

---

### FR-4: Impact Effects on Collision

**What**: Trigger visual impact effects when projectile reaches target

**Impact Detection**:
- Projectile within 10 pixels of target center → impact triggered
- Projectile despawns immediately after impact
- Impact effect spawns at collision point

**Impact Effect Types**:
```typescript
const IMPACT_EFFECTS: Record<string, ImpactEffectDefinition> = {
  arrow: {
    effectId: 'hit_spark',
    frameCount: 4,
    duration: 200, // ms
    size: 32, // pixels
    blendMode: PIXI.BLEND_MODES.NORMAL
  },
  fireball: {
    effectId: 'explosion_fire',
    frameCount: 6,
    duration: 400,
    size: 64,
    blendMode: PIXI.BLEND_MODES.SCREEN
  },
  lightning: {
    effectId: 'impact_lightning',
    frameCount: 3,
    duration: 150,
    size: 48,
    blendMode: PIXI.BLEND_MODES.SCREEN
  },
  ice_shard: {
    effectId: 'impact_ice',
    frameCount: 5,
    duration: 300,
    size: 40,
    blendMode: PIXI.BLEND_MODES.NORMAL
  }
};
```

**Impact Triggering**:
```typescript
class ProjectileSystem {
  private triggerImpact(projectile: ClientProjectile): void {
    // Mark as impacted
    projectile.hasImpacted = true;

    // Get impact effect definition
    const effectDef = IMPACT_EFFECTS[projectile.projectileType];
    if (!effectDef) {
      console.warn(`No impact effect defined for ${projectile.projectileType}`);
      this.despawn(projectile);
      return;
    }

    // Spawn impact effect at collision point
    this.effectSystem.spawn({
      effectType: effectDef.effectId,
      position: projectile.renderPosition,
      frameCount: effectDef.frameCount,
      duration: effectDef.duration,
      size: effectDef.size,
      blendMode: effectDef.blendMode,
      onComplete: () => {
        // Effect cleanup handled by effect system
      }
    });

    // Play impact sound
    this.audioManager.playSound(`impact_${projectile.projectileType}`);

    // Screen shake for big impacts (fireballs, explosions)
    if (projectile.projectileType === 'fireball' || projectile.projectileType === 'meteor') {
      this.cameraController.shake(5, 200); // 5px intensity, 200ms duration
    }

    // Despawn projectile
    this.despawn(projectile);
  }

  private despawn(projectile: ClientProjectile): void {
    // Remove from layer
    this.projectileLayer.removeChild(projectile.sprite);

    // Remove trail effect if exists
    if (projectile.trailSprite) {
      this.projectileLayer.removeChild(projectile.trailSprite);
      projectile.trailSprite.destroy();
    }

    // Destroy sprite
    projectile.sprite.destroy();

    // Remove from active list
    const index = this.activeProjectiles.indexOf(projectile);
    if (index !== -1) {
      this.activeProjectiles.splice(index, 1);
    }
  }
}
```

---

### FR-5: Projectile Types & Visual Styles

**What**: Support diverse projectile types with distinct visual styles

**Projectile Catalog**:
```typescript
interface ProjectileDefinition {
  id: string;
  spritePath: string;           // Path to projectile sprite
  frameCount: number;           // Frames for animated projectiles (1 for static)
  animationSpeed: number;       // FPS for animation (0 for static)
  rotateToFace: boolean;        // Whether to rotate toward target
  defaultVelocity: number;      // Hexes/sec
  trailEffect?: string;         // Optional trail effect
  impactEffect: string;         // Impact effect ID
  size: number;                 // Sprite size in pixels
}

const PROJECTILE_CATALOG: ProjectileDefinition[] = [
  // PHYSICAL PROJECTILES
  {
    id: 'arrow',
    spritePath: '/assets/projectiles/arrow.png',
    frameCount: 1,
    animationSpeed: 0,
    rotateToFace: true,
    defaultVelocity: 6, // Fast
    impactEffect: 'hit_spark',
    size: 32
  },
  {
    id: 'crossbow_bolt',
    spritePath: '/assets/projectiles/crossbow_bolt.png',
    frameCount: 1,
    animationSpeed: 0,
    rotateToFace: true,
    defaultVelocity: 7, // Very fast
    impactEffect: 'hit_spark',
    size: 28
  },
  {
    id: 'javelin',
    spritePath: '/assets/projectiles/javelin.png',
    frameCount: 1,
    animationSpeed: 0,
    rotateToFace: true,
    defaultVelocity: 5,
    impactEffect: 'hit_spark',
    size: 40
  },

  // FIRE PROJECTILES
  {
    id: 'fireball',
    spritePath: '/assets/projectiles/fireball.png',
    frameCount: 4, // Animated flames
    animationSpeed: 12, // 12 FPS
    rotateToFace: false,
    defaultVelocity: 4,
    trailEffect: 'fire_trail',
    impactEffect: 'explosion_fire',
    size: 48
  },
  {
    id: 'fire_breath',
    spritePath: '/assets/projectiles/fire_breath.png',
    frameCount: 4,
    animationSpeed: 15,
    rotateToFace: false,
    defaultVelocity: 5,
    trailEffect: 'fire_embers',
    impactEffect: 'explosion_fire',
    size: 64
  },

  // ICE PROJECTILES
  {
    id: 'ice_shard',
    spritePath: '/assets/projectiles/ice_shard.png',
    frameCount: 1,
    animationSpeed: 0,
    rotateToFace: true,
    defaultVelocity: 5,
    impactEffect: 'impact_ice',
    size: 32
  },
  {
    id: 'ice_bolt',
    spritePath: '/assets/projectiles/ice_bolt.png',
    frameCount: 3,
    animationSpeed: 10,
    rotateToFace: false,
    defaultVelocity: 6,
    trailEffect: 'frost_trail',
    impactEffect: 'impact_ice',
    size: 40
  },

  // LIGHTNING PROJECTILES
  {
    id: 'lightning_bolt',
    spritePath: '/assets/projectiles/lightning_bolt.png',
    frameCount: 3,
    animationSpeed: 20, // Fast flicker
    rotateToFace: false,
    defaultVelocity: 10, // Very fast
    impactEffect: 'impact_lightning',
    size: 56
  },

  // DARK/POISON PROJECTILES
  {
    id: 'poison_dart',
    spritePath: '/assets/projectiles/poison_dart.png',
    frameCount: 1,
    animationSpeed: 0,
    rotateToFace: true,
    defaultVelocity: 6,
    trailEffect: 'poison_drip',
    impactEffect: 'impact_poison',
    size: 24
  },
  {
    id: 'dark_orb',
    spritePath: '/assets/projectiles/dark_orb.png',
    frameCount: 4,
    animationSpeed: 10,
    rotateToFace: false,
    defaultVelocity: 4,
    trailEffect: 'shadow_trail',
    impactEffect: 'impact_dark',
    size: 48
  }
];
```

---

### FR-6: Projectile Trail Effects (Optional Polish)

**What**: Add visual trails behind projectiles for enhanced spectacle

**Trail Types**:
- **Fire Trail**: Flickering flames behind fireball
- **Frost Trail**: Ice crystals behind ice bolt
- **Magic Sparkle**: Glowing particles behind spell projectiles
- **Shadow Trail**: Dark wisps behind poison/dark projectiles

**Implementation**:
```typescript
class ProjectileSystem {
  private createTrailEffect(
    trailType: string,
    projectileSprite: PIXI.Sprite
  ): PIXI.ParticleEmitter | PIXI.Sprite {
    switch (trailType) {
      case 'fire_trail':
        // Simple approach: Animated sprite following projectile
        const trailFrames = this.loadFrames('/assets/effects/fire_trail');
        const trail = new PIXI.AnimatedSprite(trailFrames);
        trail.animationSpeed = 0.5;
        trail.loop = true;
        trail.play();
        trail.anchor.set(0.5, 0.5);
        trail.scale.set(0.8, 0.8);
        trail.alpha = 0.7;
        this.projectileLayer.addChild(trail);
        return trail;

      case 'frost_trail':
        const frostTrail = new PIXI.AnimatedSprite(this.loadFrames('/assets/effects/frost_trail'));
        frostTrail.animationSpeed = 0.3;
        frostTrail.loop = true;
        frostTrail.play();
        frostTrail.anchor.set(0.5, 0.5);
        frostTrail.alpha = 0.6;
        this.projectileLayer.addChild(frostTrail);
        return frostTrail;

      // ... other trail types

      default:
        return null;
    }
  }
}
```

**Trail Update**:
- Trail sprite follows projectile position each frame
- Trail fades out when projectile despawns
- Trail is removed when projectile impacts

**MVP Status**: Trail effects are **optional polish** (Priority 3). Implement basic projectiles first, add trails in polish pass.

---

### FR-7: Projectile Pooling for Performance

**What**: Reuse projectile sprites to avoid constant creation/destruction overhead

**Object Pool Pattern**:
```typescript
class ProjectilePool {
  private pools: Map<string, PIXI.Sprite[]> = new Map();
  private readonly POOL_SIZE = 20; // Max projectiles per type

  acquire(projectileType: string): PIXI.Sprite {
    // Get pool for this type
    let pool = this.pools.get(projectileType);
    if (!pool) {
      pool = [];
      this.pools.set(projectileType, pool);
    }

    // Try to reuse existing sprite
    if (pool.length > 0) {
      const sprite = pool.pop()!;
      sprite.visible = true;
      sprite.alpha = 1.0;
      return sprite;
    }

    // Create new sprite if pool empty
    const sprite = this.createProjectileSprite(projectileType);
    return sprite;
  }

  release(projectileType: string, sprite: PIXI.Sprite): void {
    // Get pool for this type
    let pool = this.pools.get(projectileType);
    if (!pool) {
      pool = [];
      this.pools.set(projectileType, pool);
    }

    // Return to pool if not full
    if (pool.length < this.POOL_SIZE) {
      sprite.visible = false; // Hide but don't destroy
      pool.push(sprite);
    } else {
      // Pool full, destroy sprite
      sprite.destroy();
    }
  }

  private createProjectileSprite(projectileType: string): PIXI.Sprite {
    const def = PROJECTILE_CATALOG.find(p => p.id === projectileType);
    if (!def) {
      console.error(`Unknown projectile type: ${projectileType}`);
      return new PIXI.Sprite();
    }

    if (def.frameCount > 1) {
      // Animated projectile
      const frames = this.loadFrames(def.spritePath, def.frameCount);
      const sprite = new PIXI.AnimatedSprite(frames);
      sprite.animationSpeed = def.animationSpeed / 60;
      sprite.loop = true;
      sprite.play();
      return sprite as any; // Cast to PIXI.Sprite for pool
    } else {
      // Static projectile
      const sprite = PIXI.Sprite.from(def.spritePath);
      sprite.anchor.set(0.5, 0.5);
      sprite.width = def.size;
      sprite.height = def.size;
      return sprite;
    }
  }
}
```

**Pool Usage**:
```typescript
class ProjectileSystem {
  private pool = new ProjectilePool();

  spawn(data: ProjectileSpawnData): ClientProjectile {
    // Acquire sprite from pool
    const sprite = this.pool.acquire(data.projectileType);

    // Configure sprite
    sprite.position.set(data.spawnPosition.x, data.spawnPosition.y);
    // ... setup rotation, etc

    // Add to layer
    this.projectileLayer.addChild(sprite);

    // Create projectile instance
    const projectile: ClientProjectile = {
      projectileId: data.projectileId,
      sprite: sprite,
      // ... other fields
    };

    return projectile;
  }

  private despawn(projectile: ClientProjectile): void {
    // Remove from layer
    this.projectileLayer.removeChild(projectile.sprite);

    // Return sprite to pool
    this.pool.release(projectile.projectileType, projectile.sprite);

    // Remove from active list
    const index = this.activeProjectiles.indexOf(projectile);
    if (index !== -1) {
      this.activeProjectiles.splice(index, 1);
    }
  }
}
```

**Performance Benefit**:
- Avoids creating 100+ sprites per combat (8 archers × 10 arrows each = 80 sprites)
- Reduces garbage collection pressure
- Maintains stable memory usage

---

### FR-8: Effect Scaling Based on Creature Size

**What**: Scale impact effects based on creature size for visual consistency

**Size Categories**:
- **Small**: 0.7x scale (goblins, rats, small creatures)
- **Medium**: 1.0x scale (humans, orcs, standard creatures)
- **Large**: 1.3x scale (dragons, giants, large creatures)

**Scaling Algorithm**:
```typescript
function spawnImpactEffect(
  effectType: string,
  position: Vector2,
  targetCreature: ClientUnit
): void {
  // Get base effect definition
  const effectDef = IMPACT_EFFECTS[effectType];

  // Determine creature size
  const sizeMultiplier = this.getCreatureSizeMultiplier(targetCreature);

  // Spawn effect with scaled size
  this.effectSystem.spawn({
    effectType: effectDef.effectId,
    position: position,
    frameCount: effectDef.frameCount,
    duration: effectDef.duration,
    size: effectDef.size * sizeMultiplier, // Scale effect size
    blendMode: effectDef.blendMode
  });
}

private getCreatureSizeMultiplier(unit: ClientUnit): number {
  // Determine size from creature stats or archetype
  // For MVP, can use simple heuristics:
  if (unit.stats.maxHealth > 150) return 1.3; // Large creature
  if (unit.stats.maxHealth < 80) return 0.7;  // Small creature
  return 1.0; // Medium creature
}
```

**Example**:
- Small goblin hit by arrow: 32px × 0.7 = 22px impact effect
- Medium knight hit by arrow: 32px × 1.0 = 32px impact effect
- Large dragon hit by arrow: 32px × 1.3 = 42px impact effect

---

## Technical Architecture

### Components

**Frontend Services** (`/frontend/src/services/`):

1. **Projectile System** (`projectiles/projectile-system.ts`):
   - Main projectile manager
   - Spawns, updates, despawns projectiles
   - Exports: `ProjectileSystem` class

2. **Projectile Pool** (`projectiles/projectile-pool.ts`):
   - Object pooling for sprite reuse
   - Exports: `ProjectilePool` class

3. **Projectile Catalog** (`projectiles/projectile-catalog.ts`):
   - Central configuration for all projectile types
   - Exports: `PROJECTILE_CATALOG: ProjectileDefinition[]`

4. **Impact Effect Manager** (`effects/impact-effect-manager.ts`):
   - Triggers impact effects on collision
   - Exports: `ImpactEffectManager` class

5. **Trail Effect Manager** (`effects/trail-effect-manager.ts`):
   - Creates and manages projectile trails
   - Exports: `TrailEffectManager` class

**Integration Point** (`/frontend/src/services/animation/frame-event-manager.ts`):
```typescript
class FrameEventManager {
  private projectileSystem: ProjectileSystem;

  triggerEvent(unit: ClientUnit, event: AnimationFrameEvent): void {
    switch (event.eventType) {
      case 'spawn_projectile':
        // Get target unit
        const target = this.getTargetUnit(unit);
        if (!target) break;

        // Spawn projectile
        this.projectileSystem.spawn({
          projectileId: generateId(),
          sourceUnitId: unit.unitId,
          targetUnitId: target.unitId,
          projectileType: event.data.projectileType || 'arrow',
          spawnPosition: unit.renderPosition, // MVP: center spawn
          targetPosition: target.renderPosition,
          velocity: event.data.velocity || 5,
          rotateToFace: event.data.rotateToFace !== false
        });
        break;

      // ... other event types
    }
  }
}
```

---

### Key Algorithms

**Algorithm 1: Projectile Movement with Target Tracking**
```typescript
function updateProjectile(
  projectile: ClientProjectile,
  deltaTime: number
): void {
  // Get current target position (may have moved)
  const target = this.getUnit(projectile.targetUnitId);
  if (!target || target.status === 'dead') {
    this.despawn(projectile);
    return;
  }

  projectile.targetPosition = target.renderPosition;

  // Calculate direction and distance
  const dx = projectile.targetPosition.x - projectile.renderPosition.x;
  const dy = projectile.targetPosition.y - projectile.renderPosition.y;
  const distance = Math.hypot(dx, dy);

  // Check for impact
  if (distance < 10) {
    this.triggerImpact(projectile);
    return;
  }

  // Move toward target
  const dirX = dx / distance;
  const dirY = dy / distance;
  const pixelsPerSec = projectile.velocity * 64; // Convert hexes/sec to pixels/sec
  const moveDistance = pixelsPerSec * deltaTime;

  projectile.renderPosition.x += dirX * moveDistance;
  projectile.renderPosition.y += dirY * moveDistance;

  // Update sprite
  projectile.sprite.position.set(
    projectile.renderPosition.x,
    projectile.renderPosition.y
  );

  // Update rotation
  if (projectile.rotateToFace) {
    projectile.sprite.rotation = Math.atan2(dy, dx);
  }
}
```

**Algorithm 2: Impact Detection with Size Scaling**
```typescript
function checkImpact(
  projectile: ClientProjectile,
  target: ClientUnit
): boolean {
  const dx = projectile.renderPosition.x - target.renderPosition.x;
  const dy = projectile.renderPosition.y - target.renderPosition.y;
  const distance = Math.hypot(dx, dy);

  // Get target size (small creatures have smaller hitbox)
  const hitboxRadius = this.getHitboxRadius(target); // 30px for medium, 20px for small, 40px for large

  return distance < hitboxRadius;
}
```

---

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ 1. ATTACK ANIMATION TRIGGERS                                │
│    - Unit plays attack animation (bow, spell cast, etc)     │
│    - Animation reaches frame 8 (release frame)              │
│    - Frame Event Manager detects frame event                │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. PROJECTILE SPAWN                                         │
│    - Frame Event Manager calls ProjectileSystem.spawn()    │
│    - Acquire sprite from object pool                        │
│    - Position at source unit center (MVP)                   │
│    - Set target to current target unit position            │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. PROJECTILE UPDATE LOOP (60 FPS)                          │
│    - Calculate direction vector to target                   │
│    - Move projectile toward target (5 hexes/sec)            │
│    - Update sprite position and rotation                    │
│    - Update trail effect position (if exists)               │
│    - Check for impact (distance < 10 pixels)                │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. IMPACT DETECTION                                         │
│    - Projectile within 10 pixels of target                  │
│    - Mark projectile as impacted                            │
│    - Trigger impact effect spawning                         │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. IMPACT EFFECT SPAWNING                                   │
│    - Get impact effect definition (explosion, spark, etc)   │
│    - Scale effect based on target creature size             │
│    - Spawn animated effect sprite at collision point        │
│    - Apply blend mode (SCREEN for fire, NORMAL for physical)│
│    - Play impact sound effect                               │
│    - Trigger screen shake (if big impact)                   │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. PROJECTILE DESPAWN                                       │
│    - Remove projectile sprite from layer                    │
│    - Remove trail effect (if exists)                        │
│    - Return sprite to object pool for reuse                 │
│    - Remove from active projectiles list                    │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. IMPACT EFFECT ANIMATION                                  │
│    - Effect plays animated frames (4-6 frames)              │
│    - Effect fades out over duration (200-400ms)             │
│    - Effect removes itself when animation completes         │
│    - Effect sprite destroyed or returned to pool            │
└─────────────────────────────────────────────────────────────┘
```

---

## Dependencies

### Depends On

- **Combat Animation Controller** (L3 - this epic): Triggers projectile spawns via frame events
- **AI-Driven Creature Stats** (L3 - this epic): Provides attack range for projectile velocity calculation
- **Effect System** (Core Rendering): Spawns impact effects (explosions, sparks)
- **Audio Manager** (Core Systems): Plays impact sounds

### Depended On By

- **Combat UI Overlays** (L3 - this epic): Visual clarity for understanding ranged attacks
- **Combat Replay System** (Post-MVP): Records projectile trajectories for replay

---

## Success Criteria

### MVP Definition of Done

**Functional**:
- [ ] Projectiles spawn from creature center at frame 8 of attack animation
- [ ] Projectiles travel smoothly toward target at 5 hexes/sec (320 pixels/sec)
- [ ] Projectiles rotate to face direction (arrows, javelins, bolts)
- [ ] Projectiles despawn on impact (within 10 pixels of target)
- [ ] Impact effects spawn at collision point (explosions, sparks, ice shatters)
- [ ] Impact effects scale based on creature size (0.7x / 1.0x / 1.3x)
- [ ] Projectile system supports 10+ projectile types (arrow, fireball, ice shard, lightning, etc)
- [ ] Object pooling reuses sprites (no memory leaks from constant creation/destruction)
- [ ] Projectiles despawn if target dies mid-flight
- [ ] Animated projectiles (fireballs, lightning) play frame animations during flight

**Non-Functional**:
- [ ] System handles 20+ simultaneous projectiles without FPS drop
- [ ] Projectile spawning adds <5ms to frame time
- [ ] Impact detection is accurate within 1 pixel
- [ ] Object pool maintains stable memory usage (no growth over time)

**Testing**:
- [ ] Unit test: Projectile movement algorithm (verify position updates)
- [ ] Unit test: Impact detection (verify collision at correct distance)
- [ ] Unit test: Rotation calculation (verify correct facing angle)
- [ ] Unit test: Object pool acquire/release (verify reuse)
- [ ] Integration test: Full projectile lifecycle (spawn → travel → impact → despawn)
- [ ] Integration test: Multiple projectiles simultaneously (performance)
- [ ] E2E test: Archer fires 10 arrows in combat, all reach targets correctly

---

## L4 Task Candidates

### Core Projectile System (5 tasks)

1. **TASK-1.1**: Create `ProjectileSystem` class with spawn/update/despawn methods
   - Implement projectile instance tracking
   - Export `ProjectileSystem` class

2. **TASK-1.2**: Implement projectile movement algorithm
   - Calculate direction vector, update position, rotate sprite
   - Handle target tracking (moving targets)

3. **TASK-1.3**: Implement impact detection
   - Distance-based collision detection
   - Handle target death during flight

4. **TASK-1.4**: Create projectile catalog configuration
   - Define 10+ projectile types with metadata
   - Export `PROJECTILE_CATALOG`

5. **TASK-1.5**: Integrate projectile spawning with frame events
   - Listen for `spawn_projectile` frame events
   - Call `ProjectileSystem.spawn()` with event data

### Impact Effects (3 tasks)

6. **TASK-2.1**: Create `ImpactEffectManager` class
   - Trigger impact effects on collision
   - Export `triggerImpact(projectile, target)`

7. **TASK-2.2**: Define impact effect definitions for each projectile type
   - Map projectile types to impact effects (arrow → spark, fireball → explosion)
   - Include blend modes and sizing

8. **TASK-2.3**: Implement creature size-based effect scaling
   - Calculate size multiplier (0.7x / 1.0x / 1.3x)
   - Apply to impact effect size

### Object Pooling (2 tasks)

9. **TASK-3.1**: Create `ProjectilePool` class with acquire/release methods
   - Implement sprite pooling for each projectile type
   - Export `ProjectilePool` class

10. **TASK-3.2**: Integrate object pooling into projectile spawn/despawn
    - Use pool for sprite acquisition
    - Return sprites to pool on despawn

### Animated Projectiles (2 tasks)

11. **TASK-4.1**: Implement animated projectile support (fireballs, lightning)
    - Create PIXI.AnimatedSprite for multi-frame projectiles
    - Handle frame animation during flight

12. **TASK-4.2**: Add projectile rotation logic
    - Rotate arrows/bolts to face direction
    - Skip rotation for spherical projectiles (fireballs)

### Trail Effects (2 tasks - Optional Polish)

13. **TASK-5.1**: Create `TrailEffectManager` class
    - Spawn trail effects behind projectiles
    - Export `createTrailEffect(projectile)`

14. **TASK-5.2**: Implement trail update and cleanup
    - Update trail position to follow projectile
    - Despawn trail when projectile impacts

### Testing (3 tasks)

15. **TASK-6.1**: Write unit tests for projectile movement
    - Test position updates, rotation, target tracking
    - Test impact detection accuracy

16. **TASK-6.2**: Write unit tests for object pooling
    - Test acquire/release cycles
    - Verify no memory leaks

17. **TASK-6.3**: Write integration test for full projectile lifecycle
    - Mock attack animation frame event
    - Verify spawn → travel → impact → despawn

---

## Metadata

- **Estimated Effort**: 2-3 weeks
- **Team Size**: 1 frontend developer
- **Priority**: HIGH (critical for ranged attack visual clarity)
- **Risks**: LOW (straightforward rendering logic)
- **Blockers**: Requires Combat Animation Controller for frame event triggers

---

*This document defines the projectile effect system for ranged attacks. Ready for L4 task implementation.*
