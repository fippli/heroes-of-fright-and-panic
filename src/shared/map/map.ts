import {
  grass,
  water,
  sand,
  tree,
  mountain,
  LandscapeType,
  type Landscape,
} from "./landscape.ts";
import type { RandomFunction } from "@shared/utils/random.ts";
import { createNoise, type NoiseFunction } from "@shared/utils/noise.ts";
import type { Tile, TilePosition } from "./tile.ts";
import { findNeighborTiles } from "@shared/tile/index.ts";

// ============================================
// MAP CONFIGURATION
// ============================================

export type MapConfig = {
  /** Forest density: 0 = no trees, 1 = maximum forest coverage. Default 0.5. */
  readonly forestDensity: number;
  /** Mountain density: 0 = no mountains, 1 = maximum mountain coverage. Default 0.5. */
  readonly mountainDensity: number;
  /** Noise frequency for forests: higher = smaller, more scattered clusters. Default FOREST_SCALE. */
  readonly forestScale?: number;
  /** Noise frequency for mountains: higher = smaller clusters. Default MOUNTAIN_SCALE. */
  readonly mountainScale?: number;
  /** Water level: 0 = minimal water (large island), 1 = mostly water (tiny island). Default 0.5. */
  readonly waterLevel: number;
};

export const defaultMapConfig: MapConfig = {
  forestDensity: 0.5,
  mountainDensity: 0.5,
  waterLevel: 0.5,
};

// ============================================
// TERRAIN THRESHOLDS
// ============================================

// Elevation thresholds for water/land boundary
const WATER_THRESHOLD = 0.30;
const SAND_THRESHOLD = 0.38;

// Noise scales — lower = larger features
const ELEVATION_SCALE = 0.12;
// Higher = smaller, more scattered clusters (0.18/0.15 gave sprawling blobs)
const FOREST_SCALE = 0.5;
const MOUNTAIN_SCALE = 0.45;

// ============================================
// LANDSCAPE FROM INDEPENDENT NOISE LAYERS
// ============================================

/**
 * Determine terrain from three independent noise values.
 *
 * Elevation controls water vs land (shaped by island mask).
 * Forest noise and mountain noise independently determine where
 * trees and mountains appear within the land area. This allows
 * forests and mountain ranges to cluster anywhere on the island,
 * not just at the center.
 *
 * Mountains take priority over forests when both are high.
 */
const landscapeFromNoise = (
  elevation: number,
  forestNoise: number,
  mountainNoise: number,
  config: MapConfig,
): Landscape => {
  if (elevation < WATER_THRESHOLD) return water();
  if (elevation < SAND_THRESHOLD) return sand();

  // Forest threshold: higher density → lower threshold → more tiles become forest
  // Range: 0.20 (density=1) to 0.80 (density=0)
  const forestThreshold = 0.20 + (1 - config.forestDensity) * 0.60;

  // Mountain threshold: higher density → lower threshold → more tiles become mountain
  // Range: 0.40 (density=1) to 0.85 (density=0)
  const mountainThreshold = 0.40 + (1 - config.mountainDensity) * 0.45;

  // Mountains take priority where mountain noise is high enough
  if (mountainNoise > mountainThreshold) return mountain();

  // Forests where forest noise exceeds threshold
  if (forestNoise > forestThreshold) return tree();

  return grass();
};

// ============================================
// ISLAND MASK
// ============================================

/**
 * Hexagonal distance-from-center falloff.
 *
 * Converts offset coordinates to cube coordinates, then uses hex distance
 * (max of the three cube axes) to produce a hexagon-shaped island mask.
 * Returns 1.0 at center, falling to 0.0 at the hex boundary.
 */
const islandMask = (
  row: number,
  column: number,
  size: number,
  waterLevel: number,
): number => {
  const centerRow = (size - 1) / 2;
  const centerCol = (size - 1) / 2;

  // Offset to cube coordinates (odd-r layout)
  const toQ = (r: number, c: number): number => c - (r - (r & 1)) / 2;
  const toR = (r: number): number => r;

  const tileQ = toQ(row, column);
  const tileR = toR(row);
  const tileS = -tileQ - tileR;

  const centerQ = toQ(Math.round(centerRow), Math.round(centerCol));
  const centerR = toR(Math.round(centerRow));
  const centerS = -centerQ - centerR;

  // Hex distance = max of absolute differences on all three cube axes
  const hexDistance = Math.max(
    Math.abs(tileQ - centerQ),
    Math.abs(tileR - centerR),
    Math.abs(tileS - centerS),
  );

  // hexRadius controls island size — larger = more land
  // waterLevel 0 = radius 0.75 (big island), waterLevel 1 = radius 0.30 (tiny island)
  const hexRadius = size * (0.75 - waterLevel * 0.45);
  const normalized = hexDistance / hexRadius;

  // Smooth falloff: 1.0 at center, tapering to 0.0 at edge and beyond
  return Math.max(0, 1 - normalized * normalized);
};

// ============================================
// POST-PROCESSING
// ============================================

/**
 * Ensure sand only borders water. Sand tiles with no water neighbor become grass.
 */
const cleanupSand = (tiles: ReadonlyArray<Tile>): Tile[] =>
  tiles.map((tile) => {
    if (tile.landscape?.type !== LandscapeType.sand) return tile as Tile;
    const neighbors = findNeighborTiles(tiles, tile);
    const hasWaterNeighbor = neighbors.some(
      (neighbor) => neighbor.landscape?.type === LandscapeType.water,
    );
    return hasWaterNeighbor ? tile as Tile : { ...tile, landscape: grass() } as Tile;
  });

/**
 * Ensure beaches: water tiles adjacent to land become sand.
 */
const createBeaches = (tiles: ReadonlyArray<Tile>): Tile[] =>
  tiles.map((tile) => {
    if (tile.landscape?.type !== LandscapeType.water) return tile as Tile;
    const neighbors = findNeighborTiles(tiles, tile);
    const hasLandNeighbor = neighbors.some(
      (neighbor) =>
        neighbor.landscape !== null &&
        neighbor.landscape.type !== LandscapeType.water &&
        neighbor.landscape.type !== LandscapeType.sand,
    );
    return hasLandNeighbor ? { ...tile, landscape: sand() } as Tile : tile as Tile;
  });

// ============================================
// GENERATION
// ============================================

/**
 * Generate a map of the given size using noise-based terrain.
 */
export const generateMap = (
  size: number,
  random: RandomFunction = Math.random,
  config: MapConfig = defaultMapConfig,
): ReadonlyArray<Tile> => {
  // Three independent noise layers, each with different octave counts
  // for varied feature sizes
  const elevationNoise = createNoise(random, 4, 2.0, 0.5);
  const forestNoise = createNoise(random, 3, 2.0, 0.5);
  const mountainNoise = createNoise(random, 2, 2.0, 0.5);

  const tiles = Array.from({ length: size * size }, (_, tileNumber) => {
    const column = tileNumber % size;
    const row = Math.floor(tileNumber / size);

    // Elevation: controls water vs land boundary
    const rawElevation = elevationNoise(
      column * ELEVATION_SCALE,
      row * ELEVATION_SCALE,
    );
    const mask = islandMask(row, column, size, config.waterLevel);
    const elevation = rawElevation * mask;

    // Forest and mountain: independent layers that can cluster anywhere on land
    const forestScale = config.forestScale ?? FOREST_SCALE;
    const mountainScale = config.mountainScale ?? MOUNTAIN_SCALE;
    const forest = forestNoise(column * forestScale, row * forestScale);
    const mountains = mountainNoise(column * mountainScale, row * mountainScale);

    const landscape = landscapeFromNoise(elevation, forest, mountains, config);

    return { column, row, landscape, piece: null, building: null, steed: null } as Tile;
  });

  const withBeaches = createBeaches(tiles);
  return connectLand(cleanupSand(withBeaches));
};

// ============================================
// CONNECTIVITY
// ============================================

const WALKABLE_TYPES: ReadonlyArray<LandscapeType> = [
  LandscapeType.grass,
  LandscapeType.sand,
  LandscapeType.farm,
];

const tileKey = (tile: TilePosition): string => `${tile.row},${tile.column}`;

const isWalkable = (tile: Tile): boolean =>
  tile.landscape !== null && WALKABLE_TYPES.includes(tile.landscape.type);

const isLand = (tile: Tile): boolean =>
  tile.landscape !== null &&
  tile.landscape.type !== LandscapeType.water &&
  tile.landscape.type !== LandscapeType.unexplored;

type Lookup = {
  readonly byKey: ReadonlyMap<string, Tile>;
  readonly neighborKeys: ReadonlyMap<string, ReadonlyArray<string>>;
};

/** Index tiles by key; neighbour keys are computed once since positions never change */
const buildLookup = (
  tiles: ReadonlyArray<Tile>,
  neighborKeys?: ReadonlyMap<string, ReadonlyArray<string>>,
): Lookup => ({
  byKey: new Map(tiles.map((tile) => [tileKey(tile), tile])),
  neighborKeys:
    neighborKeys ??
    new Map(
      tiles.map((tile) => [
        tileKey(tile),
        findNeighborTiles(tiles, tile).map(tileKey),
      ]),
    ),
});

const neighborsOf = (lookup: Lookup, key: string): ReadonlyArray<Tile> =>
  (lookup.neighborKeys.get(key) ?? [])
    .map((neighborKey) => lookup.byKey.get(neighborKey))
    .filter((tile): tile is Tile => tile !== undefined);

/** Connected components of walkable land, largest first */
const walkableComponents = (lookup: Lookup): ReadonlyArray<ReadonlyArray<Tile>> => {
  const seen = new Set<string>();
  const components: Tile[][] = [];
  lookup.byKey.forEach((start) => {
    if (!isWalkable(start) || seen.has(tileKey(start))) return;
    const component: Tile[] = [];
    const stack: Tile[] = [start];
    seen.add(tileKey(start));
    while (stack.length > 0) {
      const tile = stack.pop() as Tile;
      component.push(tile);
      neighborsOf(lookup, tileKey(tile)).forEach((neighbor) => {
        if (isWalkable(neighbor) && !seen.has(tileKey(neighbor))) {
          seen.add(tileKey(neighbor));
          stack.push(neighbor);
        }
      });
    }
    components.push(component);
  });
  return components.sort((a, b) => b.length - a.length);
};

/**
 * Shortest land route (through trees/mountains) from the main component to
 * any other walkable component. Returns the obstacle tiles to clear, or null
 * when every other component is only reachable across water.
 */
const corridorToNextComponent = (
  main: ReadonlySet<string>,
  lookup: Lookup,
): ReadonlyArray<Tile> | null => {
  const parent = new Map<string, Tile | null>();
  const queue: Tile[] = [];
  lookup.byKey.forEach((tile, key) => {
    if (main.has(key)) {
      parent.set(key, null);
      queue.push(tile);
    }
  });
  let head = 0;
  while (head < queue.length) {
    const tile = queue[head];
    head += 1;
    for (const neighbor of neighborsOf(lookup, tileKey(tile))) {
      const key = tileKey(neighbor);
      if (parent.has(key) || !isLand(neighbor)) continue;
      parent.set(key, tile);
      if (isWalkable(neighbor)) {
        // Reached another component: walk back and collect the obstacles
        const corridor: Tile[] = [];
        let step: Tile | null = tile;
        while (step !== null && !main.has(tileKey(step))) {
          corridor.push(step);
          step = parent.get(tileKey(step)) ?? null;
        }
        return corridor;
      }
      queue.push(neighbor);
    }
  }
  return null;
};

/**
 * Guarantee that all walkable land is one connected region: repeatedly join
 * the largest component to the nearest other one by turning the trees or
 * mountains on the shortest route between them into grass. Land that is
 * separated by water is left as islands (boats exist for that).
 */
export const connectLand = (tiles: ReadonlyArray<Tile>): Tile[] => {
  let current: Tile[] = [...tiles];
  let lookup = buildLookup(current);
  for (let guard = 0; guard < tiles.length; guard += 1) {
    const components = walkableComponents(lookup);
    if (components.length <= 1) break;
    const main = new Set(components[0].map(tileKey));
    const corridor = corridorToNextComponent(main, lookup);
    if (corridor === null) break;
    const clear = new Set(corridor.map(tileKey));
    current = current.map((tile) =>
      clear.has(tileKey(tile)) ? { ...tile, landscape: grass() } : tile,
    );
    lookup = buildLookup(current, lookup.neighborKeys);
  }
  return current;
};

/**
 * @deprecated Use generateMap instead. Kept for backward compatibility
 * with edge functions that import GameMap.generate.
 */
export const GameMap = {
  generate: generateMap,
};
