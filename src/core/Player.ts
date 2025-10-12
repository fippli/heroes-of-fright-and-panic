import playerSrc from "../assets/player.png";
import { Hexagon } from "./Hexagon";
import { Tile } from "./Tile";
import { TileImage } from "./TileImage";

const playerImage = new TileImage(playerSrc, Hexagon.height, Hexagon.height);

export class Player {
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
  image: TileImage;

  constructor({ row, col }: { row: number; col: number }) {
    this.row = row;
    this.col = col;
    this.x = Hexagon.x(row, col);
    this.y = Hexagon.y(row);
  }

  render(ctx: CanvasRenderingContext2D) {
    ctx.save();
    playerImage.render(ctx, this.x, this.y);
    Hexagon.debug(ctx, this.x, this.y);
    ctx.restore();
  }

  move(
    direction:
      | "east"
      | "west"
      | "north-east"
      | "north-west"
      | "south-east"
      | "south-west"
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
    // const walkableTiles = [TileType.GRASS, TileType.SAND];

    return new Player({ ...this, row: tile.row, col: tile.col });
  }

  tile(tiles: Tile[]) {
    return tiles.find((tile: Tile) => {
      return tile.isThis(this);
    });
  }
}
