import { PixelLabError, PixelLabErrorType } from './errors';

/**
 * Direction names for multi-directional sprites
 */
export type DirectionName =
  | 'north'
  | 'north-east'
  | 'east'
  | 'south-east'
  | 'south'
  | 'south-west'
  | 'west'
  | 'north-west';

/**
 * Single direction result with image buffer
 */
export interface DirectionResult {
  direction: DirectionName;
  url: string;
  buffer: Buffer;
}

/**
 * Character specifications (converted to camelCase)
 */
export interface CharacterSpecifications {
  directions: 4 | 8;
  canvasSize: string;
  view: string;
}

/**
 * Character style (converted to camelCase)
 */
export interface CharacterStyle {
  outline: string;
  shading: string;
  detail: string;
}

/**
 * Complete generation result
 */
export interface GenerationResult {
  characterId: string;
  name: string | null;
  created: string;
  specifications: CharacterSpecifications;
  style: CharacterStyle;
  directions: DirectionResult[];
  downloadUrl: string;
}

/**
 * API character data (snake_case from API)
 */
export interface ApiCharacterData {
  id: string;
  name: string | null;
  created: string;
  specifications: {
    directions: 4 | 8;
    canvas_size: string;
    view: string;
  };
  style: {
    outline: string;
    shading: string;
    detail: string;
  };
  rotations: Array<{
    direction: DirectionName;
    url: string;
  }>;
  download_url: string;
}

/**
 * Result builder input
 */
export interface ResultBuilderInput {
  characterData: ApiCharacterData;
  images: Buffer[];
}

/**
 * Result Builder for PixelLab API
 *
 * Constructs GenerationResult objects from API responses and decoded images.
 * Converts API snake_case to camelCase and combines metadata with image buffers.
 */
export class ResultBuilder {
  /**
   * Build generation result from API data and images
   *
   * @param input - Character data and decoded image buffers
   * @returns Complete generation result
   * @throws {PixelLabError} If data is invalid or inconsistent
   */
  public static buildResult(input: ResultBuilderInput): GenerationResult {
    const { characterData, images } = input;

    // Validate inputs
    this.validateInput(characterData, images);

    // Build direction results by combining API data with buffers
    const directions: DirectionResult[] = characterData.rotations.map((rotation, index) => {
      const buffer = images[index];
      if (!buffer) {
        throw new PixelLabError({
          type: PixelLabErrorType.INVALID_REQUEST,
          message: `Missing image buffer at index ${index}`,
          retryable: false,
        });
      }
      return {
        direction: rotation.direction,
        url: rotation.url,
        buffer,
      };
    });

    // Convert to camelCase and return
    return {
      characterId: characterData.id,
      name: characterData.name,
      created: characterData.created,
      specifications: {
        directions: characterData.specifications.directions,
        canvasSize: characterData.specifications.canvas_size,
        view: characterData.specifications.view,
      },
      style: {
        outline: characterData.style.outline,
        shading: characterData.style.shading,
        detail: characterData.style.detail,
      },
      directions,
      downloadUrl: characterData.download_url,
    };
  }

  /**
   * Validate input data
   */
  private static validateInput(characterData: ApiCharacterData, images: Buffer[]): void {
    // Check for empty images
    if (!images || images.length === 0) {
      throw new PixelLabError({
        type: PixelLabErrorType.INVALID_REQUEST,
        message: 'At least one image is required',
        retryable: false,
      });
    }

    // Check count mismatch
    if (images.length !== characterData.rotations.length) {
      throw new PixelLabError({
        type: PixelLabErrorType.INVALID_REQUEST,
        message: `Image count mismatch: expected ${characterData.rotations.length} images, got ${images.length}`,
        retryable: false,
      });
    }

    // Validate each buffer is valid
    images.forEach((buffer, index) => {
      if (!Buffer.isBuffer(buffer)) {
        throw new PixelLabError({
          type: PixelLabErrorType.INVALID_REQUEST,
          message: `Invalid buffer at index ${index}`,
          retryable: false,
        });
      }
    });
  }
}
