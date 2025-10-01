/**
 * Test fixtures for job requests
 */

import { StructuredPrompt } from '../../src/queue/job-status-tracker.js';
import { GenerationRequest } from '../../src/pixellab/request-validator.js';

/**
 * Simple character generation request
 */
export const simpleCharacterRequest: GenerationRequest = {
  description: 'brave knight with sword',
  size: 48 as const,
};

/**
 * Detailed character generation request
 */
export const detailedCharacterRequest: GenerationRequest = {
  description: 'wizard with blue robes and magical staff',
  size: 64 as const,
  detail: 'high detail',
  shading: 'detailed shading',
  outline: 'single color black outline',
  view: 'low top-down',
};

/**
 * Simple structured prompt for queue jobs
 */
export const simplePrompt: StructuredPrompt = {
  type: 'character',
  style: 'pixel-art',
  size: { width: 48, height: 48 },
  action: 'idle',
  description: 'brave knight with sword',
  raw: 'brave knight with sword',
};

/**
 * Detailed structured prompt for queue jobs
 */
export const detailedPrompt: StructuredPrompt = {
  type: 'character',
  style: 'pixel-art',
  size: { width: 64, height: 64 },
  action: 'idle',
  description: 'wizard with blue robes and magical staff',
  raw: 'wizard with blue robes and magical staff',
};

/**
 * Generate a unique prompt for testing (to avoid cache hits)
 */
export function createUniquePrompt(suffix: string): StructuredPrompt {
  return {
    type: 'character',
    style: 'pixel-art',
    size: { width: 48, height: 48 },
    action: 'idle',
    description: `test character ${suffix}`,
    raw: `test character ${suffix}`,
  };
}

/**
 * Generate a unique generation request
 */
export function createUniqueRequest(suffix: string): GenerationRequest {
  return {
    description: `test character ${suffix}`,
    size: 48 as const,
  };
}
