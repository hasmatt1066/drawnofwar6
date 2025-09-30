# L1-THEME: Content Management & Storage

## Purpose

The Content Management & Storage theme owns all persistent data storage, asset management, and content delivery infrastructure for Drawn of War. This includes creature assets (sprites, skeletons, animations), effect library assets, animation library metadata, player data (for post-MVP), and battle analytics. This theme ensures that all generated content is reliably stored, efficiently retrieved, and delivered to clients with high performance via CDN.

This theme is essential because it underpins every other system in the game. Without reliable storage, generated creatures disappear, battles cannot load assets, and the animation library becomes inaccessible. The theme must handle rapid asset creation from the AI Generation Pipeline, serve assets with low latency during battles, and scale storage as the player base grows.

## Scope

### Included

- **Asset Storage**
  - Creature sprite images (64x64 PNG from PixelLab.ai)
  - Skeletal rigging data (JSON format)
  - Animation library files (Spine animations, sprite sheets)
  - Effect assets (projectiles, auras, impacts, ground effects)
  - Thumbnails for creature previews
  - Raw input images from players (for potential reprocessing)

- **Metadata Management**
  - Creature metadata (abilities, stats, generation info)
  - Animation library catalog (name, category, skeleton requirements)
  - Effect library catalog (type, style signature, linked abilities)
  - Generation request history and results
  - Asset versioning and cache invalidation

- **CDN Integration**
  - Asset distribution via CDN for low-latency global access
  - Cache headers and invalidation strategies
  - Compression and optimization for bandwidth efficiency

- **Database Management**
  - PostgreSQL for structured data (metadata, battle results, analytics)
  - Redis for ephemeral data (sessions, queues, temporary state)
  - Database migrations and schema versioning
  - Backup and disaster recovery

- **Battle History & Analytics**
  - Battle result archival (winner, duration, statistics)
  - Player statistics aggregation (post-MVP when accounts exist)
  - Generation success/failure tracking
  - Performance metrics and logs

- **Asset Lifecycle**
  - Asset upload and validation
  - Asset processing and optimization (compression, format conversion)
  - Temporary asset storage (session-based for MVP)
  - Asset deletion and cleanup policies
  - Orphan asset detection and removal

### Explicitly Excluded

- **User Accounts & Authentication**: Handled by Platform Infrastructure (L1)
- **Persistent Creature Library**: No saved creature collections for MVP (post-MVP)
- **Community Features**: No creature sharing, ratings, or marketplace (post-MVP)
- **Advanced Analytics Dashboard**: Basic metrics only for MVP, no BI tools (post-MVP)
- **Real-time Analytics**: Metrics processed batch/async, not live streaming (post-MVP)
- **Multi-Region Replication**: Single-region storage for MVP (post-MVP)
- **Video Replay Storage**: No battle replay videos (post-MVP)
- **User-Generated Content Moderation Tools**: Automated only, no admin panel (post-MVP)

## Key User Journeys

These journeys happen transparently behind the scenes:

1. **Creature Generation Storage**: AI Pipeline generates creature → sprite uploaded to S3 → skeleton JSON stored in S3 → metadata written to PostgreSQL → CDN URL returned → frontend fetches from CDN for preview

2. **Animation Library Access**: Battle Engine needs animations for creature → queries animation library metadata in PostgreSQL → retrieves animation files from S3 via CDN → caches locally for battle duration

3. **Effect Asset Retrieval**: Battle starts → client needs fireball projectile for creature ability → checks browser cache → cache miss → fetches from CDN → caches for session → reuses across all battles

4. **Battle Result Archival**: Battle finishes → Battle Engine sends results to API → results stored in PostgreSQL → statistics aggregated asynchronously → cleanup job removes session data from Redis after 1 hour

5. **Asset Cleanup**: Nightly cleanup job runs → identifies creatures from abandoned sessions (>24 hours old, no battle completed) → marks for deletion → deletes from S3 after 7-day grace period → frees storage space

## Technical Architecture

### Components

**Storage Services**
- `AssetStorageService`: Wrapper for S3/Cloud Storage operations
- `MetadataRepository`: PostgreSQL access layer for structured data
- `CacheManager`: Redis wrapper for ephemeral data
- `CDNManager`: Manages CDN invalidation and URL generation

**Asset Processing**
- `ImageProcessor`: Compression, format conversion, thumbnail generation
- `AnimationPackager`: Bundles animations with metadata
- `AssetValidator`: Verifies asset integrity and format correctness

**Data Access Layer**
- `CreatureRepository`: CRUD operations for creature metadata
- `AnimationLibraryRepository`: Animation catalog queries
- `EffectLibraryRepository`: Effect catalog queries
- `BattleHistoryRepository`: Battle result queries and analytics
- `GenerationLogRepository`: Tracks generation requests and outcomes

**Background Jobs**
- `AssetCleanupWorker`: Removes orphaned and expired assets
- `AnalyticsAggregator`: Computes daily/weekly statistics
- `BackupScheduler`: Database and asset backups

**API Layer**
- `AssetAPI`: Upload and download endpoints
- `LibraryAPI`: Query animation/effect libraries
- `AnalyticsAPI`: Retrieve statistics (post-MVP)

### Key Technologies

- **AWS S3 / Google Cloud Storage**: Primary asset storage
- **CloudFront / Cloud CDN**: Global asset delivery
- **PostgreSQL 14+**: Relational database for structured data
- **Redis 7+**: In-memory cache and session store
- **Sharp**: Server-side image processing
- **BullMQ**: Background job queue
- **Prisma / TypeORM**: Database ORM
- **imgix / Cloudinary (optional)**: On-the-fly image transformations

### Data Model

**Primary Entities**
```typescript
interface CreatureAsset {
  creatureId: string;
  spriteUrl: string; // CDN URL
  spriteStoragePath: string; // S3 path
  skeletonUrl: string;
  skeletonStoragePath: string;
  thumbnailUrl: string;
  rawInputUrl?: string; // original player input
  uploadedAt: Date;
  sizeBytes: number;
  format: 'png';
  metadata: CreatureMetadata;
}

interface CreatureMetadata {
  creatureId: string;
  sessionId: string;
  generationRequestId: string;
  inputType: 'draw' | 'text' | 'upload';
  assignedAnimations: string[]; // animationIds
  abilities: CreatureAbility[];
  stats: CreatureStats;
  generationDuration: number; // ms
  generatedAt: Date;
  usedInBattles: number;
  status: 'active' | 'archived' | 'deleted';
}

interface AnimationLibraryEntry {
  animationId: string;
  name: string;
  category: 'movement' | 'combat' | 'ability' | 'death' | 'idle';
  skeletonRequirements: string[]; // required bone names
  applicableCreatureTypes: string[];
  fileUrl: string; // CDN URL
  fileStoragePath: string; // S3 path
  thumbnailUrl: string;
  durationMs: number;
  fileSize: number;
  version: string;
  createdAt: Date;
  metadata: AnimationMetadata;
}

interface EffectAssetEntry {
  effectId: string;
  effectType: 'projectile' | 'aura' | 'impact' | 'ground' | 'weapon_fx';
  name: string;
  spriteUrl: string;
  spriteStoragePath: string;
  animationDataUrl?: string; // if animated
  thumbnailUrl: string;
  styleSignature: string; // for matching to creatures
  linkedAbilityTypes: string[];
  fileSize: number;
  generatedAt: Date;
  version: string;
}

interface BattleRecord {
  battleId: string;
  sessionId: string;
  players: [PlayerId, PlayerId];
  creatures: [CreatureId, CreatureId];
  winner: PlayerId;
  startedAt: Date;
  finishedAt: Date;
  duration: number; // seconds
  statistics: BattleStatistics;
  disconnectionEvents: DisconnectionEvent[];
}

interface GenerationLog {
  generationRequestId: string;
  sessionId: string;
  inputType: 'draw' | 'text' | 'upload';
  inputSize: number; // bytes
  status: 'success' | 'failed' | 'rejected';
  failureReason?: string;
  processingTime: number; // ms
  pixelLabCost?: number; // dollars
  creatureId?: string;
  timestamp: Date;
}

interface AnalyticsSnapshot {
  snapshotId: string;
  date: Date;
  totalGenerations: number;
  successfulGenerations: number;
  totalBattles: number;
  averageGenerationTime: number;
  averageBattleDuration: number;
  totalAssetsStored: number;
  totalStorageUsed: number; // bytes
  cdnBandwidth: number; // bytes
}
```

**Key Relationships**
- One CreatureAsset → Many AnimationLibraryEntry (via assignedAnimations)
- One CreatureAbility → Many EffectAssetEntry (via linkedAbilityTypes)
- One BattleRecord → Two CreatureAsset
- Many GenerationLog → One CreatureAsset (if successful)

## Dependencies

### Depends On

- **Platform Infrastructure** (L1): Core infrastructure, logging, monitoring
- **Trust & Safety** (L1): Content moderation flags inform storage/deletion decisions

### Depended On By

- **AI Generation Pipeline** (L1): Stores generated assets
- **Creature Creation Experience** (L1): Retrieves creature previews
- **Battle Engine** (L1): Loads creature and effect assets during battles
- **Matchmaking & Session Management** (L1): Archives battle results

## Key Technical Challenges

1. **Low-Latency Asset Delivery**: Battle Engine requires sub-100ms asset loading to maintain performance target. Requires aggressive CDN caching, pre-warming popular assets, and geographic distribution.

2. **Storage Cost Management**: With AI generating thousands of creatures, storage costs scale rapidly. Must implement aggressive cleanup policies, compress assets, and dedup similar creatures without impacting user experience.

3. **Asset Consistency During Updates**: When animation library updates (new animations added), existing creatures must remain compatible. Requires versioning strategy and migration plans.

4. **CDN Cache Invalidation**: When assets regenerated or updated, stale CDN caches cause battles to load wrong assets. Requires cache-busting strategies (versioned URLs) or instant invalidation.

5. **Horizontal Database Scaling**: As battle history grows, PostgreSQL queries slow down. Must implement partitioning, archival strategies, and read replicas without over-engineering for MVP scale.

6. **Orphan Asset Prevention**: Creatures generated but never used in battles accumulate. Need efficient cleanup without accidentally deleting assets from active sessions.

7. **Backup & Disaster Recovery**: Asset loss means players' creations disappear. Requires automated backups, versioning, and tested recovery procedures without breaking budget.

## Success Criteria

### MVP Definition of Done

- [ ] All generated creature sprites stored in S3 with <2 second upload time
- [ ] Creature metadata persisted in PostgreSQL with <100ms write latency
- [ ] Assets served via CDN with <100ms average latency globally
- [ ] Animation library catalog queryable with <50ms response time
- [ ] Effect library catalog queryable with <50ms response time
- [ ] Battle results recorded within 2 seconds of battle end
- [ ] Generation logs capture 100% of requests with success/failure status
- [ ] Asset cleanup job runs nightly and removes orphaned assets >24 hours old
- [ ] Database backups automated daily with 7-day retention
- [ ] S3 backups with cross-region replication for disaster recovery
- [ ] CDN cache hit rate >90% for creature and effect assets
- [ ] No asset loading failures during battles (<0.1% error rate)
- [ ] Storage costs under $50/month at MVP scale (1000 creatures)
- [ ] Database handles 1000 concurrent queries without degradation
- [ ] Redis session data expires automatically after 1 hour of inactivity

### Exceptional Target (Post-MVP)

- [ ] Multi-region storage replication for <50ms latency worldwide
- [ ] Advanced asset deduplication reduces storage costs by 60%
- [ ] Persistent creature library with tagging, search, and filtering
- [ ] Real-time analytics dashboard for generation and battle metrics
- [ ] User-facing asset management UI (rename, delete, organize creatures)
- [ ] Video replay storage and playback
- [ ] Community creature marketplace with ratings and downloads
- [ ] On-the-fly image transformations (resize, filters) via CDN
- [ ] Automated performance optimization (convert to WebP, AVIF)
- [ ] Battle replay timeline scrubbing with frame-accurate state reconstruction

## Open Questions

1. **Asset Retention Policy**: How long to keep creatures from abandoned sessions (24 hours, 7 days, forever)?
2. **Storage Tier Strategy**: Use hot storage (S3 Standard) for all assets, or move old assets to cold storage (Glacier)?
3. **CDN Provider**: AWS CloudFront, Cloudflare, Fastly, or multi-CDN for redundancy?
4. **Database Scaling Strategy**: When to add read replicas, partition tables, or migrate to distributed DB?
5. **Asset Versioning**: Should updates to animation library create new versions of creatures, or retroactively update existing?
6. **Backup Frequency**: Daily backups sufficient, or need hourly for critical data?
7. **Analytics Granularity**: Store every battle event for deep analysis, or aggregate summaries only?
8. **Thumbnail Generation**: Generate thumbnails server-side or client-side with lazy upload?

## L2 Epic Candidates

- **Epic: Asset Storage & Upload Pipeline** - S3 integration, upload handling, validation
- **Epic: CDN Integration & Delivery** - CloudFront setup, cache strategies, performance optimization
- **Epic: Database Schema & Repositories** - PostgreSQL schema, ORM setup, query optimization
- **Epic: Animation & Effect Library Management** - Catalog systems, versioning, metadata
- **Epic: Battle History & Analytics** - Result archival, statistics computation, querying
- **Epic: Asset Lifecycle & Cleanup** - Orphan detection, deletion policies, background jobs
- **Epic: Backup & Disaster Recovery** - Automated backups, restore procedures, redundancy
- **Epic: Performance Optimization** - Caching, compression, query tuning, monitoring

---

**Version**: 1.0
**Status**: Ready for L2 Epic Development
**Dependencies Validated**: Yes (pending Platform Infrastructure L1 completion)