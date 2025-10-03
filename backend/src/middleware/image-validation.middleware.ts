/**
 * Image Validation Middleware
 *
 * Validates uploaded image files for type, size, and content.
 * Sanitizes file metadata to prevent security issues.
 */

import type { Request, Response, NextFunction } from 'express';
import { inputNormalizer } from '../services/input/normalizer.service.js';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];

export async function validateImageUpload(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const file = req.file;

    // Check if file exists
    if (!file) {
      res.status(400).json({
        error: 'No image file provided',
        code: 'MISSING_FILE'
      });
      return;
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      res.status(400).json({
        error: `Invalid file type: ${file.mimetype}. Only PNG and JPEG are allowed.`,
        code: 'INVALID_FILE_TYPE',
        allowedTypes: ALLOWED_MIME_TYPES
      });
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      res.status(400).json({
        error: `File too large: ${file.size} bytes. Maximum size is ${
          MAX_FILE_SIZE / 1024 / 1024
        }MB.`,
        code: 'FILE_TOO_LARGE',
        maxSize: MAX_FILE_SIZE
      });
      return;
    }

    // Validate that file is actually a valid image
    const isValid = await inputNormalizer.validateImage(file.buffer);
    if (!isValid) {
      res.status(400).json({
        error: 'Invalid or corrupted image file',
        code: 'INVALID_IMAGE'
      });
      return;
    }

    // Get image dimensions to ensure it's processable
    try {
      const dimensions = await inputNormalizer.getImageDimensions(file.buffer);

      // Check minimum dimensions (at least 16x16)
      if (dimensions.width < 16 || dimensions.height < 16) {
        res.status(400).json({
          error: 'Image too small. Minimum size is 16x16 pixels.',
          code: 'IMAGE_TOO_SMALL',
          dimensions
        });
        return;
      }

      // Check maximum dimensions (max 4096x4096)
      const maxDimension = 4096;
      if (dimensions.width > maxDimension || dimensions.height > maxDimension) {
        res.status(400).json({
          error: `Image too large. Maximum dimensions are ${maxDimension}x${maxDimension} pixels.`,
          code: 'IMAGE_TOO_LARGE',
          dimensions
        });
        return;
      }

      // Attach dimensions to request for later use
      req.body.imageDimensions = dimensions;
    } catch (error) {
      res.status(400).json({
        error: 'Unable to process image dimensions',
        code: 'DIMENSION_ERROR'
      });
      return;
    }

    // Sanitize filename (remove path traversal attempts)
    if (file.originalname) {
      file.originalname = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    }

    // All validation passed
    next();
  } catch (error: any) {
    console.error('[Image Validation] Error:', error);
    res.status(500).json({
      error: 'An error occurred during image validation',
      code: 'VALIDATION_ERROR'
    });
  }
}

/**
 * Validate data URL (for canvas blobs)
 */
export function validateDataUrl(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    const { imageData } = req.body;

    if (!imageData) {
      res.status(400).json({
        error: 'No image data provided',
        code: 'MISSING_IMAGE_DATA'
      });
      return;
    }

    // Validate data URL format
    if (!imageData.startsWith('data:image/')) {
      res.status(400).json({
        error: 'Invalid data URL format. Must start with "data:image/"',
        code: 'INVALID_DATA_URL'
      });
      return;
    }

    // Check if it's a supported format
    const formatMatch = imageData.match(/^data:image\/(png|jpeg|jpg);base64,/);
    if (!formatMatch) {
      res.status(400).json({
        error: 'Unsupported image format in data URL. Only PNG and JPEG are allowed.',
        code: 'UNSUPPORTED_FORMAT'
      });
      return;
    }

    // Validate base64 data exists
    const base64Data = imageData.split(',')[1];
    if (!base64Data || base64Data.length === 0) {
      res.status(400).json({
        error: 'Empty or invalid base64 data',
        code: 'INVALID_BASE64'
      });
      return;
    }

    // Check approximate size (base64 is ~33% larger than binary)
    const approximateSize = (base64Data.length * 3) / 4;
    if (approximateSize > MAX_FILE_SIZE) {
      res.status(400).json({
        error: `Image data too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
        code: 'DATA_TOO_LARGE'
      });
      return;
    }

    next();
  } catch (error: any) {
    console.error('[Data URL Validation] Error:', error);
    res.status(500).json({
      error: 'An error occurred during data URL validation',
      code: 'VALIDATION_ERROR'
    });
  }
}
