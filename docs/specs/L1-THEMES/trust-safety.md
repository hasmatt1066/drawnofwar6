# L1-THEME: Trust & Safety

## Purpose

The Trust & Safety theme owns all content moderation, abuse prevention, and player protection systems for Drawn of War. This includes filtering inappropriate drawings and text prompts, preventing copyrighted character reproduction, detecting and handling offensive behavior, and ensuring the game remains a safe, welcoming space for all players. Given the user-generated content nature of the game, this theme is critical for legal compliance, community health, and platform viability.

This theme is essential because without robust content moderation, the platform becomes a liability. Inappropriate content can lead to app store rejections, legal issues, community toxicity, and brand damage. The AI-powered generation system amplifies these risks since the platform technically "hosts" and "distributes" player-generated content. This theme must work proactively (preventing bad content) and reactively (handling violations).

## Scope

### Included

- **Input Content Moderation**
  - Automated image analysis for inappropriate content (NSFW, violence, hate symbols)
  - Text prompt filtering for profanity, slurs, and harmful instructions
  - Copyright detection for known characters and trademarks
  - Uploaded image scanning before processing

- **Generated Content Validation**
  - Post-generation review of PixelLab output
  - Detection of inappropriate results from ambiguous inputs
  - Validation that generation meets community standards

- **Moderation Infrastructure**
  - Integration with third-party moderation APIs (AWS Rekognition, Google Vision, etc.)
  - Custom keyword/image blacklists
  - Confidence scoring and thresholds
  - Appeal/review queue (post-MVP, automated for MVP)

- **Prevention & Blocking**
  - Pre-submission warnings for potentially problematic content
  - Soft blocks with user-friendly explanations
  - Hard blocks for severe violations
  - Rate limiting for repeated violations

- **Violation Tracking**
  - Logging all moderation events
  - Pattern detection for repeat offenders (post-MVP with accounts)
  - Anonymized analytics on violation types

- **User Feedback**
  - Clear rejection messages explaining why content was blocked
  - Suggestions for how to modify input
  - Appeal process (post-MVP with accounts)

### Explicitly Excluded

- **Account Bans/Suspensions**: No persistent accounts for MVP, so no user-level enforcement (post-MVP)
- **Player Reporting System**: No in-game reporting of other players (post-MVP)
- **Chat Moderation**: No player-to-player communication for MVP (post-MVP)
- **Manual Moderation Team**: Automated only for MVP, no human reviewers (post-MVP)
- **Community Moderation Tools**: No moderator roles, dashboards, or tools (post-MVP)
- **Appeal Process**: No formal appeals for MVP (post-MVP)
- **Legal Compliance Tools**: No DMCA takedown workflow, age verification (post-MVP)
- **Reputation Systems**: No karma, trust scores, or behavior tracking (post-MVP)

## Key User Journeys

1. **Innocent Content Approved**: Player draws dragon → moderation API analyzes → no violations detected → proceeds to PixelLab generation → creature created successfully

2. **NSFW Content Blocked**: Player uploads inappropriate image → moderation API detects NSFW content with 95% confidence → submission rejected before PixelLab API call → user sees message: "Your image appears to contain inappropriate content. Please try a different drawing." → player modifies and succeeds

3. **Copyright Detection**: Player draws recognizable Pokemon → copyright detection flags similarity to Pikachu → submission blocked → message: "Your creature looks similar to copyrighted characters. Try creating something original!" → player creates unique design

4. **Profanity in Text Prompt**: Player types "sexy ninja assassin" → text filter flags "sexy" as potentially inappropriate → soft warning shown: "Consider rephrasing to keep content family-friendly" → player revises to "stealthy ninja" → proceeds successfully

5. **False Positive Appeal**: Player draws abstract art → moderation flags as inappropriate (false positive) → submission blocked → player frustrated but no appeal option for MVP → player tries different drawing → succeeds (imperfect but acceptable for MVP)

6. **Edge Case Handling**: Player's drawing triggers low-confidence flag (60% inappropriate) → system applies lenient threshold for MVP → allows generation → post-generation review shows acceptable result → no action needed

## Technical Architecture

### Components

**Moderation Services**
- `InputModerationService`: Orchestrates all moderation checks
- `ImageModerationAPI`: Integration with AWS Rekognition / Google Vision API
- `TextModerationService`: Profanity and keyword filtering
- `CopyrightDetector`: Perceptual hashing and ML-based similarity detection
- `ConfidenceEvaluator`: Determines if violations exceed thresholds

**Data & Logging**
- `ModerationLogger`: Records all moderation events
- `ViolationRepository`: Stores violation data for analytics
- `BlacklistManager`: Manages custom keyword/image blacklists

**API Layer**
- `ModerationAPI`: Pre-submission validation endpoints
- `ModerationWebhooks`: Handles async moderation results

**Background Processing**
- `PostGenerationReviewer`: Reviews PixelLab output for emergent violations
- `AnalyticsAggregator`: Computes moderation statistics

### Key Technologies

- **AWS Rekognition / Google Vision API**: Image content moderation
- **Perspective API (Google)**: Text toxicity detection
- **Custom ML Models**: Copyright/similarity detection (optional)
- **Regex + Keyword Lists**: Basic text filtering
- **PostgreSQL**: Violation logging and analytics
- **Redis**: Rate limiting for repeat submissions

### Data Model

**Primary Entities**
```typescript
interface ModerationRequest {
  requestId: string;
  sessionId: string;
  inputType: 'draw' | 'text' | 'upload';
  inputData: string; // URL or text
  submittedAt: Date;
  status: 'pending' | 'approved' | 'rejected';
  result?: ModerationResult;
}

interface ModerationResult {
  requestId: string;
  approved: boolean;
  confidence: number; // 0-1
  violations: Violation[];
  processingTime: number; // ms
  apiCalls: ModerationAPICall[];
}

interface Violation {
  violationType: 'nsfw' | 'violence' | 'hate_speech' | 'copyright' | 'profanity';
  confidence: number; // 0-1
  details: string; // specific detection details
  severity: 'low' | 'medium' | 'high';
  blocked: boolean; // whether this violation triggered rejection
}

interface ModerationAPICall {
  provider: 'aws_rekognition' | 'google_vision' | 'perspective' | 'custom';
  endpoint: string;
  requestData: Record<string, any>;
  responseData: Record<string, any>;
  latency: number; // ms
  cost: number; // dollars
}

interface ViolationLog {
  logId: string;
  requestId: string;
  sessionId: string;
  playerId?: string; // null for MVP (anonymous)
  violationType: string;
  confidence: number;
  blocked: boolean;
  userMessage: string; // message shown to user
  timestamp: Date;
}

interface ModerationConfig {
  thresholds: {
    nsfw: number; // confidence threshold for blocking (e.g., 0.85)
    violence: number;
    hate_speech: number;
    copyright: number;
    profanity: number;
  };
  enabledChecks: {
    imageModeration: boolean;
    textModeration: boolean;
    copyrightDetection: boolean;
    postGenerationReview: boolean;
  };
  rateLimit: {
    maxSubmissionsPerSession: number; // prevent spam
    timePeriodMinutes: number;
  };
}
```

**Key Relationships**
- One GenerationRequest → One ModerationRequest (required before generation)
- One ModerationRequest → Many Violation (multiple violation types possible)
- ModerationConfig is global singleton, updateable by admin

## Dependencies

### Depends On

- **Platform Infrastructure** (L1): API gateway, logging, monitoring
- **Creature Creation Experience** (L1): Provides input data for moderation

### Depended On By

- **AI Generation Pipeline** (L1): Waits for moderation approval before proceeding
- **Content Management & Storage** (L1): Uses moderation results for asset retention policies

## Key Technical Challenges

1. **Balancing False Positives vs False Negatives**: Too strict moderation rejects innocent content (frustrated users, poor reviews), too lenient allows inappropriate content (legal/PR risk). Requires careful threshold tuning and ongoing adjustment.

2. **Moderation Latency vs User Experience**: Third-party APIs (Rekognition, etc.) add 200-500ms per call. Combined with generation, risks exceeding 60-second target. Must use parallel processing and async patterns where possible.

3. **Copyright Detection Accuracy**: Detecting "similar to Pokemon" without triggering on every dragon drawing is technically challenging. Perceptual hashing has high false positives, deep learning models are expensive. May need manual review queue post-MVP.

4. **API Cost Management**: Moderation APIs charge per call. At scale, moderating every submission becomes expensive. Must implement smart caching (same drawing resubmitted), pre-filtering (obvious violations caught locally), and cost caps.

5. **Adversarial Inputs**: Users intentionally trying to bypass filters with obfuscated text, slight image modifications, or prompt engineering. Requires adversarial testing and continuous model updates.

6. **Cultural/Regional Sensitivity**: What's appropriate varies by culture. Global launch requires nuanced moderation. MVP may start US-only to simplify, but architecture must support regional configs.

7. **Post-Generation Emergent Content**: AI may generate inappropriate results from innocent inputs (e.g., "flesh golem" prompt produces NSFW result). Requires post-generation review without slowing down pipeline.

## Success Criteria

### MVP Definition of Done

- [ ] 100% of submissions pass through moderation before PixelLab API call
- [ ] Image moderation detects NSFW, violence, hate symbols with >90% accuracy
- [ ] Text moderation blocks obvious profanity and slurs with >95% accuracy
- [ ] Copyright detection identifies exact matches of top 100 characters (Pokemon, Marvel, etc.)
- [ ] Moderation adds <500ms to average generation time
- [ ] Blocked submissions show user-friendly, actionable error messages
- [ ] False positive rate <5% (at most 1 in 20 innocent submissions blocked)
- [ ] False negative rate <1% (inappropriate content gets through rarely)
- [ ] Moderation events logged to database for analytics
- [ ] Rate limiting prevents more than 20 submissions per session per hour
- [ ] Moderation API costs under $0.05 per generation
- [ ] No manual moderation required for MVP (fully automated)
- [ ] Thresholds configurable via environment variables without code changes
- [ ] Post-generation review flags <0.5% of generated creatures for removal

### Exceptional Target (Post-MVP)

- [ ] AI-powered copyright detection with 98% accuracy across 10,000+ characters
- [ ] Real-time chat moderation for player communication
- [ ] Player reporting system with automated triage
- [ ] Manual moderation queue for ambiguous cases
- [ ] User appeal process with 24-hour response time
- [ ] Reputation system flags repeat offenders for stricter moderation
- [ ] Regional moderation configs for cultural sensitivity
- [ ] Proactive pattern detection (users trying to bypass filters)
- [ ] Integration with app store moderation guidelines (iOS/Android compliance)
- [ ] Automated takedown workflow for DMCA requests

## Open Questions

1. **Moderation Threshold Philosophy**: Bias toward permissive (allow edge cases, risk violations) or restrictive (block ambiguous, risk frustration)?
2. **Post-Generation Review Timing**: Review before showing preview to user (adds latency) or after preview (allows viewing then deletion)?
3. **Copyright Scope**: Block only exact copies, or also "inspired by" and parodies?
4. **Rate Limiting Strictness**: 20 submissions/hour generous enough for legitimate use, or too loose for abuse prevention?
5. **Moderation API Provider**: AWS Rekognition (tight AWS integration) vs Google Vision (better accuracy) vs custom model (full control)?
6. **Cost vs Accuracy Trade-off**: Use cheaper, less accurate APIs for first pass, then expensive accurate APIs for flagged content?
7. **User Education**: Should UI include pre-submission tips on what's allowed, or let moderation guide them?
8. **Anonymous Reporting**: Allow players to report offensive creatures even without accounts?

## L2 Epic Candidates

- **Epic: Image Content Moderation** - AWS Rekognition integration, NSFW/violence detection
- **Epic: Text Content Filtering** - Profanity filtering, Perspective API integration, keyword blacklists
- **Epic: Copyright Detection System** - Perceptual hashing, ML similarity models, known character database
- **Epic: Moderation Orchestration & Thresholds** - Confidence evaluation, threshold tuning, approval logic
- **Epic: Violation Logging & Analytics** - Event tracking, statistics, pattern detection
- **Epic: User Feedback & Messaging** - Clear rejection messages, actionable guidance, warnings
- **Epic: Rate Limiting & Abuse Prevention** - Submission limits, spam detection, repeat offender tracking
- **Epic: Post-Generation Review** - Async review of generated content, removal workflow

---

**Version**: 1.0
**Status**: Ready for L2 Epic Development
**Dependencies Validated**: Yes (pending Platform Infrastructure L1 completion)