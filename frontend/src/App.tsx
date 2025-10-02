/**
 * App Component
 *
 * Main application component with routing
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PromptBuilder } from './components/PromptBuilder';
import { GenerationPage } from './pages/GenerationPage';

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

          {/* 404 fallback */}
          <Route path="*" element={<Navigate to="/create" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
};
