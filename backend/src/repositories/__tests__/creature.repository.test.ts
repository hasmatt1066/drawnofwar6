/**
 * Creature Repository Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreatureRepository } from '../creature.repository.js';
import type { CreatureDocumentInput } from '@drawn-of-war/shared/types/creature-storage.js';

// Mock Firestore
const mockDoc = {
  id: 'test-creature-123',
  set: vi.fn().mockResolvedValue(undefined),
  get: vi.fn(),
  update: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined)
};

const mockQuery = {
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  offset: vi.fn().mockReturnThis(),
  count: vi.fn(),
  get: vi.fn()
};

const mockCollection = {
  doc: vi.fn(),
  where: vi.fn().mockReturnValue(mockQuery),
  orderBy: vi.fn().mockReturnValue(mockQuery),
  limit: vi.fn().mockReturnValue(mockQuery),
  offset: vi.fn().mockReturnValue(mockQuery)
};

const mockFirestore = {
  collection: vi.fn().mockReturnValue(mockCollection)
};

vi.mock('../../config/firebase.config.js', () => ({
  getFirestore: () => mockFirestore
}));

describe('CreatureRepository', () => {
  let repository: CreatureRepository;

  const mockCreatureInput: CreatureDocumentInput = {
    ownerId: 'demo-player1',
    name: 'Fire Dragon',
    generationJobId: 'job-123',
    inputType: 'text',
    textDescription: 'A fierce fire dragon',
    species: 'Dragon',
    primaryRole: 'Tank',
    combatAttributes: {
      strength: { value: 8, reasoning: 'Powerful physical attacks' },
      agility: { value: 5, reasoning: 'Moderate speed' },
      intelligence: { value: 6, reasoning: 'Can breathe fire' }
    },
    abilities: ['Fire Breath', 'Wing Attack'],
    physicalDescription: 'Large red dragon with scales',
    animations: {
      idle: 'anim-1',
      walk: 'anim-2',
      attack: 'anim-3'
    },
    sprites: {
      menuSprite: 'gs://bucket/creatures/123/menu-sprite.png',
      directions: {
        E: {
          sprite: 'gs://bucket/creatures/123/directions/E-sprite.png',
          walkFrames: ['gs://bucket/creatures/123/directions/E-walk-0.png']
        },
        NE: {
          sprite: 'gs://bucket/creatures/123/directions/NE-sprite.png',
          walkFrames: ['gs://bucket/creatures/123/directions/NE-walk-0.png']
        },
        SE: {
          sprite: 'gs://bucket/creatures/123/directions/SE-sprite.png',
          walkFrames: ['gs://bucket/creatures/123/directions/SE-walk-0.png']
        }
      }
    },
    generationTimeMs: 15000
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock to return doc ref by default
    mockCollection.doc.mockReturnValue(mockDoc);
    repository = new CreatureRepository();
  });

  describe('create', () => {
    it('should create a new creature document', async () => {
      const creature = await repository.create(mockCreatureInput);

      expect(mockFirestore.collection).toHaveBeenCalledWith('creatures');
      expect(mockCollection.doc).toHaveBeenCalled();
      expect(mockDoc.set).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerId: 'demo-player1',
          name: 'Fire Dragon',
          generationJobId: 'job-123',
          createdAt: expect.any(Date),
          version: '1.0.0'
        })
      );
      expect(creature.id).toBe('test-creature-123');
      expect(creature.name).toBe('Fire Dragon');
    });

    it('should use provided version if specified', async () => {
      const inputWithVersion = { ...mockCreatureInput, version: '2.0.0' };
      await repository.create(inputWithVersion);

      expect(mockDoc.set).toHaveBeenCalledWith(
        expect.objectContaining({
          version: '2.0.0'
        })
      );
    });

    it('should throw error on creation failure', async () => {
      mockDoc.set.mockRejectedValueOnce(new Error('Firestore error'));

      await expect(repository.create(mockCreatureInput)).rejects.toThrow('Failed to create creature');
    });
  });

  describe('findById', () => {
    it('should return creature when found', async () => {
      const mockSnapshot = {
        exists: true,
        id: 'test-creature-123',
        data: () => ({
          ownerId: 'demo-player1',
          name: 'Fire Dragon',
          createdAt: { toDate: () => new Date('2025-01-01') },
          generationJobId: 'job-123',
          inputType: 'text',
          species: 'Dragon',
          primaryRole: 'Tank',
          combatAttributes: mockCreatureInput.combatAttributes,
          abilities: ['Fire Breath'],
          physicalDescription: 'Large dragon',
          animations: { idle: 'anim-1' },
          sprites: mockCreatureInput.sprites,
          generationTimeMs: 15000,
          version: '1.0.0'
        })
      };

      mockDoc.get.mockResolvedValueOnce(mockSnapshot);

      const creature = await repository.findById('test-creature-123');

      expect(creature).toBeDefined();
      expect(creature?.id).toBe('test-creature-123');
      expect(creature?.name).toBe('Fire Dragon');
    });

    it('should return null when creature not found', async () => {
      mockDoc.get.mockResolvedValueOnce({ exists: false });

      const creature = await repository.findById('nonexistent');

      expect(creature).toBeNull();
    });

    it('should throw error on query failure', async () => {
      mockDoc.get.mockRejectedValueOnce(new Error('Firestore error'));

      await expect(repository.findById('test-id')).rejects.toThrow('Failed to find creature');
    });
  });

  describe('findByOwner', () => {
    it('should return creatures for owner', async () => {
      const mockDocs = [
        {
          id: 'creature-1',
          data: () => ({
            ownerId: 'demo-player1',
            name: 'Dragon 1',
            createdAt: { toDate: () => new Date() },
            generationJobId: 'job-1',
            inputType: 'text',
            species: 'Dragon',
            primaryRole: 'Tank',
            combatAttributes: mockCreatureInput.combatAttributes,
            abilities: [],
            physicalDescription: 'Desc',
            animations: {},
            sprites: mockCreatureInput.sprites,
            generationTimeMs: 1000,
            version: '1.0.0'
          })
        },
        {
          id: 'creature-2',
          data: () => ({
            ownerId: 'demo-player1',
            name: 'Dragon 2',
            createdAt: { toDate: () => new Date() },
            generationJobId: 'job-2',
            inputType: 'text',
            species: 'Dragon',
            primaryRole: 'DPS',
            combatAttributes: mockCreatureInput.combatAttributes,
            abilities: [],
            physicalDescription: 'Desc',
            animations: {},
            sprites: mockCreatureInput.sprites,
            generationTimeMs: 2000,
            version: '1.0.0'
          })
        }
      ];

      mockQuery.get.mockResolvedValueOnce({ docs: mockDocs });

      const creatures = await repository.findByOwner('demo-player1', 50, 0);

      expect(creatures).toHaveLength(2);
      expect(creatures[0].name).toBe('Dragon 1');
      expect(creatures[1].name).toBe('Dragon 2');
    });

    it('should return empty array when no creatures found', async () => {
      mockQuery.get.mockResolvedValueOnce({ docs: [] });

      const creatures = await repository.findByOwner('demo-player2');

      expect(creatures).toEqual([]);
    });
  });

  describe('findByIds', () => {
    it('should return empty array for empty input', async () => {
      const creatures = await repository.findByIds([], 'demo-player1');

      expect(creatures).toEqual([]);
    });

    it('should find creatures by IDs', async () => {
      const mockDocs = [
        {
          id: 'creature-1',
          data: () => ({
            ownerId: 'demo-player1',
            name: 'Dragon 1',
            createdAt: { toDate: () => new Date() },
            generationJobId: 'job-1',
            inputType: 'text',
            species: 'Dragon',
            primaryRole: 'Tank',
            combatAttributes: mockCreatureInput.combatAttributes,
            abilities: [],
            physicalDescription: 'Desc',
            animations: {},
            sprites: mockCreatureInput.sprites,
            generationTimeMs: 1000,
            version: '1.0.0'
          })
        }
      ];

      mockQuery.get.mockResolvedValueOnce({ docs: mockDocs });

      const creatures = await repository.findByIds(['creature-1'], 'demo-player1');

      expect(creatures).toHaveLength(1);
      expect(creatures[0].id).toBe('creature-1');
    });

    it('should handle chunks for large ID arrays', async () => {
      const ids = Array.from({ length: 50 }, (_, i) => `creature-${i}`);

      mockQuery.get.mockResolvedValue({ docs: [] });

      await repository.findByIds(ids, 'demo-player1');

      // Should be called twice (30 + 20)
      expect(mockQuery.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('delete', () => {
    it('should delete creature by ID', async () => {
      await repository.delete('test-creature-123');

      expect(mockDoc.delete).toHaveBeenCalled();
    });

    it('should throw error on deletion failure', async () => {
      mockDoc.delete.mockRejectedValueOnce(new Error('Firestore error'));

      await expect(repository.delete('test-id')).rejects.toThrow('Failed to delete creature');
    });
  });

  describe('update', () => {
    it('should update creature document', async () => {
      await repository.update('test-creature-123', { name: 'Updated Dragon' });

      expect(mockDoc.update).toHaveBeenCalledWith({ name: 'Updated Dragon' });
    });

    it('should remove id from updates', async () => {
      await repository.update('test-creature-123', { id: 'should-be-removed', name: 'Updated' } as any);

      expect(mockDoc.update).toHaveBeenCalledWith({ name: 'Updated' });
      expect(mockDoc.update).not.toHaveBeenCalledWith(expect.objectContaining({ id: expect.anything() }));
    });
  });

  describe('exists', () => {
    it('should return true when creature exists', async () => {
      mockDoc.get.mockResolvedValueOnce({ exists: true });

      const exists = await repository.exists('test-creature-123');

      expect(exists).toBe(true);
    });

    it('should return false when creature does not exist', async () => {
      mockDoc.get.mockResolvedValueOnce({ exists: false });

      const exists = await repository.exists('nonexistent');

      expect(exists).toBe(false);
    });

    it('should return false on error', async () => {
      mockDoc.get.mockRejectedValueOnce(new Error('Firestore error'));

      const exists = await repository.exists('test-id');

      expect(exists).toBe(false);
    });
  });
});
