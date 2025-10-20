# Firebase Storage Emulator Fix

## Problem Summary

The Firebase Storage emulator was not starting even though it was configured in `firebase.json`. This caused creature save operations to fail with:

```
connect ETIMEDOUT 127.0.0.1:9199
```

## Root Cause

The Firebase emulator suite requires both:
1. Configuration in `firebase.json` (which was present)
2. Rules files referenced in the configuration (which were MISSING)

The missing files were:
- `firestore.rules` - Firestore security rules
- `storage.rules` - Storage security rules (THIS WAS THE BLOCKER)
- `firestore.indexes.json` - Firestore indexes configuration

Without the `storage.rules` file, the Storage emulator would not start.

## Files Created/Updated

### 1. Created: `/firestore.rules`
Basic permissive rules for development:
```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

### 2. Created: `/storage.rules`
Basic permissive rules for development:
```
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true;
    }
  }
}
```

### 3. Created: `/firestore.indexes.json`
Empty indexes configuration:
```json
{
  "indexes": [],
  "fieldOverrides": []
}
```

### 4. Updated: `/firebase.json`
Added storage rules reference:
```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "storage": {
    "rules": "storage.rules"  // <-- ADDED THIS
  },
  "emulators": {
    // ... existing config
  }
}
```

### 5. Updated: `/backend/.env`
Fixed formatting of `FIREBASE_STORAGE_BUCKET` (was on wrong line):
```
FIREBASE_STORAGE_BUCKET=drawn-of-war.appspot.com
```

### 6. Created: `/verify-firebase-emulators.js`
Helper script to verify all emulators are running.

## How to Fix

### Step 1: Stop Current Emulator (if running)
Press `Ctrl+C` in the terminal where Firebase emulator is running.

### Step 2: Restart Firebase Emulator
```bash
firebase emulators:start
```

### Step 3: Verify All Emulators Started
You should see:
```
┌─────────────────────────────────────────────────────────────┐
│ ✔  All emulators ready! It is now safe to connect your app. │
│ i  View Emulator UI at http://127.0.0.1:4000                │
└─────────────────────────────────────────────────────────────┘

┌────────────┬────────────────┬─────────────────────────────────┐
│ Emulator   │ Host:Port      │ View in Emulator UI             │
├────────────┼────────────────┼─────────────────────────────────┤
│ Auth       │ 127.0.0.1:9099 │ http://127.0.0.1:4000/auth      │
│ Firestore  │ 127.0.0.1:8080 │ http://127.0.0.1:4000/firestore │
│ Storage    │ 127.0.0.1:9199 │ http://127.0.0.1:4000/storage   │  <-- THIS MUST BE PRESENT
└────────────┴────────────────┴─────────────────────────────────┘
```

**CRITICAL:** Verify that the Storage row is present!

### Step 4: Run Verification Script (Optional)
```bash
node verify-firebase-emulators.js
```

Expected output:
```
✅ Firestore emulator is running on port 8080
✅ Storage emulator is running on port 9199
✅ UI emulator is running on port 4000

==================================================
✅ All emulators are running correctly!

You can now:
  - Access UI at: http://localhost:4000
  - Save creatures (Storage uploads will work)
```

### Step 5: Test Creature Save
1. Start backend (if not already running):
   ```bash
   cd backend
   npm run dev
   ```

2. Start frontend (if not already running):
   ```bash
   cd frontend
   npm run dev
   ```

3. Generate a creature and click "Save Creature"

4. Should now succeed without timeout errors!

## Backend Configuration (Already Correct)

The backend was already properly configured in `/backend/src/config/firebase.config.ts`:

```typescript
if (USE_FIREBASE_EMULATOR) {
  admin.initializeApp({
    projectId: FIREBASE_PROJECT_ID,
    storageBucket: FIREBASE_STORAGE_BUCKET
  });

  // Configure emulator hosts
  process.env['FIRESTORE_EMULATOR_HOST'] = 'localhost:8080';
  process.env['FIREBASE_STORAGE_EMULATOR_HOST'] = 'localhost:9199';
}
```

The `.env` file was also correct:
```
USE_FIREBASE_EMULATOR=true
FIREBASE_STORAGE_BUCKET=drawn-of-war.appspot.com
```

## What Was Wrong

1. ✅ `firebase.json` had emulator config → CORRECT
2. ✅ Backend had emulator connection logic → CORRECT
3. ✅ `.env` had `USE_FIREBASE_EMULATOR=true` → CORRECT
4. ❌ `storage.rules` file was MISSING → **THIS WAS THE PROBLEM**

The Firebase CLI would silently skip starting the Storage emulator if it couldn't find the rules file referenced in `firebase.json`.

## Security Note

The current rules allow ALL reads/writes for development convenience:

```
allow read, write: if true;
```

⚠️ **Before deploying to production**, these rules MUST be updated to:
- Authenticate users
- Restrict access based on ownership
- Validate file types and sizes
- Prevent unauthorized access

## Testing Checklist

After restarting Firebase emulator, verify:

- [ ] Storage emulator appears in startup output (port 9199)
- [ ] Can access UI at http://localhost:4000
- [ ] Can see Storage tab in UI
- [ ] Backend starts without errors
- [ ] Can generate a creature
- [ ] Can save creature (no timeout errors)
- [ ] Saved creature appears in Firestore
- [ ] Creature sprites appear in Storage UI

## Troubleshooting

### If Storage emulator still doesn't start:

1. **Check Firebase CLI version:**
   ```bash
   firebase --version
   ```
   Should be >= 11.0.0

2. **Check for port conflicts:**
   ```bash
   lsof -i :9199  # macOS/Linux
   netstat -ano | findstr :9199  # Windows
   ```

3. **Check firebase-debug.log:**
   Look for errors related to Storage emulator initialization.

4. **Verify files exist:**
   ```bash
   ls -la firestore.rules storage.rules firestore.indexes.json
   ```

5. **Try explicit emulator selection:**
   ```bash
   firebase emulators:start --only firestore,storage
   ```

### If creature save still fails:

1. Check backend logs for Firebase initialization:
   ```
   [Firebase] Initializing with emulator configuration
   [Firebase] Using Firestore emulator at localhost:8080
   [Firebase] Using Storage emulator at localhost:9199
   [Firebase] Initialized successfully
   ```

2. Verify storage service is using emulator:
   ```bash
   # In backend logs, look for:
   [CreatureSaveService] Uploading sprites for creature...
   ```

3. Check for connection errors in frontend browser console

## Success Criteria

✅ Firebase emulator shows Storage on port 9199
✅ Backend connects to Storage emulator
✅ Creature save completes without timeout
✅ Sprites appear in Storage emulator UI
✅ Creature document has sprite URLs in Firestore

## Next Steps

Once this is working:
1. Test full creature save flow
2. Verify sprite URLs are accessible
3. Test creature loading from Firestore
4. Implement proper security rules for production
