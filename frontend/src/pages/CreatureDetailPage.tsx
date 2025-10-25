/**
 * CreatureDetailPage Component
 *
 * Detailed view of a single creature with:
 * - Full creature information
 * - Animated sprite viewer with directional controls
 * - Combat attributes and abilities
 * - Metadata (creation date, generation info)
 * - Navigation back to gallery
 */

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCreatureLibraryService } from '../services/creatureLibraryService';
import type { SerializedCreatureDocument } from '@shared/types/creature-storage';
import './CreatureDetailPage.css';

type Direction = 'E' | 'NE' | 'SE' | 'W' | 'NW' | 'SW';
type AnimationType = 'idle' | 'walk';

const DIRECTIONS: Direction[] = ['E', 'NE', 'SE', 'SW', 'W', 'NW'];
const ANIMATION_FPS = 8; // 8 frames per second for sprite animations

export const CreatureDetailPage: React.FC = () => {
  const { creatureId } = useParams<{ creatureId: string }>();
  const navigate = useNavigate();

  const [creature, setCreature] = useState<SerializedCreatureDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Animation state
  const [selectedDirection, setSelectedDirection] = useState<Direction>('SE');
  const [animationType, setAnimationType] = useState<AnimationType>('idle');
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentFrame, setCurrentFrame] = useState(0);

  const intervalRef = useRef<NodeJS.Timeout>();

  // Load creature data
  useEffect(() => {
    if (!creatureId) {
      setError('No creature ID provided');
      setLoading(false);
      return;
    }

    loadCreature();
  }, [creatureId]);

  const loadCreature = async () => {
    if (!creatureId) {
      setError('No creature ID provided');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const libraryService = getCreatureLibraryService();
      const creatureData = await libraryService.getCreature(creatureId);

      setCreature(creatureData);
    } catch (err) {
      console.error('Failed to load creature:', err);
      setError(err instanceof Error ? err.message : 'Failed to load creature');
    } finally {
      setLoading(false);
    }
  };

  // Animation loop
  useEffect(() => {
    if (!creature || !isPlaying) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      return;
    }

    const frames = getCurrentFrames();
    if (frames.length === 0) return;

    intervalRef.current = setInterval(() => {
      setCurrentFrame(prev => (prev + 1) % frames.length);
    }, 1000 / ANIMATION_FPS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [creature, isPlaying, animationType, selectedDirection]);

  const getCurrentFrames = (): string[] => {
    if (!creature) return [];

    // Determine if direction needs mirroring
    const isMirrored = selectedDirection === 'W' || selectedDirection === 'NW' || selectedDirection === 'SW';
    const baseDirection = isMirrored
      ? (selectedDirection === 'W' ? 'E' : selectedDirection === 'NW' ? 'NE' : 'SE')
      : selectedDirection;

    const directionData = creature.sprites.directions[baseDirection as 'E' | 'NE' | 'SE'];
    if (!directionData) return [];

    if (animationType === 'walk') {
      return directionData.walkFrames || [];
    } else {
      return directionData.idleFrames || [];
    }
  };

  const getCurrentFrame = (): string => {
    const frames = getCurrentFrames();
    if (frames.length === 0) return creature?.sprites.menuSprite || '';
    return frames[currentFrame % frames.length] || creature?.sprites.menuSprite || '';
  };

  const isMirrored = selectedDirection === 'W' || selectedDirection === 'NW' || selectedDirection === 'SW';

  const handleBackToGallery = () => {
    navigate('/gallery');
  };

  // Loading state
  if (loading) {
    return (
      <div className="creature-detail-page">
        <div className="creature-detail-page__loading">
          <div className="spinner"></div>
          <p>Loading creature...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !creature) {
    return (
      <div className="creature-detail-page">
        <div className="creature-detail-page__error">
          <h2>Error Loading Creature</h2>
          <p>{error || 'Creature not found'}</p>
          <button className="btn btn-primary" onClick={handleBackToGallery}>
            Back to Gallery
          </button>
        </div>
      </div>
    );
  }

  const createdDate = new Date(creature.createdAt).toLocaleString();
  const currentFrameUrl = getCurrentFrame();

  return (
    <div className="creature-detail-page">
      {/* Header */}
      <div className="creature-detail-page__header">
        <button className="btn-back" onClick={handleBackToGallery}>
          ← Back to Gallery
        </button>
        <h1>{creature.name}</h1>
      </div>

      <div className="creature-detail-page__content">
        {/* Left Column: Animation Viewer */}
        <div className="creature-detail-page__viewer">
          <div className="animation-viewer">
            <div className="animation-viewer__canvas">
              <img
                src={currentFrameUrl}
                alt={`${creature.name} - ${selectedDirection} ${animationType}`}
                className={`sprite-image ${isMirrored ? 'mirrored' : ''}`}
                style={{
                  imageRendering: 'pixelated'
                }}
              />
            </div>

            {/* Animation Controls */}
            <div className="animation-controls">
              <div className="control-group">
                <label>Animation:</label>
                <div className="button-group">
                  <button
                    className={`btn-control ${animationType === 'idle' ? 'active' : ''}`}
                    onClick={() => {
                      setAnimationType('idle');
                      setCurrentFrame(0);
                    }}
                  >
                    Idle
                  </button>
                  <button
                    className={`btn-control ${animationType === 'walk' ? 'active' : ''}`}
                    onClick={() => {
                      setAnimationType('walk');
                      setCurrentFrame(0);
                    }}
                  >
                    Walk
                  </button>
                </div>
              </div>

              <div className="control-group">
                <label>Direction:</label>
                <div className="direction-grid">
                  {DIRECTIONS.map(dir => (
                    <button
                      key={dir}
                      className={`btn-direction ${selectedDirection === dir ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedDirection(dir);
                        setCurrentFrame(0);
                      }}
                    >
                      {dir}
                    </button>
                  ))}
                </div>
              </div>

              <div className="control-group">
                <button
                  className="btn btn-secondary"
                  onClick={() => setIsPlaying(!isPlaying)}
                >
                  {isPlaying ? 'Pause' : 'Play'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Creature Info */}
        <div className="creature-detail-page__info">
          {/* Basic Info */}
          <div className="info-section">
            <h2>Basic Info</h2>
            <div className="info-grid">
              <div className="info-item">
                <span className="label">Race:</span>
                <span className="value">{creature.race}</span>
              </div>
              <div className="info-item">
                <span className="label">Class:</span>
                <span className="value">{creature.class}</span>
              </div>
              <div className="info-item">
                <span className="label">Concept:</span>
                <span className="value">{creature.concept}</span>
              </div>
              <div className="info-item">
                <span className="label">Created:</span>
                <span className="value">{createdDate}</span>
              </div>
            </div>
          </div>

          {/* Combat Attributes */}
          <div className="info-section">
            <h2>Combat Abilities</h2>
            <div className="abilities-list">
              {creature.combatAttributes.map((attr) => (
                <div key={attr.attributeId} className="ability-card">
                  <div className="ability-header">
                    <span className="ability-name">{attr.name}</span>
                    <span className="ability-priority">Priority: {attr.priority}</span>
                  </div>
                  <div className="ability-details">
                    <span className="badge">{attr.category}</span>
                    <span className="badge">{attr.attackType}</span>
                    <span className="badge">{attr.damageType}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Claude Analysis */}
          {creature.abilities && creature.abilities.length > 0 && (
            <div className="info-section">
              <h2>Detected Abilities</h2>
              <div className="abilities-tags">
                {creature.abilities.map((ability, index) => (
                  <span key={index} className="ability-tag">
                    {ability}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Generation Info */}
          <div className="info-section">
            <h2>Generation Info</h2>
            <div className="info-grid">
              <div className="info-item">
                <span className="label">Input Type:</span>
                <span className="value">{creature.inputType}</span>
              </div>
              {creature.textDescription && (
                <div className="info-item full-width">
                  <span className="label">Description:</span>
                  <span className="value">{creature.textDescription}</span>
                </div>
              )}
              <div className="info-item">
                <span className="label">Generation Time:</span>
                <span className="value">{(creature.generationTimeMs / 1000).toFixed(1)}s</span>
              </div>
              <div className="info-item">
                <span className="label">Job ID:</span>
                <span className="value code">{creature.generationJobId}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
