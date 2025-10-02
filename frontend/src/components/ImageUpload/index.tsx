/**
 * Image Upload Component
 *
 * Drag-and-drop image upload with validation.
 * Accepts PNG/JPG files up to 5MB.
 */

import React, { useState } from 'react';
import { usePromptBuilderStore } from '@/stores/usePromptBuilderStore';
import { DropZone } from './DropZone';
import { PreviewPanel } from './PreviewPanel';
import styles from './ImageUpload.module.css';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
const ACCEPTED_FORMATS = ['image/png', 'image/jpeg', 'image/jpg'];

export const ImageUpload: React.FC = () => {
  const [uploadedImage, setUploadedImage] = usePromptBuilderStore((state) => [
    state.uploadedImage,
    state.setUploadedImage
  ]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validateFile = (file: File): string | null => {
    // Check file type
    if (!ACCEPTED_FORMATS.includes(file.type)) {
      return 'Invalid file format. Please upload a PNG or JPG image.';
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return 'File too large. Maximum size is 5MB.';
    }

    return null;
  };

  const handleFileAccepted = (file: File) => {
    setError(null);

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    // Create preview URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setUploadedImage(file);
  };

  const handleFileRejected = (errorMessage: string) => {
    setError(errorMessage);
    setPreviewUrl(null);
    setUploadedImage(null);
  };

  const handleClear = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setUploadedImage(null);
    setError(null);
  };

  return (
    <div className={styles.container}>
      {!uploadedImage && (
        <DropZone
          onFileAccepted={handleFileAccepted}
          onFileRejected={handleFileRejected}
        />
      )}

      {error && (
        <div className={styles.error} role="alert">
          <span className={styles.errorIcon}>⚠️</span>
          <span className={styles.errorMessage}>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className={styles.errorClose}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {uploadedImage && previewUrl && (
        <PreviewPanel
          imageUrl={previewUrl}
          fileName={uploadedImage.name}
          fileSize={uploadedImage.size}
          onClear={handleClear}
        />
      )}
    </div>
  );
};
