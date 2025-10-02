# 🚀 Quick Start Guide

**5-Minute Setup** - Get the queue integration running

---

## Prerequisites (One-Time Setup)

### 1. Install Redis

**Easy Way - Docker**:
```powershell
docker run -d -p 6379:6379 --name redis-dev redis:alpine
```

Verify it's running:
```powershell
docker ps
# Should show redis container running
```

### 2. Set Up Environment

```powershell
cd C:\Users\mhast\Desktop\drawnofwar6\backend

# Copy and edit .env
Copy-Item .env.example .env
notepad .env
```

Add these keys:
```
REDIS_HOST=localhost
ANTHROPIC_API_KEY=sk-ant-api03-...
PIXELLAB_API_KEY=your-key
```

---

## Start Everything (3 Terminals)

### Terminal 1 - Backend

```powershell
cd C:\Users\mhast\Desktop\drawnofwar6\backend

# First time: Install dependencies from root
cd ..
pnpm install
cd backend

# Now run dev server
pnpm dev
```

Wait for: `[Queue Service] Initialized successfully` ✅

**If tsx error persists**:
```powershell
# Use npx instead
npx tsx watch --clear-screen=false src/index.ts
```

### Terminal 2 - Test Backend API

```powershell
# Quick test (no AI cost)
curl -X POST http://localhost:3001/api/generate/enhanced -H "Content-Type: application/json" -d '{\"inputType\":\"text\",\"description\":\"fire dragon\"}'
```

Should return: `{"jobId":"1","status":"queued"}` ✅

Check status:
```powershell
curl http://localhost:3001/api/generate/1
```

### Terminal 3 - Frontend

```powershell
cd C:\Users\mhast\Desktop\drawnofwar6\frontend
pnpm dev
```

Open browser: **http://localhost:5173** ✅

---

## Test the UI

1. Go to PromptBuilder page
2. Select "Describe It"
3. Type: `"armored knight"`
4. Click "Generate Creature"
5. Watch progress: 0% → 100%
6. See results!

---

## That's It! 🎉

**Full documentation**: See `TESTING_GUIDE.md` for complete instructions

**Integration docs**: See `backend/docs/PHASE3_INTEGRATION_COMPLETE.md`

---

## Common Issues

**Backend won't start**:
```powershell
# Is Redis running?
docker ps

# Check environment
notepad backend\.env
```

**Frontend won't start**:
```powershell
# Already fixed! Just run:
cd frontend
pnpm dev
```

**Job stuck in queue**:
- Check backend terminal for errors
- Verify API keys in `.env`
- Try text-only first (no API keys needed for testing)

---

## What You're Testing

✅ **Backend**: Queue system with BullMQ + Redis
✅ **Frontend**: Real-time progress polling
✅ **Integration**: Claude Vision → PixelLab → Results
✅ **UI**: Progress bar, step indicators, result display

**Total code**: ~1,500 lines across 10 files
**Status**: Feature complete, ready for testing
