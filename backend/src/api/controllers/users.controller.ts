/**
 * User Controller
 *
 * Handles user profile operations.
 * Implementation follows L4-AUTH-002 specification.
 */

import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.middleware';
import { getFirestore } from '../../config/firebase.config';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Get user profile
 *
 * GET /api/users/me/profile
 * Retrieves the current user's profile including stats.
 */
export async function getProfile(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const userId = req.user!.uid;

    // Handle demo users
    if (userId === 'demo-player1' || userId === 'demo-player2') {
      const demoProfile = {
        displayName: userId === 'demo-player1' ? 'Demo Player 1' : 'Demo Player 2',
        email: `${userId}@demo.local`,
        stats: {
          wins: userId === 'demo-player1' ? 5 : 3,
          losses: userId === 'demo-player1' ? 3 : 2,
          disconnects: 0,
          totalBattles: userId === 'demo-player1' ? 8 : 5,
          currentWinStreak: userId === 'demo-player1' ? 2 : 1,
          bestWinStreak: userId === 'demo-player1' ? 4 : 2
        }
      };

      res.json(demoProfile);
      return;
    }

    // Get profile from Firestore
    const firestore = getFirestore();
    const profileRef = firestore.doc(`users/${userId}/profile`);
    const profileDoc = await profileRef.get();

    if (!profileDoc.exists) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }

    const profile = profileDoc.data();

    res.json({
      displayName: profile?.displayName,
      email: profile?.email,
      stats: profile?.stats || {
        wins: 0,
        losses: 0,
        disconnects: 0,
        totalBattles: 0,
        currentWinStreak: 0,
        bestWinStreak: 0
      }
    });
  } catch (error) {
    console.error('[Users] Failed to get profile:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
}

/**
 * Create user profile
 *
 * POST /api/users/profile
 * Creates a new user profile in Firestore with initialized stats.
 */
export async function createProfile(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { displayName } = req.body;
    const userId = req.user!.uid;
    const email = req.user!.email;

    // Validate displayName
    if (!displayName || displayName.trim() === '') {
      res.status(400).json({ error: 'Display name is required' });
      return;
    }

    if (displayName.length > 50) {
      res.status(400).json({ error: 'Display name must be 50 characters or less' });
      return;
    }

    // Check if profile already exists
    const firestore = getFirestore();
    const profileRef = firestore.doc(`users/${userId}/profile`);
    const existingProfile = await profileRef.get();

    if (existingProfile.exists) {
      res.status(400).json({ error: 'Profile already exists' });
      return;
    }

    // Create profile document
    await profileRef.set({
      displayName: displayName.trim(),
      email: email || null,
      createdAt: FieldValue.serverTimestamp(),
      lastLoginAt: FieldValue.serverTimestamp(),
      stats: {
        wins: 0,
        losses: 0,
        disconnects: 0,
        totalBattles: 0,
        currentWinStreak: 0,
        bestWinStreak: 0
      }
    });

    res.status(201).json({
      success: true,
      message: 'Profile created successfully'
    });
  } catch (error) {
    console.error('[Users] Failed to create profile:', error);
    res.status(500).json({ error: 'Failed to create profile' });
  }
}
