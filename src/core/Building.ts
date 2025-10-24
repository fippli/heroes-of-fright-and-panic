import boatSrc from "../assets/boat.png";
import castleSrc from "../assets/castle.png";
import farmSrc from "../assets/farm.png";
import houseSrc from "../assets/house.png";
import towerSrc from "../assets/tower.png";
import { GameImage } from "./GameImage";
import { Hexagon } from "./Hexagon";
import { Piece } from "./Piece";
import type { Player } from "./Player";
import { ResourceMap } from "./ResourceMap";
import type { TilePosition } from "./Tile";

const tileWidth = Hexagon.width;

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
  readonly owner: Player;
  populated: boolean = false;
  walkable: boolean = false;
  viewRange: number;

  constructor({
    type,
    production,
    cost,
    walkable,
    viewRange,
    owner,
  }: {
    type: BuildingType;
    walkable: boolean;
    production: ResourceMap;
    cost: ResourceMap;
    viewRange?: number;
    owner: Player;
  }) {
    this.walkable = walkable;
    this.viewRange = viewRange ?? 1;
    this.type = type;
    this.cost = cost;
    this.production = production;
    this.owner = owner;
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

  static house(owner: Player) {
    return new Building({
      type: BuildingType.house,
      production: new ResourceMap({ food: 1 }),
      cost: new ResourceMap({ wood: 2 }),
      walkable: true,
      owner,
    });
  }

  static castle(owner: Player) {
    return new Building({
      type: BuildingType.castle,
      production: new ResourceMap({ food: 0 }),
      cost: new ResourceMap({ wood: 10, stone: 10 }),
      walkable: true,
      viewRange: 3,
      owner,
    });
  }

  static farm(owner: Player) {
    return new Building({
      type: BuildingType.farm,
      production: new ResourceMap({ food: 1 }),
      cost: new ResourceMap({ wood: 1 }),
      walkable: true,
      owner,
    });
  }

  static tower(owner: Player) {
    return new Building({
      type: BuildingType.tower,
      production: new ResourceMap({ food: 0 }),
      cost: new ResourceMap({ wood: 1, stone: 3 }),
      walkable: true,
      viewRange: 4,
      owner,
    });
  }

  static boat(owner: Player) {
    return new Building({
      type: BuildingType.boat,
      production: new ResourceMap({ food: 1 }),
      cost: new ResourceMap({ wood: 0, stone: 0, gold: 0 }),
      walkable: true,
      owner,
    });
  }

  static price(buildingType: BuildingType): ResourceMap {
    switch (buildingType) {
      case BuildingType.house: {
        return new ResourceMap({});
      }
      case BuildingType.tower: {
        return new ResourceMap({});
      }
      case BuildingType.castle: {
        return new ResourceMap({});
      }
      case BuildingType.boat: {
        return new ResourceMap({});
      }
      default: {
        return new ResourceMap({});
      }
    }
  }

  static build(buildingType: BuildingType, owner: Player) {
    if (!owner.canAfford(Building.price(buildingType))) {
      return undefined;
    }

    owner.pay(Building.price(buildingType));

    switch (buildingType) {
      case BuildingType.house: {
        return Building.house(owner);
      }
      case BuildingType.tower: {
        return Building.tower(owner);
      }

      case BuildingType.castle: {
        return Building.castle(owner);
      }
      case BuildingType.boat: {
        return Building.boat(owner);
      }
      case BuildingType.farm: {
        return Building.farm(owner);
      }
      default: {
        throw new Error(`Invalid building type: ${buildingType}`);
      }
    }
  }

  spawn(owner: Player) {
    switch (this.type) {
      case BuildingType.house: {
        return Piece.peasant(owner);
      }

      default: {
        throw new Error(`Invalid building type: ${this.type}`);
      }
    }
  }

  isOwnedBy(player: Player) {
    return this.owner === player;
  }
}
