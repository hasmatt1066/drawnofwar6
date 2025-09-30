import { HttpClient } from './http-client';
import { StatusParser, JobStatus, JobStatusResponse } from './status-parser';
import { PixelLabError, PixelLabErrorType } from './errors';

/**
 * Polling configuration
 */
export interface PollingConfig {
  /** Maximum number of polling attempts before timeout (default: 60) */
  maxAttempts?: number;

  /** Initial polling interval in milliseconds (default: 5000 = 5s) */
  initialInterval?: number;
}

/**
 * Status Poller for PixelLab API
 *
 * Polls character status endpoint until generation is complete or fails.
 * Uses Retry-After header from API to determine polling intervals.
 */
export class StatusPoller {
  /**
   * Default configuration
   */
  private static readonly DEFAULT_CONFIG: Required<PollingConfig> = {
    maxAttempts: 60, // Up to 60 polls (5 min at 5s intervals)
    initialInterval: 5000, // 5 seconds
  };

  constructor(private readonly httpClient: HttpClient) {}

  /**
   * Poll character status until complete or failed
   *
   * @param characterId - Character ID to poll
   * @param config - Polling configuration
   * @returns Final status response when completed
   * @throws {PixelLabError} If polling fails or times out
   */
  public async pollUntilComplete(
    characterId: string,
    config?: PollingConfig
  ): Promise<JobStatusResponse> {
    // Validate character ID
    if (!characterId || typeof characterId !== 'string' || characterId.trim() === '') {
      throw new PixelLabError({
        type: PixelLabErrorType.INVALID_REQUEST,
        message: 'Character ID is required',
        retryable: false,
      });
    }

    // Merge with defaults
    const finalConfig = {
      ...StatusPoller.DEFAULT_CONFIG,
      ...config,
    };

    let attempts = 0;

    while (attempts < finalConfig.maxAttempts) {
      attempts++;

      try {
        // Poll status
        const response = await this.httpClient.axiosInstance.get(
          `/v1/characters/${characterId}`
        );

        // Parse response
        const status = StatusParser.parseStatusResponse(characterId, response);

        // Check if completed
        if (status.status === JobStatus.COMPLETED) {
          return status;
        }

        // Check if failed
        if (status.status === JobStatus.FAILED) {
          throw new PixelLabError({
            type: PixelLabErrorType.API_ERROR,
            message: status.errorMessage || 'Generation failed',
            retryable: false,
          });
        }

        // Still processing - wait and retry
        const retryAfter = status.retryAfter || 5; // seconds
        await this.delay(retryAfter * 1000); // convert to milliseconds

      } catch (error) {
        // If it's a PixelLabError from failed status, rethrow
        if (error instanceof PixelLabError) {
          throw error;
        }

        // Otherwise, it's a network/HTTP error - rethrow
        throw error;
      }
    }

    // Exceeded max attempts
    throw new PixelLabError({
      type: PixelLabErrorType.TIMEOUT,
      message: `Maximum polling attempts (${finalConfig.maxAttempts}) exceeded for character ${characterId}`,
      retryable: false,
    });
  }

  /**
   * Delay for specified milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
