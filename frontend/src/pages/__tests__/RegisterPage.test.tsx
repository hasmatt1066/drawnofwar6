/**
 * Register Page Tests
 *
 * TDD: Tests written first following L4-AUTH-007 specification
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RegisterPage } from '../RegisterPage';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock Firebase
const mockCreateUserWithEmailAndPassword = vi.fn();
const mockUpdateProfile = vi.fn();
const mockOnAuthStateChanged = vi.fn();
const mockGetIdToken = vi.fn();

vi.mock('../../config/firebase', () => ({
  auth: {
    currentUser: null,
    onAuthStateChanged: (...args: any[]) => mockOnAuthStateChanged(...args)
  }
}));

vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: (...args: any[]) => mockCreateUserWithEmailAndPassword(...args),
  signOut: vi.fn(),
  updateProfile: (...args: any[]) => mockUpdateProfile(...args),
  onAuthStateChanged: (...args: any[]) => mockOnAuthStateChanged(...args)
}));

// Mock global fetch
global.fetch = vi.fn();

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: no user signed in
    mockOnAuthStateChanged.mockImplementation((auth, callback) => {
      callback(null);
      return vi.fn();
    });
  });

  describe('Form Rendering', () => {
    it('should render all required input fields', () => {
      // Act
      render(
        <MemoryRouter>
          <AuthProvider>
            <RegisterPage />
          </AuthProvider>
        </MemoryRouter>
      );

      // Assert
      expect(screen.getByLabelText(/display name|name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    });

    it('should render register button', () => {
      // Act
      render(
        <MemoryRouter>
          <AuthProvider>
            <RegisterPage />
          </AuthProvider>
        </MemoryRouter>
      );

      // Assert
      expect(screen.getByRole('button', { name: /sign up|register|create account/i })).toBeInTheDocument();
    });

    it('should render link to login page', () => {
      // Act
      render(
        <MemoryRouter>
          <AuthProvider>
            <RegisterPage />
          </AuthProvider>
        </MemoryRouter>
      );

      // Assert
      const loginLink = screen.getByRole('link', { name: /log in|sign in|already have an account/i });
      expect(loginLink).toBeInTheDocument();
      expect(loginLink).toHaveAttribute('href', '/login');
    });
  });

  describe('Form Validation', () => {
    it('should show error when submitting with empty display name', async () => {
      // Arrange
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <AuthProvider>
            <RegisterPage />
          </AuthProvider>
        </MemoryRouter>
      );

      // Act - Submit without filling display name
      const submitButton = screen.getByRole('button', { name: /sign up|register|create account/i });
      await user.click(submitButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/display name is required|please enter your name/i)).toBeInTheDocument();
      });
    });

    it('should show error when submitting with empty email', async () => {
      // Arrange
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <AuthProvider>
            <RegisterPage />
          </AuthProvider>
        </MemoryRouter>
      );

      // Act - Fill display name but not email
      const nameInput = screen.getByLabelText(/display name|name/i);
      await user.type(nameInput, 'Test User');

      const submitButton = screen.getByRole('button', { name: /sign up|register|create account/i });
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
            <RegisterPage />
          </AuthProvider>
        </MemoryRouter>
      );

      // Act
      const nameInput = screen.getByLabelText(/display name|name/i);
      const emailInput = screen.getByLabelText(/^email/i);
      await user.type(nameInput, 'Test User');
      await user.type(emailInput, 'invalid-email');

      const submitButton = screen.getByRole('button', { name: /sign up|register|create account/i });
      await user.click(submitButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/invalid email|valid email address/i)).toBeInTheDocument();
      });
    });

    it('should show error when password is too short', async () => {
      // Arrange
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <AuthProvider>
            <RegisterPage />
          </AuthProvider>
        </MemoryRouter>
      );

      // Act
      const nameInput = screen.getByLabelText(/display name|name/i);
      const emailInput = screen.getByLabelText(/^email/i);
      const passwordInput = screen.getByLabelText(/^password/i);

      await user.type(nameInput, 'Test User');
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, '12345');

      const submitButton = screen.getByRole('button', { name: /sign up|register|create account/i });
      await user.click(submitButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/password must be at least 6 characters/i)).toBeInTheDocument();
      });
    });

    it('should show error when passwords do not match', async () => {
      // Arrange
      const user = userEvent.setup();

      render(
        <MemoryRouter>
          <AuthProvider>
            <RegisterPage />
          </AuthProvider>
        </MemoryRouter>
      );

      // Act
      const nameInput = screen.getByLabelText(/display name|name/i);
      const emailInput = screen.getByLabelText(/^email/i);
      const passwordInput = screen.getByLabelText(/^password/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

      await user.type(nameInput, 'Test User');
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'password456');

      const submitButton = screen.getByRole('button', { name: /sign up|register|create account/i });
      await user.click(submitButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/passwords do not match|passwords must match/i)).toBeInTheDocument();
      });
    });
  });

  describe('Registration Flow', () => {
    it('should call signUp when form is submitted with valid data', async () => {
      // Arrange
      const user = userEvent.setup();
      const mockUser = {
        uid: 'new-user-123',
        email: 'newuser@example.com',
        displayName: null,
        photoURL: null,
        getIdToken: mockGetIdToken.mockResolvedValue('new-token')
      };

      mockCreateUserWithEmailAndPassword.mockResolvedValue({ user: mockUser });
      mockUpdateProfile.mockResolvedValue(undefined);
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      render(
        <MemoryRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<RegisterPage />} />
              <Route path="/home" element={<div>Home Page</div>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      // Act - Fill form and submit
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

      // Assert
      await waitFor(() => {
        expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalledWith(
          expect.anything(),
          'newuser@example.com',
          'password123'
        );
      });
    });

    it('should redirect to home page after successful registration', async () => {
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

      mockOnAuthStateChanged.mockImplementation((auth, callback) => {
        setTimeout(() => callback(mockUser), 100);
        return vi.fn();
      });

      render(
        <MemoryRouter initialEntries={['/register']}>
          <AuthProvider>
            <Routes>
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/home" element={<div>Home Page</div>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      );

      // Act - Fill form and submit
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

      // Assert - Should redirect to home
      await waitFor(() => {
        expect(screen.getByText('Home Page')).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('Error Handling', () => {
    it('should display error message when email is already in use', async () => {
      // Arrange
      const user = userEvent.setup();

      mockCreateUserWithEmailAndPassword.mockRejectedValue({
        code: 'auth/email-already-in-use',
        message: 'Email already in use'
      });

      render(
        <MemoryRouter>
          <AuthProvider>
            <RegisterPage />
          </AuthProvider>
        </MemoryRouter>
      );

      // Act - Fill form and submit
      const nameInput = screen.getByLabelText(/display name|name/i);
      const emailInput = screen.getByLabelText(/^email/i);
      const passwordInput = screen.getByLabelText(/^password/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /sign up|register|create account/i });

      await user.type(nameInput, 'Test User');
      await user.type(emailInput, 'existing@example.com');
      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'password123');
      await user.click(submitButton);

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/email is already in use|email already registered/i)).toBeInTheDocument();
      });
    });

    it('should disable submit button while registration is in progress', async () => {
      // Arrange
      const user = userEvent.setup();

      // Delay the response
      mockCreateUserWithEmailAndPassword.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ user: {} }), 500))
      );

      render(
        <MemoryRouter>
          <AuthProvider>
            <RegisterPage />
          </AuthProvider>
        </MemoryRouter>
      );

      // Act - Fill form and submit
      const nameInput = screen.getByLabelText(/display name|name/i);
      const emailInput = screen.getByLabelText(/^email/i);
      const passwordInput = screen.getByLabelText(/^password/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      const submitButton = screen.getByRole('button', { name: /sign up|register|create account/i });

      await user.type(nameInput, 'Test User');
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'password123');
      await user.click(submitButton);

      // Assert - Button should be disabled immediately
      expect(submitButton).toBeDisabled();
    });
  });
});
