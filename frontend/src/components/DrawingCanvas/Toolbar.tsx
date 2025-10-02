/**
 * Drawing Toolbar Component
 *
 * Provides tool selection and canvas actions (brush, eraser, undo, clear).
 */

import React from 'react';
import type { Tool } from './index';
import styles from './DrawingCanvas.module.css';

interface ToolbarProps {
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  onUndo: () => void;
  onClear: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  tool,
  onToolChange,
  onUndo,
  onClear
}) => {
  return (
    <div className={styles.toolbar}>
      <div className={styles.toolGroup}>
        <button
          type="button"
          className={`${styles.toolButton} ${tool === 'brush' ? styles.active : ''}`}
          onClick={() => onToolChange('brush')}
          aria-label="Brush tool"
          title="Brush"
        >
          🖌️
        </button>

        <button
          type="button"
          className={`${styles.toolButton} ${tool === 'eraser' ? styles.active : ''}`}
          onClick={() => onToolChange('eraser')}
          aria-label="Eraser tool"
          title="Eraser"
        >
          🧹
        </button>
      </div>

      <div className={styles.toolGroup}>
        <button
          type="button"
          className={styles.toolButton}
          onClick={onUndo}
          aria-label="Undo last stroke"
          title="Undo"
        >
          ↶
        </button>

        <button
          type="button"
          className={`${styles.toolButton} ${styles.dangerButton}`}
          onClick={onClear}
          aria-label="Clear canvas"
          title="Clear"
        >
          🗑️
        </button>
      </div>
    </div>
  );
};
