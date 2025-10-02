/**
 * Input Normalization Service
 *
 * Normalizes all visual inputs (canvas drawings, uploaded images) to 512x512 PNG format.
 * Uses Sharp library for high-performance image processing.
 */

import sharp from 'sharp';
import type {
  ImageMetadata,
  NormalizedImage,
  NormalizationOptions
} from '../../types/input';

const DEFAULT_TARGET_SIZE = 512;
const DEFAULT_BACKGROUND_COLOR = { r: 255, g: 255, b: 255, alpha: 1 };

export class InputNormalizerService {
  /**
   * Normalize an image buffer to target size (default 512x512)
   */
  async normalizeImage(
    inputBuffer: Buffer,
    options: NormalizationOptions = {}
  ): Promise<NormalizedImage> {
    const {
      targetSize = DEFAULT_TARGET_SIZE,
      maintainAspectRatio = true,
      backgroundColor = '#FFFFFF',
      format = 'png',
      quality = 90
    } = options;

    // Get original image metadata
    const originalMetadata = await sharp(inputBuffer).metadata();

    if (!originalMetadata.width || !originalMetadata.height) {
      throw new Error('Invalid image: unable to determine dimensions');
    }

    // Prepare Sharp pipeline
    let pipeline = sharp(inputBuffer);

    // Resize with aspect ratio preservation
    if (maintainAspectRatio) {
      pipeline = pipeline.resize(targetSize, targetSize, {
        fit: 'contain',
        background: this.parseBackgroundColor(backgroundColor)
      });
    } else {
      pipeline = pipeline.resize(targetSize, targetSize, {
        fit: 'fill'
      });
    }

    // Convert to specified format
    if (format === 'png') {
      pipeline = pipeline.png({ compressionLevel: 9 });
    } else {
      pipeline = pipeline.jpeg({ quality });
    }

    // Process image
    const processedBuffer = await pipeline.toBuffer();
    const processedMetadata = await sharp(processedBuffer).metadata();

    // Convert to base64
    const base64 = `data:image/${format};base64,${processedBuffer.toString('base64')}`;

    // Build metadata
    const metadata: ImageMetadata = {
      originalWidth: originalMetadata.width,
      originalHeight: originalMetadata.height,
      originalFormat: originalMetadata.format || 'unknown',
      normalizedWidth: processedMetadata.width || targetSize,
      normalizedHeight: processedMetadata.height || targetSize,
      fileSize: processedBuffer.length,
      hasAlpha: originalMetadata.hasAlpha || false
    };

    return {
      base64,
      metadata
    };
  }

  /**
   * Normalize from base64 data URL
   */
  async normalizeFromDataUrl(
    dataUrl: string,
    options: NormalizationOptions = {}
  ): Promise<NormalizedImage> {
    // Extract base64 data from data URL
    const base64Data = dataUrl.split(',')[1];
    if (!base64Data) {
      throw new Error('Invalid data URL format');
    }

    const buffer = Buffer.from(base64Data, 'base64');
    return this.normalizeImage(buffer, options);
  }

  /**
   * Normalize from file upload
   */
  async normalizeFromFile(
    file: Express.Multer.File,
    options: NormalizationOptions = {}
  ): Promise<NormalizedImage> {
    // Validate file type
    const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new Error(`Invalid file type: ${file.mimetype}. Allowed: PNG, JPEG`);
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error(`File too large: ${file.size} bytes. Maximum: ${maxSize} bytes`);
    }

    return this.normalizeImage(file.buffer, options);
  }

  /**
   * Validate image format
   */
  async validateImage(buffer: Buffer): Promise<boolean> {
    try {
      const metadata = await sharp(buffer).metadata();
      return !!(metadata.width && metadata.height && metadata.format);
    } catch (error) {
      return false;
    }
  }

  /**
   * Parse background color string to Sharp color object
   */
  private parseBackgroundColor(color: string): { r: number; g: number; b: number; alpha: number } {
    // Simple hex color parser
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return { r, g, b, alpha: 1 };
    }

    // Default to white
    return DEFAULT_BACKGROUND_COLOR;
  }

  /**
   * Get image dimensions without full processing
   */
  async getImageDimensions(buffer: Buffer): Promise<{ width: number; height: number }> {
    const metadata = await sharp(buffer).metadata();
    if (!metadata.width || !metadata.height) {
      throw new Error('Unable to determine image dimensions');
    }
    return {
      width: metadata.width,
      height: metadata.height
    };
  }
}

// Export singleton instance
export const inputNormalizer = new InputNormalizerService();
