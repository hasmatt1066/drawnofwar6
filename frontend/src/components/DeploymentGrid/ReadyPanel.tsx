/**
 * Ready Panel Component
 *
 * Displays ready state for both players, ready button, and countdown timer.
 */

import React from 'react';

export interface ReadyPanelProps {
  /** Current player ID */
  currentPlayerId: 'player1' | 'player2';
  /** Player 1 ready state */
  player1Ready: boolean;
  /** Player 2 ready state */
  player2Ready: boolean;
  /** Whether both players are locked */
  isLocked: boolean;
  /** Countdown seconds (null if not active) */
  countdownSeconds: number | null;
  /** Whether current player can mark ready */
  canMarkReady: boolean;
  /** Callback when ready button clicked */
  onReady: () => void;
  /** Callback when unready button clicked */
  onUnready: () => void;
}

export const ReadyPanel: React.FC<ReadyPanelProps> = ({
  currentPlayerId,
  player1Ready,
  player2Ready,
  isLocked,
  countdownSeconds,
  canMarkReady,
  onReady,
  onUnready
}) => {
  const currentPlayerReady = currentPlayerId === 'player1' ? player1Ready : player2Ready;
  const opponentReady = currentPlayerId === 'player1' ? player2Ready : player1Ready;

  return (
    <div style={{
      padding: '20px',
      background: 'rgba(0, 0, 0, 0.4)',
      borderRadius: '8px',
      border: isLocked ? '2px solid #e74c3c' : '1px solid #2c3e50',
      marginTop: '20px'
    }}>
      <h3 style={{
        margin: '0 0 15px 0',
        color: isLocked ? '#e74c3c' : '#3498db',
        fontSize: '20px',
        textAlign: 'center'
      }}>
        {isLocked ? 'Deployment Locked' : 'Ready Status'}
      </h3>

      {/* Ready Status Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '15px',
        marginBottom: '20px'
      }}>
        {/* Player 1 Status */}
        <div style={{
          padding: '12px',
          background: player1Ready ? 'rgba(46, 204, 113, 0.2)' : 'rgba(149, 165, 166, 0.2)',
          borderRadius: '6px',
          border: `2px solid ${player1Ready ? '#2ecc71' : '#95a5a6'}`,
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '14px',
            color: '#ecf0f1',
            marginBottom: '5px',
            fontWeight: currentPlayerId === 'player1' ? '600' : '400'
          }}>
            Player 1 {currentPlayerId === 'player1' && '(You)'}
          </div>
          <div style={{
            fontSize: '16px',
            color: player1Ready ? '#2ecc71' : '#95a5a6',
            fontWeight: '600'
          }}>
            {player1Ready ? 'Ready' : 'Not Ready'}
          </div>
        </div>

        {/* Player 2 Status */}
        <div style={{
          padding: '12px',
          background: player2Ready ? 'rgba(46, 204, 113, 0.2)' : 'rgba(149, 165, 166, 0.2)',
          borderRadius: '6px',
          border: `2px solid ${player2Ready ? '#2ecc71' : '#95a5a6'}`,
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '14px',
            color: '#ecf0f1',
            marginBottom: '5px',
            fontWeight: currentPlayerId === 'player2' ? '600' : '400'
          }}>
            Player 2 {currentPlayerId === 'player2' && '(You)'}
          </div>
          <div style={{
            fontSize: '16px',
            color: player2Ready ? '#2ecc71' : '#95a5a6',
            fontWeight: '600'
          }}>
            {player2Ready ? 'Ready' : 'Not Ready'}
          </div>
        </div>
      </div>

      {/* Countdown Timer */}
      {countdownSeconds !== null && !isLocked && (
        <div style={{
          padding: '15px',
          background: countdownSeconds <= 10 ? 'rgba(231, 76, 60, 0.2)' : 'rgba(241, 196, 15, 0.2)',
          borderRadius: '6px',
          border: `2px solid ${countdownSeconds <= 10 ? '#e74c3c' : '#f1c40f'}`,
          textAlign: 'center',
          marginBottom: '20px',
          animation: countdownSeconds <= 5 ? 'pulse 1s infinite' : 'none'
        }}>
          <div style={{
            fontSize: '14px',
            color: '#ecf0f1',
            marginBottom: '5px'
          }}>
            {opponentReady ? 'Opponent is ready!' : 'Waiting for opponent...'}
          </div>
          <div style={{
            fontSize: '32px',
            color: countdownSeconds <= 10 ? '#e74c3c' : '#f1c40f',
            fontWeight: '700',
            fontFamily: 'monospace'
          }}>
            {countdownSeconds}s
          </div>
          <div style={{
            fontSize: '12px',
            color: '#95a5a6',
            marginTop: '5px'
          }}>
            Auto-lock when timer expires
          </div>
        </div>
      )}

      {/* Locked Message */}
      {isLocked && (
        <div style={{
          padding: '15px',
          background: 'rgba(231, 76, 60, 0.2)',
          borderRadius: '6px',
          border: '2px solid #e74c3c',
          textAlign: 'center',
          marginBottom: '20px'
        }}>
          <div style={{
            fontSize: '18px',
            color: '#e74c3c',
            fontWeight: '600',
            marginBottom: '5px'
          }}>
            Deployment Complete
          </div>
          <div style={{
            fontSize: '14px',
            color: '#ecf0f1'
          }}>
            Both players are locked. Starting combat soon...
          </div>
        </div>
      )}

      {/* Ready Button */}
      {!isLocked && (
        <div style={{ textAlign: 'center' }}>
          {currentPlayerReady ? (
            <button
              onClick={onUnready}
              style={{
                padding: '12px 32px',
                background: 'linear-gradient(to bottom, #95a5a6 0%, #7f8c8d 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: '600',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 8px rgba(0, 0, 0, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.3)';
              }}
            >
              Cancel Ready
            </button>
          ) : (
            <button
              onClick={onReady}
              disabled={!canMarkReady}
              style={{
                padding: '12px 32px',
                background: canMarkReady
                  ? 'linear-gradient(to bottom, #2ecc71 0%, #27ae60 100%)'
                  : '#555',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: canMarkReady ? 'pointer' : 'not-allowed',
                fontSize: '16px',
                fontWeight: '600',
                boxShadow: canMarkReady ? '0 4px 6px rgba(0, 0, 0, 0.3)' : 'none',
                transition: 'all 0.2s',
                opacity: canMarkReady ? 1 : 0.5
              }}
              onMouseEnter={(e) => {
                if (canMarkReady) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 8px rgba(0, 0, 0, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                if (canMarkReady) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.3)';
                }
              }}
            >
              {canMarkReady ? 'Ready' : 'Place at least 1 creature'}
            </button>
          )}

          {!canMarkReady && (
            <div style={{
              fontSize: '12px',
              color: '#95a5a6',
              marginTop: '10px'
            }}>
              You must place at least one creature before marking ready
            </div>
          )}
        </div>
      )}

      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
          }
        `}
      </style>
    </div>
  );
};
