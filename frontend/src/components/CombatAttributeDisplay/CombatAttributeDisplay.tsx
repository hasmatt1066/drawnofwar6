/**
 * Combat Attribute Display Component
 *
 * Displays dynamic combat attributes for a creature:
 * - Baseline attack (melee or ranged)
 * - 1-3 special combat attributes with effect compositing
 */

import React, { useState, useEffect } from 'react';
import styles from './CombatAttributeDisplay.module.css';

interface CombatAttribute {
  attributeId: string;
  name: string;
  category: string;
  spriteAnimationId: string;
  damageType: string;
  attackType: string;
  priority: number;
  effectFrames?: string[];
}

interface CombatAttributeDisplayProps {
  attributes: CombatAttribute[];
  creatureSprite: string;
  baselineAttackType: 'melee' | 'ranged';
}

interface AttributeAnimationState {
  isPlaying: boolean;
  currentFrame: number;
}

export const CombatAttributeDisplay: React.FC<CombatAttributeDisplayProps> = ({
  attributes,
  creatureSprite,
  baselineAttackType
}) => {
  // Animation state for baseline attack
  const [baselineState, setBaselineState] = useState<AttributeAnimationState>({
    isPlaying: false,
    currentFrame: 0
  });

  // Animation states for each attribute
  const [attributeStates, setAttributeStates] = useState<Record<string, AttributeAnimationState>>({});

  // Initialize attribute states
  useEffect(() => {
    const initialStates: Record<string, AttributeAnimationState> = {};
    attributes.forEach(attr => {
      initialStates[attr.attributeId] = {
        isPlaying: false,
        currentFrame: 0
      };
    });
    setAttributeStates(initialStates);
  }, [attributes]);

  // Baseline attack animation (for demo, we'll just show the sprite)
  const playBaselineAttack = () => {
    if (baselineState.isPlaying) return;

    setBaselineState({ isPlaying: true, currentFrame: 0 });

    // Simple animation cycle (no actual frames, just visual feedback)
    setTimeout(() => {
      setBaselineState({ isPlaying: false, currentFrame: 0 });
    }, 500);
  };

  // Play attribute effect animation
  const playAttributeEffect = (attributeId: string) => {
    const attribute = attributes.find(a => a.attributeId === attributeId);
    if (!attribute || !attribute.effectFrames || attributeStates[attributeId]?.isPlaying) {
      return;
    }

    // Start animation
    setAttributeStates(prev => ({
      ...prev,
      [attributeId]: { isPlaying: true, currentFrame: 0 }
    }));

    // Animate through frames
    const frameCount = attribute.effectFrames.length;
    let currentFrame = 0;

    const interval = setInterval(() => {
      currentFrame++;
      if (currentFrame >= frameCount) {
        clearInterval(interval);
        setAttributeStates(prev => ({
          ...prev,
          [attributeId]: { isPlaying: false, currentFrame: 0 }
        }));
      } else {
        setAttributeStates(prev => ({
          ...prev,
          [attributeId]: { isPlaying: true, currentFrame }
        }));
      }
    }, 100); // 10 FPS
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Combat Attributes</h2>

      <div className={styles.attributeGrid}>
        {/* Baseline Attack */}
        <div className={styles.attributeCard}>
          <h3 className={styles.attributeName}>
            {baselineAttackType === 'melee' ? 'Melee Attack' : 'Ranged Attack'}
          </h3>
          <div className={styles.attributeType}>Baseline</div>

          <div className={styles.spriteContainer}>
            <img
              src={`data:image/png;base64,${creatureSprite}`}
              alt="Creature sprite"
              className={`${styles.creatureSprite} ${baselineState.isPlaying ? styles.attacking : ''}`}
              style={{
                imageRendering: 'pixelated',
                width: '128px',
                height: '128px'
              }}
            />
          </div>

          <button
            onClick={playBaselineAttack}
            disabled={baselineState.isPlaying}
            className={styles.playButton}
          >
            {baselineState.isPlaying ? 'Attacking...' : 'Play Attack'}
          </button>
        </div>

        {/* Special Attributes */}
        {attributes.map((attr) => {
          const state = attributeStates[attr.attributeId] || { isPlaying: false, currentFrame: 0 };
          const hasEffectFrames = attr.effectFrames && attr.effectFrames.length > 0;

          return (
            <div key={attr.attributeId} className={styles.attributeCard}>
              <h3 className={styles.attributeName}>{attr.name}</h3>
              <div className={styles.attributeType}>
                {attr.damageType} • {attr.category}
              </div>

              <div className={styles.spriteContainer}>
                {/* Creature sprite */}
                <img
                  src={`data:image/png;base64,${creatureSprite}`}
                  alt="Creature sprite"
                  className={styles.creatureSprite}
                  style={{
                    imageRendering: 'pixelated',
                    width: '128px',
                    height: '128px'
                  }}
                />

                {/* Effect overlay (when playing) */}
                {hasEffectFrames && state.isPlaying && (
                  <img
                    src={`data:image/png;base64,${attr.effectFrames![state.currentFrame]}`}
                    alt={`${attr.name} effect`}
                    className={styles.effectOverlay}
                    style={{
                      imageRendering: 'pixelated',
                      width: '128px',
                      height: '128px',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      mixBlendMode: 'screen' // Magical glow effect
                    }}
                  />
                )}
              </div>

              <button
                onClick={() => playAttributeEffect(attr.attributeId)}
                disabled={!hasEffectFrames || state.isPlaying}
                className={styles.playButton}
              >
                {!hasEffectFrames
                  ? 'No Effect'
                  : state.isPlaying
                    ? 'Playing...'
                    : 'Play Effect'}
              </button>

              {hasEffectFrames && (
                <div className={styles.effectInfo}>
                  Frame: {state.currentFrame + 1}/{attr.effectFrames!.length}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CombatAttributeDisplay;
