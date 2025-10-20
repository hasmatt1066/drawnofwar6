/**
 * Attribute Extractor Service
 *
 * Extracts 1-3 primary combat attributes from creature abilities and maps them
 * to sprite overlay animations from the animation library.
 *
 * Mirrors the structure of AnimationMapperService for consistency.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type { AnimationSet } from '../animations/types.js';
import type { AttributeMappingResult, CombatAttribute } from './types.js';
import { extractUniqueAttributes } from './attribute-map.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LIBRARY_ANIMATIONS_DIR = path.join(__dirname, '../../../../assets/library-animations');

/**
 * Attribute Extractor Service
 * Singleton service for extracting combat attributes
 */
class AttributeExtractorService {
  constructor() {
    console.log('[Attribute Extractor] Service initialized');
  }

  /**
   * Extract 1-3 primary combat attributes from abilities
   *
   * Selection logic:
   * - Prioritizes unique/special abilities over basic ones (based on priority score)
   * - Limits to top 3 most important attributes
   * - Always includes at least 1 attack attribute if available
   * - Ensures sprite animation exists in the provided animation set
   * - Loads effect animation frames for each selected attribute
   *
   * @param abilities - Array of ability strings from Claude Vision
   * @param animationSet - Animation set containing available sprite animations
   * @returns Attribute mapping result with 1-3 attributes
   */
  async extractAttributes(
    abilities: string[],
    animationSet: AnimationSet
  ): Promise<AttributeMappingResult> {
    console.log('[Attribute Extractor] Extracting combat attributes...');
    console.log(`[Attribute Extractor] Input abilities: ${abilities.length}`);

    // Step 1: Extract all unique attributes from abilities
    const allAttributes = extractUniqueAttributes(abilities);
    console.log(`[Attribute Extractor] Found ${allAttributes.length} unique attributes`);

    if (allAttributes.length === 0) {
      console.log('[Attribute Extractor] No attributes found, returning empty result');
      return {
        attributes: [],
        totalExtracted: 0,
        confidence: 0
      };
    }

    // Step 2: Build set of available animation IDs
    const availableAnimations = new Set<string>([
      animationSet.idle,
      animationSet.walk,
      animationSet.attack,
      animationSet.death,
      ...animationSet.additional
    ]);

    // Step 3: Filter attributes to only those with available animations
    const validAttributes = allAttributes.filter(attr =>
      availableAnimations.has(attr.spriteAnimationId)
    );

    console.log(`[Attribute Extractor] ${validAttributes.length} attributes have valid sprite animations`);

    if (validAttributes.length === 0) {
      console.log('[Attribute Extractor] No valid attributes with sprite animations');
      return {
        attributes: [],
        totalExtracted: allAttributes.length,
        confidence: 0.3
      };
    }

    // Step 4: Sort by priority (highest first)
    const sortedAttributes = [...validAttributes].sort((a, b) => b.priority - a.priority);

    // Step 5: Select top 3 attributes with smart selection logic
    const selectedAttributes = this.selectPrimaryAttributes(sortedAttributes);

    console.log(`[Attribute Extractor] Selected ${selectedAttributes.length} primary attributes:`);
    selectedAttributes.forEach(attr => {
      console.log(`  - ${attr.name} (${attr.category}, priority: ${attr.priority}, animation: ${attr.spriteAnimationId})`);
    });

    // Step 6: Load effect frames for each selected attribute
    console.log('[Attribute Extractor] Loading effect animation frames...');
    const attributesWithFrames = await Promise.all(
      selectedAttributes.map(attr => this.loadEffectFrames(attr))
    );

    const confidence = this.calculateConfidence(selectedAttributes.length, allAttributes.length);

    return {
      attributes: attributesWithFrames,
      totalExtracted: allAttributes.length,
      confidence
    };
  }

  /**
   * Select 1-3 primary attributes using smart selection logic
   *
   * Rules:
   * - Maximum 3 attributes
   * - Must include at least 1 attack attribute (melee, ranged, spell, or ability with damage)
   * - Prefer variety in categories
   * - Higher priority scores preferred
   *
   * @param sortedAttributes - Attributes sorted by priority (highest first)
   * @returns Array of 1-3 selected attributes
   */
  private selectPrimaryAttributes(sortedAttributes: CombatAttribute[]): CombatAttribute[] {
    const selected: CombatAttribute[] = [];
    const usedCategories = new Set<string>();

    // Step 1: Find the highest priority attack attribute
    const attackAttribute = sortedAttributes.find(attr =>
      attr.category === 'melee' ||
      attr.category === 'ranged' ||
      attr.category === 'spell' ||
      (attr.category === 'ability' && attr.damageType !== 'none')
    );

    if (attackAttribute) {
      selected.push(attackAttribute);
      usedCategories.add(attackAttribute.category);
    }

    // Step 2: Add up to 2 more attributes, preferring different categories
    for (const attr of sortedAttributes) {
      if (selected.length >= 3) break;

      // Skip if already selected
      if (selected.some(s => s.attributeId === attr.attributeId)) continue;

      // Prefer different categories for variety
      if (!usedCategories.has(attr.category)) {
        selected.push(attr);
        usedCategories.add(attr.category);
      } else if (selected.length < 2) {
        // If we don't have 2 yet and can't find variety, add anyway
        selected.push(attr);
      }
    }

    // Step 3: If still less than 3 and we have more options, fill remaining slots
    if (selected.length < 3) {
      for (const attr of sortedAttributes) {
        if (selected.length >= 3) break;

        if (!selected.some(s => s.attributeId === attr.attributeId)) {
          selected.push(attr);
        }
      }
    }

    return selected;
  }

  /**
   * Load effect animation frames from library
   *
   * @param attribute - Combat attribute to load frames for
   * @returns Attribute with effect frames loaded
   */
  private async loadEffectFrames(attribute: CombatAttribute): Promise<CombatAttribute> {
    try {
      const animDir = path.join(LIBRARY_ANIMATIONS_DIR, attribute.spriteAnimationId);

      // Read metadata to get frame count
      const metadataPath = path.join(animDir, 'metadata.json');
      const metadataContent = await fs.readFile(metadataPath, 'utf-8');
      const metadata = JSON.parse(metadataContent);

      // Read all frames
      const frames: string[] = [];
      for (let i = 0; i < metadata.frameCount; i++) {
        const framePath = path.join(animDir, `frame-${i}.png`);
        const frameBuffer = await fs.readFile(framePath);
        frames.push(frameBuffer.toString('base64'));
      }

      console.log(`[Attribute Extractor] Loaded ${frames.length} frames for ${attribute.name}`);

      return {
        ...attribute,
        effectFrames: frames
      };
    } catch (error) {
      console.error(`[Attribute Extractor] Failed to load effect frames for ${attribute.name}:`, error);
      // Return attribute without frames if loading fails
      return attribute;
    }
  }

  /**
   * Calculate confidence score based on extraction success
   *
   * @param selectedCount - Number of attributes selected
   * @param totalFound - Total unique attributes found
   * @returns Confidence score 0-1
   */
  private calculateConfidence(selectedCount: number, totalFound: number): number {
    if (selectedCount === 0) return 0;
    if (totalFound === 0) return 0;

    // Higher confidence if:
    // - We selected attributes (vs none)
    // - We had good options to choose from
    const baseConfidence = 0.6;
    const selectionBonus = selectedCount * 0.15; // +0.15 per selected attribute
    const optionBonus = Math.min(totalFound / 10, 0.2); // Up to +0.2 if many options

    return Math.min(baseConfidence + selectionBonus + optionBonus, 1.0);
  }
}

// Export singleton instance
export const attributeExtractor = new AttributeExtractorService();
