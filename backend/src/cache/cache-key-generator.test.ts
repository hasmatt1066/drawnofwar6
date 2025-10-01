/**
 * Task 2.2: Cache Key Generation Tests
 *
 * Tests for generating consistent, collision-resistant cache keys using SHA-256 hash.
 * Following TDD: tests written BEFORE implementation.
 */

import { describe, it, expect } from 'vitest';
import { CacheKeyGenerator } from './cache-key-generator.js';

describe('CacheKeyGenerator', () => {
  describe('generate', () => {
    // Consistency tests
    describe('deterministic hashing', () => {
      it('should generate consistent hash for same input', () => {
        const normalizedPrompt = '{"action":"walking","description":"a brave knight","raw":"brave knight walking","size":{"height":32,"width":32},"style":"pixel-art","type":"character"}';
        const userId = 'user123';

        const hash1 = CacheKeyGenerator.generate(normalizedPrompt, userId);
        const hash2 = CacheKeyGenerator.generate(normalizedPrompt, userId);

        expect(hash1).toBe(hash2);
      });

      it('should generate same hash when called multiple times', () => {
        const normalizedPrompt = '{"action":"idle","description":"a wizard","raw":"wizard idle","size":{"height":64,"width":64},"style":"pixel-art","type":"character"}';
        const userId = 'user456';

        const hashes = [];
        for (let i = 0; i < 10; i++) {
          hashes.push(CacheKeyGenerator.generate(normalizedPrompt, userId));
        }

        // All hashes should be identical
        const uniqueHashes = new Set(hashes);
        expect(uniqueHashes.size).toBe(1);
      });
    });

    // Different inputs should produce different hashes
    describe('collision resistance', () => {
      it('should generate different hash for different prompts', () => {
        const prompt1 = '{"action":"walking","description":"a brave knight","raw":"brave knight walking","size":{"height":32,"width":32},"style":"pixel-art","type":"character"}';
        const prompt2 = '{"action":"running","description":"a brave knight","raw":"brave knight running","size":{"height":32,"width":32},"style":"pixel-art","type":"character"}';
        const userId = 'user123';

        const hash1 = CacheKeyGenerator.generate(prompt1, userId);
        const hash2 = CacheKeyGenerator.generate(prompt2, userId);

        expect(hash1).not.toBe(hash2);
      });

      it('should generate different hash for different users', () => {
        const normalizedPrompt = '{"action":"walking","description":"a brave knight","raw":"brave knight walking","size":{"height":32,"width":32},"style":"pixel-art","type":"character"}';
        const userId1 = 'user123';
        const userId2 = 'user456';

        const hash1 = CacheKeyGenerator.generate(normalizedPrompt, userId1);
        const hash2 = CacheKeyGenerator.generate(normalizedPrompt, userId2);

        expect(hash1).not.toBe(hash2);
      });

      it('should generate different hash for slightly different prompts', () => {
        const prompt1 = '{"action":"walking","description":"a brave knight","raw":"brave knight walking","size":{"height":32,"width":32},"style":"pixel-art","type":"character"}';
        const prompt2 = '{"action":"walking","description":"a brave knight ","raw":"brave knight walking","size":{"height":32,"width":32},"style":"pixel-art","type":"character"}'; // Extra space
        const userId = 'user123';

        const hash1 = CacheKeyGenerator.generate(prompt1, userId);
        const hash2 = CacheKeyGenerator.generate(prompt2, userId);

        expect(hash1).not.toBe(hash2);
      });
    });

    // Hash format tests
    describe('hash format', () => {
      it('should produce 64-character hex string (SHA-256)', () => {
        const normalizedPrompt = '{"action":"walking","description":"a brave knight","raw":"brave knight walking","size":{"height":32,"width":32},"style":"pixel-art","type":"character"}';
        const userId = 'user123';

        const hash = CacheKeyGenerator.generate(normalizedPrompt, userId);

        // SHA-256 produces 256 bits = 32 bytes = 64 hex characters
        expect(hash).toHaveLength(64);
      });

      it('should contain only hexadecimal characters', () => {
        const normalizedPrompt = '{"action":"walking","description":"a brave knight","raw":"brave knight walking","size":{"height":32,"width":32},"style":"pixel-art","type":"character"}';
        const userId = 'user123';

        const hash = CacheKeyGenerator.generate(normalizedPrompt, userId);

        // Should only contain 0-9 and a-f (lowercase hex)
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
      });

      it('should be lowercase hexadecimal', () => {
        const normalizedPrompt = '{"action":"walking","description":"a brave knight","raw":"brave knight walking","size":{"height":32,"width":32},"style":"pixel-art","type":"character"}';
        const userId = 'user123';

        const hash = CacheKeyGenerator.generate(normalizedPrompt, userId);

        // Should not contain uppercase letters
        expect(hash).toBe(hash.toLowerCase());
      });
    });

    // Unicode handling
    describe('unicode character handling', () => {
      it('should handle Unicode characters correctly (UTF-8 encoding)', () => {
        const prompt1 = '{"action":"walking","description":"a brave knight 🗡️","raw":"brave knight walking","size":{"height":32,"width":32},"style":"pixel-art","type":"character"}';
        const prompt2 = '{"action":"walking","description":"a brave knight 🗡️","raw":"brave knight walking","size":{"height":32,"width":32},"style":"pixel-art","type":"character"}';
        const userId = 'user123';

        const hash1 = CacheKeyGenerator.generate(prompt1, userId);
        const hash2 = CacheKeyGenerator.generate(prompt2, userId);

        // Same Unicode input should produce same hash
        expect(hash1).toBe(hash2);
      });

      it('should handle different Unicode characters differently', () => {
        const prompt1 = '{"action":"walking","description":"a brave knight 🗡️","raw":"brave knight walking","size":{"height":32,"width":32},"style":"pixel-art","type":"character"}';
        const prompt2 = '{"action":"walking","description":"a brave knight ⚔️","raw":"brave knight walking","size":{"height":32,"width":32},"style":"pixel-art","type":"character"}';
        const userId = 'user123';

        const hash1 = CacheKeyGenerator.generate(prompt1, userId);
        const hash2 = CacheKeyGenerator.generate(prompt2, userId);

        // Different Unicode characters should produce different hashes
        expect(hash1).not.toBe(hash2);
      });

      it('should handle Japanese characters', () => {
        const prompt = '{"action":"walking","description":"勇敢な騎士","raw":"brave knight walking","size":{"height":32,"width":32},"style":"pixel-art","type":"character"}';
        const userId = 'user123';

        const hash = CacheKeyGenerator.generate(prompt, userId);

        // Should produce valid hash
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
      });

      it('should handle Arabic characters', () => {
        const prompt = '{"action":"walking","description":"فارس شجاع","raw":"brave knight walking","size":{"height":32,"width":32},"style":"pixel-art","type":"character"}';
        const userId = 'user123';

        const hash = CacheKeyGenerator.generate(prompt, userId);

        // Should produce valid hash
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
      });

      it('should handle mixed Unicode scripts', () => {
        const prompt = '{"action":"walking","description":"brave勇敢فارس🗡️","raw":"brave knight walking","size":{"height":32,"width":32},"style":"pixel-art","type":"character"}';
        const userId = 'user123';

        const hash = CacheKeyGenerator.generate(prompt, userId);

        // Should produce valid hash
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
      });
    });

    // User ID inclusion
    describe('userId incorporation', () => {
      it('should include userId in hash computation', () => {
        const normalizedPrompt = '{"action":"walking","description":"a brave knight","raw":"brave knight walking","size":{"height":32,"width":32},"style":"pixel-art","type":"character"}';
        const userId1 = 'alice';
        const userId2 = 'bob';

        const hash1 = CacheKeyGenerator.generate(normalizedPrompt, userId1);
        const hash2 = CacheKeyGenerator.generate(normalizedPrompt, userId2);

        // Different users should get different hashes for the same prompt
        expect(hash1).not.toBe(hash2);
      });

      it('should generate different hashes for user IDs that are substrings', () => {
        const normalizedPrompt = '{"action":"walking","description":"a brave knight","raw":"brave knight walking","size":{"height":32,"width":32},"style":"pixel-art","type":"character"}';
        const userId1 = 'user';
        const userId2 = 'user123';

        const hash1 = CacheKeyGenerator.generate(normalizedPrompt, userId1);
        const hash2 = CacheKeyGenerator.generate(normalizedPrompt, userId2);

        expect(hash1).not.toBe(hash2);
      });
    });

    // Edge cases
    describe('edge cases', () => {
      it('should handle empty normalized prompt', () => {
        const normalizedPrompt = '';
        const userId = 'user123';

        const hash = CacheKeyGenerator.generate(normalizedPrompt, userId);

        // Should still produce valid hash
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
      });

      it('should handle very long normalized prompt', () => {
        // Create a very long prompt (10KB of text)
        const longDescription = 'a'.repeat(10000);
        const normalizedPrompt = `{"action":"walking","description":"${longDescription}","raw":"brave knight walking","size":{"height":32,"width":32},"style":"pixel-art","type":"character"}`;
        const userId = 'user123';

        const hash = CacheKeyGenerator.generate(normalizedPrompt, userId);

        // SHA-256 should handle any input length
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
        expect(hash).toHaveLength(64);
      });

      it('should handle special characters in prompt', () => {
        const normalizedPrompt = '{"action":"walking","description":"a \\"brave\\" knight with \\n newlines \\t tabs","raw":"brave knight walking","size":{"height":32,"width":32},"style":"pixel-art","type":"character"}';
        const userId = 'user123';

        const hash = CacheKeyGenerator.generate(normalizedPrompt, userId);

        // Should produce valid hash
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
      });

      it('should handle special characters in userId', () => {
        const normalizedPrompt = '{"action":"walking","description":"a brave knight","raw":"brave knight walking","size":{"height":32,"width":32},"style":"pixel-art","type":"character"}';
        const userId = 'user@example.com';

        const hash = CacheKeyGenerator.generate(normalizedPrompt, userId);

        // Should produce valid hash
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
      });

      it('should handle numeric-like strings differently from numbers', () => {
        const prompt = '{"size":{"height":"32","width":"32"}}'; // Strings instead of numbers
        const userId = 'user123';

        const hash = CacheKeyGenerator.generate(prompt, userId);

        // Should produce valid hash
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
      });
    });

    // Known hash values for regression testing
    describe('regression tests', () => {
      it('should produce known hash for specific input (regression test)', () => {
        // This test ensures the hash algorithm doesn't change unexpectedly
        const normalizedPrompt = '{"action":"walking","description":"a brave knight","raw":"brave knight walking","size":{"height":32,"width":32},"style":"pixel-art","type":"character"}';
        const userId = 'test-user';

        const hash = CacheKeyGenerator.generate(normalizedPrompt, userId);

        // This hash was computed once and should remain stable
        // If this test fails, the hashing algorithm has changed
        const expectedHash = require('crypto')
          .createHash('sha256')
          .update(normalizedPrompt + userId)
          .digest('hex');

        expect(hash).toBe(expectedHash);
      });
    });

    // Concatenation order
    describe('concatenation order', () => {
      it('should concatenate prompt + userId (not userId + prompt)', () => {
        const normalizedPrompt = 'prompt';
        const userId = 'user';

        const hash = CacheKeyGenerator.generate(normalizedPrompt, userId);

        // Should hash "promptuser" not "userprompt"
        const expectedHash = require('crypto')
          .createHash('sha256')
          .update('promptuser')
          .digest('hex');

        expect(hash).toBe(expectedHash);
      });
    });
  });
});
