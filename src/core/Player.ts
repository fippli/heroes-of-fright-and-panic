import playerSrc from "../assets/player.png";
import type { ResourceMap } from "./Building";
import { Hexagon } from "./Hexagon";
import { Landscape, LandscapeType } from "./Landscape";
import { Tile } from "./Tile";
import { TileImage } from "./TileImage";

const playerImage = new TileImage(playerSrc, Hexagon.height, Hexagon.height);

export class Player {
  row: number;
  col: number;
  inventory: string[] = ["axe"];
  resources: ResourceMap = {
    wood: 0,
    stone: 0,
    gold: 0,
    food: 0,
  };

  constructor({ row, col }: { row: number; col: number }) {
    this.row = row;
    this.col = col;
  }

  render(ctx: CanvasRenderingContext2D) {
    ctx.save();
    const x = Hexagon.x(this.row, this.col);
    const y = Hexagon.y(this.row);
    playerImage.render(ctx, x, y);

    ctx.restore();
  }

  move(
    direction:
      | "east"
      | "west"
      | "north-east"
      | "north-west"
      | "south-east"
      | "south-west",
  ) {
    switch (direction) {
      case "east": {
        this.col = this.col + 1;
        return this;
      }
      case "west": {
        this.col = this.col - 1;
        return this;
      }
      case "north-east": {
        this.row = this.row - 1;
        return this;
      }
      case "north-west": {
        this.row = this.row - 1;
        this.col = this.col - 1;
        return this;
      }
      case "south-east": {
        this.row = this.row + 1;
        this.col = this.col + 1;
        return this;
      }
      case "south-west": {
        this.row = this.row + 1;
        this.col = this.col - 1;
        return this;
      }
      default: {
        throw new Error(`Invalid direction: ${direction}`);
      }
    }
  }

  place(tile: Tile) {
    if (tile.landscape?.type === LandscapeType.mountain) {
      return;
    }

    if (tile.landscape?.type === LandscapeType.water) {
      if (this.inventory.includes("boat")) {
        this.row = tile.row;
        this.col = tile.col;
        return;
      } else {
        return;
      }
    }

    if (tile.landscape?.type === LandscapeType.tree) {
      if (this.inventory.includes("axe")) {
        tile.landscape = Landscape.grass();
        this.wood = this.wood + 1;
        // this.row = tile.row;
        // this.col = tile.col;
        return;
      } else {
        return;
      }
    }
    // const walkableTiles = [TileType.GRASS, TileType.SAND];

    // return new Player({ ...this, row: tile.row, col: tile.col });
    if (
      [LandscapeType.grass, LandscapeType.sand].includes(tile.landscape?.type)
    ) {
      this.row = tile.row;
      this.col = tile.col;
    }
  }

  interact(tile: Tile) {}

  canAfford(cost: ResourceMap = {}) {
    return Object.keys(cost).every(
      (key) =>
        this.resources[key as keyof ResourceMap] >=
        cost[key as keyof ResourceMap],
    );
  }

  pay(cost: ResourceMap = {}) {
    Object.keys(cost).forEach((key) => {
      this.resources[key as keyof ResourceMap] =
        this.resources[key as keyof ResourceMap] -
        cost[key as keyof ResourceMap];
    });
  }
}
