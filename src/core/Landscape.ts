import { LandscapeType } from "@shared/map/landscape";
import type { ImageAssets } from "../images";
import { Hexagon } from "./Hexagon";
import type { TilePosition } from "./Tile";

export { LandscapeType };

/**
 * Landscape - Client-side landscape/terrain representation
 * Landscape generation is handled on the server, this is just for rendering
 */
export class Landscape {
  readonly type: LandscapeType;

  constructor({
    type,
  }: {
    type: LandscapeType;
  }) {
    this.type = type;
  }

  render(
    ctx: CanvasRenderingContext2D,
    tilePosition: TilePosition,
    imageAssets: ImageAssets,
  ): void {
    ctx.save();
    const x = Hexagon.x(tilePosition.row, tilePosition.column);
    const y = Hexagon.y(tilePosition.row);

    if (this.type === LandscapeType.tree) {
      imageAssets.landscapeImage(LandscapeType.grass).renderCentered(ctx, x, y);
      imageAssets.landscapeImage(LandscapeType.tree).renderCentered(ctx, x, y);
    } else if (this.type === LandscapeType.mountain) {
      imageAssets.landscapeImage(LandscapeType.grass).renderCentered(ctx, x, y);
      imageAssets.landscapeImage(LandscapeType.mountain).renderCentered(ctx, x, y);
    } else {
      imageAssets.landscapeImage(this.type).renderCentered(ctx, x, y);
    }
    ctx.restore();
  }

  static unexplored(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    imageAssets: ImageAssets,
  ): void {
    ctx.save();
    imageAssets.landscapeImage(LandscapeType.unexplored).renderCentered(ctx, x, y);
    ctx.restore();
  }
}
