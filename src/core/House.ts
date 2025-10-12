import houseSrc from "../assets/house.png";
import { Hexagon } from "./Hexagon";
import { TileImage } from "./TileImage";
const houseImage = new TileImage(houseSrc, Hexagon.height, Hexagon.height);

export class House {
  readonly row: number;
  readonly col: number;

  constructor({ row, col }: { row: number; col: number }) {
    this.row = row;
    this.col = col;
  }

  render(ctx: CanvasRenderingContext2D) {
    ctx.save();
    houseImage.render(ctx, Hexagon.x(this.row, this.col), Hexagon.y(this.row));
    ctx.restore();
  }
}
