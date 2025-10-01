/**
 * Task 2.5: Firestore Backup Layer Tests
 *
 * Comprehensive unit tests for the FirestoreBackup class covering:
 * - Cache entry storage and retrieval
 * - Expiration timestamp handling
 * - Base64 sprite frame encoding
 * - Firestore error handling
 * - Document size limit warnings
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { FirestoreBackup, type CacheEntry } from './firestore-backup.js';
import type { Firestore, CollectionReference, DocumentReference } from 'firebase-admin/firestore';
import type { QueueServiceConfig } from '../queue/queue-manager.js';
import type { QueueLogger } from '../queue/logger.js';

// Mock Firestore types
interface MockDocumentSnapshot {
  exists: boolean;
  data: () => any;
  id: string;
}

describe('FirestoreBackup', () => {
  let firestoreBackup: FirestoreBackup;
  let mockFirestore: Firestore;
  let mockCollection: CollectionReference;
  let mockDoc: DocumentReference;
  let mockLogger: QueueLogger;
  let config: QueueServiceConfig;

  beforeEach(() => {
    // Create mock Firestore instance
    mockDoc = {
      set: vi.fn(),
      get: vi.fn(),
      id: 'test-doc-id',
    } as any;

    mockCollection = {
      doc: vi.fn().mockReturnValue(mockDoc),
    } as any;

    mockFirestore = {
      collection: vi.fn().mockReturnValue(mockCollection),
    } as any;

    // Create mock logger
    mockLogger = {
      logWarn: vi.fn(),
      logInfo: vi.fn(),
      logError: vi.fn(),
    } as any;

    // Create test config
    config = {
      redis: { host: 'localhost', port: 6379 },
      firestore: { projectId: 'test-project' },
      queue: {
        name: 'test-queue',
        concurrency: 5,
        maxJobsPerUser: 5,
        systemQueueLimit: 500,
        warningThreshold: 400,
      },
      cache: {
        ttlDays: 30,
        strategy: 'moderate',
      },
      retry: {
        maxRetries: 1,
        backoffDelay: 5000,
        backoffMultiplier: 2.0,
      },
      sse: {
        updateInterval: 2500,
        keepAliveInterval: 30000,
      },
      deduplication: {
        windowSeconds: 10,
      },
    };

    firestoreBackup = new FirestoreBackup(mockFirestore, config, mockLogger);
  });

  describe('set()', () => {
    it('should store cache entry in Firestore collection', async () => {
      const key = 'cache:abc123';
      const now = Date.now();
      const entry: CacheEntry = {
        cacheKey: key,
        userId: 'user-1',
        structuredPrompt: {
          type: 'character',
          style: 'pixel-art',
          size: { width: 32, height: 32 },
          action: 'walking',
          description: 'warrior',
          raw: 'warrior walking',
        },
        result: {
          jobId: 'job-1',
          frames: [Buffer.from('frame1-data'), Buffer.from('frame2-data')],
          metadata: {
            dimensions: { width: 32, height: 32 },
            frameCount: 2,
            generationTimeMs: 5000,
            cacheHit: false,
            pixelLabJobId: 'pixellab-123',
          },
        },
        createdAt: now,
        expiresAt: now + 30 * 24 * 60 * 60 * 1000, // 30 days
        hits: 0,
        lastAccessedAt: now,
      };

      await firestoreBackup.set(key, entry);

      // Verify collection was accessed
      expect(mockFirestore.collection).toHaveBeenCalledWith('sprite-cache');

      // Verify document was created with key
      expect(mockCollection.doc).toHaveBeenCalledWith(key);

      // Verify set was called with correct data structure
      expect(mockDoc.set).toHaveBeenCalledWith(
        expect.objectContaining({
          cacheKey: key,
          userId: 'user-1',
          structuredPrompt: entry.structuredPrompt,
          createdAt: now,
          expiresAt: entry.expiresAt,
          hits: 0,
          lastAccessedAt: now,
        })
      );
    });

    it('should store sprite frames as base64 strings', async () => {
      const key = 'cache:def456';
      const now = Date.now();
      const frame1 = Buffer.from('south-image-data');
      const frame2 = Buffer.from('north-image-data');

      const entry: CacheEntry = {
        cacheKey: key,
        userId: 'user-2',
        structuredPrompt: {
          type: 'character',
          style: 'pixel-art',
          size: { width: 16, height: 16 },
          action: 'idle',
          description: 'mage',
          raw: 'mage idle',
        },
        result: {
          jobId: 'job-2',
          frames: [frame1, frame2],
          metadata: {
            dimensions: { width: 16, height: 16 },
            frameCount: 2,
            generationTimeMs: 3000,
            cacheHit: false,
          },
        },
        createdAt: now,
        expiresAt: now + 30 * 24 * 60 * 60 * 1000,
        hits: 0,
        lastAccessedAt: now,
      };

      await firestoreBackup.set(key, entry);

      const setCall = (mockDoc.set as Mock).mock.calls[0][0];

      // Verify buffers are converted to base64
      expect(setCall.result.frames[0]).toBe(frame1.toString('base64'));
      expect(setCall.result.frames[1]).toBe(frame2.toString('base64'));

      // Verify frames are strings, not buffers
      expect(typeof setCall.result.frames[0]).toBe('string');
      expect(typeof setCall.result.frames[1]).toBe('string');
    });

    it('should warn if document size approaches Firestore limit (1MB)', async () => {
      const key = 'cache:large123';
      const now = Date.now();
      const largeBuffer = Buffer.alloc(900 * 1024); // 900KB
      largeBuffer.fill('x');

      const entry: CacheEntry = {
        cacheKey: key,
        userId: 'user-3',
        structuredPrompt: {
          type: 'character',
          style: 'pixel-art',
          size: { width: 64, height: 64 },
          action: 'running',
          description: 'knight',
          raw: 'knight running',
        },
        result: {
          jobId: 'job-3',
          frames: [largeBuffer],
          metadata: {
            dimensions: { width: 64, height: 64 },
            frameCount: 1,
            generationTimeMs: 8000,
            cacheHit: false,
          },
        },
        createdAt: now,
        expiresAt: now + 30 * 24 * 60 * 60 * 1000,
        hits: 0,
        lastAccessedAt: now,
      };

      await firestoreBackup.set(key, entry);

      // Verify warning was logged (document > 800KB threshold)
      expect(mockLogger.logWarn).toHaveBeenCalledWith(
        'firestore_document_size_warning',
        expect.objectContaining({
          cacheKey: key,
          sizeKB: expect.any(Number),
        })
      );
    });

    it('should handle Firestore connection errors gracefully', async () => {
      const key = 'cache:error123';
      const now = Date.now();

      const entry: CacheEntry = {
        cacheKey: key,
        userId: 'user-4',
        structuredPrompt: {
          type: 'character',
          style: 'pixel-art',
          size: { width: 32, height: 32 },
          action: 'attack',
          description: 'rogue',
          raw: 'rogue attack',
        },
        result: {
          jobId: 'job-4',
          frames: [Buffer.from('frame-data')],
          metadata: {
            dimensions: { width: 32, height: 32 },
            frameCount: 1,
            generationTimeMs: 4000,
            cacheHit: false,
          },
        },
        createdAt: now,
        expiresAt: now + 30 * 24 * 60 * 60 * 1000,
        hits: 0,
        lastAccessedAt: now,
      };

      // Simulate Firestore error
      (mockDoc.set as Mock).mockRejectedValueOnce(new Error('Firestore connection failed'));

      // Should not throw, should log error
      await expect(firestoreBackup.set(key, entry)).resolves.toBeUndefined();

      // Verify error was logged
      expect(mockLogger.logWarn).toHaveBeenCalledWith(
        'firestore_backup_error',
        expect.objectContaining({
          operation: 'set',
          cacheKey: key,
          error: 'Firestore connection failed',
        })
      );
    });

    it('should preserve all cache entry fields', async () => {
      const key = 'cache:fields123';
      const now = Date.now();
      const expiresAt = now + 30 * 24 * 60 * 60 * 1000;

      const entry: CacheEntry = {
        cacheKey: key,
        userId: 'user-5',
        structuredPrompt: {
          type: 'character',
          style: 'pixel-art',
          size: { width: 32, height: 32 },
          action: 'walking',
          description: 'paladin',
          raw: 'paladin walking',
        },
        result: {
          jobId: 'job-5',
          frames: [],
          metadata: {
            dimensions: { width: 32, height: 32 },
            frameCount: 0,
            generationTimeMs: 2000,
            cacheHit: true,
          },
        },
        createdAt: now,
        expiresAt,
        hits: 5,
        lastAccessedAt: now - 1000,
      };

      await firestoreBackup.set(key, entry);

      const setCall = (mockDoc.set as Mock).mock.calls[0][0];

      // Verify all fields are preserved
      expect(setCall.cacheKey).toBe(key);
      expect(setCall.userId).toBe('user-5');
      expect(setCall.createdAt).toBe(now);
      expect(setCall.expiresAt).toBe(expiresAt);
      expect(setCall.hits).toBe(5);
      expect(setCall.lastAccessedAt).toBe(now - 1000);
    });
  });

  describe('get()', () => {
    it('should retrieve cache entry from Firestore', async () => {
      const key = 'cache:retrieve123';
      const now = Date.now();
      const frame1Base64 = Buffer.from('frame1-data').toString('base64');
      const frame2Base64 = Buffer.from('frame2-data').toString('base64');

      const storedData = {
        cacheKey: key,
        userId: 'user-6',
        structuredPrompt: {
          type: 'character',
          style: 'pixel-art',
          size: { width: 32, height: 32 },
          action: 'jumping',
          description: 'archer',
          raw: 'archer jumping',
        },
        result: {
          jobId: 'job-6',
          frames: [frame1Base64, frame2Base64],
          metadata: {
            dimensions: { width: 32, height: 32 },
            frameCount: 2,
            generationTimeMs: 6000,
            cacheHit: false,
          },
        },
        createdAt: now,
        expiresAt: now + 30 * 24 * 60 * 60 * 1000,
        hits: 3,
        lastAccessedAt: now - 5000,
      };

      const mockSnapshot: MockDocumentSnapshot = {
        exists: true,
        data: () => storedData,
        id: key,
      };

      (mockDoc.get as Mock).mockResolvedValueOnce(mockSnapshot);

      const result = await firestoreBackup.get(key);

      // Verify collection and doc were accessed
      expect(mockFirestore.collection).toHaveBeenCalledWith('sprite-cache');
      expect(mockCollection.doc).toHaveBeenCalledWith(key);

      // Verify result is correct
      expect(result).not.toBeNull();
      expect(result?.cacheKey).toBe(key);
      expect(result?.userId).toBe('user-6');
      expect(result?.structuredPrompt.description).toBe('archer');
      expect(result?.hits).toBe(3);

      // Verify base64 was converted back to Buffers
      expect(Buffer.isBuffer(result?.result.frames[0])).toBe(true);
      expect(Buffer.isBuffer(result?.result.frames[1])).toBe(true);
      expect(result?.result.frames[0]?.toString()).toBe('frame1-data');
      expect(result?.result.frames[1]?.toString()).toBe('frame2-data');
    });

    it('should return null for cache miss', async () => {
      const key = 'cache:notfound123';

      const mockSnapshot: MockDocumentSnapshot = {
        exists: false,
        data: () => undefined,
        id: key,
      };

      (mockDoc.get as Mock).mockResolvedValueOnce(mockSnapshot);

      const result = await firestoreBackup.get(key);

      expect(result).toBeNull();
    });

    it('should return null for expired entries', async () => {
      const key = 'cache:expired123';
      const pastDate = Date.now() - 10 * 24 * 60 * 60 * 1000; // 10 days ago
      const expiredDate = pastDate - 1000; // Already expired

      const storedData = {
        cacheKey: key,
        userId: 'user-7',
        structuredPrompt: {
          type: 'character',
          style: 'pixel-art',
          size: { width: 32, height: 32 },
          action: 'walking',
          description: 'wizard',
          raw: 'wizard walking',
        },
        result: {
          jobId: 'job-7',
          frames: [],
          metadata: {
            dimensions: { width: 32, height: 32 },
            frameCount: 0,
            generationTimeMs: 3000,
            cacheHit: false,
          },
        },
        createdAt: pastDate,
        expiresAt: expiredDate,
        hits: 0,
        lastAccessedAt: pastDate,
      };

      const mockSnapshot: MockDocumentSnapshot = {
        exists: true,
        data: () => storedData,
        id: key,
      };

      (mockDoc.get as Mock).mockResolvedValueOnce(mockSnapshot);

      const result = await firestoreBackup.get(key);

      expect(result).toBeNull();
    });

    it('should handle Firestore connection errors', async () => {
      const key = 'cache:geterror123';

      (mockDoc.get as Mock).mockRejectedValueOnce(new Error('Firestore offline'));

      const result = await firestoreBackup.get(key);

      // Should return null on error (treat as cache miss)
      expect(result).toBeNull();

      // Verify error was logged
      expect(mockLogger.logWarn).toHaveBeenCalledWith(
        'firestore_backup_error',
        expect.objectContaining({
          operation: 'get',
          cacheKey: key,
          error: 'Firestore offline',
        })
      );
    });

    it('should handle malformed data gracefully', async () => {
      const key = 'cache:malformed123';

      const invalidData = {
        // Missing required fields
        userId: 'user-8',
      };

      const mockSnapshot: MockDocumentSnapshot = {
        exists: true,
        data: () => invalidData,
        id: key,
      };

      (mockDoc.get as Mock).mockResolvedValueOnce(mockSnapshot);

      const result = await firestoreBackup.get(key);

      // Should return null for malformed data
      expect(result).toBeNull();

      // Verify error was logged
      expect(mockLogger.logWarn).toHaveBeenCalledWith(
        'firestore_backup_error',
        expect.any(Object)
      );
    });

    it('should return valid entries that have not expired', async () => {
      const key = 'cache:valid123';
      const now = Date.now();
      const futureExpiry = now + 20 * 24 * 60 * 60 * 1000; // 20 days in future

      const storedData = {
        cacheKey: key,
        userId: 'user-9',
        structuredPrompt: {
          type: 'character',
          style: 'pixel-art',
          size: { width: 32, height: 32 },
          action: 'walking',
          description: 'druid',
          raw: 'druid walking',
        },
        result: {
          jobId: 'job-9',
          frames: [Buffer.from('frame-data').toString('base64')],
          metadata: {
            dimensions: { width: 32, height: 32 },
            frameCount: 1,
            generationTimeMs: 4000,
            cacheHit: false,
          },
        },
        createdAt: now,
        expiresAt: futureExpiry,
        hits: 2,
        lastAccessedAt: now - 1000,
      };

      const mockSnapshot: MockDocumentSnapshot = {
        exists: true,
        data: () => storedData,
        id: key,
      };

      (mockDoc.get as Mock).mockResolvedValueOnce(mockSnapshot);

      const result = await firestoreBackup.get(key);

      expect(result).not.toBeNull();
      expect(result?.cacheKey).toBe(key);
      expect(result?.userId).toBe('user-9');
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent writes to same cache key (last write wins)', async () => {
      const key = 'cache:concurrent123';
      const now = Date.now();

      const entry1: CacheEntry = {
        cacheKey: key,
        userId: 'user-10',
        structuredPrompt: {
          type: 'character',
          style: 'pixel-art',
          size: { width: 32, height: 32 },
          action: 'walking',
          description: 'monk v1',
          raw: 'monk walking v1',
        },
        result: {
          jobId: 'job-10',
          frames: [],
          metadata: {
            dimensions: { width: 32, height: 32 },
            frameCount: 0,
            generationTimeMs: 2000,
            cacheHit: false,
          },
        },
        createdAt: now,
        expiresAt: now + 30 * 24 * 60 * 60 * 1000,
        hits: 0,
        lastAccessedAt: now,
      };

      const entry2: CacheEntry = {
        ...entry1,
        structuredPrompt: {
          ...entry1.structuredPrompt,
          description: 'monk v2',
        },
      };

      // Both writes should succeed (last write wins in Firestore)
      await Promise.all([firestoreBackup.set(key, entry1), firestoreBackup.set(key, entry2)]);

      // Verify both writes completed
      expect(mockDoc.set).toHaveBeenCalledTimes(2);
    });

    it('should handle empty frames array', async () => {
      const key = 'cache:empty123';
      const now = Date.now();

      const entry: CacheEntry = {
        cacheKey: key,
        userId: 'user-11',
        structuredPrompt: {
          type: 'character',
          style: 'pixel-art',
          size: { width: 32, height: 32 },
          action: 'walking',
          description: 'ranger',
          raw: 'ranger walking',
        },
        result: {
          jobId: 'job-11',
          frames: [],
          metadata: {
            dimensions: { width: 32, height: 32 },
            frameCount: 0,
            generationTimeMs: 1000,
            cacheHit: false,
          },
        },
        createdAt: now,
        expiresAt: now + 30 * 24 * 60 * 60 * 1000,
        hits: 0,
        lastAccessedAt: now,
      };

      await firestoreBackup.set(key, entry);

      const setCall = (mockDoc.set as Mock).mock.calls[0][0];
      expect(setCall.result.frames).toEqual([]);
    });
  });
});
