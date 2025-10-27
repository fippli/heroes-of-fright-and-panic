// compose function
export const compose =
  (...fns) =>
  (x) =>
    fns.reduce((acc, fn) => fn(acc), x);

export const groupWithSize = (xs, size) => {
  return xs.reduce((acc, curr, index) => {
    if (index % size === 0) {
      acc.push([curr]);
    } else {
      acc[acc.length - 1].push(curr);
    }
    return acc;
  }, []);
};

export const identity = (x) => x;

export const unfold = (xs) => xs.flatMap(identity);

export const findSurroundingTiles = (rows, tileIndex) => {
  return unfold(rows).filter((_tile, ti) => {
    return (
      tileIndex - 1 === ti ||
      tileIndex + 1 === ti ||
      tileIndex - rows[0].length === ti ||
      tileIndex + rows[0].length === ti
    );
  });
};

export const moveTowardsCenter = (state, tileIndex) => {
  // Find the surrounding tile that is closest to the center and grass
  const surroundingGrassTiles = findSurroundingTiles(
    state.rows,
    tileIndex,
  ).filter(({ type }) => type === "grass");

  const centerIndex = Math.floor(state.size / 2) + 1;
};
