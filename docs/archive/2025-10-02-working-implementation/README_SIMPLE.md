# 🚀 Super Simple Start Guide

**For Windows - No PowerShell Issues!**

---

## ✅ You Already Did:

1. ✅ Redis is running (you started it with docker)
2. ✅ Dependencies are installed

---

## 🎯 Just Do This:

### Step 1: Check Your API Keys

```powershell
cd C:\Users\mhast\Desktop\drawnofwar6\backend
notepad .env
```

**Make sure these are set:**
```
REDIS_HOST=localhost
ANTHROPIC_API_KEY=sk-ant-...
PIXELLAB_API_KEY=your-key
```

Save and close.

---

### Step 2: Start Backend (Easy Way)

**Double-click this file:**
```
C:\Users\mhast\Desktop\drawnofwar6\START_BACKEND.bat
```

Or in PowerShell:
```powershell
cd C:\Users\mhast\Desktop\drawnofwar6
.\START_BACKEND.bat
```

**Wait for:**
```
[Queue Service] Initialized successfully
Server running on http://localhost:3001
```

✅ **Leave this window open!**

---

### Step 3: Start Frontend (New Window)

**Double-click this file:**
```
C:\Users\mhast\Desktop\drawnofwar6\START_FRONTEND.bat
```

Or in PowerShell:
```powershell
cd C:\Users\mhast\Desktop\drawnofwar6
.\START_FRONTEND.bat
```

Opens browser to: **http://localhost:5173**

✅ **Leave this window open!**

---

## 🧪 Quick Test

**New PowerShell window:**

```powershell
# Test backend
curl http://localhost:3001/health

# Generate creature (FREE - no AI cost)
curl -X POST http://localhost:3001/api/generate/enhanced `
  -H "Content-Type: application/json" `
  -d '{\"inputType\":\"text\",\"description\":\"fire dragon\"}'

# Check status (use jobId from above)
curl http://localhost:3001/api/generate/1
```

---

## 🎨 Test Frontend

1. Open: **http://localhost:5173**
2. Go to PromptBuilder
3. Select "Describe It"
4. Type: `armored knight`
5. Click "Generate Creature"
6. Watch the magic! ✨

---

## ❌ Still Having Issues?

### If .bat files don't work:

**Backend:**
```powershell
cd C:\Users\mhast\Desktop\drawnofwar6
pnpm dev:backend
```

**Frontend:**
```powershell
cd C:\Users\mhast\Desktop\drawnofwar6
pnpm dev:frontend
```

These commands run from the **project root** which makes pnpm workspace work correctly.

---

### If Redis isn't running:

```powershell
docker run -d -p 6379:6379 --name redis-dev redis:alpine
```

### If port is in use:

```powershell
# Find and kill process on port 3001
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

---

## 📁 File Locations

All in: `C:\Users\mhast\Desktop\drawnofwar6\`

- ✅ `START_BACKEND.bat` - Click to start backend
- ✅ `START_FRONTEND.bat` - Click to start frontend
- 📖 `START_HERE.md` - Detailed guide
- 📖 `TESTING_GUIDE.md` - Full testing manual

---

## 🎉 That's It!

**Your integration is ready to test!**

Any issues? See the full guide: `START_HERE.md`
