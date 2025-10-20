import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to replace waitForTimeout
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function testDeploymentGrid() {
  console.log('🚀 Starting Deployment Grid Race Condition Test...\n');

  const browser = await puppeteer.launch({
    headless: false, // Run in visible mode to see what's happening
    devtools: true,  // Open DevTools automatically
    args: ['--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Collect console logs
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    consoleLogs.push({ type, text, timestamp: new Date().toISOString() });

    // Highlight important logs
    if (text.includes('Placement success') ||
        text.includes('already placed') ||
        text.includes('Cancelling invalid drag')) {
      console.log(`📋 [${type.toUpperCase()}] ${text}`);
    }
  });

  // Collect errors
  const errors = [];
  page.on('pageerror', error => {
    errors.push(error.message);
    console.log(`❌ Page Error: ${error.message}`);
  });

  page.on('requestfailed', request => {
    console.log(`⚠️  Request Failed: ${request.url()}`);
  });

  try {
    console.log('📍 Navigating to http://localhost:5177/deployment-grid-demo...');
    await page.goto('http://localhost:5177/deployment-grid-demo', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    console.log('✅ Page loaded\n');

    // Wait a bit for WebSocket connections and initial render
    console.log('⏳ Waiting for page to stabilize...');
    await delay(2000);

    // Take initial screenshot
    const screenshotDir = path.join(__dirname, 'test-screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir);
    }

    const timestamp = Date.now();
    await page.screenshot({
      path: path.join(screenshotDir, `before-drag-${timestamp}.png`),
      fullPage: true
    });
    console.log('📸 Initial screenshot taken\n');

    // Wait for the canvas to be ready
    console.log('🔍 Looking for deployment grid canvas...');
    await page.waitForSelector('canvas', { timeout: 10000 });
    console.log('✅ Canvas found\n');

    // Get canvas dimensions and position
    const canvasInfo = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const rect = canvas.getBoundingClientRect();
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      };
    });

    console.log('📐 Canvas info:', canvasInfo);

    // Look for roster creatures (assuming they're in a list or container)
    console.log('\n🔍 Looking for creature roster...');

    // Wait a bit more to ensure roster is rendered
    await delay(1000);

    // Try to find draggable creatures
    const rosterInfo = await page.evaluate(() => {
      // Look for elements that might be creatures in the roster
      const possibleRosters = [
        ...document.querySelectorAll('[class*="roster"]'),
        ...document.querySelectorAll('[class*="creature"]'),
        ...document.querySelectorAll('[draggable="true"]')
      ];

      return possibleRosters.map(el => ({
        tagName: el.tagName,
        className: el.className,
        id: el.id,
        draggable: el.draggable,
        rect: el.getBoundingClientRect()
      }));
    });

    console.log('📋 Found potential roster elements:', rosterInfo.length);
    if (rosterInfo.length > 0) {
      console.log('First few elements:', JSON.stringify(rosterInfo.slice(0, 3), null, 2));
    }

    // Test 1: Drag first creature to a valid hex (Player 1, column 0-2)
    console.log('\n🎯 TEST 1: Dragging first creature to valid hex...');

    // Calculate a valid drop position (left side of grid for Player 1)
    // Assuming hex grid starts at canvas position, target column 1, row 1
    const dropX = canvasInfo.x + (canvasInfo.width * 0.2); // 20% from left
    const dropY = canvasInfo.y + (canvasInfo.height * 0.3); // 30% from top

    console.log(`📍 Drop target position: (${dropX}, ${dropY})`);

    // Find the first draggable creature
    const firstCreature = await page.evaluate(() => {
      const draggable = document.querySelector('[draggable="true"]');
      if (draggable) {
        const rect = draggable.getBoundingClientRect();
        return {
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2,
          text: draggable.textContent,
          className: draggable.className
        };
      }
      return null;
    });

    if (!firstCreature) {
      console.log('❌ No draggable creatures found!');
      await browser.close();
      return;
    }

    console.log('🎮 Found creature to drag:', firstCreature);

    // Clear previous logs for this test
    const logsBeforeDrag = consoleLogs.length;

    // Perform drag operation
    console.log('\n🖱️  Performing drag operation...');
    await page.mouse.move(firstCreature.x, firstCreature.y);
    await page.mouse.down();
    await delay(100); // Small delay to start drag

    await page.mouse.move(dropX, dropY, { steps: 10 }); // Smooth drag
    await delay(200); // Hold over target

    await page.mouse.up();

    console.log('✅ Drag completed');

    // Wait for any async operations to complete
    await delay(1000);

    // Take screenshot after first drag
    await page.screenshot({
      path: path.join(screenshotDir, `after-drag-1-${timestamp}.png`),
      fullPage: true
    });
    console.log('📸 Screenshot after first drag taken\n');

    // Analyze logs from this drag
    const dragLogs = consoleLogs.slice(logsBeforeDrag);
    const placementSuccess = dragLogs.find(log => log.text.includes('Placement success'));
    const alreadyPlaced = dragLogs.find(log => log.text.includes('already placed'));
    const cancelledInvalid = dragLogs.find(log => log.text.includes('Cancelling invalid drag'));

    console.log('\n📊 TEST 1 RESULTS:');
    console.log('─────────────────────────────────────');
    console.log('Placement success log:', placementSuccess ? '✅ FOUND' : '❌ NOT FOUND');
    if (placementSuccess) console.log('  └─', placementSuccess.text);

    console.log('Already placed log:', alreadyPlaced ? '✅ FOUND (race fix working)' : '⚠️  NOT FOUND');
    if (alreadyPlaced) console.log('  └─', alreadyPlaced.text);

    console.log('Cancelled invalid log:', cancelledInvalid ? '❌ FOUND (bad!)' : '✅ NOT FOUND (good)');
    if (cancelledInvalid) console.log('  └─', cancelledInvalid.text);

    // Check if creature is on grid
    await delay(500);

    // Test 2: Try dragging another creature
    console.log('\n\n🎯 TEST 2: Dragging second creature to different valid hex...');

    const logsBeforeDrag2 = consoleLogs.length;

    // Find second draggable creature
    const secondCreature = await page.evaluate(() => {
      const draggables = document.querySelectorAll('[draggable="true"]');
      if (draggables.length > 1) {
        const el = draggables[1];
        const rect = el.getBoundingClientRect();
        return {
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2,
          text: el.textContent,
          className: el.className
        };
      } else if (draggables.length === 1) {
        // If only one draggable left, use it
        const el = draggables[0];
        const rect = el.getBoundingClientRect();
        return {
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2,
          text: el.textContent,
          className: el.className
        };
      }
      return null;
    });

    if (secondCreature) {
      console.log('🎮 Found second creature to drag:', secondCreature);

      // Different drop position (still valid for Player 1)
      const dropX2 = canvasInfo.x + (canvasInfo.width * 0.15);
      const dropY2 = canvasInfo.y + (canvasInfo.height * 0.5);

      console.log(`📍 Drop target position: (${dropX2}, ${dropY2})`);

      await page.mouse.move(secondCreature.x, secondCreature.y);
      await page.mouse.down();
      await delay(100);

      await page.mouse.move(dropX2, dropY2, { steps: 10 });
      await delay(200);

      await page.mouse.up();

      console.log('✅ Second drag completed');
      await delay(1000);

      // Take screenshot after second drag
      await page.screenshot({
        path: path.join(screenshotDir, `after-drag-2-${timestamp}.png`),
        fullPage: true
      });
      console.log('📸 Screenshot after second drag taken\n');

      // Analyze logs from second drag
      const dragLogs2 = consoleLogs.slice(logsBeforeDrag2);
      const placementSuccess2 = dragLogs2.find(log => log.text.includes('Placement success'));
      const alreadyPlaced2 = dragLogs2.find(log => log.text.includes('already placed'));
      const cancelledInvalid2 = dragLogs2.find(log => log.text.includes('Cancelling invalid drag'));

      console.log('\n📊 TEST 2 RESULTS:');
      console.log('─────────────────────────────────────');
      console.log('Placement success log:', placementSuccess2 ? '✅ FOUND' : '❌ NOT FOUND');
      if (placementSuccess2) console.log('  └─', placementSuccess2.text);

      console.log('Already placed log:', alreadyPlaced2 ? '✅ FOUND (race fix working)' : '⚠️  NOT FOUND');
      if (alreadyPlaced2) console.log('  └─', alreadyPlaced2.text);

      console.log('Cancelled invalid log:', cancelledInvalid2 ? '❌ FOUND (bad!)' : '✅ NOT FOUND (good)');
      if (cancelledInvalid2) console.log('  └─', cancelledInvalid2.text);
    } else {
      console.log('⚠️  No second creature available to drag');
    }

    // Final summary
    console.log('\n\n═══════════════════════════════════════');
    console.log('📋 FINAL TEST SUMMARY');
    console.log('═══════════════════════════════════════\n');

    console.log('Total console logs captured:', consoleLogs.length);
    console.log('Total errors:', errors.length);

    if (errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      errors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
    }

    // Filter and display relevant logs
    const relevantLogs = consoleLogs.filter(log =>
      log.text.includes('Placement') ||
      log.text.includes('already placed') ||
      log.text.includes('Cancelling') ||
      log.text.includes('drag') ||
      log.text.includes('hex')
    );

    if (relevantLogs.length > 0) {
      console.log('\n📜 All relevant logs:');
      relevantLogs.forEach(log => {
        console.log(`  [${log.type}] ${log.text}`);
      });
    }

    // Write full log to file
    const logFile = path.join(screenshotDir, `test-logs-${timestamp}.json`);
    fs.writeFileSync(logFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      totalLogs: consoleLogs.length,
      errors,
      relevantLogs,
      allLogs: consoleLogs
    }, null, 2));
    console.log(`\n💾 Full logs saved to: ${logFile}`);
    console.log(`📁 Screenshots saved to: ${screenshotDir}`);

    // Keep browser open for manual inspection
    console.log('\n⏸️  Browser will remain open for 30 seconds for manual inspection...');
    await delay(30000);

  } catch (error) {
    console.error('\n💥 Test failed with error:', error);

    // Take error screenshot
    try {
      const screenshotDir = path.join(__dirname, 'test-screenshots');
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir);
      }
      await page.screenshot({
        path: path.join(screenshotDir, `error-${Date.now()}.png`),
        fullPage: true
      });
    } catch (screenshotError) {
      console.error('Failed to take error screenshot:', screenshotError);
    }
  } finally {
    await browser.close();
    console.log('\n✅ Test completed, browser closed');
  }
}

// Run the test
testDeploymentGrid().catch(console.error);
