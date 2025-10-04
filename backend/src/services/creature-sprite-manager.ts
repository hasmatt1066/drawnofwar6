/**
 * Creature Sprite Manager
 *
 * Manages loading, caching, and generation of creature sprites for deployment.
 * Uses PixelLab API for on-demand generation and caches results.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { HttpClient } from '../pixellab/http-client.js';
import { SpriteGenerator } from '../pixellab/sprite-generator.js';
import type { GenerationRequest } from '../pixellab/request-validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Creature sprite metadata
 */
export interface CreatureSpriteMetadata {
  /** Creature identifier */
  creatureId: string;
  /** Creature name/description */
  name: string;
  /** Base64-encoded sprite image */
  imageBase64: string;
  /** Generation timestamp */
  generatedAt: Date;
  /** Generation cost (USD) */
  costUsd?: number;
  /** Source: 'generated' | 'cached' | 'placeholder' */
  source: 'generated' | 'cached' | 'placeholder';
}

/**
 * Creature sprite manager class
 */
export class CreatureSpriteManager {
  private spriteCache: Map<string, CreatureSpriteMetadata> = new Map();
  private cacheDir: string;
  private pixelLabClient: HttpClient | null = null;

  constructor(cacheDir?: string) {
    // Default cache directory: backend/sprite-cache
    this.cacheDir = cacheDir || path.join(__dirname, '../../sprite-cache');
  }

  /**
   * Initialize the manager
   * Creates cache directory and loads cached sprites
   */
  async initialize(): Promise<void> {
    // Create cache directory if it doesn't exist
    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
    } catch (error) {
      console.warn('[CreatureSpriteManager] Failed to create cache directory:', error);
    }

    // Load cached sprites from disk
    await this.loadCachedSprites();

    // Initialize PixelLab client if API key is available
    const apiKey = process.env['PIXELLAB_API_KEY'];
    if (apiKey) {
      this.pixelLabClient = new HttpClient({
        apiKey,
        baseURL: process.env['PIXELLAB_API_URL'] || 'https://api.pixellab.ai',
        timeout: 180000,
        maxRetries: 3,
      });
    } else {
      console.warn('[CreatureSpriteManager] No PixelLab API key found. Using placeholders only.');
    }
  }

  /**
   * Get sprite for a creature
   * Returns cached sprite or generates a new one
   */
  async getSprite(creatureId: string, creatureName: string, forceRegenerate = false): Promise<CreatureSpriteMetadata> {
    // Check cache first (unless forcing regeneration)
    if (!forceRegenerate && this.spriteCache.has(creatureId)) {
      const cached = this.spriteCache.get(creatureId)!;
      console.log(`[CreatureSpriteManager] Returning cached sprite for ${creatureId}`);
      return { ...cached, source: 'cached' };
    }

    // Try to generate with PixelLab if available
    if (this.pixelLabClient) {
      try {
        console.log(`[CreatureSpriteManager] Generating sprite for ${creatureId} (${creatureName})`);
        const sprite = await this.generateSprite(creatureId, creatureName);

        // Cache the sprite
        this.spriteCache.set(creatureId, sprite);
        await this.saveSpriteToCache(sprite);

        return sprite;
      } catch (error) {
        console.error(`[CreatureSpriteManager] Failed to generate sprite for ${creatureId}:`, error);
        // Fall through to placeholder
      }
    }

    // Fallback: Return placeholder sprite
    console.log(`[CreatureSpriteManager] Using placeholder for ${creatureId}`);
    const placeholder = this.createPlaceholderSprite(creatureId, creatureName);
    this.spriteCache.set(creatureId, placeholder);
    return placeholder;
  }

  /**
   * Generate a sprite using PixelLab API
   */
  private async generateSprite(creatureId: string, creatureName: string): Promise<CreatureSpriteMetadata> {
    if (!this.pixelLabClient) {
      throw new Error('PixelLab client not initialized');
    }

    const spriteGenerator = new SpriteGenerator(this.pixelLabClient);

    // Build generation request
    const request: GenerationRequest = {
      description: `${creatureName} fantasy creature for tactical game`,
      size: 64, // 64x64 for deployment grid
      detail: 'medium detail',
      shading: 'basic shading',
      outline: 'single color black outline',
      view: 'front', // Front view for deployment
      textGuidanceScale: 7.5,
      noBackground: true,
    };

    const response = await spriteGenerator.submitGeneration(request);

    return {
      creatureId,
      name: creatureName,
      imageBase64: response.imageBase64,
      generatedAt: new Date(),
      costUsd: response.costUsd,
      source: 'generated',
    };
  }

  /**
   * Create a placeholder sprite (simple colored circle with letter)
   */
  private createPlaceholderSprite(creatureId: string, creatureName: string): CreatureSpriteMetadata {
    // Generate a simple SVG placeholder
    const initial = creatureName.charAt(0).toUpperCase();

    // Use creature ID to generate a deterministic color
    const colorHash = this.hashCode(creatureId);
    const hue = colorHash % 360;
    const color = `hsl(${hue}, 70%, 50%)`;

    const svg = `
      <svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="28" fill="${color}" stroke="#000" stroke-width="2"/>
        <text x="32" y="32" text-anchor="middle" dy=".35em" fill="#fff" font-size="32" font-weight="bold" font-family="Arial">${initial}</text>
      </svg>
    `.trim();

    // Convert SVG to base64
    const base64 = Buffer.from(svg).toString('base64');
    const dataUrl = `data:image/svg+xml;base64,${base64}`;

    return {
      creatureId,
      name: creatureName,
      imageBase64: dataUrl,
      generatedAt: new Date(),
      source: 'placeholder',
    };
  }

  /**
   * Hash a string to a number (for color generation)
   */
  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Load cached sprites from disk
   */
  private async loadCachedSprites(): Promise<void> {
    try {
      const files = await fs.readdir(this.cacheDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      for (const file of jsonFiles) {
        try {
          const filePath = path.join(this.cacheDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const sprite = JSON.parse(content) as CreatureSpriteMetadata;

          // Restore Date objects
          sprite.generatedAt = new Date(sprite.generatedAt);

          this.spriteCache.set(sprite.creatureId, sprite);
          console.log(`[CreatureSpriteManager] Loaded cached sprite: ${sprite.creatureId}`);
        } catch (error) {
          console.warn(`[CreatureSpriteManager] Failed to load cache file ${file}:`, error);
        }
      }

      console.log(`[CreatureSpriteManager] Loaded ${this.spriteCache.size} cached sprites`);
    } catch (error) {
      console.warn('[CreatureSpriteManager] Failed to load cache directory:', error);
    }
  }

  /**
   * Save sprite to cache
   */
  private async saveSpriteToCache(sprite: CreatureSpriteMetadata): Promise<void> {
    try {
      const filePath = path.join(this.cacheDir, `${sprite.creatureId}.json`);
      await fs.writeFile(filePath, JSON.stringify(sprite, null, 2), 'utf-8');
      console.log(`[CreatureSpriteManager] Saved sprite to cache: ${sprite.creatureId}`);
    } catch (error) {
      console.warn(`[CreatureSpriteManager] Failed to save sprite to cache:`, error);
    }
  }

  /**
   * Get all cached sprite IDs
   */
  getCachedSpriteIds(): string[] {
    return Array.from(this.spriteCache.keys());
  }

  /**
   * Clear sprite cache
   */
  async clearCache(): Promise<void> {
    this.spriteCache.clear();

    try {
      const files = await fs.readdir(this.cacheDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          await fs.unlink(path.join(this.cacheDir, file));
        }
      }
      console.log('[CreatureSpriteManager] Cache cleared');
    } catch (error) {
      console.warn('[CreatureSpriteManager] Failed to clear cache:', error);
    }
  }
}

// Singleton instance
let managerInstance: CreatureSpriteManager | null = null;

/**
 * Get the singleton CreatureSpriteManager instance
 */
export async function getCreatureSpriteManager(): Promise<CreatureSpriteManager> {
  if (!managerInstance) {
    managerInstance = new CreatureSpriteManager();
    await managerInstance.initialize();
  }
  return managerInstance;
}
