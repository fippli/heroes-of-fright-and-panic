import { PieceKind } from "@shared/piece";
import type { ImageAssets } from "../images";
import { Hexagon } from "./Hexagon";
import { LandscapeType } from "./Landscape";
import type { Player } from "@shared/player";
import type { ResourceMap } from "@shared/player/resource-map";
import type { TilePosition } from "./Tile";

export { PieceKind };

/**
 * Piece - Client-side piece/unit representation
 * Piece logic is handled on the server, this is just for rendering
 */
export class Piece {
  readonly owner: Player;
  readonly kind: PieceKind;
  readonly viewRange: number = 1;
  readonly attackRange: number = 1;
  readonly walkableLandscape: LandscapeType[];
  // Item keys (sword, shield, bow) and steed key (horse, boat) for overlays
  readonly equipment: readonly string[];
  readonly steed: string | null;

  constructor({
    kind,
    viewRange,
    attackRange,
    owner,
    walkableLandscape,
    equipment,
    steed,
  }: {
    kind: PieceKind;
    viewRange?: number;
    attackRange?: number;
    owner: Player;
    walkableLandscape?: LandscapeType[];
    equipment?: readonly string[];
    steed?: string | null;
  }) {
    this.kind = kind;
    this.viewRange = viewRange ?? 1;
    this.attackRange = attackRange ?? 1;
    this.owner = owner;
    this.walkableLandscape = walkableLandscape ?? [];
    this.equipment = equipment ?? [];
    this.steed = steed ?? null;
  }

  render(
    ctx: CanvasRenderingContext2D,
    position: TilePosition,
    imageAssets: ImageAssets,
  ): void {
    ctx.save();
    const x = Hexagon.x(position.row, position.column);
    const y = Hexagon.y(position.row);
    // Steed underneath at full size, then the piece, then equipment as
    // half-size badges in the hex corners so the figure stays readable.
    if (this.steed !== null) {
      imageAssets.itemImage(this.steed)?.renderCentered(ctx, x, y);
    }
    imageAssets.pieceImage(this.owner, this.kind).renderCentered(ctx, x, y);
    const badge = Hexagon.height / 4;
    const corner: Record<string, readonly [number, number]> = {
      sword: [badge, badge],
      shield: [-badge, badge],
      bow: [badge, -badge],
    };
    this.equipment.forEach((item) => {
      const [dx, dy] = corner[item] ?? [badge, badge];
      imageAssets.itemImage(item)?.renderScaled(ctx, x + dx, y + dy, 0.5);
    });
    ctx.restore();
  }

  isOwnedBy(player: Player): boolean {
    return this.owner?.type === player?.type;
  }
}
