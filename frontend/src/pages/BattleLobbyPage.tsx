/**
 * Battle Lobby Page
 *
 * Central hub for finding and creating battles.
 * Follows L3 specification: battle-lobby-system.md
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { createBattle, joinBattleByKey, quickPlay } from '../services/battle-api';
import {
  InsufficientCreaturesError,
  ActiveBattleExistsError,
  BattleNotFoundError,
  BattleAlreadyFilledError,
  CannotJoinOwnBattleError
} from '../services/battle-api-errors';
import { useLobbySocket } from '../hooks/useLobbySocket';
import type { LobbyBattle } from '../services/lobby-socket';

export function BattleLobbyPage() {
  const navigate = useNavigate();
  const [battleKey, setBattleKey] = useState('');
  const [battleName, setBattleName] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isQuickPlaying, setIsQuickPlaying] = useState(false);
  const [quickPlayError, setQuickPlayError] = useState<string | null>(null);
  const [joiningBattleId, setJoiningBattleId] = useState<string | null>(null);
  const [listJoinError, setListJoinError] = useState<string | null>(null);

  // Connect to lobby socket for real-time battle list
  const { battles, isConnected, error: socketError } = useLobbySocket();

  /**
   * Quick Play - Auto-match or create battle
   * Calls API to find or create a battle automatically
   */
  async function handleQuickPlay() {
    setIsQuickPlaying(true);
    setQuickPlayError(null);

    try {
      const result = await quickPlay();

      // Success - navigate to deployment page
      navigate(`/deployment?matchId=${result.matchId}&playerId=${result.playerId}`);

      // Clean up state
      setIsQuickPlaying(false);
      setQuickPlayError(null);
    } catch (error) {
      setIsQuickPlaying(false);

      // Handle specific error types
      if (error instanceof InsufficientCreaturesError) {
        setQuickPlayError(error.message);
      } else if (error instanceof ActiveBattleExistsError) {
        setQuickPlayError(error.message);
      } else if (error instanceof Error) {
        setQuickPlayError(error.message);
      } else {
        setQuickPlayError('Failed to find a battle. Please try again.');
      }
    }
  }

  /**
   * Create Battle
   * Calls API to create battle and navigates to deployment
   */
  async function handleCreateBattle() {
    if (!battleName.trim()) {
      setCreateError('Please enter a battle name');
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      const result = await createBattle(battleName, true);

      // Success - navigate to deployment page
      navigate(`/deployment?matchId=${result.matchId}&playerId=${result.playerId}`);

      // Clean up state
      setShowCreateModal(false);
      setBattleName('');
      setIsCreating(false);
      setCreateError(null);
    } catch (error) {
      setIsCreating(false);

      // Handle specific error types
      if (error instanceof InsufficientCreaturesError) {
        setCreateError(error.message);
      } else if (error instanceof ActiveBattleExistsError) {
        setCreateError(error.message);
      } else if (error instanceof Error) {
        setCreateError(error.message);
      } else {
        setCreateError('Failed to create battle. Please try again.');
      }
    }
  }

  /**
   * Join by Battle Key
   * Calls API to join battle and navigates to deployment
   */
  async function handleJoinByKey() {
    if (!battleKey.trim() || battleKey.length !== 6) {
      setJoinError('Please enter a valid 6-character battle key');
      return;
    }

    setIsJoining(true);
    setJoinError(null);

    try {
      const result = await joinBattleByKey(battleKey);

      // Success - navigate to deployment page
      navigate(`/deployment?matchId=${result.matchId}&playerId=${result.playerId}`);

      // Clean up state
      setBattleKey('');
      setIsJoining(false);
      setJoinError(null);
    } catch (error) {
      setIsJoining(false);

      // Handle specific error types
      if (error instanceof BattleNotFoundError) {
        setJoinError(error.message);
      } else if (error instanceof BattleAlreadyFilledError) {
        setJoinError(error.message);
      } else if (error instanceof CannotJoinOwnBattleError) {
        setJoinError(error.message);
      } else if (error instanceof InsufficientCreaturesError) {
        setJoinError(error.message);
      } else if (error instanceof Error) {
        setJoinError(error.message);
      } else {
        setJoinError('Failed to join battle. Please try again.');
      }
    }
  }

  /**
   * Join Battle from List
   * Handles clicking a battle card in the lobby
   */
  async function handleJoinFromList(battle: LobbyBattle) {
    setJoiningBattleId(battle.battleId);
    setListJoinError(null);

    try {
      const result = await joinBattleByKey(battle.battleKey);

      // Success - navigate to deployment page
      navigate(`/deployment?matchId=${result.matchId}&playerId=${result.playerId}`);

      // Clean up state
      setJoiningBattleId(null);
      setListJoinError(null);
    } catch (error) {
      setJoiningBattleId(null);

      // Handle specific error types
      if (error instanceof BattleNotFoundError) {
        setListJoinError(error.message);
      } else if (error instanceof BattleAlreadyFilledError) {
        setListJoinError(error.message);
      } else if (error instanceof CannotJoinOwnBattleError) {
        setListJoinError(error.message);
      } else if (error instanceof InsufficientCreaturesError) {
        setListJoinError(error.message);
      } else if (error instanceof Error) {
        setListJoinError(error.message);
      } else {
        setListJoinError('Failed to join battle. Please try again.');
      }
    }
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <h1>Battle Lobby</h1>
      <p style={{ color: '#6b7280', marginBottom: '3rem' }}>
        Find opponents, create battles, or jump into Quick Play
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '2rem',
        marginBottom: '3rem'
      }}>
        {/* Quick Play */}
        <div style={{
          padding: '2rem',
          backgroundColor: '#ffffff',
          border: '2px solid #6366f1',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚡</div>
          <h2 style={{ marginBottom: '1rem' }}>Quick Play</h2>
          <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
            Jump into a battle immediately. We'll match you with an opponent or create a new game.
          </p>

          {/* Error Message */}
          {quickPlayError && (
            <div style={{
              marginBottom: '1.5rem',
              padding: '0.75rem',
              backgroundColor: '#fee2e2',
              borderLeft: '4px solid #ef4444',
              borderRadius: '4px',
              color: '#991b1b',
              fontSize: '0.9rem'
            }}>
              {quickPlayError}
            </div>
          )}

          <button
            onClick={handleQuickPlay}
            disabled={isQuickPlaying}
            style={{
              width: '100%',
              padding: '1rem',
              fontSize: '1.1rem',
              fontWeight: 'bold',
              backgroundColor: '#6366f1',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: isQuickPlaying ? 'not-allowed' : 'pointer',
              opacity: isQuickPlaying ? 0.7 : 1
            }}
            onMouseEnter={(e) => {
              if (!isQuickPlaying) e.currentTarget.style.backgroundColor = '#4f46e5';
            }}
            onMouseLeave={(e) => {
              if (!isQuickPlaying) e.currentTarget.style.backgroundColor = '#6366f1';
            }}
          >
            {isQuickPlaying ? 'Searching...' : 'Quick Play'}
          </button>
        </div>

        {/* Create Battle */}
        <div style={{
          padding: '2rem',
          backgroundColor: '#ffffff',
          border: '2px solid #10b981',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>➕</div>
          <h2 style={{ marginBottom: '1rem' }}>Create Battle</h2>
          <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
            Host a new battle. You'll get a battle key to share with friends.
          </p>
          <button
            onClick={() => {
              setShowCreateModal(true);
              setCreateError(null);
            }}
            style={{
              width: '100%',
              padding: '1rem',
              fontSize: '1.1rem',
              fontWeight: 'bold',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#059669'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
          >
            Create Battle
          </button>
        </div>

        {/* Join by Key */}
        <div style={{
          padding: '2rem',
          backgroundColor: '#ffffff',
          border: '2px solid #f59e0b',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔑</div>
          <h2 style={{ marginBottom: '1rem' }}>Join by Key</h2>
          <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
            Enter a 6-character battle key to join a friend's battle.
          </p>

          {/* Error Message */}
          {joinError && (
            <div style={{
              marginBottom: '1rem',
              padding: '0.75rem',
              backgroundColor: '#fee2e2',
              borderLeft: '4px solid #ef4444',
              borderRadius: '4px',
              color: '#991b1b',
              fontSize: '0.9rem'
            }}>
              {joinError}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="K3P9X2"
              value={battleKey}
              onChange={(e) => {
                setBattleKey(e.target.value.toUpperCase());
                setJoinError(null);
              }}
              maxLength={6}
              disabled={isJoining}
              style={{
                flex: 1,
                padding: '0.75rem',
                fontSize: '1.1rem',
                fontWeight: 'bold',
                textAlign: 'center',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                textTransform: 'uppercase',
                opacity: isJoining ? 0.5 : 1
              }}
            />
            <button
              onClick={handleJoinByKey}
              disabled={battleKey.length !== 6 || isJoining}
              style={{
                padding: '0.75rem 1.5rem',
                fontSize: '1.1rem',
                fontWeight: 'bold',
                backgroundColor: (battleKey.length === 6 && !isJoining) ? '#f59e0b' : '#d1d5db',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: (battleKey.length === 6 && !isJoining) ? 'pointer' : 'not-allowed',
                opacity: isJoining ? 0.7 : 1
              }}
            >
              {isJoining ? 'Joining...' : 'Join'}
            </button>
          </div>
        </div>
      </div>

      {/* Browse Open Battles */}
      <div style={{
        padding: '2rem',
        backgroundColor: '#ffffff',
        border: '2px solid #e5e7eb',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        {/* Header with connection status */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem'
        }}>
          <h2 style={{ margin: 0 }}>🔍 Browse Open Battles</h2>
          <div style={{
            fontSize: '0.85rem',
            padding: '0.25rem 0.75rem',
            borderRadius: '12px',
            backgroundColor: isConnected ? '#d1fae5' : '#fee2e2',
            color: isConnected ? '#065f46' : '#991b1b'
          }}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>

        {/* Socket error */}
        {socketError && (
          <div style={{
            marginBottom: '1rem',
            padding: '0.75rem',
            backgroundColor: '#fee2e2',
            borderLeft: '4px solid #ef4444',
            borderRadius: '4px',
            color: '#991b1b',
            fontSize: '0.9rem'
          }}>
            {socketError}
          </div>
        )}

        {/* List join error */}
        {listJoinError && (
          <div style={{
            marginBottom: '1rem',
            padding: '0.75rem',
            backgroundColor: '#fee2e2',
            borderLeft: '4px solid #ef4444',
            borderRadius: '4px',
            color: '#991b1b',
            fontSize: '0.9rem'
          }}>
            {listJoinError}
          </div>
        )}

        {/* Battle count */}
        {battles.length > 0 && (
          <p style={{
            color: '#6b7280',
            marginBottom: '1.5rem',
            fontSize: '0.9rem'
          }}>
            {battles.length} {battles.length === 1 ? 'battle' : 'battles'} available
          </p>
        )}

        {/* Battle list or empty state */}
        {battles.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '3rem',
            color: '#6b7280'
          }}>
            <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
              No open battles available
            </p>
            <p style={{ fontSize: '0.9rem' }}>
              Use Quick Play or Create a new battle to get started
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '1rem'
          }}>
            {battles.map((battle) => {
              const isJoiningThis = joiningBattleId === battle.battleId;
              return (
                <div
                  key={battle.battleId}
                  role="button"
                  aria-disabled={isJoiningThis}
                  onClick={() => {
                    if (!isJoiningThis) {
                      handleJoinFromList(battle);
                    }
                  }}
                  style={{
                    padding: '1.5rem',
                    backgroundColor: isJoiningThis ? '#f3f4f6' : '#ffffff',
                    border: '2px solid #e5e7eb',
                    borderRadius: '8px',
                    cursor: isJoiningThis ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    opacity: isJoiningThis ? 0.6 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!isJoiningThis) {
                      e.currentTarget.style.borderColor = '#6366f1';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isJoiningThis) {
                      e.currentTarget.style.borderColor = '#e5e7eb';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }
                  }}
                >
                  {/* Battle name */}
                  <h3 style={{
                    margin: '0 0 0.5rem 0',
                    fontSize: '1.1rem',
                    fontWeight: 'bold',
                    color: '#111827'
                  }}>
                    {battle.battleName}
                  </h3>

                  {/* Host info */}
                  <p style={{
                    margin: '0 0 0.75rem 0',
                    fontSize: '0.9rem',
                    color: '#6b7280'
                  }}>
                    Hosted by {battle.players.host.displayName}
                  </p>

                  {/* Battle key */}
                  <div style={{
                    display: 'inline-block',
                    padding: '0.25rem 0.75rem',
                    backgroundColor: '#f3f4f6',
                    borderRadius: '6px',
                    fontFamily: 'monospace',
                    fontSize: '0.9rem',
                    fontWeight: 'bold',
                    color: '#374151'
                  }}>
                    {battle.battleKey}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Battle Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '12px',
            maxWidth: '500px',
            width: '90%'
          }}>
            <h2 style={{ marginBottom: '1.5rem' }}>Create New Battle</h2>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontWeight: '500'
              }}>
                Battle Name
              </label>
              <input
                type="text"
                placeholder="Epic Showdown"
                value={battleName}
                onChange={(e) => setBattleName(e.target.value)}
                maxLength={50}
                autoFocus
                disabled={isCreating}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  fontSize: '1rem',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  opacity: isCreating ? 0.5 : 1
                }}
              />
            </div>

            {/* Error Message */}
            {createError && (
              <div style={{
                marginBottom: '1.5rem',
                padding: '0.75rem',
                backgroundColor: '#fee2e2',
                borderLeft: '4px solid #ef4444',
                borderRadius: '4px',
                color: '#991b1b',
                fontSize: '0.9rem'
              }}>
                {createError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setBattleName('');
                  setCreateError(null);
                }}
                disabled={isCreating}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  fontSize: '1rem',
                  backgroundColor: '#e5e7eb',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isCreating ? 'not-allowed' : 'pointer',
                  opacity: isCreating ? 0.5 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBattle}
                disabled={isCreating}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isCreating ? 'not-allowed' : 'pointer',
                  opacity: isCreating ? 0.7 : 1
                }}
              >
                {isCreating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
