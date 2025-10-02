/**
 * Enhanced Generate Controller (Phase 2)
 *
 * Integrates Claude Vision, Animation Mapping, and Style Validation.
 * Handles complete multi-modal creature generation pipeline.
 */

import type { Request, Response, NextFunction } from 'express';
import { inputNormalizer } from '../../services/input/normalizer.service.js';
import { claudeVisionService } from '../../services/claude/vision.service.js';
import { queueService } from '../../queue/index.js';
import type { NormalizedImage } from '../../types/input/index.js';
import type { GenerationJobData } from '../../queue/generation-processor.js';

/**
 * Enhanced generation controller with Claude Vision integration
 * Handles text, draw, and upload input types with full AI analysis
 */
export async function generateEnhancedController(
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> {
  const startTime = Date.now();

  try {
    const { inputType } = req.body;

    console.log(`[Generate Enhanced] Received ${inputType} request`);

    let normalizedImage: NormalizedImage | null = null;
    let textDescription: string | null = null;

    // ===== INPUT VALIDATION & NORMALIZATION =====

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

        console.log(`[Generate Enhanced] Text description: ${textDescription.substring(0, 50)}...`);
        break;

      case 'draw':
        const imageData = req.body.imageData;

        // Normalize canvas data URL to 512x512 PNG
        try {
          normalizedImage = await inputNormalizer.normalizeFromDataUrl(imageData);
          console.log(`[Generate Enhanced] Normalized canvas drawing to ${normalizedImage.metadata.normalizedWidth}x${normalizedImage.metadata.normalizedHeight}`);
        } catch (error: any) {
          res.status(400).json({
            error: 'Invalid Canvas Data',
            message: error.message || 'Failed to process canvas drawing',
            code: 'INVALID_CANVAS_DATA'
          });
          return;
        }

        // Optional text context
        textDescription = req.body.description || null;
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
          console.log(`[Generate Enhanced] Normalized uploaded image (${file.originalname}) to ${normalizedImage.metadata.normalizedWidth}x${normalizedImage.metadata.normalizedHeight}`);
        } catch (error: any) {
          res.status(400).json({
            error: 'Invalid Image File',
            message: error.message || 'Failed to process uploaded image',
            code: 'INVALID_IMAGE_FILE'
          });
          return;
        }

        // Optional text context
        textDescription = req.body.description || null;
        break;

      default:
        res.status(400).json({
          error: 'Invalid Input Type',
          message: `Unknown input type: ${inputType}`,
          code: 'INVALID_INPUT_TYPE'
        });
        return;
    }

    // ===== SUBMIT TO QUEUE FOR ASYNC PROCESSING =====

    console.log(`[Generate Enhanced] Submitting job to queue (${inputType})`);

    // Get userId from request (for now, use a placeholder)
    // TODO: Extract from authentication middleware
    const userId = req.headers['user-id'] as string || 'anonymous';

    // Build job data
    const jobData: GenerationJobData = {
      userId,
      inputType,
      textDescription: textDescription ?? undefined,
      normalizedImage: normalizedImage ?? undefined,
      submittedAt: new Date().toISOString(),
    };

    // Submit job to queue
    const queue = queueService.getQueue();
    const job = await queue.add('generation', jobData, {
      removeOnComplete: false, // Keep for result retrieval
      removeOnFail: false, // Keep for debugging
    });

    const processingTimeMs = Date.now() - startTime;
    console.log(`[Generate Enhanced] Job ${job.id} submitted in ${processingTimeMs}ms`);

    // ===== RESPONSE =====

    // Return 202 Accepted with job ID for status polling
    res.status(202).json({
      success: true,
      message: 'Generation job submitted successfully',
      jobId: job.id,
      status: 'queued',
      inputType,
      submittedAt: jobData.submittedAt,
    });

  } catch (error: any) {
    console.error('[Generate Enhanced] Error:', error);

    // If it's already a response, pass it through
    if (res.headersSent) {
      return;
    }

    // Return error response
    res.status(500).json({
      error: 'Generation Failed',
      message: error.message || 'An unexpected error occurred during generation',
      code: 'GENERATION_ERROR'
    });
  }
}

/**
 * Get cost statistics endpoint
 * Returns Claude API usage statistics
 */
export async function getCostStatsController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const days = parseInt(req.query['days'] as string || '1', 10);
    const stats = claudeVisionService.getCostStats(days);

    res.status(200).json({
      success: true,
      period: `last ${days} day(s)`,
      stats
    });
  } catch (error: any) {
    console.error('[Cost Stats] Error:', error);
    next(error);
  }
}
