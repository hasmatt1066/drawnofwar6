/**
 * Generation Result to Creature Document Transformer
 *
 * Transforms BullMQ generation results into Firestore-ready creature documents.
 * Validates required fields and ensures data integrity.
 */

import type { GenerationResult } from '../../types/generation.js';
import type { CreatureDocumentInput, StoredCombatAttribute, OwnerId } from '@drawn-of-war/shared';

export class GenerationToCreatureTransformer {
  /**
   * Transform generation result to creature document input
   */
  transform(
    generationResult: GenerationResult,
    ownerId: OwnerId,
    jobId: string
  ): CreatureDocumentInput {
    // Validate required fields
    this.validateGenerationResult(generationResult);

    // Extract creature name from Claude analysis or use fallback
    const name = this.extractCreatureName(generationResult);

    // Extract concept, race, class from Claude analysis
    const { concept, race, creatureClass } = this.extractClaudeData(generationResult);

    // Extract abilities
    const abilities = this.extractAbilities(generationResult);

    // Transform combat attributes
    const combatAttributes = this.transformCombatAttributes(generationResult);

    // Extract animation mappings
    const animations = this.extractAnimations(generationResult);

    // Build creature document
    return {
      ownerId,
      name,
      generationJobId: jobId,
      inputType: generationResult.inputType,
      textDescription: generationResult.textDescription,
      concept,
      race,
      class: creatureClass,
      abilities,
      combatAttributes,
      animations,
      sprites: {
        menuSprite: '', // Will be filled with Firebase Storage URLs by save service
        directions: {
          E: { sprite: '', walkFrames: [], idleFrames: [], attackFrames: [] },
          NE: { sprite: '', walkFrames: [], idleFrames: [], attackFrames: [] },
          SE: { sprite: '', walkFrames: [], idleFrames: [], attackFrames: [] }
        }
      },
      generationTimeMs: generationResult.processingTimeMs,
      version: '1.0.0'
    };
  }

  /**
   * Validate generation result has all required fields
   */
  private validateGenerationResult(result: GenerationResult): void {
    const errors: string[] = [];

    // Check for sprite data
    if (!result.spriteImageBase64) {
      errors.push('Missing menu sprite (spriteImageBase64)');
    }

    // Check for directional battlefield views
    // Note: Only text-input path generates these. Visual path (draw/upload) currently only generates side-view sprites.
    if (!result.battlefieldDirectionalViews) {
      // Warn but don't fail - battlefield views are optional for now
      console.warn('[GenerationToCreatureTransformer] No battlefield directional views found. Using legacy fields if available.');

      // Validate legacy battlefield sprite as fallback
      if (!result.battlefieldSprite) {
        errors.push('Missing battlefield sprite (both battlefieldDirectionalViews and legacy battlefieldSprite are missing)');
      }
    } else {
      const { E, NE, SE } = result.battlefieldDirectionalViews;
      if (!E || !E.sprite) errors.push('Missing E direction sprite');
      if (!NE || !NE.sprite) errors.push('Missing NE direction sprite');
      if (!SE || !SE.sprite) errors.push('Missing SE direction sprite');
    }

    // Check for animation data (animations field is required in GenerationResult type)
    // Validate that animationSet has required base animations
    if (!result.animations || !result.animations.animationSet) {
      errors.push('Missing animation set');
    } else {
      const { idle, walk, attack, death } = result.animations.animationSet;
      if (!idle) errors.push('Missing idle animation');
      if (!walk) errors.push('Missing walk animation');
      if (!attack) errors.push('Missing attack animation');
      if (!death) errors.push('Missing death animation');
    }

    if (errors.length > 0) {
      throw new Error(`Invalid generation result: ${errors.join(', ')}`);
    }
  }

  /**
   * Extract creature name from analysis or generate fallback
   */
  private extractCreatureName(result: GenerationResult): string {
    if (result.claudeAnalysis) {
      // Construct name from concept or race/class
      if (result.claudeAnalysis.concept) {
        // Capitalize first letter of each word
        return result.claudeAnalysis.concept
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }

      if (result.claudeAnalysis.race && result.claudeAnalysis.class) {
        return `${this.capitalize(result.claudeAnalysis.race)} ${this.capitalize(result.claudeAnalysis.class)}`;
      }
    }

    // Fallback: Use text description or generic name
    if (result.textDescription) {
      const words = result.textDescription.split(' ').slice(0, 3);
      return words.map(w => this.capitalize(w)).join(' ');
    }

    return 'Unknown Creature';
  }

  /**
   * Extract Claude Vision analysis data
   */
  private extractClaudeData(result: GenerationResult): { concept: string; race: string; creatureClass: string } {
    if (result.claudeAnalysis) {
      return {
        concept: result.claudeAnalysis.concept || 'Unknown Concept',
        race: result.claudeAnalysis.race || 'Unknown Race',
        creatureClass: result.claudeAnalysis.class || 'Unknown Class'
      };
    }

    // Fallback for text-only generations (no Claude analysis)
    return {
      concept: result.textDescription || 'Text-generated creature',
      race: 'Unknown',
      creatureClass: 'Unknown'
    };
  }

  /**
   * Extract abilities from Claude analysis
   */
  private extractAbilities(result: GenerationResult): string[] {
    if (result.claudeAnalysis?.abilities && result.claudeAnalysis.abilities.length > 0) {
      return result.claudeAnalysis.abilities;
    }

    // Fallback: Extract from combat attributes if available
    if (result.combatAttributes?.attributes) {
      return result.combatAttributes.attributes.map(attr => attr.name);
    }

    return [];
  }

  /**
   * Transform combat attributes from generation result
   */
  private transformCombatAttributes(result: GenerationResult): StoredCombatAttribute[] {
    if (!result.combatAttributes?.attributes) {
      return [];
    }

    return result.combatAttributes.attributes.map(attr => ({
      attributeId: attr.attributeId,
      name: attr.name,
      category: attr.category,
      spriteAnimationId: attr.spriteAnimationId,
      damageType: attr.damageType,
      attackType: attr.attackType,
      priority: attr.priority
    }));
  }

  /**
   * Extract animation mappings
   * Converts AnimationSet to flat key-value map for storage
   */
  private extractAnimations(result: GenerationResult): { [key: string]: string } {
    if (!result.animations?.animationSet) {
      return {};
    }

    const { idle, walk, attack, death, additional } = result.animations.animationSet;

    // Create flat map of animation type to animation ID
    const animationMap: { [key: string]: string } = {
      idle,
      walk,
      attack,
      death
    };

    // Add additional animations with index
    additional.forEach((animId, index) => {
      animationMap[`additional_${index}`] = animId;
    });

    return animationMap;
  }

  /**
   * Capitalize first letter of string
   */
  private capitalize(str: string): string {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }
}

// Singleton instance
let transformerInstance: GenerationToCreatureTransformer | null = null;

export function getGenerationToCreatureTransformer(): GenerationToCreatureTransformer {
  if (!transformerInstance) {
    transformerInstance = new GenerationToCreatureTransformer();
  }
  return transformerInstance;
}
