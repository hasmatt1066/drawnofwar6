/**
 * CombatStateManager - Immutable State Management for Combat Simulation
 *
 * Implements L4-COMBAT-002: Manages all combat state with immutable updates,
 * event logging, and network serialization.
 *
 * Key Features:
 * - Immutable state updates
 * - Event log pruning (max 60 ticks)
 * - Efficient unit filtering
 * - JSON serialization for network
 */

export interface HexCoordinate {
  q: number;
  r: number;
}

export interface CombatState {
  battleId: string;
  tick: number;
  status: 'initializing' | 'running' | 'paused' | 'completed';
  units: CombatUnit[];
  projectiles: Projectile[];
  activeEffects: ActiveEffect[];
  events: CombatEvent[]; // Last 60 ticks only
  winner: 'player1' | 'player2' | 'draw' | null;
}

export interface CombatUnit {
  unitId: string;
  creatureId: string;
  ownerId: 'player1' | 'player2';
  position: HexCoordinate;
  health: number;
  maxHealth: number;
  status: 'alive' | 'dead';
  currentTarget: string | null;
  facingDirection: number; // degrees
  attackCooldown: number; // ticks remaining
  stats: UnitStats;
}

export interface UnitStats {
  movementSpeed: number; // hexes per second
  attackRange: number; // hexes
  attackDamage: number;
  armor: number;
  attackSpeed: number; // attacks per second
}

export interface Projectile {
  projectileId: string;
  sourceUnitId: string;
  targetUnitId: string;
  currentPosition: HexCoordinate;
  targetPosition: HexCoordinate;
  velocity: number; // hexes per tick
  damage: number;
  spawnTick: number;
}

export interface ActiveEffect {
  effectId: string;
  targetUnitId: string;
  type: 'buff' | 'debuff';
  statModifiers: Partial<UnitStats>;
  duration: number; // ticks remaining
}

export interface CombatEvent {
  tick: number;
  type: 'damage' | 'death' | 'ability' | 'movement';
  data: Record<string, any>;
}

export interface Deployment {
  playerId: 'player1' | 'player2';
  creature: {
    id: string;
    name: string;
    stats: UnitStats;
    maxHealth: number;
  };
  hex: HexCoordinate;
}

export class CombatStateManager {
  /**
   * Initialize combat state from deployment data
   */
  initializeState(battleId: string, deployments: Deployment[]): CombatState {
    const units: CombatUnit[] = deployments.map((deployment, index) => {
      // Calculate initial attack cooldown (half of normal cooldown for "ready" phase)
      const fullCooldown = Math.round(60 / deployment.creature.stats.attackSpeed);
      const initialCooldown = Math.floor(fullCooldown / 2);

      return {
        unitId: `unit-${index + 1}`,
        creatureId: deployment.creature.id,
        ownerId: deployment.playerId,
        position: deployment.hex,
        health: deployment.creature.maxHealth,
        maxHealth: deployment.creature.maxHealth,
        status: 'alive' as const,
        currentTarget: null,
        facingDirection: deployment.playerId === 'player1' ? 0 : 180,
        attackCooldown: initialCooldown,
        stats: deployment.creature.stats
      };
    });

    return {
      battleId,
      tick: 0,
      status: 'initializing',
      units,
      projectiles: [],
      activeEffects: [],
      events: [],
      winner: null
    };
  }

  /**
   * Update unit immutably
   */
  updateUnit(state: CombatState, unitId: string, updates: Partial<CombatUnit>): CombatState {
    return {
      ...state,
      units: state.units.map(unit =>
        unit.unitId === unitId
          ? { ...unit, ...updates }
          : unit
      )
    };
  }

  /**
   * Add projectile immutably
   */
  addProjectile(state: CombatState, projectile: Projectile): CombatState {
    return {
      ...state,
      projectiles: [...state.projectiles, projectile]
    };
  }

  /**
   * Remove projectile immutably
   */
  removeProjectile(state: CombatState, projectileId: string): CombatState {
    return {
      ...state,
      projectiles: state.projectiles.filter(p => p.projectileId !== projectileId)
    };
  }

  /**
   * Add event to log
   */
  addEvent(state: CombatState, event: CombatEvent): CombatState {
    return {
      ...state,
      events: [...state.events, event]
    };
  }

  /**
   * Prune old events (keep last 60 ticks only)
   */
  pruneOldEvents(state: CombatState): CombatState {
    const cutoffTick = state.tick - 60;
    return {
      ...state,
      events: state.events.filter(event => event.tick > cutoffTick)
    };
  }

  /**
   * Get alive units, optionally filtered by player
   */
  getAliveUnits(state: CombatState, playerId?: 'player1' | 'player2'): CombatUnit[] {
    return state.units.filter(unit => {
      if (unit.status !== 'alive') return false;
      if (playerId && unit.ownerId !== playerId) return false;
      return true;
    });
  }

  /**
   * Serialize state to JSON string
   */
  serialize(state: CombatState): string {
    return JSON.stringify(state);
  }

  /**
   * Deserialize JSON string to state
   */
  deserialize(data: string): CombatState {
    return JSON.parse(data);
  }
}
