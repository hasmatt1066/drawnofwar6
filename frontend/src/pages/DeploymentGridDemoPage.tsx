/**
 * Deployment Grid Demo Page
 *
 * Demonstration page for the hex grid deployment system with drag-and-drop.
 * Shows creature roster, drag-and-drop placement, and deployment state.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import * as PIXI from 'pixi.js';
import { DeploymentGridWithDragDrop } from '../components/DeploymentGrid/DeploymentGridWithDragDrop';
import { CreatureRoster } from '../components/DeploymentGrid/CreatureRoster';
import { ReadyPanel } from '../components/DeploymentGrid/ReadyPanel';
import { ConnectionStatus } from '../components/DeploymentGrid/ConnectionStatus';
import { MatchSharing } from '../components/DeploymentGrid/MatchSharing';
import { useDeploymentState } from '../components/DeploymentGrid/useDeploymentState';
import { useDeploymentSocketSync } from '../hooks/useDeploymentSocketSync';
import { useRosterFromUrl } from '../hooks/useRosterFromUrl';
import { useCreatureRoster } from '../hooks/useCreatureRoster';
import { transformManyToDeploymentCreatures } from '../services/creature-transform.service';
import { getCreatureSpriteLoader } from '../services/creature-sprite-loader';
import { combatSocket } from '../services/combat-socket';
import { deploymentSocket } from '../services/deployment-socket';
import { CombatVisualizationManager } from '../services/combat-visualization-manager';
import { CombatGridRenderer } from '../components/CombatGrid/CombatGridRenderer';
import { CombatLogPanel } from '../components/CombatLogPanel/CombatLogPanel';
import { CombatLog, CombatEventType } from '../services/combat-log';
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

// Mock creature data for Player 2 (mirror of Player 1's roster)
const INITIAL_PLAYER2_CREATURES: DeploymentCreature[] = [
  { id: 'p2-warrior', name: 'Warrior', sprite: 'W', playerId: 'player2', stats: { health: 100, attack: 15, defense: 10 } },
  { id: 'p2-archer', name: 'Archer', sprite: 'A', playerId: 'player2', stats: { health: 80, attack: 20, defense: 5 } },
  { id: 'p2-mage', name: 'Mage', sprite: 'M', playerId: 'player2', stats: { health: 60, attack: 30, defense: 3 } },
  { id: 'p2-tank', name: 'Tank', sprite: 'T', playerId: 'player2', stats: { health: 150, attack: 10, defense: 20 } },
  { id: 'p2-rogue', name: 'Rogue', sprite: 'R', playerId: 'player2', stats: { health: 70, attack: 25, defense: 5 } },
  { id: 'p2-cleric', name: 'Cleric', sprite: 'C', playerId: 'player2', stats: { health: 90, attack: 12, defense: 8 } },
  { id: 'p2-paladin', name: 'Paladin', sprite: 'P', playerId: 'player2', stats: { health: 120, attack: 18, defense: 15 } },
  { id: 'p2-ranger', name: 'Ranger', sprite: 'G', playerId: 'player2', stats: { health: 85, attack: 22, defense: 7 } }
];

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
      const currentPath = window.location.pathname;
      const basePath = currentPath.includes('deployment-grid') ? '/deployment-grid' : '/deployment';

      // Preserve existing query parameters (like creatures)
      const params = new URLSearchParams(searchParams);
      if (!matchIdFromUrl) {
        params.set('matchId', matchId);
      }
      if (!playerIdFromUrl) {
        params.set('playerId', 'player1');
      }

      navigate(`${basePath}?${params.toString()}`, { replace: true });
    }
  }, [matchIdFromUrl, playerIdFromUrl, matchId, navigate, searchParams]);

  const [currentPlayerId] = useState<'player1' | 'player2'>(() => {
    return playerIdFromUrl || 'player1';
  });

  // Parse creature IDs from URL
  const { creatureIds, hasCreatures } = useRosterFromUrl();

  // Load creatures from library if IDs provided
  const { creatures: loadedCreatures, loading: loadingCreatures, error: loadError } = useCreatureRoster(
    creatureIds,
    currentPlayerId === 'player1' ? 'demo-player1' : 'demo-player2',
    hasCreatures
  );

  // Transform loaded creatures to deployment format
  const loadedDeploymentCreatures = React.useMemo(() => {
    if (loadedCreatures.length > 0) {
      return transformManyToDeploymentCreatures(loadedCreatures, currentPlayerId);
    }
    return [];
  }, [loadedCreatures, currentPlayerId]);

  // Use loaded creatures if available, otherwise fall back to mock data
  const [player1Creatures, setPlayer1Creatures] = useState<DeploymentCreature[]>(
    currentPlayerId === 'player1' && hasCreatures ? [] : INITIAL_PLAYER1_CREATURES
  );
  const [player2Creatures, setPlayer2Creatures] = useState<DeploymentCreature[]>(
    currentPlayerId === 'player2' && hasCreatures ? [] : INITIAL_PLAYER2_CREATURES
  );
  const [opponentPlacements, setOpponentPlacements] = useState<CreaturePlacement[]>([]);
  const [deploymentStatus, setDeploymentStatus] = useState<MatchDeploymentStatus | null>(null);
  const [combatState, setCombatState] = useState<any | null>(null);
  const [combatActive, setCombatActive] = useState(false);

  // Combat visualization state
  const [combatVisualizationManager, setCombatVisualizationManager] = useState<CombatVisualizationManager | null>(null);
  const [combatGridRenderer, setCombatGridRenderer] = useState<CombatGridRenderer | null>(null);
  const [combatLog] = useState(() => new CombatLog({ maxEntries: 100, showTimestamps: false }));
  const combatCanvasRef = useRef<HTMLDivElement>(null);

  // Update creatures when loaded from library
  useEffect(() => {
    if (!loadingCreatures && loadedDeploymentCreatures.length > 0) {
      console.log('[DeploymentDemo] Using loaded creatures from library:', loadedDeploymentCreatures.length);
      if (currentPlayerId === 'player1') {
        setPlayer1Creatures(loadedDeploymentCreatures);
      } else {
        setPlayer2Creatures(loadedDeploymentCreatures);
      }
    }
  }, [loadingCreatures, loadedDeploymentCreatures, currentPlayerId]);

  // Load creature sprites on mount (for mock data only)
  useEffect(() => {
    // Skip if using loaded creatures from library
    if (hasCreatures) {
      console.log('[DeploymentDemo] Skipping sprite loading - using creatures from library');
      return;
    }

    const loadSprites = async () => {
      const spriteLoader = getCreatureSpriteLoader();

      // Load sprites for both players' creatures
      const allCreatures = [...INITIAL_PLAYER1_CREATURES, ...INITIAL_PLAYER2_CREATURES];
      const results = await spriteLoader.loadBatch(
        allCreatures.map(c => ({ id: c.id, name: c.name }))
      );

      // Update Player 1 creatures with loaded sprites
      const updatedPlayer1Creatures = INITIAL_PLAYER1_CREATURES.map(creature => {
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

      // Update Player 2 creatures with loaded sprites
      const updatedPlayer2Creatures = INITIAL_PLAYER2_CREATURES.map(creature => {
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

      setPlayer1Creatures(updatedPlayer1Creatures);
      setPlayer2Creatures(updatedPlayer2Creatures);
      console.log('[DeploymentDemo] Loaded sprites for', allCreatures.length, 'creatures (P1:', updatedPlayer1Creatures.length, ', P2:', updatedPlayer2Creatures.length, ')');
    };

    loadSprites();
  }, [hasCreatures]);

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
    markLocked,
    canMarkReady,
    syncPlacementsFromServer
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
      console.log('[DeploymentDemo] ===== INITIAL STATE RECEIVED =====');
      console.log('[DeploymentDemo] Full data:', data);

      // Restore BOTH players' placements from server
      const currentPlayerPlacementsData = currentPlayerId === 'player1' ? data.player1Placements : data.player2Placements;
      const opponentId = currentPlayerId === 'player1' ? 'player2' : 'player1';
      const opponentPlacementsData = opponentId === 'player1' ? data.player1Placements : data.player2Placements;

      // Sync current player's placements
      console.log('[DeploymentDemo] Syncing current player placements:', {
        playerId: currentPlayerId,
        count: currentPlayerPlacementsData.length,
        creatures: currentPlayerPlacementsData.map(p => p.creature.name)
      });
      syncPlacementsFromServer(currentPlayerId, currentPlayerPlacementsData);

      // Update opponent placements
      console.log('[DeploymentDemo] Setting opponent placements:', {
        opponentId,
        count: opponentPlacementsData.length,
        placements: opponentPlacementsData.map(p => ({
          creatureId: p.creature.id,
          creatureName: p.creature.name,
          hasBattlefieldViews: !!p.creature.battlefieldDirectionalViews
        }))
      });
      setOpponentPlacements(opponentPlacementsData);
      setDeploymentStatus(data.deploymentStatus);
    },
    onOpponentPlaced: (placement) => {
      console.log('[DeploymentDemo] ===== OPPONENT PLACED =====');
      console.log('[DeploymentDemo] Full placement:', placement);
      console.log('[DeploymentDemo] Creature ID:', placement.creature.id);
      console.log('[DeploymentDemo] Creature name:', placement.creature.name);
      console.log('[DeploymentDemo] Has battlefieldDirectionalViews:', !!placement.creature.battlefieldDirectionalViews);
      if (placement.creature.battlefieldDirectionalViews) {
        console.log('[DeploymentDemo] Directional views:', placement.creature.battlefieldDirectionalViews);
        console.log('[DeploymentDemo] E direction:', placement.creature.battlefieldDirectionalViews.E);
      } else {
        console.log('[DeploymentDemo] ❌ NO battlefieldDirectionalViews - this is the problem!');
      }
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

  // Listen for combat start from deployment socket (registration only, no cleanup)
  useEffect(() => {
    console.log('[DeploymentDemo] Registering combat start listener');

    deploymentSocket.onCombatStarted(async (data: { matchId: string }) => {
      console.log('[DeploymentDemo] ===== COMBAT STARTED =====');
      console.log('[DeploymentDemo] Match ID:', data.matchId);

      // Mark combat as active FIRST - this will trigger the separate combat lifecycle effect
      setCombatActive(true);
      console.log('[DeploymentDemo] ✓ Combat active flag set');
    });

    // NO cleanup here - the combat start listener stays registered
    // Cleanup happens in the separate combat lifecycle effect below
  }, []); // Empty deps - register once on mount

  // Separate combat lifecycle management - only runs when combat becomes active
  useEffect(() => {
    if (!combatActive) {
      console.log('[DeploymentDemo] Combat not active, skipping combat setup');
      return;
    }

    console.log('[DeploymentDemo] Combat lifecycle: Starting initialization');
    let isCleanedUp = false;
    let renderer: CombatGridRenderer | null = null;
    let vizManager: CombatVisualizationManager | null = null;

    const initializeCombat = async () => {
      if (isCleanedUp) {
        console.log('[DeploymentDemo] Combat lifecycle: Already cleaned up, aborting init');
        return;
      }

      // Join combat socket FIRST and wait for confirmation
      try {
        console.log('[DeploymentDemo] Attempting to join combat socket...');
        await combatSocket.join(matchId);
        console.log('[DeploymentDemo] ✓ Successfully joined combat socket');
      } catch (error) {
        console.error('[DeploymentDemo] ✗ Failed to join combat socket:', error);
        return;
      }

      if (isCleanedUp) {
        console.log('[DeploymentDemo] Combat lifecycle: Cleaned up after socket join, aborting');
        combatSocket.leave();
        return;
      }

      // Initialize combat grid renderer
      try {
        console.log('[DeploymentDemo] Initializing combat grid renderer...');
        const gridConfig = {
          width: 14,
          height: 9,
          hexSize: 38,
          projection: 'isometric' as const
        };

        renderer = new CombatGridRenderer({
          canvasWidth: 1200,
          canvasHeight: 700,
          hexGridConfig: gridConfig,
          showCoordinates: false
        });

        const canvas = await renderer.init();
        console.log('[DeploymentDemo] ✓ Combat grid renderer initialized');

        if (isCleanedUp) {
          console.log('[DeploymentDemo] Combat lifecycle: Cleaned up during renderer init, aborting');
          renderer.destroy();
          combatSocket.leave();
          return;
        }

        // Add canvas to DOM
        if (combatCanvasRef.current) {
          combatCanvasRef.current.innerHTML = '';
          combatCanvasRef.current.appendChild(canvas);
          console.log('[DeploymentDemo] ✓ Canvas added to DOM');
        }

        setCombatGridRenderer(renderer);

        // Create socket adapter for CombatVisualizationManager
        console.log('[DeploymentDemo] Creating socket adapter...');
        const socketAdapter = {
          onCombatState: (callback: (state: any) => void) => {
            console.log('[DeploymentDemo] Socket adapter: registering state callback');
            combatSocket.onState((state) => {
              console.log('[DeploymentDemo] Socket adapter: received state, forwarding to callback');
              callback(state);
            });
          },
          onCombatCompleted: (callback: (result: any) => void) => {
            console.log('[DeploymentDemo] Socket adapter: registering completion callback');
            combatSocket.onCompleted((result) => {
              console.log('[DeploymentDemo] Socket adapter: received completion, forwarding to callback');
              callback(result);
            });
          },
          onError: (callback: (error: Error) => void) => {
            console.log('[DeploymentDemo] Socket adapter: registering error callback');
            combatSocket.onError((data) => {
              console.error('[DeploymentDemo] Socket adapter: received error, forwarding to callback');
              callback(new Error(data.message));
            });
          }
        };

        // Create combat visualization manager
        console.log('[DeploymentDemo] Creating CombatVisualizationManager...');
        vizManager = new CombatVisualizationManager(
          socketAdapter as any,
          new PIXI.Container(), // Stage container (will be added to renderer)
          renderer as any // Grid renderer interface
        );

        if (isCleanedUp) {
          console.log('[DeploymentDemo] Combat lifecycle: Cleaned up during viz manager creation, aborting');
          vizManager.destroy();
          renderer.destroy();
          combatSocket.leave();
          return;
        }

        // CRITICAL FIX: Load creature sprite data into the visualization manager
        // This allows combat to render actual creature sprites instead of placeholders
        // IMPORTANT: Include creatures from BOTH local rosters AND opponent placements
        // because opponent placements may contain creatures with sprite data we don't have locally
        const currentPlayerPlacements = currentPlayerState.placements.map(p => p.creature);
        const opponentCreatures = opponentPlacements.map(p => p.creature);
        const allCreatures = [...player1Creatures, ...player2Creatures, ...currentPlayerPlacements, ...opponentCreatures];

        // Deduplicate by creature ID (later entries override earlier ones)
        const creatureMap = new Map<string, DeploymentCreature>();
        allCreatures.forEach(c => creatureMap.set(c.id, c));
        const uniqueCreatures = Array.from(creatureMap.values());

        console.log('[DeploymentDemo] Loading creature sprite data into visualization manager:', uniqueCreatures.length, 'unique creatures');
        vizManager.setCreatureData(uniqueCreatures);

        console.log('[DeploymentDemo] Starting visualization manager...');
        vizManager.start();
        setCombatVisualizationManager(vizManager);
        console.log('[DeploymentDemo] ✓ Combat visualization manager started');

        // Listen for combat state updates and feed to combat log
        combatSocket.onState((state) => {
          console.log('[DeploymentDemo] ===== COMBAT STATE UPDATE =====');
          console.log('[DeploymentDemo] Tick:', state.tick);
          console.log('[DeploymentDemo] Units:', state.units?.length || 0);
          console.log('[DeploymentDemo] Projectiles:', state.projectiles?.length || 0);
          console.log('[DeploymentDemo] Events:', state.events?.length || 0);

          setCombatState(state);

          // Add log entry for tick
          if (state.tick !== undefined) {
            combatLog.addEntry({
              type: CombatEventType.STATUS,
              message: `Tick ${state.tick}`
            });
          }

          // Add log entries for events
          if (state.events && Array.isArray(state.events)) {
            state.events.slice(-5).forEach((event: any) => {
              if (event.type === 'damage') {
                combatLog.addEntry({
                  type: CombatEventType.ATTACK,
                  message: `${event.attackerId} dealt ${event.damage} damage to ${event.targetId}`
                });
              } else if (event.type === 'death') {
                combatLog.addEntry({
                  type: CombatEventType.DEATH,
                  message: `${event.unitId} was defeated`
                });
              }
            });
          }
        });

        // Listen for combat completion
        combatSocket.onCompleted((result) => {
          console.log('[DeploymentDemo] ===== COMBAT COMPLETED =====');
          console.log('[DeploymentDemo] Winner:', result.winner);
          console.log('[DeploymentDemo] Result:', result);

          setCombatActive(false);
          setCombatState(result);

          // Add completion log entry
          combatLog.addEntry({
            type: CombatEventType.STATUS,
            message: `Combat ended - Winner: ${result.winner || 'Draw'}`
          });

          // Cleanup will happen in the useEffect cleanup when combatActive becomes false
        });

        console.log('[DeploymentDemo] ✓ Combat initialization complete');

      } catch (error) {
        console.error('[DeploymentDemo] ✗ Failed to initialize combat visualization:', error);
        if (renderer) renderer.destroy();
        if (vizManager) vizManager.destroy();
        combatSocket.leave();
      }
    };

    initializeCombat();

    // Cleanup only when combat ends or component unmounts
    return () => {
      console.log('[DeploymentDemo] Combat lifecycle: Cleanup triggered');
      isCleanedUp = true;

      if (vizManager) {
        console.log('[DeploymentDemo] Stopping and destroying visualization manager');
        vizManager.stop();
        vizManager.destroy();
      }
      if (renderer) {
        console.log('[DeploymentDemo] Destroying combat grid renderer');
        renderer.destroy();
      }

      console.log('[DeploymentDemo] Leaving combat socket and removing listeners');
      combatSocket.removeAllListeners();
      combatSocket.leave();

      setCombatVisualizationManager(null);
      setCombatGridRenderer(null);
    };
  }, [combatActive, matchId, combatLog, player1Creatures, player2Creatures]); // Include creature rosters in dependencies

  const currentPlayerState = deploymentState[currentPlayerId];

  // Log placements whenever they change (for debugging disappearance bug)
  useEffect(() => {
    console.log(`[DeploymentDemo] currentPlayerState.placements changed:`, {
      playerId: currentPlayerId,
      count: currentPlayerState.placements.length,
      isLocked: currentPlayerState.isLocked,
      isReady: currentPlayerState.isReady,
      placements: currentPlayerState.placements.map(p => ({
        creatureId: p.creature.id,
        creatureName: p.creature.name,
        hex: p.hex
      }))
    });
  }, [currentPlayerState.placements, currentPlayerId, currentPlayerState.isLocked, currentPlayerState.isReady]);

  // Sync local lock state with server
  useEffect(() => {
    if (deploymentStatus?.isLocked && !currentPlayerState.isLocked) {
      console.log(`[DeploymentDemo] Syncing lock state - calling markLocked(${currentPlayerId})`);
      console.log(`[DeploymentDemo] Current placements before lock:`, currentPlayerState.placements.length);
      // Just update the locked flag, DON'T clear placements
      markLocked(currentPlayerId);
    }
  }, [deploymentStatus?.isLocked, currentPlayerState.isLocked, currentPlayerId, markLocked, currentPlayerState.placements]);

  // Handle drag start from roster
  const handleRosterDragStart = useCallback((creature: DeploymentCreature, _event: React.DragEvent | React.TouchEvent) => {
    console.log('Drag started:', creature.name);
    startDrag(creature);
  }, [startDrag]);

  // Handle hex hover (update drag target)
  const handleHexHover = useCallback((hex: AxialCoordinate | null) => {
    if (dragState.phase === 'dragging') {
      console.log('[HexHover] During drag, updating target to:', hex ? `{q: ${hex.q}, r: ${hex.r}}` : 'null');
      updateDrag(hex);
    }
  }, [dragState.phase, updateDrag]);

  // Handle drop on grid - MUST BE DEFINED BEFORE handleRosterDragEnd
  const handleDrop = useCallback((hex: AxialCoordinate) => {
    console.log('Drop on hex:', `{q: ${hex.q}, r: ${hex.r}}`);
    console.log('Current player ID:', currentPlayerId);
    console.log('Drag state:', { isValid: dragState.isValid, creature: dragState.creature?.name, creaturePlayerId: dragState.creature?.playerId });

    // Check if socket is connected before allowing placement
    if (!isConnected) {
      console.warn('[DeploymentDemo] Cannot place creature - socket not connected');
      cancelDrag();
      return;
    }

    const success = endDrag(hex);
    console.log('Placement success:', success);

    // Emit placement to server if successful
    if (success && dragState.creature) {
      const placement: CreaturePlacement = {
        hex,
        creature: dragState.creature
      };
      console.log('[DeploymentDemo] Emitting placement to server:', placement);
      emitPlacement(placement);
    }
  }, [endDrag, dragState, emitPlacement, currentPlayerId, isConnected, cancelDrag]);

  // Handle drag end from roster - Uses handleDrop, so must come AFTER
  const handleRosterDragEnd = useCallback((_event: React.DragEvent | React.TouchEvent) => {
    console.log('Drag ended from roster');

    // If drag is no longer active, it was already handled (prevents race condition)
    if (dragState.phase === 'idle') {
      console.log('Drag already completed, skipping');
      return;
    }

    // Complete the drag operation if we have a valid target
    if (dragState.phase === 'dragging' && dragState.targetHex && dragState.isValid) {
      console.log('Auto-completing drag to target hex:', dragState.targetHex);
      handleDrop(dragState.targetHex);
    } else {
      console.log('Cancelling invalid drag');
      cancelDrag();
    }
  }, [dragState.phase, dragState.targetHex, dragState.isValid, handleDrop, cancelDrag]);

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

  // Show loading state if creatures are being loaded from library
  if (hasCreatures && loadingCreatures) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(to bottom, #0a0e27 0%, #1a1a2e 100%)',
        padding: '40px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          textAlign: 'center',
          color: '#ecf0f1'
        }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '20px'
          }}>
            Loading creatures...
          </div>
          <p style={{ color: '#95a5a6' }}>
            Fetching {creatureIds.length} creature{creatureIds.length !== 1 ? 's' : ''} from library
          </p>
        </div>
      </div>
    );
  }

  // Show error state if failed to load creatures
  if (hasCreatures && loadError) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(to bottom, #0a0e27 0%, #1a1a2e 100%)',
        padding: '40px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          textAlign: 'center',
          color: '#ecf0f1',
          maxWidth: '600px'
        }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '20px',
            color: '#e74c3c'
          }}>
            Error Loading Creatures
          </div>
          <p style={{ color: '#95a5a6', marginBottom: '20px' }}>
            {loadError}
          </p>
          <button
            onClick={() => window.location.href = '/deployment'}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              borderRadius: '8px',
              border: 'none',
              background: '#3498db',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            Use Default Creatures
          </button>
        </div>
      </div>
    );
  }

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
            {hasCreatures && loadedCreatures.length > 0 && (
              <span style={{ color: '#27ae60', fontWeight: 'bold', marginLeft: '10px' }}>
                ({loadedCreatures.length} creature{loadedCreatures.length !== 1 ? 's' : ''} loaded from library)
              </span>
            )}
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

        {/* Main Layout: Roster + Grid (HIDE during combat) */}
        {!combatActive && (
          <div style={{
            display: 'flex',
            gap: '30px',
            alignItems: 'flex-start',
            justifyContent: 'center',
            flexWrap: 'wrap'
          }}>
            {/* Creature Roster */}
            <CreatureRoster
              creatures={currentPlayerId === 'player1' ? player1Creatures : player2Creatures}
              placedCreatureIds={placedCreatureIds}
              onDragStart={handleRosterDragStart}
              onDragEnd={handleRosterDragEnd}
              isLocked={currentPlayerState.isLocked}
              playerId={currentPlayerId}
            />

            {/* Deployment Grid */}
            <div style={{ flex: 1, minWidth: '600px', maxWidth: '1200px' }}>
              <DeploymentGridWithDragDrop
                width={1200}
                height={700}
                hexSize={38}
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
        )}

        {/* Combat Viewer (REPLACES deployment grid when active) */}
        {combatActive && (
          <div style={{
            marginTop: '30px',
            padding: '20px',
            background: 'rgba(139, 0, 0, 0.2)',
            borderRadius: '8px',
            border: '2px solid #e74c3c',
            boxShadow: '0 0 20px rgba(231, 76, 60, 0.3)'
          }}>
            <h3 style={{
              margin: '0 0 15px 0',
              color: '#e74c3c',
              fontSize: '24px',
              textAlign: 'center',
              textShadow: '0 0 10px rgba(231, 76, 60, 0.5)'
            }}>
              Combat in Progress
            </h3>

            {/* Combat Visualization Canvas and Log */}
            <div style={{
              display: 'flex',
              gap: '20px',
              marginBottom: '20px'
            }}>
              {/* Combat Grid Canvas */}
              <div
                ref={combatCanvasRef}
                style={{
                  flex: 1,
                  background: '#1a1a1a',
                  borderRadius: '4px',
                  border: '1px solid #444',
                  minHeight: '700px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              />

              {/* Combat Log */}
              <div style={{ width: '350px' }}>
                <CombatLogPanel
                  combatLog={combatLog}
                  enableFiltering={true}
                  autoScroll={true}
                  showClearButton={true}
                  maxHeight="700px"
                />
              </div>
            </div>

            {/* Combat Stats Summary */}
            {combatState && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '20px',
                color: '#ecf0f1'
              }}>
                {/* Current Tick */}
                <div style={{
                  padding: '15px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: '4px',
                  border: '1px solid #3498db'
                }}>
                  <strong style={{ color: '#3498db' }}>Current Tick:</strong>{' '}
                  <span style={{ fontSize: '20px', color: '#fff' }}>
                    {combatState.tick || 0}
                  </span>
                </div>

                {/* Player 1 Units */}
                <div style={{
                  padding: '15px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: '4px',
                  border: '1px solid #3498db'
                }}>
                  <strong style={{ color: '#3498db' }}>Player 1 Units:</strong>{' '}
                  <span style={{ fontSize: '20px', color: '#fff' }}>
                    {combatState.units?.filter((u: any) => u.playerId === 'player1' && u.currentHealth > 0).length || 0}
                  </span>
                </div>

                {/* Player 2 Units */}
                <div style={{
                  padding: '15px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: '4px',
                  border: '1px solid #e74c3c'
                }}>
                  <strong style={{ color: '#e74c3c' }}>Player 2 Units:</strong>{' '}
                  <span style={{ fontSize: '20px', color: '#fff' }}>
                    {combatState.units?.filter((u: any) => u.playerId === 'player2' && u.currentHealth > 0).length || 0}
                  </span>
                </div>

                {/* Combat Winner */}
                {combatState.winner && (
                  <div style={{
                    padding: '15px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    borderRadius: '4px',
                    border: '2px solid #2ecc71',
                    gridColumn: '1 / -1',
                    textAlign: 'center'
                  }}>
                    <strong style={{ color: '#2ecc71', fontSize: '24px' }}>
                      Winner: {combatState.winner === 'player1' ? 'Player 1' : combatState.winner === 'player2' ? 'Player 2' : 'Draw'}
                    </strong>
                  </div>
                )}
              </div>
            )}

            {/* Raw Combat State (for debugging) */}
            {combatState && (
              <details style={{ marginTop: '20px' }}>
                <summary style={{
                  cursor: 'pointer',
                  color: '#95a5a6',
                  fontSize: '14px',
                  padding: '10px',
                  background: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: '4px',
                  userSelect: 'none'
                }}>
                  Show Full Combat State (Debug)
                </summary>
                <pre style={{
                  marginTop: '10px',
                  padding: '15px',
                  background: 'rgba(0, 0, 0, 0.5)',
                  borderRadius: '4px',
                  color: '#2ecc71',
                  fontSize: '12px',
                  overflow: 'auto',
                  maxHeight: '400px',
                  border: '1px solid #34495e'
                }}>
                  {JSON.stringify(combatState, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}

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
