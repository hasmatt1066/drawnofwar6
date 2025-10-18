/**
 * TASK-COMBAT-VIZ-002: Combat State Parser Implementation
 *
 * Parses and validates raw Socket.IO combat:state events into typed CombatState objects.
 * Ensures data integrity and type safety for frontend rendering.
 */

import type { CombatState } from '@drawn-of-war/shared/types/combat';

/**
 * Custom error for combat state parsing failures
 */
export class CombatStateParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CombatStateParseError';
  }
}

/**
 * Valid combat status values
 */
const VALID_STATUSES = ['initializing', 'running', 'paused', 'completed'];

/**
 * Parse and validate raw combat state data from Socket.IO
 *
 * @param rawData - Raw data from socket.io combat:state event
 * @returns Validated and typed CombatState object
 * @throws CombatStateParseError if validation fails
 */
export function parseCombatState(rawData: any): CombatState {
  // Validate input is an object
  if (rawData === null || rawData === undefined) {
    throw new CombatStateParseError('Combat state data is null or undefined');
  }

  if (typeof rawData !== 'object') {
    throw new CombatStateParseError('Combat state data must be an object');
  }

  if (Array.isArray(rawData)) {
    throw new CombatStateParseError('Combat state data cannot be an array');
  }

  // Validate required fields
  if (!rawData.matchId || typeof rawData.matchId !== 'string' || rawData.matchId.trim() === '') {
    throw new CombatStateParseError('Invalid or missing matchId field');
  }

  if (typeof rawData.tick !== 'number') {
    throw new CombatStateParseError('Invalid or missing tick field');
  }

  if (rawData.tick < 0) {
    throw new CombatStateParseError('tick must be non-negative');
  }

  if (!rawData.status || !VALID_STATUSES.includes(rawData.status)) {
    throw new CombatStateParseError(
      `Invalid or missing status field. Expected one of: ${VALID_STATUSES.join(', ')}`
    );
  }

  if (!Array.isArray(rawData.units)) {
    throw new CombatStateParseError('units field must be an array');
  }

  if (!Array.isArray(rawData.projectiles)) {
    throw new CombatStateParseError('projectiles field must be an array');
  }

  if (!Array.isArray(rawData.events)) {
    throw new CombatStateParseError('events field must be an array');
  }

  if (!rawData.statistics || typeof rawData.statistics !== 'object') {
    throw new CombatStateParseError('Invalid or missing statistics field');
  }

  if (typeof rawData.startTime !== 'number') {
    throw new CombatStateParseError('Invalid or missing startTime field');
  }

  // Return the validated combat state
  // Note: Deep validation of nested objects (units, projectiles, events) is deferred
  // to maintain performance. Frontend should be resilient to malformed nested data.
  return rawData as CombatState;
}
