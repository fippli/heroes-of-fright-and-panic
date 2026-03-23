import * as hex from "@shared/map/hex.ts";
import { LandscapeType } from "@shared/map/landscape.ts";
import { GameMap } from "@shared/map/map.ts";
import type { Tile } from "@shared/map/tile.ts";
import type { PlayerType } from "@shared/piece/index.ts";
import { createKing, createPeasant } from "@shared/piece/index.ts";
import { createPlayer } from "@shared/player/index.ts";
import { createResourceMap } from "@shared/player/resource-map.ts";
import { createRandom } from "@shared/utils/random.ts";

type CreateGameParams = {
  readonly boardSize: number;
  readonly name: string;
  readonly alliance: PlayerType;
  readonly creatorEmail: string;
  readonly inviteEmail: string | null;
  readonly seed?: string | number;
};

export const createGame = (params: CreateGameParams) => {
  const dayPlayer = createPlayer({
    type: "day",
    resources: createResourceMap({ wood: 5, stone: 2 }),
  });
  const nightPlayer = createPlayer({
    type: "night",
    resources: createResourceMap({ wood: 5, stone: 2 }),
  });

  const random = createRandom(params.seed);
  const generatedTiles = GameMap.generate(params.boardSize, random) as Tile[];

  const grassTiles = generatedTiles.filter(
    (tile) => tile.landscape?.type === LandscapeType.grass,
  );

  const maxRow = params.boardSize - 1;
  const maxCol = params.boardSize - 1;

  // Day player starts near bottom-left
  const dayKingTile = grassTiles.reduce((closest, tile) => {
    const distance = Math.sqrt(
      Math.pow(maxRow - tile.row, 2) + Math.pow(tile.column, 2),
    );
    const closestDistance = Math.sqrt(
      Math.pow(maxRow - closest.row, 2) + Math.pow(closest.column, 2),
    );
    return distance < closestDistance ? tile : closest;
  }, grassTiles.at(0)!);

  // Find adjacent grass tile for day peasant
  const dayPeasantTile = findAdjacentGrass(dayKingTile, generatedTiles);

  // Night player starts near top-right
  const nightKingTile = grassTiles.reduce((closest, tile) => {
    const distance = Math.sqrt(
      Math.pow(tile.row, 2) + Math.pow(maxCol - tile.column, 2),
    );
    const closestDistance = Math.sqrt(
      Math.pow(closest.row, 2) + Math.pow(maxCol - closest.column, 2),
    );
    return distance < closestDistance ? tile : closest;
  }, grassTiles.at(0)!);

  // Find adjacent grass tile for night peasant
  const nightPeasantTile = findAdjacentGrass(nightKingTile, generatedTiles);

  // Place pieces
  const tilesWithDayKing = GameMap.replaceTile(
    { row: dayKingTile.row, column: dayKingTile.column, piece: createKing("day") },
    generatedTiles,
  ) as Tile[];

  const tilesWithDayPeasant = GameMap.replaceTile(
    {
      row: dayPeasantTile.row,
      column: dayPeasantTile.column,
      piece: createPeasant("day"),
    },
    tilesWithDayKing,
  ) as Tile[];

  const tilesWithNightKing = GameMap.replaceTile(
    {
      row: nightKingTile.row,
      column: nightKingTile.column,
      piece: createKing("night"),
    },
    tilesWithDayPeasant,
  ) as Tile[];

  const tiles = GameMap.replaceTile(
    {
      row: nightPeasantTile.row,
      column: nightPeasantTile.column,
      piece: createPeasant("night"),
    },
    tilesWithNightKing,
  ) as Tile[];

  const dayPlayerEmail =
    params.alliance === "day"
      ? params.creatorEmail
      : params.inviteEmail ?? null;
  const nightPlayerEmail =
    params.alliance === "night"
      ? params.creatorEmail
      : params.inviteEmail ?? null;

  return {
    name: params.name,
    size: params.boardSize,
    tiles,
    dayPlayer,
    nightPlayer,
    currentPlayer: "day" as const,
    clock: { time: 6, hasDawned: true, hasDusked: false },
    creatorEmail: params.creatorEmail,
    dayPlayerEmail,
    nightPlayerEmail,
    invitedEmail: params.inviteEmail,
    gameOver: false,
    winner: null,
  };
};

const findAdjacentGrass = (
  tile: Tile,
  tiles: ReadonlyArray<Tile>,
): Tile => {
  const neighbors = hex.findNeighbors(tile, tiles as Tile[]);
  const grassNeighbor = neighbors.find(
    (neighbor) =>
      neighbor.landscape?.type === LandscapeType.grass &&
      neighbor.piece === null,
  );
  // Fallback: if no adjacent grass, use the first neighbor available
  return grassNeighbor ?? neighbors.at(0) ?? tile;
};
