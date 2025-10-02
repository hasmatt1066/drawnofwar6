/**
 * Preview Panel Component
 *
 * Displays uploaded image preview with file info and clear option.
 */

import React from 'react';
import styles from './ImageUpload.module.css';

interface PreviewPanelProps {
  imageUrl: string;
  fileName: string;
  fileSize: number;
  onClear: () => void;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const PreviewPanel: React.FC<PreviewPanelProps> = ({
  imageUrl,
  fileName,
  fileSize,
  onClear
}) => {
  return (
    <div className={styles.previewPanel}>
      <div className={styles.previewHeader}>
        <h3 className={styles.previewTitle}>Uploaded Image</h3>
        <button
          type="button"
          onClick={onClear}
          className={styles.clearButton}
          aria-label="Clear uploaded image"
        >
          ✕
        </button>
      </div>

      <div className={styles.previewImageWrapper}>
        <img
          src={imageUrl}
          alt="Uploaded preview"
          className={styles.previewImage}
        />
      </div>

      <div className={styles.previewInfo}>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>File:</span>
          <span className={styles.infoValue}>{fileName}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Size:</span>
          <span className={styles.infoValue}>{formatFileSize(fileSize)}</span>
        </div>
      </div>
    </div>
  );
};
