/**
 * Generation Progress Component
 *
 * Displays real-time progress of creature generation:
 * - Queued → Processing → Complete/Failed
 * - Progress bar (0-100%)
 * - Status messages
 * - Final result display
 */

import React, { useEffect, useState } from 'react';
import { pollJobStatus, type JobStatus, type GenerationResult } from '@/services/generationService';
import { AnimationDebugger } from '@/components/AnimationDebugger';
import { SpellCastDemo } from '@/components/SpellCastDemo';
import { MeleeAttackDemo } from '@/components/MeleeAttackDemo';
import styles from './GenerationProgress.module.css';

interface GenerationProgressProps {
  jobId: string;
  onComplete?: (result: GenerationResult) => void;
  onError?: (error: string) => void;
}

export const GenerationProgress: React.FC<GenerationProgressProps> = ({
  jobId,
  onComplete,
  onError
}) => {
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Start polling when component mounts
    const startPolling = async () => {
      try {
        const finalStatus = await pollJobStatus(
          jobId,
          (currentStatus) => {
            // Update UI with each poll
            setStatus(currentStatus);
          },
          {
            pollInterval: 2500, // 2.5 seconds
            maxAttempts: 120 // 5 minutes total
          }
        );

        // Handle final state
        if (finalStatus.status === 'completed' && finalStatus.result) {
          if (onComplete) {
            onComplete(finalStatus.result);
          }
        } else if (finalStatus.status === 'failed') {
          const errorMessage = finalStatus.error?.message || 'Generation failed';
          setError(errorMessage);
          if (onError) {
            onError(errorMessage);
          }
        }
      } catch (err: any) {
        const errorMessage = err.message || 'An unexpected error occurred';
        setError(errorMessage);
        if (onError) {
          onError(errorMessage);
        }
      }
    };

    startPolling();
  }, [jobId, onComplete, onError]);

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorCard}>
          <div className={styles.errorIcon}>❌</div>
          <h2 className={styles.errorTitle}>Generation Failed</h2>
          <p className={styles.errorMessage}>{error}</p>
          <div className={styles.errorActions}>
            <button
              className={styles.retryButton}
              onClick={() => window.location.href = '/create'}
            >
              Try Again
            </button>
            <button
              className={styles.homeButton}
              onClick={() => window.location.href = '/'}
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingCard}>
          <div className={styles.spinner}></div>
          <p className={styles.loadingText}>Connecting to generation service...</p>
        </div>
      </div>
    );
  }

  // Render different UI based on status
  if (status.status === 'completed' && status.result) {
    return (
      <div className={styles.container}>
        <div className={styles.successCard}>
          <div className={styles.successIcon}>✨</div>
          <h2 className={styles.successTitle}>Generation Complete!</h2>
          <div className={styles.resultPanel}>
            <ResultDisplay result={status.result} />
          </div>
          <div className={styles.actions}>
            <button
              className={styles.primaryButton}
              onClick={() => {
                // TODO: Navigate to creature editor or save to collection
                console.log('Save creature:', status.result);
              }}
            >
              Save Creature
            </button>
            <button
              className={styles.secondaryButton}
              onClick={() => window.location.href = '/create'}
            >
              Create Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show progress for queued/processing states
  const statusText = status.status === 'queued'
    ? 'Waiting in queue...'
    : status.message || 'Processing your creature...';

  const progressSteps = [
    { label: 'Queued', threshold: 0 },
    { label: 'Analyzing Image', threshold: 20 },
    { label: 'Mapping Animations', threshold: 40 },
    { label: 'Generating Sprite', threshold: 60 },
    { label: 'Validating Style', threshold: 90 },
    { label: 'Complete', threshold: 100 }
  ];

  const currentStep = progressSteps.findIndex(
    step => status.progress < step.threshold
  );
  const activeStepIndex = currentStep === -1 ? progressSteps.length - 1 : Math.max(0, currentStep - 1);

  return (
    <div className={styles.container}>
      <div className={styles.progressCard}>
        <h2 className={styles.title}>Creating Your Creature</h2>
        <p className={styles.statusText}>{statusText}</p>

        {/* Progress Bar */}
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${status.progress}%` }}
          >
            <span className={styles.progressText}>{status.progress}%</span>
          </div>
        </div>

        {/* Step Indicators */}
        <div className={styles.steps}>
          {progressSteps.map((step, index) => (
            <div
              key={step.label}
              className={`${styles.step} ${
                index <= activeStepIndex ? styles.stepActive : ''
              } ${index === activeStepIndex ? styles.stepCurrent : ''}`}
            >
              <div className={styles.stepIcon}>
                {index < activeStepIndex ? '✓' : index === activeStepIndex ? '⟳' : '○'}
              </div>
              <div className={styles.stepLabel}>{step.label}</div>
            </div>
          ))}
        </div>

        {/* Info Panel */}
        <div className={styles.infoPanel}>
          <p className={styles.infoText}>
            <strong>Job ID:</strong> {jobId}
          </p>
          <p className={styles.infoText}>
            This process typically takes 30-60 seconds. Your creature will have 20+ custom animations!
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * Result Display Component
 *
 * Shows the generated creature's details
 */
const ResultDisplay: React.FC<{ result: GenerationResult }> = ({ result }) => {
  // Animation frame playback
  const [currentFrame, setCurrentFrame] = React.useState(0);

  React.useEffect(() => {
    if (!result.animationFrames || result.animationFrames.length === 0) {
      return;
    }

    const interval = setInterval(() => {
      setCurrentFrame((prev) => (prev + 1) % result.animationFrames!.length);
    }, 100); // 10 FPS animation

    return () => clearInterval(interval);
  }, [result.animationFrames]);

  return (
    <div className={styles.resultContainer}>
      {/* Animated Sprite - Just shows the sprite, no controls */}
      {result.animationFrames && result.animationFrames.length > 0 ? (
        <div className={styles.resultSection}>
          <h3 className={styles.resultSectionTitle}>Your Creature</h3>
          <div className={styles.spriteDisplay}>
            <img
              src={`data:image/png;base64,${result.animationFrames[currentFrame]}`}
              alt="Animated creature sprite"
              className={styles.spriteImage}
              style={{
                imageRendering: 'pixelated',
                width: '256px',
                height: '256px',
                border: '2px solid #ddd',
                borderRadius: '8px',
                backgroundColor: '#f5f5f5'
              }}
            />
            <p style={{ marginTop: '8px', fontSize: '14px', color: '#666', textAlign: 'center' }}>
              {result.animations.totalAnimations} animations assigned
            </p>
          </div>
        </div>
      ) : result.spriteImageBase64 ? (
        <div className={styles.resultSection}>
          <h3 className={styles.resultSectionTitle}>Your Creature</h3>
          <div className={styles.spriteDisplay}>
            <img
              src={`data:image/png;base64,${result.spriteImageBase64}`}
              alt="Generated sprite"
              className={styles.spriteImage}
              style={{
                imageRendering: 'pixelated',
                width: '256px',
                height: '256px',
                border: '2px solid #ddd',
                borderRadius: '8px',
                backgroundColor: '#f5f5f5'
              }}
            />
          </div>
        </div>
      ) : null}

      {/* Creature Concept */}
      {result.claudeAnalysis && (
        <div className={styles.resultSection}>
          <h3 className={styles.resultSectionTitle}>Creature Analysis</h3>
          <div className={styles.resultGrid}>
            <div className={styles.resultItem}>
              <span className={styles.resultLabel}>Concept:</span>
              <span className={styles.resultValue}>{result.claudeAnalysis.concept}</span>
            </div>
            <div className={styles.resultItem}>
              <span className={styles.resultLabel}>Race:</span>
              <span className={styles.resultValue}>{result.claudeAnalysis.race}</span>
            </div>
            <div className={styles.resultItem}>
              <span className={styles.resultLabel}>Class:</span>
              <span className={styles.resultValue}>{result.claudeAnalysis.class}</span>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      {result.claudeAnalysis?.stats && (
        <div className={styles.resultSection}>
          <h3 className={styles.resultSectionTitle}>Stats</h3>
          <div className={styles.statsGrid}>
            <StatBar label="Health" value={result.claudeAnalysis.stats.health} max={200} />
            <StatBar label="Attack" value={result.claudeAnalysis.stats.attack} max={50} />
            <StatBar label="Defense" value={result.claudeAnalysis.stats.defense} max={30} />
            <StatBar label="Speed" value={result.claudeAnalysis.stats.speed} max={10} />
          </div>
        </div>
      )}

      {/* Admin Animation Debugger - Hidden by default, click to expand */}
      {result.animations && (
        <AnimationDebugger
          baseSprite={result.spriteImageBase64}
          walkAnimationFrames={result.animationFrames}
          animationSet={result.animations.animationSet}
          totalAnimations={result.animations.totalAnimations}
          defaultExpanded={false}
        />
      )}

      {/* Spell Cast Demo - Proof of concept for ranged effect compositing */}
      {result.spriteImageBase64 && result.animations?.totalAnimations && (
        <div className={styles.resultSection} style={{ marginTop: '30px' }}>
          <SpellCastDemo
            casterSprite={result.spriteImageBase64}
            casterName="Your Creature"
            targetSprite={result.spriteImageBase64} // Using same sprite as target for demo
            targetName="Enemy"
          />
        </div>
      )}

      {/* Melee Attack Demo - Proof of concept for melee effect compositing */}
      {result.spriteImageBase64 && result.animations?.totalAnimations && (
        <div className={styles.resultSection} style={{ marginTop: '30px' }}>
          <MeleeAttackDemo
            attackerSprite={result.spriteImageBase64}
            attackerName="Your Creature"
            targetSprite={result.spriteImageBase64} // Using same sprite as target for demo
            targetName="Enemy"
          />
        </div>
      )}

      {/* Style Validation */}
      {result.styleValidation && (
        <div className={styles.resultSection}>
          <h3 className={styles.resultSectionTitle}>Style Preservation</h3>
          <div className={styles.styleValidation}>
            <div className={styles.styleScore}>
              <span className={styles.scoreLabel}>Overall Score:</span>
              <span className={`${styles.scoreValue} ${result.styleValidation.passed ? styles.scorePassed : styles.scoreFailed}`}>
                {Math.round(result.styleValidation.overallScore * 100)}%
              </span>
            </div>
            <p className={styles.styleFeedback}>{result.styleValidation.feedback}</p>
          </div>
        </div>
      )}

      {/* Processing Time */}
      <div className={styles.resultSection}>
        <p className={styles.processingTime}>
          Generated in {(result.processingTimeMs / 1000).toFixed(1)} seconds
        </p>
      </div>
    </div>
  );
};

/**
 * Stat Bar Component
 */
const StatBar: React.FC<{ label: string; value: number; max: number }> = ({ label, value, max }) => {
  const percentage = Math.min((value / max) * 100, 100);

  return (
    <div className={styles.statBar}>
      <div className={styles.statHeader}>
        <span className={styles.statLabel}>{label}</span>
        <span className={styles.statValue}>{value}</span>
      </div>
      <div className={styles.statTrack}>
        <div
          className={styles.statFill}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
};
