/**
 * Creature Storage Service Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreatureStorageService } from '../creature-storage.service.js';

// Mock Firebase Storage
const mockFile = {
  save: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined)
};

const mockBucket = {
  name: 'test-bucket.appspot.com',
  file: vi.fn().mockReturnValue(mockFile),
  getFiles: vi.fn().mockResolvedValue([[]])
};

vi.mock('../../../config/firebase.config.js', () => ({
  getStorageBucket: () => mockBucket
}));

describe('CreatureStorageService', () => {
  let service: CreatureStorageService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CreatureStorageService();
  });

  describe('Base64 Validation', () => {
    it('should accept valid data URL format', async () => {
      const validDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      await expect(service.uploadMenuSprite('test-creature', validDataUrl)).resolves.toBeDefined();
    });

    it('should accept raw base64 format', async () => {
      const rawBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      await expect(service.uploadMenuSprite('test-creature', rawBase64)).resolves.toBeDefined();
    });

    it('should reject empty base64 data', async () => {
      await expect(service.uploadMenuSprite('test-creature', '')).rejects.toThrow('Base64 data is required');
    });

    it('should reject invalid base64 format', async () => {
      await expect(service.uploadMenuSprite('test-creature', 'not-valid-base64!')).rejects.toThrow('Invalid base64 format');
    });
  });

  describe('Menu Sprite Upload', () => {
    it('should upload menu sprite and return gs:// URL', async () => {
      const base64Data = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const url = await service.uploadMenuSprite('test-creature-123', base64Data);

      expect(url).toBe('gs://test-bucket.appspot.com/creatures/test-creature-123/menu-sprite.png');
      expect(mockBucket.file).toHaveBeenCalledWith('creatures/test-creature-123/menu-sprite.png');
      expect(mockFile.save).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({
          metadata: expect.objectContaining({
            contentType: 'image/png',
            metadata: {
              creatureId: 'test-creature-123',
              spriteType: 'menu'
            }
          })
        })
      );
    });
  });

  describe('Directional Sprite Upload', () => {
    it('should upload directional sprite for each direction', async () => {
      const base64Data = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const directions: ('E' | 'NE' | 'SE')[] = ['E', 'NE', 'SE'];

      for (const dir of directions) {
        const url = await service.uploadDirectionalSprite('test-creature', dir, base64Data);

        expect(url).toBe(`gs://test-bucket.appspot.com/creatures/test-creature/directions/${dir}-sprite.png`);
        expect(mockBucket.file).toHaveBeenCalledWith(`creatures/test-creature/directions/${dir}-sprite.png`);
      }
    });
  });

  describe('Walk Frame Upload', () => {
    it('should upload walk frames with correct naming', async () => {
      const base64Data = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      const url = await service.uploadWalkFrame('test-creature', 'E', 2, base64Data);

      expect(url).toBe('gs://test-bucket.appspot.com/creatures/test-creature/directions/E-walk-2.png');
      expect(mockBucket.file).toHaveBeenCalledWith('creatures/test-creature/directions/E-walk-2.png');
      expect(mockFile.save).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({
          metadata: expect.objectContaining({
            metadata: expect.objectContaining({
              direction: 'E',
              frameIndex: '2'
            })
          })
        })
      );
    });
  });

  describe('Delete Creature Assets', () => {
    it('should delete all files for a creature', async () => {
      const mockFiles = [
        { delete: vi.fn().mockResolvedValue(undefined) },
        { delete: vi.fn().mockResolvedValue(undefined) },
        { delete: vi.fn().mockResolvedValue(undefined) }
      ];

      mockBucket.getFiles.mockResolvedValueOnce([mockFiles]);

      await service.deleteCreatureAssets('test-creature');

      expect(mockBucket.getFiles).toHaveBeenCalledWith({ prefix: 'creatures/test-creature/' });
      expect(mockFiles[0].delete).toHaveBeenCalled();
      expect(mockFiles[1].delete).toHaveBeenCalled();
      expect(mockFiles[2].delete).toHaveBeenCalled();
    });

    it('should handle no files found gracefully', async () => {
      mockBucket.getFiles.mockResolvedValueOnce([[]]);

      await expect(service.deleteCreatureAssets('test-creature')).resolves.not.toThrow();
    });

    it('should throw error if deletion fails', async () => {
      mockBucket.getFiles.mockRejectedValueOnce(new Error('Storage error'));

      await expect(service.deleteCreatureAssets('test-creature')).rejects.toThrow('Failed to delete creature assets');
    });
  });

  describe('Batch Upload All Sprites', () => {
    it('should upload all sprites in parallel', async () => {
      const sprites = {
        menuSprite: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        directions: {
          E: {
            sprite: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            walkFrames: Array(4).fill('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')
          },
          NE: {
            sprite: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            walkFrames: Array(4).fill('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')
          },
          SE: {
            sprite: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            walkFrames: Array(4).fill('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')
          }
        }
      };

      const result = await service.uploadAllCreatureSprites('test-creature', sprites);

      // Verify structure
      expect(result.menuSprite).toContain('menu-sprite.png');
      expect(result.directions.E.sprite).toContain('E-sprite.png');
      expect(result.directions.E.walkFrames).toHaveLength(4);
      expect(result.directions.NE.walkFrames).toHaveLength(4);
      expect(result.directions.SE.walkFrames).toHaveLength(4);

      // Verify parallel execution (should be called 1 + 3 + (3*4) = 16 times)
      expect(mockFile.save).toHaveBeenCalledTimes(16);
    });

    it('should cleanup on upload failure', async () => {
      const sprites = {
        menuSprite: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        directions: {
          E: {
            sprite: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            walkFrames: Array(4).fill('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')
          },
          NE: {
            sprite: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            walkFrames: Array(4).fill('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')
          },
          SE: {
            sprite: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            walkFrames: Array(4).fill('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')
          }
        }
      };

      // Make upload fail
      mockFile.save.mockRejectedValueOnce(new Error('Upload failed'));
      mockBucket.getFiles.mockResolvedValueOnce([[]]);

      await expect(service.uploadAllCreatureSprites('test-creature', sprites)).rejects.toThrow('Failed to upload creature sprites');

      // Verify cleanup was attempted
      expect(mockBucket.getFiles).toHaveBeenCalledWith({ prefix: 'creatures/test-creature/' });
    });
  });
});
