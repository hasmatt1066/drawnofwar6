/**
 * Battle Lobby Page
 *
 * Central hub for finding and creating battles.
 * Follows L3 specification: battle-lobby-system.md
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { createBattle } from '../services/battle-api';
import {
  InsufficientCreaturesError,
  ActiveBattleExistsError
} from '../services/battle-api-errors';

export function BattleLobbyPage() {
  const navigate = useNavigate();
  const [battleKey, setBattleKey] = useState('');
  const [battleName, setBattleName] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  /**
   * Quick Play - Auto-match or create battle
   * TODO: Implement actual matchmaking API call
   */
  function handleQuickPlay() {
    const matchId = uuidv4();
    navigate(`/deployment?matchId=${matchId}&playerId=player1`);
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
   * TODO: Call POST /api/battles/:key/join
   */
  function handleJoinByKey() {
    if (!battleKey.trim() || battleKey.length !== 6) {
      alert('Please enter a valid 6-character battle key');
      return;
    }

    // TODO: Call API to join battle by key
    // For now, generate matchId and navigate
    const matchId = uuidv4();
    navigate(`/deployment?matchId=${matchId}&playerId=player2`);
    setBattleKey('');
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
          <button
            onClick={handleQuickPlay}
            style={{
              width: '100%',
              padding: '1rem',
              fontSize: '1.1rem',
              fontWeight: 'bold',
              backgroundColor: '#6366f1',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4f46e5'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#6366f1'}
          >
            Quick Play
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
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="K3P9X2"
              value={battleKey}
              onChange={(e) => setBattleKey(e.target.value.toUpperCase())}
              maxLength={6}
              style={{
                flex: 1,
                padding: '0.75rem',
                fontSize: '1.1rem',
                fontWeight: 'bold',
                textAlign: 'center',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                textTransform: 'uppercase'
              }}
            />
            <button
              onClick={handleJoinByKey}
              disabled={battleKey.length !== 6}
              style={{
                padding: '0.75rem 1.5rem',
                fontSize: '1.1rem',
                fontWeight: 'bold',
                backgroundColor: battleKey.length === 6 ? '#f59e0b' : '#d1d5db',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: battleKey.length === 6 ? 'pointer' : 'not-allowed'
              }}
            >
              Join
            </button>
          </div>
        </div>
      </div>

      {/* Browse Battles - Placeholder */}
      <div style={{
        padding: '2rem',
        backgroundColor: '#ffffff',
        border: '2px solid #e5e7eb',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ marginBottom: '1rem' }}>🔍 Browse Open Battles</h2>
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
