import { HttpClient } from './http-client';

/**
 * Direction options for sprite rotation (PixelLab API format - with hyphens for diagonals)
 */
export type Direction = 'north' | 'north-east' | 'east' | 'south-east' | 'south' | 'south-west' | 'west' | 'north-west';

/**
 * View options for sprite rotation (CameraView from PixelLab API)
 */
export type View = 'side' | 'low top-down' | 'high top-down';

/**
 * Rotate sprite request
 */
export interface RotateRequest {
  /** Reference sprite image (base64) */
  referenceImage: string;

  /** Starting view angle */
  fromView?: View;

  /** Target view angle */
  toView?: View;

  /** Starting direction */
  fromDirection?: Direction;

  /** Target direction */
  toDirection?: Direction;

  /** View angle change in degrees (-90 to 90) */
  viewChange?: number;

  /** Direction angle change in degrees (-180 to 180) */
  directionChange?: number;

  /** Use isometric projection */
  isometric?: boolean;

  /** Use oblique projection */
  obliqueProjection?: boolean;

  /** Image guidance scale (1.0-20.0, default 3.0) */
  imageGuidanceScale?: number;

  /** Init image strength (1-999, default 300) */
  initImageStrength?: number;
}

/**
 * Rotate sprite response from PixelLab API
 */
export interface RotateResponse {
  /** Rotated sprite image (base64) */
  imageBase64: string;

  /** Cost in USD */
  costUsd: number;
}

/**
 * Sprite Rotation Service for PixelLab API
 *
 * Generates consistent multi-directional sprites using the /v1/rotate endpoint
 */
export class RotateSprite {
  constructor(private readonly httpClient: HttpClient) {}

  /**
   * Rotate sprite to a new direction or view
   *
   * @param request - Rotation parameters
   * @returns Rotated sprite and cost
   */
  public async rotateSprite(request: RotateRequest): Promise<RotateResponse> {
    const response = await this.httpClient.axiosInstance.post<{
      usage: {
        type: 'usd';
        usd: number;
      };
      image: {
        type: 'base64';
        base64: string;
      };
    }>('/v1/rotate', {
      image_size: {
        width: 64,
        height: 64
      },
      from_image: {
        type: 'base64',
        base64: request.referenceImage
      },
      from_view: request.fromView || 'side',
      to_view: request.toView || 'low top-down',
      from_direction: request.fromDirection || 'south',
      to_direction: request.toDirection || 'east',
      view_change: request.viewChange,
      direction_change: request.directionChange,
      isometric: request.isometric || false,
      oblique_projection: request.obliqueProjection || false,
      image_guidance_scale: request.imageGuidanceScale || 3.0,
      init_image_strength: request.initImageStrength || 300
    });

    return {
      imageBase64: response.data.image.base64,
      costUsd: response.data.usage.usd
    };
  }

  /**
   * Helper: Rotate from side view to top-down view for a specific direction
   *
   * @param referenceImage - Base64 reference sprite (side view)
   * @param direction - Target direction (north, northeast, east, etc.)
   * @returns Rotated sprite in top-down view
   */
  public async rotateToTopDown(
    referenceImage: string,
    direction: Direction
  ): Promise<RotateResponse> {
    return this.rotateSprite({
      referenceImage,
      fromView: 'side',
      toView: 'low top-down',  // Low top-down provides angled battlefield perspective
      fromDirection: 'south', // Side view typically faces south
      toDirection: direction,
      isometric: true // Enable isometric projection for tactical game view
    });
  }
}
