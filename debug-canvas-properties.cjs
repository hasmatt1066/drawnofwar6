/**
 * Debug script to inspect canvas properties and scroll behavior
 */

const puppeteer = require('puppeteer');

async function debugCanvas() {
  console.log('🔍 Debugging canvas properties and scroll behavior...\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--window-size=1400,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  // Enable console logging
  page.on('console', msg => console.log(`[Console] ${msg.text()}`));

  // Navigate to deployment page
  const matchId = `debug-${Date.now()}`;
  const url = `http://localhost:5175/deployment?matchId=${matchId}&playerId=player1`;

  console.log('🌐 Navigating to:', url);
  await page.goto(url, { waitUntil: 'networkidle0' });

  console.log('✅ Page loaded');
  await page.waitForTimeout(2000);

  // Check initial state
  console.log('\n📊 BEFORE COMBAT:');
  const beforeCombat = await page.evaluate(() => {
    return {
      windowScroll: { x: window.scrollX, y: window.scrollY },
      bodyScroll: { width: document.body.scrollWidth, height: document.body.scrollHeight },
      bodyClient: { width: document.body.clientWidth, height: document.body.clientHeight },
      viewportSize: { width: window.innerWidth, height: window.innerHeight },
      documentHeight: document.documentElement.scrollHeight,
      canvasElements: Array.from(document.querySelectorAll('canvas')).map(canvas => ({
        width: canvas.width,
        height: canvas.height,
        styleWidth: canvas.style.width,
        styleHeight: canvas.style.height,
        offsetWidth: canvas.offsetWidth,
        offsetHeight: canvas.offsetHeight,
        scrollWidth: canvas.scrollWidth,
        scrollHeight: canvas.scrollHeight,
        boundingRect: canvas.getBoundingClientRect(),
        position: window.getComputedStyle(canvas).position,
        display: window.getComputedStyle(canvas).display
      }))
    };
  });

  console.log(JSON.stringify(beforeCombat, null, 2));

  // Trigger combat by directly setting combatActive
  console.log('\n🔴 Triggering combat...');
  await page.evaluate(() => {
    // Find and click ready button (simulate both players ready)
    const readyButtons = Array.from(document.querySelectorAll('button'));
    const readyBtn = readyButtons.find(btn => btn.textContent?.includes('Ready'));
    if (readyBtn && !readyBtn.disabled) {
      console.log('Clicking ready button...');
      readyBtn.click();
    }
  });

  // Wait for combat to initialize
  await page.waitForTimeout(3000);

  // Check state after combat starts
  console.log('\n📊 AFTER COMBAT STARTS:');
  const afterCombat = await page.evaluate(() => {
    return {
      windowScroll: { x: window.scrollX, y: window.scrollY },
      bodyScroll: { width: document.body.scrollWidth, height: document.body.scrollHeight },
      bodyClient: { width: document.body.clientWidth, height: document.body.clientHeight },
      bodyComputedStyle: {
        overflow: window.getComputedStyle(document.body).overflow,
        overflowX: window.getComputedStyle(document.body).overflowX,
        overflowY: window.getComputedStyle(document.body).overflowY,
        position: window.getComputedStyle(document.body).position
      },
      viewportSize: { width: window.innerWidth, height: window.innerHeight },
      documentHeight: document.documentElement.scrollHeight,
      canvasElements: Array.from(document.querySelectorAll('canvas')).map(canvas => ({
        width: canvas.width,
        height: canvas.height,
        styleWidth: canvas.style.width,
        styleHeight: canvas.style.height,
        offsetWidth: canvas.offsetWidth,
        offsetHeight: canvas.offsetHeight,
        scrollWidth: canvas.scrollWidth,
        scrollHeight: canvas.scrollHeight,
        boundingRect: canvas.getBoundingClientRect(),
        position: window.getComputedStyle(canvas).position,
        display: window.getComputedStyle(canvas).display,
        parent: canvas.parentElement ? {
          tagName: canvas.parentElement.tagName,
          className: canvas.parentElement.className,
          boundingRect: canvas.parentElement.getBoundingClientRect(),
          scrollWidth: canvas.parentElement.scrollWidth,
          scrollHeight: canvas.parentElement.scrollHeight,
          computedStyle: {
            display: window.getComputedStyle(canvas.parentElement).display,
            position: window.getComputedStyle(canvas.parentElement).position,
            overflow: window.getComputedStyle(canvas.parentElement).overflow,
            width: window.getComputedStyle(canvas.parentElement).width,
            height: window.getComputedStyle(canvas.parentElement).height
          }
        } : null
      }))
    };
  });

  console.log(JSON.stringify(afterCombat, null, 2));

  // Calculate what changed
  console.log('\n🔍 ANALYSIS:');
  console.log('Scroll position delta:');
  console.log('  X:', afterCombat.windowScroll.x - beforeCombat.windowScroll.x);
  console.log('  Y:', afterCombat.windowScroll.y - beforeCombat.windowScroll.y);
  console.log('\nDocument height change:');
  console.log('  Before:', beforeCombat.documentHeight);
  console.log('  After:', afterCombat.documentHeight);
  console.log('  Delta:', afterCombat.documentHeight - beforeCombat.documentHeight);
  console.log('\nCanvas count:');
  console.log('  Before:', beforeCombat.canvasElements.length);
  console.log('  After:', afterCombat.canvasElements.length);

  // Check for any elements that extend beyond viewport
  console.log('\n🔎 Checking for overflow elements...');
  const overflowElements = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('*'));
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    return elements
      .map(el => {
        const rect = el.getBoundingClientRect();
        const computed = window.getComputedStyle(el);
        return {
          tag: el.tagName,
          id: el.id,
          className: el.className,
          rect: { right: rect.right, bottom: rect.bottom },
          extendsRight: rect.right > viewportWidth,
          extendsBottom: rect.bottom > viewportHeight,
          scrollWidth: el.scrollWidth,
          scrollHeight: el.scrollHeight,
          offsetWidth: el.offsetWidth,
          offsetHeight: el.offsetHeight,
          position: computed.position,
          overflow: computed.overflow
        };
      })
      .filter(el => el.extendsRight || el.extendsBottom)
      .slice(0, 10); // Top 10
  });

  console.log('Elements extending beyond viewport:');
  console.log(JSON.stringify(overflowElements, null, 2));

  console.log('\n⏸️  Keeping browser open for inspection. Close when done.');
  await page.waitForTimeout(300000); // 5 minutes

  await browser.close();
}

debugCanvas().catch(console.error);
