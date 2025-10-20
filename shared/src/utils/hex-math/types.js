/**
 * Hex Math Library - Type Definitions
 *
 * Core type definitions for hexagonal grid mathematics.
 * Supports axial, cube, and pixel coordinate systems.
 */
/**
 * Direction vectors for hex neighbors
 */
export var HexDirection;
(function (HexDirection) {
    HexDirection[HexDirection["NE"] = 0] = "NE";
    HexDirection[HexDirection["E"] = 1] = "E";
    HexDirection[HexDirection["SE"] = 2] = "SE";
    HexDirection[HexDirection["SW"] = 3] = "SW";
    HexDirection[HexDirection["W"] = 4] = "W";
    HexDirection[HexDirection["NW"] = 5] = "NW"; // North-West
})(HexDirection || (HexDirection = {}));
//# sourceMappingURL=types.js.map