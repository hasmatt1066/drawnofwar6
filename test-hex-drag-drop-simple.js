import puppeteer from 'puppeteer';

async function testHexGridDragDrop() {
  console.log('Starting Puppeteer test for hex grid drag-and-drop...\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Collect console logs
  const consoleLogs = [];
  page.on('console', async msg => {
    // Get the actual text values from JSHandles
    const args = await Promise.all(msg.args().map(arg => arg.jsonValue().catch(() => '[Complex Object]')));
    const text = args.length > 0 ? args.join(' ') : msg.text();
    consoleLogs.push({ type: msg.type(), text });
  });

  // Collect errors
  const errors = [];
  page.on('pageerror', error => {
    errors.push(error.message);
  });

  try {
    console.log('1. Navigating to http://localhost:5176/deployment-grid...');
    await page.goto('http://localhost:5176/deployment-grid', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    console.log('   ✓ Page loaded\n');

    // Wait for redirect to complete (it redirects to /deployment-grid with params)
    console.log('2. Waiting for redirect and page setup...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    const currentUrl = page.url();
    console.log(`   Current URL: ${currentUrl}`);

    console.log('3. Waiting for canvas to be initialized...');
    // Wait up to 10 seconds for canvas to appear
    let canvasFound = false;
    for (let i = 0; i < 20; i++) {
      const hasCanvas = await page.evaluate(() => {
        return document.querySelectorAll('canvas').length > 0;
      });

      if (hasCanvas) {
        canvasFound = true;
        console.log(`   ✓ Canvas appeared after ${(i + 1) * 500}ms`);
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (!canvasFound) {
      console.log('   Canvas not found, checking page structure...');
    }

    // Wait a bit more for initialization
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('\n4. Checking page content...');

    const pageInfo = await page.evaluate(() => {
      const canvases = document.querySelectorAll('canvas');
      const draggables = document.querySelectorAll('[draggable="true"]');
      const allElements = document.querySelectorAll('*');

      return {
        hasCanvas: canvases.length > 0,
        canvasCount: canvases.length,
        draggableCount: draggables.length,
        totalElements: allElements.length,
        canvasInfo: Array.from(canvases).map(c => ({
          width: c.width,
          height: c.height,
          visible: c.offsetParent !== null
        })),
        draggableInfo: Array.from(draggables).slice(0, 3).map(d => ({
          tagName: d.tagName,
          className: d.className,
          id: d.id,
          textContent: d.textContent?.substring(0, 50)
        }))
      };
    });

    console.log('   Page info:', JSON.stringify(pageInfo, null, 2));

    if (!pageInfo.hasCanvas) {
      throw new Error('No canvas found on page after waiting');
    }
    console.log('   ✓ Canvas found\n');

    if (pageInfo.draggableCount === 0) {
      throw new Error('No draggable elements found on page');
    }
    console.log(`   ✓ Found ${pageInfo.draggableCount} draggable elements\n`);

    console.log('5. Getting element positions...');
    const positions = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const draggable = document.querySelector('[draggable="true"]');

      if (!canvas || !draggable) return null;

      const canvasRect = canvas.getBoundingClientRect();
      const draggableRect = draggable.getBoundingClientRect();

      return {
        canvas: {
          x: canvasRect.x,
          y: canvasRect.y,
          width: canvasRect.width,
          height: canvasRect.height,
          centerX: canvasRect.x + canvasRect.width / 2,
          centerY: canvasRect.y + canvasRect.height / 2
        },
        draggable: {
          x: draggableRect.x,
          y: draggableRect.y,
          width: draggableRect.width,
          height: draggableRect.height,
          centerX: draggableRect.x + draggableRect.width / 2,
          centerY: draggableRect.y + draggableRect.height / 2
        }
      };
    });

    if (!positions) {
      throw new Error('Could not get element positions');
    }

    console.log('   Positions:', JSON.stringify(positions, null, 2));
    console.log('   ✓ Got positions\n');

    console.log('6. Performing drag operation...');
    const { draggable, canvas } = positions;

    // Clear previous logs
    consoleLogs.length = 0;

    // Start drag
    await page.mouse.move(draggable.centerX, draggable.centerY);
    await new Promise(resolve => setTimeout(resolve, 100));

    await page.mouse.down();
    console.log(`   Mouse down at (${Math.round(draggable.centerX)}, ${Math.round(draggable.centerY)})`);
    await new Promise(resolve => setTimeout(resolve, 300));

    // Move to canvas with steps
    const steps = 15;
    for (let i = 1; i <= steps; i++) {
      const x = draggable.centerX + (canvas.centerX - draggable.centerX) * (i / steps);
      const y = draggable.centerY + (canvas.centerY - draggable.centerY) * (i / steps);
      await page.mouse.move(x, y);
      await new Promise(resolve => setTimeout(resolve, 30));
    }

    console.log(`   Mouse moved to canvas center (${Math.round(canvas.centerX)}, ${Math.round(canvas.centerY)})`);
    await new Promise(resolve => setTimeout(resolve, 300));

    // Drop
    await page.mouse.up();
    console.log('   Mouse up (drop complete)');

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 1500));
    console.log('   ✓ Drag operation complete\n');

    console.log('\n=== ANALYSIS ===\n');

    // Filter logs
    const dragOverLogs = consoleLogs.filter(log => log.text.includes('[DragOver]'));
    const hexLogs = consoleLogs.filter(log => log.text.includes('hex:') || log.text.includes('Hex:'));
    const autoCompleteLogs = consoleLogs.filter(log => log.text.includes('Auto-completing'));
    const errorLogs = consoleLogs.filter(log => log.type === 'error' || log.text.toLowerCase().includes('error'));

    console.log(`Total console messages: ${consoleLogs.length}`);
    console.log(`Page errors: ${errors.length}\n`);

    console.log('1. Hex Hover Detection:');
    if (dragOverLogs.length > 0) {
      console.log(`   ✅ WORKING! Found ${dragOverLogs.length} drag over messages`);
      dragOverLogs.slice(0, 3).forEach(log => {
        console.log(`      ${log.text}`);
      });
    } else {
      console.log(`   ❌ NOT WORKING - No drag over messages found`);
    }

    console.log('\n2. Hex Coordinate Detection:');
    if (hexLogs.length > 0) {
      console.log(`   ✅ WORKING! Found ${hexLogs.length} hex coordinate messages`);
      hexLogs.slice(0, 3).forEach(log => {
        console.log(`      ${log.text}`);
      });
    } else {
      console.log(`   ❌ NOT WORKING - No hex coordinate messages found`);
    }

    console.log('\n3. Placement Success:');
    if (autoCompleteLogs.length > 0) {
      console.log(`   ✅ SUCCESS! Placement completed`);
      autoCompleteLogs.forEach(log => {
        console.log(`      ${log.text}`);
      });
    } else {
      console.log(`   ❌ FAILED - No placement confirmation found`);
    }

    console.log('\n4. Errors:');
    if (errors.length > 0 || errorLogs.length > 0) {
      console.log(`   ❌ Found ${errors.length} page errors, ${errorLogs.length} console errors`);
      errors.forEach(err => console.log(`      [PAGE] ${err}`));
      errorLogs.forEach(log => console.log(`      [CONSOLE] ${log.text}`));
    } else {
      console.log(`   ✅ No errors detected`);
    }

    console.log('\n5. All Console Messages:');
    consoleLogs.forEach((log, i) => {
      const prefix = log.type === 'error' ? '❌' : log.type === 'warn' ? '⚠️' : 'ℹ️';
      console.log(`   ${prefix} [${log.type}] ${log.text}`);
    });

    console.log('\n=== SUMMARY ===\n');
    const hexHoverWorking = dragOverLogs.length > 0;
    const placementWorking = autoCompleteLogs.length > 0;
    const hasErrors = errors.length > 0 || errorLogs.length > 0;

    console.log(`Hex Hover Detection: ${hexHoverWorking ? '✅ WORKING' : '❌ NOT WORKING'}`);
    console.log(`Placement Success: ${placementWorking ? '✅ WORKING' : '❌ NOT WORKING'}`);
    console.log(`Error-Free: ${!hasErrors ? '✅ YES' : '❌ NO'}`);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    await browser.close();
    console.log('\n✓ Browser closed');
  }
}

testHexGridDragDrop().catch(console.error);
