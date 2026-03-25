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
// TERRAIN
// ============================================

// Elevation threshold for water/land boundary
const WATER_THRESHOLD = 0.30;
const SAND_THRESHOLD = 0.38;

const ELEVATION_SCALE = 0.12;

// ============================================
// BIOME REGIONS (Catan-style hex clusters)
// ============================================

// How many fine tiles across each biome region is (approximate diameter)
const REGION_SIZE = 5;

type Biome = "grass" | "tree" | "mountain";

/**
 * Convert offset (row, col) to cube coordinates for hex math.
 * Uses odd-r offset layout.
 */
const toCube = (row: number, column: number): { readonly cubeQ: number; readonly cubeR: number; readonly cubeS: number } => {
  const cubeQ = column - (row - (row & 1)) / 2;
  const cubeR = row;
  const cubeS = -cubeQ - cubeR;
  return { cubeQ, cubeR, cubeS };
};

/**
 * Round floating-point cube coordinates to the nearest hex center.
 */
const cubeRound = (
  fractionalQ: number,
  fractionalR: number,
  fractionalS: number,
): { readonly cubeQ: number; readonly cubeR: number; readonly cubeS: number } => {
  const roundedQ = Math.round(fractionalQ);
  const roundedR = Math.round(fractionalR);
  const roundedS = Math.round(fractionalS);

  const diffQ = Math.abs(roundedQ - fractionalQ);
  const diffR = Math.abs(roundedR - fractionalR);
  const diffS = Math.abs(roundedS - fractionalS);

  if (diffQ > diffR && diffQ > diffS) {
    return { cubeQ: -roundedR - roundedS, cubeR: roundedR, cubeS: roundedS };
  }
  if (diffR > diffS) {
    return { cubeQ: roundedQ, cubeR: -roundedQ - roundedS, cubeS: roundedS };
  }
  return { cubeQ: roundedQ, cubeR: roundedR, cubeS: -roundedQ - roundedR };
};

/**
 * Map a fine tile to its coarse region center in cube coordinates.
 * Tiles within the same region share a biome.
 */
const regionCenter = (
  row: number,
  column: number,
): { readonly regionQ: number; readonly regionR: number } => {
  const { cubeQ, cubeR, cubeS } = toCube(row, column);
  const rounded = cubeRound(
    cubeQ / REGION_SIZE,
    cubeR / REGION_SIZE,
    cubeS / REGION_SIZE,
  );
  return { regionQ: rounded.cubeQ, regionR: rounded.cubeR };
};

/**
 * Determine the biome for a region using noise sampled at the region center.
 * The biome noise value is compared against forest and mountain thresholds.
 */
const regionBiome = (
  regionQ: number,
  regionR: number,
  biomeNoise: NoiseFunction,
  config: MapConfig,
): Biome => {
  // Sample noise at the region center (scaled to spread values)
  const noiseValue = biomeNoise(regionQ * 1.7, regionR * 1.7);

  // Mountain threshold: density 1 → 0.60, density 0 → 0.95
  const mountainThreshold = 0.60 + (1 - config.mountainDensity) * 0.35;

  // Forest threshold: density 1 → 0.35, density 0 → 0.80
  const forestThreshold = 0.35 + (1 - config.forestDensity) * 0.45;

  if (noiseValue > mountainThreshold) return "mountain";
  if (noiseValue > forestThreshold) return "tree";
  return "grass";
};

const biomeToLandscape = (biome: Biome): Landscape => {
  switch (biome) {
    case "tree": return tree();
    case "mountain": return mountain();
    case "grass": return grass();
  }
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
  const elevationNoise = createNoise(random, 4, 2.0, 0.5);
  const biomeNoise = createNoise(random, 2, 2.0, 0.5);

  // Cache region biomes so each region is computed once
  const regionBiomeCache = new Map<string, Biome>();

  const getRegionBiome = (regionQ: number, regionR: number): Biome => {
    const key = `${regionQ},${regionR}`;
    const cached = regionBiomeCache.get(key);
    if (cached !== undefined) return cached;
    const biome = regionBiome(regionQ, regionR, biomeNoise, config);
    regionBiomeCache.set(key, biome);
    return biome;
  };

  const tiles = Array.from({ length: size * size }, (_, tileNumber) => {
    const column = tileNumber % size;
    const row = Math.floor(tileNumber / size);

    // Elevation controls water vs land
    const rawElevation = elevationNoise(
      column * ELEVATION_SCALE,
      row * ELEVATION_SCALE,
    );
    const mask = islandMask(row, column, size, config.waterLevel);
    const elevation = rawElevation * mask;

    // Water and sand from elevation
    const landscape = (() => {
      if (elevation < WATER_THRESHOLD) return water();
      if (elevation < SAND_THRESHOLD) return sand();

      // Land tile: get biome from the region this tile belongs to
      const { regionQ, regionR } = regionCenter(row, column);
      const biome = getRegionBiome(regionQ, regionR);
      return biomeToLandscape(biome);
    })();

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
