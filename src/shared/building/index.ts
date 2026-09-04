import type { PlayerType } from "@shared/piece/index.ts";
import { createResourceMap, type ResourceMap } from "@shared/player/resource-map.ts";

export enum BuildingType {
  house = "house",
  tower = "tower",
  castle = "castle",
  wall = "wall",
  church = "church",
  dock = "dock",
}

export type Building = {
  readonly type: BuildingType;
  readonly owner: PlayerType;
  readonly cost: ResourceMap;
  readonly viewRange: number;
  readonly defense: number;
  readonly walkableByOwner: boolean;
  readonly walkableByEnemy: boolean;
  /** Houses and castles can be upgraded; other buildings stay at 1. */
  readonly level?: number;
  /** Set once the building has used its action this phase */
  readonly acted?: boolean;
  /**
   * Walls raised between towers record which hex edges they join toward
   * (direction indices 0=E … 5=NE), so the renderer can draw a continuous
   * curtain wall. Hand-placed walls have none and render as before.
   */
  readonly connections?: ReadonlyArray<number>;
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
      return createResourceMap({ stone: 5 });
    case BuildingType.wall:
      return createResourceMap({ stone: 1 });
    case BuildingType.church:
      return createResourceMap({ wood: 3, stone: 3 });
    case BuildingType.dock:
      return createResourceMap({ wood: 4 });
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

export const createTowerBuilding = (owner: PlayerType, level: number = 1): Building => ({
  type: BuildingType.tower,
  owner,
  cost: buildingCostOf(BuildingType.tower),
  viewRange: 1 + level,
  defense: level,
  walkableByOwner: true,
  walkableByEnemy: true,
  level,
});

export const CASTLE_LEVEL_NAMES: ReadonlyArray<string> = ["", "Keep", "Castle", "Citadel"];

export const TOWER_LEVEL_NAMES: ReadonlyArray<string> = ["", "Watchpost", "Watchtower", "Beacon"];

/** Cost to raise a tower from `level` to `level + 1`; null at the top */
export const towerUpgradeCost = (level: number): ResourceMap | null => {
  switch (level) {
    case 1:
      return createResourceMap({ stone: 8 });
    case 2:
      return createResourceMap({ stone: 12 });
    default:
      return null;
  }
};

/** Cost to raise a castle from `level` to `level + 1`; null at the top */
export const castleUpgradeCost = (level: number): ResourceMap | null => {
  switch (level) {
    case 1:
      return createResourceMap({ stone: 8 });
    case 2:
      return createResourceMap({ stone: 12, iron: 3 });
    default:
      return null;
  }
};

export const createCastleBuilding = (owner: PlayerType, level: number = 1): Building => ({
  type: BuildingType.castle,
  owner,
  cost: createResourceMap(),
  viewRange: 1 + level,
  defense: 1 + level,
  walkableByOwner: true,
  walkableByEnemy: true,
  level,
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

export const createDockBuilding = (owner: PlayerType): Building => ({
  type: BuildingType.dock,
  owner,
  cost: buildingCostOf(BuildingType.dock),
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
    case BuildingType.dock:
      return createDockBuilding(owner);
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
