# PixelLab.ai API Testing Plan

## Overview

This document consolidates all open questions from L3 feature specifications that require empirical testing with the actual PixelLab.ai API. Completing this testing plan will resolve remaining ambiguities before full implementation begins.

---

## Prerequisites

- PixelLab.ai API access credentials
- Test environment setup (Node.js 18+, TypeScript)
- API documentation: https://api.pixellab.ai/mcp/docs

---

## Open Questions from pixellab-api-client.md

### Question 1: API Key Storage Location

**Status**: DECISION REQUIRED (not API testable)

**Question**: Where should the API key be stored?

**Options**:
- **A**: Backend environment variable (shared across all users)
- **B**: User-provided during client init (each user has own key)
- **C**: Encrypted database storage with backend proxy

**Current Recommendation**: Start with Option B (user-provided) for MVP

**Action**: User/architect decision, not API testing

---

### Question 2: Polling Timeout Threshold

**Status**: REQUIRES API TESTING

**Question**: When should polling give up and mark job as failed?

**Current Assumption**: 10 minute fixed timeout

**Test Case**:
```typescript
// Test 1: Simple sprite generation timing
const startTime = Date.now();
const result = await pixelLabClient.generateSprite({
  description: "simple red square",
  size: 16
});
const duration = Date.now() - startTime;
console.log(`Simple generation took: ${duration}ms`);

// Test 2: Complex sprite generation timing
const startTime2 = Date.now();
const result2 = await pixelLabClient.generateSprite({
  description: "highly detailed dragon with intricate scales and wings",
  size: 128,
  detail: "highly detailed",
  shading: "highly detailed shading"
});
const duration2 = Date.now() - startTime2;
console.log(`Complex generation took: ${duration2}ms`);

// Test 3: 8-directional animation timing
const startTime3 = Date.now();
const character = await pixelLabClient.createCharacter({
  description: "wizard with blue robes",
  n_directions: 8
});
const duration3 = Date.now() - startTime3;
console.log(`8-directional character took: ${duration3}ms`);
```

**Expected Output**:
- Simple: ~30-60 seconds
- Complex: ~2-5 minutes
- 8-directional: ~3-5 minutes

**Decision Point**: If any generation exceeds 10 minutes, adjust timeout accordingly

---

### Question 3: Rate Limit Detection Strategy

**Status**: REQUIRES API TESTING

**Question**: What are PixelLab's actual rate limits?

**Current Assumption**: 30 requests/minute conservative limit

**Test Case**:
```typescript
// Test: Rapid fire requests to discover rate limits
const results = [];
const requestCount = 50;
const startTime = Date.now();

for (let i = 0; i < requestCount; i++) {
  try {
    const result = await pixelLabClient.generateSprite({
      description: `test sprite ${i}`,
      size: 16
    });
    results.push({
      index: i,
      status: 'success',
      timestamp: Date.now() - startTime
    });
  } catch (error) {
    results.push({
      index: i,
      status: 'error',
      statusCode: error.response?.status,
      message: error.message,
      timestamp: Date.now() - startTime
    });

    // Check for rate limit response
    if (error.response?.status === 429) {
      console.log('Rate limit hit at request:', i);
      console.log('Rate limit headers:', error.response?.headers);
      break;
    }
  }

  // Small delay to measure limit threshold
  await sleep(100); // 600 req/min max
}

console.log('Results:', results);
console.log('Successful requests before limit:',
  results.filter(r => r.status === 'success').length
);
```

**Expected Output**:
- HTTP 429 response if rate limit exceeded
- `Retry-After` header (if provided)
- `X-RateLimit-*` headers (if provided)

**Decision Point**: Set client rate limit to 80% of discovered limit for safety margin

---

### Question 4: Job Status Enum Values

**Status**: REQUIRES API TESTING

**Question**: What exact status strings does PixelLab return?

**Unknown**:
- Status field name (`status`, `state`, `jobStatus`?)
- Exact status values (`queued`, `pending`, `running`?)
- Progress reporting format (percentage, steps, none?)

**Test Case**:
```typescript
// Test: Submit job and capture all status transitions
const jobId = await pixelLabClient.submitJob({
  description: "test character",
  size: 32
});

const statusLog = [];
const pollInterval = 2000; // 2 seconds

while (true) {
  const response = await pixelLabClient.getJobStatus(jobId);

  // Log entire response structure
  console.log('Full response:', JSON.stringify(response, null, 2));

  // Track status transitions
  const currentStatus = response.status || response.state || response.jobStatus;
  const lastStatus = statusLog[statusLog.length - 1]?.status;

  if (currentStatus !== lastStatus) {
    statusLog.push({
      status: currentStatus,
      timestamp: Date.now(),
      progress: response.progress,
      fullResponse: response
    });
    console.log(`Status changed: ${lastStatus} → ${currentStatus}`);
  }

  // Check for completion
  if (currentStatus === 'completed' || currentStatus === 'done' ||
      currentStatus === 'succeeded' || response.completed === true) {
    console.log('Job completed!');
    break;
  }

  if (currentStatus === 'failed' || currentStatus === 'error') {
    console.log('Job failed:', response.error);
    break;
  }

  await sleep(pollInterval);
}

console.log('Status transition log:', statusLog);
```

**Expected Output**:
- Complete list of possible status values
- Field name containing status
- Progress reporting format (if available)
- Transition sequence (e.g., `queued` → `processing` → `completed`)

**Decision Point**: Update `JobStatus` enum in TypeScript with actual values

---

### Question 5: Multi-Directional Animation Handling

**Status**: REQUIRES API TESTING

**Question**: For 8-directional animations, how is the data structured in the response?

**Options**:
- **A**: One array with all frames (N frames × 8 directions = 8N frames)
- **B**: Eight separate arrays (one per direction)
- **C**: Eight separate job IDs (one job per direction)

**Test Case**:
```typescript
// Test: Create 8-directional character and inspect response structure
const character = await pixelLabClient.createCharacter({
  description: "knight with sword",
  n_directions: 8,
  size: 32
});

console.log('Character object structure:', JSON.stringify(character, null, 2));

// Check response structure
if (character.rotations) {
  console.log('Has rotations array, length:', character.rotations.length);
  console.log('First rotation:', character.rotations[0]);
}

if (character.directions) {
  console.log('Has directions object, keys:', Object.keys(character.directions));
}

if (character.frames) {
  console.log('Has frames array, length:', character.frames.length);
  console.log('Frame structure:', character.frames[0]);
}

// Get character details to see full structure
const details = await pixelLabClient.getCharacter(character.character_id);
console.log('Full character details:', JSON.stringify(details, null, 2));
```

**Expected Output**:
- Response structure for multi-directional sprites
- Field names and data organization
- Frame count per direction
- Direction naming convention (north/south/east/west vs. 0-7 indices)

**Decision Point**: Update response parsing logic in `SpriteResultBuilder` to match actual structure

---

### Question 6: Error Response Format

**Status**: REQUIRES API TESTING

**Question**: What structure do PixelLab error responses have?

**Unknown**:
- Error message field name (`error`, `message`, `detail`?)
- Error code field (numeric code, string enum?)
- Stack traces included?

**Test Case**:
```typescript
// Test 1: Invalid API key
try {
  const client = new PixelLabClient({ apiKey: 'invalid_key_12345' });
  await client.generateSprite({ description: "test", size: 16 });
} catch (error) {
  console.log('Invalid API key error:', {
    status: error.response?.status,
    statusText: error.response?.statusText,
    data: error.response?.data,
    fullError: JSON.stringify(error, null, 2)
  });
}

// Test 2: Invalid parameters
try {
  await pixelLabClient.generateSprite({
    description: "", // empty description
    size: 999 // invalid size
  });
} catch (error) {
  console.log('Invalid parameters error:', {
    status: error.response?.status,
    data: error.response?.data
  });
}

// Test 3: Rate limit exceeded (from Question 3 test)
// Captured in rate limit test

// Test 4: Network timeout
try {
  const client = new PixelLabClient({
    apiKey: process.env.PIXELLAB_API_KEY,
    timeout: 100 // 100ms timeout
  });
  await client.generateSprite({ description: "test", size: 32 });
} catch (error) {
  console.log('Timeout error:', {
    code: error.code,
    message: error.message,
    isTimeout: error.code === 'ECONNABORTED'
  });
}

// Test 5: Invalid job ID
try {
  await pixelLabClient.getJobStatus('invalid-job-id-12345');
} catch (error) {
  console.log('Invalid job ID error:', {
    status: error.response?.status,
    data: error.response?.data
  });
}
```

**Expected Output**:
- Error response structure for each error type
- Field names (error, message, detail, code, etc.)
- HTTP status codes used
- Whether stack traces are included

**Decision Point**: Update `PixelLabError` class to parse actual error format

---

## Open Questions from generation-queue.md

### Question 7: Cache Eviction Strategy

**Status**: DESIGN DECISION (not API testable)

**Question**: When Redis memory is full, which cache entries should be evicted first?

**Current Assumption**: Redis default LRU eviction policy

**Action**: Configure Redis eviction policy, not API dependent

**Recommendation**: Use `allkeys-lru` policy in Redis config

---

### Question 8: DLQ Manual Retry Authorization

**Status**: DESIGN DECISION (not API testable)

**Question**: Who should have permission to manually retry DLQ jobs?

**Current Assumption**: Admin-only access

**Action**: Design decision for MVP, not API dependent

---

### Question 9: Queue Overflow Warning Threshold

**Status**: DESIGN DECISION (not API testable)

**Question**: Should users be able to proceed after queue overflow warning (400-499 jobs)?

**Current Assumption**: Show warning but allow submission

**Action**: UX decision, not API dependent

---

### Question 10: Cache Warm-Up Strategy

**Status**: DESIGN DECISION (not API testable)

**Question**: Should the queue pre-populate cache on startup?

**Current Assumption**: No warm-up (cold start)

**Action**: Performance optimization decision, test after MVP launch

---

### Question 11: Progress Update Granularity

**Status**: PARTIALLY API TESTABLE

**Question**: How often should progress updates be sent via SSE?

**Current Assumption**: Every 2-3 seconds

**Related to Question 4**: Need to understand PixelLab's progress reporting first

**Test Case**:
```typescript
// Test: Monitor progress update frequency from PixelLab
const jobId = await pixelLabClient.submitJob({
  description: "detailed character",
  size: 64
});

const progressUpdates = [];
const pollInterval = 500; // 500ms to catch all changes

while (true) {
  const response = await pixelLabClient.getJobStatus(jobId);

  progressUpdates.push({
    timestamp: Date.now(),
    progress: response.progress,
    status: response.status
  });

  if (response.status === 'completed' || response.status === 'failed') {
    break;
  }

  await sleep(pollInterval);
}

// Analyze update frequency
console.log('Total progress updates:', progressUpdates.length);
console.log('Progress values:', progressUpdates.map(u => u.progress));

// Calculate time between progress changes
const progressChanges = progressUpdates.filter((u, i) =>
  i === 0 || u.progress !== progressUpdates[i-1].progress
);
console.log('Unique progress changes:', progressChanges.length);

const intervals = [];
for (let i = 1; i < progressChanges.length; i++) {
  intervals.push(progressChanges[i].timestamp - progressChanges[i-1].timestamp);
}
console.log('Average interval between changes:',
  intervals.reduce((a, b) => a + b, 0) / intervals.length
);
```

**Expected Output**:
- How frequently PixelLab updates progress (every second? every 10%?)
- Whether progress is continuous (0-100) or stepped (0, 25, 50, 75, 100)

**Decision Point**: Set SSE update frequency based on PixelLab's update rate

---

### Question 12: Job Timeout for Complex Prompts

**Status**: COVERED BY QUESTION 2

**Question**: Should timeout be adjustable based on prompt complexity?

**Current Assumption**: Fixed 10-minute timeout

**Action**: Use data from Question 2 test to inform decision

---

### Question 13: Firestore Backup Sync Strategy

**Status**: DESIGN DECISION (not API testable)

**Question**: When should Redis cache be synced back to Firestore?

**Current Assumption**: Write-through (on every cache write)

**Action**: Performance/cost trade-off decision, not API dependent

---

## Summary of API Testing Requirements

### Must Test (Blocks Implementation):
1. ✅ **Question 2**: Polling Timeout - measure actual generation times
2. ✅ **Question 3**: Rate Limits - discover actual limits
3. ✅ **Question 4**: Job Status Enum - capture all status values
4. ✅ **Question 5**: Multi-Directional Response Structure - inspect 8-direction data
5. ✅ **Question 6**: Error Response Format - trigger various errors

### Should Test (Improves Implementation):
6. ✅ **Question 11**: Progress Update Frequency - analyze PixelLab's update rate

### Design Decisions (No API Testing):
- Question 1: API Key Storage
- Question 7: Cache Eviction
- Question 8: DLQ Authorization
- Question 9: Queue Overflow Warning
- Question 10: Cache Warm-Up
- Question 12: Dynamic Timeout (use Question 2 data)
- Question 13: Firestore Sync Strategy

---

## Testing Execution Plan

### Phase 1: Basic API Behavior (30 minutes)
1. Test simple sprite generation (Question 2 - simple case)
2. Capture job status transitions (Question 4)
3. Inspect 8-directional response structure (Question 5)

### Phase 2: Error Handling (20 minutes)
4. Trigger various error scenarios (Question 6)
5. Document error response formats

### Phase 3: Performance & Limits (40 minutes)
6. Test complex sprite generation timing (Question 2 - complex case)
7. Test 8-directional character timing (Question 2 - multi-directional)
8. Discover rate limits (Question 3)
9. Analyze progress update frequency (Question 11)

### Phase 4: Documentation (30 minutes)
10. Consolidate findings
11. Update L3 feature documents with actual values
12. Flag any blocking issues discovered

**Total Estimated Time**: 2 hours

---

## Test Environment Setup

```bash
# Install dependencies
npm install axios @pixellab/client

# Create test script
touch test-pixellab-api.ts

# Set environment variables
export PIXELLAB_API_KEY="your-api-key-here"

# Run tests
npx tsx test-pixellab-api.ts
```

---

## Output Format

For each test, document:

```markdown
### Test X: [Test Name]

**Question**: [Question from above]

**Test Code**: [Code snippet used]

**Results**:
- Finding 1: [What was discovered]
- Finding 2: [Another finding]
- Sample Response: [JSON sample if relevant]

**Decision**: [What should be implemented based on findings]

**Updates Required**:
- File: [filename]
  - Change: [what needs to be updated]
```

---

## Next Steps After Testing

1. Review all findings
2. Update TypeScript interfaces in L3 documents:
   - `pixellab-api-client.md`: Update `JobStatus`, error types, response interfaces
   - `generation-queue.md`: Update timeout values, polling intervals
3. Document any blocking issues discovered
4. Proceed with infrastructure setup
5. Begin Phase 1 implementation

---

**Document Status**: READY FOR EXECUTION

**Last Updated**: 2025-09-30

**Estimated Testing Time**: 2 hours

**Prerequisites**: PixelLab.ai API key, Node.js 18+, TypeScript environment