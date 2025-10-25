/**
 * Authentication Middleware
 *
 * Verifies Firebase ID tokens on protected routes.
 * Supports demo accounts for testing without Firebase verification.
 *
 * Implementation follows L4-AUTH-001 specification.
 */

import type { Request, Response, NextFunction } from 'express';
import { admin } from '../config/firebase.config';

/**
 * Authenticated request with user information
 */
export interface AuthRequest extends Request {
  user?: {
    uid: string;
    email: string | undefined;
    displayName: string | undefined;
  };
}

/**
 * Demo account tokens for testing (bypass Firebase verification)
 */
const DEMO_ACCOUNTS = ['demo-player1', 'demo-player2'] as const;
type DemoAccount = typeof DEMO_ACCOUNTS[number];

/**
 * Check if token is a demo account
 */
function isDemoAccount(token: string): token is DemoAccount {
  return DEMO_ACCOUNTS.includes(token as DemoAccount);
}

/**
 * Get demo account user data
 */
function getDemoAccountUser(token: DemoAccount) {
  const displayNames: Record<DemoAccount, string> = {
    'demo-player1': 'Demo Player 1',
    'demo-player2': 'Demo Player 2'
  };

  return {
    uid: token,
    email: `${token}@demo.local`,
    displayName: displayNames[token]
  };
}

/**
 * Authentication middleware
 *
 * Verifies Firebase ID token from Authorization header.
 * Sets req.user if token is valid.
 * Returns 401 if token is missing or invalid.
 */
export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract Authorization header
    const authHeader = req.headers.authorization;

    // Check if Authorization header exists
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No auth token provided' });
      return;
    }

    // Extract token
    const idToken = authHeader.split('Bearer ')[1];

    // Check if token is empty
    if (!idToken || idToken.trim() === '') {
      res.status(401).json({ error: 'No auth token provided' });
      return;
    }

    // Special case: Demo accounts (for testing)
    if (isDemoAccount(idToken)) {
      req.user = getDemoAccountUser(idToken);
      next();
      return;
    }

    // Verify Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    // Set user on request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      displayName: decodedToken.name
    };

    // Proceed to next middleware
    next();
  } catch (error) {
    // Log error for debugging
    console.error('[Auth] Token verification failed:', error);

    // Return 401 for any error
    res.status(401).json({ error: 'Invalid auth token' });
  }
}
