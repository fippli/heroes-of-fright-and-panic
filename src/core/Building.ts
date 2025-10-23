import boatSrc from "../assets/boat.png";
import castleSrc from "../assets/castle.png";
import farmSrc from "../assets/farm.png";
import houseSrc from "../assets/house.png";
import towerSrc from "../assets/tower.png";
import { GameImage } from "./GameImage";
import { Hexagon } from "./Hexagon";
import { Piece } from "./Piece";
import { ResourceMap } from "./ResourceMap";
import type { TilePosition } from "./Tile";

const tileWidth = Hexagon.width;
const tileHeight = Hexagon.height;

const houseImage = new GameImage({
  src: houseSrc,
  width: tileWidth,
  height: tileWidth,
});
const castleImage = new GameImage({
  src: castleSrc,
  width: tileWidth,
  height: tileWidth,
});

const towerImage = new GameImage({
  src: towerSrc,
  width: tileWidth,
  height: tileWidth,
});

const boatImage = new GameImage({
  src: boatSrc,
  width: tileWidth,
  height: tileWidth,
});

const farmImage = new GameImage({
  src: farmSrc,
  width: tileWidth,
  height: tileWidth,
});

export enum BuildingType {
  house = "house",
  castle = "castle",
  tower = "tower",
  boat = "boat",
  farm = "farm",
}

export class Building {
  readonly image: GameImage;
  readonly type: BuildingType;
  readonly cost: ResourceMap;
  readonly production: ResourceMap;
  populated: boolean = false;
  walkable: boolean = false;
  viewRange: number;

  constructor({
    type,
    production,
    cost,
    walkable,
    viewRange,
  }: {
    type: BuildingType;
    walkable: boolean;
    production: ResourceMap;
    cost: ResourceMap;
    viewRange?: number;
  }) {
    this.walkable = walkable;
    this.viewRange = viewRange ?? 1;
    this.type = type;
    this.cost = cost;
    this.production = production;
    this.image = (() => {
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
          return houseImage;
        }
      }
    })();
  }

  render(ctx: CanvasRenderingContext2D, position: TilePosition) {
    ctx.save();

    const x = Hexagon.x(position.row, position.col);
    const y = Hexagon.y(position.row);

    ctx.clip(Hexagon.path(x, y));

    this.image.render(ctx, x - Hexagon.width / 2, y - Hexagon.height / 2);

    ctx.restore();
  }

  static house() {
    return new Building({
      type: BuildingType.house,
      production: new ResourceMap({ food: 1 }),
      cost: new ResourceMap({ wood: 0, stone: 0, gold: 0 }),
      walkable: true,
    });
  }

  static castle() {
    return new Building({
      type: BuildingType.castle,
      production: new ResourceMap({ food: 0 }),
      cost: new ResourceMap({ wood: 0, stone: 0, gold: 0 }),
      walkable: true,
      viewRange: 2,
    });
  }

  static farm() {
    return new Building({
      type: BuildingType.farm,
      production: new ResourceMap({ food: 1 }),
      cost: new ResourceMap({ wood: 0, stone: 0, gold: 0 }),
      walkable: true,
    });
  }

  static tower() {
    return new Building({
      type: BuildingType.tower,
      production: new ResourceMap({ food: 0 }),
      cost: new ResourceMap({ wood: 0, stone: 0, gold: 0 }),
      walkable: true,
      viewRange: 3,
    });
  }

  static boat() {
    return new Building({
      type: BuildingType.boat,
      production: new ResourceMap({ food: 1 }),
      cost: new ResourceMap({ wood: 0, stone: 0, gold: 0 }),
      walkable: true,
    });
  }

  static build(buildingType: BuildingType) {
    switch (buildingType) {
      case BuildingType.house: {
        return Building.house();
      }
      case BuildingType.tower: {
        return Building.tower();
      }

      case BuildingType.castle: {
        return Building.castle();
      }
      case BuildingType.boat: {
        return Building.boat();
      }
      case BuildingType.farm: {
        return Building.farm();
      }
      default: {
        throw new Error(`Invalid building type: ${buildingType}`);
      }
    }
  }

  spawn(tilePosition: TilePosition) {
    switch (this.type) {
      case BuildingType.house: {
        return Piece.peasant(tilePosition);
      }

      default: {
        throw new Error(`Invalid building type: ${this.type}`);
      }
    }
  }
}
