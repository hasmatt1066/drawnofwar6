import { HttpClient } from './http-client';
import { GenerationRequest, RequestValidator } from './request-validator';

/**
 * Generation response from PixelLab API
 */
export interface GenerationResponse {
  /** Base64-encoded generated sprite image */
  imageBase64: string;

  /** Cost in USD */
  costUsd: number;
}

/**
 * API request payload (snake_case for API)
 */
interface ApiGenerationPayload {
  description: string;
  image_size: {
    width: number;
    height: number;
  };
  detail?: string;
  shading?: string;
  outline?: string;
  view?: string;
  direction?: string;
  text_guidance_scale?: number;
  init_image?: string;
  init_image_strength?: number;
  no_background?: boolean;
}

/**
 * Sprite Generator for PixelLab API
 *
 * Handles submission of sprite generation requests to the
 * /v1/characters endpoint with proper validation and error handling.
 */
export class SpriteGenerator {
  constructor(private readonly httpClient: HttpClient) {}

  /**
   * Submit sprite generation request and get result immediately
   *
   * @param request - Generation parameters
   * @returns Generation response with base64 image
   * @throws {PixelLabError} If request is invalid or generation fails
   */
  public async submitGeneration(request: GenerationRequest): Promise<GenerationResponse> {
    // Validate request parameters
    RequestValidator.validateGenerationRequest(request);

    // Convert to API payload format (camelCase -> snake_case)
    const payload = this.buildApiPayload(request);

    // Submit request to API (synchronous - returns image directly)
    const response = await this.httpClient.axiosInstance.post<{
      usage: {
        type: 'usd';
        usd: number;
      };
      image: {
        type: 'base64';
        base64: string;
      };
    }>('/v1/generate-image-pixflux', payload);

    // Parse and return response
    return {
      imageBase64: response.data.image.base64,
      costUsd: response.data.usage.usd,
    };
  }

  /**
   * Build API payload from request
   * Converts camelCase to snake_case and includes only defined fields
   */
  private buildApiPayload(request: GenerationRequest): ApiGenerationPayload {
    const payload: ApiGenerationPayload = {
      description: request.description,
      image_size: {
        width: request.size,
        height: request.size
      },
    };

    // Add optional fields if present
    if (request.detail !== undefined) {
      payload.detail = request.detail;
    }

    if (request.shading !== undefined) {
      payload.shading = request.shading;
    }

    if (request.outline !== undefined) {
      payload.outline = request.outline;
    }

    if (request.view !== undefined) {
      payload.view = request.view;
    }

    if (request.textGuidanceScale !== undefined) {
      payload.text_guidance_scale = request.textGuidanceScale;
    }

    if (request.initImage !== undefined) {
      payload.init_image = request.initImage;
      // When using init_image, set strength (default 300 in API)
      payload.init_image_strength = 300;
    }

    if (request.noBackground !== undefined) {
      payload.no_background = request.noBackground;
    }

    return payload;
  }
}
