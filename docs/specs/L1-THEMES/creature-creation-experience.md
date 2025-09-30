# L1-THEME: Creature Creation Experience

## Purpose

The Creature Creation Experience theme encompasses the entire user-facing workflow for transforming player imagination into playable game assets. This is the primary touchpoint where players express creativity and begin their journey in Drawn of War. The theme owns the complete input-to-preview pipeline, ensuring that within 60 seconds of finishing their drawing, players see their creature fully animated and ready for battle.

This theme is essential because it delivers on the core vision promise: democratizing game creation. Players with zero artistic or technical skill must be able to create creatures they're proud of and excited to deploy in battle. The success of this theme directly determines whether players engage with the game at all.

## Scope

### Included

- **Multi-Modal Input Interface**
  - Canvas-based drawing tool with brush controls (size, color, undo/redo)
  - Text-to-creature prompt input with example suggestions
  - Image upload functionality (drag-and-drop, file picker)
  - Input validation and preprocessing before API submission

- **Creation Workflow UI**
  - Step-by-step guided creation process
  - Visual feedback during generation (progress indicators, estimated time)
  - Preview interface showing creature with animation playback
  - Iteration interface (regenerate, modify, accept)

- **Creature Preview & Interaction**
  - Real-time animation playback of assigned animations
  - Animation set display (showing all 20+ animations available)
  - Rotation/zoom controls for examining creature details
  - Stats display showing AI-assigned abilities and attributes

- **Creation Management**
  - Temporary storage of in-progress creatures
  - Recent creations gallery (session-based for MVP)
  - Quick access to restart or iterate on designs

- **Onboarding & Guidance**
  - First-time user tutorial (skip-able)
  - Example creatures gallery for inspiration
  - Tooltips and contextual help throughout creation process
  - Error handling and user-friendly failure messages

### Explicitly Excluded

- **Persistent Creature Library**: No save/load across sessions (post-MVP)
- **Social Sharing**: No direct share-to-social-media features (post-MVP)
- **Advanced Drawing Tools**: No layers, filters, or professional art tools
- **Custom Animation Creation**: Players cannot create or modify animations
- **Community Gallery**: No browsing other players' creations (post-MVP)
- **Creature Naming**: No custom naming or metadata editing (post-MVP)
- **Manual Stat Assignment**: Players cannot manually set creature abilities
- **Real-time Collaborative Creation**: Single-player creation only for MVP

## Key User Journeys

1. **First-Time Creator**: New player opens game → sees tutorial prompt → tries example "draw a dragon" → watches generation → sees animated dragon → feels delighted → proceeds to battle
2. **Quick Battle Entry**: Returning player → selects "text prompt" → types "robot ninja" → generation completes → previews animations → clicks "battle" → enters matchmaking
3. **Iterative Refinement**: Player draws creature → previews result → not satisfied with size → regenerates with modified drawing → compares versions → accepts better version
4. **Recovery from Failure**: Player uploads copyrighted character → system detects and rejects → shows friendly error → suggests modification → player adjusts and succeeds
5. **Inspiration-Driven Creation**: Hesitant player → browses example gallery → clicks "fire elemental" → sees full preview with animations → clicks "create similar" → modifies design → succeeds

## Technical Architecture

### Components

**Frontend (React/Next.js)**
- `CreationCanvas`: Drawing interface component with PencilKit/Canvas API
- `InputMethodSelector`: Toggle between draw/text/upload modes
- `GenerationStatus`: Progress tracking and visual feedback
- `CreaturePreview`: PixiJS-based animation playback component
- `AnimationViewer`: Grid view of all assigned animations
- `CreationGallery`: Session storage-based recent creatures display

**Backend Services**
- `InputProcessor`: Validates and preprocesses all input types
- `PixelLabOrchestrator`: Manages API calls to PixelLab.ai
- `GenerationQueue`: Handles rate limiting and retry logic
- `PreviewRenderer`: Packages creature data for frontend preview

**State Management**
- Creation workflow state (Redux/Zustand)
- WebSocket connection for generation progress updates
- Session storage for temporary creature persistence

### Key Technologies

- **Canvas API / HTML5 Canvas**: Drawing interface
- **PixiJS**: Animation preview rendering
- **React Hook Form**: Input validation and form management
- **Socket.io**: Real-time generation progress updates
- **Sharp/Jimp**: Server-side image preprocessing
- **Redis**: Generation queue management
- **PixelLab.ai API**: External creature generation service

### Data Model

**Primary Entities**
```typescript
interface CreationSession {
  sessionId: string;
  userId: string | null; // null for anonymous
  inputType: 'draw' | 'text' | 'upload';
  inputData: Blob | string; // raw input
  processedInput: ProcessedInput; // cleaned/validated
  status: 'drafting' | 'generating' | 'previewing' | 'complete';
  generationStartTime: Date;
  currentCreature?: GeneratedCreature;
  previousAttempts: GeneratedCreature[];
}

interface ProcessedInput {
  imageData: string; // base64 or URL
  normalizedDimensions: { width: number; height: number };
  colorPalette: string[];
  contentFlags: string[]; // moderation results
}

interface GeneratedCreature {
  creatureId: string;
  spriteUrl: string;
  skeletonData: SkeletonJSON; // from PixelLab
  assignedAnimations: AnimationSet;
  abilities: CreatureAbility[];
  stats: CreatureStats;
  metadata: CreatureMetadata;
}
```

**Key Relationships**
- One CreationSession → Many GeneratedCreature (iterations)
- One GeneratedCreature → One AnimationSet (assigned during generation)
- CreationSession exists only in session/Redis (no persistent DB for MVP)

## Dependencies

### Depends On

- **AI Generation Pipeline** (L1): Provides the actual creature generation, animation assignment, and ability mapping
- **Platform Infrastructure** (L1): Authentication (for future), session management, API gateway
- **Content Management & Storage** (L1): Stores generated creature assets and serves preview URLs
- **Trust & Safety** (L1): Content moderation for submitted drawings/images

### Depended On By

- **Battle Engine** (L1): Consumes completed creatures for battle deployment
- **Matchmaking & Session Management** (L1): Requires creatures to be "ready" before player can queue
- All other L1 themes rely on this as the entry point to the game

## Key Technical Challenges

1. **Sub-60-Second Generation Guarantee**: Coordinating with PixelLab.ai API latency, animation assignment processing, and preview rendering under strict time constraint. Requires optimistic UI patterns, parallel processing, and smart caching.

2. **Cross-Device Canvas Input**: Ensuring drawing experience works equally well with mouse, trackpad, touch screens, and stylus. Different input methods have different precision and performance characteristics.

3. **Graceful Degradation on AI Failures**: When PixelLab.ai rejects or fails generation (copyright, inappropriate content, API errors), maintaining user trust and offering actionable next steps without exposing technical details.

4. **Preview Performance**: Rendering 20+ animations smoothly in the browser preview without stuttering, especially on lower-end devices. Requires careful PixiJS optimization and selective loading.

5. **Real-time Progress Updates**: Keeping frontend synchronized with backend generation status when process involves multiple stages (preprocessing → PixelLab → animation assignment → preview packaging). WebSocket connection management and reconnection logic.

6. **Input Validation Without False Positives**: Detecting copyrighted/inappropriate content without rejecting legitimate creative input. Balancing safety with accessibility.

## Success Criteria

### MVP Definition of Done

- [ ] Drawing canvas supports basic tools (brush, eraser, undo, clear) on desktop and mobile browsers
- [ ] Text prompt input accepts 10-500 character descriptions and generates creatures
- [ ] Image upload accepts PNG/JPG up to 5MB and preprocesses correctly
- [ ] 95%+ of valid submissions produce playable creatures (per L0 metric)
- [ ] Generation completes in under 60 seconds from submission to preview (per L0 metric)
- [ ] Preview interface displays creature with at least 5 animations playable (idle, move, attack, special, death)
- [ ] WebSocket progress updates reach frontend within 500ms of backend status changes
- [ ] Content moderation flags inappropriate submissions before sending to PixelLab
- [ ] Failed generations show user-friendly error messages with retry/modify options
- [ ] Session persists up to 3 recent creatures for comparison/selection
- [ ] Tutorial guides first-time users through one complete creation flow
- [ ] Works on Chrome, Firefox, Safari (desktop + mobile) without crashes

### Exceptional Target (Post-MVP)

- [ ] Persistent creature library with save/naming/organizing features
- [ ] Advanced drawing tools (layers, symmetry mode, color palettes)
- [ ] Generation under 30 seconds average
- [ ] Real-time collaborative drawing (multiple players on one canvas)
- [ ] AI-powered drawing assistance (auto-complete, style suggestions)
- [ ] Community gallery with search, filters, and "remix this creature" feature
- [ ] Export creatures as shareable images/GIFs for social media
- [ ] Voice-to-creature using speech recognition and text prompt pipeline
- [ ] Augmented reality preview (view creature in physical space via phone camera)

## Open Questions

1. **Canvas Persistence**: Should incomplete drawings auto-save if user leaves the page, or require explicit "save draft" action?
2. **Regeneration Limits**: Do we rate-limit regeneration attempts to control API costs, or allow unlimited iterations?
3. **Preview Complexity**: Should preview show creatures in combat context (attacking dummy target) or isolated showcase (rotation stage)?
4. **Mobile Input Priority**: Is mobile touch drawing a must-have for MVP, or can we launch desktop-first?
5. **Inspiration Gallery Size**: How many example creatures needed to effectively onboard new players (10, 50, 100)?
6. **Undo Depth**: How many undo levels needed in drawing canvas (10, 50, unlimited with memory management)?
7. **Multi-Creature Creation**: Can players create multiple creatures in parallel sessions, or must complete one before starting next?

## L2 Epic Candidates

- **Epic: Drawing Canvas Interface** - Complete canvas-based drawing tool with full feature set
- **Epic: Multi-Modal Input System** - Integration of draw/text/upload pathways with unified preprocessing
- **Epic: Generation Orchestration & Progress Tracking** - End-to-end workflow from submission to preview
- **Epic: Creature Preview & Animation Viewer** - PixiJS-based preview interface with animation playback
- **Epic: Creation Session Management** - State handling, temporary storage, and iteration support
- **Epic: Onboarding & User Guidance** - Tutorial system and contextual help
- **Epic: Error Handling & Recovery** - Graceful failure modes and user-friendly messaging
- **Epic: Content Safety Pre-validation** - Client-side and server-side content moderation before API submission

---

**Version**: 1.0
**Status**: Ready for L2 Epic Development
**Dependencies Validated**: Yes (pending Platform Infrastructure and AI Generation Pipeline L1 completion)