/**
 * Vitest Test Setup
 *
 * Configures test environment for React component testing.
 */

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock PixiJS for unit tests (PixiJS requires WebGL/Canvas which isn't available in test environment)
vi.mock('pixi.js', async () => {
  const mockTexture = {
    width: 100,
    height: 100,
    destroy: vi.fn(),
  };

  const mockSprite = {
    x: 0,
    y: 0,
    anchor: {
      set: vi.fn(),
    },
    scale: {
      set: vi.fn(),
      x: 1,
      y: 1,
    },
    parent: null,
    destroy: vi.fn(),
  };

  // Create a factory for AnimatedSprite to ensure each instance is unique and mutable
  const createMockAnimatedSprite = (textures: any[]) => ({
    x: 0,
    y: 0,
    anchor: {
      set: vi.fn(),
    },
    scale: {
      set: vi.fn(function(this: any, x: number, y: number) {
        this.x = x;
        this.y = y;
      }),
      x: 1,
      y: 1,
    },
    parent: null,
    destroy: vi.fn(),
    animationSpeed: 0.1,
    loop: true,
    playing: true,
    onComplete: undefined,
    play: vi.fn(),
    stop: vi.fn(),
    gotoAndPlay: vi.fn(),
    gotoAndStop: vi.fn(),
    textures,
  });

  return {
    Application: class MockApplication {
      canvas = {
        width: 800,
        height: 600,
        style: {},
      };
      stage = {
        addChild: vi.fn(),
        removeChild: vi.fn(),
        children: [],
        on: vi.fn(),
        off: vi.fn(),
        emit: vi.fn(),
        eventMode: 'static',
        hitArea: null,
        cursor: 'auto',
      };
      renderer = {
        view: {
          style: {},
          width: 800,
          height: 600,
        },
        resize: vi.fn(),
        render: vi.fn(),
      };
      screen = {
        width: 800,
        height: 600,
      };
      ticker = {
        add: vi.fn(),
        remove: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      async init() {
        return Promise.resolve();
      }
      destroy() {}
    },
    Container: class MockContainer {
      children = [];
      x = 0;
      y = 0;
      alpha = 1.0;
      destroyed = false;
      addChild(...children: any[]) {
        this.children.push(...children);
        children.forEach(child => {
          child.parent = this;
        });
      }
      removeChild(child: any) {
        const index = this.children.indexOf(child);
        if (index > -1) {
          this.children.splice(index, 1);
          child.parent = null;
        }
      }
      removeChildren() {
        this.children.forEach(child => {
          child.parent = null;
        });
        this.children = [];
      }
      destroy() {
        this.destroyed = true;
      }
    },
    Graphics: class MockGraphics {
      x = 0;
      y = 0;
      parent = null;
      destroyed = false;
      circle() { return this; }
      fill() { return this; }
      rect() { return this; }
      stroke() { return this; }
      poly() { return this; }
      moveTo() { return this; }
      lineTo() { return this; }
      closePath() { return this; }
      clear() { return this; }
      destroy() {
        this.destroyed = true;
      }
    },
    Sprite: class MockSprite {
      constructor() {
        return { ...mockSprite };
      }
    },
    AnimatedSprite: class MockAnimatedSprite {
      constructor(textures: any[]) {
        return createMockAnimatedSprite(textures);
      }
    },
    Texture: class MockTexture {
      static from() {
        return mockTexture;
      }
      constructor() {
        return mockTexture;
      }
    },
    Text: class MockText {
      text: string;
      anchor: { set: any; x: number; y: number };
      x: number = 0;
      y: number = 0;
      destroyed: boolean = false;
      style: any;

      constructor(config: any) {
        this.text = config.text || '';
        this.style = config.style || {};
        this.anchor = {
          set: vi.fn((x: number, y?: number) => {
            this.anchor.x = x;
            this.anchor.y = y !== undefined ? y : x;
          }),
          x: 0.5,
          y: 0.5,
        };
      }

      destroy() {
        this.destroyed = true;
      }
    },
    Assets: {
      load: vi.fn((path: string) => Promise.resolve(mockTexture)),
      loadBundle: vi.fn(() => Promise.resolve({})),
    },
  };
});
