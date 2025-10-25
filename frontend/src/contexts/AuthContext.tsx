/**
 * Auth Context
 *
 * Provides authentication state and methods throughout the app.
 * Implementation follows L4-AUTH-004 specification.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  onAuthStateChanged,
  type User as FirebaseUser
} from 'firebase/auth';
import { auth } from '../config/firebase';

/**
 * User type exposed to components
 */
export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

/**
 * Auth context value
 */
interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  demoLogin: () => void;
}

/**
 * Auth context
 */
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Convert Firebase user to app user
 */
function mapFirebaseUser(firebaseUser: FirebaseUser | null): User | null {
  if (!firebaseUser) return null;

  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
    photoURL: firebaseUser.photoURL
  };
}

/**
 * Auth Provider Component
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Listen to auth state changes
  useEffect(() => {
    // Check for persisted demo user first
    const storedDemoUser = localStorage.getItem('demo-user');
    if (storedDemoUser) {
      try {
        const demoUser = JSON.parse(storedDemoUser);
        setUser(demoUser);
        setLoading(false);
        return;
      } catch (error) {
        console.error('Failed to parse stored demo user:', error);
        localStorage.removeItem('demo-user');
      }
    }

    // Skip Firebase listener if not configured (demo mode)
    if (!auth.onAuthStateChanged) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(mapFirebaseUser(firebaseUser));
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Token refresh interval (50 minutes)
  useEffect(() => {
    if (!user) return;
    // Skip token refresh for demo users
    if (user.uid === 'demo-player1') return;

    const refreshInterval = setInterval(async () => {
      if (auth.currentUser) {
        await auth.currentUser.getIdToken(true); // Force refresh
      }
    }, 50 * 60 * 1000); // 50 minutes

    return () => clearInterval(refreshInterval);
  }, [user]);

  /**
   * Sign in with email and password
   */
  const signIn = async (email: string, password: string): Promise<void> => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  /**
   * Sign up new user
   */
  const signUp = async (
    email: string,
    password: string,
    displayName: string
  ): Promise<void> => {
    // Create Firebase user
    const { user: firebaseUser } = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    // Update display name
    await updateProfile(firebaseUser, { displayName });

    // Create user profile in backend
    const token = await firebaseUser.getIdToken();
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

    const response = await fetch(`${apiUrl}/api/users/profile`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ displayName })
    });

    if (!response.ok) {
      throw new Error('Failed to create user profile');
    }
  };

  /**
   * Sign out current user
   */
  const signOut = async (): Promise<void> => {
    // Clear demo user from localStorage if present
    localStorage.removeItem('demo-user');

    // Sign out from Firebase if configured
    if (auth.currentUser) {
      await firebaseSignOut(auth);
    } else {
      // For demo mode, manually clear user state
      setUser(null);
    }
  };

  /**
   * Get current user's ID token
   */
  const getIdToken = async (): Promise<string | null> => {
    // Handle demo mode
    if (user?.uid === 'demo-player1') {
      return 'demo-player1';
    }

    if (!auth.currentUser) return null;
    return await auth.currentUser.getIdToken();
  };

  /**
   * Demo login (bypass Firebase for testing)
   */
  const demoLogin = () => {
    const demoUser: User = {
      uid: 'demo-player1',
      email: 'demo-player1@demo.local',
      displayName: 'Demo Player 1',
      photoURL: null
    };
    // Persist to localStorage for navigation persistence
    localStorage.setItem('demo-user', JSON.stringify(demoUser));
    setUser(demoUser);
    setLoading(false);
  };

  const value: AuthContextValue = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    getIdToken,
    demoLogin
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Use auth context hook
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
