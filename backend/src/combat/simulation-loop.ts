/**
 * SimulationLoop - Fixed Timestep Simulation Loop
 *
 * Implements L4-COMBAT-001: Runs combat simulation at stable 60 ticks/second
 * with support for pause/resume and speed multipliers.
 *
 * Key Features:
 * - Fixed timestep (immune to processing delays)
 * - Pause/resume functionality
 * - Speed multiplier (0.5x, 1x, 2x)
 * - Graceful cleanup
 */

export class SimulationLoop {
  private tickRate: number = 60; // ticks per second
  private tickDuration: number = 1000 / 60; // ~16.67ms
  private currentTick: number = 0;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private speedMultiplier: number = 1.0;
  private intervalId: NodeJS.Timeout | null = null;
  private onTickCallback: ((tick: number) => void) | null = null;

  /**
   * Start the simulation loop
   * @param onTick - Callback executed each tick with tick number
   */
  async start(onTick: (tick: number) => void): Promise<void> {
    // Prevent multiple loops
    if (this.isRunning) {
      return;
    }

    this.onTickCallback = onTick;
    this.isRunning = true;
    this.isPaused = false;
    this.currentTick = 0;

    // Start the fixed timestep loop
    this.runLoop();
  }

  /**
   * Stop the simulation loop completely
   */
  stop(): void {
    this.isRunning = false;
    this.isPaused = false;

    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.onTickCallback = null;
    this.currentTick = 0;
  }

  /**
   * Pause the simulation (preserves tick count)
   */
  pause(): void {
    this.isPaused = true;
  }

  /**
   * Resume the simulation from pause
   */
  resume(): void {
    this.isPaused = false;
  }

  /**
   * Set simulation speed multiplier
   * @param multiplier - Speed multiplier (0.5x, 1x, 2x, etc.)
   */
  setSpeed(multiplier: number): void {
    this.speedMultiplier = multiplier;

    // If already running, restart loop with new speed
    if (this.isRunning && this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.runLoop();
    }
  }

  /**
   * Main simulation loop implementation
   * Uses setInterval for fixed timestep
   */
  private runLoop(): void {
    // Calculate actual tick duration with speed multiplier
    const actualTickDuration = this.tickDuration / this.speedMultiplier;

    this.intervalId = setInterval(() => {
      if (!this.isRunning) {
        if (this.intervalId !== null) {
          clearInterval(this.intervalId);
          this.intervalId = null;
        }
        return;
      }

      // Skip tick if paused
      if (this.isPaused) {
        return;
      }

      // Execute tick callback
      if (this.onTickCallback) {
        this.onTickCallback(this.currentTick);
      }

      // Increment tick counter
      this.currentTick++;
    }, actualTickDuration);
  }

  /**
   * Get current tick number
   */
  get tick(): number {
    return this.currentTick;
  }

  /**
   * Check if loop is running
   */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Check if loop is paused
   */
  get paused(): boolean {
    return this.isPaused;
  }
}
