/**
 * Mock PixelLab Client for Load Testing
 *
 * Fast mock implementation of PixelLab client components for load testing.
 * Provides configurable response times and success/failure scenarios.
 *
 * Features:
 * - Fast response times (default 10ms)
 * - Configurable success rate
 * - Realistic response structure
 * - No actual API calls
 */

import type { GenerationRequest } from '../pixellab/request-validator.js';
import type { JobSubmissionResponse } from '../pixellab/sprite-generator.js';
import type { JobStatusResponse } from '../pixellab/status-parser.js';
import type { GenerationResult } from '../pixellab/result-builder.js';
import { JobStatus } from '../pixellab/status-parser.js';
import { character8DirectionResponse } from '../pixellab/test-utils/fixtures.js';

/**
 * Configuration for mock client behavior
 */
export interface MockClientConfig {
  /** Response delay in milliseconds (default: 10ms) */
  responseDelay?: number;
  /** Success rate 0-1 (default: 1.0 = 100% success) */
  successRate?: number;
  /** Whether to auto-complete jobs (default: true) */
  autoComplete?: boolean;
}

/**
 * Mock SpriteGenerator for load testing
 */
export class MockSpriteGenerator {
  private config: Required<MockClientConfig>;
  private jobCounter = 0;

  constructor(config: MockClientConfig = {}) {
    this.config = {
      responseDelay: config.responseDelay ?? 10,
      successRate: config.successRate ?? 1.0,
      autoComplete: config.autoComplete ?? true,
    };
  }

  /**
   * Mock submitGeneration - fast submission with configurable delay
   */
  async submitGeneration(request: GenerationRequest): Promise<JobSubmissionResponse> {
    await this.delay(this.config.responseDelay);

    // Simulate occasional failures based on success rate
    if (Math.random() > this.config.successRate) {
      throw new Error('Mock API error: rate limit exceeded');
    }

    const characterId = `mock-char-${++this.jobCounter}`;

    return {
      characterId,
      name: null,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Mock StatusPoller for load testing
 */
export class MockStatusPoller {
  private config: Required<MockClientConfig>;
  private completedJobs = new Set<string>();

  constructor(config: MockClientConfig = {}) {
    this.config = {
      responseDelay: config.responseDelay ?? 10,
      successRate: config.successRate ?? 1.0,
      autoComplete: config.autoComplete ?? true,
    };
  }

  /**
   * Mock pollUntilComplete - fast polling with immediate completion
   */
  async pollUntilComplete(
    characterId: string,
    onProgress?: (percent: number) => void
  ): Promise<JobStatusResponse> {
    // Simulate polling delay
    await this.delay(this.config.responseDelay);

    // Report progress stages
    if (onProgress) {
      onProgress(25);
      await this.delay(this.config.responseDelay / 4);
      onProgress(50);
      await this.delay(this.config.responseDelay / 4);
      onProgress(75);
      await this.delay(this.config.responseDelay / 4);
      onProgress(100);
    }

    // Simulate occasional failures
    if (Math.random() > this.config.successRate) {
      return {
        status: JobStatus.FAILED,
        characterId,
        characterData: null,
        retryAfter: null,
        errorMessage: 'Mock generation failed',
      };
    }

    this.completedJobs.add(characterId);

    return {
      status: JobStatus.COMPLETED,
      characterId,
      characterData: character8DirectionResponse as any,
      retryAfter: null,
      errorMessage: null,
    };
  }

  /**
   * Mock checkStatus - immediate status check
   */
  async checkStatus(characterId: string): Promise<JobStatusResponse> {
    await this.delay(this.config.responseDelay);

    if (this.completedJobs.has(characterId)) {
      return {
        status: JobStatus.COMPLETED,
        characterId,
        characterData: character8DirectionResponse as any,
        retryAfter: null,
        errorMessage: null,
      };
    }

    return {
      status: JobStatus.PROCESSING,
      characterId,
      characterData: null,
      retryAfter: 5,
      errorMessage: null,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Mock ResultBuilder for load testing
 */
export class MockResultBuilder {
  /**
   * Mock buildResult - fast result building
   */
  buildResult(characterData: any, characterId: string): GenerationResult {
    const images = characterData.rotations.map(() => Buffer.from('mock-image'));

    return {
      characterId,
      name: null,
      created: new Date().toISOString(),
      specifications: {
        directions: characterData.rotations.length as 4 | 8,
        canvasSize: '64x64',
        view: 'low top-down',
      },
      style: {
        outline: 'single color black outline',
        shading: 'detailed shading',
        detail: 'high detail',
      },
      directions: characterData.rotations.map((rotation: any, index: number) => ({
        direction: rotation.direction,
        url: `https://mock.url/${index}`,
        buffer: Buffer.from('mock-image'),
      })),
      downloadUrl: 'https://mock.url/download',
    };
  }
}

/**
 * Mock ImageDecoder for load testing
 */
export class MockImageDecoder {
  /**
   * Mock decodeImage - no actual decoding
   */
  async decodeImage(base64Data: string): Promise<{ width: number; height: number; data: Buffer }> {
    return {
      width: 64,
      height: 64,
      data: Buffer.from(base64Data, 'base64'),
    };
  }
}

/**
 * Factory to create mock PixelLab client components
 */
export function createMockPixelLabClient(config: MockClientConfig = {}) {
  return {
    spriteGenerator: new MockSpriteGenerator(config),
    statusPoller: new MockStatusPoller(config),
    resultBuilder: new MockResultBuilder(),
    imageDecoder: new MockImageDecoder(),
  };
}
