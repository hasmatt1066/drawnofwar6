import MockAdapter from 'axios-mock-adapter';
import { randomUUID } from 'crypto';

/**
 * Mock PixelLab API server for testing
 *
 * Provides realistic mock responses for all PixelLab API endpoints:
 * - Character creation (POST /v1/characters)
 * - Character status (GET /v1/characters/:id)
 * - Animation creation (POST /v1/characters/:id/animations)
 * - Balance queries (GET /balance)
 *
 * Supports:
 * - Configurable completion times for polling simulation
 * - Error injection for testing error handling
 * - Realistic response structures matching actual API
 */
export class MockPixelLabServer {
  private characterCompletionTimes = new Map<string, number>();
  private characterStartTimes = new Map<string, number>();

  constructor(private mockAdapter: InstanceType<typeof MockAdapter>) {}

  /**
   * Setup mock for character creation endpoint
   *
   * @param customResponse - Optional custom response data
   */
  setupCharacterCreation(customResponse?: {
    character_id?: string;
    name?: string | null;
  }): void {
    this.mockAdapter.onPost('/v1/characters').reply((config) => {
      const data = JSON.parse(config.data || '{}');

      const characterId = customResponse?.character_id || randomUUID();
      const name =
        customResponse?.name !== undefined
          ? customResponse.name
          : this.extractName(data.description);

      return [
        200,
        {
          character_id: characterId,
          name: name,
        },
      ];
    });
  }

  /**
   * Setup mock for character status endpoint
   *
   * Simulates the 423 (processing) → 200 (completed) transition
   *
   * @param characterId - Character ID to mock
   * @param options - Configuration options
   */
  setupCharacterStatus(
    characterId: string,
    options: {
      status: 'processing' | 'completed';
      completionTime?: number; // Milliseconds until completion
      nDirections?: 4 | 8;
    }
  ): void {
    if (options.status === 'processing' && options.completionTime) {
      this.characterStartTimes.set(characterId, Date.now());
      this.characterCompletionTimes.set(characterId, options.completionTime);
    }

    const nDirections = options.nDirections || 8;

    this.mockAdapter
      .onGet(`/v1/characters/${characterId}`)
      .reply((_config) => {
        // Check if job should be completed
        const startTime = this.characterStartTimes.get(characterId);
        const completionTime = this.characterCompletionTimes.get(characterId);

        if (startTime && completionTime) {
          const elapsed = Date.now() - startTime;
          if (elapsed >= completionTime) {
            // Job completed
            return [200, this.buildCharacterData(characterId, nDirections)];
          } else {
            // Still processing
            const remaining = Math.ceil((completionTime - elapsed) / 1000);
            return [
              423,
              {},
              {
                'retry-after': remaining.toString(),
              },
            ];
          }
        }

        // Static status
        if (options.status === 'completed') {
          return [200, this.buildCharacterData(characterId, nDirections)];
        } else {
          // Processing
          return [
            423,
            {},
            {
              'retry-after': '5',
            },
          ];
        }
      });
  }

  /**
   * Setup mock for animation creation endpoint
   *
   * @param characterId - Character ID
   * @param customResponse - Optional custom response
   */
  setupAnimationCreation(
    characterId: string,
    customResponse?: {
      animation_id?: string;
      name?: string | null;
    }
  ): void {
    this.mockAdapter
      .onPost(`/v1/characters/${characterId}/animations`)
      .reply((_config) => {
        const animationId = customResponse?.animation_id || randomUUID();
        const name = customResponse?.name || null;

        return [
          200,
          {
            animation_id: animationId,
            name: name,
          },
        ];
      });
  }

  /**
   * Setup mock for balance endpoint
   *
   * @param credits - Credit balance (default: 1000)
   */
  setupBalance(credits: number = 1000): void {
    this.mockAdapter.onGet('/balance').reply(200, {
      credits: credits,
    });
  }

  /**
   * Setup error response for any endpoint
   *
   * @param url - URL pattern to match
   * @param statusCode - HTTP status code
   */
  setupError(url: string | RegExp, statusCode: number): void {
    let responseData: any;
    let headers: any = {};

    switch (statusCode) {
      case 401:
        responseData = {
          detail: 'Invalid API key',
        };
        break;

      case 422:
        responseData = {
          detail: [
            {
              loc: ['body', 'description'],
              msg: 'field required',
              type: 'value_error.missing',
            },
          ],
        };
        break;

      case 429:
        responseData = {
          detail: 'Rate limit exceeded',
        };
        headers = {
          'retry-after': '60',
        };
        break;

      case 500:
        responseData = {
          detail: 'Internal server error',
        };
        break;

      default:
        responseData = {
          detail: `Error ${statusCode}`,
        };
    }

    // Setup for both GET and POST
    this.mockAdapter.onPost(url).reply(statusCode, responseData, headers);
    this.mockAdapter.onGet(url).reply(statusCode, responseData, headers);
  }

  /**
   * Setup network timeout for any endpoint
   *
   * @param url - URL pattern to match
   */
  setupTimeout(url: string | RegExp): void {
    this.mockAdapter.onPost(url).timeout();
    this.mockAdapter.onGet(url).timeout();
  }

  /**
   * Reset all mocks
   */
  reset(): void {
    this.mockAdapter.reset();
    this.characterCompletionTimes.clear();
    this.characterStartTimes.clear();
  }

  /**
   * Extract name from description (simplified)
   */
  private extractName(description: string): string | null {
    if (!description || description.length < 3) {
      return null;
    }

    // Simple extraction: capitalize first few words
    const words = description.split(' ').slice(0, 3);
    return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  /**
   * Build realistic character data response
   */
  private buildCharacterData(characterId: string, nDirections: 4 | 8): any {
    const directions4 = ['south', 'west', 'east', 'north'];
    const directions8 = [
      'south',
      'west',
      'east',
      'north',
      'south-east',
      'north-east',
      'north-west',
      'south-west',
    ];

    const directions = nDirections === 4 ? directions4 : directions8;

    const rotations = directions.map((direction) => ({
      direction: direction,
      url: `https://example.com/${characterId}/${direction}.png`,
    }));

    return {
      id: characterId,
      name: 'Test Character',
      created: new Date().toISOString(),
      specifications: {
        directions: nDirections,
        canvas_size: '48x48',
        view: 'low top-down',
      },
      style: {
        outline: 'single color black outline',
        shading: 'basic shading',
        detail: 'medium detail',
      },
      rotations: rotations,
      animations: [],
      download_url: `https://example.com/characters/${characterId}/download.zip`,
    };
  }
}
