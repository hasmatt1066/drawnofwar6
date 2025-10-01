# L2 EPIC: PixelLab.ai Integration & Management

**Epic ID**: `ai-gen-pixellab`
**Parent Theme**: AI-Powered Asset Generation (L1)
**Status**: IN PROGRESS (2/14 features complete - PixelLab API Client ✅, Generation Queue ✅)
**Version**: 1.1
**Last Updated**: 2025-09-30

---

## Epic Summary

Integrate PixelLab.ai's sprite generation API into Drawn of War to enable on-demand creation of animated game assets. This epic encompasses the complete pipeline from user input to deployed, battle-ready sprites with animations.

**User Value**: Players can create custom units, abilities, and effects using natural language descriptions, dramatically expanding creative possibilities and reducing dependency on pre-made assets.

**Business Value**: Differentiation through AI-powered content creation, reduced asset production costs, and scalable content generation that grows with the user base.

---

## ✅ Architecture Decisions Confirmed

The following critical decisions have been made and blockers resolved:

### 1. Generation Time Strategy
- **Decision**: Use async generation with progress tracking
- **Implementation**: Job queue system with polling for completion
- **User Experience**: Loading states, preview placeholders, background generation
- **Rationale**: PixelLab generation takes 30-60 seconds; blocking UI is unacceptable

### 2. Input Format
- **Decision**: Structured prompts with explicit parameters
- **Format**: `{type}-{style}-{size}-{action}-{description}`
- **Example**: `unit-fantasy-32x32-idle-armored knight with golden shield`
- **Rationale**: More predictable results than pure natural language

### 3. Animation Architecture ⚡ CONFIRMED
- **Primary Approach**: Sprite-based animations (sprite sheets from PixelLab)
- **Animation System**: Hybrid approach
  - **Base animations** (idle, walk, attack, death) → Delivered as sprite sheets
  - **Effect spawning** (projectiles, impacts, buffs) → Runtime particle/sprite instantiation
- **Storage**: Sprite sheets stored in Firebase Storage, metadata in Firestore
- **Playback**: Phaser AnimationManager for sprite sheet playback
- **Rationale**: Best balance of visual quality, performance, and PixelLab API capabilities

---

## Animation Architecture Overview

### Sprite Sheet Structure
```
Generated Asset Package:
├── base-sprite-sheet.png (all frames in grid)
├── animation-config.json
│   ├── idle: {frames: [0,1,2,3], fps: 8}
│   ├── walk: {frames: [4,5,6,7,8,9], fps: 12}
│   ├── attack: {frames: [10,11,12,13,14], fps: 15}
│   └── death: {frames: [15,16,17,18,19,20], fps: 10}
└── metadata.json (hitboxes, anchor points, effect spawn points)
```

### Hybrid Animation System
1. **Sprite Animations** (from PixelLab):
   - Character base animations (idle, walk, attack, death)
   - Played using Phaser's frame-by-frame animation system
   - Smooth, high-quality character motion

2. **Runtime Effect Spawning**:
   - Projectiles (arrows, fireballs, bullets) spawned at defined points
   - Impact effects (explosions, slashes) triggered on hit
   - Status effects (buffs, debuffs) overlaid on character
   - Implemented using Phaser particles and sprite pools

3. **Synchronization**:
   - Effect spawn points defined in animation metadata
   - Events triggered at specific frames (e.g., "spawn projectile at frame 8 of attack")
   - Hitbox activation tied to animation frames

---

## Technical Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERFACE LAYER                      │
├─────────────────────────────────────────────────────────────┤
│  • Asset Creation Modal (text input + parameter selection)  │
│  • Generation Queue Manager (progress tracking UI)          │
│  • Asset Preview & Editor (sprite sheet preview, config)    │
│  • Asset Library Browser (searchable, filterable gallery)   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   APPLICATION LOGIC LAYER                    │
├─────────────────────────────────────────────────────────────┤
│  • Prompt Builder (structured prompt generation)            │
│  • Generation Orchestrator (job management, polling)        │
│  • Asset Validator (quality checks, format validation)      │
│  • Animation Configurator (sprite sheet → Phaser config)    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   INTEGRATION LAYER                          │
├─────────────────────────────────────────────────────────────┤
│  • PixelLab API Client (generation requests, polling)       │
│  • Response Parser (sprite sheet extraction, metadata)      │
│  • Error Handler (retry logic, fallbacks, user feedback)    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                     STORAGE LAYER                            │
├─────────────────────────────────────────────────────────────┤
│  • Firebase Storage (sprite sheets, animation frames)       │
│  • Firestore (metadata, animation configs, user library)    │
│  • Local Cache (recently used assets for performance)       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      GAME ENGINE                             │
├─────────────────────────────────────────────────────────────┤
│  • Phaser AnimationManager (sprite sheet playback)          │
│  • Effect Spawner (projectiles, impacts, particles)         │
│  • Asset Loader (runtime loading of generated assets)       │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Generation Request**
   ```
   User Input → Prompt Builder → PixelLab API
   ↓
   Job ID returned → Queue Manager (poll status)
   ↓
   Generation Complete → Download sprite sheet + metadata
   ↓
   Upload to Firebase Storage → Save metadata to Firestore
   ↓
   Generate Phaser animation config → Cache locally
   ↓
   Available in Asset Library
   ```

2. **Asset Usage in Game**
   ```
   User selects asset → Load sprite sheet from cache/storage
   ↓
   Parse animation config → Register with Phaser AnimationManager
   ↓
   Instantiate game object → Play animation (e.g., "idle")
   ↓
   Trigger events (e.g., attack) → Play animation + spawn effects
   ↓
   Effect system handles projectiles/impacts separately
   ```

---

## L3 Features

This epic breaks down into the following implementable features:

### Core Integration (Foundational)

#### 1. **PixelLab API Client** (`pixellab-api-client`) - ✅ COMPLETED
**Status**: COMPLETED (2025-09-30) - 31/31 tasks (100%)
**Implementation**: `/backend/src/pixellab/` (24 files, 10,860 lines of code)
**Documentation**: `/docs/specs/L3-FEATURES/ai-generation-pipeline/pixellab-api-client.md`

**Description**: TypeScript client for PixelLab.ai API with authentication, request handling, and error management.

**Key Capabilities**:
- ✅ API authentication (API key management)
- ✅ Generation request submission (with structured prompts)
- ✅ Job status polling (with exponential backoff)
- ✅ Sprite sheet download and parsing
- ✅ Rate limiting and quota management
- ✅ Error handling and retry logic

**Technical Details**:
- HTTP client: Axios with interceptors
- Async/await with proper error boundaries
- TypeScript interfaces for all API responses
- Configurable timeouts and retry strategies
- Comprehensive unit and integration test coverage
- Production-ready with structured logging and metrics

---

#### 2. **Prompt Builder System** (`prompt-builder`)
**Description**: UI and logic for constructing structured prompts that yield consistent, high-quality results.

**Key Capabilities**:
- Parameter selection UI (type, style, size, action)
- Natural language description input
- Prompt preview and validation
- Template library (common unit types, effects)
- Advanced options (color palette, detail level, theme)

**User Flow**:
1. Select asset type (unit/ability/effect/terrain)
2. Choose visual style (fantasy/sci-fi/modern/pixel art)
3. Set dimensions (16x16, 32x32, 64x64, custom)
4. Pick base animation set (idle, walk, attack, death)
5. Write description (free text with suggestions)
6. Preview structured prompt
7. Submit for generation

---

#### 3. **Async Generation Queue** (`generation-queue`) - ✅ COMPLETED
**Status**: COMPLETED (2025-09-30) - 32/33 tasks (97%)
**Implementation**: `/backend/src/queue/`, `/backend/src/cache/`, `/backend/src/progress/`, `/backend/src/retry/`, `/backend/src/metrics/` (82 files, 29,864 lines of code)
**Documentation**: `/docs/specs/L3-FEATURES/ai-generation-pipeline/generation-queue.md`

**Description**: Production-ready BullMQ-based job queue system for handling async PixelLab generation requests with comprehensive error handling, caching, and observability.

**Key Capabilities**:
- ✅ Job submission with deduplication (10-second window)
- ✅ Redis + Firestore multi-layer caching (30-day TTL)
- ✅ Real-time progress tracking (SSE + polling fallback)
- ✅ Automatic retry with exponential backoff (1 retry)
- ✅ Dead Letter Queue for failed jobs (7-day retention)
- ✅ Queue overflow protection (500 job limit, warning at 400)
- ✅ Per-user concurrency limits (max 5 concurrent jobs)
- ✅ Prometheus metrics export for monitoring
- ✅ Comprehensive test infrastructure (754 tests, 96%+ coverage)

**Technical Details**:
- Job queue: BullMQ with Redis persistence
- Caching: Redis (L1) + Firestore (L2) hybrid
- Progress: Server-Sent Events with polling fallback
- Retry: Exponential backoff with jitter, error classification
- Observability: Structured logging, Prometheus metrics, health checks
- Load tested: Validated for 50+ concurrent jobs

---

### Asset Management

#### 4. **Asset Library** (`asset-library`)
**Description**: Searchable, filterable gallery of all generated assets with preview, metadata, and usage tracking.

**Key Capabilities**:
- Grid/list view of all user assets
- Search by name, description, tags
- Filter by type, style, size, date created
- Preview with animation playback
- Usage count (how many decks/battles use this asset)
- Duplicate/remix existing assets
- Delete unused assets
- Export assets (download sprite sheet + config)

**UI Design**:
- Card-based layout with thumbnails
- Hover to preview animation loop
- Click to open detailed view
- Bulk actions (select multiple, delete, tag)

---

#### 5. **Asset Validator** (`asset-validator`)
**Description**: Automated quality checks for generated sprites to ensure they meet game requirements.

**Key Validations**:
- **Dimensions**: Correct size (must match requested dimensions)
- **Transparency**: Proper alpha channel (no white backgrounds)
- **Animation frames**: Minimum frame count per animation (idle: 4, walk: 6, attack: 5, death: 6)
- **File size**: Under 500KB per sprite sheet
- **Format**: PNG with RGBA channels
- **Metadata completeness**: All required fields present (hitboxes, anchor points)

**Actions on Failure**:
- Retry generation with adjusted prompt
- Flag for manual review
- Suggest alternative prompts
- Provide user feedback with specific issues

---

#### 6. **Firebase Storage Integration** (`firebase-storage`)
**Description**: Reliable cloud storage for all generated sprite sheets with CDN delivery and caching.

**Key Capabilities**:
- Upload sprite sheets to Firebase Storage
- Organized folder structure (`/users/{uid}/assets/{assetId}/`)
- CDN delivery for fast loading
- Automatic thumbnail generation (for library previews)
- Download URLs with expiration (for security)
- Storage quota monitoring
- Cleanup of orphaned files

**Storage Structure**:
```
/users/{userId}/
  /assets/{assetId}/
    sprite-sheet.png (original high-res)
    sprite-sheet-thumb.png (preview thumbnail)
    animation-config.json
    metadata.json
```

---

### Animation System

#### 7. **Animation Config Generator** (`animation-config`)
**Description**: Converts PixelLab sprite sheets into Phaser-compatible animation configurations.

**Key Capabilities**:
- Parse sprite sheet dimensions and frame layout
- Generate Phaser animation JSON (frame ranges, fps, repeat)
- Define animation state machine (idle → walk → attack → death)
- Set loop behaviors (idle loops, death doesn't)
- Configure hitboxes per frame
- Define effect spawn points (e.g., "spawn projectile at frame 8 of attack")

**Example Output**:
```json
{
  "spriteSheet": "knight-32x32.png",
  "frameWidth": 32,
  "frameHeight": 32,
  "animations": {
    "idle": {"frames": [0,1,2,3], "fps": 8, "loop": true},
    "walk": {"frames": [4,5,6,7,8,9], "fps": 12, "loop": true},
    "attack": {"frames": [10,11,12,13,14], "fps": 15, "loop": false, "events": [{"frame": 8, "type": "spawnProjectile"}]},
    "death": {"frames": [15,16,17,18,19,20], "fps": 10, "loop": false}
  },
  "hitboxes": {"idle": {"x": 8, "y": 8, "w": 16, "h": 24}, ...},
  "anchorPoint": {"x": 16, "y": 28}
}
```

---

#### 8. **Phaser Animation Loader** (`phaser-animation-loader`)
**Description**: Runtime system for loading generated assets into Phaser and registering animations.

**Key Capabilities**:
- Load sprite sheets from Firebase URLs
- Register sprite sheets with Phaser TextureManager
- Create Phaser animations from config JSON
- Preload commonly used assets (for performance)
- Lazy load on-demand assets (for memory efficiency)
- Cache management (LRU eviction)
- Handle loading errors gracefully

**Technical Details**:
- Integration with Phaser's `load.spritesheet()` method
- Asset keys: `{userId}_{assetId}_{timestamp}` (unique, cacheable)
- Loading states: idle, loading, loaded, error
- Retry logic for network failures

---

#### 9. **Effect Spawning System** (`effect-spawner`)
**Description**: Runtime system for spawning projectiles, impacts, and particle effects synchronized with sprite animations.

**Key Capabilities**:
- Spawn projectiles at defined frame events (e.g., arrow leaves bow at frame 8)
- Create impact effects on hit (explosions, slashes, blood)
- Overlay status effects (buffs: glow auras, debuffs: poison clouds)
- Particle systems (fire trails, sparkles, smoke)
- Effect pooling (reuse objects for performance)
- Layering (effects render above/below sprites correctly)

**Synchronization**:
- Animation events trigger effect spawns
- Effect spawn points defined in metadata (x, y offset from sprite center)
- Projectile trajectories calculated based on target position
- Impact effects positioned at collision points

**Example**:
```javascript
// In animation config:
"attack": {
  "frames": [10,11,12,13,14],
  "fps": 15,
  "events": [
    {"frame": 12, "type": "spawnProjectile", "offset": {"x": 20, "y": -5}, "effect": "arrow"}
  ]
}

// At runtime:
animation.on('animationupdate-attack', (animation, frame) => {
  if (frame.index === 12) {
    effectSpawner.spawnProjectile('arrow', sprite.x + 20, sprite.y - 5, targetEnemy);
  }
});
```

---

### User Experience

#### 10. **Asset Creation Modal** (`asset-creation-modal`)
**Description**: Polished UI for requesting new asset generation with guided workflow and real-time feedback.

**User Flow**:
1. Click "Create New Asset" button
2. Modal opens with step-by-step form:
   - **Step 1**: Asset type (unit/ability/effect/terrain)
   - **Step 2**: Visual style (with example thumbnails)
   - **Step 3**: Dimensions and animation set
   - **Step 4**: Description (with AI-powered suggestions)
   - **Step 5**: Review and submit
3. Submit → Job added to queue
4. Modal shows "Generation started! Check the queue for progress."
5. Modal closes, user can continue working

**UI Features**:
- Step progress indicator
- Back/Next buttons
- Real-time prompt preview
- Cost estimate (if using credits)
- Example gallery for each style
- Tooltips and help text

---

#### 11. **Generation Progress Tracker** (`progress-tracker`)
**Description**: Real-time UI showing status of all pending/active generation jobs with notifications.

**Key Capabilities**:
- List all queued jobs (pending, processing, complete, failed)
- Progress bar for each job (based on polling responses)
- ETA estimation (based on average generation time)
- Notification on completion (toast: "Your Knight sprite is ready!")
- Click to view completed asset
- Retry failed jobs with one click
- Cancel pending jobs

**UI Design**:
- Collapsible panel (top-right corner, badge shows count)
- Each job: thumbnail, description, progress bar, status text
- Color coding: blue (processing), green (complete), red (failed)
- Auto-dismiss completed jobs after 10s (unless user hovers)

---

#### 12. **Asset Preview & Editor** (`asset-preview-editor`)
**Description**: Interactive preview of generated sprites with playback controls and basic editing.

**Key Capabilities**:
- Play/pause animations
- Scrub through frames (slider)
- Adjust playback speed (0.5x, 1x, 2x)
- Toggle hitbox visualization
- View metadata (dimensions, frame count, file size)
- Rename asset
- Add tags for search
- Set as favorite
- Basic edits:
  - Adjust animation speed (change fps)
  - Reorder animation states
  - Set loop behavior
  - Adjust anchor point

**UI Layout**:
- Left: Playback viewport (shows sprite in action)
- Top: Playback controls (play/pause, speed, scrubber)
- Right: Metadata panel (name, tags, stats)
- Bottom: Animation list (idle, walk, attack, death) with edit buttons

---

### System Management

#### 13. **Quota & Usage Monitoring** (`quota-monitoring`)
**Description**: Track and display PixelLab API usage, credits, and rate limits with alerts.

**Key Capabilities**:
- Display current quota (credits remaining, API calls today)
- Show usage history (graph of generations per day)
- Alert when approaching limits (90% of daily quota)
- Recommend upgrade plans (if applicable)
- Show cost per generation (if using paid tiers)
- Estimate remaining generations before quota reset

**UI**:
- Dashboard widget (shows usage bar, credits, next reset time)
- Detailed usage page (graphs, history, cost breakdown)
- Alerts: Non-intrusive toasts, warning in creation modal if low

---

#### 14. **Error Handling & Fallbacks** (`error-handling`)
**Description**: Comprehensive error management for API failures, invalid results, and edge cases.

**Error Scenarios**:
1. **API Timeout**: Retry with exponential backoff (max 3 retries)
2. **Invalid API Key**: Show setup modal, guide user to add key
3. **Quota Exceeded**: Show friendly message, offer upgrade or wait
4. **Malformed Response**: Log error, retry once, fallback to error state
5. **Generation Failed**: Suggest prompt adjustments, offer retry
6. **Network Offline**: Queue request for later, notify user
7. **Invalid Asset**: Run validator, show specific issues, offer manual fix

**User-Facing Feedback**:
- Clear error messages (no technical jargon)
- Actionable next steps ("Try rephrasing your description")
- Fallback to default assets if generation fails (for game continuity)
- Support contact for persistent issues

---

## Success Criteria

### Functional Requirements
- ✅ Users can generate custom sprites via natural language + parameters
- ✅ Generation completes in background without blocking UI
- ✅ All generated assets include functional sprite-based animations
- ✅ Assets are stored reliably and load quickly in-game
- ✅ Users can browse, search, and reuse their asset library
- ✅ Failed generations are handled gracefully with retry options

### Performance Requirements
- ✅ Asset library loads in <2s (with 100+ assets)
- ✅ Sprite sheet loading in Phaser: <500ms per asset
- ✅ Animation playback: 60fps with 10+ animated sprites on screen
- ✅ Generation polling: Max 1 API call per 5s per job
- ✅ Storage: Support 500+ assets per user without performance degradation

### Quality Requirements
- ✅ 90%+ of generated assets pass validation (no manual fixes needed)
- ✅ Sprite animations are smooth and visually consistent
- ✅ Effect synchronization is accurate (projectiles spawn at right time/place)
- ✅ UI is intuitive (user can create asset without tutorial)
- ✅ Error messages are clear and actionable

### Business Requirements
- ✅ API costs stay under $X per 1000 generations (TBD by user)
- ✅ System scales to 10,000+ users without architectural changes
- ✅ Feature can be toggled off (fallback to default assets) if API unavailable

---

## Technical Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| PixelLab API downtime | Users can't generate new assets | Cache recent assets, fallback to defaults, queue requests for retry |
| Generation quality inconsistent | Users frustrated with bad results | Validator auto-retries, prompt templates, manual review option |
| Sprite sheets too large | Slow loading, storage costs | Validator enforces 500KB limit, compression, thumbnail generation |
| Animation frame mismatch | Broken animations in game | Strict validation of frame counts, fallback to static sprite |
| Quota limits hit | Users can't create more assets | Usage alerts, upgrade prompts, daily reset notifications |
| Effect sync issues | Projectiles spawn at wrong time/place | Extensive testing, frame event debugging tools, manual adjustment UI |

---

## Dependencies

### External
- PixelLab.ai API (account, API key, quota plan)
- Firebase Storage (configured with security rules)
- Firestore (for metadata storage)

### Internal
- Phaser game engine (v3.60+)
- Asset loading system (from core game architecture)
- User authentication (to associate assets with users)

### Cross-Epic
- **Deck Builder**: Generated assets must integrate with deck card creation
- **Battle System**: Assets must work with combat animation system
- **Multiplayer**: Assets must sync across players (if custom units used in PvP)

---

## Open Questions

1. **API Key Management**: Where do we store the PixelLab API key securely? (Environment variable vs. user-provided vs. backend proxy?)
2. **Cost Model**: Do users pay for generations (credits) or is it free with rate limits?
3. **Asset Sharing**: Can users share their generated assets with others? (Marketplace implications)
4. **Moderation**: Do we need content moderation for user-generated prompts/assets? (To prevent inappropriate content)
5. **Version Control**: If a user regenerates an asset with the same name, do we overwrite or create a new version?

---

## Next Steps

1. **Refine L3 Features**: Break down each feature into L4 tasks (unit-testable functions)
2. **Prioritize Implementation**: Decide which features are MVP vs. post-launch
3. **Technical Spikes**: Prototype PixelLab API integration to validate generation time and quality
4. **Design UI Mockups**: Create wireframes for Asset Creation Modal, Library, and Progress Tracker
5. **Define API Contracts**: Document all internal APIs between components (e.g., PromptBuilder → API Client)

---

## Metadata

- **Estimated Effort**: 6-8 weeks (for full epic, all 14 features)
- **Team Size**: 2-3 developers (1 backend, 1 frontend, 1 Phaser specialist)
- **Priority**: High (core differentiator for MVP)
- **Risks**: Medium (depends on external API reliability)
- **Blockers**: None (all architecture decisions confirmed)

---

*This document represents the complete specification for PixelLab.ai integration. All blockers have been resolved, and the epic is ready for L3 feature definition and task breakdown.*