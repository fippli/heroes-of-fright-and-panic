import { ImageAssets } from "../images";
import { Hexagon } from "./Hexagon";
import { LandscapeType } from "./Landscape";
import type { Player } from "./Player";
import { ResourceMap } from "./ResourceMap";
import type { TilePosition } from "./Tile";

export enum PieceType {
  peasant = "peasant",
  knight = "knight",
  soldier = "soldier",
  archer = "archer",
  boat = "boat",
}

/**
 * Piece - Client-side piece/unit representation
 * Piece logic is handled on the server, this is just for rendering
 */
export class Piece {
  owner: Player;
  type: PieceType;
  boat: boolean = false;
  viewRange: number = 1;
  upgradeCost: ResourceMap;
  readonly walkableLandscape: LandscapeType[];
  readonly lootableLandscape: LandscapeType[];

  constructor({
    type,
    viewRange,
    owner,
    upgradeCost,
    walkableLandscape,
    lootableLandscape,
  }: {
    type: PieceType;
    viewRange?: number;
    owner: Player;
    upgradeCost?: ResourceMap;
    walkableLandscape?: LandscapeType[];
    lootableLandscape?: LandscapeType[];
  }) {
    this.type = type;
    this.viewRange = viewRange ?? 1;
    this.owner = owner;
    this.upgradeCost = upgradeCost ?? new ResourceMap({});
    this.walkableLandscape = walkableLandscape ?? [];
    this.lootableLandscape = lootableLandscape ?? [];
  }

  render(ctx: CanvasRenderingContext2D, position: TilePosition): void {
    ctx.save();
    const x = Hexagon.x(position.row, position.column) - Hexagon.width / 2;
    const y = Hexagon.y(position.row) - Hexagon.height / 2;
    ImageAssets.pieceImage(this.owner, this.type).render(ctx, x, y);
    ctx.restore();
  }

  isOwnedBy(player: Player): boolean {
    return this.owner?.type === player?.type;
  }
}
