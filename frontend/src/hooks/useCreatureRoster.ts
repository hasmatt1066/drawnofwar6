/**
 * TASK-CLS-4.2: Load Creature Roster Hook
 *
 * Fetches creatures from library via batch API.
 * Returns loading/error/data states.
 */

import { useState, useEffect } from 'react';
import { getCreatureLibraryService } from '@/services/creatureLibraryService';
import type { SerializedCreatureDocument, OwnerId } from '@drawn-of-war/shared/types/creature-storage';

export interface CreatureRosterState {
  creatures: SerializedCreatureDocument[];
  missing: string[];
  loading: boolean;
  error: string | null;
}

/**
 * Load creatures from library by IDs
 *
 * @param creatureIds - Array of creature IDs to fetch
 * @param ownerId - Owner ID for ownership validation
 * @param enabled - Whether to fetch (default: true)
 */
export function useCreatureRoster(
  creatureIds: string[],
  ownerId: OwnerId,
  enabled: boolean = true
): CreatureRosterState {
  const [state, setState] = useState<CreatureRosterState>({
    creatures: [],
    missing: [],
    loading: enabled && creatureIds.length > 0,
    error: null
  });

  useEffect(() => {
    // Skip if not enabled or no IDs provided
    if (!enabled || creatureIds.length === 0) {
      setState({
        creatures: [],
        missing: [],
        loading: false,
        error: null
      });
      return;
    }

    let cancelled = false;

    const fetchCreatures = async () => {
      setState(prev => ({ ...prev, loading: true, error: null }));

      try {
        const libraryService = getCreatureLibraryService();
        const response = await libraryService.batchGetCreatures(creatureIds, ownerId);

        if (!cancelled) {
          setState({
            creatures: response.creatures,
            missing: response.missing,
            loading: false,
            error: null
          });
        }
      } catch (error) {
        console.error('Error loading creature roster:', error);

        if (!cancelled) {
          setState({
            creatures: [],
            missing: creatureIds,
            loading: false,
            error: error instanceof Error ? error.message : 'Failed to load creatures'
          });
        }
      }
    };

    fetchCreatures();

    return () => {
      cancelled = true;
    };
  }, [creatureIds.join(','), ownerId, enabled]); // Join IDs for stable dependency

  return state;
}
