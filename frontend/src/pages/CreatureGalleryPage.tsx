/**
 * CreatureGalleryPage Component
 *
 * Public gallery page displaying all generated creatures in a responsive grid.
 * Features:
 * - Grid layout (4 columns desktop, 2 tablet, 1 mobile)
 * - Pagination with "Load More" button
 * - Click through to creature detail page
 * - Empty state for no creatures
 * - Loading states
 * - Future-proofed for user filtering
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreatureCard } from '../components/CreatureCard';
import { getCreatureLibraryService } from '../services/creatureLibraryService';
import type { SerializedCreatureDocument } from '@shared/types/creature-storage';
import './CreatureGalleryPage.css';

// Future: Add user filter state
// import type { OwnerId } from '@shared/types/creature-storage';
// const [filterOwner, setFilterOwner] = useState<OwnerId | 'all'>('all');

const CREATURES_PER_PAGE = 24;

export const CreatureGalleryPage: React.FC = () => {
  const navigate = useNavigate();
  const [creatures, setCreatures] = useState<SerializedCreatureDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  // Future: Add user filter state
  // const [filterOwner, setFilterOwner] = useState<OwnerId | 'all'>('all');

  // Load creatures on mount
  useEffect(() => {
    loadCreatures();
  }, []);

  const loadCreatures = async () => {
    try {
      setLoading(true);
      setError(null);

      const libraryService = getCreatureLibraryService();

      // For MVP: Load all creatures for demo-player1
      // Future: Support filtering by user when auth is implemented
      const response = await libraryService.listCreatures({
        ownerId: 'demo-player1',
        limit: CREATURES_PER_PAGE,
        offset: 0
      });

      setCreatures(response.creatures);
      setTotal(response.total);
      setHasMore(response.hasMore);
    } catch (err) {
      console.error('Failed to load creatures:', err);
      setError(err instanceof Error ? err.message : 'Failed to load creatures');
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;

    try {
      setLoadingMore(true);
      setError(null);

      const libraryService = getCreatureLibraryService();

      const response = await libraryService.listCreatures({
        ownerId: 'demo-player1',
        limit: CREATURES_PER_PAGE,
        offset: creatures.length
      });

      setCreatures(prev => [...prev, ...response.creatures]);
      setHasMore(response.hasMore);
    } catch (err) {
      console.error('Failed to load more creatures:', err);
      setError(err instanceof Error ? err.message : 'Failed to load more creatures');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleCreatureClick = (creature: SerializedCreatureDocument) => {
    navigate(`/creatures/${creature.id}`);
  };

  const handleCreateNew = () => {
    navigate('/create');
  };

  // Loading state
  if (loading) {
    return (
      <div className="creature-gallery-page">
        <div className="creature-gallery-page__header">
          <h1>Creature Gallery</h1>
        </div>
        <div className="creature-gallery-page__loading">
          <div className="spinner"></div>
          <p>Loading creatures...</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (creatures.length === 0 && !error) {
    return (
      <div className="creature-gallery-page">
        <div className="creature-gallery-page__header">
          <h1>Creature Gallery</h1>
        </div>
        <div className="creature-gallery-page__empty">
          <div className="empty-state">
            <h2>No Creatures Yet</h2>
            <p>Start creating your first creature to see it here!</p>
            <button className="btn btn-primary" onClick={handleCreateNew}>
              Create Your First Creature
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main gallery view
  return (
    <div className="creature-gallery-page">
      {/* Header */}
      <div className="creature-gallery-page__header">
        <div>
          <h1>Creature Gallery</h1>
          <p className="subtitle">
            {total} {total === 1 ? 'creature' : 'creatures'} created
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleCreateNew}>
          Create New Creature
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="creature-gallery-page__error">
          <p>{error}</p>
          <button className="btn btn-secondary" onClick={loadCreatures}>
            Retry
          </button>
        </div>
      )}

      {/* Creature Grid */}
      <div className="creature-gallery-page__grid">
        {creatures.map(creature => (
          <CreatureCard
            key={creature.id}
            creature={creature}
            onClick={handleCreatureClick}
          />
        ))}
      </div>

      {/* Load More Button */}
      {hasMore && (
        <div className="creature-gallery-page__load-more">
          <button
            className="btn btn-secondary"
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <>
                <span className="spinner-small"></span>
                Loading...
              </>
            ) : (
              `Load More (${creatures.length} of ${total})`
            )}
          </button>
        </div>
      )}

      {/* Footer */}
      {!hasMore && creatures.length > 0 && (
        <div className="creature-gallery-page__footer">
          <p>You've reached the end of the gallery</p>
        </div>
      )}
    </div>
  );
};
