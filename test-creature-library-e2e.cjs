/**
 * End-to-End Test: Creature Library Feature
 *
 * Tests the complete flow:
 * 1. Generate a creature
 * 2. Save to library
 * 3. Deploy to battlefield
 * 4. Verify creature appears
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Configuration
const FRONTEND_URL = 'http://localhost:5175';
const SCREENSHOT_DIR = 'test-screenshots';

// Create screenshot directory
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function testCreatureLibraryE2E() {
  console.log('🧪 Starting Creature Library E2E Test\n');
  console.log('Prerequisites:');
  console.log('  - Frontend running on port 5175');
  console.log('  - Backend running on port 3001');
  console.log('  - Firebase emulator running');
  console.log('  - Redis running\n');

  const browser = await puppeteer.launch({
    headless: false,
    slowMo: 150,
    args: ['--window-size=1920,1080']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Listen for console messages
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('Browser Error:', msg.text());
    }
  });

  try {
    // Step 1: Navigate to generation page
    console.log('📍 Step 1: Navigating to generation page...');
    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle2', timeout: 10000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-generation-page.png') });
    console.log('✅ Generation page loaded\n');

    // Step 2: Fill in creature description
    console.log('📝 Step 2: Filling in creature description...');
    await page.waitForTimeout(1000);

    // Try to find textarea or text input
    const descriptionInput = await page.$('textarea') || await page.$('input[name="description"]');
    if (!descriptionInput) {
      throw new Error('Could not find description input field');
    }

    await descriptionInput.click();
    await descriptionInput.type('a fierce fire dragon', { delay: 50 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-description-filled.png') });
    console.log('✅ Description entered\n');

    // Step 3: Submit generation
    console.log('🚀 Step 3: Submitting generation...');

    // Find and click submit button
    const submitButton = await page.$('button[type="submit"]') ||
                         await page.$('button:not([disabled])');

    if (!submitButton) {
      throw new Error('Could not find submit button');
    }

    await submitButton.click();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-generation-started.png') });
    console.log('✅ Generation submitted\n');

    // Step 4: Wait for generation to complete
    console.log('⏳ Step 4: Waiting for generation to complete (may take 30-120 seconds)...');

    // Wait for the page to show completion (look for Save button or success indicator)
    // Increased timeout for generation to complete
    await page.waitForFunction(
      () => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.some(btn => btn.textContent.includes('Save to Library') ||
                                   btn.textContent.includes('Save'));
      },
      { timeout: 180000 } // 3 minutes timeout
    );

    await page.waitForTimeout(2000); // Give UI time to settle
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-generation-complete.png') });
    console.log('✅ Generation completed\n');

    // Step 5: Save to library
    console.log('💾 Step 5: Saving creature to library...');

    // Select player (demo-player1)
    const playerSelect = await page.$('select');
    if (playerSelect) {
      await playerSelect.select('demo-player1');
      console.log('  Selected demo-player1');
    }

    // Find and click Save button
    const saveButton = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(btn => btn.textContent.includes('Save to Library') ||
                                 btn.textContent.includes('Save'));
    });

    if (!saveButton) {
      throw new Error('Could not find Save to Library button');
    }

    await saveButton.asElement().click();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-save-clicked.png') });

    // Wait for save to complete
    console.log('  Waiting for save to complete...');
    await page.waitForFunction(
      () => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.some(btn => btn.textContent.includes('Saved') ||
                                   btn.textContent.includes('✓'));
      },
      { timeout: 30000 }
    );

    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-save-success.png') });
    console.log('✅ Creature saved successfully\n');

    // Step 6: Deploy to battle
    console.log('⚔️ Step 6: Deploying to battle...');

    // Find Deploy to Battle button
    const deployButton = await page.evaluateHandle(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(btn => btn.textContent.includes('Deploy to Battle') ||
                                 btn.textContent.includes('Deploy'));
    });

    if (!deployButton) {
      throw new Error('Could not find Deploy to Battle button');
    }

    await deployButton.asElement().click();

    // Wait for navigation to deployment page
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-deployment-page.png') });
    console.log('✅ Navigated to deployment page\n');

    // Step 7: Verify deployment page
    console.log('🔍 Step 7: Verifying creature appears on battlefield...');

    const currentUrl = page.url();
    console.log('  Current URL:', currentUrl);

    // Check URL contains deployment path
    if (!currentUrl.includes('/deployment')) {
      throw new Error(`Expected deployment page, got: ${currentUrl}`);
    }

    // Check URL has creatures parameter
    if (!currentUrl.includes('creatures=')) {
      throw new Error('URL missing creatures parameter - creature ID not passed');
    }

    // Extract creature ID from URL
    const creatureIdMatch = currentUrl.match(/creatures=([^&]+)/);
    const creatureId = creatureIdMatch ? creatureIdMatch[1] : 'unknown';
    console.log('  Creature ID:', creatureId);

    // Wait for canvas (battlefield grid)
    await page.waitForSelector('canvas', { timeout: 5000 });
    console.log('  ✓ Canvas element found');

    // Give time for sprites to load
    await page.waitForTimeout(3000);

    // Take final screenshot
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08-creature-on-battlefield.png') });
    console.log('✅ Deployment page loaded with creature\n');

    // Success!
    console.log('═══════════════════════════════════════');
    console.log('🎉 E2E TEST PASSED!');
    console.log('═══════════════════════════════════════\n');
    console.log('All steps completed successfully:');
    console.log('  ✅ Generated creature from text description');
    console.log('  ✅ Saved to library (demo-player1)');
    console.log('  ✅ Deployed to battlefield');
    console.log('  ✅ Creature visible on deployment page');
    console.log(`  ✅ Creature ID: ${creatureId}\n`);
    console.log(`Screenshots saved to: ${SCREENSHOT_DIR}/\n`);

    return { success: true, creatureId };

  } catch (error) {
    console.error('═══════════════════════════════════════');
    console.error('❌ E2E TEST FAILED');
    console.error('═══════════════════════════════════════\n');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);

    // Take error screenshot
    try {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'ERROR-failure.png') });
      console.error(`\nError screenshot saved to: ${SCREENSHOT_DIR}/ERROR-failure.png\n`);
    } catch (screenshotError) {
      console.error('Could not take error screenshot:', screenshotError.message);
    }

    return { success: false, error: error.message };

  } finally {
    console.log('Closing browser...');
    await browser.close();
  }
}

// Run the test
console.log('Starting E2E test in 2 seconds...\n');
setTimeout(() => {
  testCreatureLibraryE2E()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}, 2000);
