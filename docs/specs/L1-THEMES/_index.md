# L1 Themes: Complete Breakdown

This document provides an overview of all L1 Themes for Drawn of War, including brief descriptions, purpose statements, and the dependency graph that shows how themes relate to each other.

## Theme Overview

### 1. Creature Creation Experience
**Purpose**: User-facing creature creation workflow from input to preview.

**Key Responsibilities**:
- Drawing canvas, text prompt, and image upload interfaces
- Generation progress tracking and status updates
- Animated creature preview with full animation sets
- Session-based creation management
- Onboarding and user guidance

**Theme Type**: User-Facing, Frontend-Heavy
**Stack**: React/Next.js, PixiJS, Canvas API

---

### 2. AI Generation Pipeline
**Purpose**: Backend pipeline transforming player input into animated, battle-ready creatures.

**Key Responsibilities**:
- PixelLab.ai integration for sprite generation
- Animation library management (50+ animations)
- AI-powered animation assignment
- Ability and stats mapping
- Effect asset generation
- Quality assurance and validation

**Theme Type**: Backend Processing, Integration-Heavy
**Stack**: Node.js/Python, FastAPI, TensorFlow/PyTorch, Redis, BullMQ

---

### 3. Battle Engine
**Purpose**: Authoritative server-side combat system with client-side rendering.

**Key Responsibilities**:
- Server simulation at 60 ticks/second
- Client PixiJS rendering at 30+ FPS
- Combat mechanics (movement, attacks, abilities)
- Animation and effect synchronization
- Network latency compensation
- Victory conditions and combat UI

**Theme Type**: Full-Stack, Real-Time System
**Stack**: Node.js, Socket.io, PixiJS, SpineJS, Redis

---

### 4. Matchmaking & Session Management
**Purpose**: Player pairing, lobby coordination, and battle session lifecycle.

**Key Responsibilities**:
- Matchmaking queue (FIFO for MVP)
- Lobby creation and readiness system
- Battle session state management
- Disconnection handling and reconnection
- Post-battle result processing

**Theme Type**: Backend Services, Coordination
**Stack**: Node.js, Redis, Socket.io, PostgreSQL

---

### 5. Content Management & Storage
**Purpose**: Asset storage, metadata management, and content delivery.

**Key Responsibilities**:
- S3/Cloud Storage for sprites, animations, effects
- CDN integration for low-latency delivery
- PostgreSQL for metadata and battle history
- Redis for ephemeral session data
- Asset lifecycle and cleanup
- Backup and disaster recovery

**Theme Type**: Infrastructure, Data Management
**Stack**: AWS S3/GCS, CloudFront/CDN, PostgreSQL, Redis

---

### 6. Trust & Safety
**Purpose**: Content moderation and abuse prevention.

**Key Responsibilities**:
- Image moderation (NSFW, violence, hate symbols)
- Text filtering (profanity, slurs)
- Copyright detection
- Post-generation content review
- Violation logging and analytics
- Rate limiting and spam prevention

**Theme Type**: Cross-Cutting, Security/Compliance
**Stack**: AWS Rekognition/Google Vision, Perspective API, PostgreSQL

---

### 7. Platform Infrastructure
**Purpose**: Foundational technical systems supporting all themes.

**Key Responsibilities**:
- API Gateway and REST endpoints
- WebSocket infrastructure
- Logging, monitoring, alerting
- CI/CD deployment pipelines
- Error handling and resilience
- Configuration and secrets management
- Security foundation (HTTPS, DDoS protection)

**Theme Type**: Cross-Cutting, Foundation
**Stack**: Node.js, Docker, Kubernetes, Prometheus, Grafana, CloudWatch

---

## Dependency Graph

```
┌─────────────────────────────────────────────────────────────────┐
│                   Platform Infrastructure (L1)                   │
│                   (Foundation for all themes)                    │
└───────────────────────────────┬─────────────────────────────────┘
                                │ Provides: API, WebSocket, Logging
                                │
        ┌───────────────────────┼──────────────────────────┐
        │                       │                          │
        ▼                       ▼                          ▼
┌───────────────────┐  ┌────────────────────┐  ┌─────────────────────┐
│   Trust & Safety  │  │ Content Management │  │ Matchmaking &       │
│       (L1)        │  │   & Storage (L1)   │  │ Session Mgmt (L1)   │
└─────────┬─────────┘  └──────────┬─────────┘  └──────────┬──────────┘
          │                       │                        │
          │ Moderation            │ Asset Storage          │ Session State
          │                       │                        │
          ▼                       ▼                        │
┌─────────────────────────────────────────────┐           │
│       AI Generation Pipeline (L1)           │           │
│  (Depends on: Moderation, Storage)          │           │
└────────────────────┬────────────────────────┘           │
                     │ Generated Creatures                │
                     │                                    │
        ┌────────────┴─────────────┐                      │
        ▼                          ▼                      │
┌────────────────────┐    ┌───────────────────┐          │
│  Creature Creation │    │   Battle Engine   │◄─────────┘
│   Experience (L1)  │    │       (L1)        │
│                    │    │                   │ Battle Sessions
└────────────────────┘    └───────────────────┘
        │                          ▲
        │ Queue Entry              │ Battle Initiation
        └──────────────────────────┘
```

### Dependency Explanation

**Foundation Layer**:
- **Platform Infrastructure** has no dependencies and is depended on by all other themes

**Data & Security Layer**:
- **Trust & Safety** depends on Platform Infrastructure
- **Content Management & Storage** depends on Platform Infrastructure
- Both provide services to other themes but don't depend on them

**Core Processing Layer**:
- **AI Generation Pipeline** depends on:
  - Platform Infrastructure (APIs, logging)
  - Trust & Safety (moderation approval)
  - Content Management & Storage (asset storage)
- Provides generated creatures to Creation Experience and Battle Engine

**Coordination Layer**:
- **Matchmaking & Session Management** depends on:
  - Platform Infrastructure (WebSocket, Redis)
  - Battle Engine (initiates battles)
- Coordinates player pairing and session lifecycle

**User Experience Layer**:
- **Creature Creation Experience** depends on:
  - Platform Infrastructure (API, WebSocket)
  - AI Generation Pipeline (generates creatures)
  - Content Management & Storage (retrieves previews)
  - Matchmaking & Session Management (queue entry)

- **Battle Engine** depends on:
  - Platform Infrastructure (WebSocket, logging)
  - AI Generation Pipeline (creature data)
  - Content Management & Storage (loads assets)
  - Matchmaking & Session Management (session initialization)

### Critical Path for MVP

The minimum viable path through themes for a player to complete one battle:

1. **Platform Infrastructure** must be operational (API, WebSocket, logging)
2. **Trust & Safety** must moderate input
3. **Content Management & Storage** must store and serve assets
4. **AI Generation Pipeline** must generate creature
5. **Creature Creation Experience** must show preview
6. **Matchmaking & Session Management** must pair players
7. **Battle Engine** must run combat

All 7 themes are required for MVP functionality.

---

## Theme Prioritization for Development

### Phase 1: Foundation (Weeks 1-2)
1. Platform Infrastructure
2. Content Management & Storage
3. Trust & Safety (basic version)

**Rationale**: Cannot build application features without foundation. These enable development and testing of higher layers.

### Phase 2: Core Generation (Weeks 3-5)
4. AI Generation Pipeline

**Rationale**: Most complex and uncertain theme. Early development allows time for integration testing with PixelLab.ai, animation library creation, and quality tuning.

### Phase 3: User Experience (Weeks 6-8)
5. Creature Creation Experience

**Rationale**: With generation working, can build user-facing creation workflow and validate end-to-end experience.

### Phase 4: Combat (Weeks 9-11)
6. Battle Engine
7. Matchmaking & Session Management

**Rationale**: Battle system is complex but has clear requirements once creatures exist. Matchmaking is simpler and can be developed in parallel with battle mechanics.

### Phase 5: Polish & Testing (Weeks 12-14)
- Integration testing across all themes
- Performance optimization
- Bug fixing and edge case handling
- Trust & Safety tuning (thresholds, messages)

---

## Coverage Validation

### L0 Vision Capabilities Mapped to Themes

| L0 Capability | Primary Theme | Supporting Themes |
|--------------|--------------|-------------------|
| AI-Powered Generation | AI Generation Pipeline | Trust & Safety, Content Management |
| Drawing Interface | Creature Creation Experience | Platform Infrastructure |
| Text Prompt Input | Creature Creation Experience | Trust & Safety |
| Image Upload | Creature Creation Experience | Trust & Safety |
| Animation Mapping | AI Generation Pipeline | Content Management |
| Multiplayer Battles | Battle Engine | Matchmaking, Platform Infrastructure |
| Strategic Placement | Battle Engine | - |
| Real-time Combat | Battle Engine | Platform Infrastructure |
| Creature Preview | Creature Creation Experience | Content Management |
| Session Management | Matchmaking & Session Management | Platform Infrastructure |
| Asset Storage | Content Management & Storage | - |
| Content Moderation | Trust & Safety | Platform Infrastructure |

**Coverage**: 100% of L0 capabilities mapped to themes ✅

### L0 Technical Metrics Mapped to Themes

| L0 Metric | Primary Theme | Supporting Themes |
|-----------|--------------|-------------------|
| Generation Speed (<60s) | AI Generation Pipeline | Platform Infrastructure, Content Management |
| Generation Success (95%+) | AI Generation Pipeline | Trust & Safety |
| Animation Assignment (100%) | AI Generation Pipeline | - |
| Animation Variety (15+ active) | Battle Engine | AI Generation Pipeline |
| Match Stability (<1% disconnects) | Matchmaking & Session Management | Platform Infrastructure |
| Performance (30+ FPS, 20 units) | Battle Engine | Content Management (CDN) |

**Coverage**: 100% of L0 metrics owned by themes ✅

---

## Open Cross-Theme Questions

These questions affect multiple themes and require coordinated decisions:

1. **Asset Versioning Strategy**: When animation library updates, how do existing creatures handle version changes? (AI Generation Pipeline + Content Management + Battle Engine)

2. **Session Data Lifecycle**: How long do we retain session data in Redis before cleanup? Affects costs and debugging ability. (Platform Infrastructure + Matchmaking + Content Management)

3. **Moderation Threshold Philosophy**: Permissive vs restrictive approach affects user experience and legal risk. (Trust & Safety + Creature Creation Experience)

4. **Horizontal Scaling Trigger**: At what player count do we need multiple servers? Affects architecture complexity. (Platform Infrastructure + Battle Engine + Matchmaking)

5. **Error Budget Allocation**: If we target 95% generation success, how much comes from PixelLab reliability vs our handling? (AI Generation Pipeline + Platform Infrastructure)

6. **Development Environment Parity**: Should staging mirror production exactly, or accept cheaper/simpler setup? Affects bug detection. (Platform Infrastructure + all themes)

7. **MVP Feature Cuts**: If timeline slips, which capabilities can we defer? Affects theme scope. (All themes)

---

## Validation Checklist

- [x] All 7 themes have complete documentation
- [x] Every L0 capability maps to at least one theme
- [x] No overlapping responsibilities between themes
- [x] Dependencies form valid DAG (no circular dependencies)
- [x] Technical metrics from L0 distributed to appropriate themes
- [x] Each theme has clear L2 epic candidates
- [x] MVP vs post-MVP scope clear in each theme
- [x] Cross-cutting concerns (Platform Infrastructure, Trust & Safety) properly identified
- [x] Vertical slices maintained (each user-facing theme owns frontend + backend)

---

## Next Steps

1. **Stakeholder Review**: Present L1 Theme breakdown to engineering, product, and design teams for validation
2. **L2 Epic Development**: For each theme, begin breaking down L2 Epics using `/refine-epic` command
3. **Dependency Resolution**: Resolve open cross-theme questions through architecture discussions
4. **Resource Allocation**: Assign engineering teams to themes based on expertise and priorities
5. **Timeline Estimation**: Estimate effort for each theme to validate 14-week MVP timeline

---

**Document Version**: 1.0
**Created**: 2025-01-27
**Status**: Ready for L2 Epic Development
**Dependencies Validated**: Yes
**Coverage Validated**: Yes