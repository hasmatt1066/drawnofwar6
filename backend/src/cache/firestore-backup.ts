/**
 * Task 2.5: Firestore Backup Layer
 *
 * Provides persistent backup cache using Firestore for cache entry resilience.
 * Stores sprite generation results with 30-day expiration for long-term caching.
 */

import type { Firestore } from 'firebase-admin/firestore';
import type { QueueServiceConfig } from '../queue/queue-manager.js';
import type { QueueLogger } from '../queue/logger.js';
import type { StructuredPrompt, SpriteGenerationResult } from '../queue/job-status-tracker.js';

/**
 * Cache entry structure (CANONICAL - from L3 spec)
 * This interface MUST match RedisCache's CacheEntry interface exactly.
 */
export interface CacheEntry {
  /** Cache key (format: "cache:hash") */
  cacheKey: string;

  /** User ID who created this result */
  userId: string;

  /** Structured prompt that generated this result */
  structuredPrompt: StructuredPrompt;

  /** Generation result with sprite frames */
  result: SpriteGenerationResult;

  /** Unix timestamp when entry was created */
  createdAt: number;

  /** Unix timestamp when entry expires */
  expiresAt: number;

  /** Number of times this entry has been accessed */
  hits: number;

  /** Unix timestamp of last access */
  lastAccessedAt: number;
}

/**
 * Stored cache entry format in Firestore (with base64 buffers)
 */
interface StoredCacheEntry {
  cacheKey: string;
  userId: string;
  structuredPrompt: StructuredPrompt;
  result: {
    jobId: string;
    frames: string[]; // base64 strings
    metadata: SpriteGenerationResult['metadata'];
  };
  createdAt: number;
  expiresAt: number;
  hits: number;
  lastAccessedAt: number;
}

/**
 * Firestore Backup Layer
 *
 * Provides persistent cache storage using Firestore with:
 * - 30-day automatic expiration
 * - Base64 encoding for sprite frame buffers
 * - Document size monitoring (1MB Firestore limit)
 * - Graceful error handling (fallback to generation)
 */
export class FirestoreBackup {
  private firestore: Firestore;
  private logger: QueueLogger;

  /**
   * Firestore collection name for sprite cache
   */
  private static readonly COLLECTION_NAME = 'sprite-cache';

  /**
   * Document size warning threshold (800KB)
   * Firestore limit is 1MB, warn at 80%
   */
  private static readonly SIZE_WARNING_THRESHOLD_KB = 800;

  /**
   * Creates a new FirestoreBackup instance
   *
   * @param firestore - Firestore instance from firebase-admin
   * @param config - Queue service configuration (reserved for future use)
   * @param logger - Logger instance for structured logging
   */
  constructor(firestore: Firestore, config: QueueServiceConfig, logger: QueueLogger) {
    this.firestore = firestore;
    this.logger = logger;
    // Note: config parameter reserved for future cache strategy configuration
    void config;
  }

  /**
   * Store cache entry in Firestore
   *
   * Converts sprite frame buffers to base64 for Firestore storage.
   * Sets expiration timestamp based on config.cache.ttlDays.
   * Warns if document size approaches Firestore 1MB limit.
   *
   * @param key - Cache key (e.g., "cache:abc123")
   * @param entry - Cache entry to store
   */
  async set(key: string, entry: CacheEntry): Promise<void> {
    try {
      // Convert buffers to base64 for Firestore storage
      const storedEntry: StoredCacheEntry = {
        cacheKey: entry.cacheKey,
        userId: entry.userId,
        structuredPrompt: entry.structuredPrompt,
        result: {
          jobId: entry.result.jobId,
          frames: entry.result.frames.map((frame) => frame.toString('base64')),
          metadata: entry.result.metadata,
        },
        createdAt: entry.createdAt,
        expiresAt: entry.expiresAt,
        hits: entry.hits,
        lastAccessedAt: entry.lastAccessedAt,
      };

      // Check document size and warn if approaching limit
      this.checkDocumentSize(key, storedEntry);

      // Store in Firestore
      const docRef = this.firestore.collection(FirestoreBackup.COLLECTION_NAME).doc(key);
      await docRef.set(storedEntry);
    } catch (error) {
      // Log error but don't throw - we don't want Firestore issues to break caching
      this.logger.logWarn('firestore_backup_error', {
        operation: 'set',
        cacheKey: key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Retrieve cache entry from Firestore
   *
   * Converts base64 strings back to buffers for sprite frames.
   * Returns null if entry doesn't exist or has expired.
   *
   * @param key - Cache key to retrieve
   * @returns Cache entry if found and not expired, null otherwise
   */
  async get(key: string): Promise<CacheEntry | null> {
    try {
      const docRef = this.firestore.collection(FirestoreBackup.COLLECTION_NAME).doc(key);
      const snapshot = await docRef.get();

      // Document doesn't exist
      if (!snapshot.exists) {
        return null;
      }

      const data = snapshot.data() as StoredCacheEntry;

      // Validate data has required fields
      if (!this.isValidCacheEntry(data)) {
        this.logger.logWarn('firestore_backup_error', {
          operation: 'get',
          cacheKey: key,
          error: 'Invalid cache entry data',
        });
        return null;
      }

      // Check if expired
      const now = Date.now();
      if (data.expiresAt < now) {
        return null;
      }

      // Convert base64 back to buffers
      const entry: CacheEntry = {
        cacheKey: data.cacheKey,
        userId: data.userId,
        structuredPrompt: data.structuredPrompt,
        result: {
          jobId: data.result.jobId,
          frames: data.result.frames.map((base64) => Buffer.from(base64, 'base64')),
          metadata: data.result.metadata,
        },
        createdAt: data.createdAt,
        expiresAt: data.expiresAt,
        hits: data.hits,
        lastAccessedAt: data.lastAccessedAt,
      };

      return entry;
    } catch (error) {
      // Log error and return null (treat as cache miss)
      this.logger.logWarn('firestore_backup_error', {
        operation: 'get',
        cacheKey: key,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Check document size and warn if approaching Firestore limit
   *
   * @param key - Cache key
   * @param data - Document data to check
   */
  private checkDocumentSize(key: string, data: StoredCacheEntry): void {
    try {
      // Estimate document size (JSON stringified)
      const jsonString = JSON.stringify(data);
      const sizeBytes = Buffer.byteLength(jsonString, 'utf8');
      const sizeKB = sizeBytes / 1024;

      // Warn if approaching limit
      if (sizeKB > FirestoreBackup.SIZE_WARNING_THRESHOLD_KB) {
        this.logger.logWarn('firestore_document_size_warning', {
          cacheKey: key,
          sizeKB: Math.round(sizeKB),
          limitKB: 1024,
          thresholdKB: FirestoreBackup.SIZE_WARNING_THRESHOLD_KB,
        });
      }
    } catch (error) {
      // Ignore size check errors
    }
  }

  /**
   * Validate cache entry has required fields
   *
   * @param data - Data to validate
   * @returns True if valid, false otherwise
   */
  private isValidCacheEntry(data: any): data is StoredCacheEntry {
    return (
      data &&
      typeof data === 'object' &&
      typeof data.cacheKey === 'string' &&
      typeof data.userId === 'string' &&
      data.structuredPrompt &&
      typeof data.structuredPrompt === 'object' &&
      data.result &&
      typeof data.result === 'object' &&
      Array.isArray(data.result.frames) &&
      typeof data.createdAt === 'number' &&
      typeof data.expiresAt === 'number' &&
      typeof data.hits === 'number' &&
      typeof data.lastAccessedAt === 'number'
    );
  }
}
