/**
 * Task 2.2: Cache Key Generation
 *
 * Generates consistent, collision-resistant cache keys using SHA-256 hash.
 * Ensures different users get different cache entries for the same prompt.
 */

import { createHash } from 'crypto';

/**
 * Generates cache keys for deduplication and caching
 *
 * Responsibilities:
 * - Concatenate normalized prompt + userId
 * - Generate SHA-256 hash of concatenated string
 * - Return hash as hexadecimal string
 * - Ensure deterministic output for identical inputs
 * - Handle non-ASCII characters correctly (UTF-8 encoding)
 */
export class CacheKeyGenerator {
  /**
   * Generate a cache key from normalized prompt and user ID
   *
   * @param normalizedPrompt - Normalized prompt string (from RequestNormalizer)
   * @param userId - User identifier
   * @returns SHA-256 hash as 64-character lowercase hexadecimal string
   *
   * @example
   * ```typescript
   * const normalizedPrompt = '{"action":"walking","description":"a brave knight",...}';
   * const userId = 'user123';
   *
   * const cacheKey = CacheKeyGenerator.generate(normalizedPrompt, userId);
   * // Returns: "a1b2c3d4..." (64-character hex string)
   * ```
   *
   * @remarks
   * - Uses SHA-256 for collision resistance (256 bits = 64 hex chars)
   * - Concatenation order: normalizedPrompt + userId
   * - Handles Unicode/UTF-8 correctly via Node.js Buffer encoding
   * - Produces identical keys for identical inputs (deterministic)
   * - Produces different keys for different users (privacy)
   */
  public static generate(normalizedPrompt: string, userId: string): string {
    // Concatenate normalized prompt and userId
    // Order matters: prompt + user (not user + prompt)
    const concatenated = normalizedPrompt + userId;

    // Generate SHA-256 hash
    // Node.js createHash automatically handles UTF-8 encoding
    const hash = createHash('sha256')
      .update(concatenated) // UTF-8 encoded by default
      .digest('hex'); // Return as lowercase hexadecimal string

    return hash;
  }
}
