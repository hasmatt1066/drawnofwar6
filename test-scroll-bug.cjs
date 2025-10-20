/**
 * Puppeteer test to reproduce the scroll bug when combat starts
 *
 * This test:
 * 1. Opens two browser instances (player1 and player2)
 * 2. Places creatures for both players
 * 3. Both players click ready
 * 4. Monitors scroll position when combat starts
 * 5. Takes screenshots at each step
 */

const puppeteer = require('puppeteer');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testScrollBug() {
  console.log('🚀 Starting scroll bug reproduction test...\n');

  const matchId = `scroll-test-${Date.now()}`;
  const baseUrl = 'http://localhost:5175/deployment';

  let browser1, browser2, page1, page2;

  try {
    // Launch browsers
    console.log('📱 Launching browsers...');
    browser1 = await puppeteer.launch({
      headless: false,
      args: ['--window-size=1400,900']
    });
    browser2 = await puppeteer.launch({
      headless: false,
      args: ['--window-size=1400,900', '--window-position=1400,0']
    });

    page1 = await browser1.newPage();
    page2 = await browser2.newPage();

    await page1.setViewport({ width: 1400, height: 900 });
    await page2.setViewport({ width: 1400, height: 900 });

    // Enable console logging
    page1.on('console', msg => console.log(`[P1 Console] ${msg.text()}`));
    page2.on('console', msg => console.log(`[P2 Console] ${msg.text()}`));

    // Navigate both players
    const url1 = `${baseUrl}?matchId=${matchId}&playerId=player1`;
    const url2 = `${baseUrl}?matchId=${matchId}&playerId=player2`;

    console.log('🌐 Player 1 navigating to:', url1);
    console.log('🌐 Player 2 navigating to:', url2);

    await Promise.all([
      page1.goto(url1, { waitUntil: 'networkidle0' }),
      page2.goto(url2, { waitUntil: 'networkidle0' })
    ]);

    console.log('✅ Both players loaded\n');
    await sleep(2000);

    // Take initial screenshots
    await page1.screenshot({ path: 'test-screenshots/scroll-bug-01-p1-initial.png' });
    await page2.screenshot({ path: 'test-screenshots/scroll-bug-01-p2-initial.png' });

    // Place creatures for Player 1
    console.log('🎯 Player 1: Placing creatures...');
    const p1Creatures = [
      { name: 'Warrior', hex: { q: 0, r: 0 } },
      { name: 'Archer', hex: { q: 1, r: 0 } },
      { name: 'Mage', hex: { q: 2, r: 0 } }
    ];

    for (const creature of p1Creatures) {
      await page1.evaluate((creatureName, hex) => {
        // Find the creature card
        const cards = Array.from(document.querySelectorAll('.creature-card'));
        const card = cards.find(c => c.textContent.includes(creatureName));
        if (!card) {
          console.error(`Could not find creature card: ${creatureName}`);
          return;
        }

        // Trigger drag start
        const dragStartEvent = new DragEvent('dragstart', { bubbles: true });
        card.dispatchEvent(dragStartEvent);

        // Find hex and trigger drop
        const canvas = document.querySelector('canvas');
        if (canvas) {
          // Simulate drop on canvas (will be handled by grid)
          const dropEvent = new DragEvent('drop', { bubbles: true });
          canvas.dispatchEvent(dropEvent);
        }
      }, creature.name, creature.hex);

      await sleep(300);
    }

    // Place creatures for Player 2
    console.log('🎯 Player 2: Placing creatures...');
    const p2Creatures = [
      { name: 'Warrior', hex: { q: 0, r: 8 } },
      { name: 'Archer', hex: { q: 1, r: 8 } },
      { name: 'Mage', hex: { q: 2, r: 8 } }
    ];

    for (const creature of p2Creatures) {
      await page2.evaluate((creatureName) => {
        const cards = Array.from(document.querySelectorAll('.creature-card'));
        const card = cards.find(c => c.textContent.includes(creatureName));
        if (!card) {
          console.error(`Could not find creature card: ${creatureName}`);
          return;
        }

        const dragStartEvent = new DragEvent('dragstart', { bubbles: true });
        card.dispatchEvent(dragStartEvent);

        const canvas = document.querySelector('canvas');
        if (canvas) {
          const dropEvent = new DragEvent('drop', { bubbles: true });
          canvas.dispatchEvent(dropEvent);
        }
      }, creature.name);

      await sleep(300);
    }

    await sleep(1000);
    await page1.screenshot({ path: 'test-screenshots/scroll-bug-02-p1-placed.png' });
    await page2.screenshot({ path: 'test-screenshots/scroll-bug-02-p2-placed.png' });

    // Monitor scroll position BEFORE clicking ready
    console.log('\n📏 Measuring scroll position before combat...');

    const getScrollPosition = async (page) => {
      return await page.evaluate(() => ({
        x: window.scrollX,
        y: window.scrollY,
        pageHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight
      }));
    };

    const p1ScrollBefore = await getScrollPosition(page1);
    const p2ScrollBefore = await getScrollPosition(page2);

    console.log('Player 1 scroll before:', p1ScrollBefore);
    console.log('Player 2 scroll before:', p2ScrollBefore);

    // Click ready for both players
    console.log('\n🟢 Clicking ready for both players...');

    await page1.evaluate(() => {
      const readyButton = Array.from(document.querySelectorAll('button')).find(
        btn => btn.textContent.includes('Ready')
      );
      if (readyButton) readyButton.click();
    });

    await page2.evaluate(() => {
      const readyButton = Array.from(document.querySelectorAll('button')).find(
        btn => btn.textContent.includes('Ready')
      );
      if (readyButton) readyButton.click();
    });

    console.log('⏳ Waiting for combat to start...');
    await sleep(2000);

    // Monitor scroll position AFTER combat starts
    console.log('\n📏 Measuring scroll position after combat starts...');

    const p1ScrollAfter = await getScrollPosition(page1);
    const p2ScrollAfter = await getScrollPosition(page2);

    console.log('Player 1 scroll after:', p1ScrollAfter);
    console.log('Player 2 scroll after:', p2ScrollAfter);

    // Calculate scroll change
    const p1ScrollDelta = {
      x: p1ScrollAfter.x - p1ScrollBefore.x,
      y: p1ScrollAfter.y - p1ScrollBefore.y
    };
    const p2ScrollDelta = {
      x: p2ScrollAfter.x - p2ScrollBefore.x,
      y: p2ScrollAfter.y - p2ScrollBefore.y
    };

    console.log('\n🔍 SCROLL DELTA:');
    console.log('Player 1:', p1ScrollDelta);
    console.log('Player 2:', p2ScrollDelta);

    // Take screenshots after combat starts
    await sleep(1000);
    await page1.screenshot({ path: 'test-screenshots/scroll-bug-03-p1-combat-started.png' });
    await page2.screenshot({ path: 'test-screenshots/scroll-bug-03-p2-combat-started.png' });

    // Try to scroll back up and see if it bounces
    console.log('\n🔄 Attempting to scroll back to top...');
    await page1.evaluate(() => window.scrollTo(0, 0));
    await page2.evaluate(() => window.scrollTo(0, 0));

    await sleep(500);

    const p1ScrollAfterReset = await getScrollPosition(page1);
    const p2ScrollAfterReset = await getScrollPosition(page2);

    console.log('Player 1 scroll after reset attempt:', p1ScrollAfterReset);
    console.log('Player 2 scroll after reset attempt:', p2ScrollAfterReset);

    await page1.screenshot({ path: 'test-screenshots/scroll-bug-04-p1-after-scroll-reset.png' });
    await page2.screenshot({ path: 'test-screenshots/scroll-bug-04-p2-after-scroll-reset.png' });

    // Check if scroll bounced back
    if (p1ScrollAfterReset.y > 100 || p2ScrollAfterReset.y > 100) {
      console.log('\n❌ BUG CONFIRMED: Scroll bounced back after trying to scroll to top!');
      console.log('   This confirms the scroll locking issue.');
    } else {
      console.log('\n✅ Scroll reset successful - bug may be fixed!');
    }

    console.log('\n⏸️  Test complete. Keeping browsers open for manual inspection...');
    console.log('   Close the browsers when done.');

    // Keep browsers open for manual inspection
    await sleep(300000); // 5 minutes

  } catch (error) {
    console.error('\n❌ Test failed:', error);
  } finally {
    if (browser1) await browser1.close();
    if (browser2) await browser2.close();
  }
}

// Run the test
testScrollBug().catch(console.error);
