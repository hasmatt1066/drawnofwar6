/**
 * Protected Route Component
 *
 * Wrapper component that requires authentication to access.
 * Redirects to /login if user is not authenticated.
 * Implementation follows L4-AUTH-005 specification.
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Protected Route Component
 *
 * Renders children only if user is authenticated.
 * Redirects to /login with redirect parameter if not authenticated.
 * Shows nothing while checking authentication status.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Show nothing while checking auth state
  if (loading) {
    return null;
  }

  // Redirect to login if not authenticated
  if (!user) {
    // Preserve the attempted URL for redirect after login
    const redirectUrl = location.pathname + location.search;
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirectUrl)}`} replace />;
  }

  // Render protected content
  return <>{children}</>;
}
