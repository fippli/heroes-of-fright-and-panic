import archerSrc from "../assets/archer.png";
import boatPieceSrc from "../assets/boat-piece.png";
import knightSrc from "../assets/knight.png";
import peasantSrc from "../assets/peasant.png";
import skeletonSrc from "../assets/skeleton.png";
import soldierSrc from "../assets/soldier.png";

import { GameImage } from "../core/GameImage";
import { Hexagon } from "../core/Hexagon";
import { PieceType } from "../core/Piece";
import type { Player } from "../core/Player";

const peasantImage = new GameImage({
  src: peasantSrc,
  width: Hexagon.width,
  height: Hexagon.height,
});

const skeletonImage = new GameImage({
  src: skeletonSrc,
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

export class ImageAssets {
  static pieceImage(player: Player, type: PieceType) {
    switch (type) {
      case PieceType.peasant: {
        return player.type === "day" ? peasantImage : skeletonImage;
      }
      case PieceType.knight: {
        return player.type === "day" ? knightImage : skeletonImage;
      }
      case PieceType.soldier: {
        return player.type === "day" ? soldierImage : skeletonImage;
      }
      case PieceType.archer: {
        return player.type === "day" ? archerImage : skeletonImage;
      }
      case PieceType.boat: {
        return boatPieceImage;
      }
      default: {
        throw new Error(`Invalid piece type: ${type}`);
      }
    }
  }
}
