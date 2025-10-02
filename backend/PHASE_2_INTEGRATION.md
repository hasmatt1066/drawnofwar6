# Phase 2 Integration Guide

This guide shows how to integrate Phase 2 services into your application.

---

## Table of Contents

1. [Setup and Configuration](#setup-and-configuration)
2. [Using Claude Vision Service](#using-claude-vision-service)
3. [Using Animation Mapper](#using-animation-mapper)
4. [Using Style Validator](#using-style-validator)
5. [Complete Pipeline Example](#complete-pipeline-example)
6. [Error Handling](#error-handling)
7. [Cost Optimization](#cost-optimization)

---

## Setup and Configuration

### 1. Environment Variables

Add to your `.env` file:

```bash
# Anthropic Claude API
ANTHROPIC_API_KEY=sk-ant-api03-your-actual-key-here
ANTHROPIC_API_URL=https://api.anthropic.com/v1
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
ANTHROPIC_MAX_TOKENS=1024
ANTHROPIC_TIMEOUT_MS=30000
```

### 2. Verify Configuration

```typescript
import { validateClaudeConfig } from './config/claude.config.js';

// Validates API key on startup
validateClaudeConfig();
```

---

## Using Claude Vision Service

### Basic Usage

```typescript
import { claudeVisionService } from './services/claude/vision.service.js';
import type { NormalizedImage } from './types/input/index.js';

// Analyze a creature image
const result = await claudeVisionService.analyzeCreature({
  image: {
    base64: normalizedImage.base64,
    format: 'png'
  },
  textContext: 'A fierce dragon' // Optional
});

console.log('Concept:', result.concept);
console.log('Race:', result.race);
console.log('Class:', result.class);
console.log('Attributes:', result.primaryAttributes);
console.log('Abilities:', result.abilities);
console.log('Suggested Animations:', result.suggestedAnimations);
console.log('Style:', result.styleCharacteristics);
console.log('Tokens Used:', result.tokenUsage);
```

### Response Structure

```typescript
interface ClaudeAnalysisResult {
  concept: string;              // "fierce fire dragon"
  race: string;                 // "dragon"
  class: string;                // "warrior"
  primaryAttributes: {
    hp: number;                 // 150
    attack: number;             // 40
    defense: number;            // 20
    speed: number;              // 6
  };
  abilities: string[];          // ["flight", "fire_breath", "claw_strike"]
  suggestedAnimations: string[]; // ["idle", "walk", "fly", "breathe_fire", ...]
  styleCharacteristics: {
    dominantColors: string[];   // ["#FF0000", "#8B0000", ...]
    shapeComplexity: 'simple' | 'moderate' | 'complex';
    artStyle: string;           // "cartoon"
  };
  confidence: number;           // 0.85
  tokenUsage: number;           // 1247
}
```

### Error Handling

```typescript
try {
  const result = await claudeVisionService.analyzeCreature(request);
  // Use result
} catch (error: any) {
  if (error.code === 'rate_limit') {
    // Wait and retry
    console.log(`Rate limited. Retry after ${error.retryAfter} seconds`);
  } else if (error.code === 'invalid_image') {
    // Image format issue
    console.error('Invalid image:', error.message);
  } else if (error.fallback) {
    // Use fallback result
    console.warn('Using fallback attributes');
    const result = error.fallback;
  }
}
```

### Cost Tracking

```typescript
// Get cost statistics
const stats = claudeVisionService.getCostStats(7); // Last 7 days

console.log('Total Cost:', `$${stats.totalCost.toFixed(2)}`);
console.log('Total Tokens:', stats.totalTokens);
console.log('Request Count:', stats.requestCount);
console.log('Avg Cost/Request:', `$${stats.avgCostPerRequest.toFixed(4)}`);
console.log('Avg Duration:', `${stats.avgDuration}ms`);
```

---

## Using Animation Mapper

### Basic Usage

```typescript
import { animationMapper } from './services/animations/mapper.service.js';
import type { ClaudeAnalysisResult } from './services/claude/types.js';

// Map animations from Claude's suggestions
const mappingResult = animationMapper.mapAnimations(claudeResult);

console.log('Total Animations:', mappingResult.totalAnimations);
console.log('Base Animations:', mappingResult.animationSet);
console.log('Mapped from Claude:', mappingResult.mappedFromClaude);
console.log('Filled with Defaults:', mappingResult.filledWithDefaults);
console.log('Confidence:', mappingResult.confidence);
```

### Response Structure

```typescript
interface AnimationMappingResult {
  animationSet: {
    idle: string;              // 'idle_flying' (for dragons)
    walk: string;              // 'walk_default'
    attack: string;            // 'attack_melee_claw'
    death: string;             // 'death_default'
    additional: string[];      // ['fly_default', 'breathe_fire', ...]
  };
  totalAnimations: number;     // 23
  mappedFromClaude: number;    // 18
  filledWithDefaults: number;  // 5
  confidence: number;          // 0.78
}
```

### Accessing Animation Library

```typescript
import {
  animationLibrary,
  getAnimationsByCategory,
  searchAnimationsByTags,
  getAnimationById
} from './services/animations/library.js';

// Get all animations
console.log(`Total animations: ${animationLibrary.length}`);

// Get by category
const combatAnimations = getAnimationsByCategory('combat');
console.log('Combat animations:', combatAnimations.length);

// Search by tags
const fireAnimations = searchAnimationsByTags(['fire', 'flames']);
console.log('Fire-related:', fireAnimations);

// Get specific animation
const animation = getAnimationById('breathe_fire');
console.log('Animation:', animation?.name, animation?.tags);
```

---

## Using Style Validator

### Basic Usage

```typescript
import { styleValidator } from './services/style/validator.service.js';

// Validate style preservation
const validation = await styleValidator.validate(
  originalImageBuffer,
  generatedSpriteBuffer
);

console.log('Passed:', validation.passed);
console.log('Overall Score:', validation.overallScore, '%');
console.log('Color Score:', validation.colorScore, '%');
console.log('Shape Score:', validation.shapeScore, '%');
console.log('Feedback:', validation.feedback);
console.log('Original Colors:', validation.dominantColorsOriginal);
console.log('Generated Colors:', validation.dominantColorsGenerated);
```

### Response Structure

```typescript
interface StylePreservationResult {
  passed: boolean;              // true if score >= 60%
  overallScore: number;         // 82 (0-100)
  colorScore: number;           // 85
  shapeScore: number;           // 76
  feedback: string;             // User-friendly message
  dominantColorsOriginal: string[];   // ["#FF0000", "#8B0000", ...]
  dominantColorsGenerated: string[];  // ["#E60000", "#7A0000", ...]
}
```

### Quick Validation (Skip Shape Analysis)

```typescript
// Faster validation, only checks colors
const passed = await styleValidator.quickValidate(
  originalImageBuffer,
  generatedSpriteBuffer
);

if (passed) {
  console.log('Style preserved!');
} else {
  console.log('Style differs, regenerate?');
}
```

### Direct Color/Shape Analysis

```typescript
import { extractColorPalette, compareColorPalettes } from './services/style/color-extractor.js';
import { analyzeShape, compareShapes } from './services/style/shape-comparator.js';

// Extract color palette
const palette = await extractColorPalette(imageBuffer, 8);
console.log('Dominant Colors:', palette.colors);
console.log('Most Dominant:', palette.dominantColor);

// Analyze shape
const shape = await analyzeShape(imageBuffer);
console.log('Edge Density:', shape.edgeDensity);
console.log('Complexity:', shape.complexity);
console.log('Aspect Ratio:', shape.aspectRatio);

// Compare shapes
const similarity = await compareShapes(image1Buffer, image2Buffer);
console.log('Shape Similarity:', (similarity * 100).toFixed(1), '%');
```

---

## Complete Pipeline Example

### Full Visual Input Processing

```typescript
import { inputNormalizer } from './services/input/normalizer.service.js';
import { claudeVisionService } from './services/claude/vision.service.js';
import { animationMapper } from './services/animations/mapper.service.js';
import { styleValidator } from './services/style/validator.service.js';

async function processVisualInput(
  imageFile: Express.Multer.File,
  textContext?: string
): Promise<GenerationResult> {
  const startTime = Date.now();

  // Step 1: Normalize image to 512x512 PNG
  console.log('Step 1: Normalizing image...');
  const normalizedImage = await inputNormalizer.normalizeFromFile(imageFile);

  // Step 2: Analyze with Claude Vision
  console.log('Step 2: Analyzing with Claude...');
  const claudeAnalysis = await claudeVisionService.analyzeCreature({
    image: {
      base64: normalizedImage.base64,
      format: 'png'
    },
    textContext
  });

  // Step 3: Map animations
  console.log('Step 3: Mapping animations...');
  const animations = animationMapper.mapAnimations(claudeAnalysis);

  // Step 4: Generate sprite (placeholder - Phase 3)
  console.log('Step 4: Generating sprite...');
  // TODO: const sprite = await pixelLabService.generate(claudeAnalysis);
  const mockSprite = Buffer.from('mock-sprite'); // Placeholder

  // Step 5: Validate style preservation
  console.log('Step 5: Validating style...');
  const originalBuffer = Buffer.from(normalizedImage.base64, 'base64');
  const styleValidation = await styleValidator.validate(
    originalBuffer,
    mockSprite
  );

  // Return complete result
  return {
    inputType: 'upload',
    textDescription: textContext,
    originalImage: normalizedImage.base64,
    claudeAnalysis,
    animations,
    styleValidation,
    generatedAt: new Date(),
    processingTimeMs: Date.now() - startTime
  };
}

// Usage
const result = await processVisualInput(uploadedFile, 'fire dragon');
console.log('Processing complete!');
console.log('Concept:', result.claudeAnalysis?.concept);
console.log('Total Animations:', result.animations.totalAnimations);
console.log('Style Preserved:', result.styleValidation?.passed);
console.log('Duration:', result.processingTimeMs, 'ms');
```

### Parallel Processing (Optimize Performance)

```typescript
async function processVisualInputParallel(
  imageFile: Express.Multer.File,
  textContext?: string
): Promise<GenerationResult> {
  // Step 1: Normalize
  const normalizedImage = await inputNormalizer.normalizeFromFile(imageFile);

  // Step 2 & 4: Run Claude and PixelLab in parallel
  const [claudeAnalysis, sprite] = await Promise.all([
    claudeVisionService.analyzeCreature({
      image: { base64: normalizedImage.base64, format: 'png' },
      textContext
    }),
    // TODO: pixelLabService.generate(...) - Phase 3
    Promise.resolve(Buffer.from('mock-sprite'))
  ]);

  // Step 3: Map animations (depends on Claude)
  const animations = animationMapper.mapAnimations(claudeAnalysis);

  // Step 5: Validate style
  const originalBuffer = Buffer.from(normalizedImage.base64, 'base64');
  const styleValidation = await styleValidator.validate(originalBuffer, sprite);

  return {
    inputType: 'upload',
    claudeAnalysis,
    animations,
    styleValidation,
    generatedAt: new Date(),
    processingTimeMs: 0 // Calculate if needed
  };
}

// Saves ~1-2 seconds by running Claude + PixelLab in parallel
```

---

## Error Handling

### Comprehensive Error Handling

```typescript
async function safeGenerateCreature(
  input: GenerationRequest
): Promise<GenerationResult> {
  try {
    // Attempt full pipeline
    return await processVisualInput(input.file, input.textContext);
  } catch (error: any) {
    console.error('Generation error:', error);

    // Check for specific error types
    if (error.code === 'rate_limit') {
      // Rate limit - retry after delay
      console.log(`Rate limited. Retrying in ${error.retryAfter}s...`);
      await sleep(error.retryAfter * 1000);
      return await safeGenerateCreature(input); // Retry once
    }

    if (error.code === 'invalid_image') {
      // Invalid image - return error to user
      throw new Error('Invalid image format. Please upload PNG or JPG.');
    }

    if (error.fallback) {
      // Claude failed but we have fallback
      console.warn('Using fallback attributes');
      const animations = animationMapper.mapAnimations(error.fallback);

      return {
        inputType: input.type,
        claudeAnalysis: error.fallback,
        animations,
        generatedAt: new Date(),
        processingTimeMs: 0
      };
    }

    // Unknown error - use generic fallback
    console.error('Unknown error, using generic fallback');
    const fallback = {
      concept: 'generic creature',
      race: 'unknown',
      class: 'warrior',
      primaryAttributes: { hp: 100, attack: 20, defense: 15, speed: 5 },
      abilities: ['melee_attack'],
      suggestedAnimations: ['idle', 'walk', 'attack', 'death'],
      styleCharacteristics: {
        dominantColors: ['#808080'],
        shapeComplexity: 'moderate' as const,
        artStyle: 'sketch'
      },
      confidence: 0.0,
      tokenUsage: 0
    };

    const animations = animationMapper.mapAnimations(fallback);

    return {
      inputType: input.type,
      claudeAnalysis: fallback,
      animations,
      generatedAt: new Date(),
      processingTimeMs: 0
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

## Cost Optimization

### 1. Use Cheaper Model for Simple Images

```typescript
// Switch to Haiku for simple drawings
const isSimpleDrawing = detectSimpleDrawing(imageBuffer);

if (isSimpleDrawing) {
  // Use Haiku (10x cheaper)
  process.env['ANTHROPIC_MODEL'] = 'claude-3-haiku-20240307';
} else {
  // Use Sonnet (better quality)
  process.env['ANTHROPIC_MODEL'] = 'claude-3-5-sonnet-20241022';
}

const result = await claudeVisionService.analyzeCreature(request);
```

### 2. Cache Results for Similar Images

```typescript
import crypto from 'crypto';

const imageCache = new Map<string, ClaudeAnalysisResult>();

async function cachedAnalyze(request: ClaudeVisionRequest): Promise<ClaudeAnalysisResult> {
  // Hash image to create cache key
  const hash = crypto.createHash('sha256')
    .update(request.image.base64)
    .digest('hex');

  // Check cache
  if (imageCache.has(hash)) {
    console.log('Cache hit!');
    return imageCache.get(hash)!;
  }

  // Call API
  const result = await claudeVisionService.analyzeCreature(request);

  // Cache result
  imageCache.set(hash, result);

  return result;
}
```

### 3. Batch Processing with Rate Limiting

```typescript
import pLimit from 'p-limit';

// Limit concurrent Claude API calls
const limit = pLimit(5); // Max 5 concurrent

async function batchAnalyze(images: Buffer[]): Promise<ClaudeAnalysisResult[]> {
  const results = await Promise.all(
    images.map(image =>
      limit(() =>
        claudeVisionService.analyzeCreature({
          image: { base64: image.toString('base64'), format: 'png' }
        })
      )
    )
  );

  return results;
}
```

### 4. Monitor Costs

```typescript
// Set up cost alerts
setInterval(() => {
  const stats = claudeVisionService.getCostStats(1); // Last 24 hours

  if (stats.totalCost > 10.0) {
    console.warn(`⚠️ High API costs: $${stats.totalCost.toFixed(2)} in 24h`);
    // Send alert email/Slack message
  }
}, 3600000); // Check every hour
```

---

## Testing Examples

### Mock Claude Response for Testing

```typescript
// Mock successful response
const mockClaudeResult: ClaudeAnalysisResult = {
  concept: 'test dragon',
  race: 'dragon',
  class: 'warrior',
  primaryAttributes: { hp: 150, attack: 40, defense: 20, speed: 6 },
  abilities: ['flight', 'fire_breath'],
  suggestedAnimations: [
    'idle', 'walk', 'fly', 'attack', 'breathe_fire',
    'roar', 'land', 'takeoff', 'glide', 'death',
    'hit', 'celebrate', 'taunt', 'dodge', 'run'
  ],
  styleCharacteristics: {
    dominantColors: ['#FF0000', '#8B0000'],
    shapeComplexity: 'moderate',
    artStyle: 'cartoon'
  },
  confidence: 0.85,
  tokenUsage: 1200
};

// Use in tests
const animations = animationMapper.mapAnimations(mockClaudeResult);
expect(animations.totalAnimations).toBeGreaterThanOrEqual(20);
```

---

## Next Steps

Once Phase 3 (PixelLab Integration) is complete, you can:

1. Replace mock sprite with actual PixelLab output
2. Submit jobs to BullMQ for async processing
3. Track job progress via WebSocket
4. Cache results in Redis
5. Store creatures in Firebase

**See**: `PHASE_3_TASKS.md` for next implementation steps.

---

**Last Updated**: 2025-10-01
**Version**: Phase 2 Complete
