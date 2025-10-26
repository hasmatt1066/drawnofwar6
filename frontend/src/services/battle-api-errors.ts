/**
 * Battle API Error Classes
 *
 * Typed error classes for battle API failures. These allow specific error
 * handling in the UI (e.g., showing "need more creatures" vs "battle not found").
 */

/**
 * Error thrown when user doesn't have enough creatures to battle
 */
export class InsufficientCreaturesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientCreaturesError';

    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, InsufficientCreaturesError);
    }
  }
}

/**
 * Error thrown when battle with given key/ID doesn't exist
 */
export class BattleNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BattleNotFoundError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BattleNotFoundError);
    }
  }
}

/**
 * Error thrown when trying to join a battle that's already full or started
 */
export class BattleAlreadyFilledError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BattleAlreadyFilledError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BattleAlreadyFilledError);
    }
  }
}

/**
 * Error thrown when trying to join your own battle
 */
export class CannotJoinOwnBattleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CannotJoinOwnBattleError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CannotJoinOwnBattleError);
    }
  }
}

/**
 * Error thrown when trying to create/join while already in an active battle
 */
export class ActiveBattleExistsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ActiveBattleExistsError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ActiveBattleExistsError);
    }
  }
}

/**
 * API error response structure
 */
interface ApiErrorResponse {
  error?: string;
  message?: string;
}

/**
 * Parse API error response into typed error class
 *
 * @param response - Error response from API (can be object or string)
 * @returns Typed error instance based on error code
 *
 * @example
 * ```typescript
 * try {
 *   await fetch('/api/battles', { ... });
 * } catch (err) {
 *   const apiError = await err.json();
 *   throw parseBattleApiError(apiError);
 * }
 * ```
 */
export function parseBattleApiError(response: ApiErrorResponse | string): Error {
  // Handle string responses
  if (typeof response === 'string') {
    return new Error(response);
  }

  // Extract error code and message
  const errorCode = response.error;
  const message = response.message || errorCode || 'Unknown error';

  // Map error codes to typed error classes
  switch (errorCode) {
    case 'INSUFFICIENT_CREATURES':
      return new InsufficientCreaturesError(message);

    case 'BATTLE_NOT_FOUND':
      return new BattleNotFoundError(message);

    case 'BATTLE_NOT_AVAILABLE':
    case 'BATTLE_ALREADY_FILLED':
      return new BattleAlreadyFilledError(message);

    case 'CANNOT_JOIN_OWN_BATTLE':
      return new CannotJoinOwnBattleError(message);

    case 'BATTLE_IN_PROGRESS':
      return new ActiveBattleExistsError(message);

    default:
      // Unknown error code - return generic Error
      return new Error(message);
  }
}
