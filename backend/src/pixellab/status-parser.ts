import { AxiosResponse } from 'axios';
import { ApiCharacterData } from './result-builder';

/**
 * Job status enum
 */
export enum JobStatus {
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Parsed job status response
 */
export interface JobStatusResponse {
  characterId: string;
  status: JobStatus;
  progress?: number; // 0-100
  retryAfter?: number; // seconds
  errorMessage?: string;
  characterData?: ApiCharacterData;
}

/**
 * Status Parser for PixelLab API
 *
 * Parses job status responses and determines state from HTTP codes:
 * - 200: Completed (character data available)
 * - 423: Processing (locked, still generating)
 * - 4xx/5xx: Failed (error occurred)
 */
export class StatusParser {
  /**
   * Default retry interval when Retry-After header is missing
   */
  private static readonly DEFAULT_RETRY_AFTER = 5; // seconds

  /**
   * Parse job status response from API
   *
   * @param characterId - Character ID being polled
   * @param response - Axios response from GET /v1/characters/:id
   * @returns Parsed status response
   */
  public static parseStatusResponse(
    characterId: string,
    response: AxiosResponse
  ): JobStatusResponse {
    const statusCode = response.status;

    // HTTP 200 = Completed
    if (statusCode === 200) {
      return this.parseCompletedResponse(characterId, response);
    }

    // HTTP 423 = Processing (Locked)
    if (statusCode === 423) {
      return this.parseProcessingResponse(characterId, response);
    }

    // All other codes = Failed
    return this.parseFailedResponse(characterId, response);
  }

  /**
   * Parse completed job response (HTTP 200)
   */
  private static parseCompletedResponse(
    characterId: string,
    response: AxiosResponse
  ): JobStatusResponse {
    return {
      characterId,
      status: JobStatus.COMPLETED,
      characterData: response.data,
    };
  }

  /**
   * Parse processing job response (HTTP 423)
   */
  private static parseProcessingResponse(
    characterId: string,
    response: AxiosResponse
  ): JobStatusResponse {
    // Extract Retry-After header
    const retryAfter = this.parseRetryAfter(response.headers);

    // Extract progress from message text
    const progress = this.parseProgress(response.data);

    const result: JobStatusResponse = {
      characterId,
      status: JobStatus.PROCESSING,
      retryAfter,
    };

    if (progress !== undefined) {
      result.progress = progress;
    }

    return result;
  }

  /**
   * Parse failed job response (4xx/5xx)
   */
  private static parseFailedResponse(
    characterId: string,
    response: AxiosResponse
  ): JobStatusResponse {
    // Extract error message from response
    const errorMessage = this.parseErrorMessage(response.data);

    return {
      characterId,
      status: JobStatus.FAILED,
      errorMessage,
    };
  }

  /**
   * Parse Retry-After header
   * Returns seconds to wait before next poll
   */
  private static parseRetryAfter(headers: any): number {
    // Look for Retry-After header (case-insensitive)
    const retryAfter =
      headers['retry-after'] ||
      headers['Retry-After'] ||
      headers['RETRY-AFTER'];

    if (!retryAfter) {
      return this.DEFAULT_RETRY_AFTER;
    }

    // Parse as number
    const parsed = parseInt(retryAfter, 10);

    // Validate
    if (isNaN(parsed) || parsed <= 0) {
      return this.DEFAULT_RETRY_AFTER;
    }

    return parsed;
  }

  /**
   * Parse progress percentage from message text
   * Looks for patterns like "75% complete" or "50 percent done"
   */
  private static parseProgress(data: any): number | undefined {
    if (!data) {
      return undefined;
    }

    // Check message or detail field
    const message = data.message || data.detail || '';

    if (typeof message !== 'string') {
      return undefined;
    }

    // Match percentage patterns: "75%", "75 percent", etc.
    const percentMatch = message.match(/(\d+)\s*%/);
    if (percentMatch && percentMatch[1]) {
      return parseInt(percentMatch[1], 10);
    }

    const percentWordMatch = message.match(/(\d+)\s*percent/i);
    if (percentWordMatch && percentWordMatch[1]) {
      return parseInt(percentWordMatch[1], 10);
    }

    return undefined;
  }

  /**
   * Parse error message from response data
   */
  private static parseErrorMessage(data: any): string {
    if (!data) {
      return 'Unknown error';
    }

    // Check for detail field (most common)
    if (data.detail) {
      // Pydantic validation errors (array)
      if (Array.isArray(data.detail)) {
        return 'Validation failed: ' + data.detail.map((e: any) => e.msg).join(', ');
      }

      // Simple string message
      if (typeof data.detail === 'string') {
        return data.detail;
      }
    }

    // Check for message field
    if (data.message && typeof data.message === 'string') {
      return data.message;
    }

    // Check for error field
    if (data.error && typeof data.error === 'string') {
      return data.error;
    }

    return 'Unknown error';
  }
}
