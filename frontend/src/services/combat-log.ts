/**
 * TASK-COMBAT-VIZ-014: Combat Log Implementation
 *
 * Text-based combat log displaying events in a scrollable format.
 * Supports filtering, timestamps, and color-coded event types.
 */

/**
 * Combat event type enumeration
 */
export enum CombatEventType {
  ATTACK = 'attack',
  DAMAGE = 'damage',
  HEAL = 'heal',
  DEATH = 'death',
  ABILITY = 'ability',
  STATUS = 'status'
}

/**
 * Combat log entry
 */
export interface CombatLogEntry {
  id: string;
  type: CombatEventType;
  message: string;
  timestamp: number;
}

/**
 * Combat log configuration
 */
export interface CombatLogConfig {
  maxEntries?: number;
  showTimestamps?: boolean;
}

/**
 * Input for adding log entries
 */
export interface CombatLogEntryInput {
  type: CombatEventType;
  message: string;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<CombatLogConfig> = {
  maxEntries: 100,
  showTimestamps: false
};

/**
 * Color mapping for event types
 */
const EVENT_COLORS: Record<CombatEventType, string> = {
  [CombatEventType.ATTACK]: '#ff4444',    // Red
  [CombatEventType.DAMAGE]: '#ff8844',    // Orange
  [CombatEventType.HEAL]: '#44ff44',      // Green
  [CombatEventType.DEATH]: '#aa0000',     // Dark red
  [CombatEventType.ABILITY]: '#44aaff',   // Blue
  [CombatEventType.STATUS]: '#ffaa44'     // Yellow-orange
};

/**
 * CombatLog
 *
 * Service for managing combat event log entries.
 * Maintains a scrollable history of combat events with filtering and formatting.
 */
export class CombatLog {
  private config: Required<CombatLogConfig>;
  private entries: CombatLogEntry[];
  private nextId: number;

  constructor(config: CombatLogConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.entries = [];
    this.nextId = 0;
  }

  /**
   * Get current configuration
   */
  public getConfig(): Required<CombatLogConfig> {
    return { ...this.config };
  }

  /**
   * Add a new log entry
   */
  public addEntry(input: CombatLogEntryInput): CombatLogEntry {
    const entry: CombatLogEntry = {
      id: `log-${this.nextId++}`,
      type: input.type,
      message: input.message,
      timestamp: Date.now()
    };

    // Add to beginning (newest first)
    this.entries.unshift(entry);

    // Enforce max entries limit
    if (this.entries.length > this.config.maxEntries) {
      this.entries = this.entries.slice(0, this.config.maxEntries);
    }

    return entry;
  }

  /**
   * Get all entries or filter by event type
   */
  public getEntries(filterType?: CombatEventType): CombatLogEntry[] {
    if (filterType === undefined) {
      return [...this.entries];
    }

    return this.entries.filter(entry => entry.type === filterType);
  }

  /**
   * Clear all log entries
   */
  public clear(): void {
    this.entries = [];
  }

  /**
   * Format a log entry as text
   */
  public formatEntry(entry: CombatLogEntry): string {
    if (this.config.showTimestamps) {
      const timestamp = this.formatTimestamp(entry.timestamp);
      return `[${timestamp}] ${entry.message}`;
    }

    return entry.message;
  }

  /**
   * Format timestamp as HH:MM:SS
   */
  private formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${hours}:${minutes}:${seconds}`;
  }

  /**
   * Get color for an event type
   */
  public getEventColor(type: CombatEventType): string {
    return EVENT_COLORS[type];
  }
}
