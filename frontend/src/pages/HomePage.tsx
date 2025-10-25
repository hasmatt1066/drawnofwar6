/**
 * Home Page
 *
 * Main hub for authenticated users
 */

import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect } from 'react';

interface UserStats {
  wins: number;
  losses: number;
  disconnects: number;
  totalBattles: number;
  currentWinStreak: number;
  bestWinStreak: number;
}

interface UserProfile {
  displayName: string;
  email: string;
  stats: UserStats;
}

export function HomePage() {
  const { user, getIdToken } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const token = await getIdToken();
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

        const response = await fetch(`${apiUrl}/api/users/me/profile`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setProfile(data);
        }
      } catch (error) {
        console.error('Failed to fetch profile:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [getIdToken]);

  const stats = profile?.stats || {
    wins: 0,
    losses: 0,
    disconnects: 0,
    totalBattles: 0,
    currentWinStreak: 0,
    bestWinStreak: 0
  };

  const winRate = stats.totalBattles > 0
    ? ((stats.wins / stats.totalBattles) * 100).toFixed(1)
    : '0.0';

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <h1>Welcome, {user?.displayName || 'Player'}!</h1>

      {/* Top Row: Battle Stats */}
      <div style={{
        marginTop: '2rem',
        padding: '2rem',
        backgroundColor: '#ffffff',
        border: '2px solid #007bff',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem'
        }}>
          <h2 style={{ margin: 0 }}>🏆 Battle Stats</h2>
          {stats.totalBattles === 0 && (
            <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>
              No battles yet
            </span>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: '#6b7280', padding: '2rem' }}>
            Loading stats...
          </div>
        ) : stats.totalBattles === 0 ? (
          <div style={{ textAlign: 'center', color: '#6b7280', padding: '2rem' }}>
            <p>Your battle statistics will appear here after your first match.</p>
            <p>Ready to battle? Check out the Battle Arena below!</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '1.5rem'
          }}>
            {/* Wins */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981' }}>
                {stats.wins}
              </div>
              <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>Wins</div>
            </div>

            {/* Losses */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ef4444' }}>
                {stats.losses}
              </div>
              <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>Losses</div>
            </div>

            {/* Win Rate */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#6366f1' }}>
                {winRate}%
              </div>
              <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>Win Rate</div>
            </div>

            {/* Current Streak */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f59e0b' }}>
                {stats.currentWinStreak}
                {stats.currentWinStreak >= 3 && ' 🔥'}
              </div>
              <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>Win Streak</div>
            </div>

            {/* Best Streak */}
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#6b7280' }}>
                {stats.bestWinStreak}
              </div>
              <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>Best Streak</div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '2rem',
        marginTop: '2rem'
      }}>
        {/* Creature Gallery Card */}
        <Link to="/gallery" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{
            padding: '2rem',
            border: '2px solid #007bff',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'transform 0.2s',
            backgroundColor: '#f8f9fa'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <h2>🎨 Creature Gallery</h2>
            <p>View and manage your created creatures</p>
          </div>
        </Link>

        {/* Create Creature Card */}
        <Link to="/create" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{
            padding: '2rem',
            border: '2px solid #28a745',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'transform 0.2s',
            backgroundColor: '#f8f9fa'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <h2>✨ Create Creature</h2>
            <p>Design and generate a new creature</p>
          </div>
        </Link>

        {/* Battle Card */}
        <Link to="/battles" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{
            padding: '2rem',
            border: '2px solid #dc3545',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'transform 0.2s',
            backgroundColor: '#f8f9fa'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <h2>⚔️ Battle Lobby</h2>
            <p>Find opponents and engage in battle</p>
          </div>
        </Link>

        {/* Animation Studio Card */}
        <Link to="/animation-studio" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div style={{
            padding: '2rem',
            border: '2px solid #6c757d',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'transform 0.2s',
            backgroundColor: '#f8f9fa'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <h2>🎬 Animation Studio</h2>
            <p>Test and preview creature animations</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
