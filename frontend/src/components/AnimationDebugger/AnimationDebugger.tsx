/**
 * Animation Debugger Component (Admin/Dev Only)
 *
 * Allows admins to review all 20+ assigned animations to verify they look
 * and animate as expected. Shows which animations have actual frames vs
 * are library placeholders.
 */

import React, { useEffect, useState } from 'react';
import type { AnimationSet } from '@/services/generationService';
import styles from './AnimationDebugger.module.css';

interface AnimationDebuggerProps {
  /** Base sprite image (base64) */
  baseSprite?: string;

  /** Walk animation frames (base64) - the only animation actually generated */
  walkAnimationFrames?: string[];

  /** Animation set with all assigned animation IDs */
  animationSet: AnimationSet;

  /** Total number of animations */
  totalAnimations: number;

  /** Optional: Hide by default */
  defaultExpanded?: boolean;
}

interface LibraryAnimation {
  animationId: string;
  action: string;
  description: string;
  frameCount: number;
  baseSprite: string;
  frames: string[];
}

export const AnimationDebugger: React.FC<AnimationDebuggerProps> = ({
  baseSprite,
  walkAnimationFrames,
  animationSet,
  totalAnimations,
  defaultExpanded = false
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [selectedAnimation, setSelectedAnimation] = useState<string>(
    walkAnimationFrames && walkAnimationFrames.length > 0
      ? animationSet.walk
      : animationSet.idle
  );
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  // Library animations cache
  const [libraryAnimations, setLibraryAnimations] = useState<Map<string, LibraryAnimation>>(new Map());
  const [loadingAnimations, setLoadingAnimations] = useState<Set<string>>(new Set());

  // Fetch library animation from API
  const fetchLibraryAnimation = async (animationId: string) => {
    if (libraryAnimations.has(animationId) || loadingAnimations.has(animationId)) {
      return; // Already loaded or loading
    }

    setLoadingAnimations(prev => new Set(prev).add(animationId));

    try {
      const response = await fetch(`/api/library-animations/${animationId}`);
      if (!response.ok) {
        throw new Error(`Failed to load library animation: ${animationId}`);
      }

      const data: LibraryAnimation = await response.json();
      setLibraryAnimations(prev => new Map(prev).set(animationId, data));
    } catch (error) {
      console.error(`Error loading library animation ${animationId}:`, error);
    } finally {
      setLoadingAnimations(prev => {
        const newSet = new Set(prev);
        newSet.delete(animationId);
        return newSet;
      });
    }
  };

  // Load library animation when selected
  useEffect(() => {
    if (selectedAnimation !== animationSet.walk) {
      fetchLibraryAnimation(selectedAnimation);
    }
  }, [selectedAnimation]);

  // Get all animation IDs as a flat list with metadata
  const allAnimations = [
    { id: animationSet.idle, category: 'Base', label: 'Idle' },
    { id: animationSet.walk, category: 'Base', label: 'Walk' },
    { id: animationSet.attack, category: 'Base', label: 'Attack' },
    { id: animationSet.death, category: 'Base', label: 'Death' },
    ...animationSet.additional.map((id, index) => ({
      id,
      category: 'Additional',
      label: formatAnimationName(id)
    }))
  ];

  // Animation frame playback
  useEffect(() => {
    if (!isPlaying) return;

    // Walk animation has frames from creature generation
    if (selectedAnimation === animationSet.walk && walkAnimationFrames && walkAnimationFrames.length > 0) {
      const fps = 10;
      const interval = setInterval(() => {
        setCurrentFrame((prev) => (prev + 1) % walkAnimationFrames.length);
      }, 1000 / fps);
      return () => clearInterval(interval);
    }

    // Library animations
    const libraryAnim = libraryAnimations.get(selectedAnimation);
    if (libraryAnim && libraryAnim.frames.length > 0) {
      const fps = 10;
      const interval = setInterval(() => {
        setCurrentFrame((prev) => (prev + 1) % libraryAnim.frames.length);
      }, 1000 / fps);
      return () => clearInterval(interval);
    }

    // Reset frame for non-animated states
    setCurrentFrame(0);
  }, [isPlaying, selectedAnimation, animationSet.walk, walkAnimationFrames, libraryAnimations]);

  // Check if animation has actual frames
  const hasFrames = (animId: string): boolean => {
    // Walk animation from creature generation
    if (animId === animationSet.walk && walkAnimationFrames && walkAnimationFrames.length > 0) {
      return true;
    }
    // Library animations
    const libraryAnim = libraryAnimations.get(animId);
    return libraryAnim !== undefined && libraryAnim.frames.length > 0;
  };

  // Get display image
  const getDisplayImage = (): string | null => {
    // Walk animation from creature generation
    if (selectedAnimation === animationSet.walk && walkAnimationFrames && walkAnimationFrames.length > 0) {
      return `data:image/png;base64,${walkAnimationFrames[currentFrame]}`;
    }

    // Library animations
    const libraryAnim = libraryAnimations.get(selectedAnimation);
    if (libraryAnim && libraryAnim.frames.length > 0) {
      return `data:image/png;base64,${libraryAnim.frames[currentFrame]}`;
    }

    // Fallback to creature's base sprite
    if (baseSprite) {
      return `data:image/png;base64,${baseSprite}`;
    }

    return null;
  };

  const displayImage = getDisplayImage();

  if (!isExpanded) {
    return (
      <div className={styles.collapsedContainer}>
        <button
          className={styles.expandButton}
          onClick={() => setIsExpanded(true)}
        >
          🔍 Show Animation Debugger ({totalAnimations} animations)
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h3 className={styles.title}>
          🛠️ Animation Debugger (Admin View)
        </h3>
        <button
          className={styles.collapseButton}
          onClick={() => setIsExpanded(false)}
        >
          Hide ✕
        </button>
      </div>

      <div className={styles.content}>
        {/* Left Panel: Animation Viewport */}
        <div className={styles.leftPanel}>
          <div className={styles.viewport}>
            {displayImage ? (
              <>
                <img
                  src={displayImage}
                  alt={`${selectedAnimation} animation`}
                  className={styles.sprite}
                  style={{
                    imageRendering: 'pixelated',
                    width: '256px',
                    height: '256px'
                  }}
                />

                {/* Frame counter for animated sprites */}
                {(() => {
                  if (selectedAnimation === animationSet.walk && walkAnimationFrames && walkAnimationFrames.length > 0) {
                    return (
                      <div className={styles.frameCounter}>
                        Frame {currentFrame + 1} of {walkAnimationFrames.length}
                      </div>
                    );
                  }
                  const libraryAnim = libraryAnimations.get(selectedAnimation);
                  if (libraryAnim && libraryAnim.frames.length > 0) {
                    return (
                      <div className={styles.frameCounter}>
                        Frame {currentFrame + 1} of {libraryAnim.frames.length}
                      </div>
                    );
                  }
                  if (loadingAnimations.has(selectedAnimation)) {
                    return (
                      <div className={styles.libraryBadge}>
                        ⏳ Loading...
                      </div>
                    );
                  }
                  return (
                    <div className={styles.libraryBadge}>
                      📚 Library (Not Loaded)
                    </div>
                  );
                })()}
              </>
            ) : (
              <div className={styles.placeholder}>
                <p>No sprite available</p>
              </div>
            )}
          </div>

          {/* Playback Controls */}
          <div className={styles.controls}>
            <button
              className={styles.playButton}
              onClick={() => setIsPlaying(!isPlaying)}
              disabled={!hasFrames(selectedAnimation)}
            >
              {isPlaying ? '⏸ Pause' : '▶ Play'}
            </button>
          </div>

          {/* Current Animation Info */}
          <div className={styles.animationInfo}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Selected:</span>
              <span className={styles.infoValue}>{formatAnimationName(selectedAnimation)}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>ID:</span>
              <span className={styles.infoValueMono}>{selectedAnimation}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Status:</span>
              <span className={styles.infoValue}>
                {(() => {
                  if (selectedAnimation === animationSet.walk && walkAnimationFrames && walkAnimationFrames.length > 0) {
                    return <span className={styles.statusAnimated}>✓ Animated ({walkAnimationFrames.length} frames)</span>;
                  }
                  const libraryAnim = libraryAnimations.get(selectedAnimation);
                  if (libraryAnim) {
                    return <span className={styles.statusAnimated}>✓ Animated ({libraryAnim.frames.length} frames, Library)</span>;
                  }
                  if (loadingAnimations.has(selectedAnimation)) {
                    return <span className={styles.statusStatic}>⏳ Loading...</span>;
                  }
                  return <span className={styles.statusStatic}>📚 Static (Library not loaded)</span>;
                })()}
              </span>
            </div>
          </div>
        </div>

        {/* Right Panel: Animation List */}
        <div className={styles.rightPanel}>
          <div className={styles.listHeader}>
            <h4 className={styles.listTitle}>
              All Animations ({totalAnimations})
            </h4>
            <div className={styles.legend}>
              <span className={styles.legendItem}>
                <span className={styles.legendDot} style={{ backgroundColor: '#4ade80' }}></span>
                Animated
              </span>
              <span className={styles.legendItem}>
                <span className={styles.legendDot} style={{ backgroundColor: '#94a3b8' }}></span>
                Static
              </span>
            </div>
          </div>

          <div className={styles.animationList}>
            {/* Base Animations */}
            <div className={styles.categoryGroup}>
              <div className={styles.categoryLabel}>Base Animations (4)</div>
              {allAnimations.slice(0, 4).map((anim) => (
                <button
                  key={anim.id}
                  className={`${styles.animationButton} ${
                    selectedAnimation === anim.id ? styles.animationButtonActive : ''
                  }`}
                  onClick={() => setSelectedAnimation(anim.id)}
                >
                  <span className={styles.animationLabel}>{anim.label}</span>
                  <span className={styles.animationId}>{anim.id}</span>
                  <span className={styles.animationStatus}>
                    {hasFrames(anim.id) ? (
                      <span className={styles.statusDotAnimated}>✓</span>
                    ) : (
                      <span className={styles.statusDotStatic}>○</span>
                    )}
                  </span>
                </button>
              ))}
            </div>

            {/* Additional Animations */}
            {allAnimations.length > 4 && (
              <div className={styles.categoryGroup}>
                <div className={styles.categoryLabel}>
                  Additional Animations ({allAnimations.length - 4})
                </div>
                {allAnimations.slice(4).map((anim) => (
                  <button
                    key={anim.id}
                    className={`${styles.animationButton} ${
                      selectedAnimation === anim.id ? styles.animationButtonActive : ''
                    }`}
                    onClick={() => setSelectedAnimation(anim.id)}
                  >
                    <span className={styles.animationLabel}>{anim.label}</span>
                    <span className={styles.animationId}>{anim.id}</span>
                    <span className={styles.animationStatus}>
                      {hasFrames(anim.id) ? (
                        <span className={styles.statusDotAnimated}>✓</span>
                      ) : (
                        <span className={styles.statusDotStatic}>○</span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Help Text */}
      <div className={styles.footer}>
        <p className={styles.helpText}>
          <strong>Admin Note:</strong> The <strong>walk animation</strong> is generated specifically
          for this creature. All other animations are loaded from the library (generic sprites) and
          will display animated frames once library generation completes. Click any animation to preview it.
        </p>
      </div>
    </div>
  );
};

/**
 * Format animation ID to human-readable name
 * Example: "attack_melee_sword" → "Attack Melee Sword"
 */
function formatAnimationName(animId: string): string {
  return animId
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
