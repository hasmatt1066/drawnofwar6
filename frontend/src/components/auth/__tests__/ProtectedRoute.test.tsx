/**
 * Protected Route Tests
 *
 * TDD: Tests written first following L4-AUTH-005 specification
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ProtectedRoute } from '../ProtectedRoute';
import { AuthProvider } from '../../../contexts/AuthContext';

// Mock Firebase
const mockOnAuthStateChanged = vi.fn();

vi.mock('../../../config/firebase', () => ({
  auth: {
    currentUser: null,
    onAuthStateChanged: (...args: any[]) => mockOnAuthStateChanged(...args)
  }
}));

vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  updateProfile: vi.fn(),
  onAuthStateChanged: (...args: any[]) => mockOnAuthStateChanged(...args)
}));

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Unauthenticated Access', () => {
    it('should redirect to /login when user is not authenticated', async () => {
      // Arrange - No user
      mockOnAuthStateChanged.mockImplementation((auth, callback) => {
        callback(null);
        return vi.fn();
      });

      // Act
      render(
        <MemoryRouter initialEntries={['/protected']}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<div>Login Page</div>} />
              <Route
                path="/protected"
                element={
                  <ProtectedRoute>
                    <div>Protected Content</div>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      // Assert - Should redirect to login
      await waitFor(() => {
        expect(screen.getByText('Login Page')).toBeInTheDocument();
      });

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('should preserve attempted URL for redirect after login', async () => {
      // Arrange - No user
      mockOnAuthStateChanged.mockImplementation((auth, callback) => {
        callback(null);
        return vi.fn();
      });

      // Use a component that can read the redirect param from useLocation
      function LoginPageWithRedirect() {
        const location = useLocation();
        const searchParams = new URLSearchParams(location.search);
        const redirect = searchParams.get('redirect');
        return (
          <div data-testid="login-page">
            Login with redirect to: {redirect || 'none'}
          </div>
        );
      }

      // Act
      render(
        <MemoryRouter initialEntries={['/dashboard']}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPageWithRedirect />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <div>Dashboard</div>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      // Assert - Should redirect to login with redirect parameter
      await waitFor(() => {
        const loginPage = screen.getByTestId('login-page');
        expect(loginPage).toBeInTheDocument();
        expect(loginPage.textContent).toContain('/dashboard');
      });
    });
  });

  describe('Loading State', () => {
    it('should show loading state while checking authentication', () => {
      // Arrange - Delay auth callback to test loading state
      let authCallback: any;
      mockOnAuthStateChanged.mockImplementation((auth, callback) => {
        authCallback = callback;
        return vi.fn();
      });

      // Act
      render(
        <MemoryRouter initialEntries={['/protected']}>
          <AuthProvider>
            <Routes>
              <Route
                path="/protected"
                element={
                  <ProtectedRoute>
                    <div>Protected Content</div>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      // Assert - Should show loading (nothing rendered yet)
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();

      // Cleanup - resolve auth
      authCallback(null);
    });
  });

  describe('Authenticated Access', () => {
    it('should render children when user is authenticated', async () => {
      // Arrange - Authenticated user
      const mockUser = {
        uid: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        photoURL: null,
        getIdToken: vi.fn().mockResolvedValue('token')
      };

      mockOnAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser);
        return vi.fn();
      });

      // Act
      render(
        <MemoryRouter initialEntries={['/protected']}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<div>Login Page</div>} />
              <Route
                path="/protected"
                element={
                  <ProtectedRoute>
                    <div>Protected Content</div>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      // Assert - Should render protected content
      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument();
      });

      expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
    });

    it('should render nested routes when authenticated', async () => {
      // Arrange - Authenticated user
      const mockUser = {
        uid: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        photoURL: null,
        getIdToken: vi.fn().mockResolvedValue('token')
      };

      mockOnAuthStateChanged.mockImplementation((auth, callback) => {
        callback(mockUser);
        return vi.fn();
      });

      // Act
      render(
        <MemoryRouter initialEntries={['/dashboard/settings']}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<div>Login Page</div>} />
              <Route
                path="/dashboard/*"
                element={
                  <ProtectedRoute>
                    <Routes>
                      <Route path="/settings" element={<div>Settings Page</div>} />
                    </Routes>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      // Assert - Should render nested protected route
      await waitFor(() => {
        expect(screen.getByText('Settings Page')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle user logging out while on protected route', async () => {
      // Arrange - Start with authenticated user
      const mockUser = {
        uid: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        photoURL: null,
        getIdToken: vi.fn().mockResolvedValue('token')
      };

      let authCallback: any;
      mockOnAuthStateChanged.mockImplementation((auth, callback) => {
        authCallback = callback;
        callback(mockUser);
        return vi.fn();
      });

      const { rerender } = render(
        <MemoryRouter initialEntries={['/protected']}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<div>Login Page</div>} />
              <Route
                path="/protected"
                element={
                  <ProtectedRoute>
                    <div>Protected Content</div>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      // Verify initially showing protected content
      await waitFor(() => {
        expect(screen.getByText('Protected Content')).toBeInTheDocument();
      });

      // Act - User logs out
      authCallback(null);

      // Rerender to trigger state update
      rerender(
        <MemoryRouter initialEntries={['/protected']}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<div>Login Page</div>} />
              <Route
                path="/protected"
                element={
                  <ProtectedRoute>
                    <div>Protected Content</div>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      // Assert - Should redirect to login
      await waitFor(() => {
        expect(screen.getByText('Login Page')).toBeInTheDocument();
      });
    });
  });
});
