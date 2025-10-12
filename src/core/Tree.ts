import treeSrc from "../assets/tree.png";
import { Hexagon } from "./Hexagon";
import { TileImage } from "./TileImage";

const treeImage = new TileImage(treeSrc, Hexagon.width, Hexagon.height);

export class Tree {
  static render(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();
    treeImage.render(ctx, x, y);
    ctx.restore();
  }
}
