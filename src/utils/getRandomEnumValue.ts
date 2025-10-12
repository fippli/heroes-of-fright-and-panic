export const getRandomEnumValueWeighted<T>(enumObj: T, weights: number[]): T[keyof T] {
  const values = Object.values(enumObj);
  
  if (weights.length !== values.length) {
    throw new Error("Weights array length must match enum values length");
  }

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const rnd = Math.random() * totalWeight;

  let cumulative = 0;
  for (let i = 0; i < values.length; i++) {
    cumulative += weights[i];
    if (rnd < cumulative) {
      return values[i] as T[keyof T];
    }
  }

  // Fallback (should never reach here if weights are valid)
  return values[values.length - 1] as T[keyof T];
}