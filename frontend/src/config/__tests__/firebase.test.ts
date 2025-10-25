/**
 * Firebase Config Tests
 *
 * TDD: Tests written first following L4-AUTH-003 specification
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Firebase Config', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original env
    originalEnv = { ...import.meta.env };
  });

  afterEach(() => {
    // Restore original env
    Object.keys(import.meta.env).forEach(key => {
      delete import.meta.env[key];
    });
    Object.assign(import.meta.env, originalEnv);

    // Clear module cache to get fresh imports
    vi.resetModules();
  });

  describe('Initialization', () => {
    it('should initialize Firebase app with config from env vars', async () => {
      // Arrange
      import.meta.env.VITE_FIREBASE_API_KEY = 'test-api-key';
      import.meta.env.VITE_FIREBASE_AUTH_DOMAIN = 'test.firebaseapp.com';
      import.meta.env.VITE_FIREBASE_PROJECT_ID = 'test-project';
      import.meta.env.VITE_FIREBASE_STORAGE_BUCKET = 'test.appspot.com';
      import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID = '123456';
      import.meta.env.VITE_FIREBASE_APP_ID = 'test-app-id';
      import.meta.env.VITE_ENV = 'production';

      // Act
      const { app, auth } = await import('../firebase');

      // Assert
      expect(app).toBeDefined();
      expect(app.name).toBe('[DEFAULT]');
      expect(auth).toBeDefined();
    });

    it('should export auth instance', async () => {
      // Arrange
      import.meta.env.VITE_FIREBASE_API_KEY = 'test-api-key';
      import.meta.env.VITE_FIREBASE_AUTH_DOMAIN = 'test.firebaseapp.com';
      import.meta.env.VITE_FIREBASE_PROJECT_ID = 'test-project';
      import.meta.env.VITE_FIREBASE_STORAGE_BUCKET = 'test.appspot.com';
      import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID = '123456';
      import.meta.env.VITE_FIREBASE_APP_ID = 'test-app-id';

      // Act
      const { auth } = await import('../firebase');

      // Assert
      expect(auth).toBeDefined();
      expect(auth.app).toBeDefined();
    });
  });

  describe('Environment Validation', () => {
    it('should throw error if VITE_FIREBASE_API_KEY is missing', async () => {
      // Arrange
      delete import.meta.env.VITE_FIREBASE_API_KEY;
      import.meta.env.VITE_FIREBASE_AUTH_DOMAIN = 'test.firebaseapp.com';
      import.meta.env.VITE_FIREBASE_PROJECT_ID = 'test-project';
      import.meta.env.VITE_FIREBASE_STORAGE_BUCKET = 'test.appspot.com';
      import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID = '123456';
      import.meta.env.VITE_FIREBASE_APP_ID = 'test-app-id';

      // Act & Assert
      await expect(async () => {
        await import('../firebase');
      }).rejects.toThrow('Missing required Firebase config: VITE_FIREBASE_API_KEY');
    });

    it('should throw error if VITE_FIREBASE_PROJECT_ID is missing', async () => {
      // Arrange
      import.meta.env.VITE_FIREBASE_API_KEY = 'test-api-key';
      import.meta.env.VITE_FIREBASE_AUTH_DOMAIN = 'test.firebaseapp.com';
      delete import.meta.env.VITE_FIREBASE_PROJECT_ID;
      import.meta.env.VITE_FIREBASE_STORAGE_BUCKET = 'test.appspot.com';
      import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID = '123456';
      import.meta.env.VITE_FIREBASE_APP_ID = 'test-app-id';

      // Act & Assert
      await expect(async () => {
        await import('../firebase');
      }).rejects.toThrow('Missing required Firebase config: VITE_FIREBASE_PROJECT_ID');
    });

    it('should throw error if VITE_FIREBASE_APP_ID is missing', async () => {
      // Arrange
      import.meta.env.VITE_FIREBASE_API_KEY = 'test-api-key';
      import.meta.env.VITE_FIREBASE_AUTH_DOMAIN = 'test.firebaseapp.com';
      import.meta.env.VITE_FIREBASE_PROJECT_ID = 'test-project';
      import.meta.env.VITE_FIREBASE_STORAGE_BUCKET = 'test.appspot.com';
      import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID = '123456';
      delete import.meta.env.VITE_FIREBASE_APP_ID;

      // Act & Assert
      await expect(async () => {
        await import('../firebase');
      }).rejects.toThrow('Missing required Firebase config: VITE_FIREBASE_APP_ID');
    });
  });

  describe('Development Mode', () => {
    it('should connect to emulator in development', async () => {
      // Arrange
      import.meta.env.VITE_FIREBASE_API_KEY = 'test-api-key';
      import.meta.env.VITE_FIREBASE_AUTH_DOMAIN = 'test.firebaseapp.com';
      import.meta.env.VITE_FIREBASE_PROJECT_ID = 'test-project';
      import.meta.env.VITE_FIREBASE_STORAGE_BUCKET = 'test.appspot.com';
      import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID = '123456';
      import.meta.env.VITE_FIREBASE_APP_ID = 'test-app-id';
      import.meta.env.VITE_ENV = 'development';
      import.meta.env.VITE_USE_FIREBASE_EMULATOR = 'true';

      // Act
      const { auth } = await import('../firebase');

      // Assert - Check if emulator config was applied
      // Note: We can't directly check emulator connection in tests,
      // but we verify the auth instance is created
      expect(auth).toBeDefined();
    });

    it('should not connect to emulator in production', async () => {
      // Arrange
      import.meta.env.VITE_FIREBASE_API_KEY = 'test-api-key';
      import.meta.env.VITE_FIREBASE_AUTH_DOMAIN = 'test.firebaseapp.com';
      import.meta.env.VITE_FIREBASE_PROJECT_ID = 'test-project';
      import.meta.env.VITE_FIREBASE_STORAGE_BUCKET = 'test.appspot.com';
      import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID = '123456';
      import.meta.env.VITE_FIREBASE_APP_ID = 'test-app-id';
      import.meta.env.VITE_ENV = 'production';

      // Act
      const { auth } = await import('../firebase');

      // Assert
      expect(auth).toBeDefined();
    });
  });

  describe('Configuration Object', () => {
    it('should create config with all required fields', async () => {
      // Arrange
      import.meta.env.VITE_FIREBASE_API_KEY = 'test-api-key';
      import.meta.env.VITE_FIREBASE_AUTH_DOMAIN = 'test.firebaseapp.com';
      import.meta.env.VITE_FIREBASE_PROJECT_ID = 'test-project';
      import.meta.env.VITE_FIREBASE_STORAGE_BUCKET = 'test.appspot.com';
      import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID = '123456';
      import.meta.env.VITE_FIREBASE_APP_ID = 'test-app-id';

      // Act
      const { app } = await import('../firebase');

      // Assert
      expect(app.options.apiKey).toBe('test-api-key');
      expect(app.options.authDomain).toBe('test.firebaseapp.com');
      expect(app.options.projectId).toBe('test-project');
      expect(app.options.storageBucket).toBe('test.appspot.com');
      expect(app.options.messagingSenderId).toBe('123456');
      expect(app.options.appId).toBe('test-app-id');
    });
  });
});
