/**
 * Drop Zone Component
 *
 * Drag-and-drop area with file picker fallback.
 * Uses react-dropzone for file handling.
 */

import React from 'react';
import { useDropzone } from 'react-dropzone';
import styles from './ImageUpload.module.css';

interface DropZoneProps {
  onFileAccepted: (file: File) => void;
  onFileRejected: (error: string) => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export const DropZone: React.FC<DropZoneProps> = ({
  onFileAccepted,
  onFileRejected
}) => {
  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg']
    },
    maxSize: MAX_FILE_SIZE,
    multiple: false,
    onDrop: (acceptedFiles, rejectedFiles) => {
      if (rejectedFiles.length > 0) {
        const rejection = rejectedFiles[0];
        if (rejection.errors[0]?.code === 'file-too-large') {
          onFileRejected('File too large. Maximum size is 5MB.');
        } else if (rejection.errors[0]?.code === 'file-invalid-type') {
          onFileRejected('Invalid file format. Please upload a PNG or JPG image.');
        } else {
          onFileRejected('Invalid file. Please try again.');
        }
        return;
      }

      if (acceptedFiles.length > 0) {
        onFileAccepted(acceptedFiles[0] as File);
      }
    }
  });

  return (
    <div
      {...getRootProps()}
      className={`${styles.dropZone} ${isDragActive ? styles.dragActive : ''} ${
        isDragReject ? styles.dragReject : ''
      }`}
    >
      <input {...getInputProps()} />

      <div className={styles.dropZoneContent}>
        <div className={styles.dropZoneIcon}>
          {isDragActive ? '📥' : '📤'}
        </div>

        <div className={styles.dropZoneText}>
          {isDragActive ? (
            <p className={styles.dragText}>Drop your image here</p>
          ) : (
            <>
              <p className={styles.primaryText}>
                Drag & drop an image here
              </p>
              <p className={styles.secondaryText}>or</p>
              <button type="button" className={styles.browseButton}>
                Browse Files
              </button>
            </>
          )}
        </div>

        <div className={styles.dropZoneHint}>
          <p className={styles.hintText}>
            Supported formats: PNG, JPG • Max size: 5MB
          </p>
        </div>
      </div>
    </div>
  );
};
