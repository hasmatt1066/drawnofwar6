/**
 * Directional Animation Studio
 *
 * Component to showcase and test multi-directional creature sprites and animations.
 * Displays all 6 hex directions with walk animations.
 */

import React, { useState, useEffect } from 'react';
import { HexDirection } from '@drawn-of-war/shared';
import type { BattlefieldDirectionalViews } from '@drawn-of-war/shared';

interface DirectionalAnimationStudioProps {
  /** Creature name */
  creatureName: string;
  /** Multi-directional battlefield views */
  directionalViews: BattlefieldDirectionalViews;
  /** Size of each sprite preview (default 128px) */
  spriteSize?: number;
}

/**
 * Direction metadata for display
 */
const DIRECTION_INFO = [
  { key: HexDirection.E, label: 'E (East)', generated: true },
  { key: HexDirection.NE, label: 'NE (Northeast)', generated: true },
  { key: HexDirection.SE, label: 'SE (Southeast)', generated: true },
  { key: HexDirection.W, label: 'W (West)', generated: false, mirror: HexDirection.E },
  { key: HexDirection.NW, label: 'NW (Northwest)', generated: false, mirror: HexDirection.NE },
  { key: HexDirection.SW, label: 'SW (Southwest)', generated: false, mirror: HexDirection.SE }
];

export const DirectionalAnimationStudio: React.FC<DirectionalAnimationStudioProps> = ({
  creatureName,
  directionalViews,
  spriteSize = 128
}) => {
  const [animationFrames, setAnimationFrames] = useState<Record<number, number>>({
    [HexDirection.E]: 0,
    [HexDirection.NE]: 0,
    [HexDirection.SE]: 0,
    [HexDirection.W]: 0,
    [HexDirection.NW]: 0,
    [HexDirection.SW]: 0
  });

  const [isAnimating, setIsAnimating] = useState(false);

  // Animation loop
  useEffect(() => {
    if (!isAnimating) return;

    const interval = setInterval(() => {
      setAnimationFrames(prev => {
        const next = { ...prev };
        // Update each direction's frame
        for (const dir of DIRECTION_INFO) {
          const frames = getFramesForDirection(dir.key);
          if (frames.length > 0) {
            next[dir.key] = ((prev[dir.key] || 0) + 1) % frames.length;
          }
        }
        return next;
      });
    }, 150); // 150ms per frame (~6.7 FPS for smooth walk cycle)

    return () => clearInterval(interval);
  }, [isAnimating, directionalViews]);

  /**
   * Get frames for a direction (with mirroring logic)
   */
  const getFramesForDirection = (direction: HexDirection): string[] => {
    switch (direction) {
      case HexDirection.E:
        return directionalViews.E.walkFrames;
      case HexDirection.NE:
        return directionalViews.NE.walkFrames;
      case HexDirection.SE:
        return directionalViews.SE.walkFrames;
      case HexDirection.W:
        return directionalViews.E.walkFrames; // Mirror of E
      case HexDirection.NW:
        return directionalViews.NE.walkFrames; // Mirror of NE
      case HexDirection.SW:
        return directionalViews.SE.walkFrames; // Mirror of SE
      default:
        return directionalViews.E.walkFrames;
    }
  };

  /**
   * Get static sprite for a direction
   */
  const getSpriteForDirection = (direction: HexDirection): string => {
    switch (direction) {
      case HexDirection.E:
        return directionalViews.E.sprite;
      case HexDirection.NE:
        return directionalViews.NE.sprite;
      case HexDirection.SE:
        return directionalViews.SE.sprite;
      case HexDirection.W:
        return directionalViews.E.sprite; // Mirror of E
      case HexDirection.NW:
        return directionalViews.NE.sprite; // Mirror of NE
      case HexDirection.SW:
        return directionalViews.SE.sprite; // Mirror of SE
      default:
        return directionalViews.E.sprite;
    }
  };

  /**
   * Check if direction should be mirrored
   */
  const shouldMirror = (direction: HexDirection): boolean => {
    return direction === HexDirection.W || direction === HexDirection.NW || direction === HexDirection.SW;
  };

  return (
    <div style={{
      background: 'rgba(0, 0, 0, 0.3)',
      borderRadius: '8px',
      padding: '20px',
      border: '1px solid #2c3e50'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h3 style={{
          margin: 0,
          color: '#3498db',
          fontSize: '20px'
        }}>
          Directional Animation Studio - {creatureName}
        </h3>
        <button
          onClick={() => setIsAnimating(!isAnimating)}
          style={{
            padding: '10px 20px',
            background: isAnimating
              ? 'linear-gradient(to bottom, #e74c3c 0%, #c0392b 100%)'
              : 'linear-gradient(to bottom, #2ecc71 0%, #27ae60 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600'
          }}
        >
          {isAnimating ? 'Stop Animation' : 'Play Walk Cycle'}
        </button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '20px'
      }}>
        {DIRECTION_INFO.map(dir => {
          const frames = getFramesForDirection(dir.key);
          const currentFrame = animationFrames[dir.key] || 0;
          const sprite = isAnimating && frames.length > 0 ? frames[currentFrame] : getSpriteForDirection(dir.key);
          const isMirrored = shouldMirror(dir.key);

          return (
            <div
              key={dir.key}
              style={{
                background: 'linear-gradient(to bottom, #34495e 0%, #2c3e50 100%)',
                borderRadius: '8px',
                padding: '15px',
                border: dir.generated ? '2px solid #3498db' : '2px solid #95a5a6',
                textAlign: 'center'
              }}
            >
              <div style={{
                marginBottom: '10px',
                color: '#ecf0f1',
                fontSize: '14px',
                fontWeight: '600'
              }}>
                {dir.label}
              </div>

              <div style={{
                width: spriteSize,
                height: spriteSize,
                margin: '0 auto 10px',
                background: '#1a1a1a',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #555'
              }}>
                <img
                  src={`data:image/png;base64,${sprite}`}
                  alt={`${creatureName} ${dir.label}`}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    imageRendering: 'pixelated',
                    transform: isMirrored ? 'scaleX(-1)' : 'none'
                  }}
                />
              </div>

              <div style={{
                fontSize: '12px',
                color: dir.generated ? '#2ecc71' : '#95a5a6'
              }}>
                {dir.generated ? (
                  <>Generated ({frames.length} frames)</>
                ) : (
                  <>Mirrored from {DIRECTION_INFO.find(d => d.key === dir.mirror)?.label.split(' ')[0]}</>
                )}
              </div>

              {isAnimating && (
                <div style={{
                  marginTop: '8px',
                  fontSize: '11px',
                  color: '#7f8c8d'
                }}>
                  Frame {currentFrame + 1}/{frames.length}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{
        marginTop: '20px',
        padding: '15px',
        background: 'rgba(52, 152, 219, 0.1)',
        borderRadius: '4px',
        border: '1px solid #3498db'
      }}>
        <h4 style={{
          margin: '0 0 10px 0',
          color: '#3498db',
          fontSize: '14px'
        }}>
          System Overview
        </h4>
        <ul style={{
          margin: 0,
          padding: '0 0 0 20px',
          color: '#ecf0f1',
          fontSize: '13px',
          lineHeight: '1.8'
        }}>
          <li><strong>3 Generated Directions:</strong> E, NE, SE (API cost optimized)</li>
          <li><strong>3 Mirrored Directions:</strong> W, NW, SW (horizontal flip, no API cost)</li>
          <li><strong>Walk Animation:</strong> 4 frames per direction (~150ms per frame)</li>
          <li><strong>Total Frames:</strong> {directionalViews.E.walkFrames.length + directionalViews.NE.walkFrames.length + directionalViews.SE.walkFrames.length} generated frames</li>
          <li><strong>View Angle:</strong> Low top-down perspective (~20°)</li>
        </ul>
      </div>
    </div>
  );
};

export default DirectionalAnimationStudio;
