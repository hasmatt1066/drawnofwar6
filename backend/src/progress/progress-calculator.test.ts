import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProgressCalculator, JobStage } from './progress-calculator';

describe('ProgressCalculator', () => {
  let calculator: ProgressCalculator;

  beforeEach(() => {
    calculator = new ProgressCalculator();
  });

  describe('calculateProgress', () => {
    describe('stage-based progress', () => {
      it('should return 0-5% for deduplication stage', () => {
        const progress = calculator.calculateProgress(JobStage.DEDUPLICATION, 0);
        expect(progress).toBeGreaterThanOrEqual(0);
        expect(progress).toBeLessThanOrEqual(5);
      });

      it('should return 5-10% for queued stage', () => {
        const progress = calculator.calculateProgress(JobStage.QUEUED, 0);
        expect(progress).toBeGreaterThanOrEqual(5);
        expect(progress).toBeLessThanOrEqual(10);
      });

      it('should map PixelLab 0-100 to 10-90% for generation stage', () => {
        const progress0 = calculator.calculateProgress(JobStage.PIXELLAB_GENERATION, 0);
        expect(progress0).toBe(10);

        const progress50 = calculator.calculateProgress(JobStage.PIXELLAB_GENERATION, 50);
        expect(progress50).toBe(50);

        const progress100 = calculator.calculateProgress(JobStage.PIXELLAB_GENERATION, 100);
        expect(progress100).toBe(90);
      });

      it('should return 90-100% for caching stage', () => {
        const progress = calculator.calculateProgress(JobStage.CACHING, 0);
        expect(progress).toBeGreaterThanOrEqual(90);
        expect(progress).toBeLessThanOrEqual(100);
      });

      it('should return 100% for completed stage', () => {
        const progress = calculator.calculateProgress(JobStage.COMPLETED, 0);
        expect(progress).toBe(100);
      });
    });

    describe('monotonically increasing progress', () => {
      it('should never return decreasing progress', () => {
        calculator.calculateProgress(JobStage.PIXELLAB_GENERATION, 50);
        const firstProgress = calculator.calculateProgress(JobStage.PIXELLAB_GENERATION, 50);

        // Simulate PixelLab progress going backward
        const secondProgress = calculator.calculateProgress(JobStage.PIXELLAB_GENERATION, 30);

        expect(secondProgress).toBeGreaterThanOrEqual(firstProgress);
      });

      it('should use maximum of current and previous progress', () => {
        calculator.calculateProgress(JobStage.PIXELLAB_GENERATION, 80);
        const highProgress = calculator.calculateProgress(JobStage.PIXELLAB_GENERATION, 80);

        // Progress jumps backward
        const maintainedProgress = calculator.calculateProgress(JobStage.PIXELLAB_GENERATION, 20);

        expect(maintainedProgress).toBe(highProgress);
      });

      it('should maintain progress across stage transitions', () => {
        const generationProgress = calculator.calculateProgress(JobStage.PIXELLAB_GENERATION, 100);
        expect(generationProgress).toBe(90);

        const cachingProgress = calculator.calculateProgress(JobStage.CACHING, 0);
        expect(cachingProgress).toBeGreaterThanOrEqual(90);
      });
    });

    describe('initial state', () => {
      it('should return 0% on job submission (deduplication)', () => {
        const progress = calculator.calculateProgress(JobStage.DEDUPLICATION, 0);
        expect(progress).toBe(0);
      });

      it('should return 100% on completion', () => {
        const progress = calculator.calculateProgress(JobStage.COMPLETED, 100);
        expect(progress).toBe(100);
      });
    });

    describe('smooth interpolation', () => {
      it('should interpolate PixelLab progress linearly', () => {
        const progress25 = calculator.calculateProgress(JobStage.PIXELLAB_GENERATION, 25);
        const progress75 = calculator.calculateProgress(JobStage.PIXELLAB_GENERATION, 75);

        expect(progress25).toBe(30); // 10 + (25 * 0.8)
        expect(progress75).toBe(70); // 10 + (75 * 0.8)
      });

      it('should provide smooth progress transitions between stages', () => {
        calculator.calculateProgress(JobStage.DEDUPLICATION, 0);
        const dedup = calculator.calculateProgress(JobStage.DEDUPLICATION, 0);

        calculator.calculateProgress(JobStage.QUEUED, 0);
        const queued = calculator.calculateProgress(JobStage.QUEUED, 0);

        expect(queued).toBeGreaterThan(dedup);
      });
    });

    describe('edge cases', () => {
      it('should clamp PixelLab progress exceeding 100', () => {
        const progress = calculator.calculateProgress(JobStage.PIXELLAB_GENERATION, 150);
        expect(progress).toBe(90);
      });

      it('should clamp negative PixelLab progress', () => {
        const progress = calculator.calculateProgress(JobStage.PIXELLAB_GENERATION, -10);
        expect(progress).toBe(10);
      });

      it('should handle progress jumps to 100% (fast completion)', () => {
        calculator.calculateProgress(JobStage.PIXELLAB_GENERATION, 30);
        const progress = calculator.calculateProgress(JobStage.COMPLETED, 100);
        expect(progress).toBe(100);
      });

      it('should handle multiple backward jumps', () => {
        calculator.calculateProgress(JobStage.PIXELLAB_GENERATION, 80);
        calculator.calculateProgress(JobStage.PIXELLAB_GENERATION, 70);
        const progress = calculator.calculateProgress(JobStage.PIXELLAB_GENERATION, 60);

        // Should maintain the highest progress (80 -> 74%)
        expect(progress).toBeGreaterThanOrEqual(74);
      });
    });
  });

  describe('estimateTimeRemaining', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return null when no progress has been made', () => {
      calculator.calculateProgress(JobStage.DEDUPLICATION, 0);
      const estimate = calculator.estimateTimeRemaining(0);
      expect(estimate).toBeNull();
    });

    it('should return null at 100% completion', () => {
      calculator.calculateProgress(JobStage.COMPLETED, 100);
      const estimate = calculator.estimateTimeRemaining(100);
      expect(estimate).toBeNull();
    });

    it('should estimate time based on progress rate', () => {
      const startTime = Date.now();
      calculator.calculateProgress(JobStage.PIXELLAB_GENERATION, 0);

      // Advance 10 seconds
      vi.advanceTimersByTime(10000);
      const currentProgress = calculator.calculateProgress(JobStage.PIXELLAB_GENERATION, 25);

      const estimate = calculator.estimateTimeRemaining(currentProgress);

      // Progress went from 10% to 30% in 10s (20% progress)
      // Rate: 20% / 10000ms = 0.002% per ms
      // Remaining: 70% / 0.002 = 35000ms
      expect(estimate).toBeGreaterThan(30000);
      expect(estimate).toBeLessThan(40000);
    });

    it('should return null when progress is stuck (no rate)', () => {
      calculator.calculateProgress(JobStage.PIXELLAB_GENERATION, 50);

      vi.advanceTimersByTime(10000);
      calculator.calculateProgress(JobStage.PIXELLAB_GENERATION, 50);

      const estimate = calculator.estimateTimeRemaining(50);
      expect(estimate).toBeNull();
    });

    it('should update estimate as progress continues', () => {
      calculator.calculateProgress(JobStage.PIXELLAB_GENERATION, 0);

      vi.advanceTimersByTime(5000);
      const firstProgress = calculator.calculateProgress(JobStage.PIXELLAB_GENERATION, 20);
      const firstEstimate = calculator.estimateTimeRemaining(firstProgress);

      vi.advanceTimersByTime(5000);
      const secondProgress = calculator.calculateProgress(JobStage.PIXELLAB_GENERATION, 40);
      const secondEstimate = calculator.estimateTimeRemaining(secondProgress);

      // Second estimate should be less (closer to completion)
      expect(secondEstimate).toBeLessThan(firstEstimate!);
    });

    it('should handle very fast completion', () => {
      calculator.calculateProgress(JobStage.PIXELLAB_GENERATION, 0);

      vi.advanceTimersByTime(1000);
      const currentProgress = calculator.calculateProgress(JobStage.PIXELLAB_GENERATION, 90);

      const estimate = calculator.estimateTimeRemaining(currentProgress);
      expect(estimate).toBeGreaterThan(0);
      expect(estimate).toBeLessThan(1000);
    });
  });

  describe('reset', () => {
    it('should reset progress tracking', () => {
      calculator.calculateProgress(JobStage.PIXELLAB_GENERATION, 50);
      calculator.reset();

      const progress = calculator.calculateProgress(JobStage.DEDUPLICATION, 0);
      expect(progress).toBe(0);
    });

    it('should reset time tracking', () => {
      vi.useFakeTimers();

      calculator.calculateProgress(JobStage.PIXELLAB_GENERATION, 0);
      vi.advanceTimersByTime(10000);
      calculator.calculateProgress(JobStage.PIXELLAB_GENERATION, 50);

      calculator.reset();
      calculator.calculateProgress(JobStage.DEDUPLICATION, 0);

      const estimate = calculator.estimateTimeRemaining(0);
      expect(estimate).toBeNull();

      vi.useRealTimers();
    });

    it('should allow fresh progress calculation after reset', () => {
      calculator.calculateProgress(JobStage.COMPLETED, 100);
      calculator.reset();

      const progress = calculator.calculateProgress(JobStage.QUEUED, 0);
      expect(progress).toBeGreaterThanOrEqual(5);
      expect(progress).toBeLessThanOrEqual(10);
    });
  });

  describe('integration scenarios', () => {
    it('should track complete job lifecycle', () => {
      vi.useFakeTimers();

      // Job submitted
      let progress = calculator.calculateProgress(JobStage.DEDUPLICATION, 0);
      expect(progress).toBe(0);

      // Deduplication in progress
      vi.advanceTimersByTime(1000);
      progress = calculator.calculateProgress(JobStage.DEDUPLICATION, 0);
      expect(progress).toBeLessThanOrEqual(5);

      // Queued
      vi.advanceTimersByTime(2000);
      progress = calculator.calculateProgress(JobStage.QUEUED, 0);
      expect(progress).toBeGreaterThanOrEqual(5);
      expect(progress).toBeLessThanOrEqual(10);

      // PixelLab generation starts
      vi.advanceTimersByTime(5000);
      progress = calculator.calculateProgress(JobStage.PIXELLAB_GENERATION, 0);
      expect(progress).toBe(10);

      // PixelLab progressing
      vi.advanceTimersByTime(10000);
      progress = calculator.calculateProgress(JobStage.PIXELLAB_GENERATION, 50);
      expect(progress).toBe(50);

      // PixelLab complete
      vi.advanceTimersByTime(10000);
      progress = calculator.calculateProgress(JobStage.PIXELLAB_GENERATION, 100);
      expect(progress).toBe(90);

      // Caching
      vi.advanceTimersByTime(2000);
      progress = calculator.calculateProgress(JobStage.CACHING, 0);
      expect(progress).toBeGreaterThanOrEqual(90);

      // Completed
      vi.advanceTimersByTime(1000);
      progress = calculator.calculateProgress(JobStage.COMPLETED, 100);
      expect(progress).toBe(100);

      vi.useRealTimers();
    });

    it('should handle PixelLab API quirks gracefully', () => {
      // Start generation
      calculator.calculateProgress(JobStage.PIXELLAB_GENERATION, 10);

      // Progress increases
      let progress = calculator.calculateProgress(JobStage.PIXELLAB_GENERATION, 40);
      expect(progress).toBe(42);

      // Progress jumps backward (API quirk)
      progress = calculator.calculateProgress(JobStage.PIXELLAB_GENERATION, 35);
      expect(progress).toBe(42); // Should maintain previous progress

      // Progress continues forward
      progress = calculator.calculateProgress(JobStage.PIXELLAB_GENERATION, 60);
      expect(progress).toBe(58);
    });
  });
});
