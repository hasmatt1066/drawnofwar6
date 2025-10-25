/**
 * Login Page Tests
 *
 * TDD: Tests written first following L4-AUTH-006 specification
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LoginPage } from '../LoginPage';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock Firebase
const mockSignInWithEmailAndPassword = vi.fn();
const mockOnAuthStateChanged = vi.fn();

vi.mock('../../config/firebase', () => ({
  auth: {
    currentUser: null,
    onAuthStateChanged: (...args: any[]) => mockOnAuthStateChanged(...args)
  }
}));

vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: (...args: any[]) => mockSignInWithEmailAndPassword(...args),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  updateProfile: vi.fn(),
  onAuthStateChanged: (...args: any[]) => mockOnAuthStateChanged(...args)
}));

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: no user signed in
    mockOnAuthStateChanged.mockImplementation((auth, callback) => {
      callback(null);
      return vi.fn();
    });
  });

  describe('Form Rendering', () => {
    it('should render email and password inputs', () => {
      // Act
      render(
        <MemoryRouter>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </MemoryRouter>
      );

      // Assert
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    });

    it('should render login button', () => {
      // Act
      render(
        <MemoryRouter>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </MemoryRouter>
      );

      // Assert
      expect(screen.getByRole('button', { name: /log in|sign in/i })).toBeInTheDocument();
    });

    it('should render link to register page', () => {
      // Act
      render(
        <MemoryRouter>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </MemoryRouter>
      );

      // Assert
      const registerLink = screen.getByRole('link', { name: /sign up|register|create account/i });
      expect(registerLink).toBeInTheDocument();
      expect(registerLink).toHaveAttribute('href', '/register');
    });
  });

  describe('Form Validation', () => {
    it('should show error when submitting with empty email', async () => {
      // Arrange
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </MemoryRouter>
      );

      // Act - Submit without filling email
      const submitButton = screen.getByRole('button', { name: /log in|sign in/i });
      await user.click(submitButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/email is required|please enter your email/i)).toBeInTheDocument();
      });
    });

    it('should show error when submitting with invalid email format', async () => {
      // Arrange
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </MemoryRouter>
      );

      // Act - Enter invalid email
      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'invalid-email');

      const submitButton = screen.getByRole('button', { name: /log in|sign in/i });
      await user.click(submitButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/invalid email|valid email address/i)).toBeInTheDocument();
      });
    });

    it('should show error when submitting with empty password', async () => {
      // Arrange
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </MemoryRouter>
      );

      // Act - Fill email but not password
      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'test@example.com');

      const submitButton = screen.getByRole('button', { name: /log in|sign in/i });
      await user.click(submitButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/password is required|please enter your password/i)).toBeInTheDocument();
      });
    });
  });

  describe('Login Flow', () => {
    it('should call signIn when form is submitted with valid data', async () => {
      // Arrange
      const user = userEvent.setup();
      const mockUser = {
        uid: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        photoURL: null,
        getIdToken: vi.fn().mockResolvedValue('token')
      };

      mockSignInWithEmailAndPassword.mockResolvedValue({ user: mockUser });

      render(
        <MemoryRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<LoginPage />} />
              <Route path="/home" element={<div>Home Page</div>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      // Act - Fill form and submit
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /log in|sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      // Assert
      await waitFor(() => {
        expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith(
          expect.anything(),
          'test@example.com',
          'password123'
        );
      });
    });

    it('should redirect to home page after successful login', async () => {
      // Arrange
      const user = userEvent.setup();
      const mockUser = {
        uid: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        photoURL: null,
        getIdToken: vi.fn().mockResolvedValue('token')
      };

      mockSignInWithEmailAndPassword.mockResolvedValue({ user: mockUser });
      mockOnAuthStateChanged.mockImplementation((auth, callback) => {
        // Simulate auth state change after login
        setTimeout(() => callback(mockUser), 100);
        return vi.fn();
      });

      render(
        <MemoryRouter initialEntries={['/login']}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/home" element={<div>Home Page</div>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      // Act - Fill form and submit
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /log in|sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      // Assert - Should redirect to home
      await waitFor(() => {
        expect(screen.getByText('Home Page')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('should redirect to original URL when redirect parameter is present', async () => {
      // Arrange
      const user = userEvent.setup();
      const mockUser = {
        uid: 'user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        photoURL: null,
        getIdToken: vi.fn().mockResolvedValue('token')
      };

      mockSignInWithEmailAndPassword.mockResolvedValue({ user: mockUser });
      mockOnAuthStateChanged.mockImplementation((auth, callback) => {
        setTimeout(() => callback(mockUser), 100);
        return vi.fn();
      });

      render(
        <MemoryRouter initialEntries={['/login?redirect=%2Fdashboard']}>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/dashboard" element={<div>Dashboard Page</div>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      // Act - Fill form and submit
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /log in|sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      // Assert - Should redirect to dashboard
      await waitFor(() => {
        expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when login fails', async () => {
      // Arrange
      const user = userEvent.setup();

      mockSignInWithEmailAndPassword.mockRejectedValue({
        code: 'auth/wrong-password',
        message: 'Wrong password'
      });

      render(
        <MemoryRouter>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </MemoryRouter>
      );

      // Act - Fill form and submit
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /log in|sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'wrongpassword');
      await user.click(submitButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/invalid email or password|wrong password|authentication failed/i)).toBeInTheDocument();
      });
    });

    it('should disable submit button while login is in progress', async () => {
      // Arrange
      const user = userEvent.setup();

      // Delay the response
      mockSignInWithEmailAndPassword.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ user: {} }), 500))
      );

      render(
        <MemoryRouter>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </MemoryRouter>
      );

      // Act - Fill form and submit
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole('button', { name: /log in|sign in/i });

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(submitButton);

      // Assert - Button should be disabled immediately
      expect(submitButton).toBeDisabled();
    });
  });
});
