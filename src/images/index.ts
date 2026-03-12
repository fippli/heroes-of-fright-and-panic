import { BuildingType } from "../core/Building";
import { GameImage } from "../core/GameImage";
import { Hexagon } from "../core/Hexagon";
import { LandscapeType } from "../core/Landscape";
import { PieceType } from "../core/Piece";
import type { Player } from "../core/Player";
import type { ThemeImageAssets } from "./theme-image-assets";

//
// Pieces
//

const peasantImage = new GameImage({
  src: "/img/peasant.png",
  width: Hexagon.width,
  height: Hexagon.height,
});

const skeletonImage = new GameImage({
  src: "/img/skeleton.png",
  width: Hexagon.width,
  height: Hexagon.height,
});

const knightImage = new GameImage({
  src: "/img/knight.png",
  width: Hexagon.width,
  height: Hexagon.height,
});

const soldierImage = new GameImage({
  src: "/img/soldier.svg",
  width: Hexagon.width,
  height: Hexagon.height,
});

const archerImage = new GameImage({
  src: "/img/archer.png",
  width: Hexagon.width,
  height: Hexagon.height,
});

//
// Buildings
//

const boatPieceImage = new GameImage({
  src: "/img/boat-piece.png",
  width: Hexagon.width,
  height: Hexagon.height,
});

const houseImage = new GameImage({
  src: "/img/house.png",
  width: Hexagon.width,
  height: Hexagon.height,
});
const castleImage = new GameImage({
  src: "/img/castle.png",
  width: Hexagon.width,
  height: Hexagon.height,
});

const towerImage = new GameImage({
  src: "/img/tower.png",
  width: Hexagon.width,
  height: Hexagon.height,
});

const boatImage = new GameImage({
  src: "/img/boat.png",
  width: Hexagon.width,
  height: Hexagon.height,
});

const farmImage = new GameImage({
  src: "/img/farm.png",
  width: Hexagon.width,
  height: Hexagon.height,
});

//
// Landscape
//

const unexploredImage = new GameImage({
  src: "/img/unexplored2.png",
  width: Hexagon.width,
  height: Hexagon.height,
});
const grassImage = new GameImage({
  src: "/img/grass.svg",
  width: Hexagon.width,
  height: Hexagon.height,
});
const treeImage = new GameImage({
  src: "/img/forest.svg",
  width: Hexagon.width,
  height: Hexagon.height,
});

const sandImage = new GameImage({
  src: "/img/sand.svg",
  width: Hexagon.width,
  height: Hexagon.height,
});
const waterImage = new GameImage({
  src: "/img/water.svg",
  width: Hexagon.width,
  height: Hexagon.height,
});

const mountainImage = new GameImage({
  src: "/img/rock.png",
  width: Hexagon.width,
  height: Hexagon.height,
});

const staticPieceImage = (player: Player, type: PieceType): GameImage => {
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
};

const staticBuildingImage = (type: BuildingType): GameImage => {
  switch (type) {
    case BuildingType.house: {
      return houseImage;
    }
    case BuildingType.castle: {
      return castleImage;
    }
    case BuildingType.tower: {
      return towerImage;
    }
    case BuildingType.boat: {
      return boatImage;
    }
    case BuildingType.farm: {
      return farmImage;
    }
    default: {
      throw new Error(`Invalid building type: ${type}`);
    }
  }
};

const staticLandscapeImage = (type: LandscapeType): GameImage => {
  switch (type) {
    case LandscapeType.unexplored: {
      return unexploredImage;
    }
    case LandscapeType.grass: {
      return grassImage;
    }
    case LandscapeType.tree: {
      return treeImage;
    }
    case LandscapeType.sand: {
      return sandImage;
    }
    case LandscapeType.water: {
      return waterImage;
    }
    case LandscapeType.mountain: {
      return mountainImage;
    }
    default: {
      throw new Error(`Invalid landscape type: ${type}`);
    }
  }
};

export class ImageAssets {
  readonly theme: ThemeImageAssets | undefined;

  constructor(theme?: ThemeImageAssets) {
    this.theme = theme;
  }

  pieceImage(player: Player, type: PieceType): GameImage {
    const themeImage = this.theme?.pieceImage(player, type);
    if (themeImage !== undefined) return themeImage;
    return staticPieceImage(player, type);
  }

  buildingImage(type: BuildingType): GameImage {
    const themeImage = this.theme?.buildingImage(type);
    if (themeImage !== undefined) return themeImage;
    return staticBuildingImage(type);
  }

  landscapeImage(type: LandscapeType): GameImage {
    const themeImage = this.theme?.landscapeImage(type);
    if (themeImage !== undefined) return themeImage;
    return staticLandscapeImage(type);
  }
}

export const defaultImageAssets = new ImageAssets();
