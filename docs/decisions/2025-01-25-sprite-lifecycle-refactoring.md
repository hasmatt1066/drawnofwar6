# Technical Design: Sprite Lifecycle Refactoring

## Problem Statement

Current combat visualization creates NEW containers with sprites on every combat tick (~10 Hz), causing:
1. **Ghost Trail Bug**: Orphaned containers accumulate on stage (not cleaned up)
2. **Performance Issues**: 10+ object allocations per second per unit
3. **GC Spikes**: Constant create/destroy triggers garbage collection
4. **Violates Best Practices**: Game development standards recommend object pooling and in-place updates

## Current Architecture (BROKEN)

```typescript
// CombatGridRenderer.ts - renderAnimatedCreature()
Every combat tick (10 Hz):
  1. Create new PIXI.Container()
  2. Create new PIXI.Graphics (glow effect)
  3. Create new PIXI.AnimatedSprite(textures)
  4. Add container to stage
  5. Store ONLY sprite in Map (missing container!)
  6. On cleanup: Remove sprite from container
  7. Result: Container stays on stage (ghost trail)
```

**Evidence**:
- `/screenshots/visualizationcheck.png` shows multiple overlapping sprites
- Console logs show continuous sprite creation every 200ms

## Proposed Architecture (FIXED)

### Core Principle: Create Once, Update Many, Destroy Once

```typescript
Lifecycle:
  Unit Spawns → Create container+sprite ONCE
  Combat Ticks → UPDATE position & animation
  Unit Dies → Destroy container+sprite ONCE
```

### Component Changes

#### 1. AnimatedSpriteData Interface Extension

**Location**: `DeploymentGridRenderer.ts:25-36`

```typescript
interface AnimatedSpriteData {
  container: PIXI.Container;  // ← ADD: Store container reference
  sprite: PIXI.AnimatedSprite;
  unitId: string;
  animationState: AnimationState;
  isPlaying: boolean;
  loop: boolean;
  textures: PIXI.Texture[];
  scale: { x: number; y: number };
  x: number;
  y: number;
  onComplete?: () => void;
}
```

#### 2. New Update Methods

**Location**: `CombatGridRenderer.ts`

```typescript
/**
 * Update sprite position without recreating
 */
private updateSpritePosition(
  spriteData: AnimatedSpriteData,
  hex: AxialCoordinate
): void {
  // Calculate new position
  const bounds = this.calculateGridBoundsPublic();
  const isIsometric = this.getHexGrid().getConfig().projection === 'isometric';
  const verticalBias = isIsometric ? 50 : 0;
  const offsetX = (this.getCanvas().width - bounds.width) / 2 - bounds.minX;
  const offsetY = (this.getCanvas().height - bounds.height) / 2 - bounds.minY + verticalBias;
  const pixel = this.getHexGrid().toPixel(hex);

  // Update container position (moves sprite + glow together)
  spriteData.container.x = pixel.x + offsetX;
  spriteData.container.y = pixel.y + offsetY;
}

/**
 * Update sprite animation state without recreating
 */
private async updateSpriteAnimation(
  spriteData: AnimatedSpriteData,
  newAnimationState: AnimationState,
  animationData: AnimationData
): Promise<void> {
  // Load new textures if needed
  const newTextures = await Promise.all(
    animationData.frames.map(frame => PIXI.Assets.load(frame))
  );

  // Stop current animation
  spriteData.sprite.stop();

  // Update sprite textures
  spriteData.sprite.textures = newTextures;
  spriteData.sprite.animationSpeed = animationData.frameDuration / 1000 * 0.06;
  spriteData.sprite.loop = animationData.loop;

  // Update mirroring if changed
  const currentScale = spriteData.sprite.scale.x;
  const shouldMirror = animationData.shouldMirror;
  const isMirrored = currentScale < 0;

  if (shouldMirror !== isMirrored) {
    spriteData.sprite.scale.x *= -1;
  }

  // Update stored state
  spriteData.animationState = newAnimationState;
  spriteData.textures = newTextures;
  spriteData.loop = animationData.loop;

  // Restart animation
  spriteData.sprite.play();
}
```

#### 3. Refactored renderAnimatedCreature

**Location**: `CombatGridRenderer.ts:58-172`

```typescript
public async renderAnimatedCreature(
  hex: AxialCoordinate,
  unitId: string,
  playerId: 'player1' | 'player2',
  animationState: AnimationState,
  animationData: AnimationData
): Promise<void> {
  // Validate inputs
  if (!animationData.frames || animationData.frames.length === 0) {
    throw new Error('Animation data must have at least one frame');
  }

  const hash = this.getHexGrid().hash(hex);

  // CHECK IF SPRITE ALREADY EXISTS
  const existingSpriteData = this.animatedSprites.get(hash);

  if (existingSpriteData) {
    // Unit already exists at this position - UPDATE IN PLACE

    // Update animation if state changed
    if (existingSpriteData.animationState !== animationState) {
      await this.updateSpriteAnimation(existingSpriteData, animationState, animationData);
    }

    // Update position (handles interpolation)
    this.updateSpritePosition(existingSpriteData, hex);

    return; // ← EXIT: No creation/destruction needed!
  }

  // SPRITE DOESN'T EXIST - CREATE NEW

  // Allow off-grid coordinates for spawn-to-battle
  const isOffGrid = !this.getHexGrid().isValid(hex);
  if (isOffGrid) {
    console.log('[CombatGridRenderer] Rendering at off-grid position (spawn-to-battle):', {
      unitId,
      hex,
      animationState
    });
  }

  // Load textures
  const textures = await Promise.all(
    animationData.frames.map(frame => PIXI.Assets.load(frame))
  );

  // Calculate position
  const bounds = this.calculateGridBoundsPublic();
  const isIsometric = this.getHexGrid().getConfig().projection === 'isometric';
  const verticalBias = isIsometric ? 50 : 0;
  const offsetX = (this.getCanvas().width - bounds.width) / 2 - bounds.minX;
  const offsetY = (this.getCanvas().height - bounds.height) / 2 - bounds.minY + verticalBias;
  const pixel = this.getHexGrid().toPixel(hex);

  // Create animated sprite
  const animatedSprite = new PIXI.AnimatedSprite(textures);
  animatedSprite.animationSpeed = animationData.frameDuration / 1000 * 0.06;
  animatedSprite.loop = animationData.loop;
  animatedSprite.anchor.set(0.5);

  // Scale sprite to fit hex
  const targetSize = this.getHexGrid().hexSize * 1.2;
  const baseScale = Math.min(
    targetSize / textures[0].width,
    targetSize / textures[0].height
  );

  // Apply mirroring if needed
  if (animationData.shouldMirror) {
    animatedSprite.scale.set(-baseScale, baseScale);
  } else {
    animatedSprite.scale.set(baseScale, baseScale);
  }

  // Add team color glow
  const container = new PIXI.Container();
  const glow = new PIXI.Graphics();
  const glowColor = playerId === 'player1' ? 0x3498db : 0xe74c3c;
  glow.circle(0, 0, this.getHexGrid().hexSize * 0.65);
  glow.fill({ color: glowColor, alpha: 0.2 });
  container.addChild(glow);
  container.addChild(animatedSprite);

  // Position container
  container.x = pixel.x + offsetX;
  container.y = pixel.y + offsetY;

  // Setup animation completion handler for non-looping animations
  let onComplete: (() => void) | undefined;
  if (!animationData.loop) {
    onComplete = () => {
      this.triggerAnimationComplete({
        unitId,
        animationState
      });
    };
    animatedSprite.onComplete = onComplete;
  }

  // Add to stage
  this.getCreatureLayer().addChild(container);

  // Start playing
  animatedSprite.play();

  // Store BOTH sprite AND container
  this.animatedSprites.set(hash, {
    container,        // ← NOW STORED!
    sprite: animatedSprite,
    unitId,
    animationState,
    isPlaying: true,
    loop: animationData.loop,
    textures,
    scale: { x: animatedSprite.scale.x, y: animatedSprite.scale.y },
    x: container.x,
    y: container.y,
    onComplete
  });
}
```

#### 4. Fixed Cleanup Method

**Location**: `CombatGridRenderer.ts:255-269`

```typescript
private destroyAnimatedSprite(spriteData: AnimatedSpriteData): void {
  // Stop animation
  spriteData.sprite.stop();

  // Remove container from stage (not just sprite from container!)
  if (spriteData.container.parent) {
    spriteData.container.parent.removeChild(spriteData.container);
  }

  // Destroy container (which destroys children including sprite)
  spriteData.container.destroy({
    children: true,
    texture: false,  // Don't destroy shared textures
    textureSource: false
  });
}
```

## Data Flow Analysis

### Before (Broken)
```
Combat Tick → Create Container → Create Sprite → Add to Stage
    ↓
Store Sprite in Map (container reference lost!)
    ↓
Next Tick → Create NEW Container → Create NEW Sprite → Add to Stage
    ↓
Cleanup → Remove sprite from old container
    ↓
Result: Old container orphaned on stage (ghost trail)
```

### After (Fixed)
```
Unit Spawns → Create Container → Create Sprite → Add to Stage
    ↓
Store BOTH container + sprite in Map
    ↓
Combat Tick → Check if exists → UPDATE position
    ↓
Combat Tick → Check if animation changed → UPDATE textures
    ↓
Unit Dies → Remove container from stage → Destroy all
    ↓
Result: Single sprite per unit, smooth movement, no leaks
```

## Performance Impact

### Current (Broken)
- **Allocations**: 10 containers + 10 sprites per second per unit
- **With 10 units**: 100+ object allocations per second
- **GC Pressure**: High (constant create/destroy)
- **Memory Leak**: Orphaned containers accumulate forever

### Proposed (Fixed)
- **Allocations**: 1 container + 1 sprite per unit (only on spawn)
- **With 10 units**: 10 total allocations (one-time)
- **Updates**: Property updates (negligible cost)
- **GC Pressure**: Low (only on unit death)
- **Memory Leak**: None (proper cleanup)

**Estimated Performance Improvement**: 90% reduction in allocations

## Integration Points

### Affected Components
1. **CombatGridRenderer**: Primary changes
2. **DeploymentGridRenderer**: Interface update
3. **CombatVisualizationManager**: No changes needed (uses same API)
4. **PositionInterpolator**: No changes needed
5. **UnitAnimationStateMachine**: No changes needed

### API Compatibility
- ✅ Public API unchanged (`renderAnimatedCreature` signature same)
- ✅ Existing callers work without modification
- ✅ Backward compatible

## Risk Assessment

### Low Risk
- ✅ Public API unchanged
- ✅ Internal refactoring only
- ✅ Well-established pattern (object pooling)
- ✅ Testable changes

### Potential Issues
1. **Animation Texture Loading**: Multiple calls to `PIXI.Assets.load()` for same texture
   - **Mitigation**: PixiJS caches loaded assets automatically

2. **Position Update Frequency**: Called every combat tick
   - **Mitigation**: Simple property updates are very fast

3. **Animation State Transitions**: Swapping textures on existing sprite
   - **Mitigation**: Standard PixiJS pattern, well-supported

## Testing Strategy

### Unit Tests
```typescript
describe('CombatGridRenderer Lifecycle', () => {
  it('should create sprite only once for persistent unit', async () => {
    // Render at position A
    await renderer.renderAnimatedCreature(hexA, 'unit1', 'player1', 'IDLE', idleAnim);
    const initialSprite = renderer.getSpriteAt(hexA);

    // Render again at same position (simulating combat tick)
    await renderer.renderAnimatedCreature(hexA, 'unit1', 'player1', 'IDLE', idleAnim);
    const updatedSprite = renderer.getSpriteAt(hexA);

    // Should be SAME sprite instance
    expect(updatedSprite.sprite).toBe(initialSprite.sprite);
    expect(updatedSprite.container).toBe(initialSprite.container);
  });

  it('should update position without recreating sprite', async () => {
    // Render at position A
    await renderer.renderAnimatedCreature(hexA, 'unit1', 'player1', 'IDLE', idleAnim);
    const initialSprite = renderer.getSpriteAt(hexA);

    // Move to position B
    await renderer.renderAnimatedCreature(hexB, 'unit1', 'player1', 'IDLE', idleAnim);
    const movedSprite = renderer.getSpriteAt(hexB);

    // Should be SAME sprite instance at new position
    expect(movedSprite.sprite).toBe(initialSprite.sprite);
    expect(movedSprite.container.x).not.toBe(initialSprite.container.x);
  });

  it('should update animation without recreating sprite', async () => {
    await renderer.renderAnimatedCreature(hexA, 'unit1', 'player1', 'IDLE', idleAnim);
    const idleSprite = renderer.getSpriteAt(hexA);

    // Change to attack animation
    await renderer.renderAnimatedCreature(hexA, 'unit1', 'player1', 'ATTACK', attackAnim);
    const attackSprite = renderer.getSpriteAt(hexA);

    // Should be SAME sprite instance with new textures
    expect(attackSprite.sprite).toBe(idleSprite.sprite);
    expect(attackSprite.animationState).toBe('ATTACK');
  });

  it('should properly clean up containers on removal', () => {
    await renderer.renderAnimatedCreature(hexA, 'unit1', 'player1', 'IDLE', idleAnim);
    const creatureLayer = renderer.getCreatureLayer();
    const initialChildCount = creatureLayer.children.length;

    // Remove creature
    renderer.removeCreature(hexA);

    // Container should be removed from stage
    expect(creatureLayer.children.length).toBe(initialChildCount - 1);
    expect(renderer.getSpriteAt(hexA)).toBeUndefined();
  });
});
```

### Integration Tests
1. **Combat Simulation**: Run full combat with 10 units
   - Verify no ghost trails
   - Verify smooth movement
   - Monitor memory usage (no growth)

2. **Stress Test**: 100 units moving simultaneously
   - Verify 60 FPS maintained
   - Verify no GC spikes

## Rollout Plan

1. **Phase 1**: Update interface and add helper methods
2. **Phase 2**: Refactor renderAnimatedCreature with update-in-place logic
3. **Phase 3**: Fix cleanup method to remove containers
4. **Phase 4**: Add comprehensive tests
5. **Phase 5**: Visual validation in browser

## Success Criteria

- ✅ No ghost trails visible in combat
- ✅ Single sprite per unit on screen
- ✅ Smooth movement across battlefield
- ✅ No memory leaks (container count stable)
- ✅ 60 FPS maintained with 10+ units
- ✅ All tests passing

## References

- Game Programming Patterns: Object Pool (https://gameprogrammingpatterns.com/object-pool.html)
- PixiJS Performance Tips (https://pixijs.com/8.x/guides/concepts/performance-tips)
- Research: Object pooling preferred over create/destroy for frequent operations
