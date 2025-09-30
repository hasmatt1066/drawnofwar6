import { HttpClient } from './http-client';
import { GenerationRequest, RequestValidator } from './request-validator';

/**
 * Job submission response from PixelLab API
 */
export interface JobSubmissionResponse {
  /** Character ID for polling status */
  characterId: string;

  /** Optional character name */
  name: string | null;
}

/**
 * API request payload (snake_case for API)
 */
interface ApiGenerationPayload {
  description: string;
  size: number;
  detail?: string;
  shading?: string;
  outline?: string;
  view?: string;
  n_directions?: number;
  ai_freedom?: number;
  text_guidance_scale?: number;
  init_image?: string;
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
   * Submit sprite generation request
   *
   * @param request - Generation parameters
   * @returns Job submission response with character ID
   * @throws {PixelLabError} If request is invalid or submission fails
   */
  public async submitGeneration(request: GenerationRequest): Promise<JobSubmissionResponse> {
    // Validate request parameters
    RequestValidator.validateGenerationRequest(request);

    // Convert to API payload format (camelCase -> snake_case)
    const payload = this.buildApiPayload(request);

    // Submit request to API
    const response = await this.httpClient.axiosInstance.post<{
      character_id: string;
      name: string | null;
    }>('/v1/characters', payload);

    // Parse and return response
    return {
      characterId: response.data.character_id,
      name: response.data.name,
    };
  }

  /**
   * Build API payload from request
   * Converts camelCase to snake_case and includes only defined fields
   */
  private buildApiPayload(request: GenerationRequest): ApiGenerationPayload {
    const payload: ApiGenerationPayload = {
      description: request.description,
      size: request.size,
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

    if (request.nDirections !== undefined) {
      payload.n_directions = request.nDirections;
    }

    if (request.aiFreedom !== undefined) {
      payload.ai_freedom = request.aiFreedom;
    }

    if (request.textGuidanceScale !== undefined) {
      payload.text_guidance_scale = request.textGuidanceScale;
    }

    if (request.initImage !== undefined) {
      payload.init_image = request.initImage;
    }

    return payload;
  }
}
