/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  /** Maximum requests per minute (default: 30) */
  requestsPerMinute?: number;

  /** Enable/disable rate limiting (default: true) */
  enabled?: boolean;
}

/**
 * Token Bucket Rate Limiter
 *
 * Implements token bucket algorithm to throttle API requests:
 * - Bucket starts full with N tokens
 * - Each request consumes 1 token
 * - Tokens refill at constant rate (requestsPerMinute / 60 per second)
 * - Requests block when bucket is empty
 *
 * Thread-safe for concurrent requests.
 */
export class RateLimiter {
  private readonly requestsPerMinute: number;
  private readonly enabled: boolean;
  private readonly tokensPerSecond: number;

  private tokens: number;
  private lastRefillTime: number;
  private pendingAcquires: Array<() => void> = [];

  /**
   * Default rate limit (matches config-validator default)
   */
  private static readonly DEFAULT_REQUESTS_PER_MINUTE = 30;

  constructor(config?: RateLimiterConfig) {
    this.requestsPerMinute = config?.requestsPerMinute ?? RateLimiter.DEFAULT_REQUESTS_PER_MINUTE;
    this.enabled = config?.enabled ?? true;

    // Calculate tokens per second for smooth refilling
    this.tokensPerSecond = this.requestsPerMinute / 60;

    // Start with full bucket
    this.tokens = this.requestsPerMinute;
    this.lastRefillTime = Date.now();
  }

  /**
   * Acquire a token (consume one request slot)
   * Blocks until a token is available
   *
   * @returns Promise that resolves when token is acquired
   */
  public async acquire(): Promise<void> {
    // If disabled, allow immediately
    if (!this.enabled) {
      return Promise.resolve();
    }

    // Refill tokens based on time elapsed
    this.refill();

    // If tokens available, consume one and return
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return Promise.resolve();
    }

    // No tokens available - need to wait
    return this.waitForToken();
  }

  /**
   * Get number of currently available tokens
   *
   * @returns Available tokens (Infinity if disabled)
   */
  public getAvailableTokens(): number {
    if (!this.enabled) {
      return Infinity;
    }

    // Refill before checking
    this.refill();

    return Math.floor(this.tokens);
  }

  /**
   * Refill tokens based on elapsed time
   */
  private refill(): void {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefillTime) / 1000;

    // Calculate tokens to add
    const tokensToAdd = elapsedSeconds * this.tokensPerSecond;

    // Add tokens but don't exceed max
    this.tokens = Math.min(this.tokens + tokensToAdd, this.requestsPerMinute);

    // Update last refill time
    this.lastRefillTime = now;
  }

  /**
   * Wait for a token to become available
   */
  private async waitForToken(): Promise<void> {
    return new Promise<void>((resolve) => {
      // Add to pending queue
      this.pendingAcquires.push(resolve);

      // Calculate when next token will be available
      const timeUntilNextToken = (1 / this.tokensPerSecond) * 1000; // milliseconds

      // Schedule token availability
      setTimeout(() => {
        this.processNextAcquire();
      }, timeUntilNextToken);
    });
  }

  /**
   * Process next pending acquire
   */
  private processNextAcquire(): void {
    // Refill tokens
    this.refill();

    // Process as many pending acquires as we have tokens
    while (this.pendingAcquires.length > 0 && this.tokens >= 1) {
      const resolve = this.pendingAcquires.shift();
      this.tokens -= 1;

      if (resolve) {
        resolve();
      }
    }

    // If still have pending acquires, schedule next processing
    if (this.pendingAcquires.length > 0) {
      const timeUntilNextToken = (1 / this.tokensPerSecond) * 1000;
      setTimeout(() => {
        this.processNextAcquire();
      }, timeUntilNextToken);
    }
  }
}
