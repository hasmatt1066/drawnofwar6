/**
 * Hex Math Library - Coordinate Conversion
 *
 * Functions for converting between axial, cube, and pixel coordinate systems.
 */
/**
 * Convert axial to cube coordinates
 * Formula: x = q, z = r, y = -x - z
 *
 * @param hex - Axial coordinate
 * @returns Cube coordinate (maintains invariant x + y + z = 0)
 */
export function axialToCube(hex) {
    const x = hex.q;
    const z = hex.r;
    const y = -x - z;
    // Avoid -0 by using explicit 0 when result is 0
    return { x: x || 0, y: y || 0, z: z || 0 };
}
/**
 * Convert cube to axial coordinates
 * Formula: q = x, r = z
 *
 * @param cube - Cube coordinate
 * @returns Axial coordinate
 */
export function cubeToAxial(cube) {
    return { q: cube.x, r: cube.z };
}
/**
 * Apply isometric projection to 2D coordinates (2:1 dimetric)
 * Transforms flat coordinates into isometric view
 *
 * @param pixel - Flat 2D pixel coordinate
 * @returns Isometric pixel coordinate
 */
export function applyIsometricProjection(pixel) {
    return {
        x: (pixel.x - pixel.y) * 0.5,
        y: (pixel.x + pixel.y) * 0.25
    };
}
/**
 * Reverse isometric projection to 2D coordinates
 * Transforms isometric view back to flat coordinates
 *
 * @param pixel - Isometric pixel coordinate
 * @returns Flat 2D pixel coordinate
 */
export function reverseIsometricProjection(pixel) {
    return {
        x: pixel.x + 2 * pixel.y,
        y: -pixel.x + 2 * pixel.y
    };
}
/**
 * Convert hex to pixel coordinates
 *
 * @param hex - Axial hex coordinate
 * @param config - Grid configuration (size, orientation, projection)
 * @returns Pixel coordinate for hex center
 */
export function hexToPixel(hex, config) {
    const size = config.hexSize;
    let pixel;
    if (config.orientation === 'flat-top') {
        const x = size * (3 / 2 * hex.q);
        const y = size * (Math.sqrt(3) / 2 * hex.q + Math.sqrt(3) * hex.r);
        pixel = { x, y };
    }
    else {
        // Pointy-top orientation
        const x = size * (Math.sqrt(3) * hex.q + Math.sqrt(3) / 2 * hex.r);
        const y = size * (3 / 2 * hex.r);
        pixel = { x, y };
    }
    // Apply isometric projection if enabled
    if (config.projection === 'isometric') {
        pixel = applyIsometricProjection(pixel);
    }
    return pixel;
}
/**
 * Convert pixel to hex coordinates with rounding
 * Returns nearest hex to pixel position
 *
 * @param pixel - Pixel coordinate
 * @param config - Grid configuration (size, orientation, projection)
 * @returns Nearest axial hex coordinate
 */
export function pixelToHex(pixel, config) {
    const size = config.hexSize;
    let workingPixel = pixel;
    // Reverse isometric projection if enabled
    if (config.projection === 'isometric') {
        workingPixel = reverseIsometricProjection(pixel);
    }
    let q, r;
    if (config.orientation === 'flat-top') {
        q = (2 / 3 * workingPixel.x) / size;
        r = (-1 / 3 * workingPixel.x + Math.sqrt(3) / 3 * workingPixel.y) / size;
    }
    else {
        // Pointy-top orientation
        q = (Math.sqrt(3) / 3 * workingPixel.x - 1 / 3 * workingPixel.y) / size;
        r = (2 / 3 * workingPixel.y) / size;
    }
    return hexRound({ q, r });
}
/**
 * Round fractional hex coordinates to nearest integer hex
 * Uses cube coordinates for accurate rounding
 *
 * @param hex - Fractional axial coordinates
 * @returns Rounded axial coordinates
 */
export function hexRound(hex) {
    // Convert to cube coordinates
    let { x, y, z } = axialToCube({ q: hex.q, r: hex.r });
    // Round each component
    let rx = Math.round(x);
    let ry = Math.round(y);
    let rz = Math.round(z);
    // Calculate rounding errors
    const x_diff = Math.abs(rx - x);
    const y_diff = Math.abs(ry - y);
    const z_diff = Math.abs(rz - z);
    // Reset the component with largest rounding error to maintain invariant
    if (x_diff > y_diff && x_diff > z_diff) {
        rx = -ry - rz;
    }
    else if (y_diff > z_diff) {
        ry = -rx - rz;
    }
    else {
        rz = -rx - ry;
    }
    // Avoid -0 by converting to explicit 0
    return cubeToAxial({
        x: rx === 0 ? 0 : rx,
        y: ry === 0 ? 0 : ry,
        z: rz === 0 ? 0 : rz
    });
}
//# sourceMappingURL=coordinate-conversion.js.map