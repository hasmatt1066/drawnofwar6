import { DamageCalculator } from '../damage/damage-calculator';
import type { CombatUnit } from '../combat-state';

export interface AttackResult {
  damageDealt: number;
  newDefenderHealth: number;
  attackerCooldown: number;
  defenderDied: boolean;
  isCritical: boolean;
}

export class AttackExecutor {
  private damageCalculator: DamageCalculator;

  constructor() {
    this.damageCalculator = new DamageCalculator();
  }

  executeAttack(attacker: CombatUnit, defender: CombatUnit): AttackResult {
    const damageResult = this.damageCalculator.calculateDamage(attacker, defender, 'physical');
    const newHealth = Math.max(0, defender.health - damageResult.finalDamage);
    const cooldown = Math.round(60 / attacker.stats.attackSpeed);

    return {
      damageDealt: damageResult.finalDamage,
      newDefenderHealth: newHealth,
      attackerCooldown: cooldown,
      defenderDied: newHealth === 0,
      isCritical: damageResult.isCritical
    };
  }
}
