/**
 * Style Preservation Types
 *
 * Types for style validation and color/shape comparison.
 */

/**
 * Color palette extracted from an image
 */
export interface ColorPalette {
  colors: string[];       // Hex color codes
  dominantColor: string;  // Most prominent color
  colorCount: number;     // Number of unique colors
}

/**
 * Shape analysis result
 */
export interface ShapeAnalysis {
  edgeDensity: number;    // 0-1, amount of edges detected
  complexity: number;     // 0-1, shape complexity
  aspectRatio: number;    // width / height
}

/**
 * Style preservation validation result
 */
export interface StylePreservationResult {
  passed: boolean;              // true if score >= threshold (0.6)
  overallScore: number;         // 0-100, overall similarity
  colorScore: number;           // 0-100, color similarity
  shapeScore: number;           // 0-100, shape similarity
  feedback: string;             // Human-readable feedback
  dominantColorsOriginal: string[];  // Original image colors
  dominantColorsGenerated: string[]; // Generated sprite colors
}
