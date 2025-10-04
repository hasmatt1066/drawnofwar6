/**
 * Deployment Grid with Drag-and-Drop
 *
 * Enhanced DeploymentGrid component with integrated drag-and-drop functionality
 * for creature placement on the hex grid.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { HexGridRenderer, HighlightState } from './DeploymentGridRenderer';
import type { AxialCoordinate, DeploymentCreature, CreaturePlacement } from '@drawn-of-war/shared';
import styles from './DeploymentGrid.module.css';

export interface DeploymentGridWithDragDropProps {
  /** Canvas width in pixels */
  width?: number;
  /** Canvas height in pixels */
  height?: number;
  /** Hex size (radius) in pixels */
  hexSize?: number;
  /** Show coordinate labels for debugging */
  showCoordinates?: boolean;
  /** Callback when hex is clicked */
  onHexClick?: (hex: AxialCoordinate) => void;
  /** Callback when hex is hovered */
  onHexHover?: (hex: AxialCoordinate | null) => void;
  /** Creature placements to render */
  placements?: CreaturePlacement[];
  /** Opponent creature placements to render (read-only) */
  opponentPlacements?: CreaturePlacement[];
  /** Currently dragging creature (for preview) */
  draggingCreature?: DeploymentCreature | null;
  /** Target hex while dragging */
  dragTargetHex?: AxialCoordinate | null;
  /** Whether target is valid */
  isDragValid?: boolean;
  /** Callback when drop occurs on grid */
  onDrop?: (hex: AxialCoordinate) => void;
  /** Current player ID (for determining opponent team color) */
  currentPlayerId?: 'player1' | 'player2';
}

export const DeploymentGridWithDragDrop: React.FC<DeploymentGridWithDragDropProps> = ({
  width = 1000,
  height = 600,
  hexSize = 32,
  showCoordinates = false,
  onHexClick,
  onHexHover,
  placements = [],
  opponentPlacements = [],
  draggingCreature = null,
  dragTargetHex = null,
  isDragValid = false,
  onDrop
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<HexGridRenderer | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentHex, setCurrentHex] = useState<AxialCoordinate | null>(null);
  const [debugMode, setDebugMode] = useState(showCoordinates);

  // Initialize renderer
  useEffect(() => {
    let renderer: HexGridRenderer | null = null;
    let isCancelled = false;

    const initRenderer = async () => {
      if (!containerRef.current) return;

      // Create renderer
      renderer = new HexGridRenderer({
        canvasWidth: width,
        canvasHeight: height,
        hexGridConfig: {
          width: 12,
          height: 8,
          hexSize: hexSize,
          orientation: 'flat-top'
        },
        showCoordinates: debugMode,
        onHexHover: handleHexHover,
        onHexClick: handleHexClickInternal
      });

      try {
        // Initialize and get canvas
        const canvas = await renderer.init();

        // Check if effect was cancelled during async init (React 18 strict mode)
        if (isCancelled) {
          console.log('[DeploymentGridWithDragDrop] Init completed but effect was cancelled, skipping mount');
          return;
        }

        // Add canvas to container
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
          containerRef.current.appendChild(canvas);
        }

        rendererRef.current = renderer;
        setIsInitialized(true);
      } catch (error) {
        // Initialization was aborted (likely due to destroy during init)
        console.log('[DeploymentGridWithDragDrop] Renderer initialization aborted:', error);
      }
    };

    initRenderer();

    // Cleanup
    return () => {
      isCancelled = true;
      if (renderer) {
        renderer.destroy();
        rendererRef.current = null;
        setIsInitialized(false);
      }
    };
  }, [width, height, hexSize]); // Reinitialize if dimensions change

  // Handle hex hover
  const handleHexHover = useCallback((hex: AxialCoordinate | null) => {
    setCurrentHex(hex);
    onHexHover?.(hex);
  }, [onHexHover]);

  // Handle hex click
  const handleHexClickInternal = useCallback((hex: AxialCoordinate) => {
    onHexClick?.(hex);
  }, [onHexClick]);

  // Render creature placements
  useEffect(() => {
    if (!rendererRef.current || !isInitialized) return;

    // Clear all creatures first
    rendererRef.current.clearAllCreatures();

    // Render opponent placements first (so they appear behind)
    opponentPlacements.forEach(placement => {
      rendererRef.current!.renderCreature(
        placement.hex,
        placement.creature.name,
        placement.creature.playerId,
        placement.creature.sprite, // Pass sprite URL
        0.5 // 50% opacity for opponent creatures
      );
    });

    // Render own placements on top
    placements.forEach(placement => {
      rendererRef.current!.renderCreature(
        placement.hex,
        placement.creature.name,
        placement.creature.playerId,
        placement.creature.sprite // Pass sprite URL
      );
    });
  }, [placements, opponentPlacements, isInitialized]);

  // Handle drag preview
  useEffect(() => {
    if (!rendererRef.current || !isInitialized) return;

    // Clear existing preview
    rendererRef.current.clearDragPreview();

    // Show preview if dragging
    if (draggingCreature && dragTargetHex) {
      rendererRef.current.renderDragPreview(
        dragTargetHex,
        draggingCreature.name,
        draggingCreature.playerId,
        draggingCreature.sprite // Pass sprite URL
      );

      // Update highlight based on validity
      rendererRef.current.updateHighlight(
        dragTargetHex,
        isDragValid ? HighlightState.VALID : HighlightState.INVALID
      );
    } else {
      rendererRef.current.clearHighlights();
    }
  }, [draggingCreature, dragTargetHex, isDragValid, isInitialized]);

  // Handle drag over grid
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Handle drop on grid
  const handleDropOnGrid = useCallback((event: React.DragEvent) => {
    event.preventDefault();

    if (!rendererRef.current || !currentHex) return;

    onDrop?.(currentHex);
  }, [currentHex, onDrop]);

  // Toggle debug mode with 'G' key
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'g' || e.key === 'G') {
        setDebugMode(prev => {
          const newDebugMode = !prev;
          if (rendererRef.current) {
            rendererRef.current.toggleCoordinates();
          }
          return newDebugMode;
        });
      }

      // ESC to cancel drag (handled by parent component)
      if (e.key === 'Escape' && draggingCreature) {
        // Parent should handle this via cancelDrag
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [draggingCreature]);

  return (
    <div className={styles.container}>
      <div
        ref={containerRef}
        className={styles.canvasContainer}
        onDragOver={handleDragOver}
        onDrop={handleDropOnGrid}
      />
    </div>
  );
};

export default DeploymentGridWithDragDrop;
