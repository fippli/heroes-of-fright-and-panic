import type { TilePosition } from "./tile.ts";

/**
 * Hex neighbor utilities for odd-r offset hex grids.
 *
 * Diagonal neighbor rules:
 * - Even rows are NOT shifted
 * - Odd rows are shifted RIGHT by half a hex
 * - The column offset depends on the SOURCE tile's row (origin.row)
 */

export const isSameRow = (a: TilePosition, b: TilePosition): boolean =>
  a.row === b.row;

export const isSameCol = (a: TilePosition, b: TilePosition): boolean =>
  a.column === b.column;

export const isSamePosition = (a: TilePosition, b: TilePosition): boolean =>
  isSameRow(a, b) && isSameCol(a, b);

export const isEastOf = (
  tile: TilePosition,
  origin: TilePosition,
): boolean => isSameRow(tile, origin) && tile.column === origin.column + 1;

export const isWestOf = (
  tile: TilePosition,
  origin: TilePosition,
): boolean => isSameRow(tile, origin) && tile.column === origin.column - 1;

export const isNorthEastOf = (
  tile: TilePosition,
  origin: TilePosition,
): boolean => {
  if (origin.row % 2 === 0) {
    return tile.row === origin.row - 1 && tile.column === origin.column;
  }
  return tile.row === origin.row - 1 && tile.column === origin.column + 1;
};

export const isNorthWestOf = (
  tile: TilePosition,
  origin: TilePosition,
): boolean => {
  if (origin.row % 2 === 0) {
    return tile.row === origin.row - 1 && tile.column === origin.column - 1;
  }
  return tile.row === origin.row - 1 && tile.column === origin.column;
};

export const isSouthEastOf = (
  tile: TilePosition,
  origin: TilePosition,
): boolean => {
  if (origin.row % 2 === 0) {
    return tile.row === origin.row + 1 && tile.column === origin.column;
  }
  return tile.row === origin.row + 1 && tile.column === origin.column + 1;
};

export const isSouthWestOf = (
  tile: TilePosition,
  origin: TilePosition,
): boolean => {
  if (origin.row % 2 === 0) {
    return tile.row === origin.row + 1 && tile.column === origin.column - 1;
  }
  return tile.row === origin.row + 1 && tile.column === origin.column;
};

export const isNeighborTo = (
  tile: TilePosition,
  origin: TilePosition,
): boolean =>
  isEastOf(tile, origin) ||
  isWestOf(tile, origin) ||
  isNorthEastOf(tile, origin) ||
  isNorthWestOf(tile, origin) ||
  isSouthEastOf(tile, origin) ||
  isSouthWestOf(tile, origin);

export const findNeighbors = <T extends TilePosition>(
  origin: TilePosition,
  tiles: T[],
): T[] => tiles.filter((tile) => isNeighborTo(tile, origin));

/**
 * Neighbor offsets by edge direction, clockwise from east:
 * 0 = E, 1 = SE, 2 = SW, 3 = W, 4 = NW, 5 = NE.
 * Rivers use these indices to say which two edges they connect.
 */
const OFFSETS_EVEN_ROW: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0],
];
const OFFSETS_ODD_ROW: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 1], [1, 0], [0, -1], [-1, 0], [-1, 1],
];

export const neighborAt = (
  origin: TilePosition,
  direction: number,
): TilePosition => {
  const index = ((direction % 6) + 6) % 6;
  const offsets = origin.row % 2 === 0 ? OFFSETS_EVEN_ROW : OFFSETS_ODD_ROW;
  const offset = offsets[index] ?? [0, 0];
  return { row: origin.row + offset[0], column: origin.column + offset[1] };
};

/** The edge of the neighbor that touches `direction`'s edge of the origin */
export const oppositeDirection = (direction: number): number =>
  (((direction + 3) % 6) + 6) % 6;
