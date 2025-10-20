/**
 * TASK-CLS-4.1: URL Parameter Parsing Hook
 *
 * Parse creature IDs from URL query parameters.
 * Example: ?creatures=id1,id2,id3 or ?creatures=id1&creatures=id2&creatures=id3
 */

import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface RosterParams {
  creatureIds: string[];
  hasCreatures: boolean;
}

/**
 * Parse creature roster from URL parameters
 *
 * Supports two formats:
 * 1. Comma-separated: ?creatures=id1,id2,id3
 * 2. Multiple params: ?creatures=id1&creatures=id2&creatures=id3
 */
export function useRosterFromUrl(): RosterParams {
  const [searchParams] = useSearchParams();

  return useMemo(() => {
    const creaturesParam = searchParams.get('creatures');

    if (!creaturesParam) {
      return {
        creatureIds: [],
        hasCreatures: false
      };
    }

    // Parse comma-separated IDs
    const ids = creaturesParam
      .split(',')
      .map(id => id.trim())
      .filter(id => id.length > 0 && isValidCreatureId(id));

    return {
      creatureIds: ids,
      hasCreatures: ids.length > 0
    };
  }, [searchParams]);
}

/**
 * Validate creature ID format
 *
 * Firestore IDs are alphanumeric strings
 */
function isValidCreatureId(id: string): boolean {
  // Basic validation: non-empty, alphanumeric with hyphens/underscores
  return /^[a-zA-Z0-9_-]+$/.test(id) && id.length > 0 && id.length <= 100;
}
