/**
 * Deployment Validator Service
 *
 * Server-side validation for creature deployment on hex grid.
 * Enforces all deployment rules to prevent cheating and ensure fair play.
 *
 * Based on L3-FEATURE: deployment-validation
 */

import { HexGrid } from '@drawn-of-war/shared';
import type { AxialCoordinate } from '@drawn-of-war/shared';
import type {
  DeploymentCreature,
  CreaturePlacement,
  PlayerDeploymentState,
  DEPLOYMENT_ZONES,
  MAX_CREATURES_PER_PLAYER
} from '@drawn-of-war/shared';

/**
 * Validation reasons (error codes)
 */
export enum ValidationReason {
  OUT_OF_ZONE = 'out_of_zone',
  OCCUPIED = 'occupied',
  OUT_OF_BOUNDS = 'out_of_bounds',
  LOCKED = 'locked',
  INVALID_CREATURE = 'invalid_creature',
  ROSTER_SIZE = 'roster_size',
  INCOMPLETE_DEPLOYMENT = 'incomplete_deployment',
  DUPLICATE_CREATURE = 'duplicate_creature',
  TAMPERED_CREATURE_ID = 'tampered_creature_id',
  INVALID_HEX_COORDINATES = 'invalid_hex_coordinates'
}

/**
 * Validation result for single placement
 */
export interface ValidationResult {
  valid: boolean;
  reason?: ValidationReason;
  message?: string;
  suggestedHexes?: AxialCoordinate[];
}

/**
 * Validation error details
 */
export interface ValidationError {
  type: ValidationReason;
  message: string;
  hex?: AxialCoordinate;
  creatureId?: string;
}

/**
 * Validation result for complete deployment
 */
export interface DeploymentValidation {
  complete: boolean;
  placedCount: number;
  totalCount: number;
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Server validation result (includes anti-cheat checks)
 */
export interface ServerValidationResult {
  accepted: boolean;
  reason?: string;
  tamperedFields?: string[];
  correctedDeployment?: PlayerDeploymentState;
}

/**
 * Deployment zone definition
 */
interface DeploymentZone {
  playerId: 'player1' | 'player2';
  minColumn: number;
  maxColumn: number;
  validHexes: Set<string>; // "q,r" format for fast lookup
}

/**
 * Deployment Validator
 *
 * Validates creature placements on hex grid according to deployment rules.
 * Shared validation logic ensures consistency between client and server.
 */
export class DeploymentValidator {
  private hexGrid: HexGrid;
  private deploymentZones: Map<'player1' | 'player2', DeploymentZone>;

  constructor() {
    // Initialize hex grid (12x8 standard deployment grid)
    this.hexGrid = new HexGrid({
      width: 12,
      height: 8,
      hexSize: 32,
      orientation: 'flat-top'
    });

    // Initialize deployment zones
    this.deploymentZones = this.initializeZones();
  }

  /**
   * Initialize deployment zones for both players
   */
  private initializeZones(): Map<'player1' | 'player2', DeploymentZone> {
    const zones = new Map<'player1' | 'player2', DeploymentZone>();

    // Player 1 zone (left 3 columns: 0-2)
    const player1Hexes = new Set<string>();
    for (let q = 0; q <= 2; q++) {
      for (let r = 0; r < this.hexGrid.height; r++) {
        player1Hexes.add(`${q},${r}`);
      }
    }
    zones.set('player1', {
      playerId: 'player1',
      minColumn: 0,
      maxColumn: 2,
      validHexes: player1Hexes
    });

    // Player 2 zone (right 3 columns: 9-11)
    const player2Hexes = new Set<string>();
    for (let q = 9; q <= 11; q++) {
      for (let r = 0; r < this.hexGrid.height; r++) {
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

  /**
   * Check if single placement is valid
   *
   * @param hex - Hex coordinate to place creature
   * @param creature - Creature being placed
   * @param playerId - Player making the placement
   * @param currentPlacements - Map of current placements (hex -> creature)
   * @param isLocked - Whether deployment is locked (after Ready)
   * @returns Validation result with error details if invalid
   */
  isValidPlacement(
    hex: AxialCoordinate,
    creature: DeploymentCreature,
    playerId: 'player1' | 'player2',
    currentPlacements: Map<string, DeploymentCreature>,
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
    if (!this.hexGrid.isValid(hex)) {
      return {
        valid: false,
        reason: ValidationReason.OUT_OF_BOUNDS,
        message: 'Invalid hex position - outside grid boundaries'
      };
    }

    // Check deployment zone
    const zone = this.deploymentZones.get(playerId);
    if (!zone || !this.isInZone(hex, zone)) {
      return {
        valid: false,
        reason: ValidationReason.OUT_OF_ZONE,
        message: 'Cannot place outside your deployment zone',
        suggestedHexes: this.getSuggestedHexes(hex, zone!)
      };
    }

    // Check hex occupancy
    const hexKey = this.hexGrid.hash(hex);
    if (currentPlacements.has(hexKey)) {
      const occupyingCreature = currentPlacements.get(hexKey)!;
      // Allow same creature to reposition to its own hex
      if (occupyingCreature.id !== creature.id) {
        return {
          valid: false,
          reason: ValidationReason.OCCUPIED,
          message: 'This hex is already occupied by another creature'
        };
      }
    }

    return { valid: true };
  }

  /**
   * Check if hex is within deployment zone
   */
  private isInZone(hex: AxialCoordinate, zone: DeploymentZone): boolean {
    const hexKey = this.hexGrid.hash(hex);
    return zone.validHexes.has(hexKey);
  }

  /**
   * Get suggested alternative hexes near invalid hex
   * Returns up to 3 nearest valid hexes in player's zone
   */
  private getSuggestedHexes(
    hex: AxialCoordinate,
    zone: DeploymentZone
  ): AxialCoordinate[] {
    const maxSuggestions = 3;

    // Convert zone hexes to coordinates and sort by distance
    const zoneHexes = Array.from(zone.validHexes).map(key => {
      const parsed = this.hexGrid.fromHash(key);
      return parsed!;
    });

    zoneHexes.sort((a, b) =>
      this.hexGrid.distance(hex, a) - this.hexGrid.distance(hex, b)
    );

    return zoneHexes.slice(0, maxSuggestions);
  }

  /**
   * Validate complete deployment before Ready
   *
   * @param deployment - Player's complete deployment state
   * @returns Validation result with all errors
   */
  validateDeploymentComplete(deployment: PlayerDeploymentState): DeploymentValidation {
    const errors: ValidationError[] = [];

    // Check roster count (must be exactly 8)
    if (deployment.roster.length !== deployment.maxCreatures) {
      errors.push({
        type: ValidationReason.ROSTER_SIZE,
        message: `Roster must have exactly ${deployment.maxCreatures} creatures (has ${deployment.roster.length})`
      });
    }

    // Check all creatures placed
    if (deployment.placements.length < deployment.maxCreatures) {
      errors.push({
        type: ValidationReason.INCOMPLETE_DEPLOYMENT,
        message: `Must place all ${deployment.maxCreatures} creatures (${deployment.placements.length}/${deployment.maxCreatures} placed)`
      });
    }

    // Build placement map for validation
    const placementMap = new Map<string, DeploymentCreature>();
    const placedCreatureIds = new Set<string>();

    // Check each placement is valid
    for (const placement of deployment.placements) {
      // Check for duplicate creature placements
      if (placedCreatureIds.has(placement.creature.id)) {
        errors.push({
          type: ValidationReason.DUPLICATE_CREATURE,
          message: `Creature ${placement.creature.name} is placed multiple times`,
          creatureId: placement.creature.id
        });
        continue;
      }
      placedCreatureIds.add(placement.creature.id);

      // Validate individual placement
      const validation = this.isValidPlacement(
        placement.hex,
        placement.creature,
        deployment.playerId,
        placementMap,
        false
      );

      if (!validation.valid) {
        errors.push({
          type: validation.reason!,
          message: validation.message!,
          hex: placement.hex,
          creatureId: placement.creature.id
        });
      }

      placementMap.set(this.hexGrid.hash(placement.hex), placement.creature);
    }

    return {
      complete: deployment.placements.length === deployment.maxCreatures,
      placedCount: deployment.placements.length,
      totalCount: deployment.maxCreatures,
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Server-side validation (anti-cheat)
   *
   * Performs additional checks beyond client validation to detect tampering.
   *
   * @param deployment - Player's deployment state from client
   * @returns Server validation result with tamper detection
   */
  validateServerDeployment(deployment: PlayerDeploymentState): ServerValidationResult {
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
        tamperedFields.push(ValidationReason.TAMPERED_CREATURE_ID);
      }
    }

    // Check no duplicate creature placements (double-check)
    const placedIds = new Set<string>();
    for (const placement of deployment.placements) {
      if (placedIds.has(placement.creature.id)) {
        tamperedFields.push(ValidationReason.DUPLICATE_CREATURE);
      }
      placedIds.add(placement.creature.id);
    }

    // Check hex coordinates are integers (prevent fractional exploits)
    for (const placement of deployment.placements) {
      if (
        !Number.isInteger(placement.hex.q) ||
        !Number.isInteger(placement.hex.r)
      ) {
        tamperedFields.push(ValidationReason.INVALID_HEX_COORDINATES);
      }
    }

    // Check all placed creatures have correct playerId
    for (const placement of deployment.placements) {
      if (placement.creature.playerId !== deployment.playerId) {
        tamperedFields.push(ValidationReason.TAMPERED_CREATURE_ID);
      }
    }

    if (tamperedFields.length > 0) {
      // Remove duplicates
      const uniqueTamperedFields = Array.from(new Set(tamperedFields));
      return {
        accepted: false,
        reason: 'Client state tampering detected',
        tamperedFields: uniqueTamperedFields
      };
    }

    return { accepted: true };
  }

  /**
   * Get deployment zone configuration for a player
   */
  getZone(playerId: 'player1' | 'player2'): DeploymentZone | undefined {
    return this.deploymentZones.get(playerId);
  }

  /**
   * Get hex grid instance
   */
  getHexGrid(): HexGrid {
    return this.hexGrid;
  }
}

/**
 * Singleton instance for reuse across requests
 */
export const deploymentValidator = new DeploymentValidator();
