/**
 * Input Method Selector Component
 *
 * Allows users to choose between three input methods for creature creation:
 * - Draw It: Canvas drawing interface
 * - Describe It: Text description input
 * - Upload It: Image file upload
 */

import React from 'react';
import { usePromptBuilderStore, type InputMethod } from '@/stores/usePromptBuilderStore';
import styles from './InputMethodSelector.module.css';

interface InputMethodOption {
  id: InputMethod;
  icon: string;
  label: string;
  ariaLabel: string;
}

const inputMethods: InputMethodOption[] = [
  {
    id: 'draw',
    icon: '🎨',
    label: 'Draw It',
    ariaLabel: 'Draw It - Use canvas to draw your creature'
  },
  {
    id: 'text',
    icon: '📝',
    label: 'Describe It',
    ariaLabel: 'Describe It - Write a text description'
  },
  {
    id: 'upload',
    icon: '📤',
    label: 'Upload It',
    ariaLabel: 'Upload It - Upload an image file'
  }
];

export const InputMethodSelector: React.FC = () => {
  const inputMethod = usePromptBuilderStore((state) => state.inputMethod);
  const setInputMethod = usePromptBuilderStore((state) => state.setInputMethod);

  const handleMethodSelect = (method: InputMethod) => {
    setInputMethod(method);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, method: InputMethod) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleMethodSelect(method);
    }
  };

  return (
    <div className={styles.container} role="group" aria-label="Input method selector">
      {inputMethods.map((method) => (
        <button
          key={method.id}
          type="button"
          className={`${styles.button} ${inputMethod === method.id ? styles.active : ''}`}
          onClick={() => handleMethodSelect(method.id)}
          onKeyDown={(e) => handleKeyDown(e, method.id)}
          aria-label={method.ariaLabel}
          aria-pressed={inputMethod === method.id}
          tabIndex={0}
        >
          <span className={styles.icon} aria-hidden="true">
            {method.icon}
          </span>
          <span className={styles.label}>{method.label}</span>
        </button>
      ))}
    </div>
  );
};
