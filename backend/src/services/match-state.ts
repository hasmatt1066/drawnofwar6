/**
 * Match State Service
 *
 * Manages match state including phases, deployment status, and ready/lock mechanisms.
 * In-memory storage for MVP (will be migrated to database/Redis later).
 */

import type {
  MatchState,
  MatchDeploymentStatus,
  PlayerReadyState,
  MatchPhase,
  CreaturePlacement
} from '@drawn-of-war/shared';

/**
 * Match data stored in memory
 */
interface MatchData {
  matchId: string;
  phase: MatchPhase;
  roundNumber: number;
  phaseStartedAt: Date;
  deploymentStatus: MatchDeploymentStatus;
  player1Placements: CreaturePlacement[];
  player2Placements: CreaturePlacement[];
}

/**
 * In-memory storage for active matches
 */
const activeMatches = new Map<string, MatchData>();

/**
 * Countdown timer duration in seconds
 */
const COUNTDOWN_DURATION = 30;

/**
 * Active countdown timers
 */
const countdownTimers = new Map<string, NodeJS.Timeout>();

/**
 * Create a new match in deployment phase
 */
export function createMatch(matchId: string, roundNumber: number = 1): MatchState {
  const now = new Date();

  const matchData: MatchData = {
    matchId,
    phase: 'deployment',
    roundNumber,
    phaseStartedAt: now,
    deploymentStatus: {
      matchId,
      player1: {
        playerId: 'player1',
        isReady: false,
        readyAt: null
      },
      player2: {
        playerId: 'player2',
        isReady: false,
        readyAt: null
      },
      countdownActive: false,
      countdownSeconds: null,
      isLocked: false,
      lockedAt: null
    },
    player1Placements: [],
    player2Placements: []
  };

  activeMatches.set(matchId, matchData);

  return {
    matchId,
    phase: 'deployment',
    roundNumber,
    phaseStartedAt: now,
    deploymentStatus: matchData.deploymentStatus
  };
}

/**
 * Get match state
 */
export function getMatchState(matchId: string): MatchState | null {
  const match = activeMatches.get(matchId);
  if (!match) {
    return null;
  }

  return {
    matchId: match.matchId,
    phase: match.phase,
    roundNumber: match.roundNumber,
    phaseStartedAt: match.phaseStartedAt,
    deploymentStatus: match.deploymentStatus
  };
}

/**
 * Mark player as ready
 */
export function markPlayerReady(
  matchId: string,
  playerId: 'player1' | 'player2'
): MatchDeploymentStatus | null {
  const match = activeMatches.get(matchId);
  if (!match) {
    return null;
  }

  // Can't ready if deployment is already locked
  if (match.deploymentStatus.isLocked) {
    return match.deploymentStatus;
  }

  const now = new Date();

  // Mark player as ready
  match.deploymentStatus[playerId] = {
    playerId,
    isReady: true,
    readyAt: now
  };

  // Check if both players are now ready
  const bothReady = match.deploymentStatus.player1.isReady && match.deploymentStatus.player2.isReady;

  if (bothReady) {
    // Both ready - immediately lock both players
    lockBothPlayers(matchId);
  } else {
    // Only one player ready - start countdown if not already active
    if (!match.deploymentStatus.countdownActive) {
      startCountdown(matchId);
    }
  }

  return match.deploymentStatus;
}

/**
 * Mark player as not ready (unready)
 */
export function markPlayerUnready(
  matchId: string,
  playerId: 'player1' | 'player2'
): MatchDeploymentStatus | null {
  const match = activeMatches.get(matchId);
  if (!match) {
    return null;
  }

  // Can't unready if deployment is already locked
  if (match.deploymentStatus.isLocked) {
    return match.deploymentStatus;
  }

  // Mark player as not ready
  match.deploymentStatus[playerId] = {
    playerId,
    isReady: false,
    readyAt: null
  };

  // If neither player is ready, cancel countdown
  const neitherReady = !match.deploymentStatus.player1.isReady && !match.deploymentStatus.player2.isReady;
  if (neitherReady) {
    cancelCountdown(matchId);
  }

  return match.deploymentStatus;
}

/**
 * Start countdown timer
 */
function startCountdown(matchId: string): void {
  const match = activeMatches.get(matchId);
  if (!match) {
    return;
  }

  // Cancel existing timer if any
  cancelCountdown(matchId);

  // Start countdown
  match.deploymentStatus.countdownActive = true;
  match.deploymentStatus.countdownSeconds = COUNTDOWN_DURATION;

  console.log(`[Match ${matchId}] Countdown started: ${COUNTDOWN_DURATION} seconds`);

  // Set interval to tick down countdown
  const timer = setInterval(() => {
    const currentMatch = activeMatches.get(matchId);
    if (!currentMatch || !currentMatch.deploymentStatus.countdownActive) {
      clearInterval(timer);
      countdownTimers.delete(matchId);
      return;
    }

    const seconds = currentMatch.deploymentStatus.countdownSeconds;
    if (seconds === null || seconds <= 0) {
      // Countdown expired - lock both players
      lockBothPlayers(matchId);
      clearInterval(timer);
      countdownTimers.delete(matchId);
    } else {
      // Tick down
      currentMatch.deploymentStatus.countdownSeconds = seconds - 1;

      if (seconds <= 5) {
        console.log(`[Match ${matchId}] Countdown: ${seconds - 1} seconds remaining`);
      }
    }
  }, 1000);

  countdownTimers.set(matchId, timer);
}

/**
 * Cancel countdown timer
 */
function cancelCountdown(matchId: string): void {
  const match = activeMatches.get(matchId);
  if (!match) {
    return;
  }

  const timer = countdownTimers.get(matchId);
  if (timer) {
    clearInterval(timer);
    countdownTimers.delete(matchId);
  }

  match.deploymentStatus.countdownActive = false;
  match.deploymentStatus.countdownSeconds = null;

  console.log(`[Match ${matchId}] Countdown cancelled`);
}

/**
 * Lock both players (finalize deployment)
 */
function lockBothPlayers(matchId: string): void {
  const match = activeMatches.get(matchId);
  if (!match) {
    return;
  }

  // Cancel countdown if active
  cancelCountdown(matchId);

  const now = new Date();

  // Mark deployment as locked
  match.deploymentStatus.isLocked = true;
  match.deploymentStatus.lockedAt = now;

  // Ensure both players are marked as ready
  match.deploymentStatus.player1.isReady = true;
  match.deploymentStatus.player2.isReady = true;

  console.log(`[Match ${matchId}] Both players locked - deployment complete`);

  // TODO: Transition to combat phase (next feature)
  // For now, just transition to 'countdown' phase to show deployment is locked
  match.phase = 'countdown';
}

/**
 * Get deployment status
 */
export function getDeploymentStatus(matchId: string): MatchDeploymentStatus | null {
  const match = activeMatches.get(matchId);
  if (!match) {
    return null;
  }

  return match.deploymentStatus;
}

/**
 * Store player placements (for validation before ready)
 */
export function storePlacement(
  matchId: string,
  playerId: 'player1' | 'player2',
  placements: CreaturePlacement[]
): boolean {
  const match = activeMatches.get(matchId);
  if (!match) {
    return false;
  }

  // Can't modify placements if locked
  if (match.deploymentStatus.isLocked) {
    return false;
  }

  if (playerId === 'player1') {
    match.player1Placements = placements;
  } else {
    match.player2Placements = placements;
  }

  return true;
}

/**
 * Get player placements
 */
export function getPlacements(
  matchId: string,
  playerId: 'player1' | 'player2'
): CreaturePlacement[] | null {
  const match = activeMatches.get(matchId);
  if (!match) {
    return null;
  }

  return playerId === 'player1' ? match.player1Placements : match.player2Placements;
}

/**
 * Delete match (cleanup)
 */
export function deleteMatch(matchId: string): boolean {
  // Cancel countdown timer if active
  const timer = countdownTimers.get(matchId);
  if (timer) {
    clearInterval(timer);
    countdownTimers.delete(matchId);
  }

  return activeMatches.delete(matchId);
}

/**
 * Get all active matches (for debugging)
 */
export function getAllMatches(): string[] {
  return Array.from(activeMatches.keys());
}
