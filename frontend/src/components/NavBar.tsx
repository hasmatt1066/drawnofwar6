/**
 * Navigation Bar
 *
 * Persistent navigation across all pages
 */

import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function NavBar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await signOut();
    navigate('/login');
  }

  // Don't show navbar on auth pages
  if (!user) {
    return null;
  }

  return (
    <nav style={{
      backgroundColor: '#343a40',
      color: 'white',
      padding: '1rem 2rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
        <Link to="/home" style={{
          color: 'white',
          textDecoration: 'none',
          fontSize: '1.5rem',
          fontWeight: 'bold'
        }}>
          ⚔️ Drawn of War
        </Link>

        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <Link to="/home" style={{ color: 'white', textDecoration: 'none' }}>
            Home
          </Link>
          <Link to="/gallery" style={{ color: 'white', textDecoration: 'none' }}>
            Gallery
          </Link>
          <Link to="/create" style={{ color: 'white', textDecoration: 'none' }}>
            Create
          </Link>
          <Link to="/battles" style={{ color: 'white', textDecoration: 'none' }}>
            Battle
          </Link>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span style={{ color: '#adb5bd' }}>
          {user.displayName || user.email}
        </span>
        <button
          onClick={handleLogout}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Logout
        </button>
      </div>
    </nav>
  );
}
