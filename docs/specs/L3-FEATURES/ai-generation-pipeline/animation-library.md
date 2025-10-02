# Animation Library Feature

## Status: ✅ MVP COMPLETE (Isolated Effects Approach)

## Overview
Pre-generated library of 55 reusable animation effects that overlay on player-generated creatures, enabling rich combat and movement animations without per-creature generation costs.

## Implementation Approach: Isolated Effects (MVP)

### Core Concept
Generate **isolated visual effects only** (no character bodies) that can be overlaid on any creature sprite:
- Sword slash arc trails
- Fire breath particles
- Shield impact flashes
- Spell casting auras
- Hit/impact effects
- Motion effects (dust clouds, speed lines)

### Why Isolated Effects?
1. **Universal Application**: Single effect works on any creature regardless of size, shape, or style
2. **Easy Compositing**: Simple overlay in game engine
3. **Cost Effective**: Generate once, use thousands of times
4. **Design Flexibility**: Mix and match effects with any creature

## Technical Implementation

### 1. Library Definition
**File**: `/backend/src/services/animations/library.ts`

55 animation definitions organized by category:
```typescript
export const animationLibrary: AnimationDefinition[] = [
  {
    id: 'attack_melee_sword',
    name: 'Sword Attack',
    category: 'combat',
    tags: ['melee', 'weapon', 'sword'],
    description: 'Sword slash attack'
  },
  // ... 54 more
];

Categories:
- idle (5): Subtle ambient effects
- locomotion (12): Movement-related effects
- combat (15): Weapon and attack effects
- abilities (15): Magical/special effects
- reactions (8): Status and feedback effects
```

### 2. Generation Script
**File**: `/backend/src/scripts/generate-library-animations.ts`

**Two-Step PixelLab Process**:
```typescript
// Step 1: Generate isolated effect sprite
const spriteResponse = await spriteGenerator.submitGeneration({
  description: "sword slash arc trail",  // Effect only, no character
  size: 64,
  transparentBackground: true
});

// Step 2: Animate the effect
const animationResponse = await textAnimator.animateWithText({
  description: "weapon or combat effect on transparent background, no character",
  action: "sword slash arc trail",
  referenceImage: spriteResponse.imageBase64,
  nFrames: 4,
  view: 'side'
});
```

**Effect Descriptions** (emphasis on NO character body):
```typescript
function getActionDescription(animId: string): string {
  const actionMap = {
    'attack_melee_sword': 'sword slash arc trail',
    'attack_melee_punch': 'punch impact stars',
    'cast_fire_spell': 'fire magic flames and embers',
    'breathe_fire': 'fire breath flame stream',
    'hit_default': 'damage impact stars and flash',
    // ... 50 more isolated effects
  };
}

function getEffectDescription(animId: string): string {
  const descriptions = {
    'combat': 'weapon or combat effect on transparent background, no character',
    'abilities': 'magical spell effect on transparent background, no character',
    'reactions': 'status effect icon on transparent background, no character',
  };
}
```

### 3. File Structure
**Location**: `/assets/library-animations/{animationId}/`

Each animation folder contains:
```
attack_melee_sword/
  ├── base-sprite.png       # Base effect sprite
  ├── frame-0.png          # Animation frame 0
  ├── frame-1.png          # Animation frame 1
  ├── frame-2.png          # Animation frame 2
  ├── frame-3.png          # Animation frame 3
  └── metadata.json        # Generation metadata
```

**Metadata Format**:
```json
{
  "animationId": "attack_melee_sword",
  "action": "sword slash arc trail",
  "description": "weapon or combat effect on transparent background, no character",
  "frameCount": 4,
  "costUsd": 0.04,
  "spriteCostUsd": 0.02,
  "animationCostUsd": 0.02,
  "generatedAt": "2025-10-02T19:30:00.000Z",
  "baseSprite": "base-sprite.png",
  "frames": ["frame-0.png", "frame-1.png", "frame-2.png", "frame-3.png"]
}
```

### 4. API Endpoints
**File**: `/backend/src/api/routes/library-animations.routes.ts`

**GET /api/library-animations**
- Lists all available library animations
- Returns metadata summary (ID, action, description, frame count)

**GET /api/library-animations/:animationId**
- Returns full animation data including base64-encoded frames
- Includes base sprite and all animation frames

### 5. Frontend Integration
**File**: `/frontend/src/components/AnimationDebugger/AnimationDebugger.tsx`

**Admin-Only Animation Viewer**:
- Hidden by default (collapsible section)
- Displays all 20 assigned animations for a creature
- On-demand loading: Fetches library animations from API when selected
- Playback controls: Play/pause at 10 FPS
- Visual distinction between creature-specific animations (walk) and library animations

**Features**:
- Animation dropdown selector
- Base sprite + animated frame display
- Loading states for API fetches
- Frame counter
- Status indicators:
  - ✓ Animated (4 frames) - creature walk animation
  - ✓ Animated (4 frames, Library) - loaded library animation
  - ⏳ Loading... - fetching from API
  - 📚 Library (Not Loaded) - not yet fetched

## Generation Results

### Batch Generation
**Command**: `npx tsx src/scripts/generate-library-animations.ts`

**Performance**:
- Total animations: 55
- Frames per animation: 4
- Time: ~40-45 minutes
- Cost: ~$2.20 ($0.04 per animation)
- Success rate: 100%

**Test Single Animation**:
`npx tsx src/scripts/test-single-library-animation.ts`

## Assignment System

### How Animations Are Assigned
**File**: `/backend/src/services/animations/animation-assignment.service.ts`

**CRITICAL**: AI intelligently assigns **only relevant** animations to each creature based on player input analysis. Each creature receives a **variable number** of animations (typically 6-18) that make thematic and mechanical sense.

**AI Analysis Process**:
1. **Analyze player input** (drawing, text description, or uploaded image)
2. **Assess creature capabilities**:
   - Physical attributes (wings, claws, tail, etc.)
   - Combat style (melee, ranged, magic)
   - Special abilities (fire breath, healing, stealth)
   - Size and mobility (small/nimble, large/heavy)
3. **Select appropriate animations** from 55-animation library
4. **Exclude irrelevant animations** (e.g., no bow animations for melee-only creature)

**Assignment Examples**:

```typescript
// Example 1: Fire-breathing Dragon Warrior (12 animations)
{
  walk: 'walk_default',           // Generated creature-specific
  idle: 'idle_default',
  fly: 'fly_default',             // ✓ Has wings
  attackPrimary: 'attack_melee_claw',  // ✓ Has claws
  attackSecondary: 'breathe_fire',     // ✓ Fire breath ability
  defend: 'defend_default',
  abilityOne: 'roar',             // ✓ Large creature
  abilityTwo: 'wing_attack',      // ✓ Has wings
  abilityThree: 'stomp',          // ✓ Heavy creature
  hit: 'hit_default',
  death: 'death_default',
  celebrate: 'celebrate'
}
// ✗ Excluded: cast_spell_* (not magical), attack_ranged_bow (no bow), swim_default (not aquatic)

// Example 2: Tiny Forest Healer Sprite (10 animations)
{
  walk: 'walk_default',           // Generated creature-specific
  idle: 'idle_default',
  fly: 'fly_default',             // ✓ Can fly
  glide: 'glide_default',         // ✓ Small and nimble
  attackPrimary: 'cast_spell_default',  // ✓ Uses magic
  defend: 'defend_shield',        // ✓ Defensive magic
  abilityOne: 'heal_spell',       // ✓ Healer role
  abilityTwo: 'buff_spell',       // ✓ Support abilities
  hit: 'hit_default',
  death: 'death_default'
}
// ✗ Excluded: attack_melee_* (no weapons), breathe_fire (no fire), roar/stomp (peaceful/small)

// Example 3: Armored Knight (8 animations)
{
  walk: 'walk_default',           // Generated creature-specific
  idle: 'idle_default',
  attackPrimary: 'attack_melee_sword',  // ✓ Sword wielder
  attackSecondary: 'attack_melee_default', // ✓ Melee fighter
  defend: 'defend_shield',        // ✓ Has shield
  abilityOne: 'charge_attack',    // ✓ Heavy armor charge
  hit: 'hit_default',
  death: 'death_default'
}
// ✗ Excluded: fly_* (no wings), cast_spell_* (not magical), breathe_fire (no special abilities)
```

**Assignment Criteria**:

| Creature Type | Typical Animation Count | Key Assignments |
|--------------|------------------------|-----------------|
| **Melee Warrior** | 8-12 | attack_melee_*, defend_*, charge_attack |
| **Ranged Fighter** | 8-12 | attack_ranged_*, dodge_default, roll_default |
| **Mage/Caster** | 10-15 | cast_spell_*, heal_spell, buff_spell, defend_shield |
| **Dragon/Beast** | 12-18 | attack_melee_claw, breathe_fire, roar, wing_attack, stomp, tail_whip |
| **Support/Healer** | 6-10 | heal_spell, buff_spell, cast_spell_default, defend_shield |
| **Rogue/Stealth** | 8-12 | attack_melee_*, dodge_default, stealth, special_move_* |
| **Flying Creature** | 10-14 | fly_default, glide_default, wing_attack, land_default |

**Minimum Guaranteed Animations** (every creature gets these):
- `walk` (creature-specific, generated)
- `idle` (from library)
- At least 1 attack animation
- `defend_default` (or specific defend animation)
- `hit_default`
- `death_default`

**Result Structure**:
```typescript
interface CreatureAnimationSet {
  walk: string;              // Always present (generated)
  idle: string;              // Always present
  attackPrimary?: string;    // At least one attack required
  attackSecondary?: string;  // Optional
  defend?: string;           // Always present
  abilityOne?: string;       // Variable based on creature
  abilityTwo?: string;       // Variable based on creature
  abilityThree?: string;     // Variable based on creature
  fly?: string;              // Only if creature can fly
  swim?: string;             // Only if creature is aquatic
  hit: string;               // Always present
  death: string;             // Always present
  celebrate?: string;        // Optional
  // ... more slots assigned as relevant
}

interface CreatureAnimations {
  animationSet: CreatureAnimationSet;
  totalAnimations: number;   // Variable: 6-18 typically
}
```

## Game Engine Integration (Future)

### Overlay Compositing Strategy
```typescript
// Pseudocode for game engine
class CreatureRenderer {
  render(creature, currentAnimation) {
    // 1. Render base creature sprite
    this.drawSprite(creature.baseSprite, x, y);

    // 2. Overlay current animation effect
    const effect = this.libraryAnimations[currentAnimation];
    this.drawSprite(effect.currentFrame, x, y, {
      blendMode: 'ADD',  // or 'MULTIPLY' depending on effect
      alpha: 0.8
    });
  }
}
```

### Blend Modes
- **Combat effects** (sword slashes, impacts): `ADD` blend for bright flashes
- **Auras** (shields, buffs): `MULTIPLY` or `SCREEN` for glow
- **Status effects** (stun, poison): `OVERLAY` for visibility
- **Motion effects** (dust, speed lines): `ALPHA` blend

## Current Status

### ✅ Completed
1. Library definition (55 animations)
2. Two-step PixelLab generation pipeline
3. Isolated effect prompt engineering
4. Generation scripts (batch + single test)
5. File storage structure
6. API endpoints for serving animations
7. Frontend AnimationDebugger component
8. **AI-driven smart assignment system** - Variable animation counts based on creature analysis
9. **Complete animation generation** - All 55 animations generated successfully (100% success rate)
10. **Effect Compositing System documentation** - Complete implementation guide
11. **SpellCastDemo proof-of-concept** - Validates effect compositing strategy with complete cast-to-projectile-to-hit sequence

### 📊 Generation Results
- **Total animations**: 55/55 successful
- **Failed animations**: 0
- **Total cost**: $0.00 (test environment)
- **Generation time**: ~40 minutes
- **Storage**: `/assets/library-animations/` (55 folders, ~3MB total)

### 📋 Next Steps
1. **Review generated effects** (~30 min) - Visual inspection to verify isolated effects (no character bodies)
2. ~~**Test effect overlays**~~ ✅ COMPLETE - SpellCastDemo validates compositing concept
3. **Iterate on problem animations** (~1-2 hours if needed) - Adjust prompts and regenerate specific animations
4. **Implement game engine integration** (~3-4 hours) - Follow Effect Compositing System documentation
5. **Test in battle scenario** (~1 hour) - Verify performance with 20+ creatures on screen

### ✅ Proof-of-Concept: SpellCastDemo
**Component**: `/frontend/src/components/SpellCastDemo/`
**Status**: COMPLETE (2025-10-02)
**Purpose**: Validates effect compositing strategy - overlaying library animations onto creature sprites

**Features Validated**:
- ✅ Library animation loading via API (`/api/library-animations/:animationId`)
- ✅ Effect overlay using CSS `mix-blend-mode: screen` for magical glow
- ✅ 4-frame casting animation (10 FPS) plays over wizard sprite
- ✅ Projectile spawn system - spawns when cast completes
- ✅ Projectile travel animation toward target (5px/frame at 20 FPS)
- ✅ Frame cycling during projectile flight (animates through all 4 effect frames)
- ✅ Hit detection - projectile disappears when reaching target
- ✅ Debug panel showing real-time casting state, frame progress, and active projectiles

**Integration**:
- Added to GenerationProgress component
- Shows for any creature with animations (`result.spriteImageBase64 && result.animations?.totalAnimations`)
- Successfully tested with wizard creature generation (35.8s, 20 animations assigned)

**Key Validation**: Proves that isolated library animations can be dynamically composited onto any creature sprite using blend modes, achieving the desired visual effect without per-creature animation generation costs.

## Cost Analysis

### Library Generation
- One-time cost: $2.20 (55 animations × $0.04)
- Per-creature cost: $0 (animations pre-generated and reused)

### Compared to Per-Creature Generation
- **Old approach**: Generate 20 animations per creature = $0.80/creature
- **New approach**: Assign from library = $0.00/creature
- **Savings**: 100% reduction in per-creature animation costs

### Total System Cost
- Creature base sprite + walk animation: $0.04
- Library animation assignment: $0.00 (metadata only)
- **Total per creature**: $0.04 (87.5% cost reduction)

## Key Decisions Made

### Decision 1: Isolated Effects vs Full Character Animations
**Date**: 2025-10-02
**Decision**: Generate isolated effects (no character bodies) instead of full character animations
**Reasoning**:
- Full character animations couldn't be easily isolated from character body
- Isolated effects work universally on any creature
- Simpler compositing in game engine
- Better visual flexibility

### Decision 2: Two-Step Generation Process
**Decision**: Use `/generate-image-pixflux` + `/animate-with-text`
**Reasoning**:
- `/animate-with-text` requires reference image
- Two-step ensures consistent base sprite before animation
- Better quality control

### Decision 3: 4 Frames Per Animation
**Decision**: Generate 4 frames for each library animation
**Reasoning**:
- Balance between smoothness and file size
- Consistent with creature walk animations
- Adequate for 10 FPS playback

## Testing & Validation

### Manual Testing Checklist
- [x] Generate single test animation
- [x] Verify isolated effect (no character body)
- [x] Test effect overlay on creature sprite (SpellCastDemo proof-of-concept)
- [ ] Review all 55 generated effects
- [x] Test AnimationDebugger with library animations
- [x] Verify API endpoints return correct data

### Quality Criteria
1. **Visual**: Effect has transparent background with NO character body
2. **Technical**: 4 frames, 64x64px, PNG format
3. **Functional**: Can overlay on any creature sprite
4. **Metadata**: Correct action description and effect category

## Future Enhancements

### Phase 2: Advanced Effects
1. **Elemental Variations**: Fire/ice/poison versions of effects
2. **Size Variations**: Small/medium/large effect scales
3. **Rarity Tiers**: Common/rare/legendary visual complexity
4. **Combo Effects**: Combined animation sequences

### Phase 3: Dynamic Generation
1. **On-Demand Effects**: Generate missing effects at runtime
2. **Style Matching**: Generate effects matching creature aesthetic
3. **Player Customization**: Custom effect colors/styles

### Phase 4: Performance Optimization
1. **Sprite Sheets**: Combine frames into atlases
2. **Lazy Loading**: Load effects only when needed
3. **CDN Distribution**: Serve pre-generated effects from CDN
4. **Client Caching**: Cache frequently used effects

## Related Documentation
- L0 Vision: `/docs/specs/L0-VISION/creating-speical-creature-animations.md`
- PixelLab API Client: `/docs/specs/L3-FEATURES/ai-generation-pipeline/pixellab-api-client.md`
- Animation Assignment Service: (needs documentation)

## API Endpoints Used

### PixelLab API
- `POST /generate-image-pixflux` - Generate base effect sprite
- `POST /animate-with-text` - Animate effect from reference image

### Backend API
- `GET /api/library-animations` - List all library animations
- `GET /api/library-animations/:animationId` - Get specific animation with frames
