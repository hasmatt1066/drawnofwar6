/**
 * Color Palette Extractor
 *
 * Extracts dominant colors from images using k-means clustering.
 * Uses Sharp for image processing.
 */

import sharp from 'sharp';
import type { ColorPalette } from './types.js';

/**
 * RGB color value
 */
interface RGBColor {
  r: number;
  g: number;
  b: number;
}

/**
 * Extract dominant colors from an image using k-means clustering
 *
 * @param imageBuffer - Image buffer (PNG, JPEG, etc.)
 * @param numColors - Number of dominant colors to extract (default: 5)
 * @returns Color palette with hex codes
 */
export async function extractColorPalette(
  imageBuffer: Buffer,
  numColors: number = 5
): Promise<ColorPalette> {
  console.log('[Color Extractor] Extracting color palette...');

  // Resize image to speed up processing
  const resized = await sharp(imageBuffer)
    .resize(100, 100, { fit: 'inside' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = resized;
  const pixels: RGBColor[] = [];

  // Extract pixels
  for (let i = 0; i < data.length; i += info.channels) {
    pixels.push({
      r: data[i] ?? 0,
      g: data[i + 1] ?? 0,
      b: data[i + 2] ?? 0
    });
  }

  // Remove transparent/white pixels (background)
  const opaquePixels = pixels.filter(p => {
    // Skip near-white pixels (likely background)
    const isWhite = p.r > 240 && p.g > 240 && p.b > 240;
    return !isWhite;
  });

  // Use k-means to find dominant colors
  const dominantColors = kMeansClustering(
    opaquePixels.length > 0 ? opaquePixels : pixels,
    numColors
  );

  // Convert to hex
  const hexColors = dominantColors.map(rgbToHex);

  console.log(`[Color Extractor] Extracted ${hexColors.length} colors:`, hexColors);

  return {
    colors: hexColors,
    dominantColor: hexColors[0] ?? '#808080',
    colorCount: hexColors.length
  };
}

/**
 * K-means clustering to find dominant colors
 *
 * @param pixels - Array of RGB pixels
 * @param k - Number of clusters (colors)
 * @returns Array of dominant RGB colors
 */
function kMeansClustering(pixels: RGBColor[], k: number): RGBColor[] {
  if (pixels.length === 0) {
    return [{ r: 128, g: 128, b: 128 }];
  }

  // Initialize centroids with random pixels
  let centroids: RGBColor[] = [];
  const step = Math.floor(pixels.length / k);
  for (let i = 0; i < k; i++) {
    const idx = Math.min(i * step, pixels.length - 1);
    const pixel = pixels[idx];
    if (pixel) {
      centroids.push({ ...pixel });
    }
  }

  // Iterate k-means
  const maxIterations = 10;
  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign pixels to nearest centroid
    const clusters: RGBColor[][] = Array.from({ length: k }, () => []);

    for (const pixel of pixels) {
      let minDist = Infinity;
      let nearestCluster = 0;

      for (let i = 0; i < centroids.length; i++) {
        const centroid = centroids[i];
        if (centroid) {
          const dist = colorDistance(pixel, centroid);
          if (dist < minDist) {
            minDist = dist;
            nearestCluster = i;
          }
        }
      }

      const cluster = clusters[nearestCluster];
      if (cluster) {
        cluster.push(pixel);
      }
    }

    // Update centroids
    const newCentroids: RGBColor[] = [];
    for (let i = 0; i < k; i++) {
      const cluster = clusters[i];
      const centroid = centroids[i];
      if (!cluster || cluster.length === 0) {
        // Keep old centroid if cluster is empty
        if (centroid) {
          newCentroids.push(centroid);
        }
      } else {
        // Calculate mean of cluster
        const mean = {
          r: Math.round(cluster.reduce((sum, p) => sum + p.r, 0) / cluster.length),
          g: Math.round(cluster.reduce((sum, p) => sum + p.g, 0) / cluster.length),
          b: Math.round(cluster.reduce((sum, p) => sum + p.b, 0) / cluster.length)
        };
        newCentroids.push(mean);
      }
    }

    // Check for convergence
    let converged = true;
    for (let i = 0; i < k; i++) {
      const oldCentroid = centroids[i];
      const newCentroid = newCentroids[i];
      if (oldCentroid && newCentroid && colorDistance(oldCentroid, newCentroid) > 1) {
        converged = false;
        break;
      }
    }

    centroids = newCentroids;

    if (converged) {
      break;
    }
  }

  // Sort by cluster size (most common colors first)
  const clusterSizes: Array<{ centroid: RGBColor; size: number }> = [];
  for (let i = 0; i < centroids.length; i++) {
    const centroid = centroids[i];
    const nextCentroid = centroids[(i + 1) % k];
    if (!centroid || !nextCentroid) continue;

    let size = 0;
    for (const pixel of pixels) {
      if (colorDistance(pixel, centroid) < colorDistance(pixel, nextCentroid)) {
        size++;
      }
    }
    clusterSizes.push({ centroid, size });
  }

  clusterSizes.sort((a, b) => b.size - a.size);

  return clusterSizes.map(cs => cs.centroid);
}

/**
 * Calculate Euclidean distance between two colors in RGB space
 */
function colorDistance(c1: RGBColor, c2: RGBColor): number {
  const dr = c1.r - c2.r;
  const dg = c1.g - c2.g;
  const db = c1.b - c2.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Convert RGB to hex color string
 */
function rgbToHex(color: RGBColor): string {
  const toHex = (n: number) => {
    const hex = Math.max(0, Math.min(255, n)).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`.toUpperCase();
}

/**
 * Calculate color similarity between two palettes
 * Returns score 0-1 (1 = identical)
 */
export function compareColorPalettes(
  palette1: ColorPalette,
  palette2: ColorPalette
): number {
  const colors1 = palette1.colors.map(hexToRgb);
  const colors2 = palette2.colors.map(hexToRgb);

  // Find best match for each color in palette1
  let totalSimilarity = 0;

  for (const c1 of colors1) {
    let bestMatch = 0;
    for (const c2 of colors2) {
      const dist = colorDistance(c1, c2);
      const similarity = 1 - Math.min(dist / 441.67, 1); // 441.67 = sqrt(255^2 * 3)
      bestMatch = Math.max(bestMatch, similarity);
    }
    totalSimilarity += bestMatch;
  }

  return totalSimilarity / colors1.length;
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): RGBColor {
  const cleaned = hex.replace('#', '');
  return {
    r: parseInt(cleaned.substring(0, 2), 16),
    g: parseInt(cleaned.substring(2, 4), 16),
    b: parseInt(cleaned.substring(4, 6), 16)
  };
}
