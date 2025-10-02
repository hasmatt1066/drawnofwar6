/**
 * Shape Comparator
 *
 * Compares shapes between images using edge detection.
 * Uses Sharp for image processing and edge detection.
 */

import sharp from 'sharp';
import type { ShapeAnalysis } from './types.js';

/**
 * Analyze shape characteristics of an image
 *
 * @param imageBuffer - Image buffer
 * @returns Shape analysis result
 */
export async function analyzeShape(imageBuffer: Buffer): Promise<ShapeAnalysis> {
  console.log('[Shape Comparator] Analyzing shape...');

  // Resize to standard size for comparison
  const resized = await sharp(imageBuffer)
    .resize(128, 128, { fit: 'inside' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = resized;

  // Calculate edge density using simple Sobel operator
  let edgePixels = 0;
  const threshold = 30;

  for (let y = 1; y < info.height - 1; y++) {
    for (let x = 1; x < info.width - 1; x++) {
      const idx = y * info.width + x;

      // Sobel operator (horizontal and vertical gradients)
      const gx =
        -1 * (data[idx - info.width - 1] ?? 0) +
        1 * (data[idx - info.width + 1] ?? 0) +
        -2 * (data[idx - 1] ?? 0) +
        2 * (data[idx + 1] ?? 0) +
        -1 * (data[idx + info.width - 1] ?? 0) +
        1 * (data[idx + info.width + 1] ?? 0);

      const gy =
        -1 * (data[idx - info.width - 1] ?? 0) +
        -2 * (data[idx - info.width] ?? 0) +
        -1 * (data[idx - info.width + 1] ?? 0) +
        1 * (data[idx + info.width - 1] ?? 0) +
        2 * (data[idx + info.width] ?? 0) +
        1 * (data[idx + info.width + 1] ?? 0);

      const magnitude = Math.sqrt(gx * gx + gy * gy);

      if (magnitude > threshold) {
        edgePixels++;
      }
    }
  }

  const totalPixels = (info.width - 2) * (info.height - 2);
  const edgeDensity = edgePixels / totalPixels;

  // Calculate complexity based on edge density
  // More edges = more complex shape
  const complexity = Math.min(edgeDensity * 2, 1.0);

  console.log(`[Shape Comparator] Edge density: ${(edgeDensity * 100).toFixed(1)}%`);
  console.log(`[Shape Comparator] Complexity: ${(complexity * 100).toFixed(1)}%`);

  return {
    edgeDensity,
    complexity,
    aspectRatio: info.width / info.height
  };
}

/**
 * Compare shapes between two images
 * Returns similarity score 0-1 (1 = identical)
 *
 * @param image1Buffer - First image buffer
 * @param image2Buffer - Second image buffer
 * @returns Similarity score
 */
export async function compareShapes(
  image1Buffer: Buffer,
  image2Buffer: Buffer
): Promise<number> {
  console.log('[Shape Comparator] Comparing shapes...');

  const [shape1, shape2] = await Promise.all([
    analyzeShape(image1Buffer),
    analyzeShape(image2Buffer)
  ]);

  // Compare edge densities
  const edgeDiff = Math.abs(shape1.edgeDensity - shape2.edgeDensity);
  const edgeSimilarity = 1 - Math.min(edgeDiff * 2, 1.0); // Scale to 0-1

  // Compare complexities
  const complexityDiff = Math.abs(shape1.complexity - shape2.complexity);
  const complexitySimilarity = 1 - Math.min(complexityDiff, 1.0);

  // Compare aspect ratios
  const aspectRatioDiff = Math.abs(shape1.aspectRatio - shape2.aspectRatio);
  const aspectSimilarity = 1 - Math.min(aspectRatioDiff, 1.0);

  // Weighted average
  const similarity =
    edgeSimilarity * 0.5 +
    complexitySimilarity * 0.3 +
    aspectSimilarity * 0.2;

  console.log(`[Shape Comparator] Edge similarity: ${(edgeSimilarity * 100).toFixed(1)}%`);
  console.log(`[Shape Comparator] Complexity similarity: ${(complexitySimilarity * 100).toFixed(1)}%`);
  console.log(`[Shape Comparator] Overall similarity: ${(similarity * 100).toFixed(1)}%`);

  return similarity;
}

/**
 * Extract edge map from an image (for visualization/debugging)
 *
 * @param imageBuffer - Image buffer
 * @returns Edge map as buffer
 */
export async function extractEdgeMap(imageBuffer: Buffer): Promise<Buffer> {
  const resized = await sharp(imageBuffer)
    .resize(128, 128, { fit: 'inside' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = resized;
  const edgeMap = Buffer.alloc(data.length);
  const threshold = 30;

  for (let y = 1; y < info.height - 1; y++) {
    for (let x = 1; x < info.width - 1; x++) {
      const idx = y * info.width + x;

      // Sobel operator
      const gx =
        -1 * (data[idx - info.width - 1] ?? 0) +
        1 * (data[idx - info.width + 1] ?? 0) +
        -2 * (data[idx - 1] ?? 0) +
        2 * (data[idx + 1] ?? 0) +
        -1 * (data[idx + info.width - 1] ?? 0) +
        1 * (data[idx + info.width + 1] ?? 0);

      const gy =
        -1 * (data[idx - info.width - 1] ?? 0) +
        -2 * (data[idx - info.width] ?? 0) +
        -1 * (data[idx - info.width + 1] ?? 0) +
        1 * (data[idx + info.width - 1] ?? 0) +
        2 * (data[idx + info.width] ?? 0) +
        1 * (data[idx + info.width + 1] ?? 0);

      const magnitude = Math.sqrt(gx * gx + gy * gy);

      const mapValue = edgeMap[idx];
      if (mapValue !== undefined) {
        edgeMap[idx] = magnitude > threshold ? 255 : 0;
      }
    }
  }

  // Convert back to PNG
  return sharp(edgeMap, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 1
    }
  })
    .png()
    .toBuffer();
}
