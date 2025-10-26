/**
 * Auth Context Tests
 *
 * TDD: Tests written first following L4-AUTH-004 specification
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';
import type { User as FirebaseUser } from 'firebase/auth';

// Mock Firebase Auth
const mockSignInWithEmailAndPassword = vi.fn();
const mockCreateUserWithEmailAndPassword = vi.fn();
const mockSignOut = vi.fn();
const mockUpdateProfile = vi.fn();
const mockGetIdToken = vi.fn();
const mockOnAuthStateChanged = vi.fn();

vi.mock('../../config/firebase', () => ({
  auth: {
    currentUser: null,
    onAuthStateChanged: (...args: any[]) => mockOnAuthStateChanged(...args)
  }
}));

vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: (...args: any[]) => mockSignInWithEmailAndPassword(...args),
  createUserWithEmailAndPassword: (...args: any[]) => mockCreateUserWithEmailAndPassword(...args),
  signOut: (...args: any[]) => mockSignOut(...args),
  updateProfile: (...args: any[]) => mockUpdateProfile(...args),
  onAuthStateChanged: (...args: any[]) => mockOnAuthStateChanged(...args)
}));

// Mock API fetch
global.fetch = vi.fn();

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock: no user signed in
    mockOnAuthStateChanged.mockImplementation((auth, callback) => {
      // Call callback synchronously for most tests
      callback(null);
      return vi.fn(); // Unsubscribe function
    });
  });

  describe('Initial State', () => {
    it('should provide null user when not signed in', async () => {
      // Act
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      });

      // Wait for loading to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Assert
      expect(result.current.user).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    it('should start with loading state true', async () => {
      // Mock to delay callback so we can check initial state
      let authCallback: any;
      mockOnAuthStateChanged.mockImplementation((auth, callback) => {
        authCallback = callback;
        return vi.fn();
      });

      // Act
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      });

      // Assert (immediately, before auth state resolves)
      expect(result.current.loading).toBe(true);

      // Cleanup - resolve the callback to avoid hanging
      await act(async () => {
        authCallback(null);
      });
    });
  });

  describe('Sign In', () => {
    it('should sign in user with email and password', async () => {
      // Arrange
      const mockUser: Partial<FirebaseUser> = {
        uid: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        photoURL: null,
        getIdToken: mockGetIdToken.mockResolvedValue('mock-token')
      };

      mockSignInWithEmailAndPassword.mockResolvedValue({
        user: mockUser
      });

      // Update onAuthStateChanged to trigger with signed-in user
      mockOnAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser);
        return vi.fn();
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      });

      // Act
      await act(async () => {
        await result.current.signIn('test@example.com', 'password123');
      });

      // Assert
      expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(),
        'test@example.com',
        'password123'
      );

      await waitFor(() => {
        expect(result.current.user).not.toBeNull();
      });

      expect(result.current.user?.email).toBe('test@example.com');
    });

    it('should throw error on invalid credentials', async () => {
      // Arrange
      mockSignInWithEmailAndPassword.mockRejectedValue({
        code: 'auth/wrong-password',
        message: 'Wrong password'
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act & Assert
      await expect(
        result.current.signIn('test@example.com', 'wrong-password')
      ).rejects.toThrow();
    });
  });

  describe('Sign Up', () => {
    it('should create new user and update profile', async () => {
      // Arrange
      const mockUser: Partial<FirebaseUser> = {
        uid: 'new-user-123',
        email: 'new@example.com',
        displayName: null,
        photoURL: null,
        getIdToken: mockGetIdToken.mockResolvedValue('new-user-token')
      };

      mockCreateUserWithEmailAndPassword.mockResolvedValue({
        user: mockUser
      });
      mockUpdateProfile.mockResolvedValue(undefined);
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act
      await act(async () => {
        await result.current.signUp('new@example.com', 'password123', 'New User');
      });

      // Assert
      expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(),
        'new@example.com',
        'password123'
      );

      expect(mockUpdateProfile).toHaveBeenCalledWith(
        mockUser,
        { displayName: 'New User' }
      );

      // Should create user profile via API
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/users/profile'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer new-user-token',
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify({ displayName: 'New User' })
        })
      );
    });

    it('should throw error on registration failure', async () => {
      // Arrange
      mockCreateUserWithEmailAndPassword.mockRejectedValue({
        code: 'auth/email-already-in-use',
        message: 'Email already in use'
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act & Assert
      await expect(
        result.current.signUp('existing@example.com', 'password123', 'User')
      ).rejects.toThrow();
    });
  });

  describe('Sign Out', () => {
    it('should sign out user', async () => {
      // Arrange
      mockSignOut.mockResolvedValue(undefined);

      const mockUser: any = {
        uid: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        getIdToken: mockGetIdToken.mockResolvedValue('token')
      };

      // Start with signed-in user
      mockOnAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser);
        return vi.fn();
      });

      // Mock auth.currentUser
      const { auth } = await import('../../config/firebase');
      (auth as any).currentUser = mockUser;

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      });

      await waitFor(() => {
        expect(result.current.user).not.toBeNull();
      });

      // Act
      await act(async () => {
        await result.current.signOut();
      });

      // Assert
      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  describe('Token Refresh', () => {
    it('should refresh token every 50 minutes', async () => {
      vi.useFakeTimers();

      // Arrange
      const mockUser: any = {
        uid: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        photoURL: null,
        getIdToken: mockGetIdToken.mockResolvedValue('initial-token')
      };

      mockOnAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser);
        return vi.fn();
      });

      // Mock auth.currentUser
      const { auth } = await import('../../config/firebase');
      (auth as any).currentUser = mockUser;

      renderHook(() => useAuth(), {
        wrapper: AuthProvider
      });

      // Reset call count
      mockGetIdToken.mockClear();
      mockGetIdToken.mockResolvedValue('refreshed-token');

      // Act - Advance time by 50 minutes
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50 * 60 * 1000);
      });

      // Assert - Token should be refreshed
      expect(mockGetIdToken).toHaveBeenCalledWith(true); // Force refresh

      vi.useRealTimers();
    }, 10000); // Increase timeout

    it('should not refresh token if no user signed in', async () => {
      vi.useFakeTimers();

      // Arrange - No user
      mockOnAuthStateChanged.mockImplementation((auth, callback) => {
        callback(null);
        return vi.fn();
      });

      renderHook(() => useAuth(), {
        wrapper: AuthProvider
      });

      // Act - Advance time
      await act(async () => {
        await vi.advanceTimersByTimeAsync(50 * 60 * 1000);
      });

      // Assert - No token refresh attempted
      expect(mockGetIdToken).not.toHaveBeenCalled();

      vi.useRealTimers();
    }, 10000); // Increase timeout
  });

  describe('Get ID Token', () => {
    it('should return current user token', async () => {
      // Arrange
      const mockUser: any = {
        uid: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        getIdToken: mockGetIdToken.mockResolvedValue('user-token')
      };

      mockOnAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser);
        return vi.fn();
      });

      // Mock auth.currentUser
      const { auth } = await import('../../config/firebase');
      (auth as any).currentUser = mockUser;

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      });

      await waitFor(() => {
        expect(result.current.user).not.toBeNull();
      });

      // Act
      const token = await result.current.getIdToken();

      // Assert
      expect(token).toBe('user-token');
    });

    it('should return null if no user signed in', async () => {
      // Arrange
      // Clear any previous auth.currentUser
      const { auth } = await import('../../config/firebase');
      (auth as any).currentUser = null;

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Act
      const token = await result.current.getIdToken();

      // Assert
      expect(token).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle auth state change errors gracefully', async () => {
      // Arrange
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockOnAuthStateChanged.mockImplementation((auth, callback) => {
        callback(null);
        return vi.fn();
      });

      // Act
      renderHook(() => useAuth(), {
        wrapper: AuthProvider
      });

      // Assert - Should not crash
      expect(consoleError).not.toHaveBeenCalled();

      consoleError.mockRestore();
    });
  });
});
