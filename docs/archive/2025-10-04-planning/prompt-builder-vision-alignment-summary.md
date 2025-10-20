# Prompt Builder Vision Alignment Summary

**Date**: 2025-10-01
**Purpose**: Executive summary of misalignment correction and revised specifications

---

## Executive Summary

The Prompt Builder feature specification has been comprehensively revised to align with the user's actual multi-modal vision. The original text-only specification (32-40 hours) has been replaced with a complete multi-modal system (68-92 hours) incorporating drawing canvas, image upload, Claude Vision API integration, and style preservation.

### Key Changes at a Glance

| Aspect | Before (Text-Only) | After (Multi-Modal) | Change |
|--------|-------------------|---------------------|--------|
| **Input Methods** | Text only | Draw + Text + Upload | +2 methods |
| **AI Integration** | Rule-based templates | Claude Vision API | +AI analysis |
| **Style Preservation** | None | Validation system | +New feature |
| **Animation Assignment** | Template-based | AI-suggested (20+) | +Enhanced |
| **Effort Estimate** | 32-40 hours | 68-92 hours | +2x |
| **Cost per Generation** | $0 (text) | $0-0.03 (mixed) | +$0-0.03 |
| **Architecture** | Single-path | Dual-path + parallel | +Complex |

---

## What Was Misaligned

### Critical Omissions in Original Spec

1. **No Drawing Canvas** - Despite L0 Vision stating "Draw on canvas" as primary creation method
2. **No Image Upload** - Third input modality completely missing
3. **No Claude Vision API** - No AI analysis of visual inputs
4. **No Style Preservation** - L0 Vision explicitly requires "Drawing Personality Preservation"
5. **No Animation Intelligence** - Missing AI-driven animation assignment

### Root Cause

- L3 spec focused on simplest path (text-only)
- User's recent confirmation clarified: "We need drawing/image/text for MVP"
- Drawing/upload were incorrectly assumed to be post-MVP
- Claude Vision integration was not considered in original scope

---

## What the User Confirmed

### Direct Quotes from User

> "We need drawing/image/text for MVP"

> "Claude API will analyze submission for game attribute assignment"

> "we will also pass submission to pixellab for rendering and bring it back to show user with game attributes"

> "YES! User needs to feel like their drawing matters"

### User's Complete Vision

**THREE Input Methods** (all MVP):
1. 🎨 **Drawing Canvas** - In-browser HTML5 Canvas with brush tools
2. 📝 **Text Description** - 500 character text input
3. 📤 **Image Upload** - Drag-and-drop file picker

**Dual-API Architecture**:
- **Claude Vision API** → Analyzes drawings/images, assigns attributes/animations
- **PixelLab.ai API** → Generates sprites with style preservation

**Critical User Requirement**:
- "User needs to feel like their drawing matters" = Style must be preserved in final sprite

---

## Updated Architecture

### Multi-Modal Input Flow

```
USER CHOOSES INPUT METHOD
├─ 🎨 Draw It → HTML5 Canvas with brush tools
├─ 📝 Describe It → Text input (500 chars)
└─ 📤 Upload It → Drag-and-drop (PNG/JPG, 5MB)
         ↓
INPUT NORMALIZATION (NEW)
All inputs → 512x512 PNG base64
         ↓
PARALLEL PROCESSING (NEW)
┌──────────────────────┬────────────────────────┐
│ CLAUDE VISION API    │ PIXELLAB.AI API        │
│ (if drawing/upload)  │ (all inputs)           │
│ ↓                    │ ↓                      │
│ • Analyzes image     │ • Generates sprite     │
│ • Extracts concept   │ • Preserves style      │
│ • Assigns attributes │ • Returns frames       │
│ • Suggests 20+ anims │                        │
└──────────────────────┴────────────────────────┘
         ↓
ANIMATION MAPPING (NEW)
Claude suggestions → Animation Library IDs (50-100 animations)
         ↓
STYLE VALIDATION (NEW)
Original vs Generated → Pass/Fail + Score (60% threshold)
         ↓
COMPLETE CREATURE
Sprite + Attributes + 20+ Animations + Style Preserved
```

### Two Processing Paths

**TEXT INPUT PATH** (rule-based, $0):
- Text → Keyword extraction → Template matching (50+ templates)
- Fast (<100ms), free, good for common creatures

**VISUAL INPUT PATH** (AI-powered, $0.01-0.03):
- Drawing/Upload → Claude Vision analysis → Attribute assignment
- Parallel: PixelLab generates sprite with style hints
- Style validation ensures user's drawing style preserved

---

## New Components Required

### Frontend Components (NEW)

1. **Input Method Selector** (1-2 hrs)
   - Three-button toggle: Draw / Text / Upload
   - Visual icons, active state, keyboard navigation

2. **Drawing Canvas** (8-12 hrs) - **MAJOR NEW COMPONENT**
   - HTML5 Canvas (512x512px)
   - Tools: Brush, eraser, undo/redo, color picker
   - Export to PNG blob for submission
   - Touch-friendly (works on mobile)

3. **Image Upload** (3-4 hrs)
   - Drag-and-drop zone
   - File picker fallback
   - Validation (PNG/JPG, 5MB max)
   - Preview before submission

4. **Text Input** (1-2 hrs updates)
   - Already spec'd, now integrated into multi-modal system
   - Shares submission button with other methods

### Backend Services (NEW)

1. **Input Normalizer** (4-6 hrs)
   - Converts all inputs → 512x512 PNG base64
   - Handles canvas blobs, uploaded files, text

2. **Claude Vision Service** (10-14 hrs) - **MAJOR NEW SERVICE**
   - Integrates Claude Vision API
   - Analyzes images to extract creature concept
   - Assigns game attributes (stats, abilities, animations)
   - Extracts style characteristics
   - Cost tracking ($0.01-0.03 per analysis)

3. **Animation Mapper** (6-8 hrs)
   - Maps Claude's suggestions → Animation Library IDs
   - Ensures minimum 20 animations per creature
   - Covers base animations (idle, walk, attack, death) + specials

4. **Style Preservation Validator** (4-6 hrs)
   - Compares original drawing vs. generated sprite
   - Color palette similarity (60% weight)
   - Shape similarity (40% weight)
   - Pass/fail threshold: 60% overall score
   - User feedback if failed

5. **Prompt Enhancement Service** (6-8 hrs refactoring)
   - UPDATED: Now routes to text-only OR visual path
   - Text path: Existing rule-based templates (50+)
   - Visual path: Claude Vision + PixelLab integration

6. **Express API** (1-2 hrs updates)
   - UPDATED: Now accepts multipart/form-data (file uploads)
   - Handles text, canvas blobs, uploaded files

---

## Effort Re-Estimation

### Phase Breakdown

| Phase | Description | Effort | Key Deliverables |
|-------|-------------|--------|------------------|
| **Phase 0** | Multi-Modal Input UI (NEW) | 14-20 hrs | Drawing canvas, image upload, input selector |
| **Phase 1** | Express API Server (updated) | 5-7 hrs | File upload support, multi-modal routing |
| **Phase 2** | Prompt Enhancement (major updates) | 26-34 hrs | Claude Vision, Animation Mapper, Style Validator |
| **Phase 3** | React Frontend (updates) | 12-15 hrs | Wire all three inputs to API, loading states |
| **Phase 4** | Integration & Testing (expanded) | 11-16 hrs | Parallel processing, style validation, E2E tests |
| **TOTAL** | | **68-92 hrs** | Complete multi-modal system |

### Component Type Breakdown

| Component Type | Original | NEW | Delta |
|----------------|----------|-----|-------|
| Frontend UI | 9-11 hrs | 26-35 hrs | **+17-24 hrs** |
| Backend Services | 18-22 hrs | 31-41 hrs | **+13-19 hrs** |
| Integration & Testing | 5-7 hrs | 11-16 hrs | **+6-9 hrs** |
| **TOTAL** | **32-40 hrs** | **68-92 hrs** | **+36-52 hrs (~2x)** |

### Risk Factors (Could Increase Effort Further)

**High Risk**:
- Claude Vision API reliability issues: +4-6 hrs
- Style preservation accuracy problems: +8-12 hrs
- Drawing canvas performance on mobile: +4-6 hrs
- Animation mapping complexity: +6-8 hrs

**Potential Total**: Up to 120 hours if all high-risk issues occur

---

## Cost Model Changes

### Per-Generation Costs

**TEXT INPUT** (rule-based):
- Cost: **$0** (free, no API calls)
- Time: <100ms
- Quality: Good for common creatures

**DRAWING/UPLOAD INPUT** (AI-powered):
- Cost: **$0.01-0.03** (Claude Vision API)
  - Claude 3 Sonnet: ~$0.01-0.015 per image
  - Plus PixelLab costs (same as text)
- Time: 30-50 seconds total
- Quality: Excellent, creative, style-preserved

### Monthly Cost Estimates

**Scenario 1: 1,000 Generations/Month**
- 30% text (300 × $0) = $0
- 70% visual (700 × $0.02) = $14
- **Total Claude API**: ~$14/month

**Scenario 2: 10,000 Generations/Month**
- 30% text (3,000 × $0) = $0
- 70% visual (7,000 × $0.02) = $140
- **Total Claude API**: ~$140/month

**Note**: These estimates exclude PixelLab.ai API costs (same for both paths)

---

## Architecture Diagrams

### Before: Text-Only Architecture

```
TEXT INPUT (500 chars)
    ↓
KEYWORD EXTRACTION
    ↓
TEMPLATE MATCHING (50+ templates)
    ↓
STRUCTURED PROMPT
    ↓
PIXELLAB API
    ↓
SPRITE (no style preservation)
```

### After: Multi-Modal Architecture

```
USER INPUT (3 methods)
├─ 🎨 Draw → Canvas blob
├─ 📝 Text → String
└─ 📤 Upload → File
       ↓
INPUT NORMALIZATION
All → 512x512 PNG base64
       ↓
PARALLEL PROCESSING
┌─────────────────────┬──────────────────────┐
│ CLAUDE VISION API   │ PIXELLAB API         │
│ • Analyze image     │ • Generate sprite    │
│ • Assign attributes │ • Preserve style     │
│ • Suggest 20+ anims │                      │
└─────────────────────┴──────────────────────┘
       ↓                       ↓
ANIMATION MAPPING          SPRITE FRAMES
       ↓                       ↓
       └───────┬───────────────┘
               ↓
      STYLE VALIDATION
      (Original vs Generated)
               ↓
       COMPLETE CREATURE
   (Sprite + Attributes + Animations + Style)
```

---

## Updated L0 Vision Alignment

### Requirements from L0 Vision (lines 72-73, 33)

✅ **"Draw on canvas"** → Phase 0 creates HTML5 drawing canvas
✅ **"Upload image"** → Phase 0 creates image upload component
✅ **"Describe in text"** → Phase 0 integrates text input
✅ **"Drawing Personality Preservation"** → Style Preservation Validator
✅ **"Player's art style maintained"** → PixelLab receives style hints from Claude
✅ **"20+ animations per creature"** → Animation Mapper ensures comprehensive sets

### Core Vision Promise

> "Democratize game creation by allowing players to manifest their imagination directly into gameplay"

**Original spec failed this** by limiting input to text-only.
**Updated spec delivers this** by enabling drawing, uploading, and preserving the user's visual style.

---

## Files Updated

### 1. Archived (Old Specifications)
- `/docs/archive/2025-10-01-text-only-specs/prompt-builder-text-only.md`
- `/docs/archive/2025-10-01-text-only-specs/prompt-builder-tasks-text-only.md`
- `/docs/archive/2025-10-01-text-only-specs/README.md` (explains what changed)

### 2. Created (Planning Documents)
- `/docs/planning/prompt-builder-vision-alignment-plan.md` (comprehensive analysis, 1000+ lines)
- `/docs/planning/prompt-builder-vision-alignment-summary.md` (this file)

### 3. Updated (Specifications)
- `/docs/specs/L3-FEATURES/ai-generation-pipeline/prompt-builder.md` (completely rewritten)
- `/docs/specs/L4-TASKS/ai-generation-pipeline/prompt-builder-tasks.md` (needs updating)
- `/docs/specs/L2-EPICS/ai-generation-pipeline/pixellab-integration.md` (Feature #2 description needs updating)

---

## Open Questions (Blockers)

### BLOCKER: Claude API Budget
**Question**: What's the monthly budget limit for Claude Vision API?
**Impact**: Determines if we can proceed with visual input path or need cost-reduction measures
**User Decision Required**: Yes

### Other Important Questions

1. **Claude Model Selection**: Sonnet ($0.01/image) vs Opus ($0.03/image)?
   - Recommendation: Start with Sonnet, A/B test quality

2. **Style Validation Threshold**: 60% similarity required?
   - Recommendation: Start with 60%, adjust based on user feedback

3. **Drawing Canvas Library**: Custom build vs react-canvas-draw?
   - Recommendation: Use react-canvas-draw for MVP (faster)

4. **Parallel vs Sequential APIs**: Claude + PixelLab parallel or sequential?
   - Recommendation: Parallel for speed (saves 3-5 seconds)

5. **Rate Limiting**: Per-user limits for Claude API?
   - Recommendation: 10 generations/hour per user for MVP

---

## Implementation Roadmap

### Week 1-2: Foundation (Phase 0)
- Build drawing canvas component
- Build image upload component
- Implement input normalization
- **Deliverable**: All three input methods functional

### Week 3-4: Intelligence Layer (Phase 2)
- Integrate Claude Vision API
- Build animation mapper
- Build style preservation validator
- **Deliverable**: AI analyzes images and assigns attributes

### Week 5: Frontend Integration (Phase 3)
- Wire UI components to backend
- Implement loading states
- Add error handling
- **Deliverable**: End-to-end user flow working

### Week 6: Testing & Polish (Phase 4)
- Parallel processing optimization
- Comprehensive E2E tests
- Performance testing (100+ concurrent users)
- **Deliverable**: Production-ready system

**Total Timeline**: 6 weeks (was 1 sprint for text-only)

---

## Success Metrics

### Functional Requirements
- ✅ All three input methods work end-to-end
- ✅ 95%+ of submissions produce playable creatures
- ✅ Claude Vision returns valid analysis 95%+ of time
- ✅ Style preservation passes validation 80%+ of time
- ✅ Every creature has minimum 20 animations

### User Experience
- ✅ Drawing canvas has no lag (<16ms latency)
- ✅ Total generation time <60 seconds
- ✅ Users feel their drawing style is preserved
- ✅ Regeneration option available if style fails

### Technical Performance
- ✅ API response time <200ms
- ✅ System handles 100 concurrent users
- ✅ Test coverage >90%

### Cost
- ✅ Average cost per generation <$0.03 (Claude Vision)
- ✅ Monthly Claude API costs under budget limit
- ✅ No API rate limit issues

---

## Key Takeaways

### What We Learned

1. **Always validate L0 Vision alignment early** - Drawing input was mentioned in L0, but missed in L3
2. **Question simplifying assumptions** - "Just use templates" missed the AI analysis requirement
3. **Estimate conservatively for AI integration** - Claude Vision adds significant complexity
4. **Style preservation is critical** - User explicitly stated "their drawing matters"

### Why This Matters

The original text-only spec would have delivered a functional system, but **violated the core vision**:
- No drawing input (primary creation method per L0)
- No style preservation (L0 requirement)
- Limited creativity (text-only descriptions)
- Missed key differentiator (AI-powered visual analysis)

The updated multi-modal spec **delivers the actual vision**:
- Three input methods (MVP requirement)
- Style preservation (user's drawing matters)
- AI-powered intelligence (Claude analyzes everything)
- 20+ animations per creature (comprehensive sets)

---

## Next Steps

1. **User Review** ✅ Required
   - Confirm multi-modal architecture
   - Approve Claude API budget
   - Answer open questions (#1-#6)

2. **Update L4 Tasks** ⏳ In Progress
   - Break down Phase 0 into atomic tasks
   - Break down Claude Vision integration into tasks
   - Update effort estimates

3. **Update L2 Epic** ⏳ Pending
   - Update Feature #2 description in PixelLab Integration epic
   - Update effort estimate (68-92 hrs vs 32-40 hrs)
   - Update status from "Ready" to "In Planning"

4. **Begin Implementation** ⏳ Awaiting Approval
   - Start with Phase 0 (Multi-Modal Input UI)
   - Parallel: Set up Claude Vision API credentials
   - Deliverable: Drawing canvas functional

---

## Conclusion

The Prompt Builder feature has been comprehensively revised to align with the user's multi-modal vision. This is a **2x increase in effort** (68-92 hours vs 32-40 hours) and introduces **new API costs** ($0.01-0.03 per visual generation), but delivers the **actual vision** required for MVP.

**Critical**: User approval needed for Claude API budget before implementation can begin.

**Impact**: This change affects the entire creature creation workflow and is foundational to the project's differentiation.

**Recommendation**: Proceed with multi-modal architecture as spec'd. The user's explicit confirmation ("We need drawing/image/text for MVP", "User needs to feel like their drawing matters") leaves no ambiguity that this is the correct direction.

---

**Document Status**: Complete - Ready for User Review
**Created**: 2025-10-01
**Author**: AI Orchestrator
**Reviewed**: Pending user approval
