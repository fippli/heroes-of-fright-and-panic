import type { RandomFunction } from "./random.ts";

/**
 * Value noise generator for procedural terrain.
 *
 * Produces smooth 2D noise by:
 * 1. Assigning random values to a grid of integer coordinates
 * 2. Interpolating between grid points with smooth Hermite interpolation
 * 3. Layering multiple octaves at different frequencies for natural detail
 */

/**
 * Generate a permutation table from a random function.
 * The table is used for deterministic hash lookups in the noise function.
 */
const createPermutationTable = (random: RandomFunction): ReadonlyArray<number> => {
  const size = 256;
  const table = Array.from({ length: size }, (_, index) => index);

  // Fisher-Yates shuffle using the seeded random
  // Using reduceRight to iterate from end to start
  Array.from({ length: size - 1 }, (_, index) => size - 1 - index).forEach((index) => {
    const swapIndex = Math.floor(random() * (index + 1));
    const temp = table[index];
    table[index] = table[swapIndex];
    table[swapIndex] = temp;
  });

  // Double the table to avoid index wrapping
  return [...table, ...table];
};

/**
 * Smooth interpolation (Hermite curve: 3t^2 - 2t^3).
 * Produces smoother transitions than linear interpolation.
 */
const fade = (t: number): number => t * t * (3 - 2 * t);

/**
 * Linear interpolation between two values.
 */
const lerp = (a: number, b: number, t: number): number => a + t * (b - a);

/**
 * Hash function that maps 2D integer coordinates to a pseudo-random value in [0, 1).
 */
const hash2d = (
  permutation: ReadonlyArray<number>,
  ix: number,
  iy: number,
): number => {
  // Parenthesised: the earlier `?? 0 + iy` bound as `?? (0 + iy)`, which
  // dropped the y term and produced vertically striped terrain.
  const index = permutation.at(((permutation.at(ix & 255) ?? 0) + iy) & 255) ?? 0;
  return index / 255;
};

/**
 * Single-octave 2D value noise.
 * Returns a value in approximately [0, 1] for any (x, y) coordinate.
 */
const valueNoise2d = (
  permutation: ReadonlyArray<number>,
  x: number,
  y: number,
): number => {
  // Integer part (grid cell)
  const ix = Math.floor(x);
  const iy = Math.floor(y);

  // Fractional part (position within cell)
  const fx = x - ix;
  const fy = y - iy;

  // Smooth the fractional coordinates
  const sx = fade(fx);
  const sy = fade(fy);

  // Hash the four corners of the grid cell
  const topLeft = hash2d(permutation, ix, iy);
  const topRight = hash2d(permutation, ix + 1, iy);
  const bottomLeft = hash2d(permutation, ix, iy + 1);
  const bottomRight = hash2d(permutation, ix + 1, iy + 1);

  // Bilinear interpolation with smooth fade
  const top = lerp(topLeft, topRight, sx);
  const bottom = lerp(bottomLeft, bottomRight, sx);

  return lerp(top, bottom, sy);
};

export type NoiseFunction = (x: number, y: number) => number;

/**
 * Create a multi-octave noise function.
 *
 * Octaves layer noise at increasing frequencies and decreasing amplitudes,
 * producing natural-looking terrain with both large features (continents)
 * and small details (local variation).
 *
 * @param random - Seeded random function for deterministic generation
 * @param octaves - Number of noise layers (more = more detail, default 4)
 * @param lacunarity - Frequency multiplier per octave (default 2.0)
 * @param persistence - Amplitude multiplier per octave (default 0.5)
 */
export const createNoise = (
  random: RandomFunction,
  octaves: number = 4,
  lacunarity: number = 2.0,
  persistence: number = 0.5,
): NoiseFunction => {
  const permutation = createPermutationTable(random);

  return (x: number, y: number): number => {
    const result = Array.from({ length: octaves }).reduce<{
      value: number;
      amplitude: number;
      frequency: number;
      maxAmplitude: number;
    }>(
      (acc, _, octave) => {
        const noiseValue = valueNoise2d(
          permutation,
          x * acc.frequency + octave * 31.7,
          y * acc.frequency + octave * 17.3,
        );
        return {
          value: acc.value + noiseValue * acc.amplitude,
          amplitude: acc.amplitude * persistence,
          frequency: acc.frequency * lacunarity,
          maxAmplitude: acc.maxAmplitude + acc.amplitude,
        };
      },
      { value: 0, amplitude: 1, frequency: 1, maxAmplitude: 0 },
    );

    // Normalize to [0, 1]
    return result.value / result.maxAmplitude;
  };
};
