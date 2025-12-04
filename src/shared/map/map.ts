import { compose } from "@shared/utils/compose";
import { Landscape } from "./landscape";
import type { Tile, TilePosition } from "./tile";

export class GameMap {
  static generate(size: number) {
    const startTiles = Array.from({ length: size * size }, (_, tileNumber) => {
      const column = tileNumber % size;
      const row = Math.floor(tileNumber / size);

      const tile = { column, row, landscape: null };

      return tile;
    }) as Tile[];

    const mapTiles = startTiles.reduce((acc, tile: Tile) => {
      const neighbours = GameMap.findNeighbors(tile, acc);
      const landscape = Landscape.generate(neighbours);
      const newTile = { ...tile, landscape };
      return acc.map((tile) =>
        tile.row === newTile.row && tile.column === newTile.column
          ? newTile
          : tile,
      );
    }, startTiles);

    return compose(
      Landscape.cleanupSingles,
      Landscape.createBeaches,
      Landscape.cleanupSand,
      Landscape.placeTrees,
      Landscape.placeMountains,
    )(mapTiles);
  }

  static findTile(tile: Tile, tiles: Tile[]) {
    return tiles.find(
      (compare: Tile) =>
        tile.row === compare.row && tile.column === compare.column,
    );
  }

  static replaceTile(tile: TilePosition & Partial<Tile>, tiles: Tile[]) {
    return tiles.map((compare: Tile) =>
      GameMap.isThis(compare, tile) ? { ...compare, ...tile } : compare,
    ) as Tile[];
  }

  static isSameRow(a: TilePosition, b: TilePosition) {
    return a.row === b.row;
  }

  static isSameCol(a: TilePosition, b: TilePosition) {
    return a.column === b.column;
  }

  static isThis(a: TilePosition, b: TilePosition) {
    return GameMap.isSameRow(a, b) && GameMap.isSameCol(a, b);
  }

  static isEastOf(a: TilePosition, b: TilePosition) {
    return GameMap.isSameRow(a, b) && a.column === b.column + 1;
  }

  static isWestOf(a: TilePosition, b: TilePosition) {
    return GameMap.isSameRow(a, b) && a.column === b.column - 1;
  }

  static isNorthEastOf(a: TilePosition, b: TilePosition) {
    if (a.row % 2 === 0) {
      return a.row === b.row - 1 && a.column === b.column;
    } else {
      return a.row === b.row - 1 && a.column === b.column + 1;
    }
  }

  static isNorthWestOf(a: TilePosition, b: TilePosition) {
    if (a.row % 2 === 0) {
      return a.row === b.row - 1 && a.column === b.column - 1;
    } else {
      return a.row === b.row - 1 && a.column === b.column;
    }
  }

  static isSouthEastOf(a: TilePosition, b: TilePosition) {
    if (a.row % 2 === 0) {
      return a.row === b.row + 1 && a.column === b.column;
    } else {
      return a.row === b.row + 1 && a.column === b.column + 1;
    }
  }

  static isSouthWestOf(a: TilePosition, b: TilePosition) {
    if (a.row % 2 === 0) {
      return a.row === b.row + 1 && a.column === b.column - 1;
    } else {
      return a.row === b.row + 1 && a.column === b.column;
    }
  }

  static isNeighborTo(tile: TilePosition, compareTile: TilePosition) {
    if (!tile) return false;

    return (
      GameMap.isEastOf(tile, compareTile) ||
      GameMap.isWestOf(tile, compareTile) ||
      GameMap.isNorthEastOf(tile, compareTile) ||
      GameMap.isNorthWestOf(tile, compareTile) ||
      GameMap.isSouthEastOf(tile, compareTile) ||
      GameMap.isSouthWestOf(tile, compareTile)
    );
  }

  static findNeighbors(tile: Tile, tiles: Tile[]) {
    return tiles.filter((compare) => GameMap.isNeighborTo(tile, compare));
  }
}
