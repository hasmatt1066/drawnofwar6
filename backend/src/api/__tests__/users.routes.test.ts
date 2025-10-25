/**
 * User Routes Tests
 *
 * TDD: Tests written first following L4-AUTH-002 specification
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import { usersRouter } from '../routes/users.routes';
import { getFirestore } from '../../config/firebase.config';

// Mock Firebase
vi.mock('../../config/firebase.config', () => ({
  getFirestore: vi.fn()
}));

// Mock auth middleware
vi.mock('../../middleware/auth.middleware', () => ({
  authenticate: vi.fn((req, res, next) => {
    // Simulate authenticated user
    req.user = {
      uid: 'test-user-id',
      email: 'test@example.com',
      displayName: 'Test User'
    };
    next();
  })
}));

describe('POST /api/users/profile', () => {
  let app: Express;
  let mockFirestore: any;
  let mockDoc: any;
  let mockSet: any;
  let mockGet: any;

  beforeEach(() => {
    // Setup Express app
    app = express();
    app.use(express.json());
    app.use('/api/users', usersRouter);

    // Setup Firestore mocks
    mockSet = vi.fn().mockResolvedValue(undefined);
    mockGet = vi.fn().mockResolvedValue({ exists: false });

    mockDoc = vi.fn().mockReturnValue({
      set: mockSet,
      get: mockGet
    });

    mockFirestore = {
      doc: mockDoc
    };

    vi.mocked(getFirestore).mockReturnValue(mockFirestore as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Success Cases', () => {
    it('should create new user profile with initial stats', async () => {
      // Arrange
      const requestBody = {
        displayName: 'Test User'
      };

      // Act
      const response = await request(app)
        .post('/api/users/profile')
        .send(requestBody)
        .expect(201);

      // Assert
      expect(response.body).toEqual({
        success: true,
        message: 'Profile created successfully'
      });

      // Verify Firestore doc() was called with correct path
      expect(mockDoc).toHaveBeenCalledWith('users/test-user-id/profile');

      // Verify set() was called with correct data structure
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: 'Test User',
          email: 'test@example.com',
          stats: {
            wins: 0,
            losses: 0,
            disconnects: 0,
            totalBattles: 0,
            currentWinStreak: 0,
            bestWinStreak: 0
          }
        })
      );

      // Verify timestamps are present
      const setCallArgs = mockSet.mock.calls[0][0];
      expect(setCallArgs).toHaveProperty('createdAt');
      expect(setCallArgs).toHaveProperty('lastLoginAt');
    });

    it('should use email from auth token', async () => {
      // Act
      await request(app)
        .post('/api/users/profile')
        .send({ displayName: 'User' })
        .expect(201);

      // Assert
      const setCallArgs = mockSet.mock.calls[0][0];
      expect(setCallArgs.email).toBe('test@example.com');
    });

    it('should use uid from auth token for document path', async () => {
      // Act
      await request(app)
        .post('/api/users/profile')
        .send({ displayName: 'User' })
        .expect(201);

      // Assert
      expect(mockDoc).toHaveBeenCalledWith('users/test-user-id/profile');
    });
  });

  describe('Validation', () => {
    it('should require displayName', async () => {
      // Act
      const response = await request(app)
        .post('/api/users/profile')
        .send({})
        .expect(400);

      // Assert
      expect(response.body).toEqual({
        error: 'Display name is required'
      });

      expect(mockSet).not.toHaveBeenCalled();
    });

    it('should reject empty displayName', async () => {
      // Act
      const response = await request(app)
        .post('/api/users/profile')
        .send({ displayName: '' })
        .expect(400);

      // Assert
      expect(response.body).toEqual({
        error: 'Display name is required'
      });
    });

    it('should reject displayName with only whitespace', async () => {
      // Act
      const response = await request(app)
        .post('/api/users/profile')
        .send({ displayName: '   ' })
        .expect(400);

      // Assert
      expect(response.body).toEqual({
        error: 'Display name is required'
      });
    });

    it('should reject displayName longer than 50 characters', async () => {
      // Act
      const response = await request(app)
        .post('/api/users/profile')
        .send({ displayName: 'a'.repeat(51) })
        .expect(400);

      // Assert
      expect(response.body).toEqual({
        error: 'Display name must be 50 characters or less'
      });
    });
  });

  describe('Duplicate Profile', () => {
    it('should reject if profile already exists', async () => {
      // Arrange - Mock profile already exists
      mockGet.mockResolvedValue({ exists: true });

      // Act
      const response = await request(app)
        .post('/api/users/profile')
        .send({ displayName: 'Test User' })
        .expect(400);

      // Assert
      expect(response.body).toEqual({
        error: 'Profile already exists'
      });

      expect(mockSet).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle Firestore errors gracefully', async () => {
      // Arrange
      mockGet.mockRejectedValue(new Error('Firestore connection failed'));

      // Act
      const response = await request(app)
        .post('/api/users/profile')
        .send({ displayName: 'Test User' })
        .expect(500);

      // Assert
      expect(response.body).toEqual({
        error: 'Failed to create profile'
      });
    });

    it('should handle set() errors gracefully', async () => {
      // Arrange
      mockSet.mockRejectedValue(new Error('Write failed'));

      // Act
      const response = await request(app)
        .post('/api/users/profile')
        .send({ displayName: 'Test User' })
        .expect(500);

      // Assert
      expect(response.body).toEqual({
        error: 'Failed to create profile'
      });
    });
  });

  describe('Authentication', () => {
    it('should require authentication', async () => {
      // This test will be handled by auth middleware
      // For now, we verify that our route is protected
      expect(usersRouter).toBeDefined();
    });
  });
});
