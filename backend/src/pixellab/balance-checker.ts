import { HttpClient } from './http-client';
import { QuotaTracker } from './quota-tracker';

/**
 * Configuration for Balance Checker
 */
export interface BalanceCheckerConfig {
  /** Cache balance for this duration in ms (default: 60000 = 1 minute) */
  cacheDuration?: number;

  /** Warn when balance drops below this threshold */
  lowBalanceThreshold?: number;

  /** Callback when balance is low */
  onLowBalance?: (balance: number, threshold: number) => void;

  /** Optional quota tracker to integrate with */
  quotaTracker?: QuotaTracker;
}

/**
 * Balance comparison with quota usage
 */
export interface BalanceComparison {
  /** Current API balance */
  currentBalance: number;

  /** Credits used in current session */
  creditsUsed: number;

  /** Projected balance after session usage */
  projectedBalance: number;
}

/**
 * Balance Checker for PixelLab API Client
 *
 * Checks API balance before operations with:
 * - Balance querying from API
 * - Response caching (default 1 minute)
 * - Low balance warnings
 * - Quota tracker integration
 * - Last check time tracking
 *
 * @example
 * ```typescript
 * const checker = new BalanceChecker(httpClient, {
 *   lowBalanceThreshold: 100,
 *   cacheDuration: 60000,
 *   onLowBalance: (balance, threshold) => {
 *     console.warn(`Low balance: ${balance} < ${threshold}`);
 *   },
 * });
 *
 * const balance = await checker.checkBalance();
 * console.log(`Current balance: ${balance} credits`);
 * ```
 */
export class BalanceChecker {
  private httpClient: HttpClient;
  private cachedBalance?: number;
  private cacheExpiry?: Date;
  private lastCheckTime?: Date;
  private lowBalanceWarned: boolean = false;

  private readonly cacheDuration: number;
  private readonly lowBalanceThreshold?: number;
  private readonly onLowBalance?: (balance: number, threshold: number) => void;
  private readonly quotaTracker?: QuotaTracker;

  constructor(httpClient: HttpClient, config: BalanceCheckerConfig = {}) {
    // Validate configuration
    if (config.cacheDuration !== undefined && config.cacheDuration < 0) {
      throw new Error('Cache duration must be non-negative');
    }

    if (config.lowBalanceThreshold !== undefined && config.lowBalanceThreshold <= 0) {
      throw new Error('Low balance threshold must be positive');
    }

    this.httpClient = httpClient;
    this.cacheDuration = config.cacheDuration ?? 60000; // Default 1 minute
    if (config.lowBalanceThreshold !== undefined) {
      this.lowBalanceThreshold = config.lowBalanceThreshold;
    }
    if (config.onLowBalance !== undefined) {
      this.onLowBalance = config.onLowBalance;
    }
    if (config.quotaTracker !== undefined) {
      this.quotaTracker = config.quotaTracker;
    }
  }

  /**
   * Check API balance
   * Uses cached value if available and not expired
   *
   * @param forceRefresh - Force fresh balance check, ignoring cache
   * @returns Current balance in credits
   */
  public async checkBalance(forceRefresh: boolean = false): Promise<number> {
    // Check if we have valid cached balance
    if (!forceRefresh && this.isCacheValid()) {
      return this.cachedBalance!;
    }

    // Query API for balance
    const response = await this.httpClient.axiosInstance.get<{ balance: number }>('/balance');
    const balance = response.data.balance;

    // Update cache
    this.cachedBalance = balance;
    if (this.cacheDuration > 0) {
      this.cacheExpiry = new Date(Date.now() + this.cacheDuration);
    }

    // Update last check time
    this.lastCheckTime = new Date();

    // Check for low balance warning
    this.checkLowBalance(balance);

    return balance;
  }

  /**
   * Get balance comparison with quota usage
   * Returns current balance, credits used, and projected balance
   */
  public getBalanceComparison(): BalanceComparison {
    const creditsUsed = this.quotaTracker?.getCreditsUsed() ?? 0;
    const currentBalance = this.cachedBalance ?? 0;

    return {
      currentBalance,
      creditsUsed,
      projectedBalance: currentBalance - creditsUsed,
    };
  }

  /**
   * Get last successful balance check time
   * Returns undefined if no check has been made yet
   */
  public getLastCheckTime(): Date | undefined {
    return this.lastCheckTime;
  }

  /**
   * Check if cached balance is still valid
   */
  private isCacheValid(): boolean {
    if (this.cacheDuration === 0) {
      return false; // Caching disabled
    }

    if (this.cachedBalance === undefined) {
      return false; // No cached value
    }

    if (this.cacheExpiry === undefined) {
      return false; // No expiry set
    }

    return new Date() < this.cacheExpiry;
  }

  /**
   * Check if balance is below threshold and emit warning
   * Warns only once when dropping below threshold
   * Resets warning flag when balance goes above threshold
   */
  private checkLowBalance(balance: number): void {
    // Only check if threshold is set and callback exists
    if (this.lowBalanceThreshold === undefined || !this.onLowBalance) {
      return;
    }

    const isLow = balance < this.lowBalanceThreshold;

    if (isLow && !this.lowBalanceWarned) {
      // Balance dropped below threshold - warn
      this.onLowBalance(balance, this.lowBalanceThreshold);
      this.lowBalanceWarned = true;
    } else if (!isLow && this.lowBalanceWarned) {
      // Balance recovered above threshold - reset warning flag
      this.lowBalanceWarned = false;
    }
  }
}
