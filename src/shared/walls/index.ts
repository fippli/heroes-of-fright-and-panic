import { BuildingType } from "@shared/building/index.ts";
import { LandscapeType } from "@shared/map/landscape.ts";
import { neighborAt } from "@shared/map/hex.ts";
import type { Tile, TilePosition } from "@shared/map/tile.ts";
import type { PlayerType } from "@shared/piece/index.ts";

/** Towers link to friendly towers at most this many hexes away */
export const TOWER_LINK_RANGE = 6;
/** A single wall run may cover at most this many tiles */
const MAX_PATH_TILES = 9;
/** A new tower connects to at most this many existing towers */
const MAX_LINKS = 2;

export type PlannedWall = {
  readonly position: TilePosition;
  /** Edge directions this wall joins toward (0=E … 5=NE) */
  readonly edges: ReadonlyArray<number>;
  /** False when a hand-placed wall already stands here (no extra cost) */
  readonly isNew: boolean;
};

export type WallPlan = {
  readonly walls: ReadonlyArray<PlannedWall>;
  /** Wall tiles that must be paid for (1 stone each) */
  readonly newWallCount: number;
  readonly linkedTowers: ReadonlyArray<TilePosition>;
};

const key = (position: TilePosition): string => `${position.row},${position.column}`;

const hexDistance = (a: TilePosition, b: TilePosition): number => {
  const q = (t: TilePosition): number => t.column - Math.floor((t.row - (t.row & 1)) / 2);
  const dq = q(a) - q(b);
  const dr = a.row - b.row;
  return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
};

const directionTo = (from: TilePosition, to: TilePosition): number | null => {
  for (let direction = 0; direction < 6; direction += 1) {
    const neighbor = neighborAt(from, direction);
    if (neighbor.row === to.row && neighbor.column === to.column) return direction;
  }
  return null;
};

/** Forests, mountains and water block enemies already: they are wall for free */
const isNaturalBarrier = (tile: Tile): boolean =>
  tile.landscape?.type === LandscapeType.tree ||
  tile.landscape?.type === LandscapeType.mountain ||
  tile.landscape?.type === LandscapeType.water;

/** Whether the wall line may run through this tile on its way to a tower */
const isTraversable = (tile: Tile, player: PlayerType): boolean => {
  if (isNaturalBarrier(tile)) return true;
  if (tile.building !== null) {
    return tile.building.owner === player && tile.building.type === BuildingType.wall;
  }
  if (tile.piece !== null && tile.piece.owner !== player) return false;
  return (
    tile.landscape?.type === LandscapeType.grass ||
    tile.landscape?.type === LandscapeType.sand ||
    tile.landscape?.type === LandscapeType.farm
  );
};

/** Shortest run of tiles from tower position to tower position (exclusive ends) */
const findWallPath = (
  byKey: ReadonlyMap<string, Tile>,
  from: TilePosition,
  to: TilePosition,
  player: PlayerType,
): TilePosition[] | null => {
  const cameFrom = new Map<string, TilePosition | null>([[key(from), null]]);
  let frontier: TilePosition[] = [from];

  for (let depth = 0; depth <= MAX_PATH_TILES && frontier.length > 0; depth += 1) {
    const next: TilePosition[] = [];
    for (const position of frontier) {
      for (let direction = 0; direction < 6; direction += 1) {
        const neighbor = neighborAt(position, direction);
        const neighborKey = key(neighbor);
        if (cameFrom.has(neighborKey)) continue;
        if (neighborKey === key(to)) {
          cameFrom.set(neighborKey, position);
          const path: TilePosition[] = [];
          let step = cameFrom.get(neighborKey) ?? null;
          while (step !== null && key(step) !== key(from)) {
            path.unshift(step);
            step = cameFrom.get(key(step)) ?? null;
          }
          return path;
        }
        const tile = byKey.get(neighborKey);
        if (tile === undefined || !isTraversable(tile, player)) continue;
        cameFrom.set(neighborKey, position);
        next.push(neighbor);
      }
    }
    frontier = next;
  }
  return null;
};

/**
 * Plan the curtain wall a new tower at `position` would raise: shortest runs
 * to the nearest friendly towers (at most MAX_LINKS), walling every open land
 * tile along the way. Natural barriers — forest, mountains, water — are wall
 * for free, and existing hand-placed walls are joined rather than rebuilt.
 */
export const planTowerWalls = (
  tiles: ReadonlyArray<Tile>,
  position: TilePosition,
  player: PlayerType,
): WallPlan => {
  const byKey = new Map(tiles.map((tile) => [key(tile), tile]));

  const candidates = tiles
    .filter(
      (tile) =>
        tile.building !== null &&
        tile.building.type === BuildingType.tower &&
        tile.building.owner === player &&
        hexDistance(tile, position) <= TOWER_LINK_RANGE,
    )
    .map((tower) => ({ tower, path: findWallPath(byKey, position, tower, player) }))
    .filter((entry): entry is { tower: Tile; path: TilePosition[] } => entry.path !== null)
    .sort(
      (a, b) =>
        a.path.length - b.path.length || hexDistance(a.tower, position) - hexDistance(b.tower, position),
    )
    .slice(0, MAX_LINKS);

  // Collect edges per wall tile; a tile shared by two runs joins all of them
  const edgesByTile = new Map<string, Set<number>>();
  candidates.forEach(({ tower, path }) => {
    const line: TilePosition[] = [position, ...path, tower];
    path.forEach((step, index) => {
      const tile = byKey.get(key(step));
      if (tile === undefined || isNaturalBarrier(tile)) return;
      const edges = edgesByTile.get(key(step)) ?? new Set<number>();
      const toPrevious = directionTo(step, line[index] as TilePosition);
      const toNext = directionTo(step, line[index + 2] as TilePosition);
      if (toPrevious !== null) edges.add(toPrevious);
      if (toNext !== null) edges.add(toNext);
      edgesByTile.set(key(step), edges);
    });
  });

  const walls: PlannedWall[] = [...edgesByTile.entries()].map(([tileKey, edges]) => {
    const tile = byKey.get(tileKey) as Tile;
    return {
      position: { row: tile.row, column: tile.column },
      edges: [...edges].sort((a, b) => a - b),
      isNew: tile.building === null,
    };
  });

  return {
    walls,
    newWallCount: walls.filter((wall) => wall.isNew).length,
    linkedTowers: candidates.map(({ tower }) => ({ row: tower.row, column: tower.column })),
  };
};
