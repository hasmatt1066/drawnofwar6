/**
 * Configuration for Quota Tracker
 */
export interface QuotaTrackerConfig {
  /** Maximum quota limit in credits (optional) */
  quotaLimit?: number;

  /** Warning threshold as percentage (0-1, default: 0.9 = 90%) */
  warningThreshold?: number;

  /** Callback when warning threshold is reached */
  onWarning?: (message: string) => void;
}

/**
 * Usage summary statistics
 */
export interface QuotaUsageSummary {
  /** Total credits used */
  creditsUsed: number;

  /** Total number of requests */
  requestCount: number;

  /** Average credits per request */
  averagePerRequest: number;

  /** Quota limit (if set) */
  quotaLimit?: number;

  /** Remaining quota (if limit set) */
  remainingQuota?: number;

  /** Percentage of quota used (if limit set) */
  percentageUsed?: number;
}

/**
 * Quota Tracker for PixelLab API Client
 *
 * Tracks cumulative credit usage across requests with:
 * - Credit accumulation tracking
 * - Optional quota limit enforcement
 * - Warning emission at configurable threshold (default 90%)
 * - Usage statistics (request count, averages)
 * - Reset capability for periodic tracking
 *
 * @example
 * ```typescript
 * const tracker = new QuotaTracker({
 *   quotaLimit: 1000,
 *   warningThreshold: 0.9,
 *   onWarning: (msg) => console.warn(msg)
 * });
 *
 * tracker.trackUsage(25);
 * console.log(tracker.getCreditsUsed()); // 25
 * console.log(tracker.getRemainingQuota()); // 975
 * ```
 */
export class QuotaTracker {
  private creditsUsed: number = 0;
  private requestCount: number = 0;
  private warningEmitted: boolean = false;

  private readonly quotaLimit?: number;
  private readonly warningThreshold: number;
  private readonly onWarning?: (message: string) => void;

  constructor(config: QuotaTrackerConfig = {}) {
    // Validate configuration
    if (config.quotaLimit !== undefined && config.quotaLimit <= 0) {
      throw new Error('Quota limit must be positive');
    }

    if (config.warningThreshold !== undefined) {
      if (config.warningThreshold < 0 || config.warningThreshold > 1) {
        throw new Error('Warning threshold must be between 0 and 1');
      }
    }

    if (config.quotaLimit !== undefined) {
      this.quotaLimit = config.quotaLimit;
    }
    this.warningThreshold = config.warningThreshold ?? 0.9; // Default 90%
    if (config.onWarning !== undefined) {
      this.onWarning = config.onWarning;
    }
  }

  /**
   * Track credit usage for a request
   * Ignores zero or negative values
   *
   * @param credits - Number of credits used
   */
  public trackUsage(credits: number): void {
    // Ignore invalid values
    if (credits <= 0) {
      return;
    }

    this.creditsUsed += credits;
    this.requestCount++;

    // Check if warning threshold reached
    this.checkWarningThreshold();
  }

  /**
   * Get total credits used
   */
  public getCreditsUsed(): number {
    return this.creditsUsed;
  }

  /**
   * Get remaining quota (if limit is set)
   * Returns undefined if no quota limit
   */
  public getRemainingQuota(): number | undefined {
    if (this.quotaLimit === undefined) {
      return undefined;
    }

    return this.quotaLimit - this.creditsUsed;
  }

  /**
   * Check if quota has been exceeded
   * Returns false if no quota limit set
   */
  public isQuotaExceeded(): boolean {
    if (this.quotaLimit === undefined) {
      return false;
    }

    return this.creditsUsed > this.quotaLimit;
  }

  /**
   * Get total number of requests tracked
   */
  public getRequestCount(): number {
    return this.requestCount;
  }

  /**
   * Get average credits per request
   * Returns 0 if no requests tracked
   */
  public getAverageCreditsPerRequest(): number {
    if (this.requestCount === 0) {
      return 0;
    }

    return this.creditsUsed / this.requestCount;
  }

  /**
   * Get comprehensive usage summary
   */
  public getUsageSummary(): QuotaUsageSummary {
    const summary: QuotaUsageSummary = {
      creditsUsed: this.creditsUsed,
      requestCount: this.requestCount,
      averagePerRequest: this.getAverageCreditsPerRequest(),
    };

    if (this.quotaLimit !== undefined) {
      summary.quotaLimit = this.quotaLimit;
      const remaining = this.getRemainingQuota();
      if (remaining !== undefined) {
        summary.remainingQuota = remaining;
      }
      summary.percentageUsed = (this.creditsUsed / this.quotaLimit) * 100;
    }

    return summary;
  }

  /**
   * Reset tracker to zero
   * Clears credits used, request count, and warning flag
   */
  public reset(): void {
    this.creditsUsed = 0;
    this.requestCount = 0;
    this.warningEmitted = false;
  }

  /**
   * Check if warning threshold has been reached
   * Emits warning once when threshold crossed
   */
  private checkWarningThreshold(): void {
    // Only check if we have a quota limit and callback
    if (this.quotaLimit === undefined || !this.onWarning) {
      return;
    }

    // Already emitted warning
    if (this.warningEmitted) {
      return;
    }

    // Calculate percentage used
    const percentageUsed = this.creditsUsed / this.quotaLimit;

    if (percentageUsed >= this.warningThreshold) {
      const percentage = Math.round(this.warningThreshold * 100);
      const message = `Quota warning: ${percentage}% of quota limit reached (${this.creditsUsed}/${this.quotaLimit} credits used)`;

      this.onWarning(message);
      this.warningEmitted = true;
    }
  }
}
