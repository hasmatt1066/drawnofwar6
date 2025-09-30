# Design Decisions - Resolved

**Date**: 2025-09-30
**Status**: APPROVED
**Reviewed By**: technical-advisor agent

This document records the resolved design decisions from the API testing plan that did not require empirical API testing.

---

## Decision Summary

| Question | Recommendation | Key Reasoning |
|----------|---------------|---------------|
| 1 - API Key Storage | A - Backend env var | Simplest, secure, cost control |
| 7 - Cache Eviction | A - LRU | Redis native, matches usage patterns |
| 8 - DLQ Retry Auth | C - Owner + Admin | User empowerment + admin oversight |
| 9 - Queue Overflow | A - Warn but allow | Simple, soft degradation |
| 10 - Cache Warm-Up | A - No warm-up | YAGNI, organic fill sufficient for MVP |
| 12 - Job Timeout | B - Dynamic by size | Strong predictor, simple implementation |
| 13 - Firestore Sync | A - Write-through | Data integrity, acceptable latency |

---

## Question 1: API Key Storage Location

**Decision**: Option A - Backend environment variable (shared across all users)

**Rationale**:
1. **Simplest MVP implementation** - Single configuration point, no user key management, no encryption infrastructure needed
2. **Cost control** - All usage goes through one account, making it easy to monitor and cap total API spending
3. **Security baseline** - API key never exposed to client, can't be extracted from browser/app, and easier to rotate if compromised

**MVP Implementation**:
- Store PixelLab API key in backend `.env` file
- Backend makes all API calls on behalf of users
- Add basic rate limiting per user (e.g., 10 creatures/day) to prevent abuse
- Log all API usage for cost tracking

**Future Enhancement Path**:
- Phase 2: Allow power users to bring their own API keys (Option B) for unlimited usage
- Phase 3: If scaling beyond hobby project, migrate to Option C with per-user billing

**Risks**:
- Shared key means one compromised backend = all usage at risk (mitigated by backend-only storage)
- Cost explosion if rate limiting fails (mitigated by monitoring and hard caps)
- Can't offer differentiated pricing tiers without major refactor

---

## Question 7: Cache Eviction Strategy

**Decision**: Option A - LRU (Least Recently Used)

**Rationale**:
1. **Standard proven approach** - LRU is Redis's native eviction policy (allkeys-lru), requires zero custom code
2. **Matches user behavior** - Recent creatures are likely to be re-used in battles, aligns with temporal locality
3. **Simple and predictable** - Easy to reason about, no complex priority systems to maintain

**MVP Implementation**:
- Configure Redis with `maxmemory-policy allkeys-lru`
- Set `maxmemory` to desired cache size (e.g., 2GB)
- Redis handles eviction automatically when memory limit reached

**Future Enhancement Path**:
- Monitor cache hit rates and eviction patterns
- If specific high-value entries need protection, migrate to LFU (Option B) or hybrid approach
- Add cache warming for popular base creatures

**Risks**:
- Popular but infrequently accessed entries (e.g., legendary creatures) might get evicted
- Mitigated by 30-day TTL being long enough for most use cases

---

## Question 8: DLQ Manual Retry Authorization

**Decision**: Option C - Both admins and original owner

**Rationale**:
1. **User empowerment** - Users can retry their own failed jobs without admin intervention (better UX)
2. **Admin oversight** - Admins can retry any job for support/debugging purposes
3. **No wasted effort** - Failed generations might be due to temporary API issues; user knows if they still want the result

**MVP Implementation**:
- Store `userId` with each job in DLQ
- Retry endpoint checks: `req.user.id === job.userId || req.user.isAdmin`
- Simple authorization, no complex permission system needed

**Future Enhancement Path**:
- Add retry limits (max 3 retries per job) to prevent infinite loops
- Add cooldown period between retries (e.g., 5 minutes)
- Implement automatic retry for transient errors (Option D) for common failure modes

**Risks**:
- Users might spam retries on permanently broken prompts
- Mitigated by showing technical error messages so users can understand if retry makes sense
- Consider adding retry counter to UI

---

## Question 9: Queue Overflow Warning Threshold

**Decision**: Option A - Show warning but allow submission (current spec)

**Rationale**:
1. **MVP simplicity** - No complex confirmation UI or blocking logic needed
2. **Soft degradation** - Users informed but not blocked until true limit (500) reached
3. **400 is arbitrary** - Real bottleneck is API rate limits and processing capacity, not queue length

**MVP Implementation**:
- Return `queueStatus: { length: number, warning: boolean }` with submit response
- Show toast/banner: "Queue is experiencing high load (400+ jobs). Your job may take longer."
- Hard block only at 500 with clear error message

**Future Enhancement Path**:
- Monitor actual queue processing rates and adjust thresholds dynamically (Option D)
- Add estimated wait time based on current queue velocity
- Implement priority queues if power users need faster processing

**Risks**:
- Users might submit during congestion and forget about job
- Mitigated by email notifications when job completes
- 500 hard limit prevents true overflow

---

## Question 10: Cache Warm-Up Strategy

**Decision**: Option A - No warm-up (cold start, cache fills organically)

**Rationale**:
1. **YAGNI principle** - Don't build cache warming until cold start is proven to be a problem
2. **Uncertain usage patterns** - MVP doesn't know which creatures will be popular yet
3. **Fast organic warm-up** - With 1-3 concurrent users (MVP scale), cache fills naturally within hours

**MVP Implementation**:
- Deploy Redis with empty cache
- Monitor cache hit rate metrics
- Accept initial cold start period (first few hours)

**Future Enhancement Path**:
- After 1-2 weeks, analyze most-accessed creatures
- Implement Option B (warm from Firestore top 100) if hit rate is problematic
- Add admin tool to manually warm specific entries for events/promotions

**Risks**:
- Poor initial user experience if same creatures requested repeatedly
- Mitigated by: (1) small user base in MVP, (2) first user to generate pays the cost, others benefit
- Firestore is fast enough (~100-200ms) that cold reads aren't catastrophic

---

## Question 12: Dynamic Timeout for Complex Prompts

**Decision**: Option B - Dynamic timeout based on image size

**Rationale**:
1. **Image size is strong predictor** - 128x128 images objectively take ~3x longer than 32x32 (more pixels to generate)
2. **Simple to implement** - Size is known upfront, no prompt analysis ML needed
3. **Prevents false timeouts** - Large images won't be killed prematurely while still catching truly stuck small jobs

**MVP Implementation**:
```javascript
const TIMEOUT_MAP = {
  16: 5 * 60 * 1000,   // 5 minutes
  32: 8 * 60 * 1000,   // 8 minutes
  48: 10 * 60 * 1000,  // 10 minutes
  64: 12 * 60 * 1000,  // 12 minutes
  128: 15 * 60 * 1000  // 15 minutes
};
const timeout = TIMEOUT_MAP[imageSize] || 10 * 60 * 1000;
```

**Future Enhancement Path**:
- Add prompt complexity analysis (Option C) if size alone proves insufficient
- Use historical data to refine timeout values per size
- Allow premium users to extend timeouts (Option D)

**Risks**:
- Might be too generous and let truly stuck jobs run too long
- Mitigated by: monitoring job durations and adjusting timeouts based on P99 latency + buffer
- Can tighten timeouts after collecting production data

---

## Question 13: Firestore Backup Sync Strategy

**Decision**: Option A - On every cache write (write-through, current spec)

**Rationale**:
1. **Data integrity** - Never lose generated creatures; every cache write immediately persisted
2. **Simplifies recovery** - If Redis crashes, Firestore has complete data, no sync gaps
3. **Acceptable latency** - Firestore writes are ~50-100ms, negligible in context of 2-5 minute generation time

**MVP Implementation**:
```javascript
async function cacheCreature(key, data) {
  await Promise.all([
    redis.setex(key, TTL, data),
    firestore.collection('creatures').doc(key).set(data)
  ]);
}
```

**Future Enhancement Path**:
- If Firestore costs become significant, migrate to Option B (write-behind) with background worker
- Add write batching for bulk operations
- Consider Option C (backup on eviction) for read-heavy caches, but creatures are write-heavy

**Risks**:
- Firestore write failures could block creature creation
- Mitigated by: (1) retry logic with exponential backoff, (2) circuit breaker to Redis-only mode if Firestore is down
- Firestore has 99.95% SLA, so outages rare

---

## Implementation Impact

### Files to Update

#### `/docs/specs/L3-FEATURES/ai-generation-pipeline/pixellab-api-client.md`

**Section: Open Questions → Question 1**
- Status: RESOLVED
- Decision: Backend environment variable
- Implementation: See Decision 1 above

**Section: Task 2.1 - API Key Configuration**
- Update acceptance criteria to specify `.env` file storage
- Add validation that key is never sent to client

---

#### `/docs/specs/L3-FEATURES/ai-generation-pipeline/generation-queue.md`

**Section: Open Questions → Question 7**
- Status: RESOLVED
- Decision: Redis LRU eviction policy
- Implementation: Configure `maxmemory-policy allkeys-lru`

**Section: Open Questions → Question 8**
- Status: RESOLVED
- Decision: Both admin and owner can retry
- Implementation: Authorization check `userId === job.userId || isAdmin`

**Section: Open Questions → Question 9**
- Status: RESOLVED
- Decision: Warn but allow submission
- Implementation: Return queue status with warning flag at 400

**Section: Open Questions → Question 10**
- Status: RESOLVED
- Decision: No cache warm-up
- Implementation: Deploy with empty Redis, monitor hit rate

**Section: Open Questions → Question 12**
- Status: RESOLVED
- Decision: Dynamic timeout based on image size
- Implementation: TIMEOUT_MAP by size (see code above)

**Section: Open Questions → Question 13**
- Status: RESOLVED
- Decision: Write-through sync
- Implementation: Parallel writes to Redis and Firestore

**Section: Task 6.3 - Generation Timeout Handling**
- Update to use dynamic timeout based on image size
- Add TIMEOUT_MAP configuration

**Section: Task 4.3 - Dead Letter Queue Setup**
- Update to include authorization logic for retry (owner + admin)

---

## Configuration Values

### Redis Configuration (`redis.conf`)
```conf
maxmemory 2gb
maxmemory-policy allkeys-lru
```

### Environment Variables (`.env`)
```env
PIXELLAB_API_KEY=your-api-key-here
REDIS_HOST=localhost
REDIS_PORT=6379
FIRESTORE_PROJECT_ID=drawn-of-war
```

### Queue Configuration (`src/config/queue.ts`)
```typescript
export const QUEUE_CONFIG = {
  MAX_JOBS: 500,
  WARNING_THRESHOLD: 400,
  USER_CONCURRENCY_LIMIT: 5,
  CACHE_TTL_DAYS: 30,
  DEDUPLICATION_WINDOW_MS: 10000, // 10 seconds
};

export const TIMEOUT_MAP = {
  16: 5 * 60 * 1000,   // 5 minutes
  32: 8 * 60 * 1000,   // 8 minutes
  48: 10 * 60 * 1000,  // 10 minutes
  64: 12 * 60 * 1000,  // 12 minutes
  128: 15 * 60 * 1000, // 15 minutes
};
```

---

## Next Steps

1. ✅ Update L3 documents with resolved decisions
2. ⏳ Execute API testing plan for empirical questions (2 hours)
3. ⏳ Update L3 documents with API test findings
4. ⏳ Create project infrastructure setup
5. ⏳ Begin Phase 1 implementation

---

**Document Status**: COMPLETE - All design decisions resolved

**Last Updated**: 2025-09-30

**Approved By**: technical-advisor agent

**Review Status**: Ready for implementation