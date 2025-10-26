/**
 * Firebase Admin SDK Configuration
 *
 * Initializes Firebase Admin SDK with credentials from environment variables.
 * Supports both production (service account) and development (emulator) modes.
 */

import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

// Environment variables
const FIREBASE_PROJECT_ID = process.env['FIREBASE_PROJECT_ID'];
const FIREBASE_PRIVATE_KEY = process.env['FIREBASE_PRIVATE_KEY'];
const FIREBASE_CLIENT_EMAIL = process.env['FIREBASE_CLIENT_EMAIL'];
const FIREBASE_DATABASE_URL = process.env['FIREBASE_DATABASE_URL'];
const USE_FIREBASE_EMULATOR = process.env['USE_FIREBASE_EMULATOR'] === 'true';
const FIREBASE_STORAGE_BUCKET = process.env['FIREBASE_STORAGE_BUCKET'] || `${FIREBASE_PROJECT_ID}.appspot.com`;

// Validate required configuration
function validateFirebaseConfig(): void {
  if (!FIREBASE_PROJECT_ID) {
    throw new Error('FIREBASE_PROJECT_ID environment variable is required');
  }

  // In production, require full credentials
  if (!USE_FIREBASE_EMULATOR) {
    if (!FIREBASE_PRIVATE_KEY) {
      throw new Error('FIREBASE_PRIVATE_KEY is required when not using emulator');
    }
    if (!FIREBASE_CLIENT_EMAIL) {
      throw new Error('FIREBASE_CLIENT_EMAIL is required when not using emulator');
    }
  }
}

// Initialize Firebase Admin SDK
let isInitialized = false;

export function initializeFirebase(): void {
  // Check if already initialized (Firebase Admin SDK tracks this globally)
  try {
    admin.app();
    console.warn('[Firebase] Already initialized, skipping...');
    isInitialized = true;
    return;
  } catch (error) {
    // Not initialized yet, continue
  }

  validateFirebaseConfig();

  // Initialize based on environment
  if (USE_FIREBASE_EMULATOR) {
    console.log('[Firebase] Initializing with emulator configuration');

    admin.initializeApp({
      projectId: FIREBASE_PROJECT_ID,
      storageBucket: FIREBASE_STORAGE_BUCKET
    });

    // Configure emulator hosts
    process.env['FIRESTORE_EMULATOR_HOST'] = 'localhost:8080';
    process.env['FIREBASE_STORAGE_EMULATOR_HOST'] = 'localhost:9199';

    console.log('[Firebase] Using Firestore emulator at localhost:8080');
    console.log('[Firebase] Using Storage emulator at localhost:9199');
  } else {
    console.log('[Firebase] Initializing with service account credentials');

    // Parse private key (handle escaped newlines from .env)
    const privateKey = FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n');

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: FIREBASE_PROJECT_ID,
        privateKey,
        clientEmail: FIREBASE_CLIENT_EMAIL
      }),
      databaseURL: FIREBASE_DATABASE_URL,
      storageBucket: FIREBASE_STORAGE_BUCKET
    });
  }

  isInitialized = true;
  console.log('[Firebase] Initialized successfully');
}

// Get Firestore instance
export function getFirestore(): admin.firestore.Firestore {
  if (!isInitialized) {
    throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  }
  return admin.firestore();
}

// Get Storage instance
export function getStorage(): admin.storage.Storage {
  if (!isInitialized) {
    throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  }
  return admin.storage();
}

// Get Storage bucket
export function getStorageBucket() {
  return getStorage().bucket();
}

// Export admin for direct access if needed
export { admin };

// Health check function
export async function checkFirebaseConnection(): Promise<boolean> {
  try {
    const firestore = getFirestore();

    // Try to read from a test collection
    const testDoc = await firestore.collection('_health_check').doc('test').get();

    console.log('[Firebase] Connection check passed');
    return true;
  } catch (error) {
    console.error('[Firebase] Connection check failed:', error);
    return false;
  }
}
