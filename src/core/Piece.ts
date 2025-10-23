import type { TilePosition } from "./Tile";

import archerSrc from "../assets/archer.png";
import boatPieceSrc from "../assets/boat-piece.png";
import knightSrc from "../assets/knight.png";
import peasantSrc from "../assets/peasant.png";
import soldierSrc from "../assets/soldier.png";

import { GameImage } from "./GameImage";
import { Hexagon } from "./Hexagon";

const peasantImage = new GameImage({
  src: peasantSrc,
  width: Hexagon.width,
  height: Hexagon.height,
});

const knightImage = new GameImage({
  src: knightSrc,
  width: Hexagon.width,
  height: Hexagon.height,
});

const soldierImage = new GameImage({
  src: soldierSrc,
  width: Hexagon.width,
  height: Hexagon.height,
});

const archerImage = new GameImage({
  src: archerSrc,
  width: Hexagon.width,
  height: Hexagon.height,
});

const boatPieceImage = new GameImage({
  src: boatPieceSrc,
  width: Hexagon.width,
  height: Hexagon.height,
});

export enum PieceType {
  peasant = "peasant",
  knight = "knight",
  soldier = "soldier",
  archer = "archer",
}

export class Piece {
  type: PieceType;
  boat: boolean = false;
  viewRange: number = 1;

  constructor({ type, viewRange }: { type: PieceType; viewRange?: number }) {
    this.type = type;
    this.viewRange = viewRange ?? 1;
  }

  render(ctx: CanvasRenderingContext2D, position: TilePosition) {
    ctx.save();
    const x = Hexagon.x(position.row, position.col) - Hexagon.width / 2;
    const y = Hexagon.y(position.row) - Hexagon.height / 2;
    this.image().render(ctx, x, y);
    ctx.restore();
  }

  image() {
    if (this.boat) {
      return boatPieceImage;
    }

    switch (this.type) {
      case PieceType.peasant: {
        return peasantImage;
      }
      case PieceType.knight: {
        return knightImage;
      }
      case PieceType.soldier: {
        return soldierImage;
      }
      case PieceType.archer: {
        return archerImage;
      }
      default: {
        throw new Error(`Invalid piece type: ${this.type}`);
      }
    }
  }

  static peasant() {
    return new Piece({ type: PieceType.peasant, viewRange: 1 });
  }

  static knight() {
    return new Piece({ type: PieceType.knight });
  }

  static soldier() {
    return new Piece({ type: PieceType.soldier });
  }

  static archer() {
    return new Piece({ type: PieceType.archer, viewRange: 3 });
  }

  upgrade(): Piece {
    if (this.type === PieceType.peasant) {
      return Piece.soldier();
    }
    if (this.type === PieceType.soldier) {
      return Piece.knight();
    }

    return this;
  }

  // explore(tiles: Tile[]) {
  //   const tile = tiles.filter((tile) =>
  //     tile.isNeighborTo({ row: this.row, col: this.col }),
  //   );
  //   if (tile) {
  //     tile.explore(tiles);
  //   }
  // }

  // isAt(tilePosition: TilePosition) {
  //   return this.row === tilePosition.row && this.col === tilePosition.col;
  // }

  // place(tile: Tile, player: Player, buildings: Building[]) {
  //   if (tile.landscape?.type === LandscapeType.mountain) {
  //     return;
  //   }

  //   if (tile.hasAny(buildings)) {
  //     return;
  //   }

  //   const hasBoat =
  //     buildings
  //       .filter((b) => tile.has(b))
  //       .some((b) => b.type === BuildingType.boat) || this.boat;

  //   if (tile.landscape?.type === LandscapeType.water) {
  //     if (hasBoat) {
  //       this.row = tile.row;
  //       this.col = tile.col;
  //       this.boat = true;
  //       const buildingIndex = buildings.findIndex((b) => tile.has(b));
  //       buildings.splice(buildingIndex, 1);

  //       return;
  //     } else {
  //       return;
  //     }
  //   }

  //   if (
  //     buildings.some(
  //       (building: Building) => tile.has(building) && !building.walkable,
  //     )
  //   ) {
  //     return;
  //   }

  //   if (tile.landscape?.type === LandscapeType.tree) {
  //     if (player.inventory.includes("axe")) {
  //       tile.landscape = Landscape.grass();
  //       player.wood = player.wood + 1;
  //       // this.row = tile.row;
  //       // this.col = tile.col;
  //       return;
  //     } else {
  //       return;
  //     }
  //   }
  //   // const walkableTiles = [TileType.GRASS, TileType.SAND];

  //   // return new Player({ ...this, row: tile.row, col: tile.col });
  //   if (
  //     [LandscapeType.grass, LandscapeType.sand].includes(tile.landscape?.type)
  //   ) {
  //     this.row = tile.row;
  //     this.col = tile.col;
  //   }
  // }
}
