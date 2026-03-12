import { PieceType } from "@shared/piece";
import type { ImageAssets } from "../images";
import { Hexagon } from "./Hexagon";
import { LandscapeType } from "./Landscape";
import type { Player } from "./Player";
import { ResourceMap } from "./ResourceMap";
import type { TilePosition } from "./Tile";

export { PieceType };

/**
 * Piece - Client-side piece/unit representation
 * Piece logic is handled on the server, this is just for rendering
 */
export class Piece {
  readonly owner: Player;
  readonly type: PieceType;
  readonly boat: boolean = false;
  readonly viewRange: number = 1;
  readonly attackRange: number = 1;
  readonly upgradeCost: ResourceMap;
  readonly walkableLandscape: LandscapeType[];
  readonly lootableLandscape: LandscapeType[];

  constructor({
    type,
    viewRange,
    attackRange,
    owner,
    upgradeCost,
    walkableLandscape,
    lootableLandscape,
  }: {
    type: PieceType;
    viewRange?: number;
    attackRange?: number;
    owner: Player;
    upgradeCost?: ResourceMap;
    walkableLandscape?: LandscapeType[];
    lootableLandscape?: LandscapeType[];
  }) {
    this.type = type;
    this.viewRange = viewRange ?? 1;
    this.attackRange = attackRange ?? 1;
    this.owner = owner;
    this.upgradeCost = upgradeCost ?? new ResourceMap({});
    this.walkableLandscape = walkableLandscape ?? [];
    this.lootableLandscape = lootableLandscape ?? [];
  }

  render(
    ctx: CanvasRenderingContext2D,
    position: TilePosition,
    imageAssets: ImageAssets,
  ): void {
    ctx.save();
    const x = Hexagon.x(position.row, position.column) - Hexagon.width / 2;
    const y = Hexagon.y(position.row) - Hexagon.height / 2;
    imageAssets.pieceImage(this.owner, this.type).render(ctx, x, y);
    ctx.restore();
  }

  isOwnedBy(player: Player): boolean {
    return this.owner?.type === player?.type;
  }
}
