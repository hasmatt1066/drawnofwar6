import { PixelLabError, PixelLabErrorType } from './errors';

/**
 * PNG magic bytes (file signature)
 * 89 50 4E 47 0D 0A 1A 0A
 */
const PNG_MAGIC_BYTES = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * Minimum valid PNG size (header + minimal IHDR + IEND)
 */
const MIN_PNG_SIZE = 8;

/**
 * Image Decoder for PixelLab API
 *
 * Handles decoding of base64-encoded PNG images from API responses.
 * Validates that decoded data is valid PNG format.
 */
export class ImageDecoder {
  /**
   * Decode single base64 image string to buffer
   *
   * @param base64 - Base64-encoded PNG string
   * @returns Decoded PNG buffer
   * @throws {PixelLabError} If base64 is invalid or not PNG
   */
  public static decodeBase64(base64: string): Buffer {
    // Validate input
    if (!base64 || typeof base64 !== 'string') {
      throw new PixelLabError({
        type: PixelLabErrorType.INVALID_REQUEST,
        message: 'Base64 string is required',
        retryable: false,
      });
    }

    // Strip whitespace and newlines
    const cleaned = base64.trim().replace(/\s+/g, '');

    if (cleaned.length === 0) {
      throw new PixelLabError({
        type: PixelLabErrorType.INVALID_REQUEST,
        message: 'Base64 string cannot be empty',
        retryable: false,
      });
    }

    // Decode base64 to buffer
    let buffer: Buffer;
    try {
      buffer = Buffer.from(cleaned, 'base64');
    } catch (error) {
      throw new PixelLabError({
        type: PixelLabErrorType.INVALID_REQUEST,
        message: 'Invalid base64 format',
        retryable: false,
        originalError: error as Error,
      });
    }

    // Validate PNG format
    this.validatePngBuffer(buffer);

    return buffer;
  }

  /**
   * Decode array of base64 image strings to buffers
   *
   * @param base64Array - Array of base64-encoded PNG strings
   * @returns Array of decoded PNG buffers in same order
   * @throws {PixelLabError} If any base64 is invalid or not PNG
   */
  public static decodeBase64Array(base64Array: string[]): Buffer[] {
    if (!Array.isArray(base64Array)) {
      throw new PixelLabError({
        type: PixelLabErrorType.INVALID_REQUEST,
        message: 'Input must be an array',
        retryable: false,
      });
    }

    // Decode each element, preserving order
    return base64Array.map((base64, index) => {
      try {
        return this.decodeBase64(base64);
      } catch (error) {
        // Add index to error message for debugging
        if (error instanceof PixelLabError) {
          const options: any = {
            type: error.type,
            message: `Error decoding image at index ${index}: ${error.message}`,
            retryable: error.retryable,
          };
          if (error.originalError) {
            options.originalError = error.originalError;
          }
          throw new PixelLabError(options);
        }
        throw error;
      }
    });
  }

  /**
   * Validate that buffer contains valid PNG data
   * Checks PNG magic bytes and minimum size
   *
   * @param buffer - Buffer to validate
   * @throws {PixelLabError} If not valid PNG
   */
  private static validatePngBuffer(buffer: Buffer): void {
    // Check minimum size
    if (buffer.length < MIN_PNG_SIZE) {
      throw new PixelLabError({
        type: PixelLabErrorType.INVALID_REQUEST,
        message: `Not a valid PNG: file too small (${buffer.length} bytes, minimum ${MIN_PNG_SIZE})`,
        retryable: false,
      });
    }

    // Check PNG magic bytes
    for (let i = 0; i < PNG_MAGIC_BYTES.length; i++) {
      if (buffer[i] !== PNG_MAGIC_BYTES[i]) {
        throw new PixelLabError({
          type: PixelLabErrorType.INVALID_REQUEST,
          message: `Not a valid PNG: invalid magic bytes at position ${i}`,
          retryable: false,
        });
      }
    }
  }

  /**
   * Check if buffer is valid PNG (non-throwing)
   *
   * @param buffer - Buffer to check
   * @returns true if valid PNG, false otherwise
   */
  public static isPng(buffer: Buffer): boolean {
    try {
      this.validatePngBuffer(buffer);
      return true;
    } catch {
      return false;
    }
  }
}
