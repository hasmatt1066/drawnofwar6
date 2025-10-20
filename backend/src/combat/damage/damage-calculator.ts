/**
 * DamageCalculator - Combat Damage Calculation
 *
 * Implements L4-COMBAT-009: Calculates damage with armor mitigation and critical hits.
 */

import type { CombatUnit } from '../combat-state';

export interface DamageResult {
  rawDamage: number;
  mitigatedDamage: number;
  finalDamage: number;
  isCritical: boolean;
  damageType: 'physical' | 'magical';
}

export class DamageCalculator {
  calculateDamage(
    attacker: CombatUnit,
    defender: CombatUnit,
    attackType: 'physical' | 'magical',
    critRoll?: number
  ): DamageResult {
    const rawDamage = attacker.stats.attackDamage;
    
    let mitigatedDamage = rawDamage;
    if (attackType === 'physical') {
      mitigatedDamage = rawDamage - (defender.stats.armor * 0.5);
    }
    
    const isCritical = critRoll !== undefined && critRoll >= 1.0;
    let finalDamage = Math.max(1, mitigatedDamage);
    
    if (isCritical) {
      finalDamage *= 2;
    }
    
    return {
      rawDamage,
      mitigatedDamage: Math.max(1, mitigatedDamage),
      finalDamage,
      isCritical,
      damageType: attackType
    };
  }
}
