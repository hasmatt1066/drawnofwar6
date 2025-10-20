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
    headless: false, // Run with visible browser for better debugging
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ],
    defaultViewport: { width: 1920, height: 1080 }
  });
  console.log('Browser launched successfully\n');

  const page = await browser.newPage();

  // Capture console logs
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push({ text, timestamp: Date.now() });
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
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Wait for page to be fully loaded
    console.log('2. Waiting for page to load...');
    await new Promise(resolve => setTimeout(resolve, 8000)); // Give plenty of time

    // Take initial screenshot
    const initialScreenshot = join(SCREENSHOTS_DIR, `01-initial-state-${Date.now()}.png`);
    await page.screenshot({ path: initialScreenshot, fullPage: true });
    console.log(`   Screenshot saved: ${initialScreenshot}\n`);

    // Find roster items (draggable creatures)
    console.log('3. Finding roster items...');
    const rosterItems = await page.$$('[draggable="true"]');
    console.log(`   Found ${rosterItems.length} draggable items\n`);

    if (rosterItems.length < 3) {
      throw new Error(`Not enough roster items found. Expected at least 3, got ${rosterItems.length}`);
    }

    console.log('4. Starting drag operations...\n');
    console.log('   NOTE: Watch the browser window - you should see creatures being dragged!\n');

    const dragResults = [];

    // Drag 3 creatures onto the grid
    for (let i = 0; i < 3; i++) {
      console.log(`5.${i + 1}. Dragging creature ${i + 1}...`);

      const beforeLogCount = consoleLogs.length;

      // Get the roster item
      const rosterItem = rosterItems[i];
      const box = await rosterItem.boundingBox();

      if (!box) {
        console.log(`   WARNING: Could not get bounding box for roster item ${i}`);
        continue;
      }

      // Start position (center of roster item)
      const startX = box.x + box.width / 2;
      const startY = box.y + box.height / 2;

      // End position (middle-right area of screen, should be on grid)
      const endX = 800 + (i * 100); // Spread them out horizontally
      const endY = 600; // Mid-height

      console.log(`   Dragging from (${Math.round(startX)}, ${Math.round(startY)}) to (${endX}, ${endY})`);

      // Perform the drag
      await page.mouse.move(startX, startY);
      await new Promise(resolve => setTimeout(resolve, 200));

      await page.mouse.down();
      await new Promise(resolve => setTimeout(resolve, 300));

      // Move to target in steps
      const steps = 15;
      for (let step = 0; step <= steps; step++) {
        const progress = step / steps;
        const currentX = startX + (endX - startX) * progress;
        const currentY = startY + (endY - startY) * progress;
        await page.mouse.move(currentX, currentY);
        await new Promise(resolve => setTimeout(resolve, 20));
      }

      await new Promise(resolve => setTimeout(resolve, 300));
      await page.mouse.up();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for processing

      // Analyze logs for this drag
      const dragLogs = consoleLogs.slice(beforeLogCount).map(l => l.text);

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
        placementSuccess,
        dragAlreadyCompleted,
        cancellingInvalidDrag,
        relevantLogs: dragLogs.filter(log =>
          log.includes('Placement success') ||
          log.includes('Drag already completed') ||
          log.includes('Cancelling invalid drag') ||
          log.includes('handleDragEnd') ||
          log.includes('handleDrop') ||
          log.includes('Drag started') ||
          log.includes('Drag ended')
        )
      });

      console.log(`   Placement success: ${placementSuccess}`);
      console.log(`   Drag already completed message: ${dragAlreadyCompleted}`);
      console.log(`   Cancelling invalid drag message: ${cancellingInvalidDrag}`);

      // Take screenshot after each placement
      const placementScreenshot = join(SCREENSHOTS_DIR, `02-after-creature-${i + 1}-${Date.now()}.png`);
      await page.screenshot({ path: placementScreenshot, fullPage: true });
      console.log(`   Screenshot saved: ${placementScreenshot}\n`);
    }

    // Wait for all updates to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check placement counter
    console.log('6. Checking final state...');
    const finalState = await page.evaluate(() => {
      // Find deployment status text
      const statusElement = document.querySelector('body');
      const statusText = statusElement ? statusElement.textContent : '';

      // Look for placement count
      const match = statusText.match(/Creatures Deployed:\s*(\d+)\s*\/\s*(\d+)/);

      return {
        fullText: statusText.substring(0, 500),
        placementCount: match ? match[1] : 'not found',
        maxPlacements: match ? match[2] : 'not found'
      };
    });

    console.log(`   Placement counter: ${finalState.placementCount}/${finalState.maxPlacements}\n`);

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
    console.log(`Final placement counter: ${finalState.placementCount}/${finalState.maxPlacements}`);
    console.log('');

    console.log('Detailed Results:');
    dragResults.forEach((result, index) => {
      console.log(`\nCreature ${index + 1}:`);
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
      console.log('   - Or the drag operations may have failed');
    }

    if (successfulPlacements === 3) {
      console.log('✅ All creatures remained on grid');
    } else if (successfulPlacements > 0) {
      console.log(`⚠️  Only ${successfulPlacements} creatures remained on grid`);
    } else {
      console.log('❌ No creatures were successfully placed');
    }

    console.log('');
    console.log('Screenshots saved to:', SCREENSHOTS_DIR);
    console.log('');
    console.log('=== Press Ctrl+C to close browser ===');

    // Keep browser open for manual inspection
    await new Promise(resolve => setTimeout(resolve, 30000));

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
