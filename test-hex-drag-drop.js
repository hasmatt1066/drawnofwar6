import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testHexGridDragDrop() {
  console.log('Starting Puppeteer test for hex grid drag-and-drop...\n');

  const browser = await puppeteer.launch({
    headless: false, // Set to true for headless mode
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    slowMo: 100 // Slow down by 100ms for visibility
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Collect console logs
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    console.log(`[CONSOLE ${msg.type()}]:`, text);
  });

  // Collect errors
  const errors = [];
  page.on('pageerror', error => {
    errors.push(error.message);
    console.log('[PAGE ERROR]:', error.message);
  });

  try {
    console.log('Navigating to http://localhost:5177/deployment-grid-demo...');
    await page.goto('http://localhost:5177/deployment-grid-demo', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    console.log('Page loaded. Waiting for hex grid canvas to appear...\n');

    // Wait for canvas to be present and take debug screenshot
    console.log('Checking for canvas element...');

    // Take a debug screenshot to see what's on the page
    const debugScreenshot = join(__dirname, 'screenshot-debug-page.png');
    await page.screenshot({ path: debugScreenshot, fullPage: true });
    console.log(`Debug screenshot saved to: ${debugScreenshot}`);

    // Check what elements are on the page
    const bodyContent = await page.evaluate(() => {
      const canvases = document.querySelectorAll('canvas');
      const draggables = document.querySelectorAll('[draggable]');
      return {
        hasCanvas: canvases.length > 0,
        canvasCount: canvases.length,
        draggableCount: draggables.length,
        bodyHTML: document.body.innerHTML.substring(0, 500)
      };
    });

    console.log('Page content check:', bodyContent);

    if (!bodyContent.hasCanvas) {
      console.log('❌ No canvas found on page. Waiting longer...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      const recheckContent = await page.evaluate(() => {
        const canvases = document.querySelectorAll('canvas');
        return {
          hasCanvas: canvases.length > 0,
          canvasCount: canvases.length
        };
      });

      console.log('Recheck:', recheckContent);

      if (!recheckContent.hasCanvas) {
        throw new Error('Canvas never appeared on page');
      }
    }

    console.log('Canvas element found!\n');

    // Wait a bit for everything to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Take initial screenshot
    const screenshotPath1 = join(__dirname, 'screenshot-initial.png');
    await page.screenshot({ path: screenshotPath1, fullPage: true });
    console.log(`Initial screenshot saved to: ${screenshotPath1}\n`);

    // Try to find creature cards in the roster
    console.log('Looking for creature cards in the roster...');

    // Try multiple possible selectors
    const possibleSelectors = [
      '[data-creature-id]',
      '[draggable="true"]',
      '.creature-card',
      '.roster-item',
      'div[draggable]',
      'button[draggable]'
    ];

    let creatureElement = null;
    let usedSelector = null;

    for (const selector of possibleSelectors) {
      creatureElement = await page.$(selector);
      if (creatureElement) {
        usedSelector = selector;
        console.log(`Found creature element with selector: ${selector}`);
        break;
      }
    }

    if (!creatureElement) {
      console.log('Could not find creature card with any known selector.');
      console.log('Trying to find all draggable elements...');

      const draggableElements = await page.$$('[draggable]');
      console.log(`Found ${draggableElements.length} draggable elements`);

      if (draggableElements.length > 0) {
        creatureElement = draggableElements[0];
        usedSelector = '[draggable] (first element)';
        console.log('Using first draggable element');
      }
    }

    if (!creatureElement) {
      console.log('\n❌ No creature cards found to drag. Cannot proceed with drag test.');
      console.log('Available elements on page:');
      const bodyHTML = await page.evaluate(() => document.body.innerHTML.substring(0, 1000));
      console.log(bodyHTML);
    } else {
      console.log(`\nFound creature card using selector: ${usedSelector}`);

      // Get creature element position
      const creatureBoundingBox = await creatureElement.boundingBox();
      console.log('Creature card position:', creatureBoundingBox);

      // Get canvas position
      const canvas = await page.$('canvas');
      const canvasBoundingBox = await canvas.boundingBox();
      console.log('Canvas position:', canvasBoundingBox);

      // Calculate drag start and end positions
      const startX = creatureBoundingBox.x + creatureBoundingBox.width / 2;
      const startY = creatureBoundingBox.y + creatureBoundingBox.height / 2;
      const endX = canvasBoundingBox.x + canvasBoundingBox.width / 2;
      const endY = canvasBoundingBox.y + canvasBoundingBox.height / 2;

      console.log(`\nDrag operation:`);
      console.log(`  From: (${Math.round(startX)}, ${Math.round(startY)})`);
      console.log(`  To: (${Math.round(endX)}, ${Math.round(endY)})`);

      // Clear console logs before drag
      consoleLogs.length = 0;

      console.log('\nStarting drag operation...');

      // Perform drag and drop
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      console.log('Mouse down at creature card');

      await new Promise(resolve => setTimeout(resolve, 500));

      // Move to canvas center with intermediate steps for better detection
      const steps = 10;
      for (let i = 1; i <= steps; i++) {
        const x = startX + (endX - startX) * (i / steps);
        const y = startY + (endY - startY) * (i / steps);
        await page.mouse.move(x, y);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      console.log('Mouse moved to canvas center');
      await new Promise(resolve => setTimeout(resolve, 500));

      await page.mouse.up();
      console.log('Mouse up (drop complete)');

      // Wait for any animations or state updates
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Take screenshot after drag
      const screenshotPath2 = join(__dirname, 'screenshot-after-drag.png');
      await page.screenshot({ path: screenshotPath2, fullPage: true });
      console.log(`\nAfter-drag screenshot saved to: ${screenshotPath2}\n`);

      // Analyze console logs
      console.log('\n=== ANALYSIS ===\n');

      const dragOverLogs = consoleLogs.filter(log => log.includes('[DragOver] Mouse at pixel'));
      const hexCoordinateLogs = consoleLogs.filter(log => log.includes('hex:'));
      const autoCompleteLogs = consoleLogs.filter(log => log.includes('Auto-completing drag to target hex'));
      const errorLogs = consoleLogs.filter(log => log.toLowerCase().includes('error'));

      console.log(`1. Hex Hover Detection:`);
      if (dragOverLogs.length > 0) {
        console.log(`   ✅ Working! Found ${dragOverLogs.length} "[DragOver] Mouse at pixel" messages`);
        console.log(`   Sample: ${dragOverLogs[0]}`);
        if (hexCoordinateLogs.length > 0) {
          console.log(`   ✅ Hex coordinates detected: ${hexCoordinateLogs.length} messages`);
          console.log(`   Sample: ${hexCoordinateLogs[0]}`);
        }
      } else {
        console.log(`   ❌ No drag over detection messages found`);
      }

      console.log(`\n2. Placement Success:`);
      if (autoCompleteLogs.length > 0) {
        console.log(`   ✅ Placement succeeded!`);
        console.log(`   ${autoCompleteLogs[0]}`);
      } else {
        console.log(`   ❌ No "Auto-completing drag to target hex" message found`);
      }

      console.log(`\n3. Errors:`);
      if (errors.length > 0 || errorLogs.length > 0) {
        console.log(`   ❌ Found ${errors.length} page errors and ${errorLogs.length} console errors`);
        errors.forEach(err => console.log(`   - ${err}`));
        errorLogs.forEach(err => console.log(`   - ${err}`));
      } else {
        console.log(`   ✅ No errors detected`);
      }

      console.log(`\n4. All Console Logs (${consoleLogs.length} total):`);
      consoleLogs.forEach((log, i) => {
        console.log(`   [${i + 1}] ${log}`);
      });
    }

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error(error.stack);
  } finally {
    console.log('\n=== Test Complete ===');
    console.log('Closing browser in 3 seconds...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    await browser.close();
  }
}

// Run the test
testHexGridDragDrop().catch(console.error);
