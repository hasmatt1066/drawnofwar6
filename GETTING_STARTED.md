# Getting Started with Drawn of War

Quick guide to get the text-to-animated-sprite generation pipeline running.

## What You'll Get

After following this guide, you'll be able to:
- Enter text descriptions like "fierce dragon warrior"
- Generate animated 64x64 pixel art sprites
- See 4-frame walk cycle animations at 10 FPS
- Get results in ~27 seconds

## Prerequisites

Install these first:
- [Node.js](https://nodejs.org/) version 18 or higher
- [pnpm](https://pnpm.io/) version 8 or higher
- [Docker](https://www.docker.com/) for running Redis
- [PixelLab API key](https://pixellab.ai/) - Sign up and get your API key

## Step-by-Step Setup

### 1. Clone and Install

```bash
# Clone the repository
cd /path/to/drawnofwar6

# Install all dependencies
pnpm install
```

This installs dependencies for backend, frontend, and shared packages.

### 2. Configure Backend

```bash
# Navigate to backend
cd backend

# Copy environment template
cp .env.example .env

# Edit with your API key
# On Windows: notepad .env
# On Mac/Linux: nano .env
```

**Required configuration**:
```bash
# Server
PORT=3001
NODE_ENV=development

# Redis (default values work if using Docker)
REDIS_HOST=localhost
REDIS_PORT=6379

# PixelLab API (REQUIRED - get from https://pixellab.ai/)
PIXELLAB_API_KEY=your_actual_api_key_here

# Claude API (optional for now)
ANTHROPIC_API_KEY=your_claude_key_here
```

### 3. Start Redis

Redis is required for the job queue system.

```bash
# Start Redis in Docker
docker run -d -p 6379:6379 --name redis-dev redis:alpine

# Verify it's running
docker ps
# You should see: redis-dev container RUNNING
```

**Troubleshooting**:
- If port 6379 is already in use, stop other Redis instances
- To stop: `docker stop redis-dev`
- To start again: `docker start redis-dev`
- To remove: `docker rm redis-dev`

### 4. Start Backend

Open a terminal window:

```bash
cd backend
pnpm dev
```

**Expected output**:
```
[Queue Service] Initialized successfully
Server running on http://localhost:3001
```

**Troubleshooting**:
- "Redis connection refused" → Make sure Redis container is running
- "PIXELLAB_API_KEY not set" → Check your .env file
- Port 3001 in use → Change PORT in .env file

### 5. Start Frontend

Open a **second terminal window**:

```bash
cd frontend
pnpm dev
```

**Expected output**:
```
VITE v5.x.x ready in Xms

  ➜  Local:   http://localhost:5173/
```

Your browser should open automatically to http://localhost:5173

### 6. Test the Pipeline

1. **Open the app**: http://localhost:5173
2. **Enter a description**: Type "fire dragon warrior" or any creature description
3. **Click "Generate Creature"**
4. **Watch the progress**: You'll see a progress bar from 0% to 100%
5. **See your animated sprite**: After ~27 seconds, see your creature animating!

## What's Happening Behind the Scenes

```
Your Text Description
  ↓
Frontend sends to Backend API
  ↓
Job added to Redis Queue
  ↓
Background Worker picks up job
  ↓
PixelLab generates base sprite (64x64)
  ↓
PixelLab creates walk animation (4 frames)
  ↓
Worker saves results
  ↓
Frontend polls for results
  ↓
Display animated sprite!
```

## Common Issues & Solutions

### Redis Not Connecting

**Symptom**: Backend shows "Redis connection refused"

**Solution**:
```bash
# Check if Redis is running
docker ps

# If not listed, start it
docker run -d -p 6379:6379 --name redis-dev redis:alpine

# If it exists but is stopped
docker start redis-dev
```

### Backend Won't Start

**Symptom**: "Cannot find module" or TypeScript errors

**Solution**:
```bash
cd backend
pnpm install  # Reinstall dependencies
pnpm dev
```

### Frontend Shows Blank Page

**Symptom**: White screen, no UI

**Solution**:
```bash
cd frontend
rm -rf node_modules/.vite  # Clear Vite cache
pnpm install
pnpm dev
```

### Generation Takes Forever

**Symptom**: Job stuck at "processing"

**Possible causes**:
1. Invalid PixelLab API key → Check .env file
2. PixelLab API is down → Check https://pixellab.ai/status
3. Worker crashed → Check backend terminal for errors

**Solution**:
- Restart backend (Ctrl+C, then `pnpm dev`)
- Check API key is correct
- Try a simpler description

### Job Fails Immediately

**Symptom**: Job goes to "failed" status right away

**Check backend logs** for error message:
- "Invalid API key" → Fix your PIXELLAB_API_KEY in .env
- "Validation error" → Check your description meets requirements
- "Rate limit" → Wait a few minutes and try again

## Next Steps

Now that you have the basic pipeline running:

1. **Try different descriptions**:
   - "noble knight with golden armor"
   - "mystical wizard with glowing staff"
   - "fierce orc warrior"

2. **Explore the code**:
   - Backend: `/backend/src/`
   - Frontend: `/frontend/src/`
   - Shared types: `/shared/src/`

3. **Read the documentation**:
   - `PROJECT_STATUS.md` - What's working and what's planned
   - `README.md` - Full project overview
   - `/docs/specs/` - Feature specifications

4. **Check out the features**:
   - Generation Queue system
   - PixelLab API integration
   - Animation display system

## Development Workflow

### Making Changes

1. **Backend changes**: The server auto-reloads with `pnpm dev`
2. **Frontend changes**: Vite hot-reloads automatically
3. **Shared types**: Run `pnpm build:shared` then restart servers

### Running Tests

```bash
# Run all tests
pnpm test

# Run backend tests only
cd backend && pnpm test

# Run frontend tests only
cd frontend && pnpm test
```

### Checking Logs

**Backend logs**: Look in the terminal where backend is running
- Job submissions
- Queue processing
- PixelLab API calls
- Errors and warnings

**Frontend logs**: Open browser DevTools → Console tab
- API calls
- State changes
- Errors

### Stopping Everything

```bash
# Stop frontend: Ctrl+C in frontend terminal
# Stop backend: Ctrl+C in backend terminal
# Stop Redis: docker stop redis-dev
```

## Getting Help

### Check Documentation
- `PROJECT_STATUS.md` - Current state and known issues
- `CURRENT_STATUS.md` - Technical details
- `/docs/specs/` - Feature specifications

### Debug Tools
- Backend health check: http://localhost:3001/health
- Redis CLI: `docker exec -it redis-dev redis-cli`
- Check queue: In Redis CLI, run `KEYS *`

### Common Commands

```bash
# Check if services are running
docker ps                          # Redis
curl http://localhost:3001/health  # Backend
curl http://localhost:5173         # Frontend

# Restart everything
docker restart redis-dev
# Ctrl+C backend, then pnpm dev
# Ctrl+C frontend, then pnpm dev

# Clear everything and start fresh
docker stop redis-dev
docker rm redis-dev
cd backend && rm -rf node_modules && pnpm install
cd frontend && rm -rf node_modules && pnpm install
```

## Success Checklist

You know everything is working when:

- [ ] Redis container shows as RUNNING in `docker ps`
- [ ] Backend shows "Queue Service Initialized successfully"
- [ ] Backend responds to http://localhost:3001/health
- [ ] Frontend loads at http://localhost:5173
- [ ] You can submit a creature description
- [ ] Progress bar advances from 0% to 100%
- [ ] Animated sprite appears and cycles through frames

## What's Next?

Once you're comfortable with the basics:

1. Try the drawing canvas input (UI exists, backend testing needed)
2. Try image upload input (UI exists, backend testing needed)
3. Explore the queue management system
4. Check out the PixelLab API client implementation
5. Read about the architecture in `PROJECT_STATUS.md`

## Contributing

This project follows documentation-driven development. See `.claude/CLAUDE.md` for development guidelines.

---

**Need More Help?**

- Check `PROJECT_STATUS.md` for what's working
- Look in `/docs/archive/` for troubleshooting history
- Review feature specs in `/docs/specs/`
