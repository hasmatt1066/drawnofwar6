/**
 * Animation Player Component
 *
 * Displays animated sprite with animation selector.
 * Shows the actual walk animation frames when "walk" is selected,
 * and displays a message for library animations that haven't been generated yet.
 */

import React, { useEffect, useState } from 'react';
import type { AnimationSet } from '@/services/generationService';
import styles from './AnimationPlayer.module.css';

interface AnimationPlayerProps {
  /** Base sprite image (base64) */
  baseSprite?: string;

  /** Walk animation frames (base64) - the only animation actually generated */
  walkAnimationFrames?: string[];

  /** Animation set with all assigned animation IDs */
  animationSet: AnimationSet;

  /** Total number of animations */
  totalAnimations: number;
}

export const AnimationPlayer: React.FC<AnimationPlayerProps> = ({
  baseSprite,
  walkAnimationFrames,
  animationSet,
  totalAnimations
}) => {
  // Currently selected animation ID
  const [selectedAnimation, setSelectedAnimation] = useState<string>(
    walkAnimationFrames && walkAnimationFrames.length > 0
      ? animationSet.walk
      : animationSet.idle
  );

  // Current frame index for animation playback
  const [currentFrame, setCurrentFrame] = useState(0);

  // Animation playback state
  const [isPlaying, setIsPlaying] = useState(true);

  // Get all animation IDs as a flat list
  const allAnimationIds = [
    animationSet.idle,
    animationSet.walk,
    animationSet.attack,
    animationSet.death,
    ...animationSet.additional
  ];

  // Animation frame playback
  useEffect(() => {
    if (!isPlaying) return;

    // Only walk animation has actual frames from PixelLab
    if (selectedAnimation === animationSet.walk && walkAnimationFrames && walkAnimationFrames.length > 0) {
      const fps = 10; // 10 frames per second
      const interval = setInterval(() => {
        setCurrentFrame((prev) => (prev + 1) % walkAnimationFrames.length);
      }, 1000 / fps);

      return () => clearInterval(interval);
    }

    // Reset frame for non-animated states
    setCurrentFrame(0);
  }, [isPlaying, selectedAnimation, animationSet.walk, walkAnimationFrames]);

  // Determine what to display
  const getDisplayImage = (): string | null => {
    // If walk animation is selected and we have frames, show current frame
    if (selectedAnimation === animationSet.walk && walkAnimationFrames && walkAnimationFrames.length > 0) {
      return `data:image/png;base64,${walkAnimationFrames[currentFrame]}`;
    }

    // For all other animations, show base sprite
    if (baseSprite) {
      return `data:image/png;base64,${baseSprite}`;
    }

    return null;
  };

  // Get human-readable animation name
  const getAnimationName = (animId: string): string => {
    // Convert ID to readable name
    // Example: "attack_melee_sword" → "Attack Melee Sword"
    return animId
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Check if animation has actual frames
  const hasFrames = (animId: string): boolean => {
    return animId === animationSet.walk && walkAnimationFrames && walkAnimationFrames.length > 0;
  };

  const displayImage = getDisplayImage();

  return (
    <div className={styles.container}>
      {/* Animation Viewport */}
      <div className={styles.viewport}>
        {displayImage ? (
          <img
            src={displayImage}
            alt={`${getAnimationName(selectedAnimation)} animation`}
            className={styles.sprite}
            style={{
              imageRendering: 'pixelated',
              width: '256px',
              height: '256px'
            }}
          />
        ) : (
          <div className={styles.placeholder}>
            <p>No sprite available</p>
          </div>
        )}

        {/* Frame counter for animated sprites */}
        {hasFrames(selectedAnimation) && walkAnimationFrames && (
          <div className={styles.frameCounter}>
            Frame {currentFrame + 1} of {walkAnimationFrames.length}
          </div>
        )}

        {/* Library animation notice */}
        {!hasFrames(selectedAnimation) && (
          <div className={styles.libraryNotice}>
            <span className={styles.libraryIcon}>📚</span>
            <span className={styles.libraryText}>Library Animation</span>
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

      {/* Animation Selector */}
      <div className={styles.selectorSection}>
        <label htmlFor="animation-select" className={styles.selectorLabel}>
          Animation ({totalAnimations} total)
        </label>
        <select
          id="animation-select"
          className={styles.selector}
          value={selectedAnimation}
          onChange={(e) => setSelectedAnimation(e.target.value)}
        >
          <optgroup label="Base Animations">
            <option value={animationSet.idle}>
              {getAnimationName(animationSet.idle)} {animationSet.idle === animationSet.walk ? '(Animated)' : ''}
            </option>
            <option value={animationSet.walk}>
              {getAnimationName(animationSet.walk)} (Animated ✓)
            </option>
            <option value={animationSet.attack}>
              {getAnimationName(animationSet.attack)}
            </option>
            <option value={animationSet.death}>
              {getAnimationName(animationSet.death)}
            </option>
          </optgroup>

          {animationSet.additional.length > 0 && (
            <optgroup label="Additional Animations">
              {animationSet.additional.map((animId) => (
                <option key={animId} value={animId}>
                  {getAnimationName(animId)}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      {/* Animation Info */}
      <div className={styles.info}>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Selected:</span>
          <span className={styles.infoValue}>{getAnimationName(selectedAnimation)}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Status:</span>
          <span className={styles.infoValue}>
            {hasFrames(selectedAnimation) ? (
              <span className={styles.statusAnimated}>✓ Animated</span>
            ) : (
              <span className={styles.statusLibrary}>📚 Library (Static)</span>
            )}
          </span>
        </div>
      </div>

      {/* Help Text */}
      <div className={styles.helpText}>
        <p>
          <strong>Walk animation</strong> has been generated with {walkAnimationFrames?.length || 0} frames.
          All other animations are assigned from the library and will display the base sprite.
        </p>
      </div>
    </div>
  );
};
