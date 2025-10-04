/**
 * Deployment Grid Demo Page
 *
 * Demonstration page for the hex grid deployment system with drag-and-drop.
 * Shows creature roster, drag-and-drop placement, and deployment state.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { DeploymentGridWithDragDrop } from '../components/DeploymentGrid/DeploymentGridWithDragDrop';
import { CreatureRoster } from '../components/DeploymentGrid/CreatureRoster';
import { ReadyPanel } from '../components/DeploymentGrid/ReadyPanel';
import { ConnectionStatus } from '../components/DeploymentGrid/ConnectionStatus';
import { MatchSharing } from '../components/DeploymentGrid/MatchSharing';
import { useDeploymentState } from '../components/DeploymentGrid/useDeploymentState';
import { useDeploymentSocketSync } from '../hooks/useDeploymentSocketSync';
import { getCreatureSpriteLoader } from '../services/creature-sprite-loader';
import type { AxialCoordinate, DeploymentCreature, CreaturePlacement, MatchDeploymentStatus } from '@drawn-of-war/shared';

// Initial mock creature data (sprites will be loaded dynamically)
const INITIAL_PLAYER1_CREATURES: DeploymentCreature[] = [
  { id: 'p1-warrior', name: 'Warrior', sprite: 'W', playerId: 'player1', stats: { health: 100, attack: 15, defense: 10 } },
  { id: 'p1-archer', name: 'Archer', sprite: 'A', playerId: 'player1', stats: { health: 80, attack: 20, defense: 5 } },
  { id: 'p1-mage', name: 'Mage', sprite: 'M', playerId: 'player1', stats: { health: 60, attack: 30, defense: 3 } },
  { id: 'p1-tank', name: 'Tank', sprite: 'T', playerId: 'player1', stats: { health: 150, attack: 10, defense: 20 } },
  { id: 'p1-rogue', name: 'Rogue', sprite: 'R', playerId: 'player1', stats: { health: 70, attack: 25, defense: 5 } },
  { id: 'p1-cleric', name: 'Cleric', sprite: 'C', playerId: 'player1', stats: { health: 90, attack: 12, defense: 8 } },
  { id: 'p1-paladin', name: 'Paladin', sprite: 'P', playerId: 'player1', stats: { health: 120, attack: 18, defense: 15 } },
  { id: 'p1-ranger', name: 'Ranger', sprite: 'G', playerId: 'player1', stats: { health: 85, attack: 22, defense: 7 } }
];

// Mock creature data for Player 2 (just for demonstration)
const INITIAL_PLAYER2_CREATURES: DeploymentCreature[] = [];

export const DeploymentGridDemoPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Get or generate matchId and playerId from URL params
  const matchIdFromUrl = searchParams.get('matchId');
  const playerIdFromUrl = searchParams.get('playerId') as 'player1' | 'player2' | null;

  const [matchId] = useState<string>(() => {
    return matchIdFromUrl || uuidv4();
  });

  // Redirect to add URL params if not present
  useEffect(() => {
    if (!matchIdFromUrl || !playerIdFromUrl) {
      navigate(`/deployment-grid?matchId=${matchId}&playerId=${playerIdFromUrl || 'player1'}`, { replace: true });
    }
  }, [matchIdFromUrl, playerIdFromUrl, matchId, navigate]);

  const [currentPlayerId] = useState<'player1' | 'player2'>(() => {
    return playerIdFromUrl || 'player1';
  });

  const [player1Creatures, setPlayer1Creatures] = useState<DeploymentCreature[]>(INITIAL_PLAYER1_CREATURES);
  const [player2Creatures] = useState<DeploymentCreature[]>(INITIAL_PLAYER2_CREATURES);
  const [opponentPlacements, setOpponentPlacements] = useState<CreaturePlacement[]>([]);
  const [deploymentStatus, setDeploymentStatus] = useState<MatchDeploymentStatus | null>(null);

  // Load creature sprites on mount
  useEffect(() => {
    const loadSprites = async () => {
      const spriteLoader = getCreatureSpriteLoader();

      // Load sprites for Player 1 creatures
      const results = await spriteLoader.loadBatch(
        INITIAL_PLAYER1_CREATURES.map(c => ({ id: c.id, name: c.name }))
      );

      // Update creatures with loaded sprites
      const updatedCreatures = INITIAL_PLAYER1_CREATURES.map(creature => {
        const result = results.get(creature.id);
        if (result?.success && result.sprite) {
          return {
            ...creature,
            sprite: result.sprite.imageBase64,
            spriteLoading: false,
          };
        }
        return {
          ...creature,
          spriteLoading: false,
          spriteError: result?.error || 'Failed to load sprite',
        };
      });

      setPlayer1Creatures(updatedCreatures);
      console.log('[DeploymentDemo] Loaded sprites for', updatedCreatures.length, 'creatures');
    };

    loadSprites();
  }, []);

  // Use deployment state hook
  const {
    deploymentState,
    dragState,
    removeCreature,
    startDrag,
    updateDrag,
    endDrag,
    cancelDrag,
    clearAllPlacements,
    getPlacementCount,
    markReady,
    markUnready,
    canMarkReady
  } = useDeploymentState(player1Creatures, player2Creatures, currentPlayerId);

  // Use Socket.IO sync hook
  const {
    isConnected,
    opponentConnected,
    opponentPlayerId,
    error: socketError,
    emitPlacement,
    emitReady,
    emitUnready
  } = useDeploymentSocketSync({
    matchId,
    playerId: currentPlayerId,
    enabled: true,
    onStateReceived: (data) => {
      console.log('[DeploymentDemo] Received initial state:', data);
      // Update opponent placements
      const opponentId = currentPlayerId === 'player1' ? 'player2' : 'player1';
      const opponentPlacementsData = opponentId === 'player1' ? data.player1Placements : data.player2Placements;
      setOpponentPlacements(opponentPlacementsData);
      setDeploymentStatus(data.deploymentStatus);
    },
    onOpponentPlaced: (placement) => {
      console.log('[DeploymentDemo] Opponent placed:', placement);
      setOpponentPlacements(prev => [...prev, placement]);
    },
    onOpponentRemoved: (creatureId) => {
      console.log('[DeploymentDemo] Opponent removed:', creatureId);
      setOpponentPlacements(prev => prev.filter(p => p.creature.id !== creatureId));
    },
    onOpponentUpdated: (placements) => {
      console.log('[DeploymentDemo] Opponent updated placements:', placements);
      setOpponentPlacements(placements);
    },
    onStatusChanged: (status) => {
      console.log('[DeploymentDemo] Status changed:', status);
      setDeploymentStatus(status);
    },
    onError: (message) => {
      console.error('[DeploymentDemo] Socket error:', message);
    }
  });

  const currentPlayerState = deploymentState[currentPlayerId];

  // Sync local lock state with server
  useEffect(() => {
    if (deploymentStatus?.isLocked && !currentPlayerState.isLocked) {
      // Server says locked, update local state
      clearAllPlacements();
    }
  }, [deploymentStatus?.isLocked, currentPlayerState.isLocked, clearAllPlacements]);

  // Handle drag start from roster
  const handleRosterDragStart = useCallback((creature: DeploymentCreature, _event: React.DragEvent | React.TouchEvent) => {
    console.log('Drag started:', creature.name);
    startDrag(creature);
  }, [startDrag]);

  // Handle drag end from roster
  const handleRosterDragEnd = useCallback((_event: React.DragEvent | React.TouchEvent) => {
    console.log('Drag ended from roster');
    // Don't end drag here, wait for drop on grid
  }, []);

  // Handle hex hover (update drag target)
  const handleHexHover = useCallback((hex: AxialCoordinate | null) => {
    if (dragState.phase === 'dragging') {
      updateDrag(hex);
    }
  }, [dragState.phase, updateDrag]);

  // Handle drop on grid
  const handleDrop = useCallback((hex: AxialCoordinate) => {
    console.log('Drop on hex:', hex);
    const success = endDrag(hex);
    console.log('Placement success:', success);

    // Emit placement to server if successful
    if (success && dragState.creature) {
      const placement: CreaturePlacement = {
        hex,
        creature: dragState.creature
      };
      emitPlacement(placement);
    }
  }, [endDrag, dragState.creature, emitPlacement]);

  // Handle hex click (for moving existing creatures)
  const handleHexClick = useCallback((hex: AxialCoordinate) => {
    console.log('Hex clicked:', hex);

    // If we're dragging, treat as drop
    if (dragState.phase === 'dragging') {
      handleDrop(hex);
      return;
    }

    // Otherwise, check if there's a creature here to pick up
    const creature = currentPlayerState.placements.find(
      p => p.hex.q === hex.q && p.hex.r === hex.r
    )?.creature;

    if (creature && creature.playerId === currentPlayerId) {
      // Start dragging this creature for repositioning
      startDrag(creature, hex);
      removeCreature(creature.id);
    }
  }, [dragState.phase, currentPlayerState.placements, currentPlayerId, handleDrop, startDrag, removeCreature]);

  // Handle ESC key to cancel drag
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dragState.phase === 'dragging') {
        console.log('Drag cancelled');
        cancelDrag();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dragState.phase, cancelDrag]);

  const handleClearAll = () => {
    clearAllPlacements(currentPlayerId);
  };

  const handleReady = () => {
    markReady(currentPlayerId);
    emitReady();
  };

  const handleUnready = () => {
    markUnready(currentPlayerId);
    emitUnready();
  };

  const placedCreatureIds = currentPlayerState.placements.map(p => p.creature.id);
  const isLocked = deploymentStatus?.isLocked || false;
  const countdownSeconds = deploymentStatus?.countdownSeconds || null;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(to bottom, #0a0e27 0%, #1a1a2e 100%)',
      padding: '40px 20px'
    }}>
      <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
        <header style={{
          textAlign: 'center',
          marginBottom: '20px',
          color: '#ecf0f1'
        }}>
          <h1 style={{
            fontSize: '36px',
            margin: '0 0 10px 0',
            color: '#3498db',
            textShadow: '0 0 20px rgba(52, 152, 219, 0.5)'
          }}>
            Deployment Grid - Multiplayer Demo
          </h1>
          <p style={{
            fontSize: '16px',
            color: '#95a5a6',
            maxWidth: '900px',
            margin: '0 auto 10px'
          }}>
            Drag creatures from the roster onto the hex grid to deploy them.
            Click placed creatures to reposition. Press ESC to cancel drag.
          </p>
          <div style={{
            fontSize: '14px',
            color: '#7f8c8d',
            marginTop: '8px'
          }}>
            <strong>Match ID:</strong> {matchId} | <strong>Playing as:</strong> {currentPlayerId === 'player1' ? 'Player 1 (Blue)' : 'Player 2 (Red)'}
          </div>
        </header>

        {/* Match Sharing */}
        <div style={{ maxWidth: '1000px', margin: '0 auto 20px' }}>
          <MatchSharing
            matchId={matchId}
            currentPlayerId={currentPlayerId}
          />
        </div>

        {/* Connection Status */}
        <div style={{ maxWidth: '1000px', margin: '0 auto 20px' }}>
          <ConnectionStatus
            isConnected={isConnected}
            opponentConnected={opponentConnected}
            opponentPlayerId={opponentPlayerId}
            error={socketError}
          />
        </div>

        {/* Main Layout: Roster + Grid */}
        <div style={{
          display: 'flex',
          gap: '30px',
          alignItems: 'flex-start',
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          {/* Creature Roster */}
          <CreatureRoster
            creatures={player1Creatures}
            placedCreatureIds={placedCreatureIds}
            onDragStart={handleRosterDragStart}
            onDragEnd={handleRosterDragEnd}
            isLocked={currentPlayerState.isLocked}
            playerId={currentPlayerId}
          />

          {/* Deployment Grid */}
          <div style={{ flex: 1, minWidth: '600px', maxWidth: '1000px' }}>
            <DeploymentGridWithDragDrop
              width={1000}
              height={600}
              hexSize={32}
              showCoordinates={false}
              onHexClick={handleHexClick}
              onHexHover={handleHexHover}
              placements={currentPlayerState.placements}
              opponentPlacements={opponentPlacements}
              draggingCreature={dragState.creature}
              dragTargetHex={dragState.targetHex}
              isDragValid={dragState.isValid}
              onDrop={handleDrop}
              currentPlayerId={currentPlayerId}
            />

            {/* Ready Panel */}
            <ReadyPanel
              currentPlayerId={currentPlayerId}
              player1Ready={deploymentStatus?.player1.isReady || false}
              player2Ready={deploymentStatus?.player2.isReady || false}
              isLocked={isLocked}
              countdownSeconds={countdownSeconds}
              canMarkReady={canMarkReady(currentPlayerId)}
              onReady={handleReady}
              onUnready={handleUnready}
            />
          </div>
        </div>

        {/* Deployment State Info */}
        <div style={{
          marginTop: '30px',
          padding: '20px',
          background: 'rgba(0, 0, 0, 0.3)',
          borderRadius: '8px',
          border: '1px solid #2c3e50'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '15px'
          }}>
            <h3 style={{
              margin: 0,
              color: '#3498db',
              fontSize: '18px'
            }}>
              Deployment Status
            </h3>
            <button
              onClick={handleClearAll}
              disabled={currentPlayerState.placements.length === 0}
              style={{
                padding: '8px 16px',
                background: currentPlayerState.placements.length > 0
                  ? 'linear-gradient(to bottom, #e74c3c 0%, #c0392b 100%)'
                  : '#555',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: currentPlayerState.placements.length > 0 ? 'pointer' : 'not-allowed',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              Clear All Placements
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '20px',
            color: '#ecf0f1'
          }}>
            <div>
              <strong style={{ color: '#f39c12' }}>Creatures Deployed:</strong>{' '}
              {getPlacementCount(currentPlayerId)} / 8
            </div>
            <div>
              <strong style={{ color: '#f39c12' }}>Drag State:</strong>{' '}
              {dragState.phase === 'idle' ? 'No active drag' : `Dragging ${dragState.creature?.name || 'unknown'}`}
            </div>
            <div>
              <strong style={{ color: '#f39c12' }}>Target Valid:</strong>{' '}
              {dragState.phase === 'dragging' ? (dragState.isValid ? 'Yes ✓' : 'No ✗') : 'N/A'}
            </div>
          </div>

          {/* Placements List */}
          {currentPlayerState.placements.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <h4 style={{ color: '#2ecc71', marginBottom: '10px' }}>Current Placements:</h4>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '10px'
              }}>
                {currentPlayerState.placements.map((placement, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '10px',
                      background: 'linear-gradient(to bottom, #34495e 0%, #2c3e50 100%)',
                      borderRadius: '4px',
                      border: '1px solid #3498db',
                      fontSize: '14px'
                    }}
                  >
                    <strong>{placement.creature.name}</strong>
                    <br />
                    <span style={{ color: '#95a5a6', fontSize: '12px' }}>
                      Position: ({placement.hex.q}, {placement.hex.r})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Feature Documentation */}
        <div style={{
          marginTop: '30px',
          padding: '20px',
          background: 'rgba(0, 0, 0, 0.3)',
          borderRadius: '8px',
          border: '1px solid #2c3e50',
          color: '#ecf0f1'
        }}>
          <h3 style={{
            margin: '0 0 15px 0',
            color: '#f39c12',
            fontSize: '18px'
          }}>
            Features Implemented
          </h3>
          <ul style={{
            margin: 0,
            padding: '0 0 0 20px',
            lineHeight: '1.8',
            columnCount: 2,
            columnGap: '40px'
          }}>
            <li><strong>Drag & Drop:</strong> Mouse and touch support for creature placement</li>
            <li><strong>Deployment Zones:</strong> Blue zone (columns 0-2) for Player 1</li>
            <li><strong>Visual Feedback:</strong> Green for valid, red for invalid placement</li>
            <li><strong>Creature Repositioning:</strong> Click placed creatures to move them</li>
            <li><strong>Placement Validation:</strong> Zone boundaries, occupancy, max limit</li>
            <li><strong>Drag Preview:</strong> Ghost sprite shows where creature will be placed</li>
            <li><strong>Cancel Drag:</strong> Press ESC to cancel active drag operation</li>
            <li><strong>State Management:</strong> Full deployment state tracking with React hooks</li>
            <li><strong>Creature Roster:</strong> Draggable cards with stats and placement status</li>
            <li><strong>PixiJS Rendering:</strong> Hardware-accelerated 60fps grid rendering</li>
            <li><strong>Debug Mode:</strong> Toggle coordinate labels with 'G' key</li>
            <li><strong>Type-Safe:</strong> Full TypeScript integration throughout</li>
          </ul>
        </div>

        {/* Usage Instructions */}
        <div style={{
          marginTop: '30px',
          padding: '20px',
          background: 'rgba(0, 0, 0, 0.3)',
          borderRadius: '8px',
          border: '1px solid #2c3e50',
          color: '#ecf0f1'
        }}>
          <h3 style={{
            margin: '0 0 15px 0',
            color: '#2ecc71',
            fontSize: '18px'
          }}>
            How to Use
          </h3>
          <ol style={{
            margin: 0,
            padding: '0 0 0 20px',
            lineHeight: '1.8'
          }}>
            <li>Drag a creature from the roster on the left onto the hex grid</li>
            <li>Creatures can only be placed in the blue deployment zone (left 3 columns)</li>
            <li>Green highlight = valid placement, Red highlight = invalid placement</li>
            <li>Click on a placed creature to pick it up and reposition it</li>
            <li>Press ESC key to cancel a drag operation and return creature to roster/original position</li>
            <li>Maximum 8 creatures can be deployed per player</li>
            <li>Press 'G' key to toggle coordinate labels for debugging</li>
            <li>Use "Clear All Placements" to reset and start over</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default DeploymentGridDemoPage;
