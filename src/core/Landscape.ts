import { GameImage } from "./GameImage";
import { Hexagon } from "./Hexagon";

import grassSrc from "../assets/grass.png";
import mountainSrc from "../assets/rock.png";
import sandSrc from "../assets/sand.png";
import treeSrc from "../assets/tree.png";
import unesploredSrc from "../assets/unexplored2.png";
import vegetationSrc from "../assets/vegetation.png";
import waterSrc from "../assets/water.png";
import woodSrc from "../assets/wood.png";
import { weightedRandom } from "../utils/weightedRandom";
import type { Tile } from "./Tile";

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
const vegetationImage = new GameImage({
  src: vegetationSrc,
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
const woodImage = new GameImage({
  src: woodSrc,
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
  vegetation = "vegetation",
  sand = "sand",
  water = "water",
  unexplored = "unexplored",
  mountain = "mountain",
}

export class Landscape {
  readonly type;

  constructor({ type }: { type: LandscapeType }) {
    this.type = type;
  }

  render(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();
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
      case LandscapeType.vegetation: {
        return vegetationImage;
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
    });
  }

  static tree() {
    return new Landscape({
      type: LandscapeType.tree,
    });
  }

  static generate(neighbors: Tile[]): Landscape {
    if (neighbors.length === 0) {
      return Landscape.grass();
    }

    const exploredNeighbors = neighbors.filter((neighbor) => neighbor.explored);

    const isGrass = (neighbor: Tile) =>
      neighbor.landscape?.type === LandscapeType.grass;
    const hasGrass = exploredNeighbors.some(isGrass);

    const isSand = (neighbor: Tile) =>
      neighbor.landscape?.type === LandscapeType.sand;
    const hasSand = exploredNeighbors.some(isSand);

    const isWater = (neighbor: Tile) =>
      neighbor.landscape?.type === LandscapeType.water;
    const hasWater = exploredNeighbors.some(isWater);

    const isMountain = (neighbor: Tile) =>
      neighbor.landscape?.type === LandscapeType.mountain;
    const hasMountain = exploredNeighbors.some(isMountain);

    const isTree = (neighbor: Tile) =>
      neighbor.landscape?.type === LandscapeType.tree;
    const hasTree = exploredNeighbors.some(isTree);

    if ((hasWater && hasGrass) || (hasWater && hasTree)) {
      return Landscape.sand();
    }

    if (hasSand && hasWater) {
      // only generate water or sand
      return weightedRandom([Landscape.water(), Landscape.sand()], [0.5, 0.5]);
    }

    if (hasSand && hasGrass) {
      return weightedRandom([Landscape.sand(), Landscape.grass()], [0.5, 0.5]);
    }

    if (hasSand && hasTree) {
      return weightedRandom([Landscape.sand(), Landscape.tree()], [0.5, 0.5]);
    }

    if (hasSand && hasMountain) {
      return weightedRandom(
        [Landscape.sand(), Landscape.mountain()],
        [0.5, 0.5],
      );
    }

    if (hasMountain && hasGrass) {
      return weightedRandom(
        [Landscape.mountain(), Landscape.grass()],
        [0.5, 0.5],
      );
    }

    if (hasTree && hasGrass) {
      return weightedRandom(
        [Landscape.tree(), Landscape.grass(), Landscape.sand()],
        [0.9, 0.08, 0.02],
      );
    }

    if (hasTree && hasMountain) {
      return weightedRandom(
        [Landscape.tree(), Landscape.mountain()],
        [0.9, 0.1],
      );
    }

    if (exploredNeighbors.every(isSand)) {
      return weightedRandom(
        [Landscape.water(), Landscape.grass()],
        [0.99, 0.01],
      );
    }

    if (exploredNeighbors.every(isGrass)) {
      return weightedRandom(
        [
          Landscape.tree(),
          Landscape.grass(),
          Landscape.sand(),
          Landscape.mountain(),
        ],
        [0.8, 0.05, 0.01, 0.05],
      );
    }

    if (exploredNeighbors.every(isWater)) {
      return weightedRandom(
        [Landscape.water(), Landscape.sand()],
        [0.85, 0.15],
      );
    }

    if (exploredNeighbors.every(isMountain)) {
      return weightedRandom(
        [Landscape.mountain(), Landscape.grass()],
        [0.5, 0.5],
      );
    }

    if (exploredNeighbors.every(isTree)) {
      return weightedRandom(
        [Landscape.tree(), Landscape.mountain()],
        [0.5, 0.5],
      );
    }

    console.log({ exploredNeighbors });

    throw new Error("No landscape option");
  }
}
