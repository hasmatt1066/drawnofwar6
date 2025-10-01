/**
 * Test Fixtures: SpriteGenerationResult and GenerationResult
 *
 * Provides deterministic test data for generation results from both
 * the queue system and PixelLab API.
 */

import type { SpriteGenerationResult } from '../../src/queue/job-status-tracker.js';
import type {
  GenerationResult,
  DirectionResult,
  DirectionName,
} from '../../src/pixellab/result-builder.js';

/**
 * Create a minimal PNG buffer (1x1 transparent pixel)
 *
 * Use case: Testing image processing without large test data
 */
export function createMinimalImageBuffer(): Buffer {
  // 1x1 transparent PNG
  const base64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  return Buffer.from(base64, 'base64');
}

/**
 * Create a small test PNG buffer (8x8 pixels)
 *
 * Use case: Testing with slightly larger but still small images
 */
export function createSmallImageBuffer(): Buffer {
  // 8x8 red square PNG
  const base64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAALElEQVQYV2P8z8DwHwYYGBkZ/8MxWC4qKuo/hgKQBEgOZAJZDpYBKwCpBgAuzhH+7S+AGwAAAABJRU5ErkJggg==';
  return Buffer.from(base64, 'base64');
}

/**
 * Minimal sprite generation result (1 frame)
 *
 * Use case: Testing basic result handling
 */
export function createMinimalSpriteResult(): SpriteGenerationResult {
  return {
    jobId: 'test-job-minimal',
    frames: [createMinimalImageBuffer()],
    metadata: {
      dimensions: { width: 32, height: 32 },
      frameCount: 1,
      generationTimeMs: 1000,
      cacheHit: false,
    },
  };
}

/**
 * Typical sprite generation result (4 frames)
 *
 * Use case: Testing standard 4-direction sprite
 */
export function createTypicalSpriteResult(): SpriteGenerationResult {
  const buffer = createSmallImageBuffer();
  return {
    jobId: 'test-job-typical',
    frames: [buffer, buffer, buffer, buffer],
    metadata: {
      dimensions: { width: 64, height: 64 },
      frameCount: 4,
      generationTimeMs: 15000,
      cacheHit: false,
      pixelLabJobId: 'pixellab-123',
    },
  };
}

/**
 * Maximal sprite generation result (8 frames)
 *
 * Use case: Testing 8-direction sprite with all metadata
 */
export function createMaximalSpriteResult(): SpriteGenerationResult {
  const buffer = createSmallImageBuffer();
  return {
    jobId: 'test-job-maximal',
    frames: [buffer, buffer, buffer, buffer, buffer, buffer, buffer, buffer],
    metadata: {
      dimensions: { width: 128, height: 128 },
      frameCount: 8,
      generationTimeMs: 30000,
      cacheHit: false,
      pixelLabJobId: 'pixellab-456',
    },
  };
}

/**
 * Cached sprite generation result
 *
 * Use case: Testing cache hit scenarios
 */
export function createCachedSpriteResult(): SpriteGenerationResult {
  const buffer = createMinimalImageBuffer();
  return {
    jobId: 'test-job-cached',
    frames: [buffer, buffer, buffer, buffer],
    metadata: {
      dimensions: { width: 64, height: 64 },
      frameCount: 4,
      generationTimeMs: 50, // Very fast due to cache
      cacheHit: true,
    },
  };
}

/**
 * Helper to create direction result
 */
function createDirectionResult(direction: DirectionName, index: number, characterId: string): DirectionResult {
  return {
    direction,
    url: `https://api.pixellab.ai/v2/characters/${characterId}/rotations/${direction}`,
    buffer: createSmallImageBuffer(),
  };
}

/**
 * Minimal generation result from PixelLab (4 directions)
 *
 * Use case: Testing PixelLab API response parsing
 */
export function createMinimalGenerationResult(): GenerationResult {
  const characterId = 'char-minimal-123';
  return {
    characterId,
    name: null,
    created: '2025-09-30T12:00:00Z',
    specifications: {
      directions: 4,
      canvasSize: '32x32',
      view: 'low top-down',
    },
    style: {
      outline: 'single color black outline',
      shading: 'flat shading',
      detail: 'low detail',
    },
    directions: [
      createDirectionResult('north', 0, characterId),
      createDirectionResult('east', 1, characterId),
      createDirectionResult('south', 2, characterId),
      createDirectionResult('west', 3, characterId),
    ],
    downloadUrl: `https://api.pixellab.ai/v2/characters/${characterId}/download`,
  };
}

/**
 * Typical generation result from PixelLab (8 directions)
 *
 * Use case: Testing standard 8-direction character generation
 */
export function createTypicalGenerationResult(): GenerationResult {
  const characterId = 'char-typical-456';
  return {
    characterId,
    name: 'brave-knight',
    created: '2025-09-30T12:30:00Z',
    specifications: {
      directions: 8,
      canvasSize: '64x64',
      view: 'high top-down',
    },
    style: {
      outline: 'single color outline',
      shading: 'medium shading',
      detail: 'medium detail',
    },
    directions: [
      createDirectionResult('north', 0, characterId),
      createDirectionResult('north-east', 1, characterId),
      createDirectionResult('east', 2, characterId),
      createDirectionResult('south-east', 3, characterId),
      createDirectionResult('south', 4, characterId),
      createDirectionResult('south-west', 5, characterId),
      createDirectionResult('west', 6, characterId),
      createDirectionResult('north-west', 7, characterId),
    ],
    downloadUrl: `https://api.pixellab.ai/v2/characters/${characterId}/download`,
  };
}

/**
 * Maximal generation result from PixelLab (8 directions, all features)
 *
 * Use case: Testing full feature set
 */
export function createMaximalGenerationResult(): GenerationResult {
  const characterId = 'char-maximal-789';
  return {
    characterId,
    name: 'epic-dragon',
    created: '2025-09-30T13:00:00Z',
    specifications: {
      directions: 8,
      canvasSize: '128x128',
      view: 'side',
    },
    style: {
      outline: 'selective outline',
      shading: 'detailed shading',
      detail: 'high detail',
    },
    directions: [
      createDirectionResult('north', 0, characterId),
      createDirectionResult('north-east', 1, characterId),
      createDirectionResult('east', 2, characterId),
      createDirectionResult('south-east', 3, characterId),
      createDirectionResult('south', 4, characterId),
      createDirectionResult('south-west', 5, characterId),
      createDirectionResult('west', 6, characterId),
      createDirectionResult('north-west', 7, characterId),
    ],
    downloadUrl: `https://api.pixellab.ai/v2/characters/${characterId}/download`,
  };
}
