import { compose } from "@shared/utils/compose.ts";
import * as hex from "./hex.ts";
import { generateLandscape, cleanupSingles, createBeaches, cleanupSand, placeTrees, placeMountains } from "./landscape.ts";
import type { RandomFunction } from "@shared/utils/random.ts";
import type { Tile, TilePosition } from "./tile.ts";

export class GameMap {
  static generate(size: number, random: RandomFunction = Math.random) {
    const startTiles = Array.from({ length: size * size }, (_, tileNumber) => {
      const column = tileNumber % size;
      const row = Math.floor(tileNumber / size);

      const tile = { column, row, landscape: null, piece: null, building: null, steed: null };

      return tile;
    }) as Tile[];

    const mapTiles = startTiles.reduce((acc, tile: Tile) => {
      const neighbours = GameMap.findNeighbors(tile, acc);
      const landscape = generateLandscape(neighbours, random);
      const newTile = { ...tile, landscape };
      return acc.map((tile) =>
        tile.row === newTile.row && tile.column === newTile.column
          ? newTile
          : tile,
      );
    }, startTiles);

    return compose(
      cleanupSingles,
      createBeaches,
      cleanupSand,
      (tiles: Tile[]) => placeTrees(tiles, random),
      (tiles: Tile[]) => placeMountains(tiles, random),
    )(mapTiles);
  }

  static findTile(tile: Tile, tiles: Tile[]) {
    return tiles.find((compare: Tile) => hex.isSamePosition(tile, compare));
  }

  static replaceTile(tile: TilePosition & Partial<Tile>, tiles: Tile[]) {
    return tiles.map((compare: Tile) =>
      hex.isSamePosition(compare, tile) ? { ...compare, ...tile } : compare,
    ) as Tile[];
  }

  static isNeighborTo(tile: TilePosition, compareTile: TilePosition) {
    return hex.isNeighborTo(tile, compareTile);
  }

  static findNeighbors(tile: Tile, tiles: Tile[]) {
    return hex.findNeighbors(tile, tiles);
  }
}
