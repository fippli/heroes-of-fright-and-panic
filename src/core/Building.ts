import { BuildingType } from "@shared/building";
import { neighborAt } from "@shared/map/hex";
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
  readonly acted: boolean;
  /** Curtain-wall edges this wall joins toward; hand-placed walls have none */
  readonly connections: ReadonlyArray<number> | null;

  constructor({
    type,
    production,
    cost,
    walkable,
    viewRange,
    owner,
    level,
    acted,
    connections,
  }: {
    type: BuildingType;
    walkable?: boolean;
    production?: ResourceMap;
    cost?: ResourceMap;
    viewRange?: number;
    owner: Player;
    level?: number;
    acted?: boolean;
    connections?: ReadonlyArray<number> | null;
  }) {
    this.level = level ?? 1;
    this.acted = acted ?? false;
    this.connections = connections ?? null;
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

    // Curtain-wall segments draw as a continuous rampart between their
    // edges instead of the standalone wall sprite
    if (this.type === BuildingType.wall && this.connections !== null && this.connections.length > 0) {
      this.renderCurtainWall(ctx, position, x, y);
      ctx.restore();
      return;
    }

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

  /** Stone rampart from the tile center out to each connected edge midpoint */
  private renderCurtainWall(
    ctx: CanvasRenderingContext2D,
    position: TilePosition,
    x: number,
    y: number,
  ): void {
    const edgeMid = (direction: number): { x: number; y: number } => {
      const neighbor = neighborAt(position, direction);
      return {
        x: (x + Hexagon.x(neighbor.row, neighbor.column)) / 2,
        y: (y + Hexagon.y(neighbor.row)) / 2,
      };
    };

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    (this.connections ?? []).forEach((direction) => {
      const mid = edgeMid(direction);
      // Dark base course, lighter cap on top
      ctx.strokeStyle = "#4a4440";
      ctx.lineWidth = Hexagon.height / 3.2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(mid.x, mid.y);
      ctx.stroke();
      ctx.strokeStyle = this.owner?.type === "night" ? "#8d84a8" : "#a89c84";
      ctx.lineWidth = Hexagon.height / 6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(mid.x, mid.y);
      ctx.stroke();
    });
    ctx.restore();
  }

  isOwnedBy(player: Player): boolean {
    return this.owner?.type === player?.type;
  }
}
