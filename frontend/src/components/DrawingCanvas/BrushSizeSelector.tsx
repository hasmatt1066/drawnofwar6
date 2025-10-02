/**
 * Brush Size Selector Component
 *
 * Allows users to select brush size (small, medium, large).
 */

import React from 'react';
import type { BrushSize } from './index';
import styles from './DrawingCanvas.module.css';

interface BrushSizeSelectorProps {
  size: BrushSize;
  onSizeChange: (size: BrushSize) => void;
}

const SIZES: Array<{ id: BrushSize; label: string; display: string }> = [
  { id: 'small', label: 'Small', display: '●' },
  { id: 'medium', label: 'Medium', display: '⬤' },
  { id: 'large', label: 'Large', display: '⚫' }
];

export const BrushSizeSelector: React.FC<BrushSizeSelectorProps> = ({
  size,
  onSizeChange
}) => {
  return (
    <div className={styles.brushSizeSelector}>
      <label className={styles.label}>Brush Size:</label>
      <div className={styles.sizeButtons}>
        {SIZES.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`${styles.sizeButton} ${size === s.id ? styles.active : ''}`}
            onClick={() => onSizeChange(s.id)}
            aria-label={`${s.label} brush size`}
            title={s.label}
          >
            <span className={styles[`size${s.label}`]}>{s.display}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
