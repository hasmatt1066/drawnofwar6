/**
 * Creature Sprite Loader Service
 *
 * Frontend service for loading creature sprites from the backend API.
 * Handles caching, loading states, and error handling.
 */

import type { DeploymentCreature } from '@drawn-of-war/shared';

/**
 * Sprite metadata from backend
 */
export interface SpriteMetadata {
  creatureId: string;
  name: string;
  imageBase64: string;
  generatedAt: string;
  costUsd?: number;
  source: 'generated' | 'cached' | 'placeholder';
}

/**
 * Sprite load result
 */
export interface SpriteLoadResult {
  success: boolean;
  sprite?: SpriteMetadata;
  error?: string;
}

/**
 * Creature Sprite Loader
 */
export class CreatureSpriteLoader {
  private spriteCache: Map<string, SpriteMetadata> = new Map();
  private loadingSprites: Set<string> = new Set();
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:3001') {
    this.baseUrl = baseUrl;
  }

  /**
   * Load sprite for a creature
   * Returns cached sprite if available, otherwise fetches from backend
   */
  async loadSprite(creatureId: string, creatureName: string): Promise<SpriteLoadResult> {
    // Check cache first
    if (this.spriteCache.has(creatureId)) {
      return {
        success: true,
        sprite: this.spriteCache.get(creatureId)!
      };
    }

    // Check if already loading
    if (this.loadingSprites.has(creatureId)) {
      // Wait for existing load to complete
      await this.waitForLoad(creatureId);
      if (this.spriteCache.has(creatureId)) {
        return {
          success: true,
          sprite: this.spriteCache.get(creatureId)!
        };
      }
    }

    // Start loading
    this.loadingSprites.add(creatureId);

    try {
      const url = `${this.baseUrl}/api/creatures/sprites/${encodeURIComponent(creatureId)}?name=${encodeURIComponent(creatureName)}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const sprite: SpriteMetadata = await response.json();

      // Cache the sprite
      this.spriteCache.set(creatureId, sprite);
      this.loadingSprites.delete(creatureId);

      return { success: true, sprite };
    } catch (error) {
      this.loadingSprites.delete(creatureId);
      console.error(`[CreatureSpriteLoader] Failed to load sprite for ${creatureId}:`, error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Load sprites for multiple creatures in batch
   */
  async loadBatch(creatures: Array<{ id: string; name: string }>): Promise<Map<string, SpriteLoadResult>> {
    const results = new Map<string, SpriteLoadResult>();

    // Separate cached vs uncached
    const toFetch: Array<{ id: string; name: string }> = [];

    for (const creature of creatures) {
      if (this.spriteCache.has(creature.id)) {
        results.set(creature.id, {
          success: true,
          sprite: this.spriteCache.get(creature.id)!
        });
      } else {
        toFetch.push(creature);
      }
    }

    // Fetch uncached sprites
    if (toFetch.length > 0) {
      try {
        const url = `${this.baseUrl}/api/creatures/sprites/batch`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            creatures: toFetch.map(c => ({ id: c.id, name: c.name }))
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const sprites: SpriteMetadata[] = data.sprites;

        // Cache and return results
        for (const sprite of sprites) {
          this.spriteCache.set(sprite.creatureId, sprite);
          results.set(sprite.creatureId, { success: true, sprite });
        }
      } catch (error) {
        console.error('[CreatureSpriteLoader] Failed to load batch sprites:', error);

        // Mark all uncached as failed
        for (const creature of toFetch) {
          results.set(creature.id, {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }

    return results;
  }

  /**
   * Wait for a sprite to finish loading
   */
  private async waitForLoad(creatureId: string, maxWait = 5000): Promise<void> {
    const startTime = Date.now();

    while (this.loadingSprites.has(creatureId)) {
      if (Date.now() - startTime > maxWait) {
        throw new Error('Timeout waiting for sprite to load');
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Get cached sprite (synchronous)
   */
  getCachedSprite(creatureId: string): SpriteMetadata | null {
    return this.spriteCache.get(creatureId) || null;
  }

  /**
   * Check if sprite is cached
   */
  isCached(creatureId: string): boolean {
    return this.spriteCache.has(creatureId);
  }

  /**
   * Clear sprite cache
   */
  clearCache(): void {
    this.spriteCache.clear();
    this.loadingSprites.clear();
  }

  /**
   * Preload sprites for creatures
   * Useful for preloading roster creatures before deployment starts
   */
  async preloadCreatures(creatures: DeploymentCreature[]): Promise<void> {
    console.log(`[CreatureSpriteLoader] Preloading ${creatures.length} creature sprites...`);

    const toLoad = creatures.map(c => ({ id: c.id, name: c.name }));
    await this.loadBatch(toLoad);

    console.log('[CreatureSpriteLoader] Preload complete');
  }

  /**
   * Get sprite data URL for rendering
   * Returns the base64 data URL or null if not loaded
   */
  getSpriteDataUrl(creatureId: string): string | null {
    const sprite = this.getCachedSprite(creatureId);
    if (!sprite) return null;

    // If it's already a data URL, return it
    if (sprite.imageBase64.startsWith('data:')) {
      return sprite.imageBase64;
    }

    // Otherwise, assume it's base64-encoded PNG
    return `data:image/png;base64,${sprite.imageBase64}`;
  }
}

// Singleton instance
let loaderInstance: CreatureSpriteLoader | null = null;

/**
 * Get the singleton CreatureSpriteLoader instance
 */
export function getCreatureSpriteLoader(): CreatureSpriteLoader {
  if (!loaderInstance) {
    const apiUrl = (import.meta.env?.VITE_API_URL as string | undefined) || 'http://localhost:3001';
    loaderInstance = new CreatureSpriteLoader(apiUrl);
  }
  return loaderInstance;
}
