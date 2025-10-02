# Testing Guide - Queue Integration

**Status**: Ready for testing ✅
**Date**: 2025-10-01

---

## Quick Start (Windows)

### 1. Install Dependencies (DONE ✅)

```powershell
# Already completed - dependencies are installed
```

### 2. Start Redis Server

You have 3 options:

**Option A - Docker (Recommended)**:
```powershell
docker run -d -p 6379:6379 --name redis-dev redis:alpine
```

**Option B - WSL**:
```powershell
wsl
redis-server
```

**Option C - Windows Redis**:
- Download from: https://github.com/microsoftarchive/redis/releases
- Run `redis-server.exe`

To verify Redis is running:
```powershell
# Test connection
redis-cli ping
# Should return: PONG
```

---

### 3. Configure Backend Environment

```powershell
cd C:\Users\mhast\Desktop\drawnofwar6\backend

# Copy example env file
Copy-Item .env.example .env

# Edit .env file and add:
# - ANTHROPIC_API_KEY=sk-ant-...
# - PIXELLAB_API_KEY=your-key
# - REDIS_HOST=localhost
```

**Required Environment Variables**:
```bash
REDIS_HOST=localhost
REDIS_PORT=6379
ANTHROPIC_API_KEY=sk-ant-api03-...
PIXELLAB_API_KEY=your-pixellab-key
```

---

### 4. Start Backend Server

```powershell
cd C:\Users\mhast\Desktop\drawnofwar6\backend
pnpm dev
```

**Expected Output**:
```
[Queue Service] Initialized successfully
[Worker] Started processing generation jobs
Server running on http://localhost:3001
```

**Leave this terminal running** ✅

---

### 5. Test Backend API (New Terminal)

Open a **new PowerShell window**:

```powershell
# Test health check
curl http://localhost:3001/health

# Test text-only generation (FREE - no AI cost)
curl -X POST http://localhost:3001/api/generate/enhanced `
  -H "Content-Type: application/json" `
  -d '{\"inputType\":\"text\",\"description\":\"fire breathing dragon warrior\"}'
```

**Expected Response**:
```json
{
  "success": true,
  "jobId": "1",
  "status": "queued",
  "inputType": "text",
  "submittedAt": "2025-10-01T..."
}
```

**Check Job Status**:
```powershell
# Replace :jobId with the actual ID from above
curl http://localhost:3001/api/generate/1
```

**Expected Response** (progresses over time):
```json
// Initially:
{"jobId":"1","status":"queued","progress":0}

// After a few seconds:
{"jobId":"1","status":"processing","progress":40}

// Finally:
{"jobId":"1","status":"completed","progress":100,"result":{...}}
```

---

### 6. Start Frontend Server

Open a **new PowerShell window**:

```powershell
cd C:\Users\mhast\Desktop\drawnofwar6\frontend
pnpm dev
```

**Expected Output**:
```
VITE v5.x ready in 234 ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
➜  press h to show help
```

**Leave this terminal running** ✅

---

### 7. Test Frontend UI

Open browser to: **http://localhost:5173**

#### Test Flow A - Text Input (FREE)

1. Navigate to the PromptBuilder page
2. Select **"Describe It"** tab
3. Enter text: `"armored knight with golden shield"`
4. Click **"Generate Creature"**
5. ✅ Should redirect to `/generation/:jobId`
6. ✅ Progress bar animates 0% → 100%
7. ✅ Result displays:
   - Creature concept/race/class
   - Stats bars (Health, Attack, Defense, Speed)
   - 20+ animations assigned
   - Processing time

#### Test Flow B - Drawing Input (AI - $0.01-0.03)

1. Select **"Draw It"** tab
2. Draw a simple creature on the canvas
3. (Optional) Add text description
4. Click **"Generate Creature"**
5. ✅ Should redirect to `/generation/:jobId`
6. ✅ Progress shows:
   - "Analyzing Image" (Claude Vision working)
   - "Mapping Animations"
   - "Generating Sprite" (PixelLab)
   - "Validating Style"
7. ✅ Result includes Claude's analysis

#### Test Flow C - Image Upload (AI - $0.01-0.03)

1. Select **"Upload It"** tab
2. Drag-and-drop or click to upload PNG/JPG
3. Click **"Generate Creature"**
4. ✅ Same flow as drawing input

---

## Troubleshooting

### Backend Won't Start

**Error**: `Queue service not initialized`
- ✅ **Fix**: Make sure Redis is running (`redis-cli ping`)
- ✅ **Fix**: Check `REDIS_HOST=localhost` in `.env`

**Error**: `ANTHROPIC_API_KEY not set`
- ✅ **Fix**: Add API key to `backend/.env`

**Error**: `Port 3001 already in use`
- ✅ **Fix**: Kill existing process or change `PORT=3002` in `.env`

### Frontend Won't Start

**Error**: `'vite' is not recognized`
- ✅ **Fix**: Run `pnpm install` in frontend directory
- ✅ **Already done** - should work now!

**Error**: `Cannot connect to backend`
- ✅ **Fix**: Make sure backend is running on port 3001
- ✅ **Fix**: Check CORS settings in backend

### Jobs Stuck in Queue

**Symptom**: Job stays at "queued" forever
- ✅ **Check**: Backend terminal for worker errors
- ✅ **Check**: Redis is running
- ✅ **Fix**: Restart backend server

**Symptom**: Job fails immediately
- ✅ **Check**: Backend logs for error message
- ✅ **Check**: API keys are valid
- ✅ **Try**: Text-only generation first (no API calls)

### Frontend Shows Error

**Error**: "Job not found"
- ✅ **Check**: Backend is running
- ✅ **Check**: JobId in URL is correct
- ✅ **Try**: Generate a new job

**Error**: "Generation failed"
- ✅ **Check**: Backend terminal for errors
- ✅ **Check**: PixelLab/Claude API keys are valid
- ✅ **Try**: Text-only generation (should work without APIs)

---

## Monitoring During Tests

### Backend Terminal

Watch for these logs:

```
✅ GOOD:
[Queue Service] Initialized successfully
[Worker] Started processing generation jobs
[Generation Processor] Processing job 1 (text)
[Generation Processor] Job 1 completed in 450ms

❌ BAD:
[Queue Service] Failed to initialize: Redis connection refused
[Worker] Error processing job: API key invalid
[Generation Processor] PixelLab API timeout
```

### Browser DevTools (Network Tab)

Should see:

```
✅ POST /api/generate/enhanced → 202 Accepted (immediate)
✅ GET /api/generate/1 → 200 OK (every 2.5 seconds)
✅ Status changes: queued → processing → completed
```

### Redis (Optional - Advanced)

```powershell
redis-cli

# Monitor queue
> KEYS *generation-queue*
> LLEN bull:generation-queue:wait
> LLEN bull:generation-queue:active
```

---

## Test Results Checklist

Use this to verify everything works:

### Backend API
- [ ] Backend starts without errors
- [ ] Queue service initializes
- [ ] Worker starts processing
- [ ] Text generation completes (<1s)
- [ ] Job status endpoint returns correct data
- [ ] Error handling works (invalid input)

### Frontend UI
- [ ] Frontend loads without console errors
- [ ] PromptBuilder renders all 3 input methods
- [ ] Text input submits successfully
- [ ] Drawing canvas works (can draw)
- [ ] Image upload validates files
- [ ] Submission returns jobId
- [ ] Redirect to progress page works

### Integration
- [ ] Progress polling starts automatically
- [ ] Progress bar updates in real-time
- [ ] Status text changes appropriately
- [ ] Step indicators highlight current step
- [ ] Completion shows full result
- [ ] Stats display with correct values
- [ ] Animation count shows (20+)
- [ ] Processing time displays

### Error Handling
- [ ] Invalid jobId shows error message
- [ ] Failed job shows error details
- [ ] Timeout shows appropriate message
- [ ] "Try Again" button works
- [ ] Network errors handled gracefully

---

## Performance Expectations

### Text-Only Path
- ⏱️ **Total Time**: <1 second
- 💰 **Cost**: $0 (no AI)
- ✅ **Quality**: Template-based, good

### Visual Path (Drawing/Upload)
- ⏱️ **Total Time**: 30-50 seconds
  - Claude Vision: ~3 seconds
  - PixelLab: 25-45 seconds
  - Other: <2 seconds
- 💰 **Cost**: $0.01-0.03 (Claude only)
- ✅ **Quality**: Excellent, AI-powered

### Polling
- ⏱️ **Interval**: 2.5 seconds
- ⏱️ **Max Duration**: 5 minutes (120 polls)
- 📊 **Progress Updates**: 0% → 10% → 20% → ... → 100%

---

## Next Steps After Testing

Once tests pass:

1. ✅ **Document any bugs found**
2. ✅ **Fix missing CSS modules** (if needed for full UI)
3. ✅ **Add React Router configuration**
4. ✅ **Set up production environment**
5. ✅ **Deploy to staging**

---

## Getting Help

If you encounter issues:

1. **Check backend terminal** - Shows error messages
2. **Check frontend console** - Shows JS errors
3. **Check Network tab** - Shows API calls
4. **Review logs** in `/backend/docs/PHASE3_INTEGRATION_COMPLETE.md`

---

**Happy Testing! 🚀**

The integration is complete and ready to go. Let me know if you hit any issues!
