import { PixelLabError, PixelLabErrorType } from './errors';

/**
 * Valid image sizes supported by PixelLab API (minimum 32px based on API testing)
 */
export const VALID_SIZES = [32, 48, 64, 128] as const;
export type ValidSize = typeof VALID_SIZES[number];

/**
 * Detail level options
 */
export type DetailLevel = 'low detail' | 'medium detail' | 'high detail';

/**
 * Shading complexity options
 */
export type ShadingLevel = 'flat shading' | 'basic shading' | 'medium shading' | 'detailed shading';

/**
 * Outline style options
 */
export type OutlineStyle = 'single color black outline' | 'single color outline' | 'selective outline' | 'lineless';

/**
 * Camera view angle options
 */
export type ViewAngle = 'low top-down' | 'high top-down' | 'side';

/**
 * Number of directional views (4 or 8)
 */
export type DirectionCount = 4 | 8;

/**
 * Generation request parameters
 */
export interface GenerationRequest {
  /** Text description of character/sprite */
  description: string;

  /** Canvas size in pixels (32, 48, 64, or 128) */
  size: ValidSize;

  /** Detail level (optional) */
  detail?: DetailLevel;

  /** Shading complexity (optional) */
  shading?: ShadingLevel;

  /** Outline style (optional) */
  outline?: OutlineStyle;

  /** Camera angle (optional) */
  view?: ViewAngle;

  /** Number of directional views (optional, default 8) */
  nDirections?: DirectionCount;

  /** AI creative freedom 100-999 (optional) */
  aiFreedom?: number;

  /** Text guidance scale 1.0-20.0 (optional) */
  textGuidanceScale?: number;

  /** Base64 PNG init image (optional) */
  initImage?: string;
}

/**
 * Request Validator for PixelLab API
 *
 * Validates generation request parameters before submission to ensure:
 * - Required fields are present
 * - Types are correct
 * - Values are within valid ranges
 * - Enums match allowed values
 */
export class RequestValidator {
  /**
   * Valid detail levels
   */
  private static readonly VALID_DETAILS: readonly DetailLevel[] = ['low detail', 'medium detail', 'high detail'];

  /**
   * Valid shading levels
   */
  private static readonly VALID_SHADING: readonly ShadingLevel[] = [
    'flat shading',
    'basic shading',
    'medium shading',
    'detailed shading',
  ];

  /**
   * Valid outline styles
   */
  private static readonly VALID_OUTLINES: readonly OutlineStyle[] = [
    'single color black outline',
    'single color outline',
    'selective outline',
    'lineless',
  ];

  /**
   * Valid view angles
   */
  private static readonly VALID_VIEWS: readonly ViewAngle[] = ['low top-down', 'high top-down', 'side'];

  /**
   * Valid direction counts
   */
  private static readonly VALID_DIRECTIONS: readonly DirectionCount[] = [4, 8];

  /**
   * AI freedom range
   */
  private static readonly AI_FREEDOM_MIN = 100;
  private static readonly AI_FREEDOM_MAX = 999;

  /**
   * Text guidance scale range
   */
  private static readonly TEXT_GUIDANCE_MIN = 1.0;
  private static readonly TEXT_GUIDANCE_MAX = 20.0;

  /**
   * Validate generation request
   *
   * @param request - Request to validate
   * @throws {PixelLabError} If validation fails
   */
  public static validateGenerationRequest(request: GenerationRequest): void {
    // Validate description
    this.validateDescription(request.description);

    // Validate size
    this.validateSize(request.size);

    // Validate optional fields if present
    if (request.detail !== undefined) {
      this.validateDetail(request.detail);
    }

    if (request.shading !== undefined) {
      this.validateShading(request.shading);
    }

    if (request.outline !== undefined) {
      this.validateOutline(request.outline);
    }

    if (request.view !== undefined) {
      this.validateView(request.view);
    }

    if (request.nDirections !== undefined) {
      this.validateDirections(request.nDirections);
    }

    if (request.aiFreedom !== undefined) {
      this.validateAiFreedom(request.aiFreedom);
    }

    if (request.textGuidanceScale !== undefined) {
      this.validateTextGuidanceScale(request.textGuidanceScale);
    }

    if (request.initImage !== undefined) {
      this.validateBase64Image(request.initImage);
    }
  }

  /**
   * Validate description field
   */
  private static validateDescription(description: any): void {
    if (!description || typeof description !== 'string') {
      throw new PixelLabError({
        type: PixelLabErrorType.INVALID_REQUEST,
        message: 'Description is required and must be a non-empty string',
        retryable: false,
      });
    }

    if (description.trim().length === 0) {
      throw new PixelLabError({
        type: PixelLabErrorType.INVALID_REQUEST,
        message: 'Description cannot be empty or whitespace-only',
        retryable: false,
      });
    }
  }

  /**
   * Validate size field
   */
  private static validateSize(size: any): void {
    if (typeof size !== 'number') {
      throw new PixelLabError({
        type: PixelLabErrorType.INVALID_REQUEST,
        message: 'Size must be a number',
        retryable: false,
      });
    }

    if (!VALID_SIZES.includes(size as ValidSize)) {
      throw new PixelLabError({
        type: PixelLabErrorType.INVALID_REQUEST,
        message: `Size must be one of: ${VALID_SIZES.join(', ')}`,
        retryable: false,
      });
    }
  }

  /**
   * Validate detail level
   */
  private static validateDetail(detail: any): void {
    if (!this.VALID_DETAILS.includes(detail)) {
      throw new PixelLabError({
        type: PixelLabErrorType.INVALID_REQUEST,
        message: `Detail must be one of: ${this.VALID_DETAILS.join(', ')}`,
        retryable: false,
      });
    }
  }

  /**
   * Validate shading level
   */
  private static validateShading(shading: any): void {
    if (!this.VALID_SHADING.includes(shading)) {
      throw new PixelLabError({
        type: PixelLabErrorType.INVALID_REQUEST,
        message: `Shading must be one of: ${this.VALID_SHADING.join(', ')}`,
        retryable: false,
      });
    }
  }

  /**
   * Validate outline style
   */
  private static validateOutline(outline: any): void {
    if (!this.VALID_OUTLINES.includes(outline)) {
      throw new PixelLabError({
        type: PixelLabErrorType.INVALID_REQUEST,
        message: `Outline must be one of: ${this.VALID_OUTLINES.join(', ')}`,
        retryable: false,
      });
    }
  }

  /**
   * Validate view angle
   */
  private static validateView(view: any): void {
    if (!this.VALID_VIEWS.includes(view)) {
      throw new PixelLabError({
        type: PixelLabErrorType.INVALID_REQUEST,
        message: `View must be one of: ${this.VALID_VIEWS.join(', ')}`,
        retryable: false,
      });
    }
  }

  /**
   * Validate direction count
   */
  private static validateDirections(directions: any): void {
    if (!this.VALID_DIRECTIONS.includes(directions)) {
      throw new PixelLabError({
        type: PixelLabErrorType.INVALID_REQUEST,
        message: `Directions must be 4 or 8`,
        retryable: false,
      });
    }
  }

  /**
   * Validate AI freedom parameter
   */
  private static validateAiFreedom(aiFreedom: any): void {
    if (typeof aiFreedom !== 'number') {
      throw new PixelLabError({
        type: PixelLabErrorType.INVALID_REQUEST,
        message: 'AI freedom must be a number',
        retryable: false,
      });
    }

    if (aiFreedom < this.AI_FREEDOM_MIN || aiFreedom > this.AI_FREEDOM_MAX) {
      throw new PixelLabError({
        type: PixelLabErrorType.INVALID_REQUEST,
        message: `AI freedom must be between ${this.AI_FREEDOM_MIN} and ${this.AI_FREEDOM_MAX}`,
        retryable: false,
      });
    }
  }

  /**
   * Validate text guidance scale parameter
   */
  private static validateTextGuidanceScale(scale: any): void {
    if (typeof scale !== 'number') {
      throw new PixelLabError({
        type: PixelLabErrorType.INVALID_REQUEST,
        message: 'Text guidance scale must be a number',
        retryable: false,
      });
    }

    if (scale < this.TEXT_GUIDANCE_MIN || scale > this.TEXT_GUIDANCE_MAX) {
      throw new PixelLabError({
        type: PixelLabErrorType.INVALID_REQUEST,
        message: `Text guidance scale must be between ${this.TEXT_GUIDANCE_MIN} and ${this.TEXT_GUIDANCE_MAX}`,
        retryable: false,
      });
    }
  }

  /**
   * Validate base64 image string
   */
  private static validateBase64Image(image: any): void {
    if (typeof image !== 'string') {
      throw new PixelLabError({
        type: PixelLabErrorType.INVALID_REQUEST,
        message: 'Init image must be a string',
        retryable: false,
      });
    }

    // Check if valid base64 format
    const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Pattern.test(image)) {
      throw new PixelLabError({
        type: PixelLabErrorType.INVALID_REQUEST,
        message: 'Invalid base64 image format',
        retryable: false,
      });
    }

    // Check if can be decoded
    try {
      // Node.js Buffer approach
      if (typeof Buffer !== 'undefined') {
        Buffer.from(image, 'base64');
      } else {
        // Browser atob approach
        atob(image);
      }
    } catch {
      throw new PixelLabError({
        type: PixelLabErrorType.INVALID_REQUEST,
        message: 'Invalid base64 image format',
        retryable: false,
      });
    }
  }
}
