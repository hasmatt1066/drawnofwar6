/**
 * Manual test - Just open browser and capture console
 */
import puppeteer from 'puppeteer';

const URL = 'http://localhost:5176/deployment-grid';

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    devtools: true // Open DevTools automatically
  });

  const page = await browser.newPage();

  // Log all console messages
  page.on('console', msg => {
    console.log(`[BROWSER ${msg.type().toUpperCase()}]:`, msg.text());
  });

  // Log all errors
  page.on('pageerror', error => {
    console.error('[PAGE ERROR]:', error.message);
  });

  // Log network failures
  page.on('requestfailed', request => {
    console.error('[REQUEST FAILED]:', request.url(), request.failure().errorText);
  });

  console.log(`Navigating to ${URL}...`);
  await page.goto(URL, { waitUntil: 'domcontentloaded' });

  console.log('Page loaded. Waiting 30 seconds for you to inspect...');
  console.log('Check the browser window and DevTools.');
  console.log('URL should contain matchId and playerId parameters.');

  // Wait for manual inspection
  await new Promise(resolve => setTimeout(resolve, 30000));

  // Get final URL
  const finalUrl = page.url();
  console.log('\n=== FINAL URL ===');
  console.log(finalUrl);

  // Import URL from node:url
  const { URL: NodeURL } = await import('node:url');
  const urlParams = new NodeURL(finalUrl);
  console.log('\n=== URL PARAMETERS ===');
  console.log('matchId:', urlParams.searchParams.get('matchId'));
  console.log('playerId:', urlParams.searchParams.get('playerId'));

  // Check for canvas
  const canvas = await page.$('canvas');
  console.log('\n=== CANVAS STATUS ===');
  console.log('Canvas found:', canvas !== null);

  // Take screenshot
  await page.screenshot({ path: '/mnt/c/Users/mhast/Desktop/drawnofwar6/test-output/manual-test.png', fullPage: true });
  console.log('\nScreenshot saved to test-output/manual-test.png');

  console.log('\nClosing browser in 5 seconds...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  await browser.close();
})();
