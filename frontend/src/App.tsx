/**
 * App Component
 *
 * Main application component with routing
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { NavBar } from './components/NavBar';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { HomePage } from './pages/HomePage';
import { PromptBuilder } from './components/PromptBuilder';
import { GenerationPage } from './pages/GenerationPage';
import { ViewAngleTestPage } from './pages/ViewAngleTestPage';
import { BattleLobbyPage } from './pages/BattleLobbyPage';
import { DeploymentGridDemoPage } from './pages/DeploymentGridDemoPage';
import CreatureAnimationStudio from './pages/CreatureAnimationStudio';
import { CreatureGalleryPage } from './pages/CreatureGalleryPage';
import { CreatureDetailPage } from './pages/CreatureDetailPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="app">
          <NavBar />
          <Routes>
            {/* Auth routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Root redirects to home */}
            <Route path="/" element={<Navigate to="/home" replace />} />

            {/* Protected home page */}
            <Route
              path="/home"
              element={
                <ProtectedRoute>
                  <HomePage />
                </ProtectedRoute>
              }
            />

            {/* Public routes */}
            <Route path="/create" element={<PromptBuilder />} />
            <Route path="/generation/:jobId" element={<GenerationPage />} />
            <Route path="/test-view-angles" element={<ViewAngleTestPage />} />
            <Route path="/animation-studio" element={<CreatureAnimationStudio />} />

            {/* Protected routes - require authentication */}
            <Route
              path="/gallery"
              element={
                <ProtectedRoute>
                  <CreatureGalleryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/creatures/:creatureId"
              element={
                <ProtectedRoute>
                  <CreatureDetailPage />
                </ProtectedRoute>
              }
            />
            {/* Battle Lobby - Central hub for finding/creating battles */}
            <Route
              path="/battles"
              element={
                <ProtectedRoute>
                  <BattleLobbyPage />
                </ProtectedRoute>
              }
            />
            {/* Deployment Grid - Accessed via Battle Lobby with matchId/playerId params */}
            <Route
              path="/deployment"
              element={
                <ProtectedRoute>
                  <DeploymentGridDemoPage />
                </ProtectedRoute>
              }
            />
            {/* Legacy route */}
            <Route
              path="/deployment-grid"
              element={
                <ProtectedRoute>
                  <DeploymentGridDemoPage />
                </ProtectedRoute>
              }
            />

            {/* 404 fallback */}
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
};
