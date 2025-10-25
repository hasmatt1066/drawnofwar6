/**
 * Auth E2E Flow Tests
 *
 * TDD: End-to-end tests for complete authentication flows
 * Implementation follows L4-AUTH-008 specification
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';

// Mock Firebase
const mockCreateUserWithEmailAndPassword = vi.fn();
const mockSignInWithEmailAndPassword = vi.fn();
const mockSignOut = vi.fn();
const mockUpdateProfile = vi.fn();
const mockOnAuthStateChanged = vi.fn();
const mockGetIdToken = vi.fn();

vi.mock('../config/firebase', () => ({
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

// Mock global fetch
global.fetch = vi.fn();

// Test app component
function TestApp() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/home" element={<div>Home Page</div>} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <div>Dashboard Page</div>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <div>Settings Page</div>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

describe('Auth E2E Flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: no user signed in
    mockOnAuthStateChanged.mockImplementation((auth, callback) => {
      callback(null);
      return vi.fn();
    });
  });

  describe('Complete Registration Flow', () => {
    it('should register user, create profile, and redirect to home', async () => {
      // Arrange
      const user = userEvent.setup();
      const mockUser = {
        uid: 'new-user-123',
        email: 'newuser@example.com',
        displayName: 'New User',
        photoURL: null,
        getIdToken: mockGetIdToken.mockResolvedValue('new-token')
      };

      mockCreateUserWithEmailAndPassword.mockResolvedValue({ user: mockUser });
      mockUpdateProfile.mockResolvedValue(undefined);
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      // Simulate auth state change after registration
      let authCallback: any;
      mockOnAuthStateChanged.mockImplementation((auth, callback) => {
        authCallback = callback;
        callback(null); // Start with no user
        return vi.fn();
      });

      render(
        <MemoryRouter initialEntries={['/register']}>
          <AuthProvider>
            <TestApp />
          </AuthProvider>
        </MemoryRouter>
      );

      // Act - Fill registration form
      const nameInput = screen.getByLabelText(/display name|name/i);
      const emailInput = screen.getByLabelText(/^email/i);
      const passwordInput = screen.getByLabelText(/^password/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /sign up|register|create account/i });

      await user.type(nameInput, 'New User');
      await user.type(emailInput, 'newuser@example.com');
      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'password123');
      await user.click(submitButton);

      // Wait for Firebase calls
      await waitFor(() => {
        expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalled();
        expect(mockUpdateProfile).toHaveBeenCalled();
      });

      // Verify profile creation API was called
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/users/profile'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer new-token'
          }),
          body: JSON.stringify({ displayName: 'New User' })
        })
      );

      // Simulate user being signed in
      authCallback(mockUser);

      // Assert - Should redirect to home
      await waitFor(() => {
        expect(screen.getByText('Home Page')).toBeInTheDocument();
      });
    });
  });

  describe('Complete Login Flow', () => {
    it('should login user and redirect to home', async () => {
      // Arrange
      const user = userEvent.setup();
      const mockUser = {
        uid: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        photoURL: null,
        getIdToken: mockGetIdToken.mockResolvedValue('token')
      };

      mockSignInWithEmailAndPassword.mockResolvedValue({ user: mockUser });

      let authCallback: any;
      mockOnAuthStateChanged.mockImplementation((auth, callback) => {
        authCallback = callback;
        callback(null); // Start with no user
        return vi.fn();
      });

      render(
        <MemoryRouter initialEntries={['/login']}>
          <AuthProvider>
            <TestApp />
          </AuthProvider>
        </MemoryRouter>
      );

      // Act - Fill login form
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /log in|sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      // Wait for Firebase call
      await waitFor(() => {
        expect(mockSignInWithEmailAndPassword).toHaveBeenCalled();
      });

      // Simulate user being signed in
      authCallback(mockUser);

      // Assert - Should redirect to home
      await waitFor(() => {
        expect(screen.getByText('Home Page')).toBeInTheDocument();
      });
    });
  });

  describe('Protected Route Access Flow', () => {
    it('should redirect to login when accessing protected route while unauthenticated', async () => {
      // Arrange
      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <AuthProvider>
            <TestApp />
          </AuthProvider>
        </MemoryRouter>
      );

      // Assert - Should redirect to login
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /log in|sign in/i })).toBeInTheDocument();
      });

      expect(screen.queryByText('Dashboard Page')).not.toBeInTheDocument();
    });

    it('should redirect back to protected route after login', async () => {
      // Arrange
      const user = userEvent.setup();
      const mockUser = {
        uid: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        photoURL: null,
        getIdToken: mockGetIdToken.mockResolvedValue('token')
      };

      mockSignInWithEmailAndPassword.mockResolvedValue({ user: mockUser });

      let authCallback: any;
      mockOnAuthStateChanged.mockImplementation((auth, callback) => {
        authCallback = callback;
        callback(null);
        return vi.fn();
      });

      // Start at protected route (should redirect to login with redirect param)
      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <AuthProvider>
            <TestApp />
          </AuthProvider>
        </MemoryRouter>
      );

      // Verify redirected to login
      await waitFor(() => {
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      });

      // Act - Login
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /log in|sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockSignInWithEmailAndPassword).toHaveBeenCalled();
      });

      // Simulate user being signed in
      authCallback(mockUser);

      // Assert - Should redirect back to dashboard
      await waitFor(() => {
        expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
      });
    });

    it('should allow access to protected routes when authenticated', async () => {
      // Arrange - User is already authenticated
      const mockUser = {
        uid: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        photoURL: null,
        getIdToken: mockGetIdToken.mockResolvedValue('token')
      };

      mockOnAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser); // User is signed in
        return vi.fn();
      });

      render(
        <MemoryRouter initialEntries={['/settings']}>
          <AuthProvider>
            <TestApp />
          </AuthProvider>
        </MemoryRouter>
      );

      // Assert - Should render protected content
      await waitFor(() => {
        expect(screen.getByText('Settings Page')).toBeInTheDocument();
      });

      expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
    });
  });

  describe('Logout Flow', () => {
    it('should logout user and redirect to login when accessing protected route', async () => {
      // Arrange - Start with authenticated user
      const mockUser = {
        uid: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        photoURL: null,
        getIdToken: mockGetIdToken.mockResolvedValue('token')
      };

      let authCallback: any;
      mockOnAuthStateChanged.mockImplementation((auth, callback) => {
        authCallback = callback;
        callback(mockUser); // User is signed in
        return vi.fn();
      });

      mockSignOut.mockResolvedValue(undefined);

      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <AuthProvider>
            <TestApp />
          </AuthProvider>
        </MemoryRouter>
      );

      // Verify user can access protected route
      await waitFor(() => {
        expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
      });

      // Act - Simulate logout (would normally be triggered by a logout button)
      // For this test, we'll simulate the auth state change
      authCallback(null);

      // Assert - Should redirect to login
      await waitFor(() => {
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      });

      expect(screen.queryByText('Dashboard Page')).not.toBeInTheDocument();
    });
  });

  describe('Navigation Between Pages', () => {
    it('should navigate from login to register', async () => {
      // Arrange
      const user = userEvent.setup();

      render(
        <MemoryRouter initialEntries={['/login']}>
          <AuthProvider>
            <TestApp />
          </AuthProvider>
        </MemoryRouter>
      );

      // Verify on login page
      expect(screen.getByRole('button', { name: /log in|sign in/i })).toBeInTheDocument();

      // Act - Click register link
      const registerLink = screen.getByRole('link', { name: /sign up|register|create account/i });
      await user.click(registerLink);

      // Assert - Should be on register page
      await waitFor(() => {
        expect(screen.getByLabelText(/display name|name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
      });
    });

    it('should navigate from register to login', async () => {
      // Arrange
      const user = userEvent.setup();

      render(
        <MemoryRouter initialEntries={['/register']}>
          <AuthProvider>
            <TestApp />
          </AuthProvider>
        </MemoryRouter>
      );

      // Verify on register page
      expect(screen.getByLabelText(/display name|name/i)).toBeInTheDocument();

      // Act - Click login link
      const loginLink = screen.getByRole('link', { name: /log in|sign in|already have an account/i });
      await user.click(loginLink);

      // Assert - Should be on login page
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /log in|sign in/i })).toBeInTheDocument();
      });

      expect(screen.queryByLabelText(/display name|name/i)).not.toBeInTheDocument();
    });
  });
});
