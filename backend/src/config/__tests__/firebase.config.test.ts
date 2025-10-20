/**
 * Firebase Configuration Tests
 *
 * NOTE: Firebase Admin SDK uses global state, so we test initialization
 * and instance getters without resetting the module between tests.
 */

import { describe, it, expect, vi } from 'vitest';
import { initializeFirebase, getFirestore, getStorage, getStorageBucket } from '../firebase.config.js';

describe('Firebase Config', () => {
  describe('Initialization', () => {
    it('should initialize successfully with emulator', () => {
      // Set emulator mode
      process.env['USE_FIREBASE_EMULATOR'] = 'true';
      process.env['FIREBASE_PROJECT_ID'] = 'test-project';

      expect(() => initializeFirebase()).not.toThrow();
    });

    it('should handle multiple initialization calls gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Call again
      initializeFirebase();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Already initialized'));

      consoleSpy.mockRestore();
    });
  });

  describe('Instance Getters', () => {
    it('should return Firestore instance after initialization', () => {
      const firestore = getFirestore();
      expect(firestore).toBeDefined();
      expect(firestore.collection).toBeDefined();
    });

    it('should return Storage instance after initialization', () => {
      const storage = getStorage();
      expect(storage).toBeDefined();
      expect(storage.bucket).toBeDefined();
    });

    it('should return Storage bucket after initialization', () => {
      const bucket = getStorageBucket();
      expect(bucket).toBeDefined();
      expect(bucket.file).toBeDefined();
    });
  });

  describe('Emulator Configuration', () => {
    it('should set Firestore emulator host', () => {
      expect(process.env['FIRESTORE_EMULATOR_HOST']).toBe('localhost:8080');
    });

    it('should set Storage emulator host', () => {
      expect(process.env['FIREBASE_STORAGE_EMULATOR_HOST']).toBe('localhost:9199');
    });
  });
});
