# Troubleshooting Guide - Drawn of War

**Last Updated**: October 4, 2025

This guide covers common issues encountered during development and their solutions.

---

## Table of Contents

1. [Frontend Issues](#frontend-issues)
2. [Backend Issues](#backend-issues)
3. [API Connection Issues](#api-connection-issues)
4. [Socket.IO Issues](#socketio-issues)
5. [Generation Pipeline Issues](#generation-pipeline-issues)
6. [Development Environment](#development-environment)

---

## Frontend Issues

### Issue 1: "Unexpected end of JSON input" Error

**Symptoms**:
```
Failed to execute 'json' on 'Response': Unexpected end of JSON input
POST http://localhost:5175/api/generate/enhanced 500 (Internal Server Error)
```

**Root Cause**: Frontend making requests to frontend port (5175) instead of backend port (3001), bypassing Vite's proxy.

**Solution**:

1. **Check for absolute URLs** in frontend code:
   ```bash
   cd frontend
   grep -r "localhost:3001" src/
   grep -r "localhost:5175" src/
   # Should return no results after fix
   ```

2. **Use relative paths** instead:
   ```typescript
   // ❌ WRONG - bypasses proxy
   fetch('http://localhost:3001/api/generate/enhanced', ...)

   // ✅ CORRECT - uses proxy
   fetch('/api/generate/enhanced', ...)
   ```

3. **Files to check**:
   - `frontend/src/services/deployment-socket.ts`
   - `frontend/src/services/creature-sprite-loader.ts`
   - `frontend/src/components/DeploymentGrid/useMatchSync.ts`
   - Any component making API calls

**Verification**:
```bash
# Vite should proxy /api requests to backend
# Check vite.config.ts:
cat frontend/vite.config.ts | grep -A10 "proxy"
```

**Expected Vite Config**:
```typescript
server: {
  port: 5175,
  proxy: {
    '/api': {
      target: 'http://localhost:3001',
      changeOrigin: true,
      secure: false,
    },
    '/socket.io': {
      target: 'ws://localhost:3001',
      ws: true,
    },
  },
}
```

---

### Issue 2: Module Resolution Errors

**Symptoms**:
```
Cannot find module '@/components/...'
```

**Solution**:

1. **Check tsconfig.json paths**:
   ```json
   {
     "compilerOptions": {
       "paths": {
         "@/*": ["./src/*"],
         "@shared/*": ["../shared/src/*"]
       }
     }
   }
   ```

2. **Check vite.config.ts aliases**:
   ```typescript
   resolve: {
     alias: {
       '@': path.resolve(__dirname, './src'),
       '@shared': path.resolve(__dirname, '../shared/src'),
     },
   }
   ```

3. **Restart dev server** after config changes:
   ```bash
   # Stop server (Ctrl+C), then:
   pnpm run dev
   ```

---

### Issue 3: Frontend Won't Start

**Symptoms**:
```
Error: Cannot find module 'vite'
ENOENT: no such file or directory
```

**Solution**:

1. **Use correct package manager** (frontend uses **pnpm**):
   ```bash
   cd frontend
   pnpm install
   pnpm run dev
   ```

2. **Clear node_modules** if corrupted:
   ```bash
   rm -rf node_modules
   rm pnpm-lock.yaml
   pnpm install
   ```

3. **Check Node.js version**:
   ```bash
   node --version
   # Should be v18+ or v20+
   ```

---

## Backend Issues

### Issue 1: Backend Crashes on Startup

**Symptoms**:
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module
```

**Solution**:

1. **Use dev mode** (not production build):
   ```bash
   cd backend
   npm run dev
   # NOT: npm start (requires build)
   ```

2. **Check .js extensions** in imports:
   ```typescript
   // ✅ CORRECT - ESM requires .js extension
   import { foo } from './bar.js';

   // ❌ WRONG - missing extension
   import { foo } from './bar';
   ```

3. **Verify package.json** has type module:
   ```json
   {
     "type": "module"
   }
   ```

---

### Issue 2: Redis Connection Failed

**Symptoms**:
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solution**:

1. **Start Redis** (required for queue):
   ```bash
   # Option 1: Docker
   docker run -d -p 6379:6379 redis:alpine

   # Option 2: System Redis
   sudo service redis-server start
   ```

2. **Verify Redis is running**:
   ```bash
   redis-cli ping
   # Should output: PONG
   ```

3. **Check Redis connection** in backend logs:
   ```bash
   # Should see:
   [Queue Service] Initialized successfully
   ```

---

## API Connection Issues

### Issue 1: CORS "Not allowed by CORS" Error

**Symptoms**:
```
Access to fetch at 'http://localhost:3001/api/...' from origin 'http://localhost:5175'
has been blocked by CORS policy
```

**Root Cause**: Frontend port not in backend's allowed origins list.

**Solution**:

1. **Check backend CORS config** (`backend/src/index.ts`):
   ```typescript
   const allowedOrigins = [
     'http://localhost:5173',
     'http://localhost:5174',
     'http://localhost:5175',
     'http://localhost:5176',
     process.env['FRONTEND_URL']
   ].filter(Boolean);
   ```

2. **Add your port** if missing, then restart backend:
   ```bash
   pkill -f "tsx.*src/index.ts"
   npm run dev
   ```

3. **Use Vite proxy** (preferred solution - no CORS needed):
   - Use relative paths: `/api/...`
   - Vite handles proxy to backend automatically

**Note**: The CORS error in logs is often harmless if using Vite proxy correctly. The proxy makes backend requests appear to come from same origin.

---

### Issue 2: 404 on API Endpoints

**Symptoms**:
```
POST http://localhost:3001/api/generate/enhanced 404 (Not Found)
```

**Solution**:

1. **Verify backend is running**:
   ```bash
   curl http://localhost:3001/health
   # Should return: {"status":"healthy",...}
   ```

2. **Check route registration** in `backend/src/index.ts`:
   ```typescript
   app.use('/api', generateRouter);
   app.use('/api/library-animations', libraryAnimationsRouter);
   app.use('/api/deployment', deploymentRouter);
   ```

3. **Check route file** exports:
   ```typescript
   // In generate.routes.ts:
   export { router as generateRouter };
   ```

---

## Socket.IO Issues

### Issue 1: "handleUpgrade() called more than once" Crash

**Symptoms**:
```
Error: server.handleUpgrade() was called more than once with the same socket,
possibly due to a misconfiguration
```

**Root Cause**: Multiple Socket.IO servers created on same HTTP server.

**Solution**: ✅ **FIXED** (2025-10-04) - Now uses single server with namespaces.

**Verification**:
```bash
# Backend logs should show:
[Socket.IO] Initialized with namespaces: /combat, /deployment
```

**Architecture**:
```typescript
// backend/src/sockets/index.ts
const io = new SocketIOServer(httpServer);
const combatNamespace = io.of('/combat');
const deploymentNamespace = io.of('/deployment');
```

**If you see the error**:
1. Check `backend/src/sockets/index.ts` exists
2. Verify only ONE `new SocketIOServer()` call in entire codebase:
   ```bash
   grep -r "new SocketIOServer" backend/src/
   # Should only appear in backend/src/sockets/index.ts
   ```

---

### Issue 2: "Match not found" Error on Socket Join

**Symptoms**:
```
[Deployment Socket] Match abc123 not found
Error: Must join match first
```

**Root Cause**: Frontend tried to join a match that was never created.

**Solution**: ✅ **FIXED** (2025-10-04) - Matches now auto-create on first player join.

**How It Works**:
```typescript
// backend/src/sockets/deployment-socket.ts (lines 94-100)
let matchState = matchStateService.getMatchState(matchId);
if (!matchState) {
  console.log(`[Deployment Socket] Match ${matchId} not found, creating new match...`);
  matchState = matchStateService.createMatch(matchId, 1);
  console.log(`[Deployment Socket] Match ${matchId} created successfully`);
}
```

**Match Lifecycle**:
1. Player 1 joins via `deployment:join` event → Match auto-created
2. Player 2 joins same matchId → Match already exists
3. Both players sync placement state in real-time
4. No REST API pre-creation required

**Verification**:
```bash
# Backend logs should show:
[Deployment Socket] player1 joining match abc123
[Deployment Socket] Match abc123 not found, creating new match...
[Deployment Socket] Match abc123 created successfully
```

**Old Flow (Before Fix)**:
- Required calling `POST /api/deployment/:matchId/create` before Socket.IO join
- If skipped, join would fail with "Match not found"

**New Flow (After Fix)**:
- Simply join via Socket.IO - match created automatically
- REST API endpoint still works but is optional

---

### Issue 3: Socket Connection Timeout

**Symptoms**:
```
Socket.IO connection timeout
WebSocket connection failed
```

**Solution**:

1. **Check backend Socket.IO initialization**:
   ```bash
   # Backend logs should show:
   [Startup] Initializing Socket.IO server...
   [Deployment Socket] Initialized
   ```

2. **Verify frontend connects to namespace**:
   ```typescript
   // frontend/src/services/deployment-socket.ts
   const socket = io('/deployment', {
     transports: ['websocket', 'polling'],
     autoConnect: false,
   });
   ```

3. **Check Vite proxy** includes Socket.IO:
   ```typescript
   // vite.config.ts
   proxy: {
     '/socket.io': {
       target: 'ws://localhost:3001',
       ws: true,
     },
   }
   ```

---

## Generation Pipeline Issues

### Issue 1: Generation Stuck at "Processing..."

**Symptoms**:
- Job submitted successfully
- Progress stuck at certain percentage
- No error message

**Solution**:

1. **Check backend logs**:
   ```bash
   tail -f /tmp/backend-restart.log
   # Or check console where npm run dev is running
   ```

2. **Common stuck points**:
   - **20%**: PixelLab API issue (check API key)
   - **40%**: Claude Vision analysis (check Claude API key)
   - **60%**: Animation generation (check PixelLab again)

3. **Verify environment variables**:
   ```bash
   # In backend/.env:
   CLAUDE_API_KEY=sk-ant-...
   PIXELLAB_API_KEY=...
   ```

4. **Check job status directly**:
   ```bash
   curl http://localhost:3001/api/generate/{jobId}
   ```

---

### Issue 2: Effect Frames Not Loading

**Symptoms**:
- Combat attributes display but no animations
- Console shows "Failed to load effect frames"

**Solution**:

1. **Verify library animations exist**:
   ```bash
   ls -1 assets/library-animations/ | wc -l
   # Should output: 55
   ```

2. **Check specific animation directory**:
   ```bash
   ls assets/library-animations/breathe_fire/
   # Should show: base-sprite.png, frame-0.png, frame-1.png, ...
   ```

3. **Regenerate if missing**:
   ```bash
   cd backend
   npx tsx src/scripts/generate-library-animations.ts
   ```

---

### Issue 3: Generation Fails with PixelLab Error

**Symptoms**:
```
[Generation Processor] PixelLab error: Invalid API key
```

**Solution**:

1. **Check API key** in `backend/.env`:
   ```bash
   cat backend/.env | grep PIXELLAB
   ```

2. **Verify key is valid**:
   ```bash
   # Test PixelLab API directly
   curl -H "Authorization: Bearer YOUR_KEY" https://api.pixellab.ai/health
   ```

3. **Use test mode** (if no key):
   ```typescript
   // Returns mock data instead of calling API
   const spriteGenerator = new SpriteGenerator(client, { testMode: true });
   ```

---

## Development Environment

### Issue 1: Port Already in Use

**Symptoms**:
```
Error: listen EADDRINUSE: address already in use :::3001
```

**Solution**:

1. **Find process using port**:
   ```bash
   lsof -ti:3001
   ```

2. **Kill the process**:
   ```bash
   kill $(lsof -ti:3001)
   # Or:
   pkill -f "tsx.*src/index.ts"
   ```

3. **Restart server**:
   ```bash
   npm run dev
   ```

---

### Issue 2: TypeScript Compilation Errors

**Symptoms**:
```
error TS2307: Cannot find module '...' or its corresponding type declarations
```

**Solution**:

1. **Install missing types**:
   ```bash
   npm install --save-dev @types/node @types/express
   ```

2. **Check tsconfig.json** includes src:
   ```json
   {
     "include": ["src/**/*"],
     "compilerOptions": {
       "moduleResolution": "node"
     }
   }
   ```

3. **Use .js extensions** in imports (ESM requirement):
   ```typescript
   import { foo } from './bar.js';  // ✅
   ```

---

### Issue 3: Workspace Dependencies Not Found

**Symptoms**:
```
Cannot find module '@drawn-of-war/shared'
```

**Solution**:

1. **Install from workspace root**:
   ```bash
   cd /mnt/c/Users/mhast/Desktop/drawnofwar6
   pnpm install
   ```

2. **Verify workspace** in root `package.json`:
   ```json
   {
     "workspaces": [
       "frontend",
       "backend",
       "shared"
     ]
   }
   ```

3. **Check shared package.json** has correct name:
   ```json
   {
     "name": "@drawn-of-war/shared"
   }
   ```

---

## Quick Diagnostics

### Backend Health Check
```bash
# Should return status: healthy
curl http://localhost:3001/health
```

### Frontend Health Check
```bash
# Should show Vite page
curl http://localhost:5175
```

### Redis Health Check
```bash
# Should return PONG
redis-cli ping
```

### Full System Restart
```bash
# Kill all processes
pkill -f "tsx.*src/index.ts"
pkill -f "vite"
docker stop $(docker ps -q)

# Restart Redis
docker run -d -p 6379:6379 redis:alpine

# Restart Backend
cd backend
npm run dev

# Restart Frontend (new terminal)
cd frontend
pnpm run dev
```

---

## Getting Help

If issues persist:

1. **Check logs**:
   - Backend: Console where `npm run dev` is running
   - Frontend: Browser console (F12)
   - Redis: `docker logs <container-id>`

2. **Enable debug mode**:
   ```bash
   # Backend
   DEBUG=* npm run dev

   # Frontend
   VITE_DEBUG=true pnpm run dev
   ```

3. **Report issue** with:
   - Error message (full stack trace)
   - Steps to reproduce
   - Backend logs
   - Frontend console logs
   - Environment (OS, Node version, etc.)

---

**Status**: All documented issues have verified fixes as of October 4, 2025.
