/**
 * Color Picker Component
 *
 * Provides 8 color presets + custom color picker for brush selection.
 */

import React from 'react';
import styles from './DrawingCanvas.module.css';

interface ColorPickerProps {
  color: string;
  onColorChange: (color: string) => void;
  disabled?: boolean;
}

const PRESET_COLORS = [
  { name: 'Black', value: '#000000' },
  { name: 'Red', value: '#FF0000' },
  { name: 'Green', value: '#00FF00' },
  { name: 'Blue', value: '#0000FF' },
  { name: 'Yellow', value: '#FFFF00' },
  { name: 'Purple', value: '#800080' },
  { name: 'Orange', value: '#FFA500' },
  { name: 'Brown', value: '#8B4513' }
];

export const ColorPicker: React.FC<ColorPickerProps> = ({
  color,
  onColorChange,
  disabled = false
}) => {
  return (
    <div className={`${styles.colorPicker} ${disabled ? styles.disabled : ''}`}>
      <label className={styles.label}>Color:</label>

      <div className={styles.presetColors}>
        {PRESET_COLORS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            className={`${styles.colorButton} ${color === preset.value ? styles.active : ''}`}
            style={{ backgroundColor: preset.value }}
            onClick={() => !disabled && onColorChange(preset.value)}
            aria-label={`${preset.name} color`}
            title={preset.name}
            disabled={disabled}
          />
        ))}
      </div>

      <div className={styles.customColorWrapper}>
        <label htmlFor="custom-color" className={styles.customLabel}>
          Custom:
        </label>
        <input
          id="custom-color"
          type="color"
          value={color}
          onChange={(e) => !disabled && onColorChange(e.target.value)}
          className={styles.customColorPicker}
          disabled={disabled}
          aria-label="Custom color picker"
        />
      </div>
    </div>
  );
};
