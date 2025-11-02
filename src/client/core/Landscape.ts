import { Hexagon } from "./Hexagon";

import { weightedRandom } from "../utils/weightedRandom";
import { ResourceMap } from "./ResourceMap";
import type { Tile, TilePosition } from "./Tile";
import { ImageAssets } from "../images";

export enum LandscapeType {
  grass = "grass",
  tree = "tree",
  sand = "sand",
  water = "water",
  unexplored = "unexplored",
  mountain = "mountain",
}

export class Landscape {
  type: LandscapeType;
  readonly lootDrop?: ResourceMap = undefined;

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

  render(ctx: CanvasRenderingContext2D, tilePosition: TilePosition) {
    ctx.save();
    const x = Hexagon.x(tilePosition.row, tilePosition.column);
    const y = Hexagon.y(tilePosition.row);
    const centerX = x - Hexagon.width / 2;
    const centerY = y - Hexagon.height / 2;
    ctx.translate(centerX, centerY);

    if (this.type === LandscapeType.tree) {
      ImageAssets.landscapeImage(LandscapeType.grass).render(ctx, 0, 0);
      ImageAssets.landscapeImage(LandscapeType.tree).render(ctx, 0, 0);
    } else if (this.type === LandscapeType.mountain) {
      ImageAssets.landscapeImage(LandscapeType.grass).render(ctx, 0, 0);
      ImageAssets.landscapeImage(LandscapeType.mountain).render(ctx, 0, 0);
    } else {
      ImageAssets.landscapeImage(this.type).render(ctx, 0, 0);
    }
    ctx.resetTransform();
    ctx.restore();
  }

  static unexplored(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();
    const centerX = x - Hexagon.width / 2;
    const centerY = y - Hexagon.height / 2;
    ctx.translate(centerX, centerY);
    ImageAssets.landscapeImage(LandscapeType.unexplored).render(ctx, 0, 0);
    ctx.resetTransform();
    ctx.restore();
  }

  static grass() {
    return new Landscape({
      type: LandscapeType.grass,
    });
  }

  static water() {
    return new Landscape({
      type: LandscapeType.water,
    });
  }

  static sand() {
    return new Landscape({
      type: LandscapeType.sand,
    });
  }

  static mountain() {
    return new Landscape({
      type: LandscapeType.mountain,
      lootDrop: new ResourceMap({ stone: 1 }),
    });
  }

  static tree() {
    return new Landscape({
      type: LandscapeType.tree,
      lootDrop: new ResourceMap({ wood: 1 }),
    });
  }

  transform(): Landscape {
    if (this.type === LandscapeType.tree) {
      return Landscape.grass();
    }
    if (this.type === LandscapeType.mountain) {
      return Landscape.grass();
    }
    return this;
  }

  loot(): { lootDrop: ResourceMap; nextLandscape: Landscape } {
    const lootDrop = this.lootDrop ?? new ResourceMap({});

    const nextLandscape = this.transform();

    return { lootDrop, nextLandscape };
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
    return tiles.map((tile) => {
      const neighbors = tile.getNeighbors(tiles);
      switch (tile.landscape?.type) {
        case LandscapeType.water: {
          if (
            neighbors.some(
              (neighbor) => neighbor.landscape?.type === LandscapeType.grass,
            )
          ) {
            return tile.giveLandscape(Landscape.sand());
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
      const neighbors = tile.getNeighbors(tiles);
      if (
        neighbors.every(
          (neighbor) => neighbor.landscape?.type === LandscapeType.water,
        )
      ) {
        return tile.giveLandscape(Landscape.water());
      } else if (
        neighbors.every(
          (neighbor) => neighbor.landscape?.type === LandscapeType.grass,
        )
      ) {
        return tile.giveLandscape(Landscape.grass());
      } else {
        return tile;
      }
    });
  }

  static cleanupSand(tiles: Tile[]) {
    return tiles.map((tile) => {
      const neighbors = tile.getNeighbors(tiles);
      switch (tile.landscape?.type) {
        case LandscapeType.sand: {
          if (
            neighbors.some(
              (neighbor) => neighbor.landscape?.type === LandscapeType.water,
            )
          ) {
            return tile;
          } else {
            return tile.giveLandscape(Landscape.grass());
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
            tile.giveLandscape(Landscape.tree()),
            tile.giveLandscape(Landscape.grass()),
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
            tile.giveLandscape(Landscape.mountain()),
            tile.giveLandscape(Landscape.grass()),
          ],
          [0.2, 0.8],
        );
      } else {
        return tile;
      }
    });
  }
}
