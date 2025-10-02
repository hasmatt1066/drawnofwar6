/**
 * Generation Page
 *
 * Page component for displaying generation progress
 * Route: /generation/:jobId
 */

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GenerationProgress } from '@/components/GenerationProgress';
import type { GenerationResult } from '@/services/generationService';

export const GenerationPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();

  // Handle invalid jobId
  if (!jobId) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Invalid Generation</h1>
        <p>No job ID provided.</p>
        <button onClick={() => navigate('/create')}>
          Create New Creature
        </button>
      </div>
    );
  }

  const handleComplete = (result: GenerationResult) => {
    console.log('Generation completed:', result);
    // Store result in localStorage for creature editor
    localStorage.setItem(`generation_${jobId}`, JSON.stringify(result));
  };

  const handleError = (error: string) => {
    console.error('Generation failed:', error);
  };

  return (
    <GenerationProgress
      jobId={jobId}
      onComplete={handleComplete}
      onError={handleError}
    />
  );
};
