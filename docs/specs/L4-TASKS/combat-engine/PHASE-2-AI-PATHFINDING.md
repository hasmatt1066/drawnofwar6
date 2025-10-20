# L4 Tasks: Combat Engine - Phase 2 (Unit AI & Pathfinding)

**Phase Duration:** Weeks 3-4
**Parent Epic:** Authoritative Server Simulation (L2)
**Status:** READY FOR IMPLEMENTATION
**Last Updated:** 2025-10-05

---

## Overview

Phase 2 implements unit AI and movement systems. Units will autonomously select targets, pathfind around obstacles, and move toward enemies. This brings the combat simulation to life with intelligent unit behavior.

**Deliverable:** Units that autonomously find, chase, and engage enemies using A* pathfinding on the hex grid.

---

## L4-COMBAT-005: Target Selection (Closest Enemy AI)

**File:** `/backend/src/combat/ai/target-selector.ts`

### Function Signature
```typescript
class TargetSelector {
  findClosestEnemy(
    unit: CombatUnit,
    allUnits: CombatUnit[],
    hexGrid: HexGrid
  ): CombatUnit | null

  shouldSwitchTarget(
    unit: CombatUnit,
    currentTarget: CombatUnit | null,
    allUnits: CombatUnit[]
  ): boolean
}
```

### Test Cases

**Test 1: Finds closest enemy by hex distance**
```typescript
test('should select closest enemy by hex distance', () => {
  const unit = { unitId: 'u1', ownerId: 'player1', position: {q: 5, r: 5} };
  const enemies = [
    { unitId: 'e1', ownerId: 'player2', position: {q: 8, r: 5}, status: 'alive' }, // distance 3
    { unitId: 'e2', ownerId: 'player2', position: {q: 6, r: 5}, status: 'alive' }, // distance 1
    { unitId: 'e3', ownerId: 'player2', position: {q: 10, r: 5}, status: 'alive' } // distance 5
  ];

  const selector = new TargetSelector();
  const target = selector.findClosestEnemy(unit, [unit, ...enemies], mockHexGrid);

  expect(target?.unitId).toBe('e2'); // Closest at distance 1
});
```

**Test 2: Ignores dead enemies**
```typescript
test('should ignore dead enemies', () => {
  const unit = { unitId: 'u1', ownerId: 'player1', position: {q: 5, r: 5} };
  const enemies = [
    { unitId: 'e1', ownerId: 'player2', position: {q: 6, r: 5}, status: 'dead' },
    { unitId: 'e2', ownerId: 'player2', position: {q: 8, r: 5}, status: 'alive' }
  ];

  const selector = new TargetSelector();
  const target = selector.findClosestEnemy(unit, [unit, ...enemies], mockHexGrid);

  expect(target?.unitId).toBe('e2');
});
```

**Test 3: Returns null if no enemies alive**
```typescript
test('should return null when no enemies exist', () => {
  const unit = { unitId: 'u1', ownerId: 'player1', position: {q: 5, r: 5} };
  const allies = [
    { unitId: 'a1', ownerId: 'player1', position: {q: 4, r: 5}, status: 'alive' }
  ];

  const selector = new TargetSelector();
  const target = selector.findClosestEnemy(unit, [unit, ...allies], mockHexGrid);

  expect(target).toBe(null);
});
```

**Test 4: Switches target when current dies**
```typescript
test('should switch target when current target dies', () => {
  const unit = { unitId: 'u1', ownerId: 'player1' };
  const currentTarget = { unitId: 'e1', ownerId: 'player2', status: 'dead' };
  const enemies = [
    currentTarget,
    { unitId: 'e2', ownerId: 'player2', status: 'alive' }
  ];

  const selector = new TargetSelector();
  const shouldSwitch = selector.shouldSwitchTarget(unit, currentTarget, enemies);

  expect(shouldSwitch).toBe(true);
});
```

**Test 5: Maintains target if closer enemy appears**
```typescript
test('should NOT switch to closer enemy (maintain focus)', () => {
  const unit = { unitId: 'u1', ownerId: 'player1', position: {q: 5, r: 5} };
  const currentTarget = { unitId: 'e1', ownerId: 'player2', position: {q: 8, r: 5}, status: 'alive' };
  const newEnemy = { unitId: 'e2', ownerId: 'player2', position: {q: 6, r: 5}, status: 'alive' };

  const selector = new TargetSelector();
  const shouldSwitch = selector.shouldSwitchTarget(unit, currentTarget, [currentTarget, newEnemy]);

  expect(shouldSwitch).toBe(false); // Maintain current target
});
```

### Acceptance Criteria
- [ ] Selects closest enemy by hex distance
- [ ] Ignores dead enemies
- [ ] Returns null if no enemies exist
- [ ] Switches target only when current dies
- [ ] Does NOT switch to closer targets (focus maintained)

---

## L4-COMBAT-006: A* Pathfinding on Hex Grid

**File:** `/backend/src/combat/pathfinding/astar-pathfinder.ts`

### Function Signature
```typescript
class AStarPathfinder {
  findPath(
    start: HexCoordinate,
    goal: HexCoordinate,
    hexGrid: HexGrid,
    obstacles: Set<string> // hex keys "q,r"
  ): HexCoordinate[] | null // null if no path exists

  private heuristic(a: HexCoordinate, b: HexCoordinate): number
  private getNeighbors(hex: HexCoordinate, hexGrid: HexGrid): HexCoordinate[]
}
```

### Test Cases

**Test 1: Finds straight path with no obstacles**
```typescript
test('should find straight path from (0,0) to (3,0)', () => {
  const pathfinder = new AStarPathfinder();
  const hexGrid = new HexGrid(12, 8);

  const path = pathfinder.findPath(
    {q: 0, r: 0},
    {q: 3, r: 0},
    hexGrid,
    new Set()
  );

  expect(path).toEqual([
    {q: 0, r: 0},
    {q: 1, r: 0},
    {q: 2, r: 0},
    {q: 3, r: 0}
  ]);
});
```

**Test 2: Routes around obstacles**
```typescript
test('should route around obstacle', () => {
  const pathfinder = new AStarPathfinder();
  const hexGrid = new HexGrid(12, 8);
  const obstacles = new Set(['1,0', '1,1', '1,2']); // Vertical wall

  const path = pathfinder.findPath(
    {q: 0, r: 1},
    {q: 2, r: 1},
    hexGrid,
    obstacles
  );

  // Should go around (either over or under wall)
  expect(path).toBeDefined();
  expect(path![0]).toEqual({q: 0, r: 1}); // Start
  expect(path![path!.length - 1]).toEqual({q: 2, r: 1}); // Goal
  expect(path!.length).toBeGreaterThan(3); // Longer than direct
});
```

**Test 3: Returns null if no path exists**
```typescript
test('should return null when completely blocked', () => {
  const pathfinder = new AStarPathfinder();
  const hexGrid = new HexGrid(12, 8);

  // Surround goal with obstacles
  const obstacles = new Set(['2,0', '2,1', '2,2', '1,2', '0,2', '0,1']);

  const path = pathfinder.findPath(
    {q: 0, r: 0},
    {q: 1, r: 1}, // Completely surrounded
    hexGrid,
    obstacles
  );

  expect(path).toBe(null);
});
```

**Test 4: Respects grid boundaries**
```typescript
test('should not path outside grid boundaries', () => {
  const pathfinder = new AStarPathfinder();
  const hexGrid = new HexGrid(5, 5); // Small grid

  const path = pathfinder.findPath(
    {q: 0, r: 0},
    {q: 4, r: 4},
    hexGrid,
    new Set()
  );

  // Verify all hexes in path are within bounds
  path?.forEach(hex => {
    expect(hex.q).toBeGreaterThanOrEqual(0);
    expect(hex.q).toBeLessThan(5);
    expect(hex.r).toBeGreaterThanOrEqual(0);
    expect(hex.r).toBeLessThan(5);
  });
});
```

**Test 5: Heuristic is admissible (never overestimates)**
```typescript
test('heuristic should never overestimate distance', () => {
  const pathfinder = new AStarPathfinder();

  const testCases = [
    [{q: 0, r: 0}, {q: 3, r: 0}], // Straight line
    [{q: 0, r: 0}, {q: 2, r: 2}], // Diagonal
    [{q: 5, r: 3}, {q: 1, r: 7}]  // Random
  ];

  testCases.forEach(([a, b]) => {
    const heuristic = (pathfinder as any).heuristic(a, b);
    const actualDistance = hexDistance(a, b);

    expect(heuristic).toBeLessThanOrEqual(actualDistance);
  });
});
```

### Acceptance Criteria
- [ ] Finds optimal path with no obstacles
- [ ] Routes around obstacles correctly
- [ ] Returns null when no path exists
- [ ] Respects grid boundaries
- [ ] Heuristic is admissible (A* optimality)
- [ ] Performance: <10ms for typical paths

---

## L4-COMBAT-007: Movement Controller

**File:** `/backend/src/combat/movement/movement-controller.ts`

### Function Signature
```typescript
class MovementController {
  updateMovement(
    unit: CombatUnit,
    targetPosition: HexCoordinate,
    hexGrid: HexGrid,
    occupiedHexes: Set<string>, // "q,r"
    deltaTime: number // Time since last tick (1/60 second)
  ): MovementUpdate

  isInRange(
    unitPosition: HexCoordinate,
    targetPosition: HexCoordinate,
    range: number
  ): boolean
}

interface MovementUpdate {
  newPosition: HexCoordinate;
  facingDirection: number; // degrees
  isMoving: boolean;
  path: HexCoordinate[]; // Remaining path
}
```

### Test Cases

**Test 1: Moves unit toward target at correct speed**
```typescript
test('should move unit at specified speed (3 hexes/sec)', () => {
  const unit = {
    unitId: 'u1',
    position: {q: 0, r: 0},
    stats: { movementSpeed: 3 } // 3 hexes per second
  };

  const controller = new MovementController();
  const pathfinder = new AStarPathfinder();

  const path = pathfinder.findPath(
    {q: 0, r: 0},
    {q: 5, r: 0},
    mockHexGrid,
    new Set()
  );

  unit.path = path;

  // 1 tick = 1/60 second, moves 3/60 = 0.05 hexes
  const update = controller.updateMovement(
    unit,
    {q: 5, r: 0},
    mockHexGrid,
    new Set(),
    1/60
  );

  // After 20 ticks (1/3 second), should move 1 hex
  let position = unit.position;
  for (let i = 0; i < 20; i++) {
    const result = controller.updateMovement(
      { ...unit, position },
      {q: 5, r: 0},
      mockHexGrid,
      new Set(),
      1/60
    );
    position = result.newPosition;
  }

  expect(position).toEqual({q: 1, r: 0});
});
```

**Test 2: Updates facing direction**
```typescript
test('should update facing direction toward target', () => {
  const unit = { position: {q: 5, r: 5}, stats: { movementSpeed: 2 } };
  const controller = new MovementController();

  const update = controller.updateMovement(
    unit,
    {q: 8, r: 5}, // Target to the right
    mockHexGrid,
    new Set(),
    1/60
  );

  // Facing direction should be 0° (right) in hex grid
  expect(update.facingDirection).toBe(0);
});
```

**Test 3: Stops when in range of target**
```typescript
test('should stop moving when in attack range', () => {
  const unit = {
    position: {q: 5, r: 5},
    stats: { movementSpeed: 2, attackRange: 2 }
  };

  const controller = new MovementController();

  const inRange = controller.isInRange(
    {q: 5, r: 5},
    {q: 6, r: 5}, // Distance 1, within range 2
    2
  );

  expect(inRange).toBe(true);

  const update = controller.updateMovement(
    unit,
    {q: 6, r: 5},
    mockHexGrid,
    new Set(),
    1/60
  );

  expect(update.isMoving).toBe(false);
});
```

**Test 4: Recalculates path when blocked**
```typescript
test('should recalculate path when current path blocked', () => {
  const unit = {
    position: {q: 0, r: 0},
    path: [{q: 0, r: 0}, {q: 1, r: 0}, {q: 2, r: 0}],
    stats: { movementSpeed: 2 }
  };

  const controller = new MovementController();

  // Block next hex in path
  const occupiedHexes = new Set(['1,0']);

  const update = controller.updateMovement(
    unit,
    {q: 2, r: 0},
    mockHexGrid,
    occupiedHexes,
    1/60
  );

  // Should have recalculated path to go around
  expect(update.path).toBeDefined();
  expect(update.path[0]).not.toEqual({q: 1, r: 0}); // Avoided blocked hex
});
```

**Test 5: Handles stuck units gracefully**
```typescript
test('should handle completely surrounded unit', () => {
  const unit = {
    position: {q: 5, r: 5},
    stats: { movementSpeed: 2 }
  };

  const controller = new MovementController();

  // Surround unit completely
  const occupiedHexes = new Set(['4,5', '6,5', '5,4', '5,6', '4,4', '6,6']);

  const update = controller.updateMovement(
    unit,
    {q: 10, r: 5},
    mockHexGrid,
    occupiedHexes,
    1/60
  );

  // Should not crash, should stay in place
  expect(update.newPosition).toEqual({q: 5, r: 5});
  expect(update.isMoving).toBe(false);
});
```

### Acceptance Criteria
- [ ] Moves units at correct speed (hexes/second)
- [ ] Updates facing direction toward movement
- [ ] Stops when in attack range
- [ ] Recalculates path when blocked
- [ ] Handles stuck units gracefully (no crash)
- [ ] Smooth interpolation for client rendering

---

## L4-COMBAT-008: Unit AI Controller

**File:** `/backend/src/combat/ai/unit-ai-controller.ts`

### Function Signature
```typescript
class UnitAIController {
  updateUnit(
    unit: CombatUnit,
    allUnits: CombatUnit[],
    hexGrid: HexGrid,
    deltaTime: number
  ): UnitUpdate
}

interface UnitUpdate {
  position: HexCoordinate;
  currentTarget: string | null;
  facingDirection: number;
  isMoving: boolean;
  shouldAttack: boolean;
  path: HexCoordinate[];
}
```

### Test Cases

**Test 1: Selects target and moves toward it**
```typescript
test('should select closest enemy and move toward it', () => {
  const unit = {
    unitId: 'u1',
    ownerId: 'player1',
    position: {q: 0, r: 0},
    stats: { movementSpeed: 3, attackRange: 1 },
    currentTarget: null
  };

  const enemy = {
    unitId: 'e1',
    ownerId: 'player2',
    position: {q: 5, r: 0},
    status: 'alive'
  };

  const aiController = new UnitAIController();
  const update = aiController.updateUnit(unit, [unit, enemy], mockHexGrid, 1/60);

  expect(update.currentTarget).toBe('e1');
  expect(update.isMoving).toBe(true);
  expect(update.shouldAttack).toBe(false); // Not in range yet
});
```

**Test 2: Attacks when in range**
```typescript
test('should attack when in range of target', () => {
  const unit = {
    unitId: 'u1',
    ownerId: 'player1',
    position: {q: 5, r: 5},
    stats: { attackRange: 2 },
    currentTarget: 'e1',
    attackCooldown: 0
  };

  const enemy = {
    unitId: 'e1',
    ownerId: 'player2',
    position: {q: 6, r: 5}, // Distance 1, within range 2
    status: 'alive'
  };

  const aiController = new UnitAIController();
  const update = aiController.updateUnit(unit, [unit, enemy], mockHexGrid, 1/60);

  expect(update.isMoving).toBe(false); // Stopped to attack
  expect(update.shouldAttack).toBe(true);
});
```

**Test 3: Respects attack cooldown**
```typescript
test('should NOT attack when cooldown active', () => {
  const unit = {
    unitId: 'u1',
    position: {q: 5, r: 5},
    stats: { attackRange: 2 },
    currentTarget: 'e1',
    attackCooldown: 30 // 30 ticks remaining
  };

  const enemy = {
    unitId: 'e1',
    position: {q: 6, r: 5},
    status: 'alive'
  };

  const aiController = new UnitAIController();
  const update = aiController.updateUnit(unit, [unit, enemy], mockHexGrid, 1/60);

  expect(update.shouldAttack).toBe(false);
});
```

**Test 4: Switches target when current dies**
```typescript
test('should switch to new target when current dies', () => {
  const unit = {
    unitId: 'u1',
    ownerId: 'player1',
    position: {q: 5, r: 5},
    currentTarget: 'e1'
  };

  const deadEnemy = {
    unitId: 'e1',
    ownerId: 'player2',
    status: 'dead'
  };

  const newEnemy = {
    unitId: 'e2',
    ownerId: 'player2',
    position: {q: 7, r: 5},
    status: 'alive'
  };

  const aiController = new UnitAIController();
  const update = aiController.updateUnit(unit, [unit, deadEnemy, newEnemy], mockHexGrid, 1/60);

  expect(update.currentTarget).toBe('e2');
});
```

**Test 5: Does nothing when no enemies exist**
```typescript
test('should idle when no enemies exist', () => {
  const unit = {
    unitId: 'u1',
    ownerId: 'player1',
    position: {q: 5, r: 5},
    currentTarget: null
  };

  const aiController = new UnitAIController();
  const update = aiController.updateUnit(unit, [unit], mockHexGrid, 1/60);

  expect(update.currentTarget).toBe(null);
  expect(update.isMoving).toBe(false);
  expect(update.shouldAttack).toBe(false);
});
```

### Acceptance Criteria
- [ ] Selects closest enemy as target
- [ ] Moves toward target when not in range
- [ ] Attacks when in range and cooldown ready
- [ ] Respects attack cooldown
- [ ] Switches target when current dies
- [ ] Idles when no enemies exist

---

## Integration Test: AI & Movement

**File:** `/backend/src/combat/__tests__/ai-movement-integration.test.ts`

### Test Case
```typescript
test('INTEGRATION: Unit chases and attacks enemy', async () => {
  // Setup: Warrior starts far from enemy
  const warrior = {
    unitId: 'warrior',
    ownerId: 'player1',
    position: {q: 0, r: 4},
    stats: {
      movementSpeed: 3, // 3 hexes/sec
      attackRange: 1,
      attackSpeed: 1, // 1 attack/sec = 60 tick cooldown
      attackDamage: 25
    },
    health: 100,
    maxHealth: 100,
    status: 'alive',
    currentTarget: null,
    attackCooldown: 0
  };

  const goblin = {
    unitId: 'goblin',
    ownerId: 'player2',
    position: {q: 10, r: 4}, // 10 hexes away
    stats: {
      movementSpeed: 1,
      attackRange: 1,
      attackDamage: 15
    },
    health: 50,
    maxHealth: 50,
    status: 'alive',
    currentTarget: null,
    attackCooldown: 0
  };

  const hexGrid = new HexGrid(12, 8);
  const aiController = new UnitAIController();
  const events: string[] = [];

  // Simulate 5 seconds (300 ticks)
  for (let tick = 0; tick < 300; tick++) {
    // Update warrior AI
    const warriorUpdate = aiController.updateUnit(
      warrior,
      [warrior, goblin],
      hexGrid,
      1/60
    );

    warrior.position = warriorUpdate.position;
    warrior.currentTarget = warriorUpdate.currentTarget;

    if (warriorUpdate.shouldAttack && warrior.attackCooldown === 0) {
      goblin.health -= warrior.stats.attackDamage;
      warrior.attackCooldown = 60; // 1 second cooldown
      events.push(`tick ${tick}: Warrior attacked Goblin for 25 damage`);

      if (goblin.health <= 0) {
        goblin.status = 'dead';
        events.push(`tick ${tick}: Goblin died`);
        break;
      }
    }

    if (warrior.attackCooldown > 0) {
      warrior.attackCooldown--;
    }
  }

  // Verify warrior chased and killed goblin
  expect(goblin.status).toBe('dead');
  expect(events.length).toBeGreaterThan(0);

  // Should have attacked multiple times (50 HP / 25 damage = 2 attacks minimum)
  const attackEvents = events.filter(e => e.includes('attacked'));
  expect(attackEvents.length).toBeGreaterThanOrEqual(2);

  console.log('Battle events:', events);
});
```

---

## Phase 2 Summary

### Files to Create (4)
1. `/backend/src/combat/ai/target-selector.ts` - Enemy targeting AI
2. `/backend/src/combat/pathfinding/astar-pathfinder.ts` - A* pathfinding
3. `/backend/src/combat/movement/movement-controller.ts` - Unit movement
4. `/backend/src/combat/ai/unit-ai-controller.ts` - Main AI orchestrator

### Total L4 Tasks: 4
- L4-COMBAT-005: Target Selection
- L4-COMBAT-006: A* Pathfinding
- L4-COMBAT-007: Movement Controller
- L4-COMBAT-008: Unit AI Controller

### Total Test Cases: 18
- Target Selection: 5 tests
- A* Pathfinding: 5 tests
- Movement Controller: 5 tests
- Unit AI Controller: 5 tests
- Integration: 1 test

### Phase 2 Definition of Done
- [ ] All 18 test cases passing
- [ ] Units select closest enemy
- [ ] A* pathfinding works with obstacles
- [ ] Movement at correct speed (hexes/second)
- [ ] Units chase and attack enemies
- [ ] Integration test passes (unit kills enemy)

---

**Next Phase:** Week 4-5 will add Combat Mechanics (Attack, Damage, Death) - Phase 3

**Status:** Ready for TDD implementation
