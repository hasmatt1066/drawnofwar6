/**
 * Input Normalization Types
 *
 * Type definitions for multi-modal input processing.
 */

export interface ImageMetadata {
  originalWidth: number;
  originalHeight: number;
  originalFormat: string;
  normalizedWidth: number;
  normalizedHeight: number;
  fileSize: number;
  hasAlpha: boolean;
}

export interface NormalizedImage {
  base64: string; // Base64-encoded PNG
  metadata: ImageMetadata;
}

export interface NormalizationOptions {
  targetSize?: number; // Default: 512
  maintainAspectRatio?: boolean; // Default: true
  backgroundColor?: string; // Default: '#FFFFFF' for padding
  format?: 'png' | 'jpeg'; // Default: 'png'
  quality?: number; // For JPEG, 1-100, default: 90
}

export type InputSource = 'canvas' | 'upload' | 'text';

export interface ProcessedInput {
  source: InputSource;
  normalizedImage?: NormalizedImage;
  textDescription?: string;
  timestamp: number;
}
