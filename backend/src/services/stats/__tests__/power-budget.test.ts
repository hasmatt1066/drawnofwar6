import {
  balanceStatsByBudget,
  calculatePowerBudget,
  validatePowerBudget,
  PowerBudgetStats,
} from '../power-budget';

describe('calculatePowerBudget', () => {
  it('should calculate power budget correctly', () => {
    const stats: PowerBudgetStats = {
      hp: 100,
      attackDamage: 50,
      armor: 20,
    };
    // (100/10) + 50 + (20 * 2) = 10 + 50 + 40 = 100
    expect(calculatePowerBudget(stats)).toBe(100);
  });

  it('should handle high HP correctly', () => {
    const stats: PowerBudgetStats = {
      hp: 500,
      attackDamage: 30,
      armor: 15,
    };
    // (500/10) + 30 + (15 * 2) = 50 + 30 + 30 = 110
    expect(calculatePowerBudget(stats)).toBe(110);
  });

  it('should handle zero armor', () => {
    const stats: PowerBudgetStats = {
      hp: 300,
      attackDamage: 95,
      armor: 0,
    };
    // (300/10) + 95 + (0 * 2) = 30 + 95 + 0 = 125
    expect(calculatePowerBudget(stats)).toBe(125);
  });

  it('should handle minimum stats', () => {
    const stats: PowerBudgetStats = {
      hp: 50,
      attackDamage: 10,
      armor: 0,
    };
    // (50/10) + 10 + (0 * 2) = 5 + 10 + 0 = 15
    expect(calculatePowerBudget(stats)).toBe(15);
  });
});

describe('validatePowerBudget', () => {
  it('should validate stats within budget range (100-150)', () => {
    const validStats: PowerBudgetStats = {
      hp: 100,
      attackDamage: 50,
      armor: 20,
    };
    expect(validatePowerBudget(validStats)).toBe(true);
  });

  it('should validate stats at lower bound (100)', () => {
    const stats: PowerBudgetStats = {
      hp: 100,
      attackDamage: 50,
      armor: 20,
    };
    expect(validatePowerBudget(stats)).toBe(true);
  });

  it('should validate stats at upper bound (150)', () => {
    const stats: PowerBudgetStats = {
      hp: 500,
      attackDamage: 50,
      armor: 25,
    };
    // (500/10) + 50 + (25 * 2) = 50 + 50 + 50 = 150
    expect(validatePowerBudget(stats)).toBe(true);
  });

  it('should invalidate stats below budget range', () => {
    const lowStats: PowerBudgetStats = {
      hp: 50,
      attackDamage: 10,
      armor: 0,
    };
    expect(validatePowerBudget(lowStats)).toBe(false);
  });

  it('should invalidate stats above budget range', () => {
    const highStats: PowerBudgetStats = {
      hp: 1000,
      attackDamage: 100,
      armor: 50,
    };
    // (1000/10) + 100 + (50 * 2) = 100 + 100 + 100 = 300
    expect(validatePowerBudget(highStats)).toBe(false);
  });
});

describe('balanceStatsByBudget', () => {
  describe('stats already within budget', () => {
    it('should not modify stats already in valid range', () => {
      const validStats: PowerBudgetStats = {
        hp: 200,
        attackDamage: 60,
        armor: 15,
      };
      // (200/10) + 60 + (15 * 2) = 20 + 60 + 30 = 110
      const result = balanceStatsByBudget(validStats, 'warrior');
      expect(result).toEqual(validStats);
    });

    it('should keep stats at minimum valid budget', () => {
      const stats: PowerBudgetStats = {
        hp: 100,
        attackDamage: 50,
        armor: 20,
      };
      const result = balanceStatsByBudget(stats, 'archer');
      expect(result).toEqual(stats);
    });

    it('should keep stats at maximum valid budget', () => {
      const stats: PowerBudgetStats = {
        hp: 500,
        attackDamage: 50,
        armor: 25,
      };
      const result = balanceStatsByBudget(stats, 'tank');
      expect(result).toEqual(stats);
    });
  });

  describe('stats below budget range', () => {
    it('should scale up stats below minimum budget', () => {
      const lowStats: PowerBudgetStats = {
        hp: 50,
        attackDamage: 20,
        armor: 5,
      };
      // Current budget: (50/10) + 20 + (5 * 2) = 5 + 20 + 10 = 35
      // Target: 125 (midpoint)
      // Scale factor: 125 / 35 = ~3.57
      const result = balanceStatsByBudget(lowStats, 'warrior');

      const finalBudget = calculatePowerBudget(result);
      expect(finalBudget).toBeGreaterThanOrEqual(100);
      expect(finalBudget).toBeLessThanOrEqual(150);
    });

    it('should enforce minimum HP constraint when scaling', () => {
      const lowStats: PowerBudgetStats = {
        hp: 30,
        attackDamage: 15,
        armor: 3,
      };
      const result = balanceStatsByBudget(lowStats, 'mage');

      expect(result.hp).toBeGreaterThanOrEqual(50);
      expect(validatePowerBudget(result)).toBe(true);
    });

    it('should enforce minimum damage constraint when scaling', () => {
      const lowStats: PowerBudgetStats = {
        hp: 80,
        attackDamage: 5,
        armor: 2,
      };
      const result = balanceStatsByBudget(lowStats, 'archer');

      expect(result.attackDamage).toBeGreaterThanOrEqual(10);
      expect(validatePowerBudget(result)).toBe(true);
    });
  });

  describe('stats above budget range', () => {
    it('should scale down stats above maximum budget', () => {
      const highStats: PowerBudgetStats = {
        hp: 1000,
        attackDamage: 100,
        armor: 50,
      };
      // Current budget: (1000/10) + 100 + (50 * 2) = 100 + 100 + 100 = 300
      // Target: 125 (midpoint)
      // Scale factor: 125 / 300 = ~0.42
      const result = balanceStatsByBudget(highStats, 'berserker');

      const finalBudget = calculatePowerBudget(result);
      expect(finalBudget).toBeGreaterThanOrEqual(100);
      expect(finalBudget).toBeLessThanOrEqual(150);
    });

    it('should maintain stat proportions when scaling down', () => {
      const highStats: PowerBudgetStats = {
        hp: 600,
        attackDamage: 80,
        armor: 30,
      };
      const result = balanceStatsByBudget(highStats, 'paladin');

      // Check proportions are maintained (within rounding)
      const originalRatio = highStats.attackDamage / (highStats.hp / 10);
      const resultRatio = result.attackDamage / (result.hp / 10);
      expect(Math.abs(originalRatio - resultRatio)).toBeLessThan(0.5);

      expect(validatePowerBudget(result)).toBe(true);
    });

    it('should enforce minimum constraints even when scaling down', () => {
      const highStats: PowerBudgetStats = {
        hp: 2000,
        attackDamage: 200,
        armor: 0,
      };
      const result = balanceStatsByBudget(highStats, 'juggernaut');

      expect(result.hp).toBeGreaterThanOrEqual(50);
      expect(result.attackDamage).toBeGreaterThanOrEqual(10);
      expect(result.armor).toBeGreaterThanOrEqual(0);
      expect(validatePowerBudget(result)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle zero armor', () => {
      const stats: PowerBudgetStats = {
        hp: 50,
        attackDamage: 30,
        armor: 0,
      };
      // Budget: (50/10) + 30 + 0 = 35
      const result = balanceStatsByBudget(stats, 'glass-cannon');

      expect(result.armor).toBeGreaterThanOrEqual(0);
      expect(validatePowerBudget(result)).toBe(true);
    });

    it('should handle very high armor', () => {
      const stats: PowerBudgetStats = {
        hp: 100,
        attackDamage: 10,
        armor: 100,
      };
      // Budget: (100/10) + 10 + (100 * 2) = 10 + 10 + 200 = 220
      const result = balanceStatsByBudget(stats, 'fortress');

      expect(validatePowerBudget(result)).toBe(true);
    });

    it('should round stats to whole numbers', () => {
      const stats: PowerBudgetStats = {
        hp: 333,
        attackDamage: 33,
        armor: 3,
      };
      const result = balanceStatsByBudget(stats, 'random');

      expect(Number.isInteger(result.hp)).toBe(true);
      expect(Number.isInteger(result.attackDamage)).toBe(true);
      expect(Number.isInteger(result.armor)).toBe(true);
    });

    it('should handle archetype parameter (logged but not affecting logic)', () => {
      const stats: PowerBudgetStats = {
        hp: 50,
        attackDamage: 20,
        armor: 5,
      };

      const result1 = balanceStatsByBudget(stats, 'warrior');
      const result2 = balanceStatsByBudget(stats, 'mage');

      // Archetype is for logging only, results should be the same
      expect(result1).toEqual(result2);
    });
  });

  describe('realistic creature scenarios', () => {
    it('should balance a weak goblin', () => {
      const goblin: PowerBudgetStats = {
        hp: 60,
        attackDamage: 15,
        armor: 2,
      };
      // Budget: (60/10) + 15 + (2 * 2) = 6 + 15 + 4 = 25
      const result = balanceStatsByBudget(goblin, 'goblin');

      expect(validatePowerBudget(result)).toBe(true);
      expect(result.hp).toBeGreaterThanOrEqual(50);
    });

    it('should balance a powerful dragon', () => {
      const dragon: PowerBudgetStats = {
        hp: 800,
        attackDamage: 90,
        armor: 40,
      };
      // Budget: (800/10) + 90 + (40 * 2) = 80 + 90 + 80 = 250
      const result = balanceStatsByBudget(dragon, 'dragon');

      expect(validatePowerBudget(result)).toBe(true);
    });

    it('should balance a tanky knight', () => {
      const knight: PowerBudgetStats = {
        hp: 400,
        attackDamage: 40,
        armor: 35,
      };
      // Budget: (400/10) + 40 + (35 * 2) = 40 + 40 + 70 = 150
      const result = balanceStatsByBudget(knight, 'knight');

      expect(result).toEqual(knight); // Already at max budget
    });

    it('should balance a glass cannon assassin', () => {
      const assassin: PowerBudgetStats = {
        hp: 150,
        attackDamage: 85,
        armor: 5,
      };
      // Budget: (150/10) + 85 + (5 * 2) = 15 + 85 + 10 = 110
      const result = balanceStatsByBudget(assassin, 'assassin');

      expect(result).toEqual(assassin); // Already in range
    });
  });
});
