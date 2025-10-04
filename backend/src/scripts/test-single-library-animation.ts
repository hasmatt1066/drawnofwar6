/**
 * Test Single Library Animation Generator
 *
 * Tests the /animate-skeleton endpoint with a single animation to verify the approach works.
 */

import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { HttpClient } from '../pixellab/http-client.js';
import { SpriteGenerator } from '../pixellab/sprite-generator.js';
import { TextAnimator } from '../pixellab/text-animator.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Output directory for test animation
const OUTPUT_DIR = path.join(__dirname, '../../../assets/library-animations-test');

/**
 * Create PixelLab HTTP client
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

/**
 * Main execution - test single animation
 */
async function main() {
  console.log('='.repeat(60));
  console.log('Testing Single Library Animation Generation');
  console.log('='.repeat(60));
  console.log(`Output directory: ${OUTPUT_DIR}`);
  console.log('='.repeat(60));

  // Create output directory
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Create PixelLab client
  const client = createPixelLabClient();
  const spriteGenerator = new SpriteGenerator(client);
  const textAnimator = new TextAnimator(client);

  // Test with "sword slash" animation - ISOLATED EFFECT (no character body)
  const animationId = 'attack_melee_sword';
  const action = 'sword slash arc trail';
  const effectDesc = 'weapon or combat effect on transparent background, no character';

  console.log(`\nStep 1: Generating base effect sprite`);
  console.log(`  Effect: ${action}`);

  try {
    // Step 1: Generate base effect sprite (NO character body)
    const spriteResponse = await spriteGenerator.submitGeneration({
      description: action,  // Isolated effect description
      size: 64,
      noBackground: true
    });

    console.log(`  ✓ Base effect sprite generated`);
    console.log(`  Cost: $${spriteResponse.costUsd.toFixed(4)}`);

    // Step 2: Animate the effect
    console.log(`\nStep 2: Animating effect`);
    console.log(`  Effect Description: ${effectDesc}`);

    const animationResponse = await textAnimator.animateWithText({
      description: effectDesc,  // Emphasize no character body
      action,
      referenceImage: spriteResponse.imageBase64,
      nFrames: 4,
      view: 'side'
    });

    console.log(`  ✓ Generated ${animationResponse.frames.length} frames`);
    console.log(`  Cost: $${animationResponse.costUsd.toFixed(4)}`);

    const totalCost = spriteResponse.costUsd + animationResponse.costUsd;
    console.log(`  Total Cost: $${totalCost.toFixed(4)}`);

    // Save base sprite
    const animDir = path.join(OUTPUT_DIR, animationId);
    await fs.mkdir(animDir, { recursive: true });

    const baseSpritePath = path.join(animDir, 'base-sprite.png');
    await fs.writeFile(baseSpritePath, Buffer.from(spriteResponse.imageBase64, 'base64'));
    console.log(`\n  Saved base sprite: ${baseSpritePath}`);

    // Save animation frames
    const frameFiles: string[] = [];
    for (let i = 0; i < animationResponse.frames.length; i++) {
      const frameFile = path.join(animDir, `frame-${i}.png`);
      await fs.writeFile(frameFile, Buffer.from(animationResponse.frames[i], 'base64'));
      frameFiles.push(frameFile);
      console.log(`  Saved frame: ${frameFile}`);
    }

    // Save metadata
    const metadataFile = path.join(animDir, 'metadata.json');
    await fs.writeFile(metadataFile, JSON.stringify({
      animationId,
      action,
      description: effectDesc,
      frameCount: animationResponse.frames.length,
      costUsd: totalCost,
      spriteCostUsd: spriteResponse.costUsd,
      animationCostUsd: animationResponse.costUsd,
      generatedAt: new Date().toISOString(),
      baseSprite: 'base-sprite.png',
      frames: frameFiles.map((f, i) => `frame-${i}.png`)
    }, null, 2));

    console.log('\n' + '='.repeat(60));
    console.log('✓ Test Successful!');
    console.log(`Total Cost: $${totalCost.toFixed(4)} (sprite: $${spriteResponse.costUsd.toFixed(4)}, animation: $${animationResponse.costUsd.toFixed(4)})`);
    console.log(`Output: ${animDir}`);
    console.log('='.repeat(60));

  } catch (error: any) {
    console.error(`\n✗ Test Failed: ${error.message}`);
    console.error('Error details:', error.response?.data || error);
    process.exit(1);
  }
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
