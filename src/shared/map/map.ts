import * as hex from "./hex.ts";
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

// Fixed thresholds for water and sand (not configurable)
const DEEP_WATER_THRESHOLD = 0.30;
const SAND_THRESHOLD = 0.38;

// Noise scale controls feature size (lower = larger features)
const ELEVATION_SCALE = 0.12;
const VEGETATION_SCALE = 0.25;

/**
 * Compute dynamic thresholds from forest and mountain density.
 *
 * The land band (0.38 – 1.0) is divided into grass, forest, and mountain zones.
 * forestDensity shifts where trees start (lower = more trees).
 * mountainDensity shifts where mountains start (lower = more mountains).
 */
const computeThresholds = (config: MapConfig) => {
  // grassEnd: where pure grass stops and forest mixing begins
  // Range: 0.40 (density=1, almost all forest) to 0.90 (density=0, almost no forest)
  const grassEnd = 0.40 + (1 - config.forestDensity) * 0.50;

  // mountainStart: where mountains begin
  // Range: 0.60 (density=1, lots of mountains) to 0.98 (density=0, almost none)
  const mountainStart = 0.60 + (1 - config.mountainDensity) * 0.38;

  // treeEnd must not exceed mountainStart
  const treeEnd = Math.min(grassEnd + 0.20, mountainStart);

  return {
    grassEnd,
    treeEnd,
    mountainStart,
  };
};

// ============================================
// LANDSCAPE FROM ELEVATION
// ============================================

const landscapeFromElevation = (
  elevation: number,
  vegetation: number,
  config: MapConfig,
): Landscape => {
  if (elevation < DEEP_WATER_THRESHOLD) return water();
  if (elevation < SAND_THRESHOLD) return sand();

  const { grassEnd, treeEnd, mountainStart } = computeThresholds(config);

  if (elevation < grassEnd) return grass();
  if (elevation < treeEnd) {
    // Mixed zone: vegetation noise determines tree placement
    const treeChance = (elevation - grassEnd) / (treeEnd - grassEnd);
    return vegetation < treeChance ? tree() : grass();
  }
  if (elevation < mountainStart) return tree();
  return mountain();
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
    const neighbors = hex.findNeighbors(tile, tiles as Tile[]);
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
    const neighbors = hex.findNeighbors(tile, tiles as Tile[]);
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

export class GameMap {
  static generate(
    size: number,
    random: RandomFunction = Math.random,
    config: MapConfig = defaultMapConfig,
  ) {
    const elevationNoise = createNoise(random, 4, 2.0, 0.5);
    const vegetationNoise = createNoise(random, 2, 2.0, 0.5);

    const tiles = Array.from({ length: size * size }, (_, tileNumber) => {
      const column = tileNumber % size;
      const row = Math.floor(tileNumber / size);

      const rawElevation = elevationNoise(
        column * ELEVATION_SCALE,
        row * ELEVATION_SCALE,
      );
      const mask = islandMask(row, column, size, config.waterLevel);
      // Multiplicative blend: mask=0 forces deep water, mask=1 uses full noise
      const elevation = rawElevation * mask;

      const vegetation = vegetationNoise(
        column * VEGETATION_SCALE,
        row * VEGETATION_SCALE,
      );

      const landscape = landscapeFromElevation(elevation, vegetation, config);

      return { column, row, landscape, piece: null, building: null, steed: null } as Tile;
    });

    // Post-process: beaches then sand cleanup
    const withBeaches = createBeaches(tiles);
    const cleaned = cleanupSand(withBeaches);

    return cleaned;
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
