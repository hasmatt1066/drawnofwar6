/**
 * Library Animation Generator Script
 *
 * Generates all 55 animation sprites from the animation library using PixelLab.
 * This is a one-time batch job to create generic animations that can be reused
 * across all creatures.
 *
 * Cost: ~$1.10 (55 animations × $0.02 each)
 * Time: ~30-45 minutes
 *
 * Usage: node dist/scripts/generate-library-animations.js
 */

import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { HttpClient } from '../pixellab/http-client.js';
import { SpriteGenerator } from '../pixellab/sprite-generator.js';
import { TextAnimator } from '../pixellab/text-animator.js';
import { animationLibrary } from '../services/animations/library.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Output directory for animation sprites
const OUTPUT_DIR = path.join(__dirname, '../../../assets/library-animations');

interface AnimationGenerationResult {
  animationId: string;
  success: boolean;
  framesGenerated?: number;
  costUsd?: number;
  error?: string;
  filePath?: string;
}

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
 * Map animation ID to isolated effect description for PixelLab
 * These should be effects/objects WITHOUT character bodies
 */
function getActionDescription(animId: string): string {
  // Map library IDs to isolated effect descriptions (NO character body)
  const actionMap: Record<string, string> = {
    // Idle - minimal or no effect
    'idle_default': 'empty transparent sprite',
    'idle_breathing': 'subtle breath mist particles',
    'idle_alert': 'alert exclamation mark icon',
    'idle_tired': 'sweat drops and fatigue lines',
    'idle_flying': 'subtle dust cloud or wind effect',

    // Locomotion - motion effects
    'walk_default': 'small dust puff under feet',
    'run_default': 'speed lines and dust trail',
    'fly_default': 'wing flap air ripples',
    'glide_default': 'gentle air current swirls',
    'swim_default': 'water ripples and bubbles',
    'jump_default': 'jump dust cloud',
    'land_default': 'landing impact dust burst',
    'dash_default': 'quick dash speed blur lines',
    'crawl_default': 'small ground drag marks',
    'turn_left': 'motion blur effect to left',
    'turn_right': 'motion blur effect to right',
    'teleport': 'magical teleport sparkles and portal effect',

    // Combat - weapon/attack effects
    'attack_melee_default': 'impact burst effect',
    'attack_melee_sword': 'sword slash arc trail',
    'attack_melee_punch': 'punch impact stars',
    'attack_melee_claw': 'claw scratch marks',
    'attack_melee_bite': 'bite chomp effect',
    'attack_ranged_default': 'projectile trail',
    'attack_ranged_bow': 'arrow with motion trail',
    'attack_ranged_throw': 'spinning object with arc',
    'defend_default': 'defensive barrier shimmer',
    'defend_shield': 'shield block impact flash',
    'dodge_default': 'quick dodge blur afterimage',
    'roll_default': 'rolling motion blur',
    'parry_default': 'parry clash spark effect',
    'counter_attack': 'counter strike flash',
    'charge_attack': 'charging aura buildup',

    // Abilities - magical effects
    'cast_spell_default': 'magical circle and sparkles',
    'cast_fire_spell': 'fire magic flames and embers',
    'cast_ice_spell': 'ice crystals and frost',
    'cast_lightning_spell': 'lightning bolts and electric arcs',
    'heal_spell': 'healing green sparkles and plus symbols',
    'buff_spell': 'buff aura golden glow',
    'breathe_fire': 'fire breath flame stream',
    'roar': 'sound wave rings',
    'tail_whip': 'tail whip motion arc',
    'wing_attack': 'wing gust wind effect',
    'stomp': 'ground shockwave rings',
    'summon': 'summoning portal circle',
    'special_move_1': 'special attack energy burst',
    'special_move_2': 'ultimate attack massive explosion',
    'stealth': 'stealth smoke puff vanish',

    // Reactions - status effects
    'hit_default': 'damage impact stars and flash',
    'death_default': 'death skull or ghost spirit',
    'celebrate': 'celebration confetti and stars',
    'taunt': 'taunt gesture icon',
    'scared': 'fear sweat drops and shaking lines',
    'stun': 'stun stars circling',
    'knockback': 'knockback impact burst',
    'revive': 'revival light beam and sparkles',
  };

  return actionMap[animId] || animId.replace(/_/g, ' ');
}

/**
 * Get effect description (NO character body - effects only!)
 */
function getEffectDescription(animId: string): string {
  // Request isolated visual effects with NO character bodies
  const category = animationLibrary.find(a => a.id === animId)?.category || 'combat';

  const descriptions: Record<string, string> = {
    'idle': 'visual effect element on transparent background, no character',
    'locomotion': 'motion effect element on transparent background, no character',
    'combat': 'weapon or combat effect on transparent background, no character',
    'abilities': 'magical spell effect on transparent background, no character',
    'reactions': 'status effect icon on transparent background, no character',
  };

  return descriptions[category] || 'visual effect element on transparent background, no character';
}

/**
 * Generate a single animation (two-step process)
 */
async function generateAnimation(
  client: HttpClient,
  animationId: string,
  index: number,
  total: number
): Promise<AnimationGenerationResult> {
  console.log(`\n[${index + 1}/${total}] Generating: ${animationId}`);

  try {
    const spriteGenerator = new SpriteGenerator(client);
    const textAnimator = new TextAnimator(client);
    const action = getActionDescription(animationId);
    const effectDesc = getEffectDescription(animationId);

    console.log(`  Effect: ${effectDesc}`);
    console.log(`  Action: ${action}`);

    // Step 1: Generate base effect sprite (no character body!)
    console.log(`  → Generating effect sprite...`);
    const spriteResponse = await spriteGenerator.submitGeneration({
      description: action, // Use action description directly for effects
      size: 64,
      noBackground: true
    });
    console.log(`  ✓ Effect sprite ($${spriteResponse.costUsd.toFixed(4)})`);

    // Step 2: Generate animation frames for the effect
    console.log(`  → Animating effect...`);
    const animationResponse = await textAnimator.animateWithText({
      description: effectDesc, // Emphasize "no character"
      action: action,
      referenceImage: spriteResponse.imageBase64,
      nFrames: 4,
      view: 'side'
    });
    console.log(`  ✓ Animation ($${animationResponse.costUsd.toFixed(4)})`);

    const totalCost = spriteResponse.costUsd + animationResponse.costUsd;
    console.log(`  Total: $${totalCost.toFixed(4)}`);

    // Save files to disk
    const animDir = path.join(OUTPUT_DIR, animationId);
    await fs.mkdir(animDir, { recursive: true });

    // Save base sprite
    const baseSpritePath = path.join(animDir, 'base-sprite.png');
    await fs.writeFile(baseSpritePath, Buffer.from(spriteResponse.imageBase64, 'base64'));

    // Save animation frames
    const frameFiles: string[] = [];
    for (let i = 0; i < animationResponse.frames.length; i++) {
      const frameFile = path.join(animDir, `frame-${i}.png`);
      await fs.writeFile(frameFile, Buffer.from(animationResponse.frames[i], 'base64'));
      frameFiles.push(frameFile);
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

    return {
      animationId,
      success: true,
      framesGenerated: animationResponse.frames.length,
      costUsd: totalCost,
      filePath: animDir
    };

  } catch (error: any) {
    console.error(`  ✗ Failed: ${error.message}`);
    return {
      animationId,
      success: false,
      error: error.message
    };
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('='.repeat(60));
  console.log('Library Animation Generator');
  console.log('='.repeat(60));
  console.log(`Total animations to generate: ${animationLibrary.length}`);
  console.log(`Estimated cost: $${(animationLibrary.length * 0.04).toFixed(2)} (2 API calls per animation)`);
  console.log(`Estimated time: ${Math.ceil(animationLibrary.length * 0.75)} minutes`);
  console.log(`Output directory: ${OUTPUT_DIR}`);
  console.log('='.repeat(60));

  // Create output directory
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Create PixelLab client
  const client = createPixelLabClient();

  // Generate all animations
  const results: AnimationGenerationResult[] = [];
  let totalCost = 0;

  for (let i = 0; i < animationLibrary.length; i++) {
    const anim = animationLibrary[i];

    // Add delay between requests to avoid rate limiting
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
    }

    const result = await generateAnimation(client, anim.id, i, animationLibrary.length);
    results.push(result);

    if (result.success && result.costUsd) {
      totalCost += result.costUsd;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Generation Complete!');
  console.log('='.repeat(60));

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`Successful: ${successful}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total Cost: $${totalCost.toFixed(2)}`);
  console.log(`Output: ${OUTPUT_DIR}`);

  // Save summary
  const summaryFile = path.join(OUTPUT_DIR, 'generation-summary.json');
  await fs.writeFile(summaryFile, JSON.stringify({
    generatedAt: new Date().toISOString(),
    totalAnimations: animationLibrary.length,
    successful,
    failed,
    totalCost,
    results
  }, null, 2));

  console.log(`Summary saved: ${summaryFile}`);

  // List failed animations
  if (failed > 0) {
    console.log('\nFailed animations:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.animationId}: ${r.error}`);
    });
  }
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
