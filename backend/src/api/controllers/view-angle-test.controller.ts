/**
 * View Angle Test Controller
 *
 * Handles view angle comparison testing for isometric battlefield evaluation.
 * Generates sprites from multiple camera angles (side, low top-down, high top-down)
 * with both base sprites and walk animations for visual comparison.
 */

import { Request, Response } from 'express';
import { HttpClient, PixelLabClientConfig } from '../../pixellab/http-client.js';
import { SpriteGenerator } from '../../pixellab/sprite-generator.js';
import { TextAnimator } from '../../pixellab/text-animator.js';

interface ViewAngleTestRequest {
  description: string;
  size?: 32 | 48 | 64 | 128;
}

interface ViewResult {
  view: string;
  baseSprite: string; // base64
  animationFrames: string[]; // base64 array
  costUsd: number;
  timeMs: number;
}

interface ViewAngleTestResponse {
  description: string;
  results: ViewResult[];
  totalCost: number;
  totalTime: number;
}

/**
 * POST /api/test/view-angles
 *
 * Generate sprites from all three view angles with animations
 */
export const testViewAnglesController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { description, size = 64 } = req.body as ViewAngleTestRequest;

    // Validate input
    if (!description || typeof description !== 'string') {
      res.status(400).json({
        error: 'Invalid Input',
        message: 'Description is required and must be a string',
        code: 'INVALID_DESCRIPTION'
      });
      return;
    }

    // Validate API key
    const apiKey = process.env['PIXELLAB_API_KEY'];
    if (!apiKey) {
      res.status(500).json({
        error: 'Configuration Error',
        message: 'API key is required and cannot be empty',
        code: 'MISSING_API_KEY'
      });
      return;
    }

    console.log(`[View Angle Test] Starting test for: "${description}"`);
    const testStartTime = Date.now();

    // Initialize PixelLab services
    const clientConfig: PixelLabClientConfig = { apiKey };
    const httpClient = new HttpClient(clientConfig);
    const spriteGenerator = new SpriteGenerator(httpClient);
    const textAnimator = new TextAnimator(httpClient);

    // Views to test
    const viewsToTest = [
      { name: 'side', description: 'Side view (profile)' },
      { name: 'low top-down', description: 'Low top-down (~20° angle)' },
      { name: 'high top-down', description: 'High top-down (~35° angle)' }
    ];

    const results: ViewResult[] = [];
    let totalCost = 0;

    // Generate each view sequentially (parallel could hit rate limits)
    for (const view of viewsToTest) {
      console.log(`[View Angle Test] Generating ${view.name} view...`);
      const viewStartTime = Date.now();
      let viewCost = 0;

      try {
        // Step 1: Generate base sprite
        console.log(`  → Generating base sprite...`);
        const spriteResponse = await spriteGenerator.submitGeneration({
          description,
          size,
          view: view.name as any,
          noBackground: true,
          outline: 'single color black outline'
        });

        viewCost += spriteResponse.costUsd;
        console.log(`  ✓ Base sprite generated ($${spriteResponse.costUsd.toFixed(4)})`);

        // Step 2: Generate walk animation
        console.log(`  → Generating walk animation...`);
        const animationResponse = await textAnimator.animateWithText({
          description: `pixel art creature from ${view.name} view`,
          action: 'walk cycle',
          referenceImage: spriteResponse.imageBase64,
          nFrames: 4,
          view: view.name as any
        });

        viewCost += animationResponse.costUsd;
        console.log(`  ✓ Walk animation generated ($${animationResponse.costUsd.toFixed(4)})`);

        const viewTime = Date.now() - viewStartTime;
        totalCost += viewCost;

        results.push({
          view: view.name,
          baseSprite: spriteResponse.imageBase64,
          animationFrames: animationResponse.frames,
          costUsd: viewCost,
          timeMs: viewTime
        });

        console.log(`  ✓ ${view.name} complete - $${viewCost.toFixed(4)}, ${(viewTime / 1000).toFixed(1)}s`);

      } catch (error: any) {
        console.error(`  ✗ ${view.name} failed:`, error.message);

        // Return partial results if some views succeeded
        if (results.length > 0) {
          res.status(207).json({
            description,
            results,
            totalCost,
            totalTime: Date.now() - testStartTime,
            error: {
              message: `Failed to generate ${view.name} view: ${error.message}`,
              failedView: view.name
            }
          });
          return;
        }

        // If first view fails, return error
        throw error;
      }
    }

    const totalTime = Date.now() - testStartTime;

    console.log(`[View Angle Test] Complete - $${totalCost.toFixed(4)}, ${(totalTime / 1000).toFixed(1)}s`);

    // Return successful results
    const response: ViewAngleTestResponse = {
      description,
      results,
      totalCost,
      totalTime
    };

    res.status(200).json(response);

  } catch (error: any) {
    console.error('[View Angle Test] Error:', error);

    res.status(500).json({
      error: 'Generation Failed',
      message: error.message || 'Failed to generate view angle test',
      code: error.code || 'GENERATION_ERROR'
    });
  }
};
