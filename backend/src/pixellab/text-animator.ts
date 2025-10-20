import { HttpClient } from './http-client';

/**
 * Text-based animation request
 */
export interface TextAnimationRequest {
  /** Character description */
  description: string;

  /** Action to animate (e.g., "walk", "attack", "idle") */
  action: string;

  /** Reference sprite image (base64) */
  referenceImage: string;

  /** Number of animation frames (default 4) */
  nFrames?: number;

  /** Camera view angle */
  view?: 'side' | 'low top-down' | 'high top-down';

  /** Character direction */
  direction?: 'north' | 'south' | 'east' | 'west' | 'north-east' | 'north-west' | 'south-east' | 'south-west';

  /** Text guidance scale */
  textGuidanceScale?: number;
}

/**
 * Text animation response from PixelLab API
 */
export interface TextAnimationResponse {
  /** Array of animation frame images (base64) */
  frames: string[];

  /** Cost in USD */
  costUsd: number;
}

/**
 * Text-Based Animator for PixelLab API
 *
 * Generates animation frames from text descriptions without skeleton estimation
 */
export class TextAnimator {
  constructor(private readonly httpClient: HttpClient) {}

  /**
   * Generate animation frames from text description
   *
   * @param request - Animation parameters
   * @returns Animation frames and cost
   */
  public async animateWithText(request: TextAnimationRequest): Promise<TextAnimationResponse> {
    const response = await this.httpClient.axiosInstance.post<{
      usage: {
        type: 'usd';
        usd: number;
      };
      images: Array<{
        type: 'base64';
        base64: string;
      }>;
    }>('/v1/animate-with-text', {
      description: request.description,
      action: request.action,
      image_size: {
        width: 64,
        height: 64
      },
      reference_image: {
        type: 'base64',
        base64: request.referenceImage,
        format: 'png'
      },
      n_frames: request.nFrames || 4,
      view: request.view || 'side',
      direction: request.direction || 'east',
      text_guidance_scale: request.textGuidanceScale || 8.0
    });

    return {
      frames: response.data.images.map(img => img.base64),
      costUsd: response.data.usage.usd
    };
  }
}
