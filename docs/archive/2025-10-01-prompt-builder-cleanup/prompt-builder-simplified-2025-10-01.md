# Simplified Prompt Builder - Feature Breakdown

**Feature ID**: F-003-SIMPLIFIED
**Epic**: AI Generation Pipeline (E-001)
**Status**: Ready for Implementation
**Version**: 2.0 (Simplified)
**Created**: 2025-10-01
**Estimated Effort**: 24-32 hours (3-4 days)

---

## Executive Summary

This is the **simplified version** of the Prompt Builder based on user clarification. Unlike the original L2 spec which included parameter selection dropdowns, template galleries, and multi-step wizards, this version focuses on:

**Core Concept**: User types a description → Backend AI transforms it → PixelLab generates sprite

**What Changed from Original Spec**:
- ❌ NO parameter selection UI (type, style, size dropdowns)
- ❌ NO visible template library for users
- ❌ NO advanced options panel (color picker, sliders)
- ❌ NO multi-step wizard
- ✅ Single text input box (500 char limit)
- ✅ Backend "smart prompt" service determines all parameters
- ✅ 50+ backend templates (invisible to user)
- ✅ Plain text preview with character count
- ✅ Desktop-first, basic mobile later

---

## User Flow (Simplified)

1. User clicks "Generate Creature" button
2. Modal opens with **single text input**
3. User types: "armored knight with golden shield"
4. System shows: Character count (34/500)
5. User clicks "Generate"
6. Backend service transforms input → structured PixelLab prompt
7. Job submitted to Generation Queue
8. Modal closes, progress tracked separately

**Total Steps**: 3 (down from 7 in original spec)

---

## Core Components (Minimal)

### Component 1: Text Input Form (Frontend)
**Purpose**: Single-input interface for user description

**Atomic Tasks**:
- **Task 1.1**: Create controlled text input component
  - Input: User text (controlled React state)
  - Output: Text value, onChange handler
  - Validation: 1-500 characters
  - Acceptance: Shows error if <1 or >500 chars
  - Effort: 2 hours

- **Task 1.2**: Implement character count display
  - Input: Current text length
  - Output: "X/500 characters" display
  - Color coding: green (<400), yellow (400-480), red (>480)
  - Acceptance: Updates in real-time as user types
  - Effort: 1 hour

- **Task 1.3**: Add basic input validation
  - Input: Text string
  - Output: Validation errors array
  - Rules: Non-empty, ≤500 chars, no HTML/script tags
  - Acceptance: Shows clear error messages
  - Effort: 2 hours

- **Task 1.4**: Implement submit button with disabled state
  - Input: Validation status
  - Output: Enabled/disabled button
  - Logic: Disabled if validation fails or text empty
  - Acceptance: Button only clickable when valid
  - Effort: 1 hour

**Total Component Effort**: 6 hours

---

### Component 2: Prompt Enhancement Service (Backend)
**Purpose**: Transform user text → structured PixelLab prompt using AI/template logic

**Atomic Tasks**:
- **Task 2.1**: Design template matching algorithm
  - Input: User description string
  - Output: Matched template ID
  - Logic: Keyword extraction → template selection
  - Templates: 50+ predefined patterns (knight, wizard, dragon, etc.)
  - Acceptance: Correctly matches "armored knight" → knight template
  - Effort: 4 hours

- **Task 2.2**: Implement parameter inference service
  - Input: User description + matched template
  - Output: StructuredPrompt object
  - Logic: Template provides defaults, description fills details
  - Example: "knight" → type=unit, style=fantasy, size=32x32, action=idle
  - Acceptance: Returns valid StructuredPrompt for all templates
  - Effort: 3 hours

- **Task 2.3**: Create template library data structure
  - Input: Template configuration file
  - Output: 50+ template definitions (JSON/TypeScript)
  - Schema: name, keywords[], defaultParams, examples[]
  - Acceptance: All templates have required fields
  - Effort: 5 hours

- **Task 2.4**: Add fallback/default template logic
  - Input: Unmatched description
  - Output: Generic default template
  - Logic: If no keyword match → use "generic creature" template
  - Acceptance: Never returns null, always has valid output
  - Effort: 2 hours

**Total Component Effort**: 14 hours

---

### Component 3: API Integration (Backend)
**Purpose**: Connect frontend → backend → PixelLab

**Atomic Tasks**:
- **Task 3.1**: Create POST /api/generation/submit endpoint
  - Input: `{ userId: string, description: string }`
  - Output: `{ jobId: string, status: string }`
  - Validation: Auth check, description validation
  - Acceptance: Returns 200 with jobId on success
  - Effort: 2 hours

- **Task 3.2**: Integrate with Prompt Enhancement Service
  - Input: Raw description from API
  - Output: StructuredPrompt
  - Logic: Call PromptEnhancementService.transform()
  - Acceptance: Transforms description before queue submission
  - Effort: 1 hour

- **Task 3.3**: Connect to Generation Queue
  - Input: StructuredPrompt + userId
  - Output: JobSubmissionResponse from queue
  - Logic: Pass enhanced prompt to existing queue system
  - Acceptance: Job appears in queue, trackable by jobId
  - Effort: 2 hours

- **Task 3.4**: Add error handling and user feedback
  - Input: API errors (validation, queue full, etc.)
  - Output: User-friendly error messages
  - Logic: Classify errors, map to messages
  - Acceptance: Clear errors shown in UI
  - Effort: 2 hours

**Total Component Effort**: 7 hours

---

### Component 4: Preview Panel (Frontend)
**Purpose**: Show user what will be generated (plain text preview)

**Atomic Tasks**:
- **Task 4.1**: Display raw user input as preview
  - Input: User's typed description
  - Output: Preview text display
  - Format: Plain text, read-only
  - Acceptance: Shows exactly what user typed
  - Effort: 1 hour

- **Task 4.2**: Add "what the AI sees" indicator (optional)
  - Input: Enhanced prompt preview from backend (optional API call)
  - Output: Shows simplified version of what will be sent
  - Example: "Knight character, fantasy style, 32x32 pixels"
  - Acceptance: Users understand what's being generated
  - Effort: 2 hours

**Total Component Effort**: 3 hours

---

## Template System Design

### Backend Template Structure

```typescript
interface PromptTemplate {
  id: string;
  name: string;
  keywords: string[]; // For matching user input
  defaults: {
    type: string;
    style: string;
    size: { width: number; height: number };
    action: string;
  };
  variations?: {
    [key: string]: Partial<StructuredPrompt>;
  };
}
```

### Example Templates (First 5 of 50+)

```typescript
const TEMPLATES: PromptTemplate[] = [
  {
    id: 'knight',
    name: 'Knight',
    keywords: ['knight', 'armor', 'armored', 'shield', 'sword'],
    defaults: {
      type: 'unit',
      style: 'fantasy',
      size: { width: 32, height: 32 },
      action: 'idle'
    }
  },
  {
    id: 'wizard',
    name: 'Wizard',
    keywords: ['wizard', 'mage', 'sorcerer', 'magic', 'staff'],
    defaults: {
      type: 'unit',
      style: 'fantasy',
      size: { width: 32, height: 32 },
      action: 'idle'
    }
  },
  {
    id: 'dragon',
    name: 'Dragon',
    keywords: ['dragon', 'flying', 'wings', 'fire'],
    defaults: {
      type: 'unit',
      style: 'fantasy',
      size: { width: 64, height: 64 },
      action: 'flying'
    }
  },
  {
    id: 'robot',
    name: 'Robot',
    keywords: ['robot', 'mech', 'android', 'sci-fi'],
    defaults: {
      type: 'unit',
      style: 'scifi',
      size: { width: 32, height: 32 },
      action: 'idle'
    }
  },
  {
    id: 'default',
    name: 'Generic Creature',
    keywords: [], // Fallback for unmatched
    defaults: {
      type: 'unit',
      style: 'fantasy',
      size: { width: 32, height: 32 },
      action: 'idle'
    }
  }
  // ... 45 more templates
];
```

### Matching Algorithm (Simplified)

```typescript
function matchTemplate(description: string): PromptTemplate {
  const lowerDesc = description.toLowerCase();

  // Find best keyword match
  for (const template of TEMPLATES) {
    for (const keyword of template.keywords) {
      if (lowerDesc.includes(keyword)) {
        return template;
      }
    }
  }

  // Fallback to default template
  return TEMPLATES.find(t => t.id === 'default')!;
}

function enhancePrompt(description: string): StructuredPrompt {
  const template = matchTemplate(description);

  return {
    type: template.defaults.type,
    style: template.defaults.style,
    size: template.defaults.size,
    action: template.defaults.action,
    description: description, // Keep user's original description
    raw: `${template.defaults.type}-${template.defaults.style}-${template.defaults.size.width}x${template.defaults.size.height}-${template.defaults.action}-${description}`
  };
}
```

---

## API Contract

### POST /api/generation/submit

**Request**:
```json
{
  "description": "armored knight with golden shield"
}
```

**Response (Success)**:
```json
{
  "jobId": "uuid-v4-here",
  "status": "pending",
  "enhancedPrompt": {
    "type": "unit",
    "style": "fantasy",
    "size": { "width": 32, "height": 32 },
    "action": "idle",
    "description": "armored knight with golden shield",
    "raw": "unit-fantasy-32x32-idle-armored knight with golden shield"
  }
}
```

**Response (Validation Error)**:
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Description must be between 1 and 500 characters",
  "statusCode": 400
}
```

**Response (Queue Full)**:
```json
{
  "error": "QUEUE_FULL",
  "message": "Generation queue is at capacity. Please try again in a few minutes.",
  "statusCode": 503
}
```

---

## Implementation Order

### Phase 1: Backend Foundation (Day 1)
1. Task 2.3 - Create template library (5h)
2. Task 2.1 - Template matching algorithm (4h)

### Phase 2: Backend Service (Day 2)
3. Task 2.2 - Parameter inference service (3h)
4. Task 2.4 - Fallback logic (2h)
5. Task 3.1 - API endpoint creation (2h)

### Phase 3: Integration (Day 3)
6. Task 3.2 - Integrate enhancement service (1h)
7. Task 3.3 - Connect to queue (2h)
8. Task 3.4 - Error handling (2h)

### Phase 4: Frontend (Day 4)
9. Task 1.1 - Text input component (2h)
10. Task 1.2 - Character count (1h)
11. Task 1.3 - Input validation (2h)
12. Task 1.4 - Submit button (1h)
13. Task 4.1 - Preview panel (1h)
14. Task 4.2 - AI preview (optional) (2h)

**Total: 30 hours** (well within 24-32 hour estimate)

---

## Effort Estimate

### Total: 30 hours

**Breakdown**:
- **Frontend**: 9 hours
  - Text input form: 6h
  - Preview panel: 3h
- **Backend**: 14 hours
  - Prompt enhancement service: 14h
- **API Integration**: 7 hours
  - Endpoint + queue connection: 7h

**Testing** (separate):
- Unit tests: 6 hours
- Integration tests: 4 hours
- E2E tests: 2 hours

**Grand Total with Testing**: 42 hours (~1 week)

---

## What We're NOT Building (Deferred)

### Removed from Original Spec
- ❌ Parameter selection dropdowns (type, style, size, action)
- ❌ Template picker UI with thumbnails
- ❌ Advanced options panel (color palette, sliders, checkboxes)
- ❌ Multi-step wizard (5+ steps)
- ❌ Style gallery with visual examples
- ❌ Animation preview selector
- ❌ Custom dimension inputs
- ❌ Theme/mood selectors

### Future Enhancements (Post-MVP)
- Drawing/image upload (for reference images)
- Advanced mode toggle (show parameter controls)
- Template suggestions as user types
- AI-powered description improvement
- Multi-language support
- Voice input
- Mobile-optimized layout

---

## Testing Strategy

### Unit Tests
- Template matching logic (10+ test cases)
- Prompt enhancement (each template)
- Input validation (edge cases: empty, >500 chars, special chars)
- API endpoint (success, errors, edge cases)

### Integration Tests
- Full flow: description → enhancement → queue submission
- Error scenarios: invalid input, queue full, backend down
- Cache integration (if applicable)

### E2E Tests
- User types → sees preview → clicks generate → job created
- Validation errors display correctly
- Queue integration works end-to-end

---

## Success Criteria

### Functional
- ✅ User can submit description via single text input
- ✅ Backend transforms description → valid StructuredPrompt
- ✅ All 50+ templates match correctly
- ✅ Fallback template handles unknown inputs
- ✅ Job submission succeeds and returns jobId
- ✅ Input validation prevents invalid submissions
- ✅ Character count updates in real-time

### Non-Functional
- ✅ Enhancement service responds in <200ms
- ✅ No user-facing parameter selection UI
- ✅ Works on desktop (mobile later)
- ✅ Templates are backend-only (not exposed to frontend)

### Quality
- ✅ TypeScript strict mode compliance
- ✅ 90%+ test coverage
- ✅ Clear error messages for users
- ✅ No breaking changes to existing queue system

---

## Dependencies

### External
- Existing Generation Queue (F-003) - ✅ Complete
- Existing PixelLab Client (F-001) - ✅ Complete

### Internal
- StructuredPrompt interface (already defined in queue)
- JobSubmissionResponse (already defined)
- User authentication (for userId)

### New Dependencies
- None (uses existing infrastructure)

---

## Open Questions

### 1. Template Expansion Strategy
**Question**: How do we add new templates after launch?

**Options**:
- A) Manual JSON file updates (current plan)
- B) Admin UI for template management
- C) Community-contributed templates
- D) AI-generated templates from usage patterns

**Recommendation**: Start with A (manual), add B (admin UI) later

---

### 2. Multi-Keyword Matching
**Question**: If description matches multiple templates, which wins?

**Options**:
- A) First match wins (current plan)
- B) Most keywords matched wins
- C) Weighted score (common keywords < rare keywords)
- D) Ask user to choose (defeats "simple" purpose)

**Recommendation**: Start with A (first match), optimize with B later

---

### 3. Description Sanitization
**Question**: Should we clean/modify user input before passing to PixelLab?

**Options**:
- A) Pass exactly as typed (current plan)
- B) Remove profanity/inappropriate content
- C) Enhance with AI (add details)
- D) Translate to English if other language

**Recommendation**: Start with A, add B (content filter) for production

---

### 4. Preview Accuracy
**Question**: Should preview show exact PixelLab prompt or simplified version?

**Options**:
- A) Show user's exact text (current plan)
- B) Show enhanced structured prompt
- C) Show both (original + enhanced)
- D) No preview at all

**Recommendation**: Implement A (simplest), add C (both) if users request it

---

## Risk Assessment

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| **Template matching inaccuracy** | MEDIUM | MEDIUM | Extensive testing, fallback template, user feedback loop |
| **User confusion (no parameters)** | LOW | MEDIUM | Clear messaging: "AI will choose best settings for you" |
| **Limited template coverage** | MEDIUM | HIGH | Start with 50+ templates, add more based on usage analytics |
| **Description quality varies** | HIGH | HIGH | Template defaults handle poor descriptions, AI can enhance later |
| **No way to customize results** | MEDIUM | MEDIUM | Document as MVP limitation, plan advanced mode for later |

---

## Next Steps

1. **Review & Approve**: Confirm this simplified approach meets vision
2. **Define 50+ Templates**: Complete template library design
3. **Backend Implementation**: Build enhancement service (14h)
4. **API Implementation**: Create endpoint (7h)
5. **Frontend Implementation**: Build UI (9h)
6. **Testing**: Comprehensive test suite (12h)
7. **Integration**: Connect to existing queue system (2h)

**Total Time to Launch**: ~1 week (42 hours with testing)

---

## Metadata

**Feature ID**: F-003-SIMPLIFIED
**Replaces**: F-003 (original complex version)
**Epic**: AI Generation Pipeline (E-001)
**Priority**: HIGH (blocks user-facing generation)
**Complexity**: MEDIUM (backend logic, simple UI)
**Estimated Effort**: 30 hours (42 with testing)

---

*This simplified feature breakdown focuses on the core user need: "I describe what I want, the system figures out how to generate it." All complexity is hidden in backend template logic, presenting users with a single, intuitive text input.*
