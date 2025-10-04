# L3-FEATURE: Deployment Validation

**Feature ID**: `deployment-validation`
**Epic**: Hex Grid Deployment System (L2)
**Status**: PLANNING
**Version**: 1.0
**Last Updated**: 2025-10-03

---

## Feature Summary

A comprehensive validation system that enforces deployment rules both client-side (for immediate feedback) and server-side (for anti-cheat), ensuring all creature placements are legal, complete, and fair before combat begins. Validates zone boundaries, hex occupancy, roster constraints, and state integrity.

**Value Proposition**: Prevents invalid deployments from reaching combat, provides clear error messages to guide players, and ensures competitive fairness through authoritative server validation.

---

## User Value

**For Players**: Clear, immediate feedback when attempting invalid placements. No confusion about deployment rules - the system guides players to legal placements.

**For Developers**: Single source of truth for deployment rules, shared between client and server. Testable validation logic prevents bugs and exploits.

---

## Functional Requirements

### Placement Validation Rules

1. **Zone Boundary Validation**
   - **Rule**: Creatures must be placed in player's deployment zone
   - **Player 1 Zone**: Columns 0-2 (left 3 columns)
   - **Player 2 Zone**: Columns 9-11 (right 3 columns)
   - **Error**: "Cannot place outside your deployment zone"

2. **Hex Occupancy Validation**
   - **Rule**: Only one creature per hex
   - **Check**: Hex is not already occupied by any creature
   - **Error**: "This hex is already occupied"

3. **Grid Bounds Validation**
   - **Rule**: Hex must exist within grid (0-11 columns, 0-7 rows)
   - **Check**: Hex coordinates are valid
   - **Error**: "Invalid hex position"

4. **Roster Constraint Validation**
   - **Rule**: Exactly 8 creatures per player
   - **Check**: Player has 8 creatures in roster
   - **Error**: "Roster must have exactly 8 creatures"

5. **Placement Completion Validation**
   - **Rule**: All 8 creatures must be placed before Ready
   - **Check**: 8/8 creatures placed on grid
   - **Error**: "Place all creatures before clicking Ready" (X/8 placed)

6. **Lock State Validation**
   - **Rule**: Cannot modify placements after clicking Ready
   - **Check**: Player has not clicked Ready button
   - **Error**: "Cannot modify placements after Ready"

### Validation Contexts

1. **Real-Time Validation** (Client)
   - **When**: During drag, before drop
   - **Purpose**: Provide instant visual feedback
   - **Method**: `isValidPlacement(hex, creature)`
   - **Result**: Boolean + error reason

2. **Pre-Drop Validation** (Client)
   - **When**: On mouse/touch up (attempting drop)
   - **Purpose**: Confirm placement before committing
   - **Method**: `validatePlacement(hex, creature)`
   - **Result**: Validation result object

3. **Ready Validation** (Client)
   - **When**: Clicking Ready button
   - **Purpose**: Ensure deployment is complete and legal
   - **Method**: `validateDeploymentComplete()`
   - **Result**: List of validation errors (if any)

4. **Server Validation** (Server - Anti-Cheat)
   - **When**: Receiving deployment state from client
   - **Purpose**: Prevent cheating via modified client
   - **Method**: `validateServerDeployment(deploymentState)`
   - **Result**: Accept or reject with detailed errors

### Validation Results

1. **Valid Placement**
   - `valid: true`
   - No error message
   - Allow placement, update state
   - Play success sound/animation

2. **Invalid Placement**
   - `valid: false`
   - `reason`: Error code (e.g., `'out_of_zone'`)
   - `message`: Human-readable error
   - `suggestedHexes`: Alternative valid hexes (optional)

3. **Partial Deployment**
   - `complete: false`
   - `placedCount`: X / 8
   - `missingCreatures`: List of unplaced creatures
   - Ready button disabled

4. **Complete Deployment**
   - `complete: true`
   - `placedCount`: 8 / 8
   - `valid: true` (if all placements legal)
   - Ready button enabled

---

## Technical Specification

### Architecture

**Validation Service**
```typescript
/**
 * Main validation service (shared between client and server)
 */
class DeploymentValidator {
  private gridConfig: HexGridConfig;
  private deploymentZones: Map<PlayerId, DeploymentZone>;

  constructor(config: HexGridConfig);

  // Core validation methods
  isValidPlacement(hex: AxialCoordinate, creature: Creature, playerId: PlayerId): ValidationResult;
  validateDeploymentComplete(deployment: DeploymentState): DeploymentValidation;
  validateServerDeployment(deployment: DeploymentState): ServerValidationResult;
}

/**
 * Validation result for single placement
 */
interface ValidationResult {
  valid: boolean;
  reason?: ValidationReason;
  message?: string;
  suggestedHexes?: AxialCoordinate[];
}

enum ValidationReason {
  OUT_OF_ZONE = 'out_of_zone',
  OCCUPIED = 'occupied',
  OUT_OF_BOUNDS = 'out_of_bounds',
  LOCKED = 'locked',
  INVALID_CREATURE = 'invalid_creature'
}

/**
 * Validation result for complete deployment
 */
interface DeploymentValidation {
  complete: boolean;
  placedCount: number;
  totalCount: number;
  valid: boolean;
  errors: ValidationError[];
}

interface ValidationError {
  type: ValidationReason;
  message: string;
  hex?: AxialCoordinate;
  creatureId?: string;
}

/**
 * Server validation result (includes anti-cheat checks)
 */
interface ServerValidationResult {
  accepted: boolean;
  reason?: string;
  tamperedFields?: string[]; // If client state was modified
  correctedDeployment?: DeploymentState; // Server-corrected state
}

/**
 * Deployment zone definition
 */
interface DeploymentZone {
  playerId: PlayerId;
  minColumn: number;
  maxColumn: number;
  validHexes: Set<string>; // "q,r" format for fast lookup
}
```

**Validation Implementation**
```typescript
class DeploymentValidator {
  /**
   * Check if single placement is valid
   */
  isValidPlacement(
    hex: AxialCoordinate,
    creature: Creature,
    playerId: PlayerId,
    currentPlacements: Map<string, Creature>,
    isLocked: boolean
  ): ValidationResult {
    // Check if deployment is locked
    if (isLocked) {
      return {
        valid: false,
        reason: ValidationReason.LOCKED,
        message: 'Cannot modify placements after clicking Ready'
      };
    }

    // Check grid bounds
    if (!this.hexMath.isValid(hex)) {
      return {
        valid: false,
        reason: ValidationReason.OUT_OF_BOUNDS,
        message: 'Invalid hex position'
      };
    }

    // Check deployment zone
    const zone = this.deploymentZones.get(playerId);
    if (!zone || !this.isInZone(hex, zone)) {
      return {
        valid: false,
        reason: ValidationReason.OUT_OF_ZONE,
        message: 'Cannot place outside your deployment zone',
        suggestedHexes: this.getSuggestedHexes(hex, zone)
      };
    }

    // Check hex occupancy
    const hexKey = `${hex.q},${hex.r}`;
    if (currentPlacements.has(hexKey)) {
      const occupyingCreature = currentPlacements.get(hexKey)!;
      if (occupyingCreature.id !== creature.id) {
        return {
          valid: false,
          reason: ValidationReason.OCCUPIED,
          message: 'This hex is already occupied'
        };
      }
    }

    return { valid: true };
  }

  /**
   * Check if hex is within deployment zone
   */
  private isInZone(hex: AxialCoordinate, zone: DeploymentZone): boolean {
    const hexKey = `${hex.q},${hex.r}`;
    return zone.validHexes.has(hexKey);
  }

  /**
   * Get suggested alternative hexes near invalid hex
   */
  private getSuggestedHexes(hex: AxialCoordinate, zone: DeploymentZone): AxialCoordinate[] {
    // Find nearest valid hexes in zone
    const suggestions: AxialCoordinate[] = [];
    const maxSuggestions = 3;

    // Convert zone hexes to coordinates and sort by distance
    const zoneHexes = Array.from(zone.validHexes).map(key => {
      const [q, r] = key.split(',').map(Number);
      return { q, r };
    });

    zoneHexes.sort((a, b) =>
      this.hexMath.distance(hex, a) - this.hexMath.distance(hex, b)
    );

    return zoneHexes.slice(0, maxSuggestions);
  }

  /**
   * Validate complete deployment before Ready
   */
  validateDeploymentComplete(deployment: DeploymentState): DeploymentValidation {
    const errors: ValidationError[] = [];

    // Check roster count
    if (deployment.roster.length !== 8) {
      errors.push({
        type: ValidationReason.INVALID_CREATURE,
        message: `Roster must have exactly 8 creatures (has ${deployment.roster.length})`
      });
    }

    // Check all creatures placed
    if (deployment.placements.length < 8) {
      errors.push({
        type: ValidationReason.INVALID_CREATURE,
        message: `Must place all 8 creatures (${deployment.placements.length}/8 placed)`
      });
    }

    // Check each placement is valid
    const placementMap = new Map<string, Creature>();
    for (const placement of deployment.placements) {
      const validation = this.isValidPlacement(
        placement.position,
        placement.creature,
        deployment.playerId,
        placementMap,
        false
      );

      if (!validation.valid) {
        errors.push({
          type: validation.reason!,
          message: validation.message!,
          hex: placement.position,
          creatureId: placement.creature.id
        });
      }

      placementMap.set(`${placement.position.q},${placement.position.r}`, placement.creature);
    }

    return {
      complete: deployment.placements.length === 8,
      placedCount: deployment.placements.length,
      totalCount: 8,
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Server-side validation (anti-cheat)
   */
  validateServerDeployment(deployment: DeploymentState): ServerValidationResult {
    // First run standard validation
    const standardValidation = this.validateDeploymentComplete(deployment);

    if (!standardValidation.valid) {
      return {
        accepted: false,
        reason: 'Deployment validation failed',
        tamperedFields: standardValidation.errors.map(e => e.type)
      };
    }

    // Additional server-only checks
    const tamperedFields: string[] = [];

    // Check creature IDs match roster
    const rosterIds = new Set(deployment.roster.map(c => c.id));
    for (const placement of deployment.placements) {
      if (!rosterIds.has(placement.creature.id)) {
        tamperedFields.push('creature_id');
      }
    }

    // Check no duplicate creature placements
    const placedIds = new Set<string>();
    for (const placement of deployment.placements) {
      if (placedIds.has(placement.creature.id)) {
        tamperedFields.push('duplicate_creature');
      }
      placedIds.add(placement.creature.id);
    }

    // Check hex coordinates are integers
    for (const placement of deployment.placements) {
      if (!Number.isInteger(placement.position.q) || !Number.isInteger(placement.position.r)) {
        tamperedFields.push('hex_coordinates');
      }
    }

    if (tamperedFields.length > 0) {
      return {
        accepted: false,
        reason: 'Client state tampering detected',
        tamperedFields
      };
    }

    return { accepted: true };
  }
}
```

**Zone Initialization**
```typescript
class DeploymentValidator {
  /**
   * Initialize deployment zones
   */
  private initializeZones(config: HexGridConfig): Map<PlayerId, DeploymentZone> {
    const zones = new Map<PlayerId, DeploymentZone>();

    // Player 1 zone (left 3 columns)
    const player1Hexes = new Set<string>();
    for (let q = 0; q <= 2; q++) {
      for (let r = 0; r < config.height; r++) {
        player1Hexes.add(`${q},${r}`);
      }
    }
    zones.set('player1', {
      playerId: 'player1',
      minColumn: 0,
      maxColumn: 2,
      validHexes: player1Hexes
    });

    // Player 2 zone (right 3 columns)
    const player2Hexes = new Set<string>();
    for (let q = 9; q <= 11; q++) {
      for (let r = 0; r < config.height; r++) {
        player2Hexes.add(`${q},${r}`);
      }
    }
    zones.set('player2', {
      playerId: 'player2',
      minColumn: 9,
      maxColumn: 11,
      validHexes: player2Hexes
    });

    return zones;
  }
}
```

### Key Technologies

- **TypeScript**: Shared validation logic (client + server)
- **Set Data Structure**: Fast hex lookup (O(1))
- **Immutable State**: Validation doesn't mutate deployment
- **Pure Functions**: Deterministic, testable validation

---

## Success Criteria

### MVP Definition of Done

- [ ] Zone boundary validation works (rejects out-of-zone placements)
- [ ] Hex occupancy validation prevents double-placement
- [ ] Grid bounds validation rejects invalid coordinates
- [ ] Roster constraint validation requires exactly 8 creatures
- [ ] Completion validation blocks Ready until 8/8 placed
- [ ] Lock state validation prevents changes after Ready
- [ ] Server validation detects tampered client state
- [ ] Suggested hexes provided for out-of-zone errors
- [ ] All validation < 1ms per check (client-side)
- [ ] Server validation < 10ms for full deployment
- [ ] 100% test coverage for all validation rules
- [ ] Clear error messages for all failure cases

---

## Testing Strategy

### Unit Tests

**Zone Validation**
```typescript
describe('Zone Validation', () => {
  it('should accept placement in player zone', () => {
    const hex = { q: 1, r: 3 }; // Player 1 zone
    const result = validator.isValidPlacement(hex, creature, 'player1', new Map(), false);
    expect(result.valid).toBe(true);
  });

  it('should reject placement in opponent zone', () => {
    const hex = { q: 10, r: 3 }; // Player 2 zone
    const result = validator.isValidPlacement(hex, creature, 'player1', new Map(), false);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe(ValidationReason.OUT_OF_ZONE);
  });

  it('should reject placement in neutral zone', () => {
    const hex = { q: 5, r: 4 }; // Neutral zone
    const result = validator.isValidPlacement(hex, creature, 'player1', new Map(), false);
    expect(result.valid).toBe(false);
  });
});
```

**Occupancy Validation**
```typescript
describe('Occupancy Validation', () => {
  it('should reject placement on occupied hex', () => {
    const hex = { q: 1, r: 1 };
    const placements = new Map([[`${hex.q},${hex.r}`, otherCreature]]);
    const result = validator.isValidPlacement(hex, creature, 'player1', placements, false);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe(ValidationReason.OCCUPIED);
  });

  it('should allow same creature to reposition to its own hex', () => {
    const hex = { q: 1, r: 1 };
    const placements = new Map([[`${hex.q},${hex.r}`, creature]]);
    const result = validator.isValidPlacement(hex, creature, 'player1', placements, false);
    expect(result.valid).toBe(true);
  });
});
```

**Server Anti-Cheat**
```typescript
describe('Server Validation', () => {
  it('should detect tampered creature IDs', () => {
    const deployment = createValidDeployment();
    deployment.placements[0].creature.id = 'fake-id'; // Tamper
    const result = validator.validateServerDeployment(deployment);
    expect(result.accepted).toBe(false);
    expect(result.tamperedFields).toContain('creature_id');
  });

  it('should detect fractional hex coordinates', () => {
    const deployment = createValidDeployment();
    deployment.placements[0].position.q = 1.5; // Tamper
    const result = validator.validateServerDeployment(deployment);
    expect(result.accepted).toBe(false);
    expect(result.tamperedFields).toContain('hex_coordinates');
  });
});
```

### Edge Cases

1. **Boundary Hexes**: Test placements at zone borders (columns 2-3, 8-9)
2. **Corner Cases**: Test hexes at grid corners (0,0), (11,7)
3. **Rapid Validation**: 1000 validation calls in < 100ms
4. **Concurrent Placement**: Two players placing simultaneously (server)
5. **Invalid State**: Empty roster, duplicate creatures, null hexes

---

## L4 Task Candidates

1. **Implement Zone Boundary Check** (3 hours) - Column range validation, zone lookup
2. **Implement Hex Occupancy Check** (2 hours) - Placement map, duplicate detection
3. **Implement Grid Bounds Check** (1 hour) - Coordinate range validation
4. **Implement Lock State Check** (1 hour) - Ready state validation
5. **Implement Completion Validation** (2 hours) - 8/8 check, error aggregation
6. **Implement Suggested Hexes** (3 hours) - Nearest valid hex algorithm
7. **Implement Server Validation** (4 hours) - Anti-cheat checks, tamper detection
8. **Create Validation Result Builder** (2 hours) - Error messages, result objects
9. **Write Unit Tests** (6 hours) - All rules, edge cases, anti-cheat
10. **Performance Optimization** (2 hours) - Fast lookups, caching

**Total: 26 hours (~3-4 days)**

---

## Dependencies

### Depends On
- **Hex Math Library** (L3): Grid bounds checking
- **Deployment State** (L3): Placement data structure

### Depended On By
- **Drag-and-Drop Controller** (L3): Real-time validation
- **Deployment UI** (L3): Ready button enable/disable
- **Server Deployment Handler** (L3): Anti-cheat validation

---

## Metadata

**Feature ID**: `deployment-validation`
**Epic**: Hex Grid Deployment System
**Priority**: CRITICAL
**Estimated Effort**: 3-4 days
**Complexity**: MEDIUM
