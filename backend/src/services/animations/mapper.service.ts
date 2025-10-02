/**
 * Animation Mapper Service
 *
 * Maps Claude's animation suggestions to actual animation library IDs.
 * Uses fuzzy matching to handle variations and synonyms.
 * Ensures every creature has 20+ animations.
 */

import type { ClaudeAnalysisResult } from '../claude/types.js';
import type { AnimationSet, AnimationMappingResult } from './types.js';
import {
  animationLibrary,
  getDefaultBaseAnimations
} from './library.js';

/**
 * Animation Mapper Service
 * Singleton service for mapping animation suggestions
 */
class AnimationMapperService {
  constructor() {
    console.log('[Animation Mapper] Service initialized');
  }

  /**
   * Assign default animations for text-only generation (no Claude analysis)
   *
   * @returns Complete animation set with 20+ default animations
   */
  assignDefaultAnimations(): AnimationMappingResult {
    console.log('[Animation Mapper] Assigning default animations for text-only generation...');

    const baseAnimations = getDefaultBaseAnimations();
    const animationSet: AnimationSet = {
      idle: baseAnimations.idle,
      walk: baseAnimations.walk,
      attack: baseAnimations.attack,
      death: baseAnimations.death,
      additional: []
    };

    const mappedIds = new Set<string>([
      baseAnimations.idle,
      baseAnimations.walk,
      baseAnimations.attack,
      baseAnimations.death
    ]);

    // Add common default animations
    const defaultAdditional = [
      'run_default',
      'jump_default',
      'land_default',
      'dodge_default',
      'hit_default',
      'celebrate',
      'taunt',
      'scared',
      'stun',
      'attack_ranged_default',
      'defend_default',
      'roll_default',
      'dash_default',
      'cast_spell_default',
      'heal_spell',
      'buff_spell'
    ];

    for (const animId of defaultAdditional) {
      if (!mappedIds.has(animId)) {
        animationSet.additional.push(animId);
        mappedIds.add(animId);
      }
    }

    const totalAnimations = 4 + animationSet.additional.length;
    console.log(`[Animation Mapper] Assigned ${totalAnimations} default animations`);

    return {
      animationSet,
      totalAnimations,
      mappedFromClaude: 0,
      filledWithDefaults: animationSet.additional.length,
      confidence: 0.8 // High confidence for default set
    };
  }

  /**
   * Map Claude's animation suggestions to animation library IDs
   *
   * @param claudeResult - Result from Claude Vision analysis
   * @returns Complete animation set with 20+ animations
   */
  mapAnimations(claudeResult: ClaudeAnalysisResult): AnimationMappingResult {
    console.log('[Animation Mapper] Mapping animations...');
    console.log(`[Animation Mapper] Claude suggested: ${claudeResult.suggestedAnimations.length} animations`);

    // Start with base animations
    const baseAnimations = getDefaultBaseAnimations();
    const animationSet: AnimationSet = {
      idle: baseAnimations.idle,
      walk: baseAnimations.walk,
      attack: baseAnimations.attack,
      death: baseAnimations.death,
      additional: []
    };

    let mappedCount = 0;
    const mappedIds = new Set<string>([
      baseAnimations.idle,
      baseAnimations.walk,
      baseAnimations.attack,
      baseAnimations.death
    ]);

    // Map Claude's suggestions
    for (const suggestion of claudeResult.suggestedAnimations) {
      const matched = this.findBestMatch(suggestion);

      if (matched && !mappedIds.has(matched.id)) {
        // Check if this should replace a base animation
        if (this.isIdleVariant(suggestion) && matched.category === 'idle') {
          animationSet.idle = matched.id;
        } else if (this.isWalkVariant(suggestion) && matched.category === 'locomotion') {
          animationSet.walk = matched.id;
        } else if (this.isAttackVariant(suggestion) && matched.category === 'combat') {
          animationSet.attack = matched.id;
        } else if (this.isDeathVariant(suggestion) && matched.category === 'reactions') {
          animationSet.death = matched.id;
        } else {
          // Add to additional animations
          animationSet.additional.push(matched.id);
        }

        mappedIds.add(matched.id);
        mappedCount++;
      }
    }

    // Fill with ability-specific animations based on Claude's abilities
    const abilityAnimations = this.getAbilityAnimations(claudeResult.abilities);
    for (const abilityAnim of abilityAnimations) {
      if (!mappedIds.has(abilityAnim)) {
        animationSet.additional.push(abilityAnim);
        mappedIds.add(abilityAnim);
      }
    }

    // Fill with race-specific animations
    const raceAnimations = this.getRaceSpecificAnimations(claudeResult.race);
    for (const raceAnim of raceAnimations) {
      if (!mappedIds.has(raceAnim) && animationSet.additional.length < 30) {
        animationSet.additional.push(raceAnim);
        mappedIds.add(raceAnim);
      }
    }

    // Fill with class-specific animations
    const classAnimations = this.getClassSpecificAnimations(claudeResult.class);
    for (const classAnim of classAnimations) {
      if (!mappedIds.has(classAnim) && animationSet.additional.length < 30) {
        animationSet.additional.push(classAnim);
        mappedIds.add(classAnim);
      }
    }

    // Ensure we have at least 20 total animations
    const totalAnimations = 4 + animationSet.additional.length; // 4 base + additional
    if (totalAnimations < 20) {
      const needed = 20 - totalAnimations;
      const fillers = this.getFillerAnimations(needed, mappedIds);
      animationSet.additional.push(...fillers);
    }

    const finalTotal = 4 + animationSet.additional.length;
    const filledCount = finalTotal - mappedCount - 4; // Exclude base 4

    console.log(`[Animation Mapper] Mapped ${mappedCount} from Claude suggestions`);
    console.log(`[Animation Mapper] Added ${filledCount} filler animations`);
    console.log(`[Animation Mapper] Total animations: ${finalTotal}`);

    return {
      animationSet,
      totalAnimations: finalTotal,
      mappedFromClaude: mappedCount,
      filledWithDefaults: filledCount,
      confidence: this.calculateConfidence(mappedCount, finalTotal)
    };
  }

  /**
   * Find best matching animation for a suggestion
   * Uses fuzzy string matching and tag matching
   */
  private findBestMatch(suggestion: string): typeof animationLibrary[0] | null {
    const normalized = suggestion.toLowerCase().trim();

    // 1. Try exact ID match
    let match = animationLibrary.find(anim => anim.id === normalized);
    if (match) return match;

    // 2. Try exact name match
    match = animationLibrary.find(anim =>
      anim.name.toLowerCase() === normalized
    );
    if (match) return match;

    // 3. Try tag match
    match = animationLibrary.find(anim =>
      anim.tags.includes(normalized)
    );
    if (match) return match;

    // 4. Try partial match with tags
    const words = normalized.split(/[\s_-]+/);
    match = animationLibrary.find(anim =>
      words.some(word => anim.tags.some(tag => tag.includes(word)))
    );
    if (match) return match;

    // 5. Try fuzzy string match (Levenshtein distance)
    let bestMatch: typeof animationLibrary[0] | null = null;
    let bestScore = 0;

    for (const anim of animationLibrary) {
      // Check against name
      const nameScore = this.similarityScore(normalized, anim.name.toLowerCase());
      if (nameScore > bestScore && nameScore > 0.6) {
        bestScore = nameScore;
        bestMatch = anim;
      }

      // Check against tags
      for (const tag of anim.tags) {
        const tagScore = this.similarityScore(normalized, tag);
        if (tagScore > bestScore && tagScore > 0.7) {
          bestScore = tagScore;
          bestMatch = anim;
        }
      }
    }

    return bestMatch;
  }

  /**
   * Calculate similarity score between two strings (0-1)
   * Uses Dice coefficient (bigram similarity)
   */
  private similarityScore(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    if (str1.length < 2 || str2.length < 2) return 0.0;

    // Generate bigrams
    const bigrams1 = new Set<string>();
    for (let i = 0; i < str1.length - 1; i++) {
      bigrams1.add(str1.substring(i, i + 2));
    }

    const bigrams2 = new Set<string>();
    for (let i = 0; i < str2.length - 1; i++) {
      bigrams2.add(str2.substring(i, i + 2));
    }

    // Count intersection
    let intersection = 0;
    for (const bigram of bigrams1) {
      if (bigrams2.has(bigram)) {
        intersection++;
      }
    }

    // Dice coefficient
    return (2.0 * intersection) / (bigrams1.size + bigrams2.size);
  }

  /**
   * Get animations for specific abilities
   */
  private getAbilityAnimations(abilities: string[]): string[] {
    const animations: string[] = [];

    for (const ability of abilities) {
      const normalized = ability.toLowerCase();

      // Map common abilities to animations
      if (normalized.includes('fire') || normalized.includes('flame') || normalized.includes('burn')) {
        animations.push('cast_fire_spell', 'breathe_fire');
      } else if (normalized.includes('ice') || normalized.includes('frost') || normalized.includes('freeze')) {
        animations.push('cast_ice_spell');
      } else if (normalized.includes('lightning') || normalized.includes('thunder') || normalized.includes('electric')) {
        animations.push('cast_lightning_spell');
      } else if (normalized.includes('heal') || normalized.includes('cure') || normalized.includes('restore')) {
        animations.push('heal_spell');
      } else if (normalized.includes('fly') || normalized.includes('flight') || normalized.includes('wing')) {
        animations.push('fly_default', 'glide_default', 'wing_attack');
      } else if (normalized.includes('claw') || normalized.includes('scratch')) {
        animations.push('attack_melee_claw');
      } else if (normalized.includes('bite') || normalized.includes('chomp')) {
        animations.push('attack_melee_bite');
      } else if (normalized.includes('tail')) {
        animations.push('tail_whip');
      } else if (normalized.includes('roar') || normalized.includes('bellow')) {
        animations.push('roar');
      } else if (normalized.includes('magic') || normalized.includes('spell') || normalized.includes('cast')) {
        animations.push('cast_spell_default');
      } else if (normalized.includes('ranged') || normalized.includes('bow') || normalized.includes('arrow')) {
        animations.push('attack_ranged_bow');
      }
    }

    return [...new Set(animations)]; // Remove duplicates
  }

  /**
   * Get race-specific animations
   */
  private getRaceSpecificAnimations(race: string): string[] {
    const normalized = race.toLowerCase();

    if (normalized.includes('dragon')) {
      return ['fly_default', 'glide_default', 'breathe_fire', 'roar', 'tail_whip', 'wing_attack', 'land_default'];
    } else if (normalized.includes('beast') || normalized.includes('wolf') || normalized.includes('tiger')) {
      return ['attack_melee_claw', 'attack_melee_bite', 'roar', 'dash_default'];
    } else if (normalized.includes('bird') || normalized.includes('harpy')) {
      return ['fly_default', 'glide_default', 'wing_attack', 'land_default'];
    } else if (normalized.includes('undead') || normalized.includes('skeleton') || normalized.includes('zombie')) {
      return ['crawl_default', 'stun'];
    } else if (normalized.includes('demon') || normalized.includes('devil')) {
      return ['cast_fire_spell', 'teleport', 'roar'];
    } else if (normalized.includes('elemental')) {
      return ['cast_spell_default', 'cast_fire_spell', 'cast_ice_spell', 'cast_lightning_spell'];
    }

    return [];
  }

  /**
   * Get class-specific animations
   */
  private getClassSpecificAnimations(className: string): string[] {
    const normalized = className.toLowerCase();

    if (normalized.includes('warrior') || normalized.includes('fighter')) {
      return ['attack_melee_sword', 'defend_shield', 'charge_attack', 'parry_default'];
    } else if (normalized.includes('mage') || normalized.includes('wizard') || normalized.includes('sorcerer')) {
      return ['cast_spell_default', 'cast_fire_spell', 'cast_ice_spell', 'cast_lightning_spell', 'teleport'];
    } else if (normalized.includes('rogue') || normalized.includes('assassin') || normalized.includes('thief')) {
      return ['stealth', 'dash_default', 'attack_melee_default', 'dodge_default', 'roll_default'];
    } else if (normalized.includes('archer') || normalized.includes('ranger')) {
      return ['attack_ranged_bow', 'dodge_default', 'roll_default'];
    } else if (normalized.includes('tank') || normalized.includes('guardian')) {
      return ['defend_shield', 'taunt', 'charge_attack', 'stomp'];
    } else if (normalized.includes('healer') || normalized.includes('cleric') || normalized.includes('priest')) {
      return ['heal_spell', 'buff_spell', 'cast_spell_default'];
    }

    return [];
  }

  /**
   * Get filler animations to reach minimum count
   */
  private getFillerAnimations(count: number, exclude: Set<string>): string[] {
    const fillers: string[] = [];

    // Priority order for filler animations
    const priorityAnimations = [
      'run_default',
      'jump_default',
      'land_default',
      'dodge_default',
      'hit_default',
      'celebrate',
      'taunt',
      'scared',
      'stun',
      'attack_ranged_default',
      'defend_default',
      'roll_default',
      'dash_default',
      'turn_left',
      'turn_right',
      'knockback',
      'counter_attack',
      'charge_attack',
      'special_move_1',
      'special_move_2'
    ];

    for (const animId of priorityAnimations) {
      if (!exclude.has(animId) && fillers.length < count) {
        fillers.push(animId);
      }
    }

    // If still need more, add from library
    if (fillers.length < count) {
      for (const anim of animationLibrary) {
        if (!exclude.has(anim.id) && !fillers.includes(anim.id) && fillers.length < count) {
          fillers.push(anim.id);
        }
      }
    }

    return fillers;
  }

  /**
   * Check if suggestion is an idle variant
   */
  private isIdleVariant(suggestion: string): boolean {
    const lower = suggestion.toLowerCase();
    return lower.includes('idle') || lower.includes('stand') || lower.includes('wait');
  }

  /**
   * Check if suggestion is a walk variant
   */
  private isWalkVariant(suggestion: string): boolean {
    const lower = suggestion.toLowerCase();
    return lower === 'walk' || lower === 'walking';
  }

  /**
   * Check if suggestion is an attack variant
   */
  private isAttackVariant(suggestion: string): boolean {
    const lower = suggestion.toLowerCase();
    return lower === 'attack' || lower === 'attacking';
  }

  /**
   * Check if suggestion is a death variant
   */
  private isDeathVariant(suggestion: string): boolean {
    const lower = suggestion.toLowerCase();
    return lower === 'death' || lower === 'die' || lower === 'dying' || lower === 'killed';
  }

  /**
   * Calculate mapping confidence score (0-1)
   */
  private calculateConfidence(mappedCount: number, totalCount: number): number {
    // Higher confidence if more animations were successfully mapped
    const mappingRatio = mappedCount / Math.max(totalCount - 4, 1); // Exclude base 4
    return Math.min(mappingRatio, 1.0);
  }
}

// Export singleton instance
export const animationMapper = new AnimationMapperService();
