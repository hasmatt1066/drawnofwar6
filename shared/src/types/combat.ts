/**
 * Combat State Types
 *
 * Types for managing combat simulation, creature instances, actions, and events.
 * Used by the authoritative server combat engine (60 tps).
 */

import type { AxialCoordinate } from '../utils/hex-math/types.js';

/**
 * Player identifier
 */
export type PlayerId = 'player1' | 'player2';

/**
 * Combat creature instance
 * Represents a creature in active combat with current state
 */
export interface CombatCreature {
  /** Unique instance ID for this creature in combat */
  unitId: string;
  /** Original creature ID from deployment */
  creatureId: string;
  /** Player who owns this creature */
  ownerId: PlayerId;
  /** Current position on battlefield */
  position: AxialCoordinate;
  /** Current health points */
  health: number;
  /** Maximum health points */
  maxHealth: number;
  /** Combat status */
  status: 'alive' | 'dead';
  /** Current target unit ID */
  currentTarget?: string;
  /** Pathfinding route to target */
  movementPath?: AxialCoordinate[];
  /** Facing direction in degrees (for rendering) */
  facingDirection: number;
  /** Ticks remaining until next attack */
  attackCooldownRemaining: number;
  /** Creature stats */
  stats: CombatStats;
  /** Active buffs on this creature */
  activeBuffs: Buff[];
  /** Active debuffs on this creature */
  activeDebuffs: Debuff[];
  /** Creature abilities */
  abilities: CombatAbility[];
}

/**
 * Creature combat statistics
 */
export interface CombatStats {
  /** Movement speed in hexes per second */
  movementSpeed: number;
  /** Attack range in hexes */
  attackRange: number;
  /** Base attack damage */
  attackDamage: number;
  /** Armor (damage reduction) */
  armor: number;
  /** Attacks per second */
  attackSpeed: number;
  /** Damage type */
  damageType: 'physical' | 'magic' | 'true';
  /** Creature archetype */
  archetype: 'tank' | 'melee_dps' | 'ranged_dps' | 'mage' | 'support';
}

/**
 * Combat ability
 */
export interface CombatAbility {
  /** Ability identifier */
  abilityId: string;
  /** Ability name */
  name: string;
  /** Ability type */
  type: 'single_target' | 'aoe' | 'buff' | 'debuff' | 'heal';
  /** Total cooldown in ticks */
  cooldownTotal: number;
  /** Remaining cooldown in ticks */
  cooldownRemaining: number;
  /** Ability range in hexes */
  range: number;
  /** Damage amount (for damage abilities) */
  damageAmount?: number;
  /** Heal amount (for heal abilities) */
  healAmount?: number;
  /** AOE radius in hexes (for AOE abilities) */
  aoeRadius?: number;
  /** Buff effect (for buff abilities) */
  buffEffect?: BuffEffect;
  /** Debuff effect (for debuff abilities) */
  debuffEffect?: DebuffEffect;
}

/**
 * Buff effect definition
 */
export interface BuffEffect {
  buffId: string;
  name: string;
  durationTicks: number;
  effects: {
    damageMultiplier?: number;
    armorBonus?: number;
    speedMultiplier?: number;
    healPerTick?: number;
  };
}

/**
 * Debuff effect definition
 */
export interface DebuffEffect {
  debuffId: string;
  name: string;
  durationTicks: number;
  effects: {
    damageReduction?: number;
    armorPenalty?: number;
    slowMultiplier?: number;
    damagePerTick?: number;
  };
}

/**
 * Active buff on a creature
 */
export interface Buff {
  buffId: string;
  name: string;
  appliedTick: number;
  durationRemaining: number;
  effects: {
    damageMultiplier?: number;
    armorBonus?: number;
    speedMultiplier?: number;
    healPerTick?: number;
  };
}

/**
 * Active debuff on a creature
 */
export interface Debuff {
  debuffId: string;
  name: string;
  appliedTick: number;
  durationRemaining: number;
  effects: {
    damageReduction?: number;
    armorPenalty?: number;
    slowMultiplier?: number;
    damagePerTick?: number;
  };
}

/**
 * Projectile in flight
 */
export interface Projectile {
  projectileId: string;
  abilityId: string;
  sourceUnitId: string;
  targetUnitId: string;
  currentPosition: AxialCoordinate;
  targetPosition: AxialCoordinate;
  velocity: number; // hexes per tick
  spawnTick: number;
  lifetimeTicks: number;
  damageAmount: number;
  effectOnImpact?: string; // Visual effect ID
}

/**
 * Combat state - full simulation state
 */
export interface CombatState {
  /** Match/battle identifier */
  matchId: string;
  /** Current simulation tick */
  tick: number;
  /** Combat status */
  status: 'initializing' | 'running' | 'paused' | 'completed';
  /** All creatures in combat */
  units: CombatCreature[];
  /** Active projectiles */
  projectiles: Projectile[];
  /** Recent combat events (last 60 ticks) */
  events: CombatEvent[];
  /** Combat statistics */
  statistics: CombatStatistics;
  /** Start time */
  startTime: number;
  /** End time (if completed) */
  endTime?: number;
}

/**
 * Combat action
 */
export interface CombatAction {
  tick: number;
  unitId: string;
  actionType: 'move' | 'attack' | 'use_ability' | 'death';
  targetUnitId?: string;
  targetPosition?: AxialCoordinate;
  abilityId?: string;
  damage?: number;
}

/**
 * Combat event
 */
export interface CombatEvent {
  tick: number;
  eventType: 'damage_dealt' | 'healing_done' | 'ability_used' | 'unit_died' | 'projectile_spawned' | 'buff_applied' | 'debuff_applied';
  data: Record<string, any>;
}

/**
 * Combat statistics
 */
export interface CombatStatistics {
  totalDamageDealt: Record<PlayerId, number>;
  totalHealingDone: Record<PlayerId, number>;
  unitsLost: Record<PlayerId, number>;
  abilitiesUsed: Record<PlayerId, number>;
  duration: number; // ticks
}

/**
 * Combat result
 */
export interface CombatResult {
  matchId: string;
  winner: PlayerId | 'draw';
  reason: 'elimination' | 'timeout' | 'forfeit';
  duration: number; // ticks
  finalState: CombatState;
  statistics: CombatStatistics;
  eventLog: CombatEvent[];
}

/**
 * Combat configuration
 */
export interface CombatConfig {
  /** Ticks per second */
  tickRate: number;
  /** Maximum combat duration in ticks (5 minutes at 60 tps = 18000) */
  maxTicks: number;
  /** State broadcast rate (updates per second to clients) */
  broadcastRate: number;
}

/**
 * Default combat configuration
 */
export const DEFAULT_COMBAT_CONFIG: CombatConfig = {
  tickRate: 60,
  maxTicks: 18000, // 5 minutes
  broadcastRate: 10 // 10 updates per second
};
