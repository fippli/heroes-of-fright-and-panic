import { BuildingType } from "@shared/building";
import type { ImageAssets } from "../images";
import { Hexagon } from "./Hexagon";
import type { Player } from "@shared/player";
import { createResourceMap, type ResourceMap } from "@shared/player/resource-map";
import type { TilePosition } from "./Tile";

export { BuildingType };

/**
 * Building - Client-side building representation
 * Building logic is handled on the server, this is just for rendering
 */
export class Building {
  readonly type: BuildingType;
  readonly cost: ResourceMap;
  readonly production: ResourceMap;
  readonly owner: Player;
  readonly populated: boolean = false;
  readonly walkable: boolean = false;
  readonly viewRange: number;
  readonly level: number;

  constructor({
    type,
    production,
    cost,
    walkable,
    viewRange,
    owner,
    level,
  }: {
    type: BuildingType;
    walkable?: boolean;
    production?: ResourceMap;
    cost?: ResourceMap;
    viewRange?: number;
    owner: Player;
    level?: number;
  }) {
    this.level = level ?? 1;
    this.walkable = walkable ?? true;
    this.viewRange = viewRange ?? 1;
    this.type = type;
    this.cost = cost ?? createResourceMap();
    this.production = production ?? createResourceMap();
    this.owner = owner;
  }

  render(
    ctx: CanvasRenderingContext2D,
    position: TilePosition,
    imageAssets: ImageAssets,
  ): void {
    ctx.save();

    const x = Hexagon.x(position.row, position.column);
    const y = Hexagon.y(position.row);

    ctx.clip(Hexagon.path(x, y, Hexagon.clipRadius));

    imageAssets.buildingImage(this.owner, this.type, this.level).renderCentered(ctx, x, y);

    // Upgraded houses wear their level as gold pips in the top-right corner
    if (this.level > 1) {
      const pip = Math.max(2, Math.round(Hexagon.height / 12));
      const gap = 1;
      const right = x + Hexagon.width / 2 - 2;
      const top = y - Hexagon.height / 2 + 2;
      for (let index = 0; index < this.level; index += 1) {
        ctx.fillStyle = "#ffd54f";
        ctx.fillRect(right - (index + 1) * pip - index * gap, top, pip, pip);
      }
    }

    ctx.restore();
  }

  isOwnedBy(player: Player): boolean {
    return this.owner?.type === player?.type;
  }
}
