import { describe, test, expect } from 'vitest';
import { DeathHandler } from '../death-handler';

const createUnit = (id: string, health: number, status: 'alive' | 'dead' = 'alive') => ({
  unitId: id,
  health,
  maxHealth: 100,
  status,
  position: { q: 5, r: 5 },
  currentTarget: health > 0 ? 'enemy' : null
} as any);

describe('DeathHandler (L4-COMBAT-012)', () => {
  test('should mark unit as dead when health is zero', () => {
    const unit = createUnit('u1', 0);
    const handler = new DeathHandler();
    const result = handler.handleDeath(unit);
    expect(result.isDead).toBe(true);
    expect(result.newStatus).toBe('dead');
  });

  test('should clear current target when unit dies', () => {
    const unit = createUnit('u1', 0);
    const handler = new DeathHandler();
    const result = handler.handleDeath(unit);
    expect(result.currentTarget).toBe(null);
  });

  test('should keep unit alive if health > 0', () => {
    const unit = createUnit('u1', 50);
    const handler = new DeathHandler();
    const result = handler.handleDeath(unit);
    expect(result.isDead).toBe(false);
    expect(result.newStatus).toBe('alive');
  });
});
