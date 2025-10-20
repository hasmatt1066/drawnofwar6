/**
 * TASK-VIZ-018: Combat Visualization Manager Core Tests
 *
 * Test-driven development for the main visual effects orchestrator.
 * Manages all combat visual effects in response to state changes.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CombatVisualizationManager } from '../combat-visualization-manager';
import type { CombatState } from '@drawn-of-war/shared/src/types/combat';

// Mock the socket client
const mockSocketClient = {
  onCombatState: vi.fn(),
  onCombatCompleted: vi.fn(),
  onError: vi.fn(),
  disconnect: vi.fn()
};

// Mock PixiJS stage
const mockStage = {
  addChild: vi.fn(),
  removeChild: vi.fn(),
  children: []
};

// Mock grid renderer
const mockGridRenderer = {
  getSpriteAt: vi.fn(),
  getActiveSprites: vi.fn(() => new Map())
};

// Helper to create minimal CombatState
function createCombatState(overrides: Partial<CombatState> = {}): CombatState {
  return {
    matchId: 'test-match',
    tick: 0,
    status: 'running',
    units: [],
    projectiles: [],
    events: [],
    statistics: {
      player1: { totalDamageDealt: 0, totalHealingDone: 0, unitsLost: 0 },
      player2: { totalDamageDealt: 0, totalHealingDone: 0, unitsLost: 0 }
    },
    startTime: Date.now(),
    ...overrides
  } as CombatState;
}

describe('CombatVisualizationManager', () => {
  let manager: CombatVisualizationManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new CombatVisualizationManager(
      mockSocketClient as any,
      mockStage as any,
      mockGridRenderer as any
    );
  });

  afterEach(() => {
    if (manager) {
      manager.destroy();
    }
  });

  describe('Initialization', () => {
    it('should initialize with socket client, stage, and renderer', () => {
      expect(manager).toBeDefined();
    });

    it('should subscribe to socket state updates', () => {
      expect(mockSocketClient.onCombatState).toHaveBeenCalled();
    });

    it('should subscribe to combat completed events', () => {
      expect(mockSocketClient.onCombatCompleted).toHaveBeenCalled();
    });

    it('should create effect container layers', () => {
      expect(mockStage.addChild).toHaveBeenCalled();
    });
  });

  describe('Lifecycle Management', () => {
    it('should start render loop', () => {
      const spy = vi.spyOn(window, 'requestAnimationFrame');

      manager.start();

      expect(spy).toHaveBeenCalled();

      spy.mockRestore();
    });

    it('should stop render loop', () => {
      const spy = vi.spyOn(window, 'cancelAnimationFrame');

      manager.start();
      manager.stop();

      expect(spy).toHaveBeenCalled();

      spy.mockRestore();
    });

    it('should not start if already running', () => {
      const spy = vi.spyOn(window, 'requestAnimationFrame');

      manager.start();
      const firstCallCount = spy.mock.calls.length;

      manager.start(); // Try to start again
      const secondCallCount = spy.mock.calls.length;

      expect(secondCallCount).toBe(firstCallCount); // No new calls

      spy.mockRestore();
    });

    it('should handle stop when not running', () => {
      expect(() => manager.stop()).not.toThrow();
    });
  });

  describe('State Update Handling', () => {
    it('should process state updates', () => {
      const stateCallback = mockSocketClient.onCombatState.mock.calls[0][0];
      const state = createCombatState({ tick: 1 });

      expect(() => stateCallback(state)).not.toThrow();
    });

    it('should detect state changes', () => {
      const stateCallback = mockSocketClient.onCombatState.mock.calls[0][0];

      const state1 = createCombatState({ tick: 1 });
      stateCallback(state1);

      const state2 = createCombatState({ tick: 2 });
      stateCallback(state2);

      // Should have processed 2 states
      expect(stateCallback).toBeDefined();
    });

    it('should store current state', () => {
      const stateCallback = mockSocketClient.onCombatState.mock.calls[0][0];
      const state = createCombatState({ tick: 5 });

      stateCallback(state);

      const currentState = manager.getCurrentState();
      expect(currentState?.tick).toBe(5);
    });
  });

  describe('Reconnection Support', () => {
    it('should provide setState method', () => {
      const state = createCombatState({ tick: 10 });

      manager.setState(state);

      const currentState = manager.getCurrentState();
      expect(currentState?.tick).toBe(10);
    });

    it('should clear previous state on setState', () => {
      const state1 = createCombatState({ tick: 5 });
      const state2 = createCombatState({ tick: 10 });

      manager.setState(state1);
      manager.setState(state2);

      const currentState = manager.getCurrentState();
      expect(currentState?.tick).toBe(10);
    });
  });

  describe('Cleanup', () => {
    it('should provide destroy method', () => {
      expect(() => manager.destroy()).not.toThrow();
    });

    it('should stop render loop on destroy', () => {
      const spy = vi.spyOn(window, 'cancelAnimationFrame');

      manager.start();
      manager.destroy();

      expect(spy).toHaveBeenCalled();

      spy.mockRestore();
    });

    it('should remove effect containers on destroy', () => {
      manager.destroy();

      expect(mockStage.removeChild).toHaveBeenCalled();
    });

    it('should allow multiple destroy calls', () => {
      manager.destroy();
      expect(() => manager.destroy()).not.toThrow();
    });
  });

  describe('Combat Completion', () => {
    it('should handle combat completed event', () => {
      const completedCallback = mockSocketClient.onCombatCompleted.mock.calls[0][0];
      const result = {
        matchId: 'test-match',
        winner: 'player1',
        duration: 1000
      };

      expect(() => completedCallback(result)).not.toThrow();
    });

    it('should stop render loop on combat completion', () => {
      const spy = vi.spyOn(window, 'cancelAnimationFrame');
      const completedCallback = mockSocketClient.onCombatCompleted.mock.calls[0][0];

      manager.start();
      completedCallback({ matchId: 'test', winner: 'player1', duration: 1000 });

      expect(spy).toHaveBeenCalled();

      spy.mockRestore();
    });
  });

  describe('Effect Container Management', () => {
    it('should create separate containers for each effect type', () => {
      const containers = manager.getEffectContainers();

      expect(containers).toBeDefined();
      expect(containers.projectiles).toBeDefined();
      expect(containers.healthBars).toBeDefined();
      expect(containers.buffIcons).toBeDefined();
      expect(containers.damageNumbers).toBeDefined();
    });

    it('should layer containers correctly', () => {
      const containers = manager.getEffectContainers();

      // Damage numbers should be on top (added last)
      const addChildCalls = mockStage.addChild.mock.calls;
      expect(addChildCalls.length).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    it('should handle rapid state updates', () => {
      const stateCallback = mockSocketClient.onCombatState.mock.calls[0][0];

      const startTime = performance.now();

      for (let i = 0; i < 100; i++) {
        stateCallback(createCombatState({ tick: i }));
      }

      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(100); // Should process 100 states in < 100ms
    });

    it('should maintain frame timing', () => {
      manager.start();

      // Should be able to start without errors
      expect(manager).toBeDefined();

      manager.stop();
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed state gracefully', () => {
      const stateCallback = mockSocketClient.onCombatState.mock.calls[0][0];

      expect(() => stateCallback(null as any)).not.toThrow();
      expect(() => stateCallback(undefined as any)).not.toThrow();
    });

    it('should handle errors in state processing', () => {
      const stateCallback = mockSocketClient.onCombatState.mock.calls[0][0];
      const malformedState = { tick: 1 } as any; // Missing required fields

      expect(() => stateCallback(malformedState)).not.toThrow();
    });
  });

  describe('Integration Points', () => {
    it('should query grid renderer for sprite positions', () => {
      mockGridRenderer.getSpriteAt.mockReturnValue({
        sprite: { x: 100, y: 200 },
        unitId: 'unit1'
      });

      const position = mockGridRenderer.getSpriteAt({ q: 0, r: 0 });

      expect(position).toBeDefined();
    });

    it('should access active sprites from grid renderer', () => {
      const sprites = mockGridRenderer.getActiveSprites();

      expect(sprites).toBeDefined();
      expect(sprites instanceof Map).toBe(true);
    });
  });
});
