/**
 * Damage Calculator
 *
 * Implements damage calculation formulas with armor reduction, buffs, debuffs,
 * critical hits, and damage variance.
 */

import type { CombatCreature } from '../../../../shared/src/types/combat.js';

/**
 * Damage calculation parameters
 */
export interface DamageParams {
  attacker: CombatCreature;
  target: CombatCreature;
  baseDamage?: number; // Override for ability damage
  isCritical?: boolean; // Force critical (for testing)
}

/**
 * Damage calculation result
 */
export interface DamageResult {
  finalDamage: number;
  baseDamage: number;
  armorReduction: number;
  damageMultiplier: number;
  variance: number;
  isCritical: boolean;
  damageType: 'physical' | 'magic' | 'true';
}

/**
 * Calculate effective damage considering armor, buffs, debuffs, and variance
 */
export function calculateDamage(params: DamageParams): DamageResult {
  const { attacker, target, baseDamage, isCritical } = params;

  // Base damage (from attacker or override for abilities)
  const base = baseDamage ?? attacker.stats.attackDamage;
  const damageType = attacker.stats.damageType;

  // Calculate effective armor based on damage type
  let effectiveArmor = target.stats.armor;
  if (damageType === 'magic') {
    effectiveArmor = effectiveArmor * 0.5; // Magic ignores 50% armor
  } else if (damageType === 'true') {
    effectiveArmor = 0; // True damage ignores all armor
  }

  // Apply armor penalties from debuffs
  for (const debuff of target.activeDebuffs) {
    if (debuff.effects.armorPenalty) {
      effectiveArmor = Math.max(0, effectiveArmor - debuff.effects.armorPenalty);
    }
  }

  // Apply armor bonuses from buffs
  for (const buff of target.activeBuffs) {
    if (buff.effects.armorBonus) {
      effectiveArmor += buff.effects.armorBonus;
    }
  }

  // Armor reduction (linear formula)
  const armorReduction = Math.max(0, effectiveArmor);
  let damage = Math.max(1, base - armorReduction);

  // Calculate damage multiplier from attacker buffs
  let damageMultiplier = 1.0;
  for (const buff of attacker.activeBuffs) {
    if (buff.effects.damageMultiplier) {
      damageMultiplier *= buff.effects.damageMultiplier;
    }
  }

  // Apply damage reduction from target debuffs
  for (const debuff of target.activeDebuffs) {
    if (debuff.effects.damageReduction) {
      damageMultiplier *= debuff.effects.damageReduction;
    }
  }

  // Apply multiplier
  damage *= damageMultiplier;

  // Apply variance (±10%)
  const variance = 1 + (Math.random() * 0.2 - 0.1); // 0.9 to 1.1
  damage *= variance;

  // Critical hit check (10% chance for 1.5x damage)
  const criticalHit = isCritical ?? (Math.random() < 0.1);
  if (criticalHit) {
    damage *= 1.5;
  }

  // Floor to integer
  const finalDamage = Math.floor(damage);

  return {
    finalDamage,
    baseDamage: base,
    armorReduction,
    damageMultiplier,
    variance,
    isCritical: criticalHit,
    damageType
  };
}

/**
 * Apply damage to a target creature
 * Returns whether the target died
 */
export function applyDamage(target: CombatCreature, damage: number): boolean {
  target.health = Math.max(0, target.health - damage);

  if (target.health === 0) {
    target.status = 'dead';
    return true;
  }

  return false;
}

/**
 * Apply healing to a creature
 * Returns actual amount healed (capped at max HP)
 */
export function applyHealing(target: CombatCreature, healing: number): number {
  const oldHealth = target.health;
  target.health = Math.min(target.maxHealth, target.health + healing);
  return target.health - oldHealth;
}

/**
 * Apply damage-over-time from debuffs
 * Returns total damage dealt
 */
export function applyDamageOverTime(unit: CombatCreature): number {
  let totalDamage = 0;

  for (const debuff of unit.activeDebuffs) {
    if (debuff.effects.damagePerTick) {
      const damage = debuff.effects.damagePerTick;
      unit.health = Math.max(0, unit.health - damage);
      totalDamage += damage;

      if (unit.health === 0) {
        unit.status = 'dead';
        break;
      }
    }
  }

  return totalDamage;
}

/**
 * Apply healing-over-time from buffs
 * Returns total healing done
 */
export function applyHealingOverTime(unit: CombatCreature): number {
  let totalHealing = 0;

  for (const buff of unit.activeBuffs) {
    if (buff.effects.healPerTick) {
      const healing = buff.effects.healPerTick;
      const oldHealth = unit.health;
      unit.health = Math.min(unit.maxHealth, unit.health + healing);
      totalHealing += (unit.health - oldHealth);
    }
  }

  return totalHealing;
}
