import { HttpClient } from './http-client.js';

/**
 * Skeleton animation request parameters
 */
export interface SkeletonAnimationRequest {
  /** Text description of the character */
  description: string;

  /** Action to animate (e.g., "walking", "attacking") */
  action: string;

  /** Number of frames to generate (default: 4) */
  nFrames?: number;

  /** View angle (default: "side") */
  view?: 'side' | 'front' | '3/4';
}

/**
 * Skeleton animation response
 */
export interface SkeletonAnimationResponse {
  /** Array of base64-encoded PNG frame images */
  frames: string[];

  /** Cost in USD */
  costUsd: number;
}

/**
 * Skeleton Animator for PixelLab API
 *
 * Generates animated sprites from text descriptions without requiring a reference image.
 * Uses the /animate-skeleton endpoint.
 */
export class SkeletonAnimator {
  constructor(private readonly httpClient: HttpClient) {}

  /**
   * Generate animated sprite from text description
   *
   * @param request - Animation parameters
   * @returns Array of animation frames as base64 PNG images
   */
  public async animateFromText(
    request: SkeletonAnimationRequest
  ): Promise<SkeletonAnimationResponse> {
    const response = await this.httpClient.axiosInstance.post<{
      frames: string[];
      cost_usd: number;
    }>('/animate-skeleton', {
      description: request.description,
      action: request.action,
      n_frames: request.nFrames || 4,
      view: request.view || 'side'
    });

    return {
      frames: response.data.frames,
      costUsd: response.data.cost_usd
    };
  }
}
