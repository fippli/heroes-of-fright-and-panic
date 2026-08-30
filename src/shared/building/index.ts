import type { PlayerType } from "@shared/piece/index.ts";
import { createResourceMap, type ResourceMap } from "@shared/player/resource-map.ts";

export enum BuildingType {
  house = "house",
  tower = "tower",
  castle = "castle",
  wall = "wall",
  church = "church",
}

export type Building = {
  readonly type: BuildingType;
  readonly owner: PlayerType;
  readonly cost: ResourceMap;
  readonly viewRange: number;
  readonly defense: number;
  readonly walkableByOwner: boolean;
  readonly walkableByEnemy: boolean;
  /** Houses can be upgraded: 1 house, 2 homestead, 3 manor. Other buildings stay at 1. */
  readonly level?: number;
};

export const MAX_HOUSE_LEVEL = 3;

export const HOUSE_LEVEL_NAMES: ReadonlyArray<string> = ["", "House", "Homestead", "Manor"];

export const buildingLevel = (building: Building): number => building.level ?? 1;

/** Cost to raise a house from `level` to `level + 1`; null when it is at the top */
export const houseUpgradeCost = (level: number): ResourceMap | null => {
  switch (level) {
    case 1:
      return createResourceMap({ wood: 3, stone: 2 });
    case 2:
      return createResourceMap({ wood: 5, stone: 5, iron: 1 });
    default:
      return null;
  }
};

export const buildingCostOf = (buildingType: BuildingType): ResourceMap => {
  switch (buildingType) {
    case BuildingType.house:
      return createResourceMap({ wood: 1 });
    case BuildingType.tower:
      return createResourceMap({ stone: 10 });
    case BuildingType.wall:
      return createResourceMap({ stone: 1 });
    case BuildingType.church:
      return createResourceMap({ wood: 3, stone: 3 });
    case BuildingType.castle:
      return createResourceMap();
    default:
      return createResourceMap();
  }
};

export const createHouseBuilding = (owner: PlayerType): Building => ({
  type: BuildingType.house,
  owner,
  cost: buildingCostOf(BuildingType.house),
  viewRange: 1,
  defense: 1,
  walkableByOwner: true,
  walkableByEnemy: true,
  level: 1,
});

export const createTowerBuilding = (owner: PlayerType): Building => ({
  type: BuildingType.tower,
  owner,
  cost: buildingCostOf(BuildingType.tower),
  viewRange: 4,
  defense: 1,
  walkableByOwner: true,
  walkableByEnemy: true,
});

export const createCastleBuilding = (owner: PlayerType): Building => ({
  type: BuildingType.castle,
  owner,
  cost: createResourceMap(),
  viewRange: 3,
  defense: 1,
  walkableByOwner: true,
  walkableByEnemy: true,
});

export const createWallBuilding = (owner: PlayerType): Building => ({
  type: BuildingType.wall,
  owner,
  cost: buildingCostOf(BuildingType.wall),
  viewRange: 0,
  defense: 1,
  walkableByOwner: true,
  walkableByEnemy: false,
});

export const createChurchBuilding = (owner: PlayerType): Building => ({
  type: BuildingType.church,
  owner,
  cost: buildingCostOf(BuildingType.church),
  viewRange: 1,
  defense: 1,
  walkableByOwner: true,
  walkableByEnemy: true,
});

export const createBuilding = (
  buildingType: BuildingType,
  owner: PlayerType,
): Building => {
  switch (buildingType) {
    case BuildingType.house:
      return createHouseBuilding(owner);
    case BuildingType.tower:
      return createTowerBuilding(owner);
    case BuildingType.castle:
      return createCastleBuilding(owner);
    case BuildingType.wall:
      return createWallBuilding(owner);
    case BuildingType.church:
      return createChurchBuilding(owner);
  }
};

export const isBuildingWalkableBy = (
  building: Building,
  playerType: PlayerType,
): boolean =>
  playerType === building.owner
    ? building.walkableByOwner
    : building.walkableByEnemy;

export const isBuildingOwnedBy = (
  building: Building,
  playerType: PlayerType,
): boolean => building.owner === playerType;
