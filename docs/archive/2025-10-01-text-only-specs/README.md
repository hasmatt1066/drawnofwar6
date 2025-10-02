# Archive: Text-Only Prompt Builder Specifications

**Archived**: 2025-10-01
**Reason**: Misalignment with user's actual multi-modal vision

---

## What Was Archived

This directory contains the original specifications for the Prompt Builder feature that assumed a **text-only input system**.

### Files Archived:
1. `prompt-builder-text-only.md` - L3 Feature Specification
2. `prompt-builder-tasks-text-only.md` - L4 Task Breakdown

### Original Scope:
- **Single text input box** (textarea, 500 character limit)
- **Rule-based prompt enhancement** (50+ templates, keyword matching)
- **No visual input methods** (no drawing canvas, no image upload)
- **Estimated effort**: 32-40 hours

---

## Why This Was Archived

### The Misalignment

These specifications fundamentally missed the user's core vision for Drawn of War:

1. **Missing Drawing Canvas**: L0 Vision (lines 72-73) explicitly states "Draw on canvas" as primary creation method
2. **Missing Image Upload**: Third input modality completely absent
3. **Missing Style Preservation**: L0 Vision (line 33) requires "Drawing Personality Preservation: Player's art style maintained in pixel art conversion"
4. **Missing AI Analysis**: No Claude Vision API integration for analyzing visual inputs and assigning attributes

### User's Confirmation

The user explicitly confirmed the multi-modal requirement:

> "We need drawing/image/text for MVP"

> "Claude API will analyze submission for game attribute assignment"

> "YES! User needs to feel like their drawing matters"

---

## What Changed

### New Architecture: Multi-Modal Input System

The updated specifications now include:

**THREE Input Methods** (all MVP):
1. **Drawing Canvas** - HTML5 Canvas with brush tools, colors, undo/redo
2. **Text Description** - 500 character text input (as originally spec'd)
3. **Image Upload** - Drag-and-drop file picker (PNG/JPG, 5MB max)

**Dual-API Architecture**:
- **Claude Vision API** - Analyzes drawings/images to extract creature concept and assign game attributes
- **PixelLab.ai API** - Generates sprites with style preservation

**New Components**:
- Input Method Selector
- Drawing Canvas Component (8-12 hours)
- Image Upload Component (3-4 hours)
- Input Normalization Service
- Claude Vision Integration (10-14 hours)
- Animation Mapper Service (6-8 hours)
- Style Preservation Validator (4-6 hours)

**Updated Effort Estimate**:
- FROM: 32-40 hours (text-only)
- TO: 68-92 hours (multi-modal with Claude Vision)
- INCREASE: ~2x original estimate

**Updated Cost Model**:
- Text input: $0 per generation (rule-based, as before)
- Drawing/Image input: +$0.01-0.03 per generation (Claude Vision API)

---

## Where to Find Updated Specs

**Current Specifications** (multi-modal):
- `/docs/specs/L3-FEATURES/ai-generation-pipeline/prompt-builder.md` (updated)
- `/docs/specs/L4-TASKS/ai-generation-pipeline/prompt-builder-tasks.md` (updated)

**Planning Document**:
- `/docs/planning/prompt-builder-vision-alignment-plan.md` (comprehensive analysis)

---

## Lessons Learned

1. **Always validate input modalities early** - Don't assume text-only when L0 Vision mentions drawing
2. **Question simplifying assumptions** - "Just use templates" missed the AI analysis requirement
3. **Check for style preservation requirements** - Visual input demands style transfer, not just generation
4. **Estimate conservatively for AI integration** - Claude Vision API adds significant complexity

---

## Document Metadata

**Archived By**: AI Orchestrator
**Archive Date**: 2025-10-01
**Original Created**: 2025-09-29
**Original Last Updated**: 2025-10-01
**Reason**: Fundamental misalignment with user vision
**Status**: Superseded by multi-modal specifications
