# L4 Task Breakdown: Prompt Builder System (Multi-Modal)

**Feature**: Prompt Builder (F-003)
**Epic**: Asset Generation Pipeline (E-001)
**Created**: 2025-10-01
**Updated**: 2025-10-01 (Multi-modal architecture)
**Total Estimated Effort**: 68-92 hours
**Total Tasks**: 41 atomic tasks

---

## Task Organization

Tasks are organized into 5 implementation phases:

```
Phase 0: Multi-Modal Input UI (14-20 hours) - 9 tasks
    ↓
Phase 1: Express API Updates (5-7 hours) - 5 tasks
    ↓
Phase 2: Claude Vision Integration (26-34 hours) - 13 tasks
    ↓
Phase 3: React Frontend Integration (12-15 hours) - 8 tasks
    ↓
Phase 4: Integration & Testing (11-16 hours) - 6 tasks
```

---

## Phase 0: Multi-Modal Input UI (14-20 hours)

### T-003-000: Create Input Method Selector component
**Effort**: 1-2 hours
**Dependencies**: None
**Priority**: P0 (Critical path)

**Description**: Create React component for users to toggle between Draw/Text/Upload input methods.

**Acceptance Criteria**:
- ✅ Three buttons: "Draw It" (🎨), "Describe It" (📝), "Upload It" (📤)
- ✅ Active state highlighting (visual feedback)
- ✅ State management with Zustand
- ✅ Keyboard navigation (Tab, Enter)
- ✅ Mobile-friendly touch targets (44px minimum)
- ✅ Responsive design (desktop + mobile)

**Test Requirements**:
```typescript
describe('InputMethodSelector', () => {
  it('should render three input method buttons');
  it('should highlight active method');
  it('should switch method on button click');
  it('should update Zustand state on switch');
  it('should support keyboard navigation');
  it('should have accessible button labels');
});
```

**Files to Create**:
- `/frontend/src/components/InputMethodSelector.tsx`
- `/frontend/src/components/InputMethodSelector.test.tsx`
- `/frontend/src/components/InputMethodSelector.module.css`

---

### T-003-001: Set up drawing canvas library
**Effort**: 2 hours
**Dependencies**: T-003-000
**Priority**: P0 (Critical path)

**Description**: Install and configure react-canvas-draw library for drawing functionality.

**Acceptance Criteria**:
- ✅ react-canvas-draw installed via npm/pnpm
- ✅ Library properly configured in package.json
- ✅ Type definitions available (@types or built-in)
- ✅ Canvas renders in test environment
- ✅ Touch events work on mobile browsers

**Test Requirements**:
```typescript
describe('Canvas Library Setup', () => {
  it('should import react-canvas-draw without errors');
  it('should render canvas element');
  it('should support touch events');
  it('should export canvas as blob');
});
```

**Files to Update**:
- `/frontend/package.json`
- `/frontend/pnpm-lock.yaml`

---

### T-003-002: Create Drawing Canvas component
**Effort**: 6-10 hours
**Dependencies**: T-003-001
**Priority**: P0 (Critical path)

**Description**: Build comprehensive drawing canvas component with tools, colors, undo/redo.

**Acceptance Criteria**:
- ✅ Canvas size: 512x512px
- ✅ Brush tool with 3 sizes (small, medium, large)
- ✅ Eraser tool
- ✅ Color picker with 8 presets + custom picker
- ✅ Undo/Redo (up to 50 steps)
- ✅ Clear canvas button
- ✅ Export to PNG blob
- ✅ Touch/mouse/stylus support
- ✅ No lag on stroke input (<16ms)

**Test Requirements**:
```typescript
describe('DrawingCanvas', () => {
  it('should render 512x512 canvas');
  it('should support brush size selection');
  it('should support color selection');
  it('should draw lines on mouse/touch input');
  it('should undo last stroke');
  it('should redo undone stroke');
  it('should clear canvas');
  it('should export canvas as PNG blob');
  it('should handle 50+ undo steps');
  it('should work on mobile touch screens');
});
```

**Files to Create**:
- `/frontend/src/components/DrawingCanvas/index.tsx`
- `/frontend/src/components/DrawingCanvas/Toolbar.tsx`
- `/frontend/src/components/DrawingCanvas/BrushSizeSelector.tsx`
- `/frontend/src/components/DrawingCanvas/ColorPicker.tsx`
- `/frontend/src/components/DrawingCanvas/DrawingCanvas.test.tsx`
- `/frontend/src/components/DrawingCanvas/DrawingCanvas.module.css`

---

### T-003-003: Create Image Upload component
**Effort**: 3-4 hours
**Dependencies**: T-003-000
**Priority**: P0 (Critical path)

**Description**: Build drag-and-drop image upload component with validation.

**Acceptance Criteria**:
- ✅ Drag-and-drop zone with hover highlighting
- ✅ File picker button (accessibility fallback)
- ✅ File validation (PNG/JPG only, max 5MB)
- ✅ Image preview before submission
- ✅ Error messages for invalid files
- ✅ Clear/retry functionality
- ✅ Responsive design

**Test Requirements**:
```typescript
describe('ImageUpload', () => {
  it('should render drop zone');
  it('should highlight on drag over');
  it('should accept PNG files');
  it('should accept JPG files');
  it('should reject files >5MB');
  it('should reject non-image files');
  it('should show preview after upload');
  it('should allow file picker selection');
  it('should display error for invalid files');
});
```

**Files to Create**:
- `/frontend/src/components/ImageUpload/index.tsx`
- `/frontend/src/components/ImageUpload/DropZone.tsx`
- `/frontend/src/components/ImageUpload/PreviewPanel.tsx`
- `/frontend/src/components/ImageUpload/ImageUpload.test.tsx`
- `/frontend/src/components/ImageUpload/ImageUpload.module.css`

---

### T-003-004: Update Text Input component for multi-modal
**Effort**: 1 hour
**Dependencies**: T-003-000
**Priority**: P1 (High)

**Description**: Integrate existing TextPromptInput into multi-modal system.

**Acceptance Criteria**:
- ✅ TextPromptInput renders when "Describe It" selected
- ✅ State synchronized with InputMethodSelector
- ✅ Character counter (500 max)
- ✅ Preview panel shows description
- ✅ Shares submit button with other methods

**Test Requirements**:
```typescript
describe('TextPromptInput (Multi-modal)', () => {
  it('should render when text method selected');
  it('should hide when other methods selected');
  it('should update Zustand state');
  it('should enforce 500 char limit');
  it('should display character counter');
});
```

**Files to Update**:
- `/frontend/src/components/TextPromptInput.tsx`
- `/frontend/src/components/TextPromptInput.test.tsx`

---

### T-003-005: Create Input Normalization Service (backend)
**Effort**: 4-6 hours
**Dependencies**: None (can run in parallel with frontend)
**Priority**: P0 (Critical path)

**Description**: Backend service to normalize all inputs to 512x512 PNG base64.

**Acceptance Criteria**:
- ✅ Normalize drawing blob → 512x512 PNG
- ✅ Normalize uploaded file → 512x512 PNG
- ✅ Maintain aspect ratio (pad if needed)
- ✅ Convert to base64 format
- ✅ Validate image format
- ✅ Return metadata (original size, format)

**Test Requirements**:
```typescript
describe('InputNormalizer', () => {
  it('should normalize 800x600 image to 512x512');
  it('should maintain aspect ratio with padding');
  it('should convert to PNG format');
  it('should convert to base64');
  it('should handle canvas blobs');
  it('should handle uploaded files');
  it('should validate image format');
  it('should return metadata');
});
```

**Files to Create**:
- `/backend/src/input/normalizer.service.ts`
- `/backend/src/input/types.ts`
- `/backend/tests/input/normalizer.test.ts`

---

### T-003-006: Add image processing library (Sharp)
**Effort**: 1 hour
**Dependencies**: T-003-005
**Priority**: P0 (Critical path)

**Description**: Install and configure Sharp library for image processing.

**Acceptance Criteria**:
- ✅ Sharp installed via npm/pnpm
- ✅ Properly configured in package.json
- ✅ Type definitions available
- ✅ Works in test environment
- ✅ No native module compilation issues

**Test Requirements**:
```typescript
describe('Sharp Setup', () => {
  it('should import sharp without errors');
  it('should resize images');
  it('should convert formats');
  it('should extract metadata');
});
```

**Files to Update**:
- `/backend/package.json`
- `/backend/pnpm-lock.yaml`

---

### T-003-007: Write Input Normalization tests
**Effort**: 2 hours
**Dependencies**: T-003-005, T-003-006
**Priority**: P1 (High)

**Description**: Comprehensive test suite for input normalization.

**Acceptance Criteria**:
- ✅ Test coverage >95%
- ✅ Tests for all input types (blob, file)
- ✅ Tests for various image sizes
- ✅ Tests for format conversion
- ✅ Tests for error handling

**Files to Create**:
- `/backend/tests/input/normalizer.integration.test.ts`

---

### T-003-008: Create multi-modal UI integration container
**Effort**: 2-3 hours
**Dependencies**: T-003-000, T-003-002, T-003-003, T-003-004
**Priority**: P0 (Critical path)

**Description**: Container component that orchestrates all input methods.

**Acceptance Criteria**:
- ✅ Renders InputMethodSelector
- ✅ Conditionally renders DrawingCanvas/TextInput/ImageUpload
- ✅ Manages shared state (Zustand)
- ✅ Single "Generate Creature" button
- ✅ Validates input before submission
- ✅ Shows loading/error states

**Test Requirements**:
```typescript
describe('PromptBuilderContainer', () => {
  it('should render input method selector');
  it('should show drawing canvas when Draw selected');
  it('should show text input when Describe selected');
  it('should show image upload when Upload selected');
  it('should validate input before submission');
  it('should show loading state during generation');
  it('should show error state on failure');
});
```

**Files to Create**:
- `/frontend/src/components/PromptBuilder/index.tsx`
- `/frontend/src/components/PromptBuilder/PromptBuilder.test.tsx`
- `/frontend/src/components/PromptBuilder/PromptBuilder.module.css`

---

## Phase 1: Express API Updates (5-7 hours)

### T-003-009: Install Multer for file uploads
**Effort**: 1 hour
**Dependencies**: None
**Priority**: P0 (Critical path)

**Description**: Install and configure Multer middleware for handling file uploads.

**Acceptance Criteria**:
- ✅ Multer installed via npm/pnpm
- ✅ Configured for multipart/form-data
- ✅ File size limit: 5MB
- ✅ Memory storage (no disk writes)
- ✅ Type definitions available

**Test Requirements**:
```typescript
describe('Multer Setup', () => {
  it('should accept file uploads');
  it('should reject files >5MB');
  it('should parse multipart/form-data');
});
```

**Files to Update**:
- `/backend/package.json`
- `/backend/pnpm-lock.yaml`

---

### T-003-010: Update /api/generate endpoint for multi-modal
**Effort**: 2 hours
**Dependencies**: T-003-009
**Priority**: P0 (Critical path)

**Description**: Update Express endpoint to handle text, canvas blobs, and uploaded files.

**Acceptance Criteria**:
- ✅ Accepts `inputType` parameter (text/draw/upload)
- ✅ Handles multipart/form-data for images
- ✅ Validates input based on type
- ✅ Routes to appropriate processing path
- ✅ Returns 202 with jobId

**Test Requirements**:
```typescript
describe('POST /api/generate (Multi-modal)', () => {
  it('should accept text input');
  it('should accept canvas blob');
  it('should accept uploaded file');
  it('should validate inputType');
  it('should validate file size');
  it('should return 202 with jobId');
  it('should handle missing inputType');
});
```

**Files to Update**:
- `/backend/src/api/routes/generate.routes.ts`
- `/backend/src/api/controllers/generate.controller.ts`

---

### T-003-011: Add validation middleware for images
**Effort**: 1 hour
**Dependencies**: T-003-009
**Priority**: P0 (Critical path)

**Description**: Middleware to validate image uploads (type, size).

**Acceptance Criteria**:
- ✅ Validates file type (PNG/JPG only)
- ✅ Validates file size (max 5MB)
- ✅ Returns 400 with clear error message
- ✅ Sanitizes file metadata

**Test Requirements**:
```typescript
describe('Image Validation Middleware', () => {
  it('should pass valid PNG files');
  it('should pass valid JPG files');
  it('should reject files >5MB');
  it('should reject non-image files');
  it('should return 400 with error message');
});
```

**Files to Create**:
- `/backend/src/api/middleware/image-validation.middleware.ts`
- `/backend/tests/api/middleware/image-validation.test.ts`

---

### T-003-012: Write API integration tests for multi-modal
**Effort**: 2-3 hours
**Dependencies**: T-003-010, T-003-011
**Priority**: P1 (High)

**Description**: Integration tests for all three input methods.

**Acceptance Criteria**:
- ✅ Test text input end-to-end
- ✅ Test canvas blob upload
- ✅ Test file upload
- ✅ Test validation errors
- ✅ Test coverage >90%

**Files to Create**:
- `/backend/tests/api/integration/generate-multimodal.test.ts`

---

### T-003-013: Update API documentation
**Effort**: 1 hour
**Dependencies**: T-003-010
**Priority**: P2 (Medium)

**Description**: Document multi-modal API endpoint with examples.

**Acceptance Criteria**:
- ✅ Document request format for all input types
- ✅ Include cURL examples
- ✅ Document response format
- ✅ Document error codes
- ✅ Include TypeScript types

**Files to Create**:
- `/backend/docs/api/generate-multimodal.md`

---

## Phase 2: Claude Vision Integration (26-34 hours)

### T-003-014: Set up Claude API credentials
**Effort**: 1 hour
**Dependencies**: None
**Priority**: P0 (Critical path)

**Description**: Configure Anthropic API credentials for Claude Vision.

**Acceptance Criteria**:
- ✅ API key stored in environment variables
- ✅ API key validated on startup
- ✅ Error handling for missing/invalid key
- ✅ Key not committed to repository

**Test Requirements**:
```typescript
describe('Claude API Setup', () => {
  it('should load API key from environment');
  it('should validate API key format');
  it('should throw error if key missing');
});
```

**Files to Update**:
- `/backend/.env.example`
- `/backend/src/config/claude.config.ts`

---

### T-003-015: Install Anthropic SDK
**Effort**: 1 hour
**Dependencies**: T-003-014
**Priority**: P0 (Critical path)

**Description**: Install and configure @anthropic-ai/sdk.

**Acceptance Criteria**:
- ✅ SDK installed via npm/pnpm
- ✅ Type definitions available
- ✅ Client initialized with API key
- ✅ Works in test environment

**Test Requirements**:
```typescript
describe('Anthropic SDK Setup', () => {
  it('should import SDK without errors');
  it('should create client with API key');
  it('should handle API calls');
});
```

**Files to Update**:
- `/backend/package.json`
- `/backend/pnpm-lock.yaml`

---

### T-003-016: Create Claude Vision Service
**Effort**: 6-8 hours
**Dependencies**: T-003-015
**Priority**: P0 (Critical path)

**Description**: Core service to analyze images using Claude Vision API.

**Acceptance Criteria**:
- ✅ `analyzeCreature()` function accepts image + optional text
- ✅ Constructs prompt for Claude Vision
- ✅ Calls Claude API with image
- ✅ Parses JSON response
- ✅ Returns typed ClaudeAnalysisResult
- ✅ Handles API errors gracefully
- ✅ Response time <3 seconds

**Test Requirements**:
```typescript
describe('ClaudeVisionService', () => {
  it('should analyze image and return structured result');
  it('should include creature concept');
  it('should include stats (health, attack, defense, speed)');
  it('should include 15-25 suggested animations');
  it('should include style characteristics');
  it('should handle API errors');
  it('should retry on rate limits');
  it('should complete in <3 seconds');
});
```

**Files to Create**:
- `/backend/src/claude/vision.service.ts`
- `/backend/src/claude/types.ts`
- `/backend/src/claude/prompts.ts`
- `/backend/tests/claude/vision.service.test.ts`

**Example Implementation**:
```typescript
interface ClaudeAnalysisResult {
  creatureType: 'unit' | 'effect' | 'terrain';
  concept: string;
  visualFeatures: string[];
  impliedAbilities: string[];
  stats: { health: number; attack: number; defense: number; speed: number };
  suggestedAnimations: string[];
  styleCharacteristics: string[];
}

class ClaudeVisionService {
  async analyzeCreature(
    image: NormalizedImage,
    textContext?: string
  ): Promise<ClaudeAnalysisResult> {
    const response = await this.claudeClient.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: image.base64 } },
          { type: 'text', text: this.buildAnalysisPrompt(textContext) }
        ]
      }]
    });
    return this.parseResponse(response);
  }
}
```

---

### T-003-017: Implement prompt engineering for Claude
**Effort**: 2-3 hours
**Dependencies**: T-003-016
**Priority**: P0 (Critical path)

**Description**: Craft and test prompts to get consistent structured responses.

**Acceptance Criteria**:
- ✅ Prompt instructs Claude to return JSON
- ✅ Prompt defines all required fields
- ✅ Prompt provides examples
- ✅ Prompt handles edge cases (abstract drawings, unclear inputs)
- ✅ 95%+ responses parse successfully

**Test Requirements**:
```typescript
describe('Claude Prompt Engineering', () => {
  it('should return valid JSON 95%+ of time');
  it('should include all required fields');
  it('should handle abstract drawings');
  it('should handle realistic drawings');
  it('should handle text descriptions');
});
```

**Files to Update**:
- `/backend/src/claude/prompts.ts`
- `/backend/tests/claude/prompts.test.ts`

---

### T-003-018: Add Claude API error handling
**Effort**: 2 hours
**Dependencies**: T-003-016
**Priority**: P0 (Critical path)

**Description**: Robust error handling for Claude API calls.

**Acceptance Criteria**:
- ✅ Handle rate limits (retry with exponential backoff)
- ✅ Handle invalid images
- ✅ Handle API downtime
- ✅ Handle malformed responses
- ✅ Fallback to rule-based templates on failure
- ✅ Log all errors with context

**Test Requirements**:
```typescript
describe('Claude Error Handling', () => {
  it('should retry on rate limits');
  it('should fallback on API errors');
  it('should handle invalid images');
  it('should handle malformed responses');
  it('should log errors');
});
```

**Files to Update**:
- `/backend/src/claude/vision.service.ts`
- `/backend/src/claude/error-handler.ts`

---

### T-003-019: Implement Claude cost tracking
**Effort**: 1-2 hours
**Dependencies**: T-003-016
**Priority**: P1 (High)

**Description**: Track Claude API usage and costs.

**Acceptance Criteria**:
- ✅ Track tokens used per request
- ✅ Calculate cost per request
- ✅ Record to metrics system
- ✅ Alert when approaching budget
- ✅ Daily/monthly cost summaries

**Test Requirements**:
```typescript
describe('Claude Cost Tracking', () => {
  it('should track tokens used');
  it('should calculate cost correctly');
  it('should record to metrics');
  it('should alert on budget threshold');
});
```

**Files to Create**:
- `/backend/src/claude/cost-tracker.ts`
- `/backend/tests/claude/cost-tracker.test.ts`

---

### T-003-020: Create Animation Library definitions
**Effort**: 3-4 hours
**Dependencies**: None (can run in parallel)
**Priority**: P0 (Critical path)

**Description**: Define 50-100 animation definitions for the library.

**Acceptance Criteria**:
- ✅ 50-100 animation definitions
- ✅ Categories: idle, movement, attack, ability, death
- ✅ Each definition has: id, name, category, tags, frames, fps
- ✅ Covers all common creature types
- ✅ TypeScript interfaces defined

**Test Requirements**:
```typescript
describe('Animation Library', () => {
  it('should have 50-100 animations');
  it('should have all categories represented');
  it('should validate animation schema');
  it('should have unique IDs');
});
```

**Files to Create**:
- `/backend/src/animations/library.ts`
- `/backend/src/animations/types.ts`
- `/backend/tests/animations/library.test.ts`

**Example Structure**:
```typescript
interface AnimationDefinition {
  id: string;
  name: string;
  category: 'idle' | 'movement' | 'attack' | 'ability' | 'death';
  tags: string[];
  frames: number;
  fps: number;
}

export const animationLibrary: AnimationDefinition[] = [
  { id: 'idle_default', name: 'Idle', category: 'idle', tags: ['base'], frames: 4, fps: 8 },
  { id: 'walk_default', name: 'Walk', category: 'movement', tags: ['base'], frames: 6, fps: 12 },
  // ... 48-98 more animations
];
```

---

### T-003-021: Create Animation Mapper Service
**Effort**: 4-6 hours
**Dependencies**: T-003-020, T-003-016
**Priority**: P0 (Critical path)

**Description**: Service to map Claude's suggestions to animation library IDs.

**Acceptance Criteria**:
- ✅ Maps Claude's animation suggestions to library IDs
- ✅ Fuzzy matching algorithm (handles typos, synonyms)
- ✅ Ensures base animations present (idle, walk, attack, death)
- ✅ Returns 20+ animations per creature
- ✅ Prioritizes ability-specific animations
- ✅ Response time <500ms

**Test Requirements**:
```typescript
describe('AnimationMapper', () => {
  it('should map suggestions to library IDs');
  it('should ensure base animations present');
  it('should return 20+ animations');
  it('should handle fuzzy matching');
  it('should prioritize abilities');
  it('should complete in <500ms');
});
```

**Files to Create**:
- `/backend/src/animations/mapper.service.ts`
- `/backend/tests/animations/mapper.test.ts`

---

### T-003-022: Implement fuzzy animation matching
**Effort**: 2-3 hours
**Dependencies**: T-003-021
**Priority**: P1 (High)

**Description**: Algorithm to match Claude's suggestions to library animations.

**Acceptance Criteria**:
- ✅ Levenshtein distance for typo tolerance
- ✅ Tag-based matching
- ✅ Synonym support
- ✅ Confidence scoring
- ✅ Fallback to defaults for no match

**Test Requirements**:
```typescript
describe('Fuzzy Animation Matching', () => {
  it('should match exact names');
  it('should handle typos');
  it('should match synonyms');
  it('should use tag-based matching');
  it('should return confidence scores');
});
```

**Files to Update**:
- `/backend/src/animations/matcher.ts`
- `/backend/tests/animations/matcher.test.ts`

---

### T-003-023: Create Style Preservation Validator
**Effort**: 4-6 hours
**Dependencies**: T-003-006 (Sharp library)
**Priority**: P0 (Critical path)

**Description**: Service to validate style preservation between original and generated.

**Acceptance Criteria**:
- ✅ Extract color palettes (8 dominant colors)
- ✅ Compare color similarity (0-1 score)
- ✅ Compare shape similarity (edge detection)
- ✅ Calculate overall score (60% threshold)
- ✅ Generate user feedback
- ✅ Response time <1 second

**Test Requirements**:
```typescript
describe('StylePreservationValidator', () => {
  it('should extract color palettes');
  it('should compare color similarity');
  it('should compare shape similarity');
  it('should calculate overall score');
  it('should pass if score >0.6');
  it('should generate user feedback');
  it('should complete in <1 second');
});
```

**Files to Create**:
- `/backend/src/style/validator.service.ts`
- `/backend/src/style/color-extractor.ts`
- `/backend/src/style/shape-comparator.ts`
- `/backend/tests/style/validator.test.ts`

---

### T-003-024: Implement color palette extraction
**Effort**: 2 hours
**Dependencies**: T-003-023
**Priority**: P1 (High)

**Description**: Extract dominant colors from images using k-means clustering.

**Acceptance Criteria**:
- ✅ Extract 8 dominant colors
- ✅ Return as hex strings
- ✅ Use k-means clustering algorithm
- ✅ Response time <500ms

**Test Requirements**:
```typescript
describe('Color Palette Extraction', () => {
  it('should extract 8 dominant colors');
  it('should return hex strings');
  it('should handle grayscale images');
  it('should complete in <500ms');
});
```

**Files to Update**:
- `/backend/src/style/color-extractor.ts`
- `/backend/tests/style/color-extractor.test.ts`

---

### T-003-025: Implement shape comparison
**Effort**: 2-3 hours
**Dependencies**: T-003-023
**Priority**: P1 (High)

**Description**: Compare shapes using edge detection (Canny algorithm).

**Acceptance Criteria**:
- ✅ Apply edge detection to both images
- ✅ Compare edge patterns
- ✅ Return similarity score (0-1)
- ✅ Response time <500ms

**Test Requirements**:
```typescript
describe('Shape Comparison', () => {
  it('should detect edges');
  it('should compare edge patterns');
  it('should return similarity score');
  it('should handle rotations');
  it('should complete in <500ms');
});
```

**Files to Update**:
- `/backend/src/style/shape-comparator.ts`
- `/backend/tests/style/shape-comparator.test.ts`

---

### T-003-026: Write comprehensive Claude integration tests
**Effort**: 4-6 hours
**Dependencies**: All Phase 2 tasks
**Priority**: P0 (Critical path)

**Description**: Integration tests for entire Claude Vision pipeline.

**Acceptance Criteria**:
- ✅ Test full analysis pipeline
- ✅ Test animation mapping
- ✅ Test style validation
- ✅ Mock Claude API responses
- ✅ Test error handling
- ✅ Test coverage >95%

**Files to Create**:
- `/backend/tests/claude/integration/claude-pipeline.test.ts`
- `/backend/tests/claude/integration/mock-responses.ts`

---

## Phase 3: React Frontend Integration (12-15 hours)

### T-003-027: Update Zustand store for multi-modal
**Effort**: 2 hours
**Dependencies**: Phase 0 complete
**Priority**: P0 (Critical path)

**Description**: Update state management to handle all three input methods.

**Acceptance Criteria**:
- ✅ Store manages inputMethod state
- ✅ Store manages canvas blob
- ✅ Store manages uploaded file
- ✅ Store manages text description
- ✅ Store manages loading/error states
- ✅ Store provides submitPrompt action

**Test Requirements**:
```typescript
describe('Prompt Store (Multi-modal)', () => {
  it('should manage inputMethod state');
  it('should store canvas blob');
  it('should store uploaded file');
  it('should store text description');
  it('should set loading state');
  it('should set error state');
});
```

**Files to Update**:
- `/frontend/src/store/promptStore.ts`
- `/frontend/src/store/promptStore.test.ts`

---

### T-003-028: Wire Drawing Canvas to API
**Effort**: 2-3 hours
**Dependencies**: T-003-027, Phase 1 complete
**Priority**: P0 (Critical path)

**Description**: Connect drawing canvas to backend API.

**Acceptance Criteria**:
- ✅ Export canvas as blob on submit
- ✅ Send blob to API with inputType=draw
- ✅ Show loading state during upload
- ✅ Handle upload errors
- ✅ Display success message

**Test Requirements**:
```typescript
describe('Drawing Canvas API Integration', () => {
  it('should export canvas as blob');
  it('should send blob to API');
  it('should show loading state');
  it('should handle errors');
  it('should display success message');
});
```

**Files to Update**:
- `/frontend/src/components/DrawingCanvas/index.tsx`
- `/frontend/src/api/client.ts`

---

### T-003-029: Wire Image Upload to API
**Effort**: 1-2 hours
**Dependencies**: T-003-027, Phase 1 complete
**Priority**: P0 (Critical path)

**Description**: Connect image upload to backend API.

**Acceptance Criteria**:
- ✅ Send file to API with inputType=upload
- ✅ Show loading state during upload
- ✅ Handle upload errors
- ✅ Display success message

**Test Requirements**:
```typescript
describe('Image Upload API Integration', () => {
  it('should send file to API');
  it('should show loading state');
  it('should handle errors');
  it('should display success message');
});
```

**Files to Update**:
- `/frontend/src/components/ImageUpload/index.tsx`
- `/frontend/src/api/client.ts`

---

### T-003-030: Update Text Input API integration
**Effort**: 1 hour
**Dependencies**: T-003-027, Phase 1 complete
**Priority**: P1 (High)

**Description**: Update text input to use multi-modal API.

**Acceptance Criteria**:
- ✅ Send text with inputType=text
- ✅ Compatible with multi-modal endpoint
- ✅ Handles response correctly

**Files to Update**:
- `/frontend/src/components/TextPromptInput.tsx`
- `/frontend/src/api/client.ts`

---

### T-003-031: Implement loading states for each method
**Effort**: 2 hours
**Dependencies**: T-003-028, T-003-029, T-003-030
**Priority**: P1 (High)

**Description**: Add loading indicators specific to each input method.

**Acceptance Criteria**:
- ✅ Drawing: "Analyzing your drawing..."
- ✅ Upload: "Processing your image..."
- ✅ Text: "Enhancing your description..."
- ✅ Progress bar or spinner
- ✅ Disable inputs during loading
- ✅ Cancel button

**Test Requirements**:
```typescript
describe('Loading States', () => {
  it('should show loading for drawing');
  it('should show loading for upload');
  it('should show loading for text');
  it('should disable inputs during loading');
  it('should allow cancellation');
});
```

**Files to Update**:
- `/frontend/src/components/PromptBuilder/LoadingState.tsx`
- `/frontend/src/components/PromptBuilder/LoadingState.test.tsx`

---

### T-003-032: Add error handling and feedback
**Effort**: 2 hours
**Dependencies**: T-003-028, T-003-029, T-003-030
**Priority**: P1 (High)

**Description**: User-friendly error messages for each input method.

**Acceptance Criteria**:
- ✅ Display clear error messages
- ✅ Suggest actions (retry, modify)
- ✅ Errors dismissible by user
- ✅ Errors clear on new input

**Test Requirements**:
```typescript
describe('Error Handling', () => {
  it('should display error message');
  it('should suggest retry action');
  it('should dismiss error on user action');
  it('should clear error on new input');
});
```

**Files to Update**:
- `/frontend/src/components/PromptBuilder/ErrorMessage.tsx`
- `/frontend/src/components/PromptBuilder/ErrorMessage.test.tsx`

---

### T-003-033: Create style preservation feedback UI
**Effort**: 2-3 hours
**Dependencies**: Phase 2 complete (style validation)
**Priority**: P1 (High)

**Description**: Show users style preservation results with regeneration option.

**Acceptance Criteria**:
- ✅ Side-by-side comparison (original vs generated)
- ✅ Display style score (0-100%)
- ✅ User feedback message
- ✅ "Accept" and "Regenerate" buttons
- ✅ Only shown for visual inputs

**Test Requirements**:
```typescript
describe('Style Preservation Feedback', () => {
  it('should show side-by-side comparison');
  it('should display style score');
  it('should show user feedback');
  it('should allow acceptance');
  it('should allow regeneration');
  it('should hide for text inputs');
});
```

**Files to Create**:
- `/frontend/src/components/StylePreservation/ComparisonView.tsx`
- `/frontend/src/components/StylePreservation/ComparisonView.test.tsx`
- `/frontend/src/components/StylePreservation/ComparisonView.module.css`

---

### T-003-034: Write frontend integration tests
**Effort**: 3-4 hours
**Dependencies**: All Phase 3 tasks
**Priority**: P0 (Critical path)

**Description**: Integration tests for complete frontend flow.

**Acceptance Criteria**:
- ✅ Test drawing → submission → preview
- ✅ Test upload → submission → preview
- ✅ Test text → submission → preview
- ✅ Test error scenarios
- ✅ Test loading states
- ✅ Test coverage >90%

**Files to Create**:
- `/frontend/tests/integration/prompt-builder.test.tsx`

---

## Phase 4: Integration & Testing (11-16 hours)

### T-003-035: Refactor Prompt Enhancement Service for routing
**Effort**: 3-4 hours
**Dependencies**: Phase 2 complete
**Priority**: P0 (Critical path)

**Description**: Update PromptEnhancementService to route between text and visual paths.

**Acceptance Criteria**:
- ✅ Route text-only to rule-based path
- ✅ Route visual to Claude Vision path
- ✅ Maintain backward compatibility
- ✅ Proper error handling for both paths

**Test Requirements**:
```typescript
describe('PromptEnhancementService (Routing)', () => {
  it('should route text to rule-based path');
  it('should route drawing to Claude path');
  it('should route upload to Claude path');
  it('should handle errors in both paths');
});
```

**Files to Update**:
- `/backend/src/prompt/enhancement.service.ts`
- `/backend/tests/prompt/enhancement.service.test.ts`

---

### T-003-036: Implement parallel processing (Claude + PixelLab)
**Effort**: 2-3 hours
**Dependencies**: T-003-035, Phase 2 complete
**Priority**: P1 (High)

**Description**: Run Claude Vision and PixelLab APIs in parallel.

**Acceptance Criteria**:
- ✅ Use Promise.all() for parallel execution
- ✅ Handle errors in either API
- ✅ Combine results correctly
- ✅ Total time = max(Claude, PixelLab), not sum

**Test Requirements**:
```typescript
describe('Parallel Processing', () => {
  it('should call both APIs in parallel');
  it('should combine results');
  it('should handle Claude error');
  it('should handle PixelLab error');
  it('should save time vs sequential');
});
```

**Files to Create**:
- `/backend/src/orchestration/parallel-processor.ts`
- `/backend/tests/orchestration/parallel-processor.test.ts`

---

### T-003-037: Wire all services to JobSubmitter
**Effort**: 2 hours
**Dependencies**: T-003-036
**Priority**: P0 (Critical path)

**Description**: Connect multi-modal pipeline to existing JobSubmitter.

**Acceptance Criteria**:
- ✅ Text path connects to JobSubmitter
- ✅ Visual path connects to JobSubmitter
- ✅ All metadata passed correctly
- ✅ Job created successfully

**Test Requirements**:
```typescript
describe('JobSubmitter Integration', () => {
  it('should submit text-based jobs');
  it('should submit visual-based jobs');
  it('should include all metadata');
  it('should return jobId');
});
```

**Files to Update**:
- `/backend/src/api/controllers/generate.controller.ts`
- `/backend/tests/api/integration/job-submission.test.ts`

---

### T-003-038: Write end-to-end tests for all paths
**Effort**: 3-4 hours
**Dependencies**: All previous tasks
**Priority**: P0 (Critical path)

**Description**: Comprehensive E2E tests for all three input methods.

**Acceptance Criteria**:
- ✅ E2E test: Drawing → Claude → PixelLab → Result
- ✅ E2E test: Upload → Claude → PixelLab → Result
- ✅ E2E test: Text → Templates → PixelLab → Result
- ✅ E2E test: Style validation flow
- ✅ E2E test: Error scenarios
- ✅ All tests pass

**Test Requirements**:
```typescript
describe('End-to-End Generation Flow', () => {
  it('should generate from drawing', async () => {
    const response = await fetch('/api/generate', {
      method: 'POST',
      body: createFormData({ inputType: 'draw', image: canvasBlob })
    });
    expect(response.status).toBe(202);
    const { jobId } = await response.json();

    const job = await waitForJobCompletion(jobId);
    expect(job.status).toBe('completed');
    expect(job.stats).toBeDefined();
    expect(job.animations.length).toBeGreaterThan(20);
    expect(job.styleScore).toBeGreaterThan(0.6);
  });

  it('should generate from upload');
  it('should generate from text');
  it('should validate style preservation');
  it('should handle API failures');
});
```

**Files to Create**:
- `/backend/tests/e2e/multimodal-generation.e2e.test.ts`

---

### T-003-039: Performance testing
**Effort**: 2-3 hours
**Dependencies**: T-003-038
**Priority**: P1 (High)

**Description**: Load testing and performance benchmarks.

**Acceptance Criteria**:
- ✅ Input normalization <1 second
- ✅ Claude Vision analysis <3 seconds
- ✅ Animation mapping <500ms
- ✅ Style validation <1 second
- ✅ Total processing <60 seconds
- ✅ System handles 100 concurrent users

**Test Requirements**:
```typescript
describe('Performance Tests', () => {
  it('should normalize input in <1s');
  it('should analyze with Claude in <3s');
  it('should map animations in <500ms');
  it('should validate style in <1s');
  it('should complete total flow in <60s');
  it('should handle 100 concurrent requests');
});
```

**Files to Create**:
- `/backend/tests/performance/multimodal.perf.test.ts`

---

### T-003-040: Update documentation with examples
**Effort**: 2 hours
**Dependencies**: All previous tasks
**Priority**: P2 (Medium)

**Description**: Comprehensive documentation with examples for all input methods.

**Acceptance Criteria**:
- ✅ Document all three input methods
- ✅ Include code examples
- ✅ Include API examples
- ✅ Document cost model
- ✅ Document error handling

**Files to Create**:
- `/docs/guides/multimodal-prompt-builder.md`
- `/docs/guides/claude-vision-integration.md`

---

## Summary by Phase

### Phase 0: Multi-Modal Input UI (9 tasks, 14-20 hours)
- Input Method Selector
- Drawing Canvas (major component)
- Image Upload
- Text Input updates
- Input Normalization Service
- Testing

### Phase 1: Express API Updates (5 tasks, 5-7 hours)
- Multer setup
- API endpoint updates
- Image validation
- Integration tests
- Documentation

### Phase 2: Claude Vision Integration (13 tasks, 26-34 hours)
- Claude API setup
- Vision Service
- Prompt engineering
- Animation Library (50-100 definitions)
- Animation Mapper
- Style Preservation Validator
- Comprehensive testing

### Phase 3: React Frontend Integration (8 tasks, 12-15 hours)
- Zustand updates
- Canvas API integration
- Upload API integration
- Text API integration
- Loading/error states
- Style feedback UI
- Integration tests

### Phase 4: Integration & Testing (6 tasks, 11-16 hours)
- Service refactoring
- Parallel processing
- JobSubmitter wiring
- E2E tests
- Performance tests
- Documentation

---

## Total Summary

**Total Tasks**: 41 atomic tasks
**Total Effort**: 68-92 hours
**Total Phases**: 5 phases
**Timeline**: 3-4 sprints

---

## Dependency Graph

```
Phase 0 (Multi-Modal UI)
    ├─→ Phase 1 (Express API) [depends on Phase 0 for testing]
    └─→ Phase 2 (Claude Vision) [can run in parallel with Phase 0]
            ↓
        Phase 3 (Frontend Integration) [depends on Phase 0, 1, 2]
            ↓
        Phase 4 (Integration & Testing) [depends on all previous]
```

---

## Parallel Work Opportunities

**Week 1-2** (Phases 0 & 2 in parallel):
- Team A: Frontend UI (Drawing Canvas, Upload, Selector)
- Team B: Claude Vision Integration (API setup, Vision Service, Animation Library)

**Week 3** (Phases 1 & 2):
- Team A: Express API updates
- Team B: Animation Mapper, Style Validator

**Week 4** (Phase 3):
- Full team: Frontend integration

**Week 5** (Phase 4):
- Full team: Integration, testing, optimization

---

## Risk Mitigation

### High Risk Tasks
- T-003-016: Claude Vision Service (8 hrs) - Prompt engineering complexity
- T-003-002: Drawing Canvas (10 hrs) - Mobile performance
- T-003-023: Style Validator (6 hrs) - Accuracy concerns

**Mitigation**: Allocate extra buffer time, test early with real images

### Medium Risk Tasks
- T-003-021: Animation Mapper (6 hrs) - Fuzzy matching complexity
- T-003-036: Parallel Processing (3 hrs) - Error handling coordination

**Mitigation**: Extensive testing, fallback strategies

---

## Next Steps

1. **Review L4 Tasks** - Validate completeness
2. **Begin Phase 0** - Start with T-003-000 (Input Method Selector)
3. **Set up Claude API** - Get credentials (T-003-014)
4. **Run /implement-task T-003-000** - Begin TDD implementation

---

**Last Updated**: 2025-10-01
**Status**: Ready for implementation
**Approvals**: Budget ✅, Architecture ✅, Effort ✅
