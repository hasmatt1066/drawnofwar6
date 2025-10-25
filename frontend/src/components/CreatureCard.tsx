/**
 * CreatureCard Component
 *
 * Displays a creature card in the gallery grid with:
 * - Creature sprite image
 * - Creature name
 * - Primary combat abilities (top 2-3)
 * - Click handler to view full details
 */

import React from 'react';
import type { SerializedCreatureDocument } from '@shared/types/creature-storage';
import './CreatureCard.css';

export interface CreatureCardProps {
  creature: SerializedCreatureDocument;
  onClick?: (creature: SerializedCreatureDocument) => void;
}

export const CreatureCard: React.FC<CreatureCardProps> = ({ creature, onClick }) => {
  const handleClick = () => {
    onClick?.(creature);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.(creature);
    }
  };

  // Get the menu sprite (main display sprite)
  const spriteUrl = creature.sprites.menuSprite;

  // Get top 3 combat attributes for display
  const topAbilities = creature.combatAttributes.slice(0, 3);

  // Format creation date
  const createdDate = new Date(creature.createdAt).toLocaleDateString();

  return (
    <div
      className="creature-card"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`View details for ${creature.name}`}
    >
      {/* Sprite Image */}
      <div className="creature-card__image-container">
        <img
          src={spriteUrl}
          alt={creature.name}
          className="creature-card__image"
          loading="lazy"
          onError={(e) => {
            // Fallback for failed image loads
            const target = e.target as HTMLImageElement;
            target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" height="64"%3E%3Crect width="64" height="64" fill="%23ccc"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23666" font-size="12"%3E?%3C/text%3E%3C/svg%3E';
          }}
        />
      </div>

      {/* Creature Info */}
      <div className="creature-card__content">
        <h3 className="creature-card__name">{creature.name}</h3>

        {/* Combat Attributes */}
        {topAbilities.length > 0 && (
          <div className="creature-card__abilities">
            {topAbilities.map((attr) => (
              <span
                key={attr.attributeId}
                className="creature-card__ability"
                title={`${attr.category} - ${attr.attackType}`}
              >
                {attr.name}
              </span>
            ))}
          </div>
        )}

        {/* Metadata */}
        <div className="creature-card__metadata">
          <span className="creature-card__race">{creature.race}</span>
          <span className="creature-card__class">{creature.class}</span>
          <span className="creature-card__date">{createdDate}</span>
        </div>
      </div>
    </div>
  );
};
