# Drawn of War - Documentation Index

**Welcome to the documentation!** This guide helps you navigate all project documentation.

---

## Quick Start

**New to the project?** Start here:
1. **[Project README](/README.md)** - Project overview and setup
2. **[Getting Started Guide](/GETTING_STARTED.md)** - Quick setup in 6 steps
3. **[Project Status](/PROJECT_STATUS.md)** - What's working and what's next

**Developing?** See these:
- **[Testing Guide](/TESTING_GUIDE.md)** - How to test the system
- **[Troubleshooting](/TROUBLESHOOTING.md)** - Common issues and solutions

---

## Documentation Organization

### Root Level (Essential Docs)
Located in `/`:
- **README.md** - Project overview, architecture, tech stack
- **PROJECT_STATUS.md** - Comprehensive status of all features
- **GETTING_STARTED.md** - Quick start guide for new developers
- **TESTING_GUIDE.md** - Testing procedures and best practices
- **TROUBLESHOOTING.md** - Common issues and solutions

### Specifications (`/docs/specs/`)
Complete planning documentation following L0-L4 hierarchy:

#### L0 - Vision (3 docs)
- `L0-VISION/drawn-of-war-vision-highlevel.md` - Project vision and goals
- `L0-VISION/core-creature-creation-considerations.md` - Core design philosophy
- `L0-VISION/creating-speical-creature-animations.md` - Animation vision

#### L1 - Themes (9 docs)
Major feature areas:
- `L1-THEMES/ai-generation-pipeline.md` - AI-powered generation system
- `L1-THEMES/battle-engine.md` - Tactical combat system
- `L1-THEMES/battle-engine-refined.md` - Enhanced battle system spec
- `L1-THEMES/creature-creation-experience.md` - User-facing creation flow
- `L1-THEMES/content-management-storage.md` - Data persistence
- `L1-THEMES/matchmaking-session-management.md` - Multiplayer systems
- `L1-THEMES/platform-infrastructure.md` - Infrastructure and deployment
- `L1-THEMES/trust-safety.md` - Content moderation and safety
- `L1-THEMES/_index.md` - Theme overview

#### L2 - Epics (7 docs)
Significant user journeys:

**AI Generation Pipeline**:
- `L2-EPICS/ai-generation-pipeline/pixellab-integration.md` - PixelLab API integration

**Battle Engine**:
- `L2-EPICS/battle-engine/EPIC_SUMMARY.md` - Complete battle system overview
- `L2-EPICS/battle-engine/hex-grid-deployment-system.md` - Hex grid tactical deployment
- `L2-EPICS/battle-engine/authoritative-server-simulation.md` - Server-side combat simulation
- `L2-EPICS/battle-engine/client-rendering-animation-sync.md` - Client-side rendering
- `L2-EPICS/battle-engine/combat-mechanics-ability-system.md` - Combat mechanics
- `L2-EPICS/battle-engine/multi-round-battle-system.md` - Turn-based battle flow

#### L3 - Features (12+ docs)
Implementable features:

**AI Generation Pipeline**:
- `L3-FEATURES/ai-generation-pipeline/pixellab-api-client.md` - API client implementation
- `L3-FEATURES/ai-generation-pipeline/generation-queue.md` - Job queue system
- `L3-FEATURES/ai-generation-pipeline/prompt-builder.md` - Prompt builder UI
- `L3-FEATURES/ai-generation-pipeline/animation-library.md` - 55 pre-generated animations
- `L3-FEATURES/ai-generation-pipeline/effect-compositing-system.md` - Effect overlays

**Battle Engine**:
- `L3-FEATURES/battle-engine/IMPLEMENTATION_SUMMARY.md` - Battle engine status
- `L3-FEATURES/battle-engine/hex-grid-deployment-system/hex-math-library.md` - Hex grid math
- `L3-FEATURES/battle-engine/hex-grid-deployment-system/grid-rendering-visualization.md` - PixiJS rendering
- `L3-FEATURES/battle-engine/hex-grid-deployment-system/drag-drop-placement-controller.md` - Drag-and-drop
- `L3-FEATURES/battle-engine/hex-grid-deployment-system/deployment-validation.md` - Server validation
- `L3-FEATURES/battle-engine/authoritative-server-simulation/simulation-loop-tick-manager.md` - 60 tps simulation

**Battlefield Views**:
- `L3-BATTLEFIELD-VIEW-GENERATION.md` - Multi-directional sprite generation spec

#### L4 - Tasks
Atomic development tasks:
- `L4-TASKS/ai-generation-pipeline/prompt-builder-tasks.md` - Prompt builder task breakdown

### Feature Documentation (`/docs/features/`)
In-depth feature guides and integration documentation:

- **[Animation Studio](/docs/features/ANIMATION_STUDIO.md)** - Testing creature animations
- **[Multi-Directional Sprites](/docs/features/MULTI_DIRECTIONAL_SPRITES.md)** - 6-directional sprite system (MOST CURRENT)
- **[Battlefield View Integration](/docs/features/BATTLEFIELD_VIEW_INTEGRATION.md)** - Battlefield view implementation guide

### Implementation Reports (`/docs/implementation-reports/`)
Current major implementations:

- **[Battlefield View Implementation](/docs/implementation-reports/BATTLEFIELD_VIEW_IMPLEMENTATION_REPORT.md)** - Latest battlefield view completion report (2025-10-05)

### Backend Documentation (`/backend/`)
Backend-specific documentation:

- **[Backend README](/backend/README.md)** - Backend setup and architecture
- **[API Keys Setup](/backend/API_KEYS_SETUP.md)** - Configuring PixelLab and Claude APIs
- **[Backend Implementation Status](/backend/docs/IMPLEMENTATION_STATUS.md)** - Current backend status
- **[Phase 3 Integration Complete](/backend/docs/PHASE3_INTEGRATION_COMPLETE.md)** - Phase 3 completion

### Frontend Documentation (`/frontend/`)
Frontend-specific documentation:

- **[Frontend README](/frontend/README.md)** - Frontend setup and structure

### Design Decisions (`/docs/decisions/`)
Important design decisions and trade-offs:

- **[Design Decisions Resolved](/docs/decisions/design-decisions-resolved.md)** - Key architectural decisions

### Archived Documentation (`/docs/archive/`)
Historical documentation preserved for reference:

- **[Archive Index](/docs/archive/ARCHIVED.md)** - Complete index of archived docs
- Planning sessions (completed)
- Implementation reports (features complete)
- Test reports (tests passed)
- Fix reports (bugs fixed)
- Progress reports (milestones reached)
- Research notes (research complete)

---

## Documentation by Topic

### Getting Started & Setup
1. [Project Overview](/README.md)
2. [Quick Start Guide](/GETTING_STARTED.md)
3. [Backend Setup](/backend/README.md)
4. [API Keys Configuration](/backend/API_KEYS_SETUP.md)

### Current Status & Planning
1. [Project Status](/PROJECT_STATUS.md) - Comprehensive feature status
2. [Backend Implementation Status](/backend/docs/IMPLEMENTATION_STATUS.md)
3. [Battle Engine Summary](/docs/specs/L2-EPICS/battle-engine/EPIC_SUMMARY.md)

### AI Generation System
1. [AI Generation Pipeline Theme](/docs/specs/L1-THEMES/ai-generation-pipeline.md)
2. [PixelLab Integration Epic](/docs/specs/L2-EPICS/ai-generation-pipeline/pixellab-integration.md)
3. [Generation Queue Feature](/docs/specs/L3-FEATURES/ai-generation-pipeline/generation-queue.md)
4. [Animation Library](/docs/specs/L3-FEATURES/ai-generation-pipeline/animation-library.md)

### Battle Engine & Hex Grid
1. [Battle Engine Theme](/docs/specs/L1-THEMES/battle-engine-refined.md)
2. [Hex Grid Deployment Epic](/docs/specs/L2-EPICS/battle-engine/hex-grid-deployment-system.md)
3. [Hex Math Library](/docs/specs/L3-FEATURES/battle-engine/hex-grid-deployment-system/hex-math-library.md)
4. [Drag-Drop Controller](/docs/specs/L3-FEATURES/battle-engine/hex-grid-deployment-system/drag-drop-placement-controller.md)
5. [Battle Engine Implementation](/docs/BATTLE_ENGINE_IMPLEMENTATION.md)

### Creature Sprites & Animation
1. [Animation Studio Guide](/docs/features/ANIMATION_STUDIO.md)
2. [Multi-Directional Sprites](/docs/features/MULTI_DIRECTIONAL_SPRITES.md) - **MOST CURRENT**
3. [Battlefield View Integration](/docs/features/BATTLEFIELD_VIEW_INTEGRATION.md)
4. [Animation Library System](/docs/specs/L3-FEATURES/ai-generation-pipeline/animation-library.md)

### Testing & Troubleshooting
1. [Testing Guide](/TESTING_GUIDE.md)
2. [Troubleshooting Guide](/TROUBLESHOOTING.md)

---

## Documentation by Role

### New Developers
Start here:
1. [Getting Started](/GETTING_STARTED.md) - Setup in 6 steps
2. [Project Status](/PROJECT_STATUS.md) - What works now
3. [Testing Guide](/TESTING_GUIDE.md) - How to test
4. [Troubleshooting](/TROUBLESHOOTING.md) - Common issues

### Backend Developers
Focus on:
1. [Backend README](/backend/README.md)
2. [API Keys Setup](/backend/API_KEYS_SETUP.md)
3. [Generation Queue](/docs/specs/L3-FEATURES/ai-generation-pipeline/generation-queue.md)
4. [PixelLab API Client](/docs/specs/L3-FEATURES/ai-generation-pipeline/pixellab-api-client.md)
5. [Backend Status](/backend/docs/IMPLEMENTATION_STATUS.md)

### Frontend Developers
Focus on:
1. [Frontend README](/frontend/README.md)
2. [Animation Studio](/docs/features/ANIMATION_STUDIO.md)
3. [Hex Grid Rendering](/docs/specs/L3-FEATURES/battle-engine/hex-grid-deployment-system/grid-rendering-visualization.md)
4. [Drag-Drop Controller](/docs/specs/L3-FEATURES/battle-engine/hex-grid-deployment-system/drag-drop-placement-controller.md)

### Game Designers
Focus on:
1. [Vision Documents](/docs/specs/L0-VISION/)
2. [Battle Engine Theme](/docs/specs/L1-THEMES/battle-engine-refined.md)
3. [Creature Creation Experience](/docs/specs/L1-THEMES/creature-creation-experience.md)
4. [Combat Mechanics](/docs/specs/L2-EPICS/battle-engine/combat-mechanics-ability-system.md)

### Project Managers
Focus on:
1. [Project Status](/PROJECT_STATUS.md)
2. [Epic Summaries](/docs/specs/L2-EPICS/)
3. [Implementation Reports](/docs/implementation-reports/)
4. [Design Decisions](/docs/decisions/)

---

## Documentation Standards

This project follows **documentation-driven development**:

1. **Planning First**: Features start with L3 specifications
2. **Break Down**: Features broken into atomic L4 tasks
3. **TDD Approach**: Tests written before implementation
4. **Continuous Updates**: Documentation updated as work progresses
5. **Archive When Complete**: Completed planning/implementation archived

See `/.claude/CLAUDE.md` for complete development guidelines.

---

## Key Documentation Principles

1. **Hierarchy**: L0 (vision) → L1 (themes) → L2 (epics) → L3 (features) → L4 (tasks)
2. **Separation**: Active docs in `/docs/specs/`, historical in `/docs/archive/`
3. **Feature Guides**: Detailed guides in `/docs/features/`
4. **Status Tracking**: PROJECT_STATUS.md is primary status document
5. **Root Cleanup**: Root has max 5-6 essential docs

---

## Recent Documentation Changes (2025-10-05)

**Cleanup completed**:
- Root level: 15 files → 6 files (60% reduction)
- Created `/docs/features/` for feature guides
- Moved 28+ files to archive with clear organization
- Created comprehensive archive index
- Created this navigation document

**Archive structure**:
- By date: Planning sessions and snapshots
- By category: Implementation, testing, fixes, research
- Complete index: `/docs/archive/ARCHIVED.md`

---

## Contributing to Documentation

When adding documentation:
1. **Root level**: Only essential project docs (README, status, guides)
2. **Specs**: Follow L0-L4 hierarchy, use appropriate level
3. **Features**: Detailed feature guides go in `/docs/features/`
4. **Implementation**: Reports in `/docs/implementation-reports/`
5. **Archive**: Completed planning/implementation goes to `/docs/archive/`

When archiving:
1. Use dated directories for planning (YYYY-MM-DD-topic)
2. Use category directories for implementation (reports, tests, fixes)
3. Update `/docs/archive/ARCHIVED.md` with entry
4. Preserve all content (no deletions)

---

## Documentation Maintenance

**Monthly** (or as needed):
- Review root level for creep
- Archive completed implementation reports
- Update PROJECT_STATUS.md

**Quarterly**:
- Full documentation audit
- Consolidate duplicate content
- Update this index

**Last Audit**: 2025-10-05 (see `/DOCUMENTATION_AUDIT_REPORT.md`)
**Next Audit**: January 2026

---

## Need Help?

**Can't find something?**
- Check `/docs/archive/ARCHIVED.md` for archived docs
- Use search: `grep -r "topic" docs/`
- Check git history: `git log --all --full-history -- "docs/path/file.md"`

**Documentation unclear?**
- Check parent level (L3 → L2 → L1 → L0)
- Check implementation reports for context
- See design decisions in `/docs/decisions/`

**Want to add documentation?**
- Follow documentation-driven development (see `/.claude/CLAUDE.md`)
- Use appropriate hierarchy level (L0-L4)
- Update this index when adding major docs

---

**Happy coding!**

For questions about documentation structure, see `/.claude/CLAUDE.md` or consult the development team.
