/**
 * Combat State Types
 *
 * Types for managing combat simulation, creature instances, actions, and events.
 * Used by the authoritative server combat engine (60 tps).
 */
/**
 * Default combat configuration
 */
export const DEFAULT_COMBAT_CONFIG = {
    tickRate: 60,
    maxTicks: 18000, // 5 minutes
    broadcastRate: 10 // 10 updates per second
};
//# sourceMappingURL=combat.js.map