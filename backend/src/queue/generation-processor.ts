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
import { RotateSprite } from '../pixellab/rotate-sprite.js';
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
    // TEXT-ONLY PATH: Generate sprite from text description using PixelLab → Claude Vision analysis
    console.log('[Generation Processor] Text-only path (PixelLab → Claude Vision)');

    // Step 1: Generate sprite from text description (20% progress)
    await job.updateProgress(20);
    console.log('[Generation Processor] Step 1: Generating sprite from text description...');

    // Create PixelLab client and sprite generator
    const pixelLabClient = createPixelLabClient();
    const spriteGenerator = new SpriteGenerator(pixelLabClient);

    // Build PixelLab request from text description
    const pixelLabRequest = {
      description: textDescription || 'fantasy creature',
      size: 64 as const, // 64x64 required for animate-with-text
      detail: 'medium detail' as const,
      shading: 'basic shading' as const,
      outline: 'single color black outline' as const,
      view: 'side' as const, // Match animation view
      textGuidanceScale: 7.5,
      noBackground: true, // Required for animation
    };

    console.log('[Generation Processor] PixelLab request:', pixelLabRequest);

    // Submit generation to PixelLab (returns image immediately)
    const generationResponse = await spriteGenerator.submitGeneration(pixelLabRequest);
    console.log('[Generation Processor] PixelLab sprite generated, cost:', generationResponse.costUsd, 'USD');

    // Step 2: Analyze generated sprite with Claude Vision (40% progress)
    await job.updateProgress(40);
    console.log('[Generation Processor] Step 2: Analyzing generated sprite with Claude Vision...');

    const claudeAnalysis = await claudeVisionService.analyzeCreature({
      image: {
        base64: generationResponse.imageBase64,
        format: 'png',
      },
      textContext: textDescription ?? 'fantasy creature',
    });

    // Step 3: Map animations from Claude analysis (50% progress)
    await job.updateProgress(50);
    console.log('[Generation Processor] Step 3: Mapping animations from Claude analysis...');

    const animations = animationMapper.mapAnimations(claudeAnalysis);

    // Step 4: Extract combat attributes (60% progress)
    await job.updateProgress(60);
    console.log('[Generation Processor] Step 4: Extracting combat attributes...');

    const combatAttributes = await attributeExtractor.extractAttributes(
      claudeAnalysis.abilities,
      animations.animationSet
    );

    // Step 5: Generate walk animation using text-based animator (70% progress)
    await job.updateProgress(70);
    console.log('[Generation Processor] Step 5: Generating walk animation frames...');

    const textAnimator = new TextAnimator(pixelLabClient);
    const walkAnimation = await textAnimator.animateWithText({
      description: textDescription || 'fantasy creature',
      action: 'walk',
      referenceImage: generationResponse.imageBase64,
      nFrames: 4,
      view: 'side'
    });
    console.log('[Generation Processor] Walk animation generated with', walkAnimation.frames.length, 'frames, cost:', walkAnimation.costUsd, 'USD');

    // Track total cost across all API calls
    let totalCost = generationResponse.costUsd + walkAnimation.costUsd;

    await job.updateProgress(70);

    // Step 6: Generate multi-directional battlefield views using rotation API
    console.log('[Generation Processor] Step 6: Generating multi-directional battlefield views (rotation-based)...');

    let battlefieldDirectionalViews: GenerationResult['battlefieldDirectionalViews'] | undefined;
    let battlefieldSprite: string | undefined;
    let battlefieldWalkFrames: string[] | undefined;
    let viewAngles: { menu: 'side'; battlefield?: 'low top-down' } = { menu: 'side' };

    try {
      // Create rotation service
      const rotateService = new RotateSprite(pixelLabClient);

      // Define 3 directional views to generate: E, NE, SE
      // W, NW, SW will be mirrored from these in the renderer
      // Rotate API uses hyphens for diagonal directions, text-animator also uses hyphens
      const directions = [
        {
          key: 'E' as const,
          rotateDirection: 'east' as const,
          animateDirection: 'east' as const
        },
        {
          key: 'NE' as const,
          rotateDirection: 'north-east' as const,
          animateDirection: 'north-east' as const
        },
        {
          key: 'SE' as const,
          rotateDirection: 'south-east' as const,
          animateDirection: 'south-east' as const
        }
      ];

      const directionalViews: Partial<GenerationResult['battlefieldDirectionalViews']> = {};
      let progressStep = 72;
      const progressIncrement = 18 / directions.length; // 18% total (72% → 90%)

      for (const dir of directions) {
        console.log(`[Generation Processor] Generating ${dir.key} direction using rotation API...`);

        // Step 6.1: Rotate base sprite to target direction
        const rotatedSprite = await rotateService.rotateToTopDown(
          generationResponse.imageBase64,
          dir.rotateDirection
        );

        totalCost += rotatedSprite.costUsd;
        console.log(`[Generation Processor] ${dir.key} sprite rotated, cost: ${rotatedSprite.costUsd.toFixed(4)} USD`);

        // Step 6.2: Generate walk animation for rotated sprite
        const walkAnimation = await textAnimator.animateWithText({
          description: textDescription || 'fantasy creature',
          action: 'walk cycle',
          referenceImage: rotatedSprite.imageBase64,
          nFrames: 4,
          view: 'low top-down',
          direction: dir.animateDirection
        });

        totalCost += walkAnimation.costUsd;
        console.log(`[Generation Processor] ${dir.key} walk animation generated with ${walkAnimation.frames.length} frames, cost: ${walkAnimation.costUsd.toFixed(4)} USD`);

        // Step 6.3: Generate idle animation for rotated sprite
        const idleAnimation = await textAnimator.animateWithText({
          description: textDescription || 'fantasy creature',
          action: 'idle breathing',
          referenceImage: rotatedSprite.imageBase64,
          nFrames: 4,
          view: 'low top-down',
          direction: dir.animateDirection
        });

        totalCost += idleAnimation.costUsd;
        console.log(`[Generation Processor] ${dir.key} idle animation generated with ${idleAnimation.frames.length} frames, cost: ${idleAnimation.costUsd.toFixed(4)} USD`);

        // Step 6.4: Generate attack animation for rotated sprite
        const attackAnimation = await textAnimator.animateWithText({
          description: textDescription || 'fantasy creature',
          action: 'attack',
          referenceImage: rotatedSprite.imageBase64,
          nFrames: 4,
          view: 'low top-down',
          direction: dir.animateDirection
        });

        totalCost += attackAnimation.costUsd;
        console.log(`[Generation Processor] ${dir.key} attack animation generated with ${attackAnimation.frames.length} frames, cost: ${attackAnimation.costUsd.toFixed(4)} USD`);

        // Store sprite, walk frames, idle frames, and attack frames for this direction
        directionalViews[dir.key] = {
          sprite: rotatedSprite.imageBase64,
          walkFrames: walkAnimation.frames,
          idleFrames: idleAnimation.frames,
          attackFrames: attackAnimation.frames
        };

        progressStep += progressIncrement;
        await job.updateProgress(Math.round(progressStep));
      }

      // Validate all directions were generated
      if (directionalViews.E && directionalViews.NE && directionalViews.SE) {
        battlefieldDirectionalViews = directionalViews as GenerationResult['battlefieldDirectionalViews'];

        // Set legacy fields for backward compatibility (use E direction)
        battlefieldSprite = directionalViews.E.sprite;
        battlefieldWalkFrames = directionalViews.E.walkFrames;
        viewAngles = {
          menu: 'side',
          battlefield: 'low top-down'
        };

        console.log('[Generation Processor] Multi-directional battlefield views generation complete (rotation-based)');
      } else {
        throw new Error('Failed to generate all required directional views');
      }
    } catch (error) {
      console.warn('[Generation Processor] Failed to generate multi-directional battlefield views, continuing without them:', error);
      // Fallback: Use original sprite and walk animation as legacy battlefield sprite
      console.log('[Generation Processor] Using legacy battlefield sprite fallback (original sprite + walk animation)');
      battlefieldSprite = generationResponse.imageBase64;
      battlefieldWalkFrames = walkAnimation.frames;
      viewAngles = {
        menu: 'side',
        battlefield: 'low top-down' as const  // Fallback to low top-down
      };
    }

    await job.updateProgress(90);

    console.log(`[Generation Processor] Total API cost: ${totalCost.toFixed(4)} USD`);

    // Determine baseline attack type from attack animation
    const baselineAttackType = determineAttackType(animations.animationSet.attack);

    // Build complete result
    result = {
      inputType: 'text',
      textDescription: textDescription ?? undefined,
      claudeAnalysis,
      animations,
      combatAttributes,
      baselineAttackType,
      spriteImageBase64: generationResponse.imageBase64,
      animationFrames: walkAnimation.frames,
      battlefieldDirectionalViews,
      battlefieldSprite,
      battlefieldWalkFrames,
      viewAngles,
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

    const combatAttributes = await attributeExtractor.extractAttributes(
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

    // Determine baseline attack type from attack animation
    const baselineAttackType = determineAttackType(animations.animationSet.attack);

    // Build complete result
    result = {
      inputType,
      textDescription: textDescription ?? undefined,
      originalImage: normalizedImage.base64,
      claudeAnalysis,
      animations,
      combatAttributes,
      baselineAttackType,
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
 * Determine baseline attack type from attack animation ID
 *
 * @param attackAnimationId - The attack animation ID from the animation set
 * @returns 'melee' | 'ranged'
 */
function determineAttackType(attackAnimationId: string): 'melee' | 'ranged' {
  if (attackAnimationId.includes('ranged')) {
    return 'ranged';
  }
  // Default to melee for melee animations and any other types
  return 'melee';
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
