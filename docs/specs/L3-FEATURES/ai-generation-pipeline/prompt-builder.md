# L3 Feature Specification: Prompt Builder System (Multi-Modal)

**Feature ID**: F-003
**Feature Name**: Prompt Builder (Multi-Modal with Claude Vision)
**Epic**: Asset Generation Pipeline (E-001)
**Status**: Ready for Implementation
**Created**: 2025-09-29
**Updated**: 2025-10-01 (MAJOR REVISION - Multi-modal architecture)
**Estimated Effort**: 68-92 hours (3-4 sprints)
**Previous Estimate**: 32-40 hours (text-only, archived)

---

## Feature Summary

The **Prompt Builder** is a multi-modal React-based system that enables users to create creatures through **three input methods**: drawing on canvas, uploading images, or describing in text. The system uses a **dual-API architecture** (Claude Vision + PixelLab.ai) to analyze visual inputs, assign game attributes, and generate pixel art sprites while preserving the user's drawing style.

### User Vision (Updated)

From user's direct confirmation:
> "We need drawing/image/text for MVP"

> "Claude API will analyze submission for game attribute assignment"

> "User needs to feel like their drawing matters"

**Core Requirements**:
- **Three input methods**: Drawing canvas + text description + image upload (ALL MVP)
- **AI analyzes everything**: Claude Vision API determines attributes, abilities, stats, animations
- **Style preservation**: User's drawing style must be visible in final sprite (L0 Vision requirement)
- **20+ animations per creature**: Assigned based on AI analysis
- **Desktop-first**: Mobile support post-MVP

---

## Architecture Overview

### Dual-API System

```
USER INPUT (3 methods)
├─ 🎨 Drawing Canvas (HTML5 Canvas)
├─ 📝 Text Description (500 chars)
└─ 📤 Image Upload (PNG/JPG, 5MB)
         ↓
INPUT NORMALIZATION
All inputs → 512x512 PNG base64
         ↓
PARALLEL PROCESSING
┌────────────────────┬─────────────────────┐
│ CLAUDE VISION API  │  PIXELAB.AI API     │
│ (Attribute         │  (Sprite            │
│  Assignment)       │   Generation)       │
│ ↓                  │  ↓                  │
│ • Creature concept │  • Generate sprite  │
│ • Visual features  │  • Preserve style   │
│ • Abilities        │  • Return frames    │
│ • Stats            │                     │
│ • Animations (20+) │                     │
└────────────────────┴─────────────────────┘
         ↓
ANIMATION MAPPING
Claude suggestions → Animation Library IDs
         ↓
STYLE VALIDATION
Original vs Generated → Pass/Fail + Score
         ↓
COMPLETE CREATURE
Sprite + Attributes + Animations + Style
```

### Data Flow Comparison

**TEXT INPUT PATH** (rule-based, free):
```
Text → Keyword Extraction → Template Matching → StructuredPrompt
→ PixelLab (text prompt) → Sprite
```

**VISUAL INPUT PATH** (AI-powered, $0.01-0.03 per generation):
```
Drawing/Upload → Normalize Image → Claude Vision Analysis
→ Attributes + Animations + Style Characteristics
→ PixelLab (with style hints) → Sprite (style preserved)
→ Style Validation → Pass/Fail + Regenerate option
```

---

## Core Components

### Phase 0: Multi-Modal Input UI (NEW)

#### 1. Input Method Selector (1-2 hours)
**Component**: `<InputMethodSelector />`
**What users see**: Three-button toggle to choose input method

```tsx
<InputMethodSelector>
  <button icon="🎨">Draw It</button>
  <button icon="📝">Describe It</button>
  <button icon="📤">Upload It</button>
</InputMethodSelector>
```

**Features**:
- Visual icons for each method
- Active state highlighting
- Keyboard navigation (Tab, Enter)
- Mobile-friendly touch targets

**State Management**:
```typescript
interface InputMethodState {
  selectedMethod: 'draw' | 'text' | 'upload';
  switchMethod: (method: string) => void;
}
```

---

#### 2. Drawing Canvas Interface (8-12 hours) - MAJOR NEW COMPONENT
**Component**: `<DrawingCanvas />`
**What users see**: HTML5 Canvas with drawing tools

```tsx
<DrawingCanvas>
  <Canvas width={512} height={512} />
  <Toolbar>
    <BrushSizeSelector sizes={['small', 'medium', 'large']} />
    <ColorPicker presets={8} customPicker />
    <Tool icon="✏️" name="Brush" />
    <Tool icon="🧹" name="Eraser" />
    <Button icon="↶">Undo (50 steps)</Button>
    <Button icon="↷">Redo</Button>
    <Button icon="🗑️">Clear Canvas</Button>
  </Toolbar>
  <ExportButton>Use This Drawing</ExportButton>
</DrawingCanvas>
```

**Technical Details**:
- Canvas size: 512x512px (high detail, downscaled for processing)
- Drawing library: react-canvas-draw (lightweight, MVP-ready)
- Touch support: Works with mouse, trackpad, touch screens, stylus
- Undo/Redo: Up to 50 steps (stored in memory)
- Export format: Canvas blob → PNG base64

**User Experience**:
- Smooth line rendering (Bezier curves)
- Pressure sensitivity (if stylus detected)
- No lag on stroke input (<16ms latency)
- Mobile optimization (larger touch targets)

---

#### 3. Image Upload Interface (3-4 hours) - NEW COMPONENT
**Component**: `<ImageUpload />`
**What users see**: Drag-and-drop zone with file picker fallback

```tsx
<ImageUpload>
  <DropZone>
    <Icon>📤</Icon>
    <Text>Drag image here or click to browse</Text>
    <Hint>PNG/JPG, max 5MB</Hint>
  </DropZone>
  {preview && (
    <PreviewPanel>
      <img src={preview} alt="Uploaded image" />
      <Button>Use This Image</Button>
      <Button variant="secondary">Try Different Image</Button>
    </PreviewPanel>
  )}
</ImageUpload>
```

**Features**:
- Drag-and-drop detection (highlight on hover)
- File picker button (accessibility fallback)
- File validation (PNG/JPG only, max 5MB)
- Image preview before submission
- Error messages for invalid files

**Validation**:
```typescript
function validateUpload(file: File): ValidationResult {
  if (!['image/png', 'image/jpeg'].includes(file.type)) {
    return { valid: false, error: 'Only PNG and JPG images are supported' };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { valid: false, error: 'Image must be under 5MB' };
  }
  return { valid: true };
}
```

---

#### 4. Text Input Component (1-2 hours) - UPDATED
**Component**: `<TextPromptInput />` (existing, integrated into multi-modal system)
**What users see**: Textarea with character counter

```tsx
<TextPromptInput>
  <textarea placeholder="Describe your creature..." maxLength={500} />
  <CharacterCounter current={245} max={500} />
  <PreviewPanel description="armored knight with golden shield" />
  <button>Generate Creature</button>
</TextPromptInput>
```

**Changes from original spec**:
- Now one of three input options (not standalone)
- Shares submission button with other methods
- State synchronized with InputMethodSelector

---

### Phase 1: Backend - Input Processing (NEW)

#### 5. Input Normalization Service (4-6 hours) - NEW BACKEND SERVICE
**Service**: `InputNormalizer`
**What it does**: Convert all input types to standardized image format

**Functions**:
```typescript
class InputNormalizer {
  // Canvas blob → normalized image
  async normalizeDrawing(blob: Blob): Promise<NormalizedImage> {
    // 1. Convert blob to image
    // 2. Resize to 512x512 (maintain aspect ratio, pad if needed)
    // 3. Convert to PNG base64
    // 4. Return normalized format
  }

  // Uploaded file → normalized image
  async normalizeUpload(file: File): Promise<NormalizedImage> {
    // 1. Validate file type/size
    // 2. Read file as image
    // 3. Resize to 512x512
    // 4. Convert to PNG base64
    // 5. Return normalized format
  }

  // Text → placeholder image (for text-only path)
  async normalizeText(text: string): Promise<NormalizedImage | null> {
    // For text-only input, return null (no image needed)
    // Claude Vision won't be called for pure text
    return null;
  }
}

interface NormalizedImage {
  base64: string; // PNG format
  dimensions: { width: number; height: number }; // Always 512x512
  format: 'png';
  metadata: {
    originalFormat?: string;
    originalSize?: { width: number; height: number };
    compressionApplied: boolean;
  };
}
```

---

### Phase 2: Backend - Claude Vision Integration (NEW)

#### 6. Claude Vision Service (10-14 hours) - MAJOR NEW SERVICE
**Service**: `ClaudeVisionService`
**What it does**: Analyze images using Claude Vision API to extract creature concept and assign game attributes

**Core Function**:
```typescript
class ClaudeVisionService {
  async analyzeCreature(
    image: NormalizedImage,
    textContext?: string // Optional text from user
  ): Promise<ClaudeAnalysisResult> {
    // 1. Construct prompt for Claude Vision API
    const prompt = this.buildAnalysisPrompt(textContext);

    // 2. Call Claude Vision API
    const response = await this.claudeClient.messages.create({
      model: 'claude-3-sonnet-20240229', // Vision-enabled model
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: image.base64
            }
          },
          {
            type: 'text',
            text: prompt
          }
        ]
      }]
    });

    // 3. Parse structured response
    return this.parseClaudeResponse(response);
  }

  private buildAnalysisPrompt(textContext?: string): string {
    return `You are analyzing a user's drawing for a game creature.

${textContext ? `User's description: "${textContext}"` : ''}

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
  "suggestedAnimations": ["idle", "walk", "attack", "melee", "ranged", "death", "etc"],
  "styleCharacteristics": ["bold lines", "bright colors", "cartoonish", etc]
}

Guidelines:
- Be creative but grounded in what you see
- Assign balanced stats (total ~100-150 points)
- Suggest 15-25 animations based on creature type and abilities
- Identify visual style (line quality, color palette, drawing style)
`;
  }

  private parseClaudeResponse(response: any): ClaudeAnalysisResult {
    // Parse JSON from Claude's response
    // Validate structure
    // Apply defaults for missing fields
    // Return typed result
  }
}

interface ClaudeAnalysisResult {
  creatureType: 'unit' | 'effect' | 'terrain';
  concept: string; // "fire dragon", "armored knight", etc.
  visualFeatures: string[]; // ["large wings", "scales", "breathing fire"]
  impliedAbilities: string[]; // ["melee attack", "fire breath", "flight"]
  stats: {
    health: number;
    attack: number;
    defense: number;
    speed: number;
  };
  suggestedAnimations: string[]; // 15-25 animation names
  styleCharacteristics: string[]; // ["bold lines", "vibrant colors", etc]
}
```

**Error Handling**:
```typescript
try {
  const result = await claudeVisionService.analyzeCreature(image);
} catch (error) {
  if (error.code === 'rate_limit') {
    // Retry after exponential backoff
  } else if (error.code === 'invalid_image') {
    // Return user-friendly error
  } else {
    // Fall back to rule-based template matching
  }
}
```

**Cost Tracking**:
```typescript
class ClaudeVisionService {
  private async trackCost(tokensUsed: number) {
    const costPerToken = 0.000003; // $3 per 1M tokens (Sonnet pricing)
    const cost = tokensUsed * costPerToken;

    await metrics.recordCost({
      service: 'claude-vision',
      cost: cost,
      tokensUsed: tokensUsed,
      timestamp: new Date()
    });
  }
}
```

---

### Phase 3: Backend - Animation & Style Processing (NEW)

#### 7. Animation Mapper Service (6-8 hours) - NEW SERVICE
**Service**: `AnimationMapper`
**What it does**: Map Claude's animation suggestions to actual animation IDs from the 50+ animation library

**Functions**:
```typescript
class AnimationMapper {
  async mapAnimations(
    claudeResult: ClaudeAnalysisResult
  ): Promise<AnimationSet> {
    // 1. Load animation library (50-100 animations)
    const library = await this.loadAnimationLibrary();

    // 2. Map Claude's suggestions to library IDs
    const mappedAnimations = this.matchSuggestions(
      claudeResult.suggestedAnimations,
      library
    );

    // 3. Ensure base animations present (idle, walk, attack, death)
    const withBase = this.ensureBaseAnimations(mappedAnimations);

    // 4. Add ability-specific animations
    const withAbilities = this.addAbilityAnimations(
      withBase,
      claudeResult.impliedAbilities
    );

    // 5. Return complete animation set (20+ animations)
    return withAbilities;
  }

  private matchSuggestions(
    suggestions: string[],
    library: AnimationDefinition[]
  ): AnimationSet {
    const matched: AnimationSet = {
      idle: null,
      walk: null,
      attack: null,
      death: null,
      specials: []
    };

    for (const suggestion of suggestions) {
      // Fuzzy match suggestion to library animation
      const libraryAnim = this.findBestMatch(suggestion, library);
      if (libraryAnim) {
        this.addToSet(matched, libraryAnim);
      }
    }

    return matched;
  }

  private ensureBaseAnimations(animations: AnimationSet): AnimationSet {
    // If any base animation missing, assign default
    if (!animations.idle) {
      animations.idle = 'idle_default';
    }
    if (!animations.walk) {
      animations.walk = 'walk_default';
    }
    if (!animations.attack) {
      animations.attack = 'attack_melee_default';
    }
    if (!animations.death) {
      animations.death = 'death_default';
    }
    return animations;
  }
}

interface AnimationSet {
  idle: string; // Animation ID
  walk: string;
  attack: string;
  death: string;
  specials: string[]; // 15-20 additional animations
}
```

**Animation Library Structure**:
```typescript
interface AnimationDefinition {
  id: string; // 'attack_melee_sword_01'
  name: string; // 'Sword Slash'
  category: 'idle' | 'movement' | 'attack' | 'ability' | 'death';
  tags: string[]; // ['melee', 'sword', 'physical']
  frames: number; // Number of animation frames
  fps: number; // Playback speed
}

// Example library (50-100 animations total)
const animationLibrary: AnimationDefinition[] = [
  // Idle animations (5-10)
  { id: 'idle_default', name: 'Idle', category: 'idle', tags: ['base'], frames: 4, fps: 8 },
  { id: 'idle_breathing', name: 'Breathing Idle', category: 'idle', tags: ['organic'], frames: 6, fps: 6 },

  // Movement animations (10-15)
  { id: 'walk_default', name: 'Walk', category: 'movement', tags: ['base'], frames: 6, fps: 12 },
  { id: 'run_default', name: 'Run', category: 'movement', tags: ['fast'], frames: 8, fps: 16 },
  { id: 'fly_default', name: 'Fly', category: 'movement', tags: ['aerial'], frames: 6, fps: 10 },

  // Attack animations (20-30)
  { id: 'attack_melee_sword', name: 'Sword Slash', category: 'attack', tags: ['melee', 'sword'], frames: 8, fps: 15 },
  { id: 'attack_melee_punch', name: 'Punch', category: 'attack', tags: ['melee', 'unarmed'], frames: 6, fps: 15 },
  { id: 'attack_ranged_bow', name: 'Shoot Arrow', category: 'attack', tags: ['ranged', 'bow'], frames: 10, fps: 15 },
  { id: 'attack_magic_fireball', name: 'Cast Fireball', category: 'attack', tags: ['magic', 'fire'], frames: 12, fps: 12 },

  // Ability animations (15-25)
  { id: 'ability_heal', name: 'Heal', category: 'ability', tags: ['buff', 'magic'], frames: 8, fps: 10 },
  { id: 'ability_shield', name: 'Raise Shield', category: 'ability', tags: ['defense', 'buff'], frames: 6, fps: 12 },
  { id: 'ability_dash', name: 'Dash', category: 'ability', tags: ['movement', 'fast'], frames: 4, fps: 20 },

  // Death animations (5-10)
  { id: 'death_default', name: 'Death', category: 'death', tags: ['base'], frames: 8, fps: 10 },
  { id: 'death_explosion', name: 'Explode', category: 'death', tags: ['dramatic'], frames: 12, fps: 15 },
  // ... 20-40 more animations
];
```

---

#### 8. Style Preservation Validator (4-6 hours) - NEW SERVICE
**Service**: `StylePreservationValidator`
**What it does**: Compare user's original drawing to PixelLab's generated sprite to verify style preservation

**Functions**:
```typescript
class StylePreservationValidator {
  async validate(
    originalImage: NormalizedImage,
    generatedSprite: Image,
    styleCharacteristics: string[]
  ): Promise<StylePreservationResult> {
    // 1. Extract color palettes
    const originalColors = await this.extractColorPalette(originalImage);
    const generatedColors = await this.extractColorPalette(generatedSprite);

    // 2. Compare color similarity
    const colorScore = this.compareColorPalettes(originalColors, generatedColors);

    // 3. Compare shape similarity (basic edge detection)
    const shapeScore = await this.compareShapes(originalImage, generatedSprite);

    // 4. Calculate overall score
    const overallScore = (colorScore * 0.6) + (shapeScore * 0.4); // Weight colors more

    // 5. Generate user feedback
    const passed = overallScore >= 0.6; // 60% threshold
    const feedback = this.generateFeedback(passed, colorScore, shapeScore);

    return {
      passed,
      colorSimilarity: colorScore,
      shapeSimilarity: shapeScore,
      overallScore,
      feedback
    };
  }

  private extractColorPalette(image: Image): string[] {
    // Use color quantization algorithm (k-means clustering)
    // Extract top 8 dominant colors
    // Return as hex strings
  }

  private compareColorPalettes(original: string[], generated: string[]): number {
    // Calculate color distance between palettes
    // Return similarity score 0-1
  }

  private async compareShapes(original: Image, generated: Image): number {
    // Apply edge detection (Canny algorithm)
    // Compare edge patterns
    // Return similarity score 0-1
  }

  private generateFeedback(
    passed: boolean,
    colorScore: number,
    shapeScore: number
  ): string {
    if (passed) {
      return "Your drawing style has been preserved! The sprite looks great.";
    } else if (colorScore < 0.4) {
      return "The colors don't match your drawing well. Try regenerating.";
    } else if (shapeScore < 0.4) {
      return "The shape differs from your drawing. Try regenerating.";
    } else {
      return "The style is close but not perfect. You can regenerate or accept.";
    }
  }
}

interface StylePreservationResult {
  passed: boolean;
  colorSimilarity: number; // 0-1
  shapeSimilarity: number; // 0-1
  overallScore: number; // 0-1
  feedback: string; // User-facing message
}
```

---

### Phase 4: Backend - Orchestration (UPDATED)

#### 9. Prompt Enhancement Service (6-8 hours refactoring) - UPDATED
**Service**: `PromptEnhancementService` (existing, major updates)
**What it does**: Route input to appropriate processing path (text-only OR visual + Claude)

**Updated Architecture**:
```typescript
class PromptEnhancementService {
  async enhance(input: UserInput): Promise<StructuredPrompt> {
    // ROUTING LOGIC
    if (input.type === 'text' && !input.image) {
      // TEXT-ONLY PATH: Rule-based (existing logic)
      return this.enhanceFromText(input.text);
    } else {
      // VISUAL PATH: Claude Vision + PixelLab
      const normalizedImage = await inputNormalizer.normalize(input);
      const claudeResult = await claudeVisionService.analyze(
        normalizedImage,
        input.text // Optional text context
      );
      return this.enhanceFromClaudeAnalysis(claudeResult, normalizedImage);
    }
  }

  // EXISTING: Rule-based text enhancement (50+ templates)
  private enhanceFromText(text: string): StructuredPrompt {
    // 1. Keyword extraction
    const keywords = keywordExtractor.extract(text);

    // 2. Template matching
    const template = templateMatcher.match(keywords);

    // 3. Modifier application
    const attributes = modifierApplier.apply(template.base, keywords.modifiers);

    // 4. Return structured prompt
    return {
      type: template.type,
      style: template.style,
      size: template.size,
      description: text,
      attributes: attributes,
      animations: template.animations,
      options: template.pixelLabOptions
    };
  }

  // NEW: Claude Vision-based enhancement
  private enhanceFromClaudeAnalysis(
    claudeResult: ClaudeAnalysisResult,
    originalImage: NormalizedImage
  ): StructuredPrompt {
    // 1. Map animations
    const animationSet = animationMapper.mapAnimations(claudeResult);

    // 2. Build PixelLab prompt with style hints
    const pixelLabPrompt = this.buildPixelLabPrompt(
      claudeResult.concept,
      claudeResult.styleCharacteristics
    );

    // 3. Return structured prompt
    return {
      type: claudeResult.creatureType,
      style: this.inferStyle(claudeResult.styleCharacteristics),
      size: this.inferSize(claudeResult.visualFeatures),
      description: claudeResult.concept,
      attributes: claudeResult.stats,
      animations: animationSet,
      styleHints: claudeResult.styleCharacteristics,
      originalImage: originalImage.base64, // For style comparison later
      options: {
        detail: 'high detail',
        shading: 'medium shading',
        outline: 'single color black outline',
        view: 'side',
        styleTransfer: true // Tell PixelLab to preserve style
      }
    };
  }

  private buildPixelLabPrompt(concept: string, styleHints: string[]): string {
    return `${concept}, pixel art, ${styleHints.join(', ')}, preserve original style`;
  }
}
```

---

#### 10. Express API Layer (1-2 hours updates) - UPDATED
**Endpoint**: `POST /api/generate`
**What it does**: Accept multi-modal inputs (text, drawing blob, or uploaded file)

**Updated Request Handling**:
```typescript
// Express route with file upload support
app.post('/api/generate',
  upload.single('image'), // Multer middleware for file uploads
  validateInput, // Validation middleware
  async (req: Request, res: Response) => {
    const { userId, description, inputType } = req.body;
    const imageFile = req.file; // From canvas blob or upload

    let input: UserInput;

    if (inputType === 'text') {
      input = { type: 'text', text: description };
    } else if (inputType === 'draw' || inputType === 'upload') {
      input = {
        type: 'visual',
        image: imageFile,
        text: description || null // Optional text context
      };
    }

    // 1. Normalize input (if image)
    const normalizedImage = input.type === 'visual'
      ? await inputNormalizer.normalize(input.image)
      : null;

    // 2. Enhance prompt (routes to appropriate path)
    const structuredPrompt = await promptEnhancementService.enhance({
      ...input,
      normalizedImage
    });

    // 3. Submit job (existing pipeline)
    const result = await jobSubmitter.submitJob(userId, structuredPrompt);

    // 4. Return job ID
    res.status(202).json({
      jobId: result.jobId,
      status: result.status,
      inputType: inputType
    });
  }
);
```

**Request Format**:
```typescript
// TEXT INPUT
POST /api/generate
Content-Type: application/json
{
  "userId": "user123",
  "inputType": "text",
  "description": "armored knight with golden shield"
}

// DRAWING INPUT
POST /api/generate
Content-Type: multipart/form-data
{
  "userId": "user123",
  "inputType": "draw",
  "description": "fire dragon", // Optional text context
  "image": <canvas blob as file>
}

// UPLOAD INPUT
POST /api/generate
Content-Type: multipart/form-data
{
  "userId": "user123",
  "inputType": "upload",
  "description": null,
  "image": <uploaded file>
}
```

---

### Phase 5: Integration & Testing

#### 11. Parallel Processing (2-3 hours) - NEW ORCHESTRATION
**What it does**: Run Claude Vision + PixelLab APIs in parallel to minimize total wait time

**Implementation**:
```typescript
async function generateCreature(input: UserInput): Promise<Creature> {
  if (input.type === 'text') {
    // TEXT-ONLY PATH: Skip Claude Vision
    const prompt = await promptEnhancementService.enhanceFromText(input.text);
    const sprite = await pixelLabOrchestrator.generate(prompt);
    return { sprite, ...prompt };
  }

  // VISUAL PATH: Parallel Claude + PixelLab
  const normalizedImage = await inputNormalizer.normalize(input);

  // PARALLEL API CALLS
  const [claudeResult, pixelLabResult] = await Promise.all([
    claudeVisionService.analyze(normalizedImage, input.text),
    pixelLabOrchestrator.generateFromImage(normalizedImage, input.text)
  ]);

  // COMBINE RESULTS
  const animations = await animationMapper.mapAnimations(claudeResult);
  const styleValidation = await stylePreservationValidator.validate(
    normalizedImage,
    pixelLabResult.sprite,
    claudeResult.styleCharacteristics
  );

  return {
    spriteUrl: pixelLabResult.spriteSheetUrl,
    stats: claudeResult.stats,
    abilities: claudeResult.impliedAbilities,
    animations: animations,
    stylePreserved: styleValidation.passed,
    styleScore: styleValidation.overallScore,
    styleFeedback: styleValidation.feedback,
    claudeAnalysis: claudeResult // For debugging
  };
}
```

**Timing Estimates**:
- Sequential: Claude (3s) + PixelLab (30-50s) = 33-53s total
- Parallel: max(3s, 30-50s) = 30-50s total
- **Savings**: ~3-5 seconds (marginal, but user perceives as faster)

---

## Technology Stack

### Frontend
- **Framework**: React 18 + TypeScript
- **Drawing Library**: react-canvas-draw (lightweight, MVP-ready)
- **State Management**: Zustand (already in codebase)
- **File Upload**: React Dropzone
- **Build Tool**: Vite
- **Testing**: Vitest + React Testing Library

### Backend
- **Runtime**: Node.js + TypeScript
- **HTTP Server**: Express (with Multer for file uploads)
- **AI APIs**:
  - Claude Vision API (Anthropic) - Image analysis
  - PixelLab.ai API - Sprite generation
- **Image Processing**: Sharp (resize, normalize, extract colors)
- **Queue**: BullMQ (existing)
- **Cache**: Redis + Firestore (existing)
- **Testing**: Jest

---

## Implementation Phases

### Phase 0: Multi-Modal Input UI (14-20 hours)
**Dependencies**: None

**Tasks**:
1. Create Input Method Selector component (1-2 hrs)
2. Build Drawing Canvas component (8-12 hrs)
3. Build Image Upload component (3-4 hrs)
4. Implement Input Normalization service (4-6 hrs)
5. Write component tests (2-3 hrs)

**Deliverables**:
- ✅ User can select Draw/Text/Upload
- ✅ Drawing canvas works on desktop + mobile
- ✅ Image upload validates files
- ✅ All inputs normalize to 512x512 PNG

---

### Phase 1: Express API Server (5-7 hours)
**Dependencies**: Phase 0 (for testing)

**Tasks**:
1. Set up Express with file upload support (Multer) (2 hrs)
2. Create `/api/generate` endpoint with multi-modal handling (2 hrs)
3. Add validation middleware (image files, size limits) (1 hr)
4. Write integration tests (2 hrs)

**Deliverables**:
- ✅ API accepts text, canvas blobs, uploaded files
- ✅ Validation prevents invalid inputs
- ✅ Returns 202 with jobId

---

### Phase 2: Prompt Enhancement Service (26-34 hours)
**Dependencies**: Phase 1 (for API integration)

**Tasks**:
1. **Claude Vision Integration** (10-14 hrs):
   - Set up Claude API credentials
   - Implement ClaudeVisionService
   - Prompt engineering for consistent responses
   - Error handling + retry logic
   - Cost tracking
2. **Animation Mapper** (6-8 hrs):
   - Load animation library (50-100 definitions)
   - Implement fuzzy matching algorithm
   - Ensure base animations present
   - Add ability-specific animations
3. **Style Preservation Validator** (4-6 hrs):
   - Color palette extraction
   - Shape comparison (edge detection)
   - Scoring algorithm
   - User feedback generation
4. **Refactor Core Service** (3-4 hrs):
   - Implement routing (text vs visual paths)
   - Update enhanceFromText (existing logic)
   - Implement enhanceFromClaudeAnalysis (new logic)
5. **Comprehensive Tests** (4-6 hrs):
   - Unit tests for each service
   - Integration tests for dual-path routing
   - Mock Claude API responses

**Deliverables**:
- ✅ Claude Vision analyzes images successfully
- ✅ Animations mapped from Claude suggestions
- ✅ Style preservation validated
- ✅ Text-only path still works (rule-based)

---

### Phase 3: React Frontend (12-15 hours)
**Dependencies**: Phases 0, 1 (UI components + API)

**Tasks**:
1. Integrate Input Method Selector with routing (2 hrs)
2. Wire Drawing Canvas to API (2-3 hrs)
3. Wire Image Upload to API (1-2 hrs)
4. Update Text Input for multi-modal context (1 hr)
5. Implement loading states for each input method (2 hrs)
6. Add error handling and user feedback (2 hrs)
7. Write component tests (3-4 hrs)

**Deliverables**:
- ✅ All three input methods send data to API
- ✅ User sees loading states during processing
- ✅ Errors display user-friendly messages
- ✅ Preview shows generated creature

---

### Phase 4: Integration & Testing (11-16 hours)
**Dependencies**: All phases

**Tasks**:
1. Wire Express API to JobSubmitter (1 hr)
2. Wire Claude Vision Service (2-3 hrs)
3. Wire Animation Mapper (2-3 hrs)
4. Test parallel processing (Claude + PixelLab) (2-3 hrs)
5. End-to-end tests for all three input paths (3-4 hrs)
6. Style preservation validation tests (2-3 hrs)
7. Performance testing (concurrent users) (2-3 hrs)

**Deliverables**:
- ✅ Full flow: Input → Claude → PixelLab → Result
- ✅ Parallel processing reduces wait time
- ✅ Style preservation validation runs automatically
- ✅ System handles 50+ concurrent users

---

## Effort Breakdown

| Component | Phase 0 | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Total |
|-----------|---------|---------|---------|---------|---------|-------|
| **Frontend UI** | 14-20 hrs | - | - | 12-15 hrs | - | **26-35 hrs** |
| **Backend Services** | - | 5-7 hrs | 26-34 hrs | - | 11-16 hrs | **42-57 hrs** |
| **TOTAL** | **14-20 hrs** | **5-7 hrs** | **26-34 hrs** | **12-15 hrs** | **11-16 hrs** | **68-92 hrs** |

**Previous Estimate** (text-only): 32-40 hours
**NEW Estimate** (multi-modal): 68-92 hours
**Increase**: +36-52 hours (~2x)

---

## Cost Model

### TEXT INPUT PATH (Rule-Based)
- **Cost per generation**: $0 (free, rule-based templates)
- **Processing time**: <100ms (fast)
- **Quality**: Good for common creature types, limited creativity

### VISUAL INPUT PATH (AI-Powered)
- **Cost per generation**: $0.01-0.03 (Claude Vision API)
  - Claude 3 Sonnet: ~$0.01-0.015 per image
  - Plus PixelLab costs (same as text path)
- **Processing time**: 30-50 seconds total (parallel)
- **Quality**: Excellent, creative, style-preserved

**Expected Distribution** (MVP):
- 30% text input (free)
- 70% visual input (drawing/upload) ($0.01-0.03 each)

**Monthly Cost Estimate** (1000 generations):
- Text: 300 × $0 = $0
- Visual: 700 × $0.02 = $14
- **Total**: ~$14/month for Claude Vision (plus PixelLab costs)

---

## Performance Requirements

- **Input Normalization**: <1 second per image
- **Claude Vision Analysis**: <3 seconds per image
- **Animation Mapping**: <500ms
- **Style Validation**: <1 second
- **Total Processing Time**: <60 seconds (meets L0 requirement)
- **API Endpoint Response**: <200ms (not including generation)
- **Concurrent Requests**: Support 100 simultaneous users
- **Memory Usage**: <1GB for all services

---

## Success Metrics

### Functional
- ✅ All three input methods (draw, text, upload) work end-to-end
- ✅ 95%+ of submissions produce playable creatures (L0 metric)
- ✅ Claude Vision API returns valid analysis 95%+ of time
- ✅ Style preservation passes validation 80%+ of time
- ✅ Every creature has minimum 20 animations assigned

### Quality
- ✅ Test coverage >90% across all components
- ✅ Claude Vision analysis is accurate (manual review of 100 samples)
- ✅ Animation mapping feels appropriate 90%+ of time
- ✅ Style preservation score >0.6 for 80%+ of generations
- ✅ User satisfaction with style preservation >80%

### Performance
- ✅ Total generation time <60 seconds (L0 requirement)
- ✅ API response time <200ms
- ✅ Drawing canvas has no lag (<16ms latency)
- ✅ System handles 100 concurrent users without degradation

### Cost
- ✅ Average cost per generation <$0.03 (Claude Vision)
- ✅ Monthly Claude API costs <$500 for MVP user base
- ✅ No API rate limit issues during peak usage

---

## Risk Factors

### High Risk (Could Significantly Impact Effort)

**1. Claude Vision API Reliability**
- **Risk**: API downtime, rate limits, or inconsistent responses
- **Impact**: +4-6 hours for extensive retry logic
- **Mitigation**: Implement fallback to rule-based templates, retry with exponential backoff

**2. Style Preservation Accuracy**
- **Risk**: PixelLab doesn't preserve user's drawing style well
- **Impact**: +8-12 hours for manual adjustment UI
- **Mitigation**: Offer regeneration with adjustments, collect user feedback

**3. Drawing Canvas Performance**
- **Risk**: Canvas lags on mobile devices
- **Impact**: +4-6 hours for optimization
- **Mitigation**: Use lightweight library, test on low-end devices early

**4. Animation Mapping Complexity**
- **Risk**: Claude's suggestions don't map well to library
- **Impact**: +6-8 hours for manual fallback system
- **Mitigation**: Extensive prompt engineering, manual override option

### Medium Risk

**5. Image Preprocessing Quality**
- **Risk**: Normalization introduces artifacts, affects analysis
- **Mitigation**: Use high-quality image processing library (Sharp)

**6. Claude Vision Prompt Engineering**
- **Risk**: Inconsistent structured responses from Claude
- **Mitigation**: Extensive testing, response validation, fallback parsing

**7. File Upload Security**
- **Risk**: Malicious files uploaded
- **Mitigation**: Strict validation, file type checking, size limits

---

## Open Questions

1. **Claude Model Selection**: Sonnet vs Opus vs Haiku? (Cost/quality tradeoff)
2. **Style Validation Threshold**: 60% similarity required? (Too strict = frustration)
3. **Drawing Canvas Library**: Custom vs react-canvas-draw? (Effort tradeoff)
4. **Parallel vs Sequential APIs**: Claude + PixelLab parallel or sequential?
5. **Claude API Budget**: What's the monthly budget limit? **[BLOCKER]**
6. **Rate Limiting**: Per-user limits for Claude API calls?

---

## Dependencies

### External
- ✅ PixelLab API (already integrated)
- ❌ Claude Vision API (credentials needed)

### Internal
- ✅ JobSubmitter (backend/src/queue/job-submitter.ts) - COMPLETE
- ✅ Generation Queue (backend/src/queue/) - COMPLETE
- ✅ Progress Tracking (backend/src/progress/) - COMPLETE

### New Components (All To Be Built)
- ❌ Input Method Selector (frontend)
- ❌ Drawing Canvas (frontend)
- ❌ Image Upload (frontend)
- ❌ Input Normalizer (backend)
- ❌ Claude Vision Service (backend)
- ❌ Animation Mapper (backend)
- ❌ Style Preservation Validator (backend)

---

## Alignment with User Vision

✅ **"Drawing/image/text for MVP"** → Phase 0 creates all three input methods
✅ **"Claude API analyzes submission"** → Phase 2 integrates Claude Vision
✅ **"User needs to feel like their drawing matters"** → Style preservation validation
✅ **"20+ animations per creature"** → Animation Mapper ensures comprehensive animation sets
✅ **"Pass submission to PixelLab for rendering"** → Dual-API parallel processing
✅ **"Combine with game attributes"** → Claude assigns stats, abilities, animations

---

## Status

**Current**: L3 specification complete (multi-modal architecture)
**Next Steps**:
1. User approves multi-modal architecture and budget
2. Break down into L4 atomic tasks
3. Begin Phase 0 implementation (multi-modal input UI)

---

**Last Updated**: 2025-10-01
**Approver**: Pending user review
**Blockers**: Claude API budget approval (Question #5 in Open Questions)
