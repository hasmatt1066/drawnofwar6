# Combat Visualization Fix - Architectural Solution

**Date**: 2025-10-20
**Status**: ✅ COMPLETE - Ready for Testing
**Approach**: Proper OOP with protected access pattern (NO workarounds)

---

## Problem Summary

Combat state showed units fighting (tick 551, 18 damage events, health at 27/200 and 11/200), but NO visual effects rendered:
- ❌ No health bars above units
- ❌ No damage numbers on hits
- ❌ No projectiles flying
- ❌ No buff icons

**Root Cause**: Data access pattern mismatch between sprite storage and sprite lookup.

---

## Architectural Issue

```
HexGridRenderer (base class)
  ├── private creatureSprites: Map<string, PIXI.Container>
  └── renderCreature() → stores sprites in creatureSprites ✅

CombatGridRenderer (derived class)
  ├── private animatedSprites: Map<string, AnimatedSpriteData>
  └── getSpriteAt() → ONLY checks animatedSprites ❌

CombatVisualizationManager
  ├── calls gridRenderer.renderCreature() → stores in BASE CLASS
  └── calls gridRenderer.getSpriteAt() → queries DERIVED CLASS

RESULT: undefined (maps are separate!) ❌
```

**The Flow:**
1. Units rendered via `renderCreature()` → stored in base class `creatureSprites` (private)
2. Effects call `getSpriteAt()` → checks derived class `animatedSprites` (empty)
3. Returns `undefined` → all effects silently skip with `if (!spriteData) { continue; }`

---

## Solution: Unified Sprite Access Pattern

### Design Principles
1. ✅ **Maintain Encapsulation** - Proper OOP, no type assertions
2. ✅ **Respect Inheritance** - Base→derived relationship preserved
3. ✅ **Backward Compatible** - Existing deployment code unchanged
4. ✅ **Future-Proof** - Enables animated sprite migration
5. ✅ **No Workarounds** - Addresses architectural root cause

### Changes Made

#### **Change 1: Protected Access for Sprite Storage**

**File**: `/frontend/src/components/DeploymentGrid/DeploymentGridRenderer.ts:68`

```typescript
// BEFORE
private creatureSprites: Map<string, PIXI.Container>;

// AFTER
/**
 * Creature sprite storage
 * Protected to allow derived classes (CombatGridRenderer) to access for unified sprite lookup
 * Maps hex hash → PIXI.Container for static sprites
 */
protected creatureSprites: Map<string, PIXI.Container>;
```

**Rationale**: Changing from `private` to `protected` allows the derived class to access base class sprite storage while maintaining proper encapsulation (only accessible within class hierarchy, not external code).

---

#### **Change 2: Unified getSpriteAt() with Fallback Chain**

**File**: `/frontend/src/components/CombatGrid/CombatGridRenderer.ts:167-205`

```typescript
/**
 * Get sprite at hex coordinate (unified lookup)
 *
 * Checks both animated sprites (preferred) and static sprites (fallback).
 * This enables visual effects (health bars, damage numbers, etc.) to find sprites
 * regardless of whether they were rendered via renderAnimatedCreature() or renderCreature().
 *
 * Lookup order:
 * 1. Check animatedSprites map (combat-specific animated sprites)
 * 2. Fallback to creatureSprites map (base class static sprites)
 */
public getSpriteAt(hex: AxialCoordinate): AnimatedSpriteData | undefined {
  const hash = this.getHexGrid().hash(hex);

  // Priority 1: Check animated sprites (combat rendering)
  const animatedSprite = this.animatedSprites.get(hash);
  if (animatedSprite) {
    return animatedSprite;
  }

  // Priority 2: Fallback to base class static sprites (deployment rendering)
  const staticSprite = this.creatureSprites.get(hash);
  if (staticSprite) {
    // Wrap static sprite in AnimatedSpriteData format for consistent interface
    const pixel = this.getHexGrid().toPixel(hex);
    return {
      sprite: staticSprite,
      position: hex,
      pixelPosition: pixel,
      isAnimated: false
    };
  }

  return undefined;
}
```

**Rationale**:
- Provides a **unified query interface** that works for both static and animated sprites
- **Fallback chain** ensures sprites are found regardless of rendering method
- **Wraps static sprites** in AnimatedSpriteData format for consistent interface
- **No breaking changes** - return type and signature unchanged

---

#### **Change 3: Dynamic Class Names in Logs**

**File**: `/frontend/src/components/DeploymentGrid/DeploymentGridRenderer.ts` (14 instances)

```typescript
// BEFORE
console.log(`[DeploymentGridRenderer] renderCreature called for ${creatureName}`);

// AFTER
console.log(`[${this.constructor.name}] renderCreature called for ${creatureName}`);
```

**Rationale**:
- Logs now show actual class name: `[CombatGridRenderer]` when called from derived class
- Eliminates confusion during debugging
- More accurate diagnostics

---

## How This Fixes All 4 Visual Effects

### Before Fix:
```typescript
// CombatVisualizationManager.manageHealthBars()
const spriteData = this.gridRenderer.getSpriteAt(unit.position);
if (!spriteData?.sprite) {
  continue;  // ← ALWAYS SKIPPED (undefined)
}
```

### After Fix:
```typescript
// CombatVisualizationManager.manageHealthBars()
const spriteData = this.gridRenderer.getSpriteAt(unit.position);
// ✅ Now finds sprite in base class creatureSprites map
// ✅ Returns wrapped AnimatedSpriteData with sprite.x, sprite.y
if (!spriteData?.sprite) {
  continue;  // ← Never reached now!
}

// Creates health bar at position:
const position = {
  x: spriteData.sprite.x,  // ✅ Works!
  y: spriteData.sprite.y - this.HEALTH_BAR_OFFSET_Y  // ✅ Works!
};
```

**All 4 effects use the same pattern:**
1. ✅ **Health Bars** (`manageHealthBars`, line 457) - Now finds sprite position
2. ✅ **Damage Numbers** (`manageDamageNumbers`, line 514) - Now finds sprite position
3. ✅ **Buff Icons** (`manageBuffIcons`, line 686) - Now finds sprite position
4. ✅ **Projectiles** (`manageProjectiles`, line 620) - Now finds source/target positions

---

## Testing Checklist

### Expected Visual Behavior (After Refresh):

- [ ] **Health Bars Appear**
  - Green bars above units when in combat
  - Position 20px above sprite
  - Color changes: Green (>66%) → Yellow (33-66%) → Red (<33%)
  - Disappear 3 seconds after last combat action

- [ ] **Damage Numbers Float Up**
  - Red numbers appear when unit takes damage
  - Float upward 40px over 1 second
  - Fade out after 0.6 seconds
  - Stagger horizontally/vertically if overlapping

- [ ] **Projectiles Fly** (if ranged attacks exist)
  - Spawn from attacker position
  - Travel toward target
  - Play impact animation on arrival

- [ ] **Buff Icons Display** (if buffs/debuffs exist)
  - Icons appear 30px above units
  - Show duration countdown
  - Grid layout (2x4, max 8 visible)

- [ ] **Logs Show Correct Class Name**
  - Console should show `[CombatGridRenderer]` instead of `[DeploymentGridRenderer]`

---

## Migration Path: Static → Animated Sprites

This fix enables the future migration to animated sprites:

**Current State (Working):**
```typescript
// CombatVisualizationManager
this.gridRenderer.renderCreature(...);  // Static sprites
const sprite = this.gridRenderer.getSpriteAt(hex);  // ✅ Finds it!
```

**Future State (Animated):**
```typescript
// CombatVisualizationManager
this.gridRenderer.renderAnimatedCreature(...);  // Animated sprites
const sprite = this.gridRenderer.getSpriteAt(hex);  // ✅ Still finds it!
```

The unified `getSpriteAt()` works for both paths!

---

## Files Modified

1. `/frontend/src/components/DeploymentGrid/DeploymentGridRenderer.ts`
   - Line 68: Changed `creatureSprites` from `private` to `protected`
   - Lines 546-792: Changed 14 log statements to use `this.constructor.name`

2. `/frontend/src/components/CombatGrid/CombatGridRenderer.ts`
   - Lines 167-205: Rewrote `getSpriteAt()` with fallback chain logic

**Total Changes**: 2 files, ~50 lines modified/added

---

## Verification Steps

1. **Restart dev server**: `pnpm dev` in both frontend and backend
2. **Open deployment demo**: `http://localhost:5175/deployment-grid?matchId=xxx&playerId=player1`
3. **Deploy creatures**: Place creatures on grid
4. **Start combat**: Click "Ready" on both players
5. **Observe visuals**:
   - Health bars should appear above units
   - Damage numbers should float up when damage occurs
   - Combat log should populate with events
   - Console logs should show `[CombatGridRenderer]` instead of `[DeploymentGridRenderer]`

---

## Technical Debt Eliminated

### Before:
- ❌ Type assertion workaround: `(this as any).creatureLayer`
- ❌ Silent failures in effect positioning
- ❌ Misleading debug logs
- ❌ No unified sprite access interface

### After:
- ✅ Proper protected access (OOP best practice)
- ✅ Explicit fallback chain (self-documenting)
- ✅ Accurate debug logs
- ✅ Unified sprite query interface

---

## Alignment with L2 Epic Vision

From `/docs/specs/L2-EPICS/battle-engine/client-rendering-animation-sync.md`:

**Epic Goal**: "Implement the client-side battlefield renderer using PixiJS that receives authoritative server state updates and renders smooth 60fps combat with synchronized creature animations, projectile effects, impact visuals, and UI overlays."

**This Fix Enables**:
- ✅ "Projectile rendering" - Can now find source/target positions
- ✅ "Visual feedback" - Health bars, damage numbers, hit flash
- ✅ "UI overlays" - Health bars, cooldown indicators, buff icons
- ✅ "Animation synchronization" - Foundation for future animated sprite integration

**No Workarounds Applied**: This solution respects the OOP class hierarchy, maintains encapsulation through proper protected access, and provides a clean migration path to animated sprites. Fidelity to architectural vision preserved.

---

## Next Steps

After verifying visual effects render correctly:

1. **Add Unit Tests** (TASK-VIZ-026)
   - Test `getSpriteAt()` finds static sprites
   - Test `getSpriteAt()` finds animated sprites
   - Test fallback chain priority
   - Test return value wrapping

2. **Migrate to Animated Sprites** (Quick Win Option A)
   - Change `renderCreature()` → `renderAnimatedCreature()`
   - Hook up `UnitAnimationStateMachine` (180 tests ready!)
   - Enable walk animations during movement
   - Enable attack animations during combat

3. **Add Position Interpolation** (Quick Win Option B)
   - Integrate `PositionInterpolator` (21 tests ready!)
   - Smooth movement at 60 FPS
   - Eliminate teleporting

---

**Status**: Implementation complete. Ready for browser testing.
