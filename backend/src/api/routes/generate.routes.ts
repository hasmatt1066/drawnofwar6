/**
 * Generate API Routes
 *
 * Handles creature generation requests with multi-modal inputs:
 * - Text descriptions
 * - Canvas drawings (base64)
 * - Image uploads (multipart/form-data)
 */

import { Router } from 'express';
import { upload, handleMulterError } from '../../config/multer.config.js';
import { validateImageUpload, validateDataUrl } from '../../middleware/image-validation.middleware.js';
import { generateController } from '../controllers/generate.controller.js';
import { generateEnhancedController, getCostStatsController } from '../controllers/generate-enhanced.controller.js';

const router = Router();

/**
 * POST /api/generate
 *
 * Generate a creature from multi-modal input.
 *
 * Request formats:
 *
 * 1. Text input (application/json):
 *    { inputType: 'text', description: string }
 *
 * 2. Canvas drawing (application/json):
 *    { inputType: 'draw', imageData: string (base64 data URL) }
 *
 * 3. File upload (multipart/form-data):
 *    inputType: 'upload'
 *    image: File
 *
 * Response:
 *    202 Accepted
 *    { jobId: string, status: 'queued', message: string }
 */
router.post('/generate', (req, res, next): void => {
  const inputType = req.body['inputType'] || req.query['inputType'];

  // Route based on input type
  if (inputType === 'upload') {
    // Handle file upload with Multer
    const uploadMiddleware = upload.single('image');

    uploadMiddleware(req, res, (err): void => {
      if (err) {
        const error = handleMulterError(err);
        res.status(error.status).json({
          error: 'Upload Error',
          message: error.message,
          code: 'UPLOAD_FAILED'
        });
        return;
      }

      // Validate uploaded image
      validateImageUpload(req, res, () => {
        generateController(req, res, next);
      });
    });
  } else if (inputType === 'draw') {
    // Validate data URL for canvas drawings
    validateDataUrl(req, res, () => {
      generateController(req, res, next);
    });
  } else if (inputType === 'text') {
    // Text input - no additional validation needed
    generateController(req, res, next);
  } else {
    // Invalid or missing input type
    res.status(400).json({
      error: 'Invalid Input Type',
      message: 'inputType must be one of: "text", "draw", or "upload"',
      code: 'INVALID_INPUT_TYPE',
      received: inputType
    });
    return;
  }
});

/**
 * POST /api/generate/enhanced
 *
 * Enhanced generation with Claude Vision integration.
 * This endpoint processes the request immediately and returns the full result.
 * (Phase 3 will integrate with BullMQ for async processing)
 */
router.post('/generate/enhanced', (req, res, next): void => {
  const inputType = req.body['inputType'] || req.query['inputType'];

  // Route based on input type
  if (inputType === 'upload') {
    // Handle file upload with Multer
    const uploadMiddleware = upload.single('image');

    uploadMiddleware(req, res, (err): void => {
      if (err) {
        const error = handleMulterError(err);
        res.status(error.status).json({
          error: 'Upload Error',
          message: error.message,
          code: 'UPLOAD_FAILED'
        });
        return;
      }

      // Validate uploaded image
      validateImageUpload(req, res, () => {
        generateEnhancedController(req, res, next);
      });
    });
  } else if (inputType === 'draw') {
    // Validate data URL for canvas drawings
    validateDataUrl(req, res, () => {
      generateEnhancedController(req, res, next);
    });
  } else if (inputType === 'text') {
    // Text input - no additional validation needed
    generateEnhancedController(req, res, next);
  } else {
    // Invalid or missing input type
    res.status(400).json({
      error: 'Invalid Input Type',
      message: 'inputType must be one of: "text", "draw", or "upload"',
      code: 'INVALID_INPUT_TYPE',
      received: inputType
    });
    return;
  }
});

/**
 * GET /api/generate/stats
 *
 * Get Claude API cost statistics.
 *
 * Query params:
 *    days: number (default: 1) - Number of days to look back
 *
 * Response:
 *    200 OK
 *    { totalCost, totalTokens, requestCount, avgCostPerRequest }
 */
router.get('/generate/stats', getCostStatsController);

/**
 * GET /api/generate/:jobId
 *
 * Get status of a generation job.
 *
 * Response:
 *    200 OK
 *    { jobId, status, progress, result?, error? }
 */
router.get('/generate/:jobId', async (req, res) => {
  const { jobId } = req.params;

  try {
    // Get queue from service
    const { queueService } = await import('../../queue/index.js');
    const queue = queueService.getQueue();

    // Get job from queue
    const job = await queue.getJob(jobId);

    if (!job) {
      res.status(404).json({
        error: 'Job Not Found',
        message: `No job found with ID: ${jobId}`,
        jobId
      });
      return;
    }

    // Get job state
    const state = await job.getState();
    const progress = job.progress || 0;

    // Build response based on state
    if (state === 'completed') {
      // Job completed successfully
      const result = job.returnvalue;

      res.status(200).json({
        jobId,
        status: 'completed',
        progress: 100,
        result,
        completedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : undefined,
      });
    } else if (state === 'failed') {
      // Job failed
      const error = job.failedReason;

      res.status(200).json({
        jobId,
        status: 'failed',
        progress,
        error: {
          message: error || 'Job processing failed',
          failedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : undefined,
        },
      });
    } else if (state === 'active') {
      // Job is currently processing
      res.status(200).json({
        jobId,
        status: 'processing',
        progress,
        message: 'Job is currently being processed',
      });
    } else if (state === 'waiting' || state === 'delayed') {
      // Job is queued
      res.status(200).json({
        jobId,
        status: 'queued',
        progress: 0,
        message: 'Job is waiting in queue',
      });
    } else {
      // Unknown state
      res.status(200).json({
        jobId,
        status: state,
        progress,
        message: `Job is in ${state} state`,
      });
    }
  } catch (error: any) {
    console.error('[Job Status] Error:', error);

    res.status(500).json({
      error: 'Status Check Failed',
      message: error.message || 'Failed to check job status',
      jobId,
    });
  }
});

export { router as generateRouter };
