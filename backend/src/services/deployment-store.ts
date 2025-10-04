/**
 * Deployment Store Service
 *
 * In-memory storage for active deployments during match setup.
 * Stores deployment state by matchId + playerId.
 *
 * NOTE: This is temporary in-memory storage. In production, this will be
 * replaced with Redis or database persistence.
 */

import type { PlayerDeploymentState } from '@drawn-of-war/shared/types/deployment';

/**
 * Stored deployment entry
 */
interface DeploymentEntry {
  deployment: PlayerDeploymentState;
  createdAt: Date;
  updatedAt: Date;
  isLocked: boolean;
  lockedAt: Date | null;
}

/**
 * Deployment Store
 *
 * Thread-safe in-memory storage for active deployments.
 * Uses composite key: `matchId:playerId` for fast lookups.
 */
export class DeploymentStore {
  private deployments: Map<string, DeploymentEntry>;

  constructor() {
    this.deployments = new Map();
  }

  /**
   * Generate storage key from matchId and playerId
   */
  private getKey(matchId: string, playerId: 'player1' | 'player2'): string {
    return `${matchId}:${playerId}`;
  }

  /**
   * Store or update deployment
   *
   * @param matchId - Match identifier
   * @param deployment - Player's deployment state
   * @returns True if successful
   */
  setDeployment(matchId: string, deployment: PlayerDeploymentState): boolean {
    const key = this.getKey(matchId, deployment.playerId);
    const existing = this.deployments.get(key);

    // Don't allow updates to locked deployments
    if (existing?.isLocked) {
      return false;
    }

    const entry: DeploymentEntry = {
      deployment,
      createdAt: existing?.createdAt || new Date(),
      updatedAt: new Date(),
      isLocked: deployment.isLocked,
      lockedAt: deployment.isLocked ? new Date() : null
    };

    this.deployments.set(key, entry);
    return true;
  }

  /**
   * Get deployment for a player
   *
   * @param matchId - Match identifier
   * @param playerId - Player identifier
   * @returns Deployment state or null if not found
   */
  getDeployment(
    matchId: string,
    playerId: 'player1' | 'player2'
  ): PlayerDeploymentState | null {
    const key = this.getKey(matchId, playerId);
    const entry = this.deployments.get(key);
    return entry?.deployment || null;
  }

  /**
   * Get deployment entry with metadata
   *
   * @param matchId - Match identifier
   * @param playerId - Player identifier
   * @returns Full deployment entry or null
   */
  getDeploymentEntry(
    matchId: string,
    playerId: 'player1' | 'player2'
  ): DeploymentEntry | null {
    const key = this.getKey(matchId, playerId);
    return this.deployments.get(key) || null;
  }

  /**
   * Lock a deployment (prevent further modifications)
   *
   * @param matchId - Match identifier
   * @param playerId - Player identifier
   * @returns True if locked successfully, false if not found or already locked
   */
  lockDeployment(matchId: string, playerId: 'player1' | 'player2'): boolean {
    const key = this.getKey(matchId, playerId);
    const entry = this.deployments.get(key);

    if (!entry) {
      return false;
    }

    if (entry.isLocked) {
      return false; // Already locked
    }

    entry.isLocked = true;
    entry.lockedAt = new Date();
    entry.deployment.isLocked = true;
    entry.updatedAt = new Date();

    return true;
  }

  /**
   * Check if deployment is locked
   *
   * @param matchId - Match identifier
   * @param playerId - Player identifier
   * @returns True if locked, false otherwise
   */
  isLocked(matchId: string, playerId: 'player1' | 'player2'): boolean {
    const key = this.getKey(matchId, playerId);
    const entry = this.deployments.get(key);
    return entry?.isLocked || false;
  }

  /**
   * Delete deployment
   *
   * @param matchId - Match identifier
   * @param playerId - Player identifier
   * @returns True if deleted, false if not found or locked
   */
  deleteDeployment(matchId: string, playerId: 'player1' | 'player2'): boolean {
    const key = this.getKey(matchId, playerId);
    const entry = this.deployments.get(key);

    // Don't allow deletion of locked deployments
    if (entry?.isLocked) {
      return false;
    }

    return this.deployments.delete(key);
  }

  /**
   * Get both players' deployments for a match
   *
   * @param matchId - Match identifier
   * @returns Object with player1 and player2 deployments (null if not found)
   */
  getMatchDeployments(matchId: string): {
    player1: PlayerDeploymentState | null;
    player2: PlayerDeploymentState | null;
  } {
    return {
      player1: this.getDeployment(matchId, 'player1'),
      player2: this.getDeployment(matchId, 'player2')
    };
  }

  /**
   * Check if both players have locked deployments
   *
   * @param matchId - Match identifier
   * @returns True if both locked
   */
  areBothPlayersLocked(matchId: string): boolean {
    const player1Locked = this.isLocked(matchId, 'player1');
    const player2Locked = this.isLocked(matchId, 'player2');
    return player1Locked && player2Locked;
  }

  /**
   * Clear all deployments for a match (both players)
   *
   * @param matchId - Match identifier
   * @returns Number of deployments cleared
   */
  clearMatch(matchId: string): number {
    let cleared = 0;

    if (this.deployments.delete(this.getKey(matchId, 'player1'))) {
      cleared++;
    }
    if (this.deployments.delete(this.getKey(matchId, 'player2'))) {
      cleared++;
    }

    return cleared;
  }

  /**
   * Get all active matches (for admin/monitoring)
   *
   * @returns Array of unique match IDs
   */
  getActiveMatches(): string[] {
    const matchIds = new Set<string>();

    for (const key of this.deployments.keys()) {
      const matchId = key.split(':')[0];
      if (matchId) {
        matchIds.add(matchId);
      }
    }

    return Array.from(matchIds);
  }

  /**
   * Get storage statistics (for monitoring)
   */
  getStats(): {
    totalDeployments: number;
    lockedDeployments: number;
    activeMatches: number;
  } {
    let lockedCount = 0;

    for (const entry of this.deployments.values()) {
      if (entry.isLocked) {
        lockedCount++;
      }
    }

    return {
      totalDeployments: this.deployments.size,
      lockedDeployments: lockedCount,
      activeMatches: this.getActiveMatches().length
    };
  }

  /**
   * Clear all deployments (for testing)
   */
  clearAll(): void {
    this.deployments.clear();
  }
}

/**
 * Singleton instance for reuse across requests
 */
export const deploymentStore = new DeploymentStore();
