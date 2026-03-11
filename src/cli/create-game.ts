import type { Game } from "@shared/game/types.ts";
import { GameMap } from "@shared/map/map.ts";
import { Player } from "@shared/player/index.ts";
import { ResourceMap } from "@shared/player/resource-map.ts";
import { Piece } from "@shared/piece/index.ts";
import { Building } from "@shared/building/index.ts";
import { LandscapeType } from "@shared/map/landscape.ts";
import type { Tile } from "@shared/map/tile.ts";

const findStartingTile = (
  tiles: ReadonlyArray<Tile>,
  preferredRow: number,
  preferredColumn: number,
): Tile | undefined => {
  const sorted = tiles
    .filter((tile) => tile.landscape?.type === LandscapeType.grass)
    .filter((tile) => tile.piece == null && tile.building == null)
    .toSorted(
      (a, b) =>
        Math.abs(a.row - preferredRow) +
        Math.abs(a.column - preferredColumn) -
        (Math.abs(b.row - preferredRow) + Math.abs(b.column - preferredColumn)),
    );

  return sorted.at(0);
};

const placeStartingUnits = (
  tiles: ReadonlyArray<Tile>,
  player: Player,
  startRow: number,
  startColumn: number,
): Tile[] => {
  const houseTile = findStartingTile(tiles, startRow, startColumn);
  if (houseTile === undefined) {
    return [...tiles];
  }

  const tilesWithHouse = tiles.map((tile) =>
    tile.row === houseTile.row && tile.column === houseTile.column
      ? { ...tile, building: Building.house(player), piece: Piece.peasant(player) }
      : tile,
  );

  return tilesWithHouse;
};

export const createLocalGame = (size: number): Game => {
  const startResources = new ResourceMap({ wood: 5, stone: 2, gold: 0, food: 3 });
  const dayPlayer = new Player({ type: "day", resources: startResources });
  const nightPlayer = new Player({ type: "night", resources: startResources });

  const baseTiles = GameMap.generate(size).map((tile) => ({
    ...tile,
    piece: tile.piece ?? null,
    building: tile.building ?? null,
  }));

  const tilesWithDay = placeStartingUnits(baseTiles, dayPlayer, 2, 2);
  const tilesWithBoth = placeStartingUnits(
    tilesWithDay,
    nightPlayer,
    size - 3,
    size - 3,
  );

  return {
    id: "local",
    createdAt: new Date(),
    updatedAt: new Date(),
    name: "CLI Game",
    size,
    tiles: tilesWithBoth,
    dayPlayer,
    nightPlayer,
    currentPlayer: "day",
    clock: { time: 6, hasDawned: true, hasDusked: false },
    creatorEmail: "cli@local",
    gameOver: false,
    winner: null,
  };
};
