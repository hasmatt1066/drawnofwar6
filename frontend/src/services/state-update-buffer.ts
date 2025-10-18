/**
 * TASK-COMBAT-VIZ-004: StateUpdateBuffer Implementation
 *
 * Buffers combat state updates for smooth interpolation.
 * Handles 10 updates/sec from backend, provides data for 60 FPS rendering.
 */

import type { CombatState } from '@drawn-of-war/shared/types/combat';

/**
 * Buffer options
 */
export interface StateUpdateBufferOptions {
  /** Number of states to keep in buffer (default: 5) */
  bufferSize?: number;
  /** Buffering window in milliseconds (default: 100ms) */
  bufferWindowMs?: number;
}

/**
 * Buffer statistics
 */
export interface BufferStatistics {
  /** Total state updates received */
  totalUpdates: number;
  /** Number of dropped (out-of-order) updates */
  droppedUpdates: number;
  /** Average update interval in milliseconds */
  averageUpdateIntervalMs: number;
}

/**
 * Interpolation data
 */
export interface InterpolationData {
  current: CombatState | null;
  previous: CombatState | null;
  factor: number;
}

/**
 * State entry with timestamp
 */
interface StateEntry {
  state: CombatState;
  timestamp: number;
}

/**
 * StateUpdateBuffer
 *
 * Buffers combat state updates and provides interpolation support for smooth rendering.
 */
export class StateUpdateBuffer {
  private buffer: StateEntry[] = [];
  private maxBufferSize: number;
  private bufferWindowMs: number;

  // Statistics
  private totalUpdates: number = 0;
  private droppedUpdates: number = 0;
  private updateTimestamps: number[] = [];

  constructor(options: StateUpdateBufferOptions = {}) {
    this.maxBufferSize = options.bufferSize ?? 5;
    this.bufferWindowMs = options.bufferWindowMs ?? 100;
  }

  /**
   * Add new state to buffer
   */
  public addState(state: CombatState): void {
    this.totalUpdates++;

    const timestamp = state.startTime;
    const currentTick = this.getCurrentState()?.tick ?? -1;

    // Reject states with decreasing ticks (out-of-order)
    if (state.tick < currentTick) {
      this.droppedUpdates++;
      return;
    }

    // If same tick, replace the existing state
    if (state.tick === currentTick && this.buffer.length > 0) {
      this.buffer[this.buffer.length - 1] = { state, timestamp };
      return;
    }

    // Add new state
    this.buffer.push({ state, timestamp });

    // Track update timestamps for statistics
    this.updateTimestamps.push(timestamp);
    if (this.updateTimestamps.length > 10) {
      this.updateTimestamps.shift();
    }

    // Sort by tick to maintain chronological order
    this.buffer.sort((a, b) => a.state.tick - b.state.tick);

    // Trim buffer to max size
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }
  }

  /**
   * Get current (most recent) state
   */
  public getCurrentState(): CombatState | null {
    if (this.buffer.length === 0) {
      return null;
    }
    return this.buffer[this.buffer.length - 1].state;
  }

  /**
   * Get previous state (one step back)
   */
  public getPreviousState(): CombatState | null {
    if (this.buffer.length < 2) {
      return null;
    }
    return this.buffer[this.buffer.length - 2].state;
  }

  /**
   * Get state at specific offset from current
   * @param offset - Steps back from current (0 = current, 1 = previous, etc.)
   */
  public getStateAtOffset(offset: number): CombatState | null {
    const index = this.buffer.length - 1 - offset;
    if (index < 0 || index >= this.buffer.length) {
      return null;
    }
    return this.buffer[index].state;
  }

  /**
   * Get current buffer size
   */
  public getBufferSize(): number {
    return this.buffer.length;
  }

  /**
   * Get buffer window in milliseconds
   */
  public getBufferWindowMs(): number {
    return this.bufferWindowMs;
  }

  /**
   * Calculate interpolation factor between previous and current state
   * @param timestamp - Current time in milliseconds
   * @returns Interpolation factor [0, 1]
   */
  public getInterpolationFactor(timestamp: number): number {
    if (this.buffer.length < 2) {
      return 0;
    }

    const current = this.buffer[this.buffer.length - 1];
    const previous = this.buffer[this.buffer.length - 2];

    const timeDelta = current.timestamp - previous.timestamp;
    if (timeDelta === 0) {
      return 0; // No interpolation possible with identical timestamps
    }

    const elapsed = timestamp - previous.timestamp;
    const factor = elapsed / timeDelta;

    // Clamp to [0, 1]
    return Math.max(0, Math.min(1, factor));
  }

  /**
   * Get interpolation data (states + factor)
   * @param timestamp - Current time in milliseconds
   */
  public getInterpolationData(timestamp: number): InterpolationData {
    return {
      current: this.getCurrentState(),
      previous: this.getPreviousState(),
      factor: this.getInterpolationFactor(timestamp)
    };
  }

  /**
   * Get buffered render time (applies buffering delay)
   * @param currentTime - Current time in milliseconds
   * @returns Render time with buffering applied
   */
  public getBufferedRenderTime(currentTime: number): number {
    return currentTime - this.bufferWindowMs;
  }

  /**
   * Clear all buffered states
   */
  public clear(): void {
    this.buffer = [];
  }

  /**
   * Get buffer statistics
   */
  public getStatistics(): BufferStatistics {
    let averageInterval = 0;

    if (this.updateTimestamps.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < this.updateTimestamps.length; i++) {
        intervals.push(this.updateTimestamps[i] - this.updateTimestamps[i - 1]);
      }
      const sum = intervals.reduce((acc, val) => acc + val, 0);
      averageInterval = sum / intervals.length;
    }

    return {
      totalUpdates: this.totalUpdates,
      droppedUpdates: this.droppedUpdates,
      averageUpdateIntervalMs: averageInterval
    };
  }
}
