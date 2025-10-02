# 🚀 START HERE - Complete Setup Guide

**Windows PowerShell** - Fixed for dependency issues

---

## ✅ One-Time Setup (5 Minutes)

### Step 1: Install Dependencies

```powershell
# From project root
cd C:\Users\mhast\Desktop\drawnofwar6
pnpm install
```

This installs **all** dependencies for backend and frontend. ✅

---

### Step 2: Start Redis

```powershell
# Start Redis container
docker run -d -p 6379:6379 --name redis-dev redis:alpine

# Verify it's running
docker ps
# Should show: redis-dev container
```

Redis is now running on port 6379. ✅

---

### Step 3: Configure Backend

```powershell
cd backend

# Copy environment template
Copy-Item .env.example .env

# Edit with your API keys
notepad .env
```

**Add these keys to `.env`**:
```bash
REDIS_HOST=localhost
REDIS_PORT=6379

# Get from: https://console.anthropic.com/
ANTHROPIC_API_KEY=sk-ant-api03-...

# Get from: https://pixellab.ai/
PIXELLAB_API_KEY=your-key-here
```

Save and close. ✅

---

## 🎮 Start Everything (Easy Way)

### Option A: Use PowerShell Scripts (Recommended)

**Terminal 1 - Backend**:
```powershell
cd C:\Users\mhast\Desktop\drawnofwar6\backend
.\start-dev.ps1
```

**Terminal 2 - Frontend**:
```powershell
cd C:\Users\mhast\Desktop\drawnofwar6\frontend
.\start-dev.ps1
```

The scripts check dependencies and start automatically! ✅

---

### Option B: Manual Commands

**Terminal 1 - Backend**:
```powershell
cd C:\Users\mhast\Desktop\drawnofwar6\backend

# If pnpm dev doesn't work:
npx tsx watch --clear-screen=false src/index.ts
```

Wait for:
```
[Queue Service] Initialized successfully
Server running on http://localhost:3001
```

**Terminal 2 - Frontend**:
```powershell
cd C:\Users\mhast\Desktop\drawnofwar6\frontend
pnpm dev
```

Opens browser to: **http://localhost:5173** ✅

---

## 🧪 Test It Works

### Quick Backend Test

Open **new terminal**:
```powershell
# Test API is running
curl http://localhost:3001/health

# Submit test job (no AI cost)
curl -X POST http://localhost:3001/api/generate/enhanced `
  -H "Content-Type: application/json" `
  -d '{\"inputType\":\"text\",\"description\":\"fire dragon\"}'
```

**Expected Response**:
```json
{
  "success": true,
  "jobId": "1",
  "status": "queued"
}
```

**Check Status**:
```powershell
curl http://localhost:3001/api/generate/1
```

Should progress: `queued` → `processing` → `completed` ✅

---

### Frontend Test

1. Open browser to: **http://localhost:5173**
2. Navigate to PromptBuilder page
3. Select **"Describe It"**
4. Type: `"armored knight with golden shield"`
5. Click **"Generate Creature"**
6. Should redirect to `/generation/:jobId`
7. Watch progress bar: 0% → 100%
8. See results with stats and animations! ✅

---

## 🛠️ Troubleshooting

### "tsx is not recognized"

**Fix**: Use npx instead
```powershell
cd backend
npx tsx watch --clear-screen=false src/index.ts
```

Or run the PowerShell script:
```powershell
.\start-dev.ps1
```

---

### "Cannot find module 'sharp'"

**Fix**: Rebuild native modules
```powershell
cd C:\Users\mhast\Desktop\drawnofwar6
pnpm rebuild sharp esbuild
```

---

### "Redis connection refused"

**Fix**: Start Redis container
```powershell
docker run -d -p 6379:6379 --name redis-dev redis:alpine

# Or if container exists but stopped:
docker start redis-dev
```

**Verify**:
```powershell
docker ps
# Should show redis-dev
```

---

### Backend starts but job stays "queued"

**Check**:
1. Look for errors in backend terminal
2. Verify REDIS_HOST=localhost in .env
3. Check Redis is running: `docker ps`

**Fix**:
```powershell
# Restart everything
docker restart redis-dev
# Stop backend (Ctrl+C), restart
```

---

### "Job not found" in frontend

**Cause**: Backend isn't running or crashed

**Fix**:
1. Check backend terminal for errors
2. Restart backend
3. Generate new job

---

## 📊 What You're Testing

### Backend Features
✅ Queue system with BullMQ + Redis
✅ Job submission (202 Accepted)
✅ Async processing with worker
✅ Progress tracking (0-100%)
✅ Status polling endpoint

### Frontend Features
✅ Three input methods (text, draw, upload)
✅ Real-time progress UI
✅ Progress bar animation
✅ Step indicators with icons
✅ Result display (stats, animations, style)

### Integration
✅ Submit → Queue → Process → Poll → Display
✅ Claude Vision analyzes images
✅ PixelLab generates sprites
✅ Animation mapping (20+ animations)
✅ Style validation

---

## 📚 Full Documentation

- **This Guide** - Quick start and troubleshooting
- **`QUICK_START.md`** - 5-minute minimal setup
- **`TESTING_GUIDE.md`** - Comprehensive testing manual
- **`INTEGRATION_SUMMARY.md`** - What was built
- **`backend/docs/PHASE3_INTEGRATION_COMPLETE.md`** - Technical deep dive

---

## 🎯 Success Checklist

After following this guide, you should have:

- [x] Redis running in Docker
- [x] Backend running on port 3001
- [x] Frontend running on port 5173
- [x] Backend logs show "Queue Service Initialized"
- [x] curl test returns jobId
- [x] Frontend UI loads without errors
- [x] Can submit creature generation
- [x] Progress updates in real-time
- [x] Results display correctly

---

## 🚨 Common Error Messages

### "ECONNREFUSED 127.0.0.1:6379"
→ **Redis not running**. Start: `docker run -d -p 6379:6379 --name redis-dev redis:alpine`

### "Queue service not initialized"
→ **REDIS_HOST not set**. Check `backend/.env` has `REDIS_HOST=localhost`

### "ANTHROPIC_API_KEY environment variable not set"
→ **Missing API key**. Add to `backend/.env`

### "Cannot GET /generation/123"
→ **React Router not configured**. This is expected - direct navigation works.

### "Port 3001 already in use"
→ **Backend already running**. Kill it: Find process and stop, or change port in `.env`

---

## 💡 Pro Tips

### Keep 3 Terminals Open

1. **Backend** - Shows queue/worker logs
2. **Frontend** - Shows Vite dev server
3. **Testing** - Run curl commands

### Watch Backend Logs

Important logs to look for:
```
✅ [Queue Service] Initialized successfully
✅ [Worker] Started processing generation jobs
✅ [Generation Processor] Job 1 completed in 450ms

❌ [Queue Service] Failed to initialize
❌ [Worker] Error processing job
❌ Redis connection refused
```

### Use Browser DevTools

- **Console** - See any frontend errors
- **Network** - Watch polling requests to `/api/generate/:jobId`
- **Application** - Check sessionStorage for jobId

---

## 🎉 You're Ready!

Everything is set up and ready to test. The queue integration is **complete** and working.

**Next**: Generate your first creature and watch the magic happen! ✨

For issues, see **`TESTING_GUIDE.md`** troubleshooting section.
