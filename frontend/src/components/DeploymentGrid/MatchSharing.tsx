/**
 * MatchSharing Component
 *
 * Provides UI for sharing match links and opening in multiple windows for testing.
 */

import React, { useState } from 'react';
import styles from './MatchSharing.module.css';

export interface MatchSharingProps {
  matchId: string;
  currentPlayerId: 'player1' | 'player2';
}

export const MatchSharing: React.FC<MatchSharingProps> = ({ matchId, currentPlayerId }) => {
  const [copySuccess, setCopySuccess] = useState(false);

  // Generate match URLs
  const baseUrl = window.location.origin + window.location.pathname;
  const player1Url = `${baseUrl}?matchId=${matchId}&playerId=player1`;
  const player2Url = `${baseUrl}?matchId=${matchId}&playerId=player2`;

  const opponentPlayerId = currentPlayerId === 'player1' ? 'player2' : 'player1';
  const opponentUrl = currentPlayerId === 'player1' ? player2Url : player1Url;

  // Copy match link to clipboard
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(opponentUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Open opponent view in new window
  const handleOpenOpponent = () => {
    window.open(opponentUrl, '_blank', 'width=1400,height=900');
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Multiplayer Match</h3>
        <p className={styles.subtitle}>
          Share this link with your opponent to play together
        </p>
      </div>

      <div className={styles.linkContainer}>
        <input
          type="text"
          value={opponentUrl}
          readOnly
          className={styles.linkInput}
          onClick={(e) => e.currentTarget.select()}
        />
      </div>

      <div className={styles.actions}>
        <button onClick={handleCopyLink} className={styles.copyButton}>
          {copySuccess ? '✓ Copied!' : 'Copy Match Link'}
        </button>

        <button onClick={handleOpenOpponent} className={styles.openButton}>
          Open as {opponentPlayerId === 'player1' ? 'Player 1' : 'Player 2'} (Testing)
        </button>
      </div>

      <div className={styles.instructions}>
        <strong>Testing Instructions:</strong>
        <ol>
          <li>Click "Open as {opponentPlayerId === 'player1' ? 'Player 1' : 'Player 2'}" to open a second window</li>
          <li>Place creatures in both windows - they will sync in real-time</li>
          <li>Mark both players ready to start countdown</li>
          <li>Or share the copied link with another player on a different device</li>
        </ol>
      </div>
    </div>
  );
};

export default MatchSharing;
