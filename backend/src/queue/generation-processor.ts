/**
 * Generation Queue Processor
 *
 * Processes generation jobs from BullMQ queue.
 * Orchestrates the full pipeline: Claude Vision → PixelLab → Style Validation
 */

import dotenv from 'dotenv';

// Load environment variables before importing services
dotenv.config();

import type { Job } from 'bullmq';
import { claudeVisionService } from '../services/claude/vision.service.js';
import { animationMapper } from '../services/animations/mapper.service.js';
import { attributeExtractor } from '../services/attributes/extractor.service.js';
import { styleValidator } from '../services/style/validator.service.js';
import { pixelLabPromptBuilder } from '../services/pixellab-prompt-builder.js';
import { HttpClient } from '../pixellab/http-client.js';
import { SpriteGenerator } from '../pixellab/sprite-generator.js';
import { TextAnimator } from '../pixellab/text-animator.js';
import type { GenerationResult } from '../types/generation.js';
import type { NormalizedImage } from '../types/input/index.js';

/**
 * Job data structure from enhanced controller
 */
export interface GenerationJobData {
  userId: string;
  inputType: 'text' | 'draw' | 'upload';
  textDescription?: string | undefined;
  normalizedImage?: NormalizedImage | undefined;
  submittedAt: string;
}

/**
 * Process a generation job
 *
 * This is the main worker processor function that BullMQ calls for each job.
 *
 * @param job - BullMQ job instance
 * @returns Complete generation result
 */
export async function processGenerationJob(job: Job<GenerationJobData>): Promise<GenerationResult> {
  const { inputType, textDescription, normalizedImage } = job.data;
  const startTime = Date.now();

  console.log(`[Generation Processor] Processing job ${job.id} (${inputType})`);

  // Update job progress
  await job.updateProgress(10);

  let result: GenerationResult;

  if (inputType === 'text') {
    // TEXT-ONLY PATH: Generate sprite from text description using PixelLab
    console.log('[Generation Processor] Text-only path (PixelLab direct generation)');

    await job.updateProgress(30);
    console.log('[Generation Processor] Generating sprite from text description...');

    // Create PixelLab client and sprite generator
    const pixelLabClient = createPixelLabClient();
    const spriteGenerator = new SpriteGenerator(pixelLabClient);

    // Build PixelLab request from text description
    const pixelLabRequest = {
      description: textDescription || 'fantasy creature',
      size: 64, // 64x64 required for animate-with-text
      detail: 'medium detail',
      shading: 'basic shading',
      outline: 'single color black outline',
      view: 'side', // Match animation view
      textGuidanceScale: 7.5,
      noBackground: true, // Required for animation
    };

    console.log('[Generation Processor] PixelLab request:', pixelLabRequest);

    await job.updateProgress(40);

    // Submit generation to PixelLab (returns image immediately)
    const generationResponse = await spriteGenerator.submitGeneration(pixelLabRequest);
    console.log('[Generation Processor] PixelLab sprite generated, cost:', generationResponse.costUsd, 'USD');

    await job.updateProgress(65);

    // Generate walk animation using text-based animator
    console.log('[Generation Processor] Generating walk animation frames...');
    const textAnimator = new TextAnimator(pixelLabClient);
    const walkAnimation = await textAnimator.animateWithText({
      description: textDescription || 'fantasy creature',
      action: 'walk',
      referenceImage: generationResponse.imageBase64,
      nFrames: 4,
      view: 'side'
    });
    console.log('[Generation Processor] Walk animation generated with', walkAnimation.frames.length, 'frames, cost:', walkAnimation.costUsd, 'USD');

    await job.updateProgress(85);

    // Assign default animations for text-based creatures
    const defaultAnimations = animationMapper.assignDefaultAnimations();

    await job.updateProgress(95);

    result = {
      inputType: 'text',
      textDescription: textDescription ?? undefined,
      spriteImageBase64: generationResponse.imageBase64,
      animationFrames: walkAnimation.frames,
      animations: defaultAnimations,
      generatedAt: new Date(),
      processingTimeMs: Date.now() - startTime,
    };

    await job.updateProgress(100);
  } else {
    // VISUAL PATH: Claude Vision + PixelLab + Style Validation
    console.log('[Generation Processor] Visual path (Claude Vision → PixelLab)');

    if (!normalizedImage) {
      throw new Error('Normalized image is required for visual path');
    }

    // Step 1: Analyze with Claude Vision (20% progress)
    await job.updateProgress(20);
    console.log('[Generation Processor] Step 1: Analyzing with Claude Vision...');

    const claudeAnalysis = await claudeVisionService.analyzeCreature({
      image: {
        base64: normalizedImage.base64,
        format: 'png',
      },
      textContext: textDescription ?? undefined,
    });

    // Step 2: Map animations (30% progress)
    await job.updateProgress(30);
    console.log('[Generation Processor] Step 2: Mapping animations...');

    const animations = animationMapper.mapAnimations(claudeAnalysis);

    // Step 2.5: Extract combat attributes (35% progress)
    await job.updateProgress(35);
    console.log('[Generation Processor] Step 2.5: Extracting combat attributes...');

    const combatAttributes = attributeExtractor.extractAttributes(
      claudeAnalysis.abilities,
      animations.animationSet
    );

    // Step 3: Build PixelLab prompt (40% progress)
    await job.updateProgress(40);
    console.log('[Generation Processor] Step 3: Building PixelLab prompt...');

    const pixelLabRequest = pixelLabPromptBuilder.buildPrompt(
      claudeAnalysis,
      normalizedImage.base64
    );

    // Step 4: Generate sprite with PixelLab (50-80% progress)
    await job.updateProgress(50);
    console.log('[Generation Processor] Step 4: Generating sprite with PixelLab...');

    const pixelLabClient = createPixelLabClient();
    const spriteGenerator = new SpriteGenerator(pixelLabClient);

    // Submit to PixelLab (returns image immediately)
    const generationResponse = await spriteGenerator.submitGeneration(pixelLabRequest);
    console.log('[Generation Processor] PixelLab generation complete, cost:', generationResponse.costUsd, 'USD');

    await job.updateProgress(60);

    // Step 5: Validate style preservation (90% progress)
    await job.updateProgress(90);
    console.log('[Generation Processor] Step 5: Validating style preservation...');

    // Use actual generated sprite from PixelLab
    const generatedSpriteBuffer = Buffer.from(generationResponse.imageBase64, 'base64');
    const originalImageBuffer = Buffer.from(normalizedImage.base64, 'base64');
    const styleValidation = await styleValidator.validate(originalImageBuffer, generatedSpriteBuffer);

    // Build complete result
    result = {
      inputType,
      textDescription: textDescription ?? undefined,
      originalImage: normalizedImage.base64,
      claudeAnalysis,
      animations,
      combatAttributes,
      styleValidation,
      spriteImageBase64: generationResponse.imageBase64,
      generatedAt: new Date(),
      processingTimeMs: Date.now() - startTime,
    };

    await job.updateProgress(100);
  }

  console.log(`[Generation Processor] Job ${job.id} completed in ${result.processingTimeMs}ms`);

  return result;
}

/**
 * Create PixelLab HTTP client with API key from environment
 */
function createPixelLabClient(): HttpClient {
  const apiKey = process.env['PIXELLAB_API_KEY'];
  if (!apiKey) {
    throw new Error('PIXELLAB_API_KEY environment variable is not set');
  }

  const baseURL = process.env['PIXELLAB_API_URL'] || 'https://api.pixellab.ai';

  return new HttpClient({
    apiKey,
    baseURL,
    timeout: 180000, // 3 minutes
    maxRetries: 3,
  });
}
