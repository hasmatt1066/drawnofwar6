/**
 * View Angle Test Page
 *
 * UI for testing different camera angles to determine which works best
 * for isometric battlefield display. Compares side, low top-down, and
 * high top-down views with both base sprites and walk animations.
 *
 * Route: /test-view-angles
 */

import React, { useState } from 'react';
import styles from './ViewAngleTestPage.module.css';

interface ViewResult {
  view: string;
  baseSprite: string; // base64
  animationFrames: string[]; // base64 array
  costUsd: number;
  timeMs: number;
}

interface TestResponse {
  description: string;
  results: ViewResult[];
  totalCost: number;
  totalTime: number;
  error?: {
    message: string;
    failedView: string;
  };
}

export const ViewAngleTestPage: React.FC = () => {
  const [description, setDescription] = useState('fierce red dragon warrior with wings and horns');
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<TestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentFrame, setCurrentFrame] = useState<{ [view: string]: number }>({});

  const handleGenerate = async () => {
    if (!description.trim()) {
      setError('Please enter a creature description');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setResults(null);
    setCurrentFrame({});

    try {
      console.log('[View Angle Test] Submitting request...');
      const response = await fetch('/api/test/view-angles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description,
          size: 64,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate view angles');
      }

      const data: TestResponse = await response.json();
      console.log('[View Angle Test] Results received:', data);

      setResults(data);

      // Initialize frame indices for animation
      const initialFrames: { [view: string]: number } = {};
      data.results.forEach((result) => {
        initialFrames[result.view] = 0;
      });
      setCurrentFrame(initialFrames);

      // Show warning if partial success
      if (data.error) {
        setError(`Warning: ${data.error.message}`);
      }

    } catch (err: any) {
      console.error('[View Angle Test] Error:', err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleNextFrame = (view: string, totalFrames: number) => {
    setCurrentFrame((prev) => ({
      ...prev,
      [view]: ((prev[view] || 0) + 1) % totalFrames,
    }));
  };

  const handlePrevFrame = (view: string, totalFrames: number) => {
    setCurrentFrame((prev) => ({
      ...prev,
      [view]: ((prev[view] || 0) - 1 + totalFrames) % totalFrames,
    }));
  };

  const getViewDescription = (view: string): string => {
    const descriptions: { [key: string]: string } = {
      'side': 'Side view (profile) - Current default for menus',
      'low top-down': 'Low top-down (~20° angle) - Slight overhead',
      'high top-down': 'High top-down (~35° angle) - Traditional isometric',
    };
    return descriptions[view] || view;
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>View Angle Comparison Test</h1>
        <p className={styles.subtitle}>
          Compare different camera angles to determine the best view for isometric battlefield
        </p>
      </header>

      <div className={styles.inputSection}>
        <div className={styles.inputGroup}>
          <label htmlFor="description">Creature Description:</label>
          <input
            id="description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., fierce red dragon warrior with wings and horns"
            disabled={isGenerating}
            className={styles.descriptionInput}
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={isGenerating || !description.trim()}
          className={styles.generateButton}
        >
          {isGenerating ? 'Generating All Views...' : 'Generate All Views'}
        </button>

        {error && (
          <div className={error.startsWith('Warning:') ? styles.warning : styles.error}>
            {error}
          </div>
        )}
      </div>

      {isGenerating && (
        <div className={styles.loadingSection}>
          <div className={styles.spinner} />
          <p>Generating sprites from all three view angles...</p>
          <p className={styles.loadingNote}>This may take 2-3 minutes</p>
        </div>
      )}

      {results && (
        <div className={styles.resultsSection}>
          <div className={styles.summaryCard}>
            <h2>Test Results</h2>
            <p><strong>Creature:</strong> {results.description}</p>
            <p><strong>Total Cost:</strong> ${results.totalCost.toFixed(4)}</p>
            <p><strong>Total Time:</strong> {(results.totalTime / 1000).toFixed(1)}s</p>
          </div>

          <div className={styles.comparisonGrid}>
            {results.results.map((result) => (
              <div key={result.view} className={styles.viewCard}>
                <h3 className={styles.viewTitle}>{result.view}</h3>
                <p className={styles.viewDescription}>{getViewDescription(result.view)}</p>

                <div className={styles.spriteSection}>
                  <h4>Base Sprite</h4>
                  <div className={styles.spriteContainer}>
                    <img
                      src={`data:image/png;base64,${result.baseSprite}`}
                      alt={`${result.view} base sprite`}
                      className={styles.sprite}
                    />
                  </div>
                </div>

                <div className={styles.animationSection}>
                  <h4>Walk Animation</h4>
                  <div className={styles.animationContainer}>
                    <img
                      src={`data:image/png;base64,${result.animationFrames[currentFrame[result.view] || 0]}`}
                      alt={`${result.view} animation frame ${currentFrame[result.view] || 0}`}
                      className={styles.sprite}
                    />
                    <div className={styles.animationControls}>
                      <button
                        onClick={() => handlePrevFrame(result.view, result.animationFrames.length)}
                        className={styles.frameButton}
                      >
                        ← Prev
                      </button>
                      <span className={styles.frameIndicator}>
                        Frame {(currentFrame[result.view] || 0) + 1} / {result.animationFrames.length}
                      </span>
                      <button
                        onClick={() => handleNextFrame(result.view, result.animationFrames.length)}
                        className={styles.frameButton}
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                </div>

                <div className={styles.metadata}>
                  <p><strong>Cost:</strong> ${result.costUsd.toFixed(4)}</p>
                  <p><strong>Time:</strong> {(result.timeMs / 1000).toFixed(1)}s</p>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.evaluationSection}>
            <h2>Evaluation Guide</h2>
            <ul className={styles.evaluationList}>
              <li>
                <strong>Side view:</strong> Best for character menus and galleries (current default)
              </li>
              <li>
                <strong>Low top-down:</strong> Slight overhead angle, may work for isometric battlefield
              </li>
              <li>
                <strong>High top-down:</strong> Traditional isometric view, shows more of the battlefield
              </li>
            </ul>
            <p className={styles.evaluationNote}>
              Consider: Which view shows the creature best in a tactical battlefield context?
              Does the walk animation look natural? Can you distinguish features clearly?
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
