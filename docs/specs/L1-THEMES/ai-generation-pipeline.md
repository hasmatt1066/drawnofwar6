# L1-THEME: AI Generation Pipeline

## Purpose

The AI Generation Pipeline theme owns the complete backend process of transforming raw player input (drawings, text, images) into fully-rigged, animated, battle-ready creatures. This theme is the technical heart of Drawn of War's innovation—the bridge between creative expression and playable gameplay. It encompasses integration with PixelLab.ai for sprite generation, intelligent animation assignment from a pre-built library, AI-powered ability mapping, and all supporting infrastructure to make this process reliable, high-quality, and engaging during the 2-5 minute generation window.

This theme is essential because it fulfills the core technical promise: AI-powered democratization of game asset creation. Without this pipeline working flawlessly at scale, the entire game concept fails. The 2-5 minute generation timeframe and 95% success rate are non-negotiable requirements that this theme must achieve.

## Scope

### Included

- **PixelLab.ai Integration**
  - API client with authentication and request management
  - Payload formatting for draw/text/upload input types
  - Skeletal rigging verification and quality checks
  - Response parsing and error handling
  - Rate limiting and cost management

- **Animation Library & Assignment System**
  - Pre-built animation library (50+ animations covering movement, combat, abilities, death)
  - AI-powered creature analysis for animation selection
  - Rule-based fallback system when AI classification uncertain
  - Animation compatibility validation (verifying animation frames work with creature sprite)
  - Animation set packaging (minimum 5, target 20+ per creature)

- **Ability & Stats Mapping**
  - Visual analysis of generated creatures (size, features, apparent type)
  - Ability assignment based on creature characteristics
  - Stats calculation (HP, attack, speed) based on visual attributes
  - Balancing algorithms to prevent overpowered generations

- **Effect Asset Generation**
  - Using PixelLab.ai to generate projectiles, auras, impacts, ground effects
  - Effect-to-ability mapping based on creature type
  - Effect library management and caching
  - Style consistency matching between creatures and effects

- **Generation Queue & Orchestration**
  - Request queuing with priority management
  - Parallel processing where possible (creature + effects)
  - Progress tracking and status updates
  - Retry logic for transient failures
  - Generation result caching

- **Quality Assurance**
  - Sprite frame validation (all required frames present and uncorrupted)
  - Animation frame compatibility (assigned animation frames visually match creature sprite dimensions and style)
  - Visual quality checks (resolution, clarity, no corruption)
  - Fallback asset injection when generation partially fails

### Explicitly Excluded

- **Custom Animation Creation**: No player-created animations (post-MVP)
- **Real-time Generation During Battle**: All generation pre-battle only (post-MVP feature)
- **Animation Editing/Modification**: Generated animations used as-is, no post-processing
- **Creature Stat Manual Tuning**: No player control over abilities/stats (post-MVP)
- **Community Animation Library**: No crowdsourced animations (post-MVP)
- **Advanced Procedural Animation**: No runtime procedural animation generation beyond fallbacks
- **Multi-Creature Fusion**: No combining multiple creatures into one (post-MVP)
- **Animation Interpolation**: No generating new animations between existing ones

## Key User Journeys

These journeys happen with visible progress feedback while users experience the Creation Experience theme:

1. **Standard Generation**: Player submits drawing → Pipeline preprocesses image → Sends to PixelLab (60-90s) → Receives skeletal sprite → Analyzes creature visual (30s) → Assigns 20 animations (45s) → Maps 5 abilities (30s) → Calculates stats (15s) → Returns complete creature in 2-5 minutes with progress updates at each stage
2. **Text Prompt Pipeline**: Player submits "dragon knight" → Pipeline enriches prompt with style guidance → PixelLab generates creature → Extra validation for text-generated quality → Continues through animation/ability assignment
3. **Graceful Degradation**: Generation partially fails (missing bones) → Pipeline detects issue → Applies procedural fixes → Reduces animation set to compatible subset → Flags for manual review → Returns playable creature
4. **Effect Generation**: Creature assigned "fireball" ability → Pipeline checks effect cache → Cache miss → Generates fireball effect via PixelLab matching creature style → Caches result → Links to creature ability
5. **Batch Pre-generation**: Admin triggers library build → Pipeline generates core 50 effects → Runs style variations → Tests quality → Caches all → Updates animation library metadata

## Technical Architecture

### Components

**Backend Services (Node.js/Python)**
- `PixelLabClient`: API integration wrapper with retry/rate limiting
- `CreatureAnalyzer`: AI/ML model for creature classification and feature detection
- `AnimationAssigner`: Rule engine + ML model for intelligent animation selection
- `AbilityMapper`: Logic for assigning abilities based on creature characteristics
- `StatsCalculator`: Balancing algorithm for creature stats
- `EffectGenerator`: PixelLab.ai integration for combat effects
- `GenerationOrchestrator`: Coordinates entire pipeline flow
- `QualityValidator`: Automated checks for generation output
- `GenerationQueue`: Redis-based job queue with priority

**Data Processing**
- `InputPreprocessor`: Image normalization, cleanup, validation
- `SpriteFrameProcessor`: Parses and validates PixelLab sprite frame data
- `AnimationPackager`: Bundles animations with creature for frontend delivery
- `CacheManager`: Manages generation results and effect library

**ML/AI Components**
- `VisualClassifier`: CNN model for creature type detection (humanoid, beast, construct, etc.)
- `FeatureDetector`: Identifies key creature features (wings, weapons, size category)
- `StyleAnalyzer`: Extracts artistic style for effect matching

### Key Technologies

- **PixelLab.ai API**: Primary creature generation service
- **Python + FastAPI**: ML model hosting and image processing
- **TensorFlow/PyTorch**: Visual classification models
- **OpenCV**: Image preprocessing and analysis
- **Redis**: Job queue and caching layer
- **PostgreSQL**: Persistent storage for library data and generation history
- **S3/Cloud Storage**: Sprite and animation asset storage
- **BullMQ**: Advanced job queue with retry and priority
- **Sharp**: Server-side image manipulation

### Data Model

**Primary Entities**
```typescript
interface GenerationRequest {
  requestId: string;
  sessionId: string;
  inputType: 'draw' | 'text' | 'upload';
  inputData: ProcessedInput;
  priority: number; // higher = faster processing
  submittedAt: Date;
  status: 'queued' | 'processing' | 'complete' | 'failed';
}

interface GenerationPipeline {
  requestId: string;
  stages: {
    preprocessing: StageResult;
    pixelLabGeneration: StageResult;
    spriteFrameValidation: StageResult;
    creatureAnalysis: StageResult;
    animationAssignment: StageResult;
    abilityMapping: StageResult;
    effectGeneration: StageResult;
    qualityValidation: StageResult;
    packaging: StageResult;
  };
  totalDuration: number; // ms
  completedAt: Date;
}

interface CreatureGeneration {
  creatureId: string;
  generatedSprite: {
    url: string;
    frameData: SpriteFrameArray; // Pre-rendered animation frames
    dimensions: { width: number; height: number };
  };
  assignedAnimations: {
    animationId: string;
    name: string;
    category: 'movement' | 'combat' | 'ability' | 'death' | 'idle';
    duration: number;
    skeletonCompatible: boolean;
  }[];
  abilities: CreatureAbility[];
  stats: CreatureStats;
  effects: EffectAsset[];
  generationMetadata: {
    processingTime: number;
    qualityScore: number;
    aiConfidence: number;
    fallbacksApplied: string[];
  };
}

interface AnimationLibrary {
  animations: {
    animationId: string;
    name: string;
    category: string;
    compatibilityRequirements: {
      minFrameCount: number;
      spriteDimensions: { width: number; height: number };
      applicableCreatureTypes: string[]; // humanoid, beast, construct, etc.
    };
    fileUrl: string;
    thumbnailUrl: string;
    metadata: AnimationMetadata;
  }[];
  version: string;
  lastUpdated: Date;
}

interface EffectAsset {
  effectId: string;
  effectType: 'projectile' | 'aura' | 'impact' | 'ground' | 'weapon_fx';
  spriteUrl: string;
  animationData: AnimationJSON;
  linkedAbilities: string[];
  styleSignature: string; // for matching to creatures
  generatedAt: Date;
}
```

**Key Relationships**
- One GenerationRequest → One GenerationPipeline → One CreatureGeneration
- One CreatureGeneration → Many AnimationLibrary entries (via assignedAnimations)
- One CreatureAbility → Many EffectAsset (projectile, impact, etc.)
- AnimationLibrary and EffectAsset libraries are shared across all generations

## Dependencies

### Depends On

- **Platform Infrastructure** (L1): API gateway, authentication, logging, monitoring
- **Content Management & Storage** (L1): Asset storage (S3), CDN for sprite/animation delivery
- **Trust & Safety** (L1): Content moderation results before processing

### Depended On By

- **Creature Creation Experience** (L1): Consumes pipeline output for preview
- **Battle Engine** (L1): Uses generated creatures with animations/abilities in combat
- **Content Management & Storage** (L1): Stores pipeline outputs

## Key Technical Challenges

1. **2-5 Minute End-to-End Processing with Engaging Progress**: Coordinating multiple AI services (PixelLab + internal ML models), database lookups, and asset packaging while providing meaningful progress updates. Requires stage-based processing with visible milestones, predictive caching, and fallback paths that maintain user engagement.

2. **PixelLab.ai API Reliability & Rate Limits**: External dependency with unknown uptime SLA and per-minute rate limits. Must handle outages gracefully, implement exponential backoff, maintain request quotas, and provide queue position estimates to users.

3. **Animation Frame Compatibility**: Ensuring pre-built animation frame sequences visually match dynamically generated creature sprites from PixelLab. Frame dimensions, sprite style, and visual proportions must align for seamless animation playback.

4. **AI Confidence vs Rule-Based Fallbacks**: Balancing ML model predictions (which can be wrong) with rule-based systems (which lack nuance). Determining confidence thresholds and when to override AI decisions.

5. **Effect Style Consistency**: Generating effects via PixelLab that visually match diverse creature styles without manual art direction. Requires extracting creature "style signature" and translating to PixelLab prompts.

6. **Scalability Under Load**: Handling 100+ concurrent generation requests without API quota exhaustion or memory issues. Queue management, connection pooling, and cost forecasting.

7. **Quality Assurance at Scale**: Automatically detecting generation failures that produce technically valid but gameplay-broken creatures (e.g., invisible sprites, T-pose stuck animations, misaligned effects).

## Success Criteria

### MVP Definition of Done

- [ ] PixelLab.ai integration successfully generates skeletal sprites from all input types (draw/text/upload)
- [ ] 95%+ generation success rate (producing playable creatures) per L0 metric
- [ ] Average generation time 2-5 minutes per L0 metric with visible progress updates at each stage
- [ ] Animation library contains 50+ animations covering all categories (movement, combat, abilities, death)
- [ ] Every creature receives minimum 5 animations (idle, move, attack, special, death) per L0
- [ ] 100% of creatures receive appropriate animation assignments per L0 metric
- [ ] AI classification accuracy >85% for creature type detection
- [ ] Animation-to-skeleton compatibility validation prevents broken animations in battle
- [ ] Effect library contains 30+ core effects (projectiles, auras, impacts)
- [ ] Ability mapping assigns balanced abilities (no single creature dominates all matchups)
- [ ] Graceful degradation handles partial generation failures without user-facing errors
- [ ] Generation queue handles 50+ concurrent requests without failures
- [ ] All pipeline stages emit progress updates within 500ms for frontend consumption
- [ ] Asset caching reduces repeat generation costs by 70%+ for common creatures

### Exceptional Target (Post-MVP)

- [ ] Real-time generation during battle (<10 second total pipeline)
- [ ] Animation library grows to 150+ animations with community contributions
- [ ] AI confidence >95% accuracy for creature classification
- [ ] Procedural animation generation for edge cases (blob creatures, abstract forms)
- [ ] Effect generation matches creature style with 98% visual consistency
- [ ] Advanced ability synergies detected and assigned automatically
- [ ] Generation cost reduced by 80% through optimized caching and model efficiency
- [ ] Support for multi-creature fusion (combining 2+ creatures into hybrid)
- [ ] Player-guided ability assignment (optional manual tweaking post-generation)
- [ ] Average 15+ animations per creature actively used in battles per L0

## Open Questions

1. **Animation Library Initial Size**: Start with 50, 75, or 100 animations? Trade-off between variety and maintenance burden.
2. **ML Model Hosting**: Run classification models in-process, separate service, or use cloud AI APIs (GCP Vision, AWS Rekognition)?
3. **Effect Generation Timing**: Generate effects on-demand during creature generation, or pre-generate library and assign existing effects?
4. **Skeleton Standardization**: Should we define a "canonical skeleton" and map all PixelLab outputs to it, or support diverse skeleton structures?
5. **Animation Assignment Confidence**: What confidence threshold triggers fallback to rule-based assignment (50%, 70%, 85%)?
6. **Generation Result Persistence**: Store every generation permanently for analytics, or TTL cache only (7 days, 30 days)?
7. **Cost vs Quality Balance**: PixelLab likely has quality tiers—when do we use high-quality (expensive) vs standard?
8. **Failure Recovery Strategy**: When PixelLab fails, retry immediately, queue for later, or fail fast and prompt user to modify input?

## L2 Epic Candidates

- **Epic: PixelLab.ai Integration & Management** - API client, authentication, request handling, error management
- **Epic: Animation Library Foundation** - Initial 50+ animation set, metadata, skeleton requirements
- **Epic: Creature Analysis & Classification** - ML models for visual analysis and creature type detection
- **Epic: Intelligent Animation Assignment** - Rule engine + ML hybrid for matching animations to creatures
- **Epic: Ability & Stats Mapping System** - Logic for assigning balanced abilities based on creature characteristics
- **Epic: Effect Asset Generation Pipeline** - Using PixelLab for projectiles, auras, impacts with style matching
- **Epic: Generation Orchestration & Queue** - End-to-end pipeline coordination with Redis queue
- **Epic: Quality Assurance & Validation** - Automated testing of generation outputs, fallback mechanisms
- **Epic: Performance Optimization & Caching** - Cache strategies, parallel processing, cost reduction

---

**Version**: 1.2
**Last Updated**: 2025-09-29 (Updated skeletal terminology to reflect sprite-based animation architecture)
**Status**: Ready for L2 Epic Development
**Dependencies Validated**: Yes (pending Platform Infrastructure L1 completion)