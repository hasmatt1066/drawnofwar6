/**
 * Text Prompt Input Component
 *
 * Text description input for creature generation.
 * Integrated with multi-modal prompt builder.
 */

import React from 'react';
import { usePromptBuilderStore } from '@/stores/usePromptBuilderStore';
import styles from './TextPromptInput.module.css';

const MAX_CHARACTERS = 500;

export const TextPromptInput: React.FC = () => {
  const textDescription = usePromptBuilderStore((state) => state.textDescription);
  const setTextDescription = usePromptBuilderStore((state) => state.setTextDescription);

  const charactersRemaining = MAX_CHARACTERS - textDescription.length;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= MAX_CHARACTERS) {
      setTextDescription(value);
    }
  };

  return (
    <div className={styles.container}>
      <label htmlFor="creature-description" className={styles.label}>
        Describe Your Creature
      </label>

      <textarea
        id="creature-description"
        className={styles.textarea}
        value={textDescription}
        onChange={handleChange}
        placeholder="Describe the creature you want to create... (e.g., 'A fierce dragon with emerald scales and golden eyes, breathing fire')"
        rows={8}
        maxLength={MAX_CHARACTERS}
      />

      <div className={styles.footer}>
        <div className={styles.counter}>
          <span className={charactersRemaining < 50 ? styles.counterWarning : ''}>
            {charactersRemaining} characters remaining
          </span>
        </div>

        {textDescription.length > 0 && (
          <button
            type="button"
            onClick={() => setTextDescription('')}
            className={styles.clearButton}
          >
            Clear
          </button>
        )}
      </div>

      {textDescription.length > 0 && textDescription.length < 10 && (
        <div className={styles.hint}>
          💡 Tip: Provide more details for better results (at least 10 characters)
        </div>
      )}
    </div>
  );
};
