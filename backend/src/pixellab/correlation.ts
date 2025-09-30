import { randomUUID } from 'crypto';

/**
 * Correlation context for request tracking
 */
export interface CorrelationContext {
  /** Unique correlation ID for this request chain */
  correlationId: string;

  /** Parent correlation ID (for nested requests) */
  parentCorrelationId?: string;

  /** Request depth in chain (0 = root) */
  depth: number;

  /** Timestamp when context was created */
  timestamp: Date;

  /** Optional metadata for context enrichment */
  metadata?: Record<string, any>;
}

/**
 * Correlation ID Manager
 *
 * Manages correlation IDs for distributed request tracing with:
 * - UUID v4 generation for unique IDs
 * - Context creation and propagation
 * - Header generation and extraction
 * - Log data enrichment
 * - Parent-child relationship tracking
 *
 * @example
 * ```typescript
 * // Create new correlation context
 * const context = CorrelationIdManager.createContext();
 *
 * // Add to request headers
 * const headers = CorrelationIdManager.toHeaders(context.correlationId);
 *
 * // Enrich log data
 * const logData = CorrelationIdManager.enrichLogData(context.correlationId, {
 *   level: 'info',
 *   message: 'Request started',
 * });
 * ```
 */
export class CorrelationIdManager {
  /**
   * Standard header name for correlation ID
   */
  private static readonly CORRELATION_HEADER = 'X-Correlation-ID';

  /**
   * UUID v4 validation regex
   */
  private static readonly UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  /**
   * Generate a new unique correlation ID (UUID v4)
   */
  public static generate(): string {
    return randomUUID();
  }

  /**
   * Create a new correlation context
   *
   * @param correlationId - Optional correlation ID (generates new if not provided)
   * @param metadata - Optional metadata to attach to context
   * @returns New correlation context
   */
  public static createContext(
    correlationId?: string,
    metadata?: Record<string, any>
  ): CorrelationContext {
    const context: CorrelationContext = {
      correlationId: correlationId || this.generate(),
      depth: 0,
      timestamp: new Date(),
    };
    if (metadata !== undefined) {
      context.metadata = metadata;
    }
    return context;
  }

  /**
   * Create a child context from parent context
   * Useful for tracking nested/chained requests
   *
   * @param parent - Parent correlation context
   * @param metadata - Optional additional metadata for child context
   * @returns Child correlation context
   */
  public static createChildContext(
    parent: CorrelationContext,
    metadata?: Record<string, any>
  ): CorrelationContext {
    const context: CorrelationContext = {
      correlationId: this.generate(),
      parentCorrelationId: parent.correlationId,
      depth: parent.depth + 1,
      timestamp: new Date(),
    };

    // Merge parent metadata with new metadata
    const mergedMetadata = parent.metadata
      ? { ...parent.metadata, ...metadata }
      : metadata;

    if (mergedMetadata !== undefined) {
      context.metadata = mergedMetadata;
    }

    return context;
  }

  /**
   * Convert correlation ID to HTTP headers
   *
   * @param correlationId - Correlation ID to add to headers
   * @returns Headers object with correlation ID
   */
  public static toHeaders(correlationId: string): Record<string, string> {
    if (!correlationId) {
      return {};
    }

    return {
      [this.CORRELATION_HEADER]: correlationId,
    };
  }

  /**
   * Extract correlation ID from HTTP headers
   * Performs case-insensitive header lookup
   *
   * @param headers - HTTP headers object
   * @returns Correlation ID if found, undefined otherwise
   */
  public static extractFromHeaders(
    headers: Record<string, any>
  ): string | undefined {
    // Case-insensitive header lookup
    const headerKey = Object.keys(headers).find(
      (key) => key.toLowerCase() === this.CORRELATION_HEADER.toLowerCase()
    );

    return headerKey ? headers[headerKey] : undefined;
  }

  /**
   * Enrich log data with correlation ID
   * Creates a new object without modifying the original
   *
   * @param correlationId - Correlation ID to add to log data
   * @param logData - Original log data
   * @returns New log data object with correlation ID
   */
  public static enrichLogData(
    correlationId: string,
    logData: Record<string, any>
  ): Record<string, any> {
    return {
      ...logData,
      correlationId,
    };
  }

  /**
   * Validate correlation ID format
   *
   * @param correlationId - Correlation ID to validate
   * @param strictUuid - If true, enforces UUID v4 format (default: true)
   * @returns True if valid, false otherwise
   */
  public static isValidFormat(
    correlationId: string,
    strictUuid: boolean = true
  ): boolean {
    if (!correlationId || correlationId.trim() === '') {
      return false;
    }

    if (strictUuid) {
      return this.UUID_REGEX.test(correlationId);
    }

    // For custom formats, just check non-empty
    return correlationId.trim().length > 0;
  }
}
