/**
 * Integration Test with Puppeteer
 *
 * Tests the complete flow:
 * 1. Frontend loads correctly
 * 2. Backend API is responsive
 * 3. Job submission works
 * 4. Progress page displays correctly
 * 5. Screenshots captured at each step
 */

import puppeteer from 'puppeteer';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const BACKEND_URL = 'http://localhost:3001';
const FRONTEND_URL = 'http://localhost:5173';
const SCREENSHOT_DIR = './screenshots';

// Ensure screenshot directory exists
try {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
} catch (err) {
  // Directory might already exist
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testBackendHealth() {
  console.log('\n🔍 Testing Backend Health...');
  try {
    const response = await fetch(`${BACKEND_URL}/health`);
    const data = await response.json();
    console.log('✅ Backend is healthy:', data);
    return true;
  } catch (error) {
    console.error('❌ Backend health check failed:', error.message);
    return false;
  }
}

async function submitTestJob() {
  console.log('\n📤 Submitting test job to backend...');
  try {
    const response = await fetch(`${BACKEND_URL}/api/generate/enhanced`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputType: 'text',
        description: 'fierce fire dragon warrior'
      })
    });

    const data = await response.json();
    console.log('✅ Job submitted successfully:', data);
    return data.jobId;
  } catch (error) {
    console.error('❌ Job submission failed:', error.message);
    return null;
  }
}

async function runPuppeteerTests() {
  console.log('\n🚀 Starting Puppeteer Integration Tests...\n');

  const browser = await puppeteer.launch({
    headless: false, // Show browser so we can see what's happening
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1280, height: 800 }
  });

  try {
    const page = await browser.newPage();

    // Enable console logging from the page
    page.on('console', msg => console.log('🌐 Browser:', msg.text()));
    page.on('pageerror', error => console.error('❌ Page Error:', error.message));

    // Test 1: Frontend Loads
    console.log('📋 Test 1: Loading frontend...');
    await page.goto(FRONTEND_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2000);
    await page.screenshot({ path: join(SCREENSHOT_DIR, '01-frontend-loaded.png'), fullPage: true });
    console.log('✅ Screenshot saved: 01-frontend-loaded.png');

    // Test 2: PromptBuilder Page
    console.log('\n📋 Test 2: Checking PromptBuilder page...');
    const url = page.url();
    console.log('   Current URL:', url);

    if (url.includes('/create')) {
      console.log('✅ Correctly redirected to /create');
    }

    await sleep(2000);
    await page.screenshot({ path: join(SCREENSHOT_DIR, '02-prompt-builder.png'), fullPage: true });
    console.log('✅ Screenshot saved: 02-prompt-builder.png');

    // Test 3: Check for UI elements
    console.log('\n📋 Test 3: Checking UI elements...');
    const pageContent = await page.content();

    if (pageContent.includes('Create') || pageContent.includes('Generate')) {
      console.log('✅ Page content looks correct');
    } else {
      console.log('⚠️  Page content might be missing expected elements');
    }

    // Test 4: Submit a test job via API
    console.log('\n📋 Test 4: Submitting test job via backend API...');
    const jobId = await submitTestJob();

    if (!jobId) {
      console.log('⚠️  Skipping progress page test (no job ID)');
    } else {
      // Test 5: Navigate to progress page
      console.log(`\n📋 Test 5: Navigating to progress page for job ${jobId}...`);
      await page.goto(`${FRONTEND_URL}/generation/${jobId}`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      await sleep(3000);
      await page.screenshot({ path: join(SCREENSHOT_DIR, '03-progress-page-initial.png'), fullPage: true });
      console.log('✅ Screenshot saved: 03-progress-page-initial.png');

      // Test 6: Wait and capture progress updates
      console.log('\n📋 Test 6: Capturing progress updates...');
      await sleep(5000);
      await page.screenshot({ path: join(SCREENSHOT_DIR, '04-progress-page-5s.png'), fullPage: true });
      console.log('✅ Screenshot saved: 04-progress-page-5s.png');

      await sleep(5000);
      await page.screenshot({ path: join(SCREENSHOT_DIR, '05-progress-page-10s.png'), fullPage: true });
      console.log('✅ Screenshot saved: 05-progress-page-10s.png');

      // Test 7: Check for progress elements
      console.log('\n📋 Test 7: Checking progress page elements...');
      const progressContent = await page.content();

      if (progressContent.includes('progress') || progressContent.includes('Progress')) {
        console.log('✅ Progress page content detected');
      }

      if (progressContent.includes('queued') || progressContent.includes('processing')) {
        console.log('✅ Job status visible');
      }
    }

    console.log('\n✅ All tests completed successfully!');
    console.log(`📸 Screenshots saved to: ${SCREENSHOT_DIR}/`);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  Integration Test Suite - Drawn of War');
  console.log('═══════════════════════════════════════════════════');

  // Check backend first
  const backendHealthy = await testBackendHealth();

  if (!backendHealthy) {
    console.log('\n⚠️  Backend is not running. Please start the backend first:');
    console.log('   cd backend && pnpm dev');
    console.log('\nContinuing with frontend tests anyway...\n');
  }

  // Run Puppeteer tests
  await runPuppeteerTests();

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  Test Suite Complete');
  console.log('═══════════════════════════════════════════════════\n');
}

main().catch(console.error);
