# L4 Tasks: Combat Engine - Phase 3 (Combat Mechanics)

**Phase Duration:** Week 4-5
**Parent Epic:** Authoritative Server Simulation (L2)
**Status:** READY FOR IMPLEMENTATION
**Last Updated:** 2025-10-05

---

## Overview

Phase 3 implements the core combat mechanics: attack execution, damage calculation, and death handling. This is where units actually hurt each other and the battle progresses toward victory.

**Deliverable:** Functional combat system where units deal damage, reduce health, and die when HP reaches zero.

---

## L4-COMBAT-009: Damage Calculator

**File:** `/backend/src/combat/damage/damage-calculator.ts`

### Function Signature
```typescript
class DamageCalculator {
  calculateDamage(
    attacker: CombatUnit,
    defender: CombatUnit,
    attackType: 'physical' | 'magical'
  ): DamageResult

  applyCritical(baseDamage: number, critChance: number): number
}

interface DamageResult {
  rawDamage: number;
  mitigatedDamage: number; // After armor
  finalDamage: number; // Actual HP loss
  isCritical: boolean;
  damageType: 'physical' | 'magical';
}
```

### Test Cases

**Test 1: Basic damage calculation (damage - armor)**
```typescript
test('should calculate damage with armor reduction', () => {
  const attacker = { stats: { attackDamage: 50 } };
  const defender = { stats: { armor: 10 } };

  const calculator = new DamageCalculator();
  const result = calculator.calculateDamage(attacker, defender, 'physical');

  // Formula: damage - (armor * 0.5) = 50 - (10 * 0.5) = 45
  expect(result.rawDamage).toBe(50);
  expect(result.mitigatedDamage).toBe(45);
  expect(result.finalDamage).toBe(45);
  expect(result.isCritical).toBe(false);
});
```

**Test 2: Armor cannot reduce damage below 1**
```typescript
test('should guarantee minimum 1 damage even with high armor', () => {
  const attacker = { stats: { attackDamage: 10 } };
  const defender = { stats: { armor: 50 } }; // Very high armor

  const calculator = new DamageCalculator();
  const result = calculator.calculateDamage(attacker, defender, 'physical');

  // Even though armor would reduce to negative, min is 1
  expect(result.finalDamage).toBeGreaterThanOrEqual(1);
});
```

**Test 3: Critical hits (2x damage, 10% chance)**
```typescript
test('should apply critical hit damage (2x)', () => {
  const attacker = { stats: { attackDamage: 50, critChance: 1.0 } }; // 100% crit
  const defender = { stats: { armor: 0 } };

  const calculator = new DamageCalculator();
  const result = calculator.calculateDamage(attacker, defender, 'physical');

  expect(result.isCritical).toBe(true);
  expect(result.finalDamage).toBe(100); // 50 * 2
});
```

**Test 4: Magical damage ignores armor**
```typescript
test('should ignore armor for magical damage', () => {
  const attacker = { stats: { attackDamage: 50 } };
  const defender = { stats: { armor: 20 } };

  const calculator = new DamageCalculator();
  const result = calculator.calculateDamage(attacker, defender, 'magical');

  // Magical damage ignores armor
  expect(result.mitigatedDamage).toBe(50);
  expect(result.finalDamage).toBe(50);
});
```

**Test 5: Damage calculation is deterministic (for testing)**
```typescript
test('should produce same result for same inputs (seeded RNG)', () => {
  const attacker = { stats: { attackDamage: 50 } };
  const defender = { stats: { armor: 10 } };

  const calculator = new DamageCalculator();

  // Seed RNG for deterministic testing
  Math.seedrandom('test-seed');
  const result1 = calculator.calculateDamage(attacker, defender, 'physical');

  Math.seedrandom('test-seed');
  const result2 = calculator.calculateDamage(attacker, defender, 'physical');

  expect(result1).toEqual(result2);
});
```

### Acceptance Criteria
- [ ] Calculates damage: `baseDamage - (armor * 0.5)`
- [ ] Minimum damage is 1 (armor cannot fully negate)
- [ ] Critical hits: 2x damage, configurable chance
- [ ] Magical damage ignores armor
- [ ] Deterministic with seeded RNG (for testing/replays)

---

## L4-COMBAT-010: Attack Executor

**File:** `/backend/src/combat/attack/attack-executor.ts`

### Function Signature
```typescript
class AttackExecutor {
  executeAttack(
    attacker: CombatUnit,
    defender: CombatUnit,
    state: CombatState
  ): AttackResult

  canAttack(
    attacker: CombatUnit,
    defender: CombatUnit
  ): boolean
}

interface AttackResult {
  success: boolean;
  damage: number;
  newDefenderHealth: number;
  defenderDied: boolean;
  attackerCooldown: number; // New cooldown value
  event: CombatEvent;
}
```

### Test Cases

**Test 1: Execute successful attack**
```typescript
test('should execute attack and reduce defender health', () => {
  const attacker = {
    unitId: 'u1',
    stats: { attackDamage: 25, armor: 0, attackSpeed: 1 },
    attackCooldown: 0
  };

  const defender = {
    unitId: 'u2',
    health: 100,
    maxHealth: 100,
    stats: { armor: 5 }
  };

  const executor = new AttackExecutor();
  const result = executor.executeAttack(attacker, defender, mockState);

  expect(result.success).toBe(true);
  expect(result.damage).toBeGreaterThan(0);
  expect(result.newDefenderHealth).toBeLessThan(100);
  expect(result.defenderDied).toBe(false);
});
```

**Test 2: Sets attacker cooldown after attack**
```typescript
test('should set cooldown based on attack speed', () => {
  const attacker = {
    stats: { attackSpeed: 2 }, // 2 attacks/sec = 30 tick cooldown
    attackCooldown: 0
  };

  const defender = { health: 100, stats: { armor: 0 } };

  const executor = new AttackExecutor();
  const result = executor.executeAttack(attacker, defender, mockState);

  // 60 ticks/sec ÷ 2 attacks/sec = 30 tick cooldown
  expect(result.attackerCooldown).toBe(30);
});
```

**Test 3: Kills defender when health reaches 0**
```typescript
test('should kill defender when damage >= health', () => {
  const attacker = {
    stats: { attackDamage: 100, armor: 0 },
    attackCooldown: 0
  };

  const defender = {
    health: 50,
    stats: { armor: 0 }
  };

  const executor = new AttackExecutor();
  const result = executor.executeAttack(attacker, defender, mockState);

  expect(result.newDefenderHealth).toBe(0);
  expect(result.defenderDied).toBe(true);
});
```

**Test 4: Cannot attack when on cooldown**
```typescript
test('should prevent attack when cooldown active', () => {
  const attacker = {
    stats: { attackDamage: 25 },
    attackCooldown: 30 // Still cooling down
  };

  const defender = { health: 100 };

  const executor = new AttackExecutor();
  const canAttack = executor.canAttack(attacker, defender);

  expect(canAttack).toBe(false);
});
```

**Test 5: Creates combat event for attack**
```typescript
test('should create combat event with attack details', () => {
  const attacker = { unitId: 'warrior', attackCooldown: 0, stats: { attackDamage: 25 } };
  const defender = { unitId: 'goblin', health: 100, stats: { armor: 5 } };

  const executor = new AttackExecutor();
  const result = executor.executeAttack(attacker, defender, mockState);

  expect(result.event.type).toBe('damage');
  expect(result.event.data).toMatchObject({
    attackerId: 'warrior',
    defenderId: 'goblin',
    damage: expect.any(Number)
  });
});
```

### Acceptance Criteria
- [ ] Executes attack and reduces defender health
- [ ] Sets attacker cooldown based on attack speed
- [ ] Kills defender when health ≤ 0
- [ ] Prevents attack when cooldown active
- [ ] Creates combat event for logging

---

## L4-COMBAT-011: Range Checker

**File:** `/backend/src/combat/attack/range-checker.ts`

### Function Signature
```typescript
class RangeChecker {
  isInRange(
    attackerPos: HexCoordinate,
    defenderPos: HexCoordinate,
    range: number
  ): boolean

  getUnitsInRange(
    position: HexCoordinate,
    allUnits: CombatUnit[],
    range: number
  ): CombatUnit[]
}
```

### Test Cases

**Test 1: Melee range (1 hex)**
```typescript
test('should detect melee range (distance 1)', () => {
  const checker = new RangeChecker();

  const inRange = checker.isInRange(
    {q: 5, r: 5},
    {q: 6, r: 5}, // Adjacent hex
    1
  );

  expect(inRange).toBe(true);
});
```

**Test 2: Ranged attack (5 hexes)**
```typescript
test('should detect ranged attack (distance 5)', () => {
  const checker = new RangeChecker();

  const inRange = checker.isInRange(
    {q: 0, r: 0},
    {q: 5, r: 0}, // 5 hexes away
    5
  );

  expect(inRange).toBe(true);
});
```

**Test 3: Out of range**
```typescript
test('should return false when out of range', () => {
  const checker = new RangeChecker();

  const inRange = checker.isInRange(
    {q: 0, r: 0},
    {q: 6, r: 0}, // 6 hexes away
    5 // Range only 5
  );

  expect(inRange).toBe(false);
});
```

**Test 4: Get all units in range**
```typescript
test('should return all units within range', () => {
  const units = [
    { unitId: 'u1', position: {q: 6, r: 5} }, // Distance 1
    { unitId: 'u2', position: {q: 8, r: 5} }, // Distance 3
    { unitId: 'u3', position: {q: 10, r: 5} } // Distance 5
  ];

  const checker = new RangeChecker();
  const inRange = checker.getUnitsInRange({q: 5, r: 5}, units, 3);

  expect(inRange).toHaveLength(2);
  expect(inRange.map(u => u.unitId)).toEqual(['u1', 'u2']);
});
```

**Test 5: Exact range boundary**
```typescript
test('should include units at exact range boundary', () => {
  const checker = new RangeChecker();

  const inRange = checker.isInRange(
    {q: 0, r: 0},
    {q: 3, r: 0}, // Exactly 3 hexes
    3
  );

  expect(inRange).toBe(true); // Inclusive
});
```

### Acceptance Criteria
- [ ] Correctly calculates hex distance
- [ ] Detects melee range (1 hex)
- [ ] Detects ranged attacks (up to 6 hexes)
- [ ] Returns false when out of range
- [ ] Can find all units within range
- [ ] Range checks are inclusive (≤ range)

---

## L4-COMBAT-012: Death Handler

**File:** `/backend/src/combat/death/death-handler.ts`

### Function Signature
```typescript
class DeathHandler {
  handleDeath(
    unit: CombatUnit,
    state: CombatState,
    killer: CombatUnit | null
  ): DeathResult

  cleanupDeadUnit(
    unit: CombatUnit,
    state: CombatState
  ): CombatState
}

interface DeathResult {
  deathEvent: CombatEvent;
  updatedState: CombatState;
  unitsAffected: string[]; // Unit IDs that need to retarget
}
```

### Test Cases

**Test 1: Marks unit as dead**
```typescript
test('should mark unit status as dead', () => {
  const unit = {
    unitId: 'goblin',
    health: 0, // Just died
    status: 'alive'
  };

  const handler = new DeathHandler();
  const result = handler.handleDeath(unit, mockState, null);

  const deadUnit = result.updatedState.units.find(u => u.unitId === 'goblin');
  expect(deadUnit?.status).toBe('dead');
});
```

**Test 2: Creates death event**
```typescript
test('should create death event with unit details', () => {
  const unit = { unitId: 'goblin', ownerId: 'player2', health: 0 };
  const killer = { unitId: 'warrior', ownerId: 'player1' };

  const handler = new DeathHandler();
  const result = handler.handleDeath(unit, mockState, killer);

  expect(result.deathEvent.type).toBe('death');
  expect(result.deathEvent.data).toMatchObject({
    unitId: 'goblin',
    killerId: 'warrior',
    ownerId: 'player2'
  });
});
```

**Test 3: Forces units targeting dead unit to retarget**
```typescript
test('should identify units that need to retarget', () => {
  const deadUnit = { unitId: 'goblin', health: 0 };
  const state = {
    ...mockState,
    units: [
      deadUnit,
      { unitId: 'warrior1', currentTarget: 'goblin' },
      { unitId: 'warrior2', currentTarget: 'goblin' },
      { unitId: 'mage', currentTarget: 'other-enemy' }
    ]
  };

  const handler = new DeathHandler();
  const result = handler.handleDeath(deadUnit, state, null);

  // Only warrior1 and warrior2 need to retarget (they were targeting goblin)
  expect(result.unitsAffected).toEqual(['warrior1', 'warrior2']);
});
```

**Test 4: Removes dead unit from collision map**
```typescript
test('should free hex occupied by dead unit', () => {
  const deadUnit = {
    unitId: 'goblin',
    position: {q: 5, r: 5},
    health: 0
  };

  const state = {
    ...mockState,
    occupiedHexes: new Set(['5,5', '6,6'])
  };

  const handler = new DeathHandler();
  const updatedState = handler.cleanupDeadUnit(deadUnit, state);

  // Hex should no longer be occupied
  expect(updatedState.occupiedHexes.has('5,5')).toBe(false);
  expect(updatedState.occupiedHexes.has('6,6')).toBe(true); // Other hex still occupied
});
```

**Test 5: Handles death with no killer (timeout/AOE)**
```typescript
test('should handle death with no specific killer', () => {
  const unit = { unitId: 'goblin', health: 0 };

  const handler = new DeathHandler();
  const result = handler.handleDeath(unit, mockState, null);

  expect(result.deathEvent.data.killerId).toBeUndefined();
  expect(result.deathEvent.type).toBe('death');
});
```

### Acceptance Criteria
- [ ] Marks unit status as 'dead'
- [ ] Creates death event with details
- [ ] Identifies units that need to retarget
- [ ] Frees occupied hex for movement
- [ ] Handles death with/without killer attribution

---

## Integration Test: Combat Flow

**File:** `/backend/src/combat/__tests__/combat-flow-integration.test.ts`

### Test Case
```typescript
test('INTEGRATION: 1v1 combat until death', () => {
  const warrior = {
    unitId: 'warrior',
    ownerId: 'player1',
    position: {q: 5, r: 5},
    health: 100,
    maxHealth: 100,
    stats: {
      attackDamage: 30,
      armor: 5,
      attackRange: 1,
      attackSpeed: 1 // 1 attack/sec = 60 tick cooldown
    },
    attackCooldown: 0,
    status: 'alive',
    currentTarget: 'goblin'
  };

  const goblin = {
    unitId: 'goblin',
    ownerId: 'player2',
    position: {q: 6, r: 5}, // Adjacent (range 1)
    health: 50,
    maxHealth: 50,
    stats: {
      attackDamage: 15,
      armor: 2,
      attackRange: 1,
      attackSpeed: 1.5 // 1.5 attacks/sec = 40 tick cooldown
    },
    attackCooldown: 0,
    status: 'alive',
    currentTarget: 'warrior'
  };

  const damageCalc = new DamageCalculator();
  const attackExec = new AttackExecutor();
  const rangeCheck = new RangeChecker();
  const deathHandler = new DeathHandler();

  const events: string[] = [];

  // Simulate combat until one dies
  for (let tick = 0; tick < 600; tick++) { // Max 10 seconds
    // Warrior attacks
    if (warrior.status === 'alive' && warrior.attackCooldown === 0) {
      const inRange = rangeCheck.isInRange(warrior.position, goblin.position, warrior.stats.attackRange);

      if (inRange && goblin.status === 'alive') {
        const result = attackExec.executeAttack(warrior, goblin, mockState);
        goblin.health = result.newDefenderHealth;
        warrior.attackCooldown = result.attackerCooldown;
        events.push(`Tick ${tick}: Warrior dealt ${result.damage} damage to Goblin (HP: ${goblin.health})`);

        if (result.defenderDied) {
          goblin.status = 'dead';
          events.push(`Tick ${tick}: Goblin died!`);
          break;
        }
      }
    }

    // Goblin attacks
    if (goblin.status === 'alive' && goblin.attackCooldown === 0) {
      const inRange = rangeCheck.isInRange(goblin.position, warrior.position, goblin.stats.attackRange);

      if (inRange && warrior.status === 'alive') {
        const result = attackExec.executeAttack(goblin, warrior, mockState);
        warrior.health = result.newDefenderHealth;
        goblin.attackCooldown = result.attackerCooldown;
        events.push(`Tick ${tick}: Goblin dealt ${result.damage} damage to Warrior (HP: ${warrior.health})`);

        if (result.defenderDied) {
          warrior.status = 'dead';
          events.push(`Tick ${tick}: Warrior died!`);
          break;
        }
      }
    }

    // Decrement cooldowns
    if (warrior.attackCooldown > 0) warrior.attackCooldown--;
    if (goblin.attackCooldown > 0) goblin.attackCooldown--;
  }

  // Verify one unit died
  expect(warrior.status === 'dead' || goblin.status === 'dead').toBe(true);
  expect(events.length).toBeGreaterThan(0);

  // Warrior has higher DPS (30 dmg vs 15 dmg), should win
  expect(warrior.status).toBe('alive');
  expect(goblin.status).toBe('dead');

  console.log('Combat log:', events);
});
```

---

## Phase 3 Summary

### Files to Create (4)
1. `/backend/src/combat/damage/damage-calculator.ts` - Damage formulas
2. `/backend/src/combat/attack/attack-executor.ts` - Attack execution
3. `/backend/src/combat/attack/range-checker.ts` - Range validation
4. `/backend/src/combat/death/death-handler.ts` - Death handling

### Total L4 Tasks: 4
- L4-COMBAT-009: Damage Calculator
- L4-COMBAT-010: Attack Executor
- L4-COMBAT-011: Range Checker
- L4-COMBAT-012: Death Handler

### Total Test Cases: 18
- Damage Calculator: 5 tests
- Attack Executor: 5 tests
- Range Checker: 5 tests
- Death Handler: 5 tests
- Integration: 1 test

### Phase 3 Definition of Done
- [ ] All 18 test cases passing
- [ ] Damage calculation with armor reduction
- [ ] Critical hits working
- [ ] Attack cooldowns enforced
- [ ] Death detection and handling
- [ ] Integration test passes (1v1 combat to death)

---

**Next Phase:** Week 5-6 will add Ability System & Projectiles - Phase 4

**Status:** Ready for TDD implementation
