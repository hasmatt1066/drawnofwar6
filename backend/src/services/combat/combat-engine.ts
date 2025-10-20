/**
 * Combat Engine
 *
 * Authoritative server-side combat simulation at 60 ticks per second.
 * Handles unit AI, movement, attacking, abilities, and victory conditions.
 */

import type {
  CombatState,
  CombatCreature,
  CombatEvent,
  CombatResult,
  CombatConfig,
  CombatAbility,
  PlayerId
} from '../../../../shared/src/types/combat.js';
import { DEFAULT_COMBAT_CONFIG } from '../../../../shared/src/types/combat.js';
import type { DeploymentState } from '../../../../shared/src/types/deployment.js';
import type { AxialCoordinate } from '../../../../shared/src/utils/hex-math/types.js';
import { hexDistance } from '../../../../shared/src/utils/hex-math/distance.js';
import {
  findClosestEnemy,
  isInAttackRange,
  isInAbilityRange,
  findUnitsInRadius,
  findLowHPAllies,
  calculateMovementPath,
  interpolatePosition,
  calculateFacingDirection
} from './targeting-ai.js';
import {
  calculateDamage,
  applyDamage,
  applyHealing,
  applyDamageOverTime,
  applyHealingOverTime
} from './damage-calculator.js';

/**
 * Combat state update callback
 */
export type CombatStateCallback = (state: CombatState) => void;

/**
 * Combat completion callback
 */
export type CombatCompleteCallback = (result: CombatResult) => void;

/**
 * Combat Engine
 */
export class CombatEngine {
  private state: CombatState;
  private config: CombatConfig;
  private isRunning: boolean = false;
  private intervalId?: NodeJS.Timeout;
  private onStateUpdate?: CombatStateCallback;
  private onComplete?: CombatCompleteCallback;
  private tickStartTime: number = 0;

  constructor(config: Partial<CombatConfig> = {}) {
    this.config = { ...DEFAULT_COMBAT_CONFIG, ...config };
    this.state = this.createEmptyState();
  }

  /**
   * Initialize combat from deployment state
   */
  public initializeFromDeployment(
    matchId: string,
    deployment: DeploymentState
  ): void {
    const units: CombatCreature[] = [];

    // Log placement counts BEFORE processing
    console.log('[CombatEngine] initializeFromDeployment - Input:', {
      matchId,
      player1Placements: deployment.player1.placements.length,
      player2Placements: deployment.player2.placements.length
    });

    // Convert player 1 placements to combat units
    for (const placement of deployment.player1.placements) {
      try {
        const unit = this.createCombatCreature(placement.creature.id, 'player1', placement.hex);
        units.push(unit);
        console.log('[CombatEngine] Created player1 unit:', {
          unitId: unit.unitId,
          creatureId: placement.creature.id,
          position: placement.hex
        });
      } catch (error) {
        console.error('[CombatEngine] ERROR creating player1 unit:', {
          creatureId: placement.creature.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Convert player 2 placements to combat units
    for (const placement of deployment.player2.placements) {
      try {
        const unit = this.createCombatCreature(placement.creature.id, 'player2', placement.hex);
        units.push(unit);
        console.log('[CombatEngine] Created player2 unit:', {
          unitId: unit.unitId,
          creatureId: placement.creature.id,
          position: placement.hex
        });
      } catch (error) {
        console.error('[CombatEngine] ERROR creating player2 unit:', {
          creatureId: placement.creature.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Log final unit counts AFTER processing
    const player1Units = units.filter(u => u.ownerId === 'player1').length;
    const player2Units = units.filter(u => u.ownerId === 'player2').length;
    console.log('[CombatEngine] initializeFromDeployment - Units created:', {
      totalUnits: units.length,
      player1Units,
      player2Units
    });

    this.state = {
      matchId,
      tick: 0,
      status: 'initializing',
      units,
      projectiles: [],
      events: [],
      statistics: {
        totalDamageDealt: { player1: 0, player2: 0 },
        totalHealingDone: { player1: 0, player2: 0 },
        unitsLost: { player1: 0, player2: 0 },
        abilitiesUsed: { player1: 0, player2: 0 },
        duration: 0
      },
      startTime: Date.now()
    };
  }

  /**
   * Start the combat simulation
   */
  public start(
    onStateUpdate?: CombatStateCallback,
    onComplete?: CombatCompleteCallback
  ): void {
    if (this.isRunning) {
      throw new Error('Combat is already running');
    }

    console.log('[CombatEngine] start() - Starting combat simulation:', {
      matchId: this.state.matchId,
      totalUnits: this.state.units.length,
      player1Units: this.state.units.filter(u => u.ownerId === 'player1').length,
      player2Units: this.state.units.filter(u => u.ownerId === 'player2').length,
      tickRate: this.config.tickRate
    });

    this.onStateUpdate = onStateUpdate;
    this.onComplete = onComplete;
    this.isRunning = true;
    this.state.status = 'running';
    this.tickStartTime = performance.now();

    const tickDuration = 1000 / this.config.tickRate; // 16.67ms for 60 tps

    this.intervalId = setInterval(() => {
      this.tick();
    }, tickDuration);
  }

  /**
   * Stop the combat simulation
   */
  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.isRunning = false;
    this.state.status = 'completed';
  }

  /**
   * Pause the combat simulation
   */
  public pause(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.isRunning = false;
    this.state.status = 'paused';
  }

  /**
   * Get current state snapshot
   */
  public getState(): CombatState {
    return { ...this.state };
  }

  /**
   * Execute a single simulation tick
   */
  private tick(): void {
    this.state.tick++;

    // Log initial state on tick 0
    if (this.state.tick === 1) {
      const aliveUnits = this.state.units.filter(u => u.status === 'alive');
      console.log('[CombatEngine] tick() - Tick 0 state:', {
        totalUnits: this.state.units.length,
        aliveUnits: aliveUnits.length,
        player1Alive: aliveUnits.filter(u => u.ownerId === 'player1').length,
        player2Alive: aliveUnits.filter(u => u.ownerId === 'player2').length
      });
    }

    // Update all alive units
    const aliveUnits = this.state.units.filter(u => u.status === 'alive');
    for (const unit of aliveUnits) {
      this.updateUnit(unit);
    }

    // Update all projectiles
    for (let i = this.state.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.state.projectiles[i];
      const shouldRemove = this.updateProjectile(projectile);
      if (shouldRemove) {
        this.state.projectiles.splice(i, 1);
      }
    }

    // Update buff/debuff durations
    for (const unit of this.state.units) {
      this.updateStatusEffects(unit);
    }

    // Apply damage/healing over time
    for (const unit of aliveUnits) {
      const dotDamage = applyDamageOverTime(unit);
      if (dotDamage > 0) {
        this.addEvent('damage_dealt', {
          sourceType: 'debuff',
          targetUnitId: unit.unitId,
          damage: dotDamage
        });

        if (unit.status === 'dead') {
          this.handleUnitDeath(unit);
        }
      }

      const hotHealing = applyHealingOverTime(unit);
      if (hotHealing > 0) {
        this.addEvent('healing_done', {
          sourceType: 'buff',
          targetUnitId: unit.unitId,
          healing: hotHealing
        });
      }
    }

    // Check victory conditions
    if (this.checkVictoryCondition()) {
      this.endCombat();
      return;
    }

    // Check timeout
    if (this.state.tick >= this.config.maxTicks) {
      this.endCombat('timeout');
      return;
    }

    // Update statistics
    this.state.statistics.duration = this.state.tick;

    // Trim old events (keep last 60 ticks)
    if (this.state.events.length > 60) {
      this.state.events = this.state.events.slice(-60);
    }

    // Notify state update
    if (this.onStateUpdate) {
      this.onStateUpdate(this.state);
    }
  }

  /**
   * Update a single unit's AI and actions
   */
  private updateUnit(unit: CombatCreature): void {
    // Select target if needed
    if (!unit.currentTarget || this.isTargetDead(unit.currentTarget)) {
      const target = findClosestEnemy(unit, this.state.units);
      unit.currentTarget = target?.unitId;
    }

    if (!unit.currentTarget) {
      return; // No enemies left
    }

    const target = this.getUnit(unit.currentTarget);
    if (!target) return;

    // Check if in attack range
    if (isInAttackRange(unit, target)) {
      // In range: Attack if cooldown ready
      if (unit.attackCooldownRemaining === 0) {
        this.executeAttack(unit, target);
        const attacksPerTick = unit.stats.attackSpeed / this.config.tickRate;
        unit.attackCooldownRemaining = Math.floor(1 / attacksPerTick);
      } else {
        unit.attackCooldownRemaining = Math.max(0, unit.attackCooldownRemaining - 1);
      }

      // Update facing direction
      unit.facingDirection = calculateFacingDirection(unit.position, target.position);

      // Check abilities
      for (const ability of unit.abilities) {
        if (ability.cooldownRemaining === 0 && this.shouldUseAbility(unit, ability)) {
          this.executeAbility(unit, ability);
          ability.cooldownRemaining = ability.cooldownTotal;
        } else {
          ability.cooldownRemaining = Math.max(0, ability.cooldownRemaining - 1);
        }
      }
    } else {
      // Not in range: Move closer
      const moveDistance = unit.stats.movementSpeed / this.config.tickRate; // hexes per tick
      const currentDistance = hexDistance(unit.position, target.position);

      // Simple movement toward target
      if (currentDistance > unit.stats.attackRange) {
        const path = calculateMovementPath(unit.position, target.position);

        if (path.length > 0) {
          const nextHex = path[0];
          if (nextHex) {
            const hexDist = hexDistance(unit.position, nextHex);

            if (moveDistance >= hexDist) {
              // Can reach next hex this tick
              unit.position = nextHex;
            } else {
              // Interpolate toward next hex
              const fraction = moveDistance / hexDist;
              unit.position = interpolatePosition(unit.position, nextHex, fraction);
            }

            // Update facing direction
            unit.facingDirection = calculateFacingDirection(unit.position, target.position);
          }
        }
      }

      // Update attack cooldown even while moving
      unit.attackCooldownRemaining = Math.max(0, unit.attackCooldownRemaining - 1);

      // Update ability cooldowns
      for (const ability of unit.abilities) {
        ability.cooldownRemaining = Math.max(0, ability.cooldownRemaining - 1);
      }
    }
  }

  /**
   * Execute a basic attack
   */
  private executeAttack(attacker: CombatCreature, target: CombatCreature): void {
    const damageResult = calculateDamage({ attacker, target });

    const died = applyDamage(target, damageResult.finalDamage);

    // Log event
    this.addEvent('damage_dealt', {
      sourceUnitId: attacker.unitId,
      targetUnitId: target.unitId,
      damage: damageResult.finalDamage,
      isCritical: damageResult.isCritical,
      damageType: damageResult.damageType
    });

    // Update statistics
    this.state.statistics.totalDamageDealt[attacker.ownerId] += damageResult.finalDamage;

    // Handle death
    if (died) {
      this.handleUnitDeath(target);
    }
  }

  /**
   * Check if an ability should be used
   */
  private shouldUseAbility(unit: CombatCreature, ability: CombatAbility): boolean {
    const target = unit.currentTarget ? this.getUnit(unit.currentTarget) : null;
    if (!target) return false;

    // Check range
    if (!isInAbilityRange(unit, target, ability.range)) {
      return false;
    }

    // Type-specific logic
    switch (ability.type) {
      case 'aoe':
        // Use if 3+ enemies in radius
        const enemies = findUnitsInRadius(
          unit.position,
          ability.aoeRadius ?? 2,
          this.state.units,
          unit.ownerId === 'player1' ? 'player2' : 'player1'
        );
        return enemies.length >= 3;

      case 'heal':
        // Use if self or ally below 50% HP
        if ((unit.health / unit.maxHealth) <= 0.5) {
          return true;
        }
        const lowAllies = findLowHPAllies(unit, this.state.units, 0.5);
        return lowAllies.length > 0;

      case 'buff':
      case 'debuff':
      case 'single_target':
        // Always use when available
        return true;

      default:
        return false;
    }
  }

  /**
   * Execute an ability
   */
  private executeAbility(unit: CombatCreature, ability: CombatAbility): void {
    this.addEvent('ability_used', {
      sourceUnitId: unit.unitId,
      abilityId: ability.abilityId,
      abilityName: ability.name
    });

    this.state.statistics.abilitiesUsed[unit.ownerId]++;

    switch (ability.type) {
      case 'single_target':
        this.executeSingleTargetAbility(unit, ability);
        break;
      case 'aoe':
        this.executeAOEAbility(unit, ability);
        break;
      case 'heal':
        this.executeHealAbility(unit, ability);
        break;
      case 'buff':
        this.executeBuffAbility(unit, ability);
        break;
      case 'debuff':
        this.executeDebuffAbility(unit, ability);
        break;
    }
  }

  /**
   * Execute single-target ability
   */
  private executeSingleTargetAbility(unit: CombatCreature, ability: CombatAbility): void {
    const target = unit.currentTarget ? this.getUnit(unit.currentTarget) : null;
    if (!target || target.status !== 'alive') return;

    const damage = ability.damageAmount ?? 50;
    const damageResult = calculateDamage({ attacker: unit, target, baseDamage: damage });

    const died = applyDamage(target, damageResult.finalDamage);

    this.addEvent('damage_dealt', {
      sourceUnitId: unit.unitId,
      targetUnitId: target.unitId,
      damage: damageResult.finalDamage,
      abilityId: ability.abilityId
    });

    this.state.statistics.totalDamageDealt[unit.ownerId] += damageResult.finalDamage;

    if (died) {
      this.handleUnitDeath(target);
    }
  }

  /**
   * Execute AOE ability
   */
  private executeAOEAbility(unit: CombatCreature, ability: CombatAbility): void {
    const enemies = findUnitsInRadius(
      unit.position,
      ability.aoeRadius ?? 2,
      this.state.units,
      unit.ownerId === 'player1' ? 'player2' : 'player1'
    );

    const damage = ability.damageAmount ?? 60;

    for (const target of enemies) {
      const damageResult = calculateDamage({ attacker: unit, target, baseDamage: damage });
      const died = applyDamage(target, damageResult.finalDamage);

      this.addEvent('damage_dealt', {
        sourceUnitId: unit.unitId,
        targetUnitId: target.unitId,
        damage: damageResult.finalDamage,
        abilityId: ability.abilityId
      });

      this.state.statistics.totalDamageDealt[unit.ownerId] += damageResult.finalDamage;

      if (died) {
        this.handleUnitDeath(target);
      }
    }
  }

  /**
   * Execute heal ability
   */
  private executeHealAbility(unit: CombatCreature, ability: CombatAbility): void {
    const healAmount = ability.healAmount ?? 100;

    // Heal self if low HP
    if ((unit.health / unit.maxHealth) <= 0.5) {
      const actualHealing = applyHealing(unit, healAmount);

      this.addEvent('healing_done', {
        sourceUnitId: unit.unitId,
        targetUnitId: unit.unitId,
        healing: actualHealing,
        abilityId: ability.abilityId
      });

      this.state.statistics.totalHealingDone[unit.ownerId] += actualHealing;
      return;
    }

    // Otherwise heal lowest HP ally
    const lowAllies = findLowHPAllies(unit, this.state.units, 0.5);
    if (lowAllies.length > 0) {
      const target = lowAllies[0];
      if (target) {
        const actualHealing = applyHealing(target, healAmount);

        this.addEvent('healing_done', {
          sourceUnitId: unit.unitId,
          targetUnitId: target.unitId,
          healing: actualHealing,
          abilityId: ability.abilityId
        });

        this.state.statistics.totalHealingDone[unit.ownerId] += actualHealing;
      }
    }
  }

  /**
   * Execute buff ability
   */
  private executeBuffAbility(unit: CombatCreature, ability: CombatAbility): void {
    if (!ability.buffEffect) return;

    // Apply to self
    unit.activeBuffs.push({
      buffId: ability.buffEffect.buffId,
      name: ability.buffEffect.name,
      appliedTick: this.state.tick,
      durationRemaining: ability.buffEffect.durationTicks,
      effects: ability.buffEffect.effects
    });

    this.addEvent('buff_applied', {
      sourceUnitId: unit.unitId,
      targetUnitId: unit.unitId,
      buffId: ability.buffEffect.buffId
    });
  }

  /**
   * Execute debuff ability
   */
  private executeDebuffAbility(unit: CombatCreature, ability: CombatAbility): void {
    const target = unit.currentTarget ? this.getUnit(unit.currentTarget) : null;
    if (!target || target.status !== 'alive' || !ability.debuffEffect) return;

    target.activeDebuffs.push({
      debuffId: ability.debuffEffect.debuffId,
      name: ability.debuffEffect.name,
      appliedTick: this.state.tick,
      durationRemaining: ability.debuffEffect.durationTicks,
      effects: ability.debuffEffect.effects
    });

    this.addEvent('debuff_applied', {
      sourceUnitId: unit.unitId,
      targetUnitId: target.unitId,
      debuffId: ability.debuffEffect.debuffId
    });
  }

  /**
   * Update projectile position and check for impact
   */
  private updateProjectile(_projectile: any): boolean {
    // Projectile logic placeholder (for post-MVP)
    return false;
  }

  /**
   * Update buff/debuff durations
   */
  private updateStatusEffects(unit: CombatCreature): void {
    // Update buffs
    for (let i = unit.activeBuffs.length - 1; i >= 0; i--) {
      const buff = unit.activeBuffs[i];
      if (buff) {
        buff.durationRemaining--;

        if (buff.durationRemaining <= 0) {
          unit.activeBuffs.splice(i, 1);
        }
      }
    }

    // Update debuffs
    for (let i = unit.activeDebuffs.length - 1; i >= 0; i--) {
      const debuff = unit.activeDebuffs[i];
      if (debuff) {
        debuff.durationRemaining--;

        if (debuff.durationRemaining <= 0) {
          unit.activeDebuffs.splice(i, 1);
        }
      }
    }
  }

  /**
   * Handle unit death
   */
  private handleUnitDeath(unit: CombatCreature): void {
    unit.status = 'dead';

    this.addEvent('unit_died', {
      unitId: unit.unitId,
      ownerId: unit.ownerId
    });

    this.state.statistics.unitsLost[unit.ownerId]++;
  }

  /**
   * Check victory conditions
   */
  private checkVictoryCondition(): boolean {
    const player1Alive = this.state.units.filter(
      u => u.ownerId === 'player1' && u.status === 'alive'
    ).length;

    const player2Alive = this.state.units.filter(
      u => u.ownerId === 'player2' && u.status === 'alive'
    ).length;

    const victoryMet = player1Alive === 0 || player2Alive === 0;

    if (victoryMet) {
      console.log('[CombatEngine] checkVictoryCondition - Victory condition met:', {
        tick: this.state.tick,
        player1Alive,
        player2Alive
      });
    }

    return victoryMet;
  }

  /**
   * End combat and determine winner
   */
  private endCombat(reason: 'elimination' | 'timeout' = 'elimination'): void {
    this.stop();

    const player1Alive = this.state.units.filter(
      u => u.ownerId === 'player1' && u.status === 'alive'
    ).length;

    const player2Alive = this.state.units.filter(
      u => u.ownerId === 'player2' && u.status === 'alive'
    ).length;

    let winner: PlayerId | 'draw';
    if (player1Alive > player2Alive) {
      winner = 'player1';
    } else if (player2Alive > player1Alive) {
      winner = 'player2';
    } else {
      winner = 'draw';
    }

    // On timeout, defender (player2) wins
    if (reason === 'timeout' && winner === 'draw') {
      winner = 'player2';
    }

    console.log('[CombatEngine] endCombat - Combat ending:', {
      matchId: this.state.matchId,
      reason,
      winner,
      tick: this.state.tick,
      player1Alive,
      player2Alive,
      totalUnits: this.state.units.length
    });

    this.state.endTime = Date.now();

    const result: CombatResult = {
      matchId: this.state.matchId,
      winner,
      reason,
      duration: this.state.tick,
      finalState: this.state,
      statistics: this.state.statistics,
      eventLog: this.state.events
    };

    if (this.onComplete) {
      this.onComplete(result);
    }
  }

  /**
   * Add combat event
   */
  private addEvent(eventType: CombatEvent['eventType'], data: Record<string, any>): void {
    this.state.events.push({
      tick: this.state.tick,
      eventType,
      data
    });
  }

  /**
   * Get unit by ID
   */
  private getUnit(unitId: string): CombatCreature | null {
    return this.state.units.find(u => u.unitId === unitId) ?? null;
  }

  /**
   * Check if target is dead
   */
  private isTargetDead(targetId: string): boolean {
    const target = this.getUnit(targetId);
    return !target || target.status === 'dead';
  }

  /**
   * Create a combat creature from deployment data
   */
  private createCombatCreature(
    creatureId: string,
    ownerId: PlayerId,
    position: AxialCoordinate
  ): CombatCreature {
    // For MVP: Use hardcoded stats based on archetype
    // In production, these would come from creature database
    const stats = this.getDefaultStats();

    return {
      unitId: `${ownerId}_${creatureId}_${Date.now()}`,
      creatureId,
      ownerId,
      position,
      health: stats.maxHealth,
      maxHealth: stats.maxHealth,
      status: 'alive',
      facingDirection: 0,
      attackCooldownRemaining: 0,
      stats: {
        movementSpeed: stats.movementSpeed,
        attackRange: stats.attackRange,
        attackDamage: stats.attackDamage,
        armor: stats.armor,
        attackSpeed: stats.attackSpeed,
        damageType: 'physical',
        archetype: 'melee_dps'
      },
      activeBuffs: [],
      activeDebuffs: [],
      abilities: []
    };
  }

  /**
   * Get default creature stats (MVP)
   */
  private getDefaultStats() {
    return {
      maxHealth: 200,
      movementSpeed: 2, // hexes per second
      attackRange: 1, // hexes
      attackDamage: 30,
      armor: 10,
      attackSpeed: 1 // attacks per second
    };
  }

  /**
   * Create empty state
   */
  private createEmptyState(): CombatState {
    return {
      matchId: '',
      tick: 0,
      status: 'initializing',
      units: [],
      projectiles: [],
      events: [],
      statistics: {
        totalDamageDealt: { player1: 0, player2: 0 },
        totalHealingDone: { player1: 0, player2: 0 },
        unitsLost: { player1: 0, player2: 0 },
        abilitiesUsed: { player1: 0, player2: 0 },
        duration: 0
      },
      startTime: 0
    };
  }
}
