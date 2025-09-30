import { describe, it, expect, beforeEach } from 'vitest';
import { CorrelationIdManager, CorrelationContext } from './correlation';

describe('Correlation ID Manager - Task 8.2: Correlation IDs', () => {
  describe('correlation ID generation', () => {
    it('should generate unique correlation ID', () => {
      const id1 = CorrelationIdManager.generate();
      const id2 = CorrelationIdManager.generate();

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
    });

    it('should generate ID in UUID v4 format', () => {
      const id = CorrelationIdManager.generate();

      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(id).toMatch(uuidRegex);
    });

    it('should generate many unique IDs', () => {
      const ids = new Set<string>();

      for (let i = 0; i < 1000; i++) {
        ids.add(CorrelationIdManager.generate());
      }

      expect(ids.size).toBe(1000); // All unique
    });
  });

  describe('context management', () => {
    it('should create context with generated correlation ID', () => {
      const context = CorrelationIdManager.createContext();

      expect(context.correlationId).toBeDefined();
      expect(context.correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(context.timestamp).toBeInstanceOf(Date);
    });

    it('should create context with custom correlation ID', () => {
      const customId = 'custom-correlation-id-123';
      const context = CorrelationIdManager.createContext(customId);

      expect(context.correlationId).toBe(customId);
    });

    it('should include timestamp in context', () => {
      const before = new Date();
      const context = CorrelationIdManager.createContext();
      const after = new Date();

      expect(context.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(context.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should allow optional metadata', () => {
      const context = CorrelationIdManager.createContext(undefined, {
        userId: '12345',
        requestType: 'character-creation',
      });

      expect(context.metadata).toEqual({
        userId: '12345',
        requestType: 'character-creation',
      });
    });

    it('should work without metadata', () => {
      const context = CorrelationIdManager.createContext();

      expect(context.metadata).toBeUndefined();
    });
  });

  describe('header generation', () => {
    it('should generate correlation ID header', () => {
      const correlationId = 'test-correlation-id-123';
      const headers = CorrelationIdManager.toHeaders(correlationId);

      expect(headers).toEqual({
        'X-Correlation-ID': 'test-correlation-id-123',
      });
    });

    it('should use standard header name', () => {
      const headers = CorrelationIdManager.toHeaders('any-id');

      expect(headers).toHaveProperty('X-Correlation-ID');
    });

    it('should handle UUID correlation IDs', () => {
      const uuid = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
      const headers = CorrelationIdManager.toHeaders(uuid);

      expect(headers['X-Correlation-ID']).toBe(uuid);
    });
  });

  describe('context extraction', () => {
    it('should extract correlation ID from headers', () => {
      const headers = {
        'X-Correlation-ID': 'extracted-id-123',
        'Content-Type': 'application/json',
      };

      const id = CorrelationIdManager.extractFromHeaders(headers);

      expect(id).toBe('extracted-id-123');
    });

    it('should return undefined if header not present', () => {
      const headers = {
        'Content-Type': 'application/json',
      };

      const id = CorrelationIdManager.extractFromHeaders(headers);

      expect(id).toBeUndefined();
    });

    it('should handle case-insensitive header names', () => {
      const headers = {
        'x-correlation-id': 'lowercase-id',
      };

      const id = CorrelationIdManager.extractFromHeaders(headers);

      expect(id).toBe('lowercase-id');
    });

    it('should handle mixed-case header names', () => {
      const headers = {
        'X-CORRELATION-ID': 'uppercase-id',
      };

      const id = CorrelationIdManager.extractFromHeaders(headers);

      expect(id).toBe('uppercase-id');
    });

    it('should handle empty headers object', () => {
      const id = CorrelationIdManager.extractFromHeaders({});

      expect(id).toBeUndefined();
    });
  });

  describe('log enrichment', () => {
    it('should enrich log data with correlation ID', () => {
      const correlationId = 'log-correlation-123';
      const logData = {
        level: 'info',
        message: 'Test message',
      };

      const enriched = CorrelationIdManager.enrichLogData(correlationId, logData);

      expect(enriched).toEqual({
        level: 'info',
        message: 'Test message',
        correlationId: 'log-correlation-123',
      });
    });

    it('should preserve existing log data fields', () => {
      const logData = {
        level: 'error',
        message: 'Error occurred',
        statusCode: 500,
        duration: 1234,
      };

      const enriched = CorrelationIdManager.enrichLogData('corr-id', logData);

      expect(enriched.level).toBe('error');
      expect(enriched.message).toBe('Error occurred');
      expect(enriched.statusCode).toBe(500);
      expect(enriched.duration).toBe(1234);
      expect(enriched.correlationId).toBe('corr-id');
    });

    it('should not modify original log data object', () => {
      const logData = {
        level: 'info',
        message: 'Test',
      };

      const original = { ...logData };
      CorrelationIdManager.enrichLogData('id', logData);

      expect(logData).toEqual(original); // Original unchanged
    });

    it('should handle empty log data', () => {
      const enriched = CorrelationIdManager.enrichLogData('id-123', {});

      expect(enriched).toEqual({
        correlationId: 'id-123',
      });
    });
  });

  describe('context validation', () => {
    it('should validate correlation ID format', () => {
      const validId = '12345678-1234-4123-8123-123456789012';
      expect(CorrelationIdManager.isValidFormat(validId)).toBe(true);
    });

    it('should reject invalid UUID format', () => {
      expect(CorrelationIdManager.isValidFormat('invalid-id')).toBe(false);
      expect(CorrelationIdManager.isValidFormat('')).toBe(false);
      expect(CorrelationIdManager.isValidFormat('12345')).toBe(false);
    });

    it('should accept custom format IDs', () => {
      // Allow non-UUID formats for custom correlation IDs
      const customId = 'request-12345-session-67890';
      expect(CorrelationIdManager.isValidFormat(customId, false)).toBe(true);
    });

    it('should reject empty or whitespace-only IDs', () => {
      expect(CorrelationIdManager.isValidFormat('', false)).toBe(false);
      expect(CorrelationIdManager.isValidFormat('   ', false)).toBe(false);
    });
  });

  describe('chained request tracking', () => {
    it('should create child context from parent', () => {
      const parent = CorrelationIdManager.createContext();
      const child = CorrelationIdManager.createChildContext(parent);

      expect(child.correlationId).toBeDefined();
      expect(child.correlationId).not.toBe(parent.correlationId);
      expect(child.parentCorrelationId).toBe(parent.correlationId);
    });

    it('should preserve parent metadata in child', () => {
      const parent = CorrelationIdManager.createContext(undefined, {
        userId: '123',
        sessionId: 'session-456',
      });

      const child = CorrelationIdManager.createChildContext(parent, {
        requestType: 'animation',
      });

      expect(child.metadata).toEqual({
        userId: '123',
        sessionId: 'session-456',
        requestType: 'animation',
      });
    });

    it('should allow overriding parent metadata in child', () => {
      const parent = CorrelationIdManager.createContext(undefined, {
        requestType: 'character',
      });

      const child = CorrelationIdManager.createChildContext(parent, {
        requestType: 'animation',
      });

      expect(child.metadata?.requestType).toBe('animation');
    });

    it('should track request depth', () => {
      const parent = CorrelationIdManager.createContext();
      const child1 = CorrelationIdManager.createChildContext(parent);
      const child2 = CorrelationIdManager.createChildContext(child1);

      expect(parent.depth).toBe(0);
      expect(child1.depth).toBe(1);
      expect(child2.depth).toBe(2);
    });
  });

  describe('integration scenarios', () => {
    it('should support full request lifecycle', () => {
      // 1. Create context for incoming request
      const context = CorrelationIdManager.createContext(undefined, {
        userId: 'user-123',
        endpoint: '/api/characters',
      });

      // 2. Generate headers for outgoing request
      const headers = CorrelationIdManager.toHeaders(context.correlationId);
      expect(headers['X-Correlation-ID']).toBe(context.correlationId);

      // 3. Enrich log data
      const logData = CorrelationIdManager.enrichLogData(context.correlationId, {
        level: 'info',
        message: 'Creating character',
      });
      expect(logData.correlationId).toBe(context.correlationId);

      // 4. Create child context for nested operation
      const childContext = CorrelationIdManager.createChildContext(context);
      expect(childContext.parentCorrelationId).toBe(context.correlationId);
    });

    it('should support extracting and propagating correlation ID', () => {
      // Incoming request with correlation ID header
      const incomingHeaders = {
        'X-Correlation-ID': 'incoming-request-123',
        'Content-Type': 'application/json',
      };

      // Extract correlation ID
      const extractedId = CorrelationIdManager.extractFromHeaders(incomingHeaders);
      expect(extractedId).toBe('incoming-request-123');

      // Create context with extracted ID
      const context = CorrelationIdManager.createContext(extractedId!);
      expect(context.correlationId).toBe('incoming-request-123');

      // Propagate to outgoing request
      const outgoingHeaders = CorrelationIdManager.toHeaders(context.correlationId);
      expect(outgoingHeaders['X-Correlation-ID']).toBe('incoming-request-123');
    });
  });

  describe('edge cases', () => {
    it('should handle undefined correlation ID gracefully', () => {
      const headers = CorrelationIdManager.toHeaders(undefined as any);
      expect(headers['X-Correlation-ID']).toBeUndefined();
    });

    it('should handle null metadata gracefully', () => {
      const context = CorrelationIdManager.createContext(undefined, null as any);
      expect(context.metadata).toBeNull();
    });

    it('should handle very long correlation IDs', () => {
      const longId = 'a'.repeat(1000);
      const headers = CorrelationIdManager.toHeaders(longId);
      expect(headers['X-Correlation-ID']).toBe(longId);
    });

    it('should handle special characters in correlation ID', () => {
      const specialId = 'request-#123-@user-456';
      const context = CorrelationIdManager.createContext(specialId);
      expect(context.correlationId).toBe(specialId);
    });
  });
});
