/**
 * Prompt Builder Container
 *
 * Main container component that orchestrates all three input methods:
 * - Draw It: Canvas drawing
 * - Describe It: Text description
 * - Upload It: Image file upload
 *
 * Manages state, validation, and submission to the generation API.
 */

import React, { useState } from 'react';
import { usePromptBuilderStore } from '@/stores/usePromptBuilderStore';
import { InputMethodSelector } from '../common/InputMethodSelector';
import { DrawingCanvas } from '../DrawingCanvas';
import { ImageUpload } from '../ImageUpload';
import { TextPromptInput } from '../TextPromptInput';
import styles from './PromptBuilder.module.css';

interface PromptBuilderProps {
  onSubmit?: (data: GenerationRequest) => Promise<void>;
}

interface GenerationRequest {
  inputType: 'draw' | 'text' | 'upload';
  imageData?: string;
  textDescription?: string;
  image?: File;
}

export const PromptBuilder: React.FC<PromptBuilderProps> = ({ onSubmit }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    inputMethod,
    canvasData,
    uploadedImage,
    textDescription
  } = usePromptBuilderStore();

  /**
   * Validate input based on selected method
   */
  const validateInput = (): string | null => {
    switch (inputMethod) {
      case 'draw':
        if (!canvasData) {
          return 'Please draw something on the canvas before submitting.';
        }
        return null;

      case 'text':
        if (!textDescription || textDescription.trim().length === 0) {
          return 'Please enter a description before submitting.';
        }
        if (textDescription.length < 10) {
          return 'Description is too short. Please provide at least 10 characters.';
        }
        return null;

      case 'upload':
        if (!uploadedImage) {
          return 'Please upload an image before submitting.';
        }
        return null;

      default:
        return 'Invalid input method selected.';
    }
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate input
    const validationError = validateInput();
    if (validationError) {
      setError(validationError);
      return;
    }

    // Build request data
    const requestData: GenerationRequest = {
      inputType: inputMethod
    };

    switch (inputMethod) {
      case 'draw':
        requestData.imageData = canvasData!;
        break;
      case 'text':
        requestData.textDescription = textDescription;
        break;
      case 'upload':
        requestData.image = uploadedImage!;
        break;
    }

    // Submit
    setIsSubmitting(true);
    try {
      if (onSubmit) {
        await onSubmit(requestData);
      } else {
        // Default: call API directly
        await submitToAPI(requestData);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during generation. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Submit to generation API (enhanced endpoint with queue)
   */
  const submitToAPI = async (data: GenerationRequest): Promise<void> => {
    let response: Response;

    if (data.inputType === 'upload' && data.image) {
      // File upload: use multipart/form-data
      const formData = new FormData();
      formData.append('image', data.image);
      if (data.textDescription) {
        formData.append('description', data.textDescription);
      }

      response = await fetch(`/api/generate/enhanced?inputType=${data.inputType}`, {
        method: 'POST',
        body: formData
      });
    } else if (data.inputType === 'draw' && data.imageData) {
      // Canvas drawing: send data URL in JSON body
      response = await fetch('/api/generate/enhanced', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputType: data.inputType,
          imageData: data.imageData,
          description: data.textDescription
        })
      });
    } else {
      // Text only: use JSON
      response = await fetch('/api/generate/enhanced', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputType: data.inputType,
          description: data.textDescription
        })
      });
    }

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || errorData.error || 'Generation failed');
    }

    const result = await response.json();
    console.log('Generation job submitted:', result);

    // Store jobId and navigate to progress page
    if (result.jobId) {
      // TODO: Navigate to generation progress page with jobId
      // For now, store in sessionStorage
      sessionStorage.setItem('currentJobId', result.jobId);
      window.location.href = `/generation/${result.jobId}`;
    }
  };

  /**
   * Convert data URL to Blob for FormData submission
   */
  const dataURLtoBlob = async (dataURL: string): Promise<Blob> => {
    const response = await fetch(dataURL);
    return await response.blob();
  };

  /**
   * Render appropriate input component based on selected method
   */
  const renderInputComponent = () => {
    switch (inputMethod) {
      case 'draw':
        return <DrawingCanvas />;
      case 'text':
        return <TextPromptInput />;
      case 'upload':
        return <ImageUpload />;
      default:
        return null;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Create Your Creature</h1>
        <p className={styles.subtitle}>
          Choose how you want to bring your creature to life
        </p>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        {/* Input Method Selector */}
        <div className={styles.methodSelector}>
          <InputMethodSelector />
        </div>

        {/* Active Input Component */}
        <div className={styles.inputContainer}>
          {renderInputComponent()}
        </div>

        {/* Error Message */}
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

        {/* Submit Button */}
        <div className={styles.actions}>
          <button
            type="submit"
            className={styles.generateButton}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className={styles.spinner}></span>
                Generating...
              </>
            ) : (
              <>
                <span className={styles.buttonIcon}>✨</span>
                Generate Creature
              </>
            )}
          </button>
        </div>
      </form>

      {/* Info Panel */}
      <div className={styles.infoPanel}>
        <div className={styles.infoItem}>
          <span className={styles.infoIcon}>💡</span>
          <span className={styles.infoText}>
            Your {inputMethod === 'draw' ? 'drawing' : inputMethod === 'text' ? 'description' : 'image'} will be analyzed
            by AI to create a unique pixel art creature with custom abilities and stats.
          </span>
        </div>
      </div>
    </div>
  );
};
