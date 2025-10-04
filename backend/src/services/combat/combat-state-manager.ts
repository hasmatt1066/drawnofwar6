/**
 * Combat State Manager
 *
 * Manages active combat states and provides state snapshots.
 * Singleton service for tracking all active combats.
 */

import type { CombatState, CombatResult } from '../../../../shared/src/types/combat.js';
import type { DeploymentState } from '../../../../shared/src/types/deployment.js';
import { CombatEngine } from './combat-engine.js';

/**
 * Active combat instance
 */
interface ActiveCombat {
  matchId: string;
  engine: CombatEngine;
  startTime: number;
  lastUpdateTime: number;
}

/**
 * Combat State Manager (Singleton)
 */
class CombatStateManager {
  private static instance: CombatStateManager;
  private activeCombats: Map<string, ActiveCombat> = new Map();
  private combatResults: Map<string, CombatResult> = new Map();

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): CombatStateManager {
    if (!CombatStateManager.instance) {
      CombatStateManager.instance = new CombatStateManager();
    }
    return CombatStateManager.instance;
  }

  /**
   * Initialize and start combat for a match
   */
  public async startCombat(
    matchId: string,
    deployment: DeploymentState,
    onStateUpdate?: (state: CombatState) => void,
    onComplete?: (result: CombatResult) => void
  ): Promise<void> {
    // Check if combat already exists
    if (this.activeCombats.has(matchId)) {
      throw new Error(`Combat already running for match ${matchId}`);
    }

    // Create engine
    const engine = new CombatEngine();
    engine.initializeFromDeployment(matchId, deployment);

    // Store active combat
    const activeCombat: ActiveCombat = {
      matchId,
      engine,
      startTime: Date.now(),
      lastUpdateTime: Date.now()
    };

    this.activeCombats.set(matchId, activeCombat);

    // Wrap callbacks to update tracking
    const wrappedOnUpdate = onStateUpdate
      ? (state: CombatState) => {
          activeCombat.lastUpdateTime = Date.now();
          onStateUpdate(state);
        }
      : undefined;

    const wrappedOnComplete = (result: CombatResult) => {
      // Store result
      this.combatResults.set(matchId, result);

      // Remove from active combats
      this.activeCombats.delete(matchId);

      // Call user callback
      if (onComplete) {
        onComplete(result);
      }
    };

    // Start combat
    engine.start(wrappedOnUpdate, wrappedOnComplete);
  }

  /**
   * Stop combat for a match (forfeit)
   */
  public stopCombat(matchId: string): void {
    const combat = this.activeCombats.get(matchId);
    if (!combat) {
      throw new Error(`No active combat found for match ${matchId}`);
    }

    combat.engine.stop();
    this.activeCombats.delete(matchId);
  }

  /**
   * Pause combat for a match
   */
  public pauseCombat(matchId: string): void {
    const combat = this.activeCombats.get(matchId);
    if (!combat) {
      throw new Error(`No active combat found for match ${matchId}`);
    }

    combat.engine.pause();
  }

  /**
   * Get current state snapshot for a match
   */
  public getState(matchId: string): CombatState | null {
    const combat = this.activeCombats.get(matchId);
    if (!combat) {
      return null;
    }

    return combat.engine.getState();
  }

  /**
   * Get combat result for a completed match
   */
  public getResult(matchId: string): CombatResult | null {
    return this.combatResults.get(matchId) ?? null;
  }

  /**
   * Check if combat is active for a match
   */
  public isActive(matchId: string): boolean {
    return this.activeCombats.has(matchId);
  }

  /**
   * Get all active match IDs
   */
  public getActiveMatchIds(): string[] {
    return Array.from(this.activeCombats.keys());
  }

  /**
   * Get combat statistics
   */
  public getStatistics() {
    return {
      activeCombats: this.activeCombats.size,
      completedCombats: this.combatResults.size,
      matches: Array.from(this.activeCombats.entries()).map(([matchId, combat]) => ({
        matchId,
        startTime: combat.startTime,
        lastUpdate: combat.lastUpdateTime,
        duration: Date.now() - combat.startTime
      }))
    };
  }

  /**
   * Clear old results (cleanup)
   */
  public clearOldResults(_olderThanMs: number = 3600000): void {
    // Note: We don't have timestamps on results, so we'll just clear all results for now
    // In production, you'd want to add timestamps to CombatResult
    if (this.combatResults.size > 100) {
      // Keep only last 100 results
      const entries = Array.from(this.combatResults.entries());
      const toKeep = entries.slice(-100);
      this.combatResults.clear();
      toKeep.forEach(([k, v]) => this.combatResults.set(k, v));
    }
  }

  /**
   * Force cleanup of stale combats (emergency)
   */
  public cleanupStaleCombats(staleThresholdMs: number = 600000): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [matchId, combat] of this.activeCombats.entries()) {
      const duration = now - combat.lastUpdateTime;
      if (duration > staleThresholdMs) {
        console.warn(`[CombatStateManager] Cleaning up stale combat: ${matchId}`);
        combat.engine.stop();
        toDelete.push(matchId);
      }
    }

    toDelete.forEach(matchId => this.activeCombats.delete(matchId));
  }
}

// Export singleton instance
export const combatStateManager = CombatStateManager.getInstance();
