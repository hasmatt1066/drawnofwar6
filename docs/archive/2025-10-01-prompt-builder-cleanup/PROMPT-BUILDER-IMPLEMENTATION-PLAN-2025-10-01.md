# Prompt Builder System - Implementation Plan

**Created**: 2025-10-01
**Status**: Ready for Review
**Based on**: Subagent analysis + User's simplified vision

---

## Executive Summary

After analyzing the codebase with 3 specialized subagents, we've aligned your simplified vision with the existing architecture. Your vision is **2-3x simpler** than the original L2 specification, reducing implementation from 54-72 hours to **30-35 hours**.

### Your Vision (Validated)
- **User Experience**: Single text input box where users describe what they want
- **AI Determines Everything**: Backend intelligently assigns all game attributes (type, style, size, abilities, stats, animations)
- **No Complex UI**: No dropdowns, no wizards, no parameter selection
- **50+ Templates**: Backend uses comprehensive template matching (invisible to users)
- **Desktop-First**: Mobile support post-MVP

### Critical Architecture Gaps Identified
1. ❌ **No HTTP Server** - Backend has processing pipeline but no Express API
2. ❌ **No Frontend Components** - `/frontend` exists but is empty
3. ❌ **No Prompt Transformation** - No service to convert "armored knight" → StructuredPrompt
4. ⚠️ **Documentation Mismatch** - Original spec describes complex form (doesn't match vision)

---

## Recommended Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND (React + Zustand)                                   │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Simple Text Input: "Describe your creature..."          │ │
│ │ • 500 character limit                                   │ │
│ │ • Real-time character count                             │ │
│ │ • Plain text preview                                    │ │
│ └─────────────────────────────────────────────────────────┘ │
└────────────────────────┬────────────────────────────────────┘
                         │ POST /api/generate
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ NEW: Express API Server (Thin Layer)                         │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ POST /api/generate                                      │ │
│ │ • Receives: { userId, description }                     │ │
│ │ • Returns: { jobId, status }                            │ │
│ └─────────────────────────────────────────────────────────┘ │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ NEW: Prompt Enhancement Service (Rule-Based MVP)             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Input: "armored knight with golden shield"             │ │
│ │ ↓                                                        │ │
│ │ 1. Keyword Extraction (knight → character)              │ │
│ │ 2. Template Matching (50+ creature templates)           │ │
│ │ 3. Size Determination (knight → 32x32)                  │ │
│ │ 4. Ability Assignment (armored → high defense)          │ │
│ │ 5. Animation Selection (knight → idle, attack, walk)    │ │
│ │ ↓                                                        │ │
│ │ Output: StructuredPrompt {                              │ │
│ │   type: 'character',                                    │ │
│ │   style: 'fantasy',                                     │ │
│ │   size: {width: 32, height: 32},                        │ │
│ │   action: 'idle',                                       │ │
│ │   description: 'armored knight with golden shield',     │ │
│ │   raw: 'armored knight with golden shield',             │ │
│ │   options: { detail: 'medium detail', ... }             │ │
│ │ }                                                        │ │
│ └─────────────────────────────────────────────────────────┘ │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ EXISTING: Job Submission Pipeline (✅ Already Complete)      │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ JobSubmitter.submitJob(userId, structuredPrompt)        │ │
│ │ → Generation Queue (BullMQ + Redis)                     │ │
│ │ → PixelLab API Client                                   │ │
│ │ → Progress Tracking (SSE)                               │ │
│ │ → Retry Logic                                           │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## AI Implementation: Rule-Based vs LLM

### Option A: Rule-Based Prompt Enhancement (RECOMMENDED FOR MVP)
**What it does**: Keyword matching + template system + deterministic logic

**How it works**:
```typescript
// Example: "armored knight" input
const templates = {
  knight: {
    type: 'character',
    style: 'fantasy',
    baseSize: 32,
    abilities: { defense: 8, attack: 6, speed: 4 },
    animations: ['idle', 'attack', 'walk', 'defend']
  },
  goblin: { ... },
  dragon: { ... }
  // 50+ more templates
}

function enhancePrompt(userInput: string): StructuredPrompt {
  // 1. Extract keywords: "knight", "armored", "golden", "shield"
  // 2. Match template: "knight" → knight template
  // 3. Apply modifiers: "armored" → +2 defense
  // 4. Determine size: knight → 32x32
  // 5. Build StructuredPrompt
}
```

**Pros**:
- ✅ **Fast**: <100ms response time
- ✅ **Free**: No API costs ($0/month)
- ✅ **Predictable**: Same input = same output
- ✅ **MVP-ready**: 14-16 hours to implement

**Cons**:
- ❌ Limited to template library
- ❌ Can't handle complex/creative descriptions
- ❌ Requires manual template maintenance

**Cost**: $0/month
**Effort**: 14-16 hours

---

### Option B: LLM-Powered (OpenAI/Claude) (POST-MVP)
**What it does**: AI understands natural language and makes creative decisions

**How it works**:
```typescript
async function enhancePrompt(userInput: string): Promise<StructuredPrompt> {
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{
      role: "system",
      content: "You are a game asset expert. Convert user descriptions to structured prompts..."
    }, {
      role: "user",
      content: userInput
    }]
  });

  return parseStructuredPrompt(response);
}
```

**Pros**:
- ✅ Handles any description
- ✅ Creative/intelligent decisions
- ✅ Natural language understanding

**Cons**:
- ❌ **Expensive**: $0.01-0.03 per generation
- ❌ **Slow**: 500ms-2s latency
- ❌ **Unpredictable**: Same input may vary

**Cost**: $300-1000/month (assuming 1000-3000 users)
**Effort**: 24-32 hours

---

### Option C: Hybrid (RECOMMENDED POST-LAUNCH)
**What it does**: Rule-based for common cases, LLM for complex/creative ones

**How it works**:
```typescript
async function enhancePrompt(userInput: string): Promise<StructuredPrompt> {
  // Try rule-based first (fast + free)
  const ruleBasedResult = tryRuleBasedEnhancement(userInput);

  if (ruleBasedResult.confidence > 0.8) {
    return ruleBasedResult.prompt; // Common case: "knight", "goblin"
  }

  // Fall back to LLM for complex/creative (slower + paid)
  return await llmEnhancement(userInput); // Creative case: "steampunk cyborg dragon"
}
```

**Pros**:
- ✅ Best of both worlds
- ✅ 80% requests use free/fast path
- ✅ 20% requests get AI creativity

**Cost**: $50-200/month
**Effort**: 32-40 hours

---

## Recommended Approach

### Phase 1: MVP (Rule-Based)
- Start with **Option A** (Rule-Based)
- Build 50+ comprehensive templates
- Launch quickly, validate user adoption
- Cost: $0/month, Effort: 30-35 hours

### Phase 2: Post-Launch Enhancement
- Upgrade to **Option C** (Hybrid)
- Add LLM for creative descriptions
- Maintain cost efficiency
- Cost: $50-200/month, Effort: +8-12 hours

---

## 4-Phase Implementation Plan

### Phase 1: Express API Server (4-6 hours)
**Creates the missing HTTP layer**

**L4 Tasks**:
1. Set up Express server with TypeScript (1 hr)
2. Create `/api/generate` POST endpoint (1 hr)
3. Add request validation middleware (1 hr)
4. Add error handling middleware (1 hr)
5. Write integration tests (1-2 hrs)

**Deliverables**:
- `/backend/src/api/server.ts` - Express server setup
- `/backend/src/api/routes/generate.routes.ts` - Generation endpoint
- `/backend/src/api/middleware/validation.middleware.ts` - Input validation
- Tests: `server.test.ts`, `generate.routes.test.ts`

**Acceptance Criteria**:
- ✅ `POST /api/generate` accepts `{userId, description}`
- ✅ Returns `{jobId, status}`
- ✅ Validates description length (500 chars max)
- ✅ Returns 400 for invalid input
- ✅ Test coverage >90%

---

### Phase 2: Prompt Enhancement Service (14-16 hours)
**The "AI brain" that determines everything**

**L4 Tasks**:
1. Design template schema (2 hrs)
2. Create 50+ creature templates (4 hrs)
3. Implement keyword extraction (2 hrs)
4. Implement template matching algorithm (2 hrs)
5. Implement modifier system (armored → +defense) (2 hrs)
6. Implement size determination logic (1 hr)
7. Write comprehensive tests (3-4 hrs)

**Deliverables**:
- `/backend/src/prompt/enhancement.service.ts` - Core enhancement logic
- `/backend/src/prompt/templates/` - 50+ creature templates
- `/backend/src/prompt/matchers/keyword-matcher.ts` - Keyword extraction
- `/backend/src/prompt/matchers/template-matcher.ts` - Template selection
- `/backend/src/prompt/modifiers/` - Attribute modifiers
- Tests: `enhancement.service.test.ts`, `template-matcher.test.ts`, etc.

**Template Example**:
```typescript
// /backend/src/prompt/templates/fantasy/knight.ts
export const knightTemplate: CreatureTemplate = {
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
  },
  pixelLabOptions: {
    detail: 'medium detail',
    shading: 'medium shading',
    outline: 'single color black outline',
    view: 'side'
  }
}
```

**Acceptance Criteria**:
- ✅ "knight" → knight template matched
- ✅ "armored knight" → knight + defense modifier
- ✅ "goblin archer" → goblin + ranged attributes
- ✅ 50+ templates covering common creature types
- ✅ Handles unknown inputs gracefully (default template)
- ✅ Test coverage >95%

---

### Phase 3: React Frontend (9-11 hours)
**Simple, clean UI matching your vision**

**L4 Tasks**:
1. Create PromptInput component (2 hrs)
2. Add character counter (1 hr)
3. Create PreviewPanel component (2 hrs)
4. Set up Zustand state management (1 hr)
5. Implement API client (1 hr)
6. Add loading/error states (1 hr)
7. Write component tests (2-3 hrs)

**Deliverables**:
- `/frontend/src/components/PromptInput.tsx`
- `/frontend/src/components/PreviewPanel.tsx`
- `/frontend/src/components/CharacterCounter.tsx`
- `/frontend/src/store/promptStore.ts` (Zustand)
- `/frontend/src/api/client.ts`
- Tests: `PromptInput.test.tsx`, etc.

**Component Structure**:
```tsx
// PromptInput.tsx
export function PromptInput() {
  const [description, setDescription] = useState('');
  const { submitPrompt, isLoading } = usePromptStore();

  const remainingChars = 500 - description.length;

  return (
    <div className="prompt-builder">
      <textarea
        placeholder="Describe your creature... (e.g., 'armored knight with golden shield')"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={500}
        rows={4}
      />
      <CharacterCounter current={description.length} max={500} />
      <button
        onClick={() => submitPrompt(description)}
        disabled={isLoading || description.length === 0}
      >
        Generate Creature
      </button>
      <PreviewPanel description={description} />
    </div>
  );
}
```

**Acceptance Criteria**:
- ✅ Single text input, 500 char limit
- ✅ Real-time character count
- ✅ Plain text preview
- ✅ Submit button disabled while loading
- ✅ Clear error messages
- ✅ Test coverage >90%

---

### Phase 4: Integration & Testing (5-7 hours)
**Connect all pieces and validate end-to-end**

**L4 Tasks**:
1. Wire Express API to JobSubmitter (1 hr)
2. Wire API to Prompt Enhancement Service (1 hr)
3. Write end-to-end tests (2-3 hrs)
4. Test with real PixelLab API (1 hr)
5. Performance testing (1 hr)

**Deliverables**:
- `/backend/src/api/controllers/generate.controller.ts` - Connects services
- `/backend/tests/e2e/generation-flow.test.ts` - Full flow test
- Performance benchmarks

**E2E Test Scenarios**:
```typescript
describe('End-to-End Generation Flow', () => {
  it('should generate creature from simple description', async () => {
    // 1. Frontend submits "armored knight"
    const response = await fetch('/api/generate', {
      method: 'POST',
      body: JSON.stringify({ userId: 'test-user', description: 'armored knight' })
    });

    const { jobId } = await response.json();

    // 2. Backend enhances prompt
    // Expected: type=character, style=fantasy, size=32x32, defense=8+2=10

    // 3. JobSubmitter creates queue job
    // 4. Queue processes job
    // 5. PixelLab generates sprite

    // Verify job completes successfully
    const job = await waitForJobCompletion(jobId);
    expect(job.status).toBe('completed');
    expect(job.result.spriteUrl).toBeDefined();
  });
});
```

**Acceptance Criteria**:
- ✅ User input → StructuredPrompt → Queue → PixelLab (full flow works)
- ✅ Response time <200ms for prompt enhancement
- ✅ Error handling at every layer
- ✅ E2E test coverage for happy path + 5 error scenarios
- ✅ Load testing: 100 concurrent requests

---

## Total Effort Estimate

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| Phase 1: Express API | 4-6 hours | None (can start immediately) |
| Phase 2: Enhancement Service | 14-16 hours | None (can start immediately) |
| Phase 3: React Frontend | 9-11 hours | Phase 1 (needs API endpoint) |
| Phase 4: Integration | 5-7 hours | Phases 1, 2, 3 |
| **Total** | **32-40 hours** | **MVP Complete** |

**Note**: Original L2 spec estimated 54-72 hours for complex form with dropdowns. Your simplified vision reduces effort by ~40%.

---

## Key Architectural Decisions

### 1. Why Rule-Based for MVP?
- **Speed to market**: 14-16 hrs vs 24-32 hrs for LLM
- **Cost efficiency**: $0/month vs $300-1000/month
- **Performance**: <100ms vs 500ms-2s
- **Predictability**: Critical for MVP validation
- **Easy upgrade path**: Can add LLM later without breaking changes

### 2. Why Thin API Layer?
- **Reuse existing pipeline**: JobSubmitter, Queue, PixelLab client already complete
- **Separation of concerns**: HTTP layer separate from business logic
- **Easy to scale**: Can add GraphQL, WebSockets later
- **Testability**: Each layer independently testable

### 3. Why Zustand for State?
- **Already in codebase**: `/frontend/package.json` includes Zustand
- **Simple API**: Matches simple UI requirements
- **No boilerplate**: Faster than Redux for MVP
- **TypeScript-native**: Type-safe state management

---

## Validation Against User Vision

✅ **"Single text input box"** → Phase 3 creates `<textarea>` with 500 char limit
✅ **"AI determines everything"** → Phase 2 Enhancement Service makes all decisions
✅ **"50+ templates"** → Phase 2 includes comprehensive template library
✅ **"User doesn't see templates"** → Templates are backend-only, not exposed in UI
✅ **"Desktop-first"** → No mobile CSS in MVP (can add later)
✅ **"Plain text preview"** → PreviewPanel shows description + character count
✅ **"No complex forms"** → Zero dropdowns, zero wizards

---

## Risk Assessment

### Low Risk
- ✅ Backend pipeline already complete (Queue, PixelLab, Retry, Progress)
- ✅ Frontend framework already set up (React + Zustand)
- ✅ Rule-based AI is deterministic and testable

### Medium Risk
- ⚠️ **Template coverage**: 50+ templates may not cover all user inputs
  - **Mitigation**: Default template for unknown inputs + telemetry to track gaps
- ⚠️ **Keyword extraction accuracy**: Simple keyword matching may miss context
  - **Mitigation**: Start simple, iterate based on user feedback

### High Risk (None Identified)
- All critical infrastructure already complete
- User vision aligns with existing architecture
- No external dependencies beyond PixelLab API (already integrated)

---

## Next Steps

### Immediate Actions
1. **Review this plan** - Confirm alignment with your vision
2. **Approve architecture** - Rule-based MVP → Hybrid post-launch
3. **Create L3 specification** - Formalize this plan as official spec
4. **Break down into L4 tasks** - Create 15-20 atomic tasks with TDD approach

### Questions for Confirmation
1. ✅ **Approve Rule-Based approach for MVP?** (vs jumping straight to LLM)
2. ✅ **Approve 32-40 hour estimate?** (vs original 54-72 hour complex form)
3. ✅ **Approve 4-phase plan?** (API → Enhancement → Frontend → Integration)

### After Approval
1. Create formal L3 specification document
2. Break down into L4 atomic tasks (TDD methodology)
3. Begin Phase 1 implementation (Express API server)

---

## Alignment with Documentation-Driven Development

This plan follows the project's core principles:

✅ **NO WORKAROUNDS**: All architecture gaps identified and addressed
✅ **Question Everything**: 3 subagents analyzed codebase before planning
✅ **Small Atomic Tasks**: Each phase broken into 1-2 hour units
✅ **Layer Discipline**: Completing L3 before descending to L4
✅ **Vision Fidelity**: Plan matches user's simplified vision exactly

---

**Status**: Ready for user review and approval
**Next Command**: `/review-plan L3` (after user approval)
