import { GenerationRequest } from '../request-validator';
import { PixelLabErrorType } from '../errors';

/**
 * Test fixtures for PixelLab API client
 *
 * Provides reusable test data including:
 * - Valid character generation requests (minimal, full)
 * - Valid animation requests
 * - Character data responses (4-dir, 8-dir)
 * - Base64 PNG samples
 * - Error response samples
 * - API key samples
 */

/**
 * Animation request interface (for fixtures only)
 */
export interface AnimationRequest {
  characterId: string;
  templateAnimationId: string;
  actionDescription?: string;
  animationName?: string;
}

// =============================================================================
// Character Generation Requests
// =============================================================================

/**
 * Minimal valid character generation request
 */
export const minimalCharacterRequest: GenerationRequest = {
  description: 'simple warrior',
  size: 32,
};

/**
 * Full character generation request with all optional fields
 */
export const fullCharacterRequest: GenerationRequest = {
  description: 'wizard with blue robes and magical staff',
  size: 64,
  detail: 'high detail',
  shading: 'detailed shading',
  outline: 'single color black outline',
  view: 'low top-down',
  nDirections: 8,
  aiFreedom: 750,
  textGuidanceScale: 8,
};

/**
 * 4-directional character request
 */
export const character4DirectionRequest: GenerationRequest = {
  description: 'knight with shield',
  size: 48,
  nDirections: 4,
};

/**
 * 8-directional character request
 */
export const character8DirectionRequest: GenerationRequest = {
  description: 'dragon with wings',
  size: 64,
  nDirections: 8,
};

/**
 * Character request with init image
 */
export const characterWithInitImageRequest: GenerationRequest = {
  description: 'wizard',
  size: 48,
  initImage:
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
};

// =============================================================================
// Animation Requests
// =============================================================================

/**
 * Basic animation request
 */
export const basicAnimationRequest: AnimationRequest = {
  characterId: 'char-123',
  templateAnimationId: 'walking',
};

/**
 * Animation request with custom action
 */
export const customAnimationRequest: AnimationRequest = {
  characterId: 'char-123',
  templateAnimationId: 'walking',
  actionDescription: 'walking stealthily through shadows',
};

/**
 * Animation request with custom name
 */
export const namedAnimationRequest: AnimationRequest = {
  characterId: 'char-123',
  templateAnimationId: 'running-8-frames',
  animationName: 'Sprint Animation',
};

// =============================================================================
// API Responses - Character Data
// =============================================================================

/**
 * Completed 4-directional character response
 */
export const character4DirectionResponse = {
  id: 'char-4dir-123',
  name: 'Test Warrior',
  created: '2025-01-15T10:00:00Z',
  specifications: {
    directions: 4,
    canvas_size: '48x48',
    view: 'low top-down',
  },
  style: {
    outline: 'single color black outline',
    shading: 'basic shading',
    detail: 'medium detail',
  },
  rotations: [
    {
      direction: 'south',
      url: 'https://example.com/char-4dir-123/south.png',
    },
    { direction: 'west', url: 'https://example.com/char-4dir-123/west.png' },
    { direction: 'east', url: 'https://example.com/char-4dir-123/east.png' },
    {
      direction: 'north',
      url: 'https://example.com/char-4dir-123/north.png',
    },
  ],
  animations: [],
  download_url: 'https://example.com/characters/char-4dir-123/download.zip',
};

/**
 * Completed 8-directional character response
 */
export const character8DirectionResponse = {
  id: 'char-8dir-456',
  name: 'Test Dragon',
  created: '2025-01-15T11:00:00Z',
  specifications: {
    directions: 8,
    canvas_size: '64x64',
    view: 'low top-down',
  },
  style: {
    outline: 'single color black outline',
    shading: 'detailed shading',
    detail: 'high detail',
  },
  rotations: [
    {
      direction: 'south',
      url: 'https://example.com/char-8dir-456/south.png',
    },
    { direction: 'west', url: 'https://example.com/char-8dir-456/west.png' },
    { direction: 'east', url: 'https://example.com/char-8dir-456/east.png' },
    {
      direction: 'north',
      url: 'https://example.com/char-8dir-456/north.png',
    },
    {
      direction: 'south-east',
      url: 'https://example.com/char-8dir-456/south-east.png',
    },
    {
      direction: 'north-east',
      url: 'https://example.com/char-8dir-456/north-east.png',
    },
    {
      direction: 'north-west',
      url: 'https://example.com/char-8dir-456/north-west.png',
    },
    {
      direction: 'south-west',
      url: 'https://example.com/char-8dir-456/south-west.png',
    },
  ],
  animations: [],
  download_url: 'https://example.com/characters/char-8dir-456/download.zip',
};

// =============================================================================
// Base64 PNG Samples
// =============================================================================

/**
 * Valid 1x1 red PNG (base64)
 */
export const validBase64Png =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

/**
 * Valid 48x48 transparent PNG (base64) - minimal valid sprite
 */
export const validSpritePng =
  'iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH5QEPCgAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAABlBMVEX///8AAABVwtN+AAAAAWJLR0QB/wIt3gAAAAlwSFlzAAALEwAACxMBAJqcGAAAAAd0SU1FB+UBDwoAAABkAAAAJXRFWHRkYXRlOmNyZWF0ZQAyMDI1LTAxLTE1VDEwOjAwOjAwKzAwOjAwLqpoGwAAACV0RVh0ZGF0ZTptb2RpZnkAMjAyNS0wMS0xNVQxMDowMDowMCswMDowMF/30qcAAAAASUVORK5CYII=';

/**
 * Invalid base64 string (not valid image)
 */
export const invalidBase64 = 'not-valid-base64!!!';

// =============================================================================
// Error Response Samples
// =============================================================================

/**
 * 401 Authentication error response
 */
export const authenticationError = {
  status: 401,
  data: {
    detail: 'Invalid API key',
  },
  errorType: PixelLabErrorType.AUTHENTICATION,
};

/**
 * 422 Validation error response
 */
export const validationError = {
  status: 422,
  data: {
    detail: [
      {
        loc: ['body', 'description'],
        msg: 'String should have at least 1 character',
        type: 'string_too_short',
      },
    ],
  },
  errorType: PixelLabErrorType.VALIDATION,
};

/**
 * 429 Rate limit error response
 */
export const rateLimitError = {
  status: 429,
  data: {
    detail: 'Rate limit exceeded',
  },
  headers: {
    'retry-after': '60',
  },
  errorType: PixelLabErrorType.RATE_LIMIT,
};

/**
 * 500 Server error response
 */
export const serverError = {
  status: 500,
  data: {
    detail: 'Internal server error',
  },
  errorType: PixelLabErrorType.API_ERROR,
};

/**
 * Network timeout error
 */
export const timeoutError = {
  code: 'ECONNABORTED',
  message: 'timeout of 30000ms exceeded',
  errorType: PixelLabErrorType.NETWORK,
};

/**
 * Invalid parameter error response
 */
export const invalidParameterError = {
  status: 422,
  data: {
    detail: [
      {
        loc: ['body', 'size'],
        msg: 'Input should be greater than or equal to 32',
        type: 'greater_than_equal',
      },
    ],
  },
  errorType: PixelLabErrorType.VALIDATION,
};

// =============================================================================
// API Key Samples
// =============================================================================

/**
 * Valid API key format (UUID v4)
 */
export const validApiKey = 'c1994b12-b97e-4b29-9991-180e3a0ebe55';

/**
 * Another valid API key
 */
export const validApiKey2 = '550e8400-e29b-41d4-a716-446655440000';

/**
 * Invalid API key - wrong format
 */
export const invalidApiKey = 'not-a-valid-api-key';

/**
 * Invalid API key - empty string
 */
export const emptyApiKey = '';

// =============================================================================
// Balance Response Samples
// =============================================================================

/**
 * Balance response with credits
 */
export const balanceResponse = {
  credits: 1000,
};

/**
 * Balance response with low credits
 */
export const lowBalanceResponse = {
  credits: 10,
};

/**
 * Balance response with zero credits
 */
export const zeroBalanceResponse = {
  credits: 0,
};

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a custom character request
 *
 * @param overrides - Fields to override in the minimal request
 * @returns Custom character request
 */
export function createCharacterRequest(
  overrides: Partial<GenerationRequest> = {}
): GenerationRequest {
  return {
    ...minimalCharacterRequest,
    ...overrides,
  };
}

/**
 * Create a custom animation request
 *
 * @param overrides - Fields to override in the basic request
 * @returns Custom animation request
 */
export function createAnimationRequest(
  overrides: Partial<AnimationRequest> = {}
): AnimationRequest {
  return {
    ...basicAnimationRequest,
    ...overrides,
  };
}

/**
 * Create a custom character response
 *
 * @param characterId - Character ID
 * @param nDirections - Number of directions (4 or 8)
 * @param overrides - Additional fields to override
 * @returns Custom character response
 */
export function createCharacterResponse(
  characterId: string,
  nDirections: 4 | 8 = 8,
  overrides: any = {}
): any {
  const base =
    nDirections === 4
      ? character4DirectionResponse
      : character8DirectionResponse;

  return {
    ...base,
    id: characterId,
    ...overrides,
  };
}

/**
 * Create a custom error response
 *
 * @param statusCode - HTTP status code
 * @param message - Error message
 * @returns Custom error response
 */
export function createErrorResponse(
  statusCode: number,
  message: string
): any {
  return {
    status: statusCode,
    data: {
      detail: message,
    },
  };
}
