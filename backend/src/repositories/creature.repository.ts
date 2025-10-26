/**
 * Creature Repository
 *
 * Handles all Firestore CRUD operations for creature documents.
 * Type-safe with comprehensive error handling.
 */

import { getFirestore } from '../config/firebase.config.js';
import type { Firestore, DocumentReference, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import type {
  CreatureDocument,
  CreatureDocumentInput,
  OwnerId
} from '@drawn-of-war/shared';

const COLLECTION_NAME = 'creatures';
const CURRENT_SCHEMA_VERSION = '1.0.0';

export class CreatureRepository {
  private firestore: Firestore;

  constructor() {
    this.firestore = getFirestore();
  }

  /**
   * Create a new creature document
   */
  async create(input: CreatureDocumentInput): Promise<CreatureDocument> {
    try {
      const docRef = this.firestore.collection(COLLECTION_NAME).doc();

      const document: Omit<CreatureDocument, 'id'> = {
        ...input,
        createdAt: new Date(),
        version: input.version || CURRENT_SCHEMA_VERSION
      };

      await docRef.set(document);

      return {
        id: docRef.id,
        ...document
      };
    } catch (error) {
      console.error('[CreatureRepository] Error creating creature:', error);
      throw new Error(`Failed to create creature: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find creature by ID
   */
  async findById(id: string): Promise<CreatureDocument | null> {
    try {
      const docRef = this.firestore.collection(COLLECTION_NAME).doc(id);
      const snapshot = await docRef.get();

      if (!snapshot.exists) {
        return null;
      }

      return this.snapshotToDocument(snapshot as any);
    } catch (error) {
      console.error(`[CreatureRepository] Error finding creature ${id}:`, error);
      throw new Error(`Failed to find creature: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find creature by generation job ID
   */
  async findByJobId(jobId: string): Promise<CreatureDocument | null> {
    try {
      const query = this.firestore
        .collection(COLLECTION_NAME)
        .where('generationJobId', '==', jobId)
        .limit(1);

      const snapshot = await query.get();

      if (snapshot.empty) {
        return null;
      }

      return this.snapshotToDocument(snapshot.docs[0]);
    } catch (error) {
      console.error(`[CreatureRepository] Error finding creature by job ${jobId}:`, error);
      throw new Error(`Failed to query creature by job ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find all creatures owned by a player
   */
  async findByOwner(
    ownerId: OwnerId,
    limit: number = 50,
    offset: number = 0
  ): Promise<CreatureDocument[]> {
    try {
      const query = this.firestore
        .collection(COLLECTION_NAME)
        .where('ownerId', '==', ownerId)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .offset(offset);

      const snapshot = await query.get();

      return snapshot.docs.map(doc => this.snapshotToDocument(doc));
    } catch (error) {
      console.error(`[CreatureRepository] Error finding creatures for owner ${ownerId}:`, error);
      throw new Error(`Failed to find creatures: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get total count of creatures for owner
   */
  async countByOwner(ownerId: OwnerId): Promise<number> {
    try {
      const query = this.firestore
        .collection(COLLECTION_NAME)
        .where('ownerId', '==', ownerId)
        .count();

      const snapshot = await query.get();
      return snapshot.data().count;
    } catch (error) {
      console.error(`[CreatureRepository] Error counting creatures for owner ${ownerId}:`, error);
      throw new Error(`Failed to count creatures: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find multiple creatures by IDs (batch query)
   * Validates all creatures belong to the specified owner
   */
  async findByIds(ids: string[], ownerId: OwnerId): Promise<CreatureDocument[]> {
    if (ids.length === 0) {
      return [];
    }

    try {
      // Firestore 'in' queries are limited to 30 items
      const chunks = this.chunkArray(ids, 30);
      const allDocs: CreatureDocument[] = [];

      for (const chunk of chunks) {
        const query = this.firestore
          .collection(COLLECTION_NAME)
          .where('__name__', 'in', chunk)
          .where('ownerId', '==', ownerId);

        const snapshot = await query.get();
        allDocs.push(...snapshot.docs.map(doc => this.snapshotToDocument(doc)));
      }

      return allDocs;
    } catch (error) {
      console.error('[CreatureRepository] Error finding creatures by IDs:', error);
      throw new Error(`Failed to find creatures: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a creature by ID
   */
  async delete(id: string): Promise<void> {
    try {
      const docRef = this.firestore.collection(COLLECTION_NAME).doc(id);
      await docRef.delete();
    } catch (error) {
      console.error(`[CreatureRepository] Error deleting creature ${id}:`, error);
      throw new Error(`Failed to delete creature: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update creature document (partial update)
   */
  async update(id: string, updates: Partial<CreatureDocument>): Promise<void> {
    try {
      const docRef = this.firestore.collection(COLLECTION_NAME).doc(id);

      // Remove id from updates if present
      const { id: _id, ...safeUpdates } = updates as any;

      await docRef.update(safeUpdates);
    } catch (error) {
      console.error(`[CreatureRepository] Error updating creature ${id}:`, error);
      throw new Error(`Failed to update creature: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if creature exists
   */
  async exists(id: string): Promise<boolean> {
    try {
      const docRef = this.firestore.collection(COLLECTION_NAME).doc(id);
      const snapshot = await docRef.get();
      return snapshot.exists;
    } catch (error) {
      console.error(`[CreatureRepository] Error checking if creature ${id} exists:`, error);
      return false;
    }
  }

  /**
   * Convert Firestore snapshot to CreatureDocument
   */
  private snapshotToDocument(snapshot: QueryDocumentSnapshot): CreatureDocument {
    const data = snapshot.data();

    return {
      id: snapshot.id,
      ownerId: data.ownerId,
      name: data.name,
      createdAt: data.createdAt?.toDate() || new Date(),
      generationJobId: data.generationJobId,
      inputType: data.inputType,
      textDescription: data.textDescription,
      concept: data.concept,
      race: data.race,
      class: data.class,
      abilities: data.abilities,
      combatAttributes: data.combatAttributes,
      animations: data.animations,
      sprites: data.sprites,
      generationTimeMs: data.generationTimeMs,
      version: data.version || '1.0.0'
    };
  }

  /**
   * Utility: Chunk array for batch operations
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

// Singleton instance
let repositoryInstance: CreatureRepository | null = null;

export function getCreatureRepository(): CreatureRepository {
  if (!repositoryInstance) {
    repositoryInstance = new CreatureRepository();
  }
  return repositoryInstance;
}
