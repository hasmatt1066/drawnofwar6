import puppeteer from 'puppeteer';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testHexGridDragDrop() {
  console.log('=== Hex Grid Drag-and-Drop Test ===\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  const logs = [];
  page.on('console', async msg => {
    try {
      const args = await Promise.all(
        msg.args().map(arg =>
          arg.jsonValue()
            .then(val => JSON.stringify(val))
            .catch(() => arg.toString())
        )
      );
      const logEntry = {
        type: msg.type(),
        text: msg.text(),
        args: args
      };
      logs.push(logEntry);
    } catch (e) {
      logs.push({ type: msg.type(), text: msg.text(), args: [] });
    }
  });

  try {
    console.log('1. Navigating...');
    await page.goto('http://localhost:5177/deployment-grid', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    console.log('2. Waiting for canvas...');
    let canvasFound = false;
    for (let i = 0; i < 20; i++) {
      const hasCanvas = await page.evaluate(() => document.querySelectorAll('canvas').length > 0);
      if (hasCanvas) {
        canvasFound = true;
        break;
      }
      await new Promise(r => setTimeout(r, 500));
    }

    if (!canvasFound) throw new Error('Canvas not found');
    console.log('   ✓ Canvas found');

    await new Promise(r => setTimeout(r, 1000));

    console.log('\n3. Performing drag...');
    const positions = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const draggable = document.querySelector('[draggable="true"]');
      if (!canvas || !draggable) return null;

      const canvasRect = canvas.getBoundingClientRect();
      const draggableRect = draggable.getBoundingClientRect();

      // Target LEFT side of canvas (deployment zone for player1 is columns 0-2)
      // Use left quarter of canvas to ensure we're in the blue zone
      const targetX = canvasRect.x + canvasRect.width * 0.25;
      const targetY = canvasRect.y + canvasRect.height * 0.5;

      return {
        canvas: {
          centerX: targetX,
          centerY: targetY
        },
        draggable: {
          centerX: draggableRect.x + draggableRect.width / 2,
          centerY: draggableRect.y + draggableRect.height / 2
        }
      };
    });

    if (!positions) throw new Error('Could not get positions');

    logs.length = 0; // Clear previous logs

    const { draggable, canvas } = positions;

    // Perform drag
    await page.mouse.move(draggable.centerX, draggable.centerY);
    await new Promise(r => setTimeout(r, 200));

    await page.mouse.down();
    await new Promise(r => setTimeout(r, 300));

    // Move in steps
    const steps = 15;
    for (let i = 1; i <= steps; i++) {
      const x = draggable.centerX + (canvas.centerX - draggable.centerX) * (i / steps);
      const y = draggable.centerY + (canvas.centerY - draggable.centerY) * (i / steps);
      await page.mouse.move(x, y);
      await new Promise(r => setTimeout(r, 30));
    }

    await new Promise(r => setTimeout(r, 500));
    await page.mouse.up();
    await new Promise(r => setTimeout(r, 1500));

    console.log('   ✓ Drag complete\n');

    // Analyze logs
    console.log('4. Analysis:\n');

    // Find key messages
    const dragStartLogs = logs.filter(l => l.text.includes('Drag started'));
    const dragOverLogs = logs.filter(l => l.text.includes('[DragOver]'));
    const hexHoverLogs = logs.filter(l => l.text.includes('[HexHover]'));
    const dropLogs = logs.filter(l => l.text.includes('Drop on hex'));
    const placementSuccessLogs = logs.filter(l => l.text.includes('Placement success'));
    const autoCompleteLogs = logs.filter(l => l.text.includes('Auto-completing'));
    const cancelLogs = logs.filter(l => l.text.includes('Cancelling'));

    console.log(`📊 Statistics:`);
    console.log(`   Drag Start: ${dragStartLogs.length}`);
    console.log(`   DragOver Events: ${dragOverLogs.length}`);
    console.log(`   HexHover Updates: ${hexHoverLogs.length}`);
    console.log(`   Drop Events: ${dropLogs.length}`);
    console.log(`   Placement Success Checks: ${placementSuccessLogs.length}`);
    console.log(`   Auto-complete Attempts: ${autoCompleteLogs.length}`);
    console.log(`   Cancel Events: ${cancelLogs.length}\n`);

    // Show first few hex hover events with coordinates
    console.log('📍 Hex Detection Sample (first 5):');
    hexHoverLogs.slice(0, 5).forEach((log, i) => {
      console.log(`   ${i + 1}. ${log.text}`);
      if (log.args.length > 0) {
        console.log(`      Args: ${log.args.join(', ')}`);
      }
    });

    // Show placement result
    console.log('\n🎯 Placement Result:');
    if (placementSuccessLogs.length > 0) {
      placementSuccessLogs.forEach(log => {
        console.log(`   ${log.text}`);
        if (log.args.length > 0) {
          console.log(`   Args: ${log.args.join(', ')}`);
        }
      });
    }

    // Show why it failed
    if (cancelLogs.length > 0) {
      console.log('\n❌ Cancellation:');
      cancelLogs.forEach(log => {
        console.log(`   ${log.text}`);
      });
    }

    if (autoCompleteLogs.length > 0) {
      console.log('\n✅ Auto-complete:');
      autoCompleteLogs.forEach(log => {
        console.log(`   ${log.text}`);
        if (log.args.length > 0) {
          console.log(`   Args: ${log.args.join(', ')}`);
        }
      });
    }

    // Write full log to file
    const logFile = join(__dirname, 'test-logs.json');
    writeFileSync(logFile, JSON.stringify(logs, null, 2));
    console.log(`\n📝 Full logs written to: ${logFile}`);

    // Summary
    console.log('\n=== SUMMARY ===\n');

    const hexDetectionWorking = dragOverLogs.length > 0 && hexHoverLogs.length > 0;
    const placementWorked = placementSuccessLogs.some(l => l.text.includes('true'));
    const wasCancelled = cancelLogs.length > 0;

    console.log(`Hex Hover Detection: ${hexDetectionWorking ? '✅ WORKING' : '❌ NOT WORKING'}`);
    console.log(`Placement Succeeded: ${placementWorked ? '✅ YES' : '❌ NO'}`);
    console.log(`Was Cancelled: ${wasCancelled ? '⚠️  YES' : '✅ NO'}`);

    if (!placementWorked && wasCancelled) {
      console.log('\n💡 Issue: Drag was cancelled instead of completing placement.');
      console.log('   This suggests the drag state was invalid when mouse-up occurred.');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await browser.close();
  }
}

testHexGridDragDrop().catch(console.error);
