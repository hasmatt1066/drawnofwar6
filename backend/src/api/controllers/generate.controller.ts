/**
 * Generate Controller
 *
 * Handles creature generation requests across all input types.
 * Normalizes inputs and submits jobs to the generation queue.
 */

import type { Request, Response, NextFunction } from 'express';
import { inputNormalizer } from '../../services/input/normalizer.service.js';
import type { NormalizedImage } from '../../types/input/index.js';

/**
 * Main generation controller
 * Handles text, draw, and upload input types
 */
export async function generateController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { inputType } = req.body;

    console.log(`[Generate] Received ${inputType} request`);

    let normalizedImage: NormalizedImage | null = null;
    let textDescription: string | null = null;

    // Process based on input type
    switch (inputType) {
      case 'text':
        textDescription = req.body.description;

        // Validate text description
        if (!textDescription || textDescription.trim().length === 0) {
          res.status(400).json({
            error: 'Missing Description',
            message: 'Text description is required for text input',
            code: 'MISSING_DESCRIPTION'
          });
          return;
        }

        if (textDescription.length < 10) {
          res.status(400).json({
            error: 'Description Too Short',
            message: 'Description must be at least 10 characters',
            code: 'DESCRIPTION_TOO_SHORT',
            length: textDescription.length,
            minimum: 10
          });
          return;
        }

        if (textDescription.length > 500) {
          res.status(400).json({
            error: 'Description Too Long',
            message: 'Description must not exceed 500 characters',
            code: 'DESCRIPTION_TOO_LONG',
            length: textDescription.length,
            maximum: 500
          });
          return;
        }

        console.log(`[Generate] Text description: ${textDescription.substring(0, 50)}...`);
        break;

      case 'draw':
        const imageData = req.body.imageData;

        // Normalize canvas data URL to 512x512 PNG
        try {
          normalizedImage = await inputNormalizer.normalizeFromDataUrl(imageData);
          console.log(`[Generate] Normalized canvas drawing to ${normalizedImage.metadata.normalizedWidth}x${normalizedImage.metadata.normalizedHeight}`);
        } catch (error: any) {
          res.status(400).json({
            error: 'Invalid Canvas Data',
            message: error.message || 'Failed to process canvas drawing',
            code: 'INVALID_CANVAS_DATA'
          });
          return;
        }
        break;

      case 'upload':
        const file = req.file;

        if (!file) {
          res.status(400).json({
            error: 'Missing File',
            message: 'No image file was uploaded',
            code: 'MISSING_FILE'
          });
          return;
        }

        // Normalize uploaded file to 512x512 PNG
        try {
          normalizedImage = await inputNormalizer.normalizeFromFile(file);
          console.log(`[Generate] Normalized uploaded image (${file.originalname}) to ${normalizedImage.metadata.normalizedWidth}x${normalizedImage.metadata.normalizedHeight}`);
        } catch (error: any) {
          res.status(400).json({
            error: 'Invalid Image File',
            message: error.message || 'Failed to process uploaded image',
            code: 'INVALID_IMAGE_FILE'
          });
          return;
        }
        break;

      default:
        res.status(400).json({
          error: 'Invalid Input Type',
          message: `Unknown input type: ${inputType}`,
          code: 'INVALID_INPUT_TYPE'
        });
        return;
    }

    // TODO: Submit to BullMQ queue
    // For now, return a mock response
    const mockJobId = `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    console.log(`[Generate] Job created: ${mockJobId}`);

    res.status(202).json({
      jobId: mockJobId,
      status: 'queued',
      message: 'Generation job created successfully',
      inputType,
      ...(textDescription && { description: textDescription.substring(0, 100) }),
      ...(normalizedImage && {
        imageMetadata: {
          originalSize: `${normalizedImage.metadata.originalWidth}x${normalizedImage.metadata.originalHeight}`,
          normalizedSize: `${normalizedImage.metadata.normalizedWidth}x${normalizedImage.metadata.normalizedHeight}`,
          format: normalizedImage.metadata.originalFormat,
          fileSize: normalizedImage.metadata.fileSize
        }
      })
    });
  } catch (error: any) {
    console.error('[Generate] Error:', error);
    next(error);
  }
}
