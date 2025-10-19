import playerSrc from "../assets/player.png";
import { Hexagon } from "./Hexagon";
import { Landscape, LandscapeType } from "./Landscape";
import { Tile } from "./Tile";
import { TileImage } from "./TileImage";

const playerImage = new TileImage(playerSrc, Hexagon.height, Hexagon.height);

export class Player {
  row: number;
  col: number;
  inventory: string[] = ["axe"];
  wood: number = 0;
  stone: number = 0;
  gold: number = 0;
  currentFood: number = 0;
  maxFood: number = 0;
  currentHealth: number = 1;
  maxHealth: number = 1;

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

  canAfford(cost: { wood: number; stone: number; gold: number }) {
    return (
      this.wood >= cost.wood &&
      this.stone >= cost.stone &&
      this.gold >= cost.gold
    );
  }

  pay(cost: { wood: number; stone: number; gold: number }) {
    this.wood = this.wood - cost.wood;
    this.stone = this.stone - cost.stone;
    this.gold = this.gold - cost.gold;
  }
}
