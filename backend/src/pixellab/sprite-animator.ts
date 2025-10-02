import { HttpClient } from './http-client';
import type { Keypoint } from './skeleton-estimator';

/**
 * Animation request parameters
 */
export interface AnimationRequest {
  /** Image size (width x height) */
  size: number;

  /** Reference sprite image (base64) */
  referenceImage: string;

  /** Skeleton keypoints from estimator */
  skeletonKeypoints: Keypoint[];

  /** Camera view angle */
  view?: 'side' | 'low top-down' | 'high top-down';

  /** Character direction */
  direction?: 'north' | 'south' | 'east' | 'west' | 'northeast' | 'northwest' | 'southeast' | 'southwest';

  /** Guidance scale for animation quality */
  guidanceScale?: number;
}

/**
 * Animation response from PixelLab API
 */
export interface AnimationResponse {
  /** Array of animation frame images (base64) */
  frames: string[];

  /** Cost in USD */
  costUsd: number;
}

/**
 * Sprite Animator for PixelLab API
 *
 * Generates animation frames from a sprite with skeleton keypoints
 */
export class SpriteAnimator {
  constructor(private readonly httpClient: HttpClient) {}

  /**
   * Generate animation frames for sprite
   *
   * @param request - Animation parameters
   * @returns Animation frames and cost
   */
  public async animateSprite(request: AnimationRequest): Promise<AnimationResponse> {
    const response = await this.httpClient.axiosInstance.post<{
      usage: {
        type: 'usd';
        usd: number;
      };
      images: Array<{
        type: 'base64';
        base64: string;
      }>;
    }>('/animate-with-skeleton', {
      image_size: {
        width: request.size,
        height: request.size
      },
      reference_image: {
        type: 'base64',
        base64: request.referenceImage,
        format: 'png'
      },
      skeleton_keypoints: request.skeletonKeypoints,
      view: request.view || 'side',
      direction: request.direction || 'east',
      guidance_scale: request.guidanceScale || 4.0
    });

    return {
      frames: response.data.images.map(img => img.base64),
      costUsd: response.data.usage.usd
    };
  }
}
