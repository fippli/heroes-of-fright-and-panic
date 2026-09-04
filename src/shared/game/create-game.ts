import { LandscapeType, grass as grassLandscape, farm as farmLandscape } from "@shared/map/landscape.ts";
import { GameMap, defaultMapConfig, type MapConfig } from "@shared/map/map.ts";
import type { Tile } from "@shared/map/tile.ts";
import type { PlayerType } from "@shared/piece/index.ts";
import { createKing, createPeasant } from "@shared/piece/index.ts";
import { createCastleBuilding, createHouseBuilding } from "@shared/building/index.ts";
import { createPlayer } from "@shared/player/index.ts";
import { createResourceMap } from "@shared/player/resource-map.ts";
import { replaceTile, findNeighborTiles, findTilesInRange, findTile } from "@shared/tile/index.ts";
import { neighborAt } from "@shared/map/hex.ts";
import { createRandom, type RandomFunction } from "@shared/utils/random.ts";
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

    // Each game rolls the day player into a random quadrant; night starts in
    // the diagonally opposite one, keeping the two kingdoms far apart.
    const coastDistance = computeCoastDistance(generatedTiles);
    const dayQuadrant = Math.min(3, Math.floor(random() * 4));
    const nightQuadrant = 3 - dayQuadrant;
    const dayKingTile =
      pickStartTile(generatedTiles, coastDistance, dayQuadrant, boardSize, random, null) ??
      startCandidates[0] ??
      fallbackTile;
    const nightKingTile =
      pickStartTile(generatedTiles, coastDistance, nightQuadrant, boardSize, random, dayKingTile) ??
      startCandidates.at(-1) ??
      fallbackTile;

    const tilesWithDayClearing = clearStartingArea(dayKingTile, generatedTiles);
    const tilesWithBothClearings = clearStartingArea(nightKingTile, tilesWithDayClearing);

    const connected = hasWalkablePath(tilesWithBothClearings, dayKingTile, nightKingTile);
    // Decent starts stand on grass, clear of the beach; a map that cannot
    // offer that is rerolled while attempts remain
    const goodStarts = [dayKingTile, nightKingTile].every(
      (king) =>
        king.landscape?.type === LandscapeType.grass &&
        (coastDistance.get(`${king.row},${king.column}`) ?? Number.POSITIVE_INFINITY) >= 2,
    );

    if ((!connected || !goodStarts) && attemptIndex < MAX_GENERATION_ATTEMPTS - 1) {
      return attempt(attemptIndex + 1);
    }

    const dayPeasantTile = findAdjacentGrass(dayKingTile, tilesWithBothClearings, [nightKingTile]);
    const nightPeasantTile = findAdjacentGrass(nightKingTile, tilesWithBothClearings, [
      dayKingTile,
      dayPeasantTile,
    ]);

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

/** Ideal distance from the keep to the nearest coast (sand or water) */
const COAST_CLEARANCE = 3;

/**
 * Hex-step distance from every tile to the nearest sand or water tile
 * (multi-source BFS). 0 for the coast itself, Infinity on all-land maps.
 */
const computeCoastDistance = (
  tiles: ReadonlyArray<Tile>,
): ReadonlyMap<string, number> => {
  const positionKey = (tile: { row: number; column: number }): string =>
    `${tile.row},${tile.column}`;
  const byKey = new Map(tiles.map((tile) => [positionKey(tile), tile]));
  const distances = new Map<string, number>();
  let frontier = tiles.filter(
    (tile) =>
      tile.landscape?.type === LandscapeType.sand ||
      tile.landscape?.type === LandscapeType.water,
  );
  frontier.forEach((tile) => distances.set(positionKey(tile), 0));

  let depth = 0;
  while (frontier.length > 0) {
    depth += 1;
    const next: Tile[] = [];
    for (const tile of frontier) {
      for (let direction = 0; direction < 6; direction += 1) {
        const neighborPosition = neighborAt(tile, direction);
        const neighborKey = positionKey(neighborPosition);
        const neighbor = byKey.get(neighborKey);
        if (neighbor === undefined || distances.has(neighborKey)) continue;
        distances.set(neighborKey, depth);
        next.push(neighbor);
      }
    }
    frontier = next;
  }
  return distances;
};

/**
 * A starting spot inside the given quadrant (0=NW, 1=NE, 2=SW, 3=SE): grass,
 * close to the coast but at least COAST_CLEARANCE tiles inland, chosen at
 * random among the equally good spots. The clearance relaxes step by step on
 * grass-poor maps, then any grass or walkable tile in the quadrant will do.
 */
const pickStartTile = (
  tiles: ReadonlyArray<Tile>,
  coastDistance: ReadonlyMap<string, number>,
  quadrant: number,
  boardSize: number,
  random: RandomFunction,
  avoid: Tile | null,
): Tile | null => {
  const half = boardSize / 2;
  const inQuadrant = (tile: Tile): boolean => {
    const north = tile.row < half;
    const west = tile.column < half;
    if (quadrant === 0) return north && west;
    if (quadrant === 1) return north && !west;
    if (quadrant === 2) return !north && west;
    return !north && !west;
  };
  const distanceOf = (tile: Tile): number =>
    coastDistance.get(`${tile.row},${tile.column}`) ?? Number.POSITIVE_INFINITY;
  const notAvoided = (tile: Tile): boolean =>
    avoid === null || tile.row !== avoid.row || tile.column !== avoid.column;

  const grassHere = tiles.filter(
    (tile) => inQuadrant(tile) && tile.landscape?.type === LandscapeType.grass && notAvoided(tile),
  );

  for (let clearance = COAST_CLEARANCE; clearance >= 1; clearance -= 1) {
    const inland = grassHere.filter((tile) => distanceOf(tile) >= clearance);
    if (inland.length === 0) continue;
    // Close to the beach without standing on it: the smallest valid distance
    const closest = Math.min(...inland.map(distanceOf));
    const shoreline = inland.filter((tile) => distanceOf(tile) === closest);
    return shoreline[Math.min(shoreline.length - 1, Math.floor(random() * shoreline.length))] ?? null;
  }

  if (grassHere.length > 0) {
    return grassHere[Math.min(grassHere.length - 1, Math.floor(random() * grassHere.length))] ?? null;
  }
  const walkableHere = tiles.filter(
    (tile) =>
      inQuadrant(tile) &&
      (tile.landscape?.type === LandscapeType.grass || tile.landscape?.type === LandscapeType.sand) &&
      notAvoided(tile),
  );
  return walkableHere[Math.min(walkableHere.length - 1, Math.floor(random() * walkableHere.length))] ?? null;
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
  avoid: ReadonlyArray<Tile> = [],
): Tile => {
  const taken = (candidate: Tile): boolean =>
    avoid.some((other) => other.row === candidate.row && other.column === candidate.column);
  const neighbors = findNeighborTiles(tiles, tile).filter((neighbor) => !taken(neighbor));
  const grassNeighbor = neighbors.find(
    (neighbor) =>
      neighbor.landscape?.type === LandscapeType.grass &&
      neighbor.piece === null,
  );
  // Fallback: if no adjacent grass, use the first free neighbor available
  return grassNeighbor ?? neighbors.at(0) ?? tile;
};
