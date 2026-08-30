import { BuildingType } from "../core/Building";
import { GameImage } from "../core/GameImage";
import { Hexagon } from "../core/Hexagon";
import { LandscapeType } from "../core/Landscape";
import { PieceKind } from "../core/Piece";
import type { Player } from "@shared/player";
import type { ThemeImageAssets } from "./theme-image-assets";

//
// Pieces
//

const peasantImage = new GameImage({
  src: "/img/peasant.png",
  width: Hexagon.height,
  height: Hexagon.height,
});

const skeletonImage = new GameImage({
  src: "/img/skeleton.png",
  width: Hexagon.height,
  height: Hexagon.height,
});

const kingImage = new GameImage({
  src: "/img/knight.png",
  width: Hexagon.height,
  height: Hexagon.height,
});

const priestImage = new GameImage({
  src: "/img/peasant.png",
  width: Hexagon.height,
  height: Hexagon.height,
});

const archAngelImage = new GameImage({
  src: "/img/knight.png",
  width: Hexagon.height,
  height: Hexagon.height,
});

//
// Buildings
//

const houseImage = new GameImage({
  src: "/img/house.png",
  width: Hexagon.height,
  height: Hexagon.height,
});
const castleImage = new GameImage({
  src: "/img/castle.png",
  width: Hexagon.height,
  height: Hexagon.height,
});

const towerImage = new GameImage({
  src: "/img/tower.png",
  width: Hexagon.height,
  height: Hexagon.height,
});

const wallImage = new GameImage({
  src: "/img/tower.png",
  width: Hexagon.height,
  height: Hexagon.height,
});

const churchImage = new GameImage({
  src: "/img/castle.png",
  width: Hexagon.height,
  height: Hexagon.height,
});

//
// Landscape
//

const unexploredImage = new GameImage({
  src: "/img/unexplored2.png",
  width: Hexagon.height,
  height: Hexagon.height,
});
const grassImage = new GameImage({
  src: "/img/grass.svg",
  width: Hexagon.height,
  height: Hexagon.height,
});
const treeImage = new GameImage({
  src: "/img/forest.svg",
  width: Hexagon.height,
  height: Hexagon.height,
});

const sandImage = new GameImage({
  src: "/img/sand.svg",
  width: Hexagon.height,
  height: Hexagon.height,
});
const waterImage = new GameImage({
  src: "/img/water.svg",
  width: Hexagon.height,
  height: Hexagon.height,
});

const mountainImage = new GameImage({
  src: "/img/rock.png",
  width: Hexagon.height,
  height: Hexagon.height,
});

const farmImage = new GameImage({
  src: "/img/grass.svg",
  width: Hexagon.height,
  height: Hexagon.height,
});

const staticPieceImage = (player: Player, kind: PieceKind): GameImage => {
  switch (kind) {
    case PieceKind.peasant: {
      return player.type === "day" ? peasantImage : skeletonImage;
    }
    case PieceKind.king: {
      return player.type === "day" ? kingImage : skeletonImage;
    }
    case PieceKind.priest: {
      return player.type === "day" ? priestImage : skeletonImage;
    }
    case PieceKind.archAngel: {
      return player.type === "day" ? archAngelImage : skeletonImage;
    }
    default: {
      return peasantImage;
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
    case BuildingType.wall: {
      return wallImage;
    }
    case BuildingType.church: {
      return churchImage;
    }
    default: {
      return houseImage;
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
    case LandscapeType.farm: {
      return farmImage;
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
      return grassImage;
    }
  }
};

export class ImageAssets {
  readonly theme: ThemeImageAssets | undefined;

  constructor(theme?: ThemeImageAssets) {
    this.theme = theme;
  }

  pieceImage(player: Player, kind: PieceKind): GameImage {
    const themeImage = this.theme?.pieceImage(player, kind);
    if (themeImage !== undefined) return themeImage;
    return staticPieceImage(player, kind);
  }

  buildingImage(player: Player, type: BuildingType): GameImage {
    const themeImage = this.theme?.buildingImage(player, type);
    if (themeImage !== undefined) return themeImage;
    return staticBuildingImage(type);
  }

  landscapeImage(type: LandscapeType): GameImage {
    const themeImage = this.theme?.landscapeImage(type);
    if (themeImage !== undefined) return themeImage;
    return staticLandscapeImage(type);
  }

  /** Overlay for an equipment/steed key; only themes provide these */
  itemImage(itemKey: string): GameImage | undefined {
    return this.theme?.itemImage(itemKey);
  }
}

export const defaultImageAssets = new ImageAssets();
