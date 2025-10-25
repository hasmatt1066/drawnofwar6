/**
 * Auth Middleware Tests
 *
 * TDD: Tests written first following L4-AUTH-001 specification
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../auth.middleware';
import { admin } from '../../config/firebase.config';

// Mock Firebase Admin
const mockVerifyIdToken = vi.fn();

vi.mock('../../config/firebase.config', () => ({
  admin: {
    auth: () => ({
      verifyIdToken: mockVerifyIdToken
    })
  }
}));

describe('authenticate middleware', () => {
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {}
    };
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };
    mockNext = vi.fn();

    // Reset mocks
    vi.clearAllMocks();
  });

  describe('Valid Token', () => {
    it('should verify valid Firebase token and set req.user', async () => {
      // Arrange
      const validToken = 'valid-firebase-token';
      mockRequest.headers = {
        authorization: `Bearer ${validToken}`
      };

      const mockDecodedToken = {
        uid: 'firebase-user-123',
        email: 'test@example.com',
        name: 'Test User'
      };

      mockVerifyIdToken.mockResolvedValue(mockDecodedToken as any);

      // Act
      await authenticate(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockVerifyIdToken).toHaveBeenCalledWith(validToken);
      expect(mockRequest.user).toEqual({
        uid: 'firebase-user-123',
        email: 'test@example.com',
        displayName: 'Test User'
      });
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });

  describe('Invalid Token', () => {
    it('should reject invalid token with 401', async () => {
      // Arrange
      mockRequest.headers = {
        authorization: 'Bearer invalid-token'
      };

      mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'));

      // Act
      await authenticate(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid auth token'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject malformed token with 401', async () => {
      // Arrange
      mockRequest.headers = {
        authorization: 'InvalidFormat token'
      };

      // Act
      await authenticate(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'No auth token provided'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Missing Token', () => {
    it('should reject request with no Authorization header', async () => {
      // Arrange
      mockRequest.headers = {};

      // Act
      await authenticate(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'No auth token provided'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with empty Bearer token', async () => {
      // Arrange
      mockRequest.headers = {
        authorization: 'Bearer '
      };

      // Act
      await authenticate(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'No auth token provided'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Demo Accounts (Testing)', () => {
    it('should allow demo-player1 without Firebase verification', async () => {
      // Arrange
      mockRequest.headers = {
        authorization: 'Bearer demo-player1'
      };

      // Act
      await authenticate(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockVerifyIdToken).not.toHaveBeenCalled();
      expect(mockRequest.user).toEqual({
        uid: 'demo-player1',
        email: 'demo-player1@demo.local',
        displayName: 'Demo Player 1'
      });
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should allow demo-player2 without Firebase verification', async () => {
      // Arrange
      mockRequest.headers = {
        authorization: 'Bearer demo-player2'
      };

      // Act
      await authenticate(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockVerifyIdToken).not.toHaveBeenCalled();
      expect(mockRequest.user).toEqual({
        uid: 'demo-player2',
        email: 'demo-player2@demo.local',
        displayName: 'Demo Player 2'
      });
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle Firebase SDK errors gracefully', async () => {
      // Arrange
      mockRequest.headers = {
        authorization: 'Bearer firebase-token'
      };

      mockVerifyIdToken.mockRejectedValue(new Error('Firebase service unavailable'));

      // Act
      await authenticate(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid auth token'
      });
    });

    it('should handle undefined displayName from Firebase', async () => {
      // Arrange
      mockRequest.headers = {
        authorization: 'Bearer valid-token'
      };

      const mockDecodedToken = {
        uid: 'user-123',
        email: 'test@example.com',
        name: undefined // No display name
      };

      mockVerifyIdToken.mockResolvedValue(mockDecodedToken as any);

      // Act
      await authenticate(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockRequest.user).toEqual({
        uid: 'user-123',
        email: 'test@example.com',
        displayName: undefined
      });
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
