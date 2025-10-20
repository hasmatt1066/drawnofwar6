/**
 * Power Budget Balancing System
 *
 * Ensures all creatures have balanced stats according to the power budget formula:
 * Power Budget = (HP/10) + attackDamage + (armor * 2)
 *
 * Valid range: 100-150 points
 * Target midpoint: 125 points
 */

export interface PowerBudgetStats {
  hp: number;
  attackDamage: number;
  armor: number;
}

// Constants
const BUDGET_MIN = 100;
const BUDGET_MAX = 150;
const BUDGET_TARGET = 125; // Midpoint for scaling operations
const MIN_HP = 50;
const MIN_DAMAGE = 10;
const MIN_ARMOR = 0;

/**
 * Calculate the total power budget for given stats
 * Formula: (HP/10) + attackDamage + (armor * 2)
 */
export function calculatePowerBudget(stats: PowerBudgetStats): number {
  return Math.round((stats.hp / 10) + stats.attackDamage + (stats.armor * 2));
}

/**
 * Validate if stats are within the acceptable power budget range
 */
export function validatePowerBudget(stats: PowerBudgetStats): boolean {
  const budget = calculatePowerBudget(stats);
  return budget >= BUDGET_MIN && budget <= BUDGET_MAX;
}

/**
 * Balance stats to fit within the power budget range
 *
 * If stats are already valid, returns them unchanged.
 * If outside range, scales proportionally to target midpoint (125).
 * Ensures minimums are enforced after scaling.
 *
 * @param baseStats - Original unbalanced stats
 * @param archetype - Creature archetype (for logging purposes)
 * @returns Balanced stats within power budget range
 */
export function balanceStatsByBudget(
  baseStats: PowerBudgetStats,
  archetype: string
): PowerBudgetStats {
  const currentBudget = calculatePowerBudget(baseStats);

  // If already within range, no adjustment needed
  if (currentBudget >= BUDGET_MIN && currentBudget <= BUDGET_MAX) {
    console.log(`[PowerBudget] ${archetype}: Stats already balanced (budget: ${currentBudget})`);
    return { ...baseStats };
  }

  console.log(`[PowerBudget] ${archetype}: Balancing stats (current budget: ${currentBudget}, target: ${BUDGET_TARGET})`);

  // Calculate scale factor to reach target budget
  const scaleFactor = BUDGET_TARGET / currentBudget;

  // Scale each stat proportionally
  let scaledStats: PowerBudgetStats = {
    hp: Math.round(baseStats.hp * scaleFactor),
    attackDamage: Math.round(baseStats.attackDamage * scaleFactor),
    armor: Math.round(baseStats.armor * scaleFactor),
  };

  // Enforce minimum constraints
  scaledStats = enforceMinimums(scaledStats);

  // Verify the result is valid
  const finalBudget = calculatePowerBudget(scaledStats);

  // If still outside range after enforcing minimums, fine-tune
  if (finalBudget < BUDGET_MIN || finalBudget > BUDGET_MAX) {
    scaledStats = fineTuneStats(scaledStats, finalBudget);
  }

  const verifiedBudget = calculatePowerBudget(scaledStats);
  console.log(`[PowerBudget] ${archetype}: Balanced to budget ${verifiedBudget} - HP: ${scaledStats.hp}, Damage: ${scaledStats.attackDamage}, Armor: ${scaledStats.armor}`);

  return scaledStats;
}

/**
 * Enforce minimum stat constraints
 */
function enforceMinimums(stats: PowerBudgetStats): PowerBudgetStats {
  return {
    hp: Math.max(stats.hp, MIN_HP),
    attackDamage: Math.max(stats.attackDamage, MIN_DAMAGE),
    armor: Math.max(stats.armor, MIN_ARMOR),
  };
}

/**
 * Fine-tune stats when minimums push budget outside valid range
 * Redistributes excess/deficit across stats that aren't at minimum
 */
function fineTuneStats(stats: PowerBudgetStats, currentBudget: number): PowerBudgetStats {
  const deficit = BUDGET_TARGET - currentBudget;

  // If budget is too low, we need to add points
  // If budget is too high, we need to remove points

  // Count how many stats we can adjust (not at minimum)
  const adjustableStats: Array<keyof PowerBudgetStats> = [];
  if (stats.hp > MIN_HP) adjustableStats.push('hp');
  if (stats.attackDamage > MIN_DAMAGE) adjustableStats.push('attackDamage');
  if (stats.armor > MIN_ARMOR) adjustableStats.push('armor');

  // If no stats can be adjusted, return as-is
  if (adjustableStats.length === 0) {
    return stats;
  }

  const result = { ...stats };

  // Distribute the deficit across adjustable stats
  // HP contributes 0.1 points per point, damage contributes 1, armor contributes 2
  const weights = {
    hp: 0.1,
    attackDamage: 1,
    armor: 2,
  };

  // Simple approach: adjust the most impactful stat first
  let remaining = deficit;

  // Prioritize armor (highest weight), then damage, then HP
  const priority: Array<keyof PowerBudgetStats> = ['armor', 'attackDamage', 'hp'];

  for (const stat of priority) {
    if (!adjustableStats.includes(stat)) continue;
    if (Math.abs(remaining) < 1) break;

    const weight = weights[stat];
    const adjustment = Math.round(remaining / weight);

    if (stat === 'hp') {
      const newValue = Math.max(MIN_HP, result.hp + adjustment);
      remaining -= (newValue - result.hp) * weight;
      result.hp = newValue;
    } else if (stat === 'attackDamage') {
      const newValue = Math.max(MIN_DAMAGE, result.attackDamage + adjustment);
      remaining -= (newValue - result.attackDamage) * weight;
      result.attackDamage = newValue;
    } else if (stat === 'armor') {
      const newValue = Math.max(MIN_ARMOR, result.armor + adjustment);
      remaining -= (newValue - result.armor) * weight;
      result.armor = newValue;
    }
  }

  return result;
}
