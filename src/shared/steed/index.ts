import { createResourceMap, type ResourceMap } from "@shared/player/resource-map.ts";

export enum SteedType {
  horse = "horse",
  boat = "boat",
}

export type Steed = {
  readonly type: SteedType;
  readonly cost: ResourceMap;
  readonly viewBonus: number;
  readonly moveBonus: number;
  readonly bowRangeBonus: number;
  readonly enablesWaterTravel: boolean;
};

export const createHorse = (): Steed => ({
  type: SteedType.horse,
  cost: createResourceMap({ food: 10 }),
  viewBonus: 1,
  moveBonus: 1,
  bowRangeBonus: 1,
  enablesWaterTravel: false,
});

export const createBoat = (): Steed => ({
  type: SteedType.boat,
  cost: createResourceMap({ wood: 10 }),
  viewBonus: 1,
  moveBonus: 1,
  bowRangeBonus: 1,
  enablesWaterTravel: true,
});

export const createSteed = (steedType: SteedType): Steed => {
  switch (steedType) {
    case SteedType.horse:
      return createHorse();
    case SteedType.boat:
      return createBoat();
  }
};
