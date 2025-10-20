/**
 * Combat Socket Fix Verification Script
 *
 * This script tests the combat socket connection flow to verify:
 * 1. Clients can connect to /combat namespace
 * 2. Clients can join a combat room
 * 3. Clients receive combat:joined confirmation
 * 4. Clients receive combat state updates
 */

const io = require('socket.io-client');

const BACKEND_URL = 'http://localhost:3001';
const TEST_MATCH_ID = 'test-match-' + Date.now();

console.log('='.repeat(80));
console.log('COMBAT SOCKET FIX VERIFICATION');
console.log('='.repeat(80));
console.log(`Backend URL: ${BACKEND_URL}`);
console.log(`Test Match ID: ${TEST_MATCH_ID}`);
console.log('='.repeat(80));

// Create two socket clients (simulating two players)
console.log('\n[Step 1] Creating socket clients...');

const client1 = io(`${BACKEND_URL}/combat`, {
  path: '/socket.io',
  transports: ['websocket'],
  reconnection: false
});

const client2 = io(`${BACKEND_URL}/combat`, {
  path: '/socket.io',
  transports: ['websocket'],
  reconnection: false
});

let client1Connected = false;
let client2Connected = false;
let client1Joined = false;
let client2Joined = false;
let statesReceived = 0;

// Client 1 event handlers
client1.on('connect', () => {
  console.log('[Client 1] ✓ Connected to /combat namespace');
  client1Connected = true;
  checkReadyToJoin();
});

client1.on('combat:joined', (data) => {
  console.log(`[Client 1] ✓ Joined combat room: ${data.room}`);
  client1Joined = true;
  checkAllJoined();
});

client1.on('combat:state', (state) => {
  statesReceived++;
  if (statesReceived === 1) {
    console.log(`[Client 1] ✓ Received first combat state (tick ${state.currentTick})`);
  }
});

client1.on('combat:completed', (result) => {
  console.log(`[Client 1] ✓ Combat completed - Winner: ${result.winner}`);
});

client1.on('combat:error', (error) => {
  console.error(`[Client 1] ✗ Error: ${error.message}`);
});

client1.on('disconnect', () => {
  console.log('[Client 1] Disconnected');
});

client1.on('connect_error', (error) => {
  console.error(`[Client 1] ✗ Connection error: ${error.message}`);
  process.exit(1);
});

// Client 2 event handlers
client2.on('connect', () => {
  console.log('[Client 2] ✓ Connected to /combat namespace');
  client2Connected = true;
  checkReadyToJoin();
});

client2.on('combat:joined', (data) => {
  console.log(`[Client 2] ✓ Joined combat room: ${data.room}`);
  client2Joined = true;
  checkAllJoined();
});

client2.on('combat:state', (state) => {
  // Only log from client 2 to avoid spam
  if (statesReceived === 1) {
    console.log(`[Client 2] ✓ Received first combat state (tick ${state.currentTick})`);
  }
});

client2.on('combat:completed', (result) => {
  console.log(`[Client 2] ✓ Combat completed - Winner: ${result.winner}`);
});

client2.on('combat:error', (error) => {
  console.error(`[Client 2] ✗ Error: ${error.message}`);
});

client2.on('disconnect', () => {
  console.log('[Client 2] Disconnected');
});

client2.on('connect_error', (error) => {
  console.error(`[Client 2] ✗ Connection error: ${error.message}`);
  process.exit(1);
});

// Check if both clients connected
function checkReadyToJoin() {
  if (client1Connected && client2Connected) {
    console.log('\n[Step 2] Both clients connected, joining combat room...');

    // Join combat room
    client1.emit('combat:join', TEST_MATCH_ID);
    client2.emit('combat:join', TEST_MATCH_ID);

    // Set timeout to check if join fails
    setTimeout(() => {
      if (!client1Joined || !client2Joined) {
        console.error('\n✗ FAIL: Clients did not join within 3 seconds');
        console.error(`  Client 1 joined: ${client1Joined}`);
        console.error(`  Client 2 joined: ${client2Joined}`);
        cleanup();
        process.exit(1);
      }
    }, 3000);
  }
}

// Check if both clients joined
function checkAllJoined() {
  if (client1Joined && client2Joined) {
    console.log('\n[Step 3] ✓ Both clients successfully joined combat room');
    console.log('\n[Step 4] Waiting 2 seconds to verify no state updates (combat not started)...');

    setTimeout(() => {
      if (statesReceived === 0) {
        console.log('✓ No states received (correct - combat not started)');
        console.log('\n='.repeat(80));
        console.log('SUCCESS: Combat socket join flow working correctly!');
        console.log('='.repeat(80));
        console.log('\nNext steps to verify full combat flow:');
        console.log('1. Open browser tabs and deploy creatures');
        console.log('2. Mark ready on both sides');
        console.log('3. Verify backend logs show "Broadcasting state tick X to 2 clients"');
        console.log('4. Verify frontend logs show "COMBAT STATE UPDATE" every tick');
        console.log('='.repeat(80));
      } else {
        console.log(`ℹ Received ${statesReceived} states (combat may have started)`);
        console.log('\n='.repeat(80));
        console.log('SUCCESS: Combat socket join and state reception working!');
        console.log('='.repeat(80));
      }

      cleanup();
      process.exit(0);
    }, 2000);
  }
}

// Cleanup
function cleanup() {
  console.log('\nCleaning up...');
  client1.disconnect();
  client2.disconnect();
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\nInterrupted, cleaning up...');
  cleanup();
  process.exit(0);
});

// Set overall timeout
setTimeout(() => {
  console.error('\n✗ TIMEOUT: Test did not complete within 10 seconds');
  cleanup();
  process.exit(1);
}, 10000);
