/**
 * User Routes
 *
 * API routes for user profile operations.
 * Implementation follows L4-AUTH-002 specification.
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { getProfile, createProfile } from '../controllers/users.controller';

export const usersRouter = Router();

/**
 * GET /api/users/me/profile
 * Get current user's profile and stats
 * Requires authentication
 */
usersRouter.get('/me/profile', authenticate, getProfile);

/**
 * POST /api/users/profile
 * Create new user profile
 * Requires authentication
 */
usersRouter.post('/profile', authenticate, createProfile);
