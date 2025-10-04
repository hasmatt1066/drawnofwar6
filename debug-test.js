/**
 * Debug test - Capture all console output and errors
 */
import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  const consoleLogs = [];
  const errors = [];
  const warnings = [];

  // Capture all console messages
  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();

    if (type === 'error') {
      errors.push(text);
      console.log(`[ERROR] ${text}`);
    } else if (type === 'warning') {
      warnings.push(text);
      console.log(`[WARN] ${text}`);
    } else {
      consoleLogs.push(text);
      console.log(`[${type.toUpperCase()}] ${text}`);
    }
  });

  // Capture page errors
  page.on('pageerror', error => {
    const msg = error.message;
    errors.push(msg);
    console.log(`[PAGE ERROR] ${msg}`);
  });

  // Capture failed requests
  page.on('requestfailed', request => {
    const msg = `${request.url()} - ${request.failure().errorText}`;
    errors.push(msg);
    console.log(`[REQUEST FAILED] ${msg}`);
  });

  console.log('Navigating to http://localhost:5176/deployment-grid...\n');
  await page.goto('http://localhost:5176/deployment-grid', { waitUntil: 'domcontentloaded', timeout: 15000 });

  // Wait for potential redirect
  await page.waitForFunction(() => {
    const url = new URL(window.location.href);
    return url.searchParams.has('matchId') && url.searchParams.has('playerId');
  }, { timeout: 10000 });

  console.log(`\nURL: ${page.url()}\n`);

  // Wait a bit for app to initialize
  await new Promise(resolve => setTimeout(resolve, 5000));

  console.log('\n=== SUMMARY ===');
  console.log(`Total console messages: ${consoleLogs.length}`);
  console.log(`Total warnings: ${warnings.length}`);
  console.log(`Total errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log('\n=== ERRORS ===');
    errors.forEach((err, i) => console.log(`${i + 1}. ${err}`));
  }

  // Check DOM
  const domInfo = await page.evaluate(() => {
    const root = document.querySelector('#root');
    return {
      rootExists: root !== null,
      rootHasChildren: root ? root.children.length > 0 : false,
      rootInnerHTML: root ? root.innerHTML.substring(0, 500) : null,
      bodyInnerHTML: document.body.innerHTML.substring(0, 1000)
    };
  });

  console.log('\n=== DOM INFO ===');
  console.log('Root exists:', domInfo.rootExists);
  console.log('Root has children:', domInfo.rootHasChildren);
  if (domInfo.rootInnerHTML) {
    console.log('Root innerHTML (first 500 chars):', domInfo.rootInnerHTML);
  }

  await browser.close();
})().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
