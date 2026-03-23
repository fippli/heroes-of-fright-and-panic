import { LandscapeType } from "@shared/map/landscape";
import type { ImageAssets } from "../images";
import { Hexagon } from "./Hexagon";
import { createResourceMap, type ResourceMap } from "@shared/player/resource-map";
import type { TilePosition } from "./Tile";

export { LandscapeType };

/**
 * Landscape - Client-side landscape/terrain representation
 * Landscape generation is handled on the server, this is just for rendering
 */
export class Landscape {
  readonly type: LandscapeType;
  readonly lootDrop?: ResourceMap = undefined;

  constructor({
    type,
    lootDrop,
  }: {
    type: LandscapeType;
    lootDrop?: ResourceMap;
  }) {
    this.type = type;
    this.lootDrop = lootDrop ? createResourceMap(lootDrop) : undefined;
  }

  render(
    ctx: CanvasRenderingContext2D,
    tilePosition: TilePosition,
    imageAssets: ImageAssets,
  ): void {
    ctx.save();
    const x = Hexagon.x(tilePosition.row, tilePosition.column);
    const y = Hexagon.y(tilePosition.row);
    const centerX = x - Hexagon.width / 2;
    const centerY = y - Hexagon.height / 2;
    ctx.translate(centerX, centerY);

    if (this.type === LandscapeType.tree) {
      imageAssets.landscapeImage(LandscapeType.grass).render(ctx, 0, 0);
      imageAssets.landscapeImage(LandscapeType.tree).render(ctx, 0, 0);
    } else if (this.type === LandscapeType.mountain) {
      imageAssets.landscapeImage(LandscapeType.grass).render(ctx, 0, 0);
      imageAssets.landscapeImage(LandscapeType.mountain).render(ctx, 0, 0);
    } else {
      imageAssets.landscapeImage(this.type).render(ctx, 0, 0);
    }
    ctx.resetTransform();
    ctx.restore();
  }

  static unexplored(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    imageAssets: ImageAssets,
  ): void {
    ctx.save();
    const centerX = x - Hexagon.width / 2;
    const centerY = y - Hexagon.height / 2;
    ctx.translate(centerX, centerY);
    imageAssets.landscapeImage(LandscapeType.unexplored).render(ctx, 0, 0);
    ctx.resetTransform();
    ctx.restore();
  }
}
