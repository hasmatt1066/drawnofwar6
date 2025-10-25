/**
 * Firebase Configuration
 *
 * Initializes Firebase SDK with environment configuration.
 * Implementation follows L4-AUTH-003 specification.
 */

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';

/**
 * Required Firebase configuration keys
 */
const REQUIRED_CONFIG_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID'
] as const;

/**
 * Validate that all required environment variables are present
 */
function validateFirebaseConfig(): void {
  const missing = REQUIRED_CONFIG_KEYS.filter(
    key => !import.meta.env[key]
  );

  if (missing.length > 0) {
    console.warn(
      `⚠️  Missing Firebase config: ${missing.join(', ')}\n` +
      `Firebase authentication will not work. Use Demo Login instead, or set up Firebase credentials in .env.local`
    );
    // Don't throw - allow app to run in demo mode
  }
}

/**
 * Get Firebase configuration from environment variables
 */
function getFirebaseConfig() {
  validateFirebaseConfig();

  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
  };
}

/**
 * Initialize Firebase app
 */
let app: FirebaseApp;
let auth: Auth;

try {
  const config = getFirebaseConfig();

  // Check if we have minimal required config
  if (config.apiKey && config.projectId && config.appId) {
    app = initializeApp(config);
    auth = getAuth(app);

    /**
     * Connect to Firebase Auth emulator in development mode
     */
    if (
      import.meta.env.VITE_ENV === 'development' &&
      import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true'
    ) {
      console.log('[Firebase] Connecting to Auth emulator at http://localhost:9099');
      connectAuthEmulator(auth, 'http://localhost:9099', {
        disableWarnings: true
      });
    }

    console.log('[Firebase] Initialized successfully');
  } else {
    // Create dummy instances for demo mode
    console.warn('[Firebase] Running in DEMO MODE - Firebase is not configured');
    app = {} as FirebaseApp;
    auth = {} as Auth;
  }
} catch (error) {
  console.error('[Firebase] Initialization failed:', error);
  // Create dummy instances for demo mode
  app = {} as FirebaseApp;
  auth = {} as Auth;
}

export { app, auth };
