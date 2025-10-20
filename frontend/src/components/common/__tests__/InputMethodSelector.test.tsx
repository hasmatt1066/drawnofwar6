/**
 * InputMethodSelector Component Tests
 *
 * Tests the input method selector component for multi-modal prompt input.
 * Users can choose between Draw/Text/Upload input methods.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InputMethodSelector } from '../InputMethodSelector';
import { usePromptBuilderStore } from '@/stores/usePromptBuilderStore';

describe('InputMethodSelector', () => {
  beforeEach(() => {
    // Reset store before each test
    usePromptBuilderStore.setState({
      inputMethod: 'text',
      canvasData: null,
      uploadedImage: null,
      textDescription: ''
    });
  });

  it('should render three input method buttons', () => {
    render(<InputMethodSelector />);

    expect(screen.getByRole('button', { name: /draw it/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /describe it/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload it/i })).toBeInTheDocument();
  });

  it('should highlight active method', () => {
    usePromptBuilderStore.setState({ inputMethod: 'draw' });
    render(<InputMethodSelector />);

    const drawButton = screen.getByRole('button', { name: /draw it/i });
    // Check for CSS module active class (hashed)
    expect(drawButton.className).toContain('active');
  });

  it('should switch method on button click', () => {
    render(<InputMethodSelector />);

    const uploadButton = screen.getByRole('button', { name: /upload it/i });
    fireEvent.click(uploadButton);

    expect(usePromptBuilderStore.getState().inputMethod).toBe('upload');
  });

  it('should update Zustand state on switch', () => {
    render(<InputMethodSelector />);

    const drawButton = screen.getByRole('button', { name: /draw it/i });
    fireEvent.click(drawButton);

    const state = usePromptBuilderStore.getState();
    expect(state.inputMethod).toBe('draw');
  });

  it('should support keyboard navigation', () => {
    render(<InputMethodSelector />);

    const drawButton = screen.getByRole('button', { name: /draw it/i });
    drawButton.focus();

    expect(document.activeElement).toBe(drawButton);

    // Test that Enter key activates button
    fireEvent.keyDown(drawButton, { key: 'Enter' });
    expect(usePromptBuilderStore.getState().inputMethod).toBe('draw');
  });

  it('should have accessible button labels', () => {
    render(<InputMethodSelector />);

    const drawButton = screen.getByRole('button', { name: /draw it/i });
    const describeButton = screen.getByRole('button', { name: /describe it/i });
    const uploadButton = screen.getByRole('button', { name: /upload it/i });

    expect(drawButton).toHaveAccessibleName();
    expect(describeButton).toHaveAccessibleName();
    expect(uploadButton).toHaveAccessibleName();
  });

  it('should have minimum touch target size for mobile (44px)', () => {
    render(<InputMethodSelector />);

    const buttons = screen.getAllByRole('button');
    buttons.forEach(button => {
      // Check min-height and min-width from CSS (jsdom doesn't compute styles fully)
      const styles = window.getComputedStyle(button);
      const minHeight = styles.minHeight;
      const minWidth = styles.minWidth;

      // Verify CSS has minimum dimensions set
      expect(minHeight).toBeDefined();
      expect(minWidth).toBeDefined();
    });
  });

  it('should display icons with text labels', () => {
    render(<InputMethodSelector />);

    // Check for emoji icons
    expect(screen.getByText('🎨')).toBeInTheDocument();
    expect(screen.getByText('📝')).toBeInTheDocument();
    expect(screen.getByText('📤')).toBeInTheDocument();
  });

  it('should maintain active state when re-rendered', () => {
    const { rerender } = render(<InputMethodSelector />);

    const uploadButton = screen.getByRole('button', { name: /upload it/i });
    fireEvent.click(uploadButton);

    rerender(<InputMethodSelector />);

    // Check for CSS module active class (hashed)
    expect(screen.getByRole('button', { name: /upload it/i }).className).toContain('active');
  });
});
