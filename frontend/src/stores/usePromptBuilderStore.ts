/**
 * Prompt Builder Store
 *
 * Manages state for the multi-modal prompt builder system.
 * Handles input method selection, canvas data, uploaded images, and text descriptions.
 */

import { create } from 'zustand';

export type InputMethod = 'draw' | 'text' | 'upload';

export interface PromptBuilderState {
  // Input method selection
  inputMethod: InputMethod;
  setInputMethod: (method: InputMethod) => void;

  // Canvas drawing data
  canvasData: string | null;
  setCanvasData: (data: string | null) => void;

  // Uploaded image data
  uploadedImage: File | null;
  setUploadedImage: (file: File | null) => void;

  // Text description
  textDescription: string;
  setTextDescription: (text: string) => void;

  // Reset all inputs
  reset: () => void;
}

const initialState = {
  inputMethod: 'text' as InputMethod,
  canvasData: null,
  uploadedImage: null,
  textDescription: ''
};

export const usePromptBuilderStore = create<PromptBuilderState>((set) => ({
  ...initialState,

  setInputMethod: (method) =>
    set({ inputMethod: method }),

  setCanvasData: (data) =>
    set({ canvasData: data }),

  setUploadedImage: (file) =>
    set({ uploadedImage: file }),

  setTextDescription: (text) =>
    set({ textDescription: text }),

  reset: () =>
    set(initialState)
}));
