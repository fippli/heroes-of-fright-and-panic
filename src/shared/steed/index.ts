import { ResourceMap } from "@shared/player/resource-map.ts";

export enum SteedType {
  horse = "horse",
  boat = "boat",
}

export class Steed {
  readonly type: SteedType;
  readonly cost: ResourceMap;
  readonly viewBonus: number;
  readonly moveBonus: number;
  readonly bowRangeBonus: number;
  readonly enablesWaterTravel: boolean;

  constructor({
    type,
    cost,
    viewBonus = 1,
    moveBonus = 1,
    bowRangeBonus = 1,
    enablesWaterTravel = false,
  }: {
    type: SteedType;
    cost: ResourceMap;
    viewBonus?: number;
    moveBonus?: number;
    bowRangeBonus?: number;
    enablesWaterTravel?: boolean;
  }) {
    this.type = type;
    this.cost = cost;
    this.viewBonus = viewBonus;
    this.moveBonus = moveBonus;
    this.bowRangeBonus = bowRangeBonus;
    this.enablesWaterTravel = enablesWaterTravel;
  }

  static horse(): Steed {
    return new Steed({
      type: SteedType.horse,
      cost: new ResourceMap({ food: 10 }),
    });
  }

  static boat(): Steed {
    return new Steed({
      type: SteedType.boat,
      cost: new ResourceMap({ wood: 10 }),
      enablesWaterTravel: true,
    });
  }
}
