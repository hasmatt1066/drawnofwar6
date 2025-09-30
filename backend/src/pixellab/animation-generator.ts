import { HttpClient } from './http-client';
import { PixelLabError, PixelLabErrorType } from './errors';

/**
 * Animation request parameters
 */
export interface AnimationRequest {
  /** Character ID to animate */
  characterId: string;

  /** Template animation ID (e.g., 'walking', 'running-4-frames', 'jumping-1') */
  templateAnimationId: string;

  /** Optional custom action description */
  actionDescription?: string;

  /** Optional custom name for the animation */
  animationName?: string;
}

/**
 * Animation submission response
 */
export interface AnimationResponse {
  /** Character ID */
  characterId: string;

  /** Created animation ID */
  animationId: string;

  /** Job IDs for each direction being processed */
  jobIds: string[];
}

/**
 * API request payload (snake_case for API)
 */
interface ApiAnimationPayload {
  template_animation_id: string;
  action_description?: string;
  animation_name?: string;
}

/**
 * Animation Generator for PixelLab API
 *
 * Handles submission of animation generation requests to existing characters.
 * Animations are created via POST /v1/characters/:id/animations endpoint.
 */
export class AnimationGenerator {
  constructor(private readonly httpClient: HttpClient) {}

  /**
   * Submit animation generation request
   *
   * @param request - Animation parameters
   * @returns Animation submission response with job IDs
   * @throws {PixelLabError} If request is invalid or submission fails
   */
  public async submitAnimation(request: AnimationRequest): Promise<AnimationResponse> {
    // Validate request
    this.validateRequest(request);

    // Build API payload
    const payload = this.buildApiPayload(request);

    // Submit request to API
    const response = await this.httpClient.axiosInstance.post<{
      character_id: string;
      animation_id: string;
      job_ids: string[];
    }>(`/v1/characters/${request.characterId}/animations`, payload);

    // Parse and return response
    return {
      characterId: response.data.character_id,
      animationId: response.data.animation_id,
      jobIds: response.data.job_ids,
    };
  }

  /**
   * Validate animation request
   */
  private validateRequest(request: AnimationRequest): void {
    // Validate character ID
    if (!request.characterId || typeof request.characterId !== 'string' || request.characterId.trim() === '') {
      throw new PixelLabError({
        type: PixelLabErrorType.INVALID_REQUEST,
        message: 'Character ID is required',
        retryable: false,
      });
    }

    // Validate template animation ID
    if (!request.templateAnimationId || typeof request.templateAnimationId !== 'string' || request.templateAnimationId.trim() === '') {
      throw new PixelLabError({
        type: PixelLabErrorType.INVALID_REQUEST,
        message: 'Template animation ID is required',
        retryable: false,
      });
    }
  }

  /**
   * Build API payload from request
   * Converts camelCase to snake_case
   */
  private buildApiPayload(request: AnimationRequest): ApiAnimationPayload {
    const payload: ApiAnimationPayload = {
      template_animation_id: request.templateAnimationId,
    };

    // Add optional fields if present
    if (request.actionDescription !== undefined) {
      payload.action_description = request.actionDescription;
    }

    if (request.animationName !== undefined) {
      payload.animation_name = request.animationName;
    }

    return payload;
  }
}
