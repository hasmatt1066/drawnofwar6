/**
 * Melee Attack Demo Component
 *
 * Proof-of-concept for melee attacks with:
 * 1. Creature sprite base
 * 2. Melee effect overlaid in front of attacker
 * 3. No projectile - effect plays once on/near character
 * 4. Target flashes when hit
 */

import React, { useState, useEffect } from 'react';
import styles from './MeleeAttackDemo.module.css';

interface LibraryAnimation {
  animationId: string;
  action: string;
  description: string;
  frameCount: number;
  baseSprite: string;
  frames: string[];
}

interface MeleeAttackDemoProps {
  attackerSprite: string;         // Base64 creature sprite
  attackerName?: string;
  targetSprite?: string;          // Optional enemy sprite
  targetName?: string;
}

export const MeleeAttackDemo: React.FC<MeleeAttackDemoProps> = ({
  attackerSprite,
  attackerName = 'Warrior',
  targetSprite,
  targetName = 'Enemy'
}) => {
  const [meleeEffect, setMeleeEffect] = useState<LibraryAnimation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAttacking, setIsAttacking] = useState(false);
  const [attackFrame, setAttackFrame] = useState(0);
  const [targetHit, setTargetHit] = useState(false);

  // Positions
  const ATTACKER_X = 100;
  const ATTACKER_Y = 200;
  const TARGET_X = 350;
  const TARGET_Y = 200;
  const SPRITE_SIZE = 128; // Display size (upscaled from 64px)

  // Melee effect positioned in front of attacker (between attacker and target)
  const EFFECT_OFFSET_X = 80; // Effect appears 80px to the right of attacker
  const EFFECT_OFFSET_Y = 0;   // Same vertical position

  // Load attack_melee_sword effect
  useEffect(() => {
    loadMeleeEffect();
  }, []);

  const loadMeleeEffect = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/library-animations/attack_melee_sword');
      const data: LibraryAnimation = await response.json();
      setMeleeEffect(data);
    } catch (error) {
      console.error('Failed to load melee effect:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Melee attack animation (4 frames, then hit target)
  useEffect(() => {
    if (!isAttacking || !meleeEffect) return;

    const interval = setInterval(() => {
      setAttackFrame((prev) => {
        const nextFrame = prev + 1;

        // On frame 3 (peak of swing), trigger target hit
        if (nextFrame === 3) {
          triggerTargetHit();
        }

        if (nextFrame >= meleeEffect.frames.length) {
          // Attack animation complete
          setIsAttacking(false);
          return 0;
        }
        return nextFrame;
      });
    }, 100); // 10 FPS

    return () => clearInterval(interval);
  }, [isAttacking, meleeEffect]);

  const triggerTargetHit = () => {
    setTargetHit(true);
    // Flash target for 200ms
    setTimeout(() => {
      setTargetHit(false);
    }, 200);
  };

  const handleAttack = () => {
    if (isAttacking || !meleeEffect) return;
    setIsAttacking(true);
    setAttackFrame(0);
  };

  if (isLoading) {
    return <div className={styles.loading}>Loading melee effect...</div>;
  }

  if (!meleeEffect) {
    return <div className={styles.error}>Failed to load melee effect</div>;
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Melee Attack Demo: {meleeEffect.action}</h2>

      <div className={styles.controls}>
        <button
          onClick={handleAttack}
          disabled={isAttacking}
          className={styles.attackButton}
        >
          {isAttacking ? 'Attacking...' : 'Attack!'}
        </button>
        <div className={styles.info}>
          Effect: {meleeEffect.animationId} ({meleeEffect.frameCount} frames)
        </div>
      </div>

      <div className={styles.battleField}>
        {/* Attacker */}
        <div
          className={styles.character}
          style={{
            left: `${ATTACKER_X}px`,
            top: `${ATTACKER_Y}px`
          }}
        >
          {/* Base creature sprite */}
          <img
            src={`data:image/png;base64,${attackerSprite}`}
            alt={attackerName}
            className={styles.creatureSprite}
            style={{
              width: `${SPRITE_SIZE}px`,
              height: `${SPRITE_SIZE}px`,
              imageRendering: 'pixelated'
            }}
          />

          <div className={styles.nameTag}>{attackerName}</div>
        </div>

        {/* Melee effect (positioned in front of attacker) */}
        {isAttacking && (
          <img
            src={`data:image/png;base64,${meleeEffect.frames[attackFrame]}`}
            alt="Sword slash"
            className={styles.meleeEffect}
            style={{
              left: `${ATTACKER_X + EFFECT_OFFSET_X}px`,
              top: `${ATTACKER_Y + EFFECT_OFFSET_Y}px`,
              width: `${SPRITE_SIZE}px`,
              height: `${SPRITE_SIZE}px`,
              imageRendering: 'pixelated',
              position: 'absolute',
              mixBlendMode: 'screen', // Bright slash effect
              zIndex: 10
            }}
          />
        )}

        {/* Target (if provided) */}
        {targetSprite && (
          <div
            className={styles.character}
            style={{
              left: `${TARGET_X}px`,
              top: `${TARGET_Y}px`
            }}
          >
            <img
              src={`data:image/png;base64,${targetSprite}`}
              alt={targetName}
              className={`${styles.creatureSprite} ${targetHit ? styles.hitFlash : ''}`}
              style={{
                width: `${SPRITE_SIZE}px`,
                height: `${SPRITE_SIZE}px`,
                imageRendering: 'pixelated'
              }}
            />
            <div className={styles.nameTag}>{targetName}</div>
          </div>
        )}
      </div>

      <div className={styles.debug}>
        <h3>Debug Info:</h3>
        <div>Attacking: {isAttacking ? 'Yes' : 'No'}</div>
        <div>Attack Frame: {attackFrame + 1}/{meleeEffect.frames.length}</div>
        <div>Effect Position: {ATTACKER_X + EFFECT_OFFSET_X}px, {ATTACKER_Y + EFFECT_OFFSET_Y}px</div>
        <div>Target Hit: {targetHit ? 'YES' : 'No'}</div>
        <div>Blend Mode: screen (bright slash)</div>
        <div className={styles.note}>
          <strong>Melee vs Ranged:</strong><br/>
          • Melee: Effect plays in front of attacker, no projectile<br/>
          • Ranged: Effect spawns projectile that travels to target<br/>
          • Hit triggers on frame 3 (peak of swing)
        </div>
      </div>
    </div>
  );
};

export default MeleeAttackDemo;
