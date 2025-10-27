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
    upgradeCost: ResourceMap;
    walkableLandscape: LandscapeType[];
    lootableLandscape?: LandscapeType[];
  }) {
    this.type = type;
    this.viewRange = viewRange ?? 1;
    this.owner = owner;
    this.upgradeCost = upgradeCost;
    this.walkableLandscape = walkableLandscape;
    this.lootableLandscape = lootableLandscape ?? [];
  }

  render(ctx: CanvasRenderingContext2D, position: TilePosition) {
    ctx.save();
    const x = Hexagon.x(position.row, position.col) - Hexagon.width / 2;
    const y = Hexagon.y(position.row) - Hexagon.height / 2;
    ImageAssets.pieceImage(this.owner, this.type).render(ctx, x, y);
    ctx.restore();
  }

  static peasant(owner: Player) {
    return new Piece({
      type: PieceType.peasant,
      viewRange: 1,
      owner,
      upgradeCost: new ResourceMap({ wood: 1 }),
      walkableLandscape: [LandscapeType.grass, LandscapeType.sand],
      lootableLandscape: [LandscapeType.tree, LandscapeType.mountain],
    });
  }

  static soldier(owner: Player) {
    return new Piece({
      type: PieceType.soldier,
      owner,
      viewRange: 1,
      upgradeCost: new ResourceMap({ wood: 0 }),
      walkableLandscape: [LandscapeType.grass, LandscapeType.sand],
    });
  }

  static knight(owner: Player) {
    return new Piece({
      type: PieceType.knight,
      owner,
      viewRange: 2,
      upgradeCost: new ResourceMap({ wood: 0 }),
      walkableLandscape: [LandscapeType.grass, LandscapeType.sand],
    });
  }

  static archer(owner: Player) {
    return new Piece({
      type: PieceType.archer,
      viewRange: 2,
      owner,
      upgradeCost: new ResourceMap({ wood: 3 }),
      walkableLandscape: [
        LandscapeType.grass,
        LandscapeType.tree,
        LandscapeType.sand,
      ],
    });
  }

  static costOfUpgrade(pieceType: PieceType): ResourceMap {
    switch (pieceType) {
      case PieceType.peasant: {
        return new ResourceMap({ wood: 1 });
      }
      case PieceType.soldier: {
        return new ResourceMap({ wood: 2 });
      }
      case PieceType.knight: {
        return new ResourceMap({ wood: 3 });
      }
      case PieceType.archer: {
        return new ResourceMap({ wood: 3 });
      }
      default: {
        return new ResourceMap({});
      }
    }
  }

  upgrade(): Piece {
    switch (this.type) {
      case PieceType.peasant: {
        if (!this.owner.canAfford(Piece.costOfUpgrade(PieceType.soldier))) {
          this.owner.pay(Piece.costOfUpgrade(PieceType.soldier));
          return Piece.soldier(this.owner);
        } else {
          return this;
        }
      }
      case PieceType.soldier: {
        if (!this.owner.canAfford(Piece.costOfUpgrade(PieceType.knight))) {
          this.owner.pay(Piece.costOfUpgrade(PieceType.knight));
          return Piece.knight(this.owner);
        } else {
          return this;
        }
      }
      default: {
        return this;
      }
    }
  }

  upgradeToArcher(): Piece {
    if (!this.owner.canAfford(Piece.costOfUpgrade(PieceType.archer))) {
      return this;
    }

    this.owner.pay(Piece.costOfUpgrade(PieceType.archer));
    return Piece.archer(this.owner);
  }

  isOwnedBy(player: Player) {
    return this.owner === player;
  }
}
