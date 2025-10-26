/**
 * Creature Animation Studio
 *
 * Development page for refining creature animations and abilities.
 * Allows testing movement animations, combat attributes, and ability effects.
 */

import React, { useState, useEffect, useRef } from 'react';
import styles from './CreatureAnimationStudio.module.css';
import { DirectionalAnimationStudio } from '../components/DirectionalAnimationStudio';
import { getCreatureLibraryService } from '../services/creatureLibraryService';
import { showNotification } from '../utils/notifications';

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

interface DirectionalSprite {
  sprite: string;
  walkFrames: string[];
}

interface BattlefieldDirectionalViews {
  E: DirectionalSprite;
  NE: DirectionalSprite;
  SE: DirectionalSprite;
}

interface CreatureData {
  spriteImageBase64: string;
  walkFrames?: string[];
  battlefieldSprite?: string;
  battlefieldWalkFrames?: string[];
  battlefieldDirectionalViews?: BattlefieldDirectionalViews;
  viewAngles?: {
    menu: 'side';
    battlefield?: 'low top-down';
  };
  combatAttributes?: {
    attributes: CombatAttribute[];
  };
  baselineAttackType?: 'melee' | 'ranged';
  claudeAnalysis?: {
    concept: string;
    race: string;
    class: string;
  };
}

type AnimationState = 'idle' | 'walk' | 'ability';
type ViewAngle = 'menu' | 'battlefield';

export default function CreatureAnimationStudio() {
  const [creatureData, setCreatureData] = useState<CreatureData | null>(null);
  const [animationState, setAnimationState] = useState<AnimationState>('idle');
  const [selectedAbility, setSelectedAbility] = useState<number>(0);
  const [selectedView, setSelectedView] = useState<ViewAngle>('battlefield');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [jobId, setJobId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState<'unsaved' | 'saving' | 'saved'>('unsaved');
  const [savedCreatureId, setSavedCreatureId] = useState<string | null>(null);

  const intervalRef = useRef<NodeJS.Timeout>();
  const libraryService = getCreatureLibraryService();

  // Load creature from completed generation job
  const loadCreature = async () => {
    if (!jobId.trim()) {
      setError('Please enter a job ID');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/generate/${jobId}`);

      if (!response.ok) {
        throw new Error('Failed to load creature');
      }

      const data = await response.json();

      if (data.status !== 'completed') {
        throw new Error(`Job is ${data.status}, not completed`);
      }

      setCreatureData(data.result);
      setAnimationState('idle');
      setSelectedAbility(0);
      setCurrentFrame(0);
    } catch (err: any) {
      setError(err.message || 'Failed to load creature');
    } finally {
      setLoading(false);
    }
  };

  // Check if job is already saved when creature loads
  useEffect(() => {
    if (jobId && creatureData) {
      libraryService.checkJobSaved(jobId)
        .then(result => {
          if (result.saved) {
            setSaveStatus('saved');
            setSavedCreatureId(result.creatureId || null);
          } else {
            setSaveStatus('unsaved');
            setSavedCreatureId(null);
          }
        })
        .catch(err => {
          console.error('Failed to check save status:', err);
          // Default to unsaved on error
          setSaveStatus('unsaved');
        });
    }
  }, [jobId, creatureData, libraryService]);

  // Save creature to gallery
  const handleSaveToGallery = async () => {
    if (!jobId) {
      showNotification('error', 'No job ID available');
      return;
    }

    setSaveStatus('saving');
    try {
      const result = await libraryService.saveCreature({
        jobId,
        ownerId: 'demo-player1'
      });

      setSaveStatus('saved');
      setSavedCreatureId(result.creatureId);
      showNotification('success', `Creature saved to gallery! ID: ${result.creatureId}`);
    } catch (error) {
      setSaveStatus('unsaved');
      showNotification('error', 'Failed to save creature to gallery');
      console.error('Save error:', error);
    }
  };

  // Animation playback
  useEffect(() => {
    if (!isPlaying || !creatureData) return;

    const frames = getFramesForCurrentState();
    if (!frames || frames.length === 0) return;

    intervalRef.current = setInterval(() => {
      setCurrentFrame(prev => (prev + 1) % frames.length);
    }, 100); // 10 FPS

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, animationState, selectedAbility, selectedView, creatureData]);

  const getFramesForCurrentState = (): string[] => {
    if (!creatureData) return [];

    const useMenuView = selectedView === 'menu';

    console.log('[getFrames] State:', animationState, 'View:', selectedView, 'useMenuView:', useMenuView);
    console.log('[getFrames] Has battlefield sprite:', !!creatureData.battlefieldSprite);
    if (creatureData.battlefieldSprite) {
      console.log('[getFrames] Battlefield sprite length:', creatureData.battlefieldSprite.length);
      console.log('[getFrames] Menu sprite length:', creatureData.spriteImageBase64.length);
    }

    switch (animationState) {
      case 'idle':
        if (useMenuView) {
          console.log('[getFrames] Returning menu sprite (side view)');
          return [creatureData.spriteImageBase64];
        } else {
          const sprite = creatureData.battlefieldSprite || creatureData.spriteImageBase64;
          console.log('[getFrames] Returning battlefield sprite, length:', sprite.length);
          return [sprite];
        }

      case 'walk':
        const walkFrames = useMenuView
          ? creatureData.walkFrames
          : (creatureData.battlefieldWalkFrames || creatureData.walkFrames);
        return walkFrames || [creatureData.spriteImageBase64];

      case 'ability':
        const ability = creatureData.combatAttributes?.attributes[selectedAbility];
        return ability?.effectFrames || [];

      default:
        return [creatureData.spriteImageBase64];
    }
  };

  const getCurrentDisplayImage = (): string => {
    const frames = getFramesForCurrentState();
    if (frames.length === 0) return '';

    const frame = frames[currentFrame % frames.length];
    return frame || '';
  };

  const togglePlayback = () => {
    setIsPlaying(!isPlaying);
    if (!isPlaying) {
      setCurrentFrame(0); // Reset to first frame when starting
    }
  };

  const handleStateChange = (state: AnimationState) => {
    setAnimationState(state);
    setIsPlaying(false);
    setCurrentFrame(0);
  };

  if (!creatureData) {
    return (
      <div className={styles.container}>
        <div className={styles.loadPanel}>
          <h1>Creature Animation Studio</h1>
          <p className={styles.subtitle}>
            Load a generated creature to test animations and abilities
          </p>

          <div className={styles.loadForm}>
            <label>
              Job ID (from generation):
              <input
                type="text"
                value={jobId}
                onChange={(e) => setJobId(e.target.value)}
                placeholder="Enter job ID (e.g., 72, 73)"
                className={styles.input}
              />
            </label>

            <button
              onClick={loadCreature}
              disabled={loading}
              className={styles.loadButton}
            >
              {loading ? 'Loading...' : 'Load Creature'}
            </button>

            {error && <div className={styles.error}>{error}</div>}
          </div>

          <div className={styles.hints}>
            <h3>How to get a Job ID:</h3>
            <ol>
              <li>Generate a creature on the main page</li>
              <li>Look at the network tab or console for the job ID</li>
              <li>Or check the URL during generation</li>
              <li>Paste the job ID here to load the creature</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  const frames = getFramesForCurrentState();
  const abilities = creatureData.combatAttributes?.attributes || [];

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Creature Animation Studio</h1>
        <div className={styles.headerButtons}>
          <button
            onClick={handleSaveToGallery}
            disabled={saveStatus !== 'unsaved'}
            className={`${styles.saveButton} ${saveStatus === 'saved' ? styles.savedButton : ''}`}
          >
            {saveStatus === 'unsaved' && 'Add to Gallery'}
            {saveStatus === 'saving' && 'Saving...'}
            {saveStatus === 'saved' && 'Saved ✓'}
          </button>
          <button
            onClick={() => setCreatureData(null)}
            className={styles.newCreatureButton}
          >
            Load Different Creature
          </button>
        </div>
      </header>

      <div className={styles.content}>
        {/* Left Panel: Controls */}
        <div className={styles.controlPanel}>
          <section className={styles.section}>
            <h2>Creature Info</h2>
            {creatureData.claudeAnalysis && (
              <div className={styles.info}>
                <p><strong>Concept:</strong> {creatureData.claudeAnalysis.concept}</p>
                <p><strong>Race:</strong> {creatureData.claudeAnalysis.race}</p>
                <p><strong>Class:</strong> {creatureData.claudeAnalysis.class}</p>
                {creatureData.baselineAttackType && (
                  <p><strong>Attack Type:</strong> {creatureData.baselineAttackType}</p>
                )}
              </div>
            )}
          </section>

          <section className={styles.section}>
            <h2>Animation State</h2>
            <div className={styles.stateButtons}>
              <button
                onClick={() => handleStateChange('idle')}
                className={animationState === 'idle' ? styles.active : ''}
              >
                Idle (Base Sprite)
              </button>
              <button
                onClick={() => handleStateChange('walk')}
                className={animationState === 'walk' ? styles.active : ''}
                disabled={!creatureData.walkFrames}
              >
                Walk Animation
                {creatureData.walkFrames && (
                  <span className={styles.badge}>{creatureData.walkFrames.length} frames</span>
                )}
              </button>
              <button
                onClick={() => handleStateChange('ability')}
                className={animationState === 'ability' ? styles.active : ''}
                disabled={abilities.length === 0}
              >
                Ability Effects
                {abilities.length > 0 && (
                  <span className={styles.badge}>{abilities.length} abilities</span>
                )}
              </button>
            </div>
          </section>

          <section className={styles.section}>
            <h2>View Angle</h2>
            <div className={styles.stateButtons}>
              <button
                onClick={() => setSelectedView('menu')}
                className={selectedView === 'menu' ? styles.active : ''}
              >
                Menu View (Side)
              </button>
              <button
                onClick={() => setSelectedView('battlefield')}
                className={selectedView === 'battlefield' ? styles.active : ''}
                disabled={!creatureData.battlefieldSprite}
              >
                Battlefield View (Low Top-Down)
                {creatureData.battlefieldSprite && (
                  <span className={styles.badge}>✓</span>
                )}
              </button>
            </div>
            {creatureData.viewAngles && (
              <div className={styles.modeDescription}>
                {selectedView === 'menu' && 'Side profile for menus and galleries'}
                {selectedView === 'battlefield' && 'Low top-down for hex grid deployment'}
              </div>
            )}
          </section>

          {animationState === 'ability' && abilities.length > 0 && (
            <section className={styles.section}>
              <h2>Select Ability</h2>
              <div className={styles.abilityList}>
                {abilities.map((ability, index) => (
                  <button
                    key={ability.attributeId}
                    onClick={() => {
                      setSelectedAbility(index);
                      setIsPlaying(false);
                      setCurrentFrame(0);
                    }}
                    className={selectedAbility === index ? styles.active : ''}
                  >
                    <div className={styles.abilityName}>{ability.name}</div>
                    <div className={styles.abilityDetails}>
                      {ability.damageType} • {ability.category}
                    </div>
                    {ability.effectFrames && (
                      <div className={styles.frameCount}>
                        {ability.effectFrames.length} frames
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className={styles.section}>
            <h2>Playback Controls</h2>
            <button
              onClick={togglePlayback}
              className={styles.playButton}
              disabled={frames.length === 0}
            >
              {isPlaying ? '⏸ Pause' : '▶ Play'}
            </button>

            {frames.length > 1 && (
              <div className={styles.frameInfo}>
                Frame {currentFrame + 1} / {frames.length}
              </div>
            )}

            {frames.length === 0 && (
              <div className={styles.noFrames}>
                No frames available for this state
              </div>
            )}
          </section>

          <section className={styles.section}>
            <h2>Rendering Mode</h2>
            <p className={styles.modeDescription}>
              {animationState === 'idle' && 'Displaying base sprite only'}
              {animationState === 'walk' && 'Cycling through walk animation frames'}
              {animationState === 'ability' && 'Showing ability effect overlay'}
            </p>
          </section>
        </div>

        {/* Right Panel: Visual Display */}
        <div className={styles.displayPanel}>
          <div className={styles.viewport}>
            <div className={styles.creatureDisplay}>
              {/* Display current frame based on state and view */}
              {animationState === 'idle' && (
                <img
                  key={`idle-${selectedView}`}
                  src={`data:image/png;base64,${getCurrentDisplayImage()}`}
                  alt="Creature"
                  className={styles.baseSprite}
                />
              )}

              {/* Walk animation */}
              {animationState === 'walk' && frames.length > 0 && (
                <img
                  src={`data:image/png;base64,${getCurrentDisplayImage()}`}
                  alt="Walk frame"
                  className={styles.walkFrame}
                />
              )}

              {/* Ability effect overlay */}
              {animationState === 'ability' && (
                <>
                  {/* Base sprite - show idle sprite based on selected view */}
                  <img
                    key={`ability-base-${selectedView}`}
                    src={`data:image/png;base64,${
                      selectedView === 'battlefield' && creatureData.battlefieldSprite
                        ? creatureData.battlefieldSprite
                        : creatureData.spriteImageBase64
                    }`}
                    alt="Creature base"
                    className={styles.baseSprite}
                  />
                  {/* Effect overlay */}
                  {frames.length > 0 && (
                    <img
                      key={`ability-effect-${currentFrame}`}
                      src={`data:image/png;base64,${getCurrentDisplayImage()}`}
                      alt="Ability effect"
                      className={styles.effectOverlay}
                    />
                  )}
                </>
              )}
            </div>

            <div className={styles.viewportLabel}>
              64x64px • {animationState} state • {selectedView} view
              {isPlaying && ' • Playing'}
            </div>
          </div>

          {/* State explanation */}
          <div className={styles.explanation}>
            <h3>Current State: {animationState.toUpperCase()}</h3>

            {animationState === 'idle' && (
              <p>
                This is the creature's base sprite. In the game, this would be displayed
                when the creature is standing still.
              </p>
            )}

            {animationState === 'walk' && (
              <p>
                Walk animation cycles through {frames.length} frames. In the game, this plays
                when the creature is moving across the battlefield.
              </p>
            )}

            {animationState === 'ability' && abilities[selectedAbility] && (
              <div>
                <p>
                  <strong>{abilities[selectedAbility].name}</strong> -
                  {abilities[selectedAbility].category} ability with {abilities[selectedAbility].damageType} damage.
                </p>
                <p>
                  The effect overlay uses <code>mix-blend-mode: screen</code> to create
                  a magical glow when composited over the creature sprite.
                </p>
                <p>
                  Attack Type: <strong>{abilities[selectedAbility].attackType}</strong>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Directional Animation Studio (if multi-directional views are available) */}
      {creatureData.battlefieldDirectionalViews && (
        <div style={{ marginTop: '40px', padding: '0 20px' }}>
          <DirectionalAnimationStudio
            creatureName={creatureData.claudeAnalysis?.concept || 'Unknown Creature'}
            directionalViews={creatureData.battlefieldDirectionalViews}
            spriteSize={128}
          />
        </div>
      )}
    </div>
  );
}
