# L3 Feature Specification: Prompt Builder System

**Feature ID**: F-003
**Feature Name**: Prompt Builder (Simplified)
**Epic**: Asset Generation Pipeline (E-001)
**Status**: Ready for Implementation
**Created**: 2025-09-29
**Updated**: 2025-10-01 (Simplified based on user vision)
**Estimated Effort**: 32-40 hours (1 sprint)
**Original Estimate**: 54-72 hours (complex form - deprecated)

---

## Feature Summary

The **Prompt Builder** is a simplified React-based system that enables users to describe creatures using natural language. The system uses an intelligent backend service to transform simple text descriptions into structured prompts for the PixelLab.ai API, automatically determining all game attributes, abilities, and parameters.

### User Vision
- **Single text input**: Users describe what they want in plain English
- **AI determines everything**: Backend assigns type, style, size, abilities, stats, animations
- **No complex UI**: No dropdowns, no parameter selection, no wizards
- **Desktop-first**: Mobile support post-MVP

---

## Core Components

### 1. Frontend: Simple Text Input (9-11 hours)
**What users see**: Single textarea where they describe their creature

**UI Components**:
```tsx
<PromptBuilder>
  <textarea placeholder="Describe your creature..." maxLength={500} />
  <CharacterCounter current={245} max={500} />
  <PreviewPanel description="armored knight with golden shield" />
  <button>Generate Creature</button>
</PromptBuilder>
```

**Key Features**:
- 500 character limit
- Real-time character counter
- Plain text preview
- Loading states
- Error handling

---

### 2. Backend: Express API Layer (4-6 hours)
**What it does**: HTTP interface for the existing job submission pipeline

**API Endpoint**:
```
POST /api/generate
Body: { userId: string, description: string }
Response: { jobId: string, status: string }
```

**Responsibilities**:
- Request validation (500 char limit)
- Error handling
- Calls Prompt Enhancement Service
- Calls JobSubmitter.submitJob()

---

### 3. Backend: Prompt Enhancement Service (14-16 hours)
**What it does**: Transforms "armored knight" → full StructuredPrompt with game attributes

**Core Logic**:
```typescript
interface PromptEnhancementService {
  enhance(userDescription: string): StructuredPrompt;
}

// Example transformation
Input: "armored knight with golden shield"
Output: {
  type: 'character',
  style: 'fantasy',
  size: { width: 32, height: 32 },
  action: 'idle',
  description: 'armored knight with golden shield',
  raw: 'armored knight with golden shield',
  attributes: {
    defense: 10,  // Base 8 + 2 for "armored"
    attack: 6,
    speed: 4,
    health: 100
  },
  animations: ['idle', 'attack', 'walk', 'defend', 'death'],
  options: {
    detail: 'medium detail',
    shading: 'medium shading',
    outline: 'single color black outline',
    view: 'side'
  }
}
```

**Implementation Approach: Rule-Based (MVP)**

**Why Rule-Based?**
- Fast (<100ms response)
- Free ($0/month)
- Predictable
- MVP-ready (14-16 hours)

**How It Works**:
1. **Keyword Extraction**: Parse user input for key terms
   - "knight" → base creature type
   - "armored" → defense modifier
   - "golden", "shield" → visual details

2. **Template Matching**: Match to one of 50+ creature templates
   ```typescript
   // Example template
   const knightTemplate: CreatureTemplate = {
     keywords: ['knight', 'paladin', 'warrior', 'crusader'],
     base: {
       type: 'character',
       style: 'fantasy',
       size: { width: 32, height: 32 }
     },
     attributes: {
       defense: 8,
       attack: 6,
       speed: 4,
       health: 100
     },
     animations: ['idle', 'attack', 'walk', 'defend', 'death'],
     modifiers: {
       armored: { defense: +2, speed: -1 },
       swift: { speed: +2, defense: -1 },
       heavy: { attack: +2, speed: -2 }
     }
   }
   ```

3. **Modifier Application**: Apply descriptor modifiers
   - "armored" → +2 defense, -1 speed
   - "swift" → +2 speed, -1 defense

4. **Size Determination**: Determine pixel size based on creature type
   - Small creatures (goblin, rat) → 16x16 or 24x24
   - Medium creatures (knight, archer) → 32x32
   - Large creatures (dragon, giant) → 64x64 or 128x128

5. **PixelLab Options**: Set API parameters for visual quality
   - detail: 'low detail' | 'medium detail' | 'high detail'
   - shading: 'flat shading' | 'basic shading' | 'medium shading' | 'detailed shading'
   - outline: 'single color black outline' | 'single color outline' | 'selective outline' | 'lineless'
   - view: 'low top-down' | 'high top-down' | 'side'

**Template Categories** (50+ templates):
- **Fantasy**: knight, wizard, dragon, goblin, elf, dwarf, orc, troll
- **Medieval**: archer, swordsman, pikeman, cavalier, peasant
- **Monsters**: zombie, skeleton, ghost, demon, werewolf, vampire
- **Animals**: wolf, bear, eagle, snake, spider, rat
- **Mythical**: phoenix, griffon, unicorn, hydra, minotaur
- **Undead**: lich, wraith, ghoul, bone dragon
- **Elemental**: fire elemental, water elemental, earth elemental, air elemental

**Fallback Handling**:
- Unknown inputs → default template (generic character, 32x32, balanced stats)
- Telemetry tracks unmatched inputs → guide future template additions

**Post-MVP: Upgrade to Hybrid (LLM + Rules)**
- 80% requests: Rule-based (fast, free)
- 20% requests: LLM fallback for creative descriptions
- Cost: $50-200/month
- Effort: +8-12 hours

---

### 4. Integration: Connect to Existing Pipeline (5-7 hours)
**What it does**: Wire new components to existing JobSubmitter, Queue, PixelLab API

**Existing Infrastructure (Already Complete)**:
✅ JobSubmitter.submitJob() - Entry point for jobs
✅ Generation Queue (BullMQ + Redis) - Job processing
✅ PixelLab API Client - External sprite generation
✅ Progress Tracking (SSE) - Real-time updates
✅ Retry Logic - Automatic failure recovery
✅ Dead Letter Queue - Failed job handling

**Integration Points**:
```typescript
// Express API → Prompt Enhancement → JobSubmitter
async function generateCreature(req: Request, res: Response) {
  const { userId, description } = req.body;

  // 1. Enhance prompt (new)
  const structuredPrompt = promptEnhancementService.enhance(description);

  // 2. Submit job (existing)
  const result = await jobSubmitter.submitJob(userId, structuredPrompt);

  // 3. Return job ID
  res.json({ jobId: result.jobId, status: result.status });
}
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND (React + Zustand)                                   │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ <textarea> "Describe your creature..."                  │ │
│ │ • 500 character limit                                   │ │
│ │ • Real-time character count                             │ │
│ │ • Plain text preview                                    │ │
│ └─────────────────────────────────────────────────────────┘ │
└────────────────────────┬────────────────────────────────────┘
                         │ POST /api/generate
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ NEW: Express API Server                                      │
│ POST /api/generate { userId, description }                   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ NEW: Prompt Enhancement Service (Rule-Based)                 │
│ • Keyword extraction                                         │
│ • Template matching (50+ templates)                          │
│ • Modifier application                                       │
│ • Size determination                                         │
│ • Attribute assignment                                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ EXISTING: Job Submission Pipeline (✅ Already Complete)      │
│ JobSubmitter → Queue → PixelLab API → Progress → Retry      │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Express API Server (4-6 hours)
**Tasks**:
1. Set up Express server with TypeScript
2. Create `/api/generate` POST endpoint
3. Add request validation middleware
4. Add error handling middleware
5. Write integration tests

**Acceptance Criteria**:
- ✅ POST /api/generate accepts {userId, description}
- ✅ Returns {jobId, status}
- ✅ Validates description length (500 chars max)
- ✅ Returns 400 for invalid input
- ✅ Test coverage >90%

---

### Phase 2: Prompt Enhancement Service (14-16 hours)
**Tasks**:
1. Design template schema
2. Create 50+ creature templates
3. Implement keyword extraction
4. Implement template matching algorithm
5. Implement modifier system
6. Implement size determination logic
7. Write comprehensive tests

**Acceptance Criteria**:
- ✅ "knight" → knight template matched
- ✅ "armored knight" → knight + defense modifier
- ✅ "goblin archer" → goblin + ranged attributes
- ✅ 50+ templates covering common creature types
- ✅ Handles unknown inputs gracefully (default template)
- ✅ Response time <100ms
- ✅ Test coverage >95%

---

### Phase 3: React Frontend (9-11 hours)
**Tasks**:
1. Create PromptInput component
2. Add character counter
3. Create PreviewPanel component
4. Set up Zustand state management
5. Implement API client
6. Add loading/error states
7. Write component tests

**Acceptance Criteria**:
- ✅ Single text input, 500 char limit
- ✅ Real-time character count
- ✅ Plain text preview
- ✅ Submit button disabled while loading
- ✅ Clear error messages
- ✅ Test coverage >90%

---

### Phase 4: Integration & Testing (5-7 hours)
**Tasks**:
1. Wire Express API to JobSubmitter
2. Wire API to Prompt Enhancement Service
3. Write end-to-end tests
4. Test with real PixelLab API
5. Performance testing

**Acceptance Criteria**:
- ✅ Full flow: User input → StructuredPrompt → Queue → PixelLab
- ✅ Response time <200ms for prompt enhancement
- ✅ Error handling at every layer
- ✅ E2E test coverage for happy path + 5 error scenarios
- ✅ Load testing: 100 concurrent requests

---

## Data Flow

```
1. User Input
   ↓
   "armored knight with golden shield"

2. POST /api/generate
   ↓
   { userId: "user123", description: "armored knight with golden shield" }

3. Prompt Enhancement Service
   ↓
   {
     type: 'character',
     style: 'fantasy',
     size: { width: 32, height: 32 },
     action: 'idle',
     description: 'armored knight with golden shield',
     raw: 'armored knight with golden shield',
     attributes: { defense: 10, attack: 6, speed: 4, health: 100 },
     animations: ['idle', 'attack', 'walk', 'defend', 'death'],
     options: { detail: 'medium detail', shading: 'medium shading', ... }
   }

4. JobSubmitter.submitJob()
   ↓
   Job added to BullMQ queue

5. Queue Processor
   ↓
   Transforms StructuredPrompt → PixelLab API request

6. PixelLab API
   ↓
   Generates sprite

7. Result Storage
   ↓
   Sprite URL cached in Redis + Firestore

8. User Notification
   ↓
   SSE event: { jobId, status: 'completed', spriteUrl: '...' }
```

---

## Technology Stack

### Frontend
- **Framework**: React 18 + TypeScript
- **State Management**: Zustand (already in codebase)
- **Build Tool**: Vite
- **Testing**: Vitest + React Testing Library

### Backend
- **Runtime**: Node.js + TypeScript
- **HTTP Server**: Express (NEW - to be added)
- **Prompt Enhancement**: Rule-based algorithm (NEW - to be added)
- **Queue**: BullMQ (existing)
- **Cache**: Redis + Firestore (existing)
- **Testing**: Jest

---

## Test Strategy

### Unit Tests
**Prompt Enhancement Service** (12 test suites):
- Template matching accuracy
- Keyword extraction
- Modifier application
- Size determination
- Default fallback behavior
- Edge cases (empty input, very long input, special characters)

**API Endpoints** (5 test suites):
- Valid request → 200 response
- Invalid request → 400 response
- Missing userId → 400
- Missing description → 400
- Description too long → 400

**Frontend Components** (6 test suites):
- PromptInput rendering
- Character counter updates
- Submit button state changes
- Error message display
- Loading state display
- Preview panel rendering

### Integration Tests
**API → Enhancement → JobSubmitter** (3 test suites):
- Valid description → job created
- Enhancement service failure → error response
- JobSubmitter failure → error response

### End-to-End Tests
**Full User Journey** (5 scenarios):
1. Happy path: Submit description → sprite generated
2. Invalid input: Too long → error displayed
3. Server error: Backend down → error displayed
4. PixelLab failure: External API down → retry logic
5. Queue full: Rate limit → backpressure handling

---

## Performance Requirements

- **Prompt Enhancement**: <100ms response time
- **API Endpoint**: <200ms end-to-end
- **Frontend Rendering**: <50ms
- **Concurrent Requests**: Support 100 simultaneous users
- **Memory Usage**: <512MB for enhancement service

---

## Security Considerations

- **Input Validation**: Sanitize user descriptions (prevent XSS)
- **Rate Limiting**: Prevent abuse (100 requests/hour per user)
- **Authentication**: Verify userId before job submission
- **Description Length**: Hard limit 500 characters

---

## Error Handling

### User Errors
- Empty description → "Please describe your creature"
- Too long (>500 chars) → "Description too long (500 character limit)"
- Invalid characters → "Please use only letters, numbers, and basic punctuation"

### System Errors
- Enhancement service failure → "Unable to process description, please try again"
- JobSubmitter failure → "Unable to start generation, please try again"
- PixelLab API failure → "Generation in progress, this may take longer than usual"

---

## Effort Breakdown

| Component | Effort | Dependencies |
|-----------|--------|--------------|
| Phase 1: Express API | 4-6 hours | None |
| Phase 2: Enhancement Service | 14-16 hours | None |
| Phase 3: React Frontend | 9-11 hours | Phase 1 |
| Phase 4: Integration | 5-7 hours | Phases 1, 2, 3 |
| **Total** | **32-40 hours** | **1 sprint** |

**Note**: Original L2 spec estimated 54-72 hours for complex form. Simplified vision reduces effort by ~40%.

---

## Dependencies

### External
- ✅ PixelLab API (already integrated)

### Internal
- ✅ JobSubmitter (backend/src/queue/job-submitter.ts) - COMPLETE
- ✅ Generation Queue (backend/src/queue/) - COMPLETE
- ✅ Progress Tracking (backend/src/progress/) - COMPLETE
- ✅ Retry Logic (backend/src/retry/) - COMPLETE
- ✅ Cache System (backend/src/cache/) - COMPLETE

### New Components
- ❌ Express API Server - TO BE BUILT
- ❌ Prompt Enhancement Service - TO BE BUILT
- ❌ React UI Components - TO BE BUILT

---

## Success Metrics

### Functional
- ✅ User can submit text description
- ✅ Backend transforms text → StructuredPrompt
- ✅ Job successfully submitted to queue
- ✅ Sprite generated by PixelLab
- ✅ User receives sprite URL

### Quality
- ✅ Test coverage >90% across all components
- ✅ Response time <200ms for API + enhancement
- ✅ Error rate <1%
- ✅ Zero security vulnerabilities

### User Experience
- ✅ Simple, intuitive UI
- ✅ Clear error messages
- ✅ Responsive feedback (loading states)
- ✅ Desktop-first (mobile later)

---

## Post-MVP Enhancements

### Phase 5: LLM Upgrade (Hybrid Approach)
**When**: After MVP launch + user validation
**Effort**: +8-12 hours
**Cost**: $50-200/month

**What changes**:
```typescript
async function enhance(description: string): Promise<StructuredPrompt> {
  // Try rule-based first (80% of cases)
  const ruleResult = tryRuleBased(description);
  if (ruleResult.confidence > 0.8) {
    return ruleResult.prompt;
  }

  // Fall back to LLM for creative descriptions (20% of cases)
  return await llmEnhancement(description);
}
```

**Benefits**:
- Handles creative/complex descriptions
- Maintains fast performance for common cases
- Cost-efficient hybrid approach

---

## Alignment with User Vision

✅ **"Single text input box"** → Phase 3 creates simple textarea
✅ **"AI determines everything"** → Phase 2 Enhancement Service
✅ **"50+ templates"** → Phase 2 comprehensive template library
✅ **"Templates invisible to user"** → Backend-only, not exposed in UI
✅ **"Desktop-first"** → No mobile CSS in MVP
✅ **"Plain text preview"** → PreviewPanel shows description + char count
✅ **"No complex forms"** → Zero dropdowns, zero wizards
✅ **"500 character limit"** → Hard limit in both frontend and backend

---

## Decision Log

### Decision 1: Rule-Based vs LLM for MVP
**Options**:
- A: Rule-based (fast, free, 14-16 hrs)
- B: LLM-powered (smart, expensive, 24-32 hrs)
- C: Hybrid (balanced, 32-40 hrs)

**Decision**: Option A (Rule-Based) for MVP
**Rationale**:
- Faster to market (16 hrs vs 32 hrs)
- No ongoing costs ($0/month vs $300/month)
- Easier to test and debug
- Can upgrade to Hybrid post-launch

**Approved by**: User (implied by "choose what is best for our vision")

---

### Decision 2: Simplified UI vs Complex Form
**Options**:
- A: Single text input (simple)
- B: Multi-step wizard (guided)
- C: Form with dropdowns (complex)

**Decision**: Option A (Single text input)
**Rationale**: User explicitly requested "just one text input box"
**Approved by**: User (explicit)

---

### Decision 3: Frontend State Management
**Options**:
- A: Zustand (already in codebase)
- B: Redux Toolkit
- C: React Context only

**Decision**: Option A (Zustand)
**Rationale**:
- Already in package.json
- Simple API matches simple UI
- TypeScript-native
- No boilerplate

**Approved by**: Orchestrator (based on codebase analysis)

---

## Files to be Created

### Backend
- `/backend/src/api/server.ts` - Express server setup
- `/backend/src/api/routes/generate.routes.ts` - Generation endpoint
- `/backend/src/api/middleware/validation.middleware.ts` - Input validation
- `/backend/src/api/controllers/generate.controller.ts` - Request handling
- `/backend/src/prompt/enhancement.service.ts` - Core enhancement logic
- `/backend/src/prompt/templates/` - 50+ creature templates
- `/backend/src/prompt/matchers/keyword-matcher.ts` - Keyword extraction
- `/backend/src/prompt/matchers/template-matcher.ts` - Template selection
- `/backend/src/prompt/modifiers/` - Attribute modifiers
- Tests: ~15 new test files

### Frontend
- `/frontend/src/components/PromptInput.tsx` - Main input component
- `/frontend/src/components/PreviewPanel.tsx` - Preview display
- `/frontend/src/components/CharacterCounter.tsx` - Character count
- `/frontend/src/store/promptStore.ts` - Zustand store
- `/frontend/src/api/client.ts` - API client
- Tests: ~6 new test files

---

## Status

**Current**: L3 specification complete, ready for L4 task breakdown
**Next Steps**:
1. `/review-plan L3` - Validate specification completeness
2. Break down into L4 atomic tasks (TDD approach)
3. Begin Phase 1 implementation

---

**Last Updated**: 2025-10-01
**Approver**: Pending user review
