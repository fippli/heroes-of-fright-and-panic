import { LandscapeType, grass as grassLandscape, farm as farmLandscape } from "@shared/map/landscape.ts";
import { GameMap, defaultMapConfig, type MapConfig } from "@shared/map/map.ts";
import type { Tile } from "@shared/map/tile.ts";
import type { PlayerType } from "@shared/piece/index.ts";
import { createKing, createPeasant } from "@shared/piece/index.ts";
import { createCastleBuilding, createHouseBuilding } from "@shared/building/index.ts";
import { createPlayer } from "@shared/player/index.ts";
import { createResourceMap } from "@shared/player/resource-map.ts";
import { replaceTile, findNeighborTiles, findTilesInRange, findTile } from "@shared/tile/index.ts";
import { createRandom } from "@shared/utils/random.ts";
import { hasWalkablePath } from "@shared/movement/index.ts";

type CreateGameParams = {
  readonly boardSize: number;
  readonly name: string;
  readonly alliance: PlayerType;
  readonly creatorEmail: string;
  readonly inviteEmail: string | null;
  readonly seed?: string | number;
  readonly mapConfig?: MapConfig;
};

const MAX_GENERATION_ATTEMPTS = 10;

type GeneratedBoard = {
  readonly tiles: ReadonlyArray<Tile>;
  readonly dayKingTile: Tile;
  readonly nightKingTile: Tile;
  readonly dayPeasantTile: Tile;
  readonly nightPeasantTile: Tile;
};

const generateBoard = (
  boardSize: number,
  seed: string | number | undefined,
  mapConfig: MapConfig,
): GeneratedBoard => {
  const seedStr = seed !== undefined ? String(seed) : "default";

  const attempt = (attemptIndex: number): GeneratedBoard => {
    const attemptSeed = attemptIndex === 0 ? seedStr : `${seedStr}-retry${attemptIndex}`;
    const random = createRandom(attemptSeed);
    const generatedTiles = GameMap.generate(boardSize, random, mapConfig) as Tile[];

    const walkableTiles = generatedTiles.filter(
      (tile) =>
        tile.landscape?.type === LandscapeType.grass ||
        tile.landscape?.type === LandscapeType.sand,
    );

    const fallbackTile = generatedTiles.at(
      Math.floor(generatedTiles.length / 2),
    ) as Tile;
    const startCandidates = walkableTiles.length > 0 ? walkableTiles : [fallbackTile];

    const maxRow = boardSize - 1;
    const maxCol = boardSize - 1;

    const dayKingTile = startCandidates.reduce((closest, tile) => {
      const distance = Math.sqrt(
        Math.pow(maxRow - tile.row, 2) + Math.pow(tile.column, 2),
      );
      const closestDistance = Math.sqrt(
        Math.pow(maxRow - closest.row, 2) + Math.pow(closest.column, 2),
      );
      return distance < closestDistance ? tile : closest;
    }, startCandidates[0]);

    const nightKingTile = startCandidates.reduce((closest, tile) => {
      const distance = Math.sqrt(
        Math.pow(tile.row, 2) + Math.pow(maxCol - tile.column, 2),
      );
      const closestDistance = Math.sqrt(
        Math.pow(closest.row, 2) + Math.pow(maxCol - closest.column, 2),
      );
      return distance < closestDistance ? tile : closest;
    }, startCandidates[0]);

    const tilesWithDayClearing = clearStartingArea(dayKingTile, generatedTiles);
    const tilesWithBothClearings = clearStartingArea(nightKingTile, tilesWithDayClearing);

    const connected = hasWalkablePath(tilesWithBothClearings, dayKingTile, nightKingTile);

    if (!connected && attemptIndex < MAX_GENERATION_ATTEMPTS - 1) {
      return attempt(attemptIndex + 1);
    }

    const dayPeasantTile = findAdjacentGrass(dayKingTile, tilesWithBothClearings);
    const nightPeasantTile = findAdjacentGrass(nightKingTile, tilesWithBothClearings);

    return {
      tiles: tilesWithBothClearings,
      dayKingTile,
      nightKingTile,
      dayPeasantTile,
      nightPeasantTile,
    };
  };

  return attempt(0);
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

  const mapConfig = params.mapConfig ?? defaultMapConfig;
  const board = generateBoard(params.boardSize, params.seed, mapConfig);

  const { dayKingTile, nightKingTile, dayPeasantTile, nightPeasantTile } = board;

  // Each side starts with a kingdom: a Keep on the start tile, the king
  // beside it, a peasant beside the king.
  const tilesWithDayKeep = replaceTile(
    board.tiles,
    { row: dayKingTile.row, column: dayKingTile.column, building: createCastleBuilding("day"), piece: createKing("day") },
  );

  const tilesWithDayPeasant = replaceTile(
    tilesWithDayKeep,
    {
      row: dayPeasantTile.row,
      column: dayPeasantTile.column,
      piece: createPeasant("day"),
    },
  );

  const tilesWithNightKeep = replaceTile(
    tilesWithDayPeasant,
    {
      row: nightKingTile.row,
      column: nightKingTile.column,
      building: createCastleBuilding("night"),
      piece: createKing("night"),
    },
  );

  const tilesWithNightPeasant = replaceTile(
    tilesWithNightKeep,
    {
      row: nightPeasantTile.row,
      column: nightPeasantTile.column,
      piece: createPeasant("night"),
    },
  );

  // One house each near the keep, by the woods where possible, so both
  // economies produce from the very first turn
  const tilesWithDayHouse = placeStartingHouse(dayKingTile, tilesWithNightPeasant, "day");
  const tiles = placeStartingHouse(nightKingTile, tilesWithDayHouse, "night");

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
    mapConfig,
  };
};

const CLEARABLE_TYPES: ReadonlyArray<LandscapeType> = [
  LandscapeType.tree,
  LandscapeType.mountain,
];

const clearStartingArea = (
  center: Tile,
  tiles: ReadonlyArray<Tile>,
): Tile[] => {
  const neighbors = findNeighborTiles(tiles, center);
  return neighbors.reduce<Tile[]>(
    (acc, neighbor) => {
      const shouldClear =
        neighbor.landscape !== null &&
        neighbor.landscape !== undefined &&
        CLEARABLE_TYPES.includes(neighbor.landscape.type);
      return shouldClear
        ? replaceTile(
            acc,
            { row: neighbor.row, column: neighbor.column, landscape: grassLandscape() },
          ) as Tile[]
        : acc;
    },
    tiles as Tile[],
  );
};

/**
 * Every kingdom starts with one house near the keep, on grass and — when the
 * terrain allows — next to a tree, so wood production runs from the first
 * turn and a bad first purchase can never lock a player out of the economy.
 * Adjacent grass becomes farmland, exactly as when a house is built in play.
 */
const placeStartingHouse = (
  keep: Tile,
  tiles: ReadonlyArray<Tile>,
  owner: PlayerType,
): ReadonlyArray<Tile> => {
  const resolve = (position: { row: number; column: number }): Tile | undefined =>
    findTile(tiles, position);
  const grassNear = (range: number, allowPiece: boolean): Tile[] =>
    findTilesInRange(tiles, keep, range)
      .map(resolve)
      .filter(
        (tile): tile is Tile =>
          tile !== undefined &&
          tile.landscape?.type === LandscapeType.grass &&
          tile.building === null &&
          (allowPiece || tile.piece === null) &&
          !(tile.row === keep.row && tile.column === keep.column),
      );
  // Widen the search on shorelines and other grass-poor starts; as a last
  // resort share the tile with a piece (pieces and buildings coexist)
  const searches: ReadonlyArray<readonly [number, boolean]> = [
    [2, false], [3, false], [4, false], [5, false], [6, false], [6, true],
  ];
  const grassCandidates = searches.reduce<Tile[]>(
    (found, [range, allowPiece]) => (found.length > 0 ? found : grassNear(range, allowPiece)),
    [],
  );

  // Some generated maps have no grass at all near a start (or anywhere);
  // terraform a nearby sand tile then, like the start-clearing step does
  const sandCandidates =
    grassCandidates.length > 0
      ? []
      : findTilesInRange(tiles, keep, 4)
          .map(resolve)
          .filter(
            (tile): tile is Tile =>
              tile !== undefined &&
              tile.landscape?.type === LandscapeType.sand &&
              tile.building === null &&
              !(tile.row === keep.row && tile.column === keep.column),
          );
  const terraform = grassCandidates.length === 0;
  const candidates = terraform ? sandCandidates : grassCandidates;
  if (candidates.length === 0) return tiles;

  // The most productive spot wins: trees make wood, grass becomes farmland
  const yieldAround = (tile: Tile): number =>
    findNeighborTiles(tiles, tile).reduce((sum, neighbor) => {
      if (neighbor.landscape?.type === LandscapeType.tree) return sum + 2;
      if (neighbor.landscape?.type === LandscapeType.grass && neighbor.building === null) return sum + 1;
      return sum;
    }, 0);
  const best = [...candidates].sort((a, b) => yieldAround(b) - yieldAround(a))[0];
  if (best === undefined) return tiles;

  const withHouse = replaceTile(tiles, {
    row: best.row,
    column: best.column,
    building: createHouseBuilding(owner),
    ...(terraform && { landscape: grassLandscape() }),
  });
  // Same rule as building a house in play: surrounding grass turns to farmland
  const withFarms = findNeighborTiles(withHouse, best)
    .filter(
      (neighbor) =>
        neighbor.landscape?.type === LandscapeType.grass &&
        neighbor.building === null,
    )
    .reduce(
      (acc, neighbor) => replaceTile(acc, { ...neighbor, landscape: farmLandscape() }),
      withHouse,
    );

  // A house that would produce nothing gets a patch of farmland dug from the
  // sand, so no start is ever locked out of the economy
  if (yieldAround(best) > 0) return withFarms;
  return findNeighborTiles(withFarms, best)
    .filter(
      (neighbor) =>
        neighbor.landscape?.type === LandscapeType.sand &&
        neighbor.building === null,
    )
    .slice(0, 2)
    .reduce(
      (acc, neighbor) => replaceTile(acc, { ...neighbor, landscape: farmLandscape() }),
      withFarms,
    );
};

const findAdjacentGrass = (
  tile: Tile,
  tiles: ReadonlyArray<Tile>,
): Tile => {
  const neighbors = findNeighborTiles(tiles, tile);
  const grassNeighbor = neighbors.find(
    (neighbor) =>
      neighbor.landscape?.type === LandscapeType.grass &&
      neighbor.piece === null,
  );
  // Fallback: if no adjacent grass, use the first neighbor available
  return grassNeighbor ?? neighbors.at(0) ?? tile;
};
