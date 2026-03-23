import type { Tile } from "./tile.ts";
import { GameMap } from "./map.ts";
import { weightedRandom } from "@shared/utils/weightedRandom.ts";
import type { RandomFunction } from "@shared/utils/random.ts";
import { createResourceMap, type ResourceMap } from "@shared/player/resource-map.ts";

export enum LandscapeType {
  grass = "grass",
  farm = "farm",
  tree = "tree",
  sand = "sand",
  water = "water",
  unexplored = "unexplored",
  mountain = "mountain",
}

export type Landscape = {
  readonly type: LandscapeType;
  readonly lootDrop?: ResourceMap;
};

export const grass = (): Landscape => ({
  type: LandscapeType.grass,
});

export const farm = (): Landscape => ({
  type: LandscapeType.farm,
});

export const water = (): Landscape => ({
  type: LandscapeType.water,
});

export const sand = (): Landscape => ({
  type: LandscapeType.sand,
});

export const mountain = (): Landscape => ({
  type: LandscapeType.mountain,
  lootDrop: createResourceMap({ stone: 1 }),
});

export const tree = (): Landscape => ({
  type: LandscapeType.tree,
  lootDrop: createResourceMap({ wood: 1 }),
});

export const unexplored = (): Landscape => ({
  type: LandscapeType.unexplored,
});

export const generateLandscape = (
  neighbors: Tile[],
  random: RandomFunction = Math.random,
): Landscape => {
  const waterSeed = 0.2;
  const grassSeed = 0.8;

  if (neighbors.length === 0) {
    return grass();
  }

  if (neighbors.every((neighbor) => neighbor.landscape == null)) {
    return grass();
  }

  const landscapedNeighbors = neighbors.filter(
    (neighbor) => neighbor.landscape != null,
  );

  const isGrass = (neighbor: Tile) =>
    neighbor.landscape?.type === LandscapeType.grass;

  const isWater = (neighbor: Tile) =>
    neighbor.landscape?.type === LandscapeType.water;
  const hasWater = landscapedNeighbors.some(isWater);

  if (landscapedNeighbors.every(isGrass)) {
    return weightedRandom(
      [grass(), water()],
      [0.95, 0.01],
      random,
    );
  }

  if (hasWater) {
    return weightedRandom(
      [water(), grass()],
      [grassSeed, waterSeed],
      random,
    );
  } else {
    return weightedRandom(
      [water(), grass()],
      [waterSeed, grassSeed],
      random,
    );
  }
};

export const createBeaches = (tiles: Tile[]): Tile[] =>
  tiles.map((tile: Tile) => {
    const neighbors = GameMap.findNeighbors(tile, tiles);
    switch (tile.landscape?.type) {
      case LandscapeType.water: {
        if (
          neighbors.some(
            (neighbor: Tile) =>
              neighbor.landscape?.type === LandscapeType.grass,
          )
        ) {
          return { ...tile, landscape: sand() };
        } else {
          return tile;
        }
      }
      default: {
        return tile;
      }
    }
  });

export const cleanupSingles = (tiles: Tile[]): Tile[] =>
  tiles.map((tile) => {
    const neighbors = GameMap.findNeighbors(tile, tiles);
    if (
      neighbors.every(
        (neighbor: Tile) => neighbor.landscape?.type === LandscapeType.water,
      )
    ) {
      return { ...tile, landscape: water() };
    } else if (
      neighbors.every(
        (neighbor: Tile) => neighbor.landscape?.type === LandscapeType.grass,
      )
    ) {
      return { ...tile, landscape: grass() };
    } else {
      return tile;
    }
  });

export const cleanupSand = (tiles: Tile[]): Tile[] =>
  tiles.map((tile) => {
    const neighbors = GameMap.findNeighbors(tile, tiles);
    switch (tile.landscape?.type) {
      case LandscapeType.sand: {
        if (
          neighbors.some(
            (neighbor: Tile) =>
              neighbor.landscape?.type === LandscapeType.water,
          )
        ) {
          return tile;
        } else {
          return { ...tile, landscape: grass() };
        }
      }
      default: {
        return tile;
      }
    }
  });

export const placeTrees = (
  tiles: Tile[],
  random: RandomFunction = Math.random,
): Tile[] =>
  tiles.map((tile) => {
    if (tile.landscape?.type === LandscapeType.grass) {
      return weightedRandom(
        [
          { ...tile, landscape: tree() },
          { ...tile, landscape: grass() },
        ],
        [0.7, 0.3],
        random,
      );
    } else {
      return tile;
    }
  });

export const placeMountains = (
  tiles: Tile[],
  random: RandomFunction = Math.random,
): Tile[] =>
  tiles.map((tile) => {
    if (tile.landscape?.type === LandscapeType.grass) {
      return weightedRandom(
        [
          { ...tile, landscape: mountain() },
          { ...tile, landscape: grass() },
        ],
        [0.2, 0.8],
        random,
      );
    } else {
      return tile;
    }
  });
