/**
 * Test Script: View Angles Comparison
 *
 * Purpose: Generate the same creature from different camera angles
 * to evaluate which works best for isometric battlefield
 *
 * Tests:
 * 1. Current "side" view (baseline)
 * 2. "low top-down" view (~20° angle)
 * 3. "high top-down" view (~35° angle)
 *
 * Evaluates:
 * - Visual quality per view
 * - Suitability for isometric battlefield
 * - Style consistency across views
 * - Animation quality per view
 */

import path from 'path';
import fs from 'fs/promises';
import { SpriteGenerator } from '../pixellab/sprite-generator';
import { TextAnimator } from '../pixellab/text-animator';
import { HttpClient } from '../pixellab/http-client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface ViewTestResult {
  view: string;
  baseSpritePath: string;
  animationFrames: string[];
  costUsd: number;
  timeMs: number;
  notes: string;
}

async function testViewAngles() {
  console.log('============================================================');
  console.log('View Angles Test');
  console.log('============================================================');
  console.log('Testing different camera angles for isometric battlefield\n');

  const testCreature = "fierce red dragon warrior with wings and horns";
  const outputDir = path.join(process.cwd(), 'test-output', 'view-angles', Date.now().toString());

  await fs.mkdir(outputDir, { recursive: true });

  // Views to test
  const viewsToTest = [
    {
      name: 'side',
      description: 'Side view (current - menu/gallery)',
      notes: 'Profile view, good for menus but not battlefield'
    },
    {
      name: 'low top-down',
      description: 'Low top-down (~20° angle)',
      notes: 'Slight overhead angle, may work for isometric'
    },
    {
      name: 'high top-down',
      description: 'High top-down (~35° angle)',
      notes: 'More overhead, closer to traditional isometric'
    }
  ];

  const results: ViewTestResult[] = [];

  // Initialize services with API key
  const apiKey = process.env.PIXELLAB_API_KEY;
  if (!apiKey) {
    throw new Error('PIXELLAB_API_KEY not found in environment variables');
  }

  const httpClient = new HttpClient(apiKey);
  const spriteGenerator = new SpriteGenerator(httpClient);
  const textAnimator = new TextAnimator(httpClient);

  for (const view of viewsToTest) {
    console.log(`\n[${view.name}] Generating: ${view.description}`);
    console.log('─'.repeat(60));

    const startTime = Date.now();
    let totalCost = 0;

    try {
      // Step 1: Generate base sprite
      console.log(`  → Generating base sprite (${view.name} view)...`);
      const spriteResponse = await spriteGenerator.submitGeneration({
        description: testCreature,
        size: 64,
        view: view.name as any,
        noBackground: true
      });

      totalCost += spriteResponse.costUsd;
      console.log(`  ✓ Base sprite generated ($${spriteResponse.costUsd.toFixed(4)})`);

      // Save base sprite
      const baseSpriteBuffer = Buffer.from(spriteResponse.imageBase64, 'base64');
      const baseSpritePath = path.join(outputDir, `${view.name.replace(' ', '-')}_base.png`);
      await fs.writeFile(baseSpritePath, baseSpriteBuffer);

      // Step 2: Animate it (walk cycle)
      console.log(`  → Animating walk cycle (${view.name} view)...`);
      const animationResponse = await textAnimator.animateWithText({
        description: `pixel art creature from ${view.name} view`,
        action: 'walk cycle',
        referenceImage: spriteResponse.imageBase64,
        nFrames: 4,
        view: view.name as any
      });

      totalCost += animationResponse.costUsd;
      console.log(`  ✓ Walk animation generated ($${animationResponse.costUsd.toFixed(4)})`);

      // Save animation frames
      const framePaths: string[] = [];
      for (let i = 0; i < animationResponse.frames.length; i++) {
        const frameBuffer = Buffer.from(animationResponse.frames[i], 'base64');
        const framePath = path.join(outputDir, `${view.name.replace(' ', '-')}_frame-${i}.png`);
        await fs.writeFile(framePath, frameBuffer);
        framePaths.push(framePath);
      }

      const timeMs = Date.now() - startTime;

      results.push({
        view: view.name,
        baseSpritePath,
        animationFrames: framePaths,
        costUsd: totalCost,
        timeMs,
        notes: view.notes
      });

      console.log(`  ✓ Complete - $${totalCost.toFixed(4)}, ${(timeMs / 1000).toFixed(1)}s`);

    } catch (error: any) {
      console.error(`  ✗ Failed: ${error.message}`);
      results.push({
        view: view.name,
        baseSpritePath: '',
        animationFrames: [],
        costUsd: totalCost,
        timeMs: Date.now() - startTime,
        notes: `ERROR: ${error.message}`
      });
    }
  }

  // Generate comparison report
  console.log('\n' + '='.repeat(60));
  console.log('TEST RESULTS SUMMARY');
  console.log('='.repeat(60));

  console.log(`\nTest Creature: "${testCreature}"`);
  console.log(`Output Directory: ${outputDir}\n`);

  console.log('┌─────────────────┬──────────┬──────────┬─────────────────────────┐');
  console.log('│ View            │ Cost     │ Time     │ Notes                   │');
  console.log('├─────────────────┼──────────┼──────────┼─────────────────────────┤');

  for (const result of results) {
    const cost = `$${result.costUsd.toFixed(4)}`.padEnd(8);
    const time = `${(result.timeMs / 1000).toFixed(1)}s`.padEnd(8);
    const view = result.view.padEnd(15);
    const notes = result.notes.substring(0, 23).padEnd(23);
    console.log(`│ ${view} │ ${cost} │ ${time} │ ${notes} │`);
  }
  console.log('└─────────────────┴──────────┴──────────┴─────────────────────────┘');

  // Save detailed results
  const reportPath = path.join(outputDir, 'comparison-report.json');
  await fs.writeFile(reportPath, JSON.stringify({
    testCreature,
    timestamp: new Date().toISOString(),
    results,
    recommendations: {
      forMenus: 'side',
      forBattlefield: 'TBD - Visual inspection required',
      notes: [
        'Visually inspect generated sprites to determine best battlefield view',
        'Consider style consistency between views',
        'Evaluate walk animation quality per view',
        'Test with different creature types (flying, quadruped, etc.)'
      ]
    }
  }, null, 2));

  console.log(`\n📄 Detailed report saved: ${reportPath}`);
  console.log(`\n📁 View all images: ${outputDir}`);

  console.log('\n' + '='.repeat(60));
  console.log('NEXT STEPS:');
  console.log('='.repeat(60));
  console.log('1. Open the output directory and visually compare the sprites');
  console.log('2. Evaluate which view looks best for isometric battlefield');
  console.log('3. Check walk animation quality for each view');
  console.log('4. Consider testing with different creature types:');
  console.log('   - Flying creatures (dragons, birds)');
  console.log('   - Quadrupeds (bears, wolves)');
  console.log('   - Humanoids (warriors, mages)');
  console.log('5. Decide on dual-view generation strategy\n');

  return results;
}

// Run the test
testViewAngles()
  .then((results) => {
    console.log('\n✅ View angles test complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });

export { testViewAngles };
