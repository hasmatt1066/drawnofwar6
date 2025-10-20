/**
 * Deployment State Types
 *
 * Types for managing creature placement on the deployment grid.
 */
import type { AxialCoordinate, HexDirection } from '../utils/hex-math/types.js';
/**
 * Directional sprite data for a single direction
 */
export interface DirectionalSprite {
    /** Static sprite image (base64) */
    sprite: string;
    /** Walk animation frames (base64 array) */
    walkFrames: string[];
    /** Idle animation frames (base64 array) - optional for backward compatibility */
    idleFrames?: string[];
}
/**
 * Battlefield directional views
 * Uses 3 generated directions + 3 mirrored directions for cost efficiency
 */
export interface BattlefieldDirectionalViews {
    E: DirectionalSprite;
    NE: DirectionalSprite;
    SE: DirectionalSprite;
}
/**
 * Creature data for deployment
 */
export interface DeploymentCreature {
    /** Unique creature ID */
    id: string;
    /** Creature display name */
    name: string;
    /** Sprite URL or identifier (base64 data URL or HTTP URL) */
    sprite: string;
    /** Player ID who owns this creature */
    playerId: 'player1' | 'player2';
    /** Optional creature stats for display */
    stats?: {
        health?: number;
        attack?: number;
        defense?: number;
    };
    /** Sprite loading state (managed by frontend) */
    spriteLoading?: boolean;
    /** Sprite load error (managed by frontend) */
    spriteError?: string;
    /** Multi-directional battlefield views (NEW) */
    battlefieldDirectionalViews?: BattlefieldDirectionalViews;
    /** Current facing direction (defaults to E if not set) */
    facing?: HexDirection;
}
/**
 * Placement of a creature on the grid
 */
export interface CreaturePlacement {
    /** Creature being placed */
    creature: DeploymentCreature;
    /** Hex coordinate where creature is placed */
    hex: AxialCoordinate;
}
/**
 * Deployment state for a single player
 */
export interface PlayerDeploymentState {
    /** Player identifier */
    playerId: 'player1' | 'player2';
    /** List of creatures available for deployment */
    roster: DeploymentCreature[];
    /** Current placements on the grid */
    placements: CreaturePlacement[];
    /** Maximum number of creatures allowed */
    maxCreatures: number;
    /** Whether deployment is locked (after Ready) */
    isLocked: boolean;
    /** Whether player has marked themselves as ready */
    isReady: boolean;
    /** Timestamp when player marked ready (null if not ready) */
    readyAt: Date | null;
}
/**
 * Complete deployment state for both players
 */
export interface DeploymentState {
    /** Player 1 deployment state */
    player1: PlayerDeploymentState;
    /** Player 2 deployment state */
    player2: PlayerDeploymentState;
    /** Current player making deployment */
    currentPlayer: 'player1' | 'player2';
    /** Countdown timer in seconds (null if not started) */
    countdownSeconds: number | null;
    /** Timestamp when countdown started (null if not started) */
    countdownStartedAt: Date | null;
    /** Whether both players are locked and deployment phase is complete */
    isComplete: boolean;
}
/**
 * Validation result for placement
 */
export interface PlacementValidation {
    /** Whether placement is valid */
    valid: boolean;
    /** Reason for invalid placement */
    reason?: 'occupied' | 'out_of_zone' | 'out_of_bounds' | 'locked' | 'max_creatures';
    /** Human-readable error message */
    message?: string;
}
/**
 * Deployment zone configuration
 */
export interface DeploymentZoneConfig {
    /** Player who owns this zone */
    playerId: 'player1' | 'player2';
    /** Minimum column (inclusive) */
    minColumn: number;
    /** Maximum column (inclusive) */
    maxColumn: number;
    /** Display color for zone */
    color: number;
}
/**
 * Drag state for creature being dragged
 */
export interface DragState {
    /** Creature being dragged */
    creature: DeploymentCreature | null;
    /** Source hex if repositioning from grid */
    sourceHex: AxialCoordinate | null;
    /** Current drag phase */
    phase: 'idle' | 'dragging' | 'dropping';
    /** Target hex being hovered over */
    targetHex: AxialCoordinate | null;
    /** Whether current target is valid for drop */
    isValid: boolean;
}
/**
 * Deployment zone definitions (standard configuration)
 */
export declare const DEPLOYMENT_ZONES: DeploymentZoneConfig[];
/**
 * Maximum creatures per player
 */
export declare const MAX_CREATURES_PER_PLAYER = 8;
/**
 * Ready state for a player in a match
 */
export interface PlayerReadyState {
    /** Player identifier */
    playerId: 'player1' | 'player2';
    /** Whether player is ready */
    isReady: boolean;
    /** Timestamp when ready (null if not ready) */
    readyAt: Date | null;
}
/**
 * Match deployment status (both players)
 */
export interface MatchDeploymentStatus {
    /** Match identifier */
    matchId: string;
    /** Player 1 ready state */
    player1: PlayerReadyState;
    /** Player 2 ready state */
    player2: PlayerReadyState;
    /** Whether countdown has started */
    countdownActive: boolean;
    /** Countdown seconds remaining (null if not active) */
    countdownSeconds: number | null;
    /** Whether both players are locked */
    isLocked: boolean;
    /** Timestamp when both players locked (null if not locked) */
    lockedAt: Date | null;
}
/**
 * Match phase types
 */
export type MatchPhase = 'deployment' | 'countdown' | 'combat' | 'transition' | 'complete';
/**
 * Match state tracking
 */
export interface MatchState {
    /** Match identifier */
    matchId: string;
    /** Current match phase */
    phase: MatchPhase;
    /** Current round number (1-indexed) */
    roundNumber: number;
    /** Phase started timestamp */
    phaseStartedAt: Date;
    /** Deployment status (only during deployment/countdown phases) */
    deploymentStatus?: MatchDeploymentStatus;
}
//# sourceMappingURL=deployment.d.ts.map