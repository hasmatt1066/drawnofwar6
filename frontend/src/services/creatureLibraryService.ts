/**
 * Creature Library Service
 *
 * TASK-CLS-3.4: Frontend service for creature storage API
 *
 * Handles all creature library operations:
 * - Save creatures from generation results
 * - List creatures by owner
 * - Get individual creatures
 * - Batch fetch creatures
 */

import type {
  SerializedCreatureDocument,
  CreatureListResponse,
  BatchCreaturesResponse,
  OwnerId
} from '@drawn-of-war/shared/types/creature-storage';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const LIBRARY_API = `${API_BASE}/api/creature-library`;

/**
 * Save creature request
 */
export interface SaveCreatureRequest {
  jobId: string;
  ownerId: OwnerId;
}

/**
 * Save creature response
 */
export interface SaveCreatureResponse {
  success: boolean;
  creatureId: string;
  creature: SerializedCreatureDocument;
}

/**
 * List creatures request
 */
export interface ListCreaturesRequest {
  ownerId: OwnerId;
  limit?: number;
  offset?: number;
}

/**
 * Creature Library Service
 */
export class CreatureLibraryService {
  /**
   * Save a creature from a completed generation job
   */
  async saveCreature(request: SaveCreatureRequest): Promise<SaveCreatureResponse> {
    const response = await fetch(`${LIBRARY_API}/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `Failed to save creature: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * List creatures owned by a player
   */
  async listCreatures(request: ListCreaturesRequest): Promise<CreatureListResponse> {
    const params = new URLSearchParams({
      ownerId: request.ownerId,
      ...(request.limit !== undefined && { limit: request.limit.toString() }),
      ...(request.offset !== undefined && { offset: request.offset.toString() })
    });

    const response = await fetch(`${LIBRARY_API}/list?${params}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `Failed to list creatures: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get a single creature by ID
   */
  async getCreature(id: string): Promise<SerializedCreatureDocument> {
    const response = await fetch(`${LIBRARY_API}/${id}`);

    if (response.status === 404) {
      throw new Error('Creature not found');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `Failed to get creature: ${response.statusText}`);
    }

    const data = await response.json();
    return data.creature;
  }

  /**
   * Get multiple creatures by IDs (validates ownership)
   */
  async batchGetCreatures(ids: string[], ownerId: OwnerId): Promise<BatchCreaturesResponse> {
    const params = new URLSearchParams({
      ids: ids.join(','),
      ownerId
    });

    const response = await fetch(`${LIBRARY_API}/batch?${params}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `Failed to batch get creatures: ${response.statusText}`);
    }

    return response.json();
  }
}

// Singleton instance
let serviceInstance: CreatureLibraryService | null = null;

export function getCreatureLibraryService(): CreatureLibraryService {
  if (!serviceInstance) {
    serviceInstance = new CreatureLibraryService();
  }
  return serviceInstance;
}

// Default export
export default getCreatureLibraryService;
