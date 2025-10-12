export const weightedRandom = (xs: any[], weights: number[]) => {
  const max = xs.length;

  if (max === 0) {
    return undefined;
  }

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const rnd = Math.random() * totalWeight;

  let cumulative = 0;
  for (let i = 0; i < max; i++) {
    cumulative += weights[i];
    if (rnd < cumulative) {
      return xs[i];
    }
  }

  // Fallback (should never reach here if weights are valid)
  return xs[max - 1];
};
