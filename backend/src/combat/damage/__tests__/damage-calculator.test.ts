/**
 * Tests for DamageCalculator (L4-COMBAT-009)
 */

import { describe, test, expect } from 'vitest';
import { DamageCalculator } from '../damage-calculator';

const createUnit = (attackDamage: number, armor: number) => ({
  stats: { attackDamage, armor, movementSpeed: 2, attackRange: 1, attackSpeed: 1 }
} as any);

describe('DamageCalculator (L4-COMBAT-009)', () => {
  test('should calculate damage with armor reduction', () => {
    const attacker = createUnit(50, 0);
    const defender = createUnit(0, 10);
    const calculator = new DamageCalculator();
    const result = calculator.calculateDamage(attacker, defender, 'physical');
    expect(result.rawDamage).toBe(50);
    expect(result.mitigatedDamage).toBe(45);
    expect(result.finalDamage).toBe(45);
  });

  test('should guarantee minimum 1 damage', () => {
    const attacker = createUnit(10, 0);
    const defender = createUnit(0, 50);
    const calculator = new DamageCalculator();
    const result = calculator.calculateDamage(attacker, defender, 'physical');
    expect(result.finalDamage).toBeGreaterThanOrEqual(1);
  });

  test('should apply critical hit (2x)', () => {
    const attacker = createUnit(50, 0);
    const defender = createUnit(0, 0);
    const calculator = new DamageCalculator();
    const result = calculator.calculateDamage(attacker, defender, 'physical', 1.0);
    expect(result.isCritical).toBe(true);
    expect(result.finalDamage).toBe(100);
  });

  test('should ignore armor for magical damage', () => {
    const attacker = createUnit(50, 0);
    const defender = createUnit(0, 20);
    const calculator = new DamageCalculator();
    const result = calculator.calculateDamage(attacker, defender, 'magical');
    expect(result.finalDamage).toBe(50);
  });
});
