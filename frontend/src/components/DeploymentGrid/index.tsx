/**
 * Deployment Grid Component
 *
 * React wrapper for the PixiJS hex grid renderer.
 * Provides deployment zone visualization and creature placement interface.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { HexGridRenderer, HighlightState } from './DeploymentGridRenderer';
import type { AxialCoordinate } from '@drawn-of-war/shared';
import styles from './DeploymentGrid.module.css';

export interface DeploymentGridProps {
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
}

export const DeploymentGrid: React.FC<DeploymentGridProps> = ({
  width = 1000,
  height = 600,
  hexSize = 32,
  showCoordinates = false,
  onHexClick,
  onHexHover
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<HexGridRenderer | null>(null);
  const [_isInitialized, setIsInitialized] = useState(false);
  const [currentHex, setCurrentHex] = useState<AxialCoordinate | null>(null);
  const [selectedHex, setSelectedHex] = useState<AxialCoordinate | null>(null);
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
          console.log('[DeploymentGrid] Init completed but effect was cancelled, skipping mount');
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
        console.log('[DeploymentGrid] Renderer initialization aborted:', error);
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
    setSelectedHex(hex);

    // Update highlight to selected state
    if (rendererRef.current) {
      rendererRef.current.updateHighlight(hex, HighlightState.SELECTED);
    }

    onHexClick?.(hex);
  }, [onHexClick]);

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
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // Clear selection
  const handleClearSelection = () => {
    setSelectedHex(null);
    if (rendererRef.current) {
      rendererRef.current.clearHighlights();
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Hex Grid Deployment System</h2>
        <div className={styles.controls}>
          <button
            onClick={() => {
              setDebugMode(prev => {
                const newDebugMode = !prev;
                if (rendererRef.current) {
                  rendererRef.current.toggleCoordinates();
                }
                return newDebugMode;
              });
            }}
            className={styles.button}
          >
            {debugMode ? 'Hide Coordinates' : 'Show Coordinates'} (G)
          </button>
          <button
            onClick={handleClearSelection}
            disabled={!selectedHex}
            className={styles.button}
          >
            Clear Selection
          </button>
        </div>
      </div>

      <div ref={containerRef} className={styles.canvasContainer} />

      <div className={styles.info}>
        <div className={styles.infoSection}>
          <h3>Grid Info</h3>
          <div className={styles.infoItem}>
            <span>Grid Size:</span>
            <span>12 × 8 hexes</span>
          </div>
          <div className={styles.infoItem}>
            <span>Hex Size:</span>
            <span>{hexSize}px</span>
          </div>
          <div className={styles.infoItem}>
            <span>Orientation:</span>
            <span>Flat-top</span>
          </div>
        </div>

        <div className={styles.infoSection}>
          <h3>Deployment Zones</h3>
          <div className={styles.infoItem}>
            <span className={styles.zoneLabel} style={{ color: '#3498db' }}>
              Player 1 (Blue):
            </span>
            <span>Columns 0-2 (Left)</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.zoneLabel} style={{ color: '#e74c3c' }}>
              Player 2 (Red):
            </span>
            <span>Columns 9-11 (Right)</span>
          </div>
        </div>

        <div className={styles.infoSection}>
          <h3>Current State</h3>
          <div className={styles.infoItem}>
            <span>Hover Hex:</span>
            <span>
              {currentHex ? `(${currentHex.q}, ${currentHex.r})` : 'None'}
            </span>
          </div>
          <div className={styles.infoItem}>
            <span>Selected Hex:</span>
            <span>
              {selectedHex ? `(${selectedHex.q}, ${selectedHex.r})` : 'None'}
            </span>
          </div>
          <div className={styles.infoItem}>
            <span>Debug Mode:</span>
            <span>{debugMode ? 'ON' : 'OFF'}</span>
          </div>
        </div>

        <div className={styles.legend}>
          <h3>Highlight States</h3>
          <div className={styles.legendItem}>
            <div className={styles.colorBox} style={{ background: '#f39c12' }} />
            <span>Hover - Yellow outline + fill</span>
          </div>
          <div className={styles.legendItem}>
            <div className={styles.colorBox} style={{ background: '#2ecc71' }} />
            <span>Valid - Green outline + fill</span>
          </div>
          <div className={styles.legendItem}>
            <div className={styles.colorBox} style={{ background: '#e74c3c' }} />
            <span>Invalid - Red outline + fill</span>
          </div>
          <div className={styles.legendItem}>
            <div className={styles.colorBox} style={{ background: '#ecf0f1' }} />
            <span>Selected - White thick outline</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeploymentGrid;
