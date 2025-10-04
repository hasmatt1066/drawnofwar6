/**
 * ConnectionStatus Component
 *
 * Shows Socket.IO connection status and opponent presence for multiplayer deployment.
 */

import React from 'react';
import styles from './ConnectionStatus.module.css';

export interface ConnectionStatusProps {
  /** Whether this client is connected to Socket.IO */
  isConnected: boolean;
  /** Whether the opponent is connected */
  opponentConnected: boolean;
  /** The opponent's player ID */
  opponentPlayerId: 'player1' | 'player2' | null;
  /** Error message if any */
  error?: string | null;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  isConnected,
  opponentConnected,
  opponentPlayerId,
  error
}) => {
  const getConnectionStatusColor = () => {
    if (error) return '#e74c3c'; // Red for error
    if (!isConnected) return '#f39c12'; // Yellow for connecting
    return '#2ecc71'; // Green for connected
  };

  const getConnectionStatusText = () => {
    if (error) return 'Connection Error';
    if (!isConnected) return 'Connecting...';
    return 'Connected';
  };

  const getOpponentStatusText = () => {
    if (!isConnected) return 'Waiting for connection...';
    if (!opponentConnected) return 'Waiting for opponent...';
    return `${opponentPlayerId === 'player1' ? 'Player 1' : 'Player 2'} connected`;
  };

  return (
    <div className={styles.container}>
      {/* Connection Status Indicator */}
      <div className={styles.statusRow}>
        <div className={styles.statusItem}>
          <div
            className={styles.statusDot}
            style={{ backgroundColor: getConnectionStatusColor() }}
          />
          <span className={styles.statusText}>
            {getConnectionStatusText()}
          </span>
        </div>

        {/* Opponent Status */}
        <div className={styles.statusItem}>
          <div
            className={styles.statusDot}
            style={{
              backgroundColor: opponentConnected ? '#2ecc71' : '#95a5a6'
            }}
          />
          <span className={styles.statusText}>
            {getOpponentStatusText()}
          </span>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className={styles.errorMessage}>
          {error}
        </div>
      )}

      {/* Disconnection Warning */}
      {isConnected && !opponentConnected && (
        <div className={styles.warningMessage}>
          Share the match link with your opponent to start playing
        </div>
      )}
    </div>
  );
};

export default ConnectionStatus;
