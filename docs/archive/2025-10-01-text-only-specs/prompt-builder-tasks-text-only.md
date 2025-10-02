# L4 Task Breakdown: Prompt Builder System

**Feature**: Prompt Builder (F-003)
**Epic**: Asset Generation Pipeline (E-001)
**Created**: 2025-10-01
**Total Estimated Effort**: 32-40 hours
**Total Tasks**: 24 atomic tasks

---

## Task Organization

Tasks are organized into 4 implementation phases with clear dependencies:

```
Phase 1: Express API Server (5 tasks, 4-6 hours)
    ↓
Phase 2: Prompt Enhancement Service (9 tasks, 14-16 hours)
    ↓
Phase 3: React Frontend (7 tasks, 9-11 hours)
    ↓
Phase 4: Integration & Testing (3 tasks, 5-7 hours)
```

---

## Phase 1: Express API Server

### T-003-001: Set up Express server with TypeScript
**Effort**: 1 hour
**Dependencies**: None
**Priority**: P0 (Critical path)

**Description**: Create basic Express server infrastructure with TypeScript configuration, CORS, and JSON parsing middleware.

**Acceptance Criteria**:
- ✅ Express server starts on configurable port
- ✅ CORS enabled for frontend origin
- ✅ JSON body parsing middleware configured
- ✅ Health check endpoint `/api/health` returns 200
- ✅ TypeScript compiles without errors

**Test Requirements**:
```typescript
describe('Express Server', () => {
  it('should start server on configured port');
  it('should respond to health check');
  it('should parse JSON request bodies');
  it('should handle CORS for allowed origins');
  it('should reject requests with invalid JSON');
});
```

**Files to Create**:
- `/backend/src/api/server.ts`
- `/backend/src/api/config.ts`
- `/backend/tests/api/server.test.ts`

---

### T-003-002: Create request validation middleware
**Effort**: 1 hour
**Dependencies**: T-003-001
**Priority**: P0 (Critical path)

**Description**: Implement middleware to validate incoming generation requests (userId, description).

**Acceptance Criteria**:
- ✅ Validates userId is non-empty string
- ✅ Validates description is non-empty string
- ✅ Validates description length ≤500 characters
- ✅ Returns 400 with clear error message for invalid input
- ✅ Sanitizes input to prevent XSS

**Test Requirements**:
```typescript
describe('Validation Middleware', () => {
  it('should pass valid requests');
  it('should reject missing userId');
  it('should reject missing description');
  it('should reject empty description');
  it('should reject description >500 characters');
  it('should sanitize HTML in description');
  it('should return 400 with error message');
});
```

**Files to Create**:
- `/backend/src/api/middleware/validation.middleware.ts`
- `/backend/tests/api/middleware/validation.test.ts`

---

### T-003-003: Create error handling middleware
**Effort**: 1 hour
**Dependencies**: T-003-001
**Priority**: P0 (Critical path)

**Description**: Implement centralized error handling middleware for consistent error responses.

**Acceptance Criteria**:
- ✅ Catches all unhandled errors
- ✅ Returns appropriate HTTP status codes
- ✅ Returns consistent error response format
- ✅ Logs errors with context
- ✅ Doesn't leak internal error details to client

**Test Requirements**:
```typescript
describe('Error Handling Middleware', () => {
  it('should catch and format errors');
  it('should return 500 for internal errors');
  it('should return 400 for validation errors');
  it('should log error details');
  it('should not expose stack traces in production');
});
```

**Files to Create**:
- `/backend/src/api/middleware/error.middleware.ts`
- `/backend/tests/api/middleware/error.test.ts`

---

### T-003-004: Create /api/generate POST endpoint
**Effort**: 1 hour
**Dependencies**: T-003-001, T-003-002, T-003-003
**Priority**: P0 (Critical path)

**Description**: Implement the main generation endpoint that accepts descriptions and returns job IDs.

**Acceptance Criteria**:
- ✅ POST /api/generate accepts {userId, description}
- ✅ Returns 202 with {jobId, status: 'pending'}
- ✅ Uses validation middleware
- ✅ Uses error handling middleware
- ✅ Returns appropriate status codes (202, 400, 500)

**Test Requirements**:
```typescript
describe('POST /api/generate', () => {
  it('should accept valid generation request');
  it('should return 202 with jobId');
  it('should call validation middleware');
  it('should handle service errors');
  it('should return 400 for invalid input');
});
```

**Files to Create**:
- `/backend/src/api/routes/generate.routes.ts`
- `/backend/src/api/controllers/generate.controller.ts`
- `/backend/tests/api/routes/generate.routes.test.ts`

---

### T-003-005: Write Express server integration tests
**Effort**: 1-2 hours
**Dependencies**: T-003-001, T-003-002, T-003-003, T-003-004
**Priority**: P1 (High)

**Description**: Comprehensive integration tests for the Express API layer.

**Acceptance Criteria**:
- ✅ Tests cover happy path + error scenarios
- ✅ Tests use supertest for HTTP requests
- ✅ Tests verify status codes and response format
- ✅ Test coverage >90%
- ✅ All tests pass

**Test Requirements**:
```typescript
describe('Express API Integration', () => {
  describe('POST /api/generate', () => {
    it('should generate creature from valid description');
    it('should reject empty description');
    it('should reject description >500 chars');
    it('should reject missing userId');
    it('should handle internal errors gracefully');
  });

  describe('Error Handling', () => {
    it('should return 400 for validation errors');
    it('should return 500 for server errors');
    it('should not leak error details');
  });
});
```

**Files to Create**:
- `/backend/tests/api/integration/api.integration.test.ts`

---

## Phase 2: Prompt Enhancement Service

### T-003-006: Design template schema and interfaces
**Effort**: 2 hours
**Dependencies**: None (can run in parallel with Phase 1)
**Priority**: P0 (Critical path)

**Description**: Define TypeScript interfaces for creature templates, modifiers, and enhancement results.

**Acceptance Criteria**:
- ✅ CreatureTemplate interface defined
- ✅ AttributeModifier interface defined
- ✅ EnhancementResult interface defined
- ✅ All interfaces fully typed
- ✅ Includes JSDoc documentation

**Test Requirements**:
```typescript
describe('Template Schema', () => {
  it('should validate valid template structure');
  it('should reject invalid template');
  it('should validate modifier structure');
  it('should validate enhancement result');
});
```

**Files to Create**:
- `/backend/src/prompt/types/template.types.ts`
- `/backend/src/prompt/types/modifier.types.ts`
- `/backend/src/prompt/types/enhancement.types.ts`
- `/backend/tests/prompt/types/template.types.test.ts`

**Example Schema**:
```typescript
interface CreatureTemplate {
  id: string;
  keywords: string[];
  base: {
    type: string;
    style: string;
    size: { width: number; height: number };
  };
  attributes: {
    defense: number;
    attack: number;
    speed: number;
    health: number;
  };
  animations: string[];
  modifiers: Record<string, AttributeModifier>;
  pixelLabOptions: {
    detail: string;
    shading: string;
    outline: string;
    view: string;
  };
}
```

---

### T-003-007: Create 50+ creature templates
**Effort**: 4 hours
**Dependencies**: T-003-006
**Priority**: P0 (Critical path)

**Description**: Implement comprehensive creature template library covering fantasy, medieval, monsters, animals, mythical, undead, and elemental categories.

**Acceptance Criteria**:
- ✅ 50+ templates created
- ✅ Templates cover 7 categories (fantasy, medieval, monsters, animals, mythical, undead, elemental)
- ✅ Each template has 2-5 keywords
- ✅ All templates include balanced attributes
- ✅ All templates include appropriate animations
- ✅ Templates validated against schema

**Test Requirements**:
```typescript
describe('Creature Templates', () => {
  it('should have at least 50 templates');
  it('should include all 7 categories');
  it('should validate all templates against schema');
  it('should have unique IDs');
  it('should have balanced attributes (total = 26±4)');
});
```

**Files to Create**:
- `/backend/src/prompt/templates/fantasy.templates.ts` (knight, wizard, dragon, goblin, elf, dwarf, orc, troll)
- `/backend/src/prompt/templates/medieval.templates.ts` (archer, swordsman, pikeman, cavalier, peasant)
- `/backend/src/prompt/templates/monsters.templates.ts` (zombie, skeleton, ghost, demon, werewolf, vampire)
- `/backend/src/prompt/templates/animals.templates.ts` (wolf, bear, eagle, snake, spider, rat)
- `/backend/src/prompt/templates/mythical.templates.ts` (phoenix, griffon, unicorn, hydra, minotaur)
- `/backend/src/prompt/templates/undead.templates.ts` (lich, wraith, ghoul, bone dragon)
- `/backend/src/prompt/templates/elemental.templates.ts` (fire, water, earth, air elementals)
- `/backend/src/prompt/templates/index.ts` (exports all templates)
- `/backend/tests/prompt/templates/templates.test.ts`

---

### T-003-008: Implement keyword extraction
**Effort**: 2 hours
**Dependencies**: T-003-006
**Priority**: P0 (Critical path)

**Description**: Implement keyword extraction algorithm to parse user descriptions.

**Acceptance Criteria**:
- ✅ Extracts primary keywords (creature type)
- ✅ Extracts modifier keywords (armored, swift, etc.)
- ✅ Extracts visual keywords (golden, red, etc.)
- ✅ Handles case-insensitive matching
- ✅ Handles plurals and variations

**Test Requirements**:
```typescript
describe('Keyword Extraction', () => {
  it('should extract creature type keywords');
  it('should extract modifier keywords');
  it('should extract visual keywords');
  it('should handle case-insensitive input');
  it('should handle plurals');
  it('should handle compound phrases');
  it('should return empty array for no matches');
});
```

**Files to Create**:
- `/backend/src/prompt/matchers/keyword-extractor.ts`
- `/backend/tests/prompt/matchers/keyword-extractor.test.ts`

**Example Tests**:
```typescript
expect(extractKeywords("armored knight")).toEqual({
  creature: ["knight"],
  modifiers: ["armored"],
  visual: []
});

expect(extractKeywords("swift red dragon")).toEqual({
  creature: ["dragon"],
  modifiers: ["swift"],
  visual: ["red"]
});
```

---

### T-003-009: Implement template matching algorithm
**Effort**: 2 hours
**Dependencies**: T-003-006, T-003-007, T-003-008
**Priority**: P0 (Critical path)

**Description**: Implement algorithm to match user descriptions to best creature template.

**Acceptance Criteria**:
- ✅ Matches keywords to template keywords
- ✅ Returns best match (highest confidence score)
- ✅ Returns default template if no match found
- ✅ Confidence score >0.8 for good matches
- ✅ Handles ambiguous inputs

**Test Requirements**:
```typescript
describe('Template Matching', () => {
  it('should match "knight" to knight template');
  it('should match "paladin" to knight template (synonym)');
  it('should match "armored knight" to knight template');
  it('should return default template for unknown input');
  it('should return confidence score');
  it('should prefer exact matches over partial');
});
```

**Files to Create**:
- `/backend/src/prompt/matchers/template-matcher.ts`
- `/backend/tests/prompt/matchers/template-matcher.test.ts`

**Example Tests**:
```typescript
const result = matchTemplate("knight");
expect(result.template.id).toBe("knight");
expect(result.confidence).toBeGreaterThan(0.9);

const result2 = matchTemplate("xyz123");
expect(result2.template.id).toBe("default");
expect(result2.confidence).toBeLessThan(0.3);
```

---

### T-003-010: Implement modifier system
**Effort**: 2 hours
**Dependencies**: T-003-006
**Priority**: P0 (Critical path)

**Description**: Implement system to apply attribute modifiers based on descriptive keywords.

**Acceptance Criteria**:
- ✅ Applies defense modifiers (armored, heavy, etc.)
- ✅ Applies attack modifiers (sharp, powerful, etc.)
- ✅ Applies speed modifiers (swift, slow, etc.)
- ✅ Modifiers stack correctly
- ✅ Validates final attributes are within bounds

**Test Requirements**:
```typescript
describe('Modifier System', () => {
  it('should apply armored modifier (+2 defense, -1 speed)');
  it('should apply swift modifier (+2 speed, -1 defense)');
  it('should apply heavy modifier (+2 attack, -2 speed)');
  it('should stack multiple modifiers');
  it('should enforce min/max attribute bounds');
  it('should handle no modifiers');
});
```

**Files to Create**:
- `/backend/src/prompt/modifiers/modifier-applier.ts`
- `/backend/src/prompt/modifiers/modifier-definitions.ts`
- `/backend/tests/prompt/modifiers/modifier-applier.test.ts`

**Example Tests**:
```typescript
const baseAttributes = { defense: 8, attack: 6, speed: 4, health: 100 };
const result = applyModifiers(baseAttributes, ["armored"]);
expect(result).toEqual({ defense: 10, attack: 6, speed: 3, health: 100 });
```

---

### T-003-011: Implement size determination logic
**Effort**: 1 hour
**Dependencies**: T-003-006
**Priority**: P0 (Critical path)

**Description**: Implement logic to determine appropriate pixel size based on creature type.

**Acceptance Criteria**:
- ✅ Small creatures → 16x16 or 24x24
- ✅ Medium creatures → 32x32
- ✅ Large creatures → 64x64 or 128x128
- ✅ Respects template size hints
- ✅ Handles size modifiers (tiny, giant, etc.)

**Test Requirements**:
```typescript
describe('Size Determination', () => {
  it('should assign 16x16 for small creatures (rat, goblin)');
  it('should assign 32x32 for medium creatures (knight, orc)');
  it('should assign 64x64 for large creatures (dragon, giant)');
  it('should apply tiny modifier (halve size)');
  it('should apply giant modifier (double size)');
  it('should respect template size hints');
});
```

**Files to Create**:
- `/backend/src/prompt/size/size-determiner.ts`
- `/backend/tests/prompt/size/size-determiner.test.ts`

---

### T-003-012: Create core enhancement service
**Effort**: 2 hours
**Dependencies**: T-003-006, T-003-007, T-003-008, T-003-009, T-003-010, T-003-011
**Priority**: P0 (Critical path)

**Description**: Integrate all components into main PromptEnhancementService.

**Acceptance Criteria**:
- ✅ enhance(description) returns StructuredPrompt
- ✅ Orchestrates keyword extraction → template matching → modifier application → size determination
- ✅ Handles errors gracefully
- ✅ Response time <100ms for typical inputs
- ✅ Returns complete StructuredPrompt with all required fields

**Test Requirements**:
```typescript
describe('PromptEnhancementService', () => {
  it('should enhance "knight" to complete StructuredPrompt');
  it('should enhance "armored knight" with defense modifier');
  it('should enhance "swift dragon" with speed modifier');
  it('should handle unknown inputs with default template');
  it('should complete in <100ms');
  it('should return all required StructuredPrompt fields');
});
```

**Files to Create**:
- `/backend/src/prompt/enhancement.service.ts`
- `/backend/tests/prompt/enhancement.service.test.ts`

**Example Test**:
```typescript
const result = service.enhance("armored knight with golden shield");
expect(result).toEqual({
  type: 'character',
  style: 'fantasy',
  size: { width: 32, height: 32 },
  action: 'idle',
  description: 'armored knight with golden shield',
  raw: 'armored knight with golden shield',
  attributes: { defense: 10, attack: 6, speed: 4, health: 100 },
  animations: ['idle', 'attack', 'walk', 'defend', 'death'],
  options: { detail: 'medium detail', ... }
});
```

---

### T-003-013: Implement default template fallback
**Effort**: 1 hour
**Dependencies**: T-003-006, T-003-012
**Priority**: P1 (High)

**Description**: Create default template for handling unknown/ambiguous inputs.

**Acceptance Criteria**:
- ✅ Default template has balanced attributes
- ✅ Default template uses 32x32 size
- ✅ Default template includes basic animations
- ✅ Service falls back to default when confidence <0.5
- ✅ Telemetry logs unmatched inputs

**Test Requirements**:
```typescript
describe('Default Template Fallback', () => {
  it('should use default for unknown input');
  it('should use default for low confidence matches');
  it('should log unmatched inputs');
  it('should return valid StructuredPrompt');
});
```

**Files to Create**:
- `/backend/src/prompt/templates/default.template.ts`
- `/backend/tests/prompt/templates/default.test.ts`

---

### T-003-014: Write comprehensive enhancement service tests
**Effort**: 3-4 hours
**Dependencies**: All Phase 2 tasks
**Priority**: P0 (Critical path)

**Description**: Comprehensive test suite for prompt enhancement service covering all scenarios.

**Acceptance Criteria**:
- ✅ Test coverage >95%
- ✅ Tests cover happy path + edge cases
- ✅ Tests include performance benchmarks
- ✅ Tests verify all 50+ templates
- ✅ All tests pass

**Test Requirements**:
```typescript
describe('Prompt Enhancement - Comprehensive', () => {
  describe('Template Matching', () => {
    it('should match all 50+ templates by keyword');
    it('should handle synonyms');
    it('should handle misspellings');
  });

  describe('Modifier Application', () => {
    it('should apply all defined modifiers correctly');
    it('should stack modifiers');
  });

  describe('Edge Cases', () => {
    it('should handle empty input');
    it('should handle very long input');
    it('should handle special characters');
    it('should handle non-English characters');
  });

  describe('Performance', () => {
    it('should complete in <100ms');
    it('should handle 100 concurrent requests');
  });
});
```

**Files to Create**:
- `/backend/tests/prompt/integration/enhancement.integration.test.ts`
- `/backend/tests/prompt/performance/enhancement.performance.test.ts`

---

## Phase 3: React Frontend

### T-003-015: Create PromptInput component
**Effort**: 2 hours
**Dependencies**: T-003-004 (API endpoint)
**Priority**: P0 (Critical path)

**Description**: Create main text input component for user descriptions.

**Acceptance Criteria**:
- ✅ Textarea with 500 character limit
- ✅ Placeholder text guides user
- ✅ Submit button disabled when empty or loading
- ✅ Validates input length
- ✅ Responsive design (desktop-first)

**Test Requirements**:
```typescript
describe('PromptInput', () => {
  it('should render textarea with placeholder');
  it('should enforce 500 character limit');
  it('should disable submit when empty');
  it('should disable submit when loading');
  it('should call onSubmit with description');
  it('should clear input after successful submit');
});
```

**Files to Create**:
- `/frontend/src/components/PromptInput.tsx`
- `/frontend/src/components/PromptInput.test.tsx`
- `/frontend/src/components/PromptInput.module.css`

---

### T-003-016: Create CharacterCounter component
**Effort**: 1 hour
**Dependencies**: None (can run in parallel)
**Priority**: P1 (High)

**Description**: Real-time character counter component.

**Acceptance Criteria**:
- ✅ Displays current character count
- ✅ Displays max character count
- ✅ Updates in real-time as user types
- ✅ Changes color when approaching limit (>450 chars)
- ✅ Changes color when at limit (500 chars)

**Test Requirements**:
```typescript
describe('CharacterCounter', () => {
  it('should display current/max counts');
  it('should update in real-time');
  it('should change color when >450 chars');
  it('should change color when at 500 chars');
});
```

**Files to Create**:
- `/frontend/src/components/CharacterCounter.tsx`
- `/frontend/src/components/CharacterCounter.test.tsx`
- `/frontend/src/components/CharacterCounter.module.css`

---

### T-003-017: Create PreviewPanel component
**Effort**: 2 hours
**Dependencies**: None (can run in parallel)
**Priority**: P1 (High)

**Description**: Plain text preview panel component.

**Acceptance Criteria**:
- ✅ Displays user's description
- ✅ Updates in real-time
- ✅ Shows character count
- ✅ Shows empty state when no input
- ✅ Responsive design

**Test Requirements**:
```typescript
describe('PreviewPanel', () => {
  it('should display description text');
  it('should show empty state when no input');
  it('should update in real-time');
  it('should display character count');
});
```

**Files to Create**:
- `/frontend/src/components/PreviewPanel.tsx`
- `/frontend/src/components/PreviewPanel.test.tsx`
- `/frontend/src/components/PreviewPanel.module.css`

---

### T-003-018: Set up Zustand state management
**Effort**: 1 hour
**Dependencies**: None (can run in parallel)
**Priority**: P0 (Critical path)

**Description**: Configure Zustand store for prompt builder state.

**Acceptance Criteria**:
- ✅ Store manages description state
- ✅ Store manages loading state
- ✅ Store manages error state
- ✅ Store provides submitPrompt action
- ✅ TypeScript types defined

**Test Requirements**:
```typescript
describe('Prompt Store', () => {
  it('should initialize with empty state');
  it('should update description');
  it('should set loading state');
  it('should set error state');
  it('should clear error on new input');
});
```

**Files to Create**:
- `/frontend/src/store/promptStore.ts`
- `/frontend/src/store/promptStore.test.ts`

---

### T-003-019: Implement API client
**Effort**: 1 hour
**Dependencies**: T-003-004 (API endpoint)
**Priority**: P0 (Critical path)

**Description**: API client for communicating with backend.

**Acceptance Criteria**:
- ✅ POST /api/generate function
- ✅ Handles success responses
- ✅ Handles error responses
- ✅ Includes TypeScript types
- ✅ Configurable base URL

**Test Requirements**:
```typescript
describe('API Client', () => {
  it('should send POST request to /api/generate');
  it('should include userId and description');
  it('should return jobId on success');
  it('should throw error on 400');
  it('should throw error on 500');
  it('should handle network errors');
});
```

**Files to Create**:
- `/frontend/src/api/client.ts`
- `/frontend/src/api/client.test.ts`
- `/frontend/src/api/types.ts`

---

### T-003-020: Add loading and error states
**Effort**: 1 hour
**Dependencies**: T-003-015, T-003-018, T-003-019
**Priority**: P1 (High)

**Description**: Implement loading indicators and error messages.

**Acceptance Criteria**:
- ✅ Loading spinner shown during submission
- ✅ Submit button disabled during loading
- ✅ Error messages displayed clearly
- ✅ Errors dismissible by user
- ✅ Errors clear on new input

**Test Requirements**:
```typescript
describe('Loading and Error States', () => {
  it('should show loading spinner during submit');
  it('should disable submit button during loading');
  it('should display error message on failure');
  it('should dismiss error on user action');
  it('should clear error on new input');
});
```

**Files to Create**:
- `/frontend/src/components/LoadingSpinner.tsx`
- `/frontend/src/components/ErrorMessage.tsx`
- Tests included in PromptInput.test.tsx

---

### T-003-021: Write frontend component tests
**Effort**: 2-3 hours
**Dependencies**: All Phase 3 tasks
**Priority**: P0 (Critical path)

**Description**: Comprehensive test suite for all React components.

**Acceptance Criteria**:
- ✅ Test coverage >90%
- ✅ Tests use React Testing Library
- ✅ Tests cover user interactions
- ✅ Tests verify accessibility
- ✅ All tests pass

**Test Requirements**:
```typescript
describe('Prompt Builder - Component Integration', () => {
  it('should render all components');
  it('should update counter as user types');
  it('should update preview as user types');
  it('should submit description on button click');
  it('should show loading state during submission');
  it('should show error on submission failure');
  it('should clear form on successful submission');
});
```

**Files to Create**:
- `/frontend/tests/components/PromptBuilder.integration.test.tsx`

---

## Phase 4: Integration & Testing

### T-003-022: Wire Express API to JobSubmitter
**Effort**: 1 hour
**Dependencies**: T-003-004, T-003-012
**Priority**: P0 (Critical path)

**Description**: Connect Express API endpoint to existing JobSubmitter.

**Acceptance Criteria**:
- ✅ API controller calls PromptEnhancementService
- ✅ API controller calls JobSubmitter.submitJob()
- ✅ Returns jobId to client
- ✅ Handles errors from both services
- ✅ Logs requests and responses

**Test Requirements**:
```typescript
describe('API to JobSubmitter Integration', () => {
  it('should call enhancement service');
  it('should call job submitter');
  it('should return jobId');
  it('should handle enhancement errors');
  it('should handle job submitter errors');
});
```

**Files to Update**:
- `/backend/src/api/controllers/generate.controller.ts`
- Tests: `/backend/tests/api/integration/generate.integration.test.ts`

---

### T-003-023: Write end-to-end tests
**Effort**: 2-3 hours
**Dependencies**: All previous tasks
**Priority**: P0 (Critical path)

**Description**: Full end-to-end tests covering user journey.

**Acceptance Criteria**:
- ✅ Happy path: description → sprite URL
- ✅ Invalid input: error displayed
- ✅ Server error: error displayed
- ✅ PixelLab failure: retry logic
- ✅ Queue full: backpressure handling

**Test Requirements**:
```typescript
describe('End-to-End Generation Flow', () => {
  it('should generate creature from simple description', async () => {
    // 1. User submits "armored knight"
    const response = await fetch('/api/generate', {
      method: 'POST',
      body: JSON.stringify({ userId: 'test', description: 'armored knight' })
    });

    expect(response.status).toBe(202);
    const { jobId } = await response.json();

    // 2. Wait for job completion
    const job = await waitForJobCompletion(jobId);

    // 3. Verify result
    expect(job.status).toBe('completed');
    expect(job.result.spriteUrl).toBeDefined();
  });

  it('should handle invalid input');
  it('should handle server errors');
  it('should handle PixelLab failures');
  it('should handle queue backpressure');
});
```

**Files to Create**:
- `/backend/tests/e2e/generation-flow.e2e.test.ts`

---

### T-003-024: Performance testing
**Effort**: 2-3 hours
**Dependencies**: All previous tasks
**Priority**: P1 (High)

**Description**: Performance and load testing.

**Acceptance Criteria**:
- ✅ Prompt enhancement <100ms
- ✅ API endpoint <200ms end-to-end
- ✅ Handles 100 concurrent requests
- ✅ Memory usage <512MB
- ✅ No memory leaks

**Test Requirements**:
```typescript
describe('Performance Tests', () => {
  it('should complete enhancement in <100ms');
  it('should complete API request in <200ms');
  it('should handle 100 concurrent requests');
  it('should maintain memory usage <512MB');
  it('should not leak memory over 1000 requests');
});
```

**Files to Create**:
- `/backend/tests/performance/prompt-builder.perf.test.ts`

---

## Task Summary by Phase

### Phase 1: Express API Server (5 tasks)
- T-003-001: Express server setup (1 hr)
- T-003-002: Request validation middleware (1 hr)
- T-003-003: Error handling middleware (1 hr)
- T-003-004: /api/generate endpoint (1 hr)
- T-003-005: Integration tests (1-2 hrs)
**Total: 4-6 hours**

### Phase 2: Prompt Enhancement Service (9 tasks)
- T-003-006: Template schema design (2 hrs)
- T-003-007: Create 50+ templates (4 hrs)
- T-003-008: Keyword extraction (2 hrs)
- T-003-009: Template matching (2 hrs)
- T-003-010: Modifier system (2 hrs)
- T-003-011: Size determination (1 hr)
- T-003-012: Core enhancement service (2 hrs)
- T-003-013: Default template fallback (1 hr)
- T-003-014: Comprehensive tests (3-4 hrs)
**Total: 14-16 hours**

### Phase 3: React Frontend (7 tasks)
- T-003-015: PromptInput component (2 hrs)
- T-003-016: CharacterCounter component (1 hr)
- T-003-017: PreviewPanel component (2 hrs)
- T-003-018: Zustand state setup (1 hr)
- T-003-019: API client (1 hr)
- T-003-020: Loading/error states (1 hr)
- T-003-021: Component tests (2-3 hrs)
**Total: 9-11 hours**

### Phase 4: Integration & Testing (3 tasks)
- T-003-022: API to JobSubmitter wiring (1 hr)
- T-003-023: End-to-end tests (2-3 hrs)
- T-003-024: Performance testing (2-3 hrs)
**Total: 5-7 hours**

---

## Dependency Graph

```
T-003-001 (Express setup)
    ├─→ T-003-002 (Validation middleware)
    ├─→ T-003-003 (Error middleware)
    └─→ T-003-004 (Generate endpoint)
            └─→ T-003-005 (API integration tests)

T-003-006 (Template schema)
    ├─→ T-003-007 (50+ templates)
    ├─→ T-003-008 (Keyword extraction)
    ├─→ T-003-010 (Modifier system)
    └─→ T-003-011 (Size determination)

T-003-008 (Keyword extraction)
    └─→ T-003-009 (Template matching)

T-003-007 + T-003-009 + T-003-010 + T-003-011
    └─→ T-003-012 (Core enhancement service)
            └─→ T-003-013 (Default fallback)
                    └─→ T-003-014 (Comprehensive tests)

T-003-004 (API endpoint)
    ├─→ T-003-015 (PromptInput)
    └─→ T-003-019 (API client)

T-003-015 + T-003-018 + T-003-019
    └─→ T-003-020 (Loading/error states)
            └─→ T-003-021 (Component tests)

T-003-004 + T-003-012
    └─→ T-003-022 (API to JobSubmitter wiring)
            └─→ T-003-023 (E2E tests)
                    └─→ T-003-024 (Performance tests)
```

---

## Parallel Work Opportunities

Tasks that can be worked on simultaneously:

**Week 1 (Phases 1 & 2 in parallel)**:
- Team A: T-003-001 → T-003-002 → T-003-003 → T-003-004 → T-003-005
- Team B: T-003-006 → T-003-007, T-003-008, T-003-010, T-003-011 → T-003-009 → T-003-012 → T-003-013 → T-003-014

**Week 2 (Phase 3)**:
- T-003-015, T-003-016, T-003-017, T-003-018 (in parallel)
- Then T-003-019 → T-003-020 → T-003-021

**Week 3 (Phase 4)**:
- T-003-022 → T-003-023 → T-003-024

---

## Testing Strategy

### Unit Tests (Target: >90% coverage)
- All services (enhancement, keyword extraction, template matching, modifiers)
- All middleware (validation, error handling)
- All React components (PromptInput, PreviewPanel, CharacterCounter)

### Integration Tests
- Express API endpoints
- API → Enhancement Service → JobSubmitter flow
- React component interactions

### End-to-End Tests
- Full user journey: input → backend → queue → PixelLab → result
- Error scenarios: invalid input, server errors, PixelLab failures

### Performance Tests
- Response time benchmarks (<100ms enhancement, <200ms API)
- Load testing (100 concurrent users)
- Memory leak detection

---

## Success Criteria

### Functional
- ✅ All 24 tasks completed
- ✅ All acceptance criteria met
- ✅ All tests passing

### Quality
- ✅ Test coverage >90% across all components
- ✅ Response time <200ms for API + enhancement
- ✅ Error rate <1%
- ✅ Zero security vulnerabilities

### Documentation
- ✅ All code documented with JSDoc
- ✅ All components have usage examples
- ✅ All APIs have clear interface definitions

---

## Risk Mitigation

### Risk: Template coverage insufficient
**Mitigation**:
- Implement telemetry to track unmatched inputs
- Default template fallback for unknown inputs
- Iteratively add templates based on user feedback

### Risk: Performance degradation with scale
**Mitigation**:
- Performance tests in T-003-024
- Cache template matching results
- Monitor response times in production

### Risk: User input quality varies widely
**Mitigation**:
- Placeholder text guides users
- Default template handles unclear inputs
- Plan for LLM upgrade post-MVP

---

## Next Steps

1. **Review L4 tasks** - Validate completeness and effort estimates
2. **Begin Phase 1** - Start with T-003-001 (Express server setup)
3. **Run /implement-task T-003-001** - Begin TDD implementation

---

**Last Updated**: 2025-10-01
**Status**: Ready for implementation
