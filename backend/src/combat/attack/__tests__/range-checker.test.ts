import { describe, test, expect } from 'vitest';
import { RangeChecker } from '../range-checker';

describe('RangeChecker (L4-COMBAT-011)', () => {
  test('should detect when target is in range', () => {
    const checker = new RangeChecker();
    expect(checker.isInRange({ q: 5, r: 5 }, { q: 6, r: 5 }, 2)).toBe(true);
  });

  test('should detect when target is out of range', () => {
    const checker = new RangeChecker();
    expect(checker.isInRange({ q: 5, r: 5 }, { q: 10, r: 5 }, 2)).toBe(false);
  });

  test('should find all units in range', () => {
    const units = [
      { unitId: '1', position: { q: 6, r: 5 } },
      { unitId: '2', position: { q: 10, r: 5 } },
      { unitId: '3', position: { q: 5, r: 6 } }
    ] as any[];
    const checker = new RangeChecker();
    const inRange = checker.getUnitsInRange({ q: 5, r: 5 }, 2, units);
    expect(inRange).toHaveLength(2);
  });
});
