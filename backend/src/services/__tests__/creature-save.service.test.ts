/**
 * Tests for Creature Save Service
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Queue, Job } from 'bullmq';
import { CreatureSaveService } from '../creature-save.service.js';
import type { GenerationResult } from '../../types/generation.js';
import type { CreatureDocument } from '@drawn-of-war/shared';

// Mock dependencies
vi.mock('../transform/generation-to-creature.service.js', () => ({
  getGenerationToCreatureTransformer: () => ({
    transform: vi.fn()
  })
}));

vi.mock('../storage/creature-storage.service.js', () => ({
  getCreatureStorageService: () => ({
    uploadAllCreatureSprites: vi.fn(),
    deleteCreatureAssets: vi.fn()
  })
}));

vi.mock('../../repositories/creature.repository.js', () => ({
  getCreatureRepository: () => ({
    create: vi.fn(),
    update: vi.fn(),
    findById: vi.fn(),
    delete: vi.fn()
  })
}));

describe('CreatureSaveService', () => {
  let service: CreatureSaveService;
  let mockQueue: Queue;
  let mockJob: Job;
  let mockTransformer: any;
  let mockStorageService: any;
  let mockRepository: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock queue
    mockQueue = {
      getJob: vi.fn()
    } as any;

    // Import mocked services
    const { getGenerationToCreatureTransformer } = require('../transform/generation-to-creature.service.js');
    const { getCreatureStorageService } = require('../storage/creature-storage.service.js');
    const { getCreatureRepository } = require('../../repositories/creature.repository.js');

    mockTransformer = getGenerationToCreatureTransformer();
    mockStorageService = getCreatureStorageService();
    mockRepository = getCreatureRepository();

    // Create service
    service = new CreatureSaveService(mockQueue);
  });

  describe('saveCreature', () => {
    const mockGenerationResult: GenerationResult = {
      inputType: 'text',
      textDescription: 'fierce dragon warrior',
      spriteImageBase64: 'base64-menu-sprite',
      battlefieldDirectionalViews: {
        E: {
          sprite: 'base64-e-sprite',
          walkFrames: ['e-frame-1', 'e-frame-2', 'e-frame-3', 'e-frame-4']
        },
        NE: {
          sprite: 'base64-ne-sprite',
          walkFrames: ['ne-frame-1', 'ne-frame-2', 'ne-frame-3', 'ne-frame-4']
        },
        SE: {
          sprite: 'base64-se-sprite',
          walkFrames: ['se-frame-1', 'se-frame-2', 'se-frame-3', 'se-frame-4']
        }
      },
      claudeAnalysis: {
        concept: 'fierce dragon warrior',
        race: 'dragon',
        class: 'warrior',
        abilities: ['Fire Breath', 'Claw Attack']
      },
      animations: {
        animationSet: {
          idle: 'idle_default',
          walk: 'walk_default',
          attack: 'attack_melee_default',
          death: 'death_default',
          additional: ['hit_default', 'run_default']
        },
        totalAnimations: 6,
        mappedFromClaude: 2,
        filledWithDefaults: 4,
        confidence: 0.9
      },
      generatedAt: new Date(),
      processingTimeMs: 5000
    };

    it('should successfully save a creature', async () => {
      // Mock job
      mockJob = {
        id: 'job-123',
        getState: vi.fn().mockResolvedValue('completed'),
        returnvalue: mockGenerationResult
      } as any;

      (mockQueue.getJob as any).mockResolvedValue(mockJob);

      // Mock transformer
      const mockCreatureInput = {
        ownerId: 'demo-player1',
        name: 'Fierce Dragon Warrior',
        generationJobId: 'job-123',
        inputType: 'text',
        textDescription: 'fierce dragon warrior',
        concept: 'fierce dragon warrior',
        race: 'dragon',
        class: 'warrior',
        abilities: ['Fire Breath', 'Claw Attack'],
        combatAttributes: [],
        animations: {},
        sprites: {
          menuSprite: '',
          directions: {
            E: { sprite: '', walkFrames: [] },
            NE: { sprite: '', walkFrames: [] },
            SE: { sprite: '', walkFrames: [] }
          }
        },
        generationTimeMs: 5000,
        version: '1.0.0'
      };

      mockTransformer.transform.mockReturnValue(mockCreatureInput);

      // Mock repository create
      const mockCreatedDoc: CreatureDocument = {
        ...mockCreatureInput,
        id: 'creature-123',
        createdAt: new Date()
      };

      mockRepository.create.mockResolvedValue(mockCreatedDoc);

      // Mock storage upload
      const mockSpriteUrls = {
        menuSprite: 'gs://bucket/creatures/creature-123/menu-sprite.png',
        directions: {
          E: {
            sprite: 'gs://bucket/creatures/creature-123/directions/E-sprite.png',
            walkFrames: [
              'gs://bucket/creatures/creature-123/directions/E-walk-0.png',
              'gs://bucket/creatures/creature-123/directions/E-walk-1.png',
              'gs://bucket/creatures/creature-123/directions/E-walk-2.png',
              'gs://bucket/creatures/creature-123/directions/E-walk-3.png'
            ]
          },
          NE: {
            sprite: 'gs://bucket/creatures/creature-123/directions/NE-sprite.png',
            walkFrames: [
              'gs://bucket/creatures/creature-123/directions/NE-walk-0.png',
              'gs://bucket/creatures/creature-123/directions/NE-walk-1.png',
              'gs://bucket/creatures/creature-123/directions/NE-walk-2.png',
              'gs://bucket/creatures/creature-123/directions/NE-walk-3.png'
            ]
          },
          SE: {
            sprite: 'gs://bucket/creatures/creature-123/directions/SE-sprite.png',
            walkFrames: [
              'gs://bucket/creatures/creature-123/directions/SE-walk-0.png',
              'gs://bucket/creatures/creature-123/directions/SE-walk-1.png',
              'gs://bucket/creatures/creature-123/directions/SE-walk-2.png',
              'gs://bucket/creatures/creature-123/directions/SE-walk-3.png'
            ]
          }
        }
      };

      mockStorageService.uploadAllCreatureSprites.mockResolvedValue(mockSpriteUrls);

      // Mock repository update and findById
      mockRepository.update.mockResolvedValue(undefined);

      const finalCreature: CreatureDocument = {
        ...mockCreatedDoc,
        sprites: mockSpriteUrls
      };

      mockRepository.findById.mockResolvedValue(finalCreature);

      // Execute
      const result = await service.saveCreature({
        jobId: 'job-123',
        ownerId: 'demo-player1'
      });

      // Assertions
      expect(result.success).toBe(true);
      expect(result.creatureId).toBe('creature-123');
      expect(result.creature.id).toBe('creature-123');
      expect(result.creature.sprites.menuSprite).toBe('gs://bucket/creatures/creature-123/menu-sprite.png');

      // Verify call sequence
      expect(mockQueue.getJob).toHaveBeenCalledWith('job-123');
      expect(mockTransformer.transform).toHaveBeenCalledWith(
        mockGenerationResult,
        'demo-player1',
        'job-123'
      );
      expect(mockRepository.create).toHaveBeenCalledWith(mockCreatureInput);
      expect(mockStorageService.uploadAllCreatureSprites).toHaveBeenCalledWith(
        'creature-123',
        {
          menuSprite: 'base64-menu-sprite',
          directions: {
            E: {
              sprite: 'base64-e-sprite',
              walkFrames: ['e-frame-1', 'e-frame-2', 'e-frame-3', 'e-frame-4']
            },
            NE: {
              sprite: 'base64-ne-sprite',
              walkFrames: ['ne-frame-1', 'ne-frame-2', 'ne-frame-3', 'ne-frame-4']
            },
            SE: {
              sprite: 'base64-se-sprite',
              walkFrames: ['se-frame-1', 'se-frame-2', 'se-frame-3', 'se-frame-4']
            }
          }
        }
      );
      expect(mockRepository.update).toHaveBeenCalledWith('creature-123', {
        sprites: mockSpriteUrls
      });
      expect(mockRepository.findById).toHaveBeenCalledWith('creature-123');
    });

    it('should throw error if job not found', async () => {
      (mockQueue.getJob as any).mockResolvedValue(null);

      await expect(
        service.saveCreature({
          jobId: 'non-existent-job',
          ownerId: 'demo-player1'
        })
      ).rejects.toThrow('Job non-existent-job not found in queue');
    });

    it('should throw error if job not completed', async () => {
      mockJob = {
        id: 'job-123',
        getState: vi.fn().mockResolvedValue('active')
      } as any;

      (mockQueue.getJob as any).mockResolvedValue(mockJob);

      await expect(
        service.saveCreature({
          jobId: 'job-123',
          ownerId: 'demo-player1'
        })
      ).rejects.toThrow('Job job-123 is not completed (current state: active)');
    });

    it('should throw error if job has no return value', async () => {
      mockJob = {
        id: 'job-123',
        getState: vi.fn().mockResolvedValue('completed'),
        returnvalue: null
      } as any;

      (mockQueue.getJob as any).mockResolvedValue(mockJob);

      await expect(
        service.saveCreature({
          jobId: 'job-123',
          ownerId: 'demo-player1'
        })
      ).rejects.toThrow('Job job-123 has no return value');
    });

    it('should throw error if generation result missing menu sprite', async () => {
      const invalidResult = {
        ...mockGenerationResult,
        spriteImageBase64: undefined
      };

      mockJob = {
        id: 'job-123',
        getState: vi.fn().mockResolvedValue('completed'),
        returnvalue: invalidResult
      } as any;

      (mockQueue.getJob as any).mockResolvedValue(mockJob);

      const mockCreatureInput = {
        ownerId: 'demo-player1',
        name: 'Test Creature',
        generationJobId: 'job-123',
        inputType: 'text',
        concept: 'test',
        race: 'test',
        class: 'test',
        abilities: [],
        combatAttributes: [],
        animations: {},
        sprites: {
          menuSprite: '',
          directions: {
            E: { sprite: '', walkFrames: [] },
            NE: { sprite: '', walkFrames: [] },
            SE: { sprite: '', walkFrames: [] }
          }
        },
        generationTimeMs: 5000,
        version: '1.0.0'
      };

      mockTransformer.transform.mockReturnValue(mockCreatureInput);

      const mockCreatedDoc = {
        ...mockCreatureInput,
        id: 'creature-123',
        createdAt: new Date()
      };

      mockRepository.create.mockResolvedValue(mockCreatedDoc);

      await expect(
        service.saveCreature({
          jobId: 'job-123',
          ownerId: 'demo-player1'
        })
      ).rejects.toThrow('Generation result missing menu sprite');

      // Should rollback Firestore document
      expect(mockRepository.delete).toHaveBeenCalledWith('creature-123');
    });

    it('should rollback Firestore document if storage upload fails', async () => {
      mockJob = {
        id: 'job-123',
        getState: vi.fn().mockResolvedValue('completed'),
        returnvalue: mockGenerationResult
      } as any;

      (mockQueue.getJob as any).mockResolvedValue(mockJob);

      const mockCreatureInput = {
        ownerId: 'demo-player1',
        name: 'Test Creature',
        generationJobId: 'job-123',
        inputType: 'text',
        concept: 'test',
        race: 'test',
        class: 'test',
        abilities: [],
        combatAttributes: [],
        animations: {},
        sprites: {
          menuSprite: '',
          directions: {
            E: { sprite: '', walkFrames: [] },
            NE: { sprite: '', walkFrames: [] },
            SE: { sprite: '', walkFrames: [] }
          }
        },
        generationTimeMs: 5000,
        version: '1.0.0'
      };

      mockTransformer.transform.mockReturnValue(mockCreatureInput);

      const mockCreatedDoc = {
        ...mockCreatureInput,
        id: 'creature-123',
        createdAt: new Date()
      };

      mockRepository.create.mockResolvedValue(mockCreatedDoc);

      // Simulate storage upload failure
      mockStorageService.uploadAllCreatureSprites.mockRejectedValue(
        new Error('Storage upload failed')
      );

      await expect(
        service.saveCreature({
          jobId: 'job-123',
          ownerId: 'demo-player1'
        })
      ).rejects.toThrow('Failed to save creature');

      // Should rollback Firestore document
      expect(mockRepository.delete).toHaveBeenCalledWith('creature-123');
    });

    it('should rollback sprites and Firestore if update fails', async () => {
      mockJob = {
        id: 'job-123',
        getState: vi.fn().mockResolvedValue('completed'),
        returnvalue: mockGenerationResult
      } as any;

      (mockQueue.getJob as any).mockResolvedValue(mockJob);

      const mockCreatureInput = {
        ownerId: 'demo-player1',
        name: 'Test Creature',
        generationJobId: 'job-123',
        inputType: 'text',
        concept: 'test',
        race: 'test',
        class: 'test',
        abilities: [],
        combatAttributes: [],
        animations: {},
        sprites: {
          menuSprite: '',
          directions: {
            E: { sprite: '', walkFrames: [] },
            NE: { sprite: '', walkFrames: [] },
            SE: { sprite: '', walkFrames: [] }
          }
        },
        generationTimeMs: 5000,
        version: '1.0.0'
      };

      mockTransformer.transform.mockReturnValue(mockCreatureInput);

      const mockCreatedDoc = {
        ...mockCreatureInput,
        id: 'creature-123',
        createdAt: new Date()
      };

      mockRepository.create.mockResolvedValue(mockCreatedDoc);

      const mockSpriteUrls = {
        menuSprite: 'gs://bucket/creatures/creature-123/menu-sprite.png',
        directions: {
          E: { sprite: 'gs://url', walkFrames: [] },
          NE: { sprite: 'gs://url', walkFrames: [] },
          SE: { sprite: 'gs://url', walkFrames: [] }
        }
      };

      mockStorageService.uploadAllCreatureSprites.mockResolvedValue(mockSpriteUrls);

      // Simulate Firestore update failure
      mockRepository.update.mockRejectedValue(new Error('Firestore update failed'));

      await expect(
        service.saveCreature({
          jobId: 'job-123',
          ownerId: 'demo-player1'
        })
      ).rejects.toThrow('Failed to save creature');

      // Should rollback both sprites and Firestore
      expect(mockStorageService.deleteCreatureAssets).toHaveBeenCalledWith('creature-123');
      expect(mockRepository.delete).toHaveBeenCalledWith('creature-123');
    });
  });
});
