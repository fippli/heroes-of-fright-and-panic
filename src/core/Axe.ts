import axeSrc from "../assets/axe.png";
import { Hexagon } from "./Hexagon";
import { TileImage } from "./TileImage";

const axeImage = new TileImage(axeSrc, Hexagon.width, Hexagon.height);

export class Axe {
  static render(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();
    axeImage.render(ctx, x, y);
    ctx.restore();
  }
}
