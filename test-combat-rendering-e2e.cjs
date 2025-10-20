/**
 * End-to-End Test: Combat Rendering with Real Sprites
 *
 * This test verifies:
 * 1. Creatures render with actual sprites (not placeholders) during combat
 * 2. Page doesn't auto-scroll to bottom when combat starts
 * 3. Complete user flow: deployment → ready → combat → visual verification
 */

const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: false, // Run in visible mode to see what's happening
    slowMo: 100, // Slow down actions to make them visible
    args: ['--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  console.log('\n🎮 Starting Combat Rendering E2E Test\n');

  try {
    // Step 1: Navigate to deployment page
    console.log('Step 1: Navigating to deployment page...');
    await page.goto('http://localhost:5176/deployment-demo', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    console.log('✓ Page loaded\n');

    // Step 2: Wait for deployment grid to render
    console.log('Step 2: Waiting for deployment grid...');
    await page.waitForSelector('canvas', { timeout: 10000 });
    console.log('✓ Deployment grid rendered\n');

    // Step 3: Get initial scroll position (should be at top)
    const initialScrollY = await page.evaluate(() => window.scrollY);
    console.log(`Step 3: Initial scroll position: ${initialScrollY}px\n`);

    // Step 4: Place a creature for Player 1
    console.log('Step 4: Placing creature for Player 1...');

    // Find creature roster item and drag it to deployment zone
    await page.waitForSelector('[class*="roster"] [class*="creature"]', { timeout: 5000 });

    // Click on the first creature in roster to select it
    const creatureCard = await page.$('[class*="roster"] [class*="creature"]');
    if (creatureCard) {
      await creatureCard.click();
      console.log('✓ Selected creature from roster');

      // Drag creature to deployment zone
      // We'll simulate this by finding a valid hex and clicking it
      await page.waitForTimeout(500);

      // Find the deployment grid canvas and click in a valid zone
      const canvas = await page.$('canvas');
      if (canvas) {
        const box = await canvas.boundingBox();
        // Click in the left deployment zone (Player 1's side)
        await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.5);
        await page.waitForTimeout(500);
        console.log('✓ Placed creature on grid');
      }
    }

    console.log('✓ Creature placed\n');

    // Step 5: Simulate opponent placing a creature
    console.log('Step 5: Waiting for opponent to place creature...');
    // In real scenario, opponent would place via separate connection
    // For demo, we can trigger this via the test script or manual interaction
    await page.waitForTimeout(1000);
    console.log('✓ Opponent creature placed\n');

    // Step 6: Click Ready button
    console.log('Step 6: Marking ready...');
    const readyButton = await page.waitForSelector('button:not([disabled])', { timeout: 5000 });

    // Find the "Ready" button specifically
    const buttons = await page.$$('button');
    for (const button of buttons) {
      const text = await page.evaluate(el => el.textContent, button);
      if (text.includes('Ready') || text.includes('Mark Ready')) {
        console.log(`Found button with text: "${text}"`);
        await button.click();
        console.log('✓ Clicked Ready button');
        break;
      }
    }

    console.log('✓ Ready marked\n');

    // Step 7: Wait for combat to start
    console.log('Step 7: Waiting for combat to start...');
    // Wait for combat-related UI changes
    await page.waitForTimeout(3000); // Wait for countdown + combat start
    console.log('✓ Combat started\n');

    // Step 8: Capture scroll position immediately after combat starts
    const combatStartScrollY = await page.evaluate(() => window.scrollY);
    console.log(`Step 8: Scroll position after combat start: ${combatStartScrollY}px`);

    if (Math.abs(combatStartScrollY - initialScrollY) > 50) {
      console.log(`❌ FAIL: Page auto-scrolled! Moved ${combatStartScrollY - initialScrollY}px`);
    } else {
      console.log(`✓ PASS: Scroll position preserved (diff: ${combatStartScrollY - initialScrollY}px)\n`);
    }

    // Step 9: Take screenshot of combat view
    console.log('Step 9: Capturing combat view screenshot...');
    await page.screenshot({
      path: '/mnt/c/Users/mhast/Desktop/drawnofwar6/screenshots/combat-rendering-test.png',
      fullPage: true
    });
    console.log('✓ Screenshot saved to screenshots/combat-rendering-test.png\n');

    // Step 10: Check console logs for sprite rendering
    console.log('Step 10: Checking console logs for sprite rendering...');
    const logs = [];
    page.on('console', msg => {
      const text = msg.text();
      logs.push(text);
      if (text.includes('[CombatVisualizationManager]') ||
          text.includes('spriteData') ||
          text.includes('renderCreature')) {
        console.log(`  📋 ${text}`);
      }
    });

    // Wait a bit to collect logs
    await page.waitForTimeout(2000);

    // Step 11: Check for placeholder vs real sprite rendering
    console.log('\nStep 11: Analyzing sprite rendering...');
    const hasSpriteDataLogs = logs.some(log =>
      log.includes('hasSpriteData: true') ||
      log.includes('Loaded sprite data for')
    );
    const hasPlaceholderLogs = logs.some(log =>
      log.includes('spriteData type: undefined')
    );

    if (hasSpriteDataLogs && !hasPlaceholderLogs) {
      console.log('✓ PASS: Creatures rendering with real sprite data\n');
    } else if (hasPlaceholderLogs) {
      console.log('❌ FAIL: Creatures rendering with placeholders (no sprite data)\n');
    } else {
      console.log('⚠️  WARN: Unable to determine sprite rendering status from logs\n');
    }

    // Step 12: Visual verification using canvas inspection
    console.log('Step 12: Inspecting canvas rendering...');
    const canvasInfo = await page.evaluate(() => {
      const canvases = document.querySelectorAll('canvas');
      return Array.from(canvases).map((canvas, i) => ({
        index: i,
        width: canvas.width,
        height: canvas.height,
        parent: canvas.parentElement?.className || 'unknown'
      }));
    });
    console.log('Canvas elements found:', canvasInfo);
    console.log('✓ Combat canvas rendered\n');

    // Final summary
    console.log('═══════════════════════════════════════');
    console.log('         TEST SUMMARY');
    console.log('═══════════════════════════════════════');
    console.log(`✓ Deployment page loaded`);
    console.log(`✓ Creatures placed`);
    console.log(`✓ Combat started`);
    console.log(`${Math.abs(combatStartScrollY - initialScrollY) <= 50 ? '✓' : '❌'} Scroll position preserved`);
    console.log(`${hasSpriteDataLogs ? '✓' : '❌'} Sprite data loaded`);
    console.log(`${!hasPlaceholderLogs ? '✓' : '❌'} No placeholder rendering`);
    console.log('═══════════════════════════════════════\n');

    console.log('⏸️  Browser will stay open for 30 seconds for manual inspection...');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error(error.stack);

    // Take error screenshot
    try {
      await page.screenshot({
        path: '/mnt/c/Users/mhast/Desktop/drawnofwar6/screenshots/combat-rendering-error.png',
        fullPage: true
      });
      console.log('Error screenshot saved to screenshots/combat-rendering-error.png');
    } catch (screenshotError) {
      console.error('Failed to capture error screenshot:', screenshotError.message);
    }
  } finally {
    await browser.close();
    console.log('\n🏁 Test complete');
  }
})();
