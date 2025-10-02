# Drawn of War - Project Status

**Last Updated**: October 2, 2025

## What's Working

### Text-to-Animated-Sprite Generation (Fully Functional)

The core generation pipeline is **complete and operational**:

1. **User Input**: Enter text description (e.g., "fierce dragon warrior")
2. **Base Sprite**: PixelLab generates 64x64 sprite with transparent background
3. **Animation**: PixelLab creates 4-frame walk cycle
4. **Display**: React component animates frames at 10 FPS
5. **Processing Time**: ~27 seconds end-to-end

**Key Configuration**:
- Sprite size: 64x64 pixels (required for animation)
- View angle: 'side' (matches walk animation direction)
- Background: Transparent (`no_background: true`)
- Animation: 4-frame walk cycle
- Default animations: 20 assigned per creature (idle, walk, attack, etc.)

### Technical Stack

**Backend**:
- Node.js + Express + TypeScript
- BullMQ job queue with Redis
- PixelLab API integration (2 endpoints):
  - `/generate-image-pixflux` - Base sprite generation
  - `/animate-with-text` - 4-frame walk animation
- Winston logging

**Frontend**:
- React 18 + Vite
- Real-time job status polling
- Frame-based animation display

**Infrastructure**:
- Redis for queue management
- Firebase (planned for persistence)
- Docker Compose for local Redis

## API Endpoints

### Working Endpoints

#### POST /api/generate/enhanced
Submit creature generation job
```json
{
  "inputType": "text",
  "description": "fierce dragon warrior"
}
```

Response:
```json
{
  "success": true,
  "jobId": "1",
  "status": "queued"
}
```

#### GET /api/generate/:jobId
Poll job status and get results
```json
{
  "jobId": "1",
  "status": "completed",
  "progress": 100,
  "result": {
    "sprites": ["base64..."],
    "animations": ["walk", "idle", "attack", ...]
  }
}
```

#### GET /health
Health check endpoint
```json
{
  "status": "healthy",
  "timestamp": "2025-10-02T...",
  "uptime": 123.456
}
```

## What's Not Yet Implemented

### Input Methods (Frontend exists, backend path not fully tested)
- Drawing canvas → sprite generation
- Image upload → sprite generation

### Claude Vision Integration
- Not yet integrated in text generation path
- Backend service exists but not connected to text pipeline

### Style Validation
- Service exists but not integrated into text path
- Planned for ensuring consistent pixel art style

## Architecture

```
User Input (Text Description)
  ↓
Frontend (React)
  ↓
POST /api/generate/enhanced
  ↓
Backend Express API
  ↓
BullMQ Queue (Redis)
  ↓
Generation Worker
  ├─→ PixelLab: Generate Base Sprite (64x64)
  └─→ PixelLab: Animate (4 frames walk)
  ↓
Complete Job
  ↓
Frontend Polls /api/generate/:jobId
  ↓
Display Animated Sprite (10 FPS)
```

## Setup Requirements

### Prerequisites
- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Docker (for Redis)
- PixelLab API key
- Claude API key (optional, for future features)

### Environment Variables

**Backend** (`/backend/.env`):
```bash
# Server
PORT=3001
NODE_ENV=development

# APIs
PIXELLAB_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here  # Optional for now

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Running the Project

1. **Start Redis**:
```bash
docker run -d -p 6379:6379 --name redis-dev redis:alpine
```

2. **Start Backend** (Terminal 1):
```bash
cd backend
pnpm install
pnpm dev  # Runs on http://localhost:3001
```

3. **Start Frontend** (Terminal 2):
```bash
cd frontend
pnpm install
pnpm dev  # Runs on http://localhost:5173
```

4. **Test the Pipeline**:
   - Open http://localhost:5173
   - Enter text description: "fire dragon warrior"
   - Click "Generate Creature"
   - Watch progress (0% → 100% in ~27 seconds)
   - See animated sprite with frame cycling

## Recent Implementation

### Completed Features
- Generation Queue (F-001-003) - 97% complete (32/33 tasks)
- PixelLab API Client (F-001-001) - 100% complete (31/31 tasks)
- Text-to-sprite generation pipeline
- Animation frame display
- Job queue processing
- Progress tracking

### Known Issues
- Integration tests blocked by TypeScript API signature mismatches (Task 8.3)
- Drawing/upload paths not fully tested end-to-end

## Documentation

### Core Documentation
- `README.md` - Project overview and setup
- `PROJECT_STATUS.md` - This file (current status)
- `GETTING_STARTED.md` - Quick start guide
- `CURRENT_STATUS.md` - Detailed technical status

### Specifications
- `/docs/specs/L3-FEATURES/` - Feature specifications
  - `generation-queue.md` - Queue system spec
  - `pixellab-api-client.md` - API client spec
  - `prompt-builder.md` - Prompt builder spec

### Archived Documentation
- `/docs/archive/` - Historical process documents
  - `2025-10-02-working-implementation/` - Implementation journey docs

## Next Steps

### Immediate (Complete Text Path)
1. Test drawing input end-to-end
2. Test image upload end-to-end
3. Integrate Claude Vision for text descriptions
4. Add style validation to generation pipeline

### Near Term
1. Add sprite preview in results UI
2. Show PixelLab character ID for downloads
3. Implement creature saving to database
4. Add "View in PixelLab" links

### Future Enhancements
1. Battle system integration
2. Multiplayer matchmaking
3. Creature collection management
4. Advanced animation customization

## Contributing

This project follows **documentation-driven development**:
1. All features start with L3 specifications
2. Break down into atomic L4 tasks
3. Implement with TDD approach
4. Update docs continuously

See `.claude/CLAUDE.md` for detailed development guidelines.

## Project Health

- **Build Status**: Passing
- **Tests**: Unit tests passing, integration tests blocked
- **Core Pipeline**: Operational
- **Documentation**: Up to date

## Contact

For questions or issues, see project documentation in `/docs/` or reach out to the development team.
