import type { PlayerType } from "@shared/piece/index.ts";
import { ResourceMap } from "@shared/player/resource-map.ts";

export enum BuildingType {
  house = "house",
  tower = "tower",
  castle = "castle",
  wall = "wall",
  church = "church",
}

export class Building {
  readonly type: BuildingType;
  readonly owner: PlayerType;
  readonly cost: ResourceMap;
  readonly viewRange: number;
  readonly defense: number;
  readonly walkableByOwner: boolean;
  readonly walkableByEnemy: boolean;

  constructor({
    type,
    owner,
    cost,
    viewRange = 1,
    defense = 1,
    walkableByOwner = true,
    walkableByEnemy = true,
  }: {
    type: BuildingType;
    owner: PlayerType;
    cost: ResourceMap;
    viewRange?: number;
    defense?: number;
    walkableByOwner?: boolean;
    walkableByEnemy?: boolean;
  }) {
    this.type = type;
    this.owner = owner;
    this.cost = cost;
    this.viewRange = viewRange;
    this.defense = defense;
    this.walkableByOwner = walkableByOwner;
    this.walkableByEnemy = walkableByEnemy;
  }

  static house(owner: PlayerType): Building {
    return new Building({
      type: BuildingType.house,
      owner,
      cost: Building.costOf(BuildingType.house),
      viewRange: 1,
    });
  }

  static tower(owner: PlayerType): Building {
    return new Building({
      type: BuildingType.tower,
      owner,
      cost: Building.costOf(BuildingType.tower),
      viewRange: 4,
    });
  }

  static castle(owner: PlayerType): Building {
    return new Building({
      type: BuildingType.castle,
      owner,
      cost: new ResourceMap({}),
      viewRange: 3,
    });
  }

  static wall(owner: PlayerType): Building {
    return new Building({
      type: BuildingType.wall,
      owner,
      cost: Building.costOf(BuildingType.wall),
      viewRange: 0,
      walkableByOwner: true,
      walkableByEnemy: false,
    });
  }

  static church(owner: PlayerType): Building {
    return new Building({
      type: BuildingType.church,
      owner,
      cost: Building.costOf(BuildingType.church),
      viewRange: 1,
    });
  }

  static costOf(buildingType: BuildingType): ResourceMap {
    switch (buildingType) {
      case BuildingType.house:
        return new ResourceMap({ wood: 1 });
      case BuildingType.tower:
        return new ResourceMap({ stone: 10 });
      case BuildingType.wall:
        return new ResourceMap({ stone: 1 });
      case BuildingType.church:
        return new ResourceMap({ wood: 3, stone: 3 });
      case BuildingType.castle:
        return new ResourceMap({});
      default:
        return new ResourceMap({});
    }
  }

  isWalkableBy(playerType: PlayerType): boolean {
    if (playerType === this.owner) {
      return this.walkableByOwner;
    }
    return this.walkableByEnemy;
  }

  isOwnedBy(playerType: PlayerType): boolean {
    return this.owner === playerType;
  }
}
