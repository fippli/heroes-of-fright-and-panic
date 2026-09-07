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

  /**
   * Stone rampart from the tile center out to each connected edge midpoint:
   * a drop shadow, dark base course, lighter walkway, mortar joints across
   * the run and pale merlons along the top — all drawn, no sprites.
   */
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
    const walkway = this.owner?.type === "night" ? "#847a99" : "#9a8f7a";
    const baseWidth = Hexagon.height / 3;
    const capWidth = Hexagon.height / 5;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const segments = (this.connections ?? []).map((direction) => edgeMid(direction));
    const strokeAll = (color: string, width: number, offsetY: number): void => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      segments.forEach((mid) => {
        ctx.beginPath();
        ctx.moveTo(x, y + offsetY);
        ctx.lineTo(mid.x, mid.y + offsetY);
        ctx.stroke();
      });
    };

    // Ground shadow, dark stone base, then the lighter walkway on top
    strokeAll("rgba(0, 0, 0, 0.3)", baseWidth, 2.5);
    strokeAll("#3f3a35", baseWidth, 0);
    strokeAll("#6a6156", baseWidth - 3, -1);
    strokeAll(walkway, capWidth, -1.5);

    // Mortar joints across each run, and merlons dotted along the top
    segments.forEach((mid) => {
      const dx = mid.x - x;
      const dy = mid.y - y;
      const length = Math.hypot(dx, dy) || 1;
      const stepCount = Math.max(2, Math.round(length / (Hexagon.height / 5)));
      for (let step = 1; step <= stepCount; step += 1) {
        const t = step / (stepCount + 0.5);
        const px = x + dx * t;
        const py = y + dy * t - 1;
        // Joint: a short dark tick across the walkway
        ctx.strokeStyle = "rgba(43, 38, 33, 0.55)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px - (dy / length) * (capWidth / 2), py - 0.5 + (dx / length) * (capWidth / 2));
        ctx.lineTo(px + (dy / length) * (capWidth / 2), py - 0.5 - (dx / length) * (capWidth / 2));
        ctx.stroke();
        // Merlon: a pale nub between joints
        if (step < stepCount) {
          const mt = (step + 0.5) / (stepCount + 0.5);
          ctx.fillStyle = "#c2b79e";
          ctx.fillRect(x + dx * mt - 1.5, y + dy * mt - capWidth / 2 - 2, 3, 3);
        }
      }
    });

    // A little bastion where the runs meet the tile center
    ctx.fillStyle = "#6a6156";
    ctx.beginPath();
    ctx.arc(x, y - 1, capWidth / 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = walkway;
    ctx.beginPath();
    ctx.arc(x, y - 1.5, capWidth / 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  isOwnedBy(player: Player): boolean {
    return this.owner?.type === player?.type;
  }
}
