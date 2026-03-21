import { PieceKind } from "@shared/piece";
import type { ImageAssets } from "../images";
import { Hexagon } from "./Hexagon";
import { LandscapeType } from "./Landscape";
import type { Player } from "@shared/player";
import { ResourceMap } from "@shared/player/resource-map";
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

  constructor({
    kind,
    viewRange,
    attackRange,
    owner,
    walkableLandscape,
  }: {
    kind: PieceKind;
    viewRange?: number;
    attackRange?: number;
    owner: Player;
    walkableLandscape?: LandscapeType[];
  }) {
    this.kind = kind;
    this.viewRange = viewRange ?? 1;
    this.attackRange = attackRange ?? 1;
    this.owner = owner;
    this.walkableLandscape = walkableLandscape ?? [];
  }

  render(
    ctx: CanvasRenderingContext2D,
    position: TilePosition,
    imageAssets: ImageAssets,
  ): void {
    ctx.save();
    const x = Hexagon.x(position.row, position.column) - Hexagon.width / 2;
    const y = Hexagon.y(position.row) - Hexagon.height / 2;
    imageAssets.pieceImage(this.owner, this.kind).render(ctx, x, y);
    ctx.restore();
  }

  isOwnedBy(player: Player): boolean {
    return this.owner?.type === player?.type;
  }
}
