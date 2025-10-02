/**
 * Claude Vision Error Handler
 *
 * Handles errors from Claude API with retry logic and fallback strategies.
 */

import type { ClaudeAnalysisResult, ClaudeVisionError } from './types.js';

/**
 * Default fallback creature attributes
 * Used when Claude API fails and no other fallback is available
 */
export function getDefaultFallback(): ClaudeAnalysisResult {
  return {
    concept: 'generic creature',
    race: 'unknown',
    class: 'warrior',
    primaryAttributes: {
      hp: 100,
      attack: 20,
      defense: 15,
      speed: 5
    },
    abilities: ['melee_attack', 'defend', 'dodge'],
    suggestedAnimations: [
      'idle', 'walk', 'run', 'attack_melee', 'defend', 'dodge',
      'hit', 'death', 'celebrate', 'taunt',
      'attack_heavy', 'attack_light', 'block', 'parry', 'roll',
      'jump', 'land', 'crouch', 'stand', 'turn'
    ],
    styleCharacteristics: {
      dominantColors: ['#808080', '#404040', '#C0C0C0', '#000000', '#FFFFFF'],
      shapeComplexity: 'moderate',
      artStyle: 'sketch'
    },
    confidence: 0.0,
    tokenUsage: 0
  };
}

/**
 * Determine if error is retryable
 */
export function isRetryableError(error: any): boolean {
  // Rate limit errors should be retried
  if (error.status === 429 || error.code === 'rate_limit') {
    return true;
  }

  // Temporary server errors should be retried
  if (error.status === 500 || error.status === 502 || error.status === 503) {
    return true;
  }

  // Timeout errors should be retried
  if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
    return true;
  }

  return false;
}

/**
 * Get retry delay in milliseconds (exponential backoff)
 */
export function getRetryDelay(attemptNumber: number, error: any): number {
  // If rate limit, use Retry-After header if available
  if (error.status === 429 && error.headers?.['retry-after']) {
    const retryAfter = parseInt(error.headers['retry-after'], 10);
    return retryAfter * 1000; // Convert to milliseconds
  }

  // Exponential backoff: 1s, 2s, 4s, 8s, ...
  const baseDelay = 1000;
  const maxDelay = 30000; // Cap at 30 seconds
  const delay = Math.min(baseDelay * Math.pow(2, attemptNumber - 1), maxDelay);

  // Add jitter (±25%) to prevent thundering herd
  const jitter = delay * 0.25 * (Math.random() * 2 - 1);
  return Math.floor(delay + jitter);
}

/**
 * Create a ClaudeVisionError from an API error
 */
export function createClaudeError(error: any, fallback?: ClaudeAnalysisResult): ClaudeVisionError {
  // Rate limit error
  if (error.status === 429) {
    return {
      code: 'rate_limit',
      message: 'Claude API rate limit exceeded. Please try again later.',
      retryAfter: error.headers?.['retry-after']
        ? parseInt(error.headers['retry-after'], 10)
        : 60,
      fallback
    };
  }

  // Invalid image error
  if (error.status === 400 && error.message?.includes('image')) {
    return {
      code: 'invalid_image',
      message: 'The provided image could not be processed by Claude Vision.',
      fallback
    };
  }

  // Parse error (malformed response)
  if (error.message?.includes('parse') || error.message?.includes('JSON')) {
    return {
      code: 'parse_error',
      message: 'Failed to parse Claude Vision response. Using fallback attributes.',
      fallback: fallback || getDefaultFallback()
    };
  }

  // Generic API error
  return {
    code: 'api_error',
    message: error.message || 'Claude Vision API request failed.',
    fallback
  };
}

/**
 * Sleep utility for retry delays
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry wrapper with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3
): Promise<T> {
  let lastError: any;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry if not a retryable error
      if (!isRetryableError(error)) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === maxAttempts) {
        throw error;
      }

      // Calculate retry delay and wait
      const delay = getRetryDelay(attempt, error);
      console.log(`[Claude Error Handler] Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }

  throw lastError;
}
