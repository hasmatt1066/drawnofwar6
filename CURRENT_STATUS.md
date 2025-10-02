# Drawn of War - Current Technical Status

**Last Updated**: October 2, 2025

> **Quick Links**:
> - New to the project? → See `GETTING_STARTED.md`
> - Want high-level overview? → See `PROJECT_STATUS.md`
> - Full project details? → See `README.md`

## Operational Status

### Fully Working Pipeline

The text-to-animated-sprite generation pipeline is **operational and tested**:

```
Text Input → Queue Job → PixelLab Base Sprite → PixelLab Animation → Display
    27 seconds end-to-end processing time
```

**Verified Working**:
- Text description input
- Job queue submission (BullMQ + Redis)
- Background worker processing
- PixelLab API integration (2 endpoints)
- 4-frame walk animation generation
- Real-time progress polling (every 2.5 seconds)
- Frontend animation display (10 FPS frame cycling)
- Default animation metadata assignment (20 animations)

## Technical Implementation

### Backend Architecture

**Stack**:
- Node.js + Express + TypeScript
- BullMQ for job queue
- Redis for queue persistence
- Winston for structured logging

**Key Services**:
- `GenerationQueueService` - Job orchestration
- `PixelLabClient` - API integration
- `AnimationMapper` - Metadata assignment
- `QueueProcessor` - Async job execution

**API Endpoints**:
```
POST /api/generate/enhanced   - Submit generation job
GET  /api/generate/:jobId     - Poll job status and results
GET  /health                  - Health check
```

### PixelLab Integration

**Base Sprite Generation**:
```
POST /generate-image-pixflux
{
  "size": "64",  // 64x64 pixels
  "description": "fierce dragon warrior",
  "no_background": true,
  "view": "side"
}
```

**Animation Generation**:
```
POST /animate-with-text
{
  "character_id": "...",
  "action": "walk",
  "frames": 4,
  "size": "64"
}
```

**Response Format**:
- HTTP 423 (Locked) → Still processing, check `Retry-After` header
- HTTP 200 (OK) → Complete, images in response
- Progress parsed from message text ("X% complete")

### Frontend Architecture

**Stack**:
- React 18 + TypeScript
- Vite build tool
- CSS Modules for styling

**Key Components**:
- `PromptBuilder` - Input form (text/draw/upload)
- `GenerationProgress` - Real-time progress display
- `AnimationDisplay` - Frame cycling renderer

**Data Flow**:
```javascript
// 1. Submit job
const response = await fetch('/api/generate/enhanced', {
  method: 'POST',
  body: JSON.stringify({ inputType: 'text', description: '...' })
});
const { jobId } = await response.json();

// 2. Poll for status
const poll = setInterval(async () => {
  const status = await fetch(`/api/generate/${jobId}`);
  const data = await status.json();

  if (data.status === 'completed') {
    clearInterval(poll);
    displayResult(data.result);
  }
}, 2500);
```

### Database Schema

**Planned (not yet implemented)**:
- Firebase Firestore for creature persistence
- Firebase Storage for sprite image hosting

**Current**: In-memory only (results lost on server restart)

## Configuration

### Environment Variables

**Backend** (`/backend/.env`):
```bash
# Required
PIXELLAB_API_KEY=your_key_here
REDIS_HOST=localhost
REDIS_PORT=6379

# Optional
ANTHROPIC_API_KEY=your_key_here
PORT=3001
NODE_ENV=development
```

### PixelLab Configuration

**Sprite Parameters**:
- Size: 64x64 pixels (minimum for animation)
- Background: Transparent
- View: Side (matches walk animation)
- Detail: Medium detail
- Shading: Medium shading

**Animation Parameters**:
- Action: Walk cycle
- Frames: 4
- Direction: Side view

## Known Limitations

### Input Methods
**Text Input**: ✅ Fully working
**Drawing Canvas**: ⚠️ Frontend exists, backend path needs testing
**Image Upload**: ⚠️ Frontend exists, backend path needs testing

### Integration Status
- ✅ PixelLab sprite generation
- ✅ PixelLab walk animation
- ✅ Queue processing
- ✅ Progress tracking
- ⚠️ Claude Vision (not yet integrated in text path)
- ⚠️ Style validation (service exists, not integrated)
- ❌ Creature persistence (not implemented)
- ❌ Firebase Storage uploads (not implemented)

### Testing Status
- ✅ Unit tests for core services
- ✅ Manual end-to-end testing
- ⚠️ Integration tests blocked (API signature issues - Task 8.3)
- ❌ Load testing not yet performed

## Performance Metrics

**Measured Performance**:
- Job submission: < 100ms
- Queue wait time: < 1 second (under normal load)
- PixelLab base sprite: ~15 seconds
- PixelLab animation: ~12 seconds
- Total end-to-end: ~27 seconds average

**Resource Usage**:
- Redis memory: Minimal (<10MB for queue data)
- Backend memory: ~150MB
- Frontend bundle: ~500KB

## Error Handling

**Implemented Error Types**:
- Validation errors (Pydantic format)
- Parameter constraint violations
- Database/UUID errors
- Authentication failures (401, 403)
- Rate limiting (none observed, client-side throttling at 30 req/min)
- API errors (500, 503)
- Network timeouts

**Retry Strategy**:
- Transient errors: Retry up to 3 times with exponential backoff
- Non-retryable errors: Fail immediately (auth, validation)
- Timeout: 3-10 minutes based on complexity

## Monitoring & Observability

**Logging**:
- Winston structured logging
- Request correlation IDs
- API key redaction
- Error context preservation

**Metrics** (ready but not exposed):
- Job throughput
- Queue depth
- Processing time
- Cache hit rate (for future cache implementation)
- Error rates by type

**Health Check**:
```bash
curl http://localhost:3001/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-02T...",
  "uptime": 123.456
}
```

## Development Status

### Completed Features

**Generation Queue** (F-001-003):
- Status: 97% complete (32/33 tasks)
- Blocker: Integration tests (Task 8.3) - API signature mismatches
- Implementation: 8,397 lines of production code
- Tests: 21,467 lines of test code

**PixelLab API Client** (F-001-001):
- Status: 100% complete (31/31 tasks)
- Implementation: 10,860 lines of code
- Full test coverage with mocking

### In Progress

**Prompt Builder** (F-001-002):
- Text input: ✅ Complete
- Drawing canvas: ⚠️ Frontend done, backend testing needed
- Image upload: ⚠️ Frontend done, backend testing needed

### Planned

**Creature Persistence**:
- Firebase Firestore integration
- Creature CRUD operations
- User creature collections

**Battle System**:
- Turn-based combat engine
- Ability system
- Damage calculation

**Multiplayer**:
- Matchmaking
- Real-time battles
- Rankings/leaderboards

## Troubleshooting

### Common Issues

**Redis Connection Failed**:
```bash
# Check if Redis is running
docker ps | grep redis

# Start if needed
docker run -d -p 6379:6379 --name redis-dev redis:alpine
```

**Job Stuck in Processing**:
- Check backend logs for errors
- Verify PixelLab API key is valid
- Check PixelLab API status
- Restart backend worker

**Frontend Won't Load**:
```bash
cd frontend
rm -rf node_modules/.vite
pnpm install
pnpm dev
```

### Debug Commands

```bash
# Check backend health
curl http://localhost:3001/health

# Check Redis
docker exec -it redis-dev redis-cli ping

# View queue contents
docker exec -it redis-dev redis-cli KEYS "*"

# Check job status directly
curl http://localhost:3001/api/generate/JOB_ID
```

## Next Development Steps

### Immediate (Complete Text Path)
1. Integrate Claude Vision for enhanced text descriptions
2. Add style validation to generation pipeline
3. Test drawing and upload paths end-to-end

### Near Term
1. Implement creature persistence (Firebase)
2. Add sprite preview in results UI
3. Show PixelLab character ID and download links
4. Implement creature saving and collection

### Future
1. Battle system integration
2. Multiplayer matchmaking
3. Advanced animation customization
4. Performance optimization (caching, CDN)

## Documentation Structure

### Root Level Documentation
- `README.md` - Project overview and full setup guide
- `PROJECT_STATUS.md` - High-level status and feature list
- `GETTING_STARTED.md` - Quick start guide for new developers
- `CURRENT_STATUS.md` - This file (technical details)
- `TESTING_GUIDE.md` - Testing procedures and scripts

### Specifications
- `/docs/specs/L3-FEATURES/` - Feature-level specifications
  - `generation-queue.md` - Queue system (97% complete)
  - `pixellab-api-client.md` - API client (100% complete)
  - `prompt-builder.md` - Input handling (partial)

### Archive
- `/docs/archive/2025-10-02-working-implementation/` - Historical process documents
  - Diagnostic reports
  - Implementation journey
  - Troubleshooting history

## Architecture Diagrams

### Request Flow
```
User Input
  ↓
React Frontend (localhost:5173)
  ↓
Vite Proxy → POST /api/generate/enhanced
  ↓
Express Backend (localhost:3001)
  ↓
BullMQ Queue (Redis localhost:6379)
  ↓
Worker Process
  ├─→ PixelLab: Generate Base Sprite
  └─→ PixelLab: Create Walk Animation
  ↓
Save Result to Job
  ↓
Frontend Polls: GET /api/generate/:jobId
  ↓
Display Animated Sprite
```

### Component Hierarchy
```
Backend
├── src/
│   ├── api/
│   │   ├── routes/        # Express routes
│   │   └── controllers/   # Request handlers
│   ├── services/
│   │   ├── pixellab/      # PixelLab integration
│   │   ├── claude/        # Claude Vision (ready)
│   │   └── animation/     # Animation mapping
│   ├── queue/
│   │   ├── index.ts       # Queue service
│   │   └── processor.ts   # Job processor
│   └── config/            # Configuration

Frontend
├── src/
│   ├── components/
│   │   ├── PromptBuilder/ # Input form
│   │   ├── GenerationProgress/  # Progress display
│   │   └── AnimationDisplay/    # Sprite renderer
│   ├── services/
│   │   └── api.ts         # API client
│   └── pages/
│       └── GenerationPage.tsx   # Main page
```

## Contact & Support

For questions or issues:
1. Check documentation in `/docs/`
2. Review archived troubleshooting in `/docs/archive/`
3. Check feature specifications in `/docs/specs/`
4. Review development guidelines in `.claude/CLAUDE.md`

## Version History

- **October 2, 2025**: Documentation cleanup, text pipeline operational
- **October 1, 2025**: End-to-end testing, Windows fixes applied
- **September 30, 2025**: Generation Queue and PixelLab Client features completed
- **September 29, 2025**: Initial implementation phase
