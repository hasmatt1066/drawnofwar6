/**
 * Test script to verify combat visualization integration
 *
 * This script:
 * 1. Creates a match
 * 2. Places creatures for both players
 * 3. Marks both players ready
 * 4. Monitors combat socket for state updates
 * 5. Checks that combat visualization receives states
 */

const io = require('socket.io-client');

const BACKEND_URL = 'http://localhost:3001';
const MATCH_ID = `test-${Date.now()}`;

// Test creatures to deploy
const TEST_CREATURES = [
  {
    id: 'warrior-1',
    name: 'Warrior',
    stats: { health: 100, attack: 15, defense: 10, speed: 5 },
    spriteUrl: 'test-sprite.png'
  },
  {
    id: 'archer-1',
    name: 'Archer',
    stats: { health: 80, attack: 20, defense: 5, speed: 7 },
    spriteUrl: 'test-sprite.png'
  }
];

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testCombatVisualization() {
  console.log('=== Combat Visualization Integration Test ===\n');

  let deploymentSocket1, deploymentSocket2, combatSocket;
  let combatStarted = false;
  let stateUpdateCount = 0;

  try {
    // Step 1: Connect deployment sockets for both players
    console.log('Step 1: Connecting deployment sockets...');

    deploymentSocket1 = io(`${BACKEND_URL}/deployment`, {
      transports: ['websocket'],
      reconnection: false
    });

    deploymentSocket2 = io(`${BACKEND_URL}/deployment`, {
      transports: ['websocket'],
      reconnection: false
    });

    await Promise.all([
      new Promise(resolve => deploymentSocket1.on('connect', resolve)),
      new Promise(resolve => deploymentSocket2.on('connect', resolve))
    ]);

    console.log('✓ Both deployment sockets connected\n');

    // Step 2: Join match for both players
    console.log('Step 2: Joining match...');

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Join timeout')), 5000);

      deploymentSocket1.once('deployment:state', (state) => {
        clearTimeout(timeout);
        console.log('✓ Player 1 joined:', state.matchId);
        resolve();
      });

      deploymentSocket1.emit('deployment:join', { matchId: MATCH_ID, playerId: 'player1' });
    });

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Join timeout')), 5000);

      deploymentSocket2.once('deployment:state', (state) => {
        clearTimeout(timeout);
        console.log('✓ Player 2 joined:', state.matchId);
        resolve();
      });

      deploymentSocket2.emit('deployment:join', { matchId: MATCH_ID, playerId: 'player2' });
    });

    console.log('✓ Both players joined match\n');

    // Step 3: Place creatures for player 1
    console.log('Step 3: Placing creatures...');

    deploymentSocket1.emit('deployment:place', {
      matchId: MATCH_ID,
      playerId: 'player1',
      placement: {
        creature: TEST_CREATURES[0],
        hex: { q: 2, r: 3 }
      }
    });
    console.log('✓ Player 1 placed Warrior at (2, 3)');

    // Place creatures for player 2
    deploymentSocket2.emit('deployment:place', {
      matchId: MATCH_ID,
      playerId: 'player2',
      placement: {
        creature: TEST_CREATURES[1],
        hex: { q: 8, r: 3 }
      }
    });
    console.log('✓ Player 2 placed Archer at (8, 3)');

    // Wait a moment for placements to register
    await delay(500);

    console.log('✓ Creatures placed\n');

    // Step 4: Connect combat socket BEFORE marking ready
    console.log('Step 4: Connecting combat socket...');

    combatSocket = io(`${BACKEND_URL}/combat`, {
      transports: ['websocket'],
      reconnection: false
    });

    await new Promise(resolve => combatSocket.on('connect', resolve));
    console.log('✓ Combat socket connected\n');

    // Join combat room
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Combat join timeout')), 5000);

      combatSocket.once('combat:joined', (data) => {
        clearTimeout(timeout);
        console.log('✓ Combat socket joined room:', data.matchId);
        resolve();
      });

      combatSocket.emit('combat:join', MATCH_ID);
    });

    // Listen for combat events on BOTH sockets
    deploymentSocket1.on('deployment:combat-started', (data) => {
      console.log('\n🎮 COMBAT STARTED (via deployment socket)!');
      console.log('   Match ID:', data.matchId);
      combatStarted = true;
    });

    combatSocket.on('combat:started', (data) => {
      console.log('\n🎮 COMBAT STARTED (via combat socket)!');
      console.log('   Match ID:', data.matchId);
      combatStarted = true;
    });

    combatSocket.on('combat:state', (state) => {
      stateUpdateCount++;
      if (stateUpdateCount <= 5) {
        console.log(`📊 Combat state update #${stateUpdateCount}:`);
        console.log(`   Tick: ${state.currentTick || state.tick}`);
        console.log(`   Units: ${Object.keys(state.units || {}).length}`);
        console.log(`   Active: ${state.isActive}`);
      }

      if (stateUpdateCount === 1) {
        console.log('   First state preview:', JSON.stringify(state, null, 2).substring(0, 300));
      }
    });

    combatSocket.on('combat:completed', (data) => {
      console.log('\n🏁 COMBAT COMPLETED!');
      console.log('   Winner:', data.winner || 'draw');
      console.log('   Duration:', data.duration, 'ticks');
    });

    // Step 5: Mark both players ready
    console.log('\nStep 5: Marking players ready...');

    deploymentSocket1.emit('deployment:ready', { matchId: MATCH_ID, playerId: 'player1' });
    console.log('✓ Player 1 ready');

    await delay(200);

    deploymentSocket2.emit('deployment:ready', { matchId: MATCH_ID, playerId: 'player2' });
    console.log('✓ Player 2 ready');

    // Wait for backend to process
    await delay(500);

    console.log('✓ Both players ready\n');

    // Step 6: Wait for combat to start and state updates
    console.log('Step 6: Waiting for combat to start...');

    await delay(2000); // Wait for combat to start

    if (!combatStarted) {
      throw new Error('Combat did not start after both players ready');
    }

    // Wait for state updates (combat broadcasts at 10Hz = 100ms intervals)
    console.log('\nStep 7: Monitoring combat state updates...');
    await delay(5000); // Wait 5 seconds to collect state updates

    // Step 8: Verify results
    console.log('\n=== Test Results ===');
    console.log(`✓ Combat started: ${combatStarted}`);
    console.log(`✓ State updates received: ${stateUpdateCount}`);
    console.log(`✓ Update rate: ${(stateUpdateCount / 5).toFixed(1)} updates/second`);

    if (stateUpdateCount === 0) {
      console.log('\n❌ FAILURE: No combat state updates received!');
      console.log('   This means the frontend would show an empty canvas.');
      console.log('   The combat socket is not broadcasting states properly.');
    } else if (stateUpdateCount < 10) {
      console.log('\n⚠️  WARNING: Only received', stateUpdateCount, 'state updates in 5 seconds');
      console.log('   Expected ~50 updates (10 Hz broadcast rate)');
      console.log('   Combat visualization may be choppy.');
    } else {
      console.log('\n✅ SUCCESS: Combat visualization integration working!');
      console.log('   Frontend should receive continuous state updates.');
      console.log('   Canvas should render units and animations.');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    // Cleanup
    console.log('\nCleaning up...');
    if (deploymentSocket1) deploymentSocket1.disconnect();
    if (deploymentSocket2) deploymentSocket2.disconnect();
    if (combatSocket) combatSocket.disconnect();
    console.log('✓ Disconnected all sockets');
  }
}

// Run the test
testCombatVisualization()
  .then(() => {
    console.log('\n=== Test Complete ===');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n=== Test Failed ===');
    console.error(error);
    process.exit(1);
  });
