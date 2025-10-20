import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SCREENSHOTS_DIR = join(__dirname, 'screenshots');

// Ensure screenshots directory exists
if (!existsSync(SCREENSHOTS_DIR)) {
  mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function verifyRaceConditionFix() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new', // Use new headless mode
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ],
    defaultViewport: { width: 1920, height: 1080 }
  });
  console.log('Browser launched successfully\n');

  const page = await browser.newPage();

  // Capture console logs
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    console.log('PAGE LOG:', text);
  });

  // Capture errors
  page.on('pageerror', error => {
    console.error('PAGE ERROR:', error.message);
  });

  try {
    console.log('=== Starting Race Condition Fix Verification ===\n');

    // Navigate to deployment grid demo
    console.log('1. Navigating to http://localhost:5177/deployment-grid');
    await page.goto('http://localhost:5177/deployment-grid', {
      waitUntil: 'domcontentloaded', // Changed from networkidle0 to handle socket connections
      timeout: 30000
    });

    // Wait for page to be fully loaded
    console.log('2. Waiting for page to load...');
    await new Promise(resolve => setTimeout(resolve, 5000)); // Give time for React to render

    // Take initial screenshot
    const initialScreenshot = join(SCREENSHOTS_DIR, `01-initial-state-${Date.now()}.png`);
    await page.screenshot({ path: initialScreenshot, fullPage: true });
    console.log(`   Screenshot saved: ${initialScreenshot}\n`);

    // Find roster items (draggable creatures) - using CSS module class pattern
    console.log('3. Finding roster items...');
    const rosterItems = await page.$$('[draggable="true"]');
    console.log(`   Found ${rosterItems.length} draggable items\n`);

    if (rosterItems.length < 3) {
      throw new Error(`Not enough roster items found. Expected at least 3, got ${rosterItems.length}`);
    }

    // Check if canvas exists
    const canvasCount = await page.evaluate(() => document.querySelectorAll('canvas').length);
    console.log(`   Found ${canvasCount} canvas elements\n`);

    if (canvasCount === 0) {
      throw new Error('No canvas element found! PixiJS renderer may have failed to initialize.');
    }

    // Get canvas element for drag destinations
    const canvas = await page.$('canvas');
    const canvasBox = await canvas.boundingBox();

    if (!canvasBox) {
      throw new Error('Canvas bounding box not found');
    }

    console.log('4. Canvas position:', canvasBox);
    console.log('');

    // Define valid drop positions (columns 0-2, row 7 for player side)
    // Hex grid layout: each hex is approximately 60px wide and 52px tall
    const hexWidth = 60;
    const hexHeight = 52;
    const startX = canvasBox.x + 50; // Offset from left edge
    const startY = canvasBox.y + canvasBox.height - 100; // Bottom area for player

    const dropPositions = [
      { x: startX + hexWidth * 0, y: startY, col: 0 },
      { x: startX + hexWidth * 1, y: startY, col: 1 },
      { x: startX + hexWidth * 2, y: startY, col: 2 }
    ];

    const dragResults = [];

    // Drag 3 creatures onto valid hexes
    for (let i = 0; i < 3; i++) {
      console.log(`5.${i + 1}. Dragging creature ${i + 1} to column ${dropPositions[i].col}...`);

      const rosterItem = rosterItems[i];
      const rosterBox = await rosterItem.boundingBox();

      if (!rosterBox) {
        console.log(`   WARNING: Could not get bounding box for roster item ${i}`);
        continue;
      }

      const startPos = {
        x: rosterBox.x + rosterBox.width / 2,
        y: rosterBox.y + rosterBox.height / 2
      };

      const endPos = dropPositions[i];

      // Clear console logs for this drag
      const beforeLogCount = consoleLogs.length;

      // Perform drag and drop
      await page.mouse.move(startPos.x, startPos.y);
      await page.mouse.down();
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay to ensure drag starts

      await page.mouse.move(endPos.x, endPos.y, { steps: 10 });
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay before drop

      await page.mouse.up();
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait for drop to process

      // Analyze logs for this drag
      const dragLogs = consoleLogs.slice(beforeLogCount);

      const placementSuccess = dragLogs.some(log =>
        log.includes('Placement success: true')
      );

      const dragAlreadyCompleted = dragLogs.some(log =>
        log.includes('Drag already completed, skipping')
      );

      const cancellingInvalidDrag = dragLogs.some(log =>
        log.includes('Cancelling invalid drag')
      );

      dragResults.push({
        creatureIndex: i,
        targetColumn: dropPositions[i].col,
        placementSuccess,
        dragAlreadyCompleted,
        cancellingInvalidDrag,
        relevantLogs: dragLogs.filter(log =>
          log.includes('Placement success') ||
          log.includes('Drag already completed') ||
          log.includes('Cancelling invalid drag') ||
          log.includes('handleDragEnd') ||
          log.includes('handleDrop')
        )
      });

      console.log(`   Placement success: ${placementSuccess}`);
      console.log(`   Drag already completed message: ${dragAlreadyCompleted}`);
      console.log(`   Cancelling invalid drag message: ${cancellingInvalidDrag}`);
      console.log('');

      // Take screenshot after each placement
      const placementScreenshot = join(SCREENSHOTS_DIR, `02-after-creature-${i + 1}-${Date.now()}.png`);
      await page.screenshot({ path: placementScreenshot, fullPage: true });
      console.log(`   Screenshot saved: ${placementScreenshot}\n`);
    }

    // Wait a bit to ensure all placements are finalized
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check placement counter
    console.log('6. Checking placement counter...');
    const placementCounterText = await page.evaluate(() => {
      const counter = document.querySelector('[class*="placement-counter"]') ||
                     document.querySelector('div');
      return counter ? counter.textContent : 'Not found';
    });
    console.log(`   Placement counter text: ${placementCounterText}\n`);

    // Take final screenshot
    const finalScreenshot = join(SCREENSHOTS_DIR, `03-final-state-${Date.now()}.png`);
    await page.screenshot({ path: finalScreenshot, fullPage: true });
    console.log(`   Final screenshot saved: ${finalScreenshot}\n`);

    // Generate report
    console.log('=== VERIFICATION REPORT ===\n');

    const successfulPlacements = dragResults.filter(r => r.placementSuccess).length;
    const dragAlreadyCompletedCount = dragResults.filter(r => r.dragAlreadyCompleted).length;
    const cancellingInvalidDragCount = dragResults.filter(r => r.cancellingInvalidDrag).length;

    console.log(`Creatures successfully placed: ${successfulPlacements}/3`);
    console.log(`"Drag already completed, skipping" messages: ${dragAlreadyCompletedCount}`);
    console.log(`"Cancelling invalid drag" messages for valid drops: ${cancellingInvalidDragCount}`);
    console.log(`Final placement counter: ${placementCounterText}`);
    console.log('');

    console.log('Detailed Results:');
    dragResults.forEach((result, index) => {
      console.log(`\nCreature ${index + 1} (Column ${result.targetColumn}):`);
      console.log(`  - Placement success: ${result.placementSuccess}`);
      console.log(`  - Fix working (drag already completed): ${result.dragAlreadyCompleted}`);
      console.log(`  - Invalid drag message (should be false): ${result.cancellingInvalidDrag}`);
      if (result.relevantLogs.length > 0) {
        console.log(`  - Relevant logs:`);
        result.relevantLogs.forEach(log => console.log(`    - ${log}`));
      }
    });

    console.log('\n=== CONCLUSION ===\n');

    const fixIsWorking = dragAlreadyCompletedCount > 0 && cancellingInvalidDragCount === 0;

    if (fixIsWorking) {
      console.log('✅ RACE CONDITION FIX IS WORKING!');
      console.log('   - "Drag already completed, skipping" message appears');
      console.log('   - No "Cancelling invalid drag" messages for valid placements');
      console.log('   - Phase-based check is preventing duplicate event processing');
    } else if (cancellingInvalidDragCount > 0) {
      console.log('❌ RACE CONDITION STILL EXISTS!');
      console.log('   - "Cancelling invalid drag" messages detected for valid placements');
      console.log('   - Phase-based check may not be working correctly');
    } else if (dragAlreadyCompletedCount === 0) {
      console.log('⚠️  FIX NOT DETECTED');
      console.log('   - "Drag already completed, skipping" message not found');
      console.log('   - May indicate the events are not overlapping (race condition not triggered)');
    }

    if (successfulPlacements === 3) {
      console.log('✅ All creatures remained on grid');
    } else {
      console.log(`⚠️  Only ${successfulPlacements} creatures remained on grid`);
    }

    console.log('');
    console.log('Screenshots saved to:', SCREENSHOTS_DIR);
    console.log('');

  } catch (error) {
    console.error('ERROR during verification:', error.message);
    console.error(error.stack);

    // Take error screenshot
    const errorScreenshot = join(SCREENSHOTS_DIR, `error-${Date.now()}.png`);
    await page.screenshot({ path: errorScreenshot, fullPage: true });
    console.log(`Error screenshot saved: ${errorScreenshot}`);
  } finally {
    await browser.close();
  }
}

// Run the verification
verifyRaceConditionFix().catch(console.error);
