/**
 * Tile operations — the single source of truth for all tile queries
 * and mutations on a tile array.
 */

import * as hex from "@shared/map/hex.ts";
import type { Tile, TilePosition } from "@shared/map/tile.ts";

/**
 * Find a tile at a given position. Returns undefined if not found.
 */
export const findTile = (
  tiles: ReadonlyArray<Tile>,
  position: TilePosition,
): Tile | undefined =>
  tiles.find(
    (tile) => tile.row === position.row && tile.column === position.column,
  );

/**
 * Replace a tile in the array, merging partial data onto the existing tile.
 */
export const replaceTile = (
  tiles: ReadonlyArray<Tile>,
  update: TilePosition & Partial<Tile>,
): ReadonlyArray<Tile> =>
  tiles.map((tile) =>
    tile.row === update.row && tile.column === update.column
      ? { ...tile, ...update }
      : tile,
  );

/**
 * Find all neighboring tiles of a given position (up to 6 in hex grid).
 */
export const findNeighborTiles = (
  tiles: ReadonlyArray<Tile>,
  position: TilePosition,
): ReadonlyArray<Tile> =>
  hex.findNeighbors(position, tiles as Tile[]);

/**
 * Check if two positions are hex neighbors.
 */
export const areNeighbors = (
  positionA: TilePosition,
  positionB: TilePosition,
): boolean =>
  hex.isNeighborTo(positionA, positionB);

/**
 * Find all tile positions within a given hex range of a center position.
 * Uses BFS expansion — does not check terrain walkability.
 */
export const findTilesInRange = (
  tiles: ReadonlyArray<Tile>,
  center: TilePosition,
  range: number,
): ReadonlyArray<TilePosition> =>
  Array.from({ length: range }).reduce<{
    readonly result: ReadonlyArray<TilePosition>;
    readonly currentLayer: ReadonlyArray<TilePosition>;
  }>(
    (acc) => {
      const nextLayer = acc.currentLayer.flatMap((position) =>
        findNeighborTiles(tiles, position)
          .filter(
            (neighbor) =>
              !acc.result.some(
                (existing) =>
                  existing.row === neighbor.row &&
                  existing.column === neighbor.column,
              ),
          )
          .map((neighbor) => ({ row: neighbor.row, column: neighbor.column })),
      );
      return {
        result: [...acc.result, ...nextLayer],
        currentLayer: nextLayer,
      };
    },
    { result: [center], currentLayer: [center] },
  ).result;
