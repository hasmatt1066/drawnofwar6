/**
 * Verify Firebase Emulators are Running
 *
 * This script checks if both Firestore and Storage emulators are accessible
 */

const http = require('http');

function checkEmulator(name, port) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: port,
      path: '/',
      method: 'GET',
      timeout: 2000
    };

    const req = http.request(options, (res) => {
      console.log(`✅ ${name} emulator is running on port ${port}`);
      resolve(true);
    });

    req.on('error', (err) => {
      console.error(`❌ ${name} emulator is NOT running on port ${port}: ${err.message}`);
      resolve(false);
    });

    req.on('timeout', () => {
      console.error(`❌ ${name} emulator timed out on port ${port}`);
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

async function main() {
  console.log('Checking Firebase Emulators...\n');

  const firestoreOk = await checkEmulator('Firestore', 8080);
  const storageOk = await checkEmulator('Storage', 9199);
  const uiOk = await checkEmulator('UI', 4000);

  console.log('\n' + '='.repeat(50));

  if (firestoreOk && storageOk && uiOk) {
    console.log('✅ All emulators are running correctly!');
    console.log('\nYou can now:');
    console.log('  - Access UI at: http://localhost:4000');
    console.log('  - Save creatures (Storage uploads will work)');
    process.exit(0);
  } else {
    console.log('❌ Some emulators are not running.');
    console.log('\nTo fix this:');
    console.log('  1. Stop any running emulators (Ctrl+C)');
    console.log('  2. Run: firebase emulators:start');
    console.log('  3. Wait for "All emulators ready!" message');
    console.log('  4. Run this script again to verify');
    process.exit(1);
  }
}

main();
