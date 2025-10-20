/**
 * StatsAssigner Tests
 *
 * TDD test suite for combat stats assignment based on Claude analysis
 */

import { StatsAssigner } from '../stats-assigner';
import { ClaudeAnalysisResult } from '../../claude/types';

describe('StatsAssigner', () => {
  let assigner: StatsAssigner;

  beforeEach(() => {
    assigner = new StatsAssigner();
  });

  describe('Archetype Detection', () => {
    describe('Tank Archetype', () => {
      it('should detect warrior as tank', () => {
        const analysis: ClaudeAnalysisResult = createMockAnalysis('warrior');
        const stats = assigner.assignCombatStats(analysis);
        expect(stats.archetype).toBe('tank');
      });

      it('should detect knight as tank', () => {
        const analysis: ClaudeAnalysisResult = createMockAnalysis('knight');
        const stats = assigner.assignCombatStats(analysis);
        expect(stats.archetype).toBe('tank');
      });

      it('should detect guardian as tank', () => {
        const analysis: ClaudeAnalysisResult = createMockAnalysis('guardian');
        const stats = assigner.assignCombatStats(analysis);
        expect(stats.archetype).toBe('tank');
      });

      it('should detect paladin as tank', () => {
        const analysis: ClaudeAnalysisResult = createMockAnalysis('paladin');
        const stats = assigner.assignCombatStats(analysis);
        expect(stats.archetype).toBe('tank');
      });
    });

    describe('Melee DPS Archetype', () => {
      it('should detect rogue as melee_dps', () => {
        const analysis: ClaudeAnalysisResult = createMockAnalysis('rogue');
        const stats = assigner.assignCombatStats(analysis);
        expect(stats.archetype).toBe('melee_dps');
      });

      it('should detect assassin as melee_dps', () => {
        const analysis: ClaudeAnalysisResult = createMockAnalysis('assassin');
        const stats = assigner.assignCombatStats(analysis);
        expect(stats.archetype).toBe('melee_dps');
      });

      it('should detect berserker as melee_dps', () => {
        const analysis: ClaudeAnalysisResult = createMockAnalysis('berserker');
        const stats = assigner.assignCombatStats(analysis);
        expect(stats.archetype).toBe('melee_dps');
      });

      it('should detect fighter as melee_dps', () => {
        const analysis: ClaudeAnalysisResult = createMockAnalysis('fighter');
        const stats = assigner.assignCombatStats(analysis);
        expect(stats.archetype).toBe('melee_dps');
      });
    });

    describe('Ranged DPS Archetype', () => {
      it('should detect archer as ranged_dps', () => {
        const analysis: ClaudeAnalysisResult = createMockAnalysis('archer');
        const stats = assigner.assignCombatStats(analysis);
        expect(stats.archetype).toBe('ranged_dps');
      });

      it('should detect ranger as ranged_dps', () => {
        const analysis: ClaudeAnalysisResult = createMockAnalysis('ranger');
        const stats = assigner.assignCombatStats(analysis);
        expect(stats.archetype).toBe('ranged_dps');
      });

      it('should detect marksman as ranged_dps', () => {
        const analysis: ClaudeAnalysisResult = createMockAnalysis('marksman');
        const stats = assigner.assignCombatStats(analysis);
        expect(stats.archetype).toBe('ranged_dps');
      });

      it('should detect hunter as ranged_dps', () => {
        const analysis: ClaudeAnalysisResult = createMockAnalysis('hunter');
        const stats = assigner.assignCombatStats(analysis);
        expect(stats.archetype).toBe('ranged_dps');
      });
    });

    describe('Mage Archetype', () => {
      it('should detect mage as mage', () => {
        const analysis: ClaudeAnalysisResult = createMockAnalysis('mage');
        const stats = assigner.assignCombatStats(analysis);
        expect(stats.archetype).toBe('mage');
      });

      it('should detect wizard as mage', () => {
        const analysis: ClaudeAnalysisResult = createMockAnalysis('wizard');
        const stats = assigner.assignCombatStats(analysis);
        expect(stats.archetype).toBe('mage');
      });

      it('should detect sorcerer as mage', () => {
        const analysis: ClaudeAnalysisResult = createMockAnalysis('sorcerer');
        const stats = assigner.assignCombatStats(analysis);
        expect(stats.archetype).toBe('mage');
      });

      it('should detect warlock as mage', () => {
        const analysis: ClaudeAnalysisResult = createMockAnalysis('warlock');
        const stats = assigner.assignCombatStats(analysis);
        expect(stats.archetype).toBe('mage');
      });
    });

    describe('Support Archetype', () => {
      it('should detect cleric as support', () => {
        const analysis: ClaudeAnalysisResult = createMockAnalysis('cleric');
        const stats = assigner.assignCombatStats(analysis);
        expect(stats.archetype).toBe('support');
      });

      it('should detect priest as support', () => {
        const analysis: ClaudeAnalysisResult = createMockAnalysis('priest');
        const stats = assigner.assignCombatStats(analysis);
        expect(stats.archetype).toBe('support');
      });

      it('should detect healer as support', () => {
        const analysis: ClaudeAnalysisResult = createMockAnalysis('healer');
        const stats = assigner.assignCombatStats(analysis);
        expect(stats.archetype).toBe('support');
      });

      it('should detect druid as support', () => {
        const analysis: ClaudeAnalysisResult = createMockAnalysis('druid');
        const stats = assigner.assignCombatStats(analysis);
        expect(stats.archetype).toBe('support');
      });
    });

    describe('Case Insensitivity', () => {
      it('should detect archetype regardless of case', () => {
        const upperCase = createMockAnalysis('WARRIOR');
        const lowerCase = createMockAnalysis('warrior');
        const mixedCase = createMockAnalysis('WaRrIoR');

        expect(assigner.assignCombatStats(upperCase).archetype).toBe('tank');
        expect(assigner.assignCombatStats(lowerCase).archetype).toBe('tank');
        expect(assigner.assignCombatStats(mixedCase).archetype).toBe('tank');
      });
    });

    describe('Unknown Classes', () => {
      it('should default to melee_dps for unknown class', () => {
        const analysis: ClaudeAnalysisResult = createMockAnalysis('unknown_class');
        const stats = assigner.assignCombatStats(analysis);
        expect(stats.archetype).toBe('melee_dps');
      });
    });
  });

  describe('Movement Speed Assignment', () => {
    it('should assign tank movement speed (1.5-2.0 hexes/sec)', () => {
      const analysis: ClaudeAnalysisResult = createMockAnalysis('warrior');
      const stats = assigner.assignCombatStats(analysis);
      expect(stats.movementSpeed).toBeGreaterThanOrEqual(1.5);
      expect(stats.movementSpeed).toBeLessThanOrEqual(2.0);
    });

    it('should assign melee DPS movement speed (3.0-4.0 hexes/sec)', () => {
      const analysis: ClaudeAnalysisResult = createMockAnalysis('rogue');
      const stats = assigner.assignCombatStats(analysis);
      expect(stats.movementSpeed).toBeGreaterThanOrEqual(3.0);
      expect(stats.movementSpeed).toBeLessThanOrEqual(4.0);
    });

    it('should assign ranged DPS movement speed (2.5-3.0 hexes/sec)', () => {
      const analysis: ClaudeAnalysisResult = createMockAnalysis('archer');
      const stats = assigner.assignCombatStats(analysis);
      expect(stats.movementSpeed).toBeGreaterThanOrEqual(2.5);
      expect(stats.movementSpeed).toBeLessThanOrEqual(3.0);
    });

    it('should assign mage movement speed (2.0-2.5 hexes/sec)', () => {
      const analysis: ClaudeAnalysisResult = createMockAnalysis('wizard');
      const stats = assigner.assignCombatStats(analysis);
      expect(stats.movementSpeed).toBeGreaterThanOrEqual(2.0);
      expect(stats.movementSpeed).toBeLessThanOrEqual(2.5);
    });

    it('should assign support movement speed (2.0-3.0 hexes/sec)', () => {
      const analysis: ClaudeAnalysisResult = createMockAnalysis('cleric');
      const stats = assigner.assignCombatStats(analysis);
      expect(stats.movementSpeed).toBeGreaterThanOrEqual(2.0);
      expect(stats.movementSpeed).toBeLessThanOrEqual(3.0);
    });
  });

  describe('Attack Range Assignment', () => {
    describe('Melee Range Detection', () => {
      it('should assign melee range (1 hex) for tank with no ranged abilities', () => {
        const analysis: ClaudeAnalysisResult = createMockAnalysis('warrior', ['shield_bash', 'taunt']);
        const stats = assigner.assignCombatStats(analysis);
        expect(stats.attackRange).toBe(1);
      });

      it('should assign melee range (1 hex) for melee DPS with no ranged abilities', () => {
        const analysis: ClaudeAnalysisResult = createMockAnalysis('rogue', ['backstab', 'stealth']);
        const stats = assigner.assignCombatStats(analysis);
        expect(stats.attackRange).toBe(1);
      });
    });

    describe('Ranged Weapon Detection', () => {
      it('should assign ranged weapon range (4-6 hexes) for bow abilities', () => {
        const analysis: ClaudeAnalysisResult = createMockAnalysis('archer', ['bow_shot', 'quick_draw']);
        const stats = assigner.assignCombatStats(analysis);
        expect(stats.attackRange).toBeGreaterThanOrEqual(4);
        expect(stats.attackRange).toBeLessThanOrEqual(6);
      });

      it('should assign ranged weapon range for arrow abilities', () => {
        const analysis: ClaudeAnalysisResult = createMockAnalysis('ranger', ['fire_arrow', 'poison_arrow']);
        const stats = assigner.assignCombatStats(analysis);
        expect(stats.attackRange).toBeGreaterThanOrEqual(4);
        expect(stats.attackRange).toBeLessThanOrEqual(6);
      });

      it('should detect ranged weapons case-insensitively', () => {
        const analysis: ClaudeAnalysisResult = createMockAnalysis('hunter', ['BOW_SHOT', 'ARROW_rain']);
        const stats = assigner.assignCombatStats(analysis);
        expect(stats.attackRange).toBeGreaterThanOrEqual(4);
        expect(stats.attackRange).toBeLessThanOrEqual(6);
      });
    });

    describe('Spell Caster Detection', () => {
      it('should assign spell range (3-5 hexes) for spell abilities', () => {
        const analysis: ClaudeAnalysisResult = createMockAnalysis('mage', ['fireball_spell', 'ice_shard']);
        const stats = assigner.assignCombatStats(analysis);
        expect(stats.attackRange).toBeGreaterThanOrEqual(3);
        expect(stats.attackRange).toBeLessThanOrEqual(5);
      });

      it('should assign spell range for magic abilities', () => {
        const analysis: ClaudeAnalysisResult = createMockAnalysis('wizard', ['magic_missile', 'arcane_blast']);
        const stats = assigner.assignCombatStats(analysis);
        expect(stats.attackRange).toBeGreaterThanOrEqual(3);
        expect(stats.attackRange).toBeLessThanOrEqual(5);
      });

      it('should assign spell range for staff abilities', () => {
        const analysis: ClaudeAnalysisResult = createMockAnalysis('sorcerer', ['staff_blast', 'channel_power']);
        const stats = assigner.assignCombatStats(analysis);
        expect(stats.attackRange).toBeGreaterThanOrEqual(3);
        expect(stats.attackRange).toBeLessThanOrEqual(5);
      });

      it('should detect spells case-insensitively', () => {
        const analysis: ClaudeAnalysisResult = createMockAnalysis('warlock', ['SPELL_dark_bolt', 'MAGIC_drain']);
        const stats = assigner.assignCombatStats(analysis);
        expect(stats.attackRange).toBeGreaterThanOrEqual(3);
        expect(stats.attackRange).toBeLessThanOrEqual(5);
      });
    });
  });

  describe('Attack Speed Assignment', () => {
    it('should assign tank attack speed (1 attack per 10 seconds)', () => {
      const analysis: ClaudeAnalysisResult = createMockAnalysis('warrior');
      const stats = assigner.assignCombatStats(analysis);
      expect(stats.attackSpeed).toBe(1);
    });

    it('should assign melee DPS attack speed (2-3 attacks per 10 seconds)', () => {
      const analysis: ClaudeAnalysisResult = createMockAnalysis('rogue');
      const stats = assigner.assignCombatStats(analysis);
      expect(stats.attackSpeed).toBeGreaterThanOrEqual(2);
      expect(stats.attackSpeed).toBeLessThanOrEqual(3);
    });

    it('should assign ranged DPS attack speed (2 attacks per 10 seconds)', () => {
      const analysis: ClaudeAnalysisResult = createMockAnalysis('archer');
      const stats = assigner.assignCombatStats(analysis);
      expect(stats.attackSpeed).toBe(2);
    });

    it('should assign mage attack speed (1-2 attacks per 10 seconds)', () => {
      const analysis: ClaudeAnalysisResult = createMockAnalysis('wizard');
      const stats = assigner.assignCombatStats(analysis);
      expect(stats.attackSpeed).toBeGreaterThanOrEqual(1);
      expect(stats.attackSpeed).toBeLessThanOrEqual(2);
    });

    it('should assign support attack speed (1 attack per 10 seconds)', () => {
      const analysis: ClaudeAnalysisResult = createMockAnalysis('cleric');
      const stats = assigner.assignCombatStats(analysis);
      expect(stats.attackSpeed).toBe(1);
    });
  });

  describe('Base Stats Assignment', () => {
    it('should assign attack damage from Claude primaryAttributes', () => {
      const analysis: ClaudeAnalysisResult = createMockAnalysis('warrior');
      analysis.primaryAttributes.attack = 35;
      const stats = assigner.assignCombatStats(analysis);
      expect(stats.attackDamage).toBe(35);
    });

    it('should assign armor from Claude primaryAttributes', () => {
      const analysis: ClaudeAnalysisResult = createMockAnalysis('warrior');
      analysis.primaryAttributes.defense = 25;
      const stats = assigner.assignCombatStats(analysis);
      expect(stats.armor).toBe(25);
    });

    it('should assign max health from Claude primaryAttributes', () => {
      const analysis: ClaudeAnalysisResult = createMockAnalysis('warrior');
      analysis.primaryAttributes.hp = 150;
      const stats = assigner.assignCombatStats(analysis);
      expect(stats.maxHealth).toBe(150);
    });
  });

  describe('Complete Integration', () => {
    it('should assign complete stats for a tank warrior', () => {
      const analysis: ClaudeAnalysisResult = {
        concept: 'armored knight',
        race: 'human',
        class: 'warrior',
        primaryAttributes: {
          hp: 150,
          attack: 30,
          defense: 25,
          speed: 5
        },
        abilities: ['shield_bash', 'taunt', 'heavy_strike'],
        suggestedAnimations: ['idle', 'walk', 'attack', 'defend'],
        styleCharacteristics: {
          dominantColors: ['#808080', '#C0C0C0'],
          shapeComplexity: 'moderate',
          artStyle: 'realistic'
        },
        confidence: 0.9,
        tokenUsage: 1500
      };

      const stats = assigner.assignCombatStats(analysis);

      expect(stats.archetype).toBe('tank');
      expect(stats.movementSpeed).toBeGreaterThanOrEqual(1.5);
      expect(stats.movementSpeed).toBeLessThanOrEqual(2.0);
      expect(stats.attackRange).toBe(1);
      expect(stats.attackSpeed).toBe(1);
      expect(stats.attackDamage).toBe(30);
      expect(stats.armor).toBe(25);
      expect(stats.maxHealth).toBe(150);
    });

    it('should assign complete stats for a ranged archer', () => {
      const analysis: ClaudeAnalysisResult = {
        concept: 'elven archer',
        race: 'elf',
        class: 'archer',
        primaryAttributes: {
          hp: 80,
          attack: 40,
          defense: 10,
          speed: 8
        },
        abilities: ['bow_shot', 'multishot', 'aimed_shot'],
        suggestedAnimations: ['idle', 'walk', 'attack', 'reload'],
        styleCharacteristics: {
          dominantColors: ['#228B22', '#8B4513'],
          shapeComplexity: 'simple',
          artStyle: 'cartoon'
        },
        confidence: 0.85,
        tokenUsage: 1400
      };

      const stats = assigner.assignCombatStats(analysis);

      expect(stats.archetype).toBe('ranged_dps');
      expect(stats.movementSpeed).toBeGreaterThanOrEqual(2.5);
      expect(stats.movementSpeed).toBeLessThanOrEqual(3.0);
      expect(stats.attackRange).toBeGreaterThanOrEqual(4);
      expect(stats.attackRange).toBeLessThanOrEqual(6);
      expect(stats.attackSpeed).toBe(2);
      expect(stats.attackDamage).toBe(40);
      expect(stats.armor).toBe(10);
      expect(stats.maxHealth).toBe(80);
    });

    it('should assign complete stats for a spell-casting mage', () => {
      const analysis: ClaudeAnalysisResult = {
        concept: 'arcane wizard',
        race: 'human',
        class: 'wizard',
        primaryAttributes: {
          hp: 60,
          attack: 45,
          defense: 5,
          speed: 4
        },
        abilities: ['fireball_spell', 'ice_spell', 'magic_shield'],
        suggestedAnimations: ['idle', 'walk', 'cast', 'channel'],
        styleCharacteristics: {
          dominantColors: ['#4169E1', '#9370DB'],
          shapeComplexity: 'complex',
          artStyle: 'realistic'
        },
        confidence: 0.92,
        tokenUsage: 1600
      };

      const stats = assigner.assignCombatStats(analysis);

      expect(stats.archetype).toBe('mage');
      expect(stats.movementSpeed).toBeGreaterThanOrEqual(2.0);
      expect(stats.movementSpeed).toBeLessThanOrEqual(2.5);
      expect(stats.attackRange).toBeGreaterThanOrEqual(3);
      expect(stats.attackRange).toBeLessThanOrEqual(5);
      expect(stats.attackSpeed).toBeGreaterThanOrEqual(1);
      expect(stats.attackSpeed).toBeLessThanOrEqual(2);
      expect(stats.attackDamage).toBe(45);
      expect(stats.armor).toBe(5);
      expect(stats.maxHealth).toBe(60);
    });
  });
});

/**
 * Helper function to create mock Claude analysis results for testing
 */
function createMockAnalysis(
  className: string,
  abilities: string[] = ['basic_attack']
): ClaudeAnalysisResult {
  return {
    concept: `test ${className}`,
    race: 'human',
    class: className,
    primaryAttributes: {
      hp: 100,
      attack: 20,
      defense: 15,
      speed: 5
    },
    abilities,
    suggestedAnimations: ['idle', 'walk', 'attack'],
    styleCharacteristics: {
      dominantColors: ['#FFFFFF'],
      shapeComplexity: 'simple',
      artStyle: 'cartoon'
    },
    confidence: 0.8,
    tokenUsage: 1000
  };
}
