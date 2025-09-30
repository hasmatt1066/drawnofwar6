/**
 * Log Levels (ordered by severity)
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Logger configuration options
 */
export interface LoggerConfig {
  /** Minimum log level to output (default: INFO) */
  level?: LogLevel;

  /** Enable/disable logging entirely (default: true) */
  enabled?: boolean;
}

/**
 * Structured log entry
 */
export interface LogEntry {
  timestamp: string;
  level: string;
  message?: string;
  type?: string;
  [key: string]: any;
}

/**
 * API Request log parameters
 */
export interface ApiRequestLog {
  method: string;
  url: string;
  payloadSize?: number;
  headers?: Record<string, string>;
  timestamp: Date;
}

/**
 * API Response log parameters
 */
export interface ApiResponseLog {
  method: string;
  url: string;
  statusCode: number;
  duration: number;
  creditsUsed?: number;
  timestamp: Date;
}

/**
 * Error log parameters
 */
export interface ErrorLog {
  error?: Error;
  context?: Record<string, any>;
}

/**
 * Structured Logger for PixelLab API Client
 *
 * Provides JSON-formatted logging with:
 * - Log level filtering (DEBUG, INFO, WARN, ERROR)
 * - Sensitive data redaction (API keys, user data)
 * - API request/response tracking
 * - Error logging with full context
 * - ISO timestamp formatting
 */
export class Logger {
  private level: LogLevel;
  private enabled: boolean;

  /**
   * Sensitive field names to redact in logs
   */
  private static readonly SENSITIVE_FIELDS = ['apiKey', 'api_key', 'authorization', 'Authorization'];

  /**
   * Slow request threshold (3 minutes, same as timeout)
   */
  private static readonly SLOW_REQUEST_THRESHOLD = 180000;

  constructor(config: LoggerConfig = {}) {
    this.level = config.level ?? LogLevel.INFO;
    this.enabled = config.enabled ?? true;
  }

  /**
   * Get current log level
   */
  public getLevel(): LogLevel {
    return this.level;
  }

  /**
   * Set log level at runtime
   */
  public setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Log debug message (lowest priority)
   */
  public debug(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * Log info message
   */
  public info(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * Log warning message
   */
  public warn(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * Log error message (highest priority)
   */
  public error(message: string, data?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, data);
  }

  /**
   * Log API request
   */
  public logApiRequest(params: ApiRequestLog): void {
    if (!this.shouldLog(LogLevel.DEBUG)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: params.timestamp.toISOString(),
      level: 'debug',
      type: 'api_request',
      method: params.method,
      url: params.url,
    };

    if (params.payloadSize !== undefined) {
      entry['payloadSize'] = params.payloadSize;
    }

    if (params.headers) {
      entry['headers'] = this.redactSensitiveData(params.headers);
    }

    this.output(LogLevel.DEBUG, entry);
  }

  /**
   * Log API response
   */
  public logApiResponse(params: ApiResponseLog): void {
    // Log as warning if request failed or was slow
    const isError = params.statusCode >= 400;
    const isSlow = params.duration >= Logger.SLOW_REQUEST_THRESHOLD;
    const logLevel = isError || isSlow ? LogLevel.WARN : LogLevel.DEBUG;

    if (!this.shouldLog(logLevel)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: params.timestamp.toISOString(),
      level: logLevel === LogLevel.WARN ? 'warn' : 'debug',
      type: 'api_response',
      method: params.method,
      url: params.url,
      statusCode: params.statusCode,
      duration: params.duration,
    };

    if (params.creditsUsed !== undefined) {
      entry['creditsUsed'] = params.creditsUsed;
    }

    this.output(logLevel, entry);
  }

  /**
   * Log error with full context
   */
  public logError(message: string, params?: ErrorLog): void {
    if (!this.shouldLog(LogLevel.ERROR)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      message,
    };

    if (params?.error) {
      entry['error'] = {
        message: params.error.message,
        name: params.error.name,
        stack: params.error.stack,
      };
    }

    if (params?.context) {
      entry['context'] = this.redactSensitiveData(params.context);
    }

    this.output(LogLevel.ERROR, entry);
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, data?: Record<string, any>): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: this.getLevelName(level),
      message,
    };

    if (data) {
      entry['data'] = this.redactSensitiveData(data);
    }

    this.output(level, entry);
  }

  /**
   * Check if message should be logged based on current level
   */
  private shouldLog(level: LogLevel): boolean {
    return this.enabled && level >= this.level;
  }

  /**
   * Get string name for log level
   */
  private getLevelName(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return 'debug';
      case LogLevel.INFO:
        return 'info';
      case LogLevel.WARN:
        return 'warn';
      case LogLevel.ERROR:
        return 'error';
      default:
        return 'unknown';
    }
  }

  /**
   * Output log entry to console
   */
  private output(level: LogLevel, entry: LogEntry): void {
    const json = JSON.stringify(entry);

    switch (level) {
      case LogLevel.ERROR:
        console.error(json);
        break;
      case LogLevel.WARN:
        console.warn(json);
        break;
      default:
        console.log(json);
    }
  }

  /**
   * Redact sensitive data from object
   * Handles nested objects and arrays
   */
  private redactSensitiveData(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.redactSensitiveData(item));
    }

    if (typeof obj !== 'object') {
      return obj;
    }

    const redacted: any = {};

    for (const [key, value] of Object.entries(obj)) {
      // Check if field is sensitive
      if (this.isSensitiveField(key)) {
        redacted[key] = this.redactValue(value);
      } else if (typeof value === 'object' && value !== null) {
        // Recursively redact nested objects
        redacted[key] = this.redactSensitiveData(value);
      } else {
        redacted[key] = value;
      }
    }

    return redacted;
  }

  /**
   * Check if field name is sensitive
   */
  private isSensitiveField(fieldName: string): boolean {
    return Logger.SENSITIVE_FIELDS.some(
      (sensitive) => fieldName.toLowerCase() === sensitive.toLowerCase()
    );
  }

  /**
   * Redact sensitive value (show first 4 and last 4 characters)
   */
  private redactValue(value: any): string {
    if (typeof value !== 'string') {
      return '***';
    }

    // Handle Bearer token format
    if (value.startsWith('Bearer ')) {
      const token = value.substring(7);
      return `Bearer ${this.redactString(token)}`;
    }

    return this.redactString(value);
  }

  /**
   * Redact string value (show first 4 and last 4 characters)
   */
  private redactString(value: string): string {
    if (value.length < 8) {
      return '***';
    }

    const first4 = value.substring(0, 4);
    const last4 = value.substring(value.length - 4);

    return `${first4}...${last4}`;
  }
}
