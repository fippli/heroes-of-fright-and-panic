// import { ResourceMap } from "./ResourceMap.ts";
import type { Tile } from "./tile.ts";
import { GameMap } from "./map.ts";
import { weightedRandom } from "@shared/utils/weightedRandom.ts";
import { ResourceMap } from "@shared/player/resource-map.ts";

export enum LandscapeType {
  grass = "grass",
  tree = "tree",
  sand = "sand",
  water = "water",
  unexplored = "unexplored",
  mountain = "mountain",
}

export class Landscape {
  readonly type: LandscapeType;
  readonly lootDrop?: ResourceMap;

  constructor({
    type,
    lootDrop,
  }: {
    type: LandscapeType;
    lootDrop?: ResourceMap;
  }) {
    this.type = type;
    this.lootDrop = lootDrop;
  }

  static grass() {
    return {
      type: LandscapeType.grass,
    };
  }

  static water() {
    return {
      type: LandscapeType.water,
    };
  }

  static sand() {
    return {
      type: LandscapeType.sand,
    };
  }

  static mountain() {
    return {
      type: LandscapeType.mountain,
      lootDrop: new ResourceMap({ stone: 1 }),
    };
  }

  static tree() {
    return {
      type: LandscapeType.tree,
      lootDrop: new ResourceMap({ wood: 1 }),
    };
  }

  static generate(neighbors: Tile[]): Landscape {
    const waterSeed = 0.2;
    const grassSeed = 0.8;

    if (neighbors.length === 0) {
      return Landscape.grass();
    }

    if (neighbors.every((neighbor) => !neighbor.landscape)) {
      return Landscape.grass();
    }

    const landscapedNeighbors = neighbors.filter(
      (neighbor) => neighbor.landscape,
    );

    const isGrass = (neighbor: Tile) =>
      neighbor.landscape?.type === LandscapeType.grass;

    const isWater = (neighbor: Tile) =>
      neighbor.landscape?.type === LandscapeType.water;
    const hasWater = landscapedNeighbors.some(isWater);

    if (landscapedNeighbors.every(isGrass)) {
      return weightedRandom(
        [Landscape.grass(), Landscape.water()],
        [0.95, 0.01],
      );
    }

    if (hasWater) {
      return weightedRandom(
        [Landscape.water(), Landscape.grass()],
        [grassSeed, waterSeed],
      );
    } else {
      return weightedRandom(
        [Landscape.water(), Landscape.grass()],
        [waterSeed, grassSeed],
      );
    }
  }

  static createBeaches(tiles: Tile[]) {
    return tiles.map((tile: Tile) => {
      const neighbors = GameMap.findNeighbors(tile, tiles);
      switch (tile.landscape?.type) {
        case LandscapeType.water: {
          if (
            neighbors.some(
              (neighbor: Tile) =>
                neighbor.landscape?.type === LandscapeType.grass,
            )
          ) {
            return { ...tile, landscape: Landscape.sand() };
          } else {
            return tile;
          }
        }
        default: {
          return tile;
        }
      }
    });
  }

  static cleanupSingles(tiles: Tile[]) {
    return tiles.map((tile) => {
      const neighbors = GameMap.findNeighbors(tile, tiles);
      if (
        neighbors.every(
          (neighbor: Tile) => neighbor.landscape?.type === LandscapeType.water,
        )
      ) {
        return { ...tile, landscape: Landscape.water() };
      } else if (
        neighbors.every(
          (neighbor: Tile) => neighbor.landscape?.type === LandscapeType.grass,
        )
      ) {
        return { ...tile, landscape: Landscape.grass() };
      } else {
        return tile;
      }
    });
  }

  static cleanupSand(tiles: Tile[]) {
    return tiles.map((tile) => {
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
            return { ...tile, landscape: Landscape.grass() };
          }
        }
        default: {
          return tile;
        }
      }
    });
  }

  static placeTrees(tiles: Tile[]) {
    return tiles.map((tile) => {
      if (tile.landscape?.type === LandscapeType.grass) {
        return weightedRandom(
          [
            { ...tile, landscape: Landscape.tree() },
            { ...tile, landscape: Landscape.grass() },
          ],
          [0.7, 0.3],
        );
      } else {
        return tile;
      }
    });
  }

  static placeMountains(tiles: Tile[]) {
    return tiles.map((tile) => {
      if (tile.landscape?.type === LandscapeType.grass) {
        return weightedRandom(
          [
            { ...tile, landscape: Landscape.mountain() },
            { ...tile, landscape: Landscape.grass() },
          ],
          [0.2, 0.8],
        );
      } else {
        return tile;
      }
    });
  }
}
