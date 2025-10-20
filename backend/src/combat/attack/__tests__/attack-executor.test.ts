import { describe, test, expect } from 'vitest';
import { AttackExecutor } from '../attack-executor';

const createUnit = (id: string, health: number, attackDamage: number, attackSpeed: number = 1) => ({
  unitId: id,
  health,
  maxHealth: 100,
  attackCooldown: 0,
  stats: { attackDamage, armor: 0, attackSpeed, movementSpeed: 2, attackRange: 1 }
} as any);

describe('AttackExecutor (L4-COMBAT-010)', () => {
  test('should execute attack and deal damage', () => {
    const attacker = createUnit('a1', 100, 20);
    const defender = createUnit('d1', 100, 10);
    const executor = new AttackExecutor();
    const result = executor.executeAttack(attacker, defender);
    expect(result.damageDealt).toBeGreaterThan(0);
    expect(result.newDefenderHealth).toBeLessThan(100);
  });

  test('should set attack cooldown', () => {
    const attacker = createUnit('a1', 100, 20, 1);
    const defender = createUnit('d1', 100, 10);
    const executor = new AttackExecutor();
    const result = executor.executeAttack(attacker, defender);
    expect(result.attackerCooldown).toBe(60);
  });

  test('should mark defender dead when health reaches zero', () => {
    const attacker = createUnit('a1', 100, 200);
    const defender = createUnit('d1', 50, 10);
    const executor = new AttackExecutor();
    const result = executor.executeAttack(attacker, defender);
    expect(result.defenderDied).toBe(true);
    expect(result.newDefenderHealth).toBe(0);
  });
});
