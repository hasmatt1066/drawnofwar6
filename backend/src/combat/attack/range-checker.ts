import { hexDistance } from '@drawn-of-war/shared';
import type { HexCoordinate, CombatUnit } from '../combat-state';

export class RangeChecker {
  isInRange(pos1: HexCoordinate, pos2: HexCoordinate, range: number): boolean {
    return hexDistance(pos1, pos2) <= range;
  }

  getUnitsInRange(position: HexCoordinate, range: number, units: CombatUnit[]): CombatUnit[] {
    return units.filter(u => this.isInRange(position, u.position, range));
  }
}
