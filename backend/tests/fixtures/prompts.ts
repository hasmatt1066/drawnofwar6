/**
 * Test Fixtures: StructuredPrompt
 *
 * Provides deterministic, valid test data for StructuredPrompt objects.
 * Covers minimal, typical, maximal, and invalid cases for comprehensive testing.
 */

import type { StructuredPrompt } from '../../src/queue/job-submitter.js';

/**
 * Minimal prompt fixture (only required fields)
 *
 * Use case: Testing baseline validation and minimal valid input
 */
export function createMinimalPrompt(): StructuredPrompt {
  return {
    type: 'character',
    style: 'pixel-art',
    size: {
      width: 32,
      height: 32,
    },
    action: 'idle',
    description: 'A brave knight',
    raw: 'knight',
  };
}

/**
 * Typical prompt fixture (common use case with some optional fields)
 *
 * Use case: Testing standard generation requests
 */
export function createTypicalPrompt(): StructuredPrompt {
  return {
    type: 'character',
    style: 'pixel-art',
    size: {
      width: 64,
      height: 64,
    },
    action: 'walking',
    description: 'A brave knight with golden armor',
    raw: 'knight with golden armor walking',
    options: {
      noBackground: true,
      textGuidanceScale: 7.5,
    },
  };
}

/**
 * Maximal prompt fixture (all optional fields populated)
 *
 * Use case: Testing complete feature set and edge cases
 */
export function createMaximalPrompt(): StructuredPrompt {
  return {
    type: 'character',
    style: 'pixel-art',
    size: {
      width: 128,
      height: 128,
    },
    action: 'attacking',
    description: 'A brave knight with golden armor and red cape wielding a flaming sword',
    raw: 'knight with golden armor, red cape, and flaming sword attacking',
    options: {
      noBackground: true,
      textGuidanceScale: 10.0,
      paletteImage: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    },
  };
}

/**
 * Invalid prompt fixture (for negative testing)
 *
 * Use case: Testing validation error handling
 * Note: Type assertion used intentionally for invalid data
 */
export function createInvalidPrompt(): StructuredPrompt {
  return {
    type: '',
    style: '',
    size: {
      width: 0,
      height: 0,
    },
    action: '',
    description: '',
    raw: '',
  } as StructuredPrompt;
}

/**
 * Prompt with edge case values
 *
 * Use case: Testing boundary conditions
 */
export function createEdgeCasePrompt(): StructuredPrompt {
  return {
    type: 'tile',
    style: '16-bit',
    size: {
      width: 32,
      height: 32,
    },
    action: 'static',
    description: 'A',
    raw: 'A',
    options: {
      noBackground: false,
      textGuidanceScale: 1.0,
    },
  };
}

/**
 * Prompt with maximum text guidance scale
 *
 * Use case: Testing upper bound validation
 */
export function createMaxTextGuidancePrompt(): StructuredPrompt {
  return {
    type: 'character',
    style: 'pixel-art',
    size: {
      width: 64,
      height: 64,
    },
    action: 'idle',
    description: 'A wizard',
    raw: 'wizard',
    options: {
      textGuidanceScale: 20.0,
    },
  };
}

/**
 * Prompt with large dimensions
 *
 * Use case: Testing large sprite generation
 */
export function createLargeSizePrompt(): StructuredPrompt {
  return {
    type: 'character',
    style: 'pixel-art',
    size: {
      width: 128,
      height: 128,
    },
    action: 'idle',
    description: 'A dragon',
    raw: 'dragon',
  };
}
