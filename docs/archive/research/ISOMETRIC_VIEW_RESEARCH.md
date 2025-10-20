# Isometric View Research & Implementation Plan

**Date**: October 3, 2025
**Status**: ✅ COMPLETE - UI Testing Tool Implemented & Ready
**Goal**: Generate creatures in multiple view angles for battlefield placement

---

## Research Summary

### PixelLab API Camera/View Options

✅ **Documented View Parameters** (from https://www.pixellab.ai/docs/options/camera):

#### View Options
| Value | Description | Angle | Best For |
|-------|-------------|-------|----------|
| `"none"` | No specific view guidance | N/A | Let AI decide |
| `"side"` | Sidescroller view | Profile (90°) | Menus, galleries, portraits |
| `"low top-down"` | Looking down | ~20° | Slight overhead, RTS-style |
| `"high top-down"` | Looking down | ~35° | More overhead, traditional isometric |

#### Direction Options
| Value | Description | Visual |
|-------|-------------|--------|
| `"none"` | No specific direction | Let AI decide |
| `"north"` | Facing away from camera | Back view |
| `"south"` | Facing the camera | Front view |
| `"east"` | Facing right | Right profile |
| `"west"` | Facing left | Left profile |

**Note**: PixelLab docs state these controls are "quite weak" and suggest using init image or descriptive keywords for better results.

---

## Current Implementation

### What We Generate Now
```typescript
// Single view generation
POST /generate-image-pixflux
{
  description: "fierce dragon warrior",
  size: 64,
  view: "side",        // Profile view for menus
  direction: "east"    // Facing right
}

// Then animate
POST /animate-with-text
{
  action: "walk cycle",
  referenceImage: <side view sprite>,
  nFrames: 4,
  view: "side"
}
```

**Result**:
- Perfect for: Character select, galleries, portraits
- Problem: Doesn't work on isometric battlefield

---

## Proposed Solution: Dual-View Generation

### Strategy

Generate **two views** of the same creature:

1. **Side View** (Menu/Gallery) - Current system
   - View: `"side"`
   - Animation: Static (no walk cycle needed for portraits)
   - Cost: $0.02
   - Use: Menus, character select, post-battle gallery

2. **Isometric View** (Battlefield)
   - View: `"low top-down"` or `"high top-down"` (test both)
   - Animation: 4-frame walk cycle
   - Cost: $0.04 ($0.02 sprite + $0.02 animation)
   - Use: Real-time battlefield movement and combat

**Total Cost**: $0.06 per creature (50% increase, but necessary for gameplay)

---

## Implementation Plan

### Phase 1: View Angle Testing (READY TO RUN)

**Script Created**: `/backend/src/scripts/test-view-angles.ts`

**What It Does**:
```
1. Generates same creature ("fierce red dragon warrior") in 3 views:
   - side (baseline)
   - low top-down (~20° angle)
   - high top-down (~35° angle)

2. Animates each with 4-frame walk cycle

3. Saves all sprites + frames to:
   test-output/view-angles/{timestamp}/
   ├── side_base.png
   ├── side_frame-0.png
   ├── side_frame-1.png
   ├── side_frame-2.png
   ├── side_frame-3.png
   ├── low-top-down_base.png
   ├── low-top-down_frame-0.png
   ├── ...
   ├── high-top-down_base.png
   ├── high-top-down_frame-0.png
   ├── ...
   └── comparison-report.json

4. Generates comparison report with costs/timing
```

**To Run**:
```bash
cd backend
npx tsx src/scripts/test-view-angles.ts
```

**Expected Time**: ~80 seconds (3 views × ~27s each)
**Expected Cost**: ~$0.12 ($0.04 × 3 views)

**Decision Criteria**:
- Visual quality per view
- Walk animation clarity
- Suitability for isometric battlefield
- Which angle looks most "game-like"

---

### Phase 2: Multi-Directional Walk Testing

Once we choose the best isometric view angle, test multi-directional animations:

#### Option A: Single Direction + Sprite Flipping
```
Generate: Walk cycle facing one direction (e.g., "south")
In-game: Flip/rotate sprite for other directions
Pros: Cheapest ($0.04 per creature)
Cons: May look unnatural for asymmetric creatures
```

#### Option B: 4-Directional Walk Cycles
```
Generate 4 walk cycles:
- north (walking away)
- south (walking toward)
- east (walking right)
- west (walking left)

Cost: $0.02 (base) + ($0.02 × 4 animations) = $0.10
Pros: More natural movement
Cons: 2.5x more expensive than single direction
```

#### Option C: 8-Directional Walk Cycles (Overkill?)
```
Generate 8 walk cycles for all diagonals
Cost: $0.02 + ($0.02 × 8) = $0.18
Pros: Smoothest movement
Cons: 4.5x cost increase, may be unnecessary
```

**Recommendation**: Start with Option A (single + flipping), upgrade to Option B if visual quality demands it.

---

### Phase 3: Style Consistency Strategy

**Problem**: Generating the same creature from two different angles risks visual inconsistency.

**Solutions**:

#### Solution 1: Reference Image Approach
```typescript
// Step 1: Generate side view (menu portrait)
const sideView = await generateSprite({
  description: "fierce dragon warrior",
  view: "side"
});

// Step 2: Generate isometric view using side view as reference
const isometricView = await generateSprite({
  description: "same creature as reference, from isometric angle",
  view: "high top-down",
  init_image: sideView.imageBase64,        // Guide generation
  init_image_strength: 0.5                 // Balance between reference and prompt
});
```

**Pros**: PixelLab can see the side view colors/style and match them
**Cons**: May constrain generation too much (init_image_strength tuning required)

#### Solution 2: Claude Vision Analysis
```typescript
// Step 1: Generate side view
const sideView = await generateSprite({
  description: "fierce dragon warrior",
  view: "side"
});

// Step 2: Analyze side view with Claude Vision
const analysis = await claudeVision.analyze(sideView.imageBase64);
// Returns: {
//   colors: ["red", "orange", "yellow"],
//   features: ["wings", "horns", "scales"],
//   styleKeywords: ["detailed shading", "pixel art"]
// }

// Step 3: Generate isometric view with enriched prompt
const isometricView = await generateSprite({
  description: `fierce dragon warrior with ${analysis.features.join(", ")}.
                Colors: ${analysis.colors.join(", ")}.
                ${analysis.styleKeywords.join(", ")}.
                Isometric top-down view.`,
  view: "high top-down"
});
```

**Pros**: Descriptive guidance without constraining generation
**Cons**: Relies on Claude Vision accuracy (test first)

#### Solution 3: Hybrid (Recommended)
```typescript
// Combine both approaches:
// 1. Use Claude Vision to extract key details
// 2. Pass side view as init_image with low strength (0.3-0.4)
// 3. Use enriched prompt from Claude Vision

const isometricView = await generateSprite({
  description: `${claudeAnalysis.enrichedDescription}. Isometric top-down view.`,
  view: "high top-down",
  init_image: sideView.imageBase64,
  init_image_strength: 0.35  // Light guidance
});
```

**Pros**: Best of both worlds - descriptive + visual guidance
**Cons**: Slightly more complex, requires init_image_strength tuning

---

## Updated Data Structure

```typescript
interface CreatureGeneration {
  // Portrait view (menus, galleries)
  portraitSprite: string;              // Base64 static sprite (side view)

  // Battlefield view (isometric gameplay)
  battlefieldSprite: string;           // Base64 base sprite (isometric)
  battlefieldAnimation: string[];      // 4-frame walk cycle

  // Optional: Multi-directional walks
  battlefieldAnimations?: {
    north?: string[];                  // Walking away (4 frames)
    south?: string[];                  // Walking toward (4 frames)
    east?: string[];                   // Walking right (4 frames)
    west?: string[];                   // Walking left (4 frames)
  };

  // Shared data
  animations: {
    animationSet: AnimationSet;        // Library animations work on BOTH views
    totalAnimations: number;
  };

  // Metadata
  claudeAnalysis: CreatureAnalysis;
  viewAngle: "low top-down" | "high top-down";  // Which angle was chosen
  styleValidation: StyleValidation;
  processingTimeMs: number;
  totalCostUsd: number;
}
```

---

## Generation Pipeline (Dual-View)

```typescript
async function generateDualViewCreature(description: string) {
  // Step 1: Generate portrait view (static)
  const portraitSprite = await pixellab.generateSprite({
    description,
    size: 64,
    view: "side",
    transparentBackground: true
  });
  // Cost: $0.02, Time: ~12s

  // Step 2: Analyze portrait with Claude Vision
  const styleAnalysis = await claudeVision.analyze(portraitSprite);
  // Cost: ~$0.001, Time: ~2s

  // Step 3: Generate isometric view (with reference)
  const isometricSprite = await pixellab.generateSprite({
    description: `${styleAnalysis.enrichedDescription}. Isometric view.`,
    size: 64,
    view: "high top-down",  // Or "low top-down" based on testing
    init_image: portraitSprite.imageBase64,
    init_image_strength: 0.35,
    transparentBackground: true
  });
  // Cost: $0.02, Time: ~12s

  // Step 4: Animate isometric view (walk cycle)
  const walkAnimation = await pixellab.animateWithText({
    description: `${styleAnalysis.enrichedDescription}`,
    action: "walk cycle",
    referenceImage: isometricSprite.imageBase64,
    nFrames: 4,
    view: "high top-down"
  });
  // Cost: $0.02, Time: ~15s

  // Step 5: Assign library animations (same for both views)
  const animationSet = await assignLibraryAnimations(claudeAnalysis);
  // Cost: $0.00, Time: ~1s

  return {
    portraitSprite: portraitSprite.imageBase64,
    battlefieldSprite: isometricSprite.imageBase64,
    battlefieldAnimation: walkAnimation.frames,
    animations: {
      animationSet,
      totalAnimations: Object.keys(animationSet).length
    },
    viewAngle: "high top-down",
    totalCostUsd: 0.06,
    processingTimeMs: 42000  // ~42 seconds
  };
}
```

**Total**: $0.06 per creature, ~42 seconds
**Increase**: +50% cost, +55% time (but necessary for isometric gameplay)

---

## Library Animations Compatibility

✅ **Library effects work on BOTH views!**

Since library animations are **isolated effects** (no character bodies), they overlay universally:

```typescript
// Melee sword slash works on side view:
<img src={portraitSprite} />
<img src={libraryAnimation_attack_melee_sword} style={{mixBlendMode: 'screen'}} />

// Same sword slash works on isometric view:
<img src={battlefieldSprite} />
<img src={libraryAnimation_attack_melee_sword} style={{mixBlendMode: 'screen'}} />
```

**No regeneration needed!** All 55 library animations work on any view angle.

---

## Next Steps

### Immediate (You Decide When)
1. ✅ **Run view angles test** - `npx tsx src/scripts/test-view-angles.ts`
   - Cost: ~$0.12
   - Time: ~80 seconds
   - Output: Visual comparison of all 3 angles

2. **Visual Evaluation** - Open test output, decide:
   - Which view looks best for isometric battlefield?
   - Is walk animation clear in that view?
   - Does creature feel "game-ready"?

### Short Term (After View Decision)
3. **Test multi-directional walk** - Single direction + flipping vs 4-directional
4. **Test style consistency** - Does hybrid approach match views well?
5. **Update generation processor** - Implement dual-view pipeline

### Medium Term (Full Implementation)
6. **Update API endpoints** - Return both portrait and battlefield views
7. **Update frontend** - Display appropriate view in menus vs battlefield
8. **Test with diverse creatures** - Dragons, humanoids, quadrupeds, flying
9. **Performance validation** - Ensure 30+ FPS with isometric sprites

---

## Open Questions

1. **View Angle**: Low top-down (20°) or high top-down (35°)?
   - Answer: Run test, visually evaluate

2. **Directional Walks**: Single + flip or 4-directional?
   - Answer: Test single + flip first, upgrade if needed

3. **Style Consistency**: Reference image strength? (0.3? 0.4? 0.5?)
   - Answer: Test range 0.3-0.5, find sweet spot

4. **Portrait Animation**: Do menus need animated side view?
   - Answer: User preference (static saves $0.02)

5. **Direction Parameter**: Should we specify direction for walk cycles?
   - Answer: Test with and without, see which is more consistent

---

## Cost Analysis

### Current System (Side View Only)
- Base sprite: $0.02
- Walk animation: $0.02
- **Total**: $0.04 per creature

### Proposed System (Dual View)
- Portrait sprite (side, static): $0.02
- Isometric sprite: $0.02
- Isometric walk animation: $0.02
- **Total**: $0.06 per creature

**Increase**: +50% ($0.02 more per creature)

### With Multi-Directional (If Needed)
- Portrait sprite: $0.02
- Isometric sprite: $0.02
- 4× directional walks: $0.08
- **Total**: $0.12 per creature

**Increase**: +200% ($0.08 more per creature)

---

## Test Script Ready

**File**: `/backend/src/scripts/test-view-angles.ts`

**Features**:
- ✅ Tests 3 view angles (side, low top-down, high top-down)
- ✅ Generates + animates each view
- ✅ Saves all sprites and frames
- ✅ Creates comparison report (JSON)
- ✅ Displays cost/time summary
- ✅ Ready to run with `npx tsx src/scripts/test-view-angles.ts`

**Requirements**:
- PixelLab API key in `.env`
- ~80 seconds runtime
- ~$0.12 cost

**Output**:
- Visual comparison of all angles
- Walk animation quality assessment
- Data-driven decision for best battlefield view

---

---

## ✅ IMPLEMENTATION COMPLETE

### What Was Built (October 3, 2025)

#### 1. UI-Based View Angle Testing Tool

**Frontend Component**: `/frontend/src/pages/ViewAngleTestPage.tsx`
**Backend API**: `/backend/src/api/routes/view-angle-test.routes.ts`
**Route**: `http://localhost:5173/test-view-angles`

**Features**:
- ✅ Input form for creature description
- ✅ "Generate All Views" button triggers parallel generation
- ✅ Side-by-side comparison of all 3 views:
  - Side view (profile - for menus/galleries)
  - Low top-down (~20° overhead)
  - High top-down (~35° overhead)
- ✅ Each view shows:
  - Base sprite with pixelated rendering
  - 4-frame walk animation with manual controls (prev/next)
  - Cost in USD
  - Generation time in seconds
- ✅ Summary card with total cost and time
- ✅ Evaluation guide to help decision-making
- ✅ Error handling with clear user feedback

#### 2. Backend API Endpoint

**Endpoint**: `POST http://localhost:3001/api/test/view-angles`

**Request**:
```json
{
  "description": "fierce red dragon warrior",
  "size": 64  // Optional, defaults to 64
}
```

**Response**:
```json
{
  "description": "fierce red dragon warrior",
  "results": [
    {
      "view": "side",
      "baseSprite": "base64...",
      "animationFrames": ["base64...", "base64...", "base64...", "base64..."],
      "costUsd": 0.04,
      "timeMs": 27000
    },
    {
      "view": "low top-down",
      "baseSprite": "base64...",
      "animationFrames": ["base64...", ...],
      "costUsd": 0.04,
      "timeMs": 28000
    },
    {
      "view": "high top-down",
      "baseSprite": "base64...",
      "animationFrames": ["base64...", ...],
      "costUsd": 0.04,
      "timeMs": 26000
    }
  ],
  "totalCost": 0.12,
  "totalTime": 81000
}
```

**Processing**:
- Generates all 3 views sequentially
- For each view: base sprite ($0.02) + walk animation ($0.02) = $0.04
- Total: ~$0.12, ~80 seconds

#### 3. Critical Bug Fixes

**Issue**: PixelLab API endpoints were incorrect
**Fixed**:
- ✅ Added `/v1/` prefix to all PixelLab API calls
- ✅ Changed `/generate-image-pixflux` → `/v1/generate-image-bitforge`
- ✅ Updated 5 files:
  - `sprite-generator.ts`
  - `text-animator.ts`
  - `skeleton-estimator.ts`
  - `skeleton-animator.ts`
  - `sprite-animator.ts`

### How to Use

1. **Start servers** (if not running):
   ```bash
   # Backend
   cd backend && npm run dev

   # Frontend
   cd frontend && npm run dev
   ```

2. **Access test page**:
   ```
   http://localhost:5173/test-view-angles
   ```

3. **Run a test**:
   - Enter creature description (or use default)
   - Click "Generate All Views"
   - Wait ~2-3 minutes
   - Compare results visually

4. **Evaluate**:
   - Which view looks best for battlefield?
   - How clear are the walk animations?
   - Which angle provides best gameplay visibility?

### Decision Path

Based on visual testing, choose your multi-view generation strategy:

**Option A: All 3 Views** (Maximum Flexibility)
- Side view for menus/galleries
- Low top-down for slight overhead
- High top-down for traditional isometric
- Cost: $0.12 per creature
- Use: Game can reference any view as needed

**Option B: Side + Best Isometric** (Recommended)
- Side view for menus
- One isometric view (low OR high top-down) for battlefield
- Cost: $0.08 per creature
- Use: Simpler, still covers all needs

**Option C: Isometric Only**
- Skip side view entirely
- Generate only chosen isometric view
- Cost: $0.04 per creature
- Use: If menus don't need side profile

### Multi-Directional Movement

Once view angle is chosen, decide on directional walks:

**Current**: Single direction + sprite flipping
**Future Option**: Generate 4-directional walks (north, south, east, west)
**Cost Impact**: +$0.06 for 3 additional walk animations

### Recommendation

1. ✅ **Test the UI tool** - Visual comparison is ready
2. **Make view angle decision** - Which isometric angle looks best?
3. **Implement multi-view generation** - Add chosen views to main pipeline
4. **Start with single-direction walks** - Flip sprites for other directions
5. **Upgrade if needed** - Generate multi-directional if flipping looks bad

This approach gives you:
- ✅ Beautiful portraits for menus (side view)
- ✅ Proper isometric sprites for battlefield (top-down views)
- ✅ Universal library animations (work on all views)
- ✅ Cost-effective incremental approach
- ✅ Game can reference multiple views for accurate battlefield movement
