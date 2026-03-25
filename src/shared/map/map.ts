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
const FOREST_SCALE = 0.18;
const MOUNTAIN_SCALE = 0.15;

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
    const forest = forestNoise(
      column * FOREST_SCALE,
      row * FOREST_SCALE,
    );
    const mountains = mountainNoise(
      column * MOUNTAIN_SCALE,
      row * MOUNTAIN_SCALE,
    );

    const landscape = landscapeFromNoise(elevation, forest, mountains, config);

    return { column, row, landscape, piece: null, building: null, steed: null } as Tile;
  });

  const withBeaches = createBeaches(tiles);
  return cleanupSand(withBeaches);
};

/**
 * @deprecated Use generateMap instead. Kept for backward compatibility
 * with edge functions that import GameMap.generate.
 */
export const GameMap = {
  generate: generateMap,
};
