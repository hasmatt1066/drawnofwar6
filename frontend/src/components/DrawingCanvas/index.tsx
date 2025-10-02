/**
 * Drawing Canvas Component
 *
 * Interactive drawing canvas with brush tools, colors, and undo/redo.
 * Uses react-canvas-draw for drawing functionality.
 * Size: 512x512px to match AI model input requirements.
 */

import React, { useRef, useState } from 'react';
import CanvasDraw from 'react-canvas-draw';
import { usePromptBuilderStore } from '@/stores/usePromptBuilderStore';
import { Toolbar } from './Toolbar';
import { BrushSizeSelector } from './BrushSizeSelector';
import { ColorPicker } from './ColorPicker';
import styles from './DrawingCanvas.module.css';

export type BrushSize = 'small' | 'medium' | 'large';
export type Tool = 'brush' | 'eraser';

const BRUSH_SIZES: Record<BrushSize, number> = {
  small: 2,
  medium: 6,
  large: 12
};

const CANVAS_SIZE = 512;

export const DrawingCanvas: React.FC = () => {
  const canvasRef = useRef<CanvasDraw>(null);
  const setCanvasData = usePromptBuilderStore((state) => state.setCanvasData);

  const [brushColor, setBrushColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState<BrushSize>('medium');
  const [tool, setTool] = useState<Tool>('brush');

  const handleUndo = () => {
    if (canvasRef.current) {
      canvasRef.current.undo();
      updateCanvasData();
    }
  };

  const handleRedo = () => {
    if (canvasRef.current) {
      // react-canvas-draw doesn't have built-in redo, so we'll manage history manually
      // For MVP, we'll skip redo and just support undo
    }
  };

  const handleClear = () => {
    if (canvasRef.current) {
      canvasRef.current.clear();
      setCanvasData(null);
    }
  };

  const handleColorChange = (color: string) => {
    setBrushColor(color);
    if (tool === 'eraser') {
      setTool('brush'); // Switch back to brush when selecting color
    }
  };

  const handleBrushSizeChange = (size: BrushSize) => {
    setBrushSize(size);
  };

  const handleToolChange = (newTool: Tool) => {
    setTool(newTool);
  };

  const updateCanvasData = () => {
    if (canvasRef.current) {
      // Get canvas data as base64 PNG
      const canvas = canvasRef.current.canvasContainer.children[1] as HTMLCanvasElement;
      canvas.toBlob((blob) => {
        if (blob) {
          const reader = new FileReader();
          reader.onloadend = () => {
            setCanvasData(reader.result as string);
          };
          reader.readAsDataURL(blob);
        }
      }, 'image/png');
    }
  };

  // Determine brush color based on tool
  const effectiveBrushColor = tool === 'eraser' ? '#FFFFFF' : brushColor;

  return (
    <div className={styles.container}>
      <div className={styles.canvasWrapper}>
        <CanvasDraw
          ref={canvasRef}
          canvasWidth={CANVAS_SIZE}
          canvasHeight={CANVAS_SIZE}
          brushColor={effectiveBrushColor}
          brushRadius={BRUSH_SIZES[brushSize]}
          lazyRadius={0} // Disable lag for responsive drawing
          hideGrid
          backgroundColor="#FFFFFF"
          onChange={updateCanvasData}
          className={styles.canvas}
          enablePanAndZoom={false}
          disabled={false}
        />
      </div>

      <div className={styles.controls}>
        <Toolbar
          tool={tool}
          onToolChange={handleToolChange}
          onUndo={handleUndo}
          onClear={handleClear}
        />

        <BrushSizeSelector
          size={brushSize}
          onSizeChange={handleBrushSizeChange}
        />

        <ColorPicker
          color={brushColor}
          onColorChange={handleColorChange}
          disabled={tool === 'eraser'}
        />
      </div>
    </div>
  );
};
