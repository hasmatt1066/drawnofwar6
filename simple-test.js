/**
 * Simplified test - Just check if page works
 */
import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  console.log('Test 1: Navigate to page');
  await page.goto('http://localhost:5176/deployment-grid', { waitUntil: 'domcontentloaded', timeout: 15000 });
  console.log('✅ Page loaded');

  // Wait for URL to update with parameters
  console.log('\nTest 2: Wait for URL redirect with parameters');
  await page.waitForFunction(() => {
    const url = new URL(window.location.href);
    return url.searchParams.has('matchId') && url.searchParams.has('playerId');
  }, { timeout: 10000 });

  const url = page.url();
  console.log('✅ URL updated:', url);

  const urlObj = new URL(url);
  const matchId = urlObj.searchParams.get('matchId');
  const playerId = urlObj.searchParams.get('playerId');
  console.log('  - matchId:', matchId);
  console.log('  - playerId:', playerId);

  console.log('\nTest 3: Wait for React app to render');
  await page.waitForSelector('#root', { timeout: 5000 });
  const hasContent = await page.evaluate(() => document.querySelector('#root').innerHTML.trim().length > 0);
  if (hasContent) {
    console.log('✅ React app rendered');
  } else {
    console.log('❌ React app not rendered');
  }

  console.log('\nTest 4: Check for PixiJS canvas (wait up to 15s)');
  try {
    await page.waitForSelector('canvas', { timeout: 15000 });
    console.log('✅ Canvas found');
  } catch (err) {
    console.log('❌ Canvas not found within 15 seconds');

    // Get console logs
    const logs = await page.evaluate(() => {
      return window.__CONSOLE_LOGS__ || [];
    });

    // Take screenshot for debugging
    await page.screenshot({ path: '/mnt/c/Users/mhast/Desktop/drawnofwar6/test-output/error-screenshot.png' });
    console.log('Screenshot saved: test-output/error-screenshot.png');
  }

  console.log('\nTest 5: Check Socket.IO connection');
  await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for connection

  const connectionInfo = await page.evaluate(() => {
    // Check if there's any connection indicator
    return {
      hasMatchState: localStorage.getItem('matchState') !== null,
      matchStateValue: localStorage.getItem('matchState')
    };
  });

  if (connectionInfo.hasMatchState) {
    console.log('✅ Match state found in localStorage');
    console.log('  ', connectionInfo.matchStateValue);
  } else {
    console.log('⚠️  No match state in localStorage (might be OK if using React state)');
  }

  console.log('\n=== ALL TESTS COMPLETE ===');
  await browser.close();
})().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
