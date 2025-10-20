/**
 * Deployment State Types
 *
 * Types for managing creature placement on the deployment grid.
 */
/**
 * Deployment zone definitions (standard configuration)
 */
export const DEPLOYMENT_ZONES = [
    {
        playerId: 'player1',
        minColumn: 0,
        maxColumn: 2,
        color: 0x3498db // Blue
    },
    {
        playerId: 'player2',
        minColumn: 9,
        maxColumn: 11,
        color: 0xe74c3c // Red
    }
];
/**
 * Maximum creatures per player
 */
export const MAX_CREATURES_PER_PLAYER = 8;
//# sourceMappingURL=deployment.js.map