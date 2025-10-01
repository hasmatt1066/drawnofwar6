/**
 * Task 7.3: Structured Logging for Queue Events
 *
 * Provides comprehensive structured logging for all queue operations including:
 * - Job submissions, state changes, cache access
 * - Error logging with full context
 * - Retry attempts and DLQ moves
 * - JSON formatting and sensitive data redaction
 * - Handles edge cases (large data, circular references, logging failures)
 */

/**
 * Queue logger configuration
 */
export interface QueueLoggerConfig {
  /** Enable/disable logging (default: true) */
  enabled?: boolean;

  /** Log level: 'debug', 'info', 'warn', 'error' (default: 'info') */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';

  /** Correlation ID for request tracing (optional) */
  correlationId?: string;

  /** Maximum JSON string length before truncation (default: 5000) */
  maxLength?: number;
}

/**
 * Structured log entry interface
 */
export interface LogEntry {
  timestamp: string;
  level: string;
  type: string;
  correlationId?: string | undefined;
  [key: string]: any;
}

/**
 * Queue logger for structured logging of all queue operations
 *
 * Features:
 * - JSON-formatted output for machine parsing
 * - Automatic sensitive data redaction
 * - Circular reference handling
 * - Large data truncation
 * - Correlation ID tracking for distributed tracing
 */
export class QueueLogger {
  private enabled: boolean;
  private logLevel: string;
  private correlationId?: string | undefined;
  private maxLength: number;


  /**
   * Log levels ordered by severity
   */
  private static readonly LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  constructor(config: QueueLoggerConfig = {}) {
    this.enabled = config.enabled ?? true;
    this.logLevel = config.logLevel ?? 'info';
    this.correlationId = config.correlationId ?? undefined;
    this.maxLength = config.maxLength ?? 5000;
  }

  /**
   * Log job submission
   *
   * @param jobId - Unique job identifier
   * @param userId - User who submitted the job
   * @param prompt - Job prompt/configuration data
   */
  public logJobSubmission(jobId: string, userId: string, prompt: any): void {
    if (!this.shouldLog('info')) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      type: 'queue_job_submission',
      jobId,
      userId,
      prompt: this.prepareForLogging(prompt),
    };

    if (this.correlationId !== undefined) {
      entry['correlationId'] = this.correlationId;
    }

    this.output('info', entry);
  }

  /**
   * Log job state change
   *
   * @param jobId - Unique job identifier
   * @param fromState - Previous state
   * @param toState - New state
   * @param metadata - Optional metadata about the state change
   */
  public logStateChange(
    jobId: string,
    fromState: string,
    toState: string,
    metadata?: any
  ): void {
    // Log failed states as warnings
    const level = toState === 'failed' ? 'warn' : 'info';

    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      type: 'queue_state_change',
      jobId,
      fromState,
      toState,
    };

    if (metadata) {
      entry['metadata'] = this.prepareForLogging(metadata);
    }

    if (this.correlationId !== undefined) {
      entry['correlationId'] = this.correlationId;
    }

    this.output(level, entry);
  }

  /**
   * Log cache hit/miss
   *
   * @param cacheKey - Cache key accessed
   * @param hit - Whether it was a cache hit (true) or miss (false)
   * @param userId - User making the request
   */
  public logCacheAccess(cacheKey: string, hit: boolean, userId: string): void {
    if (!this.shouldLog('debug')) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'debug',
      type: 'queue_cache_access',
      cacheKey,
      hit,
      userId,
    };

    if (this.correlationId !== undefined) {
      entry['correlationId'] = this.correlationId;
    }

    this.output('debug', entry);
  }

  /**
   * Log error with full context
   *
   * @param jobId - Job ID where error occurred
   * @param error - Error object
   * @param context - Additional context data
   */
  public logError(jobId: string, error: Error, context: any): void {
    if (!this.shouldLog('error')) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      type: 'queue_error',
      jobId,
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack,
      },
      context: this.prepareForLogging(context),
    };

    if (this.correlationId !== undefined) {
      entry['correlationId'] = this.correlationId;
    }

    this.output('error', entry);
  }

  /**
   * Log retry attempt
   *
   * @param jobId - Job being retried
   * @param attempt - Attempt number (1-based)
   * @param reason - Reason for retry
   */
  public logRetry(jobId: string, attempt: number, reason: string): void {
    if (!this.shouldLog('warn')) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'warn',
      type: 'queue_retry',
      jobId,
      attempt,
      reason,
    };

    if (this.correlationId !== undefined) {
      entry['correlationId'] = this.correlationId;
    }

    this.output('warn', entry);
  }

  /**
   * Log DLQ (Dead Letter Queue) move
   *
   * @param jobId - Job being moved to DLQ
   * @param reason - Reason for DLQ move
   * @param retryCount - Number of retries attempted
   */
  public logDLQMove(jobId: string, reason: string, retryCount: number): void {
    if (!this.shouldLog('error')) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      type: 'queue_dlq_move',
      jobId,
      reason,
      retryCount,
    };

    if (this.correlationId !== undefined) {
      entry['correlationId'] = this.correlationId;
    }

    this.output('error', entry);
  }

  /**
   * Log general info message
   *
   * @param type - Event type
   * @param data - Additional data to log
   */
  public logInfo(type: string, data: any): void {
    if (!this.shouldLog('info')) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      type,
      ...this.prepareForLogging(data),
    };

    if (this.correlationId !== undefined) {
      entry['correlationId'] = this.correlationId;
    }

    this.output('info', entry);
  }

  /**
   * Log general warning message
   *
   * @param type - Event type
   * @param data - Additional data to log
   */
  public logWarn(type: string, data: any): void {
    if (!this.shouldLog('warn')) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'warn',
      type,
      ...this.prepareForLogging(data),
    };

    if (this.correlationId !== undefined) {
      entry['correlationId'] = this.correlationId;
    }

    this.output('warn', entry);
  }

  /**
   * Check if message should be logged based on current level
   */
  private shouldLog(level: string): boolean {
    if (!this.enabled) {
      return false;
    }

    const currentLevel = QueueLogger.LOG_LEVELS[this.logLevel as keyof typeof QueueLogger.LOG_LEVELS];
    const messageLevel = QueueLogger.LOG_LEVELS[level as keyof typeof QueueLogger.LOG_LEVELS];

    return messageLevel >= currentLevel;
  }

  /**
   * Output log entry to console with appropriate method
   */
  private output(level: string, entry: LogEntry): void {
    try {
      const json = JSON.stringify(entry);

      switch (level) {
        case 'error':
          console.error(json);
          break;
        case 'warn':
          console.warn(json);
          break;
        default:
          console.log(json);
      }
    } catch (error) {
      // Fallback: if logging fails, don't crash the application
      // Try to log a simple error message
      try {
        console.error(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'error',
            type: 'logging_error',
            message: 'Failed to log entry',
            error: error instanceof Error ? error.message : String(error),
          })
        );
      } catch {
        // If even that fails, silently continue
        // We don't want logging issues to crash the application
      }
    }
  }

  /**
   * Prepare data for logging: redact sensitive data and truncate if needed
   */
  private prepareForLogging(data: any): any {
    try {
      // First redact sensitive data
      const redacted = redactSensitiveData(data);

      // Then truncate if needed
      const truncated = truncateForLogging(redacted, this.maxLength);

      return truncated;
    } catch (error) {
      // If preparation fails, return a safe placeholder
      return { error: 'Failed to prepare data for logging' };
    }
  }
}

/**
 * Redact sensitive data from objects
 *
 * Recursively walks through objects and arrays, replacing sensitive field values
 * with redacted versions (showing first 4 and last 4 characters).
 *
 * @param data - Data to redact
 * @returns Redacted copy of data
 */
export function redactSensitiveData(data: any): any {
  // Handle null/undefined
  if (data === null || data === undefined) {
    return data;
  }

  // Handle primitives
  if (typeof data !== 'object') {
    return data;
  }

  // Handle circular references using a WeakSet
  const seen = new WeakSet();

  function redactRecursive(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj !== 'object') {
      return obj;
    }

    // Check for circular reference
    if (seen.has(obj)) {
      return '[Circular]';
    }

    seen.add(obj);

    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map((item) => redactRecursive(item));
    }

    // Handle objects
    const redacted: any = {};

    for (const [key, value] of Object.entries(obj)) {
      if (isSensitiveField(key)) {
        redacted[key] = redactValue(value);
      } else if (typeof value === 'object' && value !== null) {
        redacted[key] = redactRecursive(value);
      } else {
        redacted[key] = value;
      }
    }

    return redacted;
  }

  return redactRecursive(data);
}

/**
 * Check if field name is sensitive
 */
function isSensitiveField(fieldName: string): boolean {
  const sensitiveFields = [
    'apiKey',
    'api_key',
    'authorization',
    'Authorization',
    'password',
    'secret',
    'token',
    'accessToken',
    'refreshToken',
    'privateKey',
    'private_key',
  ];

  return sensitiveFields.some(
    (sensitive) => fieldName.toLowerCase() === sensitive.toLowerCase()
  );
}

/**
 * Redact sensitive value (show first 4 and last 4 characters)
 */
function redactValue(value: any): string {
  if (typeof value !== 'string') {
    return '***';
  }

  // Handle Bearer token format
  if (value.startsWith('Bearer ')) {
    const token = value.substring(7);
    return `Bearer ${redactString(token)}`;
  }

  return redactString(value);
}

/**
 * Redact string value (show first 4 and last 4 characters)
 */
function redactString(value: string): string {
  if (value.length < 8) {
    return '***';
  }

  const first4 = value.substring(0, 4);
  const last4 = value.substring(value.length - 4);

  return `${first4}...${last4}`;
}

/**
 * Truncate large objects for logging
 *
 * Limits the total JSON string length to prevent excessive log sizes.
 * Truncates string values and limits array lengths when necessary.
 *
 * @param data - Data to truncate
 * @param maxLength - Maximum JSON string length (default: 5000)
 * @returns Truncated copy of data
 */
export function truncateForLogging(data: any, maxLength: number = 5000): any {
  // Handle null/undefined
  if (data === null || data === undefined) {
    return data;
  }

  // Handle primitives
  if (typeof data !== 'object') {
    if (typeof data === 'string' && data.length > maxLength) {
      return data.substring(0, maxLength) + '...[truncated]';
    }
    return data;
  }

  // Handle circular references
  const seen = new WeakSet();

  function truncateRecursive(obj: any, currentDepth: number = 0): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    // Limit recursion depth to prevent stack overflow
    if (currentDepth > 20) {
      return '[Max depth reached]';
    }

    if (typeof obj !== 'object') {
      if (typeof obj === 'string' && obj.length > 1000) {
        return obj.substring(0, 1000) + '...[truncated]';
      }
      return obj;
    }

    // Check for circular reference
    if (seen.has(obj)) {
      return '[Circular]';
    }

    seen.add(obj);

    // Handle arrays
    if (Array.isArray(obj)) {
      // Limit array length
      const maxArrayLength = 50;
      const truncatedArray = obj.slice(0, maxArrayLength).map((item) =>
        truncateRecursive(item, currentDepth + 1)
      );

      if (obj.length > maxArrayLength) {
        truncatedArray.push(`...[${obj.length - maxArrayLength} more items]`);
      }

      return truncatedArray;
    }

    // Handle objects
    const truncated: any = {};
    let propertyCount = 0;
    const maxProperties = 50;

    for (const [key, value] of Object.entries(obj)) {
      if (propertyCount >= maxProperties) {
        truncated['...'] = `[${Object.keys(obj).length - maxProperties} more properties]`;
        break;
      }

      truncated[key] = truncateRecursive(value, currentDepth + 1);
      propertyCount++;
    }

    return truncated;
  }

  const truncated = truncateRecursive(data);

  // Final check: if the JSON string is still too large, apply aggressive truncation
  try {
    const jsonString = JSON.stringify(truncated);
    if (jsonString.length > maxLength) {
      // Apply aggressive truncation: keep only top-level structure
      if (typeof truncated === 'object' && !Array.isArray(truncated)) {
        const aggressive: any = {};
        for (const [key, value] of Object.entries(truncated)) {
          if (typeof value === 'string') {
            aggressive[key] = value.substring(0, 100) + '...[truncated]';
          } else if (typeof value === 'object') {
            aggressive[key] = '[Object truncated]';
          } else {
            aggressive[key] = value;
          }
        }
        return aggressive;
      }

      // For arrays or other types, return summary
      return '[Data truncated due to size]';
    }

    return truncated;
  } catch (error) {
    // If JSON.stringify fails (e.g., circular reference still present), return placeholder
    return '[Data could not be serialized]';
  }
}
