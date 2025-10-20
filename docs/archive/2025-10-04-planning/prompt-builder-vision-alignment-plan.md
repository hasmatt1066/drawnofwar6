# Prompt Builder Vision Alignment Plan

**Created**: 2025-10-01
**Purpose**: Comprehensive plan to align Prompt Builder feature with user's actual multi-modal vision
**Status**: Planning Document

---

## Section 1: Misalignment Summary

### What Was Wrong

The current L3 specification for the Prompt Builder (F-003) describes a **text-only input system** that fundamentally misaligns with the user's core vision for Drawn of War.

#### Current Spec Says:
- **Single text input box** - textarea with 500 character limit
- **Rule-based AI** - 50+ templates for keyword matching
- **Backend only** - No visual input methods
- **32-40 hours effort** - Estimated for text-only implementation

#### Critical Omissions:
1. **No Drawing Canvas** - Despite L0 Vision (lines 72-73) stating "Draw on canvas" as primary creation method
2. **No Image Upload** - Missing third input modality entirely
3. **No Claude Vision API** - No AI analysis of visual inputs
4. **No Style Preservation** - L0 Vision (line 33) explicitly requires "Drawing Personality Preservation"
5. **No Animation Mapping** - Missing the intelligence layer that assigns 20+ animations based on visual analysis

### Root Cause Analysis

The misalignment occurred because:
- L3 spec was written focusing on the simpler text-only path
- User's recent confirmation clarified that **all three input methods are MVP requirements**
- Drawing canvas and image upload were assumed to be post-MVP features
- Claude Vision API integration was not considered in original scope

### Impact of Misalignment

If we had proceeded with text-only implementation:
- ❌ Violates L0 Vision requirement for "Draw on canvas" (line 72)
- ❌ Fails to deliver "Drawing Personality Preservation" (line 33)
- ❌ Undermines core value proposition: "manifest imagination directly into gameplay"
- ❌ Reduces player creative expression to text-only (against democratization goal)
- ❌ Misses key differentiator from competitors

---

## Section 2: User's Confirmed Vision

### The Three Input Methods (All MVP)

#### User's Direct Quotes:
> "We need drawing/image/text for MVP"

> "Claude API will analyze submission for game attribute assignment"

> "we will also pass submission to pixellab for rendering and bring it back to show user with game attributes"

> "Claude API will also need to decide what attribute animations to then combine with the pixel AI rendered result"

> "YES! User needs to feel like their drawing matters"

### Complete User Flow (User's Vision)

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. USER ARRIVES AT CREATION SCREEN                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. CHOOSES INPUT METHOD (MVP: All Three)                        │
├─────────────────────────────────────────────────────────────────┤
│   [🎨 Draw It]  [📝 Describe It]  [📤 Upload It]                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. USER CREATES/UPLOADS/DESCRIBES                               │
├─────────────────────────────────────────────────────────────────┤
│  • Draw It: HTML5 Canvas with brush tools, colors, undo         │
│  • Describe It: 500 char text box (already spec'd)              │
│  • Upload It: Drag-and-drop file picker (PNG/JPG, 5MB max)      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. BACKEND RECEIVES INPUT                                       │
├─────────────────────────────────────────────────────────────────┤
│  • Drawing → Canvas blob → Image normalization                  │
│  • Text → String → (used for text-only path OR metadata)        │
│  • Upload → File → Image normalization                          │
│                                                                  │
│  Result: All inputs normalized to image format (PNG base64)     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. PARALLEL PROCESSING (Dual-API Architecture)                  │
└─────────────────────────────────────────────────────────────────┘
         ↓                                        ↓
┌──────────────────────────┐        ┌──────────────────────────────┐
│ PATH A: ATTRIBUTE        │        │ PATH B: VISUAL GENERATION    │
│ ASSIGNMENT               │        │                              │
├──────────────────────────┤        ├──────────────────────────────┤
│ Claude Vision API        │        │ PixelLab.ai API              │
│ ↓                        │        │ ↓                            │
│ Analyzes submission      │        │ Receives normalized input    │
│ ↓                        │        │ ↓                            │
│ Extracts:                │        │ Generates:                   │
│ - Creature concept       │        │ - 64x64 sprite frames        │
│ - Visual features        │        │ - Preserves drawing style    │
│ - Implied abilities      │        │ - Returns sprite sheet       │
│ ↓                        │        │ ↓                            │
│ Assigns game attributes: │        │ Output: Animated sprite      │
│ - Type (unit/effect)     │        │         (user's style)       │
│ - Stats (HP, attack,     │        │                              │
│   defense, speed)        │        │                              │
│ - Abilities (melee,      │        │                              │
│   ranged, magic)         │        │                              │
│ - Animation set          │        │                              │
│   (20+ animations)       │        │                              │
│ ↓                        │        │                              │
│ Output: Game attributes  │        │                              │
│         + animation IDs  │        │                              │
└──────────────────────────┘        └──────────────────────────────┘
         ↓                                        ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. COMBINE RESULTS                                              │
├─────────────────────────────────────────────────────────────────┤
│  PixelLab Sprite + Claude Attributes + Animation Set            │
│  ↓                                                              │
│  Package as complete creature:                                  │
│  - Sprite URL (with user's drawing style preserved)             │
│  - Stats (AI-assigned)                                          │
│  - Abilities (AI-assigned)                                      │
│  - Animation mappings (20+ animations)                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 7. USER SEES ANIMATED CREATURE                                  │
├─────────────────────────────────────────────────────────────────┤
│  • Animated sprite with preserved drawing style                 │
│  • Stats display (HP, attack, defense, speed)                   │
│  • Abilities list (what it can do)                              │
│  • Animation preview (idle, walk, attack, death, specials)      │
│  • "Their drawing matters" - visual style is recognizable       │
└─────────────────────────────────────────────────────────────────┘
```

### Key Decision Confirmations

#### Decision 1: Input Methods Priority
**User's Choice**: **All three inputs MVP** (drawing canvas + text + upload)

**Quote**: "We need drawing/image/text for MVP"

**Rationale**: Core vision requires drawing as primary method (L0 Vision, line 72: "Draw on canvas"). Text and upload are alternative creative pathways.

#### Decision 2: Drawing Analysis Approach
**User's Choice**: **Claude Vision API analyzes submission**

**Quote**: "Claude API will analyze submission for game attribute assignment"

**Rationale**: AI must understand visual input to assign appropriate game attributes, stats, abilities, and animations.

#### Decision 3: Style Preservation
**User's Choice**: **Style transfer (final sprite LOOKS like user's drawing)**

**Quote**: "YES! User needs to feel like their drawing matters"

**From L0 Vision (line 33)**: "Drawing Personality Preservation: Player's art style maintained in pixel art conversion"

**Rationale**: Without style preservation, drawing input feels pointless. User must see their creative expression in the final sprite.

### Architecture: Dual-API System

#### Path A: Claude Vision API (Attribute Assignment)
**Purpose**: Analyze visual input to extract creature concept and assign game attributes

**Input**: Normalized image (PNG base64) from drawing/upload OR text description

**Processing**:
1. Send image to Claude Vision API (if drawing/upload) OR text prompt (if text input)
2. Prompt Claude to analyze:
   - "What type of creature is this?"
   - "What abilities does it appear to have?"
   - "What visual features are prominent?"
   - "What animation set would be appropriate?"
3. Parse Claude's response into structured data

**Output**:
```typescript
interface ClaudeAnalysisResult {
  creatureType: 'unit' | 'effect' | 'terrain';
  concept: string; // "armored knight", "fire dragon", etc.
  visualFeatures: string[]; // ["large shield", "golden armor", "red cape"]
  impliedAbilities: string[]; // ["melee attack", "defense buff", "slow movement"]
  suggestedAnimations: string[]; // IDs from animation library (20+ animations)
  stats: {
    health: number;
    attack: number;
    defense: number;
    speed: number;
  };
  styleCharacteristics: string[]; // ["bold lines", "bright colors", "cartoonish"]
}
```

**Cost**: ~$0.01-0.03 per submission (Claude Vision API pricing)

#### Path B: PixelLab.ai API (Visual Generation)
**Purpose**: Generate pixel art sprite with style preservation

**Input**: Normalized image OR text prompt + style hints from Claude

**Processing**:
1. If drawing/upload: Send original image with instruction "preserve this drawing style"
2. If text: Generate prompt from text description + Claude's concept extraction
3. PixelLab generates 64x64 sprite frames with skeletal rigging
4. Download sprite sheet

**Output**: Animated sprite sheet (user's drawing style preserved)

**Cost**: Same as current implementation (PixelLab API pricing)

#### Synchronization & Combination
Both paths run **in parallel** (not sequential) to minimize total wait time.

**Combination Logic**:
```typescript
async function generateCreature(input: UserInput): Promise<Creature> {
  // Normalize input to image format
  const normalizedImage = await normalizeInput(input);

  // Parallel processing
  const [claudeResult, pixelLabResult] = await Promise.all([
    claudeVisionService.analyze(normalizedImage, input.text),
    pixelLabOrchestrator.generate(normalizedImage, input.text)
  ]);

  // Combine results
  return {
    spriteUrl: pixelLabResult.spriteSheetUrl,
    stats: claudeResult.stats,
    abilities: claudeResult.impliedAbilities,
    animations: mapAnimations(claudeResult.suggestedAnimations),
    stylePreserved: verifyStylePreservation(normalizedImage, pixelLabResult.sprite)
  };
}
```

---

## Section 3: Architecture Changes

### NEW Frontend Components

#### 1. Input Method Selector (NEW)
**Component**: `<InputMethodSelector />`
**Location**: `/frontend/src/components/creation/InputMethodSelector.tsx`
**Effort**: 1-2 hours

**Features**:
- Three-button toggle: [Draw It] [Describe It] [Upload It]
- Visual icons for each method
- Disabled state if method unavailable
- Accessible keyboard navigation

**State Management**:
```typescript
interface InputMethodState {
  selectedMethod: 'draw' | 'text' | 'upload';
  availableMethods: string[];
  switchMethod: (method: string) => void;
}
```

#### 2. Drawing Canvas Component (NEW - MAJOR)
**Component**: `<DrawingCanvas />`
**Location**: `/frontend/src/components/creation/DrawingCanvas.tsx`
**Effort**: 8-12 hours

**Features**:
- HTML5 Canvas API with drawing tools
- Brush size selector (small, medium, large)
- Color picker (8 preset colors + custom)
- Eraser tool
- Undo/Redo (up to 50 steps)
- Clear canvas button (with confirmation)
- Export to blob for submission

**Technical Details**:
- Canvas size: 512x512px (downscaled to 64x64 for PixelLab, but allow detail)
- Touch-friendly (mobile support)
- Pressure sensitivity (if stylus detected)
- Smooth line rendering (Bezier curves)

**Dependencies**:
- Consider using library like Fabric.js or react-canvas-draw for advanced features

#### 3. Image Upload Component (NEW)
**Component**: `<ImageUpload />`
**Location**: `/frontend/src/components/creation/ImageUpload.tsx`
**Effort**: 3-4 hours

**Features**:
- Drag-and-drop zone
- File picker fallback (click to browse)
- Image preview before submission
- File validation (PNG/JPG, max 5MB)
- Crop/resize interface (optional, post-MVP)

**User Flow**:
1. User drags image file over drop zone
2. Drop zone highlights
3. User drops file
4. Preview appears with "Use This" button
5. User clicks "Use This" → submission flow

#### 4. Updated Text Input Component
**Component**: `<TextPromptInput />` (already spec'd, but needs integration with new multi-modal system)
**Location**: `/frontend/src/components/creation/TextPromptInput.tsx`
**Effort**: 1-2 hours (updates only)

**Changes**:
- Must now be one of three input options (not standalone)
- Share submission button with other input methods
- State synchronized with parent InputMethodSelector

### NEW Backend Services

#### 1. Input Normalization Service (NEW)
**Service**: `InputNormalizer`
**Location**: `/backend/src/input/input-normalizer.ts`
**Effort**: 4-6 hours

**Purpose**: Convert all input types (drawing blob, text, uploaded image) into normalized format for downstream processing

**Functions**:
```typescript
class InputNormalizer {
  // Convert canvas blob to normalized image
  async normalizeDrawing(blob: Blob): Promise<NormalizedImage>;

  // Validate and resize uploaded image
  async normalizeUpload(file: File): Promise<NormalizedImage>;

  // Generate placeholder image from text (for text-only path)
  async normalizeText(text: string): Promise<NormalizedImage>;

  // Common validation
  private validateDimensions(image: Image): boolean;
  private enforceMaxSize(image: Image): Image;
}

interface NormalizedImage {
  base64: string; // PNG format
  dimensions: { width: number; height: number }; // Always 512x512 after normalization
  format: 'png';
  metadata: {
    originalFormat?: string;
    originalSize?: { width: number; height: number };
    compressionApplied: boolean;
  };
}
```

#### 2. Claude Vision Integration Service (NEW - MAJOR)
**Service**: `ClaudeVisionService`
**Location**: `/backend/src/claude/claude-vision-service.ts`
**Effort**: 10-14 hours

**Purpose**: Integrate Claude Vision API for image analysis and attribute assignment

**Functions**:
```typescript
class ClaudeVisionService {
  // Main analysis function
  async analyzeCreature(
    image: NormalizedImage,
    textContext?: string
  ): Promise<ClaudeAnalysisResult>;

  // Extract creature concept
  private async extractConcept(image: NormalizedImage): Promise<string>;

  // Assign game attributes based on visual analysis
  private async assignAttributes(concept: string, features: string[]): Promise<CreatureStats>;

  // Map to animation set
  private async suggestAnimations(concept: string, abilities: string[]): Promise<string[]>;

  // Extract style characteristics
  private async extractStyle(image: NormalizedImage): Promise<string[]>;
}
```

**API Integration**:
- Use Anthropic Claude API (Vision-enabled model)
- Structured prompt engineering for consistent attribute extraction
- Error handling for API failures, rate limits
- Cost tracking (log each API call with token usage)

**Example Prompt**:
```
You are analyzing a user's drawing for a game creature.

Image: [base64 image data]

Analyze this creature and respond in JSON format:
{
  "creatureType": "unit" | "effect" | "terrain",
  "concept": "brief description (2-5 words)",
  "visualFeatures": ["list", "of", "prominent", "features"],
  "impliedAbilities": ["abilities", "this", "creature", "likely", "has"],
  "stats": {
    "health": number (10-200),
    "attack": number (1-50),
    "defense": number (0-30),
    "speed": number (1-10)
  },
  "suggestedAnimations": ["idle", "walk", "attack", "etc"],
  "styleCharacteristics": ["bold lines", "bright colors", etc]
}

Be creative but grounded in what you see.
```

#### 3. Animation Mapper Service (NEW)
**Service**: `AnimationMapper`
**Location**: `/backend/src/animation/animation-mapper.ts`
**Effort**: 6-8 hours

**Purpose**: Map Claude's suggested animations to actual animation IDs from the 50+ animation library

**Functions**:
```typescript
class AnimationMapper {
  // Map Claude's suggestions to animation library
  async mapAnimations(
    suggestions: string[],
    creatureType: string,
    abilities: string[]
  ): Promise<AnimationSet>;

  // Ensure minimum animation set (idle, walk, attack, death)
  private ensureBaseAnimations(animations: AnimationSet): AnimationSet;

  // Add ability-specific animations
  private addAbilityAnimations(
    animations: AnimationSet,
    abilities: string[]
  ): AnimationSet;

  // Load animation definitions from library
  private loadAnimationLibrary(): AnimationDefinition[];
}

interface AnimationSet {
  idle: string; // Animation ID
  walk: string;
  attack: string;
  death: string;
  specials: string[]; // 15-20 additional animations
}
```

#### 4. Updated Prompt Enhancement Service
**Service**: `PromptEnhancementService` (existing, needs major updates)
**Location**: `/backend/src/prompt/enhancement.service.ts`
**Effort**: 6-8 hours (refactoring)

**Changes**:
- Now handles TWO input paths:
  1. **Text-only path**: Use existing rule-based templates (50+ templates, keyword matching)
  2. **Visual path**: Integrate with ClaudeVisionService for image analysis

**Updated Architecture**:
```typescript
class PromptEnhancementService {
  async enhance(input: UserInput): Promise<StructuredPrompt> {
    if (input.type === 'text') {
      // Original text-only path (rule-based)
      return this.enhanceFromText(input.text);
    } else {
      // NEW: Visual path (Claude Vision)
      const normalizedImage = await inputNormalizer.normalize(input);
      const claudeResult = await claudeVisionService.analyze(normalizedImage, input.text);
      return this.enhanceFromClaudeAnalysis(claudeResult);
    }
  }

  // Existing function (rule-based templates)
  private enhanceFromText(text: string): StructuredPrompt;

  // NEW: Convert Claude analysis to StructuredPrompt
  private enhanceFromClaudeAnalysis(analysis: ClaudeAnalysisResult): StructuredPrompt;
}
```

#### 5. Updated PixelLab Orchestrator
**Service**: `PixelLabOrchestrator` (existing, needs updates)
**Location**: `/backend/src/pixellab/pixellab-orchestrator.ts`
**Effort**: 4-6 hours (updates)

**Changes**:
- Accept normalized image input (not just text prompts)
- Add style preservation instructions to PixelLab API request
- Handle image-to-image generation mode (if PixelLab supports)

**Updated Functions**:
```typescript
class PixelLabOrchestrator {
  async generate(input: GenerationInput): Promise<SpriteResult> {
    if (input.hasImage) {
      // NEW: Image-based generation with style hints
      return this.generateFromImage(input.image, input.styleHints);
    } else {
      // Existing: Text-based generation
      return this.generateFromPrompt(input.prompt);
    }
  }

  // NEW: Image-based generation
  private async generateFromImage(
    image: NormalizedImage,
    styleHints: string[]
  ): Promise<SpriteResult>;

  // Existing: Text-based generation
  private async generateFromPrompt(prompt: StructuredPrompt): Promise<SpriteResult>;
}
```

#### 6. Style Preservation Validator (NEW)
**Service**: `StylePreservationValidator`
**Location**: `/backend/src/validation/style-preservation-validator.ts`
**Effort**: 4-6 hours

**Purpose**: Verify that PixelLab's output preserves key visual characteristics from user's drawing

**Functions**:
```typescript
class StylePreservationValidator {
  // Compare original drawing to generated sprite
  async validateStylePreservation(
    originalImage: NormalizedImage,
    generatedSprite: Image,
    styleCharacteristics: string[]
  ): Promise<StylePreservationResult>;

  // Extract color palette
  private extractColorPalette(image: Image): string[];

  // Compare color palettes
  private compareColorPalettes(original: string[], generated: string[]): number; // similarity score 0-1

  // Detect shape similarity
  private compareShapes(original: Image, generated: Image): number; // similarity score 0-1
}

interface StylePreservationResult {
  passed: boolean;
  colorSimilarity: number; // 0-1
  shapeSimilarity: number; // 0-1
  overallScore: number; // 0-1
  feedback: string; // User-facing feedback
}
```

### Updated Data Flow

#### Complete Multi-Modal Flow

```
1. USER INPUT
   ├─ Drawing → Canvas blob
   ├─ Text → String (500 chars max)
   └─ Upload → File (PNG/JPG, 5MB max)
              ↓
2. INPUT NORMALIZATION (NEW)
   InputNormalizer.normalize()
   ↓
   All inputs → NormalizedImage (512x512 PNG base64)
              ↓
3. PARALLEL PROCESSING (NEW ARCHITECTURE)
   ├─────────────────────────┬─────────────────────────┐
   ↓                         ↓                         ↓
   CLAUDE VISION PATH        PIXELLAB PATH             TEXT-ONLY PATH
   (drawing/upload)          (all inputs)              (text input)
   ↓                         ↓                         ↓
   ClaudeVisionService       PixelLabOrchestrator      PromptEnhancementService
   .analyze(image)           .generate(image/prompt)   .enhanceFromText(text)
   ↓                         ↓                         ↓
   - Creature concept        - Sprite generation       - Keyword extraction
   - Visual features         - Style preservation      - Template matching
   - Implied abilities       - Animation frames        - Attribute assignment
   - Stats assignment        ↓                         ↓
   - Animation suggestions   SpriteSheet + URL         StructuredPrompt
   - Style characteristics                             (rule-based)
   ↓
   ClaudeAnalysisResult
   └─────────────────────────┴─────────────────────────┘
                              ↓
4. ANIMATION MAPPING (NEW)
   AnimationMapper.mapAnimations(claudeResult.suggestions)
   ↓
   AnimationSet (20+ animations mapped to library IDs)
              ↓
5. STYLE VALIDATION (NEW)
   StylePreservationValidator.validate(original, generated)
   ↓
   StylePreservationResult (passed/failed + scores)
              ↓
6. COMBINATION
   Package complete creature:
   {
     spriteUrl: from PixelLab
     stats: from Claude (or rule-based if text-only)
     abilities: from Claude (or rule-based if text-only)
     animations: from AnimationMapper
     stylePreserved: from StylePreservationValidator
   }
              ↓
7. JOB SUBMISSION (existing)
   JobSubmitter.submitJob() → Queue → Progress Tracking → SSE updates
              ↓
8. USER PREVIEW
   - Animated sprite (with preserved style)
   - Stats display
   - Abilities list
   - Animation preview (20+ animations)
   - "Regenerate" option if style preservation failed
```

---

## Section 4: Effort Re-estimation

### Original Estimate (Text-Only)
**Total: 32-40 hours**
- Phase 1: Express API (4-6 hrs)
- Phase 2: Prompt Enhancement (14-16 hrs, rule-based only)
- Phase 3: React Frontend (9-11 hrs, text input only)
- Phase 4: Integration & Testing (5-7 hrs)

### NEW Estimate (Multi-Modal with Claude Vision)
**Total: 68-88 hours** (~2x original estimate)

#### Phase 0: Multi-Modal Input UI (NEW)
**Effort: 14-20 hours**
- Input Method Selector: 1-2 hours
- Drawing Canvas Component: 8-12 hours (MAJOR)
- Image Upload Component: 3-4 hours
- Input Normalization Service: 4-6 hours
- Component tests: 2-3 hours

#### Phase 1: Express API Server (existing, slight updates)
**Effort: 5-7 hours** (was 4-6 hrs)
- Same as before, plus:
- Handle file uploads (multipart/form-data): +1 hour
- Image validation middleware: +1 hour

#### Phase 2: Prompt Enhancement Service (major updates)
**Effort: 26-34 hours** (was 14-16 hrs)
- Template schema design: 2 hours (existing)
- Create 50+ templates: 4 hours (existing)
- Keyword extraction: 2 hours (existing)
- Template matching: 2 hours (existing)
- Modifier system: 2 hours (existing)
- Size determination: 1 hour (existing)
- **NEW: Claude Vision Integration: 10-14 hours** (MAJOR)
- **NEW: Animation Mapper Service: 6-8 hours**
- **NEW: Style Preservation Validator: 4-6 hours**
- Refactor core service for dual paths: 3-4 hours
- Comprehensive tests: 4-6 hours (was 3-4 hrs)

#### Phase 3: React Frontend (updates)
**Effort: 12-15 hours** (was 9-11 hrs)
- PromptInput component: 2 hours (existing, minor updates)
- CharacterCounter: 1 hour (existing)
- PreviewPanel: 2 hours (existing)
- **NEW: Input method switching logic: 2-3 hours**
- **NEW: Drawing canvas integration: 2-3 hours**
- **NEW: Image upload integration: 1-2 hours**
- Zustand state management: 1 hour (existing)
- API client: 1 hour (existing)
- Loading/error states: 1 hour (existing)
- Component tests: 3-4 hours (was 2-3 hrs)

#### Phase 4: Integration & Testing (expanded)
**Effort: 11-16 hours** (was 5-7 hrs)
- Wire Express API to JobSubmitter: 1 hour (existing)
- **NEW: Wire Claude Vision Service: 2-3 hours**
- **NEW: Wire Animation Mapper: 2-3 hours**
- **NEW: Test parallel processing (Claude + PixelLab): 2-3 hours**
- End-to-end tests: 3-4 hours (was 2-3 hrs)
- **NEW: Style preservation validation tests: 2-3 hours**
- Performance testing: 2-3 hours (existing)

### Breakdown by Component Type

| Component | Original | NEW | Delta |
|-----------|----------|-----|-------|
| Frontend UI | 9-11 hrs | 26-35 hrs | +17-24 hrs |
| Backend Services | 18-22 hrs | 31-41 hrs | +13-19 hrs |
| Integration & Testing | 5-7 hrs | 11-16 hrs | +6-9 hrs |
| **TOTAL** | **32-40 hrs** | **68-92 hrs** | **+36-52 hrs** |

### Risk Factors

**High Risk Items** (could increase estimate further):
1. **Claude Vision API Reliability**: If API is unstable, may need extensive retry logic (+4-6 hrs)
2. **Style Preservation Accuracy**: If PixelLab doesn't preserve style well, may need manual adjustment UI (+8-12 hrs)
3. **Drawing Canvas Performance**: If canvas lags on mobile, may need optimization (+4-6 hrs)
4. **Animation Mapping Complexity**: If 50+ animations are hard to map automatically, may need manual fallback system (+6-8 hrs)

**Medium Risk Items**:
- Image preprocessing quality (normalization artifacts)
- Claude Vision prompt engineering (getting consistent structured responses)
- File upload security (malicious files)

---

## Section 5: Implementation Phases

### Phase 0: Multi-Modal Input UI (NEW FOUNDATION)
**Duration**: 1-2 weeks
**Dependencies**: None (can start immediately)

**Tasks**:
1. Create Input Method Selector component
2. Build Drawing Canvas component (HTML5 Canvas + drawing tools)
3. Build Image Upload component (drag-and-drop + file picker)
4. Implement Input Normalization service (backend)
5. Write component tests for all three input methods
6. Integration test: All three inputs → normalized image format

**Deliverables**:
- ✅ User can select between Draw/Text/Upload
- ✅ Drawing canvas works on desktop + mobile
- ✅ Image upload accepts PNG/JPG up to 5MB
- ✅ All inputs normalize to 512x512 PNG base64

**Acceptance Criteria**:
- Drawing canvas supports: brush, eraser, undo, color picker
- Image upload validates file type/size
- Normalized images are consistent format
- Tests cover all input methods + edge cases

---

### Phase 1: Claude Vision Integration (NEW INTELLIGENCE LAYER)
**Duration**: 1-2 weeks
**Dependencies**: Phase 0 (needs normalized image input)

**Tasks**:
1. Set up Claude Vision API credentials
2. Implement ClaudeVisionService
3. Design prompt engineering for consistent attribute extraction
4. Implement error handling (API failures, rate limits)
5. Add cost tracking (log API calls with token usage)
6. Write unit tests for Claude Vision integration
7. Test with diverse image inputs (drawings, uploads)

**Deliverables**:
- ✅ Claude Vision API successfully analyzes images
- ✅ Consistent JSON responses with creature attributes
- ✅ Error handling for API failures
- ✅ Cost tracking for API usage

**Acceptance Criteria**:
- 90%+ of images return valid analysis
- Response time <3 seconds (Claude API)
- Cost per analysis <$0.05
- Graceful fallback if API unavailable

---

### Phase 2: Animation Mapper & Style Validation (NEW SERVICES)
**Duration**: 1 week
**Dependencies**: Phase 1 (needs Claude analysis results)

**Tasks**:
1. Build Animation Mapper service
2. Load 50+ animation library definitions
3. Implement animation suggestion → library ID mapping
4. Build Style Preservation Validator
5. Implement color palette extraction
6. Implement shape similarity detection
7. Write tests for both services

**Deliverables**:
- ✅ Claude's animation suggestions map to library IDs
- ✅ Every creature has minimum 20 animations
- ✅ Style preservation validator returns pass/fail + scores
- ✅ User feedback for failed style preservation

**Acceptance Criteria**:
- Animation mapping covers all creature types
- Base animations (idle, walk, attack, death) always present
- Style validation completes in <1 second
- Clear feedback when style preservation fails

---

### Phase 3: Dual-API Orchestration (PARALLEL PROCESSING)
**Duration**: 1-2 weeks
**Dependencies**: Phases 0, 1, 2 (all prior work)

**Tasks**:
1. Refactor PromptEnhancementService for dual paths
2. Update PixelLabOrchestrator to accept image inputs
3. Implement parallel processing (Claude + PixelLab)
4. Implement result combination logic
5. Add fallback for text-only path (existing rule-based system)
6. Write integration tests for parallel processing
7. Test with all three input types

**Deliverables**:
- ✅ Claude Vision + PixelLab run in parallel
- ✅ Results combined into complete creature
- ✅ Text-only path still works (rule-based)
- ✅ Total processing time <60 seconds (L0 requirement)

**Acceptance Criteria**:
- Parallel processing reduces total wait time by 30%+
- Drawing/upload inputs use Claude Vision + PixelLab
- Text inputs use rule-based templates (fast, free)
- Error handling for both API failures

---

### Phase 4: Express API & Frontend Integration (CONNECT THE DOTS)
**Duration**: 1 week
**Dependencies**: Phases 0, 3 (needs UI + backend services)

**Tasks**:
1. Update Express API to handle file uploads (multipart/form-data)
2. Add image validation middleware
3. Wire frontend input components to API
4. Implement loading states for each input method
5. Add error messages for API failures
6. Write end-to-end tests (UI → backend → result)
7. Performance testing (concurrent users)

**Deliverables**:
- ✅ All three input methods work end-to-end
- ✅ User sees progress during generation
- ✅ Errors display user-friendly messages
- ✅ API handles 50+ concurrent requests

**Acceptance Criteria**:
- Drawing → Canvas blob → API → result
- Upload → File → API → result
- Text → String → API → result
- Response time <200ms for API (not including generation)

---

### Phase 5: Style Preservation & Validation (POLISH)
**Duration**: 3-5 days
**Dependencies**: Phase 4 (needs end-to-end flow)

**Tasks**:
1. Integrate StylePreservationValidator into generation flow
2. Create side-by-side comparison UI (original drawing vs. final sprite)
3. Implement "Regenerate with adjustments" flow
4. Add user feedback prompts ("Does this look like your drawing?")
5. Collect telemetry on style preservation success rate
6. Write tests for regeneration flow

**Deliverables**:
- ✅ Users can see original drawing vs. final sprite
- ✅ Users can regenerate if style not preserved
- ✅ Telemetry tracks style preservation success
- ✅ Clear guidance when regeneration needed

**Acceptance Criteria**:
- 80%+ of users accept first generation (no regeneration needed)
- Regeneration option always available
- Side-by-side comparison helps users decide
- Telemetry identifies patterns in failed style preservation

---

### Phase 6: Testing & Optimization (QUALITY ASSURANCE)
**Duration**: 1 week
**Dependencies**: All phases complete

**Tasks**:
1. Comprehensive end-to-end testing (all input methods)
2. Performance optimization (canvas rendering, API calls)
3. Cost optimization (Claude Vision API usage)
4. Accessibility testing (keyboard navigation, screen readers)
5. Mobile testing (drawing canvas on touch screens)
6. Load testing (100+ concurrent users)
7. Documentation for all new components

**Deliverables**:
- ✅ Test coverage >90%
- ✅ Performance targets met (60 sec generation, 30+ FPS)
- ✅ API costs under budget
- ✅ Accessible to all users
- ✅ Works on desktop + mobile

**Acceptance Criteria**:
- All L0 success metrics met
- No critical bugs
- Performance acceptable on average hardware
- Documentation complete

---

## Section 6: Open Questions

### Technical Questions

#### 1. Claude Vision API Model Selection
**Question**: Which Claude model should we use for vision analysis?
- **Option A**: Claude 3 Opus (most capable, highest cost ~$0.03/image)
- **Option B**: Claude 3 Sonnet (balanced, ~$0.01/image)
- **Option C**: Claude 3 Haiku (fast/cheap, ~$0.005/image)

**Consideration**: Opus has best analysis quality, but 3x cost of Haiku. Does accuracy justify cost?

**Recommendation**: Start with Sonnet (middle ground), A/B test with Opus to measure quality difference.

---

#### 2. Style Preservation Validation Threshold
**Question**: What similarity score triggers regeneration prompt?
- **Option A**: Strict (>80% similarity required, more regenerations)
- **Option B**: Moderate (>60% similarity required)
- **Option C**: Lenient (>40% similarity required, fewer regenerations)

**Consideration**: Too strict = frustrated users. Too lenient = poor style preservation.

**Recommendation**: Start with 60%, collect user feedback, adjust based on acceptance rate.

---

#### 3. Drawing Canvas Library Choice
**Question**: Use library or build from scratch?
- **Option A**: Build custom (full control, 8-12 hrs)
- **Option B**: Use Fabric.js (feature-rich, 4-6 hrs integration)
- **Option C**: Use react-canvas-draw (lightweight, 2-3 hrs integration)

**Consideration**: Custom = more work, but perfect fit. Library = faster, but may have limitations.

**Recommendation**: Use react-canvas-draw for MVP (fast), build custom if limitations found in testing.

---

#### 4. Input Normalization Strategy
**Question**: How aggressively should we normalize/resize images?
- **Option A**: Preserve original (no resize, send full-res to APIs)
- **Option B**: Moderate resize (512x512 for processing, keep original)
- **Option C**: Aggressive resize (256x256 for processing, lower quality)

**Consideration**: Larger images = better analysis quality, but higher API costs and slower processing.

**Recommendation**: 512x512 for processing (good balance), store original for style comparison.

---

#### 5. Parallel vs. Sequential API Calls
**Question**: Should Claude + PixelLab run in parallel or sequential?
- **Option A**: Parallel (fastest, 30-40 sec total)
- **Option B**: Sequential Claude → PixelLab (slower, 50-60 sec total, but PixelLab can use Claude's analysis)
- **Option C**: Conditional (parallel for simple cases, sequential for complex)

**Consideration**: Parallel is faster, but PixelLab can't use Claude's style insights if running simultaneously.

**Recommendation**: Parallel for MVP (speed priority), explore sequential for style preservation improvement post-MVP.

---

### User Experience Questions

#### 6. Drawing Canvas Defaults
**Question**: What default settings for canvas?
- Brush size: Small, Medium, or Large?
- Default color: Black, White, or Random?
- Canvas background: White, Transparent, or Gray grid?

**Recommendation**: Conduct quick user testing with 5 users to determine preferences.

---

#### 7. Animation Preview Complexity
**Question**: How many animations to show in preview?
- **Option A**: Show all 20+ animations (comprehensive)
- **Option B**: Show top 5 most important (simplified)
- **Option C**: Show idle + attack only (minimal)

**Consideration**: Too many = overwhelming. Too few = users don't understand creature's full capabilities.

**Recommendation**: Show idle, walk, attack, death, + 2 special abilities (7 total), with "Show All" button.

---

#### 8. Regeneration Flow
**Question**: What happens if user rejects first generation?
- **Option A**: Regenerate with same input (try again)
- **Option B**: Let user modify input (edit drawing, adjust text)
- **Option C**: Offer prompt suggestions ("Try adding more detail")

**Recommendation**: Option B + C (let user edit + provide suggestions).

---

### Cost & Business Questions

#### 9. Claude Vision API Budget
**Question**: What's the monthly budget for Claude Vision API?
- Average cost per generation: $0.01-0.03
- Expected generations per month: ?
- Budget limit: ?

**Recommendation**: User needs to provide budget constraints to determine if cost is acceptable.

---

#### 10. Rate Limiting Strategy
**Question**: Should we rate-limit Claude Vision API calls?
- **Option A**: No limits (best UX, highest cost)
- **Option B**: Per-user limits (e.g., 10 generations/hour)
- **Option C**: Global limits (e.g., 1000 generations/day across all users)

**Consideration**: No limits = potential abuse. Limits = frustrated users if hit.

**Recommendation**: Start with per-user limits (10/hour for MVP), adjust based on usage patterns.

---

## Summary of Open Questions

| # | Question | Priority | Blocker? | Recommendation |
|---|----------|----------|----------|----------------|
| 1 | Claude model selection | High | No | Start with Sonnet |
| 2 | Style validation threshold | Medium | No | 60% similarity |
| 3 | Drawing canvas library | Medium | No | react-canvas-draw |
| 4 | Image normalization | Medium | No | 512x512 processing |
| 5 | Parallel vs sequential | High | No | Parallel for MVP |
| 6 | Canvas defaults | Low | No | User testing |
| 7 | Animation preview | Low | No | Show 7 animations |
| 8 | Regeneration flow | Medium | No | Edit + suggestions |
| 9 | Claude API budget | High | **YES** | User must provide |
| 10 | Rate limiting | Medium | No | 10/hour per user |

**Blocker**: Question #9 (budget) must be answered before proceeding with implementation.

---

## Next Steps

1. **User Review**: Review this plan with user, confirm direction
2. **Answer Open Questions**: Especially #9 (budget) - blocker
3. **Update L3 Specification**: Revise prompt-builder.md with multi-modal architecture
4. **Update L4 Tasks**: Break down new phases into atomic tasks
5. **Update L2 Epic**: Update pixellab-integration.md Feature #2 description
6. **Archive Old Specs**: Move text-only versions to archive with explanation
7. **Begin Phase 0**: Start implementation with multi-modal input UI

---

**Document Status**: Planning Complete - Awaiting User Approval
**Estimated Total Effort**: 68-92 hours (was 32-40 hours)
**Effort Increase**: +36-52 hours (~2x original)
**Cost Increase**: +$0.01-0.03 per generation (Claude Vision API)
**Timeline Impact**: +2-3 weeks (was 1 sprint, now 2-3 sprints)
