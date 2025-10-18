/**
 * Generation to Creature Transformer Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GenerationToCreatureTransformer } from '../generation-to-creature.service.js';
import type { GenerationResult } from '../../../types/generation.js';

describe('GenerationToCreatureTransformer', () => {
  let transformer: GenerationToCreatureTransformer;

  // Complete valid generation result
  const mockGenerationResult: GenerationResult = {
    inputType: 'text',
    textDescription: 'A fierce fire dragon',
    claudeAnalysis: {
      concept: 'fierce fire dragon',
      race: 'dragon',
      class: 'warrior',
      primaryAttributes: {
        hp: 150,
        attack: 40,
        defense: 25,
        speed: 6
      },
      abilities: ['Fire Breath', 'Claw Strike', 'Flight'],
      suggestedAnimations: ['idle', 'walk', 'attack', 'fly', 'breathe_fire'],
      styleCharacteristics: {
        dominantColors: ['#FF0000', '#8B0000'],
        shapeComplexity: 'complex',
        artStyle: 'realistic'
      },
      confidence: 0.9,
      tokenUsage: 500
    },
    animations: {
      animationSet: {
        idle: 'idle_default',
        walk: 'walk_default',
        attack: 'attack_melee_default',
        death: 'death_default',
        additional: ['run_default', 'dodge_default', 'hit_default']
      },
      totalAnimations: 7,
      mappedFromClaude: 3,
      filledWithDefaults: 4,
      confidence: 0.95
    },
    combatAttributes: {
      attributes: [
        {
          attributeId: 'fire_breath',
          name: 'Fire Breath',
          category: 'ability',
          spriteAnimationId: 'effect-fire-1',
          damageType: 'fire',
          attackType: 'ranged',
          priority: 10
        }
      ],
      totalExtracted: 1,
      confidence: 0.9
    },
    spriteImageBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSU...',
    animationFrames: ['data:image/png;base64,frame1...', 'data:image/png;base64,frame2...'],
    battlefieldDirectionalViews: {
      E: {
        sprite: 'data:image/png;base64,E...',
        walkFrames: ['data:image/png;base64,E-walk-0...']
      },
      NE: {
        sprite: 'data:image/png;base64,NE...',
        walkFrames: ['data:image/png;base64,NE-walk-0...']
      },
      SE: {
        sprite: 'data:image/png;base64,SE...',
        walkFrames: ['data:image/png;base64,SE-walk-0...']
      }
    },
    generatedAt: new Date(),
    processingTimeMs: 15000
  };

  beforeEach(() => {
    transformer = new GenerationToCreatureTransformer();
  });

  describe('transform', () => {
    it('should transform complete generation result to creature document', () => {
      const result = transformer.transform(mockGenerationResult, 'demo-player1', 'job-123');

      expect(result).toMatchObject({
        ownerId: 'demo-player1',
        name: 'Fierce Fire Dragon',
        generationJobId: 'job-123',
        inputType: 'text',
        textDescription: 'A fierce fire dragon',
        concept: 'fierce fire dragon',
        race: 'dragon',
        class: 'warrior',
        abilities: ['Fire Breath', 'Claw Strike', 'Flight'],
        generationTimeMs: 15000,
        version: '1.0.0'
      });

      expect(result.combatAttributes).toHaveLength(1);
      expect(result.combatAttributes[0]).toMatchObject({
        attributeId: 'fire_breath',
        name: 'Fire Breath',
        category: 'ability'
      });

      expect(result.animations).toMatchObject({
        idle: 'idle_default',
        walk: 'walk_default',
        attack: 'attack_melee_default',
        death: 'death_default',
        additional_0: 'run_default',
        additional_1: 'dodge_default',
        additional_2: 'hit_default'
      });
    });

    it('should handle text-only generation without Claude analysis', () => {
      const textOnlyResult: GenerationResult = {
        ...mockGenerationResult,
        claudeAnalysis: undefined
      };

      const result = transformer.transform(textOnlyResult, 'demo-player2', 'job-456');

      expect(result.concept).toBe('A fierce fire dragon');
      expect(result.race).toBe('Unknown');
      expect(result.class).toBe('Unknown');
    });

    it('should generate fallback name from text description', () => {
      const noConceptResult: GenerationResult = {
        ...mockGenerationResult,
        claudeAnalysis: {
          ...mockGenerationResult.claudeAnalysis!,
          concept: ''
        }
      };

      const result = transformer.transform(noConceptResult, 'demo-player1', 'job-789');

      expect(result.name).toBe('Dragon Warrior'); // From race + class
    });

    it('should use text description as fallback name', () => {
      const noAnalysisResult: GenerationResult = {
        ...mockGenerationResult,
        claudeAnalysis: undefined,
        textDescription: 'mighty orc warrior'
      };

      const result = transformer.transform(noAnalysisResult, 'demo-player1', 'job-abc');

      expect(result.name).toBe('Mighty Orc Warrior');
    });

    it('should handle missing abilities', () => {
      const noAbilitiesResult: GenerationResult = {
        ...mockGenerationResult,
        claudeAnalysis: {
          ...mockGenerationResult.claudeAnalysis!,
          abilities: []
        },
        combatAttributes: undefined
      };

      const result = transformer.transform(noAbilitiesResult, 'demo-player1', 'job-def');

      expect(result.abilities).toEqual([]);
    });

    it('should extract abilities from combat attributes if Claude analysis missing', () => {
      const noClaudeAbilities: GenerationResult = {
        ...mockGenerationResult,
        claudeAnalysis: {
          ...mockGenerationResult.claudeAnalysis!,
          abilities: []
        }
      };

      const result = transformer.transform(noClaudeAbilities, 'demo-player1', 'job-ghi');

      expect(result.abilities).toEqual(['Fire Breath']);
    });
  });

  describe('validation', () => {
    it('should throw error when menu sprite missing', () => {
      const noSprite: GenerationResult = {
        ...mockGenerationResult,
        spriteImageBase64: undefined
      };

      expect(() => transformer.transform(noSprite, 'demo-player1', 'job-123'))
        .toThrow('Missing menu sprite');
    });

    it('should throw error when both directional views and legacy battlefield sprite missing', () => {
      const noBattlefield: GenerationResult = {
        ...mockGenerationResult,
        battlefieldDirectionalViews: undefined,
        battlefieldSprite: undefined
      };

      expect(() => transformer.transform(noBattlefield, 'demo-player1', 'job-123'))
        .toThrow('Missing battlefield sprite');
    });

    it('should accept legacy battlefield sprite when directional views missing', () => {
      const legacyBattlefield: GenerationResult = {
        ...mockGenerationResult,
        battlefieldDirectionalViews: undefined,
        battlefieldSprite: 'data:image/png;base64,legacy...',
        battlefieldWalkFrames: ['data:image/png;base64,legacy-walk...']
      };

      // Should not throw
      expect(() => transformer.transform(legacyBattlefield, 'demo-player1', 'job-123'))
        .not.toThrow();
    });

    it('should throw error when E direction missing', () => {
      const noE: GenerationResult = {
        ...mockGenerationResult,
        battlefieldDirectionalViews: {
          ...mockGenerationResult.battlefieldDirectionalViews!,
          E: { sprite: '', walkFrames: [] }
        }
      };

      expect(() => transformer.transform(noE, 'demo-player1', 'job-123'))
        .toThrow('Missing E direction sprite');
    });

    it('should throw error when animations missing', () => {
      const noAnimations: GenerationResult = {
        ...mockGenerationResult,
        animations: {
          animationSet: {
            idle: '',
            walk: '',
            attack: '',
            death: '',
            additional: []
          },
          totalAnimations: 0,
          mappedFromClaude: 0,
          filledWithDefaults: 0,
          confidence: 0
        }
      };

      expect(() => transformer.transform(noAnimations, 'demo-player1', 'job-123'))
        .toThrow(/Missing.*animation/);
    });

    it('should throw error with multiple validation failures', () => {
      const invalid: GenerationResult = {
        ...mockGenerationResult,
        spriteImageBase64: undefined,
        battlefieldDirectionalViews: undefined,
        battlefieldSprite: undefined,
        animations: {
          animationSet: {
            idle: '',
            walk: '',
            attack: '',
            death: '',
            additional: []
          },
          totalAnimations: 0,
          mappedFromClaude: 0,
          filledWithDefaults: 0,
          confidence: 0
        }
      };

      expect(() => transformer.transform(invalid, 'demo-player1', 'job-123'))
        .toThrow(/Missing menu sprite.*Missing battlefield sprite/);
    });
  });

  describe('combat attributes transformation', () => {
    it('should transform all combat attribute fields', () => {
      const result = transformer.transform(mockGenerationResult, 'demo-player1', 'job-123');

      expect(result.combatAttributes[0]).toEqual({
        attributeId: 'fire_breath',
        name: 'Fire Breath',
        category: 'ability',
        spriteAnimationId: 'effect-fire-1',
        damageType: 'fire',
        attackType: 'ranged',
        priority: 10
      });
    });

    it('should handle empty combat attributes', () => {
      const noAttrs: GenerationResult = {
        ...mockGenerationResult,
        combatAttributes: undefined
      };

      const result = transformer.transform(noAttrs, 'demo-player1', 'job-123');

      expect(result.combatAttributes).toEqual([]);
    });
  });
});
