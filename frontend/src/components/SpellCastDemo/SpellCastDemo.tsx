/**
 * Spell Cast Demo Component
 *
 * Proof-of-concept for spell casting with:
 * 1. Creature sprite base
 * 2. Cast effect overlaid on caster
 * 3. Projectile traveling to enemy
 */

import React, { useState, useEffect, useRef } from 'react';
import styles from './SpellCastDemo.module.css';

interface LibraryAnimation {
  animationId: string;
  action: string;
  description: string;
  frameCount: number;
  baseSprite: string;
  frames: string[];
}

interface SpellCastDemoProps {
  casterSprite: string;           // Base64 creature sprite
  casterName?: string;
  targetSprite?: string;          // Optional enemy sprite
  targetName?: string;
}

interface Projectile {
  id: number;
  x: number;
  y: number;
  frameIndex: number;
  active: boolean;
}

export const SpellCastDemo: React.FC<SpellCastDemoProps> = ({
  casterSprite,
  casterName = 'Caster',
  targetSprite,
  targetName = 'Enemy'
}) => {
  const [castEffect, setCastEffect] = useState<LibraryAnimation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCasting, setIsCasting] = useState(false);
  const [castFrame, setCastFrame] = useState(0);
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const projectileIdRef = useRef(0);

  // Positions
  const CASTER_X = 100;
  const CASTER_Y = 200;
  const TARGET_X = 500;
  const TARGET_Y = 200;
  const SPRITE_SIZE = 128; // Display size (upscaled from 64px)

  // Load cast_spell_default effect
  useEffect(() => {
    loadCastEffect();
  }, []);

  const loadCastEffect = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/library-animations/cast_spell_default');
      const data: LibraryAnimation = await response.json();
      setCastEffect(data);
    } catch (error) {
      console.error('Failed to load cast effect:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Cast spell animation (4 frames at casting position)
  useEffect(() => {
    if (!isCasting || !castEffect) return;

    const interval = setInterval(() => {
      setCastFrame((prev) => {
        const nextFrame = prev + 1;
        if (nextFrame >= castEffect.frames.length) {
          // Casting animation complete, spawn projectile
          spawnProjectile();
          setIsCasting(false);
          return 0;
        }
        return nextFrame;
      });
    }, 100); // 10 FPS

    return () => clearInterval(interval);
  }, [isCasting, castEffect]);

  // Projectile movement
  useEffect(() => {
    if (projectiles.length === 0) return;

    const interval = setInterval(() => {
      setProjectiles((prev) =>
        prev.map((proj) => {
          if (!proj.active) return proj;

          // Move projectile toward target
          const dx = TARGET_X - proj.x;
          const dy = TARGET_Y - proj.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 10) {
            // Hit target
            return { ...proj, active: false };
          }

          // Move projectile (5 pixels per frame)
          const speed = 5;
          const moveX = (dx / distance) * speed;
          const moveY = (dy / distance) * speed;

          // Advance animation frame
          const nextFrame = castEffect
            ? (proj.frameIndex + 1) % castEffect.frames.length
            : 0;

          return {
            ...proj,
            x: proj.x + moveX,
            y: proj.y + moveY,
            frameIndex: nextFrame
          };
        }).filter((proj) => proj.active) // Remove inactive projectiles
      );
    }, 50); // 20 FPS for smooth movement

    return () => clearInterval(interval);
  }, [projectiles, castEffect]);

  const spawnProjectile = () => {
    if (!castEffect) return;

    const newProjectile: Projectile = {
      id: projectileIdRef.current++,
      x: CASTER_X + SPRITE_SIZE / 2,
      y: CASTER_Y + SPRITE_SIZE / 2,
      frameIndex: 0,
      active: true
    };

    setProjectiles((prev) => [...prev, newProjectile]);
  };

  const handleCastSpell = () => {
    if (isCasting || !castEffect) return;
    setIsCasting(true);
    setCastFrame(0);
  };

  if (isLoading) {
    return <div className={styles.loading}>Loading spell effect...</div>;
  }

  if (!castEffect) {
    return <div className={styles.error}>Failed to load spell effect</div>;
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Spell Cast Demo: {castEffect.action}</h2>

      <div className={styles.controls}>
        <button
          onClick={handleCastSpell}
          disabled={isCasting}
          className={styles.castButton}
        >
          {isCasting ? 'Casting...' : 'Cast Spell'}
        </button>
        <div className={styles.info}>
          Effect: {castEffect.animationId} ({castEffect.frameCount} frames)
        </div>
      </div>

      <div className={styles.battleField}>
        {/* Caster */}
        <div
          className={styles.character}
          style={{
            left: `${CASTER_X}px`,
            top: `${CASTER_Y}px`
          }}
        >
          {/* Base creature sprite */}
          <img
            src={`data:image/png;base64,${casterSprite}`}
            alt={casterName}
            className={styles.creatureSprite}
            style={{
              width: `${SPRITE_SIZE}px`,
              height: `${SPRITE_SIZE}px`,
              imageRendering: 'pixelated'
            }}
          />

          {/* Cast effect overlay (while casting) */}
          {isCasting && (
            <img
              src={`data:image/png;base64,${castEffect.frames[castFrame]}`}
              alt="Cast effect"
              className={styles.effectOverlay}
              style={{
                width: `${SPRITE_SIZE}px`,
                height: `${SPRITE_SIZE}px`,
                imageRendering: 'pixelated',
                position: 'absolute',
                top: 0,
                left: 0,
                mixBlendMode: 'screen' // Magical glow effect
              }}
            />
          )}

          <div className={styles.nameTag}>{casterName}</div>
        </div>

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
              className={styles.creatureSprite}
              style={{
                width: `${SPRITE_SIZE}px`,
                height: `${SPRITE_SIZE}px`,
                imageRendering: 'pixelated'
              }}
            />
            <div className={styles.nameTag}>{targetName}</div>
          </div>
        )}

        {/* Projectiles */}
        {projectiles.map((proj) => (
          <img
            key={proj.id}
            src={`data:image/png;base64,${castEffect.frames[proj.frameIndex]}`}
            alt="Spell projectile"
            className={styles.projectile}
            style={{
              left: `${proj.x - 32}px`,
              top: `${proj.y - 32}px`,
              width: '64px',
              height: '64px',
              imageRendering: 'pixelated',
              position: 'absolute',
              mixBlendMode: 'screen'
            }}
          />
        ))}
      </div>

      <div className={styles.debug}>
        <h3>Debug Info:</h3>
        <div>Casting: {isCasting ? 'Yes' : 'No'}</div>
        <div>Cast Frame: {castFrame + 1}/{castEffect.frames.length}</div>
        <div>Active Projectiles: {projectiles.length}</div>
        <div>Blend Mode: screen (magical glow)</div>
      </div>
    </div>
  );
};

export default SpellCastDemo;
