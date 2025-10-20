/**
 * App Component
 *
 * Main application component with routing
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PromptBuilder } from './components/PromptBuilder';
import { GenerationPage } from './pages/GenerationPage';
import { ViewAngleTestPage } from './pages/ViewAngleTestPage';
import { DeploymentGridDemoPage } from './pages/DeploymentGridDemoPage';
import CreatureAnimationStudio from './pages/CreatureAnimationStudio';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="app">
        <Routes>
          {/* Home redirects to create */}
          <Route path="/" element={<Navigate to="/create" replace />} />

          {/* Creature creation page */}
          <Route path="/create" element={<PromptBuilder />} />

          {/* Generation progress page */}
          <Route path="/generation/:jobId" element={<GenerationPage />} />

          {/* View angle test page */}
          <Route path="/test-view-angles" element={<ViewAngleTestPage />} />

          {/* Deployment grid demo page */}
          <Route path="/deployment" element={<DeploymentGridDemoPage />} />
          {/* Legacy route for backwards compatibility */}
          <Route path="/deployment-grid" element={<DeploymentGridDemoPage />} />

          {/* Animation studio development page */}
          <Route path="/animation-studio" element={<CreatureAnimationStudio />} />

          {/* 404 fallback */}
          <Route path="*" element={<Navigate to="/create" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
};
