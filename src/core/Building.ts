import castleSrc from "../assets/castle.png";
import houseSrc from "../assets/house.png";
import towerSrc from "../assets/tower.png";
import boatSrc from "../assets/boat.png";
import { GameImage } from "./GameImage";
import { Hexagon } from "./Hexagon";
import { Piece } from "./Piece";
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

export enum BuildingType {
  house = "house",
  castle = "castle",
  tower = "tower",
  boat = "boat",
}

export class Building {
  readonly image: GameImage;
  readonly type: BuildingType;
  readonly cost: {
    wood: number;
    stone: number;
    gold: number;
  };
  readonly row: number;
  readonly col: number;
  readonly foodProduction: number;

  constructor({
    type,
    row,
    col,
    foodProduction,
    cost,
  }: {
    type: BuildingType;
    row: number;
    col: number;
    foodProduction: number;
    cost: {
      wood: number;
      stone: number;
      gold: number;
    };
  }) {
    this.row = row;
    this.col = col;
    this.type = type;
    this.cost = cost;
    this.foodProduction = foodProduction;
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
        default: {
          return houseImage;
        }
      }
    })();
  }

  render(ctx: CanvasRenderingContext2D) {
    ctx.save();

    const x = Hexagon.x(this.row, this.col) - Hexagon.width / 2;
    const y = Hexagon.y(this.row) - Hexagon.height / 2;
    this.image.render(ctx, x, y);

    ctx.restore();
  }

  static house({ row, col }: { row: number; col: number }) {
    return new Building({
      type: BuildingType.house,
      row,
      col,
      foodProduction: 1,
      cost: { wood: 1, stone: 0, gold: 0 },
    });
  }

  static castle({ row, col }: { row: number; col: number }) {
    return new Building({
      type: BuildingType.castle,
      row,
      col,
      foodProduction: 10,
      cost: { wood: 10, stone: 10, gold: 10 },
    });
  }

  static tower({ row, col }: { row: number; col: number }) {
    return new Building({
      type: BuildingType.tower,
      row,
      col,
      foodProduction: 0,
      cost: { wood: 1, stone: 5, gold: 0 },
    });
  }

  static boat({ row, col }: { row: number; col: number }) {
    return new Building({
      type: BuildingType.boat,
      row,
      col,
      foodProduction: 1,
      cost: { wood: 10, stone: 0, gold: 0 },
    });
  }

  static build(
    buildingType: BuildingType,
    { row, col }: { row: number; col: number },
  ) {
    switch (buildingType) {
      case BuildingType.house: {
        return Building.house({ row, col });
      }
      case BuildingType.tower: {
        return Building.tower({ row, col });
      }

      case BuildingType.castle: {
        return Building.castle({ row, col });
      }
      case BuildingType.boat: {
        return Building.boat({ row, col });
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
