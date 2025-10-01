import { GenerationRequest } from '../../src/pixellab/request-validator.js';
import { GenerationResult, DirectionName } from '../../src/pixellab/result-builder.js';
import { PixelLabError, PixelLabErrorType } from '../../src/pixellab/errors.js';

/**
 * Mock scenario types
 */
export type MockScenario = 'success' | 'failure' | 'timeout' | 'auth_error' | 'server_error';

/**
 * Mock PixelLab Client Configuration
 */
export interface MockPixelLabClientConfig {
  /** Scenario to simulate */
  scenario: MockScenario;

  /** Delay in milliseconds to simulate async operation (default: 0) */
  delay?: number;

  /** Whether to simulate progress callbacks (default: false) */
  progressUpdates?: boolean;

  /** Custom error message for failure scenarios */
  errorMessage?: string;
}

/**
 * Progress callback type
 */
export type ProgressCallback = (progress: number) => void;

/**
 * Mock PixelLab Client for Testing
 *
 * Simulates the behavior of the real PixelLab API client with configurable
 * responses, delays, and error scenarios for unit and integration testing.
 */
export class MockPixelLabClient {
  private callHistory: GenerationRequest[] = [];
  private config: Required<MockPixelLabClientConfig>;
  public readonly isMock = true;

  constructor(config: MockPixelLabClientConfig) {
    // Validate configuration
    this.validateConfig(config);

    // Apply defaults
    this.config = {
      scenario: config.scenario,
      delay: config.delay ?? 0,
      progressUpdates: config.progressUpdates ?? false,
      errorMessage: config.errorMessage ?? this.getDefaultErrorMessage(config.scenario),
    };
  }

  /**
   * Simulate sprite generation
   *
   * @param request - Generation request parameters
   * @param onProgress - Optional progress callback
   * @returns Generation result
   * @throws {PixelLabError} If scenario is configured for failure
   */
  public async generateSprite(
    request: GenerationRequest,
    onProgress?: ProgressCallback
  ): Promise<GenerationResult> {
    // Track call
    this.callHistory.push(request);

    // Simulate progress updates if enabled
    if (this.config.progressUpdates && onProgress) {
      await this.simulateProgressUpdates(onProgress);
    }

    // Apply delay
    if (this.config.delay > 0) {
      await this.delay(this.config.delay);
    }

    // Handle scenario
    switch (this.config.scenario) {
      case 'success':
        return this.generateSuccessResult(request);

      case 'failure':
        throw new PixelLabError({
          type: PixelLabErrorType.API_ERROR,
          message: this.config.errorMessage,
          retryable: false,
        });

      case 'auth_error':
        throw new PixelLabError({
          type: PixelLabErrorType.AUTHENTICATION,
          message: this.config.errorMessage,
          statusCode: 401,
          retryable: false,
        });

      case 'timeout':
        throw new PixelLabError({
          type: PixelLabErrorType.TIMEOUT,
          message: this.config.errorMessage,
          retryable: true,
        });

      case 'server_error':
        throw new PixelLabError({
          type: PixelLabErrorType.API_ERROR,
          message: this.config.errorMessage,
          statusCode: 500,
          retryable: true,
        });

      default:
        // TypeScript should prevent this, but handle anyway
        throw new Error(`Unknown scenario: ${this.config.scenario}`);
    }
  }

  /**
   * Get call history for verification
   */
  public getCallHistory(): GenerationRequest[] {
    return [...this.callHistory];
  }

  /**
   * Get call count
   */
  public getCallCount(): number {
    return this.callHistory.length;
  }

  /**
   * Reset call history
   */
  public reset(): void {
    this.callHistory = [];
  }

  /**
   * Generate successful result from request
   */
  private generateSuccessResult(request: GenerationRequest): GenerationResult {
    const characterId = this.generateCharacterId();
    const directions = request.nDirections ?? 8;
    const directionList = this.getDirectionList(directions);

    return {
      characterId,
      name: null,
      created: new Date().toISOString(),
      specifications: {
        directions,
        canvasSize: request.size.toString(),
        view: request.view ?? 'low top-down',
      },
      style: {
        outline: request.outline ?? 'single color black outline',
        shading: request.shading ?? 'basic shading',
        detail: request.detail ?? 'medium detail',
      },
      directions: directionList.map((direction) => ({
        direction,
        url: `https://mock.pixellab.ai/images/${characterId}/${direction}.png`,
        buffer: this.generateMockPngBuffer(),
      })),
      downloadUrl: `https://mock.pixellab.ai/download/${characterId}`,
    };
  }

  /**
   * Generate unique character ID with mock prefix
   */
  private generateCharacterId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `mock-${timestamp}-${random}`;
  }

  /**
   * Get direction list based on count
   */
  private getDirectionList(directions: 4 | 8): DirectionName[] {
    if (directions === 4) {
      return ['north', 'east', 'south', 'west'];
    }

    return [
      'north',
      'north-east',
      'east',
      'south-east',
      'south',
      'south-west',
      'west',
      'north-west',
    ];
  }

  /**
   * Generate mock PNG buffer with valid PNG signature
   */
  private generateMockPngBuffer(): Buffer {
    // Create a minimal valid PNG file
    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    // IHDR chunk (minimal 1x1 pixel image)
    const ihdr = Buffer.from([
      0x00,
      0x00,
      0x00,
      0x0d, // Length: 13 bytes
      0x49,
      0x48,
      0x44,
      0x52, // IHDR
      0x00,
      0x00,
      0x00,
      0x01, // Width: 1
      0x00,
      0x00,
      0x00,
      0x01, // Height: 1
      0x08, // Bit depth: 8
      0x06, // Color type: RGBA
      0x00, // Compression: 0
      0x00, // Filter: 0
      0x00, // Interlace: 0
      0x1f,
      0x15,
      0xc4,
      0x89, // CRC
    ]);

    // IDAT chunk (minimal compressed data)
    const idat = Buffer.from([
      0x00,
      0x00,
      0x00,
      0x0a, // Length: 10 bytes
      0x49,
      0x44,
      0x41,
      0x54, // IDAT
      0x78,
      0x9c, // zlib header
      0x62,
      0x00,
      0x01,
      0x00,
      0x00,
      0x05,
      0x00,
      0x01, // Compressed data
      0x0d,
      0x0a,
      0x2d,
      0xb4, // CRC
    ]);

    // IEND chunk
    const iend = Buffer.from([
      0x00,
      0x00,
      0x00,
      0x00, // Length: 0
      0x49,
      0x45,
      0x4e,
      0x44, // IEND
      0xae,
      0x42,
      0x60,
      0x82, // CRC
    ]);

    return Buffer.concat([pngSignature, ihdr, idat, iend]);
  }

  /**
   * Simulate progress updates with incremental callbacks
   */
  private async simulateProgressUpdates(onProgress: ProgressCallback): Promise<void> {
    const steps = 5;
    const delayPerStep = Math.floor(this.config.delay / steps);

    for (let i = 1; i <= steps; i++) {
      const progress = Math.floor((i / steps) * 100);
      if (progress < 100) {
        onProgress(progress);
        await this.delay(delayPerStep);
      }
    }
  }

  /**
   * Delay for specified milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get default error message for scenario
   */
  private getDefaultErrorMessage(scenario: MockScenario): string {
    switch (scenario) {
      case 'success':
        return '';
      case 'failure':
        return 'Mock generation failed';
      case 'auth_error':
        return 'Mock authentication failed';
      case 'timeout':
        return 'Mock request timeout';
      case 'server_error':
        return 'Mock server error';
      default:
        return 'Mock error';
    }
  }

  /**
   * Validate configuration
   */
  private validateConfig(config: MockPixelLabClientConfig): void {
    // Validate scenario
    const validScenarios: MockScenario[] = [
      'success',
      'failure',
      'timeout',
      'auth_error',
      'server_error',
    ];

    if (!validScenarios.includes(config.scenario)) {
      throw new Error(
        `Invalid scenario: ${config.scenario}. Must be one of: ${validScenarios.join(', ')}`
      );
    }

    // Validate delay
    if (config.delay !== undefined && config.delay < 0) {
      throw new Error('Delay must be non-negative');
    }
  }
}
