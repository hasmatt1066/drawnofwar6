/**
 * Creature Roster Component
 *
 * Displays a list of available creatures that can be dragged onto the deployment grid.
 * Supports mouse and touch drag interactions.
 */

import React from 'react';
import type { DeploymentCreature } from '@drawn-of-war/shared';
import styles from './CreatureRoster.module.css';

export interface CreatureRosterProps {
  /** List of creatures available for deployment */
  creatures: DeploymentCreature[];
  /** Creatures already placed on grid (to show as unavailable) */
  placedCreatureIds: string[];
  /** Callback when drag starts */
  onDragStart: (creature: DeploymentCreature, event: React.DragEvent | React.TouchEvent) => void;
  /** Callback when drag ends */
  onDragEnd: (event: React.DragEvent | React.TouchEvent) => void;
  /** Whether roster is locked (deployment finalized) */
  isLocked?: boolean;
  /** Player ID for styling */
  playerId: 'player1' | 'player2';
}

export const CreatureRoster: React.FC<CreatureRosterProps> = ({
  creatures,
  placedCreatureIds,
  onDragStart,
  onDragEnd,
  isLocked = false,
  playerId
}) => {
  const [draggedCreatureId, setDraggedCreatureId] = React.useState<string | null>(null);

  // Handle mouse drag start
  const handleDragStart = (creature: DeploymentCreature, event: React.DragEvent) => {
    if (isLocked || placedCreatureIds.includes(creature.id)) {
      event.preventDefault();
      return;
    }

    setDraggedCreatureId(creature.id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', creature.id);

    // Set drag image (the creature card itself)
    if (event.currentTarget instanceof HTMLElement) {
      event.dataTransfer.setDragImage(event.currentTarget, 50, 50);
    }

    onDragStart(creature, event);
  };

  // Handle mouse drag end
  const handleDragEndMouse = (event: React.DragEvent) => {
    setDraggedCreatureId(null);
    onDragEnd(event);
  };

  // Handle touch start
  const handleTouchStart = (creature: DeploymentCreature, event: React.TouchEvent) => {
    if (isLocked || placedCreatureIds.includes(creature.id)) {
      return;
    }

    const touch = event.touches[0];
    if (!touch) return;

    setDraggedCreatureId(creature.id);

    // Start drag after a short delay (long press simulation)
    setTimeout(() => {
      if (draggedCreatureId === creature.id) {
        onDragStart(creature, event);
      }
    }, 200);
  };

  // Handle touch end
  const handleTouchEnd = (event: React.TouchEvent) => {
    setDraggedCreatureId(null);
    onDragEnd(event);
  };

  const isPlaced = (creatureId: string) => placedCreatureIds.includes(creatureId);
  const isDragging = (creatureId: string) => draggedCreatureId === creatureId;

  return (
    <div className={`${styles.roster} ${styles[playerId]}`}>
      <div className={styles.header}>
        <h3 className={styles.title}>
          {playerId === 'player1' ? 'Your Creatures' : 'Enemy Creatures'}
        </h3>
        <div className={styles.counter}>
          {placedCreatureIds.length} / {creatures.length} placed
        </div>
      </div>

      <div className={styles.creatureList}>
        {creatures.map(creature => (
          <div
            key={creature.id}
            className={`
              ${styles.creatureCard}
              ${isPlaced(creature.id) ? styles.placed : ''}
              ${isDragging(creature.id) ? styles.dragging : ''}
              ${isLocked ? styles.locked : ''}
            `}
            draggable={!isLocked && !isPlaced(creature.id)}
            onDragStart={(e) => handleDragStart(creature, e)}
            onDragEnd={handleDragEndMouse}
            onTouchStart={(e) => handleTouchStart(creature, e)}
            onTouchEnd={handleTouchEnd}
          >
            <div className={styles.creatureSprite}>
              {/* Render actual sprite or fallback */}
              {creature.spriteLoading ? (
                <div className={styles.spriteLoading}>
                  <div className={styles.spinner}></div>
                </div>
              ) : creature.spriteError ? (
                <div className={styles.spriteError}>
                  {creature.name.charAt(0).toUpperCase()}
                </div>
              ) : creature.sprite && (creature.sprite.startsWith('data:') || creature.sprite.startsWith('http')) ? (
                <img
                  src={creature.sprite}
                  alt={creature.name}
                  className={styles.spriteImage}
                />
              ) : (
                <div className={styles.spritePlaceholder}>
                  {creature.sprite || creature.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div className={styles.creatureInfo}>
              <div className={styles.creatureName}>{creature.name}</div>
              {creature.stats && (
                <div className={styles.creatureStats}>
                  {creature.stats.health && (
                    <span className={styles.stat}>
                      ❤️ {creature.stats.health}
                    </span>
                  )}
                  {creature.stats.attack && (
                    <span className={styles.stat}>
                      ⚔️ {creature.stats.attack}
                    </span>
                  )}
                  {creature.stats.defense && (
                    <span className={styles.stat}>
                      🛡️ {creature.stats.defense}
                    </span>
                  )}
                </div>
              )}
            </div>

            {isPlaced(creature.id) && (
              <div className={styles.placedBadge}>Deployed</div>
            )}
          </div>
        ))}
      </div>

      {isLocked && (
        <div className={styles.lockedOverlay}>
          <div className={styles.lockedMessage}>
            🔒 Deployment Locked
          </div>
        </div>
      )}
    </div>
  );
};

export default CreatureRoster;
