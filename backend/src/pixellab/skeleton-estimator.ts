import { HttpClient } from './http-client';

/**
 * Skeleton keypoint with label and z-index
 */
export interface Keypoint {
  x: number;
  y: number;
  label: string;
  z_index: number;
}

/**
 * Skeleton estimation response
 */
export interface SkeletonEstimation {
  /** Array of skeleton keypoints */
  keypoints: Keypoint[];
}

/**
 * Skeleton Estimator for PixelLab API
 *
 * Estimates skeleton keypoints from a sprite image
 */
export class SkeletonEstimator {
  constructor(private readonly httpClient: HttpClient) {}

  /**
   * Estimate skeleton keypoints from sprite image
   *
   * @param imageBase64 - Base64-encoded sprite image
   * @returns Skeleton keypoints
   */
  public async estimateSkeleton(imageBase64: string): Promise<SkeletonEstimation> {
    const response = await this.httpClient.axiosInstance.post<{
      keypoints: Array<{
        x: number;
        y: number;
        label: string;
        z_index: number;
      }>;
    }>('/v1/estimate-skeleton', {
      image: {
        type: 'base64',
        base64: imageBase64,
        format: 'png'
      }
    });

    return {
      keypoints: response.data.keypoints
    };
  }
}
