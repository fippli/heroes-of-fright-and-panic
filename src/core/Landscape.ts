import { GameImage } from "./GameImage";
import { Hexagon } from "./Hexagon";

import grassSrc from "../assets/grass.png";
import mountainSrc from "../assets/rock.png";
import sandSrc from "../assets/sand.png";
import treeSrc from "../assets/tree.png";
import unesploredSrc from "../assets/unexplored2.png";

import waterSrc from "../assets/water.png";

import { weightedRandom } from "../utils/weightedRandom";
import { ResourceMap } from "./ResourceMap";
import type { Tile, TilePosition } from "./Tile";

const tileWidth = Hexagon.width;
const tileHeight = Hexagon.height;

const unexploredImage = new GameImage({
  src: unesploredSrc,
  width: tileWidth,
  height: tileHeight,
});
const grassImage = new GameImage({
  src: grassSrc,
  width: tileWidth,
  height: tileHeight,
});
const treeImage = new GameImage({
  src: treeSrc,
  width: tileWidth,
  height: tileHeight,
});

const sandImage = new GameImage({
  src: sandSrc,
  width: tileWidth,
  height: tileHeight,
});
const waterImage = new GameImage({
  src: waterSrc,
  width: tileWidth,
  height: tileHeight,
});

const mountainImage = new GameImage({
  src: mountainSrc,
  width: tileWidth,
  height: tileHeight,
});

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
  readonly walkable: boolean;
  readonly lootDrop?: ResourceMap = undefined;

  constructor({
    type,
    walkable,
    lootDrop,
  }: {
    type: LandscapeType;
    walkable: boolean;
    lootDrop?: ResourceMap;
  }) {
    this.type = type;
    this.walkable = walkable;
    this.lootDrop = lootDrop;
  }

  render(ctx: CanvasRenderingContext2D, tilePosition: TilePosition) {
    ctx.save();
    const x = Hexagon.x(tilePosition.row, tilePosition.col);
    const y = Hexagon.y(tilePosition.row);
    const centerX = x - Hexagon.width / 2;
    const centerY = y - Hexagon.height / 2;
    ctx.translate(centerX, centerY);

    if (this.type === LandscapeType.tree) {
      grassImage.render(ctx, 0, 0);
      treeImage.render(ctx, 0, 0);
    } else if (this.type === LandscapeType.mountain) {
      grassImage.render(ctx, 0, 0);
      mountainImage.render(ctx, 0, 0);
    } else {
      this.image().render(ctx, 0, 0);
    }
    ctx.resetTransform();
    ctx.restore();
  }

  image() {
    switch (this.type) {
      case LandscapeType.grass: {
        return grassImage;
      }
      case LandscapeType.tree: {
        return treeImage;
      }
      case LandscapeType.sand: {
        return sandImage;
      }
      case LandscapeType.water: {
        return waterImage;
      }
      case LandscapeType.mountain: {
        return mountainImage;
      }
      case LandscapeType.unexplored: {
        return unexploredImage;
      }
    }
  }

  static unexplored(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();
    const centerX = x - Hexagon.width / 2;
    const centerY = y - Hexagon.height / 2;
    ctx.translate(centerX, centerY);
    unexploredImage.render(ctx, 0, 0);
    ctx.resetTransform();
    ctx.restore();
  }

  static grass() {
    return new Landscape({
      type: LandscapeType.grass,
      walkable: true,
    });
  }

  static water() {
    return new Landscape({
      type: LandscapeType.water,
      walkable: false,
    });
  }

  static sand() {
    return new Landscape({
      type: LandscapeType.sand,
      walkable: true,
    });
  }

  static mountain() {
    return new Landscape({
      type: LandscapeType.mountain,
      walkable: false,
      lootDrop: new ResourceMap({ stone: 1 }),
    });
  }

  static tree() {
    return new Landscape({
      type: LandscapeType.tree,
      walkable: false,
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
