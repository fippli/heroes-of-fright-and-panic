export const weightedRandom = (xs: any[], weights: number[]) => {
  const max = xs.length;

  if (max === 0) {
    return undefined;
  }

  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const rnd = Math.random() * totalWeight;

  const selectedIndex = weights.reduce<{
    cumulative: number;
    found: number | null;
  }>(
    (acc, weight, index) => {
      if (acc.found !== null) return acc;
      const newCumulative = acc.cumulative + weight;
      if (rnd < newCumulative) {
        return { cumulative: newCumulative, found: index };
      }
      return { cumulative: newCumulative, found: null };
    },
    { cumulative: 0, found: null },
  );

  return selectedIndex.found !== null
    ? xs.at(selectedIndex.found)
    : xs.at(-1);
};
