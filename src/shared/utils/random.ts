export type RandomFunction = () => number;

/**
 * Mulberry32 PRNG — deterministic pseudo-random number generator.
 * Returns values in [0, 1) for a given numeric seed.
 */
export const createSeededRandom = (seed: number): RandomFunction => {
  const state = { value: seed | 0 };

  return () => {
    state.value = (state.value + 0x6d2b79f5) | 0;
    const intermediate = Math.imul(state.value ^ (state.value >>> 15), 1 | state.value);
    const mixed =
      (intermediate + Math.imul(intermediate ^ (intermediate >>> 7), 61 | intermediate)) ^ intermediate;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * DJB2 string hash — converts a string to a 32-bit integer for use as a PRNG seed.
 */
export const hashStringSeed = (str: string): number =>
  Array.from(str).reduce(
    (hash, char) => ((hash << 5) + hash + char.charCodeAt(0)) | 0,
    5381,
  );

/**
 * Creates a random function from an optional seed.
 * - undefined → Math.random (non-deterministic)
 * - number → seeded PRNG
 * - string → hashed to number, then seeded PRNG
 */
export const createRandom = (seed: string | number | undefined): RandomFunction => {
  if (seed === undefined) {
    return Math.random;
  }

  const numericSeed = typeof seed === "string" ? hashStringSeed(seed) : seed;
  return createSeededRandom(numericSeed);
};
