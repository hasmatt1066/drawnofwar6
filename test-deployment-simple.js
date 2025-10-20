import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function testDeploymentGrid() {
  console.log('🚀 Starting Deployment Grid Race Condition Test...\n');

  const browser = await puppeteer.launch({
    headless: true, // Run headless for faster execution
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Collect console logs
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    consoleLogs.push({ type, text, timestamp: new Date().toISOString() });
  });

  const errors = [];
  page.on('pageerror', error => {
    errors.push(error.message);
    console.log(`❌ Page Error: ${error.message}`);
  });

  try {
    console.log('📍 Navigating to http://localhost:5177/deployment-grid...');

    await page.goto('http://localhost:5177/deployment-grid', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    console.log('✅ Page loaded\n');
    await delay(3000); // Wait for initialization

    // Create screenshots directory
    const screenshotDir = path.join(__dirname, 'test-screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir);
    }

    const timestamp = Date.now();

    // Take initial screenshot
    await page.screenshot({
      path: path.join(screenshotDir, `before-drag-${timestamp}.png`),
      fullPage: true
    });
    console.log('📸 Initial screenshot taken\n');

    // Wait for canvas
    console.log('🔍 Waiting for canvas...');
    await page.waitForSelector('canvas', { timeout: 10000 });

    const canvasInfo = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const rect = canvas.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    });

    console.log('📐 Canvas:', canvasInfo);

    // Find draggable creatures
    const draggables = await page.evaluate(() => {
      const elements = document.querySelectorAll('[draggable="true"]');
      return Array.from(elements).map(el => {
        const rect = el.getBoundingClientRect();
        return {
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2,
          text: el.textContent?.trim() || '',
          width: rect.width,
          height: rect.height
        };
      });
    });

    console.log(`\n🎮 Found ${draggables.length} draggable creatures`);

    if (draggables.length === 0) {
      console.log('❌ No draggable creatures found!');
      await browser.close();
      return;
    }

    // Test 1: Drag first creature
    console.log('\n🎯 TEST 1: Dragging first creature...');
    const creature1 = draggables[0];
    console.log(`Starting from: (${creature1.x}, ${creature1.y})`);

    // Calculate valid drop position for Player 1 (columns 0-2)
    const dropX1 = canvasInfo.x + (canvasInfo.width * 0.15);
    const dropY1 = canvasInfo.y + (canvasInfo.height * 0.3);
    console.log(`Dropping at: (${dropX1}, ${dropY1})`);

    const logsBefore1 = consoleLogs.length;

    await page.mouse.move(creature1.x, creature1.y);
    await delay(100);
    await page.mouse.down();
    await delay(150);
    await page.mouse.move(dropX1, dropY1, { steps: 5 });
    await delay(200);
    await page.mouse.up();

    console.log('✅ First drag completed');
    await delay(1500);

    // Take screenshot after first drag
    await page.screenshot({
      path: path.join(screenshotDir, `after-drag-1-${timestamp}.png`),
      fullPage: true
    });

    // Analyze logs
    const logs1 = consoleLogs.slice(logsBefore1);
    const success1 = logs1.find(l => l.text.includes('Placement success'));
    const alreadyPlaced1 = logs1.find(l => l.text.includes('already placed'));
    const cancelled1 = logs1.find(l => l.text.includes('Cancelling invalid drag'));

    console.log('\n📊 TEST 1 RESULTS:');
    console.log('─────────────────────────────');
    console.log('✓ Placement success:', success1 ? 'YES' : 'NO');
    if (success1) console.log('  ', success1.text);

    console.log('✓ Already placed (race fix):', alreadyPlaced1 ? 'YES ✅' : 'NO');
    if (alreadyPlaced1) console.log('  ', alreadyPlaced1.text);

    console.log('✓ Cancelled invalid:', cancelled1 ? 'YES ❌ (BAD)' : 'NO ✅ (GOOD)');
    if (cancelled1) console.log('  ', cancelled1.text);

    // Test 2: Drag second creature if available
    if (draggables.length > 1) {
      console.log('\n\n🎯 TEST 2: Dragging second creature...');
      const creature2 = draggables[1];

      const dropX2 = canvasInfo.x + (canvasInfo.width * 0.2);
      const dropY2 = canvasInfo.y + (canvasInfo.height * 0.5);

      const logsBefore2 = consoleLogs.length;

      await page.mouse.move(creature2.x, creature2.y);
      await delay(100);
      await page.mouse.down();
      await delay(150);
      await page.mouse.move(dropX2, dropY2, { steps: 5 });
      await delay(200);
      await page.mouse.up();

      console.log('✅ Second drag completed');
      await delay(1500);

      await page.screenshot({
        path: path.join(screenshotDir, `after-drag-2-${timestamp}.png`),
        fullPage: true
      });

      const logs2 = consoleLogs.slice(logsBefore2);
      const success2 = logs2.find(l => l.text.includes('Placement success'));
      const alreadyPlaced2 = logs2.find(l => l.text.includes('already placed'));
      const cancelled2 = logs2.find(l => l.text.includes('Cancelling invalid drag'));

      console.log('\n📊 TEST 2 RESULTS:');
      console.log('─────────────────────────────');
      console.log('✓ Placement success:', success2 ? 'YES' : 'NO');
      if (success2) console.log('  ', success2.text);

      console.log('✓ Already placed (race fix):', alreadyPlaced2 ? 'YES ✅' : 'NO');
      if (alreadyPlaced2) console.log('  ', alreadyPlaced2.text);

      console.log('✓ Cancelled invalid:', cancelled2 ? 'YES ❌ (BAD)' : 'NO ✅ (GOOD)');
      if (cancelled2) console.log('  ', cancelled2.text);
    }

    // Summary
    console.log('\n\n═══════════════════════════════════════');
    console.log('📋 FINAL SUMMARY');
    console.log('═══════════════════════════════════════');
    console.log(`Total logs: ${consoleLogs.length}`);
    console.log(`Errors: ${errors.length}`);

    // Find all relevant logs
    const relevantLogs = consoleLogs.filter(l =>
      l.text.includes('Placement') ||
      l.text.includes('drag') ||
      l.text.includes('already placed') ||
      l.text.includes('Cancelling')
    );

    if (relevantLogs.length > 0) {
      console.log('\n📜 Relevant logs:');
      relevantLogs.forEach(l => console.log(`  [${l.type}] ${l.text}`));
    }

    // Save full log
    const logFile = path.join(screenshotDir, `test-logs-${timestamp}.json`);
    fs.writeFileSync(logFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      totalLogs: consoleLogs.length,
      errors,
      relevantLogs,
      allLogs: consoleLogs
    }, null, 2));

    console.log(`\n💾 Logs saved: ${logFile}`);
    console.log(`📁 Screenshots: ${screenshotDir}`);

  } catch (error) {
    console.error('\n💥 Test failed:', error.message);

    const screenshotDir = path.join(__dirname, 'test-screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir);
    }

    try {
      await page.screenshot({
        path: path.join(screenshotDir, `error-${Date.now()}.png`),
        fullPage: true
      });
    } catch (e) {
      console.error('Could not take error screenshot:', e.message);
    }
  } finally {
    await browser.close();
    console.log('\n✅ Test completed\n');
  }
}

testDeploymentGrid().catch(console.error);
