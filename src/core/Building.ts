import { BuildingType } from "@shared/building";
import type { ImageAssets } from "../images";
import { Hexagon } from "./Hexagon";
import type { Player } from "./Player";
import { ResourceMap } from "./ResourceMap";
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

  constructor({
    type,
    production,
    cost,
    walkable,
    viewRange,
    owner,
  }: {
    type: BuildingType;
    walkable?: boolean;
    production?: ResourceMap;
    cost?: ResourceMap;
    viewRange?: number;
    owner: Player;
  }) {
    this.walkable = walkable ?? true;
    this.viewRange = viewRange ?? 1;
    this.type = type;
    this.cost = cost ?? new ResourceMap({});
    this.production = production ?? new ResourceMap({});
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

    ctx.clip(Hexagon.path(x, y));

    imageAssets.buildingImage(this.type).render(
      ctx,
      x - Hexagon.width / 2,
      y - Hexagon.height / 2,
    );

    ctx.restore();
  }

  isOwnedBy(player: Player): boolean {
    return this.owner?.type === player?.type;
  }
}
