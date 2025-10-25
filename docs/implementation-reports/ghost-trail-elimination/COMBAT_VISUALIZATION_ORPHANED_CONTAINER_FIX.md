# Combat Visualization Fix - Orphaned Container Resolution

**Date**: 2025-10-20
**Status**: ✅ COMPLETE - Ready for Testing
**Approach**: Architectural fix - Proper PixiJS container hierarchy

---

## Executive Summary

Visual effects (health bars, damage numbers, projectiles, buff icons) were not rendering during combat despite:
- ✅ Combat simulation running correctly
- ✅ Sprite lookup working (getSpriteAt returned valid sprites)
- ✅ Effect creation code executing
- ❌ **NO visual effects appearing on screen**

**Root Cause**: The CombatVisualizationManager was being passed an **orphaned PIXI.Container** that was never added to the actual PixiJS renderer's display tree. All effect containers were being added to this invisible container.

**Resolution**: Effect containers now connect to the renderer's actual stage via `gridRenderer.getStage()`.

---

## Technical Root Cause

### The Orphaned Container Issue

```typescript
// BEFORE (in DeploymentGridDemoPage.tsx line 404-407)
vizManager = new CombatVisualizationManager(
  socketAdapter as any,
  new PIXI.Container(), // ← ORPHANED CONTAINER! Never added to visible stage
  renderer as any
);
```

**What was happening:**
1. `new PIXI.Container()` created an orphaned container (not attached to any renderer)
2. CombatVisualizationManager added effect containers to this orphaned container:
   ```typescript
   // In CombatVisualizationManager constructor (lines 112-115)
   this.stage.addChild(this.effectContainers.projectiles);
   this.stage.addChild(this.effectContainers.healthBars);
   this.stage.addChild(this.effectContainers.buffIcons);
   this.stage.addChild(this.effectContainers.damageNumbers);
   ```
3. Health bars, damage numbers, etc. were created and added to these containers
4. But the containers were in a tree **disconnected from the actual renderer**
5. Result: Effects exist in memory but never appear on screen

### Visualization of the Problem

```
BEFORE (Broken):

PixiJS Renderer Stage           Orphaned Container (invisible)
├── gridContainer               ├── projectiles (effect container)
├── highlightLayer              ├── healthBars (effect container) ← Health bars added here!
├── creatureLayer               ├── buffIcons (effect container)
└── coordinateLayer             └── damageNumbers (effect container)
    ^                               ^
    |                               |
    VISIBLE                         INVISIBLE (disconnected!)
```

```
AFTER (Fixed):

PixiJS Renderer Stage (all connected, all visible)
├── gridContainer
├── highlightLayer
├── creatureLayer
├── coordinateLayer
├── projectiles (effect container)      ← Now part of visible tree!
├── healthBars (effect container)       ← Now part of visible tree!
├── buffIcons (effect container)        ← Now part of visible tree!
└── damageNumbers (effect container)    ← Now part of visible tree!
```

---

## Solution Implementation

### Change 1: Add `getStage()` Method to HexGridRenderer

**File**: `frontend/src/components/DeploymentGrid/DeploymentGridRenderer.ts:993-999`

```typescript
/**
 * Get the PixiJS stage container
 * Used by effect renderers (CombatVisualizationManager) to add visual effect layers
 */
getStage(): PIXI.Container {
  return this.app.stage;
}
```

**Rationale**: Provides controlled access to the renderer's stage without exposing the entire `app` object. Maintains encapsulation while enabling effect layer integration.

---

### Change 2: Update CombatVisualizationManager Constructor

**File**: `frontend/src/services/combat-visualization-manager.ts:85-94`

```typescript
// BEFORE
constructor(
  socketClient: CombatSocketClient,
  stage: PIXI.Container,  // ← Accepting orphaned container
  gridRenderer: CombatGridRenderer
) {
  this.socketClient = socketClient;
  this.stage = stage;  // ← Using orphaned container
  this.gridRenderer = gridRenderer;
  ...
}

// AFTER
constructor(
  socketClient: CombatSocketClient,
  gridRenderer: CombatGridRenderer  // ← Stage parameter removed
) {
  this.socketClient = socketClient;
  this.gridRenderer = gridRenderer;
  // Get the actual PixiJS stage from the grid renderer
  // This ensures effect containers are added to the visible rendering tree
  this.stage = gridRenderer.getStage();  // ← Now using actual renderer stage!
  ...
}
```

**Rationale**: Eliminates the redundant `stage` parameter and sources it directly from the renderer. This ensures the stage is always the actual rendering tree.

---

### Change 3: Update DeploymentGridDemoPage Initialization

**File**: `frontend/src/pages/DeploymentGridDemoPage.tsx:402-407`

```typescript
// BEFORE
vizManager = new CombatVisualizationManager(
  socketAdapter as any,
  new PIXI.Container(), // ← REMOVED orphaned container
  renderer as any
);

// AFTER
vizManager = new CombatVisualizationManager(
  socketAdapter as any,
  renderer as any // Grid renderer (stage is obtained from renderer.getStage())
);
```

**Rationale**: Removes the orphaned container creation. Stage is now sourced internally from the renderer.

---

### Change 4: Update All Test Mocks

**Files**: All 5 test files in `frontend/src/services/__tests__/`

```typescript
// BEFORE
const mockGridRenderer = {
  getSpriteAt: vi.fn(),
  getActiveSprites: vi.fn(() => new Map())
};

manager = new CombatVisualizationManager(
  mockSocketClient as any,
  mockStage as any,  // ← REMOVED
  mockGridRenderer as any
);

// AFTER
const mockGridRenderer = {
  getSpriteAt: vi.fn(),
  getActiveSprites: vi.fn(() => new Map()),
  getStage: vi.fn(() => mockStage)  // ← ADDED
};

manager = new CombatVisualizationManager(
  mockSocketClient as any,
  mockGridRenderer as any  // ← Stage parameter removed
);
```

**Updated Test Files**:
1. `combat-visualization-manager.test.ts`
2. `health-bar-integration.test.ts`
3. `damage-number-integration.test.ts`
4. `projectile-integration.test.ts`
5. `buff-icon-integration.test.ts`

---

### Change 5: Fix TypeScript exactOptionalPropertyTypes Error

**File**: `frontend/src/components/CombatGrid/CombatGridRenderer.ts:152-170`

```typescript
// BEFORE
this.animatedSprites.set(hash, {
  sprite: animatedSprite,
  unitId,
  animationState,
  isPlaying: true,
  loop: animationData.loop,
  textures,
  scale: { x: animatedSprite.scale.x, y: animatedSprite.scale.y },
  x: animatedSprite.x,
  y: animatedSprite.y,
  onComplete  // ← Error: Type '(() => void) | undefined' not assignable
});

// AFTER
const spriteData: AnimatedSpriteData = {
  sprite: animatedSprite,
  unitId,
  animationState,
  isPlaying: true,
  loop: animationData.loop,
  textures,
  scale: { x: animatedSprite.scale.x, y: animatedSprite.scale.y },
  x: animatedSprite.x,
  y: animatedSprite.y
};

// Only add onComplete if defined (TypeScript exactOptionalPropertyTypes requirement)
if (onComplete) {
  spriteData.onComplete = onComplete;
}

this.animatedSprites.set(hash, spriteData);
```

**Rationale**: TypeScript's `exactOptionalPropertyTypes: true` requires optional properties to be either present with the correct type OR completely omitted. Conditionally adding the property satisfies this requirement.

---

## How This Fixes All Visual Effects

### Before Fix:
```typescript
// Effect containers existed but were invisible
effectContainers.healthBars.addChild(healthBar.container);  // Added to orphaned tree
effectContainers.damageNumbers.addChild(damageNumber);      // Added to orphaned tree
effectContainers.projectiles.addChild(projectile);          // Added to orphaned tree
effectContainers.buffIcons.addChild(buffIcon);              // Added to orphaned tree

// Result: Objects exist in memory but never rendered to screen
```

### After Fix:
```typescript
// Effect containers now part of visible rendering tree
this.stage = gridRenderer.getStage();  // this.stage is now the ACTUAL renderer stage
this.stage.addChild(this.effectContainers.healthBars);       // ✅ Visible!
this.stage.addChild(this.effectContainers.damageNumbers);    // ✅ Visible!
this.stage.addChild(this.effectContainers.projectiles);      // ✅ Visible!
this.stage.addChild(this.effectContainers.buffIcons);        // ✅ Visible!

// Effect creation code unchanged, but now renders correctly
effectContainers.healthBars.addChild(healthBar.container);   // ✅ Shows on screen!
```

---

## Files Modified

| File | Lines Changed | Purpose |
|------|---------------|---------|
| `DeploymentGridRenderer.ts` | 993-999 (added) | Add `getStage()` getter method |
| `combat-visualization-manager.ts` | 85-94 (modified) | Remove stage parameter, get from renderer |
| `DeploymentGridDemoPage.tsx` | 404-407 (modified) | Remove orphaned container creation |
| `CombatGridRenderer.ts` | 152-170 (modified) | Fix TypeScript optional property type |
| `combat-visualization-manager.test.ts` | 28-32, 56-59 (modified) | Update mocks |
| `health-bar-integration.test.ts` | 25-29, 82-85 (modified) | Update mocks |
| `damage-number-integration.test.ts` | 25-29, 82-85 (modified) | Update mocks |
| `projectile-integration.test.ts` | 25-29, 96-99 (modified) | Update mocks |
| `buff-icon-integration.test.ts` | 25-29, 109-112 (modified) | Update mocks |

**Total**: 9 files modified, ~60 lines changed

---

## Testing Checklist

### Expected Visual Behavior (After Restart):

- [ ] **Health Bars Appear**
  - Green bars above units during combat
  - Position 20px above sprite
  - Color changes: Green (>66%) → Yellow (33-66%) → Red (<33%)
  - Fade out 3 seconds after combat ends

- [ ] **Damage Numbers Float Up**
  - Red numbers appear when damage occurs
  - Float upward 40px over 1 second
  - Fade out after 0.6 seconds
  - Stagger if overlapping

- [ ] **Projectiles Fly** (if ranged attacks present)
  - Spawn from attacker position
  - Travel toward target
  - Impact animation on arrival

- [ ] **Buff Icons Display** (if buffs/debuffs present)
  - Icons appear 30px above units
  - Show duration countdown
  - Grid layout (2x4, max 8 visible)

### Console Log Verification:

Before fix:
```
[CombatVisualizationManager] Sprite position for player1_xxx: {x: 562.68, y: 352.84}
[DeploymentDemo] ===== COMBAT STATE UPDATE =====  ← Logs jumped here (no effect creation)
```

After fix (expected):
```
[CombatVisualizationManager] Sprite position for player1_xxx: {x: 562.68, y: 352.84}
[CombatVisualizationManager] DEBUG: About to calculate position object...
[CombatVisualizationManager] DEBUG: Position calculated: {x: 562.68, y: 332.84}
[CombatVisualizationManager] DEBUG: Creating new health bar...
[CombatVisualizationManager] DEBUG: Health bar created: {...}
[CombatVisualizationManager] DEBUG: Health bar added successfully
```

---

## Verification Steps

1. **Restart both servers**:
   ```bash
   # Backend
   cd backend && pnpm dev

   # Frontend
   cd frontend && pnpm dev
   ```

2. **Open deployment demo**:
   ```
   http://localhost:5175/deployment-grid
   ```

3. **Deploy creatures**:
   - Open Player 2 window (click button)
   - Drag creatures onto grid in both windows
   - Click "Ready" for both players

4. **Observe combat**:
   - Health bars should appear above units
   - Damage numbers should float up when hits occur
   - Projectiles should fly (if ranged attackers present)
   - Buff icons should appear (if buffs applied)

5. **Check console logs**:
   - Should see DEBUG logs showing effect creation
   - No "undefined" warnings for sprite lookup
   - Logs should show full execution through effect creation

---

## Architectural Impact

### Positive Changes:
- ✅ **Proper container hierarchy**: Effects now part of visible rendering tree
- ✅ **Reduced API surface**: Eliminated redundant `stage` parameter
- ✅ **Clearer ownership**: Stage is clearly owned by renderer, accessed via getter
- ✅ **Better encapsulation**: Renderer controls access to its stage
- ✅ **No workarounds**: Clean OOP solution following class hierarchy

### No Breaking Changes:
- ✅ Existing deployment rendering unchanged
- ✅ Grid rendering unchanged
- ✅ Sprite storage/lookup unchanged
- ✅ Test coverage maintained (all mocks updated)

---

## Alignment with L2 Epic Vision

From `/docs/specs/L2-EPICS/battle-engine/client-rendering-animation-sync.md`:

**Epic Goal**: "Implement the client-side battlefield renderer using PixiJS that receives authoritative server state updates and renders smooth 60fps combat with synchronized creature animations, projectile effects, impact visuals, and UI overlays."

**This Fix Enables**:
- ✅ **Projectile rendering** - Now visible on screen
- ✅ **Impact visuals** - Damage numbers can render
- ✅ **UI overlays** - Health bars, buff icons can display
- ✅ **Synchronized effects** - All effects now part of render loop

**Fidelity to Vision**: This is a proper architectural fix, not a workaround. The container hierarchy now correctly reflects the design intent: all visual elements are children of the renderer's stage.

---

## Next Steps

After verifying visual effects render:

1. **Remove debug logging** (Optional)
   - Clean up excessive DEBUG logs in `combat-visualization-manager.ts`
   - Keep key diagnostic logs for troubleshooting

2. **Performance validation**
   - Monitor FPS during large battles (20+ units)
   - Profile PixiJS render calls
   - Ensure 60 FPS target maintained

3. **Migrate to animated sprites** (Next major feature)
   - Replace static sprites with animated sprite rendering
   - Hook up UnitAnimationStateMachine (180 tests ready)
   - Enable walk/attack/cast animations

4. **Add position interpolation**
   - Integrate PositionInterpolator (21 tests ready)
   - Smooth movement at 60 FPS
   - Eliminate teleporting

---

## Debug Logging Added (For Troubleshooting)

If visual effects still don't appear after this fix, the comprehensive debug logs in `manageHealthBars()` (lines 478-499) will show:
- Position calculation
- Map size and lookup
- Health bar creation
- Container attachment

This will help identify any remaining issues with the render pipeline.

---

## RESOLVED: Double Positioning Bug

**Date**: 2025-10-21
**Status**: ✅ RESOLVED
**File**: `frontend/src/components/CombatGrid/CombatGridRenderer.ts`

### Problem
Animated sprites were being positioned twice, causing them to render off-screen. Only team glow circles were visible; creature sprites were invisible.

### Root Cause
In `renderAnimatedCreature()` method:
1. **Line 143-144**: Sprite positioned directly at pixel coordinates
   ```typescript
   animatedSprite.x = pixel.x;
   animatedSprite.y = pixel.y;
   ```
2. **Line 155-156**: Container (parent of sprite) also positioned at pixel coordinates
   ```typescript
   spriteContainer.x = pixel.x;
   spriteContainer.y = pixel.y;
   ```

**Result**: Sprite rendered at `(pixel.x + pixel.x, pixel.y + pixel.y)` - double the intended position, placing it off-screen.

### Solution
Removed direct sprite positioning. Sprite now positioned at `(0, 0)` relative to its container, which is positioned at the hex coordinates.

**Changes**:
- Removed lines 143-144 (direct sprite positioning)
- Kept lines 155-156 (container positioning)
- Sprite now correctly renders at container's position

### Verification
- Creature sprites now visible at correct hex positions
- Team glow circles and sprites both render correctly
- No visual displacement or off-screen rendering

---

**Status**: Implementation complete. Ready for browser testing.
