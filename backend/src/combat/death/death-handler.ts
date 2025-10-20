import type { CombatUnit } from '../combat-state';

export interface DeathResult {
  isDead: boolean;
  newStatus: 'alive' | 'dead';
  currentTarget: string | null;
}

export class DeathHandler {
  handleDeath(unit: CombatUnit): DeathResult {
    const isDead = unit.health <= 0;
    return {
      isDead,
      newStatus: isDead ? 'dead' : 'alive',
      currentTarget: isDead ? null : unit.currentTarget
    };
  }
}
